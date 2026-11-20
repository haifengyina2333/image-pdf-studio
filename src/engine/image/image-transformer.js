(() => {
  const ns = window.Toolbox ??= {};
  const transformImage = ({ file, dimensions, options, type = file.type, quality = .92, scope, signal, onStage }) => {
    const quarter = ((Number(options.rotation) % 360) + 360) % 360;
    const swap = quarter === 90 || quarter === 270;
    return ns.ImageProcessor.processImage({ file, type, quality, scope, signal, onStage,
      outputSize: { width: swap ? dimensions.height : dimensions.width, height: swap ? dimensions.width : dimensions.height },
      draw: (ctx, source, width, height) => { ctx.translate(width / 2, height / 2); ctx.rotate(quarter * Math.PI / 180); ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1); ctx.drawImage(source, -source.width / 2, -source.height / 2); }
    });
  };
  ns.ImageTransformer = { transformImage };
})();
