import { useEffect, useRef } from 'react';
import { getEngine } from '../bridge/engine';
import { idCardSheetOptions, PdfIdCardConfig, PdfImageQueueItem } from '../stores/usePdfStore';

interface PdfIdCardSheetProps {
  images: PdfImageQueueItem[];
  config: PdfIdCardConfig;
}

// A4 at 150 DPI: sharp enough to judge the watermark, light enough to redraw on every slider tick.
const PAGE_MM = getEngine().IdCardSheet.PAGE_MM;
const PREVIEW_WIDTH = 1240;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * PAGE_MM.height) / PAGE_MM.width);
const PIXELS_PER_MM = PREVIEW_WIDTH / PAGE_MM.width;

/**
 * Live A4 sheet preview. It is drawn by the same engine routine that renders the exported PDF page,
 * so what is shown here is what gets printed.
 */
export function PdfIdCardSheet({ images, config }: PdfIdCardSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const raf = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const sheet = getEngine().IdCardSheet;
      const layout = sheet.layoutFor(
        images.map((i) => i.decoded.dimensions),
        idCardSheetOptions(config)
      );
      sheet.drawSheet(
        ctx,
        PIXELS_PER_MM,
        images.map((i) => i.decoded.preview.image),
        layout
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [images, config]);

  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      className="block h-auto max-h-[calc(100dvh-236px)] w-auto max-w-full rounded bg-white object-contain"
      style={{ boxShadow: '0 12px 36px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.08)' }}
    />
  );
}
