// Thin typed ESM bridge over the proven local processing engines in src/engine/.
// Heavy libraries (pdfjs-dist, pdf-lib, heic2any, @mediapipe/tasks-vision + WASM/models) are loaded strictly on demand.

import '../engine/core/resource-scope.js';
import '../engine/core/workload-policy.js';
import '../engine/core/file-validator.js';
import '../engine/core/clipboard.js';
import '../engine/core/zip-archive.js';
import '../engine/storage/watermark-store.js';
import '../engine/image/watermark-model.js';
import '../engine/image/watermark-renderer.js';
import '../engine/image/image-decoder.js';
import '../engine/image/image-processor.js';
import '../engine/image/image-exporter.js';
import '../engine/image/compression-model.js';
import '../engine/image/image-compressor.js';
import '../engine/image/image-converter.js';
import '../engine/image/image-resizer.js';
import '../engine/image/image-transformer.js';
import '../engine/image/image-cropper.js';
import '../engine/image/image-stitcher.js';
import '../engine/image/stitch-project.js';
import '../engine/image/image-splitter.js';
import '../engine/image/face-expression.js';
import '../engine/image/face-detector.js';
import '../engine/image/face-redactor.js';
import '../engine/pdf/page-range.js';
import '../engine/pdf/pdf-runtime.js';
import '../engine/pdf/pdf-processor.js';
import '../engine/pdf/id-card-sheet.js';

export interface DecodedImage {
  file: File;
  sourceFile: File;
  dimensions: { width: number; height: number };
  preview: {
    width: number;
    height: number;
    scale: number;
    image: HTMLImageElement;
    url: string;
  };
  policy: { warning?: string };
  dispose?: () => void;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WatermarkOptions {
  kind: 'text' | 'image';
  text: string;
  font: string;
  weight: string;
  color: string;
  sizeRatio: number;
  opacity: number;
  rotation: number;
  tile: boolean;
  density: number;
  offsetXRatio: number;
  offsetYRatio: number;
  position: { xRatio: number; yRatio: number };
  logo: HTMLImageElement | null;
}

export interface WatermarkPresetSnapshot {
  schemaVersion: number;
  watermark: {
    kind: 'text' | 'image';
    text: string;
    font: string;
    weight: string;
    color: string;
    size: number;
    opacity: number;
    rotation: number;
    tile: boolean;
    density: number;
    offsetX: number;
    offsetY: number;
    position: { xRatio: number; yRatio: number };
  };
  output: {
    format: 'image/jpeg' | 'image/png' | 'image/webp';
    quality: number;
  };
  logo: { name: string; type: string; blob: Blob } | null;
}

export interface WatermarkPresetRecord {
  id: string;
  name: string;
  snapshot: WatermarkPresetSnapshot;
  createdAt: number;
  updatedAt: number;
}

export interface FaceBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  source: 'auto' | 'manual';
  confidence?: number | null;
  expression?: string;
  expressionConfidence?: number;
  expressionReliable?: boolean;
  expressionReason?: string;
  expressionOverride?: string;
}

export interface FaceRedactionOptions {
  style: 'mosaic' | 'blur' | 'solid' | 'emoji';
  shape: 'ellipse' | 'rect';
  strength: number;
  margin: number;
  color: string;
  emoji: string;
  sticker: string;
  stickerImage: HTMLImageElement | null;
  expressionMode: string;
}

export interface SplitRect {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  column: number;
}

export interface SplitAnalysis {
  rects: SplitRect[];
  rows: number;
  columns: number;
  rowCounts: number[];
  rowPattern: string;
  automatic: boolean;
}

export interface StitchLayoutItem {
  image: DecodedImage;
  x: number;
  y: number;
  width: number;
  height: number;
  clip?: boolean;
  draw: { x: number; y: number; width: number; height: number };
}

export interface StitchLayout {
  width: number;
  height: number;
  columns?: number;
  rows?: number;
  items: StitchLayoutItem[];
}

