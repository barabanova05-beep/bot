'use strict';

// Книги из лабораторной №5. ID должны совпадать с таблицей books в MySQL.
// Сайт статический: реальные бронирования и оценки выполняет Python-бот.
const BOOKS = [
  {id: 1, title:'Властелин колец', author:'Дж. Р. Р. Толкин', genre:'Фэнтези', available:true},
  {id: 2, title:'Гарри Поттер и философский камень', author:'Дж. К. Роулинг', genre:'Фэнтези', available:true},
  {id: 3, title:'Последнее желание', author:'Анджей Сапковский', genre:'Фэнтези', available:false},
  {id: 4, title:'Гордость и предубеждение', author:'Джейн Остин', genre:'Классика', available:true},
  {id: 5, title:'Преступление и наказание', author:'Фёдор Достоевский', genre:'Классика', available:true},
  {id: 6, title:'451 градус по Фаренгейту', author:'Рэй Брэдбери', genre:'Фантастика', available:true},
  {id: 7, title:'Дюна', author:'Фрэнк Герберт', genre:'Фантастика', available:true},
  {id: 8, title:'Убийство в Восточном экспрессе', author:'Агата Кристи', genre:'Детектив', available:true},
  {id: 9, title:'Собака Баскервилей', author:'Артур Конан Дойл', genre:'Детектив', available:true}
];

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const $ = id => document.getElementById(id);
const colors = ['tone-0','tone-1','tone-2','tone-3','tone-4','tone-5','tone-6','tone-7','tone-8','tone-9'];
const state = {genre:'Все', query:'', availableOnly:false, selectedId:null, rating:0, tab:'catalog'};
let favorites = [];
let toastTimer;

try {
  favorites = JSON.parse(localStorage.getItem('pereplet_favorites') || '[]');
  if (!Array.isArray(favorites)) favorites = [];
} catch { favorites = []; }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function notify(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3300);
}

function bookById(id) {return BOOKS.find(book => book.id === Number(id));}
function isFavorite(id) {return favorites.includes(Number(id));}

function cover(book, withStatus = true) {
  return `<div class="book-cover ${colors[(book.id - 1) % colors.length]}">
    ${withStatus ? `<span class="book-status ${book.available ? '' : 'status-no'}">${book.available ? 'В наличии' : 'Недоступна'}</span>` : ''}
    <span class="cover-eyebrow">ПЕРЕПЛЁТ • КОЛЛЕКЦИЯ</span>
    <span class="cover-motif" aria-hidden="true"></span>
    <span class="cover-title">${escapeHtml(book.title)}</span>
    <span class="cover-by">${escapeHtml(book.author)}</span>
  </div>`;
}

function renderGenres() {
  const genres = ['Все', ...new Set(BOOKS.map(book => book.genre))];
  $('genre-filters').innerHTML = genres.map(genre =>
    `<button type="button" class="chip ${state.genre === genre ? 'selected' : ''}" data-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`
  ).join('');
}

function renderCatalog() {
  const query = state.query.trim().toLocaleLowerCase('ru');
  const books = BOOKS.filter(book =>
    [book.title, book.author, book.genre].some(text => text.toLocaleLowerCase('ru').includes(query)) &&
    (state.genre === 'Все' || book.genre === state.genre) &&
    (!state.availableOnly || book.available)
  );

  $('book-count').textContent = String(BOOKS.length).padStart(2, '0');
  $('results-label').textContent = `Найдено книг: ${books.length}`;
  $('empty-catalog').classList.toggle('hidden', books.length !== 0);
  $('book-grid').innerHTML = books.map(book => `
    <article class="book-card">
      <button class="cover-button" type="button" data-open="${book.id}" aria-label="Открыть ${escapeHtml(book.title)}">${cover(book)}</button>
      <div class="card-meta">
        <span class="card-genre">${escapeHtml(book.genre)}</span>
        <h3 class="card-title">${escapeHtml(book.title)}</h3>
        <p class="card-author">${escapeHtml(book.author)}</p>
        <div class="card-bottom">
          <span class="card-rating">${isFavorite(book.id) ? 'На моей полке' : 'Открыть историю'}</span>
          <button class="card-open" type="button" data-open="${book.id}">Подробнее ↗</button>
        </div>
      </div>
    </article>`).join('');
}

function renderShelf() {
  const saved = BOOKS.filter(book => isFavorite(book.id));
  $('shelf-count').textContent = String(saved.length).padStart(2, '0');
  $('shelf-dot').classList.toggle('hidden', saved.length === 0);
  $('empty-shelf').classList.toggle('hidden', saved.length !== 0);
  $('shelf-list').innerHTML = saved.map(book => `
    <article class="shelf-row">
      <button class="cover-button" type="button" data-open="${book.id}">${cover(book, false)}</button>
      <div class="shelf-row-content">
        <span class="card-genre">${escapeHtml(book.genre)}</span>
        <h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.author)}</p>
        <button class="shelf-action" type="button" data-favorite="${book.id}">Убрать из избранного</button>
      </div>
    </article>`).join('');
}

