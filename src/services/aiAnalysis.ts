// ============================================================
// AI 流式分析服务 — Agnes AI
// 将差异结果构建为 prompt，调用 Agnes AI 逐步流式返回分析
// ============================================================

import type { ComparisonResult, CompareRow } from '@/types'
import { DiffType } from '@/types'

// ============================================================
// Agnes AI 配置
// ============================================================

const AGNES_API_URL = 'https://apihub.agnes-ai.com/v1/chat/completions'
const AGNES_API_KEY = 'sk-RCXeizrvdXJpgbxVS7dNKngEebudI7gg4VwhLkE4g94W7kvG'
const AGNES_MODEL = 'agnes-2.0-flash'

// ============================================================
// 递归收集差异行（防死循环）
// ============================================================

function collectAllRows(rows: CompareRow[], depth = 0): CompareRow[] {
  if (!rows || depth > 10) return []
  const result: CompareRow[] = []
  for (const r of rows) {
    result.push(r)
    if (r.children?.length > 0) result.push(...collectAllRows(r.children, depth + 1))
  }
  return result
}

// ============================================================
// 字段映射工具
// ============================================================

function formatTaskStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: '未开始',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    SUSPENDED: '暂停',
  }
  return map[status] ?? status
}

function formatFieldValue(field: string, val: string | number | null): string {
  if (val === null || val === undefined) return '无'
  if (field === 'status') return formatTaskStatus(String(val))
  if (field === 'isMilestone') return val === '是' ? '是' : '否'
  return String(val)
}

// ============================================================
// 构建 AI 分析 prompt（结构化差异摘要）
// ============================================================

function buildAIPrompt(result: ComparisonResult): string {
  const { summary, criticalPathDiff, compareRows } = result

  // 收集所有有变更的行
  const allRows = collectAllRows(compareRows)
  const addedRows = allRows.filter(r => r.diffType === DiffType.ADDED)
  const removedRows = allRows.filter(r => r.diffType === DiffType.REMOVED)
  const modifiedRows = allRows.filter(r => r.diffType === DiffType.MODIFIED)

  let prompt = `你是一位专业的项目管理分析师。请对以下项目基线的差异比对结果进行深入分析，用中文逐步分点输出。\n\n`

  // 1. 总体概览
  prompt += `## 差异总体概览\n\n`
  prompt += `- 新增任务: ${summary.totalAdded} 个\n`
  prompt += `- 删除任务: ${summary.totalRemoved} 个\n`
  prompt += `- 变更任务: ${summary.totalModified} 个\n`
  prompt += `- 无变化: ${summary.totalUnchanged} 个\n`
  prompt += `- 新增到关键路径: ${summary.criticalPathAdded} 个\n`
  prompt += `- 从关键路径移除: ${summary.criticalPathRemoved} 个\n\n`

  // 2. 新增任务详情
  if (addedRows.length > 0) {
    prompt += `## 新增任务\n\n`
    for (const r of addedRows) {
      const t = r.rightTask!
      prompt += `- WBS ${r.wbs}: **${t.name}** (工期${t.duration}天, 负责人${t.assignedTo?.name ?? '未分配'})\n`
    }
    prompt += `\n`
  }

  // 3. 删除任务详情
  if (removedRows.length > 0) {
    prompt += `## 删除任务\n\n`
    for (const r of removedRows) {
      const t = r.leftTask!
      prompt += `- WBS ${r.wbs}: **${t.name}** (工期${t.duration}天, 负责人${t.assignedTo?.name ?? '未分配'})\n`
    }
    prompt += `\n`
  }

  // 4. 变更任务详情
  if (modifiedRows.length > 0) {
    prompt += `## 变更任务详情\n\n`
    for (const r of modifiedRows) {
      const t = r.rightTask ?? r.leftTask
      prompt += `### ${r.wbs} ${t?.name ?? ''}\n`
      for (const c of r.changes) {
        prompt += `- **${c.fieldLabel}**: ${formatFieldValue(c.field, c.oldValue)} → ${formatFieldValue(c.field, c.newValue)}\n`
      }
      prompt += `\n`
    }
  }

  // 5. 关键路径变化
  if (criticalPathDiff.addedToCriticalPath.length > 0) {
    prompt += `## 关键路径新增任务\n\n`
    for (const t of criticalPathDiff.addedToCriticalPath) {
      prompt += `- WBS ${t.wbs}: ${t.name} (工期${t.duration}天)\n`
    }
    prompt += `\n`
  }
  if (criticalPathDiff.removedFromCriticalPath.length > 0) {
    prompt += `## 关键路径移除任务\n\n`
    for (const t of criticalPathDiff.removedFromCriticalPath) {
      prompt += `- WBS ${t.wbs}: ${t.name}\n`
    }
    prompt += `\n`
  }
  prompt += `关键路径工期变化: ${criticalPathDiff.totalDurationChange > 0 ? '+' : ''}${criticalPathDiff.totalDurationChange}天\n`
  prompt += `总浮时变化: ${criticalPathDiff.totalFloatChange > 0 ? '+' : ''}${criticalPathDiff.totalFloatChange.toFixed(1)}天\n\n`

  // 6. 分析要求
  prompt += `---\n`
  prompt += `请从以下几个维度对上述差异进行专业分析，逐点输出：\n\n`
  prompt += `1. **变更概述**：用一两句话总结本次基线变更的规模和影响范围。\n`
  prompt += `2. **关键路径影响**：分析关键路径变化对项目总工期的影响；关键路径是缩短了还是延长了？对项目按时交付有何影响？\n`
  prompt += `3. **风险识别**：根据任务的新增、删除和变更，识别可能存在风险的领域。哪些变更可能导致进度延期、资源冲突或质量风险？\n`
  prompt += `4. **资源变化分析**：分析人员变更情况，是否有新的资源投入或关键人员变动？这些变动对项目执行有何影响？\n`
  prompt += `5. **结构变化解读**：分析WBS结构变化（任务新增/删除）背后的业务含义。这些变化反映了项目规划怎样的调整思路？\n`
  prompt += `6. **建议与结论**：基于以上分析，给出项目管理层面的建议和总体结论。\n\n`
  prompt += `请确保分析专业、具体、可操作，使用Markdown格式输出，适当使用**加粗**、列表和emoji标记重要发现。`

  return prompt
}

