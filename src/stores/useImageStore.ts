import { create } from 'zustand';
import {
  copyImageToClipboard,
  CropRect,
  DecodedImage,
  decodeImageFile,
  FaceBox,
  FaceRedactionOptions,
  formatBytes,
  getEngine,
  PortraitMaskData,
  RedactBoxKind,
  StitchOptions,
  triggerBlobDownload,
  WatermarkOptions,
  WatermarkPresetRecord,
  WatermarkPresetSnapshot
} from '../bridge/engine';
import { useAppStore } from './useAppStore';
import { useTaskStore } from './useTaskStore';

export type ImageToolId =
  | 'watermark'
  | 'redact'
  | 'id-photo'
  | 'compress'
  | 'resize'
  | 'transform'
  | 'crop'
  | 'stitch'
  | 'split'
  | 'convert';

export interface IdPhotoConfig {
  bgColor: string;
  preset: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  feather: number;
  threshold: number;
}

export interface ImageQueueItem {
  id: string;
  name: string;
  size: number;
  decoded: DecodedImage;
}

export interface ImageExportConfig {
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  quality: number;
  background: string;
  filename: string;
  batchZip: boolean;
}

type ToolEncoding = Pick<ImageExportConfig, 'format' | 'quality'>;

export interface CompressConfig {
  profile: 'high' | 'balanced' | 'strong' | 'target' | 'custom';
  maxEdge: number;
  targetKB: number;
}

export interface ResizeConfig {
  mode: 'width' | 'height' | 'percent' | 'box';
  value: number;
  width: number;
  height: number;
  keepRatio: boolean;
}

export interface TransformConfig {
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export interface CropConfig {
  rect: CropRect;
  ratio: number;
}

export interface ImageSplitConfig {
  rows: number;
  columns: number;
  rowPattern: string;
}

export const DEFAULT_WATERMARK: WatermarkOptions = {
  kind: 'text',
  text: '仅供办理＿＿使用，他用无效',
  font: 'Arial, sans-serif',
  weight: '600',
  color: '#ffffff',
  sizeRatio: 0.04,
  opacity: 0.72,
  rotation: -20,
  tile: true,
  density: 0.82,
  offsetXRatio: 0,
  offsetYRatio: 0,
  position: { xRatio: 0.85, yRatio: 0.88 },
  logo: null
};

export const DEFAULT_REDACT: FaceRedactionOptions = {
  style: 'mosaic',
  shape: 'ellipse',
  strength: 18,
  margin: 24,
  color: '#111827',
  emoji: '😎',
  sticker: '',
  stickerImage: null,
  expressionMode: 'auto',
  annotationColor: '#ef4444',
  annotationWidth: 5
};

export const DEFAULT_ID_PHOTO: IdPhotoConfig = {
  bgColor: '#438edb',
  preset: '1inch',
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  feather: 1.5,
  threshold: 0.45
};

export const DEFAULT_COMPRESS: CompressConfig = { profile: 'balanced', maxEdge: 2560, targetKB: 200 };
export const DEFAULT_RESIZE: ResizeConfig = { mode: 'width', value: 1080, width: 1920, height: 1080, keepRatio: true };
export const DEFAULT_TRANSFORM: TransformConfig = { rotation: 0, flipX: false, flipY: false };
export const DEFAULT_CROP: CropConfig = { rect: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 }, ratio: 0 };
export const DEFAULT_IMAGE_SPLIT: ImageSplitConfig = { rows: 0, columns: 0, rowPattern: '' };

export const DEFAULT_STITCH: StitchOptions = {
  mode: 'vertical',
  size: 800,
  columns: 2,
  rowPattern: '',
  cellSizeMode: 'custom',
  originalScale: 1,
  cellRatio: 'auto',
  fit: 'contain',
  incompleteRow: 'last',
  gapX: 12,
  gapY: 12,
  background: '#ffffff',
  type: 'image/png',
  quality: 0.92,
  title: '',
  description: '',
  titleSize: 42,
  descriptionSize: 24,
  headerColor: '#0f172a',
  headerAlign: 'left',
  headerPosition: 'top',
  headerPadding: 32
};

export const DEFAULT_EXPORT: ImageExportConfig = {
  format: 'image/jpeg',
  quality: 0.92,
  background: '#ffffff',
  filename: '',
  batchZip: false
};

interface ImageStoreState {
  tool: ImageToolId;
  items: ImageQueueItem[];
  selectedId: string | null;
  importing: boolean;
  logoName: string;
  logoBlob: Blob | null;

  watermark: WatermarkOptions;
  wmPresets: WatermarkPresetRecord[];
  wmPresetsLoaded: boolean;

  redact: FaceRedactionOptions;
  redactDrawMode: RedactBoxKind;
  redactDetectMode: 'group' | 'standard';
  redactConfidence: number;
  stickerName: string;
  facesByItemId: Record<string, FaceBox[]>;
  selectedFaceId: string | null;

  idPhoto: IdPhotoConfig;
  portraitMaskByItemId: Record<string, PortraitMaskData>;

  compress: CompressConfig;
  resize: ResizeConfig;
  transform: TransformConfig;
  crop: CropConfig;
  stitch: StitchOptions;
  splitConfig: ImageSplitConfig;
  exportConfig: ImageExportConfig;
  encodingByTool: Partial<Record<ImageToolId, ToolEncoding>>;
  undoByTool: Partial<Record<ImageToolId, unknown>>;

  setTool: (tool: ImageToolId) => void;
  importFiles: (files: FileList | File[]) => Promise<void>;
  importLogo: (file: File) => Promise<void>;
  importSticker: (file: File) => Promise<void>;
  selectItem: (id: string | null) => void;
  moveItem: (id: string, delta: -1 | 1) => void;
  reorderByIds: (fromId: string, toId: string) => void;
  swapByIds: (firstId: string, secondId: string) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;

  patchWatermark: (patch: Partial<WatermarkOptions>) => void;
  loadWatermarkPresets: () => Promise<void>;
  saveWatermarkPreset: (name: string) => Promise<boolean>;
  applyWatermarkPreset: (id: string) => Promise<void>;
  deleteWatermarkPreset: (id: string) => Promise<void>;
  exportWatermarkPresets: () => Promise<void>;
  importWatermarkPresets: (file: File) => Promise<void>;

