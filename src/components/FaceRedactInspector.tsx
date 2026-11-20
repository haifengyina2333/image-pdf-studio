import { useRef } from 'react';
import { ArrowUpRight, Eye, EyeOff, ImagePlus, Minus, Plus, ScanFace, Square, Trash2 } from 'lucide-react';
import { getEngine, RedactBoxKind } from '../bridge/engine';
import { DEFAULT_REDACT, useImageStore } from '../stores/useImageStore';
import { useTaskStore } from '../stores/useTaskStore';

const SOLID_SWATCHES = ['#111827', '#ffffff', '#334155', '#2563eb', '#e11d48'];
const ANNOTATION_SWATCHES = ['#ef4444', '#f59e0b', '#2563eb', '#10b981', '#111827'];
const DRAW_MODES: { id: RedactBoxKind; label: string; icon: typeof ScanFace }[] = [
  { id: 'redact', label: '打码框', icon: ScanFace },
  { id: 'bar', label: '横条遮挡', icon: Minus },
  { id: 'highlight', label: '红框高亮', icon: Square },
  { id: 'arrow', label: '箭头标注', icon: ArrowUpRight }
];

export function FaceRedactInspector() {
  const items = useImageStore((s) => s.items);
  const selectedId = useImageStore((s) => s.selectedId);
  const redact = useImageStore((s) => s.redact);
  const drawMode = useImageStore((s) => s.redactDrawMode);
  const detectMode = useImageStore((s) => s.redactDetectMode);
  const confidence = useImageStore((s) => s.redactConfidence);
  const stickerName = useImageStore((s) => s.stickerName);
  const facesByItemId = useImageStore((s) => s.facesByItemId);
  const selectedFaceId = useImageStore((s) => s.selectedFaceId);

  const patchRedact = useImageStore((s) => s.patchRedact);
  const setDrawMode = useImageStore((s) => s.setRedactDrawMode);
  const setDetectMode = useImageStore((s) => s.setRedactDetectMode);
  const setConfidence = useImageStore((s) => s.setRedactConfidence);
  const setSelectedFaceId = useImageStore((s) => s.setSelectedFaceId);
  const detectFacesForCurrent = useImageStore((s) => s.detectFacesForCurrent);
  const addManualFace = useImageStore((s) => s.addManualFace);
  const updateFace = useImageStore((s) => s.updateFace);
  const removeFace = useImageStore((s) => s.removeFace);
  const clearFacesForCurrent = useImageStore((s) => s.clearFacesForCurrent);
  const importSticker = useImageStore((s) => s.importSticker);

  const tasks = useTaskStore((s) => s.tasks);
  const detecting = tasks.some((t) => t.status === 'running' && t.kind === 'image-face-detect');

  const stickerInputRef = useRef<HTMLInputElement>(null);
  const activeItem = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const faces = activeItem ? facesByItemId[activeItem.id] ?? [] : [];
  const selectedFace = faces.find((f) => f.id === selectedFaceId) ?? null;

  const engine = getEngine();
  const stickerPresets = engine.FaceRedactor.stickerPresets;
  const emojiPresets = engine.FaceRedactor.emojiPresets;
  const expressions = engine.FaceExpression.expressions;

  return (
    <div className="space-y-2.5">
      {/* AI Detect + Manual Add */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={detectFacesForCurrent}
          disabled={!activeItem || detecting}
          className="gemini-btn inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-bold"
        >
          <ScanFace className="h-4 w-4" />
          <span>{detecting ? '本地 AI 识别中…' : 'AI 自动识别人脸'}</span>
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => addManualFace(undefined, drawMode)}
            disabled={!activeItem}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border text-[13px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line-strong)', color: 'var(--ink-2)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>
              {drawMode === 'bar'
                ? '加横条'
                : drawMode === 'highlight'
                  ? '加红框'
                  : drawMode === 'arrow'
                    ? '加箭头'
                    : '手动添框'}
            </span>
          </button>
          <button
            type="button"
            onClick={clearFacesForCurrent}
            disabled={!faces.length}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border text-[13px] font-semibold disabled:opacity-35"
            style={{ background: 'var(--danger-soft)', borderColor: 'transparent', color: 'var(--danger)' }}
          >
            <Trash2 className="h-3 w-3" />
            <span>清空（{faces.length}）</span>
          </button>
        </div>

        {/* Drawing / Annotation tool picker */}
        <div className="space-y-1 pt-0.5">
          <span className="block text-[12px] font-bold" style={{ color: 'var(--muted)' }}>
            画布拖拽绘制模式
          </span>
          <div className="grid grid-cols-4 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
            {DRAW_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDrawMode(id)}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-lg px-1 text-[11.5px] font-semibold"
                style={{
                  background: drawMode === id ? 'var(--bg-surface)' : 'transparent',
                  color: drawMode === id ? 'var(--accent)' : 'var(--muted)'
                }}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {(drawMode === 'highlight' || drawMode === 'arrow') && (
          <div className="space-y-2 rounded-xl border p-2" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                标注颜色
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={redact.annotationColor || '#ef4444'}
                  onChange={(e) => {
                    patchRedact({ annotationColor: e.target.value });
                    if (selectedFace && (selectedFace.kind === 'highlight' || selectedFace.kind === 'arrow')) {
                      updateFace(selectedFace.id, { strokeColor: e.target.value });
                    }
                  }}
                  className="h-6 w-7 cursor-pointer rounded border p-0.5"
                  style={{ borderColor: 'var(--line-strong)' }}
                />
                {ANNOTATION_SWATCHES.map((sw) => (
                  <button
                    key={sw}
                    type="button"
                    onClick={() => {
                      patchRedact({ annotationColor: sw });
                      if (selectedFace && (selectedFace.kind === 'highlight' || selectedFace.kind === 'arrow')) {
                        updateFace(selectedFace.id, { strokeColor: sw });
                      }
                    }}
                    className="h-4.5 w-4.5 rounded-full border"
                    style={{
                      background: sw,
                      borderColor: (redact.annotationColor || '#ef4444').toLowerCase() === sw ? 'var(--accent)' : 'var(--line-strong)'
                    }}
                  />
                ))}
              </div>
            </div>
            <label className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              <div className="flex justify-between">
                <span>线条粗细</span>
                <span className="font-mono" style={{ color: 'var(--accent)' }}>
                  {redact.annotationWidth || 5}px
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={16}
                value={redact.annotationWidth || 5}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  patchRedact({ annotationWidth: val });
                  if (selectedFace && (selectedFace.kind === 'highlight' || selectedFace.kind === 'arrow')) {
                    updateFace(selectedFace.id, { strokeWidth: val });
                  }
                }}
                className="w-full"
              />
            </label>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-well)' }}>
            {(
              [
                ['group', '合照精细'],
                ['standard', '标准快速']
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setDetectMode(m)}
                className="h-6 rounded-md text-[12.5px] font-semibold"
                style={{
                  background: detectMode === m ? 'var(--bg-surface)' : 'transparent',
                  color: detectMode === m ? 'var(--accent)' : 'var(--muted)'
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
            <span>阈值</span>
            <select
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="h-6 rounded-md border px-1 font-mono text-[12px]"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            >
              <option value={0.2}>0.20 高召回</option>
              <option value={0.35}>0.35 均衡</option>
              <option value={0.55}>0.55 严格</option>
            </select>
          </label>
        </div>
      </div>

      {/* Style selector */}
      <div className="grid grid-cols-4 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-well)' }}>
        {(
          [
            ['mosaic', '马赛克'],
            ['blur', '模糊'],
            ['solid', '纯色'],
            ['emoji', '贴纸']
          ] as const
        ).map(([st, label]) => (
          <button
            key={st}
            type="button"
            onClick={() => patchRedact({ style: st })}
            className="h-7 rounded-lg text-[13px] font-semibold"
            style={{
              background: redact.style === st ? 'var(--bg-surface)' : 'transparent',
              color: redact.style === st ? 'var(--accent)' : 'var(--muted)'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Shape + Margin + Strength */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          遮挡形状
        </span>
        <div className="grid grid-cols-2 gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-well)' }}>
          {(
            [
              ['ellipse', '椭圆'],
              ['rect', '矩形']
            ] as const
          ).map(([sh, label]) => (
            <button
              key={sh}
              type="button"
              onClick={() => patchRedact({ shape: sh })}
              className="h-6 rounded-md px-2.5 text-[12.5px] font-semibold"
              style={{
                background: redact.shape === sh ? 'var(--bg-surface)' : 'transparent',
                color: redact.shape === sh ? 'var(--accent)' : 'var(--muted)'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(redact.style === 'mosaic' || redact.style === 'blur') && (
        <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          <div className="flex justify-between">
            <span>{redact.style === 'mosaic' ? '马赛克块大小' : '模糊强度'}</span>
            <span className="font-mono" style={{ color: 'var(--accent)' }}>
              {redact.strength}
            </span>
          </div>
          <input
            type="range"
            min={4}
            max={60}
            value={redact.strength}
            onDoubleClick={() => patchRedact({ strength: DEFAULT_REDACT.strength })}
            onChange={(e) => patchRedact({ strength: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      )}

      <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
        <div className="flex justify-between">
          <span>区域外扩</span>
          <span className="font-mono" style={{ color: 'var(--accent)' }}>
            +{redact.margin}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={80}
          value={redact.margin}
          onDoubleClick={() => patchRedact({ margin: DEFAULT_REDACT.margin })}
          onChange={(e) => patchRedact({ margin: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      {redact.style === 'solid' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            遮挡颜色
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={redact.color}
              onChange={(e) => patchRedact({ color: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border p-0.5"
              style={{ borderColor: 'var(--line-strong)' }}
            />
            {SOLID_SWATCHES.map((sw) => (
              <button
                key={sw}
                type="button"
                onClick={() => patchRedact({ color: sw })}
                className="h-4.5 w-4.5 rounded-full border"
                style={{
                  background: sw,
                  borderColor: redact.color.toLowerCase() === sw ? 'var(--accent)' : 'var(--line-strong)'
                }}
              />
            ))}
          </div>
        </div>
      )}

      {redact.style === 'emoji' && (
        <div className="space-y-2 rounded-xl border p-2" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold" style={{ color: 'var(--ink-2)' }}>
              可爱贴纸 / 表情
            </span>
            <select
              aria-label="表情联动模式"
              value={redact.expressionMode}
              onChange={(e) => patchRedact({ expressionMode: e.target.value })}
              className="h-6 rounded-md border px-1.5 text-[12px]"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            >
              <option value="auto">跟随人脸表情</option>
              <option value="fixed">固定 Emoji</option>
              {expressions.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  统一：{ex.emoji} {ex.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => patchRedact({ sticker: '' })}
              className="h-6 rounded-md border text-[12px] font-semibold"
              style={{
                background: redact.sticker === '' ? 'var(--accent-soft)' : 'var(--bg-surface)',
                borderColor: redact.sticker === '' ? 'var(--accent-border)' : 'var(--line)',
                color: redact.sticker === '' ? 'var(--accent)' : 'var(--ink-2)'
              }}
            >
              Emoji 表情
            </button>
            {stickerPresets.map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => patchRedact({ sticker: sp.id })}
                className="h-6 truncate rounded-md border px-1 text-[12px] font-semibold"
                style={{
                  background: redact.sticker === sp.id ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  borderColor: redact.sticker === sp.id ? 'var(--accent-border)' : 'var(--line)',
                  color: redact.sticker === sp.id ? 'var(--accent)' : 'var(--ink-2)'
                }}
              >
                {sp.name}
              </button>
            ))}
          </div>

          {redact.sticker === '' && (
            <div className="grid grid-cols-10 gap-0.5 pt-0.5">
              {emojiPresets.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => patchRedact({ emoji: em, expressionMode: 'fixed' })}
                  className="grid h-6 place-items-center rounded text-[13px] transition-transform hover:scale-115"
                  style={{
                    background: redact.emoji === em && redact.expressionMode === 'fixed' ? 'var(--accent-soft)' : 'transparent'
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          <div>
            <input
              ref={stickerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importSticker(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => stickerInputRef.current?.click()}
              className="inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg border border-dashed text-[12.5px] font-semibold"
              style={{
                background: redact.sticker === 'custom' ? 'var(--accent-soft)' : 'var(--bg-surface)',
                borderColor: redact.sticker === 'custom' ? 'var(--accent-border)' : 'var(--line-strong)',
                color: redact.sticker === 'custom' ? 'var(--accent)' : 'var(--ink-2)'
              }}
            >
              <ImagePlus className="h-3 w-3" />
              <span className="truncate">{stickerName ? `自定义贴纸：${stickerName}` : '上传自定义贴纸图片'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Detected / Manual Faces List */}
      {faces.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[12.5px] font-bold" style={{ color: 'var(--muted)' }}>
            打码区域（{faces.filter((f) => f.enabled !== false).length}/{faces.length} 已启用）
          </p>
          <div className="max-h-[132px] space-y-1 overflow-y-auto">
            {faces.map((face, idx) => {
              const active = face.id === selectedFaceId;
              const expr = engine.FaceExpression.normalize(face.expressionOverride || face.expression || 'neutral');
              return (
                <div
                  key={face.id}
                  onClick={() => setSelectedFaceId(face.id)}
                  className="flex cursor-pointer items-center justify-between gap-1.5 rounded-lg border px-2 py-1"
                  style={{
                    background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                    borderColor: active ? 'var(--accent-border)' : 'var(--line)'
                  }}
                >
                  <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                    #{idx + 1}{' '}
                    {face.kind === 'bar'
                      ? '横条遮挡'
                      : face.kind === 'highlight'
                        ? '红框高亮'
                        : face.kind === 'arrow'
                          ? '箭头标注'
                          : face.source === 'manual'
                            ? '手动框'
                            : `人脸 ${engine.FaceExpression.emojiFor(expr)}`}
                  </span>
                  <div className="flex items-center gap-1">
                    {redact.style === 'emoji' && (!face.kind || face.kind === 'redact') && (
                      <select
                        value={face.expressionOverride || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateFace(face.id, { expressionOverride: e.target.value })}
                        className="h-5 rounded border px-1 text-[11.5px]"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                      >
                        <option value="">自动</option>
                        {expressions.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.emoji}
                            {ex.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFace(face.id, { enabled: face.enabled === false });
                      }}
                      title={face.enabled !== false ? '暂时取消该区域打码' : '启用该区域打码'}
                      className="grid h-5 w-5 place-items-center rounded"
                      style={{ color: face.enabled !== false ? 'var(--accent)' : 'var(--muted)' }}
                    >
                      {face.enabled !== false ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFace(face.id);
                      }}
                      className="grid h-5 w-5 place-items-center rounded opacity-65 hover:opacity-100"
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedFace && (
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
              提示：画布中可直接拖动选中的蓝框微调位置，拖右下角缩放，或在空白处拖拉新建遮挡框。
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border p-2.5 text-[12.5px] leading-relaxed" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--muted)' }}>
          点击上方「AI 自动识别人脸」自动检测并分析表情，也可以直接在画布上按住鼠标拖拉绘制遮挡框。
        </p>
      )}
    </div>
  );
}
