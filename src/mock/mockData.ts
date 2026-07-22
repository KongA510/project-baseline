// ============================================================
// 模拟数据 — 正确的 WBS 结构
//
// 核心约束：
//   SUMMARY = 纯容器节点，只包含子 WBS 元素，不参与 CPM 计算
//   TASK / MILESTONE = 叶子节点，children 永远为空
//   层级深度 = SUMMARY 的嵌套层级
//
// WBS 结构（V1 基线）：
//
//   [6层深度]
//   0  1.项目启动 (SUMMARY)
//   0  ├─ 1.1 项目策划 (SUMMARY)
//   0  │  ├─ 1.1.1 章程制定 (TASK)
//   0  │  ├─ 1.1.2 团队组建 (TASK)
//   0  │  └─ 1.1.3 启动会议 (MILESTONE)
//   0  │
//   0  2.产品设计 (SUMMARY)
//   0  ├─ 2.1 需求分析 (SUMMARY)
//   0  │  ├─ 2.1.1 客户调研 (SUMMARY)
//   0  │  │  ├─ 2.1.1.1 访谈计划 (TASK)
//   0  │  │  ├─ 2.1.1.2 客户访谈 (TASK)
//   0  │  │  └─ 2.1.1.3 需求整理 (TASK)
//   0  │  ├─ 2.1.2 竞品分析 (TASK)            ← V2 删除
//   0  │  └─ 2.1.3 需求评审 (MILESTONE)
//   0  ├─ 2.2 结构设计 (SUMMARY)
//   0  │  ├─ 2.2.1 概念设计 (TASK)
//   0  │  ├─ 2.2.2 详细设计 (TASK)
//   0  │  └─ 2.2.3 DFMEA分析 (TASK)
//   0  ├─ 2.3 电气设计 (SUMMARY)
//   0  │  ├─ 2.3.1 原理图设计 (TASK)
//   0  │  ├─ 2.3.2 PCB布局 (TASK)
//   0  │  └─ 2.3.3 BOM编制 (TASK)
//   0  ├─ 2.4 安全审查 (TASK)                  ← V2 新增
//   0  └─ 2.5 设计评审 (MILESTONE)
//   0
//   0  3.采购与制造 (SUMMARY)
//   0  ├─ 3.1 零部件采购 (SUMMARY)
//   0  │  ├─ 3.1.1 核心部件采购 (TASK)
//   0  │  ├─ 3.1.2 电气元件采购 (TASK)         ← V2 名称变更为"一体化模组采购"
//   0  │  └─ 3.1.3 标准件采购 (TASK)
//   0  ├─ 3.2 外协加工 (SUMMARY)
//   0  │  ├─ 3.2.1 机加工外协 (TASK)
//   0  │  └─ 3.2.2 表面处理 (TASK)
//   0  └─ 3.3 来料检验 (TASK)
//   0
//   0  4.系统装配 (SUMMARY)
//   0  ├─ 4.1 机械装配 (TASK)
//   0  ├─ 4.2 电气装配 (TASK)
//   0  └─ 4.3 装配检验 (MILESTONE)
//   0
//   0  5.测试与验收 (SUMMARY)
//   0  ├─ 5.1 功能调试 (TASK)
//   0  ├─ 5.2 性能测试 (TASK)
//   0  ├─ 5.3 环境试验 (TASK)
//   0  └─ 5.4 验收测试 (MILESTONE)             ← V1/V2 完全不变
//
// V2 差异覆盖：
//   ADDED    → 2.4 安全审查（新增叶子 TASK）
//   REMOVED  → 2.1.2 竞品分析（删除叶子 TASK）
//   MODIFIED → 人员、工期、状态、日期、前继依赖、名称
//   UNCHANGED → 5.4 验收测试（完全不变）
// ============================================================

import {
  type Snapshot,
  type TaskNode,
  type TeamMember,
  TaskStatus,
  TaskType,
  DependencyType,
  ConstraintType,
} from '@/types'
import { calculateCriticalPath } from '@/utils/criticalPath'

// ============================================================
// 团队成员
// ============================================================

const teamMembers: Record<string, TeamMember> = {
  zhangSan: { id: 'IDENTITY_001', name: '张三', role: '项目经理' },
  liSi:     { id: 'IDENTITY_002', name: '李四', role: '结构工程师' },
  wangWu:   { id: 'IDENTITY_003', name: '王五', role: '电气工程师' },
  zhaoLiu:  { id: 'IDENTITY_004', name: '赵六', role: '软件工程师' },
  sunQi:    { id: 'IDENTITY_005', name: '孙七', role: '测试工程师' },
  zhouBa:   { id: 'IDENTITY_006', name: '周八', role: '工艺工程师' },
  wuJiu:    { id: 'IDENTITY_007', name: '吴九', role: '质量工程师' },
  qianShi:  { id: 'IDENTITY_008', name: '钱十', role: '采购专员' },
}

// ============================================================
// 工具函数
// ============================================================

let taskCounter = 0
function nextId(): string { taskCounter++; return `TASK_${String(taskCounter).padStart(3, '0')}` }
function resetCounter() { taskCounter = 0 }

const blankCpm = {
  earliestStart: null, earliestFinish: null,
  latestStart: null, latestFinish: null,
  totalFloat: 0, freeFloat: 0, isCritical: false,
}

