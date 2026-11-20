import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Eye,
  FileArchive,
  FileImage,
  FilePlus2,
  FileStack,
  FileText,
  IdCard,
  ImagePlus,
  Info,
  LayoutGrid,
  RotateCcw,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { formatBytes, getEngine } from '../bridge/engine';
import { useAppStore } from '../stores/useAppStore';
import { idCardSheetOptions, PdfToolId, usePdfStore } from '../stores/usePdfStore';
import { useTaskStore } from '../stores/useTaskStore';
import { NumericInput } from './NumericInput';
import { PdfIdCardSheet } from './PdfIdCardSheet';
import { PdfOrganizeStage } from './PdfOrganizeStage';
import { WorkbenchShell } from './WorkbenchShell';

const PDF_TOOLS: { id: PdfToolId; label: string; icon: typeof FileArchive }[] = [
  { id: 'compress', label: '压缩 PDF', icon: FileArchive },
  { id: 'organize', label: '页面整理', icon: LayoutGrid },
  { id: 'merge', label: '合并 PDF', icon: FileStack },
  { id: 'split', label: '拆分提取', icon: Scissors },
  { id: 'watermark', label: 'PDF 水印', icon: Droplets },
  { id: 'image-to-pdf', label: '图片转 PDF', icon: ImagePlus },
  { id: 'pdf-to-image', label: 'PDF 转图片', icon: FileImage },
  { id: 'id-card', label: '证件合成 A4', icon: IdCard }
];

const PROFILES = [
  { id: 'light', label: '轻度 · 180 DPI', desc: '清晰优先，适合合同与文字资料' },
  { id: 'standard', label: '标准 · 144 DPI', desc: '平衡清晰度与体积，适合微信/邮件' },
  { id: 'strong', label: '强力 · 110 DPI', desc: '体积优先，适合大体积扫描件' }
] as const;

const PDF_WM_SWATCHES = ['#315f72', '#6b7280', '#1f2937', '#dc2626', '#2563eb'];
const PDF_WM_CHIPS = [
  { label: '办理专用', text: '仅供办理＿＿使用，他用无效' },
  { label: '内部资料', text: '内部资料 · 严禁外传' },
  { label: '复印无效', text: '仅供核验 · 复印无效' }
];

const PDF_WM_POSITIONS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
] as const;

const PDF_WM_ANCHORS: Record<string, [number, number]> = {
  'top-left': [0.08, 0.18],
  top: [0.5, 0.18],
  'top-right': [0.92, 0.18],
  left: [0.08, 0.5],
  center: [0.5, 0.5],
  right: [0.92, 0.5],
  'bottom-left': [0.08, 0.82],
  bottom: [0.5, 0.82],
  'bottom-right': [0.92, 0.82]
};

const ID_CARD_SIZES = [
  { id: 'card', label: '标准证件（身份证 / 银行卡 / 驾驶证）' },
  { id: 'custom', label: '自定义宽度' },
  { id: 'fit', label: '自适应铺满（执照 / 户口本）' }
] as const;
const ID_CARD_SIDES = ['正面', '反面'];
const ID_CARD_WM_CHIPS = [
  { label: '办理专用', text: '仅供办理＿＿使用，他用无效' },
  { label: '入职专用', text: '仅供＿＿入职使用，他用无效' },
  { label: '租房专用', text: '仅供租房备案使用，他用无效' },
  { label: '复印无效', text: '仅供核验 · 复印无效' }
];

