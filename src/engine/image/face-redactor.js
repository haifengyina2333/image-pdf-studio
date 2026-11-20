(() => {
  const ns = window.Toolbox ??= {};
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
  const styles = new Set(['mosaic', 'blur', 'solid', 'emoji']);
  const shapes = new Set(['ellipse', 'rect']);
  const expressionModes = new Set(['fixed', 'auto', 'neutral', 'smile', 'laugh', 'surprise', 'sad', 'angry', 'shy', 'silly']);
  const emojiPresets = ['😎', '😂', '🤣', '😭', '🥹', '🤭', '🙈', '😱', '🤡', '😈', '👽', '💩', '🐶', '🐱', '🐼', '🐸', '❤️', '🔥', '⭐', '🎃'];
  const stickerPresets = [
    { id: 'monster', name: '潮玩怪兽' }, { id: 'milk-dragon', name: '奶黄小龙' },
    { id: 'hoop-rooster', name: '篮球公鸡' }, { id: 'anime-girl', name: '动漫少女' },
    { id: 'anime-boy', name: '动漫少年' }, { id: 'panda', name: '熊猫头' },
    { id: 'shiba', name: '柴犬' }, { id: 'duck', name: '黄鸭' }
  ];
  const stickerIds = new Set([...stickerPresets.map((preset) => preset.id), 'custom']);

  const normalizeBox = (box = {}) => {
    const x = clamp(box.x), y = clamp(box.y);
    return {
      ...box,
      x, y,
      width: clamp(box.width, 0.01, 1 - x),
      height: clamp(box.height, 0.01, 1 - y),
      enabled: box.enabled !== false
    };
  };

  const normalizeOptions = (options = {}) => ({
    style: styles.has(options.style) ? options.style : 'mosaic',
    shape: shapes.has(options.shape) ? options.shape : 'ellipse',
    strength: clamp(options.strength ?? 18, 2, 60),
    margin: clamp(options.margin ?? 24, 0, 80),
    color: /^#[0-9a-f]{6}$/i.test(options.color || '') ? options.color : '#111827',
    emoji: String(options.emoji || '😎').trim().slice(0, 8) || '😎',
    sticker: stickerIds.has(options.sticker) ? options.sticker : '',
    stickerImage: options.stickerImage && typeof options.stickerImage === 'object' ? options.stickerImage : null,
    expressionMode: expressionModes.has(options.expressionMode) ? options.expressionMode : 'auto'
  });

  const expandedBox = (rawBox, margin = 0) => {
    const box = normalizeBox(rawBox);
    const growX = box.width * clamp(margin, 0, 80) / 100;
    const growY = box.height * clamp(margin, 0, 80) / 100;
    const x = clamp(box.x - growX);
    const y = clamp(box.y - growY);
    const right = clamp(box.x + box.width + growX);
    const bottom = clamp(box.y + box.height + growY);
    return { ...box, x, y, width: right - x, height: bottom - y };
  };

  const pixelBox = (box, width, height) => ({
    x: Math.round(box.x * width), y: Math.round(box.y * height),
    width: Math.max(1, Math.round(box.width * width)), height: Math.max(1, Math.round(box.height * height))
  });

  const clipShape = (ctx, box, shape) => {
    ctx.beginPath();
    if (shape === 'ellipse' && typeof ctx.ellipse === 'function') ctx.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2);
    else ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
  };

  const drawMosaic = (ctx, source, box, strength, outputWidth, outputHeight) => {
    const tile = Math.max(2, Math.round(strength * Math.max(outputWidth, outputHeight) / 1200));
    const sample = document.createElement('canvas');
    sample.width = Math.max(1, Math.ceil(box.width / tile));
    sample.height = Math.max(1, Math.ceil(box.height / tile));
    const sampleCtx = sample.getContext('2d', { alpha: false });
    sampleCtx.imageSmoothingEnabled = true;
    const sourceWidth = Number(source.width || source.naturalWidth || outputWidth);
    const sourceHeight = Number(source.height || source.naturalHeight || outputHeight);
    sampleCtx.drawImage(source, box.x * sourceWidth / outputWidth, box.y * sourceHeight / outputHeight, box.width * sourceWidth / outputWidth, box.height * sourceHeight / outputHeight, 0, 0, sample.width, sample.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sample, 0, 0, sample.width, sample.height, box.x, box.y, box.width, box.height);
    ctx.imageSmoothingEnabled = true;
    sample.width = 0; sample.height = 0;
  };

  const drawBlur = (ctx, source, box, strength, outputWidth, outputHeight) => {
    const scaled = Math.max(2, strength * Math.max(outputWidth, outputHeight) / 1200);
    ctx.filter = `blur(${scaled.toFixed(1)}px)`;
    ctx.drawImage(source, 0, 0, outputWidth, outputHeight);
    ctx.filter = 'none';
  };

  const oval = (ctx, x, y, rx, ry, color, stroke = '', lineWidth = 0) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    if (stroke && lineWidth) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  };
  const circle = (ctx, x, y, radius, color, stroke = '', lineWidth = 0) => oval(ctx, x, y, radius, radius, color, stroke, lineWidth);
  const polygon = (ctx, points, color) => {
    ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  const line = (ctx, points, color, width = 3) => {
    ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };
  const eye = (ctx, x, y, iris = '#171b24', wide = false) => { oval(ctx, x, y, wide ? 8 : 6.5, wide ? 11 : 8.5, '#fff'); circle(ctx, x, y + 1, wide ? 5.2 : 4.4, iris); circle(ctx, x - 1.5, y - 1.4, 1.35, '#fff'); };
  const curve = (ctx, start, control, end, color, width = 3) => { ctx.beginPath(); ctx.moveTo(...start); ctx.quadraticCurveTo(...control, ...end); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke(); };
  const expressionFace = (ctx, rawExpression, config = {}) => {
    const expression = ns.FaceExpression?.normalize(rawExpression) || 'neutral';
    const left = config.left ?? 36, right = config.right ?? 64, eyeY = config.eyeY ?? 50, mouthY = config.mouthY ?? 72;
    const iris = config.iris || '#171b24', ink = config.ink || '#29160e', blush = config.blush || '#fb7185';
    const openEyes = (wide = false) => { eye(ctx, left, eyeY, iris, wide); eye(ctx, right, eyeY, iris, wide); };
    const closedEyes = (happy = true) => { const bend = happy ? eyeY - 5 : eyeY + 5; curve(ctx, [left - 7, eyeY], [left, bend], [left + 7, eyeY], ink, 3); curve(ctx, [right - 7, eyeY], [right, bend], [right + 7, eyeY], ink, 3); };
    if (expression === 'laugh') { closedEyes(true); oval(ctx, 50, mouthY, 17, 13, '#351018'); ctx.fillStyle = '#fff'; ctx.fillRect(37, mouthY - 8, 26, 5); oval(ctx, 50, mouthY + 7, 9, 4, '#fb7185'); }
    else if (expression === 'surprise') { openEyes(true); curve(ctx, [left - 8, eyeY - 13], [left, eyeY - 18], [left + 8, eyeY - 13], ink, 2.5); curve(ctx, [right - 8, eyeY - 13], [right, eyeY - 18], [right + 8, eyeY - 13], ink, 2.5); oval(ctx, 50, mouthY, 8, 11, '#351018'); }
    else if (expression === 'sad') { openEyes(); curve(ctx, [left - 8, eyeY - 12], [left, eyeY - 17], [left + 7, eyeY - 10], ink, 2.5); curve(ctx, [right - 7, eyeY - 10], [right, eyeY - 17], [right + 8, eyeY - 12], ink, 2.5); curve(ctx, [40, mouthY + 5], [50, mouthY - 6], [60, mouthY + 5], ink, 3); oval(ctx, right + 6, eyeY + 13, 3, 6, '#60a5fa'); }
    else if (expression === 'angry') { openEyes(); line(ctx, [[left - 9, eyeY - 12], [left + 8, eyeY - 7]], ink, 3.5); line(ctx, [[right - 8, eyeY - 7], [right + 9, eyeY - 12]], ink, 3.5); ctx.fillStyle = '#351018'; ctx.fillRect(38, mouthY - 4, 24, 9); ctx.fillStyle = '#fff'; ctx.fillRect(40, mouthY - 2, 20, 4); }
    else if (expression === 'shy') { closedEyes(true); oval(ctx, left - 11, eyeY + 13, 8, 4, blush); oval(ctx, right + 11, eyeY + 13, 8, 4, blush); curve(ctx, [41, mouthY - 2], [50, mouthY + 8], [59, mouthY - 2], ink, 3); }
    else if (expression === 'silly') { eye(ctx, left, eyeY, iris, true); curve(ctx, [right - 7, eyeY], [right, eyeY - 6], [right + 7, eyeY], ink, 3); oval(ctx, 50, mouthY, 14, 10, '#351018'); oval(ctx, 55, mouthY + 8, 7, 7, '#fb7185'); line(ctx, [[55, mouthY + 5], [55, mouthY + 11]], '#be123c', 1.5); }
    else if (expression === 'smile') { openEyes(); curve(ctx, [39, mouthY - 2], [50, mouthY + 10], [61, mouthY - 2], ink, 3); }
    else { openEyes(); line(ctx, [[42, mouthY], [58, mouthY]], ink, 3); }
  };

  const stickerPainters = {
    monster(ctx, expression) {
      polygon(ctx, [[17, 29], [8, 5], [34, 20]], '#6d28d9'); polygon(ctx, [[83, 29], [92, 5], [66, 20]], '#6d28d9'); oval(ctx, 50, 53, 40, 42, '#a78bfa', '#4c1d95', 3);
      expressionFace(ctx, expression, { eyeY: 43, mouthY: 70, iris: '#facc15', ink: '#32145f', blush: '#f0abfc' });
    },
    'milk-dragon'(ctx, expression) {
      polygon(ctx, [[27, 24], [31, 3], [42, 23]], '#f59e0b'); polygon(ctx, [[58, 23], [69, 3], [73, 25]], '#f59e0b'); oval(ctx, 50, 54, 42, 39, '#fcd34d', '#b45309', 3); oval(ctx, 19, 49, 12, 18, '#fde68a', '#b45309', 2); oval(ctx, 81, 49, 12, 18, '#fde68a', '#b45309', 2); oval(ctx, 50, 69, 23, 15, '#fff4c7'); circle(ctx, 45, 65, 2, '#9a5a17'); circle(ctx, 55, 65, 2, '#9a5a17');
      expressionFace(ctx, expression, { eyeY: 46, mouthY: 75, iris: '#6b3b11', ink: '#9a5a17', blush: '#fb923c' });
    },
    'hoop-rooster'(ctx, expression) {
      circle(ctx, 50, 54, 44, '#f6c76d', '#7c2d12', 3); circle(ctx, 77, 77, 18, '#ea7a18', '#7c2d12', 2); line(ctx, [[59, 77], [95, 77], [77, 59], [77, 95]], '#7c2d12', 2); circle(ctx, 36, 13, 12, '#e63946'); circle(ctx, 50, 9, 13, '#e63946'); circle(ctx, 64, 13, 12, '#e63946'); polygon(ctx, [[14, 54], [2, 47], [13, 39]], '#e63946'); polygon(ctx, [[42, 60], [61, 60], [52, 69]], '#f59e0b');
      expressionFace(ctx, expression, { eyeY: 43, mouthY: 70, iris: '#7c2d12', ink: '#7c2d12', blush: '#ef4444' });
    },
    'anime-girl'(ctx, expression) {
      oval(ctx, 50, 51, 43, 45, '#f472b6', '#831843', 3); oval(ctx, 50, 57, 31, 34, '#ffd7c2'); polygon(ctx, [[18, 39], [31, 10], [40, 33], [52, 7], [61, 34], [78, 16], [82, 43]], '#c026d3'); polygon(ctx, [[18, 12], [31, 20], [20, 29], [8, 21]], '#f9a8d4'); circle(ctx, 18, 21, 4, '#fff');
      expressionFace(ctx, expression, { left: 38, right: 62, eyeY: 55, mouthY: 73, iris: '#7c3aed', ink: '#9f1239', blush: '#fb7185' });
    },
    'anime-boy'(ctx, expression) {
      oval(ctx, 50, 55, 40, 40, '#18385e', '#0f172a', 3); oval(ctx, 50, 60, 31, 32, '#f5d0b5'); polygon(ctx, [[14, 43], [24, 7], [39, 28], [48, 3], [58, 29], [78, 8], [86, 45], [68, 33], [58, 41], [45, 30], [34, 42]], '#2563eb'); polygon(ctx, [[80, 12], [85, 25], [98, 27], [88, 35], [92, 48], [80, 40], [68, 48], [72, 35], [62, 27], [75, 25]], '#facc15');
      expressionFace(ctx, expression, { left: 38, right: 62, eyeY: 57, mouthY: 75, iris: '#0284c7', ink: '#7f1d1d', blush: '#fb7185' });
    },
    panda(ctx, expression) {
      circle(ctx, 25, 24, 17, '#111827'); circle(ctx, 75, 24, 17, '#111827'); oval(ctx, 50, 55, 43, 40, '#fff', '#111827', 3); oval(ctx, 34, 51, 13, 16, '#111827'); oval(ctx, 66, 51, 13, 16, '#111827'); oval(ctx, 50, 66, 7, 5, '#111827');
      expressionFace(ctx, expression, { left: 35, right: 65, eyeY: 51, mouthY: 77, iris: '#111827', ink: '#111827', blush: '#fb7185' });
    },
    shiba(ctx, expression) {
      polygon(ctx, [[13, 38], [18, 4], [40, 25]], '#d97706'); polygon(ctx, [[87, 38], [82, 4], [60, 25]], '#d97706'); polygon(ctx, [[19, 29], [22, 13], [34, 28]], '#fbbf8a'); polygon(ctx, [[81, 29], [78, 13], [66, 28]], '#fbbf8a'); oval(ctx, 50, 57, 43, 38, '#f59e0b', '#7c2d12', 3); oval(ctx, 50, 67, 25, 20, '#fff1d6'); oval(ctx, 50, 63, 6, 4.5, '#27150c');
      expressionFace(ctx, expression, { left: 35, right: 65, eyeY: 50, mouthY: 76, iris: '#27150c', ink: '#7c2d12', blush: '#ef4444' });
    },
    duck(ctx, expression) {
      circle(ctx, 50, 53, 43, '#fde047', '#a16207', 3); oval(ctx, 50, 68, 23, 13, '#fb923c', '#c2410c', 2); line(ctx, [[29, 26], [19, 14], [16, 30]], '#a16207', 3); line(ctx, [[71, 26], [81, 14], [84, 30]], '#a16207', 3);
      expressionFace(ctx, expression, { left: 35, right: 65, eyeY: 46, mouthY: 69, iris: '#191919', ink: '#9a3412', blush: '#fb7185' });
    }
  };

  const drawSticker = (ctx, box, options) => {
    if (options.sticker === 'custom' && options.stickerImage) {
      const sourceWidth = Number(options.stickerImage.naturalWidth || options.stickerImage.width || 1), sourceHeight = Number(options.stickerImage.naturalHeight || options.stickerImage.height || 1);
      const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight), width = sourceWidth * scale, height = sourceHeight * scale;
      ctx.drawImage(options.stickerImage, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height); return;
    }
    const painter = stickerPainters[options.sticker];
    if (!painter) return false;
    ctx.save(); ctx.translate(box.x, box.y); ctx.scale(box.width / 100, box.height / 100); painter(ctx, options.expression); ctx.restore(); return true;
  };

  const drawEmoji = (ctx, box, options) => {
    if (options.sticker && drawSticker(ctx, box, options) !== false) return;
    const size = Math.max(12, Math.round(Math.min(box.width, box.height) * 0.98));
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const emoji = options.expressionMode === 'fixed' ? options.emoji : ns.FaceExpression?.emojiFor(options.expression) || options.emoji;
    ctx.fillText(emoji, box.x + box.width / 2, box.y + box.height / 2 + size * 0.03);
  };

  const drawRedactions = (ctx, source, width, height, faces, rawOptions = {}) => {
    const options = normalizeOptions(rawOptions);
    (faces || []).filter((face) => face.enabled !== false).forEach((rawFace) => {
      const box = pixelBox(expandedBox(rawFace, options.margin), width, height);
      const detectedExpression = ns.FaceExpression?.normalize(rawFace.expressionOverride || rawFace.expression) || 'neutral';
      const expression = options.expressionMode === 'auto' ? detectedExpression : options.expressionMode === 'fixed' ? 'neutral' : ns.FaceExpression?.normalize(options.expressionMode) || 'neutral';
      const resolvedOptions = { ...options, expression };
      ctx.save(); clipShape(ctx, box, options.shape);
      if (options.style === 'mosaic') drawMosaic(ctx, source, box, options.strength, width, height);
      else if (options.style === 'blur') drawBlur(ctx, source, box, options.strength, width, height);
      else if (options.style === 'solid') { ctx.fillStyle = options.color; ctx.fillRect(box.x, box.y, box.width, box.height); }
      else drawEmoji(ctx, box, resolvedOptions);
      ctx.restore();
    });
  };

  const processImage = ({ file, faces, options, type, quality, outputSize = null, scope, signal, onStage }) => ns.ImageProcessor.processImage({
    file, type, quality, outputSize, scope, signal, onStage,
    draw: async (ctx, source, width, height) => {
      ctx.drawImage(source, 0, 0, width, height);
      drawRedactions(ctx, source, width, height, faces, options);
    }
  });

  ns.FaceRedactor = { emojiPresets, stickerPresets, normalizeBox, normalizeOptions, expandedBox, drawRedactions, processImage };
})();