function pred(id: string, dep = DependencyType.FS, lag = 0) {
  return { id: `PRED_${id}`, predecessorId: id, dependencyType: dep, lagDays: lag }
}

function preds(...ps: Array<{ id: string; predecessorId: string; dependencyType: DependencyType; lagDays: number }>) {
  return ps
}

/** 创建一个叶子 TASK */
function leafTask(overrides: Partial<TaskNode> & { id: string; wbs: string; name: string }): TaskNode {
  return {
    description: '', type: TaskType.TASK, status: TaskStatus.PENDING,
    duration: 5, percentComplete: 0,
    plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-07',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { ...blankCpm },
    assignedTo: null, children: [], parentId: null, sortOrder: 1,
    notes: '', isMilestone: false,
    ...overrides,
  }
}

/** 创建一个叶子 MILESTONE */
function leafMilestone(overrides: Partial<TaskNode> & { id: string; wbs: string; name: string }): TaskNode {
  return {
    description: '', type: TaskType.MILESTONE, status: TaskStatus.PENDING,
    duration: 0, percentComplete: 0,
    plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-01',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '2026-06-01', targetEndDate: '2026-12-31',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { ...blankCpm },
    assignedTo: null, children: [], parentId: null, sortOrder: 1,
    notes: '', isMilestone: true,
    ...overrides,
  }
}

/** 创建一个 SUMMARY（容器节点） */
function summaryNode(overrides: Partial<TaskNode> & { id: string; wbs: string; name: string; children: TaskNode[] }): TaskNode {
  return {
    description: '', type: TaskType.SUMMARY, status: TaskStatus.PENDING,
    duration: 0, percentComplete: 0,
    plannedStartDate: '', plannedEndDate: '',
    actualStartDate: null, actualEndDate: null,
    targetStartDate: '', targetEndDate: '',
    constraintType: ConstraintType.ASAP, constraintDate: null,
    predecessors: [], cpmDates: { ...blankCpm },
    assignedTo: null, parentId: null, sortOrder: 1,
    notes: '', isMilestone: false,
    ...overrides,
  }
}

// ============================================================
// V1 基线
// ============================================================

