// ============================================================
// 项目基线 — 后端对接实体类 (最终版)
// 定位: 前后端 JSON 对接契约 (API 入参/出参 + 持久化模型)
// 生成: 2026-07-22  与前端 src/types + store 分层加载完全对齐
//
// ── 数据模型严格两层 ────────────────────────────────────────
//   第1层 Snapshot  = 快照元数据 + 任务树入口
//   第2层 TaskNode  = WBS 任务节点 (自引用递归)
//   其余 class 分三类, 均【非数据层】:
//     值对象  TeamMember / TaskPredecessor / CPMDates  (无主键, 内嵌字段块)
//     传输投影 SnapshotSummary                          (列表视图, 砍掉 taskTree)
//     接口DTO  CompareRequest / ComparePayload / ApiResponse<T>
//
// ── 已【剔除】的前端自处理类型 (后端无需提供/存储) ───────────
//   比对引擎产出: ComparisonResult / CompareRow / TaskDiffResult /
//                 TaskFieldChange / CriticalPathDiff / DiffSummary / DiffType
//                 → 全部由前端 diffEngine.ts 本地计算
//   AI 分析产出  : AIAnalysisResult / AIAnalysisChunk / AIAnalysisStatus
//                 → 全部由前端 aiAnalysis.ts 流式调用外部 AI
//   比对字段映射 : COMPARE_FIELDS 常量 → 前端内部
//
// ── 分层加载契约 (后端实现依据) ─────────────────────────────
//   列表 GET /snapshots            → List<SnapshotSummary>   不读 taskTree
//   详情 GET /snapshots/{id}       → Snapshot                读 taskTree
//   比对 GET /snapshots/compare    → ComparePayload(2份完整) 按 id 关联读 taskTree
//   删除 DELETE /snapshots/{id}    → bool
//
// ── 日期字段说明 ────────────────────────────────────────────
//   契约层统一用 string 透传 (与前端 JSON 1:1, 零转换摩擦):
//     纯日期 = "YYYY-MM-DD"      时间戳 = ISO 8601
//   若后端 EF 要映射 datetime2, 建议在 DbContext 用 ValueConverter
//   或另建 DB 实体, 不要污染本契约层。
//
// ── EF 落地提示 ─────────────────────────────────────────────
//   taskTree / predecessors / cpmDates / assignedTo 等嵌套结构
//   建议存为 JSON 列 (单列序列化整棵树), 列表查询 SELECT 时排除该列;
//   若拆关系表, TaskNode.Children 为自引用一对多, 加载时按需 Include。
// ============================================================

