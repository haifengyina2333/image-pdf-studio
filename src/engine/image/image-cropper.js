(() => {
  const ns = window.Toolbox ??= {};
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normalizeCrop = (crop, dimensions) => {
    const x = clamp(Number(crop?.x) || 0, 0, .98), y = clamp(Number(crop?.y) || 0, 0, .98);
    const width = clamp(Number(crop?.width) || 1, .02, 1 - x), height = clamp(Number(crop?.height) || 1, .02, 1 - y);
    return { x, y, width, height };
  };
  const cropSize = (dimensions, crop) => ({ width: Math.max(1, Math.round(dimensions.width * crop.width)), height: Math.max(1, Math.round(dimensions.height * crop.height)) });
  const cropForAspect = (dimensions, pixelRatio, coverage = .84) => {
    const safeRatio = Math.max(.01, Number(pixelRatio) || 1);
    let width = Math.min(1, coverage), height = width * dimensions.width / (safeRatio * dimensions.height);
    if (height > coverage) { height = coverage; width = height * safeRatio * dimensions.height / dimensions.width; }
    return normalizeCrop({ x: (1 - width) / 2, y: (1 - height) / 2, width, height }, dimensions);
  };
  const cropImage = ({ file, dimensions, crop, type = file.type, quality = .92, scope, signal, onStage }) => {
    const normalized = normalizeCrop(crop, dimensions); const size = cropSize(dimensions, normalized);
    return ns.ImageProcessor.processImage({ file, type, quality, outputSize: size, scope, signal, onStage,
      draw: (ctx, source, width, height) => ctx.drawImage(source, Math.round(source.width * normalized.x), Math.round(source.height * normalized.y), Math.round(source.width * normalized.width), Math.round(source.height * normalized.height), 0, 0, width, height)
    });
  };
  ns.ImageCropper = { normalizeCrop, cropSize, cropForAspect, cropImage };
})();
