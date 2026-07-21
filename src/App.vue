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
  <el-container style="height: 100vh;">
    <!-- 顶部导航 -->
    <el-header style="
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      z-index: 100;
    ">
      <div style="display: flex; align-items: center; gap: 16px;">
        <el-icon :size="28" color="#409eff"><Monitor /></el-icon>
        <span style="font-size: 20px; font-weight: 700; letter-spacing: 1px;">
          项目基线管理系统
        </span>
        <el-tag type="info" size="small" effect="plain" round>Aras PLM</el-tag>
      </div>

      <el-menu
        mode="horizontal"
        :default-active="router.currentRoute.value.path"
        background-color="transparent"
        text-color="#b0b8c8"
        active-text-color="#409eff"
        style="border-bottom: none; flex: 1; margin-left: 40px;"
        @select="(path: string) => router.push(path)"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/snapshots">
          <el-icon><CameraFilled /></el-icon>
          <span>快照管理</span>
        </el-menu-item>
        <el-menu-item index="/compare">
          <el-icon><SwitchFilled /></el-icon>
          <span>基线比对</span>
        </el-menu-item>
      </el-menu>

      <div style="display: flex; align-items: center; gap: 12px;">
        <el-badge :value="store.snapshotCount" type="primary">
          <el-icon :size="20" color="#b0b8c8"><FolderOpened /></el-icon>
        </el-badge>
        <el-tag type="success" effect="dark" size="small">V1.0</el-tag>
      </div>
    </el-header>

    <!-- 主内容区 -->
    <el-main style="background: #f0f2f5; padding: 0;">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>

</style>
