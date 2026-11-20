(() => {
  const ns = window.Toolbox ??= {};
  class ResourceScope {
    constructor() { this.objectUrls = new Set(); this.bitmaps = new Set(); this.canvases = new Set(); this.cleanups = new Set(); this.disposed = false; }
    trackObjectURL(url) { if (this.disposed) { try { URL.revokeObjectURL(url); } catch {} } else this.objectUrls.add(url); return url; }
    trackBitmap(bitmap) { if (this.disposed) { try { bitmap.close?.(); } catch {} } else this.bitmaps.add(bitmap); return bitmap; }
    trackCanvas(canvas) { if (this.disposed) { try { canvas.width = 0; canvas.height = 0; } catch {} } else this.canvases.add(canvas); return canvas; }
    trackCleanup(fn) { if (this.disposed) { try { fn(); } catch {} } else this.cleanups.add(fn); return fn; }
    releaseIntermediate() { this.bitmaps.forEach((bitmap) => { try { bitmap.close?.(); } catch {} }); this.bitmaps.clear(); this.canvases.forEach((canvas) => { try { canvas.width = 0; canvas.height = 0; } catch {} }); this.canvases.clear(); this.cleanups.forEach((fn) => { try { fn(); } catch {} }); this.cleanups.clear(); }
    dispose() { if (this.disposed) return; this.releaseIntermediate(); this.objectUrls.forEach((url) => { try { URL.revokeObjectURL(url); } catch {} }); this.objectUrls.clear(); this.disposed = true; }
  }
  ns.ResourceScope = ResourceScope;
})();
