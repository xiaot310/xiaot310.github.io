# AGENTS.md — 张义廷个人站点的交接说明

> 你正在接手 **xiaot310-site**：张义廷（GitHub: `xiaot310`）的个人研究主页 +
> 本地研究工作台。先读这份文件，再读 `content/README.md`、`workbench/README.md`、
> `agent/manifest.json`、`llms.txt`。不要从零猜结构。

## 1. 两层结构（最重要）

| 层 | 文件 | 运行方式 | 内容 |
| --- | --- | --- | --- |
| 公开层 | 根目录、`lab/`、`agent/`、`content/` | GitHub Pages / 静态服务器 | 可公开的研究、演示、文档 |
| 本地层 | `workbench/`（页面 + `server.py`） | `127.0.0.1:8765` | 计划、文件、LaTeX、画图、文献、笔记 |
| 私有配置 | `workbench/private.json` | 只在本机 | 研究根目录、LaTeX 私链、排除名单 |

公开层是纯静态；本地层只绑定 localhost。**不要把本地层的能力误认为公网权限控制**：
GitHub Pages 没有登录/权限系统，真正的访问控制需要后端；当前策略是“公开的放公开层，
私有的只在本机”。

## 2. 硬约束

1. **公开页面保持纯静态、零依赖。** 不引入 npm、框架、构建步骤、CDN、外部字体。
   直接由静态文件服务器提供；GitHub Pages 可直接部署。
2. **本地服务器只用 Python 标准库。** 不引入 Flask/FastAPI；不要求 `pip install`。
3. **私有配置绝不提交。** `workbench/private.json` 含 LaTeX token 和本地路径，
   已在 `.gitignore` 中排除；`server.py` 也会拦截它的静态访问。
4. **不扫描/不展示敏感材料。** 默认排除 `个人文件`、`奖学金`、`身份证`、
   `学历`、`学位`、`宿舍`、`比赛`；不要为了“文件更多”移除。
5. **内容优先改数据。** 新增研究/项目卡改 `content/site-content.js`，
   不要复制首页 HTML；结构与字段见 `content/README.md`。
6. **公开页面用相对路径。** 站点可能部署在 `username.github.io/repo/`；
   不要写死 `/assets/...` 或域名。
7. **物理只有一份实现。** 四种失效准则在 `assets/js/ice-criteria.js`；
   实验页只调用，不复制公式。
8. **文档与代码一起改。** 结构/路由/字段变化后，同步 `agent/manifest.json`、
   `llms.txt`、本文件、`content/README.md`、`workbench/README.md`。
9. **不要假装。** 本地问答是关键词检索，不是大模型；海冰演示是教学可视化，不是工程仿真。
10. **不要用“读一小段再整文件覆写”的方式改文件。** 先完整读取，或用精确 edit；
    这会把文件截断。

## 3. 快速开始

公开页面：

```bash
cd xiaot310-site
python -m http.server 8080
# http://127.0.0.1:8080/
```

完整工作台：

```bash
python workbench/server.py
# 自动打开 http://127.0.0.1:8765/workbench/
```

Windows 也可双击 `start-workbench.bat`。没有 `npm install`，没有构建。

## 4. 目录

```text
xiaot310-site/
├─ index.html                 公开主页（个人身份 + 研究/项目 + 工作台入口）
├─ site.config.js             身份唯一来源（姓名/GitHub/描述）
├─ content/
│  ├─ site-content.js         首页数据：profile/focus/research/projects/timeline
│  ├─ plan.js                 工作台计划种子
│  └─ README.md               内容字段与新增步骤（AI 必读）
├─ assets/
│  ├─ css/site.css            基础纸感/冰蓝设计系统
│  ├─ css/personal.css        首页新组件
│  ├─ js/site.js              身份注入 / reveal / 交接 Prompt
│  ├─ js/home.js              首页数据渲染 + 本地状态
│  ├─ js/ice-criteria.js      失效准则内核（唯一）
│  └─ img/favicon.svg
├─ lab/ice-failure/           公开交互演示（index.html / lab.css / lab.js）
├─ agent/                     AI 交接页（index.html / agent.js / knowledge.js / manifest.json）
├─ workbench/
│  ├─ index.html              工作台页面
│  ├─ workbench.css
│  ├─ workbench.js            计划/文件/工具/文献/笔记
│  ├─ server.py               本地服务器（标准库）
│  ├─ private.example.json    配置样板
│  ├─ private.json            本地私有（不提交）
│  └─ README.md               启动/API/安全/备份
├─ start-workbench.bat
├─ llms.txt
├─ AGENTS.md
└─ README.md
```

## 5. 路由