export interface StitchOptions {
  mode: 'vertical' | 'horizontal' | 'grid';
  size: number;
  columns: number;
  rowPattern: string;
  cellSizeMode: 'custom' | 'original';
  originalScale?: number;
  cellRatio: string | number;
  fit: 'contain' | 'cover';
  incompleteRow: 'last' | 'first';
  gapX: number;
  gapY: number;
  background: string;
  type: 'image/png' | 'image/jpeg' | 'image/webp';
  quality: number;
  title: string;
  description: string;
  titleSize: number;
  descriptionSize: number;
  headerColor: string;
  headerAlign: 'left' | 'center';
  headerPosition: 'top' | 'bottom';
  headerPadding: number;
}

export interface PdfSessionLike {
  id: string;
  file: File;
  numPages: number;
  passwordProtected: boolean;
  metadata: { title?: string; author?: string };
  renderPage: (
    pageNumber: number,
    canvas: HTMLCanvasElement,
    options?: Record<string, unknown>
  ) => Promise<{ width: number; height: number; cssWidth: number; cssHeight: number }>;
  dispose: () => Promise<void>;
}

export interface IdCardSheetOptions {
  sizeMode: 'card' | 'custom' | 'fit';
  customWidthMm: number;
  gapMm: number;
  watermark: {
    enabled: boolean;
    text: string;
    color: string;
    scope: 'cards' | 'page';
    opacity: number;
    rotation: number;
    fontPt: number;
  };
}

export interface IdCardSheetLayout {
  page: { width: number; height: number };
  cards: { x: number; y: number; width: number; height: number }[];
  shrunk: boolean;
}

export interface ResourceScopeLike {
  dispose: () => void;
  releaseIntermediate: () => void;
}

