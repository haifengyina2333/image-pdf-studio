(() => {
  const ns = window.Toolbox ??= {};
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) { let value = index; for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1; table[index] = value >>> 0; }
    return table;
  })();
  const updateCrc = (value, bytes) => { for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff]; return value; };
  const crc32 = (bytes) => (updateCrc(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
  const abortIfNeeded = (signal) => { if (signal?.aborted) throw new DOMException('任务已取消', 'AbortError'); };
  const crcForBlob = async (blob, signal) => {
    let value = 0xffffffff;
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      abortIfNeeded(signal);
      const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
      abortIfNeeded(signal);
      value = updateCrc(value, bytes);
    }
    return (value ^ 0xffffffff) >>> 0;
  };
  const u16 = (view, offset, value) => view.setUint16(offset, value, true);
  const u32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
  const dosTime = (date) => ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff;
  const dosDate = (date) => (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  const createZip = async (files, { signal, onProgress } = {}) => {
    abortIfNeeded(signal);
    if (files.length >= 0xffff) throw new Error('文件数量超过普通 ZIP 格式上限。');
    const entries = []; const now = new Date(); let localSize = 0;
    for (let index = 0; index < files.length; index += 1) {
      abortIfNeeded(signal);
      const { name: filename, blob } = files[index]; const name = encoder.encode(filename);
      if (name.length > 0xffff || localSize + 30 + name.length + blob.size >= 0xffffffff) throw new Error('文件大小或名称超过普通 ZIP 格式上限。');
      const crc = await crcForBlob(blob, signal); const local = new Uint8Array(30 + name.length); const view = new DataView(local.buffer);
      u32(view, 0, 0x04034b50); u16(view, 4, 20); u16(view, 6, 0x0800); u16(view, 8, 0); u16(view, 10, dosTime(now)); u16(view, 12, dosDate(now)); u32(view, 14, crc); u32(view, 18, blob.size); u32(view, 22, blob.size); u16(view, 26, name.length); u16(view, 28, 0); local.set(name, 30);
      entries.push({ name, blob, crc, local, offset: localSize }); localSize += local.length + blob.size; onProgress?.(index + 1, files.length);
    }
    abortIfNeeded(signal);
    const centralParts = []; let centralSize = 0;
    for (const entry of entries) { const central = new Uint8Array(46 + entry.name.length); const view = new DataView(central.buffer); u32(view, 0, 0x02014b50); u16(view, 4, 20); u16(view, 6, 20); u16(view, 8, 0x0800); u16(view, 10, 0); u16(view, 12, dosTime(now)); u16(view, 14, dosDate(now)); u32(view, 16, entry.crc); u32(view, 20, entry.blob.size); u32(view, 24, entry.blob.size); u16(view, 28, entry.name.length); u16(view, 30, 0); u16(view, 32, 0); u16(view, 34, 0); u16(view, 36, 0); u32(view, 38, 0); u32(view, 42, entry.offset); central.set(entry.name, 46); centralParts.push(central); centralSize += central.length; }
    if (localSize + centralSize + 22 >= 0xffffffff) throw new Error('文件大小超过普通 ZIP 格式上限。');
    const ending = new Uint8Array(22); const end = new DataView(ending.buffer); u32(end, 0, 0x06054b50); u16(end, 4, 0); u16(end, 6, 0); u16(end, 8, entries.length); u16(end, 10, entries.length); u32(end, 12, centralSize); u32(end, 16, localSize); u16(end, 20, 0);
    const parts = []; for (const entry of entries) parts.push(entry.local, entry.blob); for (const central of centralParts) parts.push(central); parts.push(ending); return new Blob(parts, { type: 'application/zip' });
  };
  const safeEntryName = (name) => {
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new Error('工程文件包含不安全的路径。');
    return name;
  };
  const readZip = async (blob, { maxFiles = 200, maxTotalBytes = 600 * 1024 * 1024, signal } = {}) => {
    if (!blob || blob.size > maxTotalBytes + 16 * 1024 * 1024) throw new Error('工程文件过大，无法安全打开。');
    const bytes = new Uint8Array(await blob.arrayBuffer()); const entries = []; const names = new Set(); let offset = 0; let total = 0;
    while (offset + 4 <= bytes.length) {
      if (signal?.aborted) throw new DOMException('任务已取消', 'AbortError');
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset); const signature = view.getUint32(0, true);
      if (signature === 0x02014b50 || signature === 0x06054b50) break;
      if (signature !== 0x04034b50 || offset + 30 > bytes.length) throw new Error('工程文件结构损坏。');
      const flags = view.getUint16(6, true), method = view.getUint16(8, true), expectedCrc = view.getUint32(14, true), compressedSize = view.getUint32(18, true), uncompressedSize = view.getUint32(22, true), nameLength = view.getUint16(26, true), extraLength = view.getUint16(28, true);
      if (flags & 0x0008) throw new Error('工程文件使用了不支持的数据描述方式。');
      if (method !== 0 || compressedSize !== uncompressedSize) throw new Error('工程文件使用了不支持的压缩方式。');
      const dataStart = offset + 30 + nameLength + extraLength, dataEnd = dataStart + compressedSize;
      if (dataStart > bytes.length || dataEnd > bytes.length) throw new Error('工程文件内容不完整。');
      const name = safeEntryName(decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength)));
      if (names.has(name)) throw new Error('工程文件包含重复项目。');
      if (++total > maxFiles) throw new Error(`工程文件最多支持 ${maxFiles} 个项目。`);
      const data = bytes.slice(dataStart, dataEnd); if (crc32(data) !== expectedCrc) throw new Error(`工程文件校验失败：${name}`);
      entries.push({ name, blob: new Blob([data]), size: data.length }); names.add(name); offset = dataEnd;
    }
    const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0); if (totalBytes > maxTotalBytes) throw new Error('工程文件解包后过大，无法安全打开。');
    if (!entries.length) throw new Error('工程文件中没有可读取的内容。');
    return entries;
  };
  ns.ZipArchive = { createZip, readZip, crc32 };
})();
