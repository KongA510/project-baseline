// ============================================================
// 项目基线 - Pinia 状态管理
// 管理快照、比对和 AI 分析状态
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  type Snapshot,
  type ComparisonResult,
  type AIAnalysisResult,
  AIAnalysisStatus,
} from '@/types'
import { compareSnapshots } from '@/utils/diffEngine'
import { loadMockSnapshots } from '@/mock/mockData'

export const useBaselineStore = defineStore('baseline', () => {
  // ============================================================
  // 状态
  // ============================================================

  /** 所有快照 */
  const snapshots = ref<Snapshot[]>([])

  /** 当前选中的快照 ID（用于比对选择） */
  const selectedSnapshotId1 = ref<string | null>(null)
  const selectedSnapshotId2 = ref<string | null>(null)

  /** 当前比对结果 */
  const comparisonResult = ref<ComparisonResult | null>(null)

  /** AI 分析结果 */
  const aiAnalysis = ref<AIAnalysisResult>({
    status: AIAnalysisStatus.IDLE,
    chunks: [],
  })

  /** 加载状态 */
  const isLoading = ref(false)

  /** 是否已初始化 */
  const initialized = ref(false)

  // ============================================================
  // 计算属性
  // ============================================================

  /** 快照列表（按创建时间倒序） */
  const sortedSnapshots = computed(() =>
    [...snapshots.value].sort(
      (a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime()
    )
  )

  /** 选中的快照1 */
  const snapshot1 = computed(() =>
    snapshots.value.find(s => s.meta.id === selectedSnapshotId1.value) ?? null
  )

  /** 选中的快照2 */
  const snapshot2 = computed(() =>
    snapshots.value.find(s => s.meta.id === selectedSnapshotId2.value) ?? null
  )

  /** 快照数量 */
  const snapshotCount = computed(() => snapshots.value.length)

  // ============================================================
  // 操作
  // ============================================================

  /** 初始化：加载快照数据 */
  function init() {
    if (initialized.value) return
    isLoading.value = true
    try {
      const mockSnapshots = loadMockSnapshots()
      snapshots.value = mockSnapshots
      initialized.value = true
    } finally {
      isLoading.value = false
    }
  }

  /** 创建新快照 */
  function createSnapshot(snapshot: Snapshot) {
    snapshots.value.push(snapshot)
  }

  /** 删除快照 */
  function deleteSnapshot(snapshotId: string) {
    const idx = snapshots.value.findIndex(s => s.meta.id === snapshotId)
    if (idx !== -1) {
      snapshots.value.splice(idx, 1)
    }
    // 清除相关选择
    if (selectedSnapshotId1.value === snapshotId) selectedSnapshotId1.value = null
    if (selectedSnapshotId2.value === snapshotId) selectedSnapshotId2.value = null
  }

  /** 选择比对快照 */
  function selectSnapshots(id1: string | null, id2: string | null) {
    selectedSnapshotId1.value = id1
    selectedSnapshotId2.value = id2
  }

  /** 执行比对 */
  function runComparison(): ComparisonResult | null {
    const s1 = snapshot1.value
    const s2 = snapshot2.value

    if (!s1 || !s2) return null

    const result = compareSnapshots(s1, s2)
    comparisonResult.value = result

    // 重置 AI 分析
    aiAnalysis.value = { status: AIAnalysisStatus.IDLE, chunks: [] }

    return result
  }

  /** 清除比对结果 */
  function clearComparison() {
    comparisonResult.value = null
    aiAnalysis.value = { status: AIAnalysisStatus.IDLE, chunks: [] }
    selectedSnapshotId1.value = null
    selectedSnapshotId2.value = null
  }

  /** 追加 AI 分析流式内容 */
  function appendAIChunk(content: string) {
    aiAnalysis.value.status = AIAnalysisStatus.ANALYZING
    aiAnalysis.value.chunks.push({
      content,
      timestamp: new Date().toISOString(),
    })
  }

  /** 完成 AI 分析 */
  function completeAIAnalysis() {
    aiAnalysis.value.status = AIAnalysisStatus.COMPLETED
  }

  /** AI 分析错误 */
  function errorAIAnalysis(error: string) {
    aiAnalysis.value.status = AIAnalysisStatus.ERROR
    aiAnalysis.value.error = error
  }

  return {
    // 状态
    snapshots,
    selectedSnapshotId1,
    selectedSnapshotId2,
    comparisonResult,
    aiAnalysis,
    isLoading,
    initialized,

    // 计算属性
    sortedSnapshots,
    snapshot1,
    snapshot2,
    snapshotCount,

    // 操作
    init,
    createSnapshot,
    deleteSnapshot,
    selectSnapshots,
    runComparison,
    clearComparison,
    appendAIChunk,
    completeAIAnalysis,
    errorAIAnalysis,
  }
})
