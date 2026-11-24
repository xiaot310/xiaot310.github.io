/* =====================================================================
 * content/site-content.js — 公开主页的内容数据
 * AI 更新展示内容时，优先改这个文件；结构与写法见 content/README.md。
 * ===================================================================== */
window.SITE_CONTENT = {
  profile: {
    name: "张义廷",
    nameEn: "Yiting ZHANG",
    role: "上海交通大学 · 研究生",
    field: "海洋工程 / 极地力学 / 智能规划",
    summary: "关注冰区航行、海冰失效与智能优化。这个站点一边展示研究，一边把我每天要用的文件、画图、文献和 LaTeX 放进同一个本地工作台。",
    interests: ["极地工程", "海冰力学", "路径规划", "智能优化", "结构健康监测"],
    github: "https://github.com/xiaot310",
    location: "上海"
  },

  focus: [
    {
      code: "P01",
      title: "LLM 引导稀疏 A* 的无人艇路径规划",
      stage: "已投稿 · 审稿准备",
      status: "active",
      note: "围绕运动约束、稀疏搜索与 LLM 引导的路径规划工作；当前重点是审稿意见准备与冰区扩展的方法储备。",
      tags: ["LLM", "A*", "USV", "路径规划"]
    },
    {
      code: "P02",
      title: "极地 / 冰区路径规划",
      stage: "前期调研",
      status: "research",
      note: "冰情建模、可行性与文献梳理；把冰区约束接进现有的规划框架。",
      tags: ["冰区", "路径规划", "可行性"]
    },
    {
      code: "P03",
      title: "海洋结构健康监测",
      stage: "选题调研",
      status: "research",
      note: "海洋结构与设备的健康监测方向，正在做 OE 相关文献梳理与选题收敛。",
      tags: ["健康监测", "海洋结构", "文献"]
    }
  ],

  research: [
    {
      id: "p01",
      index: "01",
      title: "LLM 引导稀疏 A* 的无人艇路径规划",
      en: "LLM-guided sparse A* for USV path planning",
      stage: "已投稿 · 审稿准备",
      status: "review",
      summary: "把大语言模型的先验引导接进稀疏 A* 搜索：在保持运动学可行性的同时减少无效扩展。当前整理审稿意见与冰区扩展的储备实验。",
      tags: ["LLM", "Sparse A*", "USV", "Motion constraints"],
      detail: "工作区：论文/1.LLM+A"
    },
    {
      id: "p02",
      index: "02",
      title: "极地冰区路径规划",
      en: "Path planning in ice-covered waters",
      stage: "前期调研",
      status: "research",
      summary: "从冰情建模、船舶运动约束和风险代价三个角度做可行性分析，目标是把冰区约束接进可复现的规划实验。",
      tags: ["Ice", "Path planning", "Risk"],
      detail: "工作区：论文/2.ice-planning"
    },
    {
      id: "p03",
      index: "03",
      title: "海洋结构健康监测",
      en: "Structural health monitoring for marine structures",
      stage: "选题调研",
      status: "research",
      summary: "围绕海洋结构与设备的监测需求做文献梳理，寻找可以用公开数据或试验数据验证的窄问题。",
      tags: ["SHM", "Marine structures", "Sensors"],
      detail: "工作区：论文/3.健康检测"
    }
  ],

  projects: [
    {
      id: "ice-demo",
      index: "01",
      title: "海冰三轴失效准则",
      en: "Sea-ice failure criteria",
      summary: "四种失效准则的二维包络与三维主应力空间切片；拖动应力点、改材料强度、分享带参数的链接。",
      tags: ["交互演示", "Canvas", "冰力学"],
      badge: "LIVE",
      href: "lab/ice-failure/index.html",
      action: "打开演示"
    },
    {
      id: "usv",
      index: "02",
      title: "四型无人艇平台资料整理",
      en: "USV platform notes",
      summary: "把四型无人艇的平台参数、任务场景与介绍材料整理成统一结构，便于快速对比和汇报。",
      tags: ["USV", "资料整理", "汇报"],
      badge: "WORKSPACE",
      href: "workbench/index.html#files",
      action: "在工作台查看"
    },
    {
      id: "state",
      index: "03",
      title: "状态估计与试验数据",
      en: "State estimation & experimental data",
      summary: "围绕状态估计、滤波与试验数据处理的项目材料；工作文件保留在本地，不上传到公开站点。",
      tags: ["状态估计", "滤波", "数据"],
      badge: "LOCAL",
      href: "workbench/index.html#files",
      action: "打开本地工作台"
    },
    {
      id: "valve",
      index: "04",
      title: "智能阀门与控制预研",
      en: "Intelligent valve & control",
      summary: "智能阀门方向的前期资料与控制方案预研，暂以工作区笔记和汇报材料为主。",
      tags: ["控制", "阀门", "预研"],
      badge: "LOCAL",
      href: "workbench/index.html#files",
      action: "在工作台查看"
    }
  ],

  timeline: [
    { when: "2026.10", title: "论文 01 投稿包完成", note: "状态以投稿系统为准" },
    { when: "2026.11", title: "论文 02 / 03 前期调研", note: "冰区规划、健康监测" },
    { when: "2026 秋", title: "课程与助教", note: "最优化、计算方法、网络科学、工程实践" }
  ]
};
