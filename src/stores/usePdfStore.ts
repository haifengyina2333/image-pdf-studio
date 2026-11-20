import { create } from 'zustand';
import { DecodedImage, decodeImageFile, ensurePdfJs, ensurePdfLib, formatBytes, getEngine, PdfSessionLike } from '../bridge/engine';
import { useAppStore } from './useAppStore';
import { useTaskStore } from './useTaskStore';

export type PdfToolId = 'compress' | 'organize' | 'merge' | 'split' | 'watermark' | 'image-to-pdf' | 'pdf-to-image';

export interface PdfOrganizePageItem {
  uid: string;
  sourcePage: number;
  rotation: number;
}

export interface PdfCompressConfig {
  mode: 'lossless' | 'raster';
  profile: 'light' | 'standard' | 'strong';
  keepSmaller: boolean;
  filename: string;
}

export interface PdfSplitConfig {
  mode: 'every' | 'ranges';
  ranges: string;
  filename: string;
}

export interface PdfWatermarkConfig {
  text: string;
  color: string;
  pages: string;
  tiled: boolean;
  position: string;
  opacity: number;
  rotation: number;
  size: number;
  density: number;
  filename: string;
}

export interface PdfImageToPdfConfig {
  pageSize: 'a4' | 'a3' | 'original' | 'auto';
  orientation: 'auto' | 'portrait' | 'landscape';
  marginMm: number;
  background: string;
  quality: number;
  filename: string;
}

export interface PdfToImageConfig {
  pages: string;
  format: 'image/jpeg' | 'image/png';
  dpi: number;
  quality: number;
  filename: string;
}

export interface PdfImageQueueItem {
  id: string;
  name: string;
  size: number;
  file: File;
  decoded: DecodedImage;
}

export const DEFAULT_PDF_COMPRESS: PdfCompressConfig = {
  mode: 'raster',
  profile: 'standard',
  keepSmaller: true,
  filename: ''
};

export const DEFAULT_PDF_WATERMARK: PdfWatermarkConfig = {
  text: '仅供办理＿＿使用，他用无效',
  color: '#315f72',
  pages: '',
  tiled: true,
  position: 'center',
  opacity: 20,
  rotation: -25,
  size: 28,
  density: 3,
  filename: ''
};

interface PdfState {
  tool: PdfToolId;
  sessions: PdfSessionLike[];
  activeId: string | null;
  currentPage: number;
  importing: boolean;

  compress: PdfCompressConfig;
  organizeFilename: string;
  pagePlans: Record<string, PdfOrganizePageItem[]>;
  mergeFilename: string;
  split: PdfSplitConfig;
  watermark: PdfWatermarkConfig;
  imageToPdf: PdfImageToPdfConfig;
  pdfToImage: PdfToImageConfig;
  pdfImages: PdfImageQueueItem[];

  setTool: (tool: PdfToolId) => void;
  importFiles: (files: FileList | File[]) => Promise<void>;
  importPdfImages: (files: FileList | File[]) => Promise<void>;
  selectSession: (id: string) => void;
  moveSession: (id: string, delta: -1 | 1) => void;
  setPage: (page: number) => void;
  removeSession: (id: string) => Promise<void>;
  clearSessions: () => Promise<void>;
  movePdfImage: (id: string, delta: -1 | 1) => void;
  removePdfImage: (id: string) => void;
  clearPdfImages: () => void;

  setOrganizeFilename: (name: string) => void;
  reorderOrganizePage: (fromUid: string, toUid: string) => void;
  moveOrganizePage: (uid: string, delta: -1 | 1) => void;
  rotateOrganizePage: (uid: string, delta: 90 | -90) => void;
  removeOrganizePage: (uid: string) => void;
  restoreOrganizePages: () => void;

  patchCompress: (patch: Partial<PdfCompressConfig>) => void;
  setMergeFilename: (name: string) => void;
  patchSplit: (patch: Partial<PdfSplitConfig>) => void;
  patchWatermark: (patch: Partial<PdfWatermarkConfig>) => void;
  patchImageToPdf: (patch: Partial<PdfImageToPdfConfig>) => void;
  patchPdfToImage: (patch: Partial<PdfToImageConfig>) => void;
  resetCurrentTool: () => void;