function createPlanV1(): TaskNode[] {
  resetCounter()

  // ─── 1.项目启动 ───
  const t111 = leafTask({ id: nextId(), wbs: '1.1.1', name: '章程制定', duration: 3,
    plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-03',
    actualStartDate: '2026-06-01', actualEndDate: '2026-06-03',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    assignedTo: teamMembers.zhangSan, sortOrder: 1,
  })
  const t112 = leafTask({ id: nextId(), wbs: '1.1.2', name: '团队组建', duration: 5,
    plannedStartDate: '2026-06-04', plannedEndDate: '2026-06-10',
    actualStartDate: '2026-06-04', actualEndDate: '2026-06-09',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t111.id)),
    assignedTo: teamMembers.zhangSan, sortOrder: 2,
  })
  const t113 = leafMilestone({ id: nextId(), wbs: '1.1.3', name: '启动会议',
    plannedStartDate: '2026-06-11', plannedEndDate: '2026-06-11',
    actualStartDate: '2026-06-11', actualEndDate: '2026-06-11',
    status: TaskStatus.COMPLETED,
    predecessors: preds(pred(t112.id)),
    assignedTo: teamMembers.zhangSan, sortOrder: 3,
  })
  const n11 = summaryNode({ id: nextId(), wbs: '1.1', name: '项目策划',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.zhangSan,
    children: [t111, t112, t113], sortOrder: 1,
  })
  t111.parentId = n11.id; t112.parentId = n11.id; t113.parentId = n11.id

  const n1 = summaryNode({ id: nextId(), wbs: '1', name: '项目启动',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.zhangSan,
    children: [n11], sortOrder: 1,
  })
  n11.parentId = n1.id

  // ─── 2.产品设计 ───
  // 2.1 需求分析 (SUMMARY)
  const t2111 = leafTask({ id: nextId(), wbs: '2.1.1.1', name: '访谈计划', duration: 2,
    plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-02',
    actualStartDate: '2026-06-01', actualEndDate: '2026-06-02',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    assignedTo: teamMembers.liSi, sortOrder: 1,
  })
  const t2112 = leafTask({ id: nextId(), wbs: '2.1.1.2', name: '客户访谈', duration: 3,
    plannedStartDate: '2026-06-03', plannedEndDate: '2026-06-05',
    actualStartDate: '2026-06-03', actualEndDate: '2026-06-05',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t2111.id)),
    assignedTo: teamMembers.liSi, sortOrder: 2,
  })
  const t2113 = leafTask({ id: nextId(), wbs: '2.1.1.3', name: '需求整理', duration: 2,
    plannedStartDate: '2026-06-06', plannedEndDate: '2026-06-07',
    actualStartDate: '2026-06-06', actualEndDate: '2026-06-07',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t2112.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 3,
  })
  const n211 = summaryNode({ id: nextId(), wbs: '2.1.1', name: '客户调研',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.liSi,
    children: [t2111, t2112, t2113], sortOrder: 1,
  })
  t2111.parentId = n211.id; t2112.parentId = n211.id; t2113.parentId = n211.id

  const t212 = leafTask({ id: nextId(), wbs: '2.1.2', name: '竞品分析', duration: 3,  // ← V2 删除
    plannedStartDate: '2026-06-08', plannedEndDate: '2026-06-10',
    actualStartDate: '2026-06-08', actualEndDate: '2026-06-10',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t2113.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 2,
  })
  const t213 = leafMilestone({ id: nextId(), wbs: '2.1.3', name: '需求评审',
    plannedStartDate: '2026-06-12', plannedEndDate: '2026-06-12',
    actualStartDate: '2026-06-12', actualEndDate: '2026-06-12',
    status: TaskStatus.COMPLETED,
    predecessors: preds(pred(t212.id, DependencyType.FS, 2)),
    assignedTo: teamMembers.zhangSan, sortOrder: 3,
  })
  const n21 = summaryNode({ id: nextId(), wbs: '2.1', name: '需求分析',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.liSi,
    children: [n211, t212, t213], sortOrder: 1,
  })
  n211.parentId = n21.id; t212.parentId = n21.id; t213.parentId = n21.id

  // 2.2 结构设计 (SUMMARY)
  const t221 = leafTask({ id: nextId(), wbs: '2.2.1', name: '概念设计', duration: 8,
    plannedStartDate: '2026-06-13', plannedEndDate: '2026-06-22',
    actualStartDate: '2026-06-13', actualEndDate: '2026-06-21',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t213.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.liSi, sortOrder: 1,
  })
  const t222 = leafTask({ id: nextId(), wbs: '2.2.2', name: '详细设计', duration: 7,
    plannedStartDate: '2026-06-23', plannedEndDate: '2026-07-01',
    actualStartDate: '2026-06-22', actualEndDate: '2026-06-30',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t221.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 2,
  })
  const t223 = leafTask({ id: nextId(), wbs: '2.2.3', name: 'DFMEA分析', duration: 5,
    plannedStartDate: '2026-07-02', plannedEndDate: '2026-07-08',
    actualStartDate: '2026-07-01', actualEndDate: '2026-07-07',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t222.id)),
    assignedTo: teamMembers.wuJiu, sortOrder: 3,
  })
  const n22 = summaryNode({ id: nextId(), wbs: '2.2', name: '结构设计',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.liSi,
    children: [t221, t222, t223], sortOrder: 2,
  })
  t221.parentId = n22.id; t222.parentId = n22.id; t223.parentId = n22.id

  // 2.3 电气设计 (SUMMARY)
  const t231 = leafTask({ id: nextId(), wbs: '2.3.1', name: '原理图设计', duration: 6,
    plannedStartDate: '2026-07-09', plannedEndDate: '2026-07-16',
    actualStartDate: '2026-07-08', actualEndDate: '2026-07-15',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t223.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 1,
  })
  const t232 = leafTask({ id: nextId(), wbs: '2.3.2', name: 'PCB布局', duration: 4,
    plannedStartDate: '2026-07-17', plannedEndDate: '2026-07-22',
    actualStartDate: '2026-07-16', actualEndDate: '2026-07-21',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t231.id)),
    assignedTo: teamMembers.zhaoLiu, sortOrder: 2,
  })
  const t233 = leafTask({ id: nextId(), wbs: '2.3.3', name: 'BOM编制', duration: 3,
    plannedStartDate: '2026-07-23', plannedEndDate: '2026-07-25',
    actualStartDate: '2026-07-22', actualEndDate: '2026-07-24',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t232.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 3,
  })
  const n23 = summaryNode({ id: nextId(), wbs: '2.3', name: '电气设计',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.wangWu,
    children: [t231, t232, t233], sortOrder: 3,
  })
  t231.parentId = n23.id; t232.parentId = n23.id; t233.parentId = n23.id

  // 2.5 设计评审 (MILESTONE)
  const t25 = leafMilestone({ id: nextId(), wbs: '2.5', name: '设计评审',
    plannedStartDate: '2026-07-26', plannedEndDate: '2026-07-26',
    actualStartDate: '2026-07-25', actualEndDate: '2026-07-25',
    status: TaskStatus.COMPLETED,
    predecessors: preds(
      pred(t223.id, DependencyType.FS, 1),
      pred(t233.id, DependencyType.FS, 1),
    ),
    assignedTo: teamMembers.zhangSan, sortOrder: 5,
  })

  const n2 = summaryNode({ id: nextId(), wbs: '2', name: '产品设计',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.liSi,
    children: [n21, n22, n23, t25], sortOrder: 2,
  })
  n21.parentId = n2.id; n22.parentId = n2.id; n23.parentId = n2.id; t25.parentId = n2.id

  // ─── 3.采购与制造 ───
  const t311 = leafTask({ id: nextId(), wbs: '3.1.1', name: '核心部件采购', duration: 15,
    plannedStartDate: '2026-07-27', plannedEndDate: '2026-08-14',
    actualStartDate: '2026-07-27', actualEndDate: null,
    status: TaskStatus.IN_PROGRESS, percentComplete: 80,
    predecessors: preds(pred(t25.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.liSi, sortOrder: 1,
  })
  const t312 = leafTask({ id: nextId(), wbs: '3.1.2', name: '电气元件采购', duration: 12,  // ← V2 变名
    plannedStartDate: '2026-07-27', plannedEndDate: '2026-08-11',
    actualStartDate: '2026-07-27', actualEndDate: null,
    status: TaskStatus.IN_PROGRESS, percentComplete: 50,
    predecessors: preds(pred(t25.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.wangWu, sortOrder: 2,
  })
  const t313 = leafTask({ id: nextId(), wbs: '3.1.3', name: '标准件采购', duration: 8,
    plannedStartDate: '2026-07-27', plannedEndDate: '2026-08-05',
    actualStartDate: '2026-07-27', actualEndDate: '2026-08-04',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t25.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.qianShi, sortOrder: 3,
  })
  const n31 = summaryNode({ id: nextId(), wbs: '3.1', name: '零部件采购',
    status: TaskStatus.IN_PROGRESS, assignedTo: teamMembers.zhouBa,
    children: [t311, t312, t313], sortOrder: 1,
  })
  t311.parentId = n31.id; t312.parentId = n31.id; t313.parentId = n31.id

  const t321 = leafTask({ id: nextId(), wbs: '3.2.1', name: '机加工外协', duration: 20,
    plannedStartDate: '2026-08-15', plannedEndDate: '2026-09-11',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t311.id), pred(t312.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.zhouBa, sortOrder: 1,
  })
  const t322 = leafTask({ id: nextId(), wbs: '3.2.2', name: '表面处理', duration: 7,
    plannedStartDate: '2026-09-12', plannedEndDate: '2026-09-20',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t321.id)),
    assignedTo: teamMembers.zhouBa, sortOrder: 2,
  })
  const n32 = summaryNode({ id: nextId(), wbs: '3.2', name: '外协加工',
    status: TaskStatus.PENDING, assignedTo: teamMembers.zhouBa,
    children: [t321, t322], sortOrder: 2,
  })
  t321.parentId = n32.id; t322.parentId = n32.id

  const t33 = leafTask({ id: nextId(), wbs: '3.3', name: '来料检验', duration: 5,
    plannedStartDate: '2026-09-21', plannedEndDate: '2026-09-27',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t322.id), pred(t313.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.wuJiu, sortOrder: 3,
  })

  const n3 = summaryNode({ id: nextId(), wbs: '3', name: '采购与制造',
    status: TaskStatus.IN_PROGRESS, assignedTo: teamMembers.zhouBa,
    children: [n31, n32, t33], sortOrder: 3,
  })
  n31.parentId = n3.id; n32.parentId = n3.id; t33.parentId = n3.id

  // ─── 4.系统装配 ───
  const t41 = leafTask({ id: nextId(), wbs: '4.1', name: '机械装配', duration: 15,
    plannedStartDate: '2026-09-28', plannedEndDate: '2026-10-18',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t33.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.liSi, sortOrder: 1,
  })
  const t42 = leafTask({ id: nextId(), wbs: '4.2', name: '电气装配', duration: 10,
    plannedStartDate: '2026-10-05', plannedEndDate: '2026-10-18',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t41.id, DependencyType.SS, 5)),
    assignedTo: teamMembers.wangWu, sortOrder: 2,
  })
  const t43 = leafMilestone({ id: nextId(), wbs: '4.3', name: '装配检验',
    plannedStartDate: '2026-10-20', plannedEndDate: '2026-10-20',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING,
    predecessors: preds(pred(t41.id), pred(t42.id)),
    assignedTo: teamMembers.sunQi, sortOrder: 3,
  })

  const n4 = summaryNode({ id: nextId(), wbs: '4', name: '系统装配',
    status: TaskStatus.PENDING, assignedTo: teamMembers.zhouBa,
    children: [t41, t42, t43], sortOrder: 4,
  })
  t41.parentId = n4.id; t42.parentId = n4.id; t43.parentId = n4.id

  // ─── 5.测试与验收 ───
  const t51 = leafTask({ id: nextId(), wbs: '5.1', name: '功能调试', duration: 12,
    plannedStartDate: '2026-10-21', plannedEndDate: '2026-11-05',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t43.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.zhaoLiu, sortOrder: 1,
  })
  const t52 = leafTask({ id: nextId(), wbs: '5.2', name: '性能测试', duration: 10,
    plannedStartDate: '2026-11-06', plannedEndDate: '2026-11-19',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t51.id)),
    assignedTo: teamMembers.sunQi, sortOrder: 2,
  })
  const t53 = leafTask({ id: nextId(), wbs: '5.3', name: '环境试验', duration: 8,
    plannedStartDate: '2026-11-20', plannedEndDate: '2026-11-29',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t52.id)),
    assignedTo: teamMembers.sunQi, sortOrder: 3,
  })
  const t54 = leafMilestone({ id: nextId(), wbs: '5.4', name: '验收测试',
    plannedStartDate: '2026-12-01', plannedEndDate: '2026-12-01',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING,
    predecessors: preds(pred(t53.id, DependencyType.FS, 2)),
    assignedTo: teamMembers.zhangSan, sortOrder: 4,
  })

  const n5 = summaryNode({ id: nextId(), wbs: '5', name: '测试与验收',
    status: TaskStatus.PENDING, assignedTo: teamMembers.zhaoLiu,
    children: [t51, t52, t53, t54], sortOrder: 5,
  })
  t51.parentId = n5.id; t52.parentId = n5.id; t53.parentId = n5.id; t54.parentId = n5.id

  // ─── 全部扁平任务（仅叶子）───
  const allLeafs = [
    t111, t112, t113,
    t2111, t2112, t2113, t212, t213,
    t221, t222, t223,
    t231, t232, t233,
    t25,
    t311, t312, t313,
    t321, t322, t33,
    t41, t42, t43,
    t51, t52, t53, t54,
  ]

  const calculated = calculateCriticalPath(allLeafs, '2026-06-01', '2026-12-31')

  // rebuildTree 会通过 parentId 把 SUMMARY 也构建回去
  const allNodes = [n1, n11, n2, n21, n211, n22, n23, n3, n31, n32, n4, n5, ...calculated]
  return rebuildTree(allNodes)
}

