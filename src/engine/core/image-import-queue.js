(() => {
  const ns = window.Toolbox ??= {};
  let sequence = 0;

  class ImageImportQueue {
    constructor({ concurrency = 2, onChange = () => {}, onReady = () => {} } = {}) {
      this.concurrency = concurrency;
      this.onChange = onChange;
      this.onReady = onReady;
      this.entries = [];
      this.running = 0;
    }
    add(files) {
      const entries = [...files].map((file) => ({ id: `image_${Date.now()}_${++sequence}`, file, status: 'waiting', error: null, abortController: new AbortController(), scope: null, image: null }));
      this.entries.push(...entries); this.emit(); this.pump(); return entries;
    }
    remove(id) {
      const entry = this.entries.find((item) => item.id === id); if (!entry) return;
      entry.abortController.abort(); entry.scope?.dispose(); this.entries = this.entries.filter((item) => item.id !== id); this.emit(); this.pump();
    }
    swap(firstId, secondId) {
      const first = this.entries.findIndex((entry) => entry.id === firstId), second = this.entries.findIndex((entry) => entry.id === secondId);
      if (first < 0 || second < 0 || first === second) return;
      [this.entries[first], this.entries[second]] = [this.entries[second], this.entries[first]]; this.emit();
    }
    clear() { this.entries.forEach((entry) => { entry.abortController.abort(); entry.scope?.dispose(); }); this.entries = []; this.emit(); }
    get(id) { return this.entries.find((entry) => entry.id === id) ?? null; }
    ready() { return this.entries.filter((entry) => entry.status === 'ready'); }
    pendingCount() { return this.entries.filter((entry) => entry.status === 'waiting' || entry.status === 'decoding').length; }
    async pump() {
      while (this.running < this.concurrency) {
        const entry = this.entries.find((item) => item.status === 'waiting'); if (!entry) break;
        this.process(entry);
      }
    }
    async process(entry) {
      this.running += 1; entry.status = 'decoding'; this.emit();
      const scope = entry.scope = new ns.ResourceScope();
      try {
        ns.FileValidator.validateImageFile(entry.file);
        const workingFile = await ns.ImageDecoder.normalizeFile(entry.file, entry.abortController.signal);
        const bitmap = await ns.ImageDecoder.decodeBitmap(workingFile, scope, entry.abortController.signal);
        const dimensions = { width: bitmap.width, height: bitmap.height };
        const policy = ns.WorkloadPolicy.getPolicy({ ...dimensions, fileSize: entry.file.size });
        const preview = await ns.ImageDecoder.createPreview(bitmap, policy, scope, entry.abortController.signal);
        scope.releaseIntermediate();
        if (!this.get(entry.id) || entry.abortController.signal.aborted) return;
        entry.image = { file: workingFile, sourceFile: entry.file, dimensions, preview, policy }; entry.status = 'ready'; this.onReady(entry);
      } catch (error) {
        if (!this.get(entry.id)) return;
        entry.status = error.name === 'AbortError' ? 'cancelled' : 'failed'; entry.error = error; scope.dispose();
      } finally { this.running -= 1; this.emit(); this.pump(); }
    }
    emit() { this.onChange([...this.entries]); }
  }
  ns.ImageImportQueue = ImageImportQueue;
})();
