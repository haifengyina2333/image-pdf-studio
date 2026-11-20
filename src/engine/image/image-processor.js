(() => {
  const ns = window.Toolbox ??= {};
  const mimeToExtension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('浏览器未能编码图片。')), type, quality);
  });

  const clampOutputSize = (source, outputSize) => {
    if (!outputSize) return { width: source.width, height: source.height };
    return {
      width: Math.max(1, Math.round(outputSize.width)),
      height: Math.max(1, Math.round(outputSize.height))
    };
  };

  // Shared processing core. Tools only decide the target dimensions and how pixels are drawn.
  const processImage = async ({ file, type, quality, outputSize, scope, signal, onStage, draw, background = null }) => {
    const { assertNotAborted } = ns.ImageDecoder;
    assertNotAborted(signal);
    onStage?.('decode');
    const source = scope.trackBitmap(await createImageBitmap(file));
    assertNotAborted(signal);
    const { width, height } = clampOutputSize(source, outputSize);
    const canvas = scope.trackCanvas(document.createElement('canvas'));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: type !== 'image/jpeg' });
    if (background || type === 'image/jpeg') {
      ctx.fillStyle = background ?? '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    onStage?.('render');
    await draw(ctx, source, width, height);
    assertNotAborted(signal);
    onStage?.('encode');
    const blob = await toBlob(canvas, type, type === 'image/png' ? undefined : quality);
    assertNotAborted(signal);
    return { blob, width, height, extension: mimeToExtension[type], wasDownsampled: width < source.width || height < source.height };
  };

  ns.ImageProcessor = { processImage, mimeToExtension, toBlob };
})();
