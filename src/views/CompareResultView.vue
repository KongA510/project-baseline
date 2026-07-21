<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBaselineStore } from '@/store/baseline'
import { ElMessage } from 'element-plus'
import type { CompareRow } from '@/utils/diffEngine'
import CompareTreeView from '@/components/CompareTreeView.vue'

const route = useRoute()
const router = useRouter()
const store = useBaselineStore()

onMounted(() => {
  store.init()

  const id1 = route.params.id1 as string
  const id2 = route.params.id2 as string

  if (id1 && id2) {
    store.selectSnapshots(id1, id2)
    const result = store.runComparison()
    if (!result) {
      ElMessage.error('比对失败，请检查快照数据')
      router.push('/compare')
    }
  } else {
    router.push('/compare')
  }
})

// 比对结果
const result = computed(() => store.comparisonResult)
const compareRows = computed(() => store.comparisonResult?.compareRows ?? [])

/** 递归收集所有有变更的行（包含 children 中的变更），最大深度 10 防止死循环 */
function collectChangedRows(rows: CompareRow[] | undefined, depth = 0): CompareRow[] {
  if (!rows || depth > 10) return []
  const result: CompareRow[] = []
  for (const r of rows) {
    if (r.changes?.length > 0) result.push(r)
    if (r.children?.length > 0) result.push(...collectChangedRows(r.children, depth + 1))
  }
  return result
}

const allChangedRows = computed(() => collectChangedRows(compareRows.value))

// 差异统计
const diffStats = computed(() => {
  if (!result.value) return []
  const s = result.value.summary
  return [
    { label: '新增任务', value: s.totalAdded, type: 'success', color: '#67c23a' },
    { label: '删除任务', value: s.totalRemoved, type: 'danger', color: '#f56c6c' },
    { label: '变更任务', value: s.totalModified, type: 'warning', color: '#e6a23c' },
    { label: '无变化', value: s.totalUnchanged, type: 'info', color: '#909399' },
  ]
})

