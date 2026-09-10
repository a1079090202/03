/* app.js — 主逻辑：状态、事件绑定、弹窗、搜索筛选、导入导出 */
(() => {
  const state = {
    data: Store.load(),
    search: '',
    activeTag: null,
  };

  // 弹窗的临时状态
  const modal = {
    editingId: null,    // null 表示新建
    column: 'todo',
    tags: [],           // 当前编辑卡片上的标签名
    newTagColors: {},   // 本次新建标签选的颜色 { 标签名: 颜色 }
    pickedColor: Store.PALETTE[0],
  };

  const $ = id => document.getElementById(id);

  function save() { Store.save(state.data); }
  function render() { Render.renderBoard(state.data, state); }

  /* ---------- 数据操作 ---------- */

  function upsertCard(card) {
    const i = state.data.cards.findIndex(c => c.id === card.id);
    if (i >= 0) state.data.cards[i] = card;
    else state.data.cards.push(card);
    syncTags();
    save();
    render();
  }

  // 标签注册表跟着卡片走：卡片用到的新标签注册进来，没人用的清掉
  function syncTags() {
    const byName = new Map(state.data.tags.map(t => [t.name, t]));
    const used = new Set();
    state.data.cards.forEach(c => c.tags.forEach(name => {
      used.add(name);
      if (!byName.has(name)) {
        byName.set(name, {
          name,
          color: modal.newTagColors[name] || Store.PALETTE[byName.size % Store.PALETTE.length],
        });
      }
    }));
    state.data.tags = [...byName.values()].filter(t => used.has(t.name));
    // 正在筛选的标签被清掉了就同时取消筛选，免得看板突然全空
    if (state.activeTag && !state.data.tags.some(t => t.name === state.activeTag)) {
      state.activeTag = null;
    }
  }

  function deleteCard(id) {
    const card = state.data.cards.find(c => c.id === id);
    if (!card) return;
    if (!confirm('删除卡片「' + card.title + '」？')) return;
    state.data.cards = state.data.cards.filter(c => c.id !== id);
    syncTags();
    save();
    render();
  }

  // 拖拽落点：把 id 卡移到 toColumn 列、beforeId 卡之前；beforeId 为 null 则放列尾。
  // 列内顺序就是 cards 数组里的相对顺序，不需要额外的排序字段。
  function moveCard(id, toColumn, beforeId) {
    const cards = state.data.cards;
    const idx = cards.findIndex(c => c.id === id);
    if (idx < 0) return;
    const [card] = cards.splice(idx, 1);
    card.column = toColumn;
    if (beforeId && beforeId !== id) {
      const bi = cards.findIndex(c => c.id === beforeId);
      if (bi >= 0) {
        cards.splice(bi, 0, card);
        save();
        render();
        return;
      }
    }
    let last = -1;
    cards.forEach((c, i) => { if (c.column === toColumn) last = i; });
    cards.splice(last + 1, 0, card);
    save();
    render();
  }

  /* ---------- 弹窗 ---------- */

  function openModal(editingId, column) {
    modal.editingId = editingId;
    modal.newTagColors = {};
    modal.pickedColor = Store.PALETTE[0];
    if (editingId) {
      const c = state.data.cards.find(c => c.id === editingId);
      if (!c) return;
      modal.column = c.column;
      modal.tags = [...c.tags];
      $('modal-title').textContent = '编辑卡片';
      $('f-title').value = c.title;
      $('f-desc').value = c.description;
      $('f-deadline').value = c.deadline || '';
    } else {
      modal.column = column;
      modal.tags = [];
      $('modal-title').textContent = '新建卡片（' + Render.COLUMN_NAMES[column] + '）';
      $('f-title').value = '';
      $('f-desc').value = '';
      $('f-deadline').value = '';
    }
    $('new-tag-name').value = '';
    $('f-title').classList.remove('invalid');
    renderTagEditor();
    $('modal-overlay').hidden = false;
    $('f-title').focus();
  }

  function closeModal() {
    $('modal-overlay').hidden = true;
  }

  function tagColorOf(name) {
    const t = state.data.tags.find(t => t.name === name);
    return t ? t.color : (modal.newTagColors[name] || '#8a8f99');
  }

  function renderTagEditor() {
    const box = $('f-tags');
    box.innerHTML = '';
    // 这张卡已有的标签：点击移除
    modal.tags.forEach(name => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tag tag-edit';
      chip.style.backgroundColor = tagColorOf(name);
      chip.textContent = name + ' ×';
      chip.title = '点击移除';
      chip.addEventListener('click', () => {
        modal.tags = modal.tags.filter(t => t !== name);
        renderTagEditor();
      });
      box.appendChild(chip);
    });
    // 看板里已有、这张卡还没用的标签：点击添加
    state.data.tags.filter(t => !modal.tags.includes(t.name)).forEach(t => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tag tag-available';
      chip.style.backgroundColor = t.color;
      chip.textContent = '＋ ' + t.name;
      chip.title = '点击添加';
      chip.addEventListener('click', () => {
        modal.tags.push(t.name);
        renderTagEditor();
      });
      box.appendChild(chip);
    });
    if (!box.children.length) {
      const hint = document.createElement('span');
      hint.className = 'tag-hint';
      hint.textContent = '还没有标签，在下面输入名字、选个颜色新建';
      box.appendChild(hint);
    }
    // 新标签的颜色选择
    const colorRow = $('new-tag-colors');
    colorRow.innerHTML = '';
    Store.PALETTE.forEach(color => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'color-dot' + (modal.pickedColor === color ? ' selected' : '');
      dot.style.backgroundColor = color;
      dot.addEventListener('click', () => {
        modal.pickedColor = color;
        renderTagEditor();
      });
      colorRow.appendChild(dot);
    });
  }

  function addNewTag() {
    const name = $('new-tag-name').value.trim();
    if (!name) return;
    if (!modal.tags.includes(name)) {
      // 已注册过的标签沿用原来的颜色，新标签记下这次选的颜色
      if (!state.data.tags.some(t => t.name === name)) {
        modal.newTagColors[name] = modal.pickedColor;
      }
      modal.tags.push(name);
    }
    $('new-tag-name').value = '';
    renderTagEditor();
  }

  function saveModal() {
    const title = $('f-title').value.trim();
    if (!title) {
      $('f-title').classList.add('invalid');
      $('f-title').focus();
      return;
    }
    const fields = {
      title,
      description: $('f-desc').value.trim(),
      deadline: $('f-deadline').value || null,
      tags: [...modal.tags],
    };
    if (modal.editingId) {
      const c = state.data.cards.find(c => c.id === modal.editingId);
      if (c) upsertCard(Object.assign(c, fields));
    } else {
      upsertCard({
        id: Store.genId(),
        ...fields,
        column: modal.column,
        createdAt: Store.localISO(),
      });
    }
    closeModal();
  }

  /* ---------- 导入导出 ---------- */

  function exportJSON() {
    const text = JSON.stringify(Store.toExport(state.data), null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kanban-' + Store.localISO().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        alert('导入失败：文件不是有效的 JSON。');
        return;
      }
      const result = Store.validate(data);
      if (!result.ok) {
        const shown = result.errors.slice(0, 5).join('\n');
        const more = result.errors.length > 5 ? '\n…共 ' + result.errors.length + ' 处问题' : '';
        alert('导入失败，文件格式不对：\n\n' + shown + more);
        return;
      }
      if (!confirm('导入会覆盖当前全部数据，确定继续？')) return;
      state.data = Store.normalize(data);
      state.activeTag = null;
      state.search = '';
      $('search').value = '';
      save();
      render();
    };
    reader.readAsText(file);
  }

  /* ---------- 事件绑定 ---------- */

  function init() {
    render();
    DnD.init($('board'), moveCard);

    $('search').addEventListener('input', e => {
      state.search = e.target.value.trim();
      render();
    });

    $('btn-export').addEventListener('click', exportJSON);
    $('btn-import').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', e => {
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = ''; // 允许重复导入同一个文件
    });

    // 标签筛选（事件委托，筛选条是重渲染的）
    $('filter-bar').addEventListener('click', e => {
      const chip = e.target.closest('.tag-filter');
      if (chip) {
        const name = chip.dataset.tag;
        state.activeTag = state.activeTag === name ? null : name;
        render();
        return;
      }
      if (e.target.id === 'filter-clear') {
        state.activeTag = null;
        render();
      }
    });

    document.querySelectorAll('.add-card').forEach(btn => {
      btn.addEventListener('click', () => openModal(null, btn.dataset.column));
    });

    // 卡片点击：点 × 删除，点其它地方编辑（事件委托）
    $('board').addEventListener('click', e => {
      const card = e.target.closest('.card');
      if (!card) return;
      if (e.target.closest('.card-delete')) {
        deleteCard(card.dataset.id);
        return;
      }
      openModal(card.dataset.id);
    });

    // 弹窗
    $('modal-save').addEventListener('click', saveModal);
    $('modal-cancel').addEventListener('click', closeModal);
    $('modal-overlay').addEventListener('click', e => {
      if (e.target === $('modal-overlay')) closeModal();
    });
    $('f-deadline-clear').addEventListener('click', () => { $('f-deadline').value = ''; });
    $('new-tag-add').addEventListener('click', addNewTag);
    $('new-tag-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addNewTag(); }
    });
    $('f-title').addEventListener('input', () => $('f-title').classList.remove('invalid'));
    document.addEventListener('keydown', e => {
      if ($('modal-overlay').hidden) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && e.target === $('f-title')) saveModal();
    });

    // 每 30 秒重画一次，让到点的卡片及时变红置顶
    setInterval(render, 30000);
  }

  init();
})();
