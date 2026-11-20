import assert from 'node:assert/strict';
import test from 'node:test';
import * as pdfLib from 'pdf-lib';

globalThis.window = { ToolboxPDFLib: pdfLib };
await import('../src/engine/image/compression-model.js');
await import('../src/engine/image/image-processor.js');
await import('../src/engine/image/image-compressor.js');
await import('../src/engine/image/face-expression.js');
await import('../src/engine/image/face-detector.js');
await import('../src/engine/image/face-redactor.js');
await import('../src/engine/image/portrait-segmenter.js');
await import('../src/engine/pdf/pdf-processor.js');
await import('../src/engine/pdf/pdf-compare.js');

const {
  ImageProcessor,
  ImageCompressor,
  FaceDetector,
  FaceRedactor,
  PortraitSegmenter,
  PDFProcessor,
  PDFCompare
} = window.Toolbox;

// Valid 1x1 transparent PNG bytes for pdf-lib embedPng tests
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const makeMockCanvasFactory = (pixelMap) => () => {
  const canvas = {
    width: 1,
    height: 1,
    _ops: [],
    _pixels: null,
    getContext() {
      return {
        canvas,
        save() {},
        restore() {},
        clearRect() {},
        fillRect(x, y, w, h) {
          canvas._ops.push(['fillRect', x, y, w, h, this.fillStyle]);
        },
        strokeRect(x, y, w, h) {
          canvas._ops.push(['strokeRect', x, y, w, h, this.strokeStyle, this.lineWidth]);
        },
        beginPath() {},
        closePath() {},
        rect() {},
        roundRect(x, y, w, h) {
          canvas._ops.push(['roundRect', x, y, w, h]);
        },
        moveTo(x, y) {
          canvas._ops.push(['moveTo', x, y]);
        },
        lineTo(x, y) {
          canvas._ops.push(['lineTo', x, y]);
        },
        stroke() {
          canvas._ops.push(['stroke', this.strokeStyle, this.lineWidth]);
        },
        fill() {
          canvas._ops.push(['fill', this.fillStyle]);
        },
        clip() {},
        drawImage(...args) {
          canvas._ops.push(['drawImage', ...args.slice(1)]);
          if (args[0]?._pixels) canvas._pixels = new Uint8ClampedArray(args[0]._pixels);
        },
        measureText(str) {
          return { width: String(str).length * 14 };
        },
        fillText(text, x, y) {
          canvas._ops.push(['fillText', text, x, y]);
        },
        createImageData(w, h) {
          return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
        },
        getImageData(x, y, w, h) {
          if (canvas._pixels) return { width: w, height: h, data: canvas._pixels };
          const data = new Uint8ClampedArray(w * h * 4);
          data.fill(255);
          return { width: w, height: h, data };
        },
        putImageData(imgData) {
          canvas._pixels = new Uint8ClampedArray(imgData.data);
        }
      };
    },
    toBlob(cb, type = 'image/png', quality = 0.9) {
      if (typeof pixelMap === 'function') return cb(pixelMap(canvas, type, quality));
      cb(new Blob([TINY_PNG], { type: 'image/png' }));
    }
  };
  return canvas;
};

test('审计修复（推断-5）：非正方形照片表情取样保持像素正方形不拉伸', () => {
  const crop = FaceDetector.squareCropForFace({ x: 0.45, y: 0.4, width: 0.1, height: 0.16 }, { width: 1600, height: 900 });
  assert.ok(crop.pixel);
  assert.equal(Math.round(crop.pixel.side), Math.round(160 * 2.25));
  assert.equal(crop.pixel.sw, crop.pixel.sh);
});

test('审计修复（推断-4）：Safari WebP 降级输出 PNG 时扩展名自动对齐为 png', async () => {
  window.Toolbox.ImageDecoder = { assertNotAborted() {} };
  globalThis.createImageBitmap = async () => ({ width: 200, height: 100 });
  globalThis.document = {
    createElement: makeMockCanvasFactory(() => new Blob([TINY_PNG], { type: 'image/png' }))
  };
  const scope = { trackBitmap: (x) => x, trackCanvas: (x) => x };
  const res = await ImageProcessor.processImage({
    file: new File([TINY_PNG], 'sample.png', { type: 'image/png' }),
    type: 'image/webp',
    quality: 0.85,
    outputSize: { width: 200, height: 100 },
    scope,
    draw: () => {}
  });
  assert.equal(res.outputType, 'image/png');
  assert.equal(res.extension, 'png');
});

