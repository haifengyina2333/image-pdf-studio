(() => {
  const ns = window.Toolbox ??= {};
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const abortError = () => new DOMException('任务已取消', 'AbortError');
  const assertActive = (signal) => { if (signal?.aborted) throw abortError(); };

  const PRESETS = Object.freeze([
    { id: 'original', label: '原图比例', desc: '不裁切', width: 0, height: 0 },
    { id: '1inch', label: '一寸', desc: '25×35mm · 295×413', width: 295, height: 413 },
    { id: 'small-1inch', label: '小一寸', desc: '22×32mm · 260×378', width: 260, height: 378 },
    { id: '2inch', label: '二寸', desc: '35×49mm · 413×579', width: 413, height: 579 },
    { id: 'small-2inch', label: '小二寸', desc: '35×45mm · 413×531', width: 413, height: 531 },
    { id: 'passport', label: '护照/签证', desc: '33×48mm · 390×567', width: 390, height: 567 },
    { id: 'driver', label: '驾驶证', desc: '22×32mm · 260×378', width: 260, height: 378 }
  ]);

  const BG_COLORS = Object.freeze([
    { id: 'blue', label: '证件蓝', value: '#438edb' },
    { id: 'white', label: '证件白', value: '#ffffff' },
    { id: 'red', label: '证件红', value: '#d92626' },
    { id: 'deep-blue', label: '深蓝', value: '#2b5b9e' },
    { id: 'gray', label: '浅灰', value: '#edf2f7' },
    { id: 'transparent', label: '透明底', value: 'transparent' }
  ]);

  let segmenterPromise = null;
  let injectedAdapter = null;

  const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];

  const getSegmenter = async () => {
    if (!segmenterPromise) {
      segmenterPromise = (async () => {
        if (!ns.MediaPipeRuntime?.ensureFileset) throw new Error('人像抠图运行库尚未初始化。');
        const fileset = await ns.MediaPipeRuntime.ensureFileset();
        if (!window.ToolboxMediaPipe?.ImageSegmenter) throw new Error('当前环境缺少 MediaPipe ImageSegmenter 组件。');
        const model = await ns.EmbeddedAssets.getBytes('selfieSegmenterModel');
        try {
          return await window.ToolboxMediaPipe.ImageSegmenter.createFromOptions(fileset, {
            baseOptions: { modelAssetBuffer: model, delegate: 'CPU' },
            runningMode: 'IMAGE',
            outputCategoryMask: false,
            outputConfidenceMasks: true
          });
        } finally {
          ns.EmbeddedAssets.release('selfieSegmenterModel');
        }
      })().catch((error) => {
        segmenterPromise = null;
        throw error;
      });
    }
    return segmenterPromise;
  };

  const dimensionsFor = (source) => ({
    width: Number(source?.naturalWidth || source?.videoWidth || source?.width || 0),
    height: Number(source?.naturalHeight || source?.videoHeight || source?.height || 0)
  });

  // Extract foreground person confidence Float32Array [0..1] from MediaPipe ImageSegmenter.
  const segmentPortrait = async (source, { signal } = {}) => {
    assertActive(signal);
    if (injectedAdapter) {
      const result = await injectedAdapter(source, { signal });
      assertActive(signal);
      return result;
    }

    let bitmap = null;
    let input = source;
    try {
      if (typeof Blob !== 'undefined' && source instanceof Blob) {
        try { bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' }); }
        catch { bitmap = await createImageBitmap(source); }
        input = bitmap;
      }
      assertActive(signal);
      const dims = dimensionsFor(input);
      if (!dims.width || !dims.height) throw new Error('无法读取照片尺寸。');

      // Scale down very large images to <= 1024px for fast, accurate selfie segmentation.
      const maxDim = Math.max(dims.width, dims.height);
      const scale = Math.min(1, 1024 / maxDim);
      const workCanvas = document.createElement('canvas');
      workCanvas.width = Math.max(1, Math.round(dims.width * scale));
      workCanvas.height = Math.max(1, Math.round(dims.height * scale));
      const wCtx = workCanvas.getContext('2d', { alpha: false });
      wCtx.imageSmoothingEnabled = true;
      wCtx.imageSmoothingQuality = 'high';
      wCtx.drawImage(input, 0, 0, workCanvas.width, workCanvas.height);

      const segmenter = await getSegmenter();
      assertActive(signal);
      const result = segmenter.segment(workCanvas);
      try {
        const masks = result?.confidenceMasks || [];
        if (!masks.length) throw new Error('未检测到可分割的人像前景。');
        // selfie_segmenter.tflite outputs 1 confidence mask (foreground person) or 2 masks ([0]=bg, [1]=person).
        const fgMask = masks.length >= 2 ? masks[1] : masks[0];
        const rawFloat = fgMask.getAsFloat32Array();
        const copy = new Float32Array(rawFloat.length);
        copy.set(rawFloat);
        return { mask: copy, width: fgMask.width, height: fgMask.height };
      } finally {
        try { result?.close?.(); } catch {}
        workCanvas.width = 0;
        workCanvas.height = 0;
      }
    } finally {
      try { bitmap?.close?.(); } catch {}
    }
  };

  // Build an alpha canvas from Float32Array confidence mask with soft edge transition.
  const buildAlphaCanvas = (maskData, { threshold = 0.45, feather = 1.5 } = {}) => {
    const { mask, width, height } = maskData;
    const raw = document.createElement('canvas');
    raw.width = width;
    raw.height = height;
    const ctx = raw.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    const t = clamp(threshold, 0.1, 0.9);
    const softness = 0.14;
    const lo = Math.max(0, t - softness);
    const hi = Math.min(1, t + softness);
    const span = Math.max(0.001, hi - lo);

    for (let i = 0; i < mask.length; i += 1) {
      const v = mask[i];
      let a = 0;
      if (v >= hi) a = 1;
      else if (v > lo) {
        const u = (v - lo) / span;
        a = u * u * (3 - 2 * u); // smoothstep for silky hair & shoulder edges
      }
      const p = i * 4;
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 255);
    }
    ctx.putImageData(imgData, 0, 0);

    const blurPx = clamp(feather, 0, 6);
    if (blurPx <= 0.05) return raw;

    const blurred = document.createElement('canvas');
    blurred.width = width;
    blurred.height = height;
    const bCtx = blurred.getContext('2d');
    bCtx.filter = `blur(${blurPx.toFixed(1)}px)`;
    bCtx.drawImage(raw, 0, 0);
    bCtx.filter = 'none';
    raw.width = 0;
    raw.height = 0;
    return blurred;
  };

  const outputDimensionsFor = (sourceDims, presetId = 'original') => {
    const preset = presetById(presetId);
    if (preset.width > 0 && preset.height > 0) return { width: preset.width, height: preset.height, preset };
    return { width: Math.max(1, sourceDims.width), height: Math.max(1, sourceDims.height), preset };
  };

  // Compute cover-fit placement of source photo inside target canvas with zoom & normalized offset.
  const computePlacement = (sourceWidth, sourceHeight, targetWidth, targetHeight, { zoom = 1, offsetX = 0, offsetY = 0 } = {}) => {
    const baseScale = Math.max(targetWidth / Math.max(1, sourceWidth), targetHeight / Math.max(1, sourceHeight));
    const scale = baseScale * clamp(zoom, 0.5, 3);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const dx = (targetWidth - drawWidth) / 2 + clamp(offsetX, -1, 1) * targetWidth;
    const dy = (targetHeight - drawHeight) / 2 + clamp(offsetY, -1, 1) * targetHeight;
    return { dx, dy, drawWidth, drawHeight };
  };

  const drawCheckerboard = (ctx, width, height, cell = 14) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e2e8f0';
    for (let y = 0; y < height; y += cell) {
      for (let x = ((y / cell) % 2) * cell; x < width; x += cell * 2) {
        ctx.fillRect(x, y, cell, cell);
      }
    }
  };

  const renderIdPhoto = (ctx, source, maskData, options = {}) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const dims = dimensionsFor(source);
    const bgColor = options.bgColor || '#438edb';
    const isTransparent = bgColor === 'transparent';
    const placement = computePlacement(dims.width, dims.height, width, height, options);

    ctx.clearRect(0, 0, width, height);
    if (!maskData) {
      if (!isTransparent) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, placement.dx, placement.dy, placement.drawWidth, placement.drawHeight);
      return;
    }

    const alphaCanvas = buildAlphaCanvas(maskData, options);
    const fgCanvas = document.createElement('canvas');
    fgCanvas.width = width;
    fgCanvas.height = height;
    const fgCtx = fgCanvas.getContext('2d');
    try {
      fgCtx.imageSmoothingEnabled = true;
      fgCtx.imageSmoothingQuality = 'high';
      fgCtx.drawImage(source, placement.dx, placement.dy, placement.drawWidth, placement.drawHeight);
      fgCtx.globalCompositeOperation = 'destination-in';
      fgCtx.drawImage(alphaCanvas, placement.dx, placement.dy, placement.drawWidth, placement.drawHeight);
      fgCtx.globalCompositeOperation = 'source-over';

      if (isTransparent) {
        if (options.showCheckerboard) drawCheckerboard(ctx, width, height, Math.max(10, Math.round(Math.min(width, height) / 28)));
      } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(fgCanvas, 0, 0);
    } finally {
      alphaCanvas.width = 0; alphaCanvas.height = 0;
      fgCanvas.width = 0; fgCanvas.height = 0;
    }
  };

  const exportIdPhoto = async ({ file, maskData, options = {}, type = 'image/jpeg', quality = 0.94, scope, signal, onStage }) => {
    const { assertNotAborted } = ns.ImageDecoder;
    assertNotAborted(signal);
    const isTransparent = options.bgColor === 'transparent';
    const effectiveType = isTransparent && type === 'image/jpeg' ? 'image/png' : type;

    onStage?.('decode');
    const source = scope.trackBitmap(await createImageBitmap(file));
    assertNotAborted(signal);
    const target = outputDimensionsFor(source, options.preset);
    const canvas = scope.trackCanvas(document.createElement('canvas'));
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d', { alpha: effectiveType !== 'image/jpeg' });
    onStage?.('render');
    renderIdPhoto(ctx, source, maskData, { ...options, showCheckerboard: false });
    assertNotAborted(signal);
    onStage?.('encode');
    const blob = await ns.ImageProcessor.toBlob(canvas, effectiveType, effectiveType === 'image/png' ? undefined : quality);
    assertNotAborted(signal);
    const actualType = blob.type && ns.ImageProcessor.mimeToExtension[blob.type] ? blob.type : effectiveType;
    return {
      blob,
      width: target.width,
      height: target.height,
      outputType: actualType,
      extension: ns.ImageProcessor.mimeToExtension[actualType] || 'png',
      presetLabel: target.preset.label
    };
  };

  const close = async () => {
    if (segmenterPromise) {
      try { (await segmenterPromise).close?.(); } catch {}
    }
    segmenterPromise = null;
  };

  ns.PortraitSegmenter = {
    PRESETS,
    BG_COLORS,
    presetById,
    outputDimensionsFor,
    computePlacement,
    segmentPortrait,
    buildAlphaCanvas,
    renderIdPhoto,
    exportIdPhoto,
    close,
    setAdapter(adapter) { injectedAdapter = typeof adapter === 'function' ? adapter : null; }
  };
})();
