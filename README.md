# 李启榛 · UI/UX 作品集

> 广州 UI 设计师 / 交互体验设计师。6 年 B 端数据平台、教育云与无障碍产品设计经验，做过官网改版、设计系统、微信小程序与适老化界面。

**在线作品集：https://uilee01.github.io/**

## 可承接的服务

- B 端后台与数据平台界面设计：官网改版、可视化看板、设计系统搭建
- 微信小程序与移动端界面设计：政务、教育、公益类为主
- 无障碍与适老化设计：信息无障碍规范、听障人群交互
- 交互原型、设计稿与交付规范：Figma 为主，支持远程协作

**可承接 UI/UX 设计外包与兼职合作**，广州本地或远程。

## 关键词

UI设计师 · 交互体验设计师 · 广州UI设计师 · UI设计师兼职 · 兼职UI设计师 · UI设计师接单 · UI设计外包 · 远程UI设计 · B端UI设计 · 数据平台UI设计 · 教育云平台设计 · 微信小程序UI设计 · 设计系统搭建 · 无障碍设计 · 适老化设计 · Figma · 交互原型设计 · 作品集

## 案例

每个案例都有独立可抓取页面（含背景、问题、方案与规范落地）：

- [领克数云 · 全平台](https://uilee01.github.io/work/lksy-education-cloud.html) — 教育云平台 UI 与小程序设计
- [小沃无障碍通话助手](https://uilee01.github.io/work/a11y-call-assistant.html) — 无障碍与适老化设计，成果获联合国 ITU-D 国际电联报告收录
- [畅听助手 APP](https://uilee01.github.io/work/xiaowo-a11y-call.html) — 听障人群交互设计
- [KEKE · IP 设计](https://uilee01.github.io/work/keke-ip-design.html) — 企业品牌 IP 与 AIGC 角色
- [Appleland Web](https://uilee01.github.io/work/appleland.html) — Web3 产品与设计令牌体系
- [Umeta 2.1](https://uilee01.github.io/work/umeta.html) — 游戏向产品与资产流程设计
- [智屏](https://uilee01.github.io/work/zhiping.html) — 政务大屏可视化驾驶舱与适老化柜台平板端
- [模友圈](https://uilee01.github.io/work/moyouquan.html) — 垂直社区与硬件配套 App
- [企业官网设计](https://uilee01.github.io/work/corporate-website-design.html) — ANSIN 国际短信服务官网与亿语智能官网改版

## 联系

- 邮箱：965333099@qq.com
- 微信与手机同号：18666099550（微信 liqz010）

---

## 目录结构

| 文件 | 作用 | 备注 |
|---|---|---|
| `index.html` | 页面入口 | 含 noscript 静态正文（给不执行 JS 的爬虫读） |
| `copy.js` | 页面实际加载的文案 | **不要手改**，由 `copy.json` 生成 |
| `copy.json` | 全部文案与图片配置的源数据 | 文档用，方便以后改文案 |
| `seo.js` | 运行时 SEO 配置（中英 title / description） | 切换语言时由 bundle 读取 |
| `copy-images.js` / `copy-gallery.js` / `copy-masonry.js` / `copy-hide.js` | 图片/图集/瀑布流/字段屏蔽的运行时注入 | 不需要手改 |
| `back-to-top.js` / `glass-header.js` | 返回顶部、上滚抽屉式玻璃顶栏 | 不需要手改 |
| `work/*.html` | 案例独立页（9 个案例 × 中英，共 18 页） | 由生成器产出，勿手改 |
| `assets/work.css` | 案例页样式 | 与主站同一套深色基调 |
| `assets/index--caIWMcs.js` | React 打包代码 | 不要手改 |
| `assets/index-fjwNFumN.css` | 主站样式表 | 调样式改这里 |
| `assets/img/*.webp` | 作品图片与 OG 图 | 相对引用，已核对无坏图 |
| `assets/favicon.svg` / `assets/icon-192.png` / `assets/icon-512.png` | 图标 | 配套 `manifest.webmanifest` |
| `og-cover.webp`（在 `assets/img/`） | 1200×630 社交分享图 | 微信 / 微博 / X 分享用 |
| `robots.txt` / `sitemap.xml` | 抓取策略与站点地图 | sitemap 含全部 19 个 URL |
| `404.html` | 404 兜底页 | GitHub Pages 自动使用 |
| `.nojekyll` | 关闭 GitHub Pages 的 Jekyll 处理 | 确保文件原样发布、不丢文件 |

## 部署到 GitHub Pages（分步）

1. 在 GitHub 新建一个**公开（Public）**仓库，名字任意（建议 `portfolio`）。
2. 把本目录下的**全部内容**（注意是内容，不是目录本身）推送到仓库的 `main` 分支根目录：
   ```bash
   git init
   git add .
   git commit -m "deploy portfolio"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
3. 进入仓库 **Settings → Pages → Build and deployment**：
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，目录选 **/ (root)**
   - 点 Save
4. 等待约 1 分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。

> 想要更干净的地址 `https://<你的用户名>.github.io/`（无子路径）？把仓库直接命名为 `<你的用户名>.github.io`，其余步骤一样。

## 注意事项

- **主站是 SPA，正文靠 React 渲染**：所以额外提供了 `noscript` 静态正文和 `work/` 案例独立页——搜索引擎要能读到文字，案例页是长尾词的落点。
- **相对路径 + 锚点滚动定位（无浏览器路由）**：主站资源都用 `./assets/...` 相对路径，不使用 `history.pushState`，部署到子路径也不会出错；`404.html` 仅作兜底。
- **飞书简历链接已对外公开**：页面「下载简历」按钮指向 `https://my.feishu.cn/drive/folder/MmbXfEoBilOubPd56kdcF1nWnBg`，部署后任何人都能访问，请确认无误。
- **图片已全部为 WebP**，引用已同步，不存在 PNG 残留。
- **改文案流程**：改文案请用本地编辑器（`copy-editor.html` + `server.js`，**不在本部署包内**），改完重新生成 `copy.js` 后，把新的 `copy.js` 连同 `copy.json` 一起推上来。只推 `copy.json` 不生效，页面读的是 `copy.js`。
- **自定义域名**：GitHub Pages 支持绑定你自己的域名（Settings → Pages → Custom domain），HTTPS 证书由 GitHub 自动签发。域名对「搜名字」的权重提升明显。

## 本地预览

本目录是纯静态，双击 `index.html` 即可打开（已去掉 `type=module`，`file://` 下不会白屏）；或用任意静态服务器预览，例如：

```bash
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```