interface ToolboxGlobal {
  ResourceScope: new () => ResourceScopeLike;
  WorkloadPolicy: {
    getPolicy: (info: { width: number; height: number; fileSize: number }) => { warning?: string };
  };
  FileValidator: { validateImageFile: (file: File) => void };
  Clipboard: { copyPng: (blob: Blob) => Promise<void> };
  ZipArchive: {
    createZip: (
      files: { name: string; blob: Blob }[],
      options?: { signal?: AbortSignal }
    ) => Promise<Blob>;
  };
  WatermarkStore: {
    WatermarkStore: new () => {
      listPresets: () => Promise<WatermarkPresetRecord[]>;
      savePreset: (name: string, snapshot: WatermarkPresetSnapshot, id?: string | null) => Promise<WatermarkPresetRecord>;
      deletePreset: (id: string) => Promise<void>;
      exportPresets: () => Promise<string>;
      importPresets: (json: string) => Promise<number>;
    };
  };
  WatermarkModel: {
    positionForAnchor: (index: number) => { xRatio: number; yRatio: number };
  };
  WatermarkRenderer: {
    renderWatermark: (ctx: CanvasRenderingContext2D, width: number, height: number, options: WatermarkOptions) => void;
  };
  ImageDecoder: {
    normalizeFile: (file: File, signal?: AbortSignal) => Promise<File>;
    decodeBitmap: (file: File, scope: ResourceScopeLike, signal?: AbortSignal) => Promise<ImageBitmap>;
    createPreview: (
      source: ImageBitmap,
      policy: { warning?: string },
      scope: ResourceScopeLike,
      signal?: AbortSignal
    ) => Promise<{ image: HTMLImageElement; width: number; height: number; scale: number }>;
  };
  ImageExporter: {
    exportWatermarkedImage: (params: {
      file: File;
      options: WatermarkOptions;
      type: string;
      quality?: number;
      outputSize: { width: number; height: number };
      scope: ResourceScopeLike;
      signal?: AbortSignal;
    }) => Promise<{ blob: Blob; width: number; height: number }>;
  };
  CompressionModel: {
    profiles: Record<string, { label: string; quality: number; maxEdge: number }>;
    resolveType: (inputType: string, requestedType: string) => string;
    getOutputSize: (w: number, h: number, maxEdge: number) => { width: number; height: number; scale: number };
    explain: (info: { inputType: string; outputType: string; dimensions: { width: number; height: number; scale: number } }) => string;
  };
  ImageCompressor: {
    compressImage: (params: {
      file: File;
      dimensions: { width: number; height: number };
      options: { type: string; quality: number; maxEdge: number };
      scope: ResourceScopeLike;
      signal?: AbortSignal;
    }) => Promise<{ blob: Blob; width: number; height: number; outputType: string }>;
  };
  ImageConverter: {
    convertImage: (params: {
      file: File;
      dimensions: { width: number; height: number };
      type: string;
      quality?: number;
      background?: string;
      scope: ResourceScopeLike;
      signal?: AbortSignal;
    }) => Promise<{ blob: Blob; width: number; height: number }>;
  };
  ImageResizer: {
    sizeFor: (
      source: { width: number; height: number },
      mode: string,
      value: number,
      width: number,
      height: number,
      keepRatio: boolean
    ) => { width: number; height: number };
    resizeImage: (params: {
      file: File;
      dimensions: { width: number; height: number };
      options: { mode: string; value: number; width: number; height: number; keepRatio: boolean };
      type: string;
      quality?: number;
      scope: ResourceScopeLike;
      signal?: AbortSignal;
    }) => Promise<{ blob: Blob; width: number; height: number }>;
  };
  ImageTransformer: {
    transformImage: (params: {
      file: File;
      dimensions: { width: number; height: number };
      options: { rotation: number; flipX: boolean; flipY: boolean };
      type: string;
      quality?: number;
      scope: ResourceScopeLike;
      signal?: AbortSignal;
    }) => Promise<{ blob: Blob; width: number; height: number }>;
  };
  ImageCropper: {
    normalizeCrop: (crop: CropRect, dimensions: { width: number; height: number }) => CropRect;
    cropSize: (dimensions: { width: number; height: number }, crop: CropRect) => { width: number; height: number };
    cropForAspect: (dimensions: { width: number; height: number }, ratio: number) => CropRect;
    cropImage: (params: {
      file: File;
      dimensions: { width: number; height: number };
      crop: CropRect;
      type: string;
      quality?: number;
      scope: ResourceScopeLike;
      signal?: AbortSignal;
    }) => Promise<{ blob: Blob; width: number; height: number }>;
  };
  ImageStitcher: {
    normalizeOptions: (opts: Partial<StitchOptions>) => StitchOptions;
    layoutFor: (images: DecodedImage[], opts: Partial<StitchOptions>) => StitchLayout;
    drawHeader: (ctx: CanvasRenderingContext2D, layout: StitchLayout) => void;
    drawItem: (ctx: CanvasRenderingContext2D, source: CanvasImageSource, item: StitchLayoutItem) => void;
    stitchImages: (params: {
      images: DecodedImage[];
      options: Partial<StitchOptions>;
      scope: ResourceScopeLike;
      signal?: AbortSignal;
      onStage?: (stage: string) => void;
      onProgress?: (current: number, total: number) => void;
    }) => Promise<{ blob: Blob; width: number; height: number; extension: string; layout: StitchLayout }>;
  };
  StitchProject: {
    create: (
      entries: { image: DecodedImage }[],
      settings: Partial<StitchOptions>,
      options?: { signal?: AbortSignal }
    ) => Promise<Blob>;
    read: (
      file: File,
      options?: { signal?: AbortSignal }
    ) => Promise<{
      settings: StitchOptions;
      assets: { path: string; name: string; type: string; size: number; lastModified: number; blob: Blob }[];
      savedAt: string;
    }>;
  };
  ImageSplitter: {
    analyze: (
      imageData: ImageData,
      options?: { rows?: number; columns?: number; rowPattern?: string; maxPieces?: number }
    ) => SplitAnalysis;
    splitFile: (params: {
      file: File;
      rows?: number;
      columns?: number;
      rowPattern?: string;
      scope: ResourceScopeLike;
      signal?: AbortSignal;
      onProgress?: (current: number, total: number) => void;
    }) => Promise<{ files: File[]; rows: number; columns: number; rowCounts: number[]; rowPattern: string; automatic: boolean }>;
  };
  FaceExpression: {
    expressions: { id: string; name: string; emoji: string }[];
    normalize: (val: string) => string;
    nameFor: (val: string) => string;
    emojiFor: (val: string) => string;
  };
  FaceDetector: {
    embeddedAssetsReady: () => boolean;
    detect: (
      source: Blob | HTMLImageElement | HTMLCanvasElement,
      options?: {
        confidence?: number;
        mode?: 'standard' | 'group';
        signal?: AbortSignal;
        onProgress?: (info: { phase: 'detect' | 'expression'; current: number; total: number; grid?: number }) => void;
      }
    ) => Promise<FaceBox[]>;
    close: () => Promise<void>;
  };
  FaceRedactor: {
    emojiPresets: string[];
    stickerPresets: { id: string; name: string }[];
    normalizeBox: (box: Partial<FaceBox>) => FaceBox;
    normalizeOptions: (opts: Partial<FaceRedactionOptions>) => FaceRedactionOptions;
    expandedBox: (box: FaceBox, margin: number) => FaceBox;
    drawRedactions: (
      ctx: CanvasRenderingContext2D,
      source: CanvasImageSource,
      width: number,
      height: number,
      faces: FaceBox[],
      options: Partial<FaceRedactionOptions>
    ) => void;
    processImage: (params: {
      file: File;
      faces: FaceBox[];
      options: Partial<FaceRedactionOptions>;
      type: string;
      quality?: number;
      outputSize?: { width: number; height: number } | null;
      scope: ResourceScopeLike;
      signal?: AbortSignal;
    }) => Promise<{ blob: Blob; width: number; height: number }>;
  };
  PageRange: {
    allPages: (total: number) => number[];
    parsePageSelection: (expr: string, total: number) => number[];
    parseSplitGroups: (expr: string, total: number) => { label: string; pages: number[] }[];
  };
  PDFRuntime: {
    fileSize: (bytes: number) => string;
    PDFRuntimeManager: new (adapter?: unknown) => {
      sessions: PdfSessionLike[];
      open: (
        file: File,
        options?: { signal?: AbortSignal; onPassword?: (ctx: { file: File; incorrect: boolean }) => Promise<string | null> }
      ) => Promise<PdfSessionLike>;
      remove: (id: string) => Promise<void>;
      get: (id: string) => PdfSessionLike | null;
    };
  };
  PDFProcessor: {
    profileFor: (key: string) => { key: string; label: string; dpi: number; quality: number; description: string };
    savePagePlan: (
      file: File,
      pagePlan: { sourcePage: number; rotation: number }[],
      options?: { signal?: AbortSignal; onProgress?: (info: { stage?: string; current?: number; total?: number }) => void }
    ) => Promise<{ blob: Blob; pageCount: number; inputBytes: number; outputBytes: number }>;
    optimizePDF: (
      file: File,
      options?: { signal?: AbortSignal; keepOriginalIfLarger?: boolean; onProgress?: (info: { stage?: string; current?: number; total?: number }) => void }
    ) => Promise<{ blob: Blob; pageCount: number; inputBytes: number; outputBytes: number; generatedBytes: number; usedOriginal: boolean }>;
    compressPDF: (
      session: PdfSessionLike,
      profile: string,
      options?: { signal?: AbortSignal; keepOriginalIfLarger?: boolean; onProgress?: (info: { stage?: string; current?: number; total?: number }) => void }
    ) => Promise<{ blob: Blob; pageCount: number; inputBytes: number; outputBytes: number; generatedBytes: number; usedOriginal: boolean }>;
    mergePDFs: (
      inputs: { file: File; pagePlan?: { sourcePage: number; rotation: number }[] }[],
      options?: { signal?: AbortSignal; onProgress?: (info: { stage?: string; current?: number; total?: number; fileName?: string; totalPages?: number }) => void }
    ) => Promise<{ blob: Blob; fileCount: number; pageCount: number; inputBytes: number; outputBytes: number }>;
    createPDFParts: (
      file: File,
      pagePlanGroups: { sourcePage: number; rotation: number }[][],
      options?: { signal?: AbortSignal; onProgress?: (info: { current?: number; total?: number }) => void }
    ) => Promise<{ parts: { blob: Blob; pageCount: number }[]; pageCount: number }>;
    watermarkPDF: (
      file: File,
      pagePlan: { sourcePage: number; rotation: number }[] | null,
      stampBlob: Blob,
      options: {
        pages: number[];
        tiled: boolean;
        position: string;
        opacity: number;
        rotation: number;
        widthRatio: number;
        density: number;
        offsetXRatio: number;
        offsetYRatio: number;
      },
      hooks?: { signal?: AbortSignal; onProgress?: (info: { stage?: string; current?: number; total?: number }) => void }
    ) => Promise<{ blob: Blob; pageCount: number; outputBytes: number }>;
    imagesToPDF: (
      files: File[],
      options: { pageSize: string; orientation: string; marginMm: number; background: string; quality: number },
      hooks?: { signal?: AbortSignal; onProgress?: (info: { stage?: string; current?: number; total?: number; fileName?: string }) => void }
    ) => Promise<{ blob: Blob; pageCount: number; inputBytes: number; outputBytes: number }>;
    pdfToImages: (
      session: PdfSessionLike,
      pageNumbers: number[],
      options: { type: string; quality: number; dpi: number },
      hooks?: { signal?: AbortSignal; onProgress?: (info: { stage?: string; current?: number; total?: number; pageNumber?: number }) => void }
    ) => Promise<{ images: { blob: Blob; outputPage?: number }[]; dpi: number; type: string }>;
  };
  IdCardSheet: {
    PAGE_MM: { width: number; height: number };
    CARD_MM: { width: number; height: number };
    MAX_SIDES: number;
    layoutFor: (images: { width: number; height: number }[], options: IdCardSheetOptions) => IdCardSheetLayout;
    drawSheet: (
      ctx: CanvasRenderingContext2D,
      pixelsPerMm: number,
      sources: CanvasImageSource[],
      layout: IdCardSheetLayout
    ) => void;
    createPDF: (
      files: File[],
      options: IdCardSheetOptions,
      hooks?: { signal?: AbortSignal; onProgress?: (info: { stage?: string; current?: number; total?: number; fileName?: string }) => void }
    ) => Promise<{ blob: Blob; pageCount: number; sideCount: number; inputBytes: number; outputBytes: number }>;
  };
  EmbeddedAssets?: {
    has: (name: string) => boolean;
    loadScript: (name: string, ready?: () => boolean) => Promise<boolean>;
    getUrl?: (name: string) => string;
    getText?: (name: string) => Promise<string>;
    getBytes?: (name: string) => Promise<Uint8Array>;
    release?: (name: string) => void;
  };
}

