// タスク管理ツール プロトタイプ
// 見た目と、カード・リストの動きを確認するためのもの。データは保存しない。

let currentBoardId = data.boards[0] ? data.boards[0].id : null;
let currentView = 'board'; // 'board'（ボード表示） | 'trash'（ゴミ箱表示）
let trash = []; // ゴミ箱。{ id, type: 'card' | 'list', item, boardId, listId, index, deletedAt }
let dragging = null; // { type: 'card' | 'list', el: 要素 }
let activeCardEdit = null; // その場で編集中のカード（{ save }）

const boardNav = document.getElementById('board-nav');
const boardName = document.getElementById('board-name');
const listsEl = document.getElementById('lists');
const trashNav = document.getElementById('trash-nav');
const deleteBoardBtn = document.getElementById('delete-board');

// ---------- 小さな部品 ----------

// 要素を作る。文字は textContent で入れる（HTML として動かさないため）
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  children.forEach((child) => node.append(child));
  return node;
}

function newId(prefix) {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 6);
}

function currentBoard() {
  return data.boards.find((b) => b.id === currentBoardId);
}

function findCard(cardId) {
  for (const list of currentBoard().lists) {
    const card = list.cards.find((c) => c.id === cardId);
    if (card) return { list, card };
  }
  return null;
}

// ---------- 描画 ----------

function render() {
  renderSidebar();
  renderBoard();
}

function renderSidebar() {
  boardNav.replaceChildren(
    ...data.boards.map((board) => {
      const btn = el('button', {
        type: 'button',
        textContent: board.name,
        className: currentView === 'board' && board.id === currentBoardId ? 'active' : '',
        onclick: () => {
          currentBoardId = board.id;
          currentView = 'board';
          render();
        },
      });
      return el('li', {}, [btn]);
    })
  );

  trashNav.textContent = `🗑 ゴミ箱（${trash.length}）`;
  trashNav.classList.toggle('active', currentView === 'trash');
}

function renderBoard() {
  if (currentView === 'trash') return renderTrash();
  deleteBoardBtn.hidden = false;

  const board = currentBoard();
  if (!board) {
    boardName.textContent = '';
    listsEl.replaceChildren(el('p', { className: 'empty-message', textContent: 'ボードがありません。新しく作成しましょう' }));
    return;
  }

  boardName.textContent = board.name;
  const children = board.lists.map(renderList);
  if (board.lists.length === 0) {
    children.push(el('p', { className: 'empty-message', textContent: 'リストを追加しましょう →' }));
  }
  children.push(renderAddList());
  listsEl.replaceChildren(...children);
}

function renderList(list) {
  const nameEl = el('h2', { className: 'list-name', textContent: list.name, title: 'クリックで名前を変更' });
  nameEl.addEventListener('click', () => startListNameEdit(nameEl, list));

  const header = el('div', { className: 'list-header', title: 'ドラッグで並び替え' }, [
    nameEl,
    el('button', {
      type: 'button',
      className: 'icon-btn',
      textContent: '🗑',
      title: 'リストをゴミ箱へ移動',
      onclick: () => {
        const board = currentBoard();
        moveToTrash('list', list, board.id, null, board.lists.indexOf(list));
        board.lists = board.lists.filter((l) => l.id !== list.id);
        render();
      },
    }),
  ]);

  const cards = el('div', { className: 'cards' }, list.cards.map(renderCard));
  const listEl = el('section', { className: 'list' }, [header, cards]);
  listEl.dataset.listId = list.id;
  listEl.append(renderAddCard(list, listEl));

  // リストは見出しをつかんだときだけドラッグできるようにする（カードのドラッグと区別するため）
  header.addEventListener('mousedown', (e) => {
    if (!e.target.closest('button, input')) listEl.draggable = true;
  });
  listEl.addEventListener('mouseup', () => { listEl.draggable = false; });
  listEl.addEventListener('dragstart', (e) => {
    if (e.target !== listEl) return;
    startDrag(e, 'list', listEl);
  });

  // カードをリストの上に持ってきたとき、入る位置を決める
  listEl.addEventListener('dragover', (e) => {
    if (!dragging || dragging.type !== 'card') return;
    e.preventDefault();
    const after = getAfterElement(cards, '.card', e.clientY, 'y');
    if (after) cards.insertBefore(dragging.el, after);
    else cards.append(dragging.el);
  });

  return listEl;
}

