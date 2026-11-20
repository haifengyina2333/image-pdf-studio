(() => {
  const ns = window.Toolbox ??= {};
  const SCALE_STEPS = [1, 0.82, 0.68, 0.54, 0.42, 0.32, 0.24, 0.18];

  const compressImage = async ({ file, dimensions, options, scope, signal, onStage }) => {
    const type = ns.CompressionModel.resolveType(file.type, options.type);
    const outputSize = ns.CompressionModel.getOutputSize(dimensions.width, dimensions.height, options.maxEdge);
    const result = await ns.ImageProcessor.processImage({
      file, type, quality: options.quality, outputSize, scope, signal, onStage,
      draw: (ctx, source, width, height) => ctx.drawImage(source, 0, 0, width, height)
    });
    return { ...result, outputType: result.outputType || type, strategy: ns.CompressionModel.explain({ inputType: file.type, outputType: result.outputType || type, dimensions: outputSize }) };
  };

  // Search for the highest quality & largest resolution that stays <= targetBytes without assuming strict monotonicity.
  const compressToTargetBytes = async ({ file, dimensions, targetBytes, options = {}, scope, signal, onStage }) => {
    const { assertNotAborted } = ns.ImageDecoder;
    assertNotAborted(signal);
    const desiredBytes = Math.max(10 * 1024, Math.round(Number(targetBytes) || 200 * 1024));
    const requestedType = ns.CompressionModel.resolveType(file.type, options.type);
    // PNG ignores quality; switch to JPEG for reliable byte-budget compression.
    const type = requestedType === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const baseSize = ns.CompressionModel.getOutputSize(dimensions.width, dimensions.height, options.maxEdge || Math.max(dimensions.width, dimensions.height));
    const minQuality = 0.28;
    const maxQuality = 0.94;

    onStage?.('decode');
    const source = scope.trackBitmap(await createImageBitmap(file));
    assertNotAborted(signal);
    const canvas = scope.trackCanvas(document.createElement('canvas'));

    const encodeAt = async (width, height, quality) => {
      assertNotAborted(signal);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: type !== 'image/jpeg' });
      if (type === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, width, height);
      const blob = await ns.ImageProcessor.toBlob(canvas, type, quality);
      assertNotAborted(signal);
      const actualType = blob.type && ns.ImageProcessor.mimeToExtension[blob.type] ? blob.type : type;
      return {
        blob,
        width,
        height,
        quality,
        outputType: actualType,
        extension: ns.ImageProcessor.mimeToExtension[actualType] || 'jpg',
        wasDownsampled: width < source.width || height < source.height
      };
    };

    let bestUnder = null;
    let smallest = null;
    const record = (candidate) => {
      if (!smallest || candidate.blob.size < smallest.blob.size) smallest = candidate;
      if (candidate.blob.size <= desiredBytes) {
        if (
          !bestUnder ||
          candidate.width * candidate.height > bestUnder.width * bestUnder.height ||
          (candidate.width * candidate.height === bestUnder.width * bestUnder.height && candidate.quality > bestUnder.quality)
        ) {
          bestUnder = candidate;
        }
      }
    };

    onStage?.('encode');
    for (const scaleStep of SCALE_STEPS) {
      const w = Math.max(64, Math.round(baseSize.width * scaleStep));
      const h = Math.max(64, Math.round(baseSize.height * scaleStep));

      // First try high quality at this resolution.
      const hi = await encodeAt(w, h, maxQuality);
      record(hi);
      if (hi.blob.size <= desiredBytes) break;

      // Check lower bound quality at this resolution; if still too large, step resolution down.
      const lo = await encodeAt(w, h, minQuality);
      record(lo);
      if (lo.blob.size > desiredBytes) continue;

      // Binary search quality in [minQuality, maxQuality] (7 steps -> ~0.005 precision).
      let low = minQuality;
      let high = maxQuality;
      for (let iter = 0; iter < 7; iter += 1) {
        const mid = (low + high) / 2;
        const attempt = await encodeAt(w, h, mid);
        record(attempt);
        if (attempt.blob.size <= desiredBytes) low = mid;
        else high = mid;
      }
      if (bestUnder) break;
    }

    const chosen = bestUnder || smallest;
    const metTarget = Boolean(bestUnder);
    const targetKB = Math.round(desiredBytes / 1024);
    const qualityPct = Math.round((chosen.quality || 0.8) * 100);
    const strategy = metTarget
      ? `已压至 ≤ ${targetKB} KB（${chosen.width}×${chosen.height} · 质量 ${qualityPct}%）`
      : `已尽最大压缩至 ${(chosen.blob.size / 1024).toFixed(1)} KB（目标 ${targetKB} KB）`;
    return {
      ...chosen,
      targetBytes: desiredBytes,
      metTarget,
      qualityUsed: chosen.quality,
      strategy
    };
  };

  ns.ImageCompressor = { compressImage, compressToTargetBytes };
})();
