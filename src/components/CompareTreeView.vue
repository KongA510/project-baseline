<script setup lang="ts">
/**
 * 左右树状比对组件
 * 左右两侧并排显示完整的项目计划树，逐行对齐
 *
 * 颜色标注：
 *   - 绿色背景 = 新增
 *   - 橙色背景 = 变更
 *   - 红色背景 = 删除
 *   - 无背景 = 无变化
 */
import { computed } from 'vue'
import {
  type CompareRow,
  type TaskNode,
  type TaskFieldChange,
  DiffType,
  TaskStatus,
} from '@/types'
import { formatTaskStatus } from '@/utils/diffEngine'

const props = defineProps<{
  rows: CompareRow[]
  /** 展开到第几层（默认全部展开） */
  expandLevel?: number
}>()

/** 展平树为可渲染的列表行（带展开/折叠状态），最大深度 10 防止死循环 */
function flattenTree(rows: CompareRow[], level: number = 0): CompareRow[] {
  if (level > 10) return []
  const result: CompareRow[] = []
  for (const row of rows) {
    result.push(row)
    if (row.children.length > 0) {
      result.push(...flattenTree(row.children, level + 1))
    }
  }
  return result
}

const flatRows = computed(() => {
  return flattenTree(props.rows)
})

/** 获取任务（优先右再左） */
function getTask(row: CompareRow): TaskNode | null {
  return row.rightTask ?? row.leftTask
}

/** 差异行背景色 */
function rowBgClass(row: CompareRow, side: 'left' | 'right'): string {
  switch (row.diffType) {
    case DiffType.ADDED:
      return side === 'right' ? 'bg-added' : 'bg-empty'
    case DiffType.REMOVED:
      return side === 'left' ? 'bg-removed' : 'bg-empty'
    case DiffType.MODIFIED:
      return 'bg-modified'
    default:
      return ''
  }
}

/** 行 hover 背景色 */
function rowHoverClass(row: CompareRow): string {
  switch (row.diffType) {
    case DiffType.ADDED: return 'hover-added'
    case DiffType.REMOVED: return 'hover-removed'
    case DiffType.MODIFIED: return 'hover-modified'
    default: return 'hover-unchanged'
  }
}

/** 获取前置依赖文本 */
function getPredLabel(task: TaskNode | null): string {
  if (!task || task.predecessors.length === 0) return '—'
  return task.predecessors.map(p => p.predecessorId).join(', ')
}

/** 状态标签类型 */
function getStatusType(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'success'
    case 'IN_PROGRESS': return 'primary'
    case 'PENDING': return 'info'
    case 'SUSPENDED': return 'warning'
    default: return 'info'
  }
}

/** 格式化日期 */
function fd(d: string | null | undefined): string {
  if (!d) return '—'
  return d
}

/** 字段是否变更（左侧基准：红色，右侧对比：橙色） */
function fieldChanged(row: CompareRow, field: string): boolean {
  return row.changes.some(c => c.field === field)
}

/** 变更字段标记 class — 左侧（旧值/被修改）红色，右侧（新值/修改后）橙色 */
function changedClass(row: CompareRow, field: string, side: 'left' | 'right'): string {
  if (!fieldChanged(row, field)) return ''
  return side === 'left' ? 'field-removed' : 'field-added'
}
</script>

