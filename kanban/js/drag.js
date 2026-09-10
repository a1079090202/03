/* drag.js — 拖拽层：原生 HTML5 拖拽事件，不引库。
   只负责算出「哪张卡、拖到哪一列、插到哪张卡前面」，数据改动回调给 app.js */
const DnD = (() => {
  let dragId = null;
  let placeholder = null;

  // 找到鼠标位置下，第一个中线在鼠标下方的卡片（落点就在它前面）
  function getAfterElement(list, y) {
    const cards = [...list.querySelectorAll('.card:not(.dragging)')];
    return cards.find(el => {
      const box = el.getBoundingClientRect();
      return y < box.top + box.height / 2;
    }) || null;
  }

  function init(boardEl, onMove) {
    placeholder = document.createElement('div');
    placeholder.className = 'drop-placeholder';

    // dragstart / dragend 用事件委托，卡片重渲染后也不用重新绑定
    boardEl.addEventListener('dragstart', e => {
      const card = e.target.closest('.card');
      if (!card) return;
      dragId = card.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
      // 等浏览器生成拖拽影像后再加半透明，否则拖着的影像也是透明的
      setTimeout(() => card.classList.add('dragging'), 0);
    });

    boardEl.addEventListener('dragend', cleanup);

    boardEl.querySelectorAll('.card-list').forEach(list => {
      list.addEventListener('dragover', e => {
        if (!dragId) return;
        e.preventDefault(); // 必须 preventDefault，drop 才会触发
        e.dataTransfer.dropEffect = 'move';
        const after = getAfterElement(list, e.clientY);
        if (after) list.insertBefore(placeholder, after);
        else list.appendChild(placeholder);
      });

      list.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragId) return;
        const toColumn = list.dataset.column;
        // 占位条后面那张卡就是插入位置；没有就是放到列尾
        const next = placeholder.parentElement === list ? placeholder.nextElementSibling : null;
        const beforeId = next && next.classList.contains('card') ? next.dataset.id : null;
        onMove(dragId, toColumn, beforeId);
        cleanup();
      });
    });
  }

  function cleanup() {
    dragId = null;
    document.querySelectorAll('.card.dragging').forEach(c => c.classList.remove('dragging'));
    if (placeholder && placeholder.parentElement) {
      placeholder.parentElement.removeChild(placeholder);
    }
  }

  return { init };
})();
