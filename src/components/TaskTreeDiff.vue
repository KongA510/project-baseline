<script setup lang="ts">
/**
 * 任务差异树组件
 * 递归渲染项目任务的树状结构，显示比对差异
 * 颜色标注：
 *   - 绿色 (#e6ffed / #b7eb8f) = 新增
 *   - 橙色 (#fff7e6 / #ffd591) = 已修改
 *   - 红色 (#fff1f0 / #ffa39e) = 删除
 *   - 默认 = 无变化
 */
import { computed } from 'vue'
import { type TaskDiffResult, DiffType, type TaskFieldChange, type TaskNode } from '@/types'
import { getDiffLabel, formatTaskStatus } from '@/utils/diffEngine'

const props = defineProps<{
  diffs: TaskDiffResult[]
  snapshotLabel: string
  level?: number
}>()

const level = computed(() => props.level ?? 0)

/** 差异行的背景色 */
function rowClassName(diffType: DiffType): string {
  switch (diffType) {
    case DiffType.ADDED: return 'row-added'
    case DiffType.REMOVED: return 'row-removed'
    case DiffType.MODIFIED: return 'row-modified'
    default: return 'row-unchanged'
  }
}

/** 获取任务（旧或新，优先新） */
function getTask(diff: TaskDiffResult): TaskNode | null {
  return diff.newTask ?? diff.oldTask
}

/** 获取前置依赖显示文本 */
function getPredecessorLabel(task: TaskNode | null): string {
  if (!task || task.predecessors.length === 0) return '—'
  return task.predecessors.map(p => p.predecessorId).join(', ')
}

/** 获取排序序号 N */
function getSortOrder(task: TaskNode | null): number {
  return task?.sortOrder ?? 0
}

/** 获取状态标签类型 */
function getStatusType(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'success'
    case 'IN_PROGRESS': return 'primary'
    case 'PENDING': return 'info'
    case 'SUSPENDED': return 'warning'
    default: return 'info'
  }
}

/** 获取类型标签 */
function getTaskTypeTag(type: string): string {
  switch (type) {
    case 'MILESTONE': return 'danger'
    case 'SUMMARY': return 'warning'
    default: return ''
  }
}

/** 格式化日期 */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return d
}

/** 获取字段变更详情 */
function getFieldChange(diff: TaskDiffResult, field: string): TaskFieldChange | undefined {
  return diff.changes.find(c => c.field === field)
}

/** 字段是否变化了 */
function isFieldChanged(diff: TaskDiffResult, field: string): boolean {
  return diff.changes.some(c => c.field === field)
}
</script>