- `/` — 个人主页。
- `/lab/ice-failure/` — 海冰失效交互演示。
- `/agent/` — AI 交接、内容更新说明、机器可读清单。
- `/workbench/` — 本地工作台（hash：`#today|#plan|#files|#tools|#literature|#notes`）。
- `/api/*`、`/go/latex`、`/go/draw` — 只在本地 `server.py` 提供。

## 6. 内容契约（摘要）

首页渲染入口 `assets/js/home.js` 读取 `window.SITE_CONTENT`：

- `focus[]`：`code/title/stage/status/note/tags`
- `research[]`：`id/index/title/en/stage/status/summary/tags/detail`
- `projects[]`：`id/index/title/en/summary/tags/badge/href/action`
- `timeline[]`：`when/title/note`

`badge` 只用 `LIVE / LOCAL / WORKSPACE`；`href` 不得含 token。
新增步骤、字段规则、图片扩展、验证清单见 `content/README.md`。

## 7. 本地工作台 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/status` | `{ok,name,version,root,time}` |
| GET | `/api/files?limit=300&q=` | 最近文件 / 搜索 |
| GET | `/api/tools` | LaTeX/draw 配置、roots 名称 |
| POST | `/api/open` | `{path}`，系统默认程序打开 |
| POST | `/api/reveal` | `{path}`，资源管理器定位 |
| GET | `/go/latex` | 302 到私链（不暴露在页面） |
| GET | `/go/draw` | 302 到 draw.io |

安全要求：

- 只绑 `127.0.0.1`，不绑 `0.0.0.0`。
- `POST` 只接受 JSON、同源、`researchRoot` 内路径；拒绝越界/敏感目录/私链文件。
- 静态访问 `workbench/private.json` 返回 404。
- 文件上限 30 MB、最多 800 个；缓存文件跳过。
- 公开页面的本地按钮在离线时自动禁用；不要为了“看起来能用”去掉降级提示。

## 8. 海冰演示（公开层）

- 四种准则：第一强度、Mises、Mohr–Coulomb、Tsai–Wu。
- 拉为正、压为负；`g < 1` 安全，`g >= 1` 失效；单位 MPa。
- 标定与公式在 `assets/js/ice-criteria.js`；改物理必须核对：
  - 单轴拉伸 `(σt,0,0)`、单轴压缩 `(-σc,0,0)` 对相应准则 `g≈1`；
  - 纯剪切 `(S,-S,0)` 对 Tsai–Wu `g≈1`。
- 三维显示是 `σ3` 切片，不是网格求解的三维实体；文案不要夸大。
- URL：`#m=2d|3d&s=σ1,σ2,σ3&st=...&sc=...&S=...&v=1111&fit=0`。

## 9. 部署

1. 只把公开层放进 GitHub 仓库；**不要** 把 `workbench/private.json`、个人文件、`_preview/` 上传。
2. 仓库建议 `xiaot310.github.io`；Settings → Pages → Deploy from a branch → `main / (root)`。
3. `.nojekyll` 保留。
4. 部署后检查 `/`、`/lab/ice-failure/`、`/agent/`、`/workbench/`（离线态）；
   工作台在本机启动后才能看到文件/LaTeX。
5. 公开站点不包含任何后端，所以“分享给别人”只分享公开层；私有层不出本机。

## 10. 验收清单

- [ ] 首页 1440 / 390 宽无横向溢出，控制台无报错。
- [ ] 首页数据卡来自 `content/site-content.js`；新增一条能出现。
- [ ] 工作台启动后 `/api/status` 为 ok；文件列表不含敏感目录。
- [ ] `/workbench/private.json` 返回 404；`/go/latex` 仅本机 302。
- [ ] 计划增删/移动/导出/导入可用；笔记/手绘刷新后还在。
- [ ] 公开部署的 `/workbench/` 显示“本地服务未连接”，不伪造在线。
- [ ] `agent` 页面/`manifest.json`/`llms.txt` 与新结构一致。
- [ ] 没有提交私链、token、个人证件/成绩单。

## 11. 常见坑

- 用 `file://` 打开时 `fetch` 会被拦截，工作台 API 和 Agent 自检必然失败；用 HTTP。
- 工作台页面在 `/workbench/`，API 用 `../api/...`；公开部署时这些请求会 404，这是预期降级。
- 改 `site.config.js` 不会自动改手写 `<title>`；需要同步页面标题。
- `private.json` 是 JSON；尾部逗号会导致服务读配置失败并回退默认值。
- 文件列表默认只显示最近 300 个；搜索会走服务端 `q`，不要假装是全文检索。
- 计划/笔记/手绘在 localStorage，换浏览器/清缓存会丢失；重要内容导出。

## 12. 交付时说什么

说明改了哪些文件、为什么、如何验证、哪些内容仍是本地私有、还有什么边界没解决。
不要只给“已完成”。
