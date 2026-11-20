(() => {
  const ns = window.Toolbox ??= {};
  const COMPRESSION_PROFILES = Object.freeze({
    light: Object.freeze({ key: 'light', label: '轻度 · 清晰优先', dpi: 180, quality: .86, maxPixels: 16_000_000, description: '适合文字、合同和需要放大查看的资料；体积下降相对温和。' }),
    standard: Object.freeze({ key: 'standard', label: '标准 · 日常发送', dpi: 144, quality: .76, maxPixels: 12_000_000, description: '清晰度与体积平衡，适合微信、邮件和普通归档。' }),
    strong: Object.freeze({ key: 'strong', label: '强力 · 体积优先', dpi: 110, quality: .62, maxPixels: 8_000_000, description: '适合扫描件快速传输；细小文字和图片细节会更明显下降。' })
  });
  const PAGE_SIZES = Object.freeze({
    a4: Object.freeze([595.28, 841.89]),
    a3: Object.freeze([841.89, 1190.55])
  });
  const abortError = () => new DOMException('任务已取消。', 'AbortError');
  const assertNotAborted = (signal) => { if (signal?.aborted) throw abortError(); };
  const ensurePdfLib = async (pdfLib = window.ToolboxPDFLib) => {
    if (!pdfLib && ns.EmbeddedAssets?.has('pdflib')) {
      await ns.EmbeddedAssets.loadScript('pdflib', () => Boolean(window.ToolboxPDFLib));
      pdfLib = window.ToolboxPDFLib;
    }
    if (!pdfLib?.PDFDocument) throw new Error('PDF 处理组件尚未初始化，请刷新页面后重试。');
    return pdfLib;
  };
  const profileFor = (value) => COMPRESSION_PROFILES[value] ?? COMPRESSION_PROFILES.standard;
  const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('页面图像编码失败。')), type, quality));
  const outputBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });
  const normalizeRotation = (value) => ((Math.round(Number(value) / 90) * 90) % 360 + 360) % 360;
  const degreeValue = (pdfLib, angle) => pdfLib.degrees ? pdfLib.degrees(angle) : { type: 'degrees', angle };
  const saveOptions = { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 40 };
  const originalPlan = (count) => Array.from({ length: count }, (_, index) => ({ sourcePage: index + 1, rotation: 0 }));
  const displayBox = (page) => {
    const media = page.getMediaBox(), crop = page.getCropBox();
    const x = Math.max(media.x, crop.x), y = Math.max(media.y, crop.y);
    const right = Math.min(media.x + media.width, crop.x + crop.width), top = Math.min(media.y + media.height, crop.y + crop.height);
    const box = right > x && top > y ? { x, y, width: right - x, height: top - y } : media;
    const rotation = normalizeRotation(page.getRotation().angle), { width, height } = box;
    const toPage = (dx, dy) => rotation === 90 ? [box.x + width - dy, box.y + dx] : rotation === 180 ? [box.x + width - dx, box.y + height - dy] : rotation === 270 ? [box.x + dy, box.y + height - dx] : [box.x + dx, box.y + dy];
    return { width: rotation % 180 ? height : width, height: rotation % 180 ? width : height, rotation, toPage };
  };
  const stampPlacement = (box, cx, cy, width, height, angle) => {
    const [x, y] = box.toPage(cx, cy);
    const rotation = angle + box.rotation, radians = rotation * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    return { x: x - (width * cos - height * sin) / 2, y: y - (width * sin + height * cos) / 2, rotation };
  };

  const normalizePagePlan = (plan, totalPages) => {
    const fallback = Array.from({ length: totalPages }, (_, index) => ({ sourcePage: index + 1, rotation: 0 }));
    const source = Array.isArray(plan) && plan.length ? plan : fallback;
    return source.map((item, index) => {
      const sourcePage = Math.floor(Number(item?.sourcePage ?? item));
      if (!Number.isFinite(sourcePage) || sourcePage < 1 || sourcePage > totalPages) throw new Error(`第 ${index + 1} 个页面引用无效。`);
      return { sourcePage, rotation: normalizeRotation(item?.rotation || 0) };
    });
  };

  const applyExtraRotation = (page, rotation, pdfLib) => {
    const extra = normalizeRotation(rotation);
    if (!extra) return;
    const original = Number(page.getRotation?.()?.angle || 0);
    page.setRotation(degreeValue(pdfLib, normalizeRotation(original + extra)));
  };

  const copyPlanToDocument = async (target, source, plan, pdfLib) => {
    const indices = source.getPageIndices(); indices.length = 0; plan.forEach((item) => indices.push(item.sourcePage - 1));
    const pages = await target.copyPages(source, indices);
    pages.forEach((page, index) => { applyExtraRotation(page, plan[index].rotation, pdfLib); target.addPage(page); });
    return pages.length;
  };

  const loadSourcePDF = async (file, pdfLib, action = '处理') => {
    try { return await pdfLib.PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); }
    catch (error) { throw new Error(`“${file.name || '该 PDF'}”无法${action}：${/encrypt/i.test(String(error?.message || '')) ? '文件已加密或受保护。' : 'PDF 结构无法读取。'}`); }
  };

  const savePagePlan = async (file, pagePlan, { signal, onProgress, pdfLib } = {}) => {
    if (!file) throw new Error('请先选择一个 PDF。');
    const lib = await ensurePdfLib(pdfLib); assertNotAborted(signal); onProgress?.({ stage: 'read', current: 0, total: 1 });
    const source = await loadSourcePDF(file, lib, '导出'); const plan = normalizePagePlan(pagePlan, source.getPageCount());
    if (!plan.length) throw new Error('至少需要保留一页。');
    assertNotAborted(signal); const output = await lib.PDFDocument.create(); await copyPlanToDocument(output, source, plan, lib);
    onProgress?.({ stage: 'save', current: plan.length, total: plan.length }); const bytes = await output.save(saveOptions); assertNotAborted(signal);
    return { blob: outputBlob(bytes), pageCount: plan.length, inputBytes: file.size || 0, outputBytes: bytes.length };
  };

  const createPDFParts = async (file, pagePlanGroups, { signal, onProgress, pdfLib } = {}) => {
    if (!file) throw new Error('请先选择一个 PDF。');
    const lib = await ensurePdfLib(pdfLib); assertNotAborted(signal); const source = await loadSourcePDF(file, lib, '拆分');
    const groups = (pagePlanGroups || []).map((group) => normalizePagePlan(group, source.getPageCount())).filter((group) => group.length);
    if (!groups.length) throw new Error('没有可拆分的页面。');
    const parts = [];
    for (let index = 0; index < groups.length; index += 1) {
      assertNotAborted(signal); onProgress?.({ stage: 'copy', current: index + 1, total: groups.length, pageCount: groups[index].length });
      const output = await lib.PDFDocument.create(); await copyPlanToDocument(output, source, groups[index], lib); const bytes = await output.save(saveOptions);
      parts.push({ blob: outputBlob(bytes), pageCount: groups[index].length, outputBytes: bytes.length });
    }
    assertNotAborted(signal); return { parts, inputBytes: file.size || 0, pageCount: groups.reduce((sum, group) => sum + group.length, 0) };
  };

  const mergePDFs = async (inputs, { signal, onProgress, pdfLib } = {}) => {
    const sources = [...(inputs || [])].filter(Boolean).map((input) => input?.file ? input : { file: input, pagePlan: null });
    if (sources.length < 2) throw new Error('至少需要两个 PDF 才能合并。');
    const lib = await ensurePdfLib(pdfLib); assertNotAborted(signal); const merged = await lib.PDFDocument.create(); let totalPages = 0;
    for (let index = 0; index < sources.length; index += 1) {
      assertNotAborted(signal); const { file, pagePlan } = sources[index]; onProgress?.({ stage: 'read', current: index + 1, total: sources.length, fileName: file.name || `PDF ${index + 1}` });
      const source = await loadSourcePDF(file, lib, '合并'); const plan = normalizePagePlan(pagePlan, source.getPageCount());
      assertNotAborted(signal); totalPages += await copyPlanToDocument(merged, source, plan, lib); onProgress?.({ stage: 'copy', current: index + 1, total: sources.length, fileName: file.name || `PDF ${index + 1}`, totalPages });
    }
    assertNotAborted(signal); if (!totalPages) throw new Error('这些 PDF 中没有可合并的页面。'); onProgress?.({ stage: 'save', current: sources.length, total: sources.length, totalPages });
    const bytes = await merged.save(saveOptions); assertNotAborted(signal);
    return { blob: outputBlob(bytes), fileCount: sources.length, pageCount: totalPages, inputBytes: sources.reduce((sum, item) => sum + (item.file.size || 0), 0), outputBytes: bytes.length };
  };

  const optimizePDF = async (file, { signal, onProgress, pdfLib, keepOriginalIfLarger = true } = {}) => {
    if (!file) throw new Error('请先选择一个 PDF。');
    const lib = await ensurePdfLib(pdfLib); assertNotAborted(signal); onProgress?.({ stage: 'read', current: 0, total: 1 });
    const source = await loadSourcePDF(file, lib, '无损整理'); assertNotAborted(signal); onProgress?.({ stage: 'save', current: 1, total: 1 });
    const bytes = await source.save(saveOptions); assertNotAborted(signal); const inputBytes = file.size || 0;
    if (keepOriginalIfLarger && inputBytes && bytes.length >= inputBytes) {
      const original = new Uint8Array(await file.arrayBuffer()); assertNotAborted(signal);
      return { blob: outputBlob(original), pageCount: source.getPageCount(), inputBytes, outputBytes: original.length, generatedBytes: bytes.length, usedOriginal: true, rasterized: false, mode: 'lossless' };
    }
    return { blob: outputBlob(bytes), pageCount: source.getPageCount(), inputBytes, outputBytes: bytes.length, generatedBytes: bytes.length, usedOriginal: false, rasterized: false, mode: 'lossless' };
  };

  const watermarkPDF = async (file, pagePlan, stampBytes, options = {}, { signal, onProgress, pdfLib } = {}) => {
    if (!file) throw new Error('请先选择一个 PDF。');
    if (!stampBytes) throw new Error('请先设置水印文字或 Logo。');
    const lib = await ensurePdfLib(pdfLib); assertNotAborted(signal); const source = await loadSourcePDF(file, lib, '添加水印'); const plan = normalizePagePlan(pagePlan, source.getPageCount());
    if (!plan.length) throw new Error('至少需要保留一页。');
    const output = await lib.PDFDocument.create(); await copyPlanToDocument(output, source, plan, lib); assertNotAborted(signal);
    const stamp = await output.embedPng(stampBytes instanceof Blob ? await stampBytes.arrayBuffer() : stampBytes); const pages = output.getPages();
    const targetPages = new Set((options.pages || originalPlan(pages.length).map((item) => item.sourcePage)).map(Number));
    const opacity = Math.max(.03, Math.min(1, Number(options.opacity) || .2)); const rawAngle = Number(options.rotation), angle = Number.isFinite(rawAngle) ? Math.max(-180, Math.min(180, rawAngle)) : -25; const widthRatio = Math.max(.05, Math.min(.9, Number(options.widthRatio) || .28)); const tiled = Boolean(options.tiled); const density = Math.max(1, Math.min(8, Math.round(Number(options.density) || 3))); const offsetXRatio = Math.max(-.5, Math.min(.5, Number(options.offsetXRatio) || 0)); const offsetYRatio = Math.max(-.5, Math.min(.5, Number(options.offsetYRatio) || 0)); const position = String(options.position || 'center');
    const anchor = { 'top-left': [.08, .82], top: [.5, .82], 'top-right': [.92, .82], left: [.08, .5], center: [.5, .5], right: [.92, .5], 'bottom-left': [.08, .18], bottom: [.5, .18], 'bottom-right': [.92, .18] }[position] || [.5, .5];
    for (let index = 0; index < pages.length; index += 1) {
      assertNotAborted(signal); if (!targetPages.has(index + 1)) continue; onProgress?.({ stage: 'watermark', current: index + 1, total: pages.length }); const page = pages[index], box = displayBox(page), { width, height } = box; const drawWidth = width * widthRatio, drawHeight = drawWidth * stamp.height / Math.max(1, stamp.width);
      const drawAt = (cx, cy) => { const { x, y, rotation } = stampPlacement(box, cx, cy, drawWidth, drawHeight, angle); page.drawImage(stamp, { x, y, width: drawWidth, height: drawHeight, opacity, rotate: degreeValue(lib, rotation) }); };
      if (tiled) {
        const columns = density, rows = Math.max(2, Math.round(density * height / Math.max(1, width))), cellWidth = width / columns, cellHeight = height / rows, shiftX = offsetXRatio * cellWidth, shiftY = offsetYRatio * cellHeight; for (let row = -1; row <= rows; row += 1) for (let column = -1; column <= columns; column += 1) drawAt((column + .5 + (row % 2 ? .25 : 0)) * cellWidth + shiftX, (row + .5) * cellHeight + shiftY);
      } else drawAt(anchor[0] * width, anchor[1] * height);
    }
    onProgress?.({ stage: 'save', current: pages.length, total: pages.length }); const bytes = await output.save(saveOptions); assertNotAborted(signal);
    return { blob: outputBlob(bytes), pageCount: pages.length, watermarkedPages: targetPages.size, inputBytes: file.size || 0, outputBytes: bytes.length, rasterized: false };
  };

  const compressPDF = async (session, profileValue, { signal, onProgress, pdfLib, canvasFactory = () => document.createElement('canvas'), keepOriginalIfLarger = true, pagePlan } = {}) => {
    if (!session?.file || !session?.numPages || typeof session.renderPage !== 'function') throw new Error('请先选择一个可读取的 PDF。');
    const profile = profileFor(profileValue), lib = await ensurePdfLib(pdfLib), plan = normalizePagePlan(pagePlan, session.numPages); assertNotAborted(signal); const output = await lib.PDFDocument.create(); const canvas = canvasFactory();
    try {
      for (let index = 0; index < plan.length; index += 1) {
        const item = plan[index], current = index + 1; assertNotAborted(signal); onProgress?.({ stage: 'render', current, total: plan.length, profile });
        const info = await session.getPageInfo(item.sourcePage, signal, item.rotation); const requestedScale = profile.dpi / 72; const scale = Math.min(requestedScale, 16000 / Math.max(info.width, info.height), Math.sqrt(profile.maxPixels / Math.max(1, info.width * info.height)));
        const rendered = await session.renderPage(item.sourcePage, canvas, { maxWidth: info.width * scale, maxHeight: info.height * scale, outputScale: 1, background: '#ffffff', intent: 'print', signal, extraRotation: item.rotation }); assertNotAborted(signal); onProgress?.({ stage: 'encode', current, total: plan.length, profile });
        const jpeg = await canvasToBlob(canvas, 'image/jpeg', profile.quality); assertNotAborted(signal); const image = await output.embedJpg(await jpeg.arrayBuffer()); const page = output.addPage(); page.setSize(rendered.width, rendered.height); page.drawImage(image, { x: 0, y: 0, width: rendered.width, height: rendered.height });
      }
      assertNotAborted(signal); onProgress?.({ stage: 'save', current: plan.length, total: plan.length, profile }); const bytes = await output.save(saveOptions); assertNotAborted(signal); const inputBytes = session.file.size || 0;
      if (keepOriginalIfLarger && inputBytes && bytes.length >= inputBytes && plan.length === session.numPages && plan.every((item, index) => item.sourcePage === index + 1 && !item.rotation)) {
        const original = new Uint8Array(await session.file.arrayBuffer()); assertNotAborted(signal); return { blob: outputBlob(original), pageCount: plan.length, inputBytes, outputBytes: original.length, generatedBytes: bytes.length, profile, rasterized: false, usedOriginal: true };
      }
      return { blob: outputBlob(bytes), pageCount: plan.length, inputBytes, outputBytes: bytes.length, generatedBytes: bytes.length, profile, rasterized: true, usedOriginal: false };
    } finally { try { canvas.width = 1; canvas.height = 1; } catch {} }
  };

  const fitImage = (sourceWidth, sourceHeight, maxPixels = 24_000_000, maxEdge = 6500) => {
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight), Math.sqrt(maxPixels / Math.max(1, sourceWidth * sourceHeight)));
    return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)), scale };
  };
  const normalizeHex = (value) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#ffffff';
  const colorFor = (hex, pdfLib) => {
    const value = normalizeHex(hex); const parts = [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
    return pdfLib.rgb ? pdfLib.rgb(...parts) : { type: 'RGB', red: parts[0], green: parts[1], blue: parts[2] };
  };
  const pageDimensionsFor = (imageWidth, imageHeight, options = {}) => {
    const pageSize = ['a4', 'a3', 'original', 'auto'].includes(options.pageSize) ? options.pageSize : 'a4';
    const margin = Math.max(0, Math.min(50, Number(options.marginMm) || 0)) * 72 / 25.4;
    let width, height;
    if (pageSize === 'original') { width = imageWidth * .75 + margin * 2; height = imageHeight * .75 + margin * 2; }
    else { [width, height] = PAGE_SIZES[pageSize === 'a3' ? 'a3' : 'a4']; }
    const orientation = options.orientation === 'portrait' || options.orientation === 'landscape' ? options.orientation : imageWidth > imageHeight ? 'landscape' : 'portrait';
    if ((orientation === 'landscape' && width < height) || (orientation === 'portrait' && width > height)) [width, height] = [height, width];
    return { width, height, margin: Math.min(margin, Math.max(0, Math.min(width, height) / 2 - 1)) };
  };

  const imagesToPDF = async (files, options = {}, { signal, onProgress, pdfLib, canvasFactory = () => document.createElement('canvas'), imageLoader } = {}) => {
    const sources = [...(files || [])].filter(Boolean); if (!sources.length) throw new Error('请先选择至少一张图片。');
    const lib = await ensurePdfLib(pdfLib), output = await lib.PDFDocument.create(), canvas = canvasFactory(); const quality = Math.max(.45, Math.min(.95, Number(options.quality) || .9));
    const load = imageLoader || (async (file) => { const normalized = ns.ImageDecoder?.normalizeFile ? await ns.ImageDecoder.normalizeFile(file, signal) : file; return createImageBitmap(normalized); });
    try {
      for (let index = 0; index < sources.length; index += 1) {
        assertNotAborted(signal); const file = sources[index]; onProgress?.({ stage: 'decode', current: index + 1, total: sources.length, fileName: file.name || `图片 ${index + 1}` });
        const image = await load(file, signal); try {
          assertNotAborted(signal); const size = fitImage(image.width, image.height); canvas.width = size.width; canvas.height = size.height; const context = canvas.getContext('2d', { alpha: false }); context.fillStyle = normalizeHex(options.background); context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
          onProgress?.({ stage: 'encode', current: index + 1, total: sources.length, fileName: file.name || `图片 ${index + 1}` }); const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality); const embedded = await output.embedJpg(await jpeg.arrayBuffer()); const pageSize = pageDimensionsFor(canvas.width, canvas.height, options); const page = output.addPage(); page.setSize(pageSize.width, pageSize.height); page.drawRectangle({ x: 0, y: 0, width: pageSize.width, height: pageSize.height, color: colorFor(options.background, lib) });
          const availableWidth = Math.max(1, pageSize.width - pageSize.margin * 2), availableHeight = Math.max(1, pageSize.height - pageSize.margin * 2), scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height); const drawWidth = canvas.width * scale, drawHeight = canvas.height * scale;
          page.drawImage(embedded, { x: (pageSize.width - drawWidth) / 2, y: (pageSize.height - drawHeight) / 2, width: drawWidth, height: drawHeight });
        } finally { try { image.close?.(); } catch {} }
      }
      assertNotAborted(signal); onProgress?.({ stage: 'save', current: sources.length, total: sources.length }); const bytes = await output.save(saveOptions); assertNotAborted(signal);
      return { blob: outputBlob(bytes), pageCount: sources.length, inputBytes: sources.reduce((sum, file) => sum + (file.size || 0), 0), outputBytes: bytes.length };
    } finally { try { canvas.width = 1; canvas.height = 1; } catch {} }
  };

  const pdfToImages = async (session, pageNumbers, options = {}, { signal, onProgress, canvasFactory = () => document.createElement('canvas') } = {}) => {
    if (!session?.file || !session?.numPages || typeof session.renderPage !== 'function') throw new Error('请先选择一个可读取的 PDF。');
    const pages = (pageNumbers || []).map((item, index) => typeof item === 'object' ? { sourcePage: Number(item.sourcePage), rotation: normalizeRotation(item.rotation || 0), outputPage: Number(item.outputPage) || index + 1 } : { sourcePage: Number(item), rotation: 0, outputPage: Number(item) }); if (!pages.length) throw new Error('没有选择要转换的页面。');
    const type = options.type === 'image/png' ? 'image/png' : 'image/jpeg', quality = Math.max(.45, Math.min(.98, Number(options.quality) || .9)), dpi = Math.max(72, Math.min(300, Number(options.dpi) || 144)), canvas = canvasFactory(), results = [];
    try {
      for (let index = 0; index < pages.length; index += 1) {
        const item = pages[index], pageNumber = item.sourcePage; if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > session.numPages) throw new Error(`页码必须在 1-${session.numPages} 之间。`); assertNotAborted(signal); onProgress?.({ stage: 'render', current: index + 1, total: pages.length, pageNumber });
        const info = await session.getPageInfo(pageNumber, signal, item.rotation); const scale = dpi / 72, width = info.width * scale, height = info.height * scale;
        if (Math.max(width, height) > 16384 || width * height > 32_000_000) throw new Error(`第 ${item.outputPage} 页超过安全画布尺寸，请降低输出 DPI 后重试。`);
        const rendered = await session.renderPage(pageNumber, canvas, { maxWidth: width, maxHeight: height, outputScale: 1, background: '#ffffff', intent: 'print', signal, extraRotation: item.rotation }); assertNotAborted(signal);
        onProgress?.({ stage: 'encode', current: index + 1, total: pages.length, pageNumber }); const blob = await canvasToBlob(canvas, type, type === 'image/png' ? undefined : quality); assertNotAborted(signal); results.push({ blob, pageNumber, outputPage: item.outputPage, width: rendered.renderedWidth, height: rendered.renderedHeight });
      }
      return { images: results, pageCount: results.length, type, dpi };
    } finally { try { canvas.width = 1; canvas.height = 1; } catch {} }
  };

  const pdfToLongImage = async (session, pageNumbers, options = {}, { signal, onProgress, canvasFactory = () => document.createElement('canvas') } = {}) => {
    if (!session?.file || !session?.numPages || typeof session.renderPage !== 'function') throw new Error('请先选择一个可读取的 PDF。');
    const pages = (pageNumbers || []).map((item, index) => typeof item === 'object' ? { sourcePage: Number(item.sourcePage), rotation: normalizeRotation(item.rotation || 0), outputPage: Number(item.outputPage) || index + 1 } : { sourcePage: Number(item), rotation: 0, outputPage: Number(item) });
    if (!pages.length) throw new Error('没有选择要拼接为长图的页面。');
    const type = options.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = Math.max(.45, Math.min(.98, Number(options.quality) || .9));
    const requestedDpi = Math.max(72, Math.min(240, Number(options.dpi) || 144));
    const gap = Math.max(0, Math.min(80, Math.round(Number(options.gap) ?? 12)));
    const divider = options.divider !== false;
    const background = normalizeHex(options.background || '#f1f5f9');

    // Pass 1: inspect page sizes only (no rendering yet) to compute a memory-safe uniform width.
    const infos = [];
    for (let i = 0; i < pages.length; i += 1) {
      const item = pages[i];
      if (!Number.isInteger(item.sourcePage) || item.sourcePage < 1 || item.sourcePage > session.numPages) throw new Error(`页码必须在 1-${session.numPages} 之间。`);
      assertNotAborted(signal);
      const info = await session.getPageInfo(item.sourcePage, signal, item.rotation);
      infos.push(info);
    }
    const maxPtWidth = Math.max(...infos.map((info) => Math.max(1, info.width)));
    let targetWidth = Math.max(320, Math.round(maxPtWidth * (requestedDpi / 72)));
    const computeHeights = (w) => infos.map((info) => Math.max(1, Math.round((info.height / Math.max(1, info.width)) * w)));
    let heights = computeHeights(targetWidth);
    const totalGaps = gap * Math.max(0, pages.length - 1);
    let totalHeight = heights.reduce((sum, h) => sum + h, 0) + totalGaps;

    const MAX_CANVAS_HEIGHT = 30_000;
    const MAX_CANVAS_PIXELS = 42_000_000;
    const MAX_WIDTH = 4096;
    if (targetWidth > MAX_WIDTH) {
      targetWidth = MAX_WIDTH;
      heights = computeHeights(targetWidth);
      totalHeight = heights.reduce((sum, h) => sum + h, 0) + totalGaps;
    }
    if (totalHeight > MAX_CANVAS_HEIGHT) {
      const shrink = Math.max(0.15, (MAX_CANVAS_HEIGHT - totalGaps) / Math.max(1, totalHeight - totalGaps));
      targetWidth = Math.max(240, Math.floor(targetWidth * shrink));
      heights = computeHeights(targetWidth);
      totalHeight = heights.reduce((sum, h) => sum + h, 0) + totalGaps;
    }
    if (targetWidth * totalHeight > MAX_CANVAS_PIXELS) {
      const shrink = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, targetWidth * totalHeight));
      targetWidth = Math.max(240, Math.floor(targetWidth * shrink));
      heights = computeHeights(targetWidth);
      totalHeight = heights.reduce((sum, h) => sum + h, 0) + totalGaps;
    }
    if (totalHeight > 32767) throw new Error(`页数过多导致长图总高度超限（${totalHeight}px），请缩小页码范围分批生成。`);

    const outCanvas = canvasFactory();
    const pageCanvas = canvasFactory();
    try {
      outCanvas.width = targetWidth;
      outCanvas.height = totalHeight;
      const outCtx = outCanvas.getContext('2d', { alpha: false });
      outCtx.fillStyle = background;
      outCtx.fillRect(0, 0, targetWidth, totalHeight);

      let y = 0;
      for (let i = 0; i < pages.length; i += 1) {
        const item = pages[i];
        const drawH = heights[i];
        assertNotAborted(signal);
        onProgress?.({ stage: 'render', current: i + 1, total: pages.length, pageNumber: item.outputPage });
        await session.renderPage(item.sourcePage, pageCanvas, {
          maxWidth: targetWidth,
          maxHeight: drawH + 2,
          outputScale: 1,
          background: '#ffffff',
          intent: 'print',
          signal,
          extraRotation: item.rotation,
          applyInlineStyle: false
        });
        assertNotAborted(signal);
        outCtx.fillStyle = '#ffffff';
        outCtx.fillRect(0, y, targetWidth, drawH);
        outCtx.drawImage(pageCanvas, 0, 0, pageCanvas.width, pageCanvas.height, 0, y, targetWidth, drawH);
        if (divider && i < pages.length - 1) {
          const lineY = Math.round(y + drawH + gap / 2);
          outCtx.save();
          outCtx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
          outCtx.lineWidth = Math.max(1, Math.round(targetWidth / 900));
          outCtx.beginPath();
          outCtx.moveTo(0, lineY);
          outCtx.lineTo(targetWidth, lineY);
          outCtx.stroke();
          outCtx.restore();
        }
        y += drawH + gap;
      }

      onProgress?.({ stage: 'encode', current: pages.length, total: pages.length });
      const blob = await canvasToBlob(outCanvas, type, type === 'image/png' ? undefined : quality);
      assertNotAborted(signal);
      return { blob, width: targetWidth, height: totalHeight, pageCount: pages.length, type, effectiveDpi: Math.round((targetWidth / maxPtWidth) * 72) };
    } finally {
      try { pageCanvas.width = 1; pageCanvas.height = 1; } catch {}
      try { outCanvas.width = 1; outCanvas.height = 1; } catch {}
    }
  };

  const signPDF = async (file, pagePlan, placements, { signal, onProgress, pdfLib } = {}) => {
    if (!file) throw new Error('请先选择一个 PDF。');
    const items = [...(placements || [])].filter((p) => p && p.stampBytes);
    if (!items.length) throw new Error('请先在页面上放置至少一个签名或印章。');
    const lib = await ensurePdfLib(pdfLib);
    assertNotAborted(signal);
    const source = await loadSourcePDF(file, lib, '签名盖章');
    const plan = normalizePagePlan(pagePlan, source.getPageCount());
    if (!plan.length) throw new Error('至少需要保留一页。');
    const output = await lib.PDFDocument.create();
    await copyPlanToDocument(output, source, plan, lib);
    assertNotAborted(signal);

    const pages = output.getPages();
    const embeddedCache = new Map();
    let placedCount = 0;

    for (let i = 0; i < items.length; i += 1) {
      assertNotAborted(signal);
      const item = items[i];
      onProgress?.({ stage: 'sign', current: i + 1, total: items.length });
      const cacheKey = item.stampId || item.stampBytes;
      let embedded = embeddedCache.get(cacheKey);
      if (!embedded) {
        const bytes = item.stampBytes instanceof Blob ? await item.stampBytes.arrayBuffer() : item.stampBytes;
        embedded = await output.embedPng(bytes);
        embeddedCache.set(cacheKey, embedded);
      }
      const targetPages = Array.isArray(item.pages) && item.pages.length
        ? item.pages
        : [Math.max(1, Math.min(pages.length, Math.round(Number(item.page) || 1)))];

      const widthRatio = Math.max(0.03, Math.min(0.9, Number(item.widthRatio) || 0.22));
      const xRatio = Math.max(0, Math.min(1, Number(item.xRatio) ?? 0.72));
      const yRatio = Math.max(0, Math.min(1, Number(item.yRatio) ?? 0.82)); // top-down ratio from UI preview
      const opacity = Math.max(0.1, Math.min(1, Number(item.opacity) ?? 1));
      const angle = Number.isFinite(Number(item.rotation)) ? Math.max(-180, Math.min(180, Number(item.rotation))) : 0;

      for (const pageNum of targetPages) {
        if (pageNum < 1 || pageNum > pages.length) continue;
        const page = pages[pageNum - 1];
        const box = displayBox(page);
        const drawWidth = box.width * widthRatio;
        const drawHeight = (drawWidth * embedded.height) / Math.max(1, embedded.width);
        // Convert top-down UI center (xRatio, yRatio) to PDF bottom-up display coordinates.
        const cx = xRatio * box.width;
        const cy = (1 - yRatio) * box.height;
        const { x, y, rotation } = stampPlacement(box, cx, cy, drawWidth, drawHeight, -angle);
        page.drawImage(embedded, { x, y, width: drawWidth, height: drawHeight, opacity, rotate: degreeValue(lib, rotation) });
        placedCount += 1;
      }
    }

    onProgress?.({ stage: 'save', current: items.length, total: items.length });
    const bytes = await output.save(saveOptions);
    assertNotAborted(signal);
    return { blob: outputBlob(bytes), pageCount: pages.length, placedCount, inputBytes: file.size || 0, outputBytes: bytes.length };
  };

  const formatPageNumberLabel = (displayNum, displayTotal, format = 'zh-total') => {
    if (format === 'slash') return `${displayNum} / ${displayTotal}`;
    if (format === 'plain') return `${displayNum}`;
    if (format === 'dash') return `- ${displayNum} -`;
    if (format === 'en') return `Page ${displayNum} of ${displayTotal}`;
    return `第 ${displayNum} / ${displayTotal} 页`;
  };

  const renderTextStripPng = async (text, { fontSizePt = 11, color = '#475569', scale = 3, canvasFactory = () => document.createElement('canvas') } = {}) => {
    const clean = String(text || '').trim();
    if (!clean) return null;
    const pxSize = Math.max(12, fontSizePt * scale);
    const padX = Math.ceil(pxSize * 0.45);
    const padY = Math.ceil(pxSize * 0.35);
    const canvas = canvasFactory();
    const font = `500 ${pxSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif`;
    const measureCtx = canvas.getContext('2d');
    measureCtx.font = font;
    const textWidth = Math.max(1, Math.ceil(measureCtx.measureText(clean).width));
    canvas.width = textWidth + padX * 2;
    canvas.height = Math.ceil(pxSize * 1.35) + padY * 2;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(color) ? color : '#475569';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clean, canvas.width / 2, canvas.height / 2);
    const blob = await canvasToBlob(canvas, 'image/png');
    const ptWidth = canvas.width / scale;
    const ptHeight = canvas.height / scale;
    try { canvas.width = 1; canvas.height = 1; } catch {}
    return { bytes: await blob.arrayBuffer(), widthPt: ptWidth, heightPt: ptHeight };
  };

  const addHeaderFooterPDF = async (file, pagePlan, options = {}, { signal, onProgress, pdfLib, canvasFactory = () => document.createElement('canvas') } = {}) => {
    if (!file) throw new Error('请先选择一个 PDF。');
    const pageNumberEnabled = options.pageNumberEnabled !== false;
    const headerText = String(options.headerText || '').trim();
    const footerText = String(options.footerText || '').trim();
    if (!pageNumberEnabled && !headerText && !footerText) {
      throw new Error('请至少开启页码或填写页眉 / 页脚文字。');
    }
    const lib = await ensurePdfLib(pdfLib);
    assertNotAborted(signal);
    const source = await loadSourcePDF(file, lib, '添加页码与页眉页脚');
    const plan = normalizePagePlan(pagePlan, source.getPageCount());
    if (!plan.length) throw new Error('至少需要保留一页。');
    const output = await lib.PDFDocument.create();
    await copyPlanToDocument(output, source, plan, lib);
    assertNotAborted(signal);

    const pages = output.getPages();
    const targetPages = new Set((options.pages || originalPlan(pages.length).map((p) => p.sourcePage)).map(Number));
    const skipFirstPage = Boolean(options.skipFirstPage);
    const startNumber = Math.max(0, Math.round(Number(options.startNumber) ?? 1));
    const fontSizePt = Math.max(7, Math.min(28, Number(options.fontSize) || 11));
    const marginPt = Math.max(4, Math.min(40, Number(options.marginMm) || 12)) * 72 / 25.4;
    const color = /^#[0-9a-f]{6}$/i.test(options.color || '') ? options.color : '#475569';
    const position = String(options.position || 'bottom-center');
    const headerAlign = ['left', 'center', 'right'].includes(options.headerAlign) ? options.headerAlign : 'center';
    const footerAlign = ['left', 'center', 'right'].includes(options.footerAlign) ? options.footerAlign : 'left';
    const format = String(options.format || 'zh-total');

    const headerStrip = headerText ? await renderTextStripPng(headerText, { fontSizePt, color, canvasFactory }) : null;
    const footerStrip = footerText ? await renderTextStripPng(footerText, { fontSizePt, color, canvasFactory }) : null;
    const embeddedHeader = headerStrip ? await output.embedPng(headerStrip.bytes) : null;
    const embeddedFooter = footerStrip ? await output.embedPng(footerStrip.bytes) : null;

    const placeStrip = (page, box, embedded, widthPt, heightPt, align, vertical) => {
      const clampedW = Math.min(widthPt, Math.max(20, box.width - marginPt * 2));
      const clampedH = heightPt * (clampedW / Math.max(1, widthPt));
      const cx = align === 'left' ? marginPt + clampedW / 2 : align === 'right' ? box.width - marginPt - clampedW / 2 : box.width / 2;
      const cy = vertical === 'top' ? box.height - marginPt : marginPt;
      const { x, y, rotation } = stampPlacement(box, cx, cy, clampedW, clampedH, 0);
      page.drawImage(embedded, { x, y, width: clampedW, height: clampedH, rotate: degreeValue(lib, rotation) });
    };

    const effectiveTotal = Math.max(1, pages.length - (skipFirstPage ? 1 : 0)) + startNumber - 1;
    let appliedCount = 0;
    for (let i = 0; i < pages.length; i += 1) {
      const pageIndex = i + 1;
      assertNotAborted(signal);
      if ((skipFirstPage && pageIndex === 1) || !targetPages.has(pageIndex)) continue;
      onProgress?.({ stage: 'stamp', current: pageIndex, total: pages.length });
      const page = pages[i];
      const box = displayBox(page);

      if (embeddedHeader && headerStrip) {
        placeStrip(page, box, embeddedHeader, headerStrip.widthPt, headerStrip.heightPt, headerAlign, 'top');
      }
      if (embeddedFooter && footerStrip) {
        placeStrip(page, box, embeddedFooter, footerStrip.widthPt, footerStrip.heightPt, footerAlign, 'bottom');
      }
      if (pageNumberEnabled) {
        const displayNum = startNumber + i - (skipFirstPage ? 1 : 0);
        const label = formatPageNumberLabel(displayNum, effectiveTotal, format);
        const strip = await renderTextStripPng(label, { fontSizePt, color, canvasFactory });
        if (strip) {
          const embeddedNum = await output.embedPng(strip.bytes);
          const [vert, align] = position.split('-');
          placeStrip(page, box, embeddedNum, strip.widthPt, strip.heightPt, align || 'center', vert === 'top' ? 'top' : 'bottom');
        }
      }
      appliedCount += 1;
    }

    onProgress?.({ stage: 'save', current: pages.length, total: pages.length });
    const bytes = await output.save(saveOptions);
    assertNotAborted(signal);
    return { blob: outputBlob(bytes), pageCount: pages.length, appliedCount, inputBytes: file.size || 0, outputBytes: bytes.length };
  };

  ns.PDFProcessor = {
    COMPRESSION_PROFILES, PAGE_SIZES, profileFor, normalizePagePlan, pageDimensionsFor, formatPageNumberLabel,
    mergePDFs, compressPDF, optimizePDF, watermarkPDF, savePagePlan, createPDFParts, imagesToPDF, pdfToImages,
    pdfToLongImage, signPDF, addHeaderFooterPDF
  };
})();
