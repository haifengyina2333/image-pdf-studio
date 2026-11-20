(() => {
  const ns = window.Toolbox ??= {};
  const MB = 1024 * 1024;
  const MAX_CANVAS_EDGE = 16384;
  const getPolicy = ({ width, height, fileSize = 0 }) => {
    const pixels = width * height;
    const estimatedRgbaMB = Math.round((pixels * 4) / MB);
    if (width > MAX_CANVAS_EDGE || height > MAX_CANVAS_EDGE || pixels > 60_000_000) return { level: 'high-risk', pixels, estimatedRgbaMB, recommendedPreviewEdge: 1600, allowOriginalSize: true, requireConfirmation: true, warning: `原图 ${width} × ${height}（${(pixels / 1e6).toFixed(1)}MP）解码后约需 ${estimatedRgbaMB}MB 内存。浏览器可能卡顿或无法创建画布。` };
    if (pixels > 20_000_000 || fileSize > 50 * MB) return { level: 'large', pixels, estimatedRgbaMB, recommendedPreviewEdge: 2000, allowOriginalSize: true, requireConfirmation: false, warning: `这是较大的图片（${(pixels / 1e6).toFixed(1)}MP），导出将以单任务方式处理。` };
    return { level: 'normal', pixels, estimatedRgbaMB, recommendedPreviewEdge: 2300, allowOriginalSize: true, requireConfirmation: false, warning: null };
  };
  const getPreviewSize = (width, height, policy) => {
    const edge = policy.recommendedPreviewEdge;
    const scale = Math.min(1, edge / Math.max(width, height), Math.sqrt(12_000_000 / (width * height)));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
  };
  ns.WorkloadPolicy = { getPolicy, getPreviewSize, MAX_CANVAS_EDGE };
})();
