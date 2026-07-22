// ============================================================
// 快照差异比对引擎 v2
// 左右树状结构：按 WBS/名称匹配，逐行对比两棵完整任务树
// ============================================================

import {
  type TaskNode,
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
// 递归深度上限（防止循环引用导致的死循环）
// ============================================================

const MAX_DEPTH = 10

// ============================================================
// 任务扁平化
// ============================================================

function flattenTasks(tasks: TaskNode[], maxDepth = MAX_DEPTH): TaskNode[] {
  const result: TaskNode[] = []
  function walk(list: TaskNode[], depth: number) {
    if (depth > maxDepth) return
    for (const t of list) {
      result.push(t)
      if (t.children.length > 0) walk(t.children, depth + 1)
    }
  }
  walk(tasks, 0)
  return result
}

// ============================================================
// 字段级别差异
// ============================================================

const COMPARE_FIELDS: { field: string; label: string }[] = [
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
  { field: 'assignedToName', label: '负责人姓名' },
  { field: 'assignedToId', label: '负责人员工ID' },
  { field: 'assignedToRole', label: '负责人角色' },
  { field: 'type', label: '任务类型' },
]

function compareTaskFields(oldTask: TaskNode, newTask: TaskNode): TaskFieldChange[] {
  const changes: TaskFieldChange[] = []

  for (const { field, label } of COMPARE_FIELDS) {
    let oldVal: string | number | null
    let newVal: string | number | null

    if (field === 'status') {
      oldVal = oldTask.status
      newVal = newTask.status
    } else if (field === 'assignedToName') {
      oldVal = oldTask.assignedTo?.name ?? null
      newVal = newTask.assignedTo?.name ?? null
    } else if (field === 'assignedToId') {
      oldVal = oldTask.assignedTo?.id ?? null
      newVal = newTask.assignedTo?.id ?? null
    } else if (field === 'assignedToRole') {
      oldVal = oldTask.assignedTo?.role ?? null
      newVal = newTask.assignedTo?.role ?? null
    } else if (field === 'isMilestone') {
      oldVal = oldTask.isMilestone ? '是' : '否'
      newVal = newTask.isMilestone ? '是' : '否'
    } else {
      oldVal = (oldTask as unknown as Record<string, unknown>)[field] as string | number | null
      newVal = (newTask as unknown as Record<string, unknown>)[field] as string | number | null
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
  leftTask: TaskNode | null
  /** 右侧任务（null = 左侧删除） */
  rightTask: TaskNode | null
  /** 差异类型 */
  diffType: DiffType
  /** 字段变更详情 */
  changes: TaskFieldChange[]
  /** 子行 */
  children: CompareRow[]
}

/**
 * 递归构建左右树行 — 新算法
 *
 * 核心设计：
 *   1. 匹配：WBS 优先（同 WBS = 同一任务，无视 ID）
 *   2. 合并：配对成功的左右任务合并为一行（UNCHANGED 或 MODIFIED）
 *   3. 补漏：左侧独有 → REMOVED，右侧独有 → ADDED
 *   4. 子任务递归：同层同 WBS 的 children 继续递归比对
 *
 * 实现细节：
 *   每行由 wbs 唯一标识，leftTask / rightTask 分别来自左右两份任务树。
 *   左右两份数据原本就是 { meta, taskTree: [t1, t2, ...] } 的树格式，
 *   内部递归时传递的是两级对应的 children 数组，而非整个顶层结构。
 */
function buildCompareTree(
  leftChildren: TaskNode[],
  rightChildren: TaskNode[],
  level: number
): CompareRow[] {
  if (level > MAX_DEPTH) return []  // 防止死循环

  // ---- WBS 索引表：wbs → 左/右任务 ----
  const leftByWbs = new Map<string, TaskNode>()
  const rightByWbs = new Map<string, TaskNode>()

  for (const t of leftChildren) leftByWbs.set(t.wbs, t)
  for (const t of rightChildren) rightByWbs.set(t.wbs, t)

  // 收集所有出现过的 WBS（左右去重）
  const allWbs = new Set([...leftByWbs.keys(), ...rightByWbs.keys()])

  // ---- 对每一对 wbs 做匹配 ----
  const rows: CompareRow[] = []

  for (const wbs of allWbs) {
    const lt = leftByWbs.get(wbs)
    const rt = rightByWbs.get(wbs)

    if (lt && rt) {
      // 配对成功 → 合并为一行
      const changes = compareTaskFields(lt, rt)
      rows.push({
        uid: `row_${lt.id}_${rt.id}`,
        level,
        wbs,
        leftTask: lt,
        rightTask: rt,
        diffType: changes.length > 0 ? DiffType.MODIFIED : DiffType.UNCHANGED,
        changes,
        children: buildCompareTree(lt.children, rt.children, level + 1),
      })
    } else if (lt) {
      // 左侧独有 → 删除
      rows.push({
        uid: `row_removed_${lt.id}`,
        level,
        wbs,
        leftTask: lt,
        rightTask: null,
        diffType: DiffType.REMOVED,
        changes: [],
        children: buildCompareTree(lt.children, [], level + 1),
      })
    } else if (rt) {
      // 右侧独有 → 新增
      rows.push({
        uid: `row_added_${rt.id}`,
        level,
        wbs,
        leftTask: null,
        rightTask: rt,
        diffType: DiffType.ADDED,
        changes: [],
        children: buildCompareTree([], rt.children, level + 1),
      })
    }
  }

  // ---- WBS 数字序排序 ----
  rows.sort((a, b) => {
    const aParts = a.wbs.split('.').map(Number)
    const bParts = b.wbs.split('.').map(Number)
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const av = aParts[i] ?? 0
      const bv = bParts[i] ?? 0
      if (av !== bv) return av - bv
    }
    return 0
  })

  return rows
}

// ============================================================
// 关键路径差异
// ============================================================

function compareCriticalPath(
  oldTree: TaskNode[],
  newTree: TaskNode[]
): CriticalPathDiff {
  const oldFlat = flattenTasks(oldTree)
  const newFlat = flattenTasks(newTree)

  const oldCriticalIds = new Set(oldFlat.filter(t => t.cpmDates.isCritical).map(t => t.id))
  const newCriticalIds = new Set(newFlat.filter(t => t.cpmDates.isCritical).map(t => t.id))

  const oldTaskMap = new Map(oldFlat.map(t => [t.id, t]))
  const newTaskMap = new Map(newFlat.map(t => [t.id, t]))

  const addedToCriticalPath: TaskNode[] = []
  const removedFromCriticalPath: TaskNode[] = []

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
    .filter((t: TaskNode) => oldCriticalIds.has(t.id))
    .reduce((sum: number, t: TaskNode) => sum + t.cpmDates.totalFloat, 0)
  const newTotalFloat = newFlat
    .filter((t: TaskNode) => newCriticalIds.has(t.id))
    .reduce((sum: number, t: TaskNode) => sum + t.cpmDates.totalFloat, 0)

  const oldDuration = oldFlat
    .filter((t: TaskNode) => oldCriticalIds.has(t.id))
    .reduce((sum: number, t: TaskNode) => sum + t.duration, 0)
  const newDuration = newFlat
    .filter((t: TaskNode) => newCriticalIds.has(t.id))
    .reduce((sum: number, t: TaskNode) => sum + t.duration, 0)

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

  function walk(items: CompareRow[], depth: number) {
    if (depth > MAX_DEPTH) return
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
      if (r.children.length > 0) walk(r.children, depth + 1)
    }
  }
  walk(rows, 0)

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
  const oldTree = snapshot1.taskTree
  const newTree = snapshot2.taskTree

  const criticalPathDiff = compareCriticalPath(oldTree, newTree)

  const taskDiffs: TaskDiffResult[] = []

  const compareRows = buildCompareTree(oldTree, newTree, 0)

  const summary = buildSummary(compareRows)

  return {
    snapshotId1: snapshot1.id,
    snapshotId2: snapshot2.id,
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
