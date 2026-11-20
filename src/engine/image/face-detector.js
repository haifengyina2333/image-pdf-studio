(() => {
  const ns = window.Toolbox ??= {};
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
  const abortError = () => new DOMException('任务已取消', 'AbortError');
  const assertActive = (signal) => { if (signal?.aborted) throw abortError(); };
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const modes = new Set(['standard', 'group']);
  const MIN_EXPRESSION_FACE_PX = 52;
  let injectedAdapter = null, detectorPromise = null, landmarkerPromise = null, runtimePromise = null, loaderUrl = null, wasmUrl = null, activeDetectorConfidence = null, activeLandmarkerConfidence = null, faceSequence = 0;

  const embeddedAssetsReady = () => ['mediapipeRuntime', 'mediapipeLoader', 'mediapipeWasm', 'faceDetectorModel', 'faceLandmarkerModel'].every((name) => ns.EmbeddedAssets?.has(name));
  const fileset = () => ({ wasmLoaderPath: loaderUrl, wasmBinaryPath: wasmUrl });
  const ensureRuntimeUrls = async () => {
    if (loaderUrl && wasmUrl && window.ToolboxMediaPipe?.FaceDetector && window.ToolboxMediaPipe?.FaceLandmarker) return;
    if (!embeddedAssetsReady()) throw new Error('人脸检测组件未能加载，请重新打开工具后再试。');
    runtimePromise ||= (async () => {
      await ns.EmbeddedAssets.loadScript('mediapipeRuntime', () => Boolean(window.ToolboxMediaPipe?.FaceDetector && window.ToolboxMediaPipe?.FaceLandmarker));
      if (!window.ToolboxMediaPipe?.FaceDetector || !window.ToolboxMediaPipe?.FaceLandmarker) throw new Error('人脸检测运行库初始化失败。');
      const [loaderSource, wasmBytes] = await Promise.all([ns.EmbeddedAssets.getText('mediapipeLoader'), ns.EmbeddedAssets.getBytes('mediapipeWasm')]);
      loaderUrl ||= URL.createObjectURL(new Blob([loaderSource], { type: 'text/javascript' }));
      wasmUrl ||= URL.createObjectURL(new Blob([wasmBytes], { type: 'application/wasm' }));
      ns.EmbeddedAssets.release('mediapipeLoader'); ns.EmbeddedAssets.release('mediapipeWasm');
    })().catch((error) => { runtimePromise = null; throw error; });
    await runtimePromise;
  };
  const createDetector = async (confidence) => {
    await ensureRuntimeUrls(); const model = await ns.EmbeddedAssets.getBytes('faceDetectorModel');
    try { const detector = await window.ToolboxMediaPipe.FaceDetector.createFromOptions(fileset(), { baseOptions: { modelAssetBuffer: model, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: confidence, minSuppressionThreshold: .3 }); activeDetectorConfidence = confidence; return detector; }
    finally { ns.EmbeddedAssets.release('faceDetectorModel'); }
  };
  const getDetector = async (confidence) => {
    if (!detectorPromise) detectorPromise = createDetector(confidence).catch((error) => { detectorPromise = null; throw error; });
    const detector = await detectorPromise;
    if (activeDetectorConfidence !== confidence) { await detector.setOptions({ minDetectionConfidence: confidence }); activeDetectorConfidence = confidence; }
    return detector;
  };
  const createLandmarker = async (confidence) => {
    await ensureRuntimeUrls(); const model = await ns.EmbeddedAssets.getBytes('faceLandmarkerModel');
    try { const landmarker = await window.ToolboxMediaPipe.FaceLandmarker.createFromOptions(fileset(), { baseOptions: { modelAssetBuffer: model, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1, minFaceDetectionConfidence: confidence, minFacePresenceConfidence: confidence, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false }); activeLandmarkerConfidence = confidence; return landmarker; }
    finally { ns.EmbeddedAssets.release('faceLandmarkerModel'); }
  };
  const getLandmarker = async (confidence) => {
    if (!landmarkerPromise) landmarkerPromise = createLandmarker(confidence).catch((error) => { landmarkerPromise = null; throw error; });
    const landmarker = await landmarkerPromise;
    if (activeLandmarkerConfidence !== confidence) { await landmarker.setOptions({ minFaceDetectionConfidence: confidence, minFacePresenceConfidence: confidence }); activeLandmarkerConfidence = confidence; }
    return landmarker;
  };
  const dimensionsFor = (source) => ({ width: Number(source?.naturalWidth || source?.videoWidth || source?.width || 0), height: Number(source?.naturalHeight || source?.videoHeight || source?.height || 0) });
  const tileFor = (grid, row, column, overlap = .2) => {
    const cell = 1 / grid, padding = cell * clamp(overlap, 0, .5) / 2, x = Math.max(0, column * cell - padding), y = Math.max(0, row * cell - padding), right = Math.min(1, (column + 1) * cell + padding), bottom = Math.min(1, (row + 1) * cell + padding);
    return { grid, row, column, x, y, width: right - x, height: bottom - y };
  };
  const createDetectionPlan = (_width, _height, mode = 'group') => {
    const grids = modes.has(mode) && mode === 'standard' ? [1, 2, 3] : [1, 2, 3, 4, 5];
    return grids.flatMap((grid) => Array.from({ length: grid * grid }, (_, index) => tileFor(grid, Math.floor(index / grid), index % grid)));
  };
  const mapBoxToTile = (box, tile) => {
    const x = clamp(tile.x + box.x * tile.width), y = clamp(tile.y + box.y * tile.height), right = clamp(tile.x + (box.x + box.width) * tile.width), bottom = clamp(tile.y + (box.y + box.height) * tile.height);
    return { ...box, x, y, width: Math.max(.001, right - x), height: Math.max(.001, bottom - y) };
  };
  const normalizeDetections = (result, tile, canvas) => (result?.detections || []).flatMap((detection) => {
    const box = detection?.boundingBox; if (!box || !canvas.width || !canvas.height) return [];
    const confidence = Number(detection.categories?.[0]?.score);
    return [mapBoxToTile({ x: box.originX / canvas.width, y: box.originY / canvas.height, width: box.width / canvas.width, height: box.height / canvas.height, enabled: true, source: 'auto', confidence: Number.isFinite(confidence) ? confidence : null, expression: 'neutral', expressionConfidence: 0, expressionReliable: false, expressionReason: 'pending', expressionOverride: '', detectionGrid: tile.grid }, tile)];
  });
  const intersectionOverUnion = (first, second) => {
    const left = Math.max(first.x, second.x), top = Math.max(first.y, second.y), right = Math.min(first.x + first.width, second.x + second.width), bottom = Math.min(first.y + first.height, second.y + second.height), intersection = Math.max(0, right - left) * Math.max(0, bottom - top), union = first.width * first.height + second.width * second.height - intersection;
    return union > 0 ? intersection / union : 0;
  };
  const sameFace = (first, second) => {
    if (intersectionOverUnion(first, second) >= .28) return true;
    const distance = Math.hypot(first.x + first.width / 2 - second.x - second.width / 2, first.y + first.height / 2 - second.y - second.height / 2), reference = Math.min(Math.hypot(first.width, first.height), Math.hypot(second.width, second.height)), areaRatio = first.width * first.height / Math.max(.000001, second.width * second.height);
    return distance <= reference * .24 && areaRatio >= .4 && areaRatio <= 2.5;
  };
  const deduplicateFaces = (faces) => {
    const sorted = [...(faces || [])].sort((first, second) => (second.confidence || 0) - (first.confidence || 0) || (second.detectionGrid || 1) - (first.detectionGrid || 1)), kept = [];
    for (const face of sorted) if (!kept.some((candidate) => sameFace(face, candidate))) kept.push(face);
    return kept.map((face) => ({ ...face, id: face.id || `face-${Date.now().toString(36)}-${++faceSequence}` })).sort((first, second) => first.y - second.y || first.x - second.x);
  };
  const renderTile = (source, tile, canvas) => {
    const dimensions = dimensionsFor(source), sourceX = Math.round(tile.x * dimensions.width), sourceY = Math.round(tile.y * dimensions.height), sourceWidth = Math.max(1, Math.round(tile.width * dimensions.width)), sourceHeight = Math.max(1, Math.round(tile.height * dimensions.height)), scale = Math.min(1, 1024 / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale)); canvas.height = Math.max(1, Math.round(sourceHeight * scale)); const context = canvas.getContext('2d', { alpha: false }); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height); return canvas;
  };
  const squareCropForFace = (face) => {
    const centerX = face.x + face.width / 2, centerY = face.y + face.height / 2, size = Math.min(1, Math.max(face.width, face.height) * 2.25), x = clamp(centerX - size / 2, 0, Math.max(0, 1 - size)), y = clamp(centerY - size / 2, 0, Math.max(0, 1 - size));
    return { x, y, width: Math.min(size, 1 - x), height: Math.min(size, 1 - y) };
  };
  const renderFaceCrop = (source, face, canvas) => {
    const dimensions = dimensionsFor(source), crop = squareCropForFace(face), sourceX = Math.round(crop.x * dimensions.width), sourceY = Math.round(crop.y * dimensions.height), sourceWidth = Math.max(1, Math.round(crop.width * dimensions.width)), sourceHeight = Math.max(1, Math.round(crop.height * dimensions.height));
    canvas.width = 512; canvas.height = 512; const context = canvas.getContext('2d', { alpha: false }); context.fillStyle = '#808080'; context.fillRect(0, 0, 512, 512); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 512, 512); return canvas;
  };
  const analyzeExpression = (landmarker, source, face, canvas) => {
    const dimensions = dimensionsFor(source), facePixels = Math.min(face.width * dimensions.width, face.height * dimensions.height);
    if (facePixels < MIN_EXPRESSION_FACE_PX) return { expression: 'neutral', expressionConfidence: 0, expressionReliable: false, expressionReason: 'too-small', expressionFacePixels: Math.round(facePixels) };
    const result = landmarker.detect(renderFaceCrop(source, face, canvas));
    if (!result?.faceLandmarks?.length) return { expression: 'neutral', expressionConfidence: 0, expressionReliable: false, expressionReason: 'landmarks-missing', expressionFacePixels: Math.round(facePixels) };
    const classified = ns.FaceExpression?.classify(result.faceBlendshapes?.[0]?.categories || result.faceBlendshapes?.[0] || []) || { expression: 'neutral', confidence: 0, reliable: false };
    return { expression: classified.expression, expressionConfidence: classified.confidence, expressionReliable: classified.reliable === true, expressionReason: classified.reliable ? 'classified' : 'uncertain', expressionFacePixels: Math.round(facePixels) };
  };
  const decodeSource = async (source, signal) => {
    assertActive(signal);
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      if (typeof createImageBitmap !== 'function') throw new Error('当前浏览器不能从原图创建人脸检测画面。'); let bitmap;
      try { bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' }); } catch { bitmap = await createImageBitmap(source); }
      if (signal?.aborted) { bitmap.close?.(); throw abortError(); } return { source: bitmap, release: () => bitmap.close?.() };
    }
    const dimensions = dimensionsFor(source); if (!dimensions.width || !dimensions.height) throw new Error('人脸检测源没有可读取的尺寸。'); return { source, release: () => {} };
  };
  const detect = async (source, { confidence = 0.35, mode = 'group', signal, onProgress } = {}) => {
    assertActive(signal); const normalizedConfidence = clamp(confidence, .1, .95), normalizedMode = modes.has(mode) ? mode : 'group'; await nextFrame(); assertActive(signal);
    if (injectedAdapter) { const result = await injectedAdapter(source, { confidence: normalizedConfidence, mode: normalizedMode, signal, onProgress }); assertActive(signal); return (result || []).map((face) => ({ enabled: true, source: 'auto', confidence: 1, expression: 'neutral', expressionConfidence: 0, expressionReliable: Boolean(face.expression), expressionReason: face.expression ? 'classified' : 'uncertain', ...face, id: face.id || `face-test-${++faceSequence}` })); }
    const decoded = await decodeSource(source, signal), detectionCanvas = document.createElement('canvas'), expressionCanvas = document.createElement('canvas');
    try {
      const detector = await getDetector(normalizedConfidence), dimensions = dimensionsFor(decoded.source), plan = createDetectionPlan(dimensions.width, dimensions.height, normalizedMode), candidates = []; assertActive(signal);
      for (let index = 0; index < plan.length; index += 1) { assertActive(signal); const tile = plan[index]; renderTile(decoded.source, tile, detectionCanvas); candidates.push(...normalizeDetections(detector.detect(detectionCanvas), tile, detectionCanvas)); onProgress?.({ phase: 'detect', current: index + 1, total: plan.length, grid: tile.grid, tile: tile.row * tile.grid + tile.column + 1, gridTotal: tile.grid * tile.grid }); await nextFrame(); }
      const faces = deduplicateFaces(candidates); if (!faces.length) return faces;
      const landmarker = await getLandmarker(Math.max(.2, normalizedConfidence));
      for (let index = 0; index < faces.length; index += 1) { assertActive(signal); Object.assign(faces[index], analyzeExpression(landmarker, decoded.source, faces[index], expressionCanvas)); onProgress?.({ phase: 'expression', current: index + 1, total: faces.length, face: index + 1 }); await nextFrame(); }
      return faces;
    } finally { detectionCanvas.width = 0; detectionCanvas.height = 0; expressionCanvas.width = 0; expressionCanvas.height = 0; decoded.release(); }
  };
  const close = async () => {
    if (detectorPromise) { try { (await detectorPromise).close?.(); } catch {} } if (landmarkerPromise) { try { (await landmarkerPromise).close?.(); } catch {} }
    detectorPromise = null; landmarkerPromise = null; runtimePromise = null; activeDetectorConfidence = null; activeLandmarkerConfidence = null; if (loaderUrl) URL.revokeObjectURL(loaderUrl); if (wasmUrl) URL.revokeObjectURL(wasmUrl); loaderUrl = null; wasmUrl = null;
  };
  ns.FaceDetector = { detect, close, embeddedAssetsReady, createDetectionPlan, mapBoxToTile, deduplicateFaces, intersectionOverUnion, squareCropForFace, MIN_EXPRESSION_FACE_PX, setAdapter(adapter) { injectedAdapter = typeof adapter === 'function' ? adapter : null; }, get usesInjectedAdapter() { return Boolean(injectedAdapter); } };
})();
