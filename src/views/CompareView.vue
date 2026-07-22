<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBaselineStore } from '@/store/baseline'
import { ElMessage } from 'element-plus'
import type { SnapshotSummary } from '@/types'

const router = useRouter()
const store = useBaselineStore()

onMounted(() => {
  store.init()
})

// 选中的快照
const snapshotId1 = ref<string | null>(store.selectedSnapshotId1)
const snapshotId2 = ref<string | null>(store.selectedSnapshotId2)

// 格式化日期
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN')
}

// 执行比对
function startComparison() {
  if (!snapshotId1.value || !snapshotId2.value) {
    ElMessage.warning('请选择两个快照')
    return
  }
  if (snapshotId1.value === snapshotId2.value) {
    ElMessage.warning('请选择两个不同的快照进行比对')
    return
  }
  store.selectSnapshots(snapshotId1.value, snapshotId2.value)
  router.push(`/compare/${snapshotId1.value}/${snapshotId2.value}`)
}

// 交换选择
function swapSelections() {
  const temp = snapshotId1.value
  snapshotId1.value = snapshotId2.value
  snapshotId2.value = temp
}

// 获取快照简称
function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) + '...' : id
}

// 可用快照列表（过滤掉另一侧已选的）
const availableForLeft = ref<SnapshotSummary[]>([])
const availableForRight = ref<SnapshotSummary[]>([])
</script>

