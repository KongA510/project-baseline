// ============================================================
// 功能说明PPT — 项目基线管理系统 v1.1.0
// ============================================================

const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const pptxgen = require("pptxgenjs");

// ---- 颜色 ----
const DARK_BG = "1A1A2E";
const CARD_BG = "16213E";
const ACCENT_PURPLE = "A855F7";
const ACCENT_BLUE = "3B82F6";
const ACCENT_GREEN = "22C55E";
const ACCENT_ORANGE = "F59E0B";
const ACCENT_RED = "EF4444";
const TEXT_PRIMARY = "FFFFFF";
const TEXT_SECONDARY = "94A3B8";
const WHITE = "FFFFFF";

// ---- 图标工具 ----
const { FaProjectDiagram, FaCamera, FaCodeBranch, FaRocket, FaChartBar, FaRobot, FaFileExport, FaServer, FaExchangeAlt, FaSearch } = require("react-icons/fa");

function renderIconSvg(IconComponent, color, size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

// ---- 工厂函数 ----
const makeShadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 3, angle: 45, opacity: 0.25 });

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "项目基线管理系统";
  pres.title = "项目基线管理系统 — 功能说明";

  // ---- Slide 1: 封面 ----
  {
    const slide = pres.addSlide();
    slide.background = { color: DARK_BG };

    // 装饰圆形
    slide.addShape(pres.shapes.OVAL, { x: 7.5, y: -1.5, w: 5, h: 5, fill: { color: ACCENT_PURPLE, transparency: 85 } });
    slide.addShape(pres.shapes.OVAL, { x: 8.5, y: 2.5, w: 3, h: 3, fill: { color: ACCENT_BLUE, transparency: 85 } });

    const iconData = await iconToBase64Png(FaProjectDiagram, "#A855F7", 512);
    slide.addImage({ data: iconData, x: 1.5, y: 1.2, w: 1.5, h: 1.5 });

    slide.addText("项目基线管理系统", {
      x: 3.3, y: 1.2, w: 5.5, h: 0.9,
      fontSize: 40, fontFace: "Microsoft YaHei", color: WHITE, bold: true, margin: 0,
    });
    slide.addText("v1.1.0 — 功能说明", {
      x: 3.3, y: 2.0, w: 5.5, h: 0.5,
      fontSize: 20, fontFace: "Microsoft YaHei", color: ACCENT_PURPLE, margin: 0,
    });
    slide.addText("基于 Aras PLM | Vue3 + Element Plus + TypeScript", {
      x: 3.3, y: 2.6, w: 5.5, h: 0.4,
      fontSize: 13, fontFace: "Microsoft YaHei", color: TEXT_SECONDARY, margin: 0,
    });

    // 底部分隔
    slide.addShape(pres.shapes.LINE, { x: 1.5, y: 3.6, w: 7, h: 0, line: { color: ACCENT_PURPLE, width: 1.5, dashType: "dash" } });

    slide.addText("2026年7月22日", {
      x: 1.5, y: 3.9, w: 3, h: 0.4,
      fontSize: 12, fontFace: "Microsoft YaHei", color: TEXT_SECONDARY, margin: 0,
    });
  }

  // ---- Slide 2: 系统概述 ----
  {
    const slide = pres.addSlide();
    slide.background = { color: WHITE };

    slide.addText("系统概述", {
      x: 0.6, y: 0.3, w: 8, h: 0.7,
      fontSize: 34, fontFace: "Microsoft YaHei", color: DARK_BG, bold: true, margin: 0,
    });

    slide.addText("项目基线管理系统是基于 Aras PLM 平台的项目计划基线管理工具，支持快照冻结、版本比对、关键路径分析与 AI 智能解读。", {
      x: 0.6, y: 1.0, w: 8.5, h: 0.7,
      fontSize: 14, fontFace: "Microsoft YaHei", color: "475569", margin: 0,
    });

    // 技术栈卡片
    const techs = [
      { name: "Vue 3", desc: "前端框架", color: ACCENT_GREEN },
      { name: "Element Plus", desc: "UI 组件库", color: ACCENT_BLUE },
      { name: "Vite", desc: "构建工具", color: ACCENT_PURPLE },
      { name: "TypeScript", desc: "类型安全", color: "0284C7" },
      { name: "Pinia", desc: "状态管理", color: ACCENT_ORANGE },
      { name: "Aras PLM", desc: "数据源平台", color: ACCENT_RED },
    ];

    techs.forEach((tech, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.6 + col * 3.1;
      const y = 2.0 + row * 1.7;

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: y + 0.05, w: 2.8, h: 1.35,
        fill: { color: "F8FAFC" }, rectRadius: 0.12,
        shadow: makeShadow(),
      });
      slide.addText(tech.name, {
        x, y: y + 0.25, w: 2.8, h: 0.45,
        fontSize: 18, fontFace: "Microsoft YaHei", color: tech.color, bold: true, align: "center", margin: 0,
      });
      slide.addText(tech.desc, {
        x, y: y + 0.7, w: 2.8, h: 0.35,
        fontSize: 12, fontFace: "Microsoft YaHei", color: "64748B", align: "center", margin: 0,
      });
    });
  }

  // ---- Slide 3: 快照管理 ----
  {
    const slide = pres.addSlide();
    slide.background = { color: WHITE };

    const iconData = await iconToBase64Png(FaCamera, "#3B82F6", 512);
    slide.addImage({ data: iconData, x: 0.6, y: 0.35, w: 0.55, h: 0.55 });

    slide.addText("快照管理", {
      x: 1.35, y: 0.3, w: 6, h: 0.7,
      fontSize: 34, fontFace: "Microsoft YaHei", color: DARK_BG, bold: true, margin: 0,
    });

    slide.addText("冻结项目计划状态，创建、查看和管理快照版本", {
      x: 0.6, y: 1.0, w: 8.5, h: 0.5,
      fontSize: 14, fontFace: "Microsoft YaHei", color: "475569", margin: 0,
    });

    // 快照结构
    const structureItems = [
      { label: "元数据", desc: "名称、描述、创建时间、项目编号、状态" },
      { label: "统计信息", desc: "总任务数、已完成数、整体完成百分比" },
      { label: "关键路径", desc: "关键任务 ID 列表（CPM 算法计算）" },
      { label: "任务树", desc: "WBS 递归嵌套结构，支持多层 SUMMARY 容器" },
    ];

    structureItems.forEach((item, i) => {
      const y = 1.7 + i * 0.85;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.6, y, w: 0.06, h: 0.55,
        fill: { color: ACCENT_BLUE },
      });
      slide.addText(item.label, {
        x: 0.9, y, w: 2.5, h: 0.55,
        fontSize: 16, fontFace: "Microsoft YaHei", color: DARK_BG, bold: true, margin: 0, valign: "middle",
      });
      slide.addText(item.desc, {
        x: 3.5, y, w: 5.5, h: 0.55,
        fontSize: 13, fontFace: "Microsoft YaHei", color: "64748B", margin: 0, valign: "middle",
      });
    });

    // 数据卡片
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: 4.6, w: 8.5, h: 0.7,
      fill: { color: "EFF6FF" }, rectRadius: 0.1,
    });
    slide.addText("📦  系统内置 3 个预置快照：基线 V1.0、快照 V1.1、快照 V2.0 | 支持对接 Aras API 获取真实数据", {
      x: 1.0, y: 4.6, w: 8, h: 0.7,
      fontSize: 12, fontFace: "Microsoft YaHei", color: "1E40AF", margin: 0, valign: "middle",
    });
  }

  // ---- Slide 4: 基线比对 ----
  {
    const slide = pres.addSlide();
    slide.background = { color: WHITE };

    const iconData = await iconToBase64Png(FaCodeBranch, "#F59E0B", 512);
    slide.addImage({ data: iconData, x: 0.6, y: 0.35, w: 0.55, h: 0.55 });

    slide.addText("基线比对", {
      x: 1.35, y: 0.3, w: 6, h: 0.7,
      fontSize: 34, fontFace: "Microsoft YaHei", color: DARK_BG, bold: true, margin: 0,
    });

    slide.addText("左右树状并排对比两个快照，字段粒度差异检测", {
      x: 0.6, y: 1.0, w: 8.5, h: 0.5,
      fontSize: 14, fontFace: "Microsoft YaHei", color: "475569", margin: 0,
    });

    // 比对能力卡片
    const cards = [
      { icon: FaExchangeAlt, title: "左右并排对比", desc: "基准A与对比B逐行对齐，WBS 匹配", color: ACCENT_BLUE },
      { icon: FaSearch, title: "字段粒度检测", desc: "18种字段类型逐一比对，红/橙色高亮差异", color: ACCENT_ORANGE },
      { icon: FaChartBar, title: "差异统计概览", desc: "新增/删除/变更/无变化 彩色卡片可视化", color: ACCENT_GREEN },
      { icon: FaServer, title: "关键路径分析", desc: "CPM算法追踪关键路径任务进出和工期变化", color: ACCENT_RED },
    ];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const x = 0.5 + i * 2.35;
      const icn = await iconToBase64Png(card.icon, "#" + card.color, 256);

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: 1.8, w: 2.15, h: 2.6,
        fill: { color: "FFFFFF" }, rectRadius: 0.12,
        shadow: makeShadow(),
      });
      slide.addImage({ data: icn, x: x + 0.7, y: 2.0, w: 0.7, h: 0.7 });
      slide.addText(card.title, {
        x: x + 0.1, y: 2.85, w: 1.95, h: 0.4,
        fontSize: 14, fontFace: "Microsoft YaHei", color: DARK_BG, bold: true, align: "center", margin: 0,
      });
      slide.addText(card.desc, {
        x: x + 0.1, y: 3.3, w: 1.95, h: 0.8,
        fontSize: 11, fontFace: "Microsoft YaHei", color: "64748B", align: "center", margin: 0,
      });
    }

    // 差异颜色图例
    slide.addText("差异颜色标注", {
      x: 0.6, y: 4.7, w: 3, h: 0.35,
      fontSize: 13, fontFace: "Microsoft YaHei", color: DARK_BG, bold: true, margin: 0,
    });
    const legends = [
      { label: "新增", color: ACCENT_GREEN },
      { label: "变更", color: ACCENT_ORANGE },
      { label: "删除", color: ACCENT_RED },
      { label: "无变化", color: "94A3B8" },
    ];
    legends.forEach((l, i) => {
      const x = 3.8 + i * 1.5;
      slide.addShape(pres.shapes.OVAL, { x, y: 4.73, w: 0.22, h: 0.22, fill: { color: l.color } });
      slide.addText(l.label, {
        x: x + 0.32, y: 4.65, w: 0.8, h: 0.35,
        fontSize: 12, fontFace: "Microsoft YaHei", color: "475569", margin: 0, valign: "middle",
      });
    });
  }

  // ---- Slide 5: AI 智能分析 ----
  {
    const slide = pres.addSlide();
    slide.background = { color: DARK_BG };

    const iconData = await iconToBase64Png(FaRobot, "#A855F7", 512);
    slide.addImage({ data: iconData, x: 0.6, y: 0.35, w: 0.55, h: 0.55 });

    slide.addText("AI 智能分析", {
      x: 1.35, y: 0.3, w: 6, h: 0.7,
      fontSize: 34, fontFace: "Microsoft YaHei", color: WHITE, bold: true, margin: 0,
    });
    slide.addText("Agnes AI 流式分析，多维度解读基线差异", {
      x: 0.6, y: 1.0, w: 8.5, h: 0.5,
      fontSize: 14, fontFace: "Microsoft YaHei", color: ACCENT_PURPLE, margin: 0,
    });

    const dims = [
      { emoji: "📋", title: "变更概述", desc: "基线变更规模与影响范围" },
      { emoji: "🛤️", title: "关键路径影响", desc: "工期变化与按时交付分析" },
      { emoji: "⚠️", title: "风险识别", desc: "进度/依赖/合规/资源风险" },
      { emoji: "👥", title: "资源变化", desc: "人员变更与单点瓶颈" },
      { emoji: "🏗️", title: "结构解读", desc: "WBS变化的业务含义" },
      { emoji: "📌", title: "建议与结论", desc: "可操作的管理建议" },
    ];

    dims.forEach((d, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.5 + col * 3.1;
      const y = 1.7 + row * 1.65;

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: y + 0.05, w: 2.85, h: 1.3,
        fill: { color: CARD_BG }, rectRadius: 0.12,
        shadow: makeShadow(),
      });
      slide.addText(d.emoji + "  " + d.title, {
        x: x + 0.2, y: y + 0.15, w: 2.45, h: 0.4,
        fontSize: 16, fontFace: "Microsoft YaHei", color: ACCENT_PURPLE, bold: true, margin: 0,
      });
      slide.addText(d.desc, {
        x: x + 0.2, y: y + 0.65, w: 2.45, h: 0.35,
        fontSize: 12, fontFace: "Microsoft YaHei", color: TEXT_SECONDARY, margin: 0,
      });
    });

    // 底部技术说明
    slide.addText("模型：Agnes 2.0 Flash  |  传输：SSE 流式  |  体验：逐字输出 + 闪烁光标 + 自动滚动", {
      x: 0.6, y: 5.0, w: 8.5, h: 0.35,
      fontSize: 11, fontFace: "Microsoft YaHei", color: "64748B", align: "center", margin: 0,
    });
  }

  // ---- Slide 6: 报告导出 ----
  {
    const slide = pres.addSlide();
    slide.background = { color: WHITE };

    const iconData = await iconToBase64Png(FaFileExport, "#22C55E", 512);
    slide.addImage({ data: iconData, x: 0.6, y: 0.35, w: 0.55, h: 0.55 });

    slide.addText("报告导出", {
      x: 1.35, y: 0.3, w: 6, h: 0.7,
      fontSize: 34, fontFace: "Microsoft YaHei", color: DARK_BG, bold: true, margin: 0,
    });
    slide.addText("三合一导出：Excel 表格 + Word 文档 × 2", {
      x: 0.6, y: 1.0, w: 8.5, h: 0.5,
      fontSize: 14, fontFace: "Microsoft YaHei", color: "475569", margin: 0,
    });

    const exports = [
      { title: "任务计划左右比对", format: "Excel (.xlsx)", desc: "完整任务比对表 + 差异统计 Sheet\nWBS/名称/状态/工期/日期/负责人/前置依赖/关键路径", color: ACCENT_GREEN, icon: FaChartBar },
      { title: "变更任务字段详情", format: "Word (.docx)", desc: "差异摘要 + 逐任务变更明细表格\n旧值红底 / 新值橙底，覆盖18种字段类型", color: ACCENT_BLUE, icon: FaSearch },
      { title: "基线比对建议", format: "Word (.docx)", desc: "AI 分析报告转格式文档\n标题层级/加粗/列表/表格完整保留", color: ACCENT_PURPLE, icon: FaRobot },
    ];

    for (let i = 0; i < exports.length; i++) {
      const item = exports[i];
      const y = 1.8 + i * 1.2;
      const icn = await iconToBase64Png(item.icon, "#" + item.color, 256);

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 0.5, y, w: 8.8, h: 0.95,
        fill: { color: "FFFFFF" }, rectRadius: 0.12,
        shadow: makeShadow(),
      });
      slide.addImage({ data: icn, x: 0.8, y: y + 0.18, w: 0.55, h: 0.55 });

      slide.addText(item.title, {
        x: 1.6, y: y + 0.05, w: 3.5, h: 0.35,
        fontSize: 16, fontFace: "Microsoft YaHei", color: DARK_BG, bold: true, margin: 0,
      });
      slide.addText(item.desc, {
        x: 1.6, y: y + 0.42, w: 5.5, h: 0.5,
        fontSize: 11, fontFace: "Microsoft YaHei", color: "64748B", margin: 0,
      });
      slide.addText(item.format, {
        x: 7.2, y: y + 0.15, w: 1.8, h: 0.3,
        fontSize: 11, fontFace: "Microsoft YaHei", color: item.color, bold: true, align: "center", margin: 0,
      });
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 7.2, y: y + 0.5, w: 1.8, h: 0.28,
        fill: { color: item.color, transparency: 90 }, rectRadius: 0.08,
      });
    }

    // 底部提示
    slide.addText("入口：页头下拉菜单 + AI卡片底部导出按钮", {
      x: 0.6, y: 5.1, w: 8.5, h: 0.3,
      fontSize: 11, fontFace: "Microsoft YaHei", color: "94A3B8", align: "center", margin: 0,
    });
  }

  // ---- Slide 7: 操作流程 ----
  {
    const slide = pres.addSlide();
    slide.background = { color: DARK_BG };

    slide.addText("典型操作流程", {
      x: 0.6, y: 0.3, w: 8, h: 0.7,
      fontSize: 34, fontFace: "Microsoft YaHei", color: WHITE, bold: true, margin: 0,
    });

    const steps = [
      { num: "01", title: "打开首页", desc: "查看最近快照概览" },
      { num: "02", title: "快照管理", desc: "创建/查看/删除快照" },
      { num: "03", title: "基线比对", desc: "选择基准A和对比B" },
      { num: "04", title: "查看结果", desc: "左右树状对比差异详情" },
      { num: "05", title: "AI 分析", desc: "多维度智能解读差异" },
      { num: "06", title: "导出报告", desc: "Excel/Word一键下载" },
    ];

    steps.forEach(async (step, i) => {
      const x = 0.4 + i * 1.6;
      const y = 1.8;

      slide.addShape(pres.shapes.OVAL, {
        x: x + 0.35, y, w: 0.7, h: 0.7,
        fill: { color: ACCENT_PURPLE },
      });
      slide.addText(step.num, {
        x: x + 0.35, y, w: 0.7, h: 0.7,
        fontSize: 22, fontFace: "Microsoft YaHei", color: WHITE, bold: true, align: "center", valign: "middle", margin: 0,
      });

      slide.addText(step.title, {
        x, y: y + 1.0, w: 1.4, h: 0.35,
        fontSize: 14, fontFace: "Microsoft YaHei", color: WHITE, bold: true, align: "center", margin: 0,
      });
      slide.addText(step.desc, {
        x, y: y + 1.4, w: 1.4, h: 0.35,
        fontSize: 11, fontFace: "Microsoft YaHei", color: TEXT_SECONDARY, align: "center", margin: 0,
      });

      // 连接线
      if (i < steps.length - 1) {
        slide.addShape(pres.shapes.LINE, {
          x: x + 1.1, y: y + 0.35, w: 0.4, h: 0,
          line: { color: ACCENT_PURPLE, width: 1.5, dashType: "dash" },
        });
      }
    });

    slide.addText("数据流：快照数据 → Pinia Store → diffEngine → CompareRows → AI分析 / 导出", {
      x: 0.6, y: 4.7, w: 8.5, h: 0.5,
      fontSize: 13, fontFace: "Microsoft YaHei", color: ACCENT_PURPLE, align: "center", margin: 0,
    });
  }

  // ---- Slide 8: 结尾 ----
  {
    const slide = pres.addSlide();
    slide.background = { color: DARK_BG };

    slide.addShape(pres.shapes.OVAL, { x: 2.5, y: -2, w: 6, h: 6, fill: { color: ACCENT_PURPLE, transparency: 88 } });
    slide.addShape(pres.shapes.OVAL, { x: -1.5, y: 3, w: 4, h: 4, fill: { color: ACCENT_BLUE, transparency: 88 } });

    const iconData = await iconToBase64Png(FaRocket, "#A855F7", 512);
    slide.addImage({ data: iconData, x: 4.2, y: 0.6, w: 1.5, h: 1.5 });

    slide.addText("项目基线管理系统", {
      x: 1, y: 2.3, w: 8, h: 0.7,
      fontSize: 36, fontFace: "Microsoft YaHei", color: WHITE, bold: true, align: "center", margin: 0,
    });
    slide.addText("v1.1.0 — 团队高效协作，项目精准管控", {
      x: 1, y: 3.1, w: 8, h: 0.5,
      fontSize: 18, fontFace: "Microsoft YaHei", color: ACCENT_PURPLE, align: "center", margin: 0,
    });

    slide.addText("Vue3 + Element Plus + Vite + TypeScript  |  Aras PLM  |  Agnes AI", {
      x: 1, y: 3.8, w: 8, h: 0.4,
      fontSize: 12, fontFace: "Microsoft YaHei", color: TEXT_SECONDARY, align: "center", margin: 0,
    });
    slide.addText("https://github.com/KongA510/project-baseline", {
      x: 1, y: 4.3, w: 8, h: 0.4,
      fontSize: 12, fontFace: "Microsoft YaHei", color: "64748B", align: "center", margin: 0,
    });
  }

  const outPath = "D:\\git仓库\\项目基线\\doc\\功能说明.pptx";
  await pres.writeFile({ fileName: outPath });
  console.log("PPT saved to: " + outPath);
}

main().catch(err => { console.error(err); process.exit(1); });