export function PdfWorkspace() {
  const tool = usePdfStore((s) => s.tool);
  const sessions = usePdfStore((s) => s.sessions);
  const activeId = usePdfStore((s) => s.activeId);
  const currentPage = usePdfStore((s) => s.currentPage);
  const importing = usePdfStore((s) => s.importing);
  const compress = usePdfStore((s) => s.compress);
  const organizeFilename = usePdfStore((s) => s.organizeFilename);
  const pagePlans = usePdfStore((s) => s.pagePlans);
  const mergeFilename = usePdfStore((s) => s.mergeFilename);
  const split = usePdfStore((s) => s.split);
  const watermark = usePdfStore((s) => s.watermark);
  const imageToPdf = usePdfStore((s) => s.imageToPdf);
  const pdfToImage = usePdfStore((s) => s.pdfToImage);
  const pdfImages = usePdfStore((s) => s.pdfImages);
  const idCard = usePdfStore((s) => s.idCard);
  const idCardFilename = usePdfStore((s) => s.idCardFilename);
  const idImages = usePdfStore((s) => s.idImages);
  const idImagesImporting = usePdfStore((s) => s.idImagesImporting);
  const idCardWatermarkMissing = idCard.watermark && !getEngine().IdCardSheet.hasWatermarkText(idCard.text);

  const setTool = usePdfStore((s) => s.setTool);
  const importFiles = usePdfStore((s) => s.importFiles);
  const importPdfImages = usePdfStore((s) => s.importPdfImages);
  const importIdImages = usePdfStore((s) => s.importIdImages);
  const selectSession = usePdfStore((s) => s.selectSession);
  const moveSession = usePdfStore((s) => s.moveSession);
  const setPage = usePdfStore((s) => s.setPage);
  const removeSession = usePdfStore((s) => s.removeSession);
  const clearSessions = usePdfStore((s) => s.clearSessions);
  const movePdfImage = usePdfStore((s) => s.movePdfImage);
  const removePdfImage = usePdfStore((s) => s.removePdfImage);
  const clearPdfImages = usePdfStore((s) => s.clearPdfImages);
  const moveIdImage = usePdfStore((s) => s.moveIdImage);
  const removeIdImage = usePdfStore((s) => s.removeIdImage);
  const clearIdImages = usePdfStore((s) => s.clearIdImages);
  const setOrganizeFilename = usePdfStore((s) => s.setOrganizeFilename);
  const restoreOrganizePages = usePdfStore((s) => s.restoreOrganizePages);
  const patchCompress = usePdfStore((s) => s.patchCompress);
  const setMergeFilename = usePdfStore((s) => s.setMergeFilename);
  const patchSplit = usePdfStore((s) => s.patchSplit);
  const patchWatermark = usePdfStore((s) => s.patchWatermark);
  const patchImageToPdf = usePdfStore((s) => s.patchImageToPdf);
  const patchPdfToImage = usePdfStore((s) => s.patchPdfToImage);
  const patchIdCard = usePdfStore((s) => s.patchIdCard);
  const setIdCardFilename = usePdfStore((s) => s.setIdCardFilename);
  const resetCurrentTool = usePdfStore((s) => s.resetCurrentTool);
  const runCompress = usePdfStore((s) => s.runCompress);
  const runOrganize = usePdfStore((s) => s.runOrganize);
  const runMerge = usePdfStore((s) => s.runMerge);
  const runSplit = usePdfStore((s) => s.runSplit);
  const runWatermark = usePdfStore((s) => s.runWatermark);
  const runImagesToPdf = usePdfStore((s) => s.runImagesToPdf);
  const runPdfToImages = usePdfStore((s) => s.runPdfToImages);
  const runIdCardSheet = usePdfStore((s) => s.runIdCardSheet);

  const setRoute = useAppStore((s) => s.setRoute);
  const tasks = useTaskStore((s) => s.tasks);
  const pdfTaskRunning = tasks.some((t) => t.status === 'running' && t.kind.startsWith('pdf-'));

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePan, setSpacePan] = useState(false);
  const [panDrag, setPanDrag] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [comparingOriginal, setComparingOriginal] = useState(false);
  const [pageRenderSeq, setPageRenderSeq] = useState(0);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const activePlan = activeSession
    ? pagePlans[activeSession.id] ??
      Array.from({ length: activeSession.numPages }, (_, idx) => ({
        uid: `${activeSession.id}_p${idx + 1}`,
        sourcePage: idx + 1,
        rotation: 0
      }))
    : [];
  const previewPage = activePlan[currentPage - 1];
  const previewSourcePage = previewPage?.sourcePage;
  const previewRotation = previewPage?.rotation ?? 0;
  const previewPageCount = activePlan.length;

  useEffect(() => {
    setComparingOriginal(false);
  }, [tool]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest?.('button,a,summary')) {
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

  // Render active PDF page preview with strict original aspect ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (tool === 'image-to-pdf' || tool === 'id-card' || tool === 'organize' || !activeSession || !canvas || !previewSourcePage) return;
    const controller = new AbortController();
    activeSession
      .renderPage(previewSourcePage, canvas, { maxWidth: 1100, maxHeight: 1400, signal: controller.signal, extraRotation: previewRotation })
      .then(() => {
        if (controller.signal.aborted) return;
        canvas.style.width = '';
        canvas.style.height = '';
        setPageRenderSeq((n) => n + 1);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tool, activeSession, previewSourcePage, previewRotation]);

  // Synchronized live PDF watermark overlay preview
  useEffect(() => {
    const base = canvasRef.current;
    const overlay = overlayRef.current;
    if (!base || !overlay) return;
    if (tool !== 'watermark' || !activeSession || comparingOriginal || !base.width || !base.height) {
      overlay.width = 1;
      overlay.height = 1;
      return;
    }

    let inRange = true;
    try {
      const selectedPages = getEngine().PageRange.parsePageSelection(watermark.pages, previewPageCount);
      inRange = selectedPages.includes(currentPage);
    } catch {
      inRange = false;
    }
    if (!inRange || !watermark.text.trim()) {
      overlay.width = 1;
      overlay.height = 1;
      return;
    }

    const w = base.width;
    const h = base.height;
    overlay.width = w;
    overlay.height = h;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const lines = watermark.text.trim().split(/\r?\n/).filter(Boolean);
    const stamp = document.createElement('canvas');
    const sctx = stamp.getContext('2d')!;
    const fontSize = 54;
    const pad = 30;
    const lh = 70;
    sctx.font = `700 ${fontSize}px sans-serif`;
    const maxLineW = Math.max(...lines.map((l) => sctx.measureText(l).width), 60);
    stamp.width = Math.ceil(maxLineW + pad * 2);
    stamp.height = lines.length * lh + pad * 2;
    const drawS = stamp.getContext('2d')!;
    drawS.font = `700 ${fontSize}px sans-serif`;
    drawS.textAlign = 'center';
    drawS.textBaseline = 'middle';
    drawS.fillStyle = watermark.color;
    lines.forEach((line, idx) => drawS.fillText(line, stamp.width / 2, pad + lh * (idx + 0.5)));

    const drawW = w * (watermark.size / 100);
    const drawH = (drawW * stamp.height) / Math.max(1, stamp.width);
    const rad = (-watermark.rotation * Math.PI) / 180;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Math.max(0.03, Math.min(1, watermark.opacity / 100));

    const drawAt = (cx: number, cy: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rad);
      ctx.drawImage(stamp, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    };

    if (watermark.tiled) {
      const cols = Math.max(1, Math.min(8, Math.round(watermark.density || 3)));
      const rows = Math.max(2, Math.round((cols * h) / Math.max(1, w)));
      const cw = w / cols;
      const ch = h / rows;
      for (let r = -1; r <= rows; r += 1) {
        const pdfRow = rows - 1 - r;
        for (let c = -1; c <= cols; c += 1) {
          drawAt((c + 0.5 + (pdfRow % 2 ? 0.25 : 0)) * cw, (r + 0.5) * ch);
        }
      }
    } else {
      const [ax, ay] = PDF_WM_ANCHORS[watermark.position] || [0.5, 0.5];
      drawAt(ax * w, ay * h);
    }
  }, [tool, activeSession, currentPage, previewPageCount, watermark, comparingOriginal, pageRenderSeq]);

  // Image-to-PDF and the ID card sheet share one image rail; only the data and the wording differ.
  const imageRail =
    tool === 'id-card'
      ? {
          title: `证件照片（${idImages.length}/${ID_CARD_SIDES.length}）`,
          hint: '第 1 张正面 · 第 2 张反面',
          items: idImages,
          itemLabel: (idx: number) => `${ID_CARD_SIDES[idx] ?? idx + 1} · `,
          openSlots: ID_CARD_SIDES.slice(idImages.length),
          emptyText: '',
          clearLabel: `清空证件照片（${idImages.length}）`,
          onMove: moveIdImage,
          onRemove: removeIdImage,
          onClear: clearIdImages
        }
      : tool === 'image-to-pdf'
        ? {
            title: `图片队列（${pdfImages.length}）`,
            hint: '每张图片生成一页',
            items: pdfImages,
            itemLabel: (idx: number) => `${idx + 1}. `,
            openSlots: null,
            emptyText: '点击上方「添加」或直接拖入图片',
            clearLabel: `清空图片（${pdfImages.length}）`,
            onMove: movePdfImage,
            onRemove: removePdfImage,
            onClear: clearPdfImages
          }
        : null;

  const idSheetLayout =
    tool === 'id-card' && idImages.length
      ? getEngine().IdCardSheet.layoutFor(
          idImages.map((i) => i.decoded.dimensions),
          idCardSheetOptions(idCard)
        )
      : null;
  const idSheetHint = !idSheetLayout
    ? '添加证件照片后，这里会显示实际打印尺寸。'
    : idSheetLayout.shrunk
      ? '照片偏高，已等比缩小以放进 A4。'
      : idCard.sizeMode === 'card'
        ? '先把照片裁到证件边缘，打印出来才是 1:1 实际大小。'
        : '';

  const sourcesRail =
    imageRail ? (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: 'var(--line)' }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>
              {imageRail.title}
            </p>
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
              {imageRail.hint}
            </p>
          </div>
          <button
            type="button"
            onClick={() => imgInputRef.current?.click()}
            disabled={(tool === 'id-card' ? idImagesImporting : importing) || imageRail.openSlots?.length === 0}
            className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[13px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            <span>添加</span>
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {imageRail.items.map((img, idx) => (
            <div
              key={img.id}
              className="flex items-center gap-1.5 rounded-xl border p-1.5"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)' }}
            >
              <img src={img.decoded.preview.url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {imageRail.itemLabel(idx)}
                  {img.name}
                </p>
                <p className="font-mono text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  {formatBytes(img.size)}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => imageRail.onMove(img.id, -1)}
                    className="grid h-4 w-4 place-items-center rounded border disabled:opacity-25"
                    style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                  >
                    <ArrowUp className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === imageRail.items.length - 1}
                    onClick={() => imageRail.onMove(img.id, 1)}
                    className="grid h-4 w-4 place-items-center rounded border disabled:opacity-25"
                    style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                  >
                    <ArrowDown className="h-2.5 w-2.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => imageRail.onRemove(img.id)}
                  className="grid h-4 w-full place-items-center opacity-60 hover:opacity-100"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {imageRail.openSlots?.map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => imgInputRef.current?.click()}
              disabled={importing}
              className="studio-slot flex h-[54px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-[12.5px] font-semibold disabled:opacity-40"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span>添加{side}</span>
            </button>
          ))}
          {!imageRail.items.length && imageRail.emptyText && (
            <div className="py-10 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              {imageRail.emptyText}
            </div>
          )}
        </div>

        {(imageRail.items.length > 0 || (tool === 'id-card' && idImagesImporting)) && (
          <div className="border-t p-2" style={{ borderColor: 'var(--line)' }}>
            <button
              type="button"
              onClick={imageRail.onClear}
              className="w-full rounded-lg py-1.5 text-[13px] font-semibold"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              {tool === 'id-card' && idImagesImporting ? '取消导入并清空证件照片' : imageRail.clearLabel}
            </button>
          </div>
        )}
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: 'var(--line)' }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>
              PDF 文档（{sessions.length}）
            </p>
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
              {tool === 'merge' ? '按列表顺序合并' : '按需加载引擎'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={importing}
            className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[13px] font-semibold"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            <span>导入</span>
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {sessions.map((session, idx) => {
            const active = session.id === activeId;
            return (
              <div
                key={session.id}
                onClick={() => selectSession(session.id)}
                data-active={active || undefined}
                className="studio-queue-card flex cursor-pointer items-center gap-1.5 rounded-xl border p-2"
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                  style={{ background: 'var(--bg-well)', color: active ? 'var(--accent)' : 'var(--muted)' }}
                >
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }} title={session.file.name}>
                    {session.file.name}
                  </p>
                  <p className="font-mono text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    {session.numPages} 页 · {formatBytes(session.file.size)}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  {sessions.length > 1 && (
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSession(session.id, -1);
                        }}
                        className="grid h-4 w-4 place-items-center rounded border disabled:opacity-25"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                      >
                        <ArrowUp className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === sessions.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSession(session.id, 1);
                        }}
                        className="grid h-4 w-4 place-items-center rounded border disabled:opacity-25"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                      >
                        <ArrowDown className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSession(session.id);
                    }}
                    className="grid h-4 w-full place-items-center opacity-60 hover:opacity-100"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {!sessions.length && (
            <div className="py-10 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              拖入 PDF 即可开始
            </div>
          )}
        </div>

        {sessions.length > 0 && (
          <div className="border-t p-2" style={{ borderColor: 'var(--line)' }}>
            <button
              type="button"
              onClick={clearSessions}
              className="w-full rounded-lg py-1.5 text-[13px] font-semibold"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              清空全部 PDF
            </button>
          </div>
        )}
      </div>
    );

  const stage =
    tool === 'image-to-pdf' ? (
      !pdfImages.length ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div
            className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            <ImagePlus className="h-7 w-7" />
          </div>
          <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink)' }}>
            导入图片合成 PDF
          </h2>
          <p className="mt-1.5 max-w-sm text-[13px]" style={{ color: 'var(--muted)' }}>
            每张图片生成一页，支持 JPG、PNG、WebP 与 HEIC / HEIF。
          </p>
          <button
            type="button"
            onClick={() => imgInputRef.current?.click()}
            className="gemini-btn mt-5 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold"
          >
            <ImagePlus className="h-4 w-4" />
            <span>选择图片</span>
          </button>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto p-5 sm:grid-cols-3 md:grid-cols-4">
          {pdfImages.map((img, idx) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-xl border p-2"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="aspect-[3/4] overflow-hidden rounded-lg" style={{ background: 'var(--bg-well)' }}>
                <img src={img.decoded.preview.url} alt="" className="h-full w-full object-contain" />
              </div>
              <p className="mt-1.5 truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                第 {idx + 1} 页 · {img.name}
              </p>
            </div>
          ))}
        </div>
      )
    ) : tool === 'id-card' && !idImages.length ? (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div
          className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
        >
          <IdCard className="h-7 w-7" />
        </div>
        <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink)' }}>
          导入证件照片合成 A4
        </h2>
        <p className="mt-1.5 max-w-sm text-[13px]" style={{ color: 'var(--muted)' }}>
          身份证、银行卡等正反两面按真实尺寸排进一张 A4，可叠加防盗用水印后导出 PDF 打印。
        </p>
        <button
          type="button"
          onClick={() => imgInputRef.current?.click()}
          disabled={importing}
          className="gemini-btn mt-5 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold"
        >
          <ImagePlus className="h-4 w-4" />
          <span>选择证件照片</span>
        </button>
      </div>
    ) : tool !== 'id-card' && !activeSession ? (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div
          className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
        >
          <FileArchive className="h-7 w-7" />
        </div>
        <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink)' }}>
          导入 PDF 开始处理
        </h2>
        <p className="mt-1.5 max-w-sm text-[13px]" style={{ color: 'var(--muted)' }}>
          支持压缩、合并、拆分、加水印与转图片；所有后台任务在切换页面时不会中断。
        </p>
        <button
          type="button"
          onClick={() => pdfInputRef.current?.click()}
          disabled={importing}
          className="gemini-btn mt-5 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold"
        >
          <FilePlus2 className="h-4 w-4" />
          <span>{importing ? '正在加载 PDF 引擎…' : '选择 PDF 文件'}</span>
        </button>
      </div>
    ) : tool === 'organize' && activeSession ? (
      <PdfOrganizeStage session={activeSession} plan={activePlan} />
    ) : (
      <>
        <div
          className="flex flex-1 items-center justify-center overflow-hidden px-5 pt-4 pb-14"
          onWheel={(e) => {
            if (e.deltaY === 0) return;
            e.preventDefault();
            setZoom((z) => {
              const next = Math.max(0.5, Math.min(3, Number((z + (e.deltaY < 0 ? 0.12 : -0.12)).toFixed(2))));
              if (next === 1) setPan({ x: 0, y: 0 });
              return next;
            });
          }}
          onDoubleClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <div
            onPointerDown={(e) => {
              if (!spacePan) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setPanDrag({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
            }}
            onPointerMove={(e) => {
              if (!panDrag) return;
              setPan({ x: panDrag.origX + e.clientX - panDrag.startX, y: panDrag.origY + e.clientY - panDrag.startY });
            }}
            onPointerUp={() => setPanDrag(null)}
            onPointerCancel={() => setPanDrag(null)}
            className={`relative flex max-h-full max-w-full items-center justify-center transition-transform duration-100 ${
              spacePan || panDrag ? (panDrag ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
          >
            {tool === 'id-card' ? (
              <PdfIdCardSheet images={idImages} config={idCard} />
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  className="block h-auto max-h-[calc(100dvh-236px)] w-auto max-w-full rounded bg-white object-contain"
                  style={{ boxShadow: '0 12px 36px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.08)' }}
                />
                <canvas
                  ref={overlayRef}
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 h-full w-full rounded ${
                    tool === 'watermark' && !comparingOriginal ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
          <div
            className="pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md"
            style={{
              background: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow-float)'
            }}
          >
            {tool !== 'id-card' && activeSession ? (
              <>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="grid h-6 w-6 place-items-center rounded-full disabled:opacity-30"
                  style={{ color: 'var(--ink-2)' }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                  {currentPage} / {previewPageCount}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= previewPageCount}
                  onClick={() => setPage(currentPage + 1)}
                  className="grid h-6 w-6 place-items-center rounded-full disabled:opacity-30"
                  style={{ color: 'var(--ink-2)' }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <span className="px-1 font-mono text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                A4 · 210 × 297 mm
              </span>
            )}

            {tool === 'watermark' && (
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
                  <span>对比原页</span>
                </button>
              </>
            )}

            <span className="h-3.5 w-px" style={{ background: 'var(--line)' }} />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
              className="grid h-6 w-6 place-items-center rounded-full"
              style={{ color: 'var(--ink-2)' }}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="min-w-[40px] font-mono text-[13px] font-semibold tabular-nums"
              style={{ color: 'var(--ink)' }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))))}
              className="grid h-6 w-6 place-items-center rounded-full"
              style={{ color: 'var(--ink-2)' }}
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
        {PDF_TOOLS.find((t) => t.id === tool)?.label}
      </span>
      <button
        type="button"
        onClick={resetCurrentTool}
        className="studio-chip inline-flex h-6.5 items-center gap-1 rounded-full border px-2.5 text-[12.5px] font-semibold"
      >
        <RotateCcw className="h-3 w-3" />
        <span>重置</span>
      </button>
    </div>
  );

  const inspectorBody = (
    <div className="space-y-3">
      {tool === 'compress' && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
            {(
              [
                ['raster', '图像强力压缩'],
                ['lossless', '无损结构整理']
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => patchCompress({ mode: val })}
                className="h-7 rounded-lg text-[13px] font-semibold"
                style={{
                  background: compress.mode === val ? 'var(--bg-surface)' : 'transparent',
                  color: compress.mode === val ? 'var(--accent)' : 'var(--muted)'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {compress.mode === 'raster' ? (
            <div className="space-y-1.5">
              {PROFILES.map((p) => {
                const active = compress.profile === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => patchCompress({ profile: p.id })}
                    className="block w-full rounded-xl border p-2.5 text-left"
                    style={{
                      background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                      borderColor: active ? 'var(--accent-border)' : 'var(--line)'
                    }}
                  >
                    <div className="text-[13.5px] font-bold" style={{ color: active ? 'var(--accent)' : 'var(--ink)' }}>
                      {p.label}
                    </div>
                    <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                      {p.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border p-2.5 text-[13px] leading-relaxed" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--muted)' }}>
              保留文字搜索、矢量与链接，仅整理对象流结构。
            </p>
          )}

          <label className="flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              变大时自动保留原文件
            </span>
            <input
              type="checkbox"
              checked={compress.keepSmaller}
              onChange={(e) => patchCompress({ keepSmaller: e.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
          </label>
        </>
      )}

      {tool === 'organize' && (
        <div className="space-y-2.5">
          <div className="rounded-xl border p-3 text-[13px] leading-relaxed" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--muted)' }}>
            {activeSession ? (
              <>
                当前文档共 <strong style={{ color: 'var(--ink)' }}>{activeSession.numPages}</strong> 页，整理后将保留{' '}
                <strong style={{ color: 'var(--accent)' }}>{activePlan.length}</strong> 页。在中间缩略图网格里可自由拖拽调序、旋转单页或删除多余页，导出时完整保留原矢量文字。
              </>
            ) : (
              '导入一份 PDF 后即可在缩略图网格中可视化排序、旋转与删页。'
            )}
          </div>
          {activeSession && (
            <button
              type="button"
              onClick={restoreOrganizePages}
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink-2)' }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>恢复原始页序与角度</span>
            </button>
          )}
        </div>
      )}

      {tool === 'merge' && (
        <div className="space-y-2.5">
          <p className="rounded-xl border p-3 text-[13px] leading-relaxed" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--muted)' }}>
            已导入 <strong style={{ color: 'var(--ink)' }}>{sessions.length}</strong> 份 PDF（共{' '}
            {sessions.reduce((s, d) => s + (pagePlans[d.id]?.length ?? d.numPages), 0)} 页）。用左侧列表的 ↑ / ↓ 调整合并顺序，合并时完整保留原页面尺寸与矢量文字。
          </p>
        </div>
      )}

      {tool === 'split' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
            {(
              [
                ['every', '每页拆一份'],
                ['ranges', '按范围拆分']
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => patchSplit({ mode: m })}
                className="h-7 rounded-lg text-[13px] font-semibold"
                style={{
                  background: split.mode === m ? 'var(--bg-surface)' : 'transparent',
                  color: split.mode === m ? 'var(--accent)' : 'var(--muted)'
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {split.mode === 'ranges' && (
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              拆分范围（按整理后页码，分号或换行分隔多份）
              <textarea
                rows={3}
                placeholder="例如：1-3；4-6；8,10"
                value={split.ranges}
                onChange={(e) => patchSplit({ ranges: e.target.value })}
                className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[13.5px] font-normal"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
              />
            </label>
          )}
        </div>
      )}

      {tool === 'watermark' && (
        <div className="space-y-2.5">
          <div>
            <textarea
              rows={2}
              value={watermark.text}
              onChange={(e) => patchWatermark({ text: e.target.value })}
              placeholder="输入 PDF 水印文字"
              className="w-full rounded-lg border px-2.5 py-1.5 text-[13.5px]"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PDF_WM_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => patchWatermark({ text: c.text })}
                  className="h-6 rounded-full border px-2.5 text-[12px] font-semibold"
                  style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              颜色
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={watermark.color}
                onChange={(e) => patchWatermark({ color: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border p-0.5"
                style={{ borderColor: 'var(--line-strong)' }}
              />
              {PDF_WM_SWATCHES.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => patchWatermark({ color: sw })}
                  className="h-4.5 w-4.5 rounded-full border"
                  style={{
                    background: sw,
                    borderColor: watermark.color.toLowerCase() === sw ? 'var(--accent)' : 'var(--line-strong)'
                  }}
                />
              ))}
            </div>
          </div>

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
                onClick={() => patchWatermark({ tiled })}
                className="h-7 rounded-lg text-[13px] font-semibold"
                style={{
                  background: watermark.tiled === tiled ? 'var(--bg-surface)' : 'transparent',
                  color: watermark.tiled === tiled ? 'var(--accent)' : 'var(--muted)'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            页面范围（按整理后页码，留空表示全部）
            <input
              type="text"
              placeholder="例如：1-5, 8"
              value={watermark.pages}
              onChange={(e) => patchWatermark({ pages: e.target.value })}
              className="mt-1 h-8 w-full rounded-lg border px-2.5 text-[13px] font-normal"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            />
          </label>

          <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            <div className="flex justify-between">
              <span>透明度</span>
              <span className="font-mono" style={{ color: 'var(--accent)' }}>
                {watermark.opacity}%
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              value={watermark.opacity}
              onChange={(e) => patchWatermark({ opacity: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            <div className="flex justify-between">
              <span>旋转角度</span>
              <span className="font-mono" style={{ color: 'var(--accent)' }}>
                {watermark.rotation}°
              </span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              value={watermark.rotation}
              onChange={(e) => patchWatermark({ rotation: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            <div className="flex justify-between">
              <span>尺寸</span>
              <span className="font-mono" style={{ color: 'var(--accent)' }}>
                {watermark.size}%
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={80}
              value={watermark.size}
              onChange={(e) => patchWatermark({ size: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          {watermark.tiled ? (
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              <div className="flex justify-between">
                <span>铺满密度</span>
                <span className="font-mono" style={{ color: 'var(--accent)' }}>
                  {watermark.density} 级
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={watermark.density}
                onChange={(e) => patchWatermark({ density: Number(e.target.value) })}
                className="w-full"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                单个位置
              </span>
              <div className="grid grid-cols-3 gap-1">
                {PDF_WM_POSITIONS.map((pos) => {
                  const active = watermark.position === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => patchWatermark({ position: pos })}
                      className="h-5 w-5 rounded border"
                      style={{
                        background: active ? 'var(--gemini-grad)' : 'var(--bg-subtle)',
                        borderColor: active ? 'transparent' : 'var(--line-strong)'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tool === 'image-to-pdf' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              页面尺寸
              <select
                value={imageToPdf.pageSize}
                onChange={(e) => patchImageToPdf({ pageSize: e.target.value as typeof imageToPdf.pageSize })}
                className="mt-1 h-8 w-full rounded-lg border px-2 text-[13px]"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
              >
                <option value="a4">A4</option>
                <option value="a3">A3</option>
                <option value="original">按图片原尺寸</option>
              </select>
            </label>
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              页边距 (mm)
              <NumericInput
                min={0}
                max={40}
                fallback={10}
                value={imageToPdf.marginMm}
                onCommit={(v) => patchImageToPdf({ marginMm: v })}
                className="mt-1 h-8 w-full rounded-lg border px-2 font-mono text-[13px]"
              />
            </label>
          </div>
          <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            图片画质
            <select
              value={imageToPdf.quality}
              onChange={(e) => patchImageToPdf({ quality: Number(e.target.value) })}
              className="mt-1 h-8 w-full rounded-lg border px-2 text-[13px]"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            >
              <option value={0.95}>高清 (95%)</option>
              <option value={0.9}>标准 (90%)</option>
              <option value={0.78}>较小体积 (78%)</option>
            </select>
          </label>
        </div>
      )}

      {tool === 'pdf-to-image' && (
        <div className="space-y-2.5">
          <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            页码范围（按整理后页码，留空表示全部）
            <input
              type="text"
              placeholder="例如：1-3, 5"
              value={pdfToImage.pages}
              onChange={(e) => patchPdfToImage({ pages: e.target.value })}
              className="mt-1 h-8 w-full rounded-lg border px-2.5 text-[13px] font-normal"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              输出格式
              <select
                value={pdfToImage.format}
                onChange={(e) => patchPdfToImage({ format: e.target.value as 'image/jpeg' | 'image/png' })}
                className="mt-1 h-8 w-full rounded-lg border px-2 text-[13px]"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
              >
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
              </select>
            </label>
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              清晰度
              <select
                value={pdfToImage.dpi}
                onChange={(e) => patchPdfToImage({ dpi: Number(e.target.value) })}
                className="mt-1 h-8 w-full rounded-lg border px-2 text-[13px]"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
              >
                <option value={96}>96 DPI · 快速</option>
                <option value={144}>144 DPI · 标准</option>
                <option value={200}>200 DPI · 清晰</option>
                <option value={300}>300 DPI · 高精</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {tool === 'id-card' && (
        <div className="space-y-2.5">
          <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            证件尺寸
            <select
              value={idCard.sizeMode}
              onChange={(e) => patchIdCard({ sizeMode: e.target.value as typeof idCard.sizeMode })}
              className="mt-1 h-8 w-full rounded-lg border px-2 text-[13px]"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            >
              {ID_CARD_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className={`grid gap-2 ${idCard.sizeMode === 'custom' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {idCard.sizeMode === 'custom' && (
              <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                证件宽度 (mm)
                <NumericInput
                  min={30}
                  max={186}
                  fallback={120}
                  value={idCard.customWidthMm}
                  onCommit={(v) => patchIdCard({ customWidthMm: v })}
                  className="mt-1 h-8 w-full rounded-lg border px-2 font-mono text-[13px]"
                />
              </label>
            )}
            <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              正反面间距 (mm)
              <NumericInput
                min={0}
                max={80}
                fallback={20}
                value={idCard.gapMm}
                onCommit={(v) => patchIdCard({ gapMm: v })}
                className="mt-1 h-8 w-full rounded-lg border px-2 font-mono text-[13px]"
              />
            </label>
          </div>

          <div className="space-y-1 rounded-xl border p-2.5 text-[12.5px] leading-relaxed" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--muted)' }}>
            {idSheetLayout?.cards.map((card, idx) => (
              <div key={ID_CARD_SIDES[idx]} className="flex justify-between">
                <span>{ID_CARD_SIDES[idx]}打印尺寸</span>
                <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>
                  {card.width.toFixed(1)} × {card.height.toFixed(1)} mm
                </span>
              </div>
            ))}
            {idSheetHint && <p>{idSheetHint}</p>}
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              叠加防盗用水印
            </span>
            <input
              type="checkbox"
              checked={idCard.watermark}
              onChange={(e) => patchIdCard({ watermark: e.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
          </label>

          {idCard.watermark && (
            <>
              <div>
                <textarea
                  rows={2}
                  value={idCard.text}
                  maxLength={getEngine().IdCardSheet.MAX_WATERMARK_CHARS}
                  aria-invalid={idCardWatermarkMissing}
                  aria-describedby={idCardWatermarkMissing ? 'id-card-watermark-hint' : undefined}
                  onChange={(e) => patchIdCard({ text: e.target.value })}
                  placeholder="输入水印文字，如：仅供办理入职使用"
                  className="w-full rounded-lg border px-2.5 py-1.5 text-[13.5px]"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
                />
                {idCardWatermarkMissing && (
                  <p id="id-card-watermark-hint" className="text-[12px]" style={{ color: 'var(--danger)' }}>
                    请填写水印文字，或关闭水印后再导出。
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ID_CARD_WM_CHIPS.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => patchIdCard({ text: c.text })}
                      className="h-6 rounded-full border px-2.5 text-[12px] font-semibold"
                      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                  颜色
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={idCard.color}
                    onChange={(e) => patchIdCard({ color: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border p-0.5"
                    style={{ borderColor: 'var(--line-strong)' }}
                  />
                  {PDF_WM_SWATCHES.map((sw) => (
                    <button
                      key={sw}
                      type="button"
                      onClick={() => patchIdCard({ color: sw })}
                      className="h-4.5 w-4.5 rounded-full border"
                      style={{
                        background: sw,
                        borderColor: idCard.color.toLowerCase() === sw ? 'var(--accent)' : 'var(--line-strong)'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
                {(
                  [
                    ['cards', '仅盖在证件上'],
                    ['page', '铺满整页']
                  ] as const
                ).map(([scope, label]) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => patchIdCard({ scope })}
                    className="h-7 rounded-lg text-[13px] font-semibold"
                    style={{
                      background: idCard.scope === scope ? 'var(--bg-surface)' : 'transparent',
                      color: idCard.scope === scope ? 'var(--accent)' : 'var(--muted)'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                <div className="flex justify-between">
                  <span>透明度</span>
                  <span className="font-mono" style={{ color: 'var(--accent)' }}>
                    {idCard.opacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={idCard.opacity}
                  onChange={(e) => patchIdCard({ opacity: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                <div className="flex justify-between">
                  <span>旋转角度</span>
                  <span className="font-mono" style={{ color: 'var(--accent)' }}>
                    {idCard.rotation}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={idCard.rotation}
                  onChange={(e) => patchIdCard({ rotation: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                <div className="flex justify-between">
                  <span>字号</span>
                  <span className="font-mono" style={{ color: 'var(--accent)' }}>
                    {idCard.fontPt} pt
                  </span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={28}
                  value={idCard.fontPt}
                  onChange={(e) => patchIdCard({ fontPt: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
            </>
          )}
        </div>
      )}

      <div
        className="flex gap-2 rounded-xl border p-2.5 text-[12.5px] leading-relaxed"
        style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--ink-2)' }}
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
        <div>
          后台独立运行，处理中切去「设置」或「图片」不会中断任务。
          {pdfTaskRunning && (
            <button type="button" onClick={() => setRoute('settings')} className="ml-1 font-bold underline" style={{ color: 'var(--accent)' }}>
              去设置页看看 →
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const footerAction = () => {
    if (tool === 'compress') {
      const label =
        compress.mode === 'lossless'
          ? '无损整理并下载 PDF'
          : `压缩并下载 · ${PROFILES.find((p) => p.id === compress.profile)?.label.split(' · ')[1]}`;
      return {
        filename: compress.filename,
        onFilename: (v: string) => patchCompress({ filename: v }),
        placeholder: '压缩后文件名（可选）',
        disabled: !activeSession || pdfTaskRunning,
        label: pdfTaskRunning ? '后台处理中…' : label,
        onRun: runCompress
      };
    }
    if (tool === 'organize') {
      return {
        filename: organizeFilename,
        onFilename: setOrganizeFilename,
        placeholder: '整理后文件名（可选）',
        disabled: !activeSession || !activePlan.length || pdfTaskRunning,
        label: pdfTaskRunning ? '后台处理中…' : `保存整理后的 PDF（${activePlan.length} 页）`,
        onRun: runOrganize
      };
    }
    if (tool === 'merge') {
      return {
        filename: mergeFilename,
        onFilename: setMergeFilename,
        placeholder: '合并后文件名（默认：合并文档.pdf）',
        disabled: sessions.length < 2 || pdfTaskRunning,
        label: `合并 ${sessions.length} 份 PDF 并下载`,
        onRun: runMerge
      };
    }
    if (tool === 'split') {
      return {
        filename: split.filename,
        onFilename: (v: string) => patchSplit({ filename: v }),
        placeholder: 'ZIP 输出名称前缀（可选）',
        disabled: !activeSession || pdfTaskRunning,
        label: '拆分并打包 ZIP 下载',
        onRun: runSplit
      };
    }
    if (tool === 'watermark') {
      return {
        filename: watermark.filename,
        onFilename: (v: string) => patchWatermark({ filename: v }),
        placeholder: '水印输出文件名（可选）',
        disabled: !activeSession || pdfTaskRunning,
        label: '添加水印并下载 PDF',
        onRun: runWatermark
      };
    }
    if (tool === 'image-to-pdf') {
      return {
        filename: imageToPdf.filename,
        onFilename: (v: string) => patchImageToPdf({ filename: v }),
        placeholder: '输出文件名（默认：图片合集.pdf）',
        disabled: !pdfImages.length || pdfTaskRunning,
        label: `生成 PDF（${pdfImages.length} 页）`,
        onRun: runImagesToPdf
      };
    }
    if (tool === 'id-card') {
      return {
        filename: idCardFilename,
        onFilename: setIdCardFilename,
        placeholder: '输出文件名（默认：证件复印件.pdf）',
        disabled: !idImages.length || idImagesImporting || idCardWatermarkMissing || pdfTaskRunning,
        label: pdfTaskRunning ? '后台处理中…' : idImagesImporting ? '正在导入证件照片…' : '合成 A4 并下载 PDF',
        onRun: runIdCardSheet
      };
    }
    return {
      filename: pdfToImage.filename,
      onFilename: (v: string) => patchPdfToImage({ filename: v }),
      placeholder: '输出图片名称前缀（可选）',
      disabled: !activeSession || pdfTaskRunning,
      label: `转换为 ${pdfToImage.format === 'image/png' ? 'PNG' : 'JPG'} 并下载`,
      onRun: runPdfToImages
    };
  };

  const act = footerAction();

  const inspectorFooter = (
    <div className="space-y-2">
      <input
        type="text"
        maxLength={100}
        placeholder={act.placeholder}
        value={act.filename}
        onChange={(e) => act.onFilename(e.target.value)}
        className="h-8 w-full rounded-lg border px-2.5 text-[13px]"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
      />
      <button
        type="button"
        onClick={act.onRun}
        disabled={act.disabled}
        className="gemini-btn inline-flex h-9 w-full items-center justify-center gap-2 rounded-full px-4 text-[13.5px] font-bold"
      >
        <span>{act.label}</span>
      </button>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) importFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={imgInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) (tool === 'id-card' ? importIdImages : importPdfImages)(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Compact PDF Sub-Tool Bar */}
      <div
        className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl border px-2 py-1"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)' }}
      >
        {PDF_TOOLS.map(({ id, label, icon: Icon }) => {
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
                  layoutId="pdf-subtool-pill"
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
