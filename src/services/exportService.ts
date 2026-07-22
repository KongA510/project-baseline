// ============================================================
// 导出服务 — Excel (任务比对) + Word (变更详情 / AI分析)
// ============================================================

import type { ComparisonResult, CompareRow, TaskNode } from '@/types'
import { DiffType } from '@/types'
import { formatTaskStatus, getDiffLabel } from '@/utils/diffEngine'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType, convertInchesToTwip } from 'docx'
import { saveAs } from 'file-saver'

// ============================================================
// 工具函数：递归展平比对行
// ============================================================

function flattenCompareRows(rows: CompareRow[], depth = 0): CompareRow[] {
  if (!rows || depth > 10) return []
  const result: CompareRow[] = []
  for (const r of rows) {
    result.push(r)
    if (r.children?.length > 0) result.push(...flattenCompareRows(r.children, depth + 1))
  }
  return result
}

// ============================================================
// 工具函数：收集有变更的行
// ============================================================

function collectChangedRows(rows: CompareRow[], depth = 0): CompareRow[] {
  if (!rows || depth > 10) return []
  const result: CompareRow[] = []
  for (const r of rows) {
    if (r.changes?.length > 0) result.push(r)
    if (r.children?.length > 0) result.push(...collectChangedRows(r.children, depth + 1))
  }
  return result
}

// ============================================================
// 任务字段格式化
// ============================================================

function getPredLabel(task: TaskNode | null): string {
  if (!task || task.predecessors.length === 0) return ''
  return task.predecessors.map(p => `${p.predecessorId}(${p.dependencyType}+${p.lagDays}d)`).join('; ')
}

function fd(d: string | null | undefined): string {
  if (!d) return ''
  return d
}

// ============================================================
// 1. Excel 导出 — 任务计划左右比对
// ============================================================