declare global {
  interface Window {
    Toolbox: ToolboxGlobal;
    ToolboxPDFJS?: unknown;
    ToolboxPDFLib?: unknown;
    ToolboxMediaPipe?: { FaceDetector: unknown; FaceLandmarker: unknown };
    heic2any?: unknown;
    __SINGLE_FILE_ASSETS__?: Record<string, string>;
  }
}

export const getEngine = (): ToolboxGlobal => window.Toolbox;

export const decodeImageFile = async (file: File, signal?: AbortSignal): Promise<DecodedImage> => {
  const engine = getEngine();
  const scope = new engine.ResourceScope();
  try {
    engine.FileValidator.validateImageFile(file);
    const workingFile = await engine.ImageDecoder.normalizeFile(file, signal);
    const bitmap = await engine.ImageDecoder.decodeBitmap(workingFile, scope, signal);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    const policy = engine.WorkloadPolicy.getPolicy({ ...dimensions, fileSize: file.size });
    const preview = await engine.ImageDecoder.createPreview(bitmap, policy, scope, signal);
    scope.releaseIntermediate();
    return {
      file: workingFile,
      sourceFile: file,
      dimensions,
      policy,
      preview: { ...preview, url: preview.image.src },
      dispose: () => scope.dispose()
    };
  } catch (err) {
    scope.dispose();
    throw err;
  }
};

