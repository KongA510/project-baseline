// ============================================================
// 关键路径法 (Critical Path Method) 计算工具
// 基于 Aras Critical_Path_Method.htm 文档实现
//
// 核心概念（每个活动表示为方框）：
//   ┌────────────┬────────────┐
//   │ 最早开始    │  工期      │
//   │  ES        │  Duration  │
//   ├────────────┼────────────┤
//   │  任务 ID   │  任务名称  │
//   │  Task ID  (蓝色可修改)  │
//   ├────────────┼────────────┤
//   │ 最晚开始    │  最晚完成  │
//   │  LS        │  LF        │
//   └────────────┴────────────┘
//
// 步骤：
//   正向遍历：ES → EF（取前置 EF 最大值）
//   逆向遍历：LF → LS（取后续 LS 最小值）
//   浮时 = LS - ES = LF - EF
//   关键路径：浮时为 0 的活动序列
// ============================================================

import {
  type ProjectTask,
  type CPMDates,
  type TaskPredecessor,
} from '@/types'

/** CPM 输入：精简版任务信息 */
interface CPMTaskInput {
  id: string
  duration: number
  predecessors: TaskPredecessor[]
}

/** CPM 输出映射 */
interface CPMResultMap {
  [taskId: string]: CPMDates
}

/**
 * 正向遍历 (Forward Pass)
 * 从目标开始日期（即 day 0）开始，计算每个任务的最早开始 (ES) 和最早完成 (EF) 日期
 *
 * 步骤：
 * 1. 将目标开始日期设为 0，无前置活动的任务的 ES = 0
 * 2. ES + Duration = EF
 * 3. 后续活动的 ES = max(所有前置活动的 EF + lag)
 * 4. 递归重复直到所有活动都有 EF
 */
function forwardPass(
  tasks: CPMTaskInput[],
  taskMap: Map<string, CPMTaskInput>
): { esMap: Map<string, number>; efMap: Map<string, number> } {
  const esMap = new Map<string, number>()
  const efMap = new Map<string, number>()
  const visited = new Set<string>()

  // 拓扑排序：确保处理顺序正确
  const sorted = topologicalSort(tasks, taskMap)

  for (const taskId of sorted) {
    const task = taskMap.get(taskId)!
    let maxEs = 0 // 目标开始日期 = 0

    if (task.predecessors.length > 0) {
      for (const pred of task.predecessors) {
        const predEf = efMap.get(pred.predecessorId)
        if (predEf !== undefined) {
          // 考虑滞后量：前置任务的 EF + 滞后天数
          const predEsPlusLag = predEf + pred.lagDays
          if (predEsPlusLag > maxEs) {
            maxEs = predEsPlusLag
          }
        }
      }
    }

    esMap.set(taskId, maxEs)
    efMap.set(taskId, maxEs + task.duration)
    visited.add(taskId)
  }

  return { esMap, efMap }
}

/**
 * 逆向遍历 (Backward Pass)
 * 从目标完成日期开始，计算每个任务的最晚完成 (LF) 和最晚开始 (LS) 日期
 *
 * 步骤：
 * 1. 将目标完成日期作为无后续活动的 LF
 * 2. LS = LF - Duration
 * 3. 前置活动的 LF = min(所有后续活动的 LS - lag)
 * 4. 递归重复直到所有活动都有 LS
 */
function backwardPass(
  tasks: CPMTaskInput[],
  taskMap: Map<string, CPMTaskInput>,
  efMap: Map<string, number>,
  targetEndDate: number
): { lsMap: Map<string, number>; lfMap: Map<string, number> } {
  const lsMap = new Map<string, number>()
  const lfMap = new Map<string, number>()

  // 构建反向依赖图：后续活动 → 前置活动
  const successors = new Map<string, string[]>()
  for (const task of tasks) {
    successors.set(task.id, [])
  }
  for (const task of tasks) {
    for (const pred of task.predecessors) {
      const succList = successors.get(pred.predecessorId)
      if (succList) {
        succList.push(task.id)
      }
    }
  }

  // 找出所有没有后续活动的任务
  const noSuccessorTasks = tasks.filter(t => !successors.get(t.id) || successors.get(t.id)!.length === 0)

  // 计算项目最早完成日期（所有无后续活动的 EF 中的最大值）
  let projectEarlyFinish = targetEndDate
  if (noSuccessorTasks.length > 0) {
    projectEarlyFinish = Math.max(
      ...noSuccessorTasks.map(t => efMap.get(t.id) ?? 0)
    )
  }
  // 使用目标完成日期和项目最早完成日期中的较大值
  const projectFinish = Math.max(projectEarlyFinish, targetEndDate)

  // 逆拓扑排序
  const sorted = topologicalSort(tasks, taskMap).reverse()

  for (const taskId of sorted) {
    const task = taskMap.get(taskId)!
    const succList = successors.get(taskId) || []

    let minLf: number
    if (succList.length === 0) {
      // 没有后续活动 → 使用项目完成日期
      minLf = projectFinish
    } else {
      minLf = Infinity
      for (const succId of succList) {
        const succLs = lsMap.get(succId)
        if (succLs !== undefined) {
          // 考虑滞后量
          const succLsMinusLag = succLs - (task.predecessors.find(p => p.predecessorId === task.id)?.lagDays ?? 0)
          // 对于 FS 关系，实际上是 LF = 后续的 LS
          if (succLs < minLf) {
            minLf = succLs
          }
        }
      }
    }

    lfMap.set(taskId, minLf)
    lsMap.set(taskId, minLf - task.duration)
  }

  return { lsMap, lfMap }
}

