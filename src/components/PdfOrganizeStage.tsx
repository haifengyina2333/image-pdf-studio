import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, GripVertical, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { PdfSessionLike } from '../bridge/engine';
import { PdfOrganizePageItem, usePdfStore } from '../stores/usePdfStore';

interface PdfOrganizeStageProps {
  session: PdfSessionLike;
  plan: PdfOrganizePageItem[];
}

export function PdfOrganizeStage({ session, plan }: PdfOrganizeStageProps) {
  const reorderOrganizePage = usePdfStore((s) => s.reorderOrganizePage);
  const moveOrganizePage = usePdfStore((s) => s.moveOrganizePage);
  const rotateOrganizePage = usePdfStore((s) => s.rotateOrganizePage);
  const removeOrganizePage = usePdfStore((s) => s.removeOrganizePage);

  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [overUid, setOverUid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setThumbs({});

    const renderAll = async () => {
      const canvas = document.createElement('canvas');
      const total = Math.min(session.numPages, 60);
      for (let p = 1; p <= total; p += 1) {
        if (cancelled) break;
        try {
          await session.renderPage(p, canvas, {
            maxWidth: 260,
            maxHeight: 340,
            outputScale: 1,
            signal: controller.signal
          });
          if (cancelled) break;
          const url = canvas.toDataURL('image/jpeg', 0.8);
          setThumbs((prev) => ({ ...prev, [p]: url }));
        } catch {
          if (cancelled) break;
        }
      }
      canvas.width = 1;
      canvas.height = 1;
    };
    renderAll();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [session]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between text-[13px]" style={{ color: 'var(--muted)' }}>
        <span>拖拽页面卡片可直接调序 · 支持单页旋转 90° 与删除不需要的页面</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--ink-2)' }}>
          当前保留 {plan.length} / {session.numPages} 页
        </span>
      </div>

      <div className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {plan.map((item, idx) => {
          const thumb = thumbs[item.sourcePage];
          const isOver = overUid === item.uid && dragUid !== item.uid;
          return (
            <div
              key={item.uid}
              draggable
              onDragStart={() => setDragUid(item.uid)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverUid(item.uid);
              }}
              onDragLeave={() => setOverUid((cur) => (cur === item.uid ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragUid && dragUid !== item.uid) reorderOrganizePage(dragUid, item.uid);
                setDragUid(null);
                setOverUid(null);
              }}
              onDragEnd={() => {
                setDragUid(null);
                setOverUid(null);
              }}
              className="group flex cursor-grab flex-col rounded-xl border p-2 transition-all active:cursor-grabbing"
              style={{
                background: 'var(--bg-surface)',
                borderColor: isOver ? 'var(--accent)' : 'var(--line)',
                boxShadow: isOver ? '0 0 0 2px var(--accent-soft)' : 'var(--shadow-card)'
              }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-1 text-[12px]">
                <span className="inline-flex items-center gap-0.5 font-mono font-bold" style={{ color: 'var(--ink)' }}>
                  <GripVertical className="h-3 w-3" style={{ color: 'var(--muted)' }} />
                  第 {idx + 1} 页
                </span>
                <span className="font-mono text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  原 P.{item.sourcePage}
                  {item.rotation ? ` · ${item.rotation}°` : ''}
                </span>
              </div>

              <div
                className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg p-1"
                style={{ background: 'var(--bg-well)' }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={`第 ${item.sourcePage} 页`}
                    className="max-h-full max-w-full rounded object-contain shadow-xs transition-transform duration-150"
                    style={{ transform: `rotate(${item.rotation}deg)` }}
                  />
                ) : (
                  <span className="font-mono text-[12.5px]" style={{ color: 'var(--muted)' }}>
                    P.{item.sourcePage}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveOrganizePage(item.uid, -1)}
                    title="前移一页"
                    className="grid h-6 w-6 place-items-center rounded-md border disabled:opacity-25"
                    style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === plan.length - 1}
                    onClick={() => moveOrganizePage(item.uid, 1)}
                    title="后移一页"
                    className="grid h-6 w-6 place-items-center rounded-md border disabled:opacity-25"
                    style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => rotateOrganizePage(item.uid, -90)}
                    title="左转 90°"
                    className="grid h-6 w-6 place-items-center rounded-md border"
                    style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateOrganizePage(item.uid, 90)}
                    title="右转 90°"
                    className="grid h-6 w-6 place-items-center rounded-md border"
                    style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={plan.length <= 1}
                    onClick={() => removeOrganizePage(item.uid)}
                    title="移除该页"
                    className="grid h-6 w-6 place-items-center rounded-md border disabled:opacity-25"
                    style={{ background: 'var(--danger-soft)', borderColor: 'transparent', color: 'var(--danger)' }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
