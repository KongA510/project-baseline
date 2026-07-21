// ============================================================
// 项目基线管理系统 - 后端实体类（极简两层设计）
//
// 第1层 Snapshot — 快照（所有项目元数据 + 任务树根节点）
// 第2层 TaskNode — 任务节点（递归嵌套，构成完整 WBS 树）
//
// 设计原则：
//   1. 后端只负责存储和传输基础数据（快照本身）
//   2. 快照比对、字段差异、统计摘要等全部由前端 diffEngine.ts 分析
//   3. 字段名 camelCase，与前端 JSON 无缝对接
//
// 命名空间：ProjectBaseline.Models
// JSON：System.Text.Json（PropertyNameCaseInsensitive）
// ============================================================

using System.Text.Json.Serialization;

namespace ProjectBaseline.Models
{
    // ============================================================
    // 枚举
    // ============================================================

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ConstraintType { ASAP, ALAP, FNET, FNLT, MSO, MFO, SNET, SNLT }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum TaskStatus { PENDING, IN_PROGRESS, COMPLETED, SUSPENDED }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum TaskType { TASK, MILESTONE, SUMMARY }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DependencyType { FS, SS, FF, SF }

    // ============================================================
    // 基础组件
    // ============================================================

    /// <summary>前置依赖</summary>
    public class TaskPredecessor
    {
        public string Id { get; set; } = string.Empty;
        public string PredecessorId { get; set; } = string.Empty;
        public DependencyType DependencyType { get; set; } = DependencyType.FS;
        public int LagDays { get; set; }
    }

    /// <summary>CPM 关键路径法计算结果</summary>
    public class CPMDates
    {
        public string? EarliestStart { get; set; }
        public string? EarliestFinish { get; set; }
        public string? LatestStart { get; set; }
        public string? LatestFinish { get; set; }
        public double TotalFloat { get; set; }
        public double FreeFloat { get; set; }
        public bool IsCritical { get; set; }
    }

    /// <summary>团队成员</summary>
    public class TeamMember
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    // ============================================================
    // 第2层: TaskNode（WBS 任务树节点，递归嵌套）
    // ============================================================

    /// <summary>
    /// 任务节点 — 对应 Aras WBS Activity
    /// 每个节点可递归包含 Children，构成完整 WBS 树
    /// </summary>
    public class TaskNode
    {
        // 身份
        public string Id { get; set; } = string.Empty;
        public string Wbs { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public TaskType Type { get; set; } = TaskType.TASK;

        // 进度
        public TaskStatus Status { get; set; } = TaskStatus.PENDING;
        public int Duration { get; set; }
        public int PercentComplete { get; set; }
        public bool IsMilestone { get; set; }

        // 日期
        public string PlannedStartDate { get; set; } = string.Empty;
        public string PlannedEndDate { get; set; } = string.Empty;
        public string? ActualStartDate { get; set; }
        public string? ActualEndDate { get; set; }
        public string TargetStartDate { get; set; } = string.Empty;
        public string TargetEndDate { get; set; } = string.Empty;

        // 约束 & 依赖
        public ConstraintType ConstraintType { get; set; } = ConstraintType.ASAP;
        public string? ConstraintDate { get; set; }
        public List<TaskPredecessor> Predecessors { get; set; } = new();

        // CPM
        public CPMDates CpmDates { get; set; } = new();

        // 人员
        public TeamMember? AssignedTo { get; set; }
        public string Notes { get; set; } = string.Empty;

        // 树结构
        public List<TaskNode> Children { get; set; } = new();
        public string? ParentId { get; set; }
        public int SortOrder { get; set; }
    }

    // ============================================================
    // 第1层: Snapshot（快照 = 元数据 + 任务树）
    // ============================================================

    /// <summary>
    /// 快照 — 冻结的项目基线。
    /// 包含所有扁平元属性 + taskTree（递归任务树）。
    /// 前端拿到两份 Snapshot 后，由 diffEngine.ts 自动完成比对分析。
    /// </summary>
    public class Snapshot
    {
        // -- 快照标识 --
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;

        // -- 项目信息 --
        public string ProjectNumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public TeamMember? ProjectManager { get; set; }

        // -- 项目日期 --
        public string TargetStartDate { get; set; } = string.Empty;
        public string TargetEndDate { get; set; } = string.Empty;
        public string ProjectedEndDate { get; set; } = string.Empty;

        // -- 统计摘要 --
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int OverallPercentComplete { get; set; }

        // -- 关键路径 --
        public List<string> CriticalPath { get; set; } = new();

        // -- ★ 任务树（第2层入口，递归嵌套）--
        public List<TaskNode> TaskTree { get; set; } = new();
    }
}
