// ============================================================
// 快照差异比对引擎 v2
// 左右树状结构：按 WBS/名称匹配，逐行对比两棵完整任务树
// ============================================================

import {
  type ProjectTask,
  type ProjectPlan,
  type Snapshot,
  type ComparisonResult,
  type TaskDiffResult,
  type TaskFieldChange,
  type CriticalPathDiff,
  type DiffSummary,
  type TaskPredecessor,
  DiffType,
  TaskStatus,
} from '@/types'
import { getCriticalPathTaskIds } from './criticalPath'

// ============================================================
// 任务扁平化
// ============================================================

function flattenTasks(tasks: ProjectTask[]): ProjectTask[] {
  const result: ProjectTask[] = []
  function walk(list: ProjectTask[]) {
    for (const t of list) {
      result.push(t)
      if (t.children.length > 0) walk(t.children)
    }
  }
  walk(tasks)
  return result
}

// ============================================================
// 字段级别差异
// ============================================================

const COMPARE_FIELDS: { field: keyof ProjectTask; label: string }[] = [
  { field: 'name', label: '任务名称' },
  { field: 'status', label: '任务状态' },
  { field: 'duration', label: '工期（天）' },
  { field: 'percentComplete', label: '完成百分比' },
  { field: 'plannedStartDate', label: '计划开始日期' },
  { field: 'plannedEndDate', label: '计划完成日期' },
  { field: 'actualStartDate', label: '实际开始日期' },
  { field: 'actualEndDate', label: '实际完成日期' },
  { field: 'targetStartDate', label: '目标开始日期' },
  { field: 'targetEndDate', label: '目标完成日期' },
  { field: 'constraintType', label: '约束类型' },
  { field: 'constraintDate', label: '约束日期' },
  { field: 'isMilestone', label: '是否里程碑' },
  { field: 'notes', label: '备注' },
  { field: 'assignedTo', label: '负责人' },
  { field: 'type', label: '任务类型' },
]

function compareTaskFields(oldTask: ProjectTask, newTask: ProjectTask): TaskFieldChange[] {
  const changes: TaskFieldChange[] = []

  for (const { field, label } of COMPARE_FIELDS) {
    let oldVal: string | number | null
    let newVal: string | number | null

    if (field === 'status') {
      oldVal = oldTask.status
      newVal = newTask.status
    } else if (field === 'assignedTo') {
      oldVal = oldTask.assignedTo?.name ?? null
      newVal = newTask.assignedTo?.name ?? null
    } else if (field === 'isMilestone') {
      oldVal = oldTask.isMilestone ? '是' : '否'
      newVal = newTask.isMilestone ? '是' : '否'
    } else {
      oldVal = oldTask[field] as string | number | null
      newVal = newTask[field] as string | number | null
    }

    const ov = oldVal === '' || oldVal === undefined ? null : oldVal
    const nv = newVal === '' || newVal === undefined ? null : newVal

    if (ov !== nv) {
      changes.push({ field, fieldLabel: label, oldValue: ov, newValue: nv })
    }
  }

  // 前置依赖变化
  const oldPreds = JSON.stringify(
    oldTask.predecessors.map((p: TaskPredecessor) => `${p.predecessorId}:${p.dependencyType}:${p.lagDays}`).sort()
  )
  const newPreds = JSON.stringify(
    newTask.predecessors.map((p: TaskPredecessor) => `${p.predecessorId}:${p.dependencyType}:${p.lagDays}`).sort()
  )
  if (oldPreds !== newPreds) {
    changes.push({
      field: 'predecessors',
      fieldLabel: '前置依赖',
      oldValue: oldPreds || '(无)',
      newValue: newPreds || '(无)',
    })
  }

  // 关键路径状态
  if (oldTask.cpmDates.isCritical !== newTask.cpmDates.isCritical) {
    changes.push({
      field: 'cpmDates.isCritical',
      fieldLabel: '关键路径',
      oldValue: oldTask.cpmDates.isCritical ? '是' : '否',
      newValue: newTask.cpmDates.isCritical ? '是' : '否',
    })
  }

  return changes
}