<template>
  <!-- 表头 -->
  <div class="compare-header">
    <div class="header-left">
      <el-tag type="primary" effect="dark" round>快照 A（基准）</el-tag>
    </div>
    <div class="header-divider"></div>
    <div class="header-right">
      <el-tag type="success" effect="dark" round>快照 B（对比）</el-tag>
    </div>
  </div>

  <!-- 图例 -->
  <div class="legend-bar">
    <span class="legend-item"><span class="legend-dot" style="background: #67c23a;"></span> 新增</span>
    <span class="legend-item"><span class="legend-dot" style="background: #e6a23c;"></span> 变更</span>
    <span class="legend-item"><span class="legend-dot" style="background: #f56c6c;"></span> 删除</span>
    <span class="legend-item"><span class="legend-dot" style="background: #dcdfe6;"></span> 无变化</span>
  </div>

  <!-- 比对行容器 -->
  <div class="compare-body">
    <template v-for="row in flatRows" :key="row.uid">
      <div :class="['compare-row', rowHoverClass(row)]">
        <!-- 左侧 -->
        <div :class="['row-cell', 'cell-left', rowBgClass(row, 'left')]">
          <template v-if="row.leftTask">
            <div :class="['cell-content']" :style="{ paddingLeft: (row.level * 24 + 12) + 'px' }">
              <!-- 差异标签 -->
              <span class="diff-indicator">
                <el-tag
                  v-if="row.diffType === DiffType.ADDED"
                  type="success" size="small" effect="dark" class="mini-tag"
                ></el-tag>
                <el-tag
                  v-else-if="row.diffType === DiffType.REMOVED"
                  type="danger" size="small" effect="dark" class="mini-tag"
                ></el-tag>
                <el-tag
                  v-else-if="row.diffType === DiffType.MODIFIED"
                  type="warning" size="small" effect="dark" class="mini-tag"
                ></el-tag>
              </span>

              <span class="task-icon">
                <el-icon v-if="row.leftTask.isMilestone" class="milestone-icon" :size="16"><Trophy /></el-icon>
                <el-icon v-else-if="row.leftTask.type === 'SUMMARY'" color="#c8813a" :size="14"><FolderOpened /></el-icon>
                <el-icon v-else color="#5b9bd5" :size="14"><Document /></el-icon>
              </span>

              <span class="task-wbs">{{ row.leftTask.wbs }}</span>
              <span class="task-name">{{ row.leftTask.name }}</span>
              <span class="task-n">N:{{ row.leftTask.sortOrder }}</span>

              <span class="task-meta" v-if="row.leftTask.predecessors.length > 0">
                前继:{{ getPredLabel(row.leftTask) }}
              </span>

              <!-- SUMMARY 节点只显示 duration + progress + dates，不显示 status 和 assignedTo -->
              <template v-if="row.leftTask.type === 'SUMMARY'">
                <span class="task-meta" :class="changedClass(row, 'duration', 'left')">
                  {{ row.leftTask.duration }}天
                </span>
                <span class="task-meta">
                  <el-progress
                    :percentage="row.leftTask.percentComplete"
                    :stroke-width="5"
                    :color="row.leftTask.percentComplete === 100 ? '#67c23a' : '#409eff'"
                    style="width: 60px; display: inline-flex;"
                  />
                </span>
                <span class="task-meta task-dates" :class="changedClass(row, 'plannedStartDate', 'left') + ' ' + changedClass(row, 'plannedEndDate', 'left')">
                  {{ fd(row.leftTask.plannedStartDate) }} ~ {{ fd(row.leftTask.plannedEndDate) }}
                </span>
              </template>
              <template v-else>
                <el-tag :type="getStatusType(row.leftTask.status)" size="small" effect="light"
                  :class="changedClass(row, 'status', 'left')">
                  {{ formatTaskStatus(row.leftTask.status) }}
                </el-tag>
                <span class="task-meta" :class="changedClass(row, 'duration', 'left')">
                  {{ row.leftTask.duration }}天
                </span>
                <span class="task-meta">
                  <el-progress
                    :percentage="row.leftTask.percentComplete"
                    :stroke-width="5"
                    :color="row.leftTask.percentComplete === 100 ? '#67c23a' : '#409eff'"
                    style="width: 60px; display: inline-flex;"
                  />
                </span>
                <span class="task-meta task-dates" :class="changedClass(row, 'plannedStartDate', 'left') + ' ' + changedClass(row, 'plannedEndDate', 'left')">
                  {{ fd(row.leftTask.plannedStartDate) }} ~ {{ fd(row.leftTask.plannedEndDate) }}
                </span>
                <span class="task-meta" :class="changedClass(row, 'assignedToName', 'left') || changedClass(row, 'assignedToId', 'left') || changedClass(row, 'assignedToRole', 'left') ? 'field-removed' : ''">
                  {{ row.leftTask.assignedTo?.name ?? '未分配' }}
                  <span v-if="row.leftTask.assignedTo?.role" class="task-role">({{ row.leftTask.assignedTo.role }})</span>
                </span>
              </template>

              <el-tag v-if="row.leftTask.cpmDates.isCritical" type="danger" size="small" effect="dark"
                :class="changedClass(row, 'cpmDates.isCritical', 'left')">
                关键
              </el-tag>
            </div>
          </template>
          <template v-else>
            <div :class="['cell-content', 'cell-empty']" :style="{ paddingLeft: (row.level * 24 + 12) + 'px' }">
              <span class="empty-placeholder">（空）</span>
            </div>
          </template>
        </div>

        <!-- 中间分隔线 -->
        <div class="cell-divider"></div>

        <!-- 右侧 -->
        <div :class="['row-cell', 'cell-right', rowBgClass(row, 'right')]">
          <template v-if="row.rightTask">
            <div :class="['cell-content']" :style="{ paddingLeft: (row.level * 24 + 12) + 'px' }">
              <span class="diff-indicator">
                <el-tag
                  v-if="row.diffType === DiffType.ADDED"
                  type="success" size="small" effect="dark" class="mini-tag"
                ></el-tag>
                <el-tag
                  v-else-if="row.diffType === DiffType.REMOVED"
                  type="danger" size="small" effect="dark" class="mini-tag"
                ></el-tag>
                <el-tag
                  v-else-if="row.diffType === DiffType.MODIFIED"
                  type="warning" size="small" effect="dark" class="mini-tag"
                ></el-tag>
              </span>

              <span class="task-icon">
                <el-icon v-if="row.rightTask.isMilestone" class="milestone-icon" :size="16"><Trophy /></el-icon>
                <el-icon v-else-if="row.rightTask.type === 'SUMMARY'" color="#c8813a" :size="14"><FolderOpened /></el-icon>
                <el-icon v-else color="#5b9bd5" :size="14"><Document /></el-icon>
              </span>

              <span class="task-wbs">{{ row.rightTask.wbs }}</span>
              <span class="task-name">{{ row.rightTask.name }}</span>
              <span class="task-n">N:{{ row.rightTask.sortOrder }}</span>

              <span class="task-meta" v-if="row.rightTask.predecessors.length > 0">
                前继:{{ getPredLabel(row.rightTask) }}
              </span>

              <!-- SUMMARY 节点只显示 duration + progress + dates -->
              <template v-if="row.rightTask.type === 'SUMMARY'">
                <span class="task-meta" :class="changedClass(row, 'duration', 'right')">
                  {{ row.rightTask.duration }}天
                </span>
                <span class="task-meta">
                  <el-progress
                    :percentage="row.rightTask.percentComplete"
                    :stroke-width="5"
                    :color="row.rightTask.percentComplete === 100 ? '#67c23a' : '#409eff'"
                    style="width: 60px; display: inline-flex;"
                  />
                </span>
                <span class="task-meta task-dates" :class="changedClass(row, 'plannedStartDate', 'right') + ' ' + changedClass(row, 'plannedEndDate', 'right')">
                  {{ fd(row.rightTask.plannedStartDate) }} ~ {{ fd(row.rightTask.plannedEndDate) }}
                </span>
              </template>
              <template v-else>
                <el-tag :type="getStatusType(row.rightTask.status)" size="small" effect="light"
                  :class="changedClass(row, 'status', 'right')">
                  {{ formatTaskStatus(row.rightTask.status) }}
                </el-tag>
                <span class="task-meta" :class="changedClass(row, 'duration', 'right')">
                  {{ row.rightTask.duration }}天
                </span>
                <span class="task-meta">
                  <el-progress
                    :percentage="row.rightTask.percentComplete"
                    :stroke-width="5"
                    :color="row.rightTask.percentComplete === 100 ? '#67c23a' : '#409eff'"
                    style="width: 60px; display: inline-flex;"
                  />
                </span>
                <span class="task-meta task-dates" :class="changedClass(row, 'plannedStartDate', 'right') + ' ' + changedClass(row, 'plannedEndDate', 'right')">
                  {{ fd(row.rightTask.plannedStartDate) }} ~ {{ fd(row.rightTask.plannedEndDate) }}
                </span>
                <span class="task-meta" :class="changedClass(row, 'assignedToName', 'right') || changedClass(row, 'assignedToId', 'right') || changedClass(row, 'assignedToRole', 'right') ? 'field-added' : ''">
                  {{ row.rightTask.assignedTo?.name ?? '未分配' }}
                  <span v-if="row.rightTask.assignedTo?.role" class="task-role">({{ row.rightTask.assignedTo.role }})</span>
                </span>
              </template>

              <el-tag v-if="row.rightTask.cpmDates.isCritical" type="danger" size="small" effect="dark"
                :class="changedClass(row, 'cpmDates.isCritical', 'right')">
                关键
              </el-tag>
            </div>
          </template>
          <template v-else>
            <div :class="['cell-content', 'cell-empty']" :style="{ paddingLeft: (row.level * 24 + 12) + 'px' }">
              <span class="empty-placeholder">（空）</span>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <div v-if="flatRows.length === 0" style="text-align: center; padding: 40px; color: #909399;">
      无任务数据
    </div>
  </div>
