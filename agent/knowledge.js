/* =====================================================================
 * knowledge.js — Agent 页的关键词检索条目（不是大模型）
 * ===================================================================== */
window.AGENT_KNOWLEDGE = [
  {
    id: 'content',
    title: '怎么加一张研究 / 项目卡',
    tags: ['内容', '加卡', '项目', '研究', 'site-content', '首页'],
    body: '改 content/site-content.js。研究卡加到 research 数组，项目卡加到 projects 数组，当前焦点加到 focus。字段示例和完整规则见 content/README.md。不要复制首页 HTML；刷新页面即可看到。'
  },
  {
    id: 'fields',
    title: '研究卡有哪些字段',
    tags: ['字段', 'research', 'id', 'summary', 'stage'],
    body: '研究卡字段：id、index、title、en、stage、status、summary、tags、detail。status 只用 review / active / research；stage 是给人看的阶段。summary 只写愿意公开的内容，detail 写工作区相对路径。'
  },
  {
    id: 'plan',
    title: '计划任务存在哪里',
    tags: ['计划', '任务', 'plan', 'localStorage', '备份'],
    body: '计划默认来自 content/plan.js 的种子，之后存在浏览器 localStorage。工作台可以导出 JSON、导入 JSON、重置种子。换浏览器或清理缓存前先导出。'
  },
  {
    id: 'private',
    title: 'private.json 会被上传吗',
    tags: ['private', '私有', 'latex', 'token', '上传', '安全'],
    body: '不会。workbench/private.json 在 .gitignore 中排除，server.py 也会拦截它的静态访问。它包含研究根目录和 LaTeX 私链，绝不能提交到 GitHub。公开页面只通过本机 /go/latex 跳转，不写链接。'
  },
  {
    id: 'start',
    title: '工作台怎么启动',
    tags: ['启动', '工作台', 'server.py', 'python', '端口'],
    body: '在 xiaot310-site 目录运行 python workbench/server.py，或双击 start-workbench.bat。它会打开 http://127.0.0.1:8765/workbench/。只用 Python 标准库，不需要 pip install。公开部署的页面上文件/LaTeX 按钮会显示未连接。'
  },
  {
    id: 'files',
    title: '文件列表为什么只有这些',
    tags: ['文件', '扫描', 'roots', '排除', '敏感'],
    body: '只扫描 private.json 的 roots，默认论文、项目、课程、助教；排除个人文件、奖学金、身份证、学历、学位、宿舍、比赛、隐藏目录、缓存和超过 30 MB 的文件。最多 800 个，页面显示最近 300 个，搜索会请求服务端 q。'
  },
  {
    id: 'deploy',
    title: '怎么部署到 GitHub Pages',
    tags: ['部署', 'github', 'pages', '分享', '公开'],
    body: '只上传公开层到仓库（建议 xiaot310.github.io），Settings → Pages → Deploy from a branch → main / (root)，保留 .nojekyll。不要上传 private.json、个人文件、预览临时图。部署后验证首页、演示、Agent、工作台离线态。'
  },
  {
    id: 'permission',
    title: '分享给别人时权限怎么控制',
    tags: ['权限', '分享', '公开', '私有', '登录'],
    body: 'GitHub Pages 没有按人授权的登录系统：公开层拿到链接就能看。当前策略是公开内容放公开层，私有文件/LaTeX/计划只在本机。需要“只给某些人看”时，要另做带登录的后端，而不是假装静态站有权限。'
  },
  {
    id: 'ice',
    title: '海冰演示的边界',
    tags: ['海冰', 'ice', '失效', '物理', '演示'],
    body: '海冰演示是教学可视化，不是工程仿真。四种准则在第一强度、Mises、Mohr-Coulomb、Tsai-Wu；拉为正、压为负，g<1 安全、g>=1 失效。三维是 σ3 切片，不是网格实体。公式只在 assets/js/ice-criteria.js 维护。'
  },
  {
    id: 'check',
    title: '改完怎么验证',
    tags: ['验证', '自检', 'check', '控制台', '移动端'],
    body: '首页 1440/390 无横向溢出、控制台无报错；新卡出现；工作台 /api/status 为 ok、文件列表不含敏感目录；/workbench/private.json 返回 404；公开部署工作台显示离线。Agent 页的“运行自检”可检查静态文件。'
  },
  {
    id: 'layout',
    title: '站点目录与路由',
    tags: ['目录', '路由', '结构', '页面'],
    body: '根目录是主页；lab/ice-failure/ 是海冰演示；agent/ 是交接页；workbench/ 是本地工作台；content/ 是首页数据；assets/ 是 CSS/JS/物理内核。工作台 hash：today、plan、files、tools、literature、notes。'
  },
  {
    id: 'agent',
    title: '下一个 AI 应该先读什么',
    tags: ['agent', '交接', 'agents.md', 'manifest', 'llms'],
    body: '先读 AGENTS.md，再读 content/README.md 和 workbench/README.md；机器入口是 agent/manifest.json 与 llms.txt。不要从零猜结构，不要提交私有配置，不要用“读一小段再整文件覆写”的方式改文件。'
  }
];