  runCompress: () => Promise<void>;
  runOrganize: () => Promise<void>;
  runMerge: () => Promise<void>;
  runSplit: () => Promise<void>;
  runWatermark: () => Promise<void>;
  runImagesToPdf: () => Promise<void>;
  runPdfToImages: () => Promise<void>;
}

let runtimeManager: InstanceType<ReturnType<typeof getEngine>['PDFRuntime']['PDFRuntimeManager']> | null = null;
const getRuntimeManager = async () => {
  await ensurePdfJs();
  if (!runtimeManager) {
    const engine = getEngine();
    runtimeManager = new engine.PDFRuntime.PDFRuntimeManager(window.ToolboxPDFJS);
  }
  return runtimeManager;
};

const cleanStem = (raw: string, fallback: string) => {
  const stem = raw
    .trim()
    .replace(/\.(?:pdf|zip)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 96);
  return stem || fallback;
};

const makeTextStampBlob = async (text: string, color: string): Promise<Blob> => {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error('请输入 PDF 水印文字。');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontSize = 54;
  const padding = 30;
  const lineHeight = 70;
  ctx.font = `700 ${fontSize}px sans-serif`;
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width));
  canvas.width = Math.ceil(width + padding * 2);
  canvas.height = lines.length * lineHeight + padding * 2;
  const draw = canvas.getContext('2d')!;
  draw.font = `700 ${fontSize}px sans-serif`;
  draw.textAlign = 'center';
  draw.textBaseline = 'middle';
  draw.fillStyle = color;
  lines.forEach((line, idx) => draw.fillText(line, canvas.width / 2, padding + lineHeight * (idx + 0.5)));
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('水印图层生成失败'))), 'image/png')
  );
};

const defaultPlanForSession = (session: PdfSessionLike): PdfOrganizePageItem[] =>
  Array.from({ length: session.numPages }, (_, idx) => ({
    uid: `${session.id}_p${idx + 1}`,
    sourcePage: idx + 1,
    rotation: 0
  }));