</template>

<style scoped>
/* ========== 表头 ========== */
.compare-header {
  display: flex;
  align-items: center;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-bottom: 2px solid #dcdfe6;
  border-radius: 8px 8px 0 0;
  position: sticky;
  top: 0;
  z-index: 10;
}
.header-left,
.header-right {
  flex: 1;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.header-divider {
  width: 2px;
  background: #dcdfe6;
  align-self: stretch;
}

/* ========== 图例 ========== */
.legend-bar {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: #fafafa;
  border-left: 1px solid #e4e7ed;
  border-right: 1px solid #e4e7ed;
  font-size: 12px;
  color: #909399;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

/* ========== 比对行容器 ========== */
.compare-body {
  border: 1px solid #e4e7ed;
  border-top: none;
  border-radius: 0 0 8px 8px;
  overflow: auto;
  max-height: 700px;
}

/* ========== 行 ========== */
.compare-row {
  display: flex;
  border-bottom: 1px solid #ebeef5;
  transition: background 0.15s;
  min-height: 44px;
}
.compare-row:last-child {
  border-bottom: none;
  border-radius: 0 0 8px 8px;
}

/* hover 效果 */
.compare-row:hover .cell-left.bg-empty,
.compare-row:hover .cell-right.bg-empty {
  background: #fafafa;
}
.compare-row.hover-added:hover { background: #eaf7ea; }
.compare-row.hover-removed:hover { background: #fef0f0; }
.compare-row.hover-modified:hover { background: #f5f7fa; }
.compare-row.hover-unchanged:hover { background: #f5f7fa; }

/* ========== 单元格 ========== */
.row-cell {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

/* 分隔线 */
.cell-divider {
  width: 2px;
  background: #dcdfe6;
  flex-shrink: 0;
}

/* 背景色 */
.bg-added {
  background: #f0f9eb;
}
.bg-removed {
  background: #fef0f0;
}
/* 变更行不用整行背景，只用圆点+字段红色标记 */
.bg-modified {
  background: transparent;
}
.bg-empty {
  background: #fafafa;
}

/* ========== 单元格内容 ========== */
.cell-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  flex-wrap: wrap;
  min-height: 42px;
}

.cell-empty {
  justify-content: flex-start;
  font-style: italic;
  color: #c0c4cc;
}

.empty-placeholder {
  color: #c0c4cc;
  font-size: 12px;
  font-style: italic;
}

/* 差异指示灯 */
.diff-indicator .mini-tag {
  width: 6px;
  height: 6px;
  padding: 0;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 任务图标 */
.task-icon {
  flex-shrink: 0;
}

/* WBS */
.task-wbs {
  font-family: 'Consolas', 'Courier New', monospace;
  font-weight: 700;
  font-size: 12px;
  color: #303133;
  flex-shrink: 0;
  min-width: 30px;
}

/* 任务名称 */
.task-name {
  font-weight: 500;
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* N 序号 */
.task-n {
  font-size: 11px;
  color: #909399;
  flex-shrink: 0;
}

/* 元数据 */
.task-meta {
  font-size: 11px;
  color: #606266;
  white-space: nowrap;
}

.task-dates {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
}

.task-role {
  font-size: 10px;
  color: #909399;
  font-style: italic;
}

/* 里程碑图标 — 柔和绿色 */
.milestone-icon {
  color: #7ecb76;
}

/* 变更字段高亮 — 左侧（旧值/被修改方）红色，右侧（新值/修改后方）橙色 */
.field-removed {
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(245, 108, 108, 0.12);
  border: 1px solid #f56c6c;
  color: #f56c6c;
}
.field-added {
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(230, 162, 60, 0.15);
  border: 1px solid #e6a23c;
  color: #e6a23c;
}
</style>
