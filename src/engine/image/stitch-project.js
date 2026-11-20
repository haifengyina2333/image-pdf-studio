(() => {
  const ns = window.Toolbox ??= {};
  const FORMAT = 'image-pdf-toolbox-stitch-project'; const VERSION = 1; const MAX_PROJECT_BYTES = 500 * 1024 * 1024; const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
  const extensionFor = (file) => { const fromName = String(file.name || '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase(); if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName; return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/heic' ? 'heic' : file.type === 'image/heif' ? 'heif' : 'jpg'; };
  const validateManifest = (manifest) => {
    if (!manifest || manifest.format !== FORMAT || manifest.version !== VERSION) throw new Error('这不是受支持的拼图工程文件。');
    if (!Array.isArray(manifest.assets) || !manifest.assets.length || manifest.assets.length > 100) throw new Error('工程文件中的图片数量无效。');
    const paths = new Set(); manifest.assets.forEach((asset) => { if (!asset || typeof asset.path !== 'string' || !asset.path.startsWith('images/') || paths.has(asset.path)) throw new Error('工程文件的图片索引无效。'); if (typeof asset.name !== 'string' || !asset.name || !imageTypes.has(asset.type)) throw new Error('工程文件包含不支持的图片。'); paths.add(asset.path); });
    return manifest;
  };
  const create = async (entries, settings, options = {}) => {
    if (!entries.length) throw new Error('请先导入至少一张图片。'); if (entries.length > 100) throw new Error('工程文件最多保存 100 张图片。');
    const assets = entries.map((entry, index) => { const file = entry.image?.sourceFile ?? entry.image?.file ?? entry.file ?? entry; const path = `images/${String(index + 1).padStart(3, '0')}.${extensionFor(file)}`; return { path, name: file.name || `图片-${index + 1}.${extensionFor(file)}`, type: imageTypes.has(file.type) ? file.type : /\.(?:heic|heif)$/i.test(file.name || '') ? 'image/heic' : 'image/jpeg', size: file.size, lastModified: file.lastModified || Date.now(), file }; });
    if (assets.reduce((total, asset) => total + asset.size, 0) > MAX_PROJECT_BYTES) throw new Error('工程原图合计超过 500MB，请减少图片数量后再保存。');
    const manifest = { format: FORMAT, version: VERSION, savedAt: new Date().toISOString(), settings: ns.ImageStitcher.normalizeOptions(settings), assets: assets.map(({ file, ...asset }) => asset) };
    const files = [{ name: 'project.json', blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }) }, ...assets.map((asset) => ({ name: asset.path, blob: asset.file }))]; return ns.ZipArchive.createZip(files, options);
  };
  const read = async (file, options = {}) => {
    const entries = await ns.ZipArchive.readZip(file, { ...options, maxFiles: 110, maxTotalBytes: MAX_PROJECT_BYTES }); const map = new Map(entries.map((entry) => [entry.name, entry])); const manifestEntry = map.get('project.json'); if (!manifestEntry) throw new Error('工程文件缺少 project.json。');
    let manifest; try { manifest = JSON.parse(await manifestEntry.blob.text()); } catch { throw new Error('工程文件的设置数据已损坏。'); } validateManifest(manifest);
    const assets = manifest.assets.map((asset) => { const entry = map.get(asset.path); if (!entry) throw new Error(`工程文件缺少图片：${asset.name}`); return { ...asset, blob: new Blob([entry.blob], { type: asset.type }) }; });
    return { settings: ns.ImageStitcher.normalizeOptions(manifest.settings), assets, savedAt: manifest.savedAt };
  };
  ns.StitchProject = { FORMAT, VERSION, MAX_PROJECT_BYTES, validateManifest, create, read };
})();
