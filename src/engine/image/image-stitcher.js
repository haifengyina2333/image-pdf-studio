(() => {
  const ns = window.Toolbox ??= {};
  const MAX_EDGE = 32_000;
  const MAX_PIXELS = 64_000_000;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const safeNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const parseRowPattern = (value, maxPieces = 100) => {
    const text = Array.isArray(value) ? value.join('+') : String(value ?? '').trim();
    if (!text) return [];
    if (!/^\d+(?:\s*(?:\+|＋|,|，|、)\s*\d+)*$/.test(text)) throw new Error('每行张数格式不正确，请输入 5+6、11+13 或 7+8+9。');
    const counts = text.split(/\s*(?:\+|＋|,|，|、)\s*/).map(Number);
    if (counts.some((count) => !Number.isInteger(count) || count < 1 || count > 50)) throw new Error('每行张数必须是 1–50 的整数。');
    if (counts.reduce((sum, count) => sum + count, 0) > maxPieces) throw new Error(`一个拼图最多支持 ${maxPieces} 张图片。`);
    return counts;
  };
  const normalizeOptions = (options = {}) => ({
    mode: ['vertical', 'horizontal', 'grid'].includes(options.mode) ? options.mode : 'vertical',
    size: Math.round(clamp(safeNumber(options.size ?? options.width, 1080), Math.max(1, safeNumber(options.minSize, 160)), 10_000)),
    columns: Math.round(clamp(safeNumber(options.columns, 2), 1, 50)), rowPattern: parseRowPattern(options.rowPattern).join('+'),
    cellSizeMode: options.cellSizeMode === 'original' ? 'original' : 'custom', originalScale: clamp(safeNumber(options.originalScale, 1), .01, 1), incompleteRow: options.incompleteRow === 'first' ? 'first' : 'last',
    cellRatio: options.cellRatio === 'auto' || options.cellRatio === undefined ? 'auto' : clamp(safeNumber(options.cellRatio, 1), .3, 3),
    fit: options.fit === 'cover' ? 'cover' : 'contain', gap: Math.round(clamp(safeNumber(options.gap, 12), 0, 240)),
    gapX: Math.round(clamp(safeNumber(options.gapX ?? options.gap, 12), 0, 240)), gapY: Math.round(clamp(safeNumber(options.gapY ?? options.gap, 12), 0, 240)),
    background: options.background || '#ffffff', type: options.type || 'image/jpeg', quality: clamp(safeNumber(options.quality, .92), .4, 1),
    title: String(options.title ?? '').slice(0, 160), description: String(options.description ?? '').slice(0, 1600),
    titleSize: Math.round(clamp(safeNumber(options.titleSize, 42), 16, 160)), descriptionSize: Math.round(clamp(safeNumber(options.descriptionSize, 24), 12, 100)),
    headerColor: /^#[0-9a-f]{6}$/i.test(options.headerColor) ? options.headerColor : '#203044', headerAlign: options.headerAlign === 'center' ? 'center' : 'left', headerPosition: options.headerPosition === 'bottom' ? 'bottom' : 'top', headerPadding: Math.round(clamp(safeNumber(options.headerPadding, 32), 12, 160))
  });
  const dimensionsFor = (image) => image.dimensions ?? image;
  const autoCellRatioFor = (images) => {
    const ratios = images.map((image) => { const d = dimensionsFor(image); return d.width / d.height; }).filter((ratio) => Number.isFinite(ratio) && ratio > 0).sort((a, b) => a - b);
    if (!ratios.length) return 1;
    const middle = Math.floor(ratios.length / 2);
    return ratios.length % 2 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2;
  };
  const withPlacement = (image, x, y, width, height, clip = false) => ({ image, x, y, width, height, clip, draw: { x, y, width, height } });
  const characterUnits = (character) => /[\u0000-\u00ff]/.test(character) ? .55 : 1;
  const wrapText = (text, maxWidth, fontSize, maxLines = 30) => {
    const lines = []; const maxUnits = Math.max(1, maxWidth / fontSize); String(text || '').split(/\r?\n/).forEach((paragraph) => { if (!paragraph) { lines.push(''); return; } let line = ''; let units = 0; for (const character of paragraph) { const next = characterUnits(character); if (line && units + next > maxUnits) { lines.push(line); if (lines.length >= maxLines) return; line = character; units = next; } else { line += character; units += next; } } if (line && lines.length < maxLines) lines.push(line); }); return lines.slice(0, maxLines);
  };
  const headerFor = (width, options) => {
    const title = options.title.trim(), description = options.description.trim(); if (!title && !description) return null; const innerWidth = Math.max(1, width - options.headerPadding * 2); const titleLines = title ? wrapText(title, innerWidth, options.titleSize, 3) : []; const descriptionLines = description ? wrapText(description, innerWidth, options.descriptionSize, 30) : []; const titleLineHeight = Math.round(options.titleSize * 1.28), descriptionLineHeight = Math.round(options.descriptionSize * 1.5), gap = titleLines.length && descriptionLines.length ? Math.round(options.descriptionSize * .8) : 0; const height = options.headerPadding * 2 + titleLines.length * titleLineHeight + gap + descriptionLines.length * descriptionLineHeight;
    return { height, padding: options.headerPadding, color: options.headerColor, align: options.headerAlign, titleSize: options.titleSize, descriptionSize: options.descriptionSize, titleLineHeight, descriptionLineHeight, gap, titleLines, descriptionLines };
  };
  const withHeader = (layout, options) => { const baseHeader = headerFor(layout.width, options); if (!baseHeader) return { ...layout, header: null, contentHeight: layout.height }; const top = options.headerPosition === 'top', shift = top ? baseHeader.height : 0, header = { ...baseHeader, position: options.headerPosition, y: top ? 0 : layout.height }, items = shift ? layout.items.map((item) => ({ ...item, y: item.y + shift, draw: { ...item.draw, y: item.draw.y + shift } })) : layout.items; return { ...layout, header, items, contentHeight: layout.height, height: layout.height + baseHeader.height, pixels: layout.width * (layout.height + baseHeader.height) }; };
  const gridPlacement = (image, x, y, cellWidth, cellHeight, fit) => {
    const dimensions = dimensionsFor(image); const scale = fit === 'cover' ? Math.max(cellWidth / dimensions.width, cellHeight / dimensions.height) : Math.min(cellWidth / dimensions.width, cellHeight / dimensions.height);
    const width = Math.max(1, Math.round(dimensions.width * scale)), height = Math.max(1, Math.round(dimensions.height * scale));
    return { image, x, y, width: cellWidth, height: cellHeight, clip: fit === 'cover', draw: { x: x + Math.round((cellWidth - width) / 2), y: y + Math.round((cellHeight - height) / 2), width, height } };
  };
  const originalPlacement = (image, x, y, cellWidth, cellHeight, scale) => { const dimensions = dimensionsFor(image), width = Math.max(1, Math.round(dimensions.width * scale)), height = Math.max(1, Math.round(dimensions.height * scale)); return { image, x, y, width: cellWidth, height: cellHeight, clip: false, draw: { x: x + Math.round((cellWidth - width) / 2), y: y + Math.round((cellHeight - height) / 2), width, height } }; };
  const rowCountsFor = (length, columns, incompleteRow) => { const rows = Math.ceil(length / columns), remainder = length % columns, counts = Array.from({ length: rows }, () => columns); if (remainder) counts[incompleteRow === 'first' ? 0 : rows - 1] = remainder; return counts; };
  const layoutFor = (images, rawOptions) => {
    const options = normalizeOptions(rawOptions); const items = [];
    if (options.mode === 'vertical') { let y = 0; images.forEach((image, index) => { const d = dimensionsFor(image), height = Math.max(1, Math.round(options.size * d.height / d.width)); items.push(withPlacement(image, 0, y, options.size, height)); y += height + (index < images.length - 1 ? options.gapY : 0); }); return withHeader({ ...options, width: options.size, height: y, pixels: options.size * y, items }, options); }
    if (options.mode === 'horizontal') { let x = 0; images.forEach((image, index) => { const d = dimensionsFor(image), width = Math.max(1, Math.round(options.size * d.width / d.height)); items.push(withPlacement(image, x, 0, width, options.size)); x += width + (index < images.length - 1 ? options.gapX : 0); }); return withHeader({ ...options, width: x, height: options.size, pixels: x * options.size, items }, options); }
    const requestedRowCounts = parseRowPattern(options.rowPattern); if (requestedRowCounts.length && requestedRowCounts.reduce((sum, count) => sum + count, 0) !== images.length) throw new Error(`每行张数合计为 ${requestedRowCounts.reduce((sum, count) => sum + count, 0)}，必须与当前 ${images.length} 张图片一致。`); const rowCounts = requestedRowCounts.length ? requestedRowCounts : rowCountsFor(images.length, Math.min(options.columns, Math.max(1, images.length)), options.incompleteRow), columns = requestedRowCounts.length ? Math.max(...requestedRowCounts) : Math.min(options.columns, Math.max(1, images.length)), rows = rowCounts.length;
    if (options.cellSizeMode === 'original') {
      const scaled = images.map((image) => { const dimensions = dimensionsFor(image); return { width: Math.max(1, Math.round(dimensions.width * options.originalScale)), height: Math.max(1, Math.round(dimensions.height * options.originalScale)) }; }); const columnWidths = Array(columns).fill(0), rowHeights = Array(rows).fill(0); let cursor = 0;
      rowCounts.forEach((count, row) => { for (let column = 0; column < count; column += 1) { const dimensions = scaled[cursor++]; columnWidths[column] = Math.max(columnWidths[column], dimensions.width); rowHeights[row] = Math.max(rowHeights[row], dimensions.height); } }); const width = columnWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, columns - 1) * options.gapX, height = rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, rows - 1) * options.gapY; cursor = 0; let y = 0;
      rowCounts.forEach((count, row) => { const rowWidth = columnWidths.slice(0, count).reduce((sum, value) => sum + value, 0) + Math.max(0, count - 1) * options.gapX; let x = count < columns ? Math.round((width - rowWidth) / 2) : 0; for (let column = 0; column < count; column += 1) { items.push(originalPlacement(images[cursor++], x, y, columnWidths[column], rowHeights[row], options.originalScale)); x += columnWidths[column] + options.gapX; } y += rowHeights[row] + options.gapY; });
      return withHeader({ ...options, fit: 'contain', cellRatio: 'original', cellWidth: null, cellHeight: null, cellWidths: columnWidths, rowHeights, columns, rows, rowCounts, width, height, pixels: width * height, items }, options);
    }
    const resolvedCellRatio = options.cellRatio === 'auto' ? autoCellRatioFor(images) : options.cellRatio, cellWidth = options.size, cellHeight = Math.max(1, Math.round(cellWidth / resolvedCellRatio)), width = columns * cellWidth + Math.max(0, columns - 1) * options.gapX, height = rows * cellHeight + Math.max(0, rows - 1) * options.gapY; let cursor = 0;
    rowCounts.forEach((count, row) => { const rowWidth = count * cellWidth + Math.max(0, count - 1) * options.gapX, rowOffset = count < columns ? Math.round((width - rowWidth) / 2) : 0; for (let column = 0; column < count; column += 1) items.push(gridPlacement(images[cursor++], rowOffset + column * (cellWidth + options.gapX), row * (cellHeight + options.gapY), cellWidth, cellHeight, options.fit)); });
    return withHeader({ ...options, cellRatio: resolvedCellRatio, cellWidth, cellHeight, columns, rows, rowCounts, width, height, pixels: width * height, items }, options);
  };
  const assertSupportedLayout = (layout) => {
    if (!layout.items.length) throw new Error('请至少导入一张可用图片。');
    if (layout.height > MAX_EDGE || layout.width > MAX_EDGE) throw new Error(`拼图边长不能超过 ${MAX_EDGE.toLocaleString()} px，请降低单图尺寸或减少图片数量。`);
    if (layout.pixels > MAX_PIXELS) throw new Error('拼图像素过高，可能导致浏览器无响应；请降低单图尺寸或减少图片数量。');
  };
  const drawItem = (ctx, source, item) => { if (item.clip) { ctx.save(); ctx.beginPath(); ctx.rect(item.x, item.y, item.width, item.height); ctx.clip(); } ctx.drawImage(source, item.draw.x, item.draw.y, item.draw.width, item.draw.height); if (item.clip) ctx.restore(); };
  const drawHeader = (ctx, layout, scale = 1) => { const header = layout.header; if (!header) return; const x = header.align === 'center' ? layout.width * scale / 2 : header.padding * scale; let y = (header.y + header.padding) * scale; ctx.save(); ctx.fillStyle = header.color; ctx.textAlign = header.align; ctx.textBaseline = 'top'; if (header.titleLines.length) { ctx.font = `700 ${Math.max(1, Math.round(header.titleSize * scale))}px "Segoe UI",Arial,sans-serif`; header.titleLines.forEach((line) => { ctx.fillText(line, x, y); y += header.titleLineHeight * scale; }); } if (header.descriptionLines.length) { y += header.gap * scale; ctx.font = `400 ${Math.max(1, Math.round(header.descriptionSize * scale))}px "Segoe UI",Arial,sans-serif`; header.descriptionLines.forEach((line) => { ctx.fillText(line, x, y); y += header.descriptionLineHeight * scale; }); } ctx.restore(); };
  const stitchImages = async ({ images, options, scope, signal, onStage, onProgress }) => {
    const layout = layoutFor(images, options); assertSupportedLayout(layout);
    ns.ImageDecoder.assertNotAborted(signal); onStage?.('render');
    const canvas = scope.trackCanvas(document.createElement('canvas')); canvas.width = layout.width; canvas.height = layout.height;
    const ctx = canvas.getContext('2d', { alpha: layout.type !== 'image/jpeg' });
    if (layout.type === 'image/jpeg' || layout.background !== 'transparent') { ctx.fillStyle = layout.background; ctx.fillRect(0, 0, layout.width, layout.height); }
    drawHeader(ctx, layout);
    for (let index = 0; index < layout.items.length; index += 1) {
      ns.ImageDecoder.assertNotAborted(signal);
      onStage?.('decode');
      const item = layout.items[index], file = item.image.file ?? item.image;
      const bitmap = scope.trackBitmap(await createImageBitmap(file));
      ns.ImageDecoder.assertNotAborted(signal);
      onStage?.('render'); drawItem(ctx, bitmap, item); bitmap.close?.(); scope.bitmaps.delete(bitmap); onProgress?.(index + 1, layout.items.length);
    }
    ns.ImageDecoder.assertNotAborted(signal); onStage?.('encode');
    const blob = await ns.ImageProcessor.toBlob(canvas, layout.type, layout.type === 'image/png' ? undefined : layout.quality);
    ns.ImageDecoder.assertNotAborted(signal);
    return { blob, width: layout.width, height: layout.height, extension: ns.ImageProcessor.mimeToExtension[layout.type], layout };
  };
  ns.ImageStitcher = { MAX_EDGE, MAX_PIXELS, parseRowPattern, normalizeOptions, autoCellRatioFor, wrapText, headerFor, rowCountsFor, layoutFor, assertSupportedLayout, drawHeader, drawItem, stitchImages };
})();
