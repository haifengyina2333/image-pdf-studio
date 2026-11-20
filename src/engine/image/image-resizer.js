(() => {
  const ns = window.Toolbox ??= {};
  const sizeFor = (source, mode, value, width, height, keepRatio) => {
    if (mode === 'percent') { const scale = Math.max(.01, Math.min(4, Number(value) / 100 || 1)); return { width: Math.round(source.width * scale), height: Math.round(source.height * scale) }; }
    if (mode === 'width') { const w = Math.max(1, Number(value) || source.width); return { width: w, height: Math.round(source.height * w / source.width) }; }
    if (mode === 'height') { const h = Math.max(1, Number(value) || source.height); return { width: Math.round(source.width * h / source.height), height: h }; }
    const w = Math.max(1, Number(width) || source.width), h = Math.max(1, Number(height) || source.height);
    if (!keepRatio) return { width: w, height: h };
    const scale = Math.min(w / source.width, h / source.height); return { width: Math.max(1, Math.round(source.width * scale)), height: Math.max(1, Math.round(source.height * scale)) };
  };
  const resizeImage = ({ file, dimensions, options, type = file.type, quality = .92, scope, signal, onStage }) => ns.ImageProcessor.processImage({ file, type, quality, outputSize: sizeFor(dimensions, options.mode, options.value, options.width, options.height, options.keepRatio), scope, signal, onStage, draw: (ctx, source, width, height) => ctx.drawImage(source, 0, 0, width, height) });
  ns.ImageResizer = { sizeFor, resizeImage };
})();
