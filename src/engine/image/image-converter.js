(() => {
  const ns = window.Toolbox ??= {};
  const convertImage = ({ file, dimensions, type, quality, background, scope, signal, onStage }) => ns.ImageProcessor.processImage({
    file, type, quality: type === 'image/png' ? undefined : quality, scope, signal, onStage, background,
    outputSize: { width: dimensions.width, height: dimensions.height },
    draw: (ctx, source, width, height) => ctx.drawImage(source, 0, 0, width, height)
  });
  ns.ImageConverter = { convertImage };
})();
