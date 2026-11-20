import { Layers } from 'lucide-react';
import { SplitAnalysis } from '../bridge/engine';
import { useImageStore } from '../stores/useImageStore';
import { useTaskStore } from '../stores/useTaskStore';
import { NumericInput } from './NumericInput';

interface ImageSplitInspectorProps {
  analysis: SplitAnalysis | null;
  error: string | null;
}

const PRESETS: { label: string; rows: number; columns: number }[] = [
  { label: '自动识别', rows: 0, columns: 0 },
  { label: '2×2', rows: 2, columns: 2 },
  { label: '3×3 九宫格', rows: 3, columns: 3 },
  { label: '1×3 横切', rows: 1, columns: 3 },
  { label: '3×1 竖切', rows: 3, columns: 1 },
  { label: '2×3', rows: 2, columns: 3 }
];

export function ImageSplitInspector({ analysis, error }: ImageSplitInspectorProps) {
  const splitConfig = useImageStore((s) => s.splitConfig);
  const patchSplitConfig = useImageStore((s) => s.patchSplitConfig);
  const runSplitIntoQueue = useImageStore((s) => s.runSplitIntoQueue);
  const items = useImageStore((s) => s.items);
  const tasks = useTaskStore((s) => s.tasks);
  const busy = tasks.some((t) => t.status === 'running' && t.kind.startsWith('image-'));

  return (
    <div className="space-y-2.5">
      {/* Live Analysis Status */}
      {analysis ? (
        <div
          className="rounded-xl border px-3 py-2 text-[13px] font-semibold"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
        >
          {analysis.automatic ? '自动识别网格' : '按设定网格'}：共切分{' '}
          <span className="font-mono font-bold">{analysis.rects.length}</span> 张（{analysis.rowPattern}）
        </div>
      ) : (
        <div
          className="rounded-xl border px-3 py-2 text-[13px] leading-relaxed"
          style={{
            background: error ? 'var(--danger-soft)' : 'var(--bg-subtle)',
            borderColor: error ? 'var(--danger)' : 'var(--line)',
            color: error ? 'var(--danger)' : 'var(--muted)'
          }}
        >
          {error || '导入一张拼图或长图后，将自动识别分隔线并预览切割网格。'}
        </div>
      )}

      {/* Quick Presets */}
      <div className="grid grid-cols-3 gap-1.5">
        {PRESETS.map((p) => {
          const active = !splitConfig.rowPattern && splitConfig.rows === p.rows && splitConfig.columns === p.columns;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => patchSplitConfig({ rows: p.rows, columns: p.columns, rowPattern: '' })}
              className="h-7 rounded-lg border text-[12.5px] font-semibold"
              style={{
                background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                borderColor: active ? 'var(--accent-border)' : 'var(--line)',
                color: active ? 'var(--accent)' : 'var(--ink-2)'
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          行数（0=自动）
          <NumericInput
            min={0}
            max={50}
            fallback={0}
            value={splitConfig.rows}
            onCommit={(v) => patchSplitConfig({ rows: v, rowPattern: '' })}
            className="mt-1 h-8 w-full rounded-lg border px-2 font-mono text-[13px]"
          />
        </label>
        <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          列数（0=自动）
          <NumericInput
            min={0}
            max={50}
            fallback={0}
            value={splitConfig.columns}
            onCommit={(v) => patchSplitConfig({ columns: v, rowPattern: '' })}
            className="mt-1 h-8 w-full rounded-lg border px-2 font-mono text-[13px]"
          />
        </label>
      </div>

      <label className="block text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
        每行张数（可选，如 5+6）
        <input
          type="text"
          value={splitConfig.rowPattern}
          onChange={(e) => patchSplitConfig({ rowPattern: e.target.value })}
          placeholder="留空按行列切，或填 5+6 / 3+4"
          className="mt-1 h-8 w-full rounded-lg border px-2.5 text-[13px] font-normal"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
        />
      </label>

      <button
        type="button"
        onClick={runSplitIntoQueue}
        disabled={!items.length || !analysis || busy}
        className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold transition-colors hover:opacity-85 disabled:opacity-40"
        style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
      >
        <Layers className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
        <span>拆散进队列并重新拼图</span>
      </button>

      <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        把已合成的拼图一键拆回单张图进队列，即可拖拽调序或更换排版；或直接点下方主按钮打包 ZIP 导出全部切片。
      </p>
    </div>
  );
}