// Vite native lazy loaders wired into window.Toolbox.EmbeddedAssets
let pdfJsPromise: Promise<unknown> | null = null;
let pdfLibPromise: Promise<unknown> | null = null;
let heicPromise: Promise<unknown> | null = null;
let mediaPipePromise: Promise<unknown> | null = null;
let pdfWorkerUrl: string | null = null;

const decodeBase64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

export const ensurePdfJs = async () => {
  if (window.ToolboxPDFJS) return window.ToolboxPDFJS;
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist');
      let workerSrc = '';
      if (window.__SINGLE_FILE_ASSETS__?.pdfWorker) {
        const workerBytes = decodeBase64ToBytes(window.__SINGLE_FILE_ASSETS__.pdfWorker);
        workerSrc = URL.createObjectURL(new Blob([workerBytes as BlobPart], { type: 'text/javascript' }));
      } else {
        const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        workerSrc = workerMod.default;
      }
      pdfWorkerUrl = workerSrc;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      window.ToolboxPDFJS = pdfjsLib;
      return pdfjsLib;
    })();
  }
  return pdfJsPromise;
};

export const ensurePdfLib = async () => {
  if (window.ToolboxPDFLib) return window.ToolboxPDFLib;
  if (!pdfLibPromise) {
    pdfLibPromise = import('pdf-lib').then(({ PDFDocument, degrees, rgb }) => {
      window.ToolboxPDFLib = { PDFDocument, degrees, rgb };
      return window.ToolboxPDFLib;
    });
  }
  return pdfLibPromise;
};

