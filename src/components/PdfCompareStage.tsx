import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FilePlus2, GitCompare } from 'lucide-react';
import { getEngine, PdfSessionLike, triggerBlobDownload } from '../bridge/engine';
import { PdfOrganizePageItem, usePdfStore } from '../stores/usePdfStore';

interface PdfCompareStageProps {
  sessionA: PdfSessionLike | null;
  sessionB: PdfSessionLike | null;
  planA: PdfOrganizePageItem[];
  planB: PdfOrganizePageItem[];
  onImportPdf: () => void;
}

export function PdfCompareStage({ sessionA, sessionB, planA, planB, onImportPdf }: PdfCompareStageProps) {
  const currentPage = usePdfStore((s) => s.currentPage);
  const compare = usePdfStore((s) => s.compare);
  const compareResults = usePdfStore((s) => s.compareResults);
  const setPage = usePdfStore((s) => s.setPage);

  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pageDiffStats, setPageDiffStats] = useState<{ ratio: number; hasDiff: boolean; missing?: 'A' | 'B' } | null>(null);
  const [rendering, setRendering] = useState(false);

  const countA = planA.length;
  const countB = planB.length;
  const totalPages = Math.max(countA, countB, 1);
  const clampedPage = Math.max(1, Math.min(totalPages, currentPage));

  useEffect(() => {
    if (!sessionA || !sessionB) return;
    const controller = new AbortController();
    let cancelled = false;
    setRendering(true);

    const run = async () => {
      try {
        const entryA = planA[clampedPage - 1];
        const entryB = planB[clampedPage - 1];
        const tmpA = document.createElement('canvas');
        const tmpB = document.createElement('canvas');
        const maxW = compare.viewMode === 'side-by-side' ? 860 : 1080;
        const maxH = compare.viewMode === 'side-by-side' ? 1150 : 1440;

        if (entryA) {
          await sessionA.renderPage(entryA.sourcePage, tmpA, {
            maxWidth: maxW,
            maxHeight: maxH,
            outputScale: 1,
            background: '#ffffff',
            signal: controller.signal,
            extraRotation: entryA.rotation,
            applyInlineStyle: false
          });
        }
        if (entryB) {
          await sessionB.renderPage(entryB.sourcePage, tmpB, {
            maxWidth: maxW,
            maxHeight: maxH,
            outputScale: 1,
            background: '#ffffff',
            signal: controller.signal,
            extraRotation: entryB.rotation,
            applyInlineStyle: false
          });
        }
        if (cancelled) return;

        if (compare.viewMode === 'side-by-side') {
          if (canvasARef.current) {
            canvasARef.current.width = entryA ? tmpA.width : 400;
            canvasARef.current.height = entryA ? tmpA.height : 560;
            const ctxA = canvasARef.current.getContext('2d')!;
            ctxA.fillStyle = '#f8fafc';
            ctxA.fillRect(0, 0, canvasARef.current.width, canvasARef.current.height);
            if (entryA) ctxA.drawImage(tmpA, 0, 0);
          }
          if (canvasBRef.current) {
            canvasBRef.current.width = entryB ? tmpB.width : 400;
            canvasBRef.current.height = entryB ? tmpB.height : 560;
            const ctxB = canvasBRef.current.getContext('2d')!;
            ctxB.fillStyle = '#f8fafc';
            ctxB.fillRect(0, 0, canvasBRef.current.width, canvasBRef.current.height);
            if (entryB) ctxB.drawImage(tmpB, 0, 0);
          }
          const diff = getEngine().PDFCompare.comparePageCanvases(entryA ? tmpA : null, entryB ? tmpB : null, {
            threshold: compare.threshold,
            mode: 'overlay'
          });
          setPageDiffStats({
            ratio: diff.diffRatio,
            hasDiff: diff.hasDiff,
            missing: !entryA ? 'A' : !entryB ? 'B' : undefined
          });
          diff.diffCanvas.width = 1;
          diff.diffCanvas.height = 1;
        } else {
          const diff = getEngine().PDFCompare.comparePageCanvases(entryA ? tmpA : null, entryB ? tmpB : null, {
            threshold: compare.threshold,
            mode: compare.viewMode === 'highlight' ? 'highlight' : 'overlay'
          });
          if (diffCanvasRef.current) {
            diffCanvasRef.current.width = diff.width;
            diffCanvasRef.current.height = diff.height;
            diffCanvasRef.current.getContext('2d')!.drawImage(diff.diffCanvas, 0, 0);
          }
          setPageDiffStats({
            ratio: diff.diffRatio,
            hasDiff: diff.hasDiff,
            missing: !entryA ? 'A' : !entryB ? 'B' : undefined
          });
          diff.diffCanvas.width = 1;
          diff.diffCanvas.height = 1;
        }
        tmpA.width = 1;
        tmpA.height = 1;
        tmpB.width = 1;
        tmpB.height = 1;
      } catch {
        // Ignore aborted renders
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionA, sessionB, planA, planB, clampedPage, compare.viewMode, compare.threshold]);

  const exportCurrentDiffPng = () => {
    const canvas = diffCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerBlobDownload(blob, `PDF差异对比-第${clampedPage}页.png`);
    }, 'image/png');
  };

  if (!sessionA || !sessionB) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div
          className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
        >
          <GitCompare className="h-7 w-7" />
        </div>
        <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink)' }}>
          {sessionA ? '再导入一份对比 PDF 即可找不同' : '导入两份 PDF 开始本地视觉找不同'}
        </h2>
        <p className="mt-1.5 max-w-sm text-[13px]" style={{ color: 'var(--muted)' }}>
          纯本地逐页比对 V1 / V2 合同、报价单或标书，红绿双色精准标出增删改差异，机密文档绝不上传云端。
        </p>
        <button
          type="button"
          onClick={onImportPdf}
          className="gemini-btn mt-5 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold"
        >
          <FilePlus2 className="h-4 w-4" />
          <span>{sessionA ? '添加对比版 PDF（文档 B）' : '选择 PDF 文件'}</span>
        </button>
      </div>
    );
  }

  const diffPageNums = compareResults.filter((r) => r.hasDiff).map((r) => r.page);
  const nextDiffPage = diffPageNums.find((p) => p > clampedPage) ?? diffPageNums[0];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Legend header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-[12.5px]"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--line)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>
            A：{sessionA.file.name}
          </span>
          <span style={{ color: 'var(--muted)' }}>vs</span>
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>
            B：{sessionB.file.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {compare.viewMode === 'overlay' && (
            <span className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--muted)' }}>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                旧版删减
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                新版新增
              </span>
            </span>
          )}
          {pageDiffStats && (
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[12px] font-bold"
              style={{
                background: pageDiffStats.hasDiff ? 'var(--danger-soft)' : 'rgba(16, 185, 129, 0.14)',
                color: pageDiffStats.hasDiff ? 'var(--danger)' : 'var(--success)'
              }}
            >
              {pageDiffStats.missing
                ? `文档 ${pageDiffStats.missing} 无此页`
                : pageDiffStats.hasDiff
                  ? `差异 ${(pageDiffStats.ratio * 100).toFixed(2)}%`
                  : '本页一致'}
            </span>
          )}
        </div>
      </div>

      {/* Main visual diff viewport */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 pb-16">
        {compare.viewMode === 'side-by-side' ? (
          <div className="grid max-h-full w-full grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>
                文档 A · 第 {clampedPage} 页
              </span>
              <canvas
                ref={canvasARef}
                className="h-auto max-h-[calc(100dvh-260px)] w-auto max-w-full rounded bg-white object-contain"
                style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)' }}
              />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[12px] font-bold" style={{ color: 'var(--accent)' }}>
                文档 B · 第 {clampedPage} 页
              </span>
              <canvas
                ref={canvasBRef}
                className="h-auto max-h-[calc(100dvh-260px)] w-auto max-w-full rounded bg-white object-contain"
                style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)' }}
              />
            </div>
          </div>
        ) : (
          <canvas
            ref={diffCanvasRef}
            className="h-auto max-h-[calc(100dvh-250px)] w-auto max-w-full rounded bg-white object-contain"
            style={{
              opacity: rendering ? 0.65 : 1,
              boxShadow: '0 12px 36px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.08)'
            }}
          />
        )}
      </div>

      {/* Bottom Floating Navigation Island */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md"
          style={{
            background: 'color-mix(in srgb, var(--bg-surface) 90%, transparent)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow-float)'
          }}
        >
          <button
            type="button"
            disabled={clampedPage <= 1}
            onClick={() => setPage(clampedPage - 1)}
            className="grid h-6 w-6 place-items-center rounded-full disabled:opacity-30"
            style={{ color: 'var(--ink-2)' }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
            {clampedPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={clampedPage >= totalPages}
            onClick={() => setPage(clampedPage + 1)}
            className="grid h-6 w-6 place-items-center rounded-full disabled:opacity-30"
            style={{ color: 'var(--ink-2)' }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {nextDiffPage && (
            <>
              <span className="h-3.5 w-px" style={{ background: 'var(--line)' }} />
              <button
                type="button"
                onClick={() => setPage(nextDiffPage)}
                className="rounded-full border px-2.5 py-0.5 text-[12px] font-semibold"
                style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
              >
                跳到差异页 P.{nextDiffPage}
              </button>
            </>
          )}

          {compare.viewMode !== 'side-by-side' && (
            <>
              <span className="h-3.5 w-px" style={{ background: 'var(--line)' }} />
              <button
                type="button"
                onClick={exportCurrentDiffPng}
                className="inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-[12px] font-semibold"
                style={{ background: 'var(--bg-subtle)', borderColor: 'var(--line-strong)', color: 'var(--ink-2)' }}
              >
                <Download className="h-3 w-3" />
                <span>存当前差异图</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
