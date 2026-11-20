(() => {
  const ns = window.Toolbox ??= {};
  const DB_NAME = 'watermark-studio'; const DB_VERSION = 1; const PRESETS = 'presets'; const META = 'meta'; const RECENT_KEY = 'recent-snapshot'; const MAX_LOGO_BYTES = 2 * 1024 * 1024;
  const requestValue = (request) => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error('本地预设读取失败。')); });
  const finish = (transaction) => new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error ?? new Error('本地预设写入失败。')); transaction.onabort = () => reject(transaction.error ?? new Error('本地预设写入被中止。')); });
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const assertLogoSize = (blob) => {
    if (blob?.size > MAX_LOGO_BYTES) throw new Error('水印预设的 Logo 不能超过 2 MiB，请压缩 Logo 后重试。');
  };
  const logoToDataUrl = async (logo) => {
    if (!logo?.blob) return null;
    const bytes = new Uint8Array(await logo.blob.arrayBuffer()); let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return `data:${logo.blob.type};base64,${btoa(binary)}`;
  };
  const logoFromDataUrl = (logo) => {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(logo?.dataUrl ?? '');
    if (!match) return null;
    const binary = atob(match[2]); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)); const blob = new Blob([bytes], { type: match[1].toLowerCase() });
    assertLogoSize(blob);
    return { name: String(logo.name ?? 'watermark-logo').slice(0, 180), type: blob.type, blob };
  };
  const normalizeSnapshot = (value) => {
    if (!value || typeof value !== 'object' || !value.watermark || !value.output) throw new Error('预设内容不完整，无法读取。');
    const { watermark, output } = value; const position = watermark.position;
    if (!position || !Number.isFinite(Number(position.xRatio)) || !Number.isFinite(Number(position.yRatio))) throw new Error('预设位置数据无效。');
    const logo = value.logo && value.logo.blob instanceof Blob && value.logo.blob.size <= MAX_LOGO_BYTES ? { name: String(value.logo.name ?? 'watermark-logo').slice(0, 180), type: String(value.logo.type ?? value.logo.blob.type), blob: value.logo.blob } : null;
    const normalized = { schemaVersion: 1, watermark: { kind: watermark.kind === 'image' ? 'image' : 'text', text: String(watermark.text ?? '').slice(0, 1200), font: String(watermark.font ?? 'Arial, sans-serif'), weight: String(watermark.weight ?? '600'), color: String(watermark.color ?? '#ffffff'), size: Math.max(2, Math.min(30, finite(watermark.size, 7))), opacity: Math.max(10, Math.min(100, finite(watermark.opacity, 72))), rotation: Math.max(-180, Math.min(180, finite(watermark.rotation))), tile: Boolean(watermark.tile), density: Math.max(20, Math.min(100, finite(watermark.density, 60))), offsetX: Math.max(-50, Math.min(50, finite(watermark.offsetX))), offsetY: Math.max(-50, Math.min(50, finite(watermark.offsetY))), position: { xRatio: Math.max(0, Math.min(1, finite(position.xRatio))), yRatio: Math.max(0, Math.min(1, finite(position.yRatio))) } }, output: { format: ['image/jpeg', 'image/png', 'image/webp'].includes(output.format) ? output.format : 'image/jpeg', quality: Math.max(40, Math.min(100, finite(output.quality, 92))) }, logo };
    return globalThis.structuredClone ? structuredClone(normalized) : normalized;
  };
  const importDocument = (payload) => {
    if (!payload || payload.kind !== 'image-pdf-toolbox-watermark-presets' || !Array.isArray(payload.presets)) throw new Error('这不是有效的水印预设文件。');
    if (payload.version !== 1) throw new Error('该预设文件版本暂不支持。');
    return payload.presets;
  };
  class WatermarkStore {
    constructor() { this.dbPromise = null; }
    open() { if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器不支持本地预设存储。')); if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(PRESETS)) db.createObjectStore(PRESETS, { keyPath: 'id' }); if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error('无法打开本地预设数据库。')); }); return this.dbPromise; }
    async listPresets() { const db = await this.open(); const tx = db.transaction(PRESETS, 'readonly'); const records = await requestValue(tx.objectStore(PRESETS).getAll()); return records.sort((a, b) => b.updatedAt - a.updatedAt).map((record) => ({ ...record, snapshot: normalizeSnapshot(record.snapshot) })); }
    async savePreset(name, snapshot, id = null) { const cleanName = String(name ?? '').trim().slice(0, 60); if (!cleanName) throw new Error('请先填写预设名称。'); assertLogoSize(snapshot?.logo?.blob); const cleanSnapshot = normalizeSnapshot(snapshot); if (cleanSnapshot.watermark.kind === 'image' && !cleanSnapshot.logo?.blob.size) throw new Error('请先上传 Logo 水印，再保存预设。'); const db = await this.open(); const tx = db.transaction(PRESETS, 'readwrite'); const store = tx.objectStore(PRESETS); const all = await requestValue(store.getAll()); if (all.some((record) => record.name === cleanName && record.id !== id)) throw new Error('已有同名预设，请换一个名称。'); const existing = id ? await requestValue(store.get(id)) : null; if (id && !existing) throw new Error('预设不存在，可能已被删除。'); const now = Date.now(); const record = { id: id ?? crypto.randomUUID(), name: cleanName, snapshot: cleanSnapshot, createdAt: existing?.createdAt ?? now, updatedAt: now }; store.put(record); await finish(tx); return record; }
    async deletePreset(id) { const db = await this.open(); const tx = db.transaction(PRESETS, 'readwrite'); tx.objectStore(PRESETS).delete(id); await finish(tx); }
    async saveRecent(snapshot) { const db = await this.open(); const tx = db.transaction(META, 'readwrite'); tx.objectStore(META).put({ key: RECENT_KEY, snapshot: normalizeSnapshot(snapshot), updatedAt: Date.now() }); await finish(tx); }
    async loadRecent() { const db = await this.open(); const tx = db.transaction(META, 'readonly'); const record = await requestValue(tx.objectStore(META).get(RECENT_KEY)); return record?.snapshot ? normalizeSnapshot(record.snapshot) : null; }
    async exportPresets() { const presets = []; for (const preset of await this.listPresets()) { const snapshot = { ...preset.snapshot, watermark: { ...preset.snapshot.watermark }, output: { ...preset.snapshot.output }, logo: preset.snapshot.logo ? { name: preset.snapshot.logo.name, type: preset.snapshot.logo.type, dataUrl: await logoToDataUrl(preset.snapshot.logo) } : null }; presets.push({ name: preset.name, snapshot }); } return JSON.stringify({ kind: 'image-pdf-toolbox-watermark-presets', version: 1, exportedAt: new Date().toISOString(), presets }, null, 2); }
    async importPresets(json) { let payload; try { payload = JSON.parse(json); } catch { throw new Error('预设文件不是有效的 JSON。'); } const incoming = importDocument(payload).slice(0, 100).map((record) => { const snapshot = { ...record.snapshot, logo: logoFromDataUrl(record.snapshot?.logo) ?? record.snapshot?.logo }; return { name: String(record.name ?? '').trim().slice(0, 60), snapshot: normalizeSnapshot(snapshot) }; }); if (incoming.some((record) => !record.name)) throw new Error('预设文件中存在缺少名称的条目。'); const db = await this.open(); const tx = db.transaction(PRESETS, 'readwrite'); const store = tx.objectStore(PRESETS); const names = new Set((await requestValue(store.getAll())).map((record) => record.name)); const now = Date.now(); for (const incomingRecord of incoming) { let name = incomingRecord.name; let suffix = 2; while (names.has(name)) name = `${incomingRecord.name} (${suffix++})`; names.add(name); store.add({ id: crypto.randomUUID(), name, snapshot: incomingRecord.snapshot, createdAt: now, updatedAt: now }); } await finish(tx); return incoming.length; }
  }
  ns.WatermarkStore = { WatermarkStore, normalizeSnapshot, importDocument, MAX_LOGO_BYTES };
})();
