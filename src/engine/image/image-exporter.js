(() => {
  const ns = window.Toolbox ??= {};
  const assertExportable = (options) => {
    if (options.kind === 'image' && (!options.logo?.width || !options.logo?.height)) {
      throw new Error('请先上传 Logo 水印，或切换到文字水印。');
    }
  };
  const exportWatermarkedImage = async ({ file, options, type, quality, outputSize, scope, signal, onStage }) => {
    assertExportable(options);
    return ns.ImageProcessor.processImage({
      file, type, quality, outputSize, scope, signal, onStage,
      draw: (ctx, source, width, height) => { ctx.drawImage(source, 0, 0, width, height); ns.WatermarkRenderer.renderWatermark(ctx, width, height, options); }
    });
  };
  ns.ImageExporter = { assertExportable, exportWatermarkedImage };
})();
