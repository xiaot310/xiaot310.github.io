# 本地工作台 Workbench

张义廷（GitHub: xiaot310）个人站点的**本地层**：在公开静态站点旁边，用 Python 标准库起一个只监听
127.0.0.1 的小服务器，把「最近文件 / 打开文件 / LaTeX 私链 / 画图 / OC 课程」收进 workbench 页面。

- 公开层（首页、lab/、agent/、content/）仍然是纯静态，可以直接部署到 GitHub Pages。
- 本地层只在启动 server.py 后可用；不启动或部署到公网时，工作台页面自动显示「本地服务未连接」。
- 只用 Python 标准库，没有 pip install，没有 npm 构建。
- **不需要手动打开 Python**：已设置 Windows 登录后台启动；也可以双击 start-workbench-hidden.bat。

> 边界：这是**本机单人使用**的工具，不是带登录的网盘。能打开网页的人就是这台电脑的使用者。

## 1. 快速开始（推荐：不打开 Python）

**登录自动启动**已配置：下次登录 Windows 时，后台用 pythonw 启动服务，无终端窗口。
打开 http://127.0.0.1:8765/workbench/ 即可。

当前想立即启动：双击站点根目录的

~~~text
start-workbench-hidden.bat
~~~

它会后台启动服务并打开浏览器，不显示 Python 终端。

- 重新设置自动启动：双击 install-autostart.bat
- 停止后台服务：双击 stop-workbench.bat
- 移除自动启动：双击 remove-autostart.bat

命令行/排障时才需要：

~~~bash
python workbench/server.py
# 自动打开 http://127.0.0.1:8765/workbench/
~~~

只启动、不打开浏览器：

~~~bash
python workbench/server.py --no-open
~~~

端口被占用时换一个：

~~~bash
python workbench/server.py --port 8766
~~~

要求：Python 3.8+；启动脚本优先用 PATH 里的 python，其次用 py -3。页面在服务未就绪时会每 7 秒自动重试连接。

## 2. 文件结构

~~~text
xiaot310-site/                     ← 站点根目录（静态服务根）
├─ start-workbench-hidden.bat       ← 一键后台启动 + 打开页面
├─ start-workbench.bat              ← 带终端的启动器（排障用）
├─ install-autostart.bat            ← 设置登录后台启动
├─ stop-workbench.bat               ← 停止后台服务
├─ remove-autostart.bat             ← 移除登录启动
├─ index.html / lab/ / agent/ ...   ← 公开层，不含任何私有数据
└─ workbench/
   ├─ index.html / workbench.css / workbench.js   ← 工作台页面
   ├─ server.py                    ← 本地服务器（本文件说明的对象）
   ├─ oc_sync.py                   ← OC / Canvas 只读同步
   ├─ start-hidden.vbs             ← 后台启动脚本
   ├─ install-autostart.ps1        ← 创建登录快捷方式
   ├─ private.example.json         ← 配置样板（可以提交）
   ├─ private.json                 ← 本地私有配置（**不要提交**）
   ├─ oc.json / oc-cache.json      ← 本机 OC 令牌与缓存（**不要提交**）
   └─ README.md                    ← 本文
~~~

- **站点根目录** = `workbench/` 的父目录，服务器只服务这个目录里的静态文件。
- **研究工作区（researchRoot）** 默认是站点根目录的上一级再上一级，即
  `你的研究工作区`（站点在 `你的研究工作区\agent\xiaot310-site`）。
- 只有 `researchRoot` 下面的 `roots` 白名单目录会被扫描成「最近文件」。

## 3. 私有配置 private.json

服务器启动时读取配置，优先级：

~~~text
workbench/private.json  >  workbench/private.example.json  >  server.py 内置默认值
~~~

即：没有 `private.json` 时直接用样板 `private.example.json` 的默认值；有 `private.json` 时
用它的字段覆盖样板（样板补齐缺省项）。改完配置需要重启服务器。

第一次启用私有链接：

~~~powershell
Copy-Item workbench\private.example.json workbench\private.json
notepad workbench\private.json
~~~

字段说明：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `researchRoot` | 字符串 | `"../.."` | 研究工作区根目录。相对路径按**站点根目录**解析，也可写绝对路径（如 `D:/path/to/research`） |
| `roots` | 数组 | `["论文","项目","课程","助教"]` | 要扫描的子目录（相对 `researchRoot`），也是页面上的「打开 XX 文件夹」按钮 |
| `exclude` | 数组 | 见下 | 追加排除的目录/文件名；**内置的敏感名单不能通过配置删除** |
| `maxFileMB` | 数字 | `30` | 单文件大小上限，超过的文件不进列表 |
| `latexUrl` | 字符串 | `""` | 私有 LaTeX 论文地址，只经 `/go/latex` 302 跳转，接口不返回它 |
| `drawUrl` | 字符串 | `""` | 私有画图地址，经 `/go/draw` 302 跳转 |

