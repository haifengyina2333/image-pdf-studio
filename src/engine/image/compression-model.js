(() => {
  const ns = window.Toolbox ??= {};
  const profiles = {
    high: { label: '高清', format: 'image/jpeg', quality: 90, maxEdge: 4096, description: '默认输出 JPG，优先保留细节，仅在必要时缩小尺寸。' },
    balanced: { label: '均衡', format: 'image/jpeg', quality: 82, maxEdge: 2560, description: '默认 JPG，兼顾体积、画质与通用兼容性。' },
    strong: { label: '强力', format: 'image/jpeg', quality: 70, maxEdge: 1920, description: '默认 JPG，适合聊天软件与快速传输。' }
  };
  const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;

  const resolveType = (inputType, requested) => {
    if (requested === 'auto') return 'image/jpeg';
    return supportedTypes.has(requested) ? requested : 'image/jpeg';
  };
  const getOutputSize = (width, height, maxEdge) => {
    const edge = clamp(maxEdge, 320, 16384, Math.max(width, height));
    const scale = Math.min(1, edge / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
  };
  const fromControls = (controls) => {
    const selectedProfile = controls.compressionProfile.value;
    const preset = profiles[selectedProfile];
    const source = preset ?? { format: controls.compressionFormat.value, quality: controls.compressionQuality.value, maxEdge: controls.compressionMaxEdge.value, description: '使用自定义格式、质量和最长边。' };
    return {
      profile: selectedProfile,
      type: source.format,
      quality: clamp(source.quality, 40, 100, 82) / 100,
      maxEdge: clamp(source.maxEdge, 320, 16384, 2560),
      description: source.description
    };
  };
  const explain = ({ inputType, outputType, dimensions }) => {
    const changes = [];
    if (inputType !== outputType) changes.push(`格式转为 ${outputType.replace('image/', '').toUpperCase()}`);
    if (dimensions.scale < 1) changes.push(`最长边缩至 ${Math.max(dimensions.width, dimensions.height)}px`);
    if (!changes.length) changes.push('仅重新编码；若结果未变小，说明原文件已较优化');
    return changes.join('；');
  };
  ns.CompressionModel = { profiles, resolveType, getOutputSize, fromControls, explain };
})();