function renderCard(card) {
  // 完了チェック。押してもカードの編集は開かない
  const checkbox = el('input', { type: 'checkbox', className: 'card-check', checked: card.done, title: '完了にする' });
  checkbox.addEventListener('click', (e) => e.stopPropagation());
  checkbox.addEventListener('change', () => {
    card.done = checkbox.checked;
    cardEl.classList.toggle('done', card.done);
  });

  const body = el('div', { className: 'card-body' }, [el('span', { className: 'card-title', textContent: card.title })]);
  if (card.description) {
    body.append(el('span', { className: 'card-desc-mark', textContent: '≡ 説明あり' }));
  }

  const cardEl = el('div', { className: card.done ? 'card done' : 'card', draggable: true }, [checkbox, body]);
  cardEl.dataset.cardId = card.id;
  cardEl.addEventListener('click', () => startCardEdit(cardEl, card));
  cardEl.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    startDrag(e, 'card', cardEl);
  });
  return cardEl;
}

// ---------- その場で編集 ----------

// テキストエリアの高さを中身に合わせる
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// リスト名：クリックで入力欄に変わる。Enter か欄の外を押すと確定、Esc で取り消し
function startListNameEdit(nameEl, list) {
  const input = el('input', { type: 'text', className: 'list-name-input', value: list.name, maxLength: 50 });
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (save && name) list.name = name;
    nameEl.textContent = list.name;
    input.replaceWith(nameEl);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  nameEl.replaceWith(input);
  input.select();
}

// カード：クリックでタイトルと説明の入力欄に変わる。
// 「保存」・タイトルで Enter・カードの外を押すと確定、Esc で取り消し
function startCardEdit(cardEl, card) {
  if (activeCardEdit) activeCardEdit.save();

  const titleInput = el('textarea', { className: 'card-edit-title', value: card.title, maxLength: 100, rows: 1 });
  const descInput = el('textarea', {
    className: 'card-edit-desc',
    value: card.description,
    maxLength: 2000,
    rows: 3,
    placeholder: '説明を追加',
  });

  const finish = (save) => {
    const title = titleInput.value.trim();
    if (save && title) {
      card.title = title;
      card.description = descInput.value;
    }
    activeCardEdit = null;
    editor.replaceWith(renderCard(card));
  };

  const editor = el('div', { className: 'card card-editing' }, [
    titleInput,
    descInput,
    el('div', { className: 'add-form-actions' }, [
      el('button', { type: 'button', className: 'btn btn-primary', textContent: '保存', onclick: () => finish(true) }),
      el('button', { type: 'button', className: 'btn', textContent: 'キャンセル', onclick: () => finish(false) }),
      el('button', {
        type: 'button',
        className: 'icon-btn card-edit-delete',
        textContent: '🗑',
        title: 'カードをゴミ箱へ移動',
        onclick: () => {
          const { list } = findCard(card.id);
          moveToTrash('card', card, currentBoardId, list.id, list.cards.indexOf(card));
          list.cards = list.cards.filter((c) => c.id !== card.id);
          renderSidebar();
          activeCardEdit = null;
          editor.remove();
        },
      }),
    ]),
  ]);

  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); finish(true); }
  });
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') finish(false);
  });
  [titleInput, descInput].forEach((t) => t.addEventListener('input', () => autoResize(t)));

  activeCardEdit = { editor, save: () => finish(true) };
  cardEl.replaceWith(editor);
  autoResize(titleInput);
  autoResize(descInput);
  titleInput.focus();
  titleInput.select();
}

// 編集中のカードの外を押したら確定する（確認ダイアログを操作しているときは除く）
document.addEventListener('mousedown', (e) => {
  if (!activeCardEdit || confirmDialog.open) return;
  if (!activeCardEdit.editor.contains(e.target)) activeCardEdit.save();
});

// 「＋ カードを追加」ボタンと入力フォームの切り替え
function renderAddCard(list, listEl) {
  const button = el('button', { type: 'button', className: 'add-btn', textContent: '＋ カードを追加' });

  button.onclick = () => {
    const input = el('textarea', { rows: 2, maxLength: 100, placeholder: 'カードのタイトルを入力' });
    const add = () => {
      const title = input.value.trim();
      if (!title) return input.focus();
      const card = { id: newId('c'), title, description: '' };
      list.cards.push(card);
      listEl.querySelector('.cards').append(renderCard(card));
      input.value = '';
      input.focus();
    };
    const close = () => form.replaceWith(button);
    const form = el('div', { className: 'add-form' }, [
      input,
      el('div', { className: 'add-form-actions' }, [
        el('button', { type: 'button', className: 'btn btn-primary', textContent: '追加', onclick: add }),
        el('button', { type: 'button', className: 'icon-btn', textContent: '×', title: 'キャンセル', onclick: close }),
      ]),
    ]);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); add(); }
      if (e.key === 'Escape') close();
    });
    button.replaceWith(form);
    input.focus();
  };

  return button;
}