// ============================================================
// V2 基线 — 覆盖全差异状态
//
// 差异清单：
//   ADDED     → 2.4 安全审查（新增叶子 TASK）
//   REMOVED   → 2.1.2 竞品分析（WBS 2.1.2 不再存在）
//   MODIFIED  → 人员: 2.1.1.1 李四→赵六            (姓名+ID+角色)
//   MODIFIED  → 人员: 3.1.1 李四→钱十               (姓名+ID+角色)
//   MODIFIED  → 人员: 3.1.2 王五→钱十               (姓名+ID+角色)
//   MODIFIED  → 名称: 3.1.2 电气元件采购→一体化电气模组采购
//   MODIFIED  → 工期: 3.1.2 12→18天
//   MODIFIED  → 工期: 3.2.1 20→18天
//   MODIFIED  → 工期: 4.1 15→18天
//   MODIFIED  → 工期: 4.2 10→8天
//   MODIFIED  → 状态: 5.1 PENDING→IN_PROGRESS
//   MODIFIED  → %:   5.1 0→30%
//   MODIFIED  → 日期: 大量任务因前置链路变化而日期漂移
//   MODIFIED  → 前继: 2.5 设计评审增加依赖 t24 (安全审查)
//   MODIFIED  → 约束: 5.4 MFO 约束日期 2026-12-01→2026-12-15
//   UNCHANGED → 1.1.1 章程制定（所有字段完全一致）
//   UNCHANGED → 1.1.2 团队组建
//   UNCHANGED → 1.1.3 启动会议
// ============================================================

