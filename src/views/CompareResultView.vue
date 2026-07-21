<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBaselineStore } from '@/store/baseline'
import { ElMessage } from 'element-plus'
import type { CompareRow } from '@/utils/diffEngine'
import CompareTreeView from '@/components/CompareTreeView.vue'
import { streamAIAnalysis } from '@/services/aiAnalysis'
import { exportTaskCompareExcel, exportChangeDetailWord, exportAIAnalysisWord } from '@/services/exportService'
import { AIAnalysisStatus } from '@/types'

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

// 导出处理
const exporting = ref(false)

async function handleExportExcel() {
  if (!result.value) return
  try {
    exporting.value = true
    exportTaskCompareExcel(result.value, store.snapshot1?.name ?? '基准A', store.snapshot2?.name ?? '对比B')
    ElMessage.success('任务比对 Excel 导出成功')
  } catch (e: any) {
    ElMessage.error(`导出失败: ${e?.message ?? e}`)
  } finally {
    exporting.value = false
  }
}

async function handleExportChangeWord() {
  if (!result.value) return
  try {
    exporting.value = true
    await exportChangeDetailWord(result.value, store.snapshot1?.name ?? '基准A', store.snapshot2?.name ?? '对比B')
    ElMessage.success('变更详情 Word 导出成功')
  } catch (e: any) {
    ElMessage.error(`导出失败: ${e?.message ?? e}`)
  } finally {
    exporting.value = false
  }
}

async function handleExportAIWord() {
  if (!aiStreamingText.value) {
    ElMessage.warning('请先完成 AI 分析后再导出')
    return
  }
  try {
    exporting.value = true
    await exportAIAnalysisWord(aiStreamingText.value, store.snapshot1?.name ?? '基准A', store.snapshot2?.name ?? '对比B')
    ElMessage.success('基线比对建议 Word 导出成功')
  } catch (e: any) {
    ElMessage.error(`导出失败: ${e?.message ?? e}`)
  } finally {
    exporting.value = false
  }
}

// AI 分析状态
const aiAnalyzing = ref(false)
const aiStreamingText = ref('')
const aiError = ref('')
const aiOutputEl = ref<HTMLElement | null>(null)

/** 启动 AI 流式分析 */
async function startAIAnalysis() {
  if (!result.value) return
  aiAnalyzing.value = true
  aiStreamingText.value = ''
  aiError.value = ''
  store.aiAnalysis = { status: AIAnalysisStatus.ANALYZING, chunks: [] }

  await streamAIAnalysis(result.value, {
    onChunk(text: string) {
      aiStreamingText.value += text
      store.appendAIChunk(text)
      // 自动滚动到底部
      nextTick(() => {
        if (aiOutputEl.value) {
          aiOutputEl.value.scrollTop = aiOutputEl.value.scrollHeight
        }
      })
    },
    onComplete(fullText: string) {
      aiAnalyzing.value = false
      store.completeAIAnalysis()
    },
    onError(error: string) {
      aiAnalyzing.value = false
      aiError.value = error
      store.errorAIAnalysis(error)
      ElMessage.error(`AI 分析失败: ${error}`)
    },
  })
}