// 关键路径统计
const criticalPathStats = computed(() => {
  if (!result.value) return []
  const cp = result.value.criticalPathDiff
  return [
    { label: '新增到关键路径', value: cp.addedToCriticalPath.length, type: 'danger' as const },
    { label: '从关键路径移除', value: cp.removedFromCriticalPath.length, type: 'warning' as const },
    { label: '总浮时变化', value: cp.totalFloatChange > 0 ? `+${cp.totalFloatChange.toFixed(1)}天` : `${cp.totalFloatChange.toFixed(1)}天`, type: 'info' as const },
    { label: '关键路径工期变化', value: cp.totalDurationChange > 0 ? `+${cp.totalDurationChange}天` : `${cp.totalDurationChange}天`, type: 'info' as const },
  ]
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN')
}

// 展开控制
const showCriticalPath = ref(true)
const showTaskTree = ref(true)
const showAiAnalysis = ref(true)
</script>

<template>
  <div style="padding: 24px 32px; max-width: 1800px; margin: 0 auto;">
    <!-- 页头 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div>
        <h2 style="margin: 0 0 4px; font-size: 22px; color: #1a1a2e;">
          <el-icon color="#f5576c"><SwitchFilled /></el-icon>
          基线比对结果
        </h2>
        <p style="margin: 0; color: #6b7280; font-size: 13px;">
          生成于 {{ result ? formatDate(result.comparedAt) : '...' }}
        </p>
      </div>
      <el-space>
        <el-button @click="router.push('/compare')" text>
          <el-icon><ArrowLeft /></el-icon> 重新选择
        </el-button>
        <el-button type="primary" plain>
          <el-icon><Download /></el-icon> 导出报告
        </el-button>
      </el-space>
    </div>

    <template v-if="result">
      <!-- 快照信息卡片 -->
      <el-row :gutter="20" style="margin-bottom: 20px;">
        <el-col :span="12">
          <el-card shadow="hover" class="snap-card snap-card-left">
            <template #header>
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-tag type="primary" effect="dark" round>基准 A</el-tag>
                <span style="font-weight: 600;">{{ store.snapshot1?.name }}</span>
                <span style="font-size: 12px; color: #909399;">
                  {{ formatDate(store.snapshot1?.createdAt ?? '') }}
                </span>
              </div>
            </template>
            <span style="font-size: 13px; color: #606266;">{{ store.snapshot1?.description }}</span>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="hover" class="snap-card snap-card-right">
            <template #header>
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-tag type="success" effect="dark" round>对比 B</el-tag>
                <span style="font-weight: 600;">{{ store.snapshot2?.name }}</span>
                <span style="font-size: 12px; color: #909399;">
                  {{ formatDate(store.snapshot2?.createdAt ?? '') }}
                </span>
              </div>
            </template>
            <span style="font-size: 13px; color: #606266;">{{ store.snapshot2?.description }}</span>
          </el-card>
        </el-col>
      </el-row>

      <!-- 差异统计仪表盘 -->
      <el-card shadow="hover" style="margin-bottom: 20px;">
        <template #header><span style="font-weight: 600;">差异统计概览</span></template>
        <el-row :gutter="16">
          <el-col :span="6" v-for="stat in diffStats" :key="stat.label">
            <div class="stat-card" :style="{ borderColor: stat.color }">
              <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <!-- ============ 1. 左右任务树比对 ============ -->
      <el-card shadow="hover" style="margin-bottom: 20px;">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;"
               @click="showTaskTree = !showTaskTree">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-icon color="#409eff" :size="20"><List /></el-icon>
              <span style="font-weight: 600; font-size: 16px;">任务计划左右比对</span>
            </div>
            <el-button text :icon="showTaskTree ? 'ArrowUp' : 'ArrowDown'" />
          </div>
        </template>

        <div v-show="showTaskTree">
          <CompareTreeView :rows="compareRows" />

          <!-- 变更详情表 -->
          <div v-if="allChangedRows.length > 0" style="margin-top: 24px;">
            <h4 style="margin-bottom: 12px; color: #e6a23c;">
              <el-icon><WarningFilled /></el-icon> 变更任务字段详情（共 {{ allChangedRows.length }} 项）
            </h4>
            <div class="changes-scroll-container">
            <div v-for="row in allChangedRows" :key="row.uid" style="margin-bottom: 16px;">
              <el-card shadow="never" size="small" style="border-left: 3px solid #e6a23c;">
                <template #header>
                  <span style="font-weight: 600;">{{ row.wbs }} {{ row.rightTask?.name ?? row.leftTask?.name }} — {{ row.changes.length }}项变更</span>
                </template>
                <el-table :data="row.changes" size="small" stripe max-height="300">
                  <el-table-column prop="fieldLabel" label="字段" width="140" />
                  <el-table-column label="旧值（基准A）">
                    <template #default="{ row: c }">
                      <span class="change-old-value">{{ c.oldValue ?? '—' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="新值（对比B）">
                    <template #default="{ row: c }">
                      <span class="change-new-value">{{ c.newValue ?? '—' }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </el-card>
            </div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- ============ 2. AI 分析（占位） ============ -->
      <el-card shadow="hover" style="margin-bottom: 20px;" class="ai-card">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;"
               @click="showAiAnalysis = !showAiAnalysis">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-icon color="#a855f7" :size="20"><ChatDotRound /></el-icon>
              <span style="font-weight: 600; font-size: 16px;">AI 智能分析</span>
              <el-tag type="warning" size="small" effect="plain">待接入 API</el-tag>
            </div>
            <el-button text :icon="showAiAnalysis ? 'ArrowUp' : 'ArrowDown'" />
          </div>
        </template>

        <div v-show="showAiAnalysis" style="text-align: center; padding: 40px 20px;">
          <el-icon :size="48" color="#c0c4cc"><Cpu /></el-icon>
          <h3 style="color: #909399; margin: 16px 0 8px;">AI 流式分析（待接入）</h3>
          <p style="color: #b0b8c8; font-size: 13px; max-width: 500px; margin: 0 auto 16px;">
            后续接入 AI 接口后，此处将对差异结果进行流式分析，逐步输出。
          </p>

          <div class="ai-summary" style="text-align: left; max-width: 600px; margin: 0 auto;">
            <div class="ai-bubble">
              <div class="ai-avatar">AI</div>
              <div class="ai-text">
                <p>差异摘要：</p>
                <ul>
                  <li>新增 <strong>{{ result.summary.totalAdded }}</strong> 个任务，删除 <strong>{{ result.summary.totalRemoved }}</strong> 个，变更 <strong>{{ result.summary.totalModified }}</strong> 个</li>
                  <li v-if="result.criticalPathDiff.totalDurationChange !== 0">
                    关键路径工期变化 <strong :style="{ color: result.criticalPathDiff.totalDurationChange > 0 ? '#f56c6c' : '#67c23a' }">
                      {{ result.criticalPathDiff.totalDurationChange > 0 ? '+' : '' }}{{ result.criticalPathDiff.totalDurationChange }}天
                    </strong>
                  </li>
                  <li>完成 AI 接口接入后将提供详细的流式分析报告</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- ============ 3. 关键路径差异 ============ -->
      <el-card shadow="hover" style="margin-bottom: 20px;">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;"
               @click="showCriticalPath = !showCriticalPath">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-icon color="#f56c6c" :size="20"><Connection /></el-icon>
              <span style="font-weight: 600; font-size: 16px;">关键路径差异分析</span>
            </div>
            <el-button text :icon="showCriticalPath ? 'ArrowUp' : 'ArrowDown'" />
          </div>
        </template>

        <div v-show="showCriticalPath">
          <el-row :gutter="16" style="margin-bottom: 16px;">
            <el-col :span="6" v-for="stat in criticalPathStats" :key="stat.label">
              <div class="stat-card stat-card-small">
                <div class="stat-value-sm">{{ stat.value }}</div>
                <div class="stat-label-sm">{{ stat.label }}</div>
              </div>
            </el-col>
          </el-row>

          <div v-if="result.criticalPathDiff.addedToCriticalPath.length > 0" style="margin-bottom: 12px;">
            <h4 style="color: #f56c6c; margin-bottom: 8px;">新增到关键路径</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <el-tag v-for="t in result.criticalPathDiff.addedToCriticalPath" :key="t.id" type="danger" effect="light">
                {{ t.wbs }} {{ t.name }}
              </el-tag>
            </div>
          </div>

          <div v-if="result.criticalPathDiff.removedFromCriticalPath.length > 0" style="margin-bottom: 12px;">
            <h4 style="color: #e6a23c; margin-bottom: 8px;">从关键路径移除</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <el-tag v-for="t in result.criticalPathDiff.removedFromCriticalPath" :key="t.id" type="warning" effect="light">
                {{ t.wbs }} {{ t.name }}
              </el-tag>
            </div>
          </div>

          <el-empty v-if="result.criticalPathDiff.addedToCriticalPath.length === 0 && result.criticalPathDiff.removedFromCriticalPath.length === 0"
                    description="关键路径无变化" :image-size="48" />
        </div>
      </el-card>
    </template>

    <el-empty v-else description="未找到比对结果" />
  </div>
</template>

<style scoped>
.snap-card { border-top: 3px solid #409eff; }
.snap-card-left { border-top-color: #409eff; }
.snap-card-right { border-top-color: #67c23a; }

.stat-card {
  text-align: center;
  padding: 16px;
  border: 2px solid #e4e7ed;
  border-radius: 12px;
  transition: all 0.3s;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }
.stat-value { font-size: 36px; font-weight: 700; font-family: 'Consolas', 'Courier New', monospace; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }

.stat-card-small { padding: 12px; }
.stat-value-sm { font-size: 24px; font-weight: 700; font-family: 'Consolas', 'Courier New', monospace; color: #303133; }
.stat-label-sm { font-size: 12px; color: #909399; margin-top: 2px; }

.ai-card { border-top: 3px solid #a855f7; }

.ai-summary { margin-top: 16px; }
.ai-bubble { display: flex; gap: 12px; }
.ai-avatar {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.ai-text {
  flex: 1; background: #fff; border-radius: 8px; padding: 12px 16px;
  font-size: 13px; line-height: 1.8; color: #303133;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.ai-text ul { padding-left: 20px; margin: 8px 0; }
.ai-text ul li { margin-bottom: 4px; }
.ai-text strong { color: #409eff; }

/* 变更详情滚动容器 — 限制高度防止过长影响后面AI分析加载 */
.changes-scroll-container {
  max-height: 500px;
  overflow-y: auto;
  padding-right: 4px;
}

/* 滚动条美化 */
.changes-scroll-container::-webkit-scrollbar {
  width: 6px;
}
.changes-scroll-container::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}
.changes-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #909399;
}

/* 变更详情旧值/新值颜色 */
.change-old-value {
  color: #f56c6c;
  font-weight: 500;
}
.change-new-value {
  color: #e6a23c;
  font-weight: 500;
}
</style>
