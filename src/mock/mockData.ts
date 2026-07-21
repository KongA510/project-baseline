// ============================================================
// 模拟数据 - Aras 项目计划结构
// 所有 id 使用 Aras Item 风格的 GUID 格式
// 前置依赖使用图中的 "N:X" 格式
// ============================================================

import {
  type ProjectPlan,
  type ProjectTask,
  type Snapshot,
  type TeamMember,
  TaskStatus,
  TaskType,
  DependencyType,
  ConstraintType,
} from '@/types'
import { calculateCriticalPath, getCriticalPathTaskIds } from '@/utils/criticalPath'

// ============================================================
// 团队成员
// ============================================================

const teamMembers: Record<string, TeamMember> = {
  zhangSan: { id: 'IDENTITY_001', name: '张三', role: '项目经理' },
  liSi: { id: 'IDENTITY_002', name: '李四', role: '结构工程师' },
  wangWu: { id: 'IDENTITY_003', name: '王五', role: '电气工程师' },
  zhaoLiu: { id: 'IDENTITY_004', name: '赵六', role: '软件工程师' },
  sunQi: { id: 'IDENTITY_005', name: '孙七', role: '测试工程师' },
  zhouBa: { id: 'IDENTITY_006', name: '周八', role: '工艺工程师' },
}

// ============================================================
// 构造任务
// ============================================================

let taskCounter = 0
function nextId(): string {
  taskCounter++
  return `TASK_${String(taskCounter).padStart(3, '0')}`
}

/** 任务计数器重置（仅用于 V2，不用于 V1） */
function resetCounter() {
  taskCounter = 0
}

// ============================================================
// 项目计划 V1（初始版本——作为快照1的基础）
// ============================================================