// 简单的 markdown → HTML 渲染（处理 **bold** 和换行）
function renderMarkdown(text: string): string {
  if (!text) return ''
  let html = text
  // **bold** → <strong>bold</strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // 处理标题 ### / ## / #
  html = html.replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 6px;color:#303133;">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 style="margin:14px 0 6px;color:#1a1a2e;">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 style="margin:16px 0 8px;color:#1a1a2e;font-size:17px;">$1</h2>')
  // 处理无序列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  // 处理有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
  // 包裹连续的 <li>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul style="padding-left:20px;margin:4px 0;">$1</ul>')
  // 处理换行
  html = html.replace(/\n\n/g, '<br/>')
  html = html.replace(/\n/g, '<br/>')
  return html
}
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
        <el-dropdown trigger="click" :disabled="!result">
          <el-button type="primary" plain :loading="exporting">
            <el-icon><Download /></el-icon> 导出报告
            <el-icon style="margin-left: 2px;"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleExportExcel">
                <el-icon><List /></el-icon> 任务计划左右比对 — Excel 表格
              </el-dropdown-item>
              <el-dropdown-item @click="handleExportChangeWord">
                <el-icon><Document /></el-icon> 变更任务字段详情 — Word 文档
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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

      <!-- ============ 2. AI 智能分析 ============ -->
      <el-card shadow="hover" style="margin-bottom: 20px;" class="ai-card">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;"
               @click="showAiAnalysis = !showAiAnalysis">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-icon color="#a855f7" :size="20"><ChatDotRound /></el-icon>
              <span style="font-weight: 600; font-size: 16px;">AI 智能分析</span>
              <el-tag v-if="aiAnalyzing" type="warning" size="small" effect="plain">
                <el-icon class="is-loading"><Loading /></el-icon> 分析中...
              </el-tag>
              <el-tag v-else-if="aiStreamingText" type="success" size="small" effect="plain">已完成</el-tag>
              <el-tag v-else-if="aiError" type="danger" size="small" effect="plain">出错</el-tag>
            </div>
            <el-button text :icon="showAiAnalysis ? 'ArrowUp' : 'ArrowDown'" />
          </div>
        </template>

        <div v-show="showAiAnalysis">
          <!-- 未开始状态 -->
          <div v-if="!aiStreamingText && !aiAnalyzing && !aiError" style="text-align: center; padding: 32px 20px;">
            <el-icon :size="48" color="#a855f7"><Cpu /></el-icon>
            <h3 style="color: #303133; margin: 16px 0 8px;">AI 智能差异分析</h3>
            <p style="color: #909399; font-size: 13px; max-width: 500px; margin: 0 auto 20px;">
              基于 Agnes AI 对基线差异进行智能分析，涵盖关键路径影响、风险识别、资源变化等多维度解读。
            </p>
            <el-button type="primary" size="large" @click="startAIAnalysis" :loading="false" style="min-width: 180px;">
              <el-icon><Cpu /></el-icon> 开始 AI 分析
            </el-button>
          </div>

          <!-- 流式输出区域 -->
          <div v-if="aiStreamingText || aiAnalyzing" class="ai-output-area" ref="aiOutputEl">
            <div class="ai-output-header">
              <div class="ai-output-avatar">AI</div>
              <div class="ai-output-model">Agnes 2.0 Flash</div>
            </div>
            <div class="ai-output-content" v-html="renderMarkdown(aiStreamingText)"></div>
            <!-- 光标动画 -->
            <span v-if="aiAnalyzing" class="ai-cursor-blink">▌</span>
          </div>

          <!-- 错误状态 -->
          <div v-if="aiError" style="text-align: center; padding: 20px;">
            <el-result icon="error" title="AI 分析失败" :sub-title="aiError">
              <template #extra>
                <el-button type="primary" @click="startAIAnalysis">重新分析</el-button>
              </template>
            </el-result>
          </div>

          <!-- 完成后可重新分析 / 导出 -->
          <div v-if="aiStreamingText && !aiAnalyzing && !aiError" style="text-align: center; margin-top: 12px; display: flex; gap: 12px; justify-content: center;">
            <el-button text size="small" @click="startAIAnalysis">
              <el-icon><Refresh /></el-icon> 重新分析
            </el-button>
            <el-button type="primary" size="small" @click="handleExportAIWord">
              <el-icon><Download /></el-icon> 导出基线比对建议
            </el-button>
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

/* AI 流式输出区域 */
.ai-output-area {
  max-height: 500px;
  overflow-y: auto;
  background: #faf5ff;
  border-radius: 12px;
  padding: 20px 24px;
}

.ai-output-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e9d5ff;
}

.ai-output-avatar {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
}

.ai-output-model {
  font-size: 12px; color: #7c3aed; font-weight: 500;
}

.ai-output-content {
  flex: 1; font-size: 14px; line-height: 1.9; color: #374151;
  white-space: pre-wrap; word-break: break-word;
}

.ai-output-content :deep(strong) {
  color: #6d28d9; font-weight: 600;
}

.ai-output-content :deep(h2), .ai-output-content :deep(h3), .ai-output-content :deep(h4) {
  color: #1a1a2e;
}

.ai-output-content :deep(li) {
  margin-bottom: 2px;
}

.ai-output-content :deep(ul) {
  padding-left: 20px;
  margin: 4px 0;
}

/* 流式光标闪烁动画 */
.ai-cursor-blink {
  display: inline-block; color: #a855f7; font-weight: 700; font-size: 16px;
  animation: blink 1s step-end infinite;
  vertical-align: middle; margin-left: 1px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* AI 输出区域滚动条 */
.ai-output-area::-webkit-scrollbar {
  width: 6px;
}
.ai-output-area::-webkit-scrollbar-thumb {
  background: #d4bfff;
  border-radius: 3px;
}
.ai-output-area::-webkit-scrollbar-thumb:hover {
  background: #a855f7;
}

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
