# 图片 + PDF 本地工作台（v2.0 Studio）

> **纯本地、零上传、离线可用的现代图片与 PDF 桌面级工作台**  
> 前端 **Gemini Neon** + 后端 **GPT6.2Sol**

所有图像处理、AI 人脸检测、HEIC 解码与 PDF 压缩/合并/整理均在浏览器本地内存中完成，**原文件永不上传服务器、不覆盖源文件**。

---

## 核心功能（全 16 工具）

### 图片工作台（9 工具，全工具共享图片队列与拖拽排序）
1. **图片加水印**：文字 / Logo 双模式、快捷办公模板、铺满与单水印九宫格/画布直接拖拽定位、字体/字重/偏移微调、**本地 IndexedDB 预设库**（保存/应用/删除/JSON 备份导入导出）。
2. **人脸打码（本地 AI）**：按需加载 MediaPipe `BlazeFace` + `FaceLandmarker`（52 维表情识别），支持合照精细/标准快速模式、画布直接框选/移动/缩放；提供 **马赛克 / 高斯模糊 / 纯色 / 表情贴纸**（内置 8 款表情联动矢量可爱贴纸 + 20 个 Emoji + 自定义贴纸图片）。
3. **图片压缩**：高清（`4096px · 90%`）/ 均衡（`2560px · 82%`）/ 强力（`1920px · 70%`）/ 自定义最长边，支持批量导出或打包 ZIP。
4. **调整尺寸**：按宽度、按高度、按百分比缩放、自定义宽高范围（可选保持原比例）。
5. **旋转与翻转**：左转 / 右转 90°、水平 / 垂直镜像翻转。
6. **图片裁剪**：自由比例及常用预设（`1:1 / 3:4 / 4:3 / 2:3 / 3:2 / 9:16 / 16:9`），画布内拖动定位与**四角手柄等比缩放**。
7. **拼接图片**：纵向 / 横向 / 网格拼图、**画布内直接拖动图片交换位置**、自定义每行张数（如 `5+6`）、原图尺寸模式、标题与多行说明文字，支持 **`.zip` 拼图工程存档与重新打开续编**。
8. **图片切割**：自动识别拼图分隔线并实时预览带编号网格，支持九宫格/自定义行列/每行张数切图，可一键 **打包 ZIP 导出** 或 **拆散进队列重新拼图**。
9. **格式转换**：PNG / JPG / WebP 互转（支持透明转 JPG 背景色填充）与批量 ZIP 打包。

### PDF 工作台（7 工具，后台任务独立运行、切页不中断）
1. **压缩 PDF**：无损对象流整理 或 图像强力压缩（轻度 180 DPI / 标准 144 DPI / 强力 110 DPI），变大时自动保留原文件。
2. **页面整理**：自动渲染全部页面缩略图网格，支持拖拽排序、单页左/右旋转 90°、删页与恢复，无损保留矢量文字导出。
3. **合并 PDF**：多份文档排序合并，完整保留原页面尺寸与矢量文字。
4. **拆分提取**：每页拆一份或按自定义范围（如 `1-3；4-6；8,10`）拆分为多份 PDF 并打包 ZIP。
5. **PDF 水印**：支持铺满与单个九宫格水印、自定义页码范围、**画布实时同步预览**与按住「对比原页」。
6. **图片转 PDF**：支持 JPG / PNG / WebP / HEIC 自动解码，可选 A4 / A3 / 原图尺寸、页边距与画质。
7. **PDF 转图片**：支持自定义页码范围、JPG / PNG 格式与 `96–300 DPI` 清晰度导出。

---

## 体验与架构亮点

- **技术栈**：React 19 + TypeScript + Zustand v5 + Tailwind CSS v4 + Motion + Lucide React + Vite 6。
- **按需懒加载**：Web 部署版首屏仅加载轻量核心包，`pdfjs-dist`、`pdf-lib`、`heic2any`、`@mediapipe/tasks-vision` 及 WASM/AI 模型均在点击对应功能时才按需加载。
- **后台任务解耦**：任务调度器与 UI 视图彻底解耦，PDF 压缩/批量导出过程中切去「设置」或其他页面不会中断任务，随时可取消或重新下载。
- **双主题与快捷键**：浅色 / 深色 Studio 主题（1.05s 柔和慢溶切换）、`⌘V` 粘贴截图、`⌘S` 导出、`⌘⇧C` 复制到剪贴板（设置页支持 PNG / JPG 优先及最长边上限调节）、`←/→` 切图、`空格 + 拖拽` 移动画布、`0` 复位缩放。

---

## 本地开发与构建

```bash
# 安装依赖
npm install

# 本地开发预览
npm run dev

# 1. 构建可部署的 Web 静态版（输出 dist/ 与 release/图片PDF工作台-v2.0-Web部署包.zip）
npm run build:web

# 2. 构建双击即用的离线单文件 HTML（输出 release/图片PDF工作台-v2.0-离线单文件.html）
npm run build:single

# 一键同时产出 Web 部署包 + 离线单文件 HTML
npm run build:release
```

