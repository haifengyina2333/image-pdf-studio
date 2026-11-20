(() => {
  const ns = window.Toolbox ??= {};

  const allPages = (total) => Array.from({ length: total }, (_, index) => index + 1);
  const normalizeExpression = (value) => String(value ?? '')
    .trim()
    .replace(/[，、]/g, ',')
    .replace(/[–—~～至]/g, '-')
    .replace(/\s+/g, ',')
    .replace(/,+/g, ',')
    .replace(/^,|,$/g, '');

  const assertTotal = (total) => {
    const value = Math.floor(Number(total));
    if (!Number.isFinite(value) || value < 1) throw new Error('PDF 没有可处理的页面。');
    return value;
  };

  const parsePageSelection = (expression, total, { defaultAll = true } = {}) => {
    const pageTotal = assertTotal(total);
    const normalized = normalizeExpression(expression);
    if (!normalized || /^(?:全部|all)$/i.test(normalized)) {
      if (!defaultAll && !normalized) throw new Error('请填写页面范围。');
      return allPages(pageTotal);
    }

    const pages = [];
    const seen = new Set();
    for (const token of normalized.split(',')) {
      if (!token) continue;
      const range = token.match(/^(\d+)-(\d+)$/);
      const single = token.match(/^\d+$/);
      if (!range && !single) throw new Error(`无法识别页面范围“${token}”。请使用 1-5,8,11-13。`);
      const start = Number(range?.[1] ?? token);
      const end = Number(range?.[2] ?? token);
      if (start < 1 || end < 1 || start > pageTotal || end > pageTotal) throw new Error(`页码必须在 1-${pageTotal} 之间。`);
      if (start > end) throw new Error(`页面范围“${token}”起始页不能大于结束页。`);
      for (let page = start; page <= end; page += 1) {
        if (!seen.has(page)) { seen.add(page); pages.push(page); }
      }
    }
    if (!pages.length) throw new Error('没有识别到可处理的页面。');
    return pages;
  };

  const parseSplitGroups = (expression, total) => {
    const raw = String(expression ?? '').trim();
    if (!raw) throw new Error('请填写拆分范围，例如 1-5；6-10；12,14。');
    const groups = raw.split(/[;；\n]+/).map((part) => part.trim()).filter(Boolean);
    if (!groups.length) throw new Error('没有识别到拆分范围。');
    return groups.map((part) => ({ label: part, pages: parsePageSelection(part, total, { defaultAll: false }) }));
  };

  const formatPageSelection = (pages) => {
    const numbers = [...new Set((pages || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
    if (!numbers.length) return '';
    const parts = [];
    let start = numbers[0], previous = numbers[0];
    for (let index = 1; index <= numbers.length; index += 1) {
      const current = numbers[index];
      if (current === previous + 1) { previous = current; continue; }
      parts.push(start === previous ? String(start) : `${start}-${previous}`);
      start = current; previous = current;
    }
    return parts.join(',');
  };

  ns.PageRange = { allPages, normalizeExpression, parsePageSelection, parseSplitGroups, formatPageSelection };
})();