export function exportTaskCompareExcel(result: ComparisonResult, snapshotAName: string, snapshotBName: string) {
  const allRows = flattenCompareRows(result.compareRows)

  const data: any[][] = []

  // 表头
  data.push([
    'WBS', '任务名称', '类型', '差异状态',
    `${snapshotAName} 状态`, `${snapshotBName} 状态`,
    `${snapshotAName} 工期(天)`, `${snapshotBName} 工期(天)`,
    `${snapshotAName} 完成%`, `${snapshotBName} 完成%`,
    `${snapshotAName} 开始日期`, `${snapshotBName} 开始日期`,
    `${snapshotAName} 完成日期`, `${snapshotBName} 完成日期`,
    `${snapshotAName} 负责人`, `${snapshotBName} 负责人`,
    `${snapshotAName} 前置依赖`, `${snapshotBName} 前置依赖`,
    '是否关键路径(A)', '是否关键路径(B)',
  ])

  for (const row of allRows) {
    const lt = row.leftTask
    const rt = row.rightTask

    data.push([
      row.wbs,
      lt?.name ?? rt?.name ?? '',
      lt?.type ?? rt?.type ?? '',
      getDiffLabel(row.diffType),
      lt && lt.type !== 'SUMMARY' ? formatTaskStatus(lt.status) : (lt?.type === 'SUMMARY' ? '—' : ''),
      rt && rt.type !== 'SUMMARY' ? formatTaskStatus(rt.status) : (rt?.type === 'SUMMARY' ? '—' : ''),
      lt?.duration ?? '',
      rt?.duration ?? '',
      lt?.percentComplete ?? '',
      rt?.percentComplete ?? '',
      fd(lt?.plannedStartDate),
      fd(rt?.plannedStartDate),
      fd(lt?.plannedEndDate),
      fd(rt?.plannedEndDate),
      lt?.assignedTo?.name ?? '',
      rt?.assignedTo?.name ?? '',
      getPredLabel(lt),
      getPredLabel(rt),
      lt?.cpmDates.isCritical ? '是' : '否',
      rt?.cpmDates.isCritical ? '是' : '否',
    ])
  }

  // 创建工作簿
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)

  // 列宽
  ws['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 8 },
    { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 },
    { wch: 8 }, { wch: 8 },
    { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 },
    { wch: 10 }, { wch: 10 },
    { wch: 22 }, { wch: 22 },
    { wch: 14 }, { wch: 14 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, '任务计划左右比对')

  // 差异统计 sheet
  const summaryData: any[][] = [
    ['差异统计概览', ''],
    ['新增任务', result.summary.totalAdded],
    ['删除任务', result.summary.totalRemoved],
    ['变更任务', result.summary.totalModified],
    ['无变化', result.summary.totalUnchanged],
    ['', ''],
    ['关键路径变化', ''],
    ['新增到关键路径', result.criticalPathDiff.addedToCriticalPath.length],
    ['从关键路径移除', result.criticalPathDiff.removedFromCriticalPath.length],
    ['总浮时变化', `${result.criticalPathDiff.totalFloatChange > 0 ? '+' : ''}${result.criticalPathDiff.totalFloatChange.toFixed(1)}天`],
    ['关键路径工期变化', `${result.criticalPathDiff.totalDurationChange > 0 ? '+' : ''}${result.criticalPathDiff.totalDurationChange}天`],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
  ws2['!cols'] = [{ wch: 22 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws2, '差异统计')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  saveAs(blob, `任务计划左右比对_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ============================================================
// 2. Word 导出 — 变更任务字段详情
// ============================================================

export async function exportChangeDetailWord(result: ComparisonResult, snapshotAName: string, snapshotBName: string) {
  const changedRows = collectChangedRows(result.compareRows)

  // ===== 标题 =====
  const children: any[] = [
    new Paragraph({
      text: '变更任务字段详情',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `基准A：${snapshotAName}`, bold: true, color: '#409eff' }),
        new TextRun({ text: '    vs    ' }),
        new TextRun({ text: `对比B：${snapshotBName}`, bold: true, color: '#67c23a' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      style: 'Normal',
    }),
    new Paragraph({
      text: `共 ${changedRows.length} 项变更`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  ]

  // ===== 差异统计摘要 =====
  children.push(
    new Paragraph({ text: '差异统计概览', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }),
    new Paragraph({ text: `新增: ${result.summary.totalAdded}  |  删除: ${result.summary.totalRemoved}  |  变更: ${result.summary.totalModified}  |  无变化: ${result.summary.totalUnchanged}`, spacing: { after: 120 } }),
    new Paragraph({ text: `新增到关键路径: ${result.criticalPathDiff.addedToCriticalPath.length}  |  从关键路径移除: ${result.criticalPathDiff.removedFromCriticalPath.length}`, spacing: { after: 120 } }),
    new Paragraph({ text: `关键路径工期变化: ${result.criticalPathDiff.totalDurationChange > 0 ? '+' : ''}${result.criticalPathDiff.totalDurationChange}天  |  总浮时变化: ${result.criticalPathDiff.totalFloatChange > 0 ? '+' : ''}${result.criticalPathDiff.totalFloatChange.toFixed(1)}天`, spacing: { after: 300 } }),
  )

  // ===== 逐项变更详情 =====
  children.push(new Paragraph({ text: '变更明细', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))

  for (const row of changedRows) {
    const taskName = row.rightTask?.name ?? row.leftTask?.name ?? ''

    // 任务标题
    children.push(
      new Paragraph({
        text: `${row.wbs}  ${taskName}  —  ${row.changes.length}项变更`,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 80 },
      })
    )

    // 变更表格
    const tableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          createCell('字段', 2400, true),
          createCell(`旧值（${snapshotAName}）`, 2800, true),
          createCell(`新值（${snapshotBName}）`, 2800, true),
        ],
      }),
    ]

    for (const c of row.changes) {
      tableRows.push(
        new TableRow({
          children: [
            createCell(c.fieldLabel, 2400),
            createCell(c.oldValue != null ? String(c.oldValue) : '—', 2800, false, '#fef0f0'),
            createCell(c.newValue != null ? String(c.newValue) : '—', 2800, false, '#fdf6ec'),
          ],
        })
      )
    }

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 8000, type: WidthType.DXA },
        columnWidths: [2400, 2800, 2800],
      })
    )
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `变更任务字段详情_${new Date().toISOString().slice(0, 10)}.docx`)
}

// ============================================================
// 3. Word 导出 — 基线比对建议 (AI 分析)
// ============================================================

export async function exportAIAnalysisWord(aiText: string, snapshotAName: string, snapshotBName: string) {
  const children: any[] = [
    new Paragraph({
      text: '基线比对建议',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `基准A：${snapshotAName}`, bold: true, color: '#409eff' }),
        new TextRun({ text: '    vs    ' }),
        new TextRun({ text: `对比B：${snapshotBName}`, bold: true, color: '#67c23a' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: `生成时间: ${new Date().toLocaleString('zh-CN')}  |  分析引擎: Agnes 2.0 Flash`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  ]

  // 将 AI 文本按行解析为段落
  const lines = aiText.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      children.push(new Paragraph({ text: '', spacing: { after: 40 } }))
      continue
    }

    // 标题行
    if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({
        text: trimmed.slice(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 },
      }))
      continue
    }

    if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({
        text: trimmed.slice(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
      }))
      continue
    }

    if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({
        text: trimmed.slice(2),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
      }))
      continue
    }

    // 分隔线
    if (trimmed === '---') {
      children.push(new Paragraph({
        children: [new TextRun({ text: '—'.repeat(40), color: '#c0c4cc', size: 20 })],
        spacing: { before: 120, after: 120 },
      }))
      continue
    }

    // 表格行
    if (trimmed.startsWith('|')) {
      // 跳过表格分隔行
      if (trimmed.includes('---')) continue
      const cells = trimmed.split('|').filter(c => c.trim()).map(c => c.trim())
      children.push(new Paragraph({
        children: cells.map((cell, i) => {
          const runs: TextRun[] = []
          if (i > 0) runs.push(new TextRun({ text: '  |  ', color: '#c0c4cc' }))
          runs.push(new TextRun({ text: cell, bold: i === 0 }))
          return runs
        }).flat(),
        spacing: { after: 40 },
      }))
      continue
    }

    // 普通段落 — 解析 markdown **bold** 和 emoji
    const runs = parseMarkdownToRuns(trimmed)
    children.push(new Paragraph({
      children: runs,
      spacing: { after: 60 },
    }))
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `基线比对建议_${new Date().toISOString().slice(0, 10)}.docx`)
}

// ============================================================
// 辅助：创建表格单元格
// ============================================================

function createCell(text: string, width: number, header = false, shadingColor?: string): TableCell {
  const runs: TextRun[] = [
    new TextRun({
      text,
      bold: header,
      size: 20,
      font: 'Microsoft YaHei',
    }),
  ]

  const cellOpts: any = {
    children: [new Paragraph({ children: runs, alignment: AlignmentType.LEFT })],
    width: { size: width, type: WidthType.DXA },
  }

  if (shadingColor) {
    cellOpts.shading = { type: ShadingType.SOLID, color: shadingColor, fill: shadingColor }
  }

  return new TableCell(cellOpts)
}

// ============================================================
// 辅助：解析 markdown 文本 → TextRun 数组
// ============================================================

function parseMarkdownToRuns(text: string): TextRun[] {
  const runs: TextRun[] = []

  // 正则匹配 **bold** 或普通文本或 emoji
  const regex = /(\*\*(.+?)\*\*)|([^*]+)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      // **bold** 部分
      runs.push(new TextRun({ text: match[2], bold: true, color: '#6d28d9' }))
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3] }))
    }
  }

  // 如果没有任何匹配，返回纯文本
  if (runs.length === 0) {
    runs.push(new TextRun({ text }))
  }

  return runs
}