---

## 部署指南（Web 版）

运行 `npm run build:web` 后，将 `dist/` 目录（或 `release/图片PDF工作台-v2.0-Web部署包.zip` 解压后的全部文件）直接部署到任意静态托管平台即可：

- **Cloudflare Pages / Netlify**：直接拖入 `dist/` 文件夹即可上线，已内置 `_headers` 自动启用 `/assets/*` 永久强缓存。
- **Vercel / GitHub Pages / Nginx**：构建命令填 `npm run build`，输出目录填 `dist`，零后端依赖。
- **离线分发**：直接发送 `图片PDF工作台-v2.0-离线单文件.html`，双击即可在 Chrome / Edge / Safari 离线运行全部 16 个工具（含本地 AI 人脸打码与 PDF 引擎）。

---

## 未来功能规划（Roadmap · v2.1+）

- [ ] **PDF 电子签名 / 盖红章**：支持手写画板签名或上传透明公章/私章，直接在 PDF 预览页上拖拽到落款位置并自由缩放导出（复用现有 `pdf-lib`，零新增依赖，适合报销单与合同签字）。
- [ ] **证件正反面合成 A4（顺手加水印）**：将身份证、营业执照等正反面两张图一键按真实比例居中排入标准 A4 纸，支持直接叠加「仅供办理＿＿使用，他用无效」水印并导出 PDF 打印。
- [ ] **工程化演进（按需）**：将 `ImageWorkspace.tsx` 拆分为可插拔的工具注册表模块，并把无头 Chrome 端到端回归脚本接入 CI。

---

## 开发与重构踩坑复盘（Pitfalls & Notes）

记录从 v0.30.0 原生单文件迁移到 React 19 Studio v2.0 过程中实际踩过并彻底解决的关键问题，避免后续二次踩坑：

1. **Zustand v5 + React 19 无限渲染白屏**
   - 现象：在 `useStore((s) => s.tasks.filter(...))` 里直接返回新数组会触发 `useSyncExternalStore` 无限重渲染。
   - 规范：selector 永远只取原始引用或基础类型，过滤与派生计算放在组件体内或 `useMemo` 中完成。
2. **底层引擎接口签名与量纲差异**
   - `CompressionModel.profiles` 的质量是百分制（`90 / 82 / 70`），而 `canvas.toBlob` 要求 `0–1`（传入大于 1 会被浏览器静默回退为 `0.92`，导致压缩失效）。
   - `PageRange.parseSplitGroups()` 返回的是 `{ label, pages }[]` 对象数组，而非 `number[][]`。
   - `ImageStitcher.layoutFor()` 返回的槽位图片挂载在 `slot.image` 下；`ImageDecoder` 需完整走 `ResourceScope → normalizeFile → decodeBitmap → createPreview` 生命周期。
3. **PDF 预览比例被压扁**
   - `pdf-runtime.js` 的 `renderPage()` 会给 `<canvas>` 写入固定内联 `style.width / height`，与外层自适应容器冲突。渲染完成后需清空内联宽高，由 CSS `w-auto h-auto max-w-full object-contain` 严格锁定原比例。
4. **浏览器剪贴板写入 JPG 限制 & `Number(null)` 陷阱**
   - 实测 Chrome / Edge / Safari 中 `ClipboardItem.supports('image/jpeg')` 为 `false`，裸写 `image/jpeg` 会直接抛错。因此在「JPG 优先」模式下采用混合写入：支持原生 JPG 时直写，否则以轻量 JPG 写入 `text/html`（供 Word/邮件/文档使用）并附带兼容 `image/png`（保证微信/QQ 粘贴不失败）。
   - 读取 `localStorage` 时 `Number(null) === 0`，若 `0` 也是合法选项（如“原始尺寸不缩放”），必须先显式判断 `saved === null` 再做数值转换。
5. **受控数字输入框无法清空重输**
   - 直接在 `onChange` 中用 `Math.max(min, Number(val) || fallback)` 强钳制会导致清空第一位数字时立刻回弹。改为草稿缓冲组件 `NumericInput`，允许自由删除与键入，在 `onBlur` / `Enter` 时统一校验提交。
6. **布局、Hover 与离线单文件打包细节**
   - Flex 子元素 `flex-1` 若缺少 `min-w-0`，超长按钮文案（如 `4800×3200`）会直接撑破右侧面板边界。
   - Tailwind v4 默认移除了 `<button>` 的 `cursor: pointer`，且行内 `style` 优先级高于 Hover 工具类；交互控件需通过语义 CSS 类 + CSS 变量统一管理浅/深色 Hover。
   - `file://` 离线单文件版不可使用外链 ES Module 或相对 `fetch()`：需通过 `vite.single.config.ts` 打成经典 IIFE 脚本，并将 `pdf.worker` 与 MediaPipe WASM / `.tflite` / `.task` 模型以 Base64 内嵌，运行时按需解码为 Blob URL / `Uint8Array` 后立即释放原始字符串。

