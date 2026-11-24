# 张义廷 · 研究工作台

线上：https://xiaot310.github.io/  
仓库：https://github.com/xiaot310/xiaot310.github.io

个人研究主页 + 本地工作台。公开层是纯静态页面，可以部署到 GitHub Pages；
本地层只在本机运行，用来打开文件、LaTeX、画图、查文献、管理计划，以及只读同步 OC 课程与公告。

## 这是什么

- **公开主页**：个人介绍、研究方向、项目演示、当前在做、AI 交接说明。
- **本地工作台**：今日、计划、最近文件、工具、OC、文献、笔记；文件与私链不出本机。
- **OC 同步**：用 Canvas 个人访问令牌读取课程、待办和公告；不需要也不保存学校密码。
- **海冰演示**：四种失效准则的二维包络与三维主应力切片，可分享带参数的链接。
- **Agent 模块**：给未来 AI 的交接文档、内容更新规则、机器可读清单。

## 快速开始

### 只看公开页面

```bash
cd xiaot310-site
python -m http.server 8080
```

打开 `http://127.0.0.1:8080/`。

### 启动完整工作台（不用打开 Python）

**已经设置好登录自动启动**：下次登录 Windows 时，本地服务会在后台启动（无终端窗口），
直接打开收藏夹里的 `http://127.0.0.1:8765/workbench/` 即可。

当前想立即启动/打开，双击站点根目录：

```text
start-workbench-hidden.bat
```

它会后台启动服务并打开浏览器，不显示 Python 终端。

- 换电脑或需要重新设置：双击 `install-autostart.bat`
- 停止后台服务：双击 `stop-workbench.bat`
- 想移除自动启动：双击 `remove-autostart.bat`

命令行/排障时才需要手动运行：

```bash
python workbench/server.py
```

要求 Python 3.9+，不需要安装依赖。

### 部署公开层

把仓库根目录的公开层推到 GitHub（建议仓库名 `xiaot310.github.io`），
Settings → Pages → Deploy from a branch → `main / (root)`。
不要上传 `workbench/private.json`、个人文件或预览临时图。

## 存储在哪？

| 内容 | 存储位置 | 分享给别人 |
| --- | --- | --- |
| 主页、研究摘要、项目说明 | GitHub Pages（云端公开） | 可以，链接即可 |
| 计划、笔记、手绘、阅读清单 | 当前浏览器 localStorage | 默认不共享；可导出 |
| 最近文件、打开文件 | 本机 Python 服务 | 不能，只在本机 |
| LaTeX 私有项目 | 本机 `private.json` → 跳转 | 不能 |
| OC 访问令牌 / 课程缓存 | 本机 `workbench/oc.json` / `oc-cache.json` | 不能；不进 Git |
| 个人证件、成绩单、奖学金 | 不进入站点 | 不会暴露 |

**没有“登录后才能看”的公网权限系统。** 只要内容在 GitHub Pages 上，拿到链接的人就能看；
真正的按人授权需要后端/登录。当前做法是把可公开的放公开层，私有的只留在本机。

## 更新公开内容

改 `content/site-content.js`：

- `research` 加研究卡
- `projects` 加项目卡
- `focus` 改“当前在做”
- `timeline` 改时间线

字段、示例、图片扩展和验证清单见 `content/README.md`。
不需要构建，刷新即可。

## OC 课程同步

工作台新增 **OC** 标签页，只读读取：

- 当前活跃课程（Canvas Courses）
- 待办 / 截止（Canvas Todo）
- 课程公告（Announcements）

### 怎么连接

1. 登录 https://oc.sjtu.edu.cn/
2. 右上角 **Account / 账户 → Settings / 设置 → New Access Token / 新建访问令牌**
3. 复制令牌，粘贴到工作台 OC 页，点 **保存并连接**

**不要输入学校密码。** 令牌只保存在本机 workbench/oc.json（已在 .gitignore，静态服务也会拦截），
网页只拿到课程/公告结果，不拿到令牌；GitHub 上看不到它。同步是**只读**的，不会提交作业或发公告。

如果学校关闭了令牌入口，OC 同步就不可用；不会退回密码登录。

## 更新本地工作台

- 私有配置：`workbench/private.json`（从 `private.example.json` 复制）。
- 启动/API/安全/备份：`workbench/README.md`。
- 默认只扫描 `论文 / 项目 / 课程 / 助教`，排除个人文件、奖学金、证件等。
- 改扫描范围：编辑 `roots` / `exclude`，重启服务。

## 目录

```text
index.html              公开主页
site.config.js          姓名 / GitHub / 描述
content/                公开内容数据 + 维护指南
assets/                 CSS / JS / 物理内核 / 图标
lab/ice-failure/        海冰失效演示
agent/                  AI 交接页 + manifest
workbench/              本地工作台（页面 + server.py + private.json）
start-workbench.bat     一键启动
AGENTS.md               给编码 Agent 的详细交接
llms.txt                给 LLM 的机器可读摘要
```

## 常见问题

**为什么工作台在 GitHub 上文件按钮是灰的？**
文件/LaTeX 由本机 Python 服务提供；公开页面没有这个服务，所以自动降级。

**能分享工作台吗？**
可以分享公开主页和演示；工作台本身不建议暴露到公网。需要多人访问时，应该另做带登录的后端。

**换电脑会丢计划吗？**
计划/笔记/手绘在浏览器 localStorage。换电脑前用工作台的导出 JSON / 下载 .md / 下载 PNG。

**怎么联系我？**
目前只保留 GitHub：`https://github.com/xiaot310`。不编造邮箱/电话。

## 交接文档

- `AGENTS.md` — 结构、硬约束、API、验收清单。
- `content/README.md` — 首页内容字段与新增步骤。
- `workbench/README.md` — 本地服务启动、私有边界、故障排查。
- `agent/index.html` — 可视化交接页。
- `llms.txt` — 机器可读入口。

## 边界

- 海冰演示是教学可视化，不是工程仿真；三维是 `σ3` 切片，不是网格实体。
- Agent 页面的本地问答是关键词检索，不是大模型。
- 论文状态以投稿系统/导师确认为准；页面只写“已投稿 / 审稿准备 / 调研中”。
- 站内不包含未发表数据、审稿意见、合作方敏感材料。
