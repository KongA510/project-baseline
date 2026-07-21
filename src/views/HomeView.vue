<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBaselineStore } from '@/store/baseline'

const router = useRouter()
const store = useBaselineStore()

onMounted(() => {
  store.init()
})
</script>

<template>
  <div style="padding: 32px; max-width: 1200px; margin: 0 auto;">
    <!-- 欢迎卡片 -->
    <el-row :gutter="24">
      <el-col :span="24">
        <el-card shadow="hover" style="margin-bottom: 24px;">
          <div style="text-align: center; padding: 40px 20px;">
            <el-icon :size="64" color="#409eff"><Monitor /></el-icon>
            <h1 style="margin: 16px 0 8px; font-size: 28px; color: #1a1a2e;">
              项目基线管理系统
            </h1>
            <p style="color: #6b7280; font-size: 15px; max-width: 600px; margin: 0 auto 8px;">
              基于 Aras PLM 平台的项目计划基线管理工具。支持项目的快照冻结、版本比对、
              关键路径分析与 AI 智能差异解读。
            </p>
            <el-tag type="warning" size="small" effect="plain" style="margin-top: 8px;">
              模拟数据模式 | 可对接 Aras API
            </el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 功能导航卡片 -->
    <el-row :gutter="24">
      <el-col :span="8">
        <el-card shadow="hover" class="feature-card" @click="router.push('/snapshots')">
          <div class="feature-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <el-icon :size="36" color="#fff"><CameraFilled /></el-icon>
          </div>
          <h3>快照管理</h3>
          <p>创建、查看和管理项目计划快照。冻结项目状态用于版本比对。</p>
          <div class="feature-stats">
            <span>已创建 <strong>{{ store.snapshotCount }}</strong> 个快照</span>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover" class="feature-card" @click="router.push('/compare')">
          <div class="feature-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <el-icon :size="36" color="#fff"><SwitchFilled /></el-icon>
          </div>
          <h3>基线比对</h3>
          <p>选择两个快照进行差异分析：任务变更、关键路径变化一目了然。</p>
          <div class="feature-stats">
            <span>支持 <strong>任务级</strong> 字段粒度比对</span>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover" class="feature-card" style="cursor: default; opacity: 0.7;">
          <div class="feature-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <el-icon :size="36" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <h3>AI 智能分析</h3>
          <p>对接 AI 接口，对差异结果进行流式智能分析与建议。（即将上线）</p>
          <div class="feature-stats">
            <el-tag type="info" size="small">接口待配置</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 快速操作 -->
    <el-card shadow="hover" style="margin-top: 24px;">
      <template #header>
        <span style="font-weight: 600;">快速操作</span>
      </template>
      <el-space wrap :size="16">
        <el-button type="primary" @click="router.push('/snapshots')">
          <el-icon><CameraFilled /></el-icon> 管理快照
        </el-button>
        <el-button type="success" @click="router.push('/compare')">
          <el-icon><SwitchFilled /></el-icon> 开始比对
        </el-button>
        <el-button type="warning" plain>
          <el-icon><Download /></el-icon> 导出报告
        </el-button>
        <el-button type="info" plain disabled>
          <el-icon><Setting /></el-icon> AI 接口配置（即将开放）
        </el-button>
      </el-space>
    </el-card>

    <!-- 最近快照列表 -->
    <el-card shadow="hover" style="margin-top: 24px;" v-if="store.sortedSnapshots.length > 0">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600;">最近快照</span>
          <el-button text type="primary" @click="router.push('/snapshots')">查看全部</el-button>
        </div>
      </template>
      <el-table :data="store.sortedSnapshots.slice(0, 5)" stripe size="large" style="width: 100%;">
        <el-table-column prop="meta.name" label="快照名称" min-width="180">
          <template #default="{ row }">
            <el-icon color="#409eff"><CameraFilled /></el-icon>
            <span style="margin-left: 8px; font-weight: 500;">{{ row.meta.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="meta.description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="meta.createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.meta.createdAt).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <el-tag type="success" effect="light">
              任务 {{ row.meta.completedTasks }}/{{ row.meta.totalTasks }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="完成度" width="150">
          <template #default="{ row }">
            <el-progress
              :percentage="row.meta.overallPercentComplete"
              :stroke-width="8"
              :color="row.meta.overallPercentComplete === 100 ? '#67c23a' : '#409eff'"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.feature-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-top: 3px solid #409eff;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.feature-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.feature-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #1a1a2e;
}

.feature-card p {
  margin: 0 0 12px;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.6;
}

.feature-stats {
  font-size: 13px;
  color: #909399;
}

.feature-stats strong {
  color: #409eff;
}
</style>