// ============================================================
// 流式调用类型
// ============================================================

export interface StreamCallbacks {
  /** 收到一个 chunk */
  onChunk: (text: string) => void
  /** 全部完成 */
  onComplete: (fullText: string) => void
  /** 出错 */
  onError: (error: string) => void
}

// ============================================================
// 流式调用 Agnes AI
// ============================================================

export async function streamAIAnalysis(
  result: ComparisonResult,
  callbacks: StreamCallbacks
): Promise<void> {
  const prompt = buildAIPrompt(result)

  // 限制 prompt token 数量（粗略估算：中文约每字符2 token）
  const maxPromptBytes = 8000  // ~4000 中文字符
  const truncatedPrompt = prompt.length > maxPromptBytes
    ? prompt.slice(0, maxPromptBytes) + '\n\n--- 内容过长已截断，请基于已有数据进行分析 ---'
    : prompt

  try {
    const response = await fetch(AGNES_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGNES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AGNES_MODEL,
        messages: [
          {
            role: 'user',
            content: truncatedPrompt,
          },
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '未知错误')
      throw new Error(`API 返回错误 (${response.status}): ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('浏览器不支持流式读取')
    }

    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 解析 SSE 数据行
      const lines = buffer.split('\n')
      // 最后一个可能不完整，保留给下次
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()

        // 跳过空行
        if (!trimmed) continue

        // [DONE] 标记
        if (trimmed === 'data: [DONE]') continue

        // SSE data 行: data: {...}
        if (!trimmed.startsWith('data: ')) continue

        const jsonStr = trimmed.slice(6)
        try {
          const parsed = JSON.parse(jsonStr)
          const delta = parsed?.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            callbacks.onChunk(delta)
          }
        } catch {
          // JSON 解析失败，跳过此行（可能是网络分片问题）
        }
      }
    }

    // 处理 buffer 中剩余的数据（如果有）
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const parsed = JSON.parse(trimmed.slice(6))
          const delta = parsed?.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            callbacks.onChunk(delta)
          }
        } catch { /* ignore */ }
      }
    }

    callbacks.onComplete(fullText)
  } catch (err: any) {
    callbacks.onError(err?.message ?? 'AI 分析请求失败')
  }
}