一个填好的例子（不要提交这个文件）：

~~~json
{
  "researchRoot": "D:/path/to/research",
  "roots": ["论文", "项目", "课程", "助教"],
  "exclude": ["个人文件", "奖学金", "身份证", "学历", "学位", "宿舍", "比赛"],
  "maxFileMB": 30,
  "latexUrl": "https://latex.sjtu.edu.cn/project/xxxxxxxx",
  "drawUrl": "https://app.diagrams.net/"
}
~~~

注意：

- `private.json` 含私有链接和本地路径。项目根目录的 `.gitignore` 里应有
  `workbench/private.json`（如果还没有，请补上）；不要把私有配置、证件材料、成绩单提交到仓库。
- JSON 不能写注释，**结尾多一个逗号会导致读取失败**，服务器会打印提示并回退到样板默认值。
- `roots` 里如果写了 `researchRoot` 之外的绝对路径、敏感目录或不存在的目录，会被忽略并打印提示。

## 4. HTTP API

所有接口只在本机可用；接口返回 UTF-8 JSON，响应带 `Cache-Control: no-store`。
错误统一是 `{"ok": false, "error": "中文原因", "code": "..."}`，并配合 4xx/5xx 状态码。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/status` | 服务状态 |
| GET | `/api/files?limit=80&q=` | 最近文件 / 按名称路径搜索 |
| GET | `/api/tools` | LaTeX / draw 是否已配置、roots 名称（不含私链） |
| POST | `/api/open` | `{"path": "..."}`，用系统默认程序打开文件或文件夹 |
| POST | `/api/reveal` | `{"path": "..."}`，在资源管理器中定位 |
| GET | `/go/latex` | 302 到私有 LaTeX 链接（未配置时跳学校平台） |
| GET | `/go/draw` | 302 到私有绘图链接（未配置时跳 app.diagrams.net） |

### 4.1 GET /api/status

~~~bash
curl -s http://127.0.0.1:8765/api/status
~~~

~~~json
{"ok":true,"name":"Yiting Workbench","version":"1.0.0",
 "root":"你的研究工作区","site":"你的研究工作区\\agent\\xiaot310-site",
 "time":"2026-11-24T13:20:00+08:00"}
~~~

`root` 是研究工作区路径（页面用它拼「打开论文文件夹」这类路径），`site` 是静态服务根目录。

### 4.2 GET /api/files

~~~bash
curl -s "http://127.0.0.1:8765/api/files?limit=5"
curl -s "http://127.0.0.1:8765/api/files?q=LLM"
~~~

~~~json
{"ok":true,
 "root":"你的研究工作区",
 "roots":[{"name":"论文","path":"你的研究工作区\\论文"}],
 "files":[{"name":"paper.pdf","path":"你的研究工作区\\论文\\1.LLM+A\\paper.pdf",
           "rel":"论文/1.LLM+A/paper.pdf","dir":"论文/1.LLM+A","ext":"pdf",
           "size":1048576,"mtime":1763900000,"kind":"pdf","root":"论文"}],
 "total":326,"limit":5,"query":""}
~~~

| 字段 | 说明 |
| --- | --- |
| `name` | 文件名 |
| `path` | 绝对路径（Windows 原生分隔符），前端原样回传给 `/api/open` |
| `rel` | 相对 `researchRoot` 的路径，正斜杠 |
| `dir` | `rel` 的父目录（相对 `researchRoot`，正斜杠）；顶层文件为空串 |
| `ext` | 小写扩展名，不带点；无扩展名为空串 |
| `size` | 字节数 |
| `mtime` | 最后修改时间，**Unix 秒** |
| `kind` | 粗分类：`pdf / doc / sheet / slide / image / archive / code / other` |
| `root` | 来自哪个扫描根（论文 / 项目 / …） |

- `limit` 默认 80，范围 1–800；`files` 按修改时间倒序，`total` 是过滤后的总数。
- `q` 按空格分词，所有词都要出现在「文件名 + 相对路径 + 目录 + 扫描根」里（不区分大小写）。
- 扫描结果有 3 秒快照缓存：刚新建的文件最多 3 秒后出现，刷新页面即可。
- 服务端不做全文检索，`q` 只匹配名称和路径。

### 4.3 GET /api/tools

~~~bash
curl -s http://127.0.0.1:8765/api/tools
~~~

~~~json
{"ok":true,"latex":false,"draw":false,"roots":["论文","项目","课程","助教"]}
~~~

`latex / draw` 表示私链**是否已配置**；即使为 `false`，`/go/latex` 仍会跳默认平台，
只是工作台页面的按钮会显示「未配置」。接口不返回任何私有 URL。

### 4.4 POST /api/open 与 /api/reveal

~~~bash
curl -s -X POST http://127.0.0.1:8765/api/open \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"D:/path/to/research/论文\"}"
~~~

成功：`{"ok":true,"action":"open","path":"你的研究工作区\\论文","name":"论文"}`

失败示例：

~~~json
{"ok":false,"error":"该路径不在研究工作区（researchRoot）内","code":"forbidden"}
~~~

`path` 可以是文件或目录，也可以写相对 `researchRoot` 的相对路径。限制见下一节。

### 4.5 /go/latex 与 /go/draw

~~~bash
curl -s -i http://127.0.0.1:8765/go/latex
# HTTP/1.1 302 Found
# Location: https://latex.sjtu.edu.cn/
~~~

302 的目标来自 `private.json` 的 `latexUrl` / `drawUrl`；未配置时跳默认公开平台。
在公开站点上没有这两个路由，页面只在本地服务在线时启用它们。

## 4.1 OC 同步（只读）

工作台的 OC 标签页通过 Canvas API 读取当前活跃课程、Todo 待办和课程公告。**不使用也不保存学校密码。**

### 创建令牌

1. 登录 https://oc.sjtu.edu.cn/
2. Account / 账户 → Settings / 设置 → New Access Token / 新建访问令牌
3. 复制令牌，粘贴到工作台 OC 页，点“保存并连接”

### 存储与边界

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 访问令牌 | workbench/oc.json | 仅本机；.gitignore 排除；静态访问 404 |
| 同步缓存 | workbench/oc-cache.json | 课程/待办/公告的只读快照；不含令牌 |
| 请求目标 | https://oc.sjtu.edu.cn | 只允许该校 Canvas，不向其他域发令牌 |

- 同步只读，不会提交作业、发公告或改课程。
- 令牌不会返回给网页，也不会写进缓存。
- 如果学校关闭了令牌入口，OC 同步不可用；**不会退回密码登录**。
- 清除令牌：OC 页底部“断开并清除本机令牌”，或删除 oc.json 后重启服务。

### 接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | /api/oc/status | 是否配置、上次同步、计数（不含令牌） |
| GET | /api/oc/data | 读取本机缓存 |
| POST | /api/oc/config | 验证并保存令牌 |
| POST | /api/oc/sync | 请求 Canvas 并刷新缓存 |
| POST | /api/oc/clear | 删除本机令牌和缓存 |

## 5. 安全设计

| 措施 | 说明 |
| --- | --- |
| 只绑回环 | 固定监听 `127.0.0.1`，不接受 `--host` 改绑 `0.0.0.0`；局域网其他设备访问不到 |
| 同源 / Host 校验 | 校验 `Host`、`Origin`、`Sec-Fetch-Site`，只接受 `127.0.0.1` 或 `localhost` 的同源请求，防 DNS rebinding 与跨站伪造 POST |
| 文件只读 | 没有任何文件上传、删除、重命名接口；扫描只是 `listdir + stat`。OC 同步会写本机 token/缓存，但不会改 Canvas |
| 路径围栏 | `/api/open`、`/api/reveal` 用 `realpath` 解析后必须落在 `researchRoot` 内，`..` 逃逸无效 |
| 敏感目录 | 强制排除 `个人文件、奖学金、身份证、学历、学位、宿舍、比赛`（大小写不敏感、任意层级） |
| 隐藏与工程目录 | 跳过 `.` 开头的隐藏目录/文件、`.git`、`node_modules`、`__pycache__`、`venv`、`site-packages` |
| 大文件 | 默认跳过大于 30 MB 的文件（`maxFileMB` 可调） |
| 链接与联接点 | 不跟随符号链接 / Windows 联接点，避免循环和越界 |
| 私有配置 | `workbench/private.json` 静态访问返回 404，`/api/open` 也拒绝打开它 |
| OC 令牌 | `oc.json` / `oc-cache.json` 静态访问 404；状态接口只返回布尔值与计数，不返回 token |
| OC 目标限制 | 只向 `https://oc.sjtu.edu.cn` 发请求；不接受密码，不接受任意 URL |
| 私链不落接口 | `/api/tools` 只返回布尔值；私链只存在于 `/go/*` 的 302 目标里 |
| 跳转白名单 | `/go/*` 只接受 `http(s)` 链接，非法配置回退默认值 |
| 静态围栏 | 静态服务用 `realpath` 限制在站点根内，拒绝 `..`、隐藏路径与 `private.json` |

