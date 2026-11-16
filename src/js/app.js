import { inject } from '@vercel/analytics';

inject();
import '../styles/main.css';
import * as TMDB from './api/tmdb.js';
import { getList, toggleList, getProgress, trackProgress } from './utils/storage.js';

const $ = (id) => document.getElementById(id);

const state = {
  hero: null,
  heroItems: [],
  heroIndex: 0,
  heroTimer: null,
  currentDetail: null,
  currentCollection: [],
  searchTimer: null,
  season: 1,
  playerItem: null
};

const titleOf = (item) => item.title || item.name || 'Untitled';
const typeOf = (item) => item.media_type || (item.first_air_date || item.name ? 'tv' : 'movie');
const yearOf = (item) => (item.release_date || item.first_air_date || '').slice(0, 4) || '—';
const ratingOf = (item) => Number(item.vote_average || 0).toFixed(1);

const safe = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const fallbackPoster = (name) =>
  `<div class="poster-fallback">${safe((name || 'C').slice(0, 1).toUpperCase())}</div>`;

function toast(message) {
  const node = $('toast');
  if (!node) return;

  node.textContent = message;
  node.classList.add('show');

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2300);
}

function itemKey(item) {
  return `${typeOf(item)}-${item.id}`;
}

function posterCard(item) {
  const type = typeOf(item);
  const title = titleOf(item);
  const saved = getList().some((entry) => itemKey(entry) === itemKey(item));
  const poster = TMDB.img(item.poster_path, 'w342');

  return `
    <article class="poster-card" data-open="${safe(item.id)}" data-type="${type}">
      <div class="poster-image-wrap">
        ${poster
          ? `<img class="poster-image" loading="lazy" src="${poster}" alt="${safe(title)} poster" onerror="this.style.display='none'">`
          : fallbackPoster(title)}
        <span class="poster-rating">★ ${ratingOf(item)}</span>
        <span class="poster-type">${type === 'tv' ? 'SERIES' : 'FILM'}</span>
        <div class="poster-actions">
          <button class="save-mini ${saved ? 'saved' : ''}"
            data-save="${safe(item.id)}"
            data-type="${type}"
            aria-label="${saved ? 'Remove from' : 'Add to'} My List">
            ${saved ? '✓' : '+'}
          </button>
        </div>
      </div>
      <h3 class="poster-title">${safe(title)}</h3>
      <div class="poster-sub">
        <span>${yearOf(item)}</span><span>·</span>
        <span>${type === 'tv' ? 'Series' : 'Movie'}</span>
      </div>
    </article>`;
}

function renderRow(id, items, emptyText = 'No titles to show yet.') {
  const el = $(id);
  if (!el) return;

  el.innerHTML = items?.length
    ? items.map(posterCard).join('')
    : `<p class="empty-message">${emptyText}</p>`;
}

function bindCardEvents(root = document) {
  if (!root) return;

  root.querySelectorAll('[data-open]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-save]')) return;
      openDetails(card.dataset.type, card.dataset.open);
    });
  });

  root.querySelectorAll('[data-save]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();

      const type = button.dataset.type;
      const id = Number(button.dataset.save);

      const source = {
        id,
        media_type: type,
        title: button.closest('[data-open]')?.querySelector('.poster-title')?.textContent || 'Saved title'
      };

      const added = toggleList(source);
      toast(added ? 'Added to My List' : 'Removed from My List');
      refreshSavedRows();
    });
  });
}

function refreshSavedRows() {
  const list = getList();

  if ($('my-list')) $('my-list').classList.toggle('is-hidden', !list.length);

  renderRow('myListRow', list, 'Your watchlist is waiting for its first story.');
  bindCardEvents($('myListRow'));

  const progress = getProgress();

  if ($('continueSection')) {
    $('continueSection').classList.toggle('is-hidden', !progress.length);
  }

  renderRow('continueRow', progress, 'Your viewing journey will appear here.');
  bindCardEvents($('continueRow'));
}