// ============================================================
// 左右树行结构
// ============================================================

/** 单行的比对展示数据 */
export interface CompareRow {
  /** 行唯一标识 */
  uid: string
  /** 层级 */
  level: number
  /** WBS */
  wbs: string
  /** 左侧任务（null = 右侧新增） */
  leftTask: ProjectTask | null
  /** 右侧任务（null = 左侧删除） */
  rightTask: ProjectTask | null
  /** 差异类型 */
  diffType: DiffType
  /** 字段变更详情 */
  changes: TaskFieldChange[]
  /** 子行 */
  children: CompareRow[]
}

/**
 * 递归构建左右树行
 * 匹配规则：同级按 WBS 前缀匹配，其次按 task id 匹配
 */
function buildCompareTree(
  leftChildren: ProjectTask[],
  rightChildren: ProjectTask[],
  level: number
): CompareRow[] {
  // 分别排序
  const sortedLeft = [...leftChildren].sort((a, b) => a.sortOrder - b.sortOrder)
  const sortedRight = [...rightChildren].sort((a, b) => a.sortOrder - b.sortOrder)

  // 匹配左右任务：优先按 WBS 匹配
  const leftMatched = new Set<string>()
  const rightMatched = new Set<string>()

  const pairedRows: CompareRow[] = []

  // 第一轮：按 id 精确匹配
  for (const lt of sortedLeft) {
    const rt = sortedRight.find(r => r.id === lt.id && !rightMatched.has(r.id))
    if (rt) {
      leftMatched.add(lt.id)
      rightMatched.add(rt.id)
    }
  }

  // 第二轮：按 WBS 匹配未匹配的
  for (const lt of sortedLeft) {
    if (leftMatched.has(lt.id)) continue
    const rt = sortedRight.find(r => r.wbs === lt.wbs && !rightMatched.has(r.id))
    if (rt) {
      leftMatched.add(lt.id)
      rightMatched.add(rt.id)
    }
  }

  // 第三轮：按名称匹配（同层级且名称相同视为同一任务）
  for (const lt of sortedLeft) {
    if (leftMatched.has(lt.id)) continue
    const rt = sortedRight.find(r => r.name === lt.name && !rightMatched.has(r.id))
    if (rt) {
      leftMatched.add(lt.id)
      rightMatched.add(rt.id)
    }
  }

  // 构建行：按原始排序合并
  let leftIdx = 0
  let rightIdx = 0
  const allRows: CompareRow[] = []
  const leftSeen = new Set<string>()
  const rightSeen = new Set<string>()

  // 将匹配的左右任务插入，保持原始排序
  while (leftIdx < sortedLeft.length || rightIdx < sortedRight.length) {
    let leftTask: ProjectTask | null = null
    let rightTask: ProjectTask | null = null

    if (leftIdx < sortedLeft.length) {
      leftTask = sortedLeft[leftIdx]
    }
    if (rightIdx < sortedRight.length) {
      rightTask = sortedRight[rightIdx]
    }

    if (leftTask && rightTask) {
      if (leftTask.id === rightTask.id ||
          (leftMatched.has(leftTask.id) && rightMatched.has(rightTask.id) &&
           leftTask.wbs === rightTask.wbs)) {
        // 已匹配对
        const changes = compareTaskFields(leftTask, rightTask)
        const dt = changes.length > 0 ? DiffType.MODIFIED : DiffType.UNCHANGED
        allRows.push({
          uid: `row_${leftTask.id}_${rightTask.id}`,
          level,
          wbs: rightTask.wbs,
          leftTask,
          rightTask,
          diffType: dt,
          changes,
          children: buildCompareTree(leftTask.children, rightTask.children, level + 1),
        })
        leftSeen.add(leftTask.id)
        rightSeen.add(rightTask.id)
        leftIdx++
        rightIdx++
      } else if (leftMatched.has(leftTask.id) && !rightMatched.has(rightTask.id)) {
        // rightTask 未匹配 → 右侧新增
        allRows.push({
          uid: `row_added_${rightTask.id}`,
          level,
          wbs: rightTask.wbs,
          leftTask: null,
          rightTask,
          diffType: DiffType.ADDED,
          changes: [],
          children: buildCompareTree([], rightTask.children, level + 1),
        })
        rightSeen.add(rightTask.id)
        rightIdx++
      } else if (!leftMatched.has(leftTask.id) && rightMatched.has(rightTask.id)) {
        // leftTask 未匹配 → 左侧删除
        allRows.push({
          uid: `row_removed_${leftTask.id}`,
          level,
          wbs: leftTask.wbs,
          leftTask,
          rightTask: null,
          diffType: DiffType.REMOVED,
          changes: [],
          children: buildCompareTree(leftTask.children, [], level + 1),
        })
        leftSeen.add(leftTask.id)
        leftIdx++
      } else {
        // 都不匹配 → 分别处理
        if (!leftMatched.has(leftTask.id)) {
          allRows.push({
            uid: `row_removed_${leftTask.id}`,
            level,
            wbs: leftTask.wbs,
            leftTask,
            rightTask: null,
            diffType: DiffType.REMOVED,
            changes: [],
            children: buildCompareTree(leftTask.children, [], level + 1),
          })
          leftSeen.add(leftTask.id)
        }
        leftIdx++
        if (!rightMatched.has(rightTask.id)) {
          allRows.push({
            uid: `row_added_${rightTask.id}`,
            level,
            wbs: rightTask.wbs,
            leftTask: null,
            rightTask,
            diffType: DiffType.ADDED,
            changes: [],
            children: buildCompareTree([], rightTask.children, level + 1),
          })
          rightSeen.add(rightTask.id)
        }
        rightIdx++
      }
    } else if (leftTask) {
      // 右侧无任务 → 删除
      allRows.push({
        uid: `row_removed_${leftTask.id}`,
        level,
        wbs: leftTask.wbs,
        leftTask,
        rightTask: null,
        diffType: DiffType.REMOVED,
        changes: [],
        children: buildCompareTree(leftTask.children, [], level + 1),
      })
      leftSeen.add(leftTask.id)
      leftIdx++
    } else if (rightTask) {
      // 左侧无任务 → 新增
      allRows.push({
        uid: `row_added_${rightTask.id}`,
        level,
        wbs: rightTask.wbs,
        leftTask: null,
        rightTask,
        diffType: DiffType.ADDED,
        changes: [],
        children: buildCompareTree([], rightTask.children, level + 1),
      })
      rightSeen.add(rightTask.id)
      rightIdx++
    }
  }

  // 处理间隙：按 WBS 数序排序以保持视觉对齐
  allRows.sort((a, b) => {
    const aWbs = a.wbs
    const bWbs = b.wbs
    // 按 WBS 数字排序
    const aParts = aWbs.split('.').map(Number)
    const bParts = bWbs.split('.').map(Number)
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const av = aParts[i] ?? 0
      const bv = bParts[i] ?? 0
      if (av !== bv) return av - bv
    }
    return 0
  })

  return allRows
}

