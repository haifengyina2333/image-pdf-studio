(() => {
  const ns = window.Toolbox ??= {};
  const registry = window.__TOOLBOX_COMPRESSED_ASSETS__ || {};
  const bytesCache = new Map();
  const inflight = new Map();
  const scripts = new Map();

  const entryFor = (name) => {
    const entry = registry[name];
    if (entry?.url) return entry;
    if (!entry?.data || entry.encoding !== 'gzip' || !Number.isFinite(entry.size)) throw new Error(`内嵌资源“${name}”不存在或已经损坏。`);
    return entry;
  };
  const decodeBase64 = (value) => {
    const binary = atob(value), bytes = new Uint8Array(binary.length), block = 32_768;
    for (let offset = 0; offset < binary.length; offset += block) for (let index = offset, end = Math.min(binary.length, offset + block); index < end; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  };
  const fetchBytes = async (name, entry) => {
    if (typeof fetch !== 'function') throw new Error(`当前环境不支持按需加载资源“${name}”。`);
    const response = await fetch(entry.url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`资源“${name}”加载失败（HTTP ${response.status}）。`);
    return new Uint8Array(await response.arrayBuffer());
  };
  const inflate = async (name) => {
    const entry = entryFor(name);
    if (entry.url) return fetchBytes(name, entry);
    if (typeof DecompressionStream !== 'function' || typeof Response !== 'function') throw new Error('当前浏览器版本不支持内嵌资源解压，请升级到新版 Chrome、Edge、Firefox 或 Safari。');
    const compressed = decodeBase64(entry.data);
    const source = new Response(compressed).body;
    if (!source) throw new Error(`内嵌资源“${name}”无法创建解压数据流。`);
    const stream = source.pipeThrough(new DecompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    if (bytes.byteLength !== entry.size) throw new Error(`内嵌资源“${name}”解压后长度不正确。`);
    return bytes;
  };
  const getBytes = (name) => {
    if (bytesCache.has(name)) return Promise.resolve(bytesCache.get(name));
    if (inflight.has(name)) return inflight.get(name);
    const promise = inflate(name).then((bytes) => { bytesCache.set(name, bytes); inflight.delete(name); return bytes; }, (error) => { inflight.delete(name); throw error; });
    inflight.set(name, promise); return promise;
  };
  const getText = async (name) => new TextDecoder().decode(await getBytes(name));
  const getUrl = (name) => registry[name]?.url || '';
  const release = (name) => bytesCache.delete(name);
  const loadScript = (name, ready) => {
    if (scripts.has(name)) return scripts.get(name);
    const entry = entryFor(name);
    const promise = entry.url
      ? new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = entry.url; script.async = true; script.dataset.embeddedAsset = name;
          script.onload = () => { if (typeof ready === 'function' && !ready()) reject(new Error(`按需脚本“${name}”执行后没有完成初始化。`)); else resolve(true); };
          script.onerror = () => reject(new Error(`按需脚本“${name}”加载失败，请检查网络或部署路径。`));
          (document.head || document.documentElement).append(script);
        }).catch((error) => { scripts.delete(name); throw error; })
      : getText(name).then((source) => {
          const script = document.createElement('script'); script.dataset.embeddedAsset = name; script.textContent = `${source}\n//# sourceURL=toolbox-${name}.js`; (document.head || document.documentElement).append(script); script.remove(); release(name); if (typeof ready === 'function' && !ready()) throw new Error(`内嵌脚本“${name}”执行后没有完成初始化。`); return true;
        }).catch((error) => { scripts.delete(name); throw error; });
    scripts.set(name, promise); return promise;
  };
  const has = (name) => Boolean(registry[name]?.data || registry[name]?.url);
  const facts = () => Object.fromEntries(Object.entries(registry).map(([name, entry]) => [name, { size: entry.size, compressedSize: entry.compressedSize ?? entry.size, ...(entry.url ? { url: entry.url } : {}) }]));

  ns.EmbeddedAssets = { has, getBytes, getText, getUrl, loadScript, release, facts };
})();
