/* storage.js — 数据层：localStorage 读写、ID 生成、过期判断、导入校验、导出 */
const Store = (() => {
  const KEY = 'kanban.data.v1';
  const VERSION = 1;
  const COLUMNS = ['todo', 'doing', 'done'];
  // 新建标签时的备选颜色
  const PALETTE = ['#4f8ef7', '#f76f6f', '#3fbf7f', '#f7a94f', '#a06ef7', '#f76fb8', '#8a8f99'];

  function emptyData() {
    return { version: VERSION, cards: [], tags: [] };
  }

  // ID = 时间戳(base36) + 随机串，单机单用户不会撞
  function genId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // 本地时间格式化为 "YYYY-MM-DDTHH:mm"，和 datetime-local 控件的格式一致
  function localISO(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // 过期判断：有截止时间、没做完、截止时刻早于现在。
  // "YYYY-MM-DDTHH:mm" 不带时区，new Date() 按本地时间解析，比较的就是本地时间。
  function isOverdue(card) {
    return !!card.deadline
      && card.column !== 'done'
      && new Date(card.deadline).getTime() < Date.now();
  }

  // 导入校验：返回 { ok, errors }，不合格的文件一律拒绝，不碰现有数据
  function validate(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, errors: ['顶层必须是一个 JSON 对象'] };
    }
    if (!Array.isArray(data.cards)) {
      return { ok: false, errors: ['缺少 cards 数组'] };
    }
    const ids = new Set();
    data.cards.forEach((c, i) => {
      const where = '第 ' + (i + 1) + ' 张卡片';
      if (!c || typeof c !== 'object' || Array.isArray(c)) {
        errors.push(where + '：不是对象');
        return;
      }
      if (typeof c.id !== 'string' || !c.id) {
        errors.push(where + '：缺少有效的 id');
      } else if (ids.has(c.id)) {
        errors.push(where + '：id "' + c.id + '" 重复');
      } else {
        ids.add(c.id);
      }
      if (typeof c.title !== 'string' || !c.title.trim()) {
        errors.push(where + '：缺少标题 title');
      }
      if (c.description !== undefined && typeof c.description !== 'string') {
        errors.push(where + '：description 必须是字符串');
      }
      if (!COLUMNS.includes(c.column)) {
        errors.push(where + '：column 必须是 ' + COLUMNS.join(' / '));
      }
      if (c.deadline !== undefined && c.deadline !== null) {
        if (typeof c.deadline !== 'string' || isNaN(new Date(c.deadline).getTime())) {
          errors.push(where + '：deadline 不是有效的时间字符串');
        }
      }
      if (c.tags !== undefined &&
          !(Array.isArray(c.tags) && c.tags.every(t => typeof t === 'string'))) {
        errors.push(where + '：tags 必须是字符串数组');
      }
    });
    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        errors.push('tags 必须是数组');
      } else {
        data.tags.forEach((t, i) => {
          if (!t || typeof t.name !== 'string' || !t.name.trim() || typeof t.color !== 'string') {
            errors.push('第 ' + (i + 1) + ' 个标签：需要 name 和 color 两个字符串字段');
          }
        });
      }
    }
    return { ok: errors.length === 0, errors };
  }

  // 清洗数据：补默认值；卡片引用了但注册表没有的标签补一个默认色；没人用的标签清掉
  function normalize(data) {
    const tags = [];
    const byName = new Map();
    (data.tags || []).forEach(t => {
      if (!byName.has(t.name)) {
        const tag = { name: t.name, color: t.color };
        byName.set(t.name, tag);
        tags.push(tag);
      }
    });
    const cards = data.cards.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description || '',
      column: c.column,
      deadline: c.deadline || null,
      tags: Array.isArray(c.tags) ? [...new Set(c.tags)] : [],
      createdAt: c.createdAt || localISO(),
    }));
    const used = new Set();
    cards.forEach(c => c.tags.forEach(name => {
      used.add(name);
      if (!byName.has(name)) {
        const tag = { name, color: PALETTE[byName.size % PALETTE.length] };
        byName.set(name, tag);
        tags.push(tag);
      }
    }));
    return { version: VERSION, cards, tags: tags.filter(t => used.has(t.name)) };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyData();
      const data = JSON.parse(raw);
      if (!validate(data).ok) return emptyData();
      return normalize(data);
    } catch (e) {
      return emptyData();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  // 导出：逐字段拼，只保留给人看的字段，不多塞
  function toExport(data) {
    return {
      version: VERSION,
      cards: data.cards.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        column: c.column,
        deadline: c.deadline,
        tags: c.tags,
        createdAt: c.createdAt,
      })),
      tags: data.tags.map(t => ({ name: t.name, color: t.color })),
    };
  }

  return {
    COLUMNS, PALETTE,
    emptyData, genId, localISO, isOverdue,
    validate, normalize, load, save, toExport,
  };
})();