// ============================================================
// 关键路径差异
// ============================================================

function compareCriticalPath(
  oldPlan: ProjectPlan,
  newPlan: ProjectPlan
): CriticalPathDiff {
  const oldCriticalIds = new Set(getCriticalPathTaskIds(oldPlan.tasks))
  const newCriticalIds = new Set(getCriticalPathTaskIds(newPlan.tasks))

  const oldFlat = flattenTasks(oldPlan.tasks)
  const newFlat = flattenTasks(newPlan.tasks)

  const oldTaskMap = new Map(oldFlat.map(t => [t.id, t]))
  const newTaskMap = new Map(newFlat.map(t => [t.id, t]))

  const addedToCriticalPath: ProjectTask[] = []
  const removedFromCriticalPath: ProjectTask[] = []

  for (const id of newCriticalIds) {
    if (!oldCriticalIds.has(id)) {
      const task = newTaskMap.get(id)
      if (task) addedToCriticalPath.push(task)
    }
  }
  for (const id of oldCriticalIds) {
    if (!newCriticalIds.has(id)) {
      const task = oldTaskMap.get(id)
      if (task) removedFromCriticalPath.push(task)
    }
  }

  const oldTotalFloat = oldFlat
    .filter((t: ProjectTask) => oldCriticalIds.has(t.id))
    .reduce((sum: number, t: ProjectTask) => sum + t.cpmDates.totalFloat, 0)
  const newTotalFloat = newFlat
    .filter((t: ProjectTask) => newCriticalIds.has(t.id))
    .reduce((sum: number, t: ProjectTask) => sum + t.cpmDates.totalFloat, 0)

  const oldDuration = oldFlat
    .filter((t: ProjectTask) => oldCriticalIds.has(t.id))
    .reduce((sum: number, t: ProjectTask) => sum + t.duration, 0)
  const newDuration = newFlat
    .filter((t: ProjectTask) => newCriticalIds.has(t.id))
    .reduce((sum: number, t: ProjectTask) => sum + t.duration, 0)

  return {
    addedToCriticalPath,
    removedFromCriticalPath,
    totalFloatChange: newTotalFloat - oldTotalFloat,
    totalDurationChange: newDuration - oldDuration,
  }
}

