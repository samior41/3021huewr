(() => {
  "use strict";

  const MESSAGE_SELECTOR = ".ttobot-content-text";
  const STATUS_SELECTOR = ".ttobot-status";
  const SEARCH_PARAM = "search";
  const MATCH_PARAM = "match";

  const normalize = (text) =>
    String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("ko-KR");

  const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    }[ch]));

  const escapeRegExp = text =>
    String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function getLogLinks() {
    const manifest = window.ENTY_MANIFEST;
    if (manifest?.logs?.length) {
      return manifest.logs.map(log => ({ href: log.file, title: log.label }));
    }
    return [...document.querySelectorAll(".index-list a[href]")]
      .map(a => ({ href: a.getAttribute("href"), title: a.textContent.trim() }));
  }

  function makeSnippet(text, query) {
    const source = String(text).replace(/\s+/g, " ").trim();
    const lower = source.toLocaleLowerCase("ko-KR");
    const q = String(query).toLocaleLowerCase("ko-KR");
    const at = lower.indexOf(q);

    if (at < 0) return escapeHtml(source.slice(0, 180));

    const start = Math.max(0, at - 80);
    const end = Math.min(source.length, at + query.length + 120);
    let snippet = source.slice(start, end);
    if (start > 0) snippet = "…" + snippet;
    if (end < source.length) snippet += "…";

    const escaped = escapeHtml(snippet);
    return escaped.replace(
      new RegExp(escapeRegExp(escapeHtml(query)), "gi"),
      m => `<mark>${m}</mark>`
    );
  }

  function installStyles() {
    if (document.getElementById("enty-search-style")) return;

    const style = document.createElement("style");
    style.id = "enty-search-style";
    style.textContent = `
      .enty-search {
        margin: 0 0 1.5rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-card);
        box-shadow: var(--shadow);
      }
      .enty-search-form { display:flex; gap:.5rem; }
      .enty-search-input {
        flex:1; min-width:0; padding:.75rem .9rem;
        border:1px solid var(--border); border-radius:var(--radius);
        background:var(--bg-card-alt); color:var(--text);
        font:inherit; outline:none;
      }
      .enty-search-input:focus { border-color:var(--accent-point); }
      .enty-search-button {
        padding:.75rem 1rem; border:1px solid var(--border);
        border-radius:var(--radius); background:var(--bg-card-alt);
        color:var(--text); font:inherit; font-weight:600; cursor:pointer;
      }
      .enty-search-button:hover { border-color:var(--accent-point); }
      .enty-search-panel[hidden] { display:none; }
      .enty-search-status { color:var(--text-muted); font-size:.85rem; }
      .enty-search-results { display:flex; flex-direction:column; gap:.55rem; margin-top:.7rem; }
      .enty-search-result {
        display:block; padding:.75rem .9rem;
        border:1px solid var(--border); border-radius:var(--radius);
        color:var(--text); text-decoration:none; background:var(--bg-card-alt);
      }
      .enty-search-result:hover { border-color:var(--accent-point); }
      .enty-search-result-title { margin-bottom:.25rem; color:var(--text-muted); font-size:.8rem; }
      .enty-search-result-text { line-height:1.55; }
      .enty-search mark {
        padding:0 .1em; border-radius:3px;
        background:var(--mark-bg); color:var(--mark-text);
      }
      .enty-search-target {
        scroll-margin-top: 2rem;
        outline: 3px solid var(--accent-point) !important;
        outline-offset: 4px;
        border-radius: 6px;
      }
      @media (max-width:480px) {
        .enty-search-form { flex-direction:column; }
        .enty-search-button { width:100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function makeSearchBox() {
    const isReader = document.body.classList.contains("reader-page");
    if (!isReader && !document.body.classList.contains("index-page")) return;
    if (document.querySelector(".enty-search")) return;

    installStyles();

    const box = document.createElement("section");
    box.className = "enty-search";
    box.innerHTML = `
      <form class="enty-search-form">
        <input class="enty-search-input" type="search"
               placeholder="로그 내용 검색" autocomplete="off"
               aria-label="로그 내용 검색">
        <button class="enty-search-button" type="submit">검색</button>
      </form>
      <div class="enty-search-panel" hidden>
        <div class="enty-search-status" aria-live="polite"></div>
        <div class="enty-search-results"></div>
      </div>
    `;

    if (isReader) {
      document.querySelector(".reader-search-slot")?.appendChild(box);
    } else {
      const wrap = document.querySelector(".index-wrap");
      const nav = document.querySelector(".index-nav");
      if (wrap) {
        if (nav) wrap.insertBefore(box, nav);
        else wrap.prepend(box);
      }
    }

    const form = box.querySelector("form");
    const input = box.querySelector("input");
    const panel = box.querySelector(".enty-search-panel");

    const closePanel = () => {
      panel.hidden = true;
      box.querySelector(".enty-search-results").innerHTML = "";
      box.querySelector(".enty-search-status").textContent = "";
    };

    form.addEventListener("submit", e => {
      e.preventDefault();
      runSearch(input.value.trim(), box);
    });

    input.addEventListener("input", () => {
      if (!input.value.trim()) closePanel();
    });

    input.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      input.value = "";
      closePanel();
    });

    document.addEventListener("click", e => {
      if (panel.hidden) return;
      if (e.target.closest(".enty-search-result")) closePanel();
      else if (!e.target.closest(".enty-search")) closePanel();
    });

    const query = new URLSearchParams(location.search).get(SEARCH_PARAM);
    if (query) {
      input.value = query;
      runSearch(query, box);
    }
  }

  async function runSearch(query, box) {
    const status = box.querySelector(".enty-search-status");
    const results = box.querySelector(".enty-search-results");
    const panel = box.querySelector(".enty-search-panel");
    results.innerHTML = "";

    if (!query) {
      panel.hidden = true;
      status.textContent = "";
      return;
    }

    panel.hidden = false;

    const links = getLogLinks();
    if (!links.length) {
      status.textContent = "검색할 로그가 없습니다.";
      return;
    }

    status.textContent = `전체 ${links.length}개 로그 검색 중…`;

    const found = [];

    await Promise.all(links.map(async (log, fileIndex) => {
      try {
        const response = await fetch(log.href, { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const messages = [...doc.querySelectorAll(MESSAGE_SELECTOR)];

        let matchNo = 0;

        messages.forEach((message, messageIndex) => {
          const text = message.textContent.trim();
          if (!normalize(text).includes(normalize(query))) return;

          const card = message.closest(STATUS_SELECTOR);
          const name = card?.querySelector(".ttobot-name")?.textContent.trim() || "";
          const time = card?.querySelector(".ttobot-time")?.textContent.trim() || "";

          found.push({
            fileIndex, messageIndex, matchNo,
            href: log.href,
            title: log.title || doc.title || log.href,
            name, time, text
          });

          matchNo++;
        });
      } catch (error) {
        console.error("ENTY 검색 실패:", log.href, error);
      }
    }));

    found.sort((a,b) => a.fileIndex - b.fileIndex || a.messageIndex - b.messageIndex);

    if (!found.length) {
      status.textContent = `"${query}" 검색 결과가 없습니다.`;
      return;
    }

    status.textContent = `"${query}" 검색 결과 ${found.length}건`;

    for (const item of found) {
      const a = document.createElement("a");
      a.className = "enty-search-result";
      a.href =
        `${item.href}?${SEARCH_PARAM}=${encodeURIComponent(query)}` +
        `&${MATCH_PARAM}=${item.messageIndex}`;

      a.innerHTML = `
        <div class="enty-search-result-title">
          ${escapeHtml(item.title)}
          ${item.name ? " · " + escapeHtml(item.name) : ""}
          ${item.time ? " · " + escapeHtml(item.time) : ""}
        </div>
        <div class="enty-search-result-text">${makeSnippet(item.text, query)}</div>
      `;

      results.appendChild(a);
    }
  }

  function jumpToSearchResult() {
    const params = new URLSearchParams(location.search);
    const query = params.get(SEARCH_PARAM);
    const messageIndex = Number.parseInt(params.get(MATCH_PARAM) || "", 10);

    if (!query || !Number.isInteger(messageIndex)) return;

    installStyles();

    const messages = [...document.querySelectorAll(MESSAGE_SELECTOR)];
    const target = messages[messageIndex];

    if (!target) return;

    const card = target.closest(STATUS_SELECTOR) || target;
    card.classList.add("enty-search-target");

    const jump = () => card.scrollIntoView({
      behavior: "auto",
      block: "center"
    });

    if (document.readyState === "complete") {
      setTimeout(jump, 50);
    } else {
      window.addEventListener("load", () => setTimeout(jump, 50), { once: true });
    }
  }

  function init() {
    installStyles();
    makeSearchBox();
    jumpToSearchResult();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();