using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ProjectBaseline.Models
{
    // ============================================================
    // 枚举 (锁定 TaskNode 取值边界)
    // ============================================================

    /// <summary>约束类型 — 限制任务排程方式 (对应 MS Project 约束)</summary>
    public enum ConstraintType
    {
        ASAP = 0,  // 越早越好 (默认, 正推)
        ALAP = 1,  // 越晚越好 (逆推)
        FNET = 2,  // 完成不早于 (Finish No Earlier Than)
        FNLT = 3,  // 完成不晚于 (Finish No Later Than)
        MSO = 4,   // 必须开始于 (Must Start On)
        MFO = 5,   // 必须完成于 (Must Finish On)
        SNET = 6,  // 开始不早于 (Start No Earlier Than)
        SNLT = 7   // 开始不晚于 (Start No Later Than)
    }

    /// <summary>任务状态</summary>
    public enum TaskStatus
    {
        PENDING = 0,     // 未开始
        IN_PROGRESS = 1, // 进行中
        COMPLETED = 2,   // 已完成
        SUSPENDED = 3    // 已暂停/挂起
    }

    /// <summary>任务类型</summary>
    public enum TaskType
    {
        TASK = 0,      // 普通任务 (参与 CPM 计算)
        MILESTONE = 1, // 里程碑 (工期=0)
        SUMMARY = 2    // 汇总/容器节点 (不参与 CPM, 工期由子任务 rollup)
    }

    /// <summary>前置依赖关系类型</summary>
    public enum DependencyType
    {
        FS = 0, // Finish-to-Start: 前置完成后才能开始 (最常用)
        SS = 1, // Start-to-Start:  前置开始后才能开始
        FF = 2, // Finish-to-Finish: 前置完成后才能完成
        SF = 3  // Start-to-Finish:  前置开始后才能完成 (极少用)
    }

    // ============================================================
    // 值对象 (内嵌字段块, 不单独存表)
    // ============================================================

    /// <summary>团队成员 — 内嵌于 TaskNode.AssignedTo / Snapshot.ProjectManager</summary>
    public class TeamMember
    {
        /// <summary>成员唯一标识 (对应 Aras Identity ID)</summary>
        [Required, MaxLength(50)]
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        /// <summary>成员姓名 (显示用)</summary>
        [Required, MaxLength(100)]
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        /// <summary>成员角色/职位 (如 "项目经理"、"结构工程师")</summary>
        [Required, MaxLength(100)]
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;
    }

    /// <summary>前置依赖 — 内嵌于 TaskNode.Predecessors, 描述任务间逻辑关系</summary>
    public class TaskPredecessor
    {
        /// <summary>依赖记录唯一标识</summary>
        [Required, MaxLength(50)]
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        /// <summary>前置任务 ID (指向 TaskNode.Id)</summary>
        [Required, MaxLength(50)]
        [JsonPropertyName("predecessorId")]
        public string PredecessorId { get; set; } = string.Empty;

        /// <summary>依赖类型 (FS/SS/FF/SF, 默认 FS)</summary>
        [JsonPropertyName("dependencyType")]
        public DependencyType DependencyType { get; set; } = DependencyType.FS;

        /// <summary>延迟天数 (正数=延后, 负数=提前/重叠, 单位: 工作日)</summary>
        [JsonPropertyName("lagDays")]
        public int LagDays { get; set; }
    }

    /// <summary>CPM 关键路径计算结果 — 内嵌于 TaskNode.CpmDates (整组算法输出)</summary>
    public class CPMDates
    {
        /// <summary>最早开始时间 (正推得出, 格式 "YYYY-MM-DD")</summary>
        [JsonPropertyName("earliestStart")]
        public string? EarliestStart { get; set; }

        /// <summary>最早完成时间 (ES + Duration, 格式 "YYYY-MM-DD")</summary>
        [JsonPropertyName("earliestFinish")]
        public string? EarliestFinish { get; set; }

        /// <summary>最晚开始时间 (逆推得出, 格式 "YYYY-MM-DD")</summary>
        [JsonPropertyName("latestStart")]
        public string? LatestStart { get; set; }

        /// <summary>最晚完成时间 (LS + Duration, 格式 "YYYY-MM-DD")</summary>
        [JsonPropertyName("latestFinish")]
        public string? LatestFinish { get; set; }

        /// <summary>总浮动 (Total Float = LS - ES, 单位: 天; 0 表示关键路径)</summary>
        [JsonPropertyName("totalFloat")]
        public double TotalFloat { get; set; }

        /// <summary>自由浮动 (Free Float: 不影响后继最早开始的可延迟天数)</summary>
        [JsonPropertyName("freeFloat")]
        public double FreeFloat { get; set; }

        /// <summary>是否关键路径任务 (TotalFloat == 0 时为 true)</summary>
        [JsonPropertyName("isCritical")]
        public bool IsCritical { get; set; }
    }

    // ============================================================
    // 第2层: TaskNode (WBS 任务节点, 自引用递归)
    // ============================================================

    /// <summary>WBS 任务节点 — 第二层核心实体, 通过 Children 自引用构成递归树</summary>
    public class TaskNode
    {
        /// <summary>任务唯一标识 (GUID 或 Aras Activity ID)</summary>
        [Key, MaxLength(50)]
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        /// <summary>WBS 编码 (如 "1.2.3", 表示层级位置)</summary>
        [Required, MaxLength(50)]
        [JsonPropertyName("wbs")]
        public string Wbs { get; set; } = string.Empty;

        /// <summary>任务名称</summary>
        [Required, MaxLength(200)]
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        /// <summary>任务描述/详细说明</summary>
        [MaxLength(2000)]
        [JsonPropertyName("description")]
        public string Description { get; set; } = string.Empty;

        /// <summary>任务类型 (TASK=普通 / MILESTONE=里程碑 / SUMMARY=汇总容器)</summary>
        [JsonPropertyName("type")]
        public TaskType Type { get; set; } = TaskType.TASK;

        /// <summary>任务状态 (PENDING/IN_PROGRESS/COMPLETED/SUSPENDED)</summary>
        [JsonPropertyName("status")]
        public TaskStatus Status { get; set; } = TaskStatus.PENDING;

        /// <summary>计划工期 (单位: 工作日; 里程碑=0)</summary>
        [JsonPropertyName("duration")]
        public int Duration { get; set; }

        /// <summary>完成百分比 (0~100)</summary>
        [Range(0, 100)]
        [JsonPropertyName("percentComplete")]
        public int PercentComplete { get; set; }

        /// <summary>是否里程碑 (冗余标记, 与 Type==MILESTONE 等价)</summary>
        [JsonPropertyName("isMilestone")]
        public bool IsMilestone { get; set; }

        /// <summary>计划开始日期 (基线排程, 格式 "YYYY-MM-DD")</summary>
        [Required, MaxLength(20)]
        [JsonPropertyName("plannedStartDate")]
        public string PlannedStartDate { get; set; } = string.Empty;

        /// <summary>计划结束日期 (基线排程, 格式 "YYYY-MM-DD")</summary>
        [Required, MaxLength(20)]
        [JsonPropertyName("plannedEndDate")]
        public string PlannedEndDate { get; set; } = string.Empty;

        /// <summary>实际开始日期 (开工后回填, 未开始为 null)</summary>
        [MaxLength(20)]
        [JsonPropertyName("actualStartDate")]
        public string? ActualStartDate { get; set; }

        /// <summary>实际结束日期 (完工后回填, 未完工为 null)</summary>
        [MaxLength(20)]
        [JsonPropertyName("actualEndDate")]
        public string? ActualEndDate { get; set; }

        /// <summary>目标开始日期 (合同/甲方要求, 格式 "YYYY-MM-DD")</summary>
        [Required, MaxLength(20)]
        [JsonPropertyName("targetStartDate")]
        public string TargetStartDate { get; set; } = string.Empty;

        /// <summary>目标结束日期 (合同/甲方要求, 格式 "YYYY-MM-DD")</summary>
        [Required, MaxLength(20)]
        [JsonPropertyName("targetEndDate")]
        public string TargetEndDate { get; set; } = string.Empty;

        /// <summary>约束类型 (限制排程方式, 默认 ASAP 越早越好)</summary>
        [JsonPropertyName("constraintType")]
        public ConstraintType ConstraintType { get; set; } = ConstraintType.ASAP;

        /// <summary>约束日期 (配合 ConstraintType 使用, 如 MSO 指定必须开始日)</summary>
        [MaxLength(20)]
        [JsonPropertyName("constraintDate")]
        public string? ConstraintDate { get; set; }

        /// <summary>前置依赖列表 (描述与哪些任务有逻辑先后关系)</summary>
        [JsonPropertyName("predecessors")]
        public List<TaskPredecessor> Predecessors { get; set; } = new();

        /// <summary>CPM 计算结果 (ES/EF/LS/LF/浮动/是否关键)</summary>
        [JsonPropertyName("cpmDates")]
        public CPMDates CpmDates { get; set; } = new();

        /// <summary>任务负责人 (内嵌值对象, 可为空表示未分配)</summary>
        [JsonPropertyName("assignedTo")]
        public TeamMember? AssignedTo { get; set; }

        /// <summary>任务备注/批注 (富文本或纯文本)</summary>
        [MaxLength(5000)]
        [JsonPropertyName("notes")]
        public string Notes { get; set; } = string.Empty;

        /// <summary>子任务列表 (自引用递归, 构成 WBS 树结构)</summary>
        [JsonPropertyName("children")]
        public List<TaskNode> Children { get; set; } = new();

        /// <summary>父任务 ID (顶层节点为 null, 用于反向查找)</summary>
        [MaxLength(50)]
        [JsonPropertyName("parentId")]
        public string? ParentId { get; set; }

        /// <summary>同级排序序号 (从 0 开始, 控制显示顺序)</summary>
        [JsonPropertyName("sortOrder")]
        public int SortOrder { get; set; }
    }

    // ============================================================
    // 第1层: Snapshot (完整实体, 含第二层 taskTree)
    //   用于: 详情 / 比对出参 / 新建提交
    // ============================================================

    /// <summary>项目基线快照 — 第一层核心实体, 包含元数据 + 完整任务树</summary>
    public class Snapshot
    {
        /// <summary>快照唯一标识 (GUID)</summary>
        [Key, MaxLength(50)]
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        /// <summary>快照名称 (用户自定义, 如 "2026-07 第三版基线")</summary>
        [Required, MaxLength(200)]
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        /// <summary>快照描述/备注说明</summary>
        [MaxLength(2000)]
        [JsonPropertyName("description")]
        public string Description { get; set; } = string.Empty;

        /// <summary>创建时间 (ISO 8601 格式, 如 "2026-07-22T10:30:00Z")</summary>
        [Required]
        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;

        /// <summary>项目编号 (对应 Aras Project 的 project_number)</summary>
        [Required, MaxLength(50)]
        [JsonPropertyName("projectNumber")]
        public string ProjectNumber { get; set; } = string.Empty;

        /// <summary>项目状态 (如 "进行中"、"已完成"、"已暂停")</summary>
        [Required, MaxLength(50)]
        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        /// <summary>项目经理 (内嵌值对象, 含 id/name/role)</summary>
        [JsonPropertyName("projectManager")]
        public TeamMember? ProjectManager { get; set; }

        /// <summary>计划开始日期 (格式 "YYYY-MM-DD")</summary>
        [Required, MaxLength(20)]
        [JsonPropertyName("targetStartDate")]
        public string TargetStartDate { get; set; } = string.Empty;

        /// <summary>计划结束日期 (格式 "YYYY-MM-DD")</summary>
        [Required, MaxLength(20)]
        [JsonPropertyName("targetEndDate")]
        public string TargetEndDate { get; set; } = string.Empty;

        /// <summary>预计结束日期 (CPM 正推算法计算得出, 格式 "YYYY-MM-DD")</summary>
        [Required, MaxLength(20)]
        [JsonPropertyName("projectedEndDate")]
        public string ProjectedEndDate { get; set; } = string.Empty;

        // 以下统计/关键路径为【派生字段】, 建议后端据 taskTree 计算后回填

        /// <summary>任务总数 (含所有层级 WBS 节点)</summary>
        [JsonPropertyName("totalTasks")]
        public int TotalTasks { get; set; }

        /// <summary>已完成任务数 (status=COMPLETED 的节点计数)</summary>
        [JsonPropertyName("completedTasks")]
        public int CompletedTasks { get; set; }

        /// <summary>整体完成百分比 (0~100, 加权或简单平均)</summary>
        [Range(0, 100)]
        [JsonPropertyName("overallPercentComplete")]
        public int OverallPercentComplete { get; set; }

        /// <summary>关键路径任务 ID 列表 (CPM 算法输出, 总浮动=0 的任务链)</summary>
        [JsonPropertyName("criticalPath")]
        public List<string> CriticalPath { get; set; } = new();

        /// <summary>是否为基线快照 (true=已锁定为对比基准, 不可修改)</summary>
        [JsonPropertyName("isBaseline")]
        public bool IsBaseline { get; set; }

        /// <summary>第二层入口 — 完整 WBS 任务递归树。列表查询不加载此项。</summary>
        [JsonPropertyName("taskTree")]
        public List<TaskNode> TaskTree { get; set; } = new();
    }

    // ============================================================
    // 传输投影: SnapshotSummary (列表视图, 故意不含 taskTree)
    //   字段与"快照管理"表格列一一对应
    // ============================================================

    /// <summary>快照摘要 — 列表视图投影, 故意不含 taskTree 以减少传输量</summary>
    public class SnapshotSummary
    {
        /// <summary>快照唯一标识 (GUID)</summary>
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        /// <summary>快照名称 (用户自定义, 如"2026-07 第三版基线")</summary>
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        /// <summary>快照描述/备注说明</summary>
        [JsonPropertyName("description")]
        public string Description { get; set; } = string.Empty;

        /// <summary>创建时间 (ISO 8601 格式, 如 "2026-07-22T10:30:00Z")</summary>
        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;

        /// <summary>项目编号 (对应 Aras Project 的 project_number)</summary>
        [JsonPropertyName("projectNumber")]
        public string ProjectNumber { get; set; } = string.Empty;

        /// <summary>项目状态 (如 "进行中"、"已完成"、"已暂停")</summary>
        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        /// <summary>项目经理 (内嵌值对象, 含 id/name/role)</summary>
        [JsonPropertyName("projectManager")]
        public TeamMember? ProjectManager { get; set; }

        /// <summary>计划开始日期 (格式 "YYYY-MM-DD")</summary>
        [JsonPropertyName("targetStartDate")]
        public string TargetStartDate { get; set; } = string.Empty;

        /// <summary>计划结束日期 (格式 "YYYY-MM-DD")</summary>
        [JsonPropertyName("targetEndDate")]
        public string TargetEndDate { get; set; } = string.Empty;

        /// <summary>预计结束日期 (CPM 正推算法计算得出, 格式 "YYYY-MM-DD")</summary>
        [JsonPropertyName("projectedEndDate")]
        public string ProjectedEndDate { get; set; } = string.Empty;

        /// <summary>任务总数 (含所有层级 WBS 节点)</summary>
        [JsonPropertyName("totalTasks")]
        public int TotalTasks { get; set; }

        /// <summary>已完成任务数 (status=COMPLETED 的节点计数)</summary>
        [JsonPropertyName("completedTasks")]
        public int CompletedTasks { get; set; }

        /// <summary>整体完成百分比 (0~100, 加权或简单平均)</summary>
        [JsonPropertyName("overallPercentComplete")]
        public int OverallPercentComplete { get; set; }

        /// <summary>关键路径任务 ID 列表 (CPM 算法输出, 总浮动=0 的任务链)</summary>
        [JsonPropertyName("criticalPath")]
        public List<string> CriticalPath { get; set; } = new();

        /// <summary>是否为基线快照 (true=已锁定为对比基准, 不可修改)</summary>
        [JsonPropertyName("isBaseline")]
        public bool IsBaseline { get; set; }

        // 注意: 故意【不含】 taskTree —— 列表无需第二层

        /// <summary>由完整 Snapshot 投影 (后端列表 Service 直接调用)</summary>
        public static SnapshotSummary From(Snapshot s) => new()
        {
            Id = s.Id,
            Name = s.Name,
            Description = s.Description,
            CreatedAt = s.CreatedAt,
            ProjectNumber = s.ProjectNumber,
            Status = s.Status,
            ProjectManager = s.ProjectManager,
            TargetStartDate = s.TargetStartDate,
            TargetEndDate = s.TargetEndDate,
            ProjectedEndDate = s.ProjectedEndDate,
            TotalTasks = s.TotalTasks,
            CompletedTasks = s.CompletedTasks,
            OverallPercentComplete = s.OverallPercentComplete,
            CriticalPath = s.CriticalPath,
            IsBaseline = s.IsBaseline,
        };
    }

    // ============================================================
    // 接口 DTO
    // ============================================================

    /// <summary>比对入参: 只传两个快照 ID, 第二层 taskTree 由后端按 id 关联加载</summary>
    public class CompareRequest
    {
        /// <summary>基准快照 ID (对比左侧/旧版)</summary>
        [Required, MaxLength(50)]
        [JsonPropertyName("snapshotId1")]
        public string SnapshotId1 { get; set; } = string.Empty;

        /// <summary>目标快照 ID (对比右侧/新版)</summary>
        [Required, MaxLength(50)]
        [JsonPropertyName("snapshotId2")]
        public string SnapshotId2 { get; set; } = string.Empty;
    }

    /// <summary>比对出参: 两份完整快照(含 taskTree), 供前端 diffEngine.ts 本地 diff</summary>
    public class ComparePayload
    {
        /// <summary>基准快照完整数据 (含 taskTree)</summary>
        [JsonPropertyName("snapshot1")]
        public Snapshot Snapshot1 { get; set; } = new();

        /// <summary>目标快照完整数据 (含 taskTree)</summary>
        [JsonPropertyName("snapshot2")]
        public Snapshot Snapshot2 { get; set; } = new();
    }

    /// <summary>通用 API 响应包装 — 统一 success/message/data 结构</summary>
    public class ApiResponse<T>
    {
        /// <summary>请求是否成功</summary>
        public bool Success { get; set; }

        /// <summary>提示消息 (成功时可选, 失败时必填)</summary>
        public string? Message { get; set; }

        /// <summary>响应数据载荷 (泛型, 失败时为 null)</summary>
        public T? Data { get; set; }

        /// <summary>构造成功响应</summary>
        public static ApiResponse<T> Ok(T data, string? msg = null)
            => new() { Success = true, Data = data, Message = msg };

        /// <summary>构造失败响应</summary>
        public static ApiResponse<T> Fail(string msg)
            => new() { Success = false, Message = msg };
    }
}
