# 李启榛 · 个人作品集（静态站点部署包）

本目录是**可直接部署到 GitHub Pages 的纯静态站点**，供他人浏览你的作品集。已剔除所有本地编辑器和历史备份文件，仅保留运行时所需内容。

## 目录结构

| 文件 | 作用 | 备注 |
|---|---|---|
| `index.html` | 页面入口 | 已修正 meta description，已移除 Kimi 注入脚本 |
| `copy.js` | 页面实际加载的文案 | **不要手改**，由 `copy.json` 生成 |
| `copy-images.js` / `copy-gallery.js` / `copy-masonry.js` / `copy-hide.js` | 图片/图集/瀑布流/字段屏蔽的运行时注入 | 不需要手改 |
| `copy.json` | 全部文案与图片配置的源数据 | 文档用，方便以后改文案 |
| `assets/index--caIWMcs.js` | React 打包代码 | 不要手改 |
| `assets/index-fjwNFumN.css` | 样式表 | 调样式改这里 |
| `assets/img/*.webp`（含 2 张 `.png`） | 作品图片，共 63 张 | 相对引用，已核对无坏图 |
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

- **相对路径 + 锚点滚动定位（无浏览器路由）**：站点所有资源都用 `./assets/...` 相对路径，且没有使用 `history.pushState` 之类的路由，因此部署到子路径也不出错，**也不需要 `404.html` 兜底**。
- **飞书简历链接已对外公开**：页面「下载简历」按钮指向 `https://my.feishu.cn/drive/folder/MmbXfEoBilOubPd56kdcF1nWnBg`，部署后任何人都能访问，请确认无误。
- **图片已全部为 WebP**：原 2 张 PNG（`Wireframe_10` / `Wireframe_12`）已转为 WebP（q=88，共约 -82% 体积），引用已同步，不存在 PNG 残留。
- **改文案流程**：改文案请用本地编辑器（`copy-editor.html` + `server.js`，**不在本部署包内**），改完重新生成 `copy.js` 后，把新的 `copy.js` 连同 `copy.json` 一起推上来。只推 `copy.json` 不生效，页面读的是 `copy.js`。
- **自定义域名**：GitHub Pages 支持绑定你自己的域名（Settings → Pages → Custom domain），HTTPS 证书由 GitHub 自动签发。

## 本地预览

本目录是纯静态，双击 `index.html` 即可打开（已去掉 `type=module`，`file://` 下不会白屏）；或用任意静态服务器预览，例如：

```bash
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```
