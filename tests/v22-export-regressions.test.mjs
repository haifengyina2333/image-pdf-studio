import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import * as pdfLib from 'pdf-lib';

globalThis.window = { ToolboxPDFLib: pdfLib, addEventListener() {} };
const notices = [];
globalThis.document = { body: { append() {} }, createElement: () => ({ click() {}, remove() {} }) };
const setTimeoutOriginal = globalThis.setTimeout;
globalThis.setTimeout = (fn, delay, ...args) => {
  const timer = setTimeoutOriginal(fn, delay, ...args);
  if (delay === 60_000) timer.unref();
  return timer;
};
const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, watch: null, ws: false } });
after(async () => {
  await server.close();
  globalThis.setTimeout = setTimeoutOriginal;
});
const { usePdfStore: pdf, selectCompareResults } = await server.ssrLoadModule('/src/stores/usePdfStore.ts');
const { useImageStore: image } = await server.ssrLoadModule('/src/stores/useImageStore.ts');
const { useTaskStore: task } = await server.ssrLoadModule('/src/stores/useTaskStore.ts');
const { useAppStore: app } = await server.ssrLoadModule('/src/stores/useAppStore.ts');
const engine = window.Toolbox;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const bitmapBlob = new Blob([png], { type: 'image/png' });
const plan = (...pages) => pages.map(sourcePage => ({ uid: String(sourcePage), sourcePage, rotation: 0 }));
const latest = () => task.getState().tasks[0];

beforeEach(() => {
  for (const store of [pdf, image, task]) store.setState(store.getInitialState(), true);
  notices.length = 0;
  app.setState({ notify: (message, tone) => notices.push({ message, tone }) });
});

const newSession = async (id) => {
  const doc = await pdfLib.PDFDocument.create();
  doc.addPage([200, 200]);
  doc.addPage([220, 200]);
  return { id, numPages: 2, file: new File([await doc.save()], id + '.pdf', { type: 'application/pdf' }) };
};

test('签章不跨文档，整理后的签章跟随原页，原页删除后不可导出该印章', async () => {
  const a = await newSession('A'), b = await newSession('B');
  pdf.setState({ sessions: [a, b], activeId: a.id, pagePlans: { A: plan(1, 2), B: plan(1, 2) } });
  const stamp = pdf.getState().addSignatureAsset({ name: 'test', blob: bitmapBlob, width: 1, height: 1 });
  pdf.getState().placeSignature(stamp, 1);
  pdf.getState().selectSession('B');
  await pdf.getState().runSignPdf();
  assert.equal(latest(), undefined);
  assert.match(notices.at(-1).message, /先在页面上放置/);

  pdf.getState().selectSession('A');
  pdf.getState().reorderOrganizePage('1', '2');
  await pdf.getState().runSignPdf();
  assert.equal(latest().status, 'completed', latest().error);
  const saved = await pdfLib.PDFDocument.load(await latest().downloadBlob.arrayBuffer());
  const xobjs = (page) => page.node.Resources().lookupMaybe(pdfLib.PDFName.of('XObject'), pdfLib.PDFDict)?.keys().length ?? 0;
  assert.deepEqual(saved.getPages().map(page => [page.getWidth(), xobjs(page)]), [[220, 0], [200, 1]]);
  pdf.getState().removeOrganizePage('1');
  const previousTask = latest();
  await pdf.getState().runSignPdf();
  assert.equal(latest(), previousTask);
});

test('仅差异页拒绝空扫描和过期扫描；明确选全本才输出全部页', async (t) => {
  const a = await newSession('A'), b = await newSession('B'), c = await newSession('C');
  pdf.setState({ sessions: [a, b, c], activeId: a.id, pagePlans: { A: plan(1, 2), B: plan(1, 2), C: plan(1, 2) } });
  pdf.getState().patchCompare({ targetSessionId: 'B' });
  const exports = [];
  let diff = 1;
  t.mock.method(engine.PDFCompare, 'scanDocumentDifferences', async () => ({
    totalPages: 2, diffPages: diff ? [diff] : [],
    pages: [1, 2].map(page => ({ page, hasDiff: page === diff }))
  }));
  t.mock.method(engine.PDFCompare, 'exportDiffReportPDF', async (source, target, pages) => {
    exports.push([source.id, target.id, pages]);
    return { pageCount: pages.length, blob: source.file, outputBytes: source.file.size };
  });
  await pdf.getState().runExportCompareReport();
  assert.deepEqual(exports, []);
  await pdf.getState().runCompareScan();
  pdf.getState().selectSession('C');
  assert.deepEqual(selectCompareResults(pdf.getState()), []);
  await pdf.getState().runExportCompareReport();
  assert.deepEqual(exports, []);
  diff = 2;
  await pdf.getState().runCompareScan();
  await pdf.getState().runExportCompareReport();
  assert.deepEqual(exports, [['C', 'B', [2]]]);
  pdf.getState().rotateOrganizePage('2', 90);
  assert.deepEqual(selectCompareResults(pdf.getState()), []);
  diff = 0;
  await pdf.getState().runCompareScan();
  await pdf.getState().runExportCompareReport();
  assert.equal(exports.length, 1);
  assert.match(notices.at(-1).message, /未发现差异/);
  pdf.getState().patchCompare({ onlyDiffExport: false });
  await pdf.getState().runExportCompareReport();
  assert.deepEqual(exports.at(-1), ['C', 'B', [1, 2]]);
});

test('批量压缩保留超限件，但区分下载成功与体积达标', async (t) => {
  const queue = ['fit', 'over'].map(id => {
    const file = new File([png], id + '.png', { type: 'image/png' });
    return { id, name: file.name, size: file.size, decoded: { file, dimensions: { width: 200, height: 200 } } };
  });
  t.mock.method(engine.ImageCompressor, 'compressToTargetBytes', async ({ file }) => {
    const metTarget = file.name === 'fit.png';
    return { blob: new Blob([new Uint8Array(metTarget ? 18_000 : 39_035)], { type: 'image/jpeg' }),
      width: 200, height: 200, extension: 'jpg', metTarget };
  });
  image.getState().setTool('compress');
  image.getState().patchCompress({ profile: 'target', targetKB: 20 });
  image.getState().patchExportConfig({ batchZip: true });
  image.setState({ items: queue, selectedId: 'over' });
  await image.getState().exportBatch();
  assert.equal(latest().status, 'completed', latest().error);
  assert.match(latest().summary, /1 张未达目标体积：over\.jpg/);
  assert.equal(notices.at(-1).tone, 'info');
  const files = await engine.ZipArchive.readZip(latest().downloadBlob);
  assert.deepEqual(files.map(file => [file.name, file.size]), [['fit.jpg', 18_000], ['over.jpg', 39_035]]);
  image.getState().patchExportConfig({ batchZip: false });
  await image.getState().exportBatch();
  assert.match(latest().summary, /未达目标体积：over\.jpg/);
  await image.getState().exportCurrent();
  assert.match(notices.at(-1).message, /已导出但未达到目标体积/);
});
