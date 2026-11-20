import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Copy,
  Crop,
  Download,
  Droplets,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  Grid3X3,
  GripVertical,
  ImagePlus,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Save,
  ScanFace,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { formatBytes, getEngine, SplitAnalysis, StitchLayout } from '../bridge/engine';
import {
  DEFAULT_STITCH,
  DEFAULT_WATERMARK,
  ImageToolId,
  useImageStore
} from '../stores/useImageStore';
import { useTaskStore } from '../stores/useTaskStore';
import { FaceRedactInspector } from './FaceRedactInspector';
import { ImageSplitInspector } from './ImageSplitInspector';
import { NumericInput } from './NumericInput';
import { WatermarkPresetPanel } from './WatermarkPresetPanel';
import { WorkbenchShell } from './WorkbenchShell';

const IMAGE_TOOLS: { id: ImageToolId; label: string; icon: typeof Droplets }[] = [
  { id: 'watermark', label: '水印', icon: Droplets },
  { id: 'redact', label: '人脸打码', icon: ScanFace },
  { id: 'compress', label: '压缩', icon: Minimize2 },
  { id: 'resize', label: '尺寸', icon: Maximize2 },
  { id: 'transform', label: '旋转', icon: RotateCw },
  { id: 'crop', label: '裁剪', icon: Crop },
  { id: 'stitch', label: '拼图', icon: Layers },
  { id: 'split', label: '图片切割', icon: Grid3X3 },
  { id: 'convert', label: '格式转换', icon: ArrowLeftRight }
];

const WM_CHIPS = [
  { label: '办理专用', text: '仅供办理＿＿使用，他用无效' },
  { label: '内部资料', text: '内部资料 · 严禁外传' },
  { label: '复印无效', text: '仅供核验 · 复印无效' }
];

