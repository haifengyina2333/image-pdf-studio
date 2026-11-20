(() => {
  const ns = window.Toolbox ??= {};
  const MAX_TILE_DRAWS = 1500;
  const linesForText = (ctx, text, maxWidth) => {
    const lines = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = '';
      for (const char of paragraph || ' ') {
        const next = line + char;
        if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = char; } else line = next;
      }
      lines.push(line);
    }
    return lines;
  };
  const metric = (ctx, width, height, options) => {
    const side = Math.max(13, Math.min(width, height) * options.sizeRatio);
    if (options.kind === 'image' && options.logo) return { width: side, height: side * options.logo.height / options.logo.width, font: side, lines: [] };
    ctx.font = `${options.weight} ${side}px ${options.font}`;
    const lines = linesForText(ctx, options.text, Math.max(side * 2, Math.min(width * .88, side * 16)));
    return { width: Math.max(...lines.map((line) => ctx.measureText(line).width), side), height: side * lines.length * 1.22, font: side, lines };
  };
  const drawMark = (ctx, data, options, x, y, alpha = 1) => {
    ctx.save(); ctx.globalAlpha = options.opacity * alpha; ctx.translate(x, y); ctx.rotate(options.rotation * Math.PI / 180);
    if (options.kind === 'image' && options.logo) ctx.drawImage(options.logo, -data.width / 2, -data.height / 2, data.width, data.height);
    else { ctx.fillStyle = options.color; ctx.font = `${options.weight} ${data.font}px ${options.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const step = data.font * 1.22; const start = -((data.lines.length - 1) * step) / 2; data.lines.forEach((line, index) => ctx.fillText(line, 0, start + index * step)); }
    ctx.restore();
  };
  const renderWatermark = (ctx, width, height, options) => {
    if (options.kind === 'image' && !options.logo) return { tileDraws: 0 };
    const data = metric(ctx, width, height, options);
    if (!options.tile) { drawMark(ctx, data, options, width * options.position.xRatio, height * options.position.yRatio); return { tileDraws: 1 }; }
    let gap = Math.max(Math.max(data.width, data.height) * 1.04, Math.max(data.width, data.height) * (2.8 - 1.8 * options.density));
    let columns = Math.ceil(width / gap) + 3; let rows = Math.ceil(height / gap) + 3;
    if (columns * rows > MAX_TILE_DRAWS) { gap *= Math.sqrt((columns * rows) / MAX_TILE_DRAWS); columns = Math.ceil(width / gap) + 3; rows = Math.ceil(height / gap) + 3; }
    const startX = -gap + options.offsetXRatio * gap; const startY = -gap + options.offsetYRatio * gap;
    let tileDraws = 0;
    for (let row = 0, y = startY; row < rows; row += 1, y += gap) for (let column = 0, x = startX; column < columns; column += 1, x += gap) { drawMark(ctx, data, options, x + (row % 2 ? gap / 2 : 0), y, .8); tileDraws += 1; }
    return { tileDraws };
  };
  ns.WatermarkRenderer = { renderWatermark };
})();
