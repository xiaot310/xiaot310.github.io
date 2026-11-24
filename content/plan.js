/* =====================================================================
 * content/plan.js — 工作台“计划”的初始种子
 * 浏览器会把它与 localStorage 合并；AI 可以改这里来预置新任务。
 * 列：now / next / later / done
 * ===================================================================== */
window.PLAN_SEED = {
  version: 1,
  updated: "2026-11-24",
  tasks: [
    {
      id: "t-p01-review",
      title: "整理论文 01 的审稿意见与回复框架",
      project: "论文 01",
      due: "2026-12-05",
      priority: "high",
      status: "now",
      note: "先列问题清单，再补实验/说明"
    },
    {
      id: "t-p02-feas",
      title: "补全冰区路径规划的可行性分析",
      project: "论文 02",
      due: "2026-12-12",
      priority: "high",
      status: "now",
      note: "冰情建模 + 文献缺口 + 数据来源"
    },
    {
      id: "t-p03-topic",
      title: "健康检测：收敛 3 个可验证的选题",
      project: "论文 03",
      due: "2026-12-20",
      priority: "mid",
      status: "next",
      note: "每个选题写清数据、方法、指标"
    },
    {
      id: "t-course",
      title: "课程作业：最优化 / 计算方法",
      project: "课程",
      due: "2026-11-29",
      priority: "mid",
      status: "now",
      note: "按周清理，不堆到期末"
    },
    {
      id: "t-ta",
      title: "助教：工程实践材料归档",
      project: "助教",
      due: "",
      priority: "low",
      status: "next",
      note: "手册、模板、学生反馈"
    },
    {
      id: "t-usv",
      title: "四型无人艇资料统一模板",
      project: "项目",
      due: "",
      priority: "mid",
      status: "next",
      note: "参数、场景、图、来源"
    },
    {
      id: "t-ice-env",
      title: "搭建冰区路径规划实验环境",
      project: "论文 02",
      due: "",
      priority: "mid",
      status: "later",
      note: "数据、环境、基线"
    },
    {
      id: "t-lit-note",
      title: "把文献笔记接进工作台",
      project: "工具",
      due: "",
      priority: "low",
      status: "later",
      note: "先做 reading list，再考虑导出"
    },
    {
      id: "t-p01-submit",
      title: "完成论文 01 投稿包",
      project: "论文 01",
      due: "2026-10-26",
      priority: "high",
      status: "done",
      note: "正文、Cover Letter、Highlights、图表"
    },
    {
      id: "t-usv-done",
      title: "整理四型无人艇平台介绍",
      project: "项目",
      due: "",
      priority: "mid",
      status: "done",
      note: "PPT 与 PDF 已归档"
    }
  ]
};
