// ============================================================
// 项目基线 - Pinia 状态管理（极简 Snapshot 结构）
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

  const snapshots = ref<Snapshot[]>([])
  const selectedSnapshotId1 = ref<string | null>(null)
  const selectedSnapshotId2 = ref<string | null>(null)
  const comparisonResult = ref<ComparisonResult | null>(null)
  const aiAnalysis = ref<AIAnalysisResult>({ status: AIAnalysisStatus.IDLE, chunks: [] })
  const isLoading = ref(false)
  const initialized = ref(false)

  // ============================================================
  // 计算属性
  // ============================================================

  const sortedSnapshots = computed(() =>
    [...snapshots.value].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  )

  const snapshot1 = computed(() =>
    snapshots.value.find(s => s.id === selectedSnapshotId1.value) ?? null
  )

  const snapshot2 = computed(() =>
    snapshots.value.find(s => s.id === selectedSnapshotId2.value) ?? null
  )

  const snapshotCount = computed(() => snapshots.value.length)

  // ============================================================
  // 操作
  // ============================================================

  function init() {
    if (initialized.value) return
    isLoading.value = true
    try {
      snapshots.value = loadMockSnapshots()
      initialized.value = true
    } finally {
      isLoading.value = false
    }
  }

  function createSnapshot(snapshot: Snapshot) {
    snapshots.value.push(snapshot)
  }

  function deleteSnapshot(snapshotId: string) {
    const idx = snapshots.value.findIndex(s => s.id === snapshotId)
    if (idx !== -1) snapshots.value.splice(idx, 1)
    if (selectedSnapshotId1.value === snapshotId) selectedSnapshotId1.value = null
    if (selectedSnapshotId2.value === snapshotId) selectedSnapshotId2.value = null
  }

  function selectSnapshots(id1: string | null, id2: string | null) {
    selectedSnapshotId1.value = id1
    selectedSnapshotId2.value = id2
  }

  function runComparison(): ComparisonResult | null {
    const s1 = snapshot1.value
    const s2 = snapshot2.value
    if (!s1 || !s2) return null
    const result = compareSnapshots(s1, s2)
    comparisonResult.value = result
    aiAnalysis.value = { status: AIAnalysisStatus.IDLE, chunks: [] }
    return result
  }

  function clearComparison() {
    comparisonResult.value = null
    aiAnalysis.value = { status: AIAnalysisStatus.IDLE, chunks: [] }
    selectedSnapshotId1.value = null
    selectedSnapshotId2.value = null
  }

  function appendAIChunk(content: string) {
    aiAnalysis.value.status = AIAnalysisStatus.ANALYZING
    aiAnalysis.value.chunks.push({ content, timestamp: new Date().toISOString() })
  }

  function completeAIAnalysis() {
    aiAnalysis.value.status = AIAnalysisStatus.COMPLETED
  }

  function errorAIAnalysis(error: string) {
    aiAnalysis.value.status = AIAnalysisStatus.ERROR
    aiAnalysis.value.error = error
  }

  return {
    snapshots, selectedSnapshotId1, selectedSnapshotId2,
    comparisonResult, aiAnalysis, isLoading, initialized,
    sortedSnapshots, snapshot1, snapshot2, snapshotCount,
    init, createSnapshot, deleteSnapshot, selectSnapshots,
    runComparison, clearComparison,
    appendAIChunk, completeAIAnalysis, errorAIAnalysis,
  }
})