  patchRedact: (patch: Partial<FaceRedactionOptions>) => void;
  setRedactDrawMode: (mode: RedactBoxKind) => void;
  setRedactDetectMode: (mode: 'group' | 'standard') => void;
  setRedactConfidence: (conf: number) => void;
  setSelectedFaceId: (id: string | null) => void;
  detectFacesForCurrent: () => Promise<void>;
  addManualFace: (
    rect?: { x: number; y: number; width: number; height: number; x1?: number; y1?: number; x2?: number; y2?: number },
    kindOverride?: RedactBoxKind
  ) => void;
  updateFace: (faceId: string, patch: Partial<FaceBox>) => void;
  removeFace: (faceId: string) => void;
  clearFacesForCurrent: () => void;

  patchIdPhoto: (patch: Partial<IdPhotoConfig>) => void;
  segmentPortraitForCurrent: () => Promise<void>;
  clearPortraitMaskForCurrent: () => void;

  patchCompress: (patch: Partial<CompressConfig>) => void;
  patchResize: (patch: Partial<ResizeConfig>) => void;
  patchTransform: (patch: Partial<TransformConfig>) => void;
  patchCrop: (patch: Partial<CropConfig>) => void;
  patchStitch: (patch: Partial<StitchOptions>) => void;
  patchSplitConfig: (patch: Partial<ImageSplitConfig>) => void;
  patchExportConfig: (patch: Partial<ImageExportConfig>) => void;

  resetCurrentTool: () => void;
  undoResetCurrentTool: () => void;

  saveStitchProject: () => Promise<void>;
  openStitchProject: (file: File) => Promise<void>;
  runSplitExportZip: () => Promise<void>;
  runSplitIntoQueue: () => Promise<void>;

  exportCurrent: () => Promise<void>;
  exportBatch: () => Promise<void>;
  copyCurrentPng: () => Promise<void>;
}

let watermarkStoreInstance: InstanceType<ReturnType<typeof getEngine>['WatermarkStore']['WatermarkStore']> | null = null;
const getWatermarkStore = () => {
  if (!watermarkStoreInstance) {
    watermarkStoreInstance = new (getEngine().WatermarkStore.WatermarkStore)();
  }
  return watermarkStoreInstance;
};

let logoDisposeFn: (() => void) | null = null;
let stickerDisposeFn: (() => void) | null = null;
let importGeneration = 0;

const encodingFor = ({ format, quality }: ToolEncoding): ToolEncoding => ({ format, quality });

const switchImageTool = (state: ImageStoreState, tool: ImageToolId) => {
  if (tool === state.tool) return {};
  const firstEncoding: ToolEncoding = tool === 'stitch'
    ? { format: 'image/png', quality: DEFAULT_EXPORT.quality }
    : tool === 'compress'
      ? { format: 'image/jpeg', quality: (getEngine().CompressionModel.profiles[state.compress.profile]?.quality ?? 82) / 100 }
      : encodingFor(DEFAULT_EXPORT);
  return {
    tool,
    encodingByTool: { ...state.encodingByTool, [state.tool]: encodingFor(state.exportConfig) },
    exportConfig: { ...state.exportConfig, ...(state.encodingByTool[tool] ?? firstEncoding) }
  };
};

const canStartImageOutput = (state: ImageStoreState) => {
  if (state.tool !== 'watermark') return true;
  try {
    getEngine().ImageExporter.assertExportable(state.watermark);
    return true;
  } catch (err) {
    useAppStore.getState().notify(err instanceof Error ? err.message : '请先上传 Logo 水印。', 'error');
    return false;
  }
};

const extForMime = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');

const stemOf = (name: string) => name.replace(/\.[^.]+$/, '') || 'image';

const makeStamp = (prefix: string) => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

const cleanName = (raw: string, fallback: string, ext: string) => {
  const stem = raw
    .trim()
    .replace(/\.(?:png|jpe?g|webp|zip)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 96);
  return `${stem || fallback}.${ext}`;
};

const processSingleItem = async (
  item: ImageQueueItem,
  state: ImageStoreState,
  overrideFormat?: string,
  signal?: AbortSignal
): Promise<{ blob: Blob; width: number; height: number; ext: string; note?: string }> => {
  const engine = getEngine();
  const scope = new engine.ResourceScope();
  const mime = overrideFormat || state.exportConfig.format;
  const quality = mime === 'image/png' ? undefined : state.exportConfig.quality;

  try {
    const file = item.decoded.file;
    const dims = item.decoded.dimensions;

    if (state.tool === 'watermark') {
      const res = await engine.ImageExporter.exportWatermarkedImage({
        file,
        options: state.watermark,
        type: mime,
        quality,
        outputSize: dims,
        scope,
        signal
      });
      return { ...res, ext: res.extension || extForMime(res.blob.type || mime) };
    }
    if (state.tool === 'redact') {
      const faces = state.facesByItemId[item.id] ?? [];
      const activeFaces = faces.filter((f) => f.enabled !== false);
      if (!activeFaces.length) {
        throw new Error(
          faces.length
            ? `「${item.name}」的打码/标注区域已全部关闭，请至少启用一个区域后再导出。`
            : `「${item.name}」还没有打码或标注区域，请先点击「AI 自动识别人脸」或手动框选后再导出。`
        );
      }
      const res = await engine.FaceRedactor.processImage({
        file,
        faces: activeFaces,
        options: state.redact,
        type: mime,
        quality,
        outputSize: dims,
        scope,
        signal
      });
      return { ...res, ext: res.extension || extForMime(res.blob.type || mime) };
    }
    if (state.tool === 'id-photo') {
      let maskData = state.portraitMaskByItemId[item.id] ?? null;
      if (!maskData) {
        maskData = await engine.PortraitSegmenter.segmentPortrait(file, { signal });
        useImageStore.setState((prev) => ({
          portraitMaskByItemId: { ...prev.portraitMaskByItemId, [item.id]: maskData! }
        }));
      }
      const res = await engine.PortraitSegmenter.exportIdPhoto({
        file,
        maskData,
        options: state.idPhoto,
        type: mime,
        quality,
        scope,
        signal
      });
      return { blob: res.blob, width: res.width, height: res.height, ext: res.extension || extForMime(res.outputType || mime), note: res.presetLabel };
    }
    if (state.tool === 'compress') {
      if (state.compress.profile === 'target') {
        const res = await engine.ImageCompressor.compressToTargetBytes({
          file,
          dimensions: dims,
          targetBytes: Math.max(20, state.compress.targetKB) * 1024,
          options: { type: mime, maxEdge: state.compress.maxEdge },
          scope,
          signal
        });
        return {
          blob: res.blob,
          width: res.width,
          height: res.height,
          ext: res.extension || extForMime(res.outputType || mime),
          note: res.strategy
        };
      }
      const profile = engine.CompressionModel.profiles[state.compress.profile];
      const maxEdge = state.compress.profile === 'custom' ? state.compress.maxEdge : profile?.maxEdge ?? 2560;
      const q = Math.max(0.4, Math.min(1, state.exportConfig.quality));
      const res = await engine.ImageCompressor.compressImage({
        file,
        dimensions: dims,
        options: { type: mime, quality: q, maxEdge },
        scope,
        signal
      });
      return { blob: res.blob, width: res.width, height: res.height, ext: res.extension || extForMime(res.outputType || mime) };
    }
    if (state.tool === 'resize') {
      const res = await engine.ImageResizer.resizeImage({
        file,
        dimensions: dims,
        options: state.resize,
        type: mime,
        quality,
        scope,
        signal
      });
      return { ...res, ext: res.extension || extForMime(res.blob.type || mime) };
    }
    if (state.tool === 'transform') {
      const res = await engine.ImageTransformer.transformImage({
        file,
        dimensions: dims,
        options: state.transform,
        type: mime,
        quality,
        scope,
        signal
      });
      return { ...res, ext: res.extension || extForMime(res.blob.type || mime) };
    }
    if (state.tool === 'crop') {
      const activeId = state.selectedId ?? state.items[0]?.id;
      const effectiveCrop =
        state.crop.ratio > 0 && item.id !== activeId
          ? engine.ImageCropper.cropForAspect(dims, state.crop.ratio)
          : state.crop.rect;
      const res = await engine.ImageCropper.cropImage({
        file,
        dimensions: dims,
        crop: effectiveCrop,
        type: mime,
        quality,
        scope,
        signal
      });
      return { ...res, ext: res.extension || extForMime(res.blob.type || mime) };
    }
    // convert (or fallback)
    const res = await engine.ImageConverter.convertImage({
      file,
      dimensions: dims,
      type: mime,
      quality,
      // Fill only when the effective output format is JPG; PNG / WebP (including PNG copy) keep their alpha channel
      background: mime === 'image/jpeg' ? state.exportConfig.background : undefined,
      scope,
      signal
    });
    return { ...res, ext: res.extension || extForMime(res.blob.type || mime) };
  } finally {
    scope.dispose();
  }
};

