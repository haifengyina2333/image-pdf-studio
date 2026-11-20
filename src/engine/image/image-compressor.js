(() => {
  const ns = window.Toolbox ??= {};
  const compressImage = async ({ file, dimensions, options, scope, signal, onStage }) => {
    const type = ns.CompressionModel.resolveType(file.type, options.type);
    const outputSize = ns.CompressionModel.getOutputSize(dimensions.width, dimensions.height, options.maxEdge);
    const result = await ns.ImageProcessor.processImage({
      file, type, quality: options.quality, outputSize, scope, signal, onStage,
      draw: (ctx, source, width, height) => ctx.drawImage(source, 0, 0, width, height)
    });
    return { ...result, outputType: type, strategy: ns.CompressionModel.explain({ inputType: file.type, outputType: type, dimensions: outputSize }) };
  };
  ns.ImageCompressor = { compressImage };
})();
