const CSV_URL = "https://tight-tooth-b54c.koj31342.workers.dev/csv";

const WORKER_URL = "https://tight-tooth-b54c.koj31342.workers.dev";

const IMG_FALLBACK = "./images/no-image.jpg";

const PAGE_SIZE = 20;

let allData = [];
let filteredData = [];
let page = 0;
let loading = false;

const cache = {};

/* ---------------- FILTER STATE ---------------- */
let filters = {
  year: "",
  network: "",
  era: "",
  owned: "",
};

/* ---------------- CSV ---------------- */
async function fetchCSV() {
  const res = await fetch(CSV_URL);
  const text = await res.text();

  return text
    .trim()
    .split("\n")
    .slice(1)
    .map((r) => {
      const c = r.split(",");

      return {
        id: c[1],
        era: c[2],
        title: c[4],
        version: c[5],
        year: c[6],
        network: c[7],
        opening: c[9],
        tmdb_id: c[10],
      };
    });
}

/* ---------------- TMDB (안정형 fallback) ---------------- */
async function getTMDB(item) {
  let id = item.tmdb_id;
  const cacheKey = id || item.title;

  if (cache[cacheKey]) return cache[cacheKey];

  let data = null;

  try {
    // 🔥 숫자 ID → TV 먼저 시도
    if (id && /^\d+$/.test(id)) {
      let res = await fetch(`${WORKER_URL}/?type=tv&id=${id}`);
      data = await res.json();

      // 실패 시 movie fallback
      if (!data || !data.poster_path) {
        res = await fetch(`${WORKER_URL}/?type=movie&id=${id}`);
        data = await res.json();
      }
    } else {
      // 🔥 검색 fallback
      const res = await fetch(
        `${WORKER_URL}/?query=${encodeURIComponent(item.title)}`,
      );
      data = await res.json();
    }
  } catch (e) {
    console.error("TMDB error:", e);
    data = null;
  }

  const result = data?.results?.[0] || data || null;
  cache[cacheKey] = result;

  return result;
}

/* ---------------- POSTER ---------------- */
function poster(tmdb) {
  if (!tmdb) return IMG_FALLBACK;

  return tmdb.poster_path
    ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`
    : IMG_FALLBACK;
}

/* ---------------- BADGE ---------------- */
function badge(v) {
  return v === "O"
    ? `<span class="badge owned">소유중</span>`
    : `<span class="badge none">없음</span>`;
}

/* ---------------- CARD ---------------- */
function card(item, tmdb) {
  const div = document.createElement("div");
  div.className = "card";

  div.innerHTML = `
    <img src="${poster(tmdb)}" loading="lazy">

    <div class="info">
      <div class="title">
        ${item.title} ${item.version ? `(${item.version})` : ""}
      </div>

      <div class="meta">${item.year} · ${item.network}</div>
      <div class="meta">${item.id} · ${item.era}</div>
      <div>${badge(item.opening)}</div>
    </div>
  `;

  return div;
}

/* ---------------- SKELETON ---------------- */
function addSkeletons(items) {
  const grid = document.getElementById("grid");

  return items.map(() => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="skeleton"></div>`;
    grid.appendChild(div);
    return div;
  });
}

/* ---------------- LOAD MORE ---------------- */
async function loadMore() {
  if (loading) return;
  loading = true;

  const start = page * PAGE_SIZE;
  const next = filteredData.slice(start, start + PAGE_SIZE);

  if (next.length === 0) {
    loading = false;
    return;
  }

  const placeholders = addSkeletons(next);

  const results = await Promise.all(
    next.map(async (item) => {
      const tmdb = await getTMDB(item);
      return { item, tmdb };
    }),
  );

  results.forEach((r, i) => {
    placeholders[i].replaceWith(card(r.item, r.tmdb));
  });

  page++;
  loading = false;
}

/* ---------------- RESET ---------------- */
function reset(data) {
  filteredData = data;
  page = 0;

  document.getElementById("grid").innerHTML = "";

  loading = false;

  loadMore();
}

/* ---------------- SEARCH ---------------- */
function match(item, v) {
  if (!v) return true;

  const q = v.replace(/\s/g, "").toLowerCase();

  return (
    (item.title || "").replace(/\s/g, "").toLowerCase().includes(q) ||
    (item.year || "").includes(q) ||
    (item.network || "").toLowerCase().includes(q) ||
    (item.id || "").toLowerCase().includes(q) ||
    (item.era || "").toLowerCase().includes(q)
  );
}

/* ---------------- FILTER APPLY ---------------- */
function applyFilters(data) {
  return data.filter((item) => {
    return (
      (!filters.year || item.year === filters.year) &&
      (!filters.network || item.network === filters.network) &&
      (!filters.era || item.era === filters.era) &&
      (!filters.owned || item.opening === filters.owned)
    );
  });
}

/* ---------------- UPDATE VIEW ---------------- */
function updateView() {
  let data = allData;

  const query = document.getElementById("search").value;

  data = data.filter((x) => match(x, query));
  data = applyFilters(data);

  reset(data);
}

/* ---------------- SCROLL ---------------- */
window.addEventListener("scroll", () => {
  if (loading) return;

  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadMore();
  }
});

/* ---------------- FILTER INIT (자동 생성) ---------------- */
function initFilters(data) {
  const yearEl = document.getElementById("filterYear");
  const eraEl = document.getElementById("filterEra");
  const networkEl = document.getElementById("filterNetwork");

  const years = [...new Set(data.map((d) => d.year))].sort();
  const eras = [...new Set(data.map((d) => d.era))];
  const networks = [...new Set(data.map((d) => d.network))];

  years.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearEl.appendChild(opt);
  });

  eras.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    eraEl.appendChild(opt);
  });

  networks.forEach((n) => {
    if (!n) return;

    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    networkEl.appendChild(opt);
  });
}

/* ---------------- EVENTS ---------------- */
document.getElementById("search").addEventListener("input", updateView);

document.getElementById("filterYear").addEventListener("change", (e) => {
  filters.year = e.target.value;
  updateView();
});

document.getElementById("filterNetwork").addEventListener("change", (e) => {
  filters.network = e.target.value;
  updateView();
});

document.getElementById("filterEra").addEventListener("change", (e) => {
  filters.era = e.target.value;
  updateView();
});

document.getElementById("filterOwned").addEventListener("change", (e) => {
  filters.owned = e.target.value;
  updateView();
});

/* ---------------- INIT ---------------- */
async function init() {
  allData = await fetchCSV();

  initFilters(allData);

  reset(allData);
}

init();
