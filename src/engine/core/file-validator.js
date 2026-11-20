(() => {
  const ns = window.Toolbox ??= {};
  const types = new Map([['image/jpeg', 'JPG'], ['image/png', 'PNG'], ['image/webp', 'WEBP'], ['image/heic', 'HEIC'], ['image/heif', 'HEIF']]);
  const heicName = (file) => /\.(?:heic|heif)$/i.test(String(file?.name || ''));
  const isHeicFile = (file) => types.get(file?.type) === 'HEIC' || types.get(file?.type) === 'HEIF' || heicName(file);
  const validateImageFile = (file) => {
    if (!(file instanceof File)) throw new Error('没有读取到有效文件。');
    if (!types.has(file.type) && !heicName(file)) throw new Error('当前仅支持 JPG、PNG、WEBP、HEIC/HEIF 图片。');
    if (!file.size) throw new Error('该文件为空，无法处理。');
    return { name: file.name, type: file.type || (isHeicFile(file) ? 'image/heic' : ''), typeLabel: types.get(file.type) || (isHeicFile(file) ? 'HEIC' : ''), size: file.size };
  };
  ns.FileValidator = { validateImageFile, isHeicFile };
})();