function renderAddList() {
  const wrap = el('div', { className: 'add-list' });
  const button = el('button', { type: 'button', className: 'add-btn', textContent: '＋ リストを追加' });
  wrap.append(button);

  button.onclick = () => {
    const input = el('input', { type: 'text', maxLength: 50, placeholder: 'リスト名を入力' });
    const add = () => {
      const name = input.value.trim();
      if (!name) return input.focus();
      currentBoard().lists.push({ id: newId('l'), name, cards: [] });
      renderBoard();
      // 続けて追加できるように、フォームを開いたままにする
      listsEl.querySelector('.add-list .add-btn').click();
    };
    const close = () => {
      wrap.classList.remove('open');
      wrap.replaceChildren(button);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) add();
      if (e.key === 'Escape') close();
    });
    wrap.classList.add('open');
    wrap.replaceChildren(
      el('div', { className: 'add-form' }, [
        input,
        el('div', { className: 'add-form-actions' }, [
          el('button', { type: 'button', className: 'btn btn-primary', textContent: '追加', onclick: add }),
          el('button', { type: 'button', className: 'icon-btn', textContent: '×', title: 'キャンセル', onclick: close }),
        ]),
      ])
    );
    input.focus();
  };

  return wrap;
}

// ---------- ドラッグ＆ドロップ ----------
// ドラッグ中は要素そのものを動かして見せ、離したときに画面の並びをデータに反映する。
// リストの外など、落とせない場所で離したときは元の並びに戻す。

function startDrag(e, type, element) {
  dragging = { type, el: element };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', '');
  // dragstart の中ですぐ見た目を変えると、つかんでいる画像まで変わるため少し遅らせる
  setTimeout(() => element.classList.add('dragging'), 0);
}

// リストを表示エリアの上で動かしたとき、入る位置を決める
listsEl.addEventListener('dragover', (e) => {
  if (!dragging || dragging.type !== 'list') return;
  e.preventDefault();
  const after = getAfterElement(listsEl, '.list', e.clientX, 'x');
  listsEl.insertBefore(dragging.el, after || listsEl.querySelector('.add-list'));
});

document.addEventListener('drop', (e) => {
  if (!dragging) return;
  e.preventDefault();
  applyDomOrder();
});

document.addEventListener('dragend', () => {
  if (!dragging) return;
  dragging.el.classList.remove('dragging');
  dragging.el.draggable = dragging.type === 'card';
  dragging = null;
  // drop で反映済みならデータと同じ並び、落とせない場所なら元の並びで描き直される
  renderBoard();
});

// マウスの位置より後ろにある、一番近い要素を返す（なければ末尾に入れる）
function getAfterElement(container, selector, pos, axis) {
  const items = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
  return items.find((item) => {
    const box = item.getBoundingClientRect();
    const center = axis === 'x' ? box.left + box.width / 2 : box.top + box.height / 2;
    return pos < center;
  }) || null;
}

// 画面の並びをデータに反映する
function applyDomOrder() {
  const board = currentBoard();
  const listById = new Map(board.lists.map((l) => [l.id, l]));
  const cardById = new Map(board.lists.flatMap((l) => l.cards).map((c) => [c.id, c]));

  board.lists = [...listsEl.querySelectorAll('.list')].map((listEl) => {
    const list = listById.get(listEl.dataset.listId);
    list.cards = [...listEl.querySelectorAll('.card')].map((cardEl) => cardById.get(cardEl.dataset.cardId));
    return list;
  });
}

// ---------- ゴミ箱 ----------
// 削除したカード・リストはいったんゴミ箱に入り、元に戻せる。
// ゴミ箱から削除すると、完全に消えて元に戻せない。

function moveToTrash(type, item, boardId, listId, index) {
  trash.unshift({ id: newId('t'), type, item, boardId, listId, index, deletedAt: new Date() });
}

function removeFromTrash(entry) {
  trash = trash.filter((t) => t !== entry);
}