async function loadHome() {
  const jobs = [
    ['trendingRow', TMDB.getTrending()],
    ['moviesRow', TMDB.getPopularMovies()],
    ['tvRow', TMDB.getPopularTV()],
    ['topRatedRow', TMDB.getTopRated()],
    ['upcomingRow', TMDB.getUpcoming()]
  ];

  const results = await Promise.allSettled(jobs.map((job) => job[1]));

  results.forEach((result, index) => {
    const [target] = jobs[index];
    const element = $(target);

    if (!element) return;

    if (result.status === 'fulfilled') {
      const items = (result.value.results || []).map((item) => ({
        ...item,
        media_type: item.media_type || (target === 'tvRow' ? 'tv' : 'movie')
      }));

      renderRow(target, items);
      bindCardEvents(element);

      if (target === 'trendingRow') {
        setHero(items.filter((item) => item.backdrop_path).slice(0, 4));
      }
    } else {
      element.innerHTML = `<p class="error-message">${safe(result.reason?.message || 'Could not load titles. Check your TMDB setup.')}</p>`;
    }
  });

  refreshSavedRows();
}

function setHero(items) {
  if (!items.length) return;

  state.heroItems = items;
  state.heroIndex = 0;
  showHero(0);

  if (state.heroTimer) clearInterval(state.heroTimer);

  state.heroTimer = setInterval(() => {
    showHero((state.heroIndex + 1) % state.heroItems.length);
  }, 9000);
}

function showHero(index) {
  const item = state.heroItems?.[index];
  if (!item) return;

  state.heroIndex = index;
  state.hero = item;

  const bg = $('heroBackdrop');
  if (bg) {
    bg.classList.remove('loaded');

    const url = TMDB.backdrop(item.backdrop_path, 'original');
    bg.style.backgroundImage = url ? `url("${url}")` : '';

    requestAnimationFrame(() => bg.classList.add('loaded'));
  }

  $('heroKicker').textContent = typeOf(item) === 'tv'
    ? 'A SERIES TO GET LOST IN'
    : 'A STORY WORTH GETTING LOST IN';

  $('heroTitle').innerHTML = safe(titleOf(item))
    .replace(/\s+/, '<br/><em>') +
    (titleOf(item).includes(' ') ? '</em>' : '');

  $('heroOverview').textContent = item.overview ||
    'Discover a new world and let the story take you somewhere unexpected.';

  $('heroMeta').innerHTML = `
    <span>${typeOf(item) === 'tv' ? 'SERIES' : 'FEATURE FILM'}</span>
    <span class="meta-dot"></span>
    <span>${yearOf(item)}</span>
    <span class="meta-dot"></span>
    <span>★ ${ratingOf(item)}</span>`;
}

