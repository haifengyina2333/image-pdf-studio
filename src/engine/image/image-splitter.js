(() => {
  const ns = window.Toolbox ??= {};
  const clampInteger = (value, min, max, fallback = 0) => { const number = Math.round(Number(value)); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; };
  const colorDistance = (data, offset, color) => Math.max(Math.abs(data[offset] - color[0]), Math.abs(data[offset + 1] - color[1]), Math.abs(data[offset + 2] - color[2]), Math.abs(data[offset + 3] - color[3]));
  const cornerColor = ({ data, width, height }) => {
    const points = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]; const color = [0, 0, 0, 0];
    points.forEach(([x, y]) => { const offset = (y * width + x) * 4; for (let channel = 0; channel < 4; channel += 1) color[channel] += data[offset + channel]; });
    return color.map((value) => Math.round(value / points.length));
  };
  const parseRowPattern = (value, maxPieces = 100) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];
      const counts = value.map(Number);
      if (counts.some((count) => !Number.isInteger(count) || count < 1 || count > 50)) throw new Error('每行张数必须是 1–50 的整数，例如 5+6 或 7+8+9。');
      if (counts.reduce((sum, count) => sum + count, 0) > maxPieces) throw new Error(`一次最多拆分 ${maxPieces} 张图片，请减少每行张数。`);
      return counts;
    }
    const text = String(value ?? '').trim();
    if (!text) return [];
    if (!/^\d+(?:\s*(?:\+|＋|,|，|、)\s*\d+)*$/.test(text)) throw new Error('每行张数格式不正确，请输入 5+6、11+13 或 7+8+9。');
    return parseRowPattern(text.split(/\s*(?:\+|＋|,|，|、)\s*/), maxPieces);
  };
  const meanColorForLine = (imageData, axis, index, rangeStart = 0, rangeEnd) => {
    const { data, width, height } = imageData; const limit = axis === 'x' ? height : width; const start = Math.max(0, Math.floor(rangeStart)); const end = Math.min(limit, Math.ceil(rangeEnd ?? limit)); const stride = Math.max(1, Math.floor(Math.max(1, end - start) / 700)); const mean = [0, 0, 0, 0]; let count = 0;
    for (let point = start; point < end; point += stride) { const x = axis === 'x' ? index : point, y = axis === 'x' ? point : index, offset = (y * width + x) * 4; for (let channel = 0; channel < 4; channel += 1) mean[channel] += data[offset + channel]; count += 1; }
    return mean.map((value) => Math.round(value / Math.max(1, count)));
  };
  const lineIsSeparator = (imageData, axis, index, background, tolerance = 14) => {
    const { data, width, height } = imageData; const length = axis === 'x' ? height : width; const stride = Math.max(1, Math.floor(length / 700)); const mean = meanColorForLine(imageData, axis, index); let uniform = 0; let backgroundMatches = 0; let count = 0;
    for (let point = 0; point < length; point += stride) { const x = axis === 'x' ? index : point, y = axis === 'x' ? point : index, offset = (y * width + x) * 4; if (colorDistance(data, offset, mean) <= tolerance) uniform += 1; if (colorDistance(data, offset, background) <= tolerance + 8) backgroundMatches += 1; count += 1; }
    return uniform / count >= .988 || backgroundMatches / count >= .988;
  };
  const lineMatchesColorInRange = (imageData, axis, index, rangeStart, rangeEnd, background, tolerance = 22) => {
    const { data, width, height } = imageData; const limit = axis === 'x' ? height : width; const start = Math.max(0, Math.floor(rangeStart)); const end = Math.min(limit, Math.ceil(rangeEnd)); const stride = Math.max(1, Math.floor(Math.max(1, end - start) / 700)); let matches = 0; let count = 0;
    for (let point = start; point < end; point += stride) { const x = axis === 'x' ? index : point, y = axis === 'x' ? point : index, offset = (y * width + x) * 4; if (colorDistance(data, offset, background) <= tolerance) matches += 1; count += 1; }
    return count > 0 && matches / count >= .985;
  };
  const runsFromFlags = (flags) => { const runs = []; let start = -1; flags.forEach((flag, index) => { if (flag && start < 0) start = index; if ((!flag || index === flags.length - 1) && start >= 0) { const end = flag && index === flags.length - 1 ? index : index - 1; runs.push({ start, end }); start = -1; } }); return runs; };
  const detectSeparatorBands = (imageData, axis) => { const length = axis === 'x' ? imageData.width : imageData.height, background = cornerColor(imageData), flags = Array.from({ length }, (_, index) => lineIsSeparator(imageData, axis, index, background)); return runsFromFlags(flags); };
  const detectColorBandsInRange = (imageData, axis, rangeStart, rangeEnd, background) => { const length = axis === 'x' ? imageData.width : imageData.height; return runsFromFlags(Array.from({ length }, (_, index) => lineMatchesColorInRange(imageData, axis, index, rangeStart, rangeEnd, background))); };
  const rangesFromBands = (length, bands, minSize = Math.max(8, Math.floor(length * .025))) => {
    const ranges = []; let cursor = 0;
    for (const band of bands) { if (band.start - cursor >= minSize) ranges.push({ start: cursor, end: band.start }); cursor = band.end + 1; }
    if (length - cursor >= minSize) ranges.push({ start: cursor, end: length });
    return ranges.length ? ranges : [{ start: 0, end: length }];
  };
  const equalRangesWithin = (start, end, count) => Array.from({ length: count }, (_, index) => ({ start: Math.round(start + index * (end - start) / count), end: Math.round(start + (index + 1) * (end - start) / count) }));
  const equalRanges = (length, count) => equalRangesWithin(0, length, count);
  const chooseRanges = (length, detected, forcedCount) => { if (!forcedCount) return detected; if (detected.length === forcedCount) return detected; const start = detected.length === 1 ? detected[0].start : 0, end = detected.length === 1 ? detected[0].end : length; return equalRangesWithin(start, end, forcedCount); };
  const separatorColorFor = (imageData, xBands, yBands) => {
    const widest = (bands) => bands.reduce((best, band) => !best || band.end - band.start > best.end - best.start ? band : best, null);
    const yBand = widest(yBands); if (yBand) return meanColorForLine(imageData, 'y', Math.round((yBand.start + yBand.end) / 2));
    const xBand = widest(xBands); if (xBand) return meanColorForLine(imageData, 'x', Math.round((xBand.start + xBand.end) / 2));
    return cornerColor(imageData);
  };
  const assertEqualCellSize = (rects) => {
    if (rects.length < 2) return;
    const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; }; const width = median(rects.map((rect) => rect.width)), height = median(rects.map((rect) => rect.height)); const widthTolerance = Math.max(3, width * .08), heightTolerance = Math.max(3, height * .08);
    if (rects.some((rect) => Math.abs(rect.width - width) > widthTolerance || Math.abs(rect.height - height) > heightTolerance)) throw new Error('检测到不同尺寸或跨行单元格；自动切割仅支持等尺寸网格，请改用手动裁切。');
  };
  const analyze = (imageData, { rows = 0, columns = 0, rowPattern = '', maxPieces = 100 } = {}) => {
    if (!imageData?.data || !imageData.width || !imageData.height) throw new Error('无法读取拼图像素。');
    const requestedPattern = parseRowPattern(rowPattern, maxPieces), forcedRows = requestedPattern.length || clampInteger(rows, 0, 50), forcedColumns = clampInteger(columns, 0, 50); const xBands = detectSeparatorBands(imageData, 'x'), yBands = detectSeparatorBands(imageData, 'y'); const detectedRows = rangesFromBands(imageData.height, yBands); const yRanges = chooseRanges(imageData.height, detectedRows, forcedRows); const separatorColor = separatorColorFor(imageData, xBands, yBands); const globalColumns = rangesFromBands(imageData.width, xBands); const rects = []; const rowCounts = [];
    yRanges.forEach((y, row) => {
      const rowBands = detectColorBandsInRange(imageData, 'x', y.start, y.end, separatorColor); let xRanges = rangesFromBands(imageData.width, rowBands); const expected = requestedPattern[row] || forcedColumns;
      if (expected) xRanges = chooseRanges(imageData.width, xRanges, expected);
      else if (xRanges.length === 1 && globalColumns.length > 1) xRanges = globalColumns;
      rowCounts.push(xRanges.length); xRanges.forEach((x, column) => rects.push({ x: x.start, y: y.start, width: x.end - x.start, height: y.end - y.start, row, column }));
    });
    if (!requestedPattern.length && !forcedRows && !forcedColumns && rects.length === 1) throw new Error('没有识别到可靠分隔线，请填写“每行张数”或原拼图的行数、列数后重试。');
    if (rects.length > maxPieces) throw new Error(`一次最多拆分 ${maxPieces} 张图片，请减少每行张数。`);
    assertEqualCellSize(rects);
    return { rects, rows: yRanges.length, columns: Math.max(...rowCounts), rowCounts, rowPattern: rowCounts.join('+'), automatic: !requestedPattern.length && !forcedRows && !forcedColumns, separatorBands: { x: xBands, y: yBands } };
  };
  const canvasBlob = (canvas, type = 'image/png') => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成拆分图片。')), type));
  // Map both edges, not start + rounded size: adjacent analysis cells must share one rounded source boundary.
  const mapCropToSource = (rect, analysisWidth, analysisHeight, sourceWidth, sourceHeight) => {
    const x = (edge) => Math.max(0, Math.min(sourceWidth, Math.round(edge * sourceWidth / analysisWidth)));
    const y = (edge) => Math.max(0, Math.min(sourceHeight, Math.round(edge * sourceHeight / analysisHeight)));
    const sx = x(rect.x), sy = y(rect.y);
    return { sx, sy, sw: x(rect.x + rect.width) - sx, sh: y(rect.y + rect.height) - sy };
  };
  const splitFile = async ({ file, rows = 0, columns = 0, rowPattern = '', scope, signal, maxAnalysisEdge = 1800, onProgress }) => {
    ns.ImageDecoder.assertNotAborted(signal); const workingFile = await ns.ImageDecoder.normalizeFile(file, signal); const source = scope.trackBitmap(await createImageBitmap(workingFile)); ns.ImageDecoder.assertNotAborted(signal);
    const scale = Math.min(1, maxAnalysisEdge / Math.max(source.width, source.height)); const analysisCanvas = scope.trackCanvas(document.createElement('canvas')); analysisCanvas.width = Math.max(1, Math.round(source.width * scale)); analysisCanvas.height = Math.max(1, Math.round(source.height * scale)); const analysisContext = analysisCanvas.getContext('2d', { alpha: true, willReadFrequently: true }); analysisContext.drawImage(source, 0, 0, analysisCanvas.width, analysisCanvas.height);
    const layout = analyze(analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height), { rows, columns, rowPattern }); const files = []; const base = (file.name || '拼图').replace(/\.[^.]+$/, '');
    for (let index = 0; index < layout.rects.length; index += 1) {
      ns.ImageDecoder.assertNotAborted(signal);
      const { sx, sy, sw, sh } = mapCropToSource(layout.rects[index], analysisCanvas.width, analysisCanvas.height, source.width, source.height);
      if (sw < 1 || sh < 1) throw new Error('切片尺寸不足 1 像素，请减少行数或列数。');
      if (sw * sh > 64_000_000) throw new Error('单个切片像素过高，请先降低原拼图分辨率。');
      const output = document.createElement('canvas'); output.width = sw; output.height = sh;
      let blob;
      try { output.getContext('2d', { alpha: true }).drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh); blob = await canvasBlob(output); }
      finally { output.width = 1; output.height = 1; }
      ns.ImageDecoder.assertNotAborted(signal);
      files.push(new File([blob], `${base}-切片-${String(index + 1).padStart(2, '0')}.png`, { type: 'image/png', lastModified: Date.now() })); onProgress?.(index + 1, layout.rects.length);
    }
    return { files, rows: layout.rows, columns: layout.columns, rowCounts: layout.rowCounts, rowPattern: layout.rowPattern, automatic: layout.automatic };
  };
  ns.ImageSplitter = { parseRowPattern, detectSeparatorBands, rangesFromBands, equalRanges, analyze, splitFile };
})();