function restoreFromTrash(entry) {
  const board = data.boards.find((b) => b.id === entry.boardId);
  if (!board) return alert('元のボードがないため、戻せません。');

  if (entry.type === 'list') {
    board.lists.splice(Math.min(entry.index, board.lists.length), 0, entry.item);
  } else {
    // 元のリストがなくなっていたら、ボードの一番左のリストに戻す
    let list = board.lists.find((l) => l.id === entry.listId);
    if (!list) {
      list = board.lists[0];
      if (!list) return alert('ボードにリストがないため、戻せません。先にリストを作成してください。');
      alert(`元のリストがないため、「${list.name}」に戻しました。`);
    }
    list.cards.splice(Math.min(entry.index, list.cards.length), 0, entry.item);
  }
  removeFromTrash(entry);
  render();
}

function renderTrash() {
  boardName.textContent = 'ゴミ箱';
  deleteBoardBtn.hidden = true;

  const emptyBtn = el('button', {
    type: 'button',
    className: 'btn btn-danger',
    textContent: 'ゴミ箱を空にする',
    disabled: trash.length === 0,
    onclick: async () => {
      const ok = await confirmDelete(`ゴミ箱の ${trash.length} 件をすべて完全に削除します。\n元に戻せません。削除しますか？`);
      if (!ok) return;
      trash = [];
      render();
    },
  });

  const items = trash.map((entry) => {
    const board = data.boards.find((b) => b.id === entry.boardId);
    const place = [`ボード：${board ? board.name : '（なし）'}`];
    let label;
    if (entry.type === 'list') {
      label = `リスト（カード ${entry.item.cards.length} 枚）`;
    } else {
      label = 'カード';
      const list = board && board.lists.find((l) => l.id === entry.listId);
      place.push(`リスト：${list ? list.name : '（削除済み）'}`);
    }
    const time = entry.deletedAt.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return el('li', { className: 'trash-item' }, [
      el('div', { className: 'trash-info' }, [
        el('span', { className: `trash-type trash-type-${entry.type}`, textContent: label }),
        el('span', { className: 'trash-name', textContent: entry.type === 'list' ? entry.item.name : entry.item.title }),
        el('span', { className: 'trash-place', textContent: `${place.join(' ／ ')} ／ 削除：${time}` }),
      ]),
      el('button', { type: 'button', className: 'btn', textContent: '元に戻す', onclick: () => restoreFromTrash(entry) }),
      el('button', {
        type: 'button',
        className: 'btn btn-danger',
        textContent: '完全に削除',
        onclick: async () => {
          const extra = entry.type === 'list' ? '\nリスト内のカードもすべて削除されます。' : '';
          const ok = await confirmDelete(`「${entry.type === 'list' ? entry.item.name : entry.item.title}」を完全に削除します。${extra}\n元に戻せません。削除しますか？`);
          if (!ok) return;
          removeFromTrash(entry);
          render();
        },
      }),
    ]);
  });

  const panel = el('div', { className: 'trash-panel' }, [
    el('div', { className: 'trash-header' }, [
      el('p', { className: 'trash-note', textContent: '削除したカードとリストはここに入ります。「元に戻す」で元の場所に戻せます。' }),
      emptyBtn,
    ]),
    trash.length
      ? el('ul', { className: 'trash-list' }, items)
      : el('p', { className: 'trash-empty', textContent: 'ゴミ箱は空です' }),
  ]);
  listsEl.replaceChildren(panel);
}

trashNav.addEventListener('click', () => {
  if (activeCardEdit) activeCardEdit.save();
  currentView = 'trash';
  render();
});

// ---------- 確認ダイアログ ----------

const confirmDialog = document.getElementById('confirm-dialog');

function confirmDelete(message) {
  document.getElementById('confirm-message').textContent = message;
  confirmDialog.showModal();
  return new Promise((resolve) => {
    const finish = (result) => {
      confirmDialog.close();
      okBtn.onclick = cancelBtn.onclick = confirmDialog.oncancel = null;
      resolve(result);
    };
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    okBtn.onclick = () => finish(true);
    cancelBtn.onclick = () => finish(false);
    confirmDialog.oncancel = () => finish(false); // Esc キー
  });
}

// ---------- 見た目だけのボタン ----------

document.getElementById('create-board').addEventListener('click', () => {
  alert('ボードの作成は、プロトタイプでは動きません（見た目の確認のみ）。');
});

document.getElementById('delete-board').addEventListener('click', () => {
  alert('ボードの削除は、プロトタイプでは動きません（見た目の確認のみ）。');
});

render();
