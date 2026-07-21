// ============================================================
// 项目基线 - 核心类型定义
// 所有 key 值设计为可对接 Aras 系统 Item 结构
// ============================================================

/** 任务约束类型 */
export enum ConstraintType {
  ASAP = 'ASAP',                       // 尽快
  ALAP = 'ALAP',                       // 尽晚
  FNET = 'FNET',                       // 不早于...完成
  FNLT = 'FNLT',                       // 不晚于...完成
  MSO = 'MSO',                         // 必须开始于
  MFO = 'MFO',                         // 必须完成于
  SNET = 'SNET',                       // 不早于...开始
  SNLT = 'SNLT',                       // 不晚于...开始
}

/** 任务状态 */
export enum TaskStatus {
  PENDING = 'PENDING',                 // 未开始
  IN_PROGRESS = 'IN_PROGRESS',         // 进行中
  COMPLETED = 'COMPLETED',             // 已完成
  SUSPENDED = 'SUSPENDED',             // 暂停
}

/** 任务类型 */
export enum TaskType {
  TASK = 'TASK',                       // 普通任务
  MILESTONE = 'MILESTONE',             // 里程碑
  SUMMARY = 'SUMMARY',                 // 摘要任务
}

/** 前置依赖类型 */
export enum DependencyType {
  FS = 'FS',                           // 完成-开始
  SS = 'SS',                           // 开始-开始
  FF = 'FF',                           // 完成-完成
  SF = 'SF',                           // 开始-完成
}

/** 前置依赖（对应图中的 "N:前置任务ID" 关系） */
export interface TaskPredecessor {
  /** Aras Item ID */
  id: string
  /** 前置任务ID */
  predecessorId: string
  /** 依赖类型 */
  dependencyType: DependencyType
  /** 滞后量（天数，可为负表示提前） */
  lagDays: number
}

/** 前置关系详情（解析后用于显示，图中的 "N:X" 格式） */
export interface PredecessorDetail {
  /** 前置任务的 WBS 编号 */
  wbs: string
  /** 前置任务名称 */
  name: string
  /** 依赖类型 */
  dependencyType: DependencyType
  /** 滞后量 */
  lagDays: number
}

/** CPM 计算后的日期字段 */
export interface CPMDates {
  /** 最早开始日期 */
  earliestStart: string | null
  /** 最早完成日期 */
  earliestFinish: string | null
  /** 最晚开始日期 */
  latestStart: string | null
  /** 最晚完成日期 */
  latestFinish: string | null
  /** 总浮时（天） */
  totalFloat: number
  /** 自由浮时（天） */
  freeFloat: number
  /** 是否在关键路径上 */
  isCritical: boolean
}

/** 项目成员 */
export interface TeamMember {
  /** Aras Identity ID */
  id: string
  /** 成员姓名 */
  name: string
  /** 角色 */
  role: string
}

/** 项目计划任务（对应 Aras 中的 WBS Activity / Project Activity） */
export interface ProjectTask {
  /** Aras Item ID（如 Project Activity ID） */
  id: string
  /** WBS 编号 */
  wbs: string
  /** 任务名称 */
  name: string
  /** 任务描述 */
  description: string
  /** 任务类型 */
  type: TaskType
  /** 任务状态 */
  status: TaskStatus
  /** 工期（天） */
  duration: number
  /** 完成百分比 0-100 */
  percentComplete: number
  /** 计划开始日期（ISO 8601） */
  plannedStartDate: string
  /** 计划完成日期（ISO 8601） */
  plannedEndDate: string
  /** 实际开始日期 */
  actualStartDate: string | null
  /** 实际完成日期 */
  actualEndDate: string | null
  /** 目标开始日期 */
  targetStartDate: string
  /** 目标完成日期 */
  targetEndDate: string
  /** 约束类型 */
  constraintType: ConstraintType
  /** 约束日期 */
  constraintDate: string | null
  /** 前置依赖列表 */
  predecessors: TaskPredecessor[]
  /** 前置关系详情（解析后用于显示，图中的 "N:X"） */
  predecessorDetails?: PredecessorDetail[]
  /** CPM 计算字段 */
  cpmDates: CPMDates
  /** 负责人 */
  assignedTo: TeamMember | null
  /** 子任务（用于树状结构） */
  children: ProjectTask[]
  /** 父任务ID */
  parentId: string | null
  /** 排序序号 */
  sortOrder: number
  /** 备注 */
  notes: string
  /** 是否为里程碑 */
  isMilestone: boolean
}

