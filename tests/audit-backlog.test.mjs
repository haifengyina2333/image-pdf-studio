import assert from 'node:assert/strict';
import test from 'node:test';
import * as pdfLib from 'pdf-lib';

globalThis.window = { ToolboxPDFLib: pdfLib };
await import('../src/engine/pdf/page-range.js');
await import('../src/engine/pdf/pdf-processor.js');
await import('../src/engine/image/image-splitter.js');
await import('../src/engine/storage/watermark-store.js');
const { PageRange, PDFProcessor, ImageSplitter, WatermarkStore } = window.Toolbox;

test('PDF 页码兼容全角数字、空格和中文分隔符，保留输入次序', () => {
  assert.deepEqual(PageRange.parsePageSelection('５，１ － ３、２  ６', 6), [5, 1, 2, 3, 6]);
  assert.deepEqual(PageRange.parseSplitGroups('３ 至 ４；１ - ２\n５', 5).map(group => group.pages), [[3, 4], [1, 2], [5]]);
  assert.throws(() => PageRange.parsePageSelection('３ - １', 3), /起始页不能大于结束页/);
  assert.throws(() => PageRange.parsePageSelection('１ - ４', 3), /1-3/);
});

test('拆分输出保留整理顺序和旋转，不复活被删页', async () => {
  const source = await pdfLib.PDFDocument.create();
  for (const width of [200, 240, 280]) source.addPage([width, 300]);
  const file = new File([await source.save()], 'marked.pdf', { type: 'application/pdf' });
  const plan = [{ sourcePage: 3, rotation: 90 }, { sourcePage: 1, rotation: 0 }];
  const split = await PDFProcessor.createPDFParts(file, [plan, [plan[1]]]);
  const parts = await Promise.all(split.parts.map(async ({ blob }) => pdfLib.PDFDocument.load(await blob.arrayBuffer())));
  assert.deepEqual(parts.map(part => part.getPages().map(page => [page.getWidth(), page.getRotation().angle])),
    [[[280, 90], [200, 0]], [[200, 0]]]);
});

test('PDF 转图片传递源页和旋转，文件名所用页码独立于源页', async () => {
  const calls = [];
  const session = {
    file: new File([], 'marked.pdf'), numPages: 3,
    async getPageInfo(page, _signal, rotation) {
      calls.push(['size', page, rotation]);
      return { width: 300, height: 280 };
    },
    async renderPage(page, _canvas, { extraRotation }) {
      calls.push(['render', page, extraRotation]);
      return { renderedWidth: 600, renderedHeight: 560 };
    }
  };
  const result = await PDFProcessor.pdfToImages(session, [
    { sourcePage: 3, rotation: 90, outputPage: 1 }, { sourcePage: 1, rotation: 0, outputPage: 2 }
  ], { type: 'image/png' }, { canvasFactory: () => ({ toBlob: cb => cb(new Blob(['test fixture'])) }) });
  assert.deepEqual(calls, [['size', 3, 90], ['render', 3, 90], ['size', 1, 0], ['render', 1, 0]]);
  assert.deepEqual(result.images.map(({ pageNumber, outputPage }) => [pageNumber, outputPage]), [[3, 1], [1, 2]]);
});

test('2002 像素宽的拼图缩小分析后三块相邻，不漏掉中间列', async () => {
  const calls = [];
  window.Toolbox.ImageDecoder = { assertNotAborted() {}, normalizeFile: async file => file };
  globalThis.createImageBitmap = async () => ({ width: 2002, height: 19 });
  globalThis.document = { createElement() {
    const canvas = {
      getContext: () => ({
        drawImage: (...args) => { if (args.length === 9) calls.push(args.slice(1, 5)); },
        getImageData: (_x, _y, width, height) => ({
          width, height, data: Uint8ClampedArray.from({ length: width * height * 4 }, (_, i) => {
            if (i % 4 === 3) return 255;
            const point = Math.floor(i / 4);
            return ((point % width) * 37 + Math.floor(point / width) * 67) % 233;
          })
        })
      }),
      toBlob: cb => cb(new Blob(['fixture'], { type: 'image/png' }))
    };
    return canvas;
  }};
  const scope = { trackBitmap: x => x, trackCanvas: x => x };
  const split = await ImageSplitter.splitFile({ file: new File([], 'stitch.png'), rows: 1, columns: 3, scope });
  assert.equal(split.files.length, 3);
  assert.deepEqual(calls, [[0, 0, 667, 19], [667, 0, 668, 19], [1335, 0, 667, 19]]);
});

test('水印预设保留滑块最低 40% 画质，也会限制更低的无效值', () => {
  for (const [quality, expected] of [[40, 40], [47, 47], [20, 40], [150, 100]]) {
    const preset = WatermarkStore.normalizeSnapshot({
      watermark: { kind: 'text', position: { xRatio: .5, yRatio: .5 } }, output: { quality }
    });
    assert.equal(preset.output.quality, expected);
  }
});