async function openDetails(type, id) {
  $('detailModal').classList.remove('is-hidden');
  $('detailContent').innerHTML = `
    <div class="detail-body">
      <div class="loading-line"></div>
      <p class="empty-message">Gathering the story...</p>
    </div>`;

  try {
    const item = await TMDB.getDetails(type, id);
    item.media_type = type;
    state.currentDetail = item;

    const title = titleOf(item);
    const bg = TMDB.backdrop(item.backdrop_path, 'w1280');
    const genres = (item.genres || []).map((g) => g.name).join(' · ');

    const trailer = (item.videos?.results || []).find(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );

    const saved = getList().some((entry) => itemKey(entry) === itemKey(item));

    $('detailContent').innerHTML = `
      <div class="detail-hero" style="background-image:url('${bg}')">
        <div class="detail-hero-content">
          <span class="section-kicker">CINORA PRESENTS · ${type === 'tv' ? 'ORIGINAL SERIES' : 'FEATURE FILM'}</span>
          <h2>${safe(title)}</h2>
          <div class="detail-meta">
            <span>★ ${ratingOf(item)} / 10</span>
            <span>${yearOf(item)}</span>
            <span>${safe(genres || 'Discover')}</span>
            ${item.runtime ? `<span>${item.runtime} MIN</span>` : ''}
          </div>
        </div>
      </div>
      <div class="detail-body">
        <p class="detail-overview">${safe(item.overview || 'A story waiting to be discovered.')}</p>
        <div class="detail-actions">
          <button class="detail-action" id="detailWatch">
            ${type === 'tv' ? 'EXPLORE EPISODES' : 'WATCH NOW'} ↗
          </button>
          <button class="detail-action secondary" id="detailSave">
            ${saved ? '✓ IN MY LIST' : '+ ADD TO MY LIST'}
          </button>
          ${trailer ? '<button class="detail-action secondary" id="detailTrailer">▶ WATCH TRAILER</button>' : ''}
        </div>

        ${item.credits?.cast?.length ? `
          <h3 class="detail-section-title">The cast</h3>
          <div class="cast-row">
            ${item.credits.cast.slice(0, 12).map((person) => `
              <div class="cast-person">
                ${person.profile_path
                  ? `<img loading="lazy" src="${TMDB.img(person.profile_path, 'w185')}" alt="${safe(person.name)}">`
                  : '<div style="height:100px;background:#222"></div>'}
                <b>${safe(person.name)}</b>
                <small>${safe(person.character || '')}</small>
              </div>
            `).join('')}
          </div>` : ''}
        <div id="seasonArea"></div>
      </div>`;

    $('detailWatch').addEventListener('click', () =>
      type === 'tv' ? loadSeasonOptions(item) : openPlayer(item)
    );

    $('detailSave').addEventListener('click', () => {
      const added = toggleList({
        id: item.id,
        media_type: type,
        title,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path
      });

      $('detailSave').textContent = added ? '✓ IN MY LIST' : '+ ADD TO MY LIST';
      toast(added ? 'Added to My List' : 'Removed from My List');
      refreshSavedRows();
    });

    if (trailer) {
      $('detailTrailer').addEventListener('click', () => openTrailer(trailer.key, title));
    }

    if (type === 'tv') await loadSeasonOptions(item);

  } catch (error) {
    $('detailContent').innerHTML =
      `<div class="detail-body"><p class="error-message">${safe(error.message)}</p></div>`;
  }
}

async function loadSeasonOptions(item) {
  const area = $('seasonArea');
  if (!area) return;

  const seasons = (item.seasons || []).filter((season) => season.season_number >= 0);

  if (!seasons.length) {
    area.innerHTML = '<p class="empty-message">No episode information is available.</p>';
    return;
  }

  area.innerHTML = `
    <h3 class="detail-section-title">Episodes</h3>
    <select id="seasonSelect" class="season-select">
      ${seasons.map((s) => `
        <option value="${s.season_number}">${safe(s.name || `Season ${s.season_number}`)}</option>
      `).join('')}
    </select>
    <div id="episodeList" class="episode-list">
      <div class="loading-line"></div>
    </div>`;

  const select = $('seasonSelect');

  select.addEventListener('change', () =>
    loadEpisodes(item, Number(select.value))
  );

  await loadEpisodes(item, seasons[0].season_number);
}

async function loadEpisodes(item, seasonNumber) {
  const list = $('episodeList');
  if (!list) return;

  list.innerHTML = '<div class="loading-line"></div>';

  try {
    const season = await TMDB.getSeason(item.id, seasonNumber);

    list.innerHTML = (season.episodes || []).map((episode) => `
      <article class="episode-item"
        data-episode="${episode.episode_number}"
        data-season="${seasonNumber}">
        ${episode.still_path
          ? `<img loading="lazy" src="${TMDB.img(episode.still_path, 'w300')}" alt="">`
          : '<div style="height:58px;background:#252327"></div>'}
        <div>
          <b>${episode.episode_number}. ${safe(episode.name)}</b>
          <p>${safe(episode.overview || 'Continue the story with this episode.')}</p>
        </div>
        <span>▶ PLAY</span>
      </article>
    `).join('') || '<p class="empty-message">No episodes listed for this season.</p>';

    list.querySelectorAll('[data-episode]').forEach((episodeNode) => {
      episodeNode.addEventListener('click', () => {
        openPlayer(
          item,
          Number(episodeNode.dataset.season),
          Number(episodeNode.dataset.episode),
          season.episodes
        );
      });
    });

  } catch (error) {
    list.innerHTML = `<p class="error-message">${safe(error.message)}</p>`;
  }
}

