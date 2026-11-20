(() => {
  const ns = window.Toolbox ??= {};
  const assertNotAborted = (signal) => { if (signal?.aborted) throw new DOMException('任务已取消', 'AbortError'); };
  const normalizeFile = async (file, signal) => {
    assertNotAborted(signal); if (!ns.FileValidator.isHeicFile(file)) return file;
    if (typeof window.heic2any !== 'function') await ns.EmbeddedAssets?.loadScript('heic2any', () => typeof window.heic2any === 'function');
    assertNotAborted(signal);
    if (typeof window.heic2any !== 'function') throw new Error('HEIC 解码组件未能加载，请重新打开工具后再试。');
    let result; try { result = await window.heic2any({ blob: file, toType: 'image/png', quality: 1 }); } catch (error) { throw new Error(`HEIC 图片解码失败：${error?.message || '文件可能已损坏或不是受支持的 HEIC/HEIF。'}`); }
    assertNotAborted(signal); const blob = Array.isArray(result) ? result[0] : result; if (!(blob instanceof Blob) || !blob.size) throw new Error('HEIC 图片没有可读取的主画面。');
    const name = String(file.name || 'HEIC图片.heic').replace(/\.(?:heic|heif)$/i, '') + '.png'; return new File([blob], name, { type: 'image/png', lastModified: file.lastModified || Date.now() });
  };
  const decodeBitmap = async (file, scope, signal) => { assertNotAborted(signal); const bitmap = scope.trackBitmap(await createImageBitmap(file)); assertNotAborted(signal); return bitmap; };
  const createPreview = async (source, policy, scope, signal) => {
    assertNotAborted(signal);
    const { width, height, scale } = ns.WorkloadPolicy.getPreviewSize(source.width, source.height, policy);
    const preview = document.createElement('canvas'); scope.trackCanvas(preview); preview.width = width; preview.height = height;
    preview.getContext('2d', { alpha: true }).drawImage(source, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => preview.toBlob((result) => result ? resolve(result) : reject(new Error('无法生成预览图。')), 'image/png'));
    assertNotAborted(signal); const url = scope.trackObjectURL(URL.createObjectURL(blob));
    const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error('预览图加载失败。')); element.src = url; });
    return { image, width, height, scale };
  };
  ns.ImageDecoder = { normalizeFile, decodeBitmap, createPreview, assertNotAborted };
})();