function createPlanV2(): TaskNode[] {
  resetCounter()

  // ─── 1.项目启动（完全不变）───
  const t111 = leafTask({ id: nextId(), wbs: '1.1.1', name: '章程制定', duration: 3,
    plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-03',
    actualStartDate: '2026-06-01', actualEndDate: '2026-06-03',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    assignedTo: teamMembers.zhangSan, sortOrder: 1,
  })
  const t112 = leafTask({ id: nextId(), wbs: '1.1.2', name: '团队组建', duration: 5,
    plannedStartDate: '2026-06-04', plannedEndDate: '2026-06-10',
    actualStartDate: '2026-06-04', actualEndDate: '2026-06-09',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t111.id)),
    assignedTo: teamMembers.zhangSan, sortOrder: 2,
  })
  const t113 = leafMilestone({ id: nextId(), wbs: '1.1.3', name: '启动会议',
    plannedStartDate: '2026-06-11', plannedEndDate: '2026-06-11',
    actualStartDate: '2026-06-11', actualEndDate: '2026-06-11',
    status: TaskStatus.COMPLETED,
    predecessors: preds(pred(t112.id)),
    assignedTo: teamMembers.zhangSan, sortOrder: 3,
  })
  const n11 = summaryNode({ id: nextId(), wbs: '1.1', name: '项目策划',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.zhangSan,
    children: [t111, t112, t113], sortOrder: 1,
  })
  t111.parentId = n11.id; t112.parentId = n11.id; t113.parentId = n11.id
  const n1 = summaryNode({ id: nextId(), wbs: '1', name: '项目启动',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.zhangSan,
    children: [n11], sortOrder: 1,
  })
  n11.parentId = n1.id

  // ─── 2.产品设计 ───
  // 2.1.1 客户调研 (SUMMARY)
  const t2111 = leafTask({ id: nextId(), wbs: '2.1.1.1', name: '访谈计划', duration: 2,
    plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-02',
    actualStartDate: '2026-06-01', actualEndDate: '2026-06-02',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    assignedTo: teamMembers.zhaoLiu, sortOrder: 1,  // ★ 人员变更: 李四→赵六
  })
  const t2112 = leafTask({ id: nextId(), wbs: '2.1.1.2', name: '客户访谈', duration: 3,
    plannedStartDate: '2026-06-03', plannedEndDate: '2026-06-05',
    actualStartDate: '2026-06-03', actualEndDate: '2026-06-05',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t2111.id)),
    assignedTo: teamMembers.liSi, sortOrder: 2,
  })
  const t2113 = leafTask({ id: nextId(), wbs: '2.1.1.3', name: '需求整理', duration: 2,
    plannedStartDate: '2026-06-06', plannedEndDate: '2026-06-07',
    actualStartDate: '2026-06-06', actualEndDate: '2026-06-07',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t2112.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 3,
  })
  const n211 = summaryNode({ id: nextId(), wbs: '2.1.1', name: '客户调研',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.liSi,
    children: [t2111, t2112, t2113], sortOrder: 1,
  })
  t2111.parentId = n211.id; t2112.parentId = n211.id; t2113.parentId = n211.id

  // ★ 2.1.2 竞品分析 — 已删除

  const t213 = leafMilestone({ id: nextId(), wbs: '2.1.3', name: '需求评审',
    plannedStartDate: '2026-06-12', plannedEndDate: '2026-06-12',
    actualStartDate: '2026-06-12', actualEndDate: '2026-06-12',
    status: TaskStatus.COMPLETED,
    predecessors: preds(pred(t2113.id, DependencyType.FS, 2)),  // ★ 前继变更: 原依赖 t212，现依赖 t2113
    assignedTo: teamMembers.zhangSan, sortOrder: 3,
  })
  const n21 = summaryNode({ id: nextId(), wbs: '2.1', name: '需求分析',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.liSi,
    children: [n211, t213], sortOrder: 1,  // ★ children 变少了
  })
  n211.parentId = n21.id; t213.parentId = n21.id

  // 2.2 结构设计 (SUMMARY) — 不变
  const t221 = leafTask({ id: nextId(), wbs: '2.2.1', name: '概念设计', duration: 8,
    plannedStartDate: '2026-06-13', plannedEndDate: '2026-06-22',
    actualStartDate: '2026-06-13', actualEndDate: '2026-06-21',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t213.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.liSi, sortOrder: 1,
  })
  const t222 = leafTask({ id: nextId(), wbs: '2.2.2', name: '详细设计', duration: 7,
    plannedStartDate: '2026-06-23', plannedEndDate: '2026-07-01',
    actualStartDate: '2026-06-22', actualEndDate: '2026-06-30',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t221.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 2,
  })
  const t223 = leafTask({ id: nextId(), wbs: '2.2.3', name: 'DFMEA分析', duration: 5,
    plannedStartDate: '2026-07-02', plannedEndDate: '2026-07-08',
    actualStartDate: '2026-07-01', actualEndDate: '2026-07-07',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t222.id)),
    assignedTo: teamMembers.wuJiu, sortOrder: 3,
  })
  const n22 = summaryNode({ id: nextId(), wbs: '2.2', name: '结构设计',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.liSi,
    children: [t221, t222, t223], sortOrder: 2,
  })
  t221.parentId = n22.id; t222.parentId = n22.id; t223.parentId = n22.id

  // 2.3 电气设计 (SUMMARY)
  const t231 = leafTask({ id: nextId(), wbs: '2.3.1', name: '原理图设计', duration: 6,
    plannedStartDate: '2026-07-09', plannedEndDate: '2026-07-16',
    actualStartDate: '2026-07-08', actualEndDate: '2026-07-15',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t223.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 1,
  })
  const t232 = leafTask({ id: nextId(), wbs: '2.3.2', name: 'PCB布局', duration: 4,
    plannedStartDate: '2026-07-17', plannedEndDate: '2026-07-22',
    actualStartDate: '2026-07-16', actualEndDate: '2026-07-21',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t231.id)),
    assignedTo: teamMembers.zhaoLiu, sortOrder: 2,
  })
  const t233 = leafTask({ id: nextId(), wbs: '2.3.3', name: 'BOM编制', duration: 3,
    plannedStartDate: '2026-07-23', plannedEndDate: '2026-07-25',
    actualStartDate: '2026-07-22', actualEndDate: '2026-07-24',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t232.id)),
    assignedTo: teamMembers.wangWu, sortOrder: 3,
  })
  const n23 = summaryNode({ id: nextId(), wbs: '2.3', name: '电气设计',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.wangWu,
    children: [t231, t232, t233], sortOrder: 3,
  })
  t231.parentId = n23.id; t232.parentId = n23.id; t233.parentId = n23.id

  // ★ 2.4 安全审查 — 新增 TASK
  const t24 = leafTask({ id: nextId(), wbs: '2.4', name: '安全审查', duration: 3,
    plannedStartDate: '2026-07-26', plannedEndDate: '2026-07-28',
    actualStartDate: '2026-07-25', actualEndDate: '2026-07-27',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t223.id, DependencyType.FS, 1), pred(t233.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.sunQi, sortOrder: 4,
  })

  // 2.5 设计评审 — 前继增加 t24
  const t25 = leafMilestone({ id: nextId(), wbs: '2.5', name: '设计评审',
    plannedStartDate: '2026-07-29', plannedEndDate: '2026-07-29',  // ★ 日期变更
    actualStartDate: '2026-07-28', actualEndDate: '2026-07-28',
    status: TaskStatus.COMPLETED,
    predecessors: preds(
      pred(t223.id, DependencyType.FS, 1),
      pred(t233.id, DependencyType.FS, 1),
      pred(t24.id, DependencyType.FS, 1),  // ★ 新增前继
    ),
    assignedTo: teamMembers.zhangSan, sortOrder: 5,
  })

  const n2 = summaryNode({ id: nextId(), wbs: '2', name: '产品设计',
    status: TaskStatus.COMPLETED, assignedTo: teamMembers.liSi,
    children: [n21, n22, n23, t24, t25], sortOrder: 2,  // ★ children 多了一个
  })
  n21.parentId = n2.id; n22.parentId = n2.id; n23.parentId = n2.id; t24.parentId = n2.id; t25.parentId = n2.id

  // ─── 3.采购与制造 ───
  const t311 = leafTask({ id: nextId(), wbs: '3.1.1', name: '核心部件采购', duration: 15,
    plannedStartDate: '2026-07-30', plannedEndDate: '2026-08-17',  // ★ 日期变更
    actualStartDate: '2026-07-30', actualEndDate: null,
    status: TaskStatus.IN_PROGRESS, percentComplete: 80,
    predecessors: preds(pred(t25.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.qianShi, sortOrder: 1,  // ★ 人员变更: 李四→钱十
  })
  const t312 = leafTask({ id: nextId(), wbs: '3.1.2', name: '一体化电气模组采购', duration: 18,  // ★ 名称+工期变更
    plannedStartDate: '2026-07-30', plannedEndDate: '2026-08-22',
    actualStartDate: '2026-07-30', actualEndDate: null,
    status: TaskStatus.IN_PROGRESS, percentComplete: 40,
    predecessors: preds(pred(t25.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.qianShi, sortOrder: 2,  // ★ 人员变更: 王五→钱十
  })
  const t313 = leafTask({ id: nextId(), wbs: '3.1.3', name: '标准件采购', duration: 8,
    plannedStartDate: '2026-07-30', plannedEndDate: '2026-08-08',
    actualStartDate: '2026-07-30', actualEndDate: '2026-08-07',
    status: TaskStatus.COMPLETED, percentComplete: 100,
    predecessors: preds(pred(t25.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.qianShi, sortOrder: 3,
  })
  const n31 = summaryNode({ id: nextId(), wbs: '3.1', name: '零部件采购',
    status: TaskStatus.IN_PROGRESS, assignedTo: teamMembers.zhouBa,
    children: [t311, t312, t313], sortOrder: 1,
  })
  t311.parentId = n31.id; t312.parentId = n31.id; t313.parentId = n31.id

  const t321 = leafTask({ id: nextId(), wbs: '3.2.1', name: '机加工外协', duration: 18,  // ★ 20→18天
    plannedStartDate: '2026-08-23', plannedEndDate: '2026-09-17',  // ★ 日期变更
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t311.id), pred(t312.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.zhouBa, sortOrder: 1,
  })
  const t322 = leafTask({ id: nextId(), wbs: '3.2.2', name: '表面处理', duration: 7,
    plannedStartDate: '2026-09-18', plannedEndDate: '2026-09-26',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t321.id)),
    assignedTo: teamMembers.zhouBa, sortOrder: 2,
  })
  const n32 = summaryNode({ id: nextId(), wbs: '3.2', name: '外协加工',
    status: TaskStatus.PENDING, assignedTo: teamMembers.zhouBa,
    children: [t321, t322], sortOrder: 2,
  })
  t321.parentId = n32.id; t322.parentId = n32.id

  const t33 = leafTask({ id: nextId(), wbs: '3.3', name: '来料检验', duration: 5,
    plannedStartDate: '2026-09-27', plannedEndDate: '2026-10-03',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t322.id), pred(t313.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.wuJiu, sortOrder: 3,
  })

  const n3 = summaryNode({ id: nextId(), wbs: '3', name: '采购与制造',
    status: TaskStatus.IN_PROGRESS, assignedTo: teamMembers.zhouBa,
    children: [n31, n32, t33], sortOrder: 3,
  })
  n31.parentId = n3.id; n32.parentId = n3.id; t33.parentId = n3.id

  // ─── 4.系统装配 ───
  const t41 = leafTask({ id: nextId(), wbs: '4.1', name: '机械装配', duration: 18,  // ★ 15→18天
    plannedStartDate: '2026-10-04', plannedEndDate: '2026-10-27',  // ★ 日期变更
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t33.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.liSi, sortOrder: 1,
  })
  const t42 = leafTask({ id: nextId(), wbs: '4.2', name: '电气装配', duration: 8,  // ★ 10→8天
    plannedStartDate: '2026-10-11', plannedEndDate: '2026-10-21',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t41.id, DependencyType.SS, 5)),
    assignedTo: teamMembers.wangWu, sortOrder: 2,
  })
  const t43 = leafMilestone({ id: nextId(), wbs: '4.3', name: '装配检验',
    plannedStartDate: '2026-10-29', plannedEndDate: '2026-10-29',  // ★ 日期变更
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING,
    predecessors: preds(pred(t41.id), pred(t42.id)),
    assignedTo: teamMembers.sunQi, sortOrder: 3,
  })

  const n4 = summaryNode({ id: nextId(), wbs: '4', name: '系统装配',
    status: TaskStatus.PENDING, assignedTo: teamMembers.zhouBa,
    children: [t41, t42, t43], sortOrder: 4,
  })
  t41.parentId = n4.id; t42.parentId = n4.id; t43.parentId = n4.id

  // ─── 5.测试与验收 ───
  const t51 = leafTask({ id: nextId(), wbs: '5.1', name: '功能调试', duration: 12,
    plannedStartDate: '2026-10-30', plannedEndDate: '2026-11-14',  // ★ 日期变更
    actualStartDate: '2026-10-30', actualEndDate: null,
    status: TaskStatus.IN_PROGRESS, percentComplete: 30,  // ★ 状态+%变更
    predecessors: preds(pred(t43.id, DependencyType.FS, 1)),
    assignedTo: teamMembers.zhaoLiu, sortOrder: 1,
  })
  const t52 = leafTask({ id: nextId(), wbs: '5.2', name: '性能测试', duration: 10,
    plannedStartDate: '2026-11-15', plannedEndDate: '2026-11-28',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t51.id)),
    assignedTo: teamMembers.sunQi, sortOrder: 2,
  })
  const t53 = leafTask({ id: nextId(), wbs: '5.3', name: '环境试验', duration: 8,
    plannedStartDate: '2026-11-29', plannedEndDate: '2026-12-08',
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING, percentComplete: 0,
    predecessors: preds(pred(t52.id)),
    assignedTo: teamMembers.sunQi, sortOrder: 3,
  })
  // ★ 5.4 验收测试 — 约束日期变更
  const t54 = leafMilestone({ id: nextId(), wbs: '5.4', name: '验收测试',
    plannedStartDate: '2026-12-10', plannedEndDate: '2026-12-10',  // ★ 日期变更
    actualStartDate: null, actualEndDate: null,
    status: TaskStatus.PENDING,
    predecessors: preds(pred(t53.id, DependencyType.FS, 2)),
    constraintType: ConstraintType.MFO, constraintDate: '2026-12-31',  // ★ 约束日期变更
    assignedTo: teamMembers.zhangSan, sortOrder: 4,
  })

  const n5 = summaryNode({ id: nextId(), wbs: '5', name: '测试与验收',
    status: TaskStatus.PENDING, assignedTo: teamMembers.zhaoLiu,
    children: [t51, t52, t53, t54], sortOrder: 5,
  })
  t51.parentId = n5.id; t52.parentId = n5.id; t53.parentId = n5.id; t54.parentId = n5.id

  const allLeafs = [
    t111, t112, t113,
    t2111, t2112, t2113, t213,
    t221, t222, t223,
    t231, t232, t233,
    t24, t25,
    t311, t312, t313,
    t321, t322, t33,
    t41, t42, t43,
    t51, t52, t53, t54,
  ]

  const calculated = calculateCriticalPath(allLeafs, '2026-06-01', '2026-12-31')
  const allNodes = [n1, n11, n2, n21, n211, n22, n23, n3, n31, n32, n4, n5, ...calculated]
  return rebuildTree(allNodes)
}