test('图片按目标体积压缩：二分搜索在指定 KB 上限内选出最高画质与尺寸', async () => {
  window.Toolbox.ImageDecoder = { assertNotAborted() {} };
  globalThis.createImageBitmap = async () => ({ width: 2000, height: 1000 });
  globalThis.document = {
    createElement: makeMockCanvasFactory((canvas, type, quality) => {
      // Simulate realistic JPEG byte size proportional to area * quality^1.4
      const bytes = Math.round(canvas.width * canvas.height * 0.22 * Math.pow(quality || 0.9, 1.4));
      return new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
    })
  };
  const scope = { trackBitmap: (x) => x, trackCanvas: (x) => x };
  const res = await ImageCompressor.compressToTargetBytes({
    file: new File([new Uint8Array(500_000)], 'photo.jpg', { type: 'image/jpeg' }),
    dimensions: { width: 2000, height: 1000 },
    targetBytes: 150 * 1024,
    options: { type: 'image/jpeg', maxEdge: 2000 },
    scope
  });
  assert.equal(res.metTarget, true);
  assert.ok(res.blob.size <= 150 * 1024);
  assert.ok(res.blob.size > 100 * 1024, 'should stay close to budget without over-crushing quality');
});

test('敏感信息打码与标注：支持横条打码、红框高亮与箭头标注', () => {
  const canvas = makeMockCanvasFactory()();
  const ctx = canvas.getContext('2d');
  FaceRedactor.drawRedactions(
    ctx,
    { width: 1200, height: 800 },
    1200,
    800,
    [
      { id: 'b1', kind: 'bar', x: 0.1, y: 0.2, width: 0.4, height: 0.06, barStyle: 'solid', color: '#111827', enabled: true },
      { id: 'h1', kind: 'highlight', x: 0.2, y: 0.4, width: 0.3, height: 0.15, strokeColor: '#ef4444', strokeWidth: 6, enabled: true },
      { id: 'a1', kind: 'arrow', x: 0.5, y: 0.5, width: 0.2, height: 0.1, x1: 0.5, y1: 0.5, x2: 0.7, y2: 0.6, strokeColor: '#2563eb', strokeWidth: 5, enabled: true }
    ],
    { style: 'solid', color: '#111827' }
  );
  assert.ok(canvas._ops.some((op) => op[0] === 'fillRect' && op[5] === '#111827'));
  assert.ok(canvas._ops.some((op) => op[0] === 'stroke' && op[1] === '#ef4444'));
  assert.ok(canvas._ops.some((op) => op[0] === 'fill' && op[1] === '#2563eb'));
});

test('AI 证件照预设尺寸与透明底自动切 PNG', async () => {
  assert.deepEqual(PortraitSegmenter.outputDimensionsFor({ width: 1000, height: 1200 }, '1inch').width, 295);
  assert.deepEqual(PortraitSegmenter.outputDimensionsFor({ width: 1000, height: 1200 }, '2inch').height, 579);
  window.Toolbox.ImageDecoder = { assertNotAborted() {} };
  globalThis.createImageBitmap = async () => ({ width: 800, height: 1000 });
  globalThis.document = {
    createElement: makeMockCanvasFactory((_c, type) => new Blob([TINY_PNG], { type }))
  };
  const scope = { trackBitmap: (x) => x, trackCanvas: (x) => x };
  const res = await PortraitSegmenter.exportIdPhoto({
    file: new File([TINY_PNG], 'selfie.jpg', { type: 'image/jpeg' }),
    maskData: { mask: new Float32Array(16).fill(1), width: 4, height: 4 },
    options: { bgColor: 'transparent', preset: '1inch', zoom: 1, offsetX: 0, offsetY: 0, feather: 0, threshold: 0.5 },
    type: 'image/jpeg',
    scope
  });
  assert.equal(res.width, 295);
  assert.equal(res.height, 413);
  assert.equal(res.outputType, 'image/png');
  assert.equal(res.extension, 'png');
});