export const ensureHeic = async () => {
  if (typeof window.heic2any === 'function') return window.heic2any;
  if (!heicPromise) {
    heicPromise = import('heic2any').then((mod) => {
      const fn = (mod as { default?: unknown }).default ?? mod;
      window.heic2any = fn;
      return fn;
    });
  }
  return heicPromise;
};

export const ensureMediaPipe = async () => {
  if (window.ToolboxMediaPipe?.FaceDetector && window.ToolboxMediaPipe?.FaceLandmarker) {
    return window.ToolboxMediaPipe;
  }
  if (!mediaPipePromise) {
    mediaPipePromise = import('@mediapipe/tasks-vision').then((mod) => {
      window.ToolboxMediaPipe = { FaceDetector: mod.FaceDetector, FaceLandmarker: mod.FaceLandmarker };
      return window.ToolboxMediaPipe;
    });
  }
  return mediaPipePromise;
};

const MEDIAPIPE_ASSET_PATHS: Record<string, string> = {
  mediapipeLoader: './mediapipe/vision_wasm_internal.js',
  mediapipeWasm: './mediapipe/vision_wasm_internal.wasm',
  faceDetectorModel: './mediapipe/blaze_face_full_range.tflite',
  faceLandmarkerModel: './mediapipe/face_landmarker.task'
};