/**
 * 拓扑排序（确保 CPM 计算的正确顺序）
 */
function topologicalSort(
  tasks: CPMTaskInput[],
  taskMap: Map<string, CPMTaskInput>
): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const task of tasks) {
    inDegree.set(task.id, task.predecessors.length)
    adjacency.set(task.id, [])
  }

  // 构建邻接表
  for (const task of tasks) {
    for (const pred of task.predecessors) {
      const adj = adjacency.get(pred.predecessorId)
      if (adj) {
        adj.push(task.id)
      }
    }
  }

  const queue: string[] = []
  for (const [taskId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(taskId)
    }
  }

  const result: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  // 如果有循环依赖，返回原始顺序
  if (result.length < tasks.length) {
    console.warn('CPM: 检测到循环依赖，部分任务可能无法正确计算')
    return tasks.map(t => t.id)
  }

  return result
}

/**
 * 计算自由浮时 (Free Float)
 * 自由浮时 = min(后续ES) - EF（不延迟任何后续活动的情况下可延迟的时间）
 */
function calculateFreeFloat(
  taskId: string,
  ef: number,
  taskMap: Map<string, CPMTaskInput>,
  esMap: Map<string, number>
): number {
  // 找所有后续活动
  const successorIds: string[] = []
  for (const [, task] of taskMap) {
    if (task.predecessors.some(p => p.predecessorId === taskId)) {
      successorIds.push(task.id)
    }
  }

  if (successorIds.length === 0) {
    // 没有后续活动，自由浮时 = 总浮时（简化处理）
    return 0
  }

  let minSuccessorEs = Infinity
  for (const succId of successorIds) {
    const succEs = esMap.get(succId)
    if (succEs !== undefined && succEs < minSuccessorEs) {
      minSuccessorEs = succEs
    }
  }

  return minSuccessorEs - ef
}

/**
 * 主函数：执行完整的关键路径法计算
 *
 * @param tasks - 项目任务列表（扁平，含依赖关系）
 * @param targetStartDate - 目标开始日期（日期字符串 YYYY-MM-DD）
 * @param targetEndDate - 目标完成日期（日期字符串 YYYY-MM-DD）
 * @returns 更新了 CPM 字段的任务列表
 */
export function calculateCriticalPath(
  tasks: ProjectTask[],
  targetStartDate: string,
  targetEndDate: string
): ProjectTask[] {
  // 构建 CPM 输入
  const taskMap = new Map<string, CPMTaskInput>()
  const cpmTasks: CPMTaskInput[] = []

  for (const task of tasks) {
    const input: CPMTaskInput = {
      id: task.id,
      duration: task.duration,
      predecessors: task.predecessors,
    }
    taskMap.set(task.id, input)
    cpmTasks.push(input)
  }

  // 计算目标完成日期的偏移天数
  const startDate = new Date(targetStartDate)
  const endDate = new Date(targetEndDate)
  const targetDuration = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // 正向遍历
  const { esMap, efMap } = forwardPass(cpmTasks, taskMap)

  // 逆向遍历
  const { lsMap, lfMap } = backwardPass(cpmTasks, taskMap, efMap, targetDuration)

  // 汇总结果
  const resultMap: CPMResultMap = {}
  for (const taskId of taskMap.keys()) {
    const es = esMap.get(taskId) ?? 0
    const ef = efMap.get(taskId) ?? 0
    const ls = lsMap.get(taskId) ?? 0
    const lf = lfMap.get(taskId) ?? 0
    const totalFloat = ls - es
    const freeFloat = calculateFreeFloat(taskId, ef, taskMap, esMap)
    const isCritical = Math.abs(totalFloat) < 0.001 // 浮点为 0

    resultMap[taskId] = {
      earliestStart: offsetToDate(targetStartDate, es),
      earliestFinish: offsetToDate(targetStartDate, ef),
      latestStart: offsetToDate(targetStartDate, ls),
      latestFinish: offsetToDate(targetStartDate, lf),
      totalFloat,
      freeFloat,
      isCritical,
    }
  }

  // 更新任务
  return tasks.map(task => ({
    ...task,
    cpmDates: resultMap[task.id] ?? task.cpmDates,
  }))
}

/**
 * 工具函数：将偏移天数转为日期字符串
 */
function offsetToDate(baseDate: string, offsetDays: number): string {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().split('T')[0]
}

/**
 * 获取关键路径上的任务 ID 列表
 */
export function getCriticalPathTaskIds(tasks: ProjectTask[]): string[] {
  return tasks.filter(t => t.cpmDates.isCritical).map(t => t.id)
}

/**
 * 格式化浮时显示
 */
export function formatFloat(floatDays: number): string {
  if (Math.abs(floatDays) < 0.001) return '0 天（关键）'
  return `${floatDays.toFixed(1)} 天`
}
