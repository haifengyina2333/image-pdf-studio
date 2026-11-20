import { RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { getEngine } from '../bridge/engine';
import { DEFAULT_ID_PHOTO, useImageStore } from '../stores/useImageStore';
import { useTaskStore } from '../stores/useTaskStore';

export function IdPhotoInspector() {
  const items = useImageStore((s) => s.items);
  const selectedId = useImageStore((s) => s.selectedId);
  const idPhoto = useImageStore((s) => s.idPhoto);
  const portraitMaskByItemId = useImageStore((s) => s.portraitMaskByItemId);
  const patchIdPhoto = useImageStore((s) => s.patchIdPhoto);
  const segmentPortraitForCurrent = useImageStore((s) => s.segmentPortraitForCurrent);
  const clearPortraitMaskForCurrent = useImageStore((s) => s.clearPortraitMaskForCurrent);

  const tasks = useTaskStore((s) => s.tasks);
  const segmenting = tasks.some((t) => t.status === 'running' && t.kind === 'image-id-photo');

  const activeItem = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const hasMask = Boolean(activeItem && portraitMaskByItemId[activeItem.id]);

  const engine = getEngine();
  const presets = engine.PortraitSegmenter.PRESETS;
  const bgColors = engine.PortraitSegmenter.BG_COLORS;

  return (
    <div className="space-y-3">
      {/* AI Cutout trigger */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={segmentPortraitForCurrent}
          disabled={!activeItem || segmenting}
          className="gemini-btn inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-bold"
        >
          <Sparkles className="h-4 w-4" />
          <span>{segmenting ? '本地 AI 抠图中…' : hasMask ? '重新 AI 抠图' : 'AI 一键人像抠图'}</span>
        </button>
        {hasMask && (
          <div className="flex items-center justify-between text-[12px]">
            <span style={{ color: 'var(--success)' }}>● 已完成人像分离，可任意换底色</span>
            <button
              type="button"
              onClick={clearPortraitMaskForCurrent}
              className="inline-flex items-center gap-0.5 font-semibold opacity-75 hover:opacity-100"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 className="h-3 w-3" />
              清除
            </button>
          </div>
        )}
      </div>

      {/* Background Color Picker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[13px] font-semibold">
          <span style={{ color: 'var(--ink-2)' }}>证件照底色</span>
          <input
            type="color"
            aria-label="自定义证件照底色"
            value={idPhoto.bgColor === 'transparent' ? '#438edb' : idPhoto.bgColor}
            onChange={(e) => patchIdPhoto({ bgColor: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border p-0.5"
            style={{ borderColor: 'var(--line-strong)' }}
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {bgColors.map((c) => {
            const active = idPhoto.bgColor.toLowerCase() === c.value.toLowerCase();
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => patchIdPhoto({ bgColor: c.value })}
                className="flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-semibold"
                style={{
                  background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  borderColor: active ? 'var(--accent-border)' : 'var(--line)',
                  color: active ? 'var(--accent)' : 'var(--ink-2)'
                }}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border"
                  style={{
                    background:
                      c.value === 'transparent'
                        ? 'repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                        : c.value,
                    borderColor: 'var(--line-strong)'
                  }}
                />
                <span className="truncate">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Size Presets */}
      <div className="space-y-1.5">
        <span className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          证件照尺寸（300 DPI）
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((p) => {
            const active = idPhoto.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => patchIdPhoto({ preset: p.id })}
                className="rounded-xl border px-2.5 py-1.5 text-left"
                style={{
                  background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  borderColor: active ? 'var(--accent-border)' : 'var(--line)'
                }}
              >
                <div className="text-[12.5px] font-bold" style={{ color: active ? 'var(--accent)' : 'var(--ink)' }}>
                  {p.label}
                </div>
                <div className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                  {p.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Framing & Edge Refinement */}
      <div className="space-y-2 rounded-xl border p-2.5" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-bold" style={{ color: 'var(--ink-2)' }}>
            人像构图与边缘微调
          </span>
          {(idPhoto.zoom !== 1 || idPhoto.offsetX !== 0 || idPhoto.offsetY !== 0) && (
            <button
              type="button"
              onClick={() => patchIdPhoto({ zoom: 1, offsetX: 0, offsetY: 0 })}
              className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              <RotateCcw className="h-3 w-3" />
              居中复位
            </button>
          )}
        </div>

        <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          <div className="flex justify-between">
            <span>人像缩放</span>
            <span className="font-mono" style={{ color: 'var(--accent)' }}>
              {Math.round(idPhoto.zoom * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.6}
            max={2.2}
            step={0.02}
            value={idPhoto.zoom}
            onDoubleClick={() => patchIdPhoto({ zoom: DEFAULT_ID_PHOTO.zoom })}
            onChange={(e) => patchIdPhoto({ zoom: Number(e.target.value) })}
            className="w-full"
          />
        </label>

        <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          <div className="flex justify-between">
            <span>边缘羽化（发丝柔化）</span>
            <span className="font-mono" style={{ color: 'var(--accent)' }}>
              {idPhoto.feather.toFixed(1)}px
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            step={0.2}
            value={idPhoto.feather}
            onDoubleClick={() => patchIdPhoto({ feather: DEFAULT_ID_PHOTO.feather })}
            onChange={(e) => patchIdPhoto({ feather: Number(e.target.value) })}
            className="w-full"
          />
        </label>

        <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          <div className="flex justify-between">
            <span>抠图阈值</span>
            <span className="font-mono" style={{ color: 'var(--accent)' }}>
              {Math.round(idPhoto.threshold * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={0.8}
            step={0.02}
            value={idPhoto.threshold}
            onDoubleClick={() => patchIdPhoto({ threshold: DEFAULT_ID_PHOTO.threshold })}
            onChange={(e) => patchIdPhoto({ threshold: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          可在画布上直接拖拽人像调整居中位置；直接点「导出」时若尚未抠图会自动先执行本地 AI 抠图。
        </p>
      </div>
    </div>
  );
}