/** 项目计划 */
export interface ProjectPlan {
  /** Aras Item ID */
  id: string
  /** 项目名称 */
  name: string
  /** 项目编号 */
  projectNumber: string
  /** 目标开始日期 */
  targetStartDate: string
  /** 目标完成日期 */
  targetEndDate: string
  /** 任务列表（扁平，通过 parentId 构建树） */
  tasks: ProjectTask[]
  /** 项目状态 */
  status: string
  /** 项目负责人 */
  projectManager: TeamMember | null
}

// ============================================================
// 快照相关类型
// ============================================================

/** 快照元数据 */
export interface SnapshotMeta {
  /** 快照 ID */
  id: string
  /** 快照名称 */
  name: string
  /** 快照创建时间 */
  createdAt: string
  /** 快照描述 */
  description: string
  /** 关联的项目计划ID */
  projectPlanId: string
  /** 关键路径（逗号分隔的任务ID） */
  criticalPath: string[]
  /** 项目预计完成日期 */
  projectedEndDate: string
  /** 总任务数 */
  totalTasks: number
  /** 完成任务数 */
  completedTasks: number
  /** 总体完成百分比 */
  overallPercentComplete: number
}

/** 快照（包含完整的项目计划冻结数据） */
export interface Snapshot {
  meta: SnapshotMeta
  /** 冻结的项目计划数据 */
  plan: ProjectPlan
}

// ============================================================
// 比对相关类型
// ============================================================

/** 差异类型 */
export enum DiffType {
  UNCHANGED = 'UNCHANGED',           // 无变化
  ADDED = 'ADDED',                   // 新增
  REMOVED = 'REMOVED',               // 删除
  MODIFIED = 'MODIFIED',             // 已修改
}

/** 任务变更字段详情 */
export interface TaskFieldChange {
  field: string                       // 字段名
  fieldLabel: string                  // 字段中文名
  oldValue: string | number | null
  newValue: string | number | null
}

/** 关键路径差异 */
export interface CriticalPathDiff {
  /** 新增到关键路径的任务 */
  addedToCriticalPath: ProjectTask[]
  /** 从关键路径移除的任务 */
  removedFromCriticalPath: ProjectTask[]
  /** 关键路径总浮时变化 */
  totalFloatChange: number
  /** 关键路径总工期变化 */
  totalDurationChange: number
}

/** 单个任务的比对结果 */
export interface TaskDiffResult {
  /** 任务在旧快照中的数据（不存在则为 null） */
  oldTask: ProjectTask | null
  /** 任务在新快照中的数据（不存在则为 null） */
  newTask: ProjectTask | null
  /** 差异类型 */
  diffType: DiffType
  /** 任务 WBS */
  wbs: string
  /** 任务名称 */
  taskName: string
  /** 变更的字段详情列表 */
  changes: TaskFieldChange[]
  /** 子任务差异 */
  childrenDiffs: TaskDiffResult[]
}

/** 左右树状比对行（用于左右并排视图） */
export interface CompareRow {
  uid: string
  level: number
  wbs: string
  leftTask: ProjectTask | null
  rightTask: ProjectTask | null
  diffType: DiffType
  changes: TaskFieldChange[]
  children: CompareRow[]
}

/** 整体比对结果 */
export interface ComparisonResult {
  /** 快照1 ID */
  snapshotId1: string
  /** 快照2 ID */
  snapshotId2: string
  /** 比对时间 */
  comparedAt: string
  /** 关键路径差异 */
  criticalPathDiff: CriticalPathDiff
  /** 任务差异树 */
  taskDiffs: TaskDiffResult[]
  /** 左右树状比对行 */
  compareRows: CompareRow[]
  /** 统计摘要 */
  summary: DiffSummary
}

/** 差异统计摘要 */
export interface DiffSummary {
  totalAdded: number
  totalRemoved: number
  totalModified: number
  totalUnchanged: number
  criticalPathAdded: number
  criticalPathRemoved: number
}

// ============================================================
// AI 分析相关类型
// ============================================================

/** AI 分析状态 */
export enum AIAnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

/** AI 分析结果块 */
export interface AIAnalysisChunk {
  content: string
  timestamp: string
}

/** AI 分析结果 */
export interface AIAnalysisResult {
  status: AIAnalysisStatus
  chunks: AIAnalysisChunk[]
  error?: string
}