export const usePdfStore = create<PdfState>((set, get) => ({
  tool: 'compress',
  sessions: [],
  activeId: null,
  currentPage: 1,
  importing: false,

  compress: { ...DEFAULT_PDF_COMPRESS },
  organizeFilename: '',
  pagePlans: {},
  mergeFilename: '',
  split: { mode: 'every', ranges: '', filename: '' },
  watermark: { ...DEFAULT_PDF_WATERMARK },
  imageToPdf: { pageSize: 'a4', orientation: 'auto', marginMm: 10, background: '#ffffff', quality: 0.9, filename: '' },
  pdfToImage: { pages: '', format: 'image/jpeg', dpi: 144, quality: 0.9, filename: '' },
  pdfImages: [],

  setTool: (tool) => set({ tool }),

  importFiles: async (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const notify = useAppStore.getState().notify;

    set({ importing: true });
    let added = 0;
    try {
      const manager = await getRuntimeManager();
      for (const file of files) {
        try {
          const session = await manager.open(file, {
            onPassword: async ({ file: f, incorrect }) =>
              window.prompt(incorrect ? `${f.name} 密码不正确，请重新输入：` : `请输入加密 PDF「${f.name}」的密码：`) || null
          });
          set((state) => ({
            sessions: [...state.sessions, session],
            pagePlans: { ...state.pagePlans, [session.id]: defaultPlanForSession(session) },
            activeId: state.activeId ?? session.id,
            currentPage: state.activeId ? state.currentPage : 1
          }));
          added += 1;
        } catch (err) {
          notify(err instanceof Error ? err.message : `${file.name} 导入失败`, 'error');
        }
      }
      if (added > 0) notify(`已导入 ${added} 份 PDF`, 'success');
    } finally {
      set({ importing: false });
    }
  },

  importPdfImages: async (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const notify = useAppStore.getState().notify;
    set({ importing: true });
    let added = 0;
    for (const file of files) {
      try {
        const decoded = await decodeImageFile(file);
        const id = `pimg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          pdfImages: [...state.pdfImages, { id, name: file.name, size: file.size, file: decoded.file, decoded }]
        }));
        added += 1;
      } catch (err) {
        notify(err instanceof Error ? err.message : `${file.name} 导入失败`, 'error');
      }
    }
    set({ importing: false });
    if (added > 0) notify(`已添加 ${added} 张图片`, 'success');
  },

  selectSession: (id) => set({ activeId: id, currentPage: 1 }),

  moveSession: (id, delta) => {
    const { sessions } = get();
    const idx = sessions.findIndex((s) => s.id === id);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= sessions.length) return;
    const next = [...sessions];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    set({ sessions: next });
  },

  setPage: (page) => {
    const active = get().sessions.find((s) => s.id === get().activeId);
    if (!active) return;
    set({ currentPage: Math.max(1, Math.min(active.numPages, page)) });
  },

  removeSession: async (id) => {
    const busy = useTaskStore.getState().tasks.some((t) => t.status === 'running' && t.kind.startsWith('pdf-'));
    if (busy) {
      useAppStore.getState().notify('PDF 任务运行中，请先等待完成或取消后再移除文档', 'error');
      return;
    }
    await runtimeManager?.remove(id);
    set((state) => {
      const next = state.sessions.filter((s) => s.id !== id);
      const nextPlans = { ...state.pagePlans };
      delete nextPlans[id];
      return {
        sessions: next,
        pagePlans: nextPlans,
        activeId: state.activeId === id ? next[0]?.id ?? null : state.activeId,
        currentPage: 1
      };
    });
  },

  clearSessions: async () => {
    const busy = useTaskStore.getState().tasks.some((t) => t.status === 'running' && t.kind.startsWith('pdf-'));
    if (busy) {
      useAppStore.getState().notify('PDF 任务运行中，请先等待完成或取消后再清空', 'error');
      return;
    }
    for (const s of get().sessions) await runtimeManager?.remove(s.id);
    set({ sessions: [], pagePlans: {}, activeId: null, currentPage: 1 });
    useAppStore.getState().notify('已清空 PDF 列表');
  },

  setOrganizeFilename: (organizeFilename) => set({ organizeFilename }),

  reorderOrganizePage: (fromUid, toUid) => {
    const { activeId, pagePlans } = get();
    if (!activeId || fromUid === toUid) return;
    const plan = pagePlans[activeId];
    if (!plan) return;
    const fromIdx = plan.findIndex((p) => p.uid === fromUid);
    const toIdx = plan.findIndex((p) => p.uid === toUid);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...plan];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    set({ pagePlans: { ...pagePlans, [activeId]: next } });
  },

  moveOrganizePage: (uid, delta) => {
    const { activeId, pagePlans } = get();
    if (!activeId) return;
    const plan = pagePlans[activeId];
    if (!plan) return;
    const idx = plan.findIndex((p) => p.uid === uid);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= plan.length) return;
    const next = [...plan];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    set({ pagePlans: { ...pagePlans, [activeId]: next } });
  },

  rotateOrganizePage: (uid, delta) => {
    const { activeId, pagePlans } = get();
    if (!activeId) return;
    const plan = pagePlans[activeId];
    if (!plan) return;
    set({
      pagePlans: {
        ...pagePlans,
        [activeId]: plan.map((p) => (p.uid === uid ? { ...p, rotation: ((p.rotation + delta) % 360 + 360) % 360 } : p))
      }
    });
  },

  removeOrganizePage: (uid) => {
    const { activeId, pagePlans } = get();
    if (!activeId) return;
    const plan = pagePlans[activeId];
    if (!plan) return;
    if (plan.length <= 1) {
      useAppStore.getState().notify('至少需要保留 1 页', 'error');
      return;
    }
    set({ pagePlans: { ...pagePlans, [activeId]: plan.filter((p) => p.uid !== uid) } });
  },

  restoreOrganizePages: () => {
    const { activeId, sessions, pagePlans } = get();
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return;
    set({ pagePlans: { ...pagePlans, [session.id]: defaultPlanForSession(session) } });
    useAppStore.getState().notify('已恢复原始页序与角度');
  },

  movePdfImage: (id, delta) => {
    const { pdfImages } = get();
    const idx = pdfImages.findIndex((i) => i.id === id);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= pdfImages.length) return;
    const next = [...pdfImages];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    set({ pdfImages: next });
  },

  removePdfImage: (id) => {
    const target = get().pdfImages.find((i) => i.id === id);
    target?.decoded.dispose?.();
    set((s) => ({ pdfImages: s.pdfImages.filter((i) => i.id !== id) }));
  },

  clearPdfImages: () => {
    get().pdfImages.forEach((i) => i.decoded.dispose?.());
    set({ pdfImages: [] });
  },

  patchCompress: (patch) => set((s) => ({ compress: { ...s.compress, ...patch } })),
  setMergeFilename: (mergeFilename) => set({ mergeFilename }),
  patchSplit: (patch) => set((s) => ({ split: { ...s.split, ...patch } })),
  patchWatermark: (patch) => set((s) => ({ watermark: { ...s.watermark, ...patch } })),
  patchImageToPdf: (patch) => set((s) => ({ imageToPdf: { ...s.imageToPdf, ...patch } })),
  patchPdfToImage: (patch) => set((s) => ({ pdfToImage: { ...s.pdfToImage, ...patch } })),

  resetCurrentTool: () => {
    const { tool, watermark } = get();
    if (tool === 'compress') set({ compress: { ...DEFAULT_PDF_COMPRESS } });
    else if (tool === 'organize') {
      get().restoreOrganizePages();
      return;
    } else if (tool === 'watermark') set({ watermark: { ...DEFAULT_PDF_WATERMARK, text: watermark.text } });
    else if (tool === 'split') set({ split: { mode: 'every', ranges: '', filename: '' } });
    else if (tool === 'image-to-pdf')
      set({ imageToPdf: { pageSize: 'a4', orientation: 'auto', marginMm: 10, background: '#ffffff', quality: 0.9, filename: '' } });
    else if (tool === 'pdf-to-image')
      set({ pdfToImage: { pages: '', format: 'image/jpeg', dpi: 144, quality: 0.9, filename: '' } });
    useAppStore.getState().notify('已重置当前 PDF 工具参数');
  },

  runCompress: async () => {
    const { sessions, activeId, compress } = get();
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return;
    const engine = getEngine();
    const filename = `${cleanStem(compress.filename, `${session.file.name.replace(/\.pdf$/i, '')}-压缩`)}.pdf`;

    await useTaskStore.getState().runTask(
      { kind: 'pdf-compress', title: `压缩 PDF：${session.file.name}`, initialStage: '正在加载 PDF 处理引擎…' },
      async ({ signal, report }) => {
        await ensurePdfLib();
        const onProgress = ({ stage, current = 1, total = 1 }: { stage?: string; current?: number; total?: number }) => {
          const action = stage === 'render' ? '渲染页面' : stage === 'encode' ? '编码图像' : stage === 'read' ? '读取结构' : '生成 PDF';
          report(`正在${action} ${current}/${total}…`, { current, total });
        };
        const result =
          compress.mode === 'raster'
            ? await engine.PDFProcessor.compressPDF(session, compress.profile, {
                signal,
                keepOriginalIfLarger: compress.keepSmaller,
                onProgress
              })
            : await engine.PDFProcessor.optimizePDF(session.file, {
                signal,
                keepOriginalIfLarger: compress.keepSmaller,
                onProgress
              });

        const delta = result.inputBytes ? Math.round((1 - result.outputBytes / result.inputBytes) * 100) : 0;
        const summary = result.usedOriginal
          ? `未变小，已保留原文件 ${formatBytes(result.inputBytes)}`
          : `${result.pageCount} 页 · ${formatBytes(result.inputBytes)} → ${formatBytes(result.outputBytes)}${delta > 0 ? `（-${delta}%）` : ''}`;
        useAppStore.getState().notify(`PDF 压缩完成：${filename}`, 'success');
        return { summary, downloadBlob: result.blob, downloadName: filename };
      }
    );
  },

  runOrganize: async () => {
    const { sessions, activeId, pagePlans, organizeFilename } = get();
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return;
    const plan = pagePlans[session.id] ?? defaultPlanForSession(session);
    if (!plan.length) return;
    const engine = getEngine();
    const filename = `${cleanStem(organizeFilename, `${session.file.name.replace(/\.pdf$/i, '')}-整理`)}.pdf`;

    await useTaskStore.getState().runTask(
      { kind: 'pdf-organize', title: `整理 PDF：${session.file.name}`, initialStage: '正在加载 PDF 引擎…' },
      async ({ signal, report }) => {
        await ensurePdfLib();
        const res = await engine.PDFProcessor.savePagePlan(
          session.file,
          plan.map((p) => ({ sourcePage: p.sourcePage, rotation: p.rotation })),
          {
            signal,
            onProgress: ({ stage, current = 1, total = plan.length }) =>
              report(stage === 'save' ? '正在保存整理后的 PDF…' : `正在重排页面 ${current}/${total}…`, { current, total })
          }
        );
        useAppStore.getState().notify(`页面整理完成：${filename}`, 'success');
        return {
          summary: `保留 ${res.pageCount} 页 · ${formatBytes(res.outputBytes)}`,
          downloadBlob: res.blob,
          downloadName: filename
        };
      }
    );
  },

  runMerge: async () => {
    const { sessions, mergeFilename } = get();
    if (sessions.length < 2) return;
    const engine = getEngine();
    const filename = `${cleanStem(mergeFilename, '合并文档')}.pdf`;

    await useTaskStore.getState().runTask(
      { kind: 'pdf-merge', title: `合并 ${sessions.length} 份 PDF`, initialStage: '正在加载 PDF 引擎…' },
      async ({ signal, report }) => {
        await ensurePdfLib();
        const res = await engine.PDFProcessor.mergePDFs(
          sessions.map((s) => ({ file: s.file })),
          {
            signal,
            onProgress: ({ stage, current = 1, total = sessions.length, fileName }) =>
              report(stage === 'save' ? '正在生成合并文档…' : `正在合并 ${current}/${total}：${fileName || ''}`, {
                current,
                total
              })
          }
        );
        useAppStore.getState().notify(`合并完成：${filename}`, 'success');
        return {
          summary: `${res.fileCount} 份文档 · 共 ${res.pageCount} 页 · ${formatBytes(res.outputBytes)}`,
          downloadBlob: res.blob,
          downloadName: filename
        };
      }
    );
  },

  runSplit: async () => {
    const { sessions, activeId, split } = get();
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return;
    const engine = getEngine();
    const prefix = cleanStem(split.filename, `${session.file.name.replace(/\.pdf$/i, '')}-拆分`);

    await useTaskStore.getState().runTask(
      { kind: 'pdf-split', title: `拆分 PDF：${session.file.name}`, initialStage: '正在解析拆分范围…' },
      async ({ signal, report }) => {
        await ensurePdfLib();
        const groups =
          split.mode === 'every'
            ? Array.from({ length: session.numPages }, (_, i) => [{ sourcePage: i + 1, rotation: 0 }])
            : engine.PageRange.parseSplitGroups(split.ranges, session.numPages).map((group) =>
                group.pages.map((p) => ({ sourcePage: p, rotation: 0 }))
              );
        const res = await engine.PDFProcessor.createPDFParts(session.file, groups, {
          signal,
          onProgress: ({ current = 1, total = groups.length }) =>
            report(`正在生成第 ${current}/${total} 份 PDF…`, { current, total })
        });
        report('正在打包 ZIP…');
        const zipFiles = res.parts.map((part, idx) => ({
          name: `${prefix}-${String(idx + 1).padStart(2, '0')}.pdf`,
          blob: part.blob
        }));
        const zipBlob = await engine.ZipArchive.createZip(zipFiles, { signal });
        useAppStore.getState().notify(`拆分完成：${prefix}.zip`, 'success');
        return {
          summary: `拆分为 ${res.parts.length} 份 PDF · ZIP ${formatBytes(zipBlob.size)}`,
          downloadBlob: zipBlob,
          downloadName: `${prefix}.zip`
        };
      }
    );
  },

  runWatermark: async () => {
    const { sessions, activeId, watermark } = get();
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return;
    const engine = getEngine();
    const filename = `${cleanStem(watermark.filename, `${session.file.name.replace(/\.pdf$/i, '')}-水印`)}.pdf`;

    await useTaskStore.getState().runTask(
      { kind: 'pdf-watermark', title: `PDF 水印：${session.file.name}`, initialStage: '正在生成水印图层…' },
      async ({ signal, report }) => {
        await ensurePdfLib();
        const pages = engine.PageRange.parsePageSelection(watermark.pages, session.numPages);
        const stampBlob = await makeTextStampBlob(watermark.text, watermark.color);
        const res = await engine.PDFProcessor.watermarkPDF(
          session.file,
          null,
          stampBlob,
          {
            pages,
            tiled: watermark.tiled,
            position: watermark.position,
            opacity: watermark.opacity / 100,
            rotation: watermark.rotation,
            widthRatio: watermark.size / 100,
            density: watermark.density,
            offsetXRatio: 0,
            offsetYRatio: 0
          },
          {
            signal,
            onProgress: ({ stage, current = 1, total = pages.length }) =>
              report(stage === 'save' ? '正在保存带水印 PDF…' : `正在写入第 ${current}/${total} 页…`, { current, total })
          }
        );
        useAppStore.getState().notify(`PDF 水印完成：${filename}`, 'success');
        return {
          summary: `已对 ${pages.length} 页添加${watermark.tiled ? '铺满' : '单个'}水印 · ${formatBytes(res.outputBytes)}`,
          downloadBlob: res.blob,
          downloadName: filename
        };
      }
    );
  },

  runImagesToPdf: async () => {
    const { pdfImages, imageToPdf } = get();
    if (!pdfImages.length) return;
    const engine = getEngine();
    const filename = `${cleanStem(imageToPdf.filename, '图片合集')}.pdf`;

    await useTaskStore.getState().runTask(
      { kind: 'pdf-image-to-pdf', title: `图片转 PDF（${pdfImages.length} 张）`, initialStage: '正在加载 PDF 引擎…' },
      async ({ signal, report }) => {
        await ensurePdfLib();
        const res = await engine.PDFProcessor.imagesToPDF(
          pdfImages.map((i) => i.file),
          {
            pageSize: imageToPdf.pageSize,
            orientation: imageToPdf.orientation,
            marginMm: imageToPdf.marginMm,
            background: imageToPdf.background,
            quality: imageToPdf.quality
          },
          {
            signal,
            onProgress: ({ stage, current = 1, total = pdfImages.length, fileName }) =>
              report(stage === 'save' ? '正在生成 PDF…' : `正在处理 ${current}/${total}：${fileName || ''}`, {
                current,
                total
              })
          }
        );
        useAppStore.getState().notify(`已生成 PDF：${filename}`, 'success');
        return {
          summary: `${res.pageCount} 页 · ${formatBytes(res.outputBytes)}`,
          downloadBlob: res.blob,
          downloadName: filename
        };
      }
    );
  },

  runPdfToImages: async () => {
    const { sessions, activeId, pdfToImage } = get();
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return;
    const engine = getEngine();
    const prefix = cleanStem(pdfToImage.filename, `${session.file.name.replace(/\.pdf$/i, '')}-图片`);

    await useTaskStore.getState().runTask(
      { kind: 'pdf-to-image', title: `PDF 转图片：${session.file.name}`, initialStage: '正在解析页码…' },
      async ({ signal, report }) => {
        const pages = engine.PageRange.parsePageSelection(pdfToImage.pages, session.numPages);
        const res = await engine.PDFProcessor.pdfToImages(
          session,
          pages,
          { type: pdfToImage.format, quality: pdfToImage.quality, dpi: pdfToImage.dpi },
          {
            signal,
            onProgress: ({ stage, current = 1, total = pages.length, pageNumber }) =>
              report(`正在${stage === 'render' ? '渲染' : '编码'} ${current}/${total}（第 ${pageNumber || current} 页）…`, {
                current,
                total
              })
          }
        );
        const ext = res.type === 'image/png' ? 'png' : 'jpg';
        const files = res.images.map((img, idx) => ({
          name: `${prefix}-${String(img.outputPage || pages[idx]).padStart(3, '0')}.${ext}`,
          blob: img.blob
        }));
        if (files.length === 1) {
          useAppStore.getState().notify(`已导出：${files[0].name}`, 'success');
          return {
            summary: `1 页 · ${res.dpi} DPI · ${formatBytes(files[0].blob.size)}`,
            downloadBlob: files[0].blob,
            downloadName: files[0].name
          };
        }
        report(`正在打包 ${files.length} 张图片…`);
        const zipBlob = await engine.ZipArchive.createZip(files, { signal });
        useAppStore.getState().notify(`已导出：${prefix}.zip`, 'success');
        return {
          summary: `${files.length} 页 · ${res.dpi} DPI · ZIP ${formatBytes(zipBlob.size)}`,
          downloadBlob: zipBlob,
          downloadName: `${prefix}.zip`
        };
      }
    );
  }
}));