const fetchAsset = async (name: string) => {
  const rel = MEDIAPIPE_ASSET_PATHS[name];
  if (!rel) throw new Error(`未知内嵌资源：${name}`);
  const url = new URL(rel, document.baseURI).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载本地资源失败（${res.status}）：${rel}`);
  return res;
};

window.Toolbox.EmbeddedAssets = {
  has: (name: string) =>
    [
      'pdfjs',
      'pdfWorker',
      'pdflib',
      'heic2any',
      'mediapipeRuntime',
      'mediapipeLoader',
      'mediapipeWasm',
      'faceDetectorModel',
      'faceLandmarkerModel'
    ].includes(name),
  getUrl: (name: string) => (name === 'pdfWorker' && pdfWorkerUrl ? pdfWorkerUrl : ''),
  loadScript: async (name: string) => {
    if (name === 'pdfjs') await ensurePdfJs();
    else if (name === 'pdflib') await ensurePdfLib();
    else if (name === 'heic2any') await ensureHeic();
    else if (name === 'mediapipeRuntime') await ensureMediaPipe();
    return true;
  },
  getText: async (name: string) => {
    const embedded = window.__SINGLE_FILE_ASSETS__?.[name];
    if (embedded) return new TextDecoder().decode(decodeBase64ToBytes(embedded));
    return (await fetchAsset(name)).text();
  },
  getBytes: async (name: string) => {
    const embedded = window.__SINGLE_FILE_ASSETS__?.[name];
    if (embedded) return decodeBase64ToBytes(embedded);
    return new Uint8Array(await (await fetchAsset(name)).arrayBuffer());
  },
  release: (name: string) => {
    if (window.__SINGLE_FILE_ASSETS__?.[name]) {
      delete window.__SINGLE_FILE_ASSETS__[name];
    }
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const supportsNativeJpegClipboard = (): boolean => {
  try {
    return typeof ClipboardItem !== 'undefined' && typeof ClipboardItem.supports === 'function'
      ? ClipboardItem.supports('image/jpeg')
      : false;
  } catch {
    return false;
  }
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('编码剪贴板数据失败'));
    reader.readAsDataURL(blob);
  });

/**
 * Copy image to clipboard honoring the user's PNG / JPG preference.
 * Note: Chromium & WebKit reject raw `image/jpeg` ClipboardItem writes unless ClipboardItem.supports('image/jpeg').
 * In JPG mode on those browsers, writes compact JPG via `text/html` (for Docs/Mail/Word) alongside a compatible `image/png`
 * so pasting into WeChat/Feishu/Photoshop NEVER fails.
 */
export const copyImageToClipboard = async (params: {
  sourceBlob: Blob;
  format: 'image/png' | 'image/jpeg';
  quality?: number;
  maxEdge?: number;
}): Promise<{ mode: 'png' | 'jpeg-native' | 'jpeg-hybrid'; bytes: number }> => {
  const { sourceBlob, format, quality = 0.88, maxEdge = 0 } = params;
  const engine = getEngine();

  if (!globalThis.isSecureContext) {
    throw new Error('当前页面不是安全环境，浏览器不允许写入剪贴板，请使用下载功能。');
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器不支持复制图片到剪贴板，请使用下载功能。');
  }

  const bitmap = await createImageBitmap(sourceBlob);
  try {
    const scale = maxEdge > 0 && Math.max(bitmap.width, bitmap.height) > maxEdge ? maxEdge / Math.max(bitmap.width, bitmap.height) : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法初始化剪贴板画布');

    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);

    const encode = (mime: string, q?: number) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片编码失败'))), mime, q)
      );

    if (format === 'image/png') {
      const pngBlob = scale === 1 && sourceBlob.type === 'image/png' ? sourceBlob : await encode('image/png');
      await engine.Clipboard.copyPng(pngBlob);
      return { mode: 'png', bytes: pngBlob.size };
    }

    const jpgBlob = await encode('image/jpeg', Math.max(0.5, Math.min(0.96, quality)));
    if (supportsNativeJpegClipboard()) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/jpeg': jpgBlob })]);
      return { mode: 'jpeg-native', bytes: jpgBlob.size };
    }

    // Hybrid write: compact JPG inside text/html (for rich-text editors) + PNG fallback (for chat/image apps)
    const [jpgDataUrl, pngFallback] = await Promise.all([blobToDataUrl(jpgBlob), encode('image/png')]);
    const htmlBlob = new Blob([`<img src="${jpgDataUrl}" alt="image" />`], { type: 'text/html' });
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'image/png': pngFallback
      })
    ]);
    return { mode: 'jpeg-hybrid', bytes: jpgBlob.size };
  } finally {
    bitmap.close();
  }
};
