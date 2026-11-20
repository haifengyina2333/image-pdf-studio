(() => {
  const ns = window.Toolbox ??= {};
  const PAGE_MM = Object.freeze({ width: 210, height: 297 });
  // ISO/IEC 7810 ID-1: the physical size shared by ID cards, bank cards and driving licences.
  const CARD_MM = Object.freeze({ width: 85.6, height: 54 });
  const SAFE_MARGIN_MM = 12;
  const MAX_SIDES = 2;
  const PT_PER_MM = 72 / 25.4;
  const saveOptions = { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 40 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const dimensionsFor = (image) => image.dimensions ?? image;
  const ensurePdfLib = async (pdfLib = window.ToolboxPDFLib) => {
    if (!pdfLib && ns.EmbeddedAssets?.has('pdflib')) {
      await ns.EmbeddedAssets.loadScript('pdflib', () => Boolean(window.ToolboxPDFLib));
      pdfLib = window.ToolboxPDFLib;
    }
    if (!pdfLib?.PDFDocument) throw new Error('PDF 处理组件尚未初始化，请刷新页面后重试。');
    return pdfLib;
  };
  const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('证件页面编码失败。')), type, quality));

  const normalizeOptions = (options = {}) => {
    const watermark = options.watermark ?? {}, text = String(watermark.text ?? '').slice(0, 300);
    return {
      sizeMode: ['card', 'custom', 'fit'].includes(options.sizeMode) ? options.sizeMode : 'card',
      customWidthMm: clamp(finite(options.customWidthMm, 120), 30, PAGE_MM.width - SAFE_MARGIN_MM * 2),
      gapMm: clamp(finite(options.gapMm, 20), 0, 80),
      watermark: {
        enabled: Boolean(watermark.enabled) && Boolean(text.trim()), text,
        color: /^#[0-9a-f]{6}$/i.test(watermark.color) ? watermark.color : '#315f72',
        scope: watermark.scope === 'page' ? 'page' : 'cards',
        opacity: clamp(finite(watermark.opacity, .3), .03, 1),
        rotation: clamp(finite(watermark.rotation, -25), -90, 90),
        fontPt: clamp(finite(watermark.fontPt, 11), 6, 36)
      }
    };
  };

  // All geometry is in millimetres on a portrait A4 page, so the preview and the exported PDF share one layout.
  const layoutFor = (images, rawOptions) => {
    const options = normalizeOptions(rawOptions);
    const sizes = [...(images || [])].slice(0, MAX_SIDES).map(dimensionsFor).filter((size) => size?.width > 0 && size?.height > 0);
    const availableWidth = PAGE_MM.width - SAFE_MARGIN_MM * 2, availableHeight = PAGE_MM.height - SAFE_MARGIN_MM * 2;
    const gaps = options.gapMm * Math.max(0, sizes.length - 1);
    const contain = (size, boxWidth, boxHeight) => { const scale = Math.min(boxWidth / size.width, boxHeight / size.height); return { width: size.width * scale, height: size.height * scale }; };
    let boxes = sizes.map((size) => options.sizeMode === 'card' ? contain(size, CARD_MM.width, CARD_MM.height)
      : options.sizeMode === 'custom' ? { width: options.customWidthMm, height: options.customWidthMm * size.height / size.width }
        : contain(size, availableWidth, (availableHeight - gaps) / sizes.length));
    // Tall photos at a custom width can overflow the printable area; shrink the whole stack instead of clipping it.
    const stackHeight = boxes.reduce((sum, box) => sum + box.height, 0), shrink = stackHeight > 0 ? Math.min(1, (availableHeight - gaps) / stackHeight) : 1;
    if (shrink < 1) boxes = boxes.map((box) => ({ width: box.width * shrink, height: box.height * shrink }));
    let y = (PAGE_MM.height - stackHeight * shrink - gaps) / 2;
    const cards = boxes.map((box) => { const card = { x: (PAGE_MM.width - box.width) / 2, y, width: box.width, height: box.height }; y += box.height + options.gapMm; return card; });
    return { page: PAGE_MM, cards, options, shrunk: shrink < 1 };
  };

  const drawWatermark = (ctx, region, watermark, pixelsPerMm) => {
    const lines = watermark.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); if (!lines.length) return;
    const font = watermark.fontPt / PT_PER_MM * pixelsPerMm, lineHeight = font * 1.35;
    ctx.save(); ctx.beginPath(); ctx.rect(region.x, region.y, region.width, region.height); ctx.clip();
    ctx.globalAlpha = watermark.opacity; ctx.fillStyle = watermark.color; ctx.font = `600 ${font}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const blockWidth = Math.max(...lines.map((line) => ctx.measureText(line).width)), blockHeight = lines.length * lineHeight;
    const stepX = blockWidth + font * 2.4, stepY = blockHeight + font * 2.6, reach = Math.hypot(region.width, region.height) / 2;
    const columns = Math.ceil(reach / stepX) + 1, rows = Math.ceil(reach / stepY) + 1;
    ctx.translate(region.x + region.width / 2, region.y + region.height / 2); ctx.rotate(watermark.rotation * Math.PI / 180);
    for (let row = -rows; row <= rows; row += 1) for (let column = -columns; column <= columns; column += 1) {
      const x = column * stepX + (row % 2 ? stepX / 2 : 0), top = row * stepY - blockHeight / 2;
      lines.forEach((line, index) => ctx.fillText(line, x, top + lineHeight * (index + .5)));
    }
    ctx.restore();
  };

  const drawSheet = (ctx, pixelsPerMm, sources, layout) => {
    const { page, cards, options } = layout, px = (value) => value * pixelsPerMm;
    const regions = cards.map((card) => ({ x: px(card.x), y: px(card.y), width: px(card.width), height: px(card.height) }));
    ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, px(page.width), px(page.height)); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    regions.forEach((region, index) => { if (sources[index]) ctx.drawImage(sources[index], region.x, region.y, region.width, region.height); });
    ctx.restore();
    if (!options.watermark.enabled) return;
    const targets = options.watermark.scope === 'page' ? [{ x: 0, y: 0, width: px(page.width), height: px(page.height) }] : regions;
    targets.forEach((region) => drawWatermark(ctx, region, options.watermark, pixelsPerMm));
  };

  // The page is flattened to one image on purpose: a watermark burned into the pixels cannot be peeled off the PDF.
  const createPDF = async (files, rawOptions = {}, { signal, onProgress, pdfLib, dpi = 300, quality = .92, canvasFactory = () => document.createElement('canvas') } = {}) => {
    const sources = [...(files || [])].filter(Boolean).slice(0, MAX_SIDES); if (!sources.length) throw new Error('请先添加证件照片。');
    const { assertNotAborted, normalizeFile } = ns.ImageDecoder; const lib = await ensurePdfLib(pdfLib), canvas = canvasFactory(), bitmaps = [];
    try {
      for (let index = 0; index < sources.length; index += 1) {
        assertNotAborted(signal); onProgress?.({ stage: 'decode', current: index + 1, total: sources.length, fileName: sources[index].name || `证件 ${index + 1}` });
        bitmaps.push(await createImageBitmap(await normalizeFile(sources[index], signal)));
      }
      assertNotAborted(signal); onProgress?.({ stage: 'render', current: sources.length, total: sources.length });
      const layout = layoutFor(bitmaps, rawOptions), pixelsPerMm = clamp(finite(dpi, 300), 72, 600) / 25.4;
      canvas.width = Math.round(layout.page.width * pixelsPerMm); canvas.height = Math.round(layout.page.height * pixelsPerMm);
      drawSheet(canvas.getContext('2d', { alpha: false }), pixelsPerMm, bitmaps, layout);
      const jpeg = await canvasToBlob(canvas, 'image/jpeg', clamp(finite(quality, .92), .45, .98)); assertNotAborted(signal);
      onProgress?.({ stage: 'save', current: sources.length, total: sources.length });
      const output = await lib.PDFDocument.create(), embedded = await output.embedJpg(await jpeg.arrayBuffer()), width = layout.page.width * PT_PER_MM, height = layout.page.height * PT_PER_MM;
      const page = output.addPage(); page.setSize(width, height); page.drawImage(embedded, { x: 0, y: 0, width, height });
      const bytes = await output.save(saveOptions); assertNotAborted(signal);
      return { blob: new Blob([bytes], { type: 'application/pdf' }), pageCount: 1, sideCount: sources.length, cards: layout.cards, inputBytes: sources.reduce((sum, file) => sum + (file.size || 0), 0), outputBytes: bytes.length };
    } finally { bitmaps.forEach((bitmap) => { try { bitmap.close?.(); } catch {} }); try { canvas.width = 1; canvas.height = 1; } catch {} }
  };

  ns.IdCardSheet = { PAGE_MM, CARD_MM, MAX_SIDES, normalizeOptions, layoutFor, drawSheet, createPDF };
})();