// Original CINORA playback provider.
const PLAYER_PROVIDER = {
  movie: 'https://vaplayer.ru/embed/movie/{id}',
  tv: 'https://vaplayer.ru/embed/tv/{id}/{season}/{episode}'
};

function buildPlayerUrl(item, season, episode) {
  const template = typeOf(item) === 'tv'
    ? PLAYER_PROVIDER.tv
    : PLAYER_PROVIDER.movie;

  return template
    .replaceAll('{id}', encodeURIComponent(item.id))
    .replaceAll('{season}', encodeURIComponent(season ?? 1))
    .replaceAll('{episode}', encodeURIComponent(episode ?? 1));
}

function openPlayer(item, season = null, episode = null, episodes = []) {
  state.playerItem = { item, season, episode, episodes };

  $('playerTitle').textContent =
    `${titleOf(item)}${season !== null ? ` — S${season} E${episode}` : ''}`;

  const url = buildPlayerUrl(item, season, episode);

  $('playerFrameWrap').innerHTML = `
    <div class="player-loading" id="playerLoading">
      <div class="loading-line"></div>
      <p>PREPARING YOUR CINEMATIC EXPERIENCE</p>
    </div>
    <iframe
      src="${safe(url)}"
      title="${safe(titleOf(item))}"
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      loading="eager">
    </iframe>`;

  const frame = $('playerFrameWrap').querySelector('iframe');

  frame.addEventListener('load', () => {
    $('playerLoading')?.remove();
  });

  trackProgress({
    id: item.id,
    media_type: typeOf(item),
    title: titleOf(item),
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path
  }, season, episode);

  refreshSavedRows();

  $('episodeControls').innerHTML = season === null
    ? '<span class="empty-message">Movie playback</span>'
    : `
      <button id="prevEpisode">← PREVIOUS EPISODE</button>
      <span class="empty-message">SEASON ${season} · EPISODE ${episode}</span>
      <button id="nextEpisode">NEXT EPISODE →</button>`;

  if (season !== null) {
    const index = episodes.findIndex((ep) => ep.episode_number === episode);

    $('prevEpisode')?.addEventListener('click', () => {
      if (index > 0) {
        openPlayer(item, season, episodes[index - 1].episode_number, episodes);
      } else {
        toast('This is the first listed episode.');
      }
    });

    $('nextEpisode')?.addEventListener('click', () => {
      if (index >= 0 && index < episodes.length - 1) {
        openPlayer(item, season, episodes[index + 1].episode_number, episodes);
      } else {
        toast('No next episode in this season.');
      }
    });
  }

  $('detailModal').classList.add('is-hidden');
  $('playerModal').classList.remove('is-hidden');
}

function openTrailer(key, title) {
  $('playerTitle').textContent = `${title} — Official Trailer`;

  $('playerFrameWrap').innerHTML = `
    <iframe
      src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1"
      title="${safe(title)} trailer"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen>
    </iframe>`;

  $('episodeControls').innerHTML =
    '<span class="empty-message">Official trailer</span>';

  $('detailModal').classList.add('is-hidden');
  $('playerModal').classList.remove('is-hidden');
}

function closePlayer() {
  $('playerModal').classList.add('is-hidden');
  $('playerFrameWrap').innerHTML = '';
  state.playerItem = null;
}

async function runSearch(query) {
  const results = $('searchResults');

  if (!query.trim()) {
    results.innerHTML = '';
    return;
  }

  results.innerHTML = '<div class="loading-line"></div>';

  try {
    const data = await TMDB.searchTitles(query);
    const items = (data.results || []).filter(
      (item) => item.media_type === 'movie' || item.media_type === 'tv'
    );

    results.innerHTML = items.length
      ? items.slice(0, 18).map(posterCard).join('')
      : '<p class="empty-message">No stories found. Try another title.</p>';

    bindCardEvents(results);

  } catch (error) {
    results.innerHTML = `<p class="error-message">${safe(error.message)}</p>`;
  }
}

