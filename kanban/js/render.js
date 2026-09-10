/* render.js — 渲染层：根据数据重建看板、卡片、筛选条（只负责画，不管数据怎么来） */
const Render = (() => {
  const COLUMN_NAMES = { todo: '要做', doing: '在做', done: '做完' };

  function tagColor(data, name) {
    const t = data.tags.find(t => t.name === name);
    return t ? t.color : '#8a8f99';
  }

  // 关键词（标题/描述/标签）+ 标签筛选
  function cardMatches(card, ui) {
    if (ui.activeTag && !card.tags.includes(ui.activeTag)) return false;
    if (ui.search) {
      const q = ui.search.toLowerCase();
      const hay = (card.title + '\n' + card.description + '\n' + card.tags.join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderBoard(data, ui) {
    Store.COLUMNS.forEach(col => {
      const list = document.getElementById('list-' + col);
      list.innerHTML = '';
      // 过期未完成的排到列顶，其余保持数组里的顺序（即拖拽排好的顺序）
      const cards = data.cards
        .filter(c => c.column === col && cardMatches(c, ui))
        .sort((a, b) => (Store.isOverdue(b) ? 1 : 0) - (Store.isOverdue(a) ? 1 : 0));
      cards.forEach(c => list.appendChild(renderCard(data, c)));
      // 列头计数不受筛选影响，显示该列真实数量
      document.getElementById('count-' + col).textContent =
        data.cards.filter(c => c.column === col).length;
    });
    renderFilterBar(data, ui);
  }

  function renderCard(data, card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.draggable = true;
    el.dataset.id = card.id;
    const overdue = Store.isOverdue(card);
    if (overdue) el.classList.add('overdue');

    const head = document.createElement('div');
    head.className = 'card-head';
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = card.title;
    const del = document.createElement('button');
    del.className = 'card-delete';
    del.textContent = '×';
    del.title = '删除';
    head.append(title, del);
    el.appendChild(head);

    if (card.description) {
      const desc = document.createElement('div');
      desc.className = 'card-desc';
      desc.textContent = card.description;
      el.appendChild(desc);
    }

    if (card.tags.length) {
      const tags = document.createElement('div');
      tags.className = 'card-tags';
      card.tags.forEach(name => {
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.style.backgroundColor = tagColor(data, name);
        chip.textContent = name;
        tags.appendChild(chip);
      });
      el.appendChild(tags);
    }

    if (card.deadline) {
      const dl = document.createElement('div');
      dl.className = 'card-deadline';
      dl.textContent = '⏰ ' + card.deadline.replace('T', ' ');
      if (overdue) {
        const badge = document.createElement('span');
        badge.className = 'overdue-badge';
        badge.textContent = '已过期';
        dl.appendChild(badge);
      }
      el.appendChild(dl);
    }
    return el;
  }

  // 标签筛选条：每个标签一个彩色 chip，点击切换筛选
  function renderFilterBar(data, ui) {
    const bar = document.getElementById('filter-bar');
    bar.innerHTML = '';
    if (!data.tags.length) { bar.hidden = true; return; }
    bar.hidden = false;
    const label = document.createElement('span');
    label.className = 'filter-label';
    label.textContent = '按标签筛选：';
    bar.appendChild(label);
    data.tags.forEach(t => {
      const chip = document.createElement('button');
      chip.className = 'tag tag-filter' + (ui.activeTag === t.name ? ' active' : '');
      chip.style.backgroundColor = t.color;
      chip.textContent = t.name;
      chip.dataset.tag = t.name;
      bar.appendChild(chip);
    });
    if (ui.activeTag) {
      const clear = document.createElement('button');
      clear.className = 'btn btn-small';
      clear.id = 'filter-clear';
      clear.textContent = '清除筛选';
      bar.appendChild(clear);
    }
  }

  return { renderBoard, COLUMN_NAMES };
})();