<template>
  <div style="padding: 24px 32px; max-width: 1200px; margin: 0 auto;">
    <!-- 页头 -->
    <div style="margin-bottom: 32px;">
      <h2 style="margin: 0 0 4px; font-size: 22px; color: #1a1a2e;">
        <el-icon color="#f5576c"><SwitchFilled /></el-icon>
        基线比对
      </h2>
      <p style="margin: 0; color: #6b7280; font-size: 13px;">
        选择两个快照进行差异分析，系统将自动比对任务变化、关键路径变化等
      </p>
    </div>

    <!-- 选择区域 -->
    <el-row :gutter="32" style="margin-bottom: 32px;">
      <!-- 左侧快照选择 -->
      <el-col :span="11">
        <el-card shadow="hover" class="select-card" :class="{ 'card-selected': snapshotId1 }">
          <template #header>
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-tag type="primary" effect="dark" round>快照 A（基准）</el-tag>
              <span style="font-weight: 600; font-size: 15px;">选择基准快照</span>
            </div>
          </template>

          <el-select
            v-model="snapshotId1"
            placeholder="选择基准快照..."
            size="large"
            style="width: 100%;"
            filterable
          >
            <el-option
              v-for="s in store.sortedSnapshots"
              :key="s.id"
              :label="s.name"
              :value="s.id"
              :disabled="s.id === snapshotId2"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>{{ s.name }}</span>
                <span style="font-size: 11px; color: #909399;">{{ formatDate(s.createdAt) }}</span>
              </div>
            </el-option>
          </el-select>

          <!-- 选中快照信息 -->
          <div v-if="snapshotId1" style="margin-top: 16px;">
            <template v-for="s in store.sortedSnapshots.filter(x => x.id === snapshotId1)" :key="s.id">
              <el-descriptions :column="1" size="small" border>
                <el-descriptions-item label="描述">{{ s.description }}</el-descriptions-item>
                <el-descriptions-item label="总任务">{{ s.totalTasks }}</el-descriptions-item>
                <el-descriptions-item label="完成度">
                  <el-progress :percentage="s.overallPercentComplete" :stroke-width="6" />
                </el-descriptions-item>
                <el-descriptions-item label="关键路径任务">{{ s.criticalPath.length }} 个</el-descriptions-item>
              </el-descriptions>
            </template>
          </div>

          <el-empty v-else description="请选择基准快照" :image-size="60" style="padding: 20px 0;" />
        </el-card>
      </el-col>

      <!-- 交换按钮 -->
      <el-col :span="2" style="display: flex; align-items: center; justify-content: center;">
        <el-button
          circle
          size="large"
          @click="swapSelections"
          :disabled="!snapshotId1 && !snapshotId2"
        >
          <el-icon :size="20"><Sort /></el-icon>
        </el-button>
      </el-col>

      <!-- 右侧快照选择 -->
      <el-col :span="11">
        <el-card shadow="hover" class="select-card" :class="{ 'card-selected': snapshotId2 }">
          <template #header>
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-tag type="success" effect="dark" round>快照 B（对比）</el-tag>
              <span style="font-weight: 600; font-size: 15px;">选择对比快照</span>
            </div>
          </template>

          <el-select
            v-model="snapshotId2"
            placeholder="选择对比快照..."
            size="large"
            style="width: 100%;"
            filterable
          >
            <el-option
              v-for="s in store.sortedSnapshots"
              :key="s.id"
              :label="s.name"
              :value="s.id"
              :disabled="s.id === snapshotId1"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>{{ s.name }}</span>
                <span style="font-size: 11px; color: #909399;">{{ formatDate(s.createdAt) }}</span>
              </div>
            </el-option>
          </el-select>

          <div v-if="snapshotId2" style="margin-top: 16px;">
            <template v-for="s in store.sortedSnapshots.filter(x => x.id === snapshotId2)" :key="s.id">
              <el-descriptions :column="1" size="small" border>
                <el-descriptions-item label="描述">{{ s.description }}</el-descriptions-item>
                <el-descriptions-item label="总任务">{{ s.totalTasks }}</el-descriptions-item>
                <el-descriptions-item label="完成度">
                  <el-progress :percentage="s.overallPercentComplete" :stroke-width="6" />
                </el-descriptions-item>
                <el-descriptions-item label="关键路径任务">{{ s.criticalPath.length }} 个</el-descriptions-item>
              </el-descriptions>
            </template>
          </div>

          <el-empty v-else description="请选择对比快照" :image-size="60" style="padding: 20px 0;" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 比对按钮 -->
    <div style="text-align: center;">
      <el-button
        type="primary"
        size="large"
        :disabled="!snapshotId1 || !snapshotId2"
        @click="startComparison"
        style="min-width: 200px; height: 48px; font-size: 16px;"
      >
        <el-icon :size="20"><SwitchFilled /></el-icon>
        开始比对
      </el-button>
      <p style="margin-top: 12px; color: #909399; font-size: 12px;" v-if="!snapshotId1 || !snapshotId2">
        请先在左右两侧选择两个不同的快照
      </p>
    </div>

    <!-- 快照快速列表 -->
    <el-card shadow="hover" style="margin-top: 32px;">
      <template #header>
        <span style="font-weight: 600;">可用快照列表</span>
      </template>
      <el-table
        :data="store.sortedSnapshots"
        stripe
        size="default"
        @row-click="(row: SnapshotSummary) => { if (!snapshotId1) { snapshotId1 = row.id } else if (!snapshotId2) { snapshotId2 = row.id } }"
        style="cursor: pointer;"
      >
        <el-table-column prop="name" label="名称" min-width="180">
          <template #default="{ row }: { row: SnapshotSummary }">
            <el-icon color="#409eff"><CameraFilled /></el-icon>
            <span style="margin-left: 8px; font-weight: 500;">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="220" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }: { row: SnapshotSummary }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="A" width="60" align="center">
          <template #default="{ row }: { row: SnapshotSummary }">
            <el-radio
              :model-value="snapshotId1"
              :value="row.id"
              @change="snapshotId1 = row.id"
            />
          </template>
        </el-table-column>
        <el-table-column label="B" width="60" align="center">
          <template #default="{ row }: { row: SnapshotSummary }">
            <el-radio
              :model-value="snapshotId2"
              :value="row.id"
              @change="snapshotId2 = row.id"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.select-card {
  min-height: 250px;
  transition: all 0.3s ease;
  border: 2px solid #e4e7ed;
}

.select-card.card-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}
</style>
