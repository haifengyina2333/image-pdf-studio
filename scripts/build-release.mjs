import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_DIR = resolve(ROOT, 'release');
const SINGLE_OUT = resolve(RELEASE_DIR, '图片PDF工作台-v2.0.2-离线单文件.html');
const WEB_DIR = resolve(RELEASE_DIR, 'web');
const WEB_ZIP = resolve(RELEASE_DIR, '图片PDF工作台-v2.0.2-Web部署包.zip');

const mode = process.argv[2] || 'all'; // 'all' | 'web' | 'single'

const run = (cmd, args) => {
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
};

const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

mkdirSync(RELEASE_DIR, { recursive: true });

if (mode === 'all' || mode === 'web') {
  console.log('\n[1/2] Building Web Deployable Edition (code-split + lazy chunks)...');
  run('npx', ['tsc', '--noEmit']);
  run('npx', ['vite', 'build']);

  // Add immutable cache headers for Cloudflare Pages / Netlify / Vercel static hosting
  const headersContent = `/assets/*
  Cache-Control: public, max-age=31536000, immutable

/mediapipe/*
  Cache-Control: public, max-age=2592000

/index.html
  Cache-Control: no-cache
`;
  writeFileSync(resolve(ROOT, 'dist', '_headers'), headersContent, 'utf8');

  rmSync(WEB_DIR, { recursive: true, force: true });
  cpSync(resolve(ROOT, 'dist'), WEB_DIR, { recursive: true });

  rmSync(WEB_ZIP, { force: true });
  execFileSync('zip', ['-r', '-q', WEB_ZIP, '.'], { cwd: WEB_DIR, stdio: 'inherit' });
  console.log(`✓ Web deployable directory: ${WEB_DIR}`);
  console.log(`✓ Web deployable ZIP:       ${WEB_ZIP} (${fmtMB(statSync(WEB_ZIP).size)})`);
}

if (mode === 'all' || mode === 'single') {
  console.log('\n[2/2] Building Offline Single-File HTML Edition (works directly on file://)...');
  run('npx', ['vite', 'build', '--config', 'vite.single.config.ts']);

  const cssPath = resolve(ROOT, 'dist-single', 'app.css');
  const jsPath = resolve(ROOT, 'dist-single', 'app.iife.js');
  if (!existsSync(cssPath) || !existsSync(jsPath)) {
    throw new Error('dist-single output missing app.css or app.iife.js');
  }

  const cssText = readFileSync(cssPath, 'utf8').replace(/<\/style>/gi, '<\\/style>');
  const jsText = readFileSync(jsPath, 'utf8').replace(/<\/script>/gi, '<\\/script>');

  const b64 = (absPath) => readFileSync(absPath).toString('base64');
  const assets = {
    pdfWorker: b64(resolve(ROOT, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')),
    mediapipeLoader: b64(resolve(ROOT, 'public/mediapipe/vision_wasm_internal.js')),
    mediapipeWasm: b64(resolve(ROOT, 'public/mediapipe/vision_wasm_internal.wasm')),
    faceDetectorModel: b64(resolve(ROOT, 'public/mediapipe/blaze_face_full_range.tflite')),
    faceLandmarkerModel: b64(resolve(ROOT, 'public/mediapipe/face_landmarker.task'))
  };

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="离线、本地处理的图片与 PDF 现代工作台（单文件完整离线版）" />
    <link
      rel="icon"
      type="image/svg+xml"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%233b82f6'/%3E%3Cstop offset='1' stop-color='%238b5cf6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='32' height='32' rx='8' fill='url(%23g)'/%3E%3Cpath d='M16 7l2.4 6.6L25 16l-6.6 2.4L16 25l-2.4-6.6L7 16l6.6-2.4z' fill='%23fff'/%3E%3C/svg%3E"
    />
    <title>图片 + PDF 本地工作台</title>
    <script>
      (function () {
        try {
          var t = localStorage.getItem('toolbox-v2-theme');
          document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light';
        } catch (e) {}
      })();
    </script>
    <style>${cssText}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__SINGLE_FILE_ASSETS__ = ${JSON.stringify(assets)};</script>
    <script>${jsText}</script>
  </body>
</html>
`;

  writeFileSync(SINGLE_OUT, html, 'utf8');
  rmSync(resolve(ROOT, 'dist-single'), { recursive: true, force: true });
  console.log(`✓ Offline Single-File HTML: ${SINGLE_OUT} (${fmtMB(statSync(SINGLE_OUT).size)})`);
}