注意：以上是「防误触 + 防本地浏览器被跨站利用」的边界，不是多用户鉴权。**同一个 Windows 账户下
的其他进程本来就能读这些文件**；任何能操作这台电脑的人都能做到同样的事。

## 6. 在公开站点上的表现（离线降级）

- GitHub Pages / `python -m http.server 8080` 上不存在 `/api/*`，工作台页面会显示
  「本地服务未连接」，文件 / LaTeX / 打开按钮自动禁用，不伪造在线状态。
- 首页的「本地工作台在线」状态靠 `api/status`；未启动服务时显示「本地工作台 · 仅本机」。
- 公开站点只包含静态文件；私有文件、`private.json`、`oc.json`、LaTeX 私链都不在仓库里。
- 公开页面没有权限启动本地程序；本机通过 Windows 登录后台启动，页面只负责连接和显示。

## 7. 备份

- **计划**：工作台「计划」页右上角可导出 JSON（含全部任务），也可导入恢复；数据存在浏览器
  `localStorage`（键名 `xiaot.plan.v1`），清缓存 / 换浏览器会丢。
- **笔记 / 手绘**：同样在 `localStorage`（`xiaot.notes.v1`、`xiaot.sketch.v1`），
  笔记可下载为 `.md`，手绘可下载为 `.png`。
