(() => {
  const ns = window.Toolbox ??= {};
  const MAX_FILES = 20;
  const MAX_FILE_BYTES = 500 * 1024 * 1024;
  const WARNING_FILE_BYTES = 100 * 1024 * 1024;
  const HEADER_BYTES = 1024;
  let sessionSequence = 0;
  let workerUrl = '';

  const abortError = () => new DOMException('任务已取消。', 'AbortError');
  const assertNotAborted = (signal) => { if (signal?.aborted) throw abortError(); };
  const fileSize = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 2)} MB`;
  const pageNumber = (value, total) => { const number = Math.round(Number(value)); return Number.isFinite(number) ? Math.max(1, Math.min(total, number)) : 1; };
  const pdfName = (file) => /\.pdf$/i.test(String(file?.name || ''));
  const headerText = async (file) => {
    const bytes = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()); let text = '';
    for (const byte of bytes) text += String.fromCharCode(byte);
    return text;
  };
  const validateFile = async (file) => {
    if (!file || typeof file.slice !== 'function' || typeof file.arrayBuffer !== 'function') throw new Error('没有读取到有效的 PDF 文件。');
    if (!file.size) throw new Error(`“${file.name || '未命名文件'}”为空文件，无法读取。`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`“${file.name}”超过 500MB，当前浏览器版本不允许直接载入。`);
    if (file.type && file.type !== 'application/pdf' && !pdfName(file)) throw new Error(`“${file.name}”不是 PDF 文件。`);
    if (!(await headerText(file)).includes('%PDF-')) throw new Error(`“${file.name}”缺少有效的 PDF 文件头，可能已损坏或扩展名不正确。`);
    return { name: file.name || '未命名.pdf', size: file.size, type: 'application/pdf', warning: file.size >= WARNING_FILE_BYTES ? `文件为 ${fileSize(file.size)}，页面预览将按需逐页加载。` : '' };
  };
  const normalizeError = (error, fileName = '该 PDF') => {
    if (error?.name === 'AbortError') return error;
    const name = error?.name || '', message = String(error?.message || '');
    if (/Password/i.test(name) || /password/i.test(message)) return new Error(`${fileName} 的密码不正确或已取消解锁。`);
    if (/InvalidPDF|FormatError/i.test(name) || /invalid pdf|bad xref|invalid xref/i.test(message)) return new Error(`${fileName} 的 PDF 结构无效或已经损坏。`);
    if (/MissingPDF|UnexpectedResponse/i.test(name)) return new Error(`${fileName} 无法读取，请确认文件完整。`);
    return new Error(error?.message || `${fileName} 读取失败。`);
  };
  const ensureAdapter = (adapter) => {
    if (!adapter?.getDocument) throw new Error('PDF Runtime 尚未完成初始化，请刷新页面后重试。');
    return adapter;
  };
  const ensureWorker = async (adapter) => {
    if (!adapter?.GlobalWorkerOptions || adapter.GlobalWorkerOptions.workerSrc) return;
    if (!ns.EmbeddedAssets?.has('pdfWorker')) throw new Error('PDF Worker 内嵌资源不存在，请重新下载工具。');
    const directUrl = ns.EmbeddedAssets.getUrl?.('pdfWorker');
    if (directUrl) { adapter.GlobalWorkerOptions.workerSrc = directUrl; return; }
    const source = await ns.EmbeddedAssets.getText('pdfWorker');
    workerUrl ||= URL.createObjectURL(new Blob([source], { type: 'text/javascript' })); adapter.GlobalWorkerOptions.workerSrc = workerUrl; ns.EmbeddedAssets.release('pdfWorker');
  };
  const metadataFrom = async (document) => {
    try {
      const result = await document.getMetadata(); const info = result?.info || {};
      return { title: String(info.Title || '').trim(), author: String(info.Author || '').trim(), subject: String(info.Subject || '').trim(), creator: String(info.Creator || '').trim(), producer: String(info.Producer || '').trim(), creationDate: String(info.CreationDate || '').trim(), modificationDate: String(info.ModDate || '').trim(), tagged: Boolean(info.IsTagged) };
    } catch { return { title: '', author: '', subject: '', creator: '', producer: '', creationDate: '', modificationDate: '', tagged: false }; }
  };

  class PDFSession {
    constructor(file, document, loadingTask, metadata, passwordProtected = false) { this.id = `pdf_${Date.now()}_${++sessionSequence}`; this.file = file; this.document = document; this.loadingTask = loadingTask; this.metadata = metadata; this.numPages = document.numPages; this.passwordProtected = passwordProtected; this.disposed = false; this.renderTasks = new Set(); }
    assertOpen() { if (this.disposed) throw new Error('该 PDF 已关闭，请重新导入。'); }
    async getPageInfo(number, signal, extraRotation = 0) {
      this.assertOpen(); assertNotAborted(signal); const selected = pageNumber(number, this.numPages); const page = await this.document.getPage(selected);
      try { assertNotAborted(signal); const rotation = (((Number(page.rotate || 0) + Number(extraRotation || 0)) % 360) + 360) % 360; const viewport = page.getViewport({ scale: 1, rotation }); return { pageNumber: selected, width: viewport.width, height: viewport.height, rotation, widthMm: viewport.width * 25.4 / 72, heightMm: viewport.height * 25.4 / 72 }; }
      finally { try { page.cleanup?.(true); } catch {} }
    }
    async renderPage(number, canvas, { maxWidth = 1400, maxHeight = 1800, outputScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1)), background = '#ffffff', intent = 'display', signal, extraRotation = 0 } = {}) {
      this.assertOpen(); assertNotAborted(signal); const selected = pageNumber(number, this.numPages); const page = await this.document.getPage(selected); let task;
      try {
        assertNotAborted(signal); const rotation = (((Number(page.rotate || 0) + Number(extraRotation || 0)) % 360) + 360) % 360; const base = page.getViewport({ scale: 1, rotation }); const fit = Math.min(maxWidth / base.width, maxHeight / base.height); const viewport = page.getViewport({ scale: fit * outputScale, rotation }); const cssWidth = Math.max(1, Math.round(viewport.width / outputScale)), cssHeight = Math.max(1, Math.round(viewport.height / outputScale)); canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height)); canvas.style.width = `${cssWidth}px`; canvas.style.height = `${cssHeight}px`; const context = canvas.getContext('2d', { alpha: false }); context.save?.(); context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); context.restore?.();
        task = page.render({ canvasContext: context, viewport, background, intent }); this.renderTasks.add(task); const cancel = () => { try { task.cancel?.(); } catch {} }; signal?.addEventListener('abort', cancel, { once: true });
        try { await task.promise; } finally { signal?.removeEventListener('abort', cancel); this.renderTasks.delete(task); }
        assertNotAborted(signal); return { pageNumber: selected, width: base.width, height: base.height, rotation, renderedWidth: canvas.width, renderedHeight: canvas.height, cssWidth, cssHeight };
      } catch (error) { if (signal?.aborted || /RenderingCancelled/i.test(error?.name || '')) throw abortError(); throw normalizeError(error, this.file.name); }
      finally { if (task) this.renderTasks.delete(task); try { page.cleanup?.(true); } catch {} }
    }
    async dispose() {
      if (this.disposed) return; this.disposed = true; this.renderTasks.forEach((task) => { try { task.cancel?.(); } catch {} }); this.renderTasks.clear();
      try { await this.loadingTask?.destroy?.(); } catch {} try { await this.document?.destroy?.(); } catch {} this.document = null; this.loadingTask = null;
    }
  }

  class PDFRuntimeManager {
    constructor(adapter = window.ToolboxPDFJS) {
      if (!adapter && ns.EmbeddedAssets?.has('pdfjs')) { this.adapter = null; this.usesEmbeddedAdapter = true; }
      else { this.adapter = ensureAdapter(adapter); this.usesEmbeddedAdapter = adapter === window.ToolboxPDFJS; }
      this.sessions = [];
    }
    get totalBytes() { return this.sessions.reduce((sum, session) => sum + session.file.size, 0); }
    get(id) { return this.sessions.find((session) => session.id === id) || null; }
    async open(file, { signal, onProgress, onPassword } = {}) {
      if (this.sessions.length >= MAX_FILES) throw new Error(`一次最多打开 ${MAX_FILES} 个 PDF，请先移除部分文件。`);
      const facts = await validateFile(file); assertNotAborted(signal);
      if (!this.adapter && ns.EmbeddedAssets?.has('pdfjs')) { await ns.EmbeddedAssets.loadScript('pdfjs', () => Boolean(window.ToolboxPDFJS)); this.adapter = ensureAdapter(window.ToolboxPDFJS); assertNotAborted(signal); }
      if (this.usesEmbeddedAdapter) await ensureWorker(this.adapter); assertNotAborted(signal); const bytes = new Uint8Array(await file.arrayBuffer()); assertNotAborted(signal); let passwordRequired = false, passwordCancelled = false; const loadingTask = this.adapter.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true, stopAtErrors: false });
      loadingTask.onProgress = ({ loaded = 0, total = file.size } = {}) => onProgress?.(loaded, total || file.size);
      loadingTask.onPassword = async (updatePassword, reason) => {
        passwordRequired = true;
        try {
          if (typeof onPassword !== 'function') throw new Error('未提供密码。');
          const password = await onPassword({ file, reason, incorrect: reason === 2 });
          if (password == null || password === '') { passwordCancelled = true; try { await loadingTask.destroy?.(); } catch {} return; }
          updatePassword(String(password));
        } catch { passwordCancelled = true; try { await loadingTask.destroy?.(); } catch {} }
      };
      const abort = () => { try { loadingTask.destroy?.(); } catch {} }; signal?.addEventListener('abort', abort, { once: true });
      try {
        const document = await loadingTask.promise; assertNotAborted(signal); if (!document?.numPages) throw new Error('PDF 中没有可读取的页面。'); const metadata = await metadataFrom(document); assertNotAborted(signal); const session = new PDFSession(file, document, loadingTask, metadata, passwordRequired); session.warning = facts.warning || (passwordRequired ? '已解锁阅读。加密 PDF 不参与结构编辑，可转图片或重建为图像型 PDF。' : ''); this.sessions.push(session); return session;
      } catch (error) { try { await loadingTask.destroy?.(); } catch {} if (signal?.aborted) throw abortError(); if (passwordCancelled) throw new Error(`${file.name} 已取消解锁。`); throw normalizeError(error, file.name); }
      finally { signal?.removeEventListener('abort', abort); }
    }
    async remove(id) { const index = this.sessions.findIndex((session) => session.id === id); if (index < 0) return false; const [session] = this.sessions.splice(index, 1); await session.dispose(); return true; }
    async clear() { const sessions = this.sessions.splice(0); await Promise.all(sessions.map((session) => session.dispose())); }
  }

  window.addEventListener('pagehide', () => { if (workerUrl) { try { URL.revokeObjectURL(workerUrl); } catch {} workerUrl = ''; } }, { once: true });
  ns.PDFRuntime = { MAX_FILES, MAX_FILE_BYTES, WARNING_FILE_BYTES, validateFile, normalizeError, pageNumber, fileSize, PDFSession, PDFRuntimeManager };
})();