function renderPicks() {
  // Это редакционная подборка, не рейтинг MySQL.
  const ids = [4, 7, 8, 1, 6];
  $('picks-note').textContent = 'ВЫБОР РЕДАКЦИИ';
  $('picks-list').innerHTML = ids.map((id, index) => {
    const book = bookById(id);
    return `<article class="pick-row" role="button" tabindex="0" data-open="${book.id}">
      ${cover(book, false)}
      <div class="pick-row-content">
        <span class="card-genre">${escapeHtml(book.genre)}</span>
        <h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.author)}</p>
        <span class="card-rating">Посмотреть книгу ↗</span>
      </div><span class="pick-position">${String(index + 1).padStart(2, '0')}</span>
    </article>`;
  }).join('');
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.screen').forEach(node => node.classList.toggle('screen-active', node.id === `screen-${tab}`));
  document.querySelectorAll('[data-tab]').forEach(node => {
    node.classList.toggle('active', node.dataset.tab === tab);
    if (node.dataset.tab === tab) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  if (tab === 'shelf') renderShelf();
  if (tab === 'picks') renderPicks();
  window.scrollTo({top:0, behavior:'smooth'});
}

function renderRating() {
  document.querySelectorAll('#rating-picker [data-rate]').forEach(button => {
    const score = Number(button.dataset.rate);
    button.classList.toggle('lit', score <= state.rating);
    button.setAttribute('aria-pressed', String(score === state.rating));
  });
  $('my-rating-note').textContent = state.rating ? `${state.rating} из 5` : 'Выберите оценку';
}

function openBook(id) {
  const book = bookById(id);
  if (!book) return;
  state.selectedId = book.id;
  state.rating = 0;
  $('detail-cover').innerHTML = cover(book, false);
  $('detail-title').textContent = book.title;
  $('detail-author').textContent = book.author;
  $('detail-genre').textContent = book.genre;
  $('detail-rating').textContent = 'Оценить в Telegram';
  $('detail-availability').textContent = book.available ? 'В наличии по каталогу' : 'Недоступна по каталогу';
  $('reserve-button').disabled = !book.available;
  $('reserve-button').innerHTML = (book.available ? 'Забронировать через бота' : 'Книга недоступна') + ' <span>↗</span>';
  $('favorite-button').textContent = isFavorite(book.id) ? 'Убрать из избранного' : 'Сохранить в избранное';
  renderRating();
  $('book-dialog').showModal();
}

function toggleFavorite(id) {
  const book = bookById(id);
  if (!book) return;
  if (isFavorite(id)) favorites = favorites.filter(value => value !== Number(id));
  else favorites.push(Number(id));
  try {localStorage.setItem('pereplet_favorites', JSON.stringify(favorites));} catch {}
  $('favorite-button').textContent = isFavorite(id) ? 'Убрать из избранного' : 'Сохранить в избранное';
  notify(isFavorite(id) ? 'Добавлено в избранное' : 'Убрано из избранного');
  renderShelf();
  renderCatalog();
}

function sendToBot(payload) {
  // sendData работает при открытии Web App из обычной кнопки Telegram-клавиатуры.
  if (!tg || !tg.initData || typeof tg.sendData !== 'function') {
    notify('Для отправки откройте сайт через кнопку «Открыть библиотеку» в Telegram.');
    return;
  }
  try { tg.sendData(JSON.stringify(payload)); }
  catch { notify('Не удалось передать действие боту. Откройте приложение заново.'); }
}

function bindEvents() {
  $('home-link').addEventListener('click', event => {event.preventDefault(); switchTab('catalog');});
  $('profile-trigger').addEventListener('click', () => switchTab('shelf'));
  $('hero-explore').addEventListener('click', () => $('catalog-anchor').scrollIntoView({behavior:'smooth'}));
  $('search').addEventListener('input', event => {state.query = event.target.value; renderCatalog();});
  $('available-only').addEventListener('change', event => {state.availableOnly = event.target.checked; renderCatalog();});
  $('genre-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-genre]');
    if (!button) return;
    state.genre = button.dataset.genre;
    renderGenres();renderCatalog();
  });
  $('clear-filters').addEventListener('click', () => {
    state.query = '';state.genre='Все';state.availableOnly=false;
    $('search').value='';$('available-only').checked=false;
    renderGenres();renderCatalog();
  });
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  document.querySelectorAll('[data-switch]').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.switch)));
  document.addEventListener('click', event => {
    const open = event.target.closest('[data-open]');
    if (open) {openBook(Number(open.dataset.open));return;}
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) toggleFavorite(Number(favorite.dataset.favorite));
  });
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.pick-row[data-open]')) {
      event.preventDefault();openBook(event.target.dataset.open);
    }
  });
  $('close-dialog').addEventListener('click', () => $('book-dialog').close());
  $('book-dialog').addEventListener('click', event => {if (event.target === $('book-dialog')) $('book-dialog').close();});
  $('rating-picker').addEventListener('click', event => {
    const button = event.target.closest('[data-rate]');
    if (!button) return;
    state.rating = Number(button.dataset.rate);renderRating();
  });
  $('save-rating').addEventListener('click', () => {
    if (state.rating < 1 || state.rating > 5) return notify('Выберите от 1 до 5 звёзд.');
    sendToBot({action:'rate', book_id:state.selectedId, rating:state.rating});
  });
  $('favorite-button').addEventListener('click', () => toggleFavorite(state.selectedId));
  $('reserve-button').addEventListener('click', () => sendToBot({action:'reserve',book_id:state.selectedId}));
  $('send-to-bot').addEventListener('click', () => sendToBot({action:'book',book_id:state.selectedId}));
  $('view-reservations').addEventListener('click', () => sendToBot({action:'reservations'}));
  $('ask-recommendation').addEventListener('click', () => sendToBot({action:'recommend'}));
}

function start() {
  bindEvents();
  const name = tg?.initDataUnsafe?.user?.first_name;
  if (name) $('profile-trigger').textContent = name.charAt(0).toLocaleUpperCase('ru');
  renderGenres();renderCatalog();renderShelf();renderPicks();
}
start();
