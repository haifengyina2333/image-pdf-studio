(() => {
  const ns = window.Toolbox ??= {};
  const abortError = () => new DOMException('任务已取消。', 'AbortError');
  const assertNotAborted = (signal) => { if (signal?.aborted) throw abortError(); };
  const canvasToBlob = (canvas, type, quality) =>
    new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('差异图编码失败。'))), type, quality));

  // Pixel-level visual diff between two rendered PDF page canvases.
  // mode: 'overlay' (red = only/changed in A, green = only/changed in B, dimmed gray = unchanged)
  //       'highlight' (original B tinted with vivid magenta boxes/pixels where changed)
  const comparePageCanvases = (canvasA, canvasB, { threshold = 24, mode = 'overlay', canvasFactory = () => document.createElement('canvas') } = {}) => {
    const wA = canvasA?.width || 0, hA = canvasA?.height || 0;
    const wB = canvasB?.width || 0, hB = canvasB?.height || 0;
    const width = Math.max(1, wA, wB);
    const height = Math.max(1, hA, hB);

    const readPadded = (src, sw, sh) => {
      const tmp = canvasFactory();
      tmp.width = width;
      tmp.height = height;
      const ctx = tmp.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      if (src && sw > 0 && sh > 0) ctx.drawImage(src, 0, 0);
      const data = ctx.getImageData(0, 0, width, height).data;
      try { tmp.width = 1; tmp.height = 1; } catch {}
      return data;
    };

    const dataA = readPadded(canvasA, wA, hA);
    const dataB = readPadded(canvasB, wB, hB);

    const outCanvas = canvasFactory();
    outCanvas.width = width;
    outCanvas.height = height;
    const outCtx = outCanvas.getContext('2d', { alpha: false });
    const outImg = outCtx.createImageData(width, height);
    const out = outImg.data;

    const tol = Math.max(4, Math.min(120, Math.round(Number(threshold) || 24)));
    const totalPixels = width * height;
    let diffPixels = 0;

    for (let i = 0; i < totalPixels; i += 1) {
      const p = i * 4;
      const rA = dataA[p], gA = dataA[p + 1], bA = dataA[p + 2];
      const rB = dataB[p], gB = dataB[p + 1], bB = dataB[p + 2];
      const dr = Math.abs(rA - rB);
      const dg = Math.abs(gA - gB);
      const db = Math.abs(bA - bB);
      const maxDelta = Math.max(dr, dg, db);

      if (maxDelta > tol) {
        diffPixels += 1;
        if (mode === 'highlight') {
          // Vivid rose/magenta tint blended with B so text stays legible
          out[p] = Math.min(255, Math.round(rB * 0.45 + 244 * 0.55));
          out[p + 1] = Math.round(gB * 0.25 + 63 * 0.25);
          out[p + 2] = Math.min(255, Math.round(bB * 0.35 + 94 * 0.55));
          out[p + 3] = 255;
        } else {
          // Overlay: compare luminance to separate deletions (darker in A -> red) vs additions (darker in B -> emerald)
          const lumA = 0.299 * rA + 0.587 * gA + 0.114 * bA;
          const lumB = 0.299 * rB + 0.587 * gB + 0.114 * bB;
          if (lumA + 12 < lumB) {
            // Content removed or faded in B -> Red
            out[p] = 239; out[p + 1] = 56; out[p + 2] = 68; out[p + 3] = 255;
          } else if (lumB + 12 < lumA) {
            // Content added or darkened in B -> Emerald Green
            out[p] = 16; out[p + 1] = 163; out[p + 2] = 104; out[p + 3] = 255;
          } else {
            // Color/tonal change -> Amber/Orange
            out[p] = 234; out[p + 1] = 88; out[p + 2] = 12; out[p + 3] = 255;
          }
        }
      } else {
        // Dimmed grayscale context so differences jump off the page
        const lum = Math.round(0.299 * rB + 0.587 * gB + 0.114 * bB);
        const soft = mode === 'highlight' ? lum : Math.round(255 - (255 - lum) * 0.28);
        out[p] = soft;
        out[p + 1] = soft;
        out[p + 2] = soft;
        out[p + 3] = 255;
      }
    }

    outCtx.putImageData(outImg, 0, 0);
    const diffRatio = diffPixels / Math.max(1, totalPixels);
    return {
      diffCanvas: outCanvas,
      width,
      height,
      diffPixels,
      totalPixels,
      diffRatio,
      hasDiff: diffPixels > Math.max(12, Math.round(totalPixels * 0.00008))
    };
  };

  const renderPlannedPage = async (session, plan, pageIndex, canvas, { maxWidth, maxHeight, signal }) => {
    const entry = plan ? plan[pageIndex - 1] : pageIndex <= session.numPages ? { sourcePage: pageIndex, rotation: 0 } : null;
    if (!entry) return null;
    return session.renderPage(entry.sourcePage, canvas, {
      maxWidth,
      maxHeight,
      outputScale: 1,
      background: '#ffffff',
      intent: 'print',
      signal,
      extraRotation: entry.rotation || 0,
      applyInlineStyle: false
    });
  };

  const scanDocumentDifferences = async (sessionA, sessionB, { planA = null, planB = null, maxEdge = 960, threshold = 24, signal, onProgress, canvasFactory = () => document.createElement('canvas') } = {}) => {
    if (!sessionA || !sessionB) throw new Error('请先选择两份需要对比的 PDF 文档。');
    const countA = planA ? planA.length : sessionA.numPages;
    const countB = planB ? planB.length : sessionB.numPages;
    const totalPages = Math.max(countA, countB);
    const canvasA = canvasFactory();
    const canvasB = canvasFactory();
    const results = [];

    try {
      for (let page = 1; page <= totalPages; page += 1) {
        assertNotAborted(signal);
        onProgress?.({ current: page, total: totalPages });
        const hasA = page <= countA;
        const hasB = page <= countB;
        if (!hasA || !hasB) {
          results.push({ page, hasDiff: true, diffRatio: 1, diffPixels: 1, status: hasB ? 'added' : 'removed' });
          continue;
        }
        await renderPlannedPage(sessionA, planA, page, canvasA, { maxWidth: maxEdge, maxHeight: maxEdge * 1.45, signal });
        await renderPlannedPage(sessionB, planB, page, canvasB, { maxWidth: maxEdge, maxHeight: maxEdge * 1.45, signal });
        const diff = comparePageCanvases(canvasA, canvasB, { threshold, mode: 'overlay', canvasFactory });
        try { diff.diffCanvas.width = 1; diff.diffCanvas.height = 1; } catch {}
        results.push({
          page,
          hasDiff: diff.hasDiff,
          diffRatio: diff.diffRatio,
          diffPixels: diff.diffPixels,
          status: diff.hasDiff ? 'changed' : 'same'
        });
      }
      return {
        pages: results,
        totalPages,
        diffPages: results.filter((r) => r.hasDiff).map((r) => r.page)
      };
    } finally {
      try { canvasA.width = 1; canvasA.height = 1; } catch {}
      try { canvasB.width = 1; canvasB.height = 1; } catch {}
    }
  };

  const exportDiffReportPDF = async (sessionA, sessionB, pageNumbers, { planA = null, planB = null, mode = 'overlay', threshold = 24, maxEdge = 1350, signal, onProgress, pdfLib, canvasFactory = () => document.createElement('canvas') } = {}) => {
    if (!sessionA || !sessionB) throw new Error('请先选择两份 PDF 文档。');
    const lib = pdfLib || window.ToolboxPDFLib;
    if (!lib?.PDFDocument) throw new Error('PDF 处理组件尚未初始化，请刷新页面后重试。');
    const countA = planA ? planA.length : sessionA.numPages;
    const countB = planB ? planB.length : sessionB.numPages;
    const total = Math.max(countA, countB);
    const targetPages = Array.isArray(pageNumbers) && pageNumbers.length ? pageNumbers : Array.from({ length: total }, (_, i) => i + 1);
    const output = await lib.PDFDocument.create();
    const canvasA = canvasFactory();
    const canvasB = canvasFactory();

    try {
      for (let i = 0; i < targetPages.length; i += 1) {
        const pageNum = targetPages[i];
        assertNotAborted(signal);
        onProgress?.({ stage: 'compare', current: i + 1, total: targetPages.length, pageNumber: pageNum });
        const hasA = pageNum <= countA;
        const hasB = pageNum <= countB;
        if (hasA) await renderPlannedPage(sessionA, planA, pageNum, canvasA, { maxWidth: maxEdge, maxHeight: maxEdge * 1.45, signal });
        if (hasB) await renderPlannedPage(sessionB, planB, pageNum, canvasB, { maxWidth: maxEdge, maxHeight: maxEdge * 1.45, signal });

        const diff = comparePageCanvases(hasA ? canvasA : null, hasB ? canvasB : null, { threshold, mode, canvasFactory });
        try {
          const jpeg = await canvasToBlob(diff.diffCanvas, 'image/jpeg', 0.88);
          assertNotAborted(signal);
          const embedded = await output.embedJpg(await jpeg.arrayBuffer());
          const page = output.addPage();
          const ptW = (diff.width * 72) / 144;
          const ptH = (diff.height * 72) / 144;
          page.setSize(ptW, ptH);
          page.drawImage(embedded, { x: 0, y: 0, width: ptW, height: ptH });
        } finally {
          try { diff.diffCanvas.width = 1; diff.diffCanvas.height = 1; } catch {}
        }
      }
      onProgress?.({ stage: 'save', current: targetPages.length, total: targetPages.length });
      const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 40 });
      assertNotAborted(signal);
      return { blob: new Blob([bytes], { type: 'application/pdf' }), pageCount: targetPages.length, outputBytes: bytes.length };
    } finally {
      try { canvasA.width = 1; canvasA.height = 1; } catch {}
      try { canvasB.width = 1; canvasB.height = 1; } catch {}
    }
  };

  ns.PDFCompare = { comparePageCanvases, scanDocumentDifferences, exportDiffReportPDF };
})();