export const useImageStore = create<ImageStoreState>((set, get) => ({
  tool: 'watermark',
  items: [],
  selectedId: null,
  importing: false,
  logoName: '',
  logoBlob: null,

  watermark: { ...DEFAULT_WATERMARK },
  wmPresets: [],
  wmPresetsLoaded: false,

  redact: { ...DEFAULT_REDACT },
  redactDrawMode: 'redact',
  redactDetectMode: 'group',
  redactConfidence: 0.35,
  stickerName: '',
  facesByItemId: {},
  selectedFaceId: null,

  idPhoto: { ...DEFAULT_ID_PHOTO },
  portraitMaskByItemId: {},

  compress: { ...DEFAULT_COMPRESS },
  resize: { ...DEFAULT_RESIZE },
  transform: { ...DEFAULT_TRANSFORM },
  crop: { ...DEFAULT_CROP },
  stitch: { ...DEFAULT_STITCH },
  splitConfig: { ...DEFAULT_IMAGE_SPLIT },
  exportConfig: { ...DEFAULT_EXPORT },
  encodingByTool: {},
  undoByTool: {},

  setTool: (tool) => set((state) => switchImageTool(state, tool)),

  importFiles: async (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const notify = useAppStore.getState().notify;
    const batchGen = importGeneration;

    set({ importing: true });
    let added = 0;
    const errors: string[] = [];

    for (const file of files) {
      if (batchGen !== importGeneration) break;
      try {
        const decoded = await decodeImageFile(file);
        if (batchGen !== importGeneration) {
          decoded.dispose?.();
          break;
        }
        const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const item: ImageQueueItem = {
          id,
          name: decoded.sourceFile?.name || file.name,
          size: decoded.sourceFile?.size ?? file.size,
          decoded
        };
        set((state) => ({
          items: [...state.items, item],
          selectedId: state.selectedId ?? id
        }));
        added += 1;
      } catch (err) {
        if (batchGen !== importGeneration) break;
        errors.push(`${file.name}: ${err instanceof Error ? err.message : '导入失败'}`);
      }
    }

    set({ importing: false });
    if (batchGen !== importGeneration) return;
    if (errors.length) notify(errors[0], 'error');
    else if (added > 0) notify(`已导入 ${added} 张图片`, 'success');
  },

  importLogo: async (file) => {
    try {
      const decoded = await decodeImageFile(file);
      logoDisposeFn?.();
      logoDisposeFn = decoded.dispose ?? null;
      set((state) => ({
        logoName: file.name,
        logoBlob: decoded.file,
        watermark: { ...state.watermark, kind: 'image', logo: decoded.preview.image }
      }));
      useAppStore.getState().notify(`已载入水印图片：${file.name}`, 'success');
    } catch (err) {
      useAppStore.getState().notify(err instanceof Error ? err.message : 'Logo 读取失败', 'error');
    }
  },

  importSticker: async (file) => {
    try {
      const decoded = await decodeImageFile(file);
      stickerDisposeFn?.();
      stickerDisposeFn = decoded.dispose ?? null;
      set((state) => ({
        stickerName: file.name,
        redact: { ...state.redact, style: 'emoji', sticker: 'custom', stickerImage: decoded.preview.image }
      }));
      useAppStore.getState().notify(`已载入自定义贴纸：${file.name}`, 'success');
    } catch (err) {
      useAppStore.getState().notify(err instanceof Error ? err.message : '贴纸读取失败', 'error');
    }
  },

  selectItem: (id) =>
    set((state) => {
      if (id === state.selectedId) return {};
      if (state.crop.ratio > 0 && id) {
        const nextItem = state.items.find((i) => i.id === id);
        if (nextItem) {
          return {
            selectedId: id,
            selectedFaceId: null,
            crop: { ...state.crop, rect: getEngine().ImageCropper.cropForAspect(nextItem.decoded.dimensions, state.crop.ratio) }
          };
        }
      }
      return { selectedId: id, selectedFaceId: null };
    }),

  moveItem: (id, delta) => {
    const { items } = get();
    const idx = items.findIndex((item) => item.id === id);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    set({ items: next });
  },

  reorderByIds: (fromId, toId) => {
    if (fromId === toId) return;
    const { items } = get();
    const fromIdx = items.findIndex((i) => i.id === fromId);
    const toIdx = items.findIndex((i) => i.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...items];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    set({ items: next });
  },

  swapByIds: (firstId, secondId) => {
    if (firstId === secondId) return;
    const { items } = get();
    const a = items.findIndex((i) => i.id === firstId);
    const b = items.findIndex((i) => i.id === secondId);
    if (a < 0 || b < 0) return;
    const next = [...items];
    [next[a], next[b]] = [next[b], next[a]];
    set({ items: next });
  },

  removeItem: (id) => {
    const target = get().items.find((i) => i.id === id);
    target?.decoded.dispose?.();
    set((state) => {
      const next = state.items.filter((i) => i.id !== id);
      const nextFaces = { ...state.facesByItemId };
      delete nextFaces[id];
      const nextMasks = { ...state.portraitMaskByItemId };
      delete nextMasks[id];
      const nextSelected = state.selectedId === id ? next[0]?.id ?? null : state.selectedId;
      const nextItem = next.find((i) => i.id === nextSelected);
      const nextCrop =
        state.selectedId === id && state.crop.ratio > 0 && nextItem
          ? { ...state.crop, rect: getEngine().ImageCropper.cropForAspect(nextItem.decoded.dimensions, state.crop.ratio) }
          : state.crop;
      return {
        items: next,
        facesByItemId: nextFaces,
        portraitMaskByItemId: nextMasks,
        selectedFaceId: null,
        selectedId: nextSelected,
        crop: nextCrop
      };
    });
  },

  clearItems: () => {
    importGeneration += 1;
    get().items.forEach((i) => i.decoded.dispose?.());
    set({ items: [], selectedId: null, facesByItemId: {}, portraitMaskByItemId: {}, selectedFaceId: null });
    useAppStore.getState().notify('已清空图片队列');
  },

  // --- Watermark & IndexedDB Presets ---
  patchWatermark: (patch) => set((s) => ({ watermark: { ...s.watermark, ...patch } })),

  loadWatermarkPresets: async () => {
    try {
      const list = await getWatermarkStore().listPresets();
      set({ wmPresets: list, wmPresetsLoaded: true });
    } catch {
      set({ wmPresetsLoaded: true });
    }
  },

  saveWatermarkPreset: async (name) => {
    const s = get();
    const wm = s.watermark;
    const snapshot: WatermarkPresetSnapshot = {
      schemaVersion: 1,
      watermark: {
        kind: wm.kind,
        text: wm.text,
        font: wm.font,
        weight: wm.weight,
        color: wm.color,
        size: Math.round(wm.sizeRatio * 100),
        opacity: Math.round(wm.opacity * 100),
        rotation: wm.rotation,
        tile: wm.tile,
        density: Math.round(wm.density * 100),
        offsetX: Math.round(wm.offsetXRatio * 100),
        offsetY: Math.round(wm.offsetYRatio * 100),
        position: { ...wm.position }
      },
      output: {
        format: s.exportConfig.format,
        quality: Math.round(s.exportConfig.quality * 100)
      },
      logo: wm.kind === 'image' && s.logoBlob ? { name: s.logoName || 'logo.png', type: s.logoBlob.type || 'image/png', blob: s.logoBlob } : null
    };
    try {
      await getWatermarkStore().savePreset(name, snapshot);
      const list = await getWatermarkStore().listPresets();
      set({ wmPresets: list });
      useAppStore.getState().notify(`已保存水印预设：${name.trim()}`, 'success');
      return true;
    } catch (err) {
      useAppStore.getState().notify(err instanceof Error ? err.message : '预设保存失败', 'error');
      return false;
    }
  },

  applyWatermarkPreset: async (id) => {
    const record = get().wmPresets.find((p) => p.id === id);
    if (!record) return;
    const snap = record.snapshot;
    let logoImg: HTMLImageElement | null = get().watermark.logo;
    let logoName = get().logoName;
    let logoBlob = get().logoBlob;
    if (snap.watermark.kind === 'image' && !snap.logo?.blob.size) {
      useAppStore.getState().notify('这个预设缺少 Logo，请重新上传 Logo 后保存为新预设。', 'error');
      return;
    }

    if (snap.logo?.blob) {
      try {
        const logoFile = new File([snap.logo.blob], snap.logo.name, { type: snap.logo.type });
        const decoded = await decodeImageFile(logoFile);
        logoDisposeFn?.();
        logoDisposeFn = decoded.dispose ?? null;
        logoImg = decoded.preview.image;
        logoName = snap.logo.name;
        logoBlob = snap.logo.blob;
      } catch {
        useAppStore.getState().notify('预设中的 Logo 无法读取，请重新上传后再保存。', 'error');
        return;
      }
    }

    const encoding = { format: snap.output.format, quality: snap.output.quality / 100 };
    set((s) => ({
      logoName,
      logoBlob,
      watermark: {
        ...s.watermark,
        kind: snap.watermark.kind,
        text: snap.watermark.text,
        font: snap.watermark.font,
        weight: snap.watermark.weight,
        color: snap.watermark.color,
        sizeRatio: snap.watermark.size / 100,
        opacity: snap.watermark.opacity / 100,
        rotation: snap.watermark.rotation,
        tile: snap.watermark.tile,
        density: snap.watermark.density / 100,
        offsetXRatio: snap.watermark.offsetX / 100,
        offsetYRatio: snap.watermark.offsetY / 100,
        position: { ...snap.watermark.position },
        logo: snap.watermark.kind === 'image' ? logoImg : s.watermark.logo
      },
      ...(s.tool === 'watermark'
        ? { exportConfig: { ...s.exportConfig, ...encoding } }
        : { encodingByTool: { ...s.encodingByTool, watermark: encoding } })
    }));
    useAppStore.getState().notify(`已载入预设：${record.name}`, 'success');
  },

  deleteWatermarkPreset: async (id) => {
    try {
      await getWatermarkStore().deletePreset(id);
      const list = await getWatermarkStore().listPresets();
      set({ wmPresets: list });
      useAppStore.getState().notify('已删除预设');
    } catch (err) {
      useAppStore.getState().notify(err instanceof Error ? err.message : '删除失败', 'error');
    }
  },

  exportWatermarkPresets: async () => {
    try {
      const json = await getWatermarkStore().exportPresets();
      triggerBlobDownload(new Blob([json], { type: 'application/json' }), `${makeStamp('水印预设')}.json`);
      useAppStore.getState().notify('已导出全部水印预设 JSON', 'success');
    } catch (err) {
      useAppStore.getState().notify(err instanceof Error ? err.message : '导出失败', 'error');
    }
  },

  importWatermarkPresets: async (file) => {
    try {
      const text = await file.text();
      const count = await getWatermarkStore().importPresets(text);
      const list = await getWatermarkStore().listPresets();
      set({ wmPresets: list });
      useAppStore.getState().notify(`已导入 ${count} 条水印预设`, 'success');
    } catch (err) {
      useAppStore.getState().notify(err instanceof Error ? err.message : '导入预设失败', 'error');
    }
  },

  // --- Face Redaction ---
  patchRedact: (patch) => set((s) => ({ redact: { ...s.redact, ...patch } })),
  setRedactDrawMode: (mode) => set({ redactDrawMode: mode }),
  setRedactDetectMode: (redactDetectMode) => set({ redactDetectMode }),
  setRedactConfidence: (redactConfidence) => set({ redactConfidence }),
  setSelectedFaceId: (selectedFaceId) => set({ selectedFaceId }),

  detectFacesForCurrent: async () => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    const engine = getEngine();
    const mode = s.redactDetectMode;
    const confidence = s.redactConfidence;

    await useTaskStore.getState().runTask(
      { kind: 'image-face-detect', title: `识别人脸：${active.name}`, initialStage: '正在按需加载本地 AI 人脸模型…' },
      async ({ signal, report }) => {
        const detected = await engine.FaceDetector.detect(active.decoded.file, {
          mode,
          confidence,
          signal,
          onProgress: ({ phase, current, total }) => {
            report(
              phase === 'detect' ? `正在扫描人脸区域 ${current}/${total}…` : `正在识别表情 ${current}/${total}…`,
              { current, total }
            );
          }
        });
        set((prev) => {
          const manualOnly = (prev.facesByItemId[active.id] ?? []).filter((f) => f.source === 'manual');
          const merged = [...detected, ...manualOnly];
          return {
            facesByItemId: { ...prev.facesByItemId, [active.id]: merged },
            selectedFaceId: detected[0]?.id ?? manualOnly[0]?.id ?? null
          };
        });
        const msg = detected.length
          ? `识别到 ${detected.length} 张人脸${detected.some((f) => f.expressionReliable) ? '（含表情识别）' : ''}`
          : '未自动识别到人脸，可直接在画布上框选添加';
        useAppStore.getState().notify(msg, detected.length ? 'success' : 'info');
        return { summary: msg };
      }
    );
  },

  addManualFace: (rect, kindOverride) => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    const kind = kindOverride || s.redactDrawMode || 'redact';
    const defaultRect =
      kind === 'bar'
        ? { x: 0.25, y: 0.45, width: 0.5, height: 0.08 }
        : kind === 'arrow'
          ? { x: 0.3, y: 0.35, width: 0.28, height: 0.16, x1: 0.3, y1: 0.35, x2: 0.58, y2: 0.51 }
          : kind === 'highlight'
            ? { x: 0.3, y: 0.35, width: 0.36, height: 0.2 }
            : { x: 0.38, y: 0.34, width: 0.24, height: 0.28 };
    const merged = { ...defaultRect, ...rect };
    const box = getEngine().FaceRedactor.normalizeBox({
      id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      x: merged.x,
      y: merged.y,
      width: merged.width,
      height: merged.height,
      ...(kind === 'arrow'
        ? {
            x1: merged.x1 ?? merged.x,
            y1: merged.y1 ?? merged.y,
            x2: merged.x2 ?? merged.x + merged.width,
            y2: merged.y2 ?? merged.y + merged.height
          }
        : {}),
      ...(kind === 'highlight' || kind === 'arrow'
        ? {
            strokeColor: s.redact.annotationColor || '#ef4444',
            strokeWidth: s.redact.annotationWidth || 5
          }
        : {}),
      ...(kind === 'bar'
        ? {
            barStyle: s.redact.style === 'emoji' ? 'solid' : s.redact.style,
            color: s.redact.color
          }
        : {}),
      enabled: true,
      source: 'manual',
      expression: 'neutral',
      expressionReliable: false,
      expressionOverride: ''
    });
    set((prev) => ({
      facesByItemId: {
        ...prev.facesByItemId,
        [active.id]: [...(prev.facesByItemId[active.id] ?? []), box]
      },
      selectedFaceId: box.id
    }));
  },

  updateFace: (faceId, patch) => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    const list = s.facesByItemId[active.id] ?? [];
    set({
      facesByItemId: {
        ...s.facesByItemId,
        [active.id]: list.map((f) => (f.id === faceId ? getEngine().FaceRedactor.normalizeBox({ ...f, ...patch }) : f))
      }
    });
  },

  removeFace: (faceId) => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    const next = (s.facesByItemId[active.id] ?? []).filter((f) => f.id !== faceId);
    set({
      facesByItemId: { ...s.facesByItemId, [active.id]: next },
      selectedFaceId: s.selectedFaceId === faceId ? next[0]?.id ?? null : s.selectedFaceId
    });
  },

  clearFacesForCurrent: () => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    set({
      facesByItemId: { ...s.facesByItemId, [active.id]: [] },
      selectedFaceId: null
    });
    useAppStore.getState().notify('已清空当前图片的打码与标注区域');
  },

  patchIdPhoto: (patch) => set((s) => ({ idPhoto: { ...s.idPhoto, ...patch } })),

  segmentPortraitForCurrent: async () => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    const engine = getEngine();
    await useTaskStore.getState().runTask(
      { kind: 'image-id-photo', title: `AI 人像抠图：${active.name}`, initialStage: '正在加载本地 AI 抠图模型…' },
      async ({ signal, report }) => {
        report('正在分离人像与背景…');
        const mask = await engine.PortraitSegmenter.segmentPortrait(active.decoded.file, { signal });
        set((prev) => ({
          portraitMaskByItemId: { ...prev.portraitMaskByItemId, [active.id]: mask }
        }));
        useAppStore.getState().notify('本地 AI 抠图完成，可自由切换底色与证件照尺寸', 'success');
        return { summary: `抠图完成（${mask.width}×${mask.height} 遮罩）` };
      }
    );
  },

  clearPortraitMaskForCurrent: () => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    const next = { ...s.portraitMaskByItemId };
    delete next[active.id];
    set({ portraitMaskByItemId: next });
    useAppStore.getState().notify('已清除当前图片的抠图结果');
  },

  patchCompress: (patch) =>
    set((s) => {
      const nextCompress = { ...s.compress, ...patch };
      if (patch.profile && patch.profile !== 'custom' && patch.profile !== 'target') {
        const prof = getEngine().CompressionModel.profiles[patch.profile];
        if (prof) {
          return {
            compress: { ...nextCompress, maxEdge: prof.maxEdge },
            exportConfig: { ...s.exportConfig, format: 'image/jpeg', quality: prof.quality / 100 }
          };
        }
      }
      if (patch.profile === 'target' && s.exportConfig.format === 'image/png') {
        return {
          compress: nextCompress,
          exportConfig: { ...s.exportConfig, format: 'image/jpeg' }
        };
      }
      return { compress: nextCompress };
    }),
  patchResize: (patch) => set((s) => ({
    resize: {
      ...s.resize,
      ...(patch.mode === 'percent' && s.resize.mode !== 'percent' ? { value: 100 } : {}),
      ...patch
    }
  })),
  patchTransform: (patch) => set((s) => ({ transform: { ...s.transform, ...patch } })),
  patchCrop: (patch) => set((s) => ({ crop: { ...s.crop, ...patch } })),
  patchStitch: (patch) => set((s) => ({ stitch: { ...s.stitch, ...patch } })),
  patchSplitConfig: (patch) => set((s) => ({ splitConfig: { ...s.splitConfig, ...patch } })),
  patchExportConfig: (patch) => set((s) => ({ exportConfig: { ...s.exportConfig, ...patch } })),

  resetCurrentTool: () => {
    const s = get();
    const t = s.tool;
    const snap =
      t === 'watermark'
        ? { ...s.watermark }
        : t === 'redact'
          ? { ...s.redact }
          : t === 'id-photo'
            ? { ...s.idPhoto }
            : t === 'compress'
            ? { compress: { ...s.compress }, format: s.exportConfig.format, quality: s.exportConfig.quality }
            : t === 'resize'
              ? { ...s.resize }
              : t === 'transform'
                ? { ...s.transform }
                : t === 'crop'
                  ? { ...s.crop }
                  : t === 'stitch'
                    ? { ...s.stitch }
                    : t === 'split'
                      ? { ...s.splitConfig }
                      : { ...s.exportConfig };

    const nextUndo = { ...s.undoByTool, [t]: snap };
    if (t === 'watermark') {
      set({
        undoByTool: nextUndo,
        watermark: { ...DEFAULT_WATERMARK, text: s.watermark.text, logo: s.watermark.logo, kind: s.watermark.kind }
      });
      useAppStore.getState().notify('已重置水印外观与位置（保留已输入文字）');
    } else if (t === 'redact') {
      set({ undoByTool: nextUndo, redact: { ...DEFAULT_REDACT } });
      useAppStore.getState().notify('已重置打码与标注参数');
    } else if (t === 'id-photo') {
      set({ undoByTool: nextUndo, idPhoto: { ...DEFAULT_ID_PHOTO } });
      useAppStore.getState().notify('已重置证件照底色与构图');
    } else if (t === 'compress') {
      set({
        undoByTool: nextUndo,
        compress: { ...DEFAULT_COMPRESS },
        exportConfig: { ...s.exportConfig, format: 'image/jpeg', quality: 0.82 }
      });
      useAppStore.getState().notify('已重置压缩参数');
    } else if (t === 'resize') {
      set({ undoByTool: nextUndo, resize: { ...DEFAULT_RESIZE } });
      useAppStore.getState().notify('已重置尺寸参数');
    } else if (t === 'transform') {
      set({ undoByTool: nextUndo, transform: { ...DEFAULT_TRANSFORM } });
      useAppStore.getState().notify('已重置旋转与翻转');
    } else if (t === 'crop') {
      set({ undoByTool: nextUndo, crop: { ...DEFAULT_CROP } });
      useAppStore.getState().notify('已恢复裁剪区域');
    } else if (t === 'stitch') {
      set({ undoByTool: nextUndo, stitch: { ...DEFAULT_STITCH, title: s.stitch.title } });
      useAppStore.getState().notify('已重置拼图参数');
    } else if (t === 'split') {
      set({ undoByTool: nextUndo, splitConfig: { ...DEFAULT_IMAGE_SPLIT } });
      useAppStore.getState().notify('已恢复自动检测切割线');
    } else {
      set({ undoByTool: nextUndo, exportConfig: { ...DEFAULT_EXPORT } });
      useAppStore.getState().notify('已重置转换参数');
    }
  },

  undoResetCurrentTool: () => {
    const s = get();
    const t = s.tool;
    const snap = s.undoByTool[t];
    if (!snap) return;
    const nextUndo = { ...s.undoByTool };
    delete nextUndo[t];
    if (t === 'watermark') set({ undoByTool: nextUndo, watermark: snap as WatermarkOptions });
    else if (t === 'redact') set({ undoByTool: nextUndo, redact: snap as FaceRedactionOptions });
    else if (t === 'id-photo') set({ undoByTool: nextUndo, idPhoto: snap as IdPhotoConfig });
    else if (t === 'compress') {
      const cSnap = snap as { compress: CompressConfig; format: ImageExportConfig['format']; quality: number };
      set({
        undoByTool: nextUndo,
        compress: cSnap.compress,
        exportConfig: { ...s.exportConfig, format: cSnap.format, quality: cSnap.quality }
      });
    }
    else if (t === 'resize') set({ undoByTool: nextUndo, resize: snap as ResizeConfig });
    else if (t === 'transform') set({ undoByTool: nextUndo, transform: snap as TransformConfig });
    else if (t === 'crop') set({ undoByTool: nextUndo, crop: snap as CropConfig });
    else if (t === 'stitch') set({ undoByTool: nextUndo, stitch: snap as StitchOptions });
    else if (t === 'split') set({ undoByTool: nextUndo, splitConfig: snap as ImageSplitConfig });
    else set({ undoByTool: nextUndo, exportConfig: snap as ImageExportConfig });
    useAppStore.getState().notify('已撤销重置');
  },

  // --- Stitch Project Save / Open ---
  saveStitchProject: async () => {
    const s = get();
    if (!s.items.length) return;
    const engine = getEngine();
    const filename = cleanName(s.exportConfig.filename, makeStamp('拼图工程'), 'zip');

    await useTaskStore.getState().runTask(
      { kind: 'image-project', title: `保存拼图工程（${s.items.length} 张）`, initialStage: '正在打包原图与排版参数…' },
      async ({ signal }) => {
        const blob = await engine.StitchProject.create(
          s.items.map((i) => ({ image: i.decoded })),
          { ...s.stitch, type: s.exportConfig.format, quality: s.exportConfig.quality },
          { signal }
        );
        useAppStore.getState().notify(`拼图工程已保存：${filename}`, 'success');
        return { summary: `${s.items.length} 张原图 + 参数 · ${formatBytes(blob.size)}`, downloadBlob: blob, downloadName: filename };
      }
    );
  },

  openStitchProject: async (file) => {
    const engine = getEngine();
    await useTaskStore.getState().runTask(
      { kind: 'image-project', title: `打开拼图工程：${file.name}`, initialStage: '正在解析工程文件…' },
      async ({ signal, report }) => {
        const project = await engine.StitchProject.read(file, { signal });
        const nextItems: ImageQueueItem[] = [];
        try {
          for (let i = 0; i < project.assets.length; i += 1) {
            if (signal.aborted) throw new DOMException('任务已取消', 'AbortError');
            const a = project.assets[i];
            report(`正在载入原图 ${i + 1}/${project.assets.length}…`, { current: i + 1, total: project.assets.length });
            const f = new File([a.blob], a.name, { type: a.type, lastModified: a.lastModified || Date.now() });
            const decoded = await decodeImageFile(f, signal);
            nextItems.push({
              id: `img_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
              name: a.name,
              size: f.size,
              decoded
            });
          }
        } catch (err) {
          nextItems.forEach((it) => it.decoded.dispose?.());
          throw err;
        }
        // Release old items only after full project decode succeeds
        importGeneration += 1;
        get().items.forEach((old) => old.decoded.dispose?.());
        const fmt = (['image/png', 'image/jpeg', 'image/webp'].includes(project.settings.type)
          ? project.settings.type
          : 'image/png') as ImageExportConfig['format'];
        set((state) => ({
          ...switchImageTool(state, 'stitch'),
          items: nextItems,
          selectedId: nextItems[0]?.id ?? null,
          facesByItemId: {},
          selectedFaceId: null,
          stitch: { ...DEFAULT_STITCH, ...project.settings },
          exportConfig: {
            ...state.exportConfig,
            format: fmt,
            quality: project.settings.quality || 0.92
          }
        }));
        useAppStore.getState().notify(`已还原拼图工程（${nextItems.length} 张原图）`, 'success');
        return { summary: `已载入 ${nextItems.length} 张图片及排版设置` };
      }
    );
  },

  // --- Image Split / Collage Unpack ---
  runSplitExportZip: async () => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    const engine = getEngine();
    const zipName = cleanName(s.exportConfig.filename, `${stemOf(active.name)}-切片`, 'zip');

    await useTaskStore.getState().runTask(
      { kind: 'image-split', title: `切割图片：${active.name}`, initialStage: '正在识别网格并切分…' },
      async ({ signal, report }) => {
        const scope = new engine.ResourceScope();
        try {
          const res = await engine.ImageSplitter.splitFile({
            file: active.decoded.file,
            rows: s.splitConfig.rows,
            columns: s.splitConfig.columns,
            rowPattern: s.splitConfig.rowPattern,
            scope,
            signal,
            onProgress: (c, t) => report(`正在切割第 ${c}/${t} 张…`, { current: c, total: t })
          });
          report('正在打包 ZIP…');
          const zipBlob = await engine.ZipArchive.createZip(
            res.files.map((f) => ({ name: f.name, blob: f })),
            { signal }
          );
          useAppStore.getState().notify(`已切割 ${res.files.length} 张并打包：${zipName}`, 'success');
          return {
            summary: `${res.files.length} 张切片（${res.rowPattern}） · ZIP ${formatBytes(zipBlob.size)}`,
            downloadBlob: zipBlob,
            downloadName: zipName
          };
        } finally {
          scope.dispose();
        }
      }
    );
  },

  runSplitIntoQueue: async () => {
    const s = get();
    const active = s.items.find((i) => i.id === s.selectedId) ?? s.items[0];
    if (!active) return;
    const engine = getEngine();

    await useTaskStore.getState().runTask(
      { kind: 'image-split', title: `拆散进队列：${active.name}`, initialStage: '正在识别网格并拆散…' },
      async ({ signal, report }) => {
        const scope = new engine.ResourceScope();
        try {
          const res = await engine.ImageSplitter.splitFile({
            file: active.decoded.file,
            rows: s.splitConfig.rows,
            columns: s.splitConfig.columns,
            rowPattern: s.splitConfig.rowPattern,
            scope,
            signal,
            onProgress: (c, t) => report(`正在拆散第 ${c}/${t} 张…`, { current: c, total: t })
          });
          const nextItems: ImageQueueItem[] = [];
          try {
            for (let i = 0; i < res.files.length; i += 1) {
              if (signal.aborted) throw new DOMException('任务已取消', 'AbortError');
              report(`正在导入切片 ${i + 1}/${res.files.length}…`, { current: i + 1, total: res.files.length });
              const decoded = await decodeImageFile(res.files[i], signal);
              nextItems.push({
                id: `img_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                name: res.files[i].name,
                size: res.files[i].size,
                decoded
              });
            }
          } catch (err) {
            nextItems.forEach((it) => it.decoded.dispose?.());
            throw err;
          }
          importGeneration += 1;
          get().items.forEach((old) => old.decoded.dispose?.());
          set((state) => ({
            ...switchImageTool(state, 'stitch'),
            items: nextItems,
            selectedId: nextItems[0]?.id ?? null,
            facesByItemId: {},
            selectedFaceId: null
          }));
          useAppStore.getState().notify(`已拆散为 ${nextItems.length} 张单图并切到拼图工作台`, 'success');
          return { summary: `已拆散为 ${nextItems.length} 张单图（${res.rowPattern}）` };
        } finally {
          scope.dispose();
        }
      }
    );
  },

  exportCurrent: async () => {
    const state = get();
    if (!state.items.length || !canStartImageOutput(state)) return;
    if (state.tool === 'split') {
      await get().runSplitExportZip();
      return;
    }
    const engine = getEngine();
    const ext = extForMime(state.exportConfig.format);

    if (state.tool === 'stitch') {
      const filename = cleanName(state.exportConfig.filename, makeStamp('拼图'), ext);
      const totalBytes = state.items.reduce((sum, i) => sum + i.size, 0);
      await useTaskStore.getState().runTask(
        { kind: 'image-export', title: `导出拼图（${ext.toUpperCase()}）`, initialStage: '正在拼接原图…' },
        async ({ signal, report }) => {
          const scope = new engine.ResourceScope();
          try {
            const res = await engine.ImageStitcher.stitchImages({
              images: state.items.map((i) => i.decoded),
              options: {
                ...state.stitch,
                rowPattern: state.stitch.mode === 'grid' ? state.stitch.rowPattern : '',
                type: state.exportConfig.format,
                quality: state.exportConfig.quality
              },
              scope,
              signal,
              onProgress: (c, t) => report(`正在拼接 ${c}/${t} 张…`, { current: c, total: t })
            });
            useAppStore.getState().notify(`拼图已导出：${filename}`, 'success');
            return {
              summary: `${state.items.length} 张 · ${res.width}×${res.height} · ${formatBytes(totalBytes)} → ${formatBytes(res.blob.size)}`,
              downloadBlob: res.blob,
              downloadName: filename
            };
          } finally {
            scope.dispose();
          }
        }
      );
      return;
    }

    const active = state.items.find((i) => i.id === state.selectedId) ?? state.items[0];
    if (!active) return;

    await useTaskStore.getState().runTask(
      { kind: 'image-export', title: `导出 ${active.name}`, initialStage: '正在处理原图…' },
      async ({ signal }) => {
        const res = await processSingleItem(active, state, undefined, signal);
        const filename = `${stemOf(active.name)}.${res.ext}`;
        const delta = active.size ? Math.round((1 - res.blob.size / active.size) * 100) : 0;
        useAppStore.getState().notify(`已导出：${filename}`, 'success');
        return {
          summary: res.note
            ? `${res.note} · ${formatBytes(active.size)} → ${formatBytes(res.blob.size)}`
            : `${res.width}×${res.height} · ${formatBytes(active.size)} → ${formatBytes(res.blob.size)}${delta > 0 ? `（-${delta}%）` : ''}`,
          downloadBlob: res.blob,
          downloadName: filename
        };
      }
    );
  },

  exportBatch: async () => {
    const state = get();
    if (state.items.length < 2 || state.tool === 'stitch' || state.tool === 'split' || !canStartImageOutput(state)) return;
    const engine = getEngine();
    const asZip = state.exportConfig.batchZip;

    await useTaskStore.getState().runTask(
      {
        kind: 'image-batch',
        title: asZip ? `批量打包 ${state.items.length} 张（ZIP）` : `批量导出 ${state.items.length} 张`,
        initialStage: '正在逐张处理…'
      },
      async ({ signal, report }) => {
        const outputs: { name: string; blob: Blob }[] = [];
        const failed: string[] = [];
        const usedNames = new Set<string>();
        const uniqueName = (base: string, ext: string) => {
          let candidate = `${base}.${ext}`;
          let idx = 2;
          while (usedNames.has(candidate)) candidate = `${base}-${idx++}.${ext}`;
          usedNames.add(candidate);
          return candidate;
        };

        for (let i = 0; i < state.items.length; i += 1) {
          if (signal.aborted) throw new DOMException('任务已取消', 'AbortError');
          const item = state.items[i];
          report(`正在处理 ${i + 1}/${state.items.length}：${item.name}`, { current: i + 1, total: state.items.length });
          try {
            const res = await processSingleItem(item, state, undefined, signal);
            const name = uniqueName(stemOf(item.name), res.ext);
            outputs.push({ name, blob: res.blob });
            if (!asZip) triggerBlobDownload(res.blob, name);
          } catch (err) {
            if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) throw err;
            failed.push(item.name);
          }
        }

        if (!outputs.length) {
          throw new Error(`全部 ${failed.length} 张图片处理失败，请检查文件或参数后重试。`);
        }

        const failSuffix = failed.length ? `（跳过 ${failed.length} 张失败：${failed.slice(0, 2).join('、')}${failed.length > 2 ? '…' : ''}）` : '';

        if (asZip) {
          report('正在打包 ZIP…');
          const zipBlob = await engine.ZipArchive.createZip(outputs, { signal });
          const zipName = cleanName(state.exportConfig.filename, makeStamp('批量图片'), 'zip');
          useAppStore.getState().notify(`已打包 ${outputs.length} 张图片：${zipName}${failSuffix}`, failed.length ? 'info' : 'success');
          return {
            summary: `${outputs.length} 张成功 · ZIP ${formatBytes(zipBlob.size)}${failSuffix}`,
            downloadBlob: zipBlob,
            downloadName: zipName
          };
        }

        useAppStore.getState().notify(`已分别导出 ${outputs.length} 张图片${failSuffix}`, failed.length ? 'info' : 'success');
        return { summary: `已分别下载 ${outputs.length} 张图片${failSuffix}` };
      }
    );
  },

  copyCurrentPng: async () => {
    const state = get();
    if (!state.items.length || state.tool === 'split' || !canStartImageOutput(state)) return;
    const engine = getEngine();
    const { copyMaxEdge: maxEdge, copyFormat } = useAppStore.getState();
    const label = copyFormat === 'image/jpeg' ? 'JPG' : 'PNG';

    await useTaskStore.getState().runTask(
      { kind: 'image-copy', title: `复制 ${label} 到剪贴板`, initialStage: `正在生成 ${label}…` },
      async ({ signal }) => {
        let blob: Blob;

        if (state.tool === 'stitch') {
          const scope = new engine.ResourceScope();
          try {
            const res = await engine.ImageStitcher.stitchImages({
              images: state.items.map((i) => i.decoded),
              options: {
                ...state.stitch,
                rowPattern: state.stitch.mode === 'grid' ? state.stitch.rowPattern : '',
                type: 'image/png',
                quality: 1
              },
              scope,
              signal
            });
            blob = res.blob;
          } finally {
            scope.dispose();
          }
        } else {
          const active = state.items.find((i) => i.id === state.selectedId) ?? state.items[0];
          const res = await processSingleItem(active, state, 'image/png', signal);
          blob = res.blob;
        }

        const copied = await copyImageToClipboard({
          sourceBlob: blob,
          format: copyFormat,
          quality: state.exportConfig.quality,
          maxEdge,
          signal
        });

        const msg =
          copied.mode === 'jpeg-native'
            ? `已复制 JPG · ${formatBytes(copied.bytes)}`
            : copied.mode === 'jpeg-hybrid'
              ? `已复制（JPG ${formatBytes(copied.bytes)} + 兼容 PNG）`
              : `已复制 PNG · ${formatBytes(copied.bytes)}`;
        useAppStore.getState().notify(msg, 'success');
        return { summary: msg };
      }
    );
  }
}));
