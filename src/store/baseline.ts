// ============================================================
// baseline store - layered loading
//   first layer  : summaries (SnapshotSummary, NO taskTree) -> list / select / home
//   second layer : detailCache (full Snapshot w/ taskTree)  -> loaded on compare
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  type Snapshot,
  type SnapshotSummary,
  type ComparisonResult,
  type AIAnalysisResult,
  AIAnalysisStatus,
} from '@/types'
import { compareSnapshots } from '@/utils/diffEngine'
import { loadMockSnapshots, loadMockSnapshotDetail } from '@/mock/mockData'

// project a full snapshot into a lightweight first-layer summary (drop taskTree)
function toSummary(s: Snapshot): SnapshotSummary {
  return {
    id: s.id, name: s.name, description: s.description, createdAt: s.createdAt,
    projectNumber: s.projectNumber, status: s.status, projectManager: s.projectManager,
    targetStartDate: s.targetStartDate, targetEndDate: s.targetEndDate, projectedEndDate: s.projectedEndDate,
    totalTasks: s.totalTasks, completedTasks: s.completedTasks, overallPercentComplete: s.overallPercentComplete,
    criticalPath: s.criticalPath, isBaseline: s.isBaseline,
  }
}

export const useBaselineStore = defineStore('baseline', () => {
  // ---- state ----
  const summaries = ref<SnapshotSummary[]>([])                 // first layer only
  const detailCache = ref<Record<string, Snapshot>>({})        // second layer, on demand

  const selectedSnapshotId1 = ref<string | null>(null)
  const selectedSnapshotId2 = ref<string | null>(null)
  const comparisonResult = ref<ComparisonResult | null>(null)
  const aiAnalysis = ref<AIAnalysisResult>({ status: AIAnalysisStatus.IDLE, chunks: [] })
  const isLoading = ref(false)
  const initialized = ref(false)

  // ---- getters ----
  const sortedSnapshots = computed(() =>
    [...summaries.value].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  )
  const snapshotCount = computed(() => summaries.value.length)
  const snapshot1 = computed(() =>
    selectedSnapshotId1.value ? detailCache.value[selectedSnapshotId1.value] ?? null : null
  )
  const snapshot2 = computed(() =>
    selectedSnapshotId2.value ? detailCache.value[selectedSnapshotId2.value] ?? null : null
  )

  // ---- load first layer only (list page) ----
  function init() {
    if (initialized.value) return
    isLoading.value = true
    try {
      summaries.value = loadMockSnapshots().map(toSummary)
      initialized.value = true
    } finally {
      isLoading.value = false
    }
  }

  // ---- load second layer on demand (compare) ----
  async function loadSnapshotDetail(id: string): Promise<Snapshot | null> {
    if (detailCache.value[id]) return detailCache.value[id]
    await new Promise((r) => setTimeout(r, 120)) // simulate network fetch of taskTree
    const full = loadMockSnapshotDetail(id)
    if (full) detailCache.value[id] = full
    return full
  }

  // ---- mutations ----
  function createSnapshot(snapshot: Snapshot) {
    summaries.value.unshift(toSummary(snapshot))
    detailCache.value[snapshot.id] = snapshot
  }

  function deleteSnapshot(snapshotId: string) {
    summaries.value = summaries.value.filter((s) => s.id !== snapshotId)
    delete detailCache.value[snapshotId]
    if (selectedSnapshotId1.value === snapshotId) selectedSnapshotId1.value = null
    if (selectedSnapshotId2.value === snapshotId) selectedSnapshotId2.value = null
  }

  function selectSnapshots(id1: string | null, id2: string | null) {
    selectedSnapshotId1.value = id1
    selectedSnapshotId2.value = id2
  }

  // comparison triggers second-layer load for both snapshots, then local diff
  async function runComparison(): Promise<ComparisonResult | null> {
    const id1 = selectedSnapshotId1.value
    const id2 = selectedSnapshotId2.value
    if (!id1 || !id2) return null
    const [s1, s2] = await Promise.all([loadSnapshotDetail(id1), loadSnapshotDetail(id2)])
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
  function completeAIAnalysis() { aiAnalysis.value.status = AIAnalysisStatus.COMPLETED }
  function errorAIAnalysis(error: string) {
    aiAnalysis.value.status = AIAnalysisStatus.ERROR
    aiAnalysis.value.error = error
  }

  return {
    summaries, detailCache, selectedSnapshotId1, selectedSnapshotId2,
    comparisonResult, aiAnalysis, isLoading, initialized,
    sortedSnapshots, snapshot1, snapshot2, snapshotCount,
    init, loadSnapshotDetail, createSnapshot, deleteSnapshot, selectSnapshots,
    runComparison, clearComparison, appendAIChunk, completeAIAnalysis, errorAIAnalysis,
  }
})