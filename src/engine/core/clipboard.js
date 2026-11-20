(() => {
  const ns = window.Toolbox ??= {};

  const clipboardError = (code, message, cause) => {
    const error = new Error(message);
    error.code = code;
    error.cause = cause;
    return error;
  };

  const copyPng = async (blob) => {
    if (!(blob instanceof Blob) || blob.type !== 'image/png') {
      throw clipboardError('invalid-image', '复制结果必须是 PNG 图片。');
    }
    if (!globalThis.isSecureContext) {
      throw clipboardError('insecure-context', '当前页面不是安全环境，浏览器不允许写入剪贴板。请使用下载功能。');
    }
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw clipboardError('unsupported', '当前浏览器不支持复制图片到剪贴板。请使用下载功能。');
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (cause) {
      if (cause?.name === 'NotAllowedError') {
        throw clipboardError('permission-denied', '浏览器拒绝了剪贴板权限。请允许权限后重试，或使用下载功能。', cause);
      }
      throw clipboardError('write-failed', '图片未能复制到剪贴板。请使用下载功能。', cause);
    }
  };

  const copyPngPromise = async (blobPromise) => {
    if (!globalThis.isSecureContext) throw clipboardError('insecure-context', '当前页面不是安全环境，浏览器不允许写入剪贴板。请使用下载功能。');
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw clipboardError('unsupported', '当前浏览器不支持复制图片到剪贴板。请使用下载功能。');
    const pngPromise = Promise.resolve(blobPromise).then((blob) => {
      if (!(blob instanceof Blob) || blob.type !== 'image/png') throw clipboardError('invalid-image', '复制结果必须是 PNG 图片。');
      return blob;
    });
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngPromise })]); }
    catch (cause) {
      if (cause?.code) throw cause;
      if (cause?.name === 'NotAllowedError') throw clipboardError('permission-denied', '浏览器拒绝了剪贴板权限。请允许权限后重试，或使用下载功能。', cause);
      throw clipboardError('write-failed', '图片未能复制到剪贴板。请使用下载功能。', cause);
    }
  };

  ns.Clipboard = { copyPng, copyPngPromise };
})();
