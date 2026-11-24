# 内容维护指南（给 AI 与人）

这个站点的公开内容集中在两个数据文件里。**新增一张研究/项目卡，优先改数据，不要复制 HTML。**

## 1. 文件分工

| 文件 | 用途 | 公开？ |
| --- | --- | --- |
| `site.config.js` | 姓名、品牌、GitHub、站点描述 | 是 |
| `content/site-content.js` | 首页：焦点、研究、项目、时间线 | 是 |
| `content/plan.js` | 工作台计划种子 | 是（不含私密内容） |
| `workbench/private.json` | 本地路径、LaTeX 私链、排除目录 | **否，永远不提交** |
| `assets/js/home.js` | 把数据渲染成卡片 | 是 |
| `workbench/workbench.js` | 本地工作台交互 | 是 |

## 2. 首页数据总览

```js
window.SITE_CONTENT = {
  profile: { name, nameEn, role, field, summary, interests, github, location },
  focus: [ ... ],      // 首页「当前在做」三张卡
  research: [ ... ],   // 首页「研究方向」三张卡
  projects: [ ... ],   // 首页「项目与演示」四张卡
  timeline: [ ... ]    // 关于区的小时间线
};
```

所有字段都是普通字符串/数组，不需要构建。

## 3. 新增一条研究

在 `research` 数组里加一个对象：

```js
{
  id: "p04",
  index: "04",
  title: "冰区船舶运动规划",
  en: "Motion planning for ships in ice",
  stage: "前期调研",
  status: "research",
  summary: "一句话说明问题、方法和当前阶段；不要写未经验证的结论。",
  tags: ["Ice", "Planning", "Motion"],
  detail: "工作区：论文/4.xxx"
}
```

字段规则：

- `id`：唯一，小写字母/数字/连字符，用于未来详情页锚点。
- `index`：展示编号，两位字符串，如 `"04"`。
- `status`：`"review"`（审稿/已投稿）、`"active"`（进行中）、`"research"`（调研）。只影响颜色和文案，不要夸大状态。
- `stage`：给人看的阶段，如“已投稿 · 审稿准备”“前期调研”。
- `summary`：2–3 句，公开可读；不要放未发表数据、审稿意见或合作方敏感信息。
- `tags`：3–5 个，短标签。
- `detail`：工作区相对路径提示；不要写绝对路径。

首页只显示前 3 条；更多条目会自然进入数组，但当前布局是三列，建议保持 3 条或同步改布局。

## 4. 新增一个项目

```js
{
  id: "my-project",
  index: "05",
  title: "项目名",
  en: "Project name",
  summary: "公开摘要。",
  tags: ["标签 1", "标签 2"],
  badge: "LIVE",              // LIVE / LOCAL / WORKSPACE
  href: "lab/xxx/index.html", // 或 workbench/index.html#files
  action: "打开演示"
}
```

- `badge: "LIVE"`：可公开访问的演示，链接到 `lab/...`。
- `badge: "LOCAL"`：私有/本地内容，链接到 `workbench/index.html#files`。
- `badge: "WORKSPACE"`：整理中的工作区。
- 外部链接也可以，但不要放带 token 的 URL。

## 5. 新增当前焦点

`focus` 是首页 hero 下方的三张卡，字段：

```js
{
  code: "P04",
  title: "…",
  stage: "进行中",
  status: "active",
  note: "1–2 句，说明下一步。",
  tags: ["…"]
}
```

## 6. 时间线

```js
{ when: "2026.12", title: "论文 02 开题", note: "状态以实际为准" }
```

只写确定发生或已计划的事；不确定就写“计划/准备”。

## 7. 工作台计划种子

`content/plan.js` 的 `tasks` 会作为浏览器 localStorage 的初始值。
任务字段：

```js
{
  id: "t-xxx",
  title: "任务标题",
  project: "论文 01",
  due: "2026-12-05",   // 可空
  priority: "high",     // high / mid / low
  status: "now",        // now / next / later / done
  note: "可选备注"
}
```

注意：用户浏览器里已有 localStorage 时，改种子不会覆盖现有计划；要生效需在
工作台点“重置种子”（会覆盖当前计划，先导出备份）。

## 8. 公开/私有规则（硬约束）

1. 不把 `个人文件`、`奖学金`、`身份证`、`学历`、`学位`、
   成绩单、宿舍、比赛报名材料放进 `content/`。
2. 不把 LaTeX token、内网地址、审稿意见、未发表数据写进公开 HTML/JS。
3. 不虚构论文录用、影响因子、合作单位、奖项或引用数。
4. 图片如涉及他人/合作方，先确认授权。
5. 公开页面只放“愿意让任何人看到”的内容；不确定就放工作台本地。

## 9. 渲染与验证

渲染入口：`assets/js/home.js`。它读取 `window.SITE_CONTENT`，
用 `textContent`/转义写卡片，所以内容里的 `<`、`>` 不会变成 HTML。

改完后：

```bash
cd xiaot310-site
python -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

检查：

- 首页控制台无报错；三张 focus / research / project 卡都出现。
- 移动端 390px 不横向溢出。
- 新内容没有私密信息。
- 工作台仍能启动：`python workbench/server.py --no-open`，
  打开 `/api/status` 为 `ok`。
- 若改了字段名，同步改 `home.js` 和本文档。

## 10. 加图片（可选扩展）

当前卡片没有图片字段。需要时：

1. 把图片放 `assets/img/projects/`（压缩到 200 KB 内，优先 WebP/JPG）。
2. 在数据里加 `image: "assets/img/projects/xxx.jpg"`。
3. 在 `home.js` 的卡片模板里加 `<img loading="lazy" ...>`，并补 CSS。
4. 不要用外链图床；不要放含个人信息的原图。

## 11. 交付时说什么

说明：改了哪个数组、新增了什么、验证了哪些页面、哪些内容是本地私有。
不要只说“已完成”。