function createPlanV1(): ProjectPlan {
  taskCounter = 0
  // --- 顶层任务 ---
  const t1: ProjectTask = {
    id: nextId(), wbs: '1', name: '产品设计阶段', description: '完成产品整体设计',
    type: TaskType.SUMMARY, status: TaskStatus.COMPLETED, duration: 20,
    percentComplete: 100, plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-28',
    actualStartDate: '2026-06-01', actualEndDate: '2026-06-26',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhangSan, children: [], parentId: null, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t11: ProjectTask = {
    id: nextId(), wbs: '1.1', name: '需求分析', description: '收集和分析客户需求',
    type: TaskType.TASK, status: TaskStatus.COMPLETED, duration: 5,
    percentComplete: 100, plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-07',
    actualStartDate: '2026-06-01', actualEndDate: '2026-06-06',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t1.id, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t12: ProjectTask = {
    id: nextId(), wbs: '1.2', name: '概念设计', description: '产品概念方案设计',
    type: TaskType.TASK, status: TaskStatus.COMPLETED, duration: 8,
    percentComplete: 100, plannedStartDate: '2026-06-08', plannedEndDate: '2026-06-17',
    actualStartDate: '2026-06-07', actualEndDate: '2026-06-16',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_001', predecessorId: t11.id, dependencyType: DependencyType.FS, lagDays: 0 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t1.id, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t13: ProjectTask = {
    id: nextId(), wbs: '1.3', name: '详细设计', description: '产品详细工程设计',
    type: TaskType.TASK, status: TaskStatus.COMPLETED, duration: 7,
    percentComplete: 100, plannedStartDate: '2026-06-18', plannedEndDate: '2026-06-26',
    actualStartDate: '2026-06-17', actualEndDate: '2026-06-25',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_002', predecessorId: t12.id, dependencyType: DependencyType.FS, lagDays: 0 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.wangWu, children: [], parentId: t1.id, sortOrder: 3, notes: '', isMilestone: false,
  }

  const t14: ProjectTask = {
    id: nextId(), wbs: '1.4', name: '设计评审（里程碑）', description: '设计阶段评审里程碑',
    type: TaskType.MILESTONE, status: TaskStatus.COMPLETED, duration: 0,
    percentComplete: 100, plannedStartDate: '2026-06-28', plannedEndDate: '2026-06-28',
    actualStartDate: '2026-06-26', actualEndDate: '2026-06-26',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_003', predecessorId: t13.id, dependencyType: DependencyType.FS, lagDays: 2 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhangSan, children: [], parentId: t1.id, sortOrder: 4, notes: '关键里程碑', isMilestone: true,
  }

  t1.children = [t11, t12, t13, t14]

  // --- 顶层任务 2 ---
  const t2: ProjectTask = {
    id: nextId(), wbs: '2', name: '零部件采购与制造', description: '核心零部件采购和外协制造',
    type: TaskType.SUMMARY, status: TaskStatus.IN_PROGRESS, duration: 40,
    percentComplete: 60, plannedStartDate: '2026-07-01', plannedEndDate: '2026-08-25',
    actualStartDate: '2026-07-01', actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_004', predecessorId: t14.id, dependencyType: DependencyType.FS, lagDays: 3 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhouBa, children: [], parentId: null, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t21: ProjectTask = {
    id: nextId(), wbs: '2.1', name: '核心部件采购', description: '关键机械部件采购',
    type: TaskType.TASK, status: TaskStatus.IN_PROGRESS, duration: 15,
    percentComplete: 80, plannedStartDate: '2026-07-01', plannedEndDate: '2026-07-21',
    actualStartDate: '2026-07-01', actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t2.id, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t22: ProjectTask = {
    id: nextId(), wbs: '2.2', name: '电气元件采购', description: 'PLC和传感器采购',
    type: TaskType.TASK, status: TaskStatus.IN_PROGRESS, duration: 12,
    percentComplete: 50, plannedStartDate: '2026-07-01', plannedEndDate: '2026-07-16',
    actualStartDate: '2026-07-01', actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.wangWu, children: [], parentId: t2.id, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t23: ProjectTask = {
    id: nextId(), wbs: '2.3', name: '外协加工', description: '机加工外协',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 20,
    percentComplete: 0, plannedStartDate: '2026-07-22', plannedEndDate: '2026-08-18',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [
      { id: 'PRED_005', predecessorId: t21.id, dependencyType: DependencyType.FS, lagDays: 1 },
      { id: 'PRED_006', predecessorId: t22.id, dependencyType: DependencyType.FS, lagDays: 6 },
    ],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhouBa, children: [], parentId: t2.id, sortOrder: 3, notes: '', isMilestone: false,
  }

  const t24: ProjectTask = {
    id: nextId(), wbs: '2.4', name: '来料检验', description: '所有外购和加工件检验',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 5,
    percentComplete: 0, plannedStartDate: '2026-08-19', plannedEndDate: '2026-08-25',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_007', predecessorId: t23.id, dependencyType: DependencyType.FS, lagDays: 0 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t2.id, sortOrder: 4, notes: '', isMilestone: false,
  }

  t2.children = [t21, t22, t23, t24]

  // --- 顶层任务 3 ---
  const t3: ProjectTask = {
    id: nextId(), wbs: '3', name: '系统装配', description: '产品整机装配',
    type: TaskType.SUMMARY, status: TaskStatus.PENDING, duration: 25,
    percentComplete: 0, plannedStartDate: '2026-08-26', plannedEndDate: '2026-09-29',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_008', predecessorId: t24.id, dependencyType: DependencyType.FS, lagDays: 1 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhouBa, children: [], parentId: null, sortOrder: 3, notes: '', isMilestone: false,
  }

  const t31: ProjectTask = {
    id: nextId(), wbs: '3.1', name: '机械装配', description: '机械结构件装配',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 15,
    percentComplete: 0, plannedStartDate: '2026-08-26', plannedEndDate: '2026-09-15',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t3.id, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t32: ProjectTask = {
    id: nextId(), wbs: '3.2', name: '电气装配', description: '电气柜和线缆装配',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 10,
    percentComplete: 0, plannedStartDate: '2026-09-01', plannedEndDate: '2026-09-14',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_009', predecessorId: t31.id, dependencyType: DependencyType.SS, lagDays: 5 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.wangWu, children: [], parentId: t3.id, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t33: ProjectTask = {
    id: nextId(), wbs: '3.3', name: '装配检验', description: '装配完成后检验',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 3,
    percentComplete: 0, plannedStartDate: '2026-09-25', plannedEndDate: '2026-09-29',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [
      { id: 'PRED_010', predecessorId: t31.id, dependencyType: DependencyType.FS, lagDays: 1 },
      { id: 'PRED_011', predecessorId: t32.id, dependencyType: DependencyType.FS, lagDays: 1 },
    ],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.sunQi, children: [], parentId: t3.id, sortOrder: 3, notes: '', isMilestone: false,
  }

  t3.children = [t31, t32, t33]

  // --- 顶层任务 4 ---
  const t4: ProjectTask = {
    id: nextId(), wbs: '4', name: '系统调试与测试', description: '整机调试和性能测试',
    type: TaskType.SUMMARY, status: TaskStatus.PENDING, duration: 30,
    percentComplete: 0, plannedStartDate: '2026-10-01', plannedEndDate: '2026-11-11',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_012', predecessorId: t33.id, dependencyType: DependencyType.FS, lagDays: 2 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhaoLiu, children: [], parentId: null, sortOrder: 4, notes: '', isMilestone: false,
  }

  const t41: ProjectTask = {
    id: nextId(), wbs: '4.1', name: '功能调试', description: '基本功能调试',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 12,
    percentComplete: 0, plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-16',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhaoLiu, children: [], parentId: t4.id, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t42: ProjectTask = {
    id: nextId(), wbs: '4.2', name: '性能测试', description: '各种工况性能测试',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 10,
    percentComplete: 0, plannedStartDate: '2026-10-17', plannedEndDate: '2026-10-30',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_013', predecessorId: t41.id, dependencyType: DependencyType.FS, lagDays: 1 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.sunQi, children: [], parentId: t4.id, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t43: ProjectTask = {
    id: nextId(), wbs: '4.3', name: '验收测试（里程碑）', description: '客户验收测试',
    type: TaskType.MILESTONE, status: TaskStatus.PENDING, duration: 0,
    percentComplete: 0, plannedStartDate: '2026-11-11', plannedEndDate: '2026-11-11',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.MFO, constraintDate: '2026-11-11',
    predecessors: [{ id: 'PRED_014', predecessorId: t42.id, dependencyType: DependencyType.FS, lagDays: 0 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhangSan, children: [], parentId: t4.id, sortOrder: 3, notes: '最终验收里程碑', isMilestone: true,
  }

  t4.children = [t41, t42, t43]

  const allTasks = [
    t1, t11, t12, t13, t14,
    t2, t21, t22, t23, t24,
    t3, t31, t32, t33,
    t4, t41, t42, t43,
  ]

  // 运行关键路径计算
  const calculatedTasks = calculateCriticalPath(allTasks, '2026-06-01', '2026-12-31')

  // 重建树结构
  function rebuildTree(flat: ProjectTask[]): ProjectTask[] {
    const map = new Map<string, ProjectTask>(flat.map(t => [t.id, { ...t, children: [] as ProjectTask[] }]))
    const roots: ProjectTask[] = []
    for (const t of map.values()) {
      if (t.parentId && map.has(t.parentId)) {
        map.get(t.parentId)!.children.push(t)
      } else if (!t.parentId) {
        roots.push(t)
      }
    }
    // 递归排序
    function sortChildren(task: ProjectTask) {
      task.children.sort((a: ProjectTask, b: ProjectTask) => a.sortOrder - b.sortOrder)
      task.children.forEach(sortChildren)
    }
    roots.sort((a: ProjectTask, b: ProjectTask) => a.sortOrder - b.sortOrder)
    roots.forEach(sortChildren)
    return roots
  }

  const rootedTasks = rebuildTree(calculatedTasks)

  return {
    id: 'PROJECT_PLAN_001',
    name: '智能装配线开发项目',
    projectNumber: 'PRJ-2026-0001',
    targetStartDate: '2026-06-01',
    targetEndDate: '2026-12-31',
    tasks: rootedTasks,
    status: 'Active',
    projectManager: teamMembers.zhangSan,
  }
}

// ============================================================
// 项目计划 V2（变更后版本——作为快照2的基础）
// 模拟变化：
//   - 新增任务 "1.5 安全审查"
//   - 删除任务 "2.2 电气元件采购" → 替换为 "2.2 一体化电气模组采购"
//   - 任务 "3.1 机械装配" 工期从 15→18 天
//   - 任务 "4.1 功能调试" 状态变为进行中
//   - 任务 "3.2 电气装配" 工期从 10→8 天
//   - 关键路径可能变化
// ============================================================

function createPlanV2(): ProjectPlan {
  resetCounter() // 重置计数器确保与 V1 完全一致

  const t1: ProjectTask = {
    id: nextId(), wbs: '1', name: '产品设计阶段', description: '完成产品整体设计',
    type: TaskType.SUMMARY, status: TaskStatus.COMPLETED, duration: 25,
    percentComplete: 100, plannedStartDate: '2026-06-01', plannedEndDate: '2026-07-05',
    actualStartDate: '2026-06-01', actualEndDate: '2026-07-03',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhangSan, children: [], parentId: null, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t11: ProjectTask = {
    id: nextId(), wbs: '1.1', name: '需求分析', description: '收集和分析客户需求',
    type: TaskType.TASK, status: TaskStatus.COMPLETED, duration: 5,
    percentComplete: 100, plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-07',
    actualStartDate: '2026-06-01', actualEndDate: '2026-06-06',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t1.id, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t12: ProjectTask = {
    id: nextId(), wbs: '1.2', name: '概念设计', description: '产品概念方案设计',
    type: TaskType.TASK, status: TaskStatus.COMPLETED, duration: 8,
    percentComplete: 100, plannedStartDate: '2026-06-08', plannedEndDate: '2026-06-17',
    actualStartDate: '2026-06-07', actualEndDate: '2026-06-16',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_001', predecessorId: t11.id, dependencyType: DependencyType.FS, lagDays: 0 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t1.id, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t13: ProjectTask = {
    id: nextId(), wbs: '1.3', name: '详细设计', description: '产品详细工程设计',
    type: TaskType.TASK, status: TaskStatus.COMPLETED, duration: 7,
    percentComplete: 100, plannedStartDate: '2026-06-18', plannedEndDate: '2026-06-26',
    actualStartDate: '2026-06-17', actualEndDate: '2026-06-25',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_002', predecessorId: t12.id, dependencyType: DependencyType.FS, lagDays: 0 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.wangWu, children: [], parentId: t1.id, sortOrder: 3, notes: '', isMilestone: false,
  }

  // ★ 新增任务
  const t15: ProjectTask = {
    id: nextId(), wbs: '1.5', name: '安全审查', description: '产品安全性设计审查（新增）',
    type: TaskType.TASK, status: TaskStatus.COMPLETED, duration: 3,
    percentComplete: 100, plannedStartDate: '2026-06-27', plannedEndDate: '2026-06-29',
    actualStartDate: '2026-06-26', actualEndDate: '2026-06-28',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_NEW', predecessorId: t13.id, dependencyType: DependencyType.FS, lagDays: 1 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.sunQi, children: [], parentId: t1.id, sortOrder: 4, notes: 'V2新增安全审查任务', isMilestone: false,
  }

  const t14: ProjectTask = {
    id: nextId(), wbs: '1.4', name: '设计评审（里程碑）', description: '设计阶段评审里程碑',
    type: TaskType.MILESTONE, status: TaskStatus.COMPLETED, duration: 0,
    percentComplete: 100, plannedStartDate: '2026-07-05', plannedEndDate: '2026-07-05',
    actualStartDate: '2026-07-03', actualEndDate: '2026-07-03',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_003', predecessorId: t15.id, dependencyType: DependencyType.FS, lagDays: 6 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhangSan, children: [], parentId: t1.id, sortOrder: 5, notes: '关键里程碑', isMilestone: true,
  }

  t1.children = [t11, t12, t13, t15, t14]

  // --- 顶层任务 2（变更后） ---
  const t2: ProjectTask = {
    id: nextId(), wbs: '2', name: '零部件采购与制造', description: '核心零部件采购和外协制造',
    type: TaskType.SUMMARY, status: TaskStatus.IN_PROGRESS, duration: 43,
    percentComplete: 65, plannedStartDate: '2026-07-06', plannedEndDate: '2026-09-04',
    actualStartDate: '2026-07-06', actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_004', predecessorId: t14.id, dependencyType: DependencyType.FS, lagDays: 1 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhouBa, children: [], parentId: null, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t21: ProjectTask = {
    id: nextId(), wbs: '2.1', name: '核心部件采购', description: '关键机械部件采购',
    type: TaskType.TASK, status: TaskStatus.COMPLETED, duration: 15,
    percentComplete: 100, plannedStartDate: '2026-07-06', plannedEndDate: '2026-07-26',
    actualStartDate: '2026-07-06', actualEndDate: '2026-07-25',
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t2.id, sortOrder: 1, notes: '', isMilestone: false,
  }

  // ★ 新任务替换旧任务 "2.2 电气元件采购" → "2.2 一体化电气模组采购"
  const t22New: ProjectTask = {
    id: nextId(), wbs: '2.2', name: '一体化电气模组采购', description: 'PLC+传感器一体化模组采购（替换原电气元件采购）',
    type: TaskType.TASK, status: TaskStatus.IN_PROGRESS, duration: 18,
    percentComplete: 40, plannedStartDate: '2026-07-06', plannedEndDate: '2026-07-30',
    actualStartDate: '2026-07-06', actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.wangWu, children: [], parentId: t2.id, sortOrder: 2, notes: 'V2替换为一体化模组采购', isMilestone: false,
  }

  const t23: ProjectTask = {
    id: nextId(), wbs: '2.3', name: '外协加工', description: '机加工外协',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 20,
    percentComplete: 0, plannedStartDate: '2026-07-31', plannedEndDate: '2026-08-27',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [
      { id: 'PRED_005', predecessorId: t21.id, dependencyType: DependencyType.FS, lagDays: 1 },
      { id: 'PRED_006', predecessorId: t22New.id, dependencyType: DependencyType.FS, lagDays: 1 },
    ],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhouBa, children: [], parentId: t2.id, sortOrder: 3, notes: '', isMilestone: false,
  }

  const t24: ProjectTask = {
    id: nextId(), wbs: '2.4', name: '来料检验', description: '所有外购和加工件检验',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 5,
    percentComplete: 0, plannedStartDate: '2026-08-28', plannedEndDate: '2026-09-04',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_007', predecessorId: t23.id, dependencyType: DependencyType.FS, lagDays: 1 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t2.id, sortOrder: 4, notes: '', isMilestone: false,
  }

  t2.children = [t21, t22New, t23, t24]

  // --- 顶层任务 3 ---
  const t3: ProjectTask = {
    id: nextId(), wbs: '3', name: '系统装配', description: '产品整机装配',
    type: TaskType.SUMMARY, status: TaskStatus.PENDING, duration: 28, // 工期延长
    percentComplete: 0, plannedStartDate: '2026-09-05', plannedEndDate: '2026-10-13',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_008', predecessorId: t24.id, dependencyType: DependencyType.FS, lagDays: 1 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhouBa, children: [], parentId: null, sortOrder: 3, notes: '', isMilestone: false,
  }

  const t31: ProjectTask = {
    id: nextId(), wbs: '3.1', name: '机械装配', description: '机械结构件装配',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 18, // ★ 从 15→18天
    percentComplete: 0, plannedStartDate: '2026-09-05', plannedEndDate: '2026-09-30',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.liSi, children: [], parentId: t3.id, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t32: ProjectTask = {
    id: nextId(), wbs: '3.2', name: '电气装配', description: '电气柜和线缆装配',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 8, // ★ 从 10→8天
    percentComplete: 0, plannedStartDate: '2026-09-10', plannedEndDate: '2026-09-21',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_009', predecessorId: t31.id, dependencyType: DependencyType.SS, lagDays: 5 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.wangWu, children: [], parentId: t3.id, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t33: ProjectTask = {
    id: nextId(), wbs: '3.3', name: '装配检验', description: '装配完成后检验',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 3,
    percentComplete: 0, plannedStartDate: '2026-10-08', plannedEndDate: '2026-10-13',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [
      { id: 'PRED_010', predecessorId: t31.id, dependencyType: DependencyType.FS, lagDays: 1 },
      { id: 'PRED_011', predecessorId: t32.id, dependencyType: DependencyType.FS, lagDays: 1 },
    ],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.sunQi, children: [], parentId: t3.id, sortOrder: 3, notes: '', isMilestone: false,
  }

  t3.children = [t31, t32, t33]

  // --- 顶层任务 4 ---
  const t4: ProjectTask = {
    id: nextId(), wbs: '4', name: '系统调试与测试', description: '整机调试和性能测试',
    type: TaskType.SUMMARY, status: TaskStatus.PENDING, duration: 30,
    percentComplete: 0, plannedStartDate: '2026-10-15', plannedEndDate: '2026-11-25',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_012', predecessorId: t33.id, dependencyType: DependencyType.FS, lagDays: 2 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhaoLiu, children: [], parentId: null, sortOrder: 4, notes: '', isMilestone: false,
  }

  const t41: ProjectTask = {
    id: nextId(), wbs: '4.1', name: '功能调试', description: '基本功能调试',
    type: TaskType.TASK, status: TaskStatus.IN_PROGRESS, duration: 12, // ★ 状态从 PENDING→IN_PROGRESS
    percentComplete: 30, plannedStartDate: '2026-10-15', plannedEndDate: '2026-10-30',
    actualStartDate: '2026-10-15', actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhaoLiu, children: [], parentId: t4.id, sortOrder: 1, notes: '', isMilestone: false,
  }

  const t42: ProjectTask = {
    id: nextId(), wbs: '4.2', name: '性能测试', description: '各种工况性能测试',
    type: TaskType.TASK, status: TaskStatus.PENDING, duration: 10,
    percentComplete: 0, plannedStartDate: '2026-10-31', plannedEndDate: '2026-11-13',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [{ id: 'PRED_013', predecessorId: t41.id, dependencyType: DependencyType.FS, lagDays: 1 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.sunQi, children: [], parentId: t4.id, sortOrder: 2, notes: '', isMilestone: false,
  }

  const t43: ProjectTask = {
    id: nextId(), wbs: '4.3', name: '验收测试（里程碑）', description: '客户验收测试',
    type: TaskType.MILESTONE, status: TaskStatus.PENDING, duration: 0,
    percentComplete: 0, plannedStartDate: '2026-11-25', plannedEndDate: '2026-11-25',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.MFO, constraintDate: '2026-11-25',
    predecessors: [{ id: 'PRED_014', predecessorId: t42.id, dependencyType: DependencyType.FS, lagDays: 0 }],
    cpmDates: { earliestStart: null, earliestFinish: null, latestStart: null, latestFinish: null, totalFloat: 0, freeFloat: 0, isCritical: false },
    assignedTo: teamMembers.zhangSan, children: [], parentId: t4.id, sortOrder: 3, notes: '最终验收里程碑', isMilestone: true,
  }

  t4.children = [t41, t42, t43]

  const allTasks = [
    t1, t11, t12, t13, t14, t15,
    t2, t21, t22New, t23, t24,
    t3, t31, t32, t33,
    t4, t41, t42, t43,
  ]

  const calculatedTasks = calculateCriticalPath(allTasks, '2026-06-01', '2026-12-31')

  function rebuildTree(flat: ProjectTask[]): ProjectTask[] {
    const map = new Map<string, ProjectTask>(flat.map(t => [t.id, { ...t, children: [] as ProjectTask[] }]))
    const roots: ProjectTask[] = []
    for (const t of map.values()) {
      if (t.parentId && map.has(t.parentId)) {
        map.get(t.parentId)!.children.push(t)
      } else if (!t.parentId) {
        roots.push(t)
      }
    }
    function sortChildren(task: ProjectTask) {
      task.children.sort((a: ProjectTask, b: ProjectTask) => a.sortOrder - b.sortOrder)
      task.children.forEach(sortChildren)
    }
    roots.sort((a: ProjectTask, b: ProjectTask) => a.sortOrder - b.sortOrder)
    roots.forEach(sortChildren)
    return roots
  }

  const rootedTasks = rebuildTree(calculatedTasks)

  return {
    id: 'PROJECT_PLAN_001',
    name: '智能装配线开发项目',
    projectNumber: 'PRJ-2026-0001',
    targetStartDate: '2026-06-01',
    targetEndDate: '2026-12-31',
    tasks: rootedTasks,
    status: 'Active',
    projectManager: teamMembers.zhangSan,
  }
}

// ============================================================
// 生成快照工具函数
// ============================================================

function snapshotPlan(
  plan: ProjectPlan,
  name: string,
  description: string,
  createdAt: string,
  fixedId: string
): Snapshot {
  const criticalPath = getCriticalPathTaskIds(flatTasks(plan.tasks))
  const flat = flatTasks(plan.tasks)

  return {
    meta: {
      id: fixedId,
      name,
      createdAt,
      description,
      projectPlanId: plan.id,
      criticalPath,
      projectedEndDate: plan.targetEndDate,
      totalTasks: flat.length,
      completedTasks: flat.filter(t => t.status === TaskStatus.COMPLETED).length,
      overallPercentComplete: Math.round(
        flat.reduce((sum, t) => sum + t.percentComplete, 0) / flat.length
      ),
    },
    plan: JSON.parse(JSON.stringify(plan)), // 深拷贝冻结
  }
}

function flatTasks(tasks: ProjectTask[]): ProjectTask[] {
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
// 预生成快照列表
// ============================================================

export function loadMockSnapshots(): Snapshot[] {
  const plan1 = createPlanV1()
  const plan2 = createPlanV2()

  return [
    snapshotPlan(plan1, '基线 V1.0 - 初始计划', '2026年6月初始项目计划基线', '2026-06-01T00:00:00Z', 'SNAP_V1_0'),
    snapshotPlan(plan1, '快照 V1.1 - 设计完成', '设计阶段完成时的状态冻结', '2026-06-28T00:00:00Z', 'SNAP_V1_1'),
    snapshotPlan(plan2, '快照 V2.0 - 采购阶段更新', '采购阶段根据实际情况调整计划', '2026-07-20T00:00:00Z', 'SNAP_V2_0'),
  ]
}

/** 获取所有快照（从 Pinia Store 或首次加载） */
export { teamMembers }