async function openCollection(kind) {
  const map = {
    trending: ['Trending now', TMDB.getTrending],
    'popular-movies': ['Popular movies', TMDB.getPopularMovies],
    'popular-tv': ['Popular series', TMDB.getPopularTV],
    'top-rated': ['Critically loved', TMDB.getTopRated],
    upcoming: ['Coming soon', TMDB.getUpcoming]
  };

  const [title, loader] = map[kind] || map.trending;

  $('collectionTitle').textContent = title;
  $('collectionGrid').innerHTML = '<div class="loading-line"></div>';
  $('collectionModal').classList.remove('is-hidden');

  try {
    const data = await loader(1);

    const items = (data.results || []).map((item) => ({
      ...item,
      media_type: item.media_type || (kind === 'popular-tv' ? 'tv' : 'movie')
    }));

    state.currentCollection = items;
    $('collectionGrid').innerHTML = items.map(posterCard).join('');
    bindCardEvents($('collectionGrid'));

  } catch (error) {
    $('collectionGrid').innerHTML =
      `<p class="error-message">${safe(error.message)}</p>`;
  }
}

function closeDetails() {
  $('detailModal').classList.add('is-hidden');
  state.currentDetail = null;
}

function closeCollection() {
  $('collectionModal').classList.add('is-hidden');
}

function startApp() {
  const app = $('app');
  const intro = $('intro');

  app.classList.remove('is-hidden');

  requestAnimationFrame(() => app.classList.remove('booting'));

  const finish = () => {
    if (!intro || intro.classList.contains('leaving')) return;

    intro.classList.add('leaving');
    setTimeout(() => intro.remove(), 1100);
  };

  $('skipIntro').addEventListener('click', finish);
  setTimeout(finish, 4800);

  $('heroExplore').addEventListener('click', () =>
    state.hero && openDetails(typeOf(state.hero), state.hero.id)
  );

  $('heroInfo').addEventListener('click', () =>
    state.hero && openDetails(typeOf(state.hero), state.hero.id)
  );

  $('detailClose').addEventListener('click', closeDetails);
  $('modalBackdrop').addEventListener('click', closeDetails);
  $('playerClose').addEventListener('click', closePlayer);
  $('collectionClose').addEventListener('click', closeCollection);

  $('searchToggle').addEventListener('click', () => {
    $('searchPanel').classList.toggle('is-hidden');
    $('searchInput').focus();
  });

  $('searchClose').addEventListener('click', () => {
    $('searchPanel').classList.add('is-hidden');
    $('searchInput').value = '';
    $('searchResults').innerHTML = '';
  });

  $('searchInput').addEventListener('input', (event) => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(
      () => runSearch(event.target.value),
      350
    );
  });

  document.querySelectorAll('[data-see-all]').forEach((button) => {
    button.addEventListener('click', () => openCollection(button.dataset.seeAll));
  });

  $('profileButton').addEventListener('click', () =>
    toast('CINORA · Created by Sage Dickson')
  );

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach((n) => n.classList.remove('active'));
      link.classList.add('active');
    });
  });

  $('genreGrid').addEventListener('click', async (event) => {
    const tile = event.target.closest('.genre-tile');
    if (!tile) return;

    const name = tile.childNodes[0].textContent.trim();

    try {
      const [movies, tv] = await Promise.all([
        TMDB.getGenres('movie'),
        TMDB.getGenres('tv')
      ]);

      const genre = [...(movies.genres || []), ...(tv.genres || [])]
        .find((g) => g.name.toLowerCase() === name.toLowerCase());

      if (!genre) return;

      $('collectionTitle').textContent = `${name} stories`;
      $('collectionGrid').innerHTML = '<div class="loading-line"></div>';
      $('collectionModal').classList.remove('is-hidden');

      const type = (movies.genres || []).some((g) => g.id === genre.id)
        ? 'movie'
        : 'tv';

      const data = await TMDB.discoverGenre(type, genre.id);

      $('collectionGrid').innerHTML = (data.results || [])
        .map((item) => posterCard({ ...item, media_type: type }))
        .join('');

      bindCardEvents($('collectionGrid'));

    } catch (error) {
      toast(error.message);
    }
  });

  loadHome();
}

startApp();