- **私有配置**：单独备份 `workbench/private.json`（放本地或密码管理器，不要放进公开仓库）。
- **OC 令牌**：`workbench/oc.json` 仅本机；如更换电脑，在新电脑上重新创建令牌，不要复制到公开仓库。
- **研究文件**：`你的研究工作区` 下的文件按你自己的习惯备份；本项目不复制、不上传。

## 8. 故障排查

| 现象 | 原因 / 处理 |
| --- | --- |
| 启动报「无法监听 … 端口可能已被占用」 | 关掉占用 8765 的程序，或 `--port 8766` 后访问对应端口 |
| 页面显示「本地服务未连接」 | 没启动服务，或端口不是 8765；双击 `start-workbench-hidden.bat`，页面会每 7 秒自动重试 |
| 登录后没有自动启动 | 双击 `install-autostart.bat` 重建快捷方式；检查启动文件夹里是否有 `Xiaot Workbench.lnk` |
| OC 显示未配置 | 在 OC 页粘贴 Canvas 访问令牌；不要输入密码 |
| OC 令牌失效 | 在 OC 设置里重新创建令牌，粘贴保存；旧令牌不会自动续期 |
| 文件列表为空 | `researchRoot` / `roots` 写错、目录不存在，或文件都超过 `maxFileMB`；看启动时打印的提示 |
| LaTeX 按钮是灰的 | `private.json` 的 `latexUrl` 还没填；填完重启服务器 |
| 改了 `private.json` 没生效 | 配置只在启动时读取，用 `Ctrl+C` 重启 |
| 打开文件没反应 | 系统没有关联程序；先在资源管理器里手动打开一次再试 |
| 中文控制台乱码 | 服务器已统一输出 UTF-8；老式 `cmd` 可先执行 `chcp 65001` |
| 页面数据旧 | 接口是 3 秒快照；刷新页面即可 |

## 9. 已知限制

1. 只面向 Windows 本机（跨平台 fallback 用 `open` / `xdg-open`，但未在 macOS/Linux 上实测）。
2. 没有鉴权、没有多用户；只绑 `127.0.0.1` 是本机使用的前提。
3. 不提供文件下载、上传、删除、重命名等写操作；需要写文件请用资源管理器。
4. 最近文件按修改时间排序，是快照式索引，不是全文检索；`q` 只匹配文件名与路径。
5. 不进入隐藏目录、工程目录和符号链接/联接点，因此被隐藏或被链接进来的文件不会出现在列表里。
6. 打开文件依赖系统默认程序；服务器只发起打开动作，不检查文件内容。
7. 计划/笔记/手绘依赖浏览器 `localStorage`，不是数据库，也不跨设备同步。
8. OC 同步依赖学校开放的 Canvas 个人访问令牌；不保存密码，不支持无令牌登录。
9. 自动启动是 Windows 当前用户的登录快捷方式，不是系统服务；换用户/换电脑需重新设置。

## 10. 本机验证

~~~bash
cd xiaot310-site
python workbench/server.py --no-open --port 8799 &
sleep 1
curl -s http://127.0.0.1:8799/api/status
curl -s "http://127.0.0.1:8799/api/files?limit=3"
curl -s http://127.0.0.1:8799/api/tools
curl -s -i http://127.0.0.1:8799/go/latex | head -5
kill %1
~~~

检查文件列表 JSON 里不应出现 `个人文件 / 奖学金 / 身份证 / 学历 / 学位 / 宿舍 / 比赛`，
也不应出现 `.git`、`node_modules`、`__pycache__` 等目录。