// ============================================================
// 统计摘要
// ============================================================

function buildSummary(rows: CompareRow[]): DiffSummary {
  let totalAdded = 0
  let totalRemoved = 0
  let totalModified = 0
  let totalUnchanged = 0
  let criticalPathAdded = 0
  let criticalPathRemoved = 0

  function walk(items: CompareRow[]) {
    for (const r of items) {
      switch (r.diffType) {
        case DiffType.ADDED:
          totalAdded++
          if (r.rightTask?.cpmDates.isCritical) criticalPathAdded++
          break
        case DiffType.REMOVED:
          totalRemoved++
          if (r.leftTask?.cpmDates.isCritical) criticalPathRemoved++
          break
        case DiffType.MODIFIED:
          totalModified++
          break
        case DiffType.UNCHANGED:
          totalUnchanged++
          break
      }
      if (r.children.length > 0) walk(r.children)
    }
  }
  walk(rows)

  return {
    totalAdded,
    totalRemoved,
    totalModified,
    totalUnchanged,
    criticalPathAdded,
    criticalPathRemoved,
  }
}

// ============================================================
// 主导出函数
// ============================================================

export function compareSnapshots(
  snapshot1: Snapshot,
  snapshot2: Snapshot
): ComparisonResult {
  const oldPlan = snapshot1.plan
  const newPlan = snapshot2.plan

  const criticalPathDiff = compareCriticalPath(oldPlan, newPlan)

  // 用旧的 diff 结果格式，taskDiffs 保留但新增 compareRows
  const taskDiffs: TaskDiffResult[] = [] // 兼容旧类型，实际用 compareRows

  const compareRows = buildCompareTree(oldPlan.tasks, newPlan.tasks, 0)

  const summary = buildSummary(compareRows)

  return {
    snapshotId1: snapshot1.meta.id,
    snapshotId2: snapshot2.meta.id,
    comparedAt: new Date().toISOString(),
    criticalPathDiff,
    taskDiffs,
    summary,
    compareRows,
  }
}

// ============================================================
// 格式化工具
// ============================================================

export function formatTaskStatus(status: string): string {
  const map: Record<string, string> = {
    [TaskStatus.PENDING]: '未开始',
    [TaskStatus.IN_PROGRESS]: '进行中',
    [TaskStatus.COMPLETED]: '已完成',
    [TaskStatus.SUSPENDED]: '暂停',
  }
  return map[status] ?? status
}

export function getDiffLabel(diffType: DiffType): string {
  switch (diffType) {
    case DiffType.ADDED: return '新增'
    case DiffType.REMOVED: return '删除'
    case DiffType.MODIFIED: return '变更'
    default: return '无变化'
  }
}
