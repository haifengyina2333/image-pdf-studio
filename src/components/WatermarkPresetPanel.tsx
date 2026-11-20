import { useEffect, useRef, useState } from 'react';
import { Bookmark, Download, FolderInput, Plus, Trash2 } from 'lucide-react';
import { useImageStore } from '../stores/useImageStore';

export function WatermarkPresetPanel() {
  const presets = useImageStore((s) => s.wmPresets);
  const loaded = useImageStore((s) => s.wmPresetsLoaded);
  const loadPresets = useImageStore((s) => s.loadWatermarkPresets);
  const savePreset = useImageStore((s) => s.saveWatermarkPreset);
  const applyPreset = useImageStore((s) => s.applyWatermarkPreset);
  const deletePreset = useImageStore((s) => s.deleteWatermarkPreset);
  const exportPresets = useImageStore((s) => s.exportWatermarkPresets);
  const importPresets = useImageStore((s) => s.importWatermarkPresets);

  const [name, setName] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) loadPresets();
  }, [loaded, loadPresets]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await savePreset(trimmed);
    if (ok) setName('');
  };

  return (
    <details
      className="rounded-xl border"
      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)' }}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between px-2.5 py-1.5 text-[13px] font-semibold select-none"
        style={{ color: 'var(--ink-2)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Bookmark className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          <span>我的水印预设（{presets.length}）</span>
        </span>
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
          展开
        </span>
      </summary>

      <div className="space-y-2 border-t px-2.5 py-2" style={{ borderColor: 'var(--line)' }}>
        <div className="flex gap-1.5">
          <input
            type="text"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="输入名称保存当前水印…"
            className="h-7 min-w-0 flex-1 rounded-lg border px-2 text-[13px]"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[12.5px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            <Plus className="h-3 w-3" />
            <span>存预设</span>
          </button>
        </div>

        {presets.length > 0 ? (
          <div className="max-h-[120px] space-y-1 overflow-y-auto">
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-1 rounded-lg border px-2 py-1"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)' }}
              >
                <button
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold hover:underline"
                  style={{ color: 'var(--ink)' }}
                  title={`点击应用：${p.name}`}
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => deletePreset(p.id)}
                  aria-label={`删除预设 ${p.name}`}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded opacity-60 hover:opacity-100"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
            暂无已保存预设，可随时将常用文字/Logo 水印存到本地。
          </p>
        )}

        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importPresets(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded-md border text-[12px] font-semibold"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
          >
            <FolderInput className="h-3 w-3" />
            <span>导入 JSON</span>
          </button>
          <button
            type="button"
            disabled={!presets.length}
            onClick={exportPresets}
            className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded-md border text-[12px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
          >
            <Download className="h-3 w-3" />
            <span>备份导出</span>
          </button>
        </div>
      </div>
    </details>
  );
}
