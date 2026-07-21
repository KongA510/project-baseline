<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBaselineStore } from '@/store/baseline'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Snapshot } from '@/types'

const router = useRouter()
const store = useBaselineStore()

// 展开的快照行
const expandedRows = ref<string[]>([])

// 当前查看的快照详情
const viewingSnapshot = ref<Snapshot | null>(null)
const showDetailDialog = ref(false)

// 格式化日期
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN')
}

// 查看快照详情
function viewDetail(snapshot: Snapshot) {
  viewingSnapshot.value = snapshot
  showDetailDialog.value = true
}

// 删除快照
async function confirmDelete(snapshot: Snapshot) {
  try {
    await ElMessageBox.confirm(
      `确定要删除快照 "${snapshot.name}" 吗？此操作不可撤销。`,
      '确认删除',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    )
    store.deleteSnapshot(snapshot.id)
    ElMessage.success('快照已删除')
  } catch {
    // 取消
  }
}

// 新建快照（模拟）
function createNewSnapshot() {
  ElMessage.info('新快照创建功能将在对接 Aras API 后开放。当前使用模拟数据。')
}

// 获取关键路径任务名称
function getCriticalPathNames(snapshot: Snapshot): string {
  const taskMap = new Map<string, string>()
  function walk(tasks: any[], depth: number) {
    if (depth > 10) return
    for (const t of tasks) {
      taskMap.set(t.id, t.name)
      if (t.children) walk(t.children, depth + 1)
    }
  }
  walk(snapshot.taskTree, 0)
  return snapshot.criticalPath.map(id => taskMap.get(id) || '?').join(' → ')
}
</script>

<template>
  <div style="padding: 24px 32px; max-width: 1400px; margin: 0 auto;">
    <!-- 页头 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div>
        <h2 style="margin: 0 0 4px; font-size: 22px; color: #1a1a2e;">
          <el-icon color="#409eff"><CameraFilled /></el-icon>
          快照管理
        </h2>
        <p style="margin: 0; color: #6b7280; font-size: 13px;">
          管理项目计划基线快照，支持创建、查看、删除和选择用于比对
        </p>
      </div>
      <el-space>
        <el-button @click="router.push('/compare')" type="success">
          <el-icon><SwitchFilled /></el-icon> 去比对
        </el-button>
        <el-button type="primary" @click="createNewSnapshot">
          <el-icon><Plus /></el-icon> 新建快照
        </el-button>
      </el-space>
    </div>

    <!-- 快照列表 -->
    <el-card shadow="hover" v-if="store.snapshots.length > 0">
      <el-table
        :data="store.sortedSnapshots"
        stripe
        size="large"
        row-key="id"
        style="width: 100%;"
      >
        <el-table-column type="expand">
          <template #default="{ row }: { row: Snapshot }">
            <div style="padding: 16px 24px;">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="快照 ID">{{ row.id }}</el-descriptions-item>
                <el-descriptions-item label="目标开始日期">{{ row.targetStartDate }}</el-descriptions-item>
                <el-descriptions-item label="目标完成日期">{{ row.targetEndDate }}</el-descriptions-item>
                <el-descriptions-item label="项目编号">{{ row.projectNumber }}</el-descriptions-item>
                <el-descriptions-item label="项目状态">{{ row.status }}</el-descriptions-item>
                <el-descriptions-item label="项目负责人">{{ row.projectManager?.name ?? '—' }}</el-descriptions-item>
                <el-descriptions-item label="关键路径">
                  <el-tag
                    v-for="(taskId, idx) in row.criticalPath"
                    :key="taskId"
                    size="small"
                    type="danger"
                    effect="light"
                    style="margin-right: 4px;"
                  >
                    {{ taskId }}
                  </el-tag>
                  <span v-if="row.criticalPath.length === 0" style="color: #909399;">无</span>
                </el-descriptions-item>
                <el-descriptions-item label="关键路径详情" :span="2">
                  <span style="font-size: 12px; color: #606266;">{{ getCriticalPathNames(row) }}</span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="快照名称" min-width="200">
          <template #default="{ row }: { row: Snapshot }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-icon :size="20" color="#409eff"><CameraFilled /></el-icon>
              <span style="font-weight: 600;">{{ row.name }}</span>
              <el-tag v-if="row.name.includes('V1.0')" type="success" size="small" effect="dark">基线</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip />

        <el-table-column label="创建时间" width="180">
          <template #default="{ row }: { row: Snapshot }">
            <span style="font-size: 13px;">{{ formatDate(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="任务进度" width="180">
          <template #default="{ row }: { row: Snapshot }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-progress
                :percentage="row.overallPercentComplete"
                :stroke-width="6"
                style="flex: 1;"
                :color="row.overallPercentComplete === 100 ? '#67c23a' : '#409eff'"
              />
            </div>
          </template>
        </el-table-column>

        <el-table-column label="任务统计" width="140">
          <template #default="{ row }: { row: Snapshot }">
            <el-tag type="success" effect="light" size="small">
              {{ row.completedTasks }}/{{ row.totalTasks }} 已完成
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }: { row: Snapshot }">
            <el-space>
              <el-button size="small" text type="primary" @click="viewDetail(row)">
                <el-icon><View /></el-icon> 详情
              </el-button>
              <el-button size="small" text type="danger" @click="confirmDelete(row)">
                <el-icon><Delete /></el-icon> 删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 空状态 -->
    <el-empty v-else description="暂无快照数据，请先创建快照">
      <el-button type="primary" @click="createNewSnapshot">创建第一个快照</el-button>
    </el-empty>

    <!-- 快照详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      :title="viewingSnapshot?.name"
      width="900px"
      destroy-on-close
    >
      <template v-if="viewingSnapshot">
        <el-descriptions :column="2" border size="small" style="margin-bottom: 24px;">
          <el-descriptions-item label="快照 ID">{{ viewingSnapshot.id }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(viewingSnapshot.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ viewingSnapshot.description }}</el-descriptions-item>
          <el-descriptions-item label="项目编号">{{ viewingSnapshot.projectNumber }}</el-descriptions-item>
          <el-descriptions-item label="总任务数">{{ viewingSnapshot.totalTasks }}</el-descriptions-item>
          <el-descriptions-item label="完成任务数">{{ viewingSnapshot.completedTasks }}</el-descriptions-item>
          <el-descriptions-item label="总体完成度">
            <el-progress :percentage="viewingSnapshot.overallPercentComplete" :stroke-width="8" />
          </el-descriptions-item>
          <el-descriptions-item label="关键路径任务数">{{ viewingSnapshot.criticalPath.length }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-bottom: 12px;">关键路径任务</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px;">
          <el-tag
            v-for="id in viewingSnapshot.criticalPath"
            :key="id"
            type="danger"
            effect="light"
          >
            {{ id }}
          </el-tag>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
