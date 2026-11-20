import { useRef, useState } from 'react';
import { Check, Eraser, ImagePlus, PenTool, Plus, Stamp, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { usePdfStore } from '../stores/usePdfStore';

const INK_COLORS = [
  { id: 'black', label: '签字黑', color: '#111827' },
  { id: 'blue', label: '签字蓝', color: '#1d4ed8' },
  { id: 'red', label: '印章红', color: '#dc2626' }
];

const trimCanvasToPng = async (sourceCanvas: HTMLCanvasElement): Promise<{ blob: Blob; dataUrl: string; width: number; height: number } | null> => {
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = sourceCanvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const pad = 10;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d')!.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('签名生成失败'))), 'image/png')
  );
  const dataUrl = out.toDataURL('image/png');
  return { blob, dataUrl, width: sw, height: sh };
};

const processUploadedStamp = async (
  file: File,
  mode: 'keep' | 'remove-white' | 'red-seal'
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> => {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, w, h);

    if (mode !== 'keep') {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        if (a < 8) continue;
        if (mode === 'red-seal') {
          // Keep red ink (high R relative to G & B), discard white/gray paper background
          const redness = r - Math.max(g, b);
          if (redness < 24 || (r > 230 && g > 220 && b > 220)) {
            d[i + 3] = 0;
          } else {
            const strength = Math.min(1, (redness - 20) / 75);
            d[i] = Math.min(255, Math.max(r, 185));
            d[i + 1] = Math.round(g * 0.65);
            d[i + 2] = Math.round(b * 0.65);
            d[i + 3] = Math.round(a * strength);
          }
        } else {
          // Remove near-white paper background smoothly
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const chroma = Math.max(r, g, b) - Math.min(r, g, b);
          if (lum > 236 && chroma < 25) {
            d[i + 3] = 0;
          } else if (lum > 195 && chroma < 32) {
            const factor = (236 - lum) / 41;
            d[i + 3] = Math.round(a * Math.max(0, Math.min(1, factor)));
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const trimmed = await trimCanvasToPng(canvas);
    if (!trimmed) throw new Error('未能提取有效印章或签名像素，请更换处理模式或重新上传。');
    return trimmed;
  } finally {
    bitmap.close();
  }
};

export function PdfSignaturePanel() {
  const currentPage = usePdfStore((s) => s.currentPage);
  const assets = usePdfStore((s) => s.signatureAssets);
  const placements = usePdfStore((s) => s.signaturePlacements);
  const selectedPlacementId = usePdfStore((s) => s.selectedPlacementId);

  const addSignatureAsset = usePdfStore((s) => s.addSignatureAsset);
  const removeSignatureAsset = usePdfStore((s) => s.removeSignatureAsset);
  const placeSignature = usePdfStore((s) => s.placeSignature);
  const updateSignaturePlacement = usePdfStore((s) => s.updateSignaturePlacement);
  const removeSignaturePlacement = usePdfStore((s) => s.removeSignaturePlacement);
  const selectSignaturePlacement = usePdfStore((s) => s.selectSignaturePlacement);
  const setPage = usePdfStore((s) => s.setPage);
  const notify = useAppStore((s) => s.notify);

  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState('#111827');
  const [brushSize, setBrushSize] = useState(4);
  const [hasStroke, setHasStroke] = useState(false);
  const [uploadMode, setUploadMode] = useState<'remove-white' | 'red-seal' | 'keep'>('red-seal');

  const padRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 });

  const selectedPlacement = placements.find((p) => p.id === selectedPlacementId) ?? null;

  const padCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = padRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height
    };
  };

  const clearPad = () => {
    const canvas = padRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const saveDrawnSignature = async () => {
    const canvas = padRef.current;
    if (!canvas) return;
    const trimmed = await trimCanvasToPng(canvas);
    if (!trimmed) {
      notify('请先在下方手写签名', 'error');
      return;
    }
    const id = addSignatureAsset({
      name: `手写签名 ${assets.length + 1}`,
      ...trimmed
    });
    placeSignature(id, currentPage);
    clearPad();
    notify('已生成签名并放到当前页，可在画布上直接拖拽和缩放', 'success');
  };

  const handleStampUpload = async (file: File) => {
    try {
      const processed = await processUploadedStamp(file, uploadMode);
      const id = addSignatureAsset({
        name: file.name.replace(/\.[^.]+$/, '') || '印章',
        ...processed
      });
      placeSignature(id, currentPage);
      notify(`已载入「${file.name}」并放到当前页`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : '印章处理失败', 'error');
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode switch: Draw vs Upload Stamp */}
      <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
        <button
          type="button"
          onClick={() => setTab('draw')}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg text-[12.5px] font-semibold"
          style={{
            background: tab === 'draw' ? 'var(--bg-surface)' : 'transparent',
            color: tab === 'draw' ? 'var(--accent)' : 'var(--muted)'
          }}
        >
          <PenTool className="h-3.5 w-3.5" />
          <span>手写签名</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('upload')}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg text-[12.5px] font-semibold"
          style={{
            background: tab === 'upload' ? 'var(--bg-surface)' : 'transparent',
            color: tab === 'upload' ? 'var(--accent)' : 'var(--muted)'
          }}
        >
          <Stamp className="h-3.5 w-3.5" />
          <span>上传公章/签字</span>
        </button>
      </div>

      {tab === 'draw' ? (
        <div className="space-y-2 rounded-xl border p-2.5" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {INK_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setInkColor(c.color)}
                  title={c.label}
                  className="h-5 w-5 rounded-full border-2"
                  style={{
                    background: c.color,
                    borderColor: inkColor === c.color ? 'var(--accent)' : 'transparent'
                  }}
                />
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
              <span>笔粗</span>
              <input
                type="range"
                min={2}
                max={10}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-16"
              />
            </label>
          </div>

          <canvas
            ref={padRef}
            width={520}
            height={220}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const pt = padCoords(e);
              drawingRef.current = { active: true, lastX: pt.x, lastY: pt.y };
              const ctx = padRef.current!.getContext('2d')!;
              ctx.fillStyle = inkColor;
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
              ctx.fill();
              setHasStroke(true);
            }}
            onPointerMove={(e) => {
              if (!drawingRef.current.active) return;
              const pt = padCoords(e);
              const ctx = padRef.current!.getContext('2d')!;
              ctx.strokeStyle = inkColor;
              ctx.lineWidth = brushSize;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(drawingRef.current.lastX, drawingRef.current.lastY);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
              drawingRef.current.lastX = pt.x;
              drawingRef.current.lastY = pt.y;
            }}
            onPointerUp={() => {
              drawingRef.current.active = false;
            }}
            onPointerCancel={() => {
              drawingRef.current.active = false;
            }}
            className="h-[112px] w-full cursor-crosshair touch-none rounded-lg border bg-white"
            style={{ borderColor: 'var(--line-strong)' }}
          />

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={clearPad}
              disabled={!hasStroke}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border text-[12.5px] font-semibold disabled:opacity-35"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink-2)' }}
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>重写</span>
            </button>
            <button
              type="button"
              onClick={saveDrawnSignature}
              disabled={!hasStroke}
              className="gemini-btn inline-flex h-7 items-center justify-center gap-1 rounded-lg text-[12.5px] font-bold disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
              <span>放到当前页</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border p-2.5" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
          <div className="space-y-1">
            <span className="block text-[12px] font-bold" style={{ color: 'var(--muted)' }}>
              白底照片自动抠透明
            </span>
            <div className="grid grid-cols-3 gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-well)' }}>
              {(
                [
                  ['red-seal', '提取红章'],
                  ['remove-white', '去白底'],
                  ['keep', '原图透明']
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setUploadMode(m)}
                  className="h-6 rounded-md text-[11.5px] font-semibold"
                  style={{
                    background: uploadMode === m ? 'var(--bg-surface)' : 'transparent',
                    color: uploadMode === m ? 'var(--accent)' : 'var(--muted)'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <input
            ref={uploadRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleStampUpload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-[13px] font-semibold"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            <ImagePlus className="h-4 w-4" />
            <span>选择公章 / 透明签名图</span>
          </button>
          <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            支持直接上传白纸拍的红章或手写签字照片，自动去白底转为透明 PNG 盖在 PDF 上。
          </p>
        </div>
      )}

      {/* Saved Signatures / Stamps Library */}
      {assets.length > 0 && (
        <div className="space-y-1.5">
          <span className="block text-[12.5px] font-bold" style={{ color: 'var(--muted)' }}>
            签名 / 印章库（点击盖到第 {currentPage} 页）
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group relative flex flex-col items-center gap-1 rounded-xl border p-1.5"
                style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}
              >
                <button
                  type="button"
                  onClick={() => placeSignature(asset.id, currentPage)}
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-white p-1"
                  title="点击放置到当前页"
                >
                  <img src={asset.dataUrl} alt={asset.name} className="max-h-full max-w-full object-contain" />
                </button>
                <div className="flex w-full items-center justify-between gap-1 px-0.5">
                  <button
                    type="button"
                    onClick={() => placeSignature(asset.id, currentPage)}
                    className="inline-flex min-w-0 items-center gap-0.5 truncate text-[11.5px] font-semibold"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <span className="truncate">{asset.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSignatureAsset(asset.id)}
                    className="grid h-4 w-4 shrink-0 place-items-center rounded opacity-60 hover:opacity-100"
                    style={{ color: 'var(--danger)' }}
                    title="删除此签名"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Placement Inspector */}
      {selectedPlacement && (
        <div className="space-y-2 rounded-xl border p-2.5" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold" style={{ color: 'var(--accent)' }}>
              当前选中签章（{selectedPlacement.applyAll ? '全部页' : `第 ${selectedPlacement.page} 页`}）
            </span>
            <button
              type="button"
              onClick={() => removeSignaturePlacement(selectedPlacement.id)}
              className="inline-flex items-center gap-0.5 text-[12px] font-semibold"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 className="h-3 w-3" />
              移除
            </button>
          </div>

          <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            <div className="flex justify-between">
              <span>宽度占比</span>
              <span className="font-mono">{Math.round(selectedPlacement.widthRatio * 100)}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              value={Math.round(selectedPlacement.widthRatio * 100)}
              onChange={(e) => updateSignaturePlacement(selectedPlacement.id, { widthRatio: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </label>

          <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            <div className="flex justify-between">
              <span>旋转角度</span>
              <span className="font-mono">{selectedPlacement.rotation}°</span>
            </div>
            <input
              type="range"
              min={-45}
              max={45}
              value={selectedPlacement.rotation}
              onChange={(e) => updateSignaturePlacement(selectedPlacement.id, { rotation: Number(e.target.value) })}
              className="w-full"
            />
          </label>

          <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            <div className="flex justify-between">
              <span>不透明度</span>
              <span className="font-mono">{Math.round(selectedPlacement.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={25}
              max={100}
              value={Math.round(selectedPlacement.opacity * 100)}
              onChange={(e) => updateSignaturePlacement(selectedPlacement.id, { opacity: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </label>

          <label className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            <input
              type="checkbox"
              checked={selectedPlacement.applyAll}
              onChange={(e) => updateSignaturePlacement(selectedPlacement.id, { applyAll: e.target.checked })}
            />
            <span>应用到全部页面（同一落款位置）</span>
          </label>
        </div>
      )}

      {/* Placements List */}
      {placements.length > 0 && (
        <div className="space-y-1">
          <span className="block text-[12px] font-bold" style={{ color: 'var(--muted)' }}>
            已放置签章（{placements.length}）
          </span>
          <div className="max-h-[112px] space-y-1 overflow-y-auto">
            {placements.map((pl, idx) => {
              const asset = assets.find((a) => a.id === pl.stampId);
              const active = pl.id === selectedPlacementId;
              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    selectSignaturePlacement(pl.id);
                    if (!pl.applyAll) setPage(pl.page);
                  }}
                  className="flex cursor-pointer items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-[12px]"
                  style={{
                    background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                    borderColor: active ? 'var(--accent-border)' : 'var(--line)'
                  }}
                >
                  <span className="truncate font-semibold" style={{ color: 'var(--ink)' }}>
                    #{idx + 1} {asset?.name || '签章'} · {pl.applyAll ? '全页' : `P.${pl.page}`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSignaturePlacement(pl.id);
                    }}
                    className="grid h-5 w-5 place-items-center rounded opacity-65 hover:opacity-100"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
