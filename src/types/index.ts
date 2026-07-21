// ============================================================
// 项目基线 - 核心类型定义（极简两层设计）
// 第1层 Snapshot — 快照（所有元数据 + 任务树）
// 第2层 TaskNode — 任务节点（递归嵌套）
// 比对分析类型由 diffEngine.ts 产出
// ============================================================

// ============================================================
// 枚举
// ============================================================

export enum ConstraintType {
  ASAP = 'ASAP',
  ALAP = 'ALAP',
  FNET = 'FNET',
  FNLT = 'FNLT',
  MSO = 'MSO',
  MFO = 'MFO',
  SNET = 'SNET',
  SNLT = 'SNLT',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SUSPENDED = 'SUSPENDED',
}

export enum TaskType {
  TASK = 'TASK',
  MILESTONE = 'MILESTONE',
  SUMMARY = 'SUMMARY',
}

export enum DependencyType {
  FS = 'FS',
  SS = 'SS',
  FF = 'FF',
  SF = 'SF',
}

// ============================================================
// 基础组件
// ============================================================

export interface TaskPredecessor {
  id: string
  predecessorId: string
  dependencyType: DependencyType
  lagDays: number
}

export interface CPMDates {
  earliestStart: string | null
  earliestFinish: string | null
  latestStart: string | null
  latestFinish: string | null
  totalFloat: number
  freeFloat: number
  isCritical: boolean
}

export interface TeamMember {
  id: string
  name: string
  role: string
}

// ============================================================
// 第2层: TaskNode（WBS 任务树节点，递归嵌套）
// ============================================================

export interface TaskNode {
  id: string
  wbs: string
  name: string
  description: string
  type: TaskType
  status: TaskStatus
  duration: number
  percentComplete: number
  isMilestone: boolean
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate: string | null
  actualEndDate: string | null
  targetStartDate: string
  targetEndDate: string
  constraintType: ConstraintType
  constraintDate: string | null
  predecessors: TaskPredecessor[]
  cpmDates: CPMDates
  assignedTo: TeamMember | null
  notes: string
  children: TaskNode[]
  parentId: string | null
  sortOrder: number
}

// ============================================================
// 第1层: Snapshot（快照 = 元数据 + 任务树）
// ============================================================

export interface Snapshot {
  // 快照标识
  id: string
  name: string
  description: string
  createdAt: string
  // 项目信息
  projectNumber: string
  status: string
  projectManager: TeamMember | null
  // 项目日期
  targetStartDate: string
  targetEndDate: string
  projectedEndDate: string
  // 统计摘要
  totalTasks: number
  completedTasks: number
  overallPercentComplete: number
  // 关键路径
  criticalPath: string[]
  // ★ 任务树（第2层入口，递归嵌套）
  taskTree: TaskNode[]
}

// ============================================================
// 比对分析类型（由 diffEngine.ts 从两份 Snapshot 自动衍生）
// ============================================================

export enum DiffType {
  UNCHANGED = 'UNCHANGED',
  ADDED = 'ADDED',
  REMOVED = 'REMOVED',
  MODIFIED = 'MODIFIED',
}

export interface TaskFieldChange {
  field: string
  fieldLabel: string
  oldValue: string | number | null
  newValue: string | number | null
}

export interface CriticalPathDiff {
  addedToCriticalPath: TaskNode[]
  removedFromCriticalPath: TaskNode[]
  totalFloatChange: number
  totalDurationChange: number
}

export interface TaskDiffResult {
  oldTask: TaskNode | null
  newTask: TaskNode | null
  diffType: DiffType
  wbs: string
  taskName: string
  changes: TaskFieldChange[]
  childrenDiffs: TaskDiffResult[]
}

export interface CompareRow {
  uid: string
  level: number
  wbs: string
  leftTask: TaskNode | null
  rightTask: TaskNode | null
  diffType: DiffType
  changes: TaskFieldChange[]
  children: CompareRow[]
}

export interface DiffSummary {
  totalAdded: number
  totalRemoved: number
  totalModified: number
  totalUnchanged: number
  criticalPathAdded: number
  criticalPathRemoved: number
}

export interface ComparisonResult {
  snapshotId1: string
  snapshotId2: string
  comparedAt: string
  criticalPathDiff: CriticalPathDiff
  taskDiffs: TaskDiffResult[]
  compareRows: CompareRow[]
  summary: DiffSummary
}

// ============================================================
// AI 分析
// ============================================================

export enum AIAnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface AIAnalysisChunk {
  content: string
  timestamp: string
}

export interface AIAnalysisResult {
  status: AIAnalysisStatus
  chunks: AIAnalysisChunk[]
  error?: string
}
