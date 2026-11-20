(() => {
  const ns = window.Toolbox ??= {};
  const exportWatermarkedImage = async ({ file, options, type, quality, outputSize, scope, signal, onStage }) => {
    return ns.ImageProcessor.processImage({
      file, type, quality, outputSize, scope, signal, onStage,
      draw: (ctx, source, width, height) => { ctx.drawImage(source, 0, 0, width, height); ns.WatermarkRenderer.renderWatermark(ctx, width, height, options); }
    });
  };
  ns.ImageExporter = { exportWatermarkedImage };
})();