const WM_SWATCHES = ['#ffffff', '#9ca3af', '#4b5563', '#dc2626', '#2563eb'];
const BG_SWATCHES = ['#ffffff', '#f1f5f9', '#0f172a', '#fefce8'];
const CROP_RATIOS = [
  { label: '自由', value: 0 },
  { label: '1:1', value: 1 },
  { label: '3:4', value: 0.75 },
  { label: '4:3', value: 4 / 3 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:2', value: 1.5 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 }
];

function SliderRow({
  label,
  valueText,
  value,
  defaultValue,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  valueText: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const modified = Math.abs(value - defaultValue) > 0.0001;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[13px] font-semibold">
        <span style={{ color: 'var(--ink-2)' }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono tabular-nums" style={{ color: 'var(--accent)' }}>
            {valueText}
          </span>
          <button
            type="button"
            disabled={!modified}
            onClick={() => onChange(defaultValue)}
            title="恢复此项默认"
            aria-label={`重置${label}`}
            className={`grid h-4 w-4 place-items-center rounded-full text-[11.5px] transition-all ${
              modified ? 'opacity-100 hover:scale-110' : 'pointer-events-none opacity-20'
            }`}
            style={{
              background: modified ? 'var(--accent-soft)' : 'transparent',
              color: modified ? 'var(--accent)' : 'var(--muted)'
            }}
          >
            ↺
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onDoubleClick={() => onChange(defaultValue)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export function ImageWorkspace() {
  const tool = useImageStore((s) => s.tool);
  const items = useImageStore((s) => s.items);
  const selectedId = useImageStore((s) => s.selectedId);
  const importing = useImageStore((s) => s.importing);
  const logoName = useImageStore((s) => s.logoName);
  const watermark = useImageStore((s) => s.watermark);
  const redact = useImageStore((s) => s.redact);
  const facesByItemId = useImageStore((s) => s.facesByItemId);
  const selectedFaceId = useImageStore((s) => s.selectedFaceId);
  const compress = useImageStore((s) => s.compress);
  const resize = useImageStore((s) => s.resize);
  const transform = useImageStore((s) => s.transform);
  const crop = useImageStore((s) => s.crop);
  const stitch = useImageStore((s) => s.stitch);
  const splitConfig = useImageStore((s) => s.splitConfig);
  const exportConfig = useImageStore((s) => s.exportConfig);
  const undoByTool = useImageStore((s) => s.undoByTool);

  const setTool = useImageStore((s) => s.setTool);
  const importFiles = useImageStore((s) => s.importFiles);
  const importLogo = useImageStore((s) => s.importLogo);
  const selectItem = useImageStore((s) => s.selectItem);
  const moveItem = useImageStore((s) => s.moveItem);
  const reorderByIds = useImageStore((s) => s.reorderByIds);
  const swapByIds = useImageStore((s) => s.swapByIds);
  const removeItem = useImageStore((s) => s.removeItem);
  const clearItems = useImageStore((s) => s.clearItems);
  const patchWatermark = useImageStore((s) => s.patchWatermark);
  const setSelectedFaceId = useImageStore((s) => s.setSelectedFaceId);
  const addManualFace = useImageStore((s) => s.addManualFace);
  const updateFace = useImageStore((s) => s.updateFace);
  const patchCompress = useImageStore((s) => s.patchCompress);
  const patchResize = useImageStore((s) => s.patchResize);
  const patchTransform = useImageStore((s) => s.patchTransform);
  const patchCrop = useImageStore((s) => s.patchCrop);
  const patchStitch = useImageStore((s) => s.patchStitch);
  const patchExportConfig = useImageStore((s) => s.patchExportConfig);
  const resetCurrentTool = useImageStore((s) => s.resetCurrentTool);
  const undoResetCurrentTool = useImageStore((s) => s.undoResetCurrentTool);
  const saveStitchProject = useImageStore((s) => s.saveStitchProject);
  const openStitchProject = useImageStore((s) => s.openStitchProject);
  const exportCurrent = useImageStore((s) => s.exportCurrent);
  const exportBatch = useImageStore((s) => s.exportBatch);
  const copyCurrentPng = useImageStore((s) => s.copyCurrentPng);

  const tasks = useTaskStore((s) => s.tasks);
  const busy = tasks.some((t) => t.status === 'running' && t.kind.startsWith('image-'));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const wmTextareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePan, setSpacePan] = useState(false);
  const [panDrag, setPanDrag] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [comparingOriginal, setComparingOriginal] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [stitchDrag, setStitchDrag] = useState<{ fromId: string; targetId: string } | null>(null);
  const [wmDragging, setWmDragging] = useState(false);
  const [faceDrag, setFaceDrag] = useState<
    | { mode: 'move' | 'resize'; faceId: string; startX: number; startY: number; orig: { x: number; y: number; width: number; height: number } }
    | { mode: 'draw'; startX: number; startY: number; curX: number; curY: number }
    | null
  >(null);
  const [cropDrag, setCropDrag] = useState<{
    startX: number;
    startY: number;
    orig: typeof crop.rect;
    mode: 'move' | 'tl' | 'tr' | 'bl' | 'br';
  } | null>(null);

  useEffect(() => {
    setComparingOriginal(false);
  }, [tool]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.code === 'Space' && !e.target || (e.code === 'Space' && !(e.target as HTMLElement)?.closest?.('button,a,summary'))) {
        e.preventDefault();
        setSpacePan(true);
      } else if (e.key === '0' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePan(false);
    };
    const onBlur = () => {
      setSpacePan(false);
      setPanDrag(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const activeItem = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const activeFaces = useMemo(() => (activeItem ? facesByItemId[activeItem.id] ?? [] : []), [activeItem, facesByItemId]);

  const splitAnalysisInfo = useMemo<{ analysis: SplitAnalysis | null; error: string | null }>(() => {
    if (tool !== 'split' || !activeItem) return { analysis: null, error: null };
    try {
      const pw = activeItem.decoded.preview.width;
      const ph = activeItem.decoded.preview.height;
      const tmp = document.createElement('canvas');
      tmp.width = pw;
      tmp.height = ph;
      const tctx = tmp.getContext('2d', { willReadFrequently: true });
      if (!tctx) return { analysis: null, error: '无法读取预览像素' };
      tctx.drawImage(activeItem.decoded.preview.image, 0, 0, pw, ph);
      const imageData = tctx.getImageData(0, 0, pw, ph);
      tmp.width = 1;
      tmp.height = 1;
      const analysis = getEngine().ImageSplitter.analyze(imageData, {
        rows: splitConfig.rows,
        columns: splitConfig.columns,
        rowPattern: splitConfig.rowPattern
      });
      return { analysis, error: null };
    } catch (err) {
      return { analysis: null, error: err instanceof Error ? err.message : '未识别到切割线' };
    }
  }, [tool, activeItem, splitConfig]);

  const stitchLayoutInfo = useMemo<{ layout: StitchLayout | null; error: string | null }>(() => {
    if (tool !== 'stitch' || !items.length) return { layout: null, error: null };
    try {
      const layout = getEngine().ImageStitcher.layoutFor(
        items.map((i) => i.decoded),
        stitch
      );
      return { layout, error: null };
    } catch (err) {
      return { layout: null, error: err instanceof Error ? err.message : '拼图参数无效' };
    }
  }, [tool, items, stitch]);

  // Compute expected output dimensions for SSOT export button label
  const outputDims = useMemo(() => {
    if (tool === 'stitch') {
      return stitchLayoutInfo.layout ? `${stitchLayoutInfo.layout.width}×${stitchLayoutInfo.layout.height}` : '';
    }
    if (!activeItem) return '';
    const engine = getEngine();
    const d = activeItem.decoded.dimensions;
    if (tool === 'compress') {
      const prof = engine.CompressionModel.profiles[compress.profile];
      const maxEdge = compress.profile === 'custom' ? compress.maxEdge : prof?.maxEdge ?? 2560;
      const out = engine.CompressionModel.getOutputSize(d.width, d.height, maxEdge);
      return `${out.width}×${out.height}`;
    }
    if (tool === 'resize') {
      const out = engine.ImageResizer.sizeFor(d, resize.mode, resize.value, resize.width, resize.height, resize.keepRatio);
      return `${out.width}×${out.height}`;
    }
    if (tool === 'transform') {
      const swap = ((transform.rotation % 360) + 360) % 180 === 90;
      return `${swap ? d.height : d.width}×${swap ? d.width : d.height}`;
    }
    if (tool === 'crop') {
      const out = engine.ImageCropper.cropSize(d, crop.rect);
      return `${out.width}×${out.height}`;
    }
    return `${d.width}×${d.height}`;
  }, [tool, activeItem, stitchLayoutInfo, compress, resize, transform, crop]);

  // Unified rAF Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return;
    const raf = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const engine = getEngine();

      if (tool === 'stitch') {
        const layout = stitchLayoutInfo.layout;
        if (!layout) return;
        const scale = Math.min(1, 1600 / Math.max(layout.width, layout.height, 1));
        canvas.width = Math.max(1, Math.round(layout.width * scale));
        canvas.height = Math.max(1, Math.round(layout.height * scale));
        ctx.save();
        ctx.scale(scale, scale);
        ctx.fillStyle = stitch.background || '#ffffff';
        ctx.fillRect(0, 0, layout.width, layout.height);
        engine.ImageStitcher.drawHeader(ctx, layout);
        layout.items.forEach((slot, idx) => {
          const img = slot.image?.preview?.image;
          if (img) engine.ImageStitcher.drawItem(ctx, img, slot);
          if (stitchDrag) {
            const id = items[idx]?.id;
            const lw = Math.max(2, 4 / scale);
            if (id === stitchDrag.fromId) {
              ctx.save();
              ctx.fillStyle = 'rgba(37, 99, 235, 0.16)';
              ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = lw;
              ctx.setLineDash([lw * 3, lw * 2]);
              ctx.strokeRect(slot.x + lw / 2, slot.y + lw / 2, slot.width - lw, slot.height - lw);
              ctx.restore();
            } else if (id === stitchDrag.targetId) {
              ctx.save();
              ctx.fillStyle = 'rgba(99, 102, 241, 0.22)';
              ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
              ctx.strokeStyle = '#4f46e5';
              ctx.lineWidth = lw * 1.4;
              ctx.strokeRect(slot.x + lw, slot.y + lw, slot.width - lw * 2, slot.height - lw * 2);
              ctx.restore();
            }
          }
        });
        ctx.restore();
        return;
      }

      if (!activeItem) return;
      const src = activeItem.decoded.preview.image;
      const pw = activeItem.decoded.preview.width;
      const ph = activeItem.decoded.preview.height;

      if (comparingOriginal) {
        canvas.width = pw;
        canvas.height = ph;
        ctx.drawImage(src, 0, 0, pw, ph);
        return;
      }

      if (tool === 'transform') {
        const rot = ((transform.rotation % 360) + 360) % 360;
        const swap = rot === 90 || rot === 270;
        canvas.width = swap ? ph : pw;
        canvas.height = swap ? pw : ph;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
        ctx.drawImage(src, -pw / 2, -ph / 2, pw, ph);
        ctx.restore();
        return;
      }

      canvas.width = pw;
      canvas.height = ph;
      ctx.drawImage(src, 0, 0, pw, ph);

      if (tool === 'watermark') {
        engine.WatermarkRenderer.renderWatermark(ctx, pw, ph, watermark);
      } else if (tool === 'redact') {
        engine.FaceRedactor.drawRedactions(ctx, src, pw, ph, activeFaces, redact);
        // Draw selection & box guides so users can directly drag/resize faces
        activeFaces.forEach((face, idx) => {
          const isSel = face.id === selectedFaceId;
          const fx = face.x * pw;
          const fy = face.y * ph;
          const fw = face.width * pw;
          const fh = face.height * ph;
          ctx.save();
          ctx.strokeStyle = face.enabled === false ? 'rgba(148, 163, 184, 0.85)' : isSel ? '#3b82f6' : 'rgba(59, 130, 246, 0.55)';
          ctx.lineWidth = Math.max(2, pw / 360);
          if (face.enabled === false || !isSel) ctx.setLineDash([6, 4]);
          ctx.strokeRect(fx, fy, fw, fh);
          ctx.setLineDash([]);
          const tagH = Math.max(16, Math.round(pw / 44));
          ctx.fillStyle = isSel ? '#2563eb' : 'rgba(15, 23, 42, 0.72)';
          ctx.fillRect(fx, Math.max(0, fy - tagH), tagH * 1.45, tagH);
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.max(10, Math.round(tagH * 0.65))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`#${idx + 1}`, fx + tagH * 0.72, Math.max(0, fy - tagH) + tagH / 2);
          if (isSel) {
            const hs = Math.max(10, pw / 52);
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1.5, pw / 480);
            ctx.fillRect(fx + fw - hs / 2, fy + fh - hs / 2, hs, hs);
            ctx.strokeRect(fx + fw - hs / 2, fy + fh - hs / 2, hs, hs);
          }
          ctx.restore();
        });
        if (faceDrag && faceDrag.mode === 'draw') {
          const lx = Math.min(faceDrag.startX, faceDrag.curX) * pw;
          const ly = Math.min(faceDrag.startY, faceDrag.curY) * ph;
          const lw = Math.abs(faceDrag.curX - faceDrag.startX) * pw;
          const lh = Math.abs(faceDrag.curY - faceDrag.startY) * ph;
          ctx.save();
          ctx.fillStyle = 'rgba(59, 130, 246, 0.16)';
          ctx.fillRect(lx, ly, lw, lh);
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = Math.max(2, pw / 360);
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(lx, ly, lw, lh);
          ctx.restore();
        }
      } else if (tool === 'split' && splitAnalysisInfo.analysis) {
        const rects = splitAnalysisInfo.analysis.rects;
        ctx.save();
        rects.forEach((r, idx) => {
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = Math.max(2, pw / 340);
          ctx.setLineDash([8, 5]);
          ctx.strokeRect(r.x + 1, r.y + 1, Math.max(1, r.width - 2), Math.max(1, r.height - 2));
          ctx.setLineDash([]);
          const badge = Math.max(20, Math.min(34, Math.round(Math.min(r.width, r.height) * 0.2)));
          ctx.fillStyle = 'rgba(37, 99, 235, 0.88)';
          ctx.fillRect(r.x + 6, r.y + 6, badge * 1.3, badge);
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.round(badge * 0.56)}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(idx + 1), r.x + 6 + badge * 0.65, r.y + 6 + badge / 2);
        });
        ctx.restore();
      } else if (tool === 'crop') {
        const r = crop.rect;
        const cx = r.x * pw;
        const cy = r.y * ph;
        const cw = r.width * pw;
        const ch = r.height * ph;
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.52)';
        ctx.fillRect(0, 0, pw, cy);
        ctx.fillRect(0, cy + ch, pw, ph - cy - ch);
        ctx.fillRect(0, cy, cx, ch);
        ctx.fillRect(cx + cw, cy, pw - cx - cw, ch);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, pw / 360);
        ctx.strokeRect(cx, cy, cw, ch);
        // Rule-of-thirds guides
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = Math.max(1, pw / 720);
        ctx.beginPath();
        ctx.moveTo(cx + cw / 3, cy);
        ctx.lineTo(cx + cw / 3, cy + ch);
        ctx.moveTo(cx + (cw * 2) / 3, cy);
        ctx.lineTo(cx + (cw * 2) / 3, cy + ch);
        ctx.moveTo(cx, cy + ch / 3);
        ctx.lineTo(cx + cw, cy + ch / 3);
        ctx.moveTo(cx, cy + (ch * 2) / 3);
        ctx.lineTo(cx + cw, cy + (ch * 2) / 3);
        ctx.stroke();
        // 4 corner resize handles
        const hs = Math.max(11, pw / 48);
        const corners: [number, number][] = [
          [cx, cy],
          [cx + cw, cy],
          [cx, cy + ch],
          [cx + cw, cy + ch]
        ];
        ctx.fillStyle = '#3b82f6';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, pw / 480);
        corners.forEach(([hx, hy]) => {
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
          ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
        ctx.restore();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [
    tool,
    items,
    activeItem,
    watermark,
    redact,
    activeFaces,
    selectedFaceId,
    faceDrag,
    splitAnalysisInfo,
    transform,
    crop,
    stitch,
    stitchLayoutInfo,
    stitchDrag,
    comparingOriginal
  ]);

  const hitStitchSlotId = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    const layout = stitchLayoutInfo.layout;
    if (!canvas || !layout) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const lx = ((clientX - rect.left) / rect.width) * layout.width;
    const ly = ((clientY - rect.top) / rect.height) * layout.height;
    const idx = layout.items.findIndex(
      (slot) => lx >= slot.x && lx <= slot.x + slot.width && ly >= slot.y && ly <= slot.y + slot.height
    );
    return idx >= 0 ? items[idx]?.id ?? null : null;
  };

  const canvasRatioPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    };
  };

  const formatLabel = exportConfig.format === 'image/png' ? 'PNG' : exportConfig.format === 'image/webp' ? 'WebP' : 'JPG';
  const hasUndo = Boolean(undoByTool[tool]);

  const sourcesRail = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: 'var(--line)' }}>
        <div>
          <p className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>
            图片队列（{items.length}）
          </p>
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
            全工具共享 · 拖拽排序
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[13px] font-semibold"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          <span>添加</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) importFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        <AnimatePresence initial={false}>
          {items.map((item, idx) => {
            const active = item.id === activeItem?.id;
            const isOver = dragOverId === item.id && draggedId !== item.id;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.16 }}
                draggable
                onDragStart={() => setDraggedId(item.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(item.id);
                }}
                onDragLeave={() => setDragOverId((cur) => (cur === item.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedId && draggedId !== item.id) reorderByIds(draggedId, item.id);
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onClick={() => selectItem(item.id)}
                data-active={active || undefined}
                className="studio-queue-card flex cursor-grab items-center gap-1.5 rounded-xl border p-1.5 active:cursor-grabbing"
                style={isOver ? { borderColor: 'var(--accent)' } : undefined}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted)' }} />
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg" style={{ background: 'var(--bg-well)' }}>
                  <img src={item.decoded.preview.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-slate-900/75 px-1 font-mono text-[9px] font-bold text-white">
                    {idx + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }} title={item.name}>
                    {item.name}
                  </p>
                  <p className="font-mono text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    {item.decoded.dimensions.width}×{item.decoded.dimensions.height}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(item.id, -1);
                      }}
                      className="grid h-4 w-4 place-items-center rounded border disabled:opacity-25"
                      style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                    >
                      <ArrowUp className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(item.id, 1);
                      }}
                      className="grid h-4 w-4 place-items-center rounded border disabled:opacity-25"
                      style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                    >
                      <ArrowDown className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    className="grid h-4 w-full place-items-center rounded opacity-60 hover:opacity-100"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!items.length && (
          <div className="py-10 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
            拖入图片或 ⌘V 粘贴
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t p-2" style={{ borderColor: 'var(--line)' }}>
          <button
            type="button"
            onClick={clearItems}
            disabled={busy}
            className="w-full rounded-lg py-1.5 text-[13px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            清空全部（{items.length}）
          </button>
        </div>
      )}
    </div>
  );

  const stage = !items.length ? (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div
        className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border"
        style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
      >
        <ImagePlus className="h-7 w-7" />
      </div>
      <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink)' }}>
        导入图片开始处理
      </h2>
      <p className="mt-1.5 max-w-sm text-[13px]" style={{ color: 'var(--muted)' }}>
        支持 JPG、PNG、WebP、HEIC / HEIF；拖入窗口或直接按 ⌘V / Ctrl+V 粘贴截图。
      </p>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="gemini-btn mt-5 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold"
      >
        <ImagePlus className="h-4 w-4" />
        <span>选择图片</span>
      </button>
    </div>
  ) : (
    <>
      <div
        className="flex flex-1 items-center justify-center overflow-hidden px-5 pt-4 pb-14"
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z) => {
            const next = Math.max(0.4, Math.min(3, Number((z + (e.deltaY < 0 ? 0.12 : -0.12)).toFixed(2))));
            if (next === 1) setPan({ x: 0, y: 0 });
            return next;
          });
        }}
        onDoubleClick={() => {
          if (tool !== 'crop') {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }
        }}
      >
        {tool === 'stitch' && stitchLayoutInfo.error ? (
          <div
            className="rounded-xl border px-4 py-3 text-[13px] font-medium"
            style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            {stitchLayoutInfo.error}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              if (spacePan) {
                e.currentTarget.setPointerCapture(e.pointerId);
                setPanDrag({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
                return;
              }
              if (tool === 'stitch' && items.length >= 2) {
                const hit = hitStitchSlotId(e.clientX, e.clientY);
                if (!hit) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                selectItem(hit);
                setStitchDrag({ fromId: hit, targetId: hit });
                return;
              }
              if (tool === 'watermark' && !watermark.tile) {
                const pt = canvasRatioPoint(e.clientX, e.clientY);
                if (!pt) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setWmDragging(true);
                patchWatermark({ position: { xRatio: pt.x, yRatio: pt.y } });
                return;
              }
              if (tool === 'redact') {
                const pt = canvasRatioPoint(e.clientX, e.clientY);
                if (!pt) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                const tol = 0.045;
                // Check resize handle on selected face first
                const sel = activeFaces.find((f) => f.id === selectedFaceId);
                if (sel && Math.abs(pt.x - (sel.x + sel.width)) < tol && Math.abs(pt.y - (sel.y + sel.height)) < tol) {
                  setFaceDrag({
                    mode: 'resize',
                    faceId: sel.id,
                    startX: pt.x,
                    startY: pt.y,
                    orig: { x: sel.x, y: sel.y, width: sel.width, height: sel.height }
                  });
                  return;
                }
                // Check clicking inside any existing face box (top-most first)
                const hit = [...activeFaces]
                  .reverse()
                  .find((f) => pt.x >= f.x && pt.x <= f.x + f.width && pt.y >= f.y && pt.y <= f.y + f.height);
                if (hit) {
                  setSelectedFaceId(hit.id);
                  setFaceDrag({
                    mode: 'move',
                    faceId: hit.id,
                    startX: pt.x,
                    startY: pt.y,
                    orig: { x: hit.x, y: hit.y, width: hit.width, height: hit.height }
                  });
                  return;
                }
                // Otherwise draw a brand new manual redaction box
                setFaceDrag({ mode: 'draw', startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y });
                return;
              }
              if (tool === 'crop') {
                const pt = canvasRatioPoint(e.clientX, e.clientY);
                if (!pt) return;
                const r = crop.rect;
                const tol = 0.055;
                const corner: 'move' | 'tl' | 'tr' | 'bl' | 'br' =
                  Math.abs(pt.x - r.x) < tol && Math.abs(pt.y - r.y) < tol
                    ? 'tl'
                    : Math.abs(pt.x - (r.x + r.width)) < tol && Math.abs(pt.y - r.y) < tol
                      ? 'tr'
                      : Math.abs(pt.x - r.x) < tol && Math.abs(pt.y - (r.y + r.height)) < tol
                        ? 'bl'
                        : Math.abs(pt.x - (r.x + r.width)) < tol && Math.abs(pt.y - (r.y + r.height)) < tol
                          ? 'br'
                          : 'move';
                e.currentTarget.setPointerCapture(e.pointerId);
                setCropDrag({ startX: pt.x, startY: pt.y, orig: { ...r }, mode: corner });
              }
            }}
            onPointerMove={(e) => {
              if (panDrag) {
                setPan({ x: panDrag.origX + e.clientX - panDrag.startX, y: panDrag.origY + e.clientY - panDrag.startY });
                return;
              }
              if (stitchDrag) {
                const hit = hitStitchSlotId(e.clientX, e.clientY);
                const nextTarget = hit ?? stitchDrag.fromId;
                if (nextTarget !== stitchDrag.targetId) setStitchDrag({ ...stitchDrag, targetId: nextTarget });
                return;
              }
              if (wmDragging) {
                const pt = canvasRatioPoint(e.clientX, e.clientY);
                if (pt) patchWatermark({ position: { xRatio: pt.x, yRatio: pt.y } });
                return;
              }
              if (faceDrag) {
                const pt = canvasRatioPoint(e.clientX, e.clientY);
                if (!pt) return;
                if (faceDrag.mode === 'draw') {
                  setFaceDrag({ ...faceDrag, curX: pt.x, curY: pt.y });
                } else if (faceDrag.mode === 'move') {
                  const dx = pt.x - faceDrag.startX;
                  const dy = pt.y - faceDrag.startY;
                  updateFace(faceDrag.faceId, {
                    x: Math.max(0, Math.min(1 - faceDrag.orig.width, faceDrag.orig.x + dx)),
                    y: Math.max(0, Math.min(1 - faceDrag.orig.height, faceDrag.orig.y + dy))
                  });
                } else {
                  const nw = Math.max(0.03, Math.min(1 - faceDrag.orig.x, faceDrag.orig.width + (pt.x - faceDrag.startX)));
                  const nh = Math.max(0.03, Math.min(1 - faceDrag.orig.y, faceDrag.orig.height + (pt.y - faceDrag.startY)));
                  updateFace(faceDrag.faceId, { width: nw, height: nh });
                }
                return;
              }
              if (cropDrag && activeItem) {
                const pt = canvasRatioPoint(e.clientX, e.clientY);
                if (!pt) return;
                const dx = pt.x - cropDrag.startX;
                const dy = pt.y - cropDrag.startY;
                const o = cropDrag.orig;
                const min = 0.06;
                if (cropDrag.mode === 'move') {
                  patchCrop({
                    rect: {
                      ...o,
                      x: Math.max(0, Math.min(1 - o.width, o.x + dx)),
                      y: Math.max(0, Math.min(1 - o.height, o.y + dy))
                    }
                  });
                } else {
                  let left = cropDrag.mode.includes('l') ? Math.max(0, Math.min(o.x + o.width - min, o.x + dx)) : o.x;
                  let right = cropDrag.mode.includes('r') ? Math.min(1, Math.max(o.x + min, o.x + o.width + dx)) : o.x + o.width;
                  let top = cropDrag.mode.includes('t') ? Math.max(0, Math.min(o.y + o.height - min, o.y + dy)) : o.y;
                  let bottom = cropDrag.mode.includes('b') ? Math.min(1, Math.max(o.y + min, o.y + o.height + dy)) : o.y + o.height;
                  let nw = right - left;
                  let nh = bottom - top;
                  if (crop.ratio > 0) {
                    const dims = activeItem.decoded.dimensions;
                    const desiredH = (nw * dims.width) / (crop.ratio * dims.height);
                    const maxH = cropDrag.mode.includes('t') ? bottom : 1 - top;
                    if (desiredH <= maxH) {
                      nh = Math.max(min, desiredH);
                    } else {
                      nh = maxH;
                      nw = Math.max(min, (nh * crop.ratio * dims.height) / dims.width);
                    }
                    if (cropDrag.mode.includes('l')) left = right - nw;
                    if (cropDrag.mode.includes('t')) top = bottom - nh;
                  }
                  patchCrop({ rect: { x: left, y: top, width: nw, height: nh } });
                }
              }
            }}
            onPointerUp={(e) => {
              if (panDrag) {
                setPanDrag(null);
                return;
              }
              if (stitchDrag) {
                const hit = hitStitchSlotId(e.clientX, e.clientY) ?? stitchDrag.targetId;
                if (hit && hit !== stitchDrag.fromId) swapByIds(stitchDrag.fromId, hit);
                setStitchDrag(null);
              }
              if (faceDrag && faceDrag.mode === 'draw') {
                const x = Math.min(faceDrag.startX, faceDrag.curX);
                const y = Math.min(faceDrag.startY, faceDrag.curY);
                const w = Math.abs(faceDrag.curX - faceDrag.startX);
                const h = Math.abs(faceDrag.curY - faceDrag.startY);
                if (w >= 0.025 && h >= 0.025) addManualFace({ x, y, width: w, height: h });
              }
              setFaceDrag(null);
              setWmDragging(false);
              setCropDrag(null);
            }}
            onPointerCancel={() => {
              setPanDrag(null);
              setStitchDrag(null);
              setFaceDrag(null);
              setWmDragging(false);
              setCropDrag(null);
            }}
            className={`h-auto max-h-full w-auto max-w-full rounded-md object-contain transition-transform duration-100 ${
              spacePan || panDrag
                ? panDrag
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : tool === 'stitch' && items.length >= 2
                  ? stitchDrag
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : tool === 'crop' || tool === 'redact'
                    ? 'cursor-crosshair'
                    : tool === 'watermark' && !watermark.tile
                      ? 'cursor-move'
                      : ''
            }`}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              boxShadow: '0 12px 36px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.08)'
            }}
          />
        )}
      </div>

      {/* Floating Canvas Island */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md"
          style={{
            background: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow-float)'
          }}
        >
          <span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>
            {outputDims || '—'}
          </span>

          {tool !== 'stitch' && (
            <>
              <span className="h-3.5 w-px" style={{ background: 'var(--line)' }} />
              <button
                type="button"
                onPointerDown={() => setComparingOriginal(true)}
                onPointerUp={() => setComparingOriginal(false)}
                onPointerLeave={() => setComparingOriginal(false)}
                onPointerCancel={() => setComparingOriginal(false)}
                className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12.5px] font-semibold select-none"
                style={{
                  background: comparingOriginal ? 'var(--gemini-grad)' : 'var(--bg-subtle)',
                  borderColor: comparingOriginal ? 'transparent' : 'var(--line)',
                  color: comparingOriginal ? '#ffffff' : 'var(--ink-2)'
                }}
              >
                <Eye className="h-3 w-3" />
                <span>对比原图</span>
              </button>
            </>
          )}

          <span className="h-3.5 w-px" style={{ background: 'var(--line)' }} />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.2).toFixed(2))))}
            aria-label="缩小"
            className="studio-icon-btn grid h-6 w-6 place-items-center rounded-full border border-transparent"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="恢复 100%（快捷键 0；放大后按住空格拖动画布）"
            className="studio-tab min-w-[44px] rounded-full px-1.5 py-0.5 font-mono text-[13px] font-semibold tabular-nums"
            style={{ color: 'var(--ink)' }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.2).toFixed(2))))}
            aria-label="放大"
            className="studio-icon-btn grid h-6 w-6 place-items-center rounded-full border border-transparent"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  const inspectorHeader = (
    <div className="flex items-center justify-between">
      <span className="text-[13.5px] font-bold" style={{ color: 'var(--ink)' }}>
        {IMAGE_TOOLS.find((t) => t.id === tool)?.label}参数
      </span>
      <div className="flex items-center gap-1.5">
        {hasUndo && (
          <button
            type="button"
            onClick={undoResetCurrentTool}
            className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12.5px] font-semibold"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            <Undo2 className="h-3 w-3" />
            <span>撤销</span>
          </button>
        )}
        <button
          type="button"
          onClick={resetCurrentTool}
          className="studio-chip inline-flex h-6.5 items-center gap-1 rounded-full border px-2.5 text-[12.5px] font-semibold"
        >
          <RotateCcw className="h-3 w-3" />
          <span>重置</span>
        </button>
      </div>
    </div>
  );

  const inspectorBody = (
    <div className="space-y-2.5">
      {tool === 'watermark' && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
            {(
              [
                ['text', '文字水印'],
                ['image', '图片 Logo']
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => patchWatermark({ kind: k })}
                className="h-7 rounded-lg text-[13px] font-semibold"
                style={{
                  background: watermark.kind === k ? 'var(--bg-surface)' : 'transparent',
                  color: watermark.kind === k ? 'var(--accent)' : 'var(--muted)'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {watermark.kind === 'text' ? (
            <>
              <div>
                <textarea
                  ref={wmTextareaRef}
                  rows={2}
                  value={watermark.text}
                  onChange={(e) => patchWatermark({ text: e.target.value })}
                  placeholder="输入水印文字，支持换行"
                  className="w-full rounded-lg border px-2.5 py-1.5 text-[13.5px]"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {WM_CHIPS.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => {
                        patchWatermark({ text: c.text });
                        requestAnimationFrame(() => {
                          const el = wmTextareaRef.current;
                          if (!el) return;
                          el.focus();
                          const idx = c.text.indexOf('＿＿');
                          if (idx >= 0) el.setSelectionRange(idx, idx + 2);
                        });
                      }}
                      className="h-6 rounded-full border px-2.5 text-[12px] font-semibold"
                      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <select
                  aria-label="水印字体"
                  value={watermark.font}
                  onChange={(e) => patchWatermark({ font: e.target.value })}
                  className="h-7 rounded-lg border px-2 text-[13px]"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                >
                  <option value="Arial, sans-serif">无衬线</option>
                  <option value="Georgia, serif">衬线</option>
                  <option value="'Courier New', monospace">等宽</option>
                </select>
                <select
                  aria-label="水印字重"
                  value={watermark.weight}
                  onChange={(e) => patchWatermark({ weight: e.target.value })}
                  className="h-7 rounded-lg border px-2 text-[13px]"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                >
                  <option value="400">常规</option>
                  <option value="600">半粗</option>
                  <option value="800">粗体</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                  文字颜色
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={watermark.color}
                    onChange={(e) => patchWatermark({ color: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border p-0.5"
                    style={{ borderColor: 'var(--line-strong)' }}
                  />
                  {WM_SWATCHES.map((sw) => (
                    <button
                      key={sw}
                      type="button"
                      onClick={() => patchWatermark({ color: sw })}
                      className="h-4.5 w-4.5 rounded-full border transition-transform hover:scale-110"
                      style={{
                        background: sw,
                        borderColor: watermark.color.toLowerCase() === sw ? 'var(--accent)' : 'var(--line-strong)',
                        boxShadow: watermark.color.toLowerCase() === sw ? '0 0 0 2px var(--accent-soft)' : undefined
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importLogo(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full rounded-xl border border-dashed py-3 text-[13px] font-semibold"
                style={{ borderColor: 'var(--line-strong)', color: 'var(--ink-2)', background: 'var(--bg-subtle)' }}
              >
                {logoName || '点击选择 Logo 图片（PNG / WebP）'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
            {(
              [
                [false, '单个水印'],
                [true, '铺满水印']
              ] as const
            ).map(([tiled, label]) => (
              <button
                key={String(tiled)}
                type="button"
                onClick={() => patchWatermark({ tile: tiled })}
                className="h-7 rounded-lg text-[13px] font-semibold"
                style={{
                  background: watermark.tile === tiled ? 'var(--bg-surface)' : 'transparent',
                  color: watermark.tile === tiled ? 'var(--accent)' : 'var(--muted)'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <SliderRow
            label="大小"
            valueText={`${Math.round(watermark.sizeRatio * 100)}%`}
            value={Math.round(watermark.sizeRatio * 100)}
            defaultValue={Math.round(DEFAULT_WATERMARK.sizeRatio * 100)}
            min={2}
            max={30}
            onChange={(v) => patchWatermark({ sizeRatio: v / 100 })}
          />
          <SliderRow
            label="不透明度"
            valueText={`${Math.round(watermark.opacity * 100)}%`}
            value={Math.round(watermark.opacity * 100)}
            defaultValue={Math.round(DEFAULT_WATERMARK.opacity * 100)}
            min={10}
            max={100}
            onChange={(v) => patchWatermark({ opacity: v / 100 })}
          />
          <SliderRow
            label="旋转角度"
            valueText={`${watermark.rotation}°`}
            value={watermark.rotation}
            defaultValue={DEFAULT_WATERMARK.rotation}
            min={-180}
            max={180}
            onChange={(v) => patchWatermark({ rotation: v })}
          />

          {watermark.tile ? (
            <>
              <SliderRow
                label="铺满密度"
                valueText={`${Math.round(watermark.density * 100)}%`}
                value={Math.round(watermark.density * 100)}
                defaultValue={Math.round(DEFAULT_WATERMARK.density * 100)}
                min={20}
                max={100}
                onChange={(v) => patchWatermark({ density: v / 100 })}
              />
              <SliderRow
                label="横向偏移"
                valueText={`${Math.round(watermark.offsetXRatio * 100)}%`}
                value={Math.round(watermark.offsetXRatio * 100)}
                defaultValue={0}
                min={-50}
                max={50}
                onChange={(v) => patchWatermark({ offsetXRatio: v / 100 })}
              />
              <SliderRow
                label="纵向偏移"
                valueText={`${Math.round(watermark.offsetYRatio * 100)}%`}
                value={Math.round(watermark.offsetYRatio * 100)}
                defaultValue={0}
                min={-50}
                max={50}
                onChange={(v) => patchWatermark({ offsetYRatio: v / 100 })}
              />
            </>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                九宫格位置（也可画布拖动）
              </span>
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }, (_, i) => {
                  const anchor = getEngine().WatermarkModel.positionForAnchor(i);
                  const isActive =
                    Math.abs(watermark.position.xRatio - anchor.xRatio) < 0.03 &&
                    Math.abs(watermark.position.yRatio - anchor.yRatio) < 0.03;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => patchWatermark({ position: anchor })}
                      className="h-5 w-5 rounded border transition-all hover:border-blue-500"
                      style={{
                        background: isActive ? 'var(--gemini-grad)' : 'var(--bg-subtle)',
                        borderColor: isActive ? 'transparent' : 'var(--line-strong)'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <WatermarkPresetPanel />
        </>
      )}

      {tool === 'redact' && <FaceRedactInspector />}

      {tool === 'split' && <ImageSplitInspector analysis={splitAnalysisInfo.analysis} error={splitAnalysisInfo.error} />}

      {tool === 'compress' && (
        <div className="space-y-2">
          {(
            [
              ['high', '高清 · 优先细节', '最长边 4096px · 质量 90%'],
              ['balanced', '均衡 · 日常发送', '最长边 2560px · 质量 82%'],
              ['strong', '强力 · 快速传输', '最长边 1920px · 质量 70%'],
              ['custom', '自定义最长边', '手动控制输出像素上限']
            ] as const
          ).map(([id, title, desc]) => {
            const active = compress.profile === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => patchCompress({ profile: id })}
                className="block w-full rounded-xl border p-2.5 text-left"
                style={{
                  background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  borderColor: active ? 'var(--accent-border)' : 'var(--line)'
                }}
              >
                <div className="text-[13.5px] font-bold" style={{ color: active ? 'var(--accent)' : 'var(--ink)' }}>
                  {title}
                </div>
                <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                  {desc}
                </div>
              </button>
            );
          })}
          {compress.profile === 'custom' && (
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              最长边限制（px）
              <NumericInput
                min={320}
                max={16384}
                fallback={2560}
                value={compress.maxEdge}
                onCommit={(v) => patchCompress({ maxEdge: v })}
                className="mt-1 h-8 w-full rounded-lg border px-2.5 font-mono text-[13.5px]"
              />
            </label>
          )}
        </div>
      )}

      {tool === 'resize' && (
        <div className="space-y-2.5">
          <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            调整方式
            <select
              value={resize.mode}
              onChange={(e) => {
                const nextMode = e.target.value as typeof resize.mode;
                if (nextMode === 'percent') {
                  patchResize({ mode: nextMode, value: resize.value > 400 ? 100 : resize.value });
                } else if (nextMode === 'width' || nextMode === 'height') {
                  const fallbackDim =
                    nextMode === 'height'
                      ? activeItem?.decoded.dimensions.height || 1080
                      : activeItem?.decoded.dimensions.width || 1080;
                  patchResize({ mode: nextMode, value: resize.mode === 'percent' ? fallbackDim : resize.value });
                } else {
                  patchResize({ mode: nextMode });
                }
              }}
              className="mt-1 h-8 w-full rounded-lg border px-2 text-[13.5px]"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            >
              <option value="width">按宽度（保持比例）</option>
              <option value="height">按高度（保持比例）</option>
              <option value="percent">按百分比缩放</option>
              <option value="box">自定义宽高范围</option>
            </select>
          </label>
          {resize.mode !== 'box' ? (
            <>
              <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                目标值（{resize.mode === 'percent' ? '%' : 'px'}）
                <NumericInput
                  min={1}
                  max={resize.mode === 'percent' ? 400 : 16384}
                  fallback={resize.mode === 'percent' ? 100 : 1080}
                  value={resize.value}
                  onCommit={(v) => patchResize({ value: v })}
                  className="mt-1 h-8 w-full rounded-lg border px-2.5 font-mono text-[13.5px]"
                />
              </label>
              {resize.mode === 'percent' ? (
                <div className="grid grid-cols-4 gap-1">
                  {[25, 50, 75, 100].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patchResize({ value: v })}
                      className="h-6 rounded-md border font-mono text-[12.5px] font-semibold"
                      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {[
                    800,
                    1080,
                    1920,
                    resize.mode === 'height'
                      ? activeItem?.decoded.dimensions.height || 1080
                      : activeItem?.decoded.dimensions.width || 1080
                  ].map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => patchResize({ value: v })}
                      className="h-6 rounded-md border font-mono text-[12.5px] font-semibold"
                      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                    >
                      {i === 3 ? (resize.mode === 'height' ? '原高' : '原宽') : v}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                  最大宽度
                  <NumericInput
                    min={1}
                    max={16384}
                    fallback={1920}
                    value={resize.width}
                    onCommit={(v) => patchResize({ width: v })}
                    className="mt-1 h-8 w-full rounded-lg border px-2 font-mono text-[13.5px]"
                  />
                </label>
                <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                  最大高度
                  <NumericInput
                    min={1}
                    max={16384}
                    fallback={1080}
                    value={resize.height}
                    onCommit={(v) => patchResize({ height: v })}
                    className="mt-1 h-8 w-full rounded-lg border px-2 font-mono text-[13.5px]"
                  />
                </label>
              </div>
              <label
                className="flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5"
                style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}
              >
                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                  保持原图比例（不拉伸变形）
                </span>
                <input
                  type="checkbox"
                  checked={resize.keepRatio}
                  onChange={(e) => patchResize({ keepRatio: e.target.checked })}
                  className="h-3.5 w-3.5 accent-blue-600"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {tool === 'transform' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => patchTransform({ rotation: (transform.rotation + 270) % 360 })}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold"
              style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>左转 90°</span>
            </button>
            <button
              type="button"
              onClick={() => patchTransform({ rotation: (transform.rotation + 90) % 360 })}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold"
              style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>右转 90°</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => patchTransform({ flipX: !transform.flipX })}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold"
              style={{
                background: transform.flipX ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                borderColor: transform.flipX ? 'var(--accent-border)' : 'var(--line-strong)',
                color: transform.flipX ? 'var(--accent)' : 'var(--ink)'
              }}
            >
              <FlipHorizontal2 className="h-3.5 w-3.5" />
              <span>水平翻转</span>
            </button>
            <button
              type="button"
              onClick={() => patchTransform({ flipY: !transform.flipY })}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold"
              style={{
                background: transform.flipY ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                borderColor: transform.flipY ? 'var(--accent-border)' : 'var(--line-strong)',
                color: transform.flipY ? 'var(--accent)' : 'var(--ink)'
              }}
            >
              <FlipVertical2 className="h-3.5 w-3.5" />
              <span>垂直翻转</span>
            </button>
          </div>
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            当前旋转：{transform.rotation}°{transform.flipX ? ' · 水平翻转' : ''}
            {transform.flipY ? ' · 垂直翻转' : ''}
          </p>
        </div>
      )}

      {tool === 'crop' && (
        <div className="space-y-2.5">
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            在画布内拖动裁剪框移动位置，拖动四角蓝色手柄缩放区域。
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {CROP_RATIOS.map((r) => {
              const active = Math.abs(crop.ratio - r.value) < 0.001;
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => {
                    if (activeItem && r.value > 0) {
                      patchCrop({ ratio: r.value, rect: getEngine().ImageCropper.cropForAspect(activeItem.decoded.dimensions, r.value) });
                    } else {
                      patchCrop({ ratio: 0 });
                    }
                  }}
                  data-active={active || undefined}
                  className="studio-chip h-8 rounded-lg border font-mono text-[13px] font-semibold"
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tool === 'stitch' && (
        <>
          <div className="grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
            {(
              [
                ['vertical', '纵向'],
                ['horizontal', '横向'],
                ['grid', '网格']
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => patchStitch({ mode: val })}
                data-active={stitch.mode === val || undefined}
                className="studio-seg-btn h-7.5 rounded-lg text-[13px] font-semibold"
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-1 flex justify-between text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              <span>{stitch.mode === 'horizontal' ? '统一高度 (px)' : stitch.mode === 'grid' ? '单格边长 (px)' : '统一宽度 (px)'}</span>
              {stitch.size !== DEFAULT_STITCH.size && (
                <button type="button" onClick={() => patchStitch({ size: 800 })} style={{ color: 'var(--accent)' }}>
                  ↺ 800
                </button>
              )}
            </div>
            <NumericInput
              min={160}
              max={10000}
              fallback={800}
              value={stitch.size}
              onCommit={(v) => patchStitch({ size: v })}
              className="h-9 w-full rounded-lg border px-2.5 font-mono text-[13.5px] font-normal"
            />
          </div>

          {stitch.mode === 'grid' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                每行列数
                <NumericInput
                  min={1}
                  max={20}
                  fallback={2}
                  value={stitch.columns}
                  onCommit={(v) => patchStitch({ columns: v })}
                  className="mt-1 h-9 w-full rounded-lg border px-2.5 font-mono text-[13.5px] font-normal"
                />
              </label>
              <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                填充方式
                <select
                  value={stitch.fit}
                  onChange={(e) => patchStitch({ fit: e.target.value as 'contain' | 'cover' })}
                  className="mt-1 h-9 w-full rounded-lg border px-2.5 text-[13.5px] font-normal"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                >
                  <option value="contain">完整不裁切</option>
                  <option value="cover">铺满裁切</option>
                </select>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              左右间距
              <NumericInput
                min={0}
                max={240}
                fallback={12}
                value={stitch.gapX}
                onCommit={(v) => patchStitch({ gapX: v })}
                className="mt-1 h-9 w-full rounded-lg border px-2.5 font-mono text-[13.5px] font-normal"
              />
            </label>
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              上下间距
              <NumericInput
                min={0}
                max={240}
                fallback={12}
                value={stitch.gapY}
                onCommit={(v) => patchStitch({ gapY: v })}
                className="mt-1 h-9 w-full rounded-lg border px-2.5 font-mono text-[13.5px] font-normal"
              />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              背景色
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={stitch.background}
                onChange={(e) => patchStitch({ background: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border p-0.5"
                style={{ borderColor: 'var(--line-strong)' }}
              />
              {BG_SWATCHES.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => patchStitch({ background: sw })}
                  className="h-4.5 w-4.5 rounded-full border"
                  style={{
                    background: sw,
                    borderColor: stitch.background.toLowerCase() === sw ? 'var(--accent)' : 'var(--line-strong)'
                  }}
                />
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="顶部标题（可选，如：11 月报销凭证）"
            value={stitch.title}
            onChange={(e) => patchStitch({ title: e.target.value })}
            className="h-8 w-full rounded-lg border px-2.5 text-[13px]"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
          />

          <details className="rounded-xl border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
            <summary
              className="flex cursor-pointer list-none items-center justify-between px-2.5 py-1.5 text-[13px] font-semibold select-none"
              style={{ color: 'var(--ink-2)' }}
            >
              <span>高级排版与说明文字</span>
              <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                展开
              </span>
            </summary>
            <div className="space-y-2 border-t px-2.5 py-2" style={{ borderColor: 'var(--line)' }}>
              {stitch.mode === 'grid' && (
                <>
                  <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                    自定义每行张数（如 5+6）
                    <input
                      type="text"
                      value={stitch.rowPattern}
                      onChange={(e) => patchStitch({ rowPattern: e.target.value })}
                      placeholder="留空按列数均分"
                      className="mt-1 h-7 w-full rounded-lg border px-2 text-[13px] font-normal"
                      style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                      单元格尺寸
                      <select
                        value={stitch.cellSizeMode}
                        onChange={(e) => patchStitch({ cellSizeMode: e.target.value as 'custom' | 'original' })}
                        className="mt-1 h-7 w-full rounded-lg border px-1.5 text-[12.5px]"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                      >
                        <option value="custom">统一尺寸</option>
                        <option value="original">按原图尺寸</option>
                      </select>
                    </label>
                    <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                      不满行位置
                      <select
                        value={stitch.incompleteRow}
                        onChange={(e) => patchStitch({ incompleteRow: e.target.value as 'last' | 'first' })}
                        className="mt-1 h-7 w-full rounded-lg border px-1.5 text-[12.5px]"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                      >
                        <option value="last">在最后一行</option>
                        <option value="first">在第一行</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              <textarea
                rows={2}
                placeholder="补充说明文字（可选，支持多行）"
                value={stitch.description}
                onChange={(e) => patchStitch({ description: e.target.value })}
                className="w-full rounded-lg border px-2 py-1 text-[13px]"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
              />

              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={stitch.headerPosition}
                  onChange={(e) => patchStitch({ headerPosition: e.target.value as 'top' | 'bottom' })}
                  className="h-7 rounded-lg border px-1.5 text-[12.5px]"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                >
                  <option value="top">标题在顶部</option>
                  <option value="bottom">标题在底部</option>
                </select>
                <select
                  value={stitch.headerAlign}
                  onChange={(e) => patchStitch({ headerAlign: e.target.value as 'left' | 'center' })}
                  className="h-7 rounded-lg border px-1.5 text-[12.5px]"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                >
                  <option value="left">文字左对齐</option>
                  <option value="center">文字居中</option>
                </select>
              </div>
            </div>
          </details>

          {/* Stitch Project Save / Open (.zip) */}
          <div className="grid grid-cols-2 gap-1.5">
            <input
              ref={projectInputRef}
              type="file"
              accept="application/zip,.zip"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) openStitchProject(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={saveStitchProject}
              disabled={!items.length || busy}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border text-[12.5px] font-semibold disabled:opacity-40"
              style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line-strong)', color: 'var(--ink-2)' }}
            >
              <Save className="h-3 w-3" />
              <span>存工程 .zip</span>
            </button>
            <button
              type="button"
              onClick={() => projectInputRef.current?.click()}
              disabled={busy}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border text-[12.5px] font-semibold disabled:opacity-40"
              style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line-strong)', color: 'var(--ink-2)' }}
            >
              <FolderOpen className="h-3 w-3" />
              <span>打开工程</span>
            </button>
          </div>
        </>
      )}

      {tool === 'convert' && (
        <div className="space-y-2.5">
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            在下方选择目标格式（PNG / JPG / WebP），不改变原图分辨率。若透明图转为 JPG，将使用下方背景色填充：
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              透明转 JPG 填充色
            </span>
            <div className="flex items-center gap-1.5">
              {['#ffffff', '#000000', '#f3f4f6'].map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => patchExportConfig({ background: bg })}
                  className="h-5 w-5 rounded-full border"
                  style={{
                    background: bg,
                    borderColor: exportConfig.background === bg ? 'var(--accent)' : 'var(--line-strong)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Unified SSOT Export Footer
  const inspectorFooter = (
    <div className="space-y-2">
      {tool !== 'split' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold" style={{ color: 'var(--muted)' }}>
              输出格式
            </span>
            <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-well)' }}>
              {(
                [
                  ['image/png', 'PNG'],
                  ['image/jpeg', 'JPG'],
                  ['image/webp', 'WebP']
                ] as const
              ).map(([fmt, label]) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => patchExportConfig({ format: fmt })}
                  data-active={exportConfig.format === fmt || undefined}
                  className="studio-seg-btn h-6.5 rounded-md px-2.5 font-mono text-[12.5px] font-bold"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {exportConfig.format !== 'image/png' && (
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                质量
              </span>
              <input
                type="range"
                min={40}
                max={100}
                value={Math.round(exportConfig.quality * 100)}
                onChange={(e) => patchExportConfig({ quality: Number(e.target.value) / 100 })}
                className="flex-1"
              />
              <span className="w-8 text-right font-mono text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>
                {Math.round(exportConfig.quality * 100)}%
              </span>
            </div>
          )}
        </>
      )}

      {(tool === 'stitch' || tool === 'split' || (items.length > 1 && exportConfig.batchZip)) && (
        <input
          type="text"
          maxLength={100}
          placeholder={
            tool === 'stitch'
              ? '拼图文件名（留空自动命名）'
              : tool === 'split'
                ? '切片 ZIP 包名（留空自动命名）'
                : 'ZIP 包名称（留空自动命名）'
          }
          value={exportConfig.filename}
          onChange={(e) => patchExportConfig({ filename: e.target.value })}
          className="h-7 w-full rounded-lg border px-2.5 text-[13px]"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
        />
      )}

      <div className="flex min-w-0 gap-2">
        {tool !== 'split' && (
          <button
            type="button"
            onClick={copyCurrentPng}
            disabled={!items.length || busy}
            title="复制图片到剪贴板（可在设置页切换 PNG / JPG 与尺寸上限）"
            className="studio-secondary-btn inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>复制</span>
          </button>
        )}

        <button
          type="button"
          onClick={exportCurrent}
          disabled={
            !items.length ||
            busy ||
            Boolean(tool === 'stitch' && stitchLayoutInfo.error) ||
            Boolean(tool === 'split' && !splitAnalysisInfo.analysis)
          }
          className="gemini-btn inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-full px-3.5 text-[13.5px] font-bold"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {tool === 'split'
              ? `切割并打包 ZIP${splitAnalysisInfo.analysis ? `（${splitAnalysisInfo.analysis.rects.length} 张）` : ''}`
              : tool === 'stitch'
                ? `导出拼图 · ${formatLabel}`
                : `导出 ${formatLabel}`}
          </span>
        </button>
      </div>

      {tool !== 'stitch' && tool !== 'split' && items.length > 1 && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <label className="flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={exportConfig.batchZip}
              onChange={(e) => patchExportConfig({ batchZip: e.target.checked })}
              className="accent-blue-600"
            />
            <span>打包 ZIP</span>
          </label>
          <button
            type="button"
            onClick={exportBatch}
            disabled={busy}
            className="h-7 rounded-full border px-3 text-[13.5px] font-semibold transition-colors hover:opacity-85 disabled:opacity-40"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            {exportConfig.batchZip ? `打包全部 ${items.length} 张` : `批量导出 ${items.length} 张`}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <p className="truncate text-center font-mono text-[13px]" style={{ color: 'var(--muted)' }}>
          {tool === 'stitch'
            ? `${items.length} 张拼图${outputDims ? ` · 输出 ${outputDims} px` : ''}`
            : activeItem
              ? `${outputDims ? `${outputDims} px · ` : ''}${activeItem.name} · ${formatBytes(activeItem.size)}`
              : ''}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Compact Image Sub-Tool Bar */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 overflow-x-auto rounded-xl border px-2 py-1"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)' }}
      >
        <div className="relative flex items-center gap-1">
          {IMAGE_TOOLS.map(({ id, label, icon: Icon }) => {
            const active = tool === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                data-active={active || undefined}
                className="studio-tab relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold"
              >
                {active && (
                  <motion.span
                    layoutId="image-subtool-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    className="absolute inset-0 rounded-lg border"
                    style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}
                  />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
        <span className="hidden pr-2 text-[12.5px] 2xl:inline" style={{ color: 'var(--muted)' }}>
          {tool === 'stitch'
            ? '画布内直接拖动图片交换位置'
            : tool === 'redact'
              ? '点「AI 识别」或在画布直接拖拉框选打码'
              : tool === 'split'
                ? '蓝虚线为切片边界，可导出 ZIP 或拆散进队列'
                : tool === 'watermark'
                  ? watermark.tile
                    ? '双击滑杆可单项重置'
                    : '画布内可直接拖动水印位置'
                  : tool === 'crop'
                    ? '拖动框内移动，拖四角缩放'
                    : '按住下方「对比原图」随时校验效果'}
        </span>
      </div>

      <WorkbenchShell
        sources={sourcesRail}
        stage={stage}
        inspectorHeader={inspectorHeader}
        inspectorBody={inspectorBody}
        inspectorFooter={inspectorFooter}
      />
    </div>
  );
}