<template>
  <div class="task-tree-diff">
    <template v-for="diff in diffs" :key="diff.wbs">
      <!-- 任务行 -->
      <div :class="['task-row', rowClassName(diff.diffType)]">
        <!-- 缩进 -->
        <div class="task-indent" :style="{ paddingLeft: `${level * 24}px` }">
          <!-- 差异标签 -->
          <el-tag
            :type="diff.diffType === DiffType.ADDED ? 'success' : diff.diffType === DiffType.REMOVED ? 'danger' : diff.diffType === DiffType.MODIFIED ? 'warning' : 'info'"
            size="small"
            effect="dark"
            class="diff-tag"
          >
            {{ getDiffLabel(diff.diffType) }}
          </el-tag>

          <!-- WBS 编号 -->
          <span class="task-wbs">{{ diff.wbs }}</span>

          <!-- 任务名称 -->
          <span class="task-name">
            <el-icon v-if="getTask(diff)?.isMilestone" class="milestone-icon" :size="16"><Trophy /></el-icon>
            <el-icon v-else-if="getTask(diff)?.type === 'SUMMARY'" color="#c8813a"><FolderOpened /></el-icon>
            <el-icon v-else color="#5b9bd5"><Document /></el-icon>
            {{ diff.taskName }}
          </span>

          <!-- 任务类型标签 -->
          <el-tag
            v-if="getTask(diff)?.type === 'MILESTONE'"
            type="danger"
            size="small"
            effect="plain"
          >
            里程碑
          </el-tag>
          <el-tag
            v-else-if="getTask(diff)?.type === 'SUMMARY'"
            type="warning"
            size="small"
            effect="plain"
          >
            摘要
          </el-tag>

          <!-- 排序序号 N -->
          <span class="task-sort-order">
            <el-tag size="small" type="info" effect="plain">
              N:{{ getSortOrder(getTask(diff)) }}
            </el-tag>
          </span>

          <!-- 前置依赖 -->
          <span class="task-predecessor" :title="getPredecessorLabel(getTask(diff))">
            <el-tag size="small" type="info" effect="plain" v-if="getTask(diff)?.predecessors.length">
              前继: {{ getPredecessorLabel(getTask(diff)) }}
            </el-tag>
          </span>

          <!-- 状态 -->
          <el-tag
            :type="getStatusType(getTask(diff)?.status ?? 'PENDING')"
            size="small"
            effect="light"
            :class="{ 'field-changed': isFieldChanged(diff, 'status') }"
          >
            {{ formatTaskStatus(getTask(diff)?.status ?? 'PENDING') }}
          </el-tag>

          <!-- 工期 -->
          <span
            class="task-field"
            :class="{ 'field-changed': isFieldChanged(diff, 'duration') }"
          >
            <el-icon><Timer /></el-icon>
            {{ getTask(diff)?.duration ?? '—' }}天
            <span v-if="isFieldChanged(diff, 'duration')" class="change-arrow">
              <template v-if="getFieldChange(diff, 'duration')">
                {{ getFieldChange(diff, 'duration')!.oldValue }}→{{ getFieldChange(diff, 'duration')!.newValue }}
              </template>
            </span>
          </span>

          <!-- 完成百分比 -->
          <span
            class="task-field"
            :class="{ 'field-changed': isFieldChanged(diff, 'percentComplete') }"
          >
            <el-progress
              :percentage="getTask(diff)?.percentComplete ?? 0"
              :stroke-width="6"
              :color="(getTask(diff)?.percentComplete ?? 0) === 100 ? '#67c23a' : '#409eff'"
              style="width: 80px; display: inline-flex;"
            />
            <span v-if="isFieldChanged(diff, 'percentComplete')" class="change-arrow">
              <template v-if="getFieldChange(diff, 'percentComplete')">
                {{ getFieldChange(diff, 'percentComplete')!.oldValue }}%→{{ getFieldChange(diff, 'percentComplete')!.newValue }}%
              </template>
            </span>
          </span>

          <!-- 日期 -->
          <span
            class="task-field task-dates"
            :class="{ 'field-changed': isFieldChanged(diff, 'plannedStartDate') || isFieldChanged(diff, 'plannedEndDate') }"
          >
            {{ fmtDate(getTask(diff)?.plannedStartDate) }} ~ {{ fmtDate(getTask(diff)?.plannedEndDate) }}
          </span>

          <!-- 关键路径标志 -->
          <el-tag
            v-if="getTask(diff)?.cpmDates?.isCritical"
            type="danger"
            size="small"
            effect="dark"
            :class="{ 'field-changed': isFieldChanged(diff, 'cpmDates.isCritical') }"
          >
            关键
          </el-tag>

          <!-- 负责人 -->
          <span
            class="task-field"
            :class="{ 'field-changed': isFieldChanged(diff, 'assignedTo') }"
          >
            {{ getTask(diff)?.assignedTo?.name ?? '未分配' }}
          </span>

          <!-- 展开变更详情按钮 -->
          <el-popover
            v-if="diff.diffType === DiffType.MODIFIED && diff.changes.length > 0"
            placement="bottom"
            :width="480"
            trigger="click"
          >
            <template #reference>
              <el-button size="small" text type="warning">
                <el-icon><InfoFilled /></el-icon>
                {{ diff.changes.length }}项变更
              </el-button>
            </template>
            <div class="changes-detail">
              <h4 style="margin: 0 0 12px;">字段变更详情</h4>
              <el-table :data="diff.changes" size="small" stripe max-height="300">
                <el-table-column prop="fieldLabel" label="字段" width="120" />
                <el-table-column label="旧值" width="160">
                  <template #default="{ row: change }: { row: TaskFieldChange }">
                    <span style="color: #f56c6c;">{{ change.oldValue ?? '—' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="新值" width="160">
                  <template #default="{ row: change }: { row: TaskFieldChange }">
                    <span style="color: #67c23a;">{{ change.newValue ?? '—' }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-popover>
        </div>
      </div>

      <!-- 递归渲染子任务（最大 10 层） -->
      <TaskTreeDiff
        v-if="diff.childrenDiffs.length > 0 && level < 10"
        :diffs="diff.childrenDiffs"
        :snapshot-label="snapshotLabel"
        :level="level + 1"
      />
    </template>
  </div>
</template>

<style scoped>
.task-tree-diff {
  font-size: 13px;
}

.task-row {
  border-bottom: 1px solid #ebeef5;
  transition: background-color 0.2s;
}

.task-row.row-added {
  background-color: #f0f9eb;
  border-left: 4px solid #67c23a;
}

.task-row.row-removed {
  background-color: #fef0f0;
  border-left: 4px solid #f56c6c;
}

.task-row.row-modified {
  background-color: #fdf6ec;
  border-left: 4px solid #e6a23c;
}

.task-row.row-unchanged {
  border-left: 4px solid transparent;
}

.task-indent {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  flex-wrap: wrap;
  min-height: 44px;
}

.diff-tag {
  flex-shrink: 0;
}

.task-wbs {
  font-family: 'Consolas', 'Courier New', monospace;
  font-weight: 700;
  color: #303133;
  min-width: 40px;
  flex-shrink: 0;
}

.task-name {
  font-weight: 500;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 120px;
}

.task-predecessor {
  margin-left: 4px;
}

.task-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #606266;
  font-size: 12px;
  white-space: nowrap;
}

.task-dates {
  font-family: 'Consolas', 'Courier New', monospace;
}

/* 里程碑图标 — 柔和绿色 */
.milestone-icon {
  color: #7ecb76;
}

.field-changed {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(230, 162, 60, 0.15);
  border: 1px dashed #e6a23c;
}

.change-arrow {
  color: #e6a23c;
  font-weight: 600;
  font-size: 11px;
}

.changes-detail h4 {
  color: #303133;
}
</style>