// ============================================================
// rebuildTree / flatTasks（统一复用）
// ============================================================

function rebuildTree(flat: TaskNode[]): TaskNode[] {
  const map = new Map<string, TaskNode>(flat.map(t => [t.id, { ...t, children: [] as TaskNode[] }]))
  const roots: TaskNode[] = []
  for (const t of map.values()) {
    if (t.parentId && map.has(t.parentId)) {
      map.get(t.parentId)!.children.push(t)
    } else if (!t.parentId) {
      roots.push(t)
    }
  }
  function sortChildren(task: TaskNode, depth: number) {
    if (depth > 10) return
    task.children.sort((a, b) => a.sortOrder - b.sortOrder)
    task.children.forEach(c => sortChildren(c, depth + 1))
  }
  roots.sort((a, b) => a.sortOrder - b.sortOrder)
  roots.forEach(c => sortChildren(c, 0))
  return roots
}

function flatTasks(tasks: TaskNode[], maxDepth = 10): TaskNode[] {
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
// 构建 Snapshot
// ============================================================

function buildSnapshot(
  taskTree: TaskNode[],
  name: string,
  description: string,
  createdAt: string,
  fixedId: string,
  isBaseline: boolean
): Snapshot {
  const flat = flatTasks(taskTree)
  const leafs = flat.filter(t => t.type !== TaskType.SUMMARY)
  const criticalPath = leafs.filter(t => t.cpmDates.isCritical).map(t => t.id)

  return {
    id: fixedId,
    name, description, createdAt,
    projectNumber: 'PRJ-2026-0001',
    status: 'Active',
    projectManager: teamMembers.zhangSan,
    targetStartDate: '2026-06-01',
    targetEndDate: '2026-12-31',
    projectedEndDate: '2026-12-31',
    totalTasks: leafs.length,
    completedTasks: leafs.filter(t => t.status === TaskStatus.COMPLETED).length,
    overallPercentComplete: Math.round(
      leafs.reduce((s, t) => s + t.percentComplete, 0) / Math.max(leafs.length, 1)
    ),
    criticalPath,
    isBaseline,
    taskTree: JSON.parse(JSON.stringify(taskTree)),
  }
}

// ============================================================
// 导出快照列表
// ============================================================

export function loadMockSnapshots(): Snapshot[] {
  const v1Tree = createPlanV1()
  const v2Tree = createPlanV2()

  return [
    buildSnapshot(v1Tree, '基线 V1.0 - 初始计划', '2026年6月初始项目计划基线', '2026-06-01T00:00:00Z', 'SNAP_V1_0', true),
    buildSnapshot(v1Tree, '快照 V1.1 - 设计完成', '设计阶段完成时的状态冻结', '2026-06-28T00:00:00Z', 'SNAP_V1_1', false),
    buildSnapshot(v2Tree, '快照 V2.0 - 采购阶段调整', '采购阶段调整计划，新增安全审查、替换模组采购', '2026-07-20T00:00:00Z', 'SNAP_V2_0', false),
  ]
}

export function loadMockSnapshotDetail(id: string): Snapshot | null {
  return loadMockSnapshots().find(s => s.id === id) ?? null
}

export { teamMembers }