test('PDF 一键转连续长图遵循整理页序并两阶段计算统一尺寸', async () => {
  const renderedPages = [];
  const session = {
    file: new File([], 'doc.pdf'),
    numPages: 3,
    async getPageInfo(page, _signal, rotation) {
      return rotation % 180 ? { width: 800, height: 600 } : { width: 600, height: 800 };
    },
    async renderPage(page, canvas, { maxWidth, maxHeight, extraRotation }) {
      renderedPages.push([page, extraRotation]);
      canvas.width = Math.round(maxWidth);
      canvas.height = Math.round(maxHeight);
      return { renderedWidth: canvas.width, renderedHeight: canvas.height };
    }
  };
  const res = await PDFProcessor.pdfToLongImage(
    session,
    [
      { sourcePage: 3, rotation: 90, outputPage: 1 },
      { sourcePage: 1, rotation: 0, outputPage: 2 }
    ],
    { type: 'image/jpeg', dpi: 72, gap: 10, divider: true },
    { canvasFactory: makeMockCanvasFactory((_c, type) => new Blob([new Uint8Array(2048)], { type })) }
  );
  assert.deepEqual(renderedPages, [[3, 90], [1, 0]]);
  assert.equal(res.pageCount, 2);
  assert.equal(res.width, 800);
  // Page 1 rotated: 800x600 -> height 600; Page 2 portrait 600x800 scaled to width 800 -> height 1067; + gap 10 = 1677
  assert.equal(res.height, 1677);
});

test('PDF 电子签名盖章与页码页眉页脚遵循整理方案并产出合法 PDF', async () => {
  const source = await pdfLib.PDFDocument.create();
  source.addPage([595, 842]);
  source.addPage([595, 842]);
  source.addPage([595, 842]);
  const srcFile = new File([await source.save()], 'contract.pdf', { type: 'application/pdf' });
  const plan = [{ sourcePage: 3, rotation: 0 }, { sourcePage: 1, rotation: 90 }];

  const signed = await PDFProcessor.signPDF(
    srcFile,
    plan,
    [{ stampId: 's1', stampBytes: TINY_PNG, page: 2, xRatio: 0.75, yRatio: 0.85, widthRatio: 0.2, rotation: 0, opacity: 1 }],
    { pdfLib }
  );
  assert.equal(signed.pageCount, 2);
  assert.equal(signed.placedCount, 1);
  const loadedSigned = await pdfLib.PDFDocument.load(await signed.blob.arrayBuffer());
  assert.equal(loadedSigned.getPageCount(), 2);
  assert.equal(loadedSigned.getPage(1).getRotation().angle, 90);

  assert.equal(PDFProcessor.formatPageNumberLabel(2, 10, 'zh-total'), '第 2 / 10 页');
  assert.equal(PDFProcessor.formatPageNumberLabel(2, 10, 'en'), 'Page 2 of 10');

  const numbered = await PDFProcessor.addHeaderFooterPDF(
    srcFile,
    plan,
    { pageNumberEnabled: true, format: 'zh-total', skipFirstPage: true, headerText: '合同审定稿', startNumber: 1 },
    { pdfLib, canvasFactory: makeMockCanvasFactory() }
  );
  assert.equal(numbered.pageCount, 2);
  assert.equal(numbered.appliedCount, 1);
  const loadedNumbered = await pdfLib.PDFDocument.load(await numbered.blob.arrayBuffer());
  assert.equal(loadedNumbered.getPageCount(), 2);
});

test('两份 PDF 视觉找不同：一致页返回无差异，变更页与多出页准确检出', async () => {
  const makeSolidCanvas = (r, g, b) => {
    const c = makeMockCanvasFactory()();
    c.width = 40;
    c.height = 40;
    const pixels = new Uint8ClampedArray(40 * 40 * 4);
    for (let i = 0; i < 40 * 40; i += 1) {
      pixels[i * 4] = r;
      pixels[i * 4 + 1] = g;
      pixels[i * 4 + 2] = b;
      pixels[i * 4 + 3] = 255;
    }
    c._pixels = pixels;
    return c;
  };
  const same = PDFCompare.comparePageCanvases(makeSolidCanvas(250, 250, 250), makeSolidCanvas(250, 250, 250), {
    canvasFactory: makeMockCanvasFactory()
  });
  assert.equal(same.hasDiff, false);
  assert.equal(same.diffPixels, 0);

  const changed = PDFCompare.comparePageCanvases(makeSolidCanvas(255, 255, 255), makeSolidCanvas(20, 20, 20), {
    canvasFactory: makeMockCanvasFactory()
  });
  assert.equal(changed.hasDiff, true);
  assert.equal(changed.diffPixels, 1600);
});
