(() => {
  "use strict";

  const BRAND_KEY = "enty-brand";
  const IMAGE_KEY = "enty-avatars";

  const SIZES = { banner: 1280, portrait: 640 };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  function start() {
    const MANIFEST = window.ENTY_MANIFEST;
    if (!MANIFEST) return;

    const reader = document.getElementById("reader");
    if (!reader) return;

    const frame = document.getElementById("reader-frame");
    const empty = document.getElementById("reader-empty");
    const title = document.getElementById("reader-title");
    const sub = document.getElementById("reader-sub");
    const back = document.getElementById("reader-back");
    const picker = document.getElementById("reader-picker");
    const banner = document.querySelector("[data-banner]");
    let pair = document.getElementById("reader-pair");

    const wide = matchMedia("(min-width: 64rem)");

    const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));

    const clockOf = stamp => {
      const match = String(stamp || "").match(/(오전|오후)\s*(\d{1,2}):(\d{2})/);
      return match ? `${match[1]} ${Number(match[2])}:${match[3]}` : "";
    };

    const readJson = key => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "{}");
        return value && typeof value === "object" ? value : {};
      } catch {
        return {};
      }
    };

    const writeJson = (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    };

    let brand = readJson(BRAND_KEY);
    let images = readJson(IMAGE_KEY);

    const nameOf = id =>
      brand.names?.[id] || MANIFEST.characters[id]?.names?.[0] || id;

    function shrink(file, max) {
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
        fileReader.onload = () => {
          const image = new Image();
          image.onerror = () => reject(new Error("이미지를 열지 못했습니다."));
          image.onload = () => {
            const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(image.naturalWidth * scale);
            canvas.height = Math.round(image.naturalHeight * scale);
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            let url = canvas.toDataURL("image/webp", 0.82);
            if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", 0.85);
            resolve(url);
          };
          image.src = fileReader.result;
        };
        fileReader.readAsDataURL(file);
      });
    }

    let pendingSlot = null;

    function pick(slot) {
      pendingSlot = slot;
      picker.value = "";
      picker.click();
    }

    picker?.addEventListener("change", async () => {
      const file = picker.files?.[0];
      if (!file || !pendingSlot) return;
      const slot = pendingSlot;
      pendingSlot = null;

      try {
        images[slot] = await shrink(file, slot === "banner" ? SIZES.banner : SIZES.portrait);
        if (!writeJson(IMAGE_KEY, images)) {
          alert("저장 공간이 부족해 이번 방문에만 적용됩니다.");
        }
        paintImages();
      } catch (error) {
        alert(error.message);
      }
    });

    function paintImages() {
      banner.style.backgroundImage = images.banner ? `url("${images.banner}")` : "";
      banner.dataset.set = String(Boolean(images.banner));

      for (const button of document.querySelectorAll("[data-portrait]")) {
        const url = images[`portrait:${button.dataset.portrait}`];
        button.style.backgroundImage = url ? `url("${url}")` : "";
        button.dataset.set = String(Boolean(url));
      }
    }

    banner.addEventListener("click", () => pick("banner"));
    for (const button of document.querySelectorAll("[data-portrait]")) {
      button.addEventListener("click", () => pick(`portrait:${button.dataset.portrait}`));
    }

    function paintNames() {
      pair.textContent = brand.pair || "ENTY";
      document.title = brand.pair || "ENTY";
      for (const node of document.querySelectorAll("[data-name]")) {
        node.textContent = nameOf(node.dataset.name);
      }
      for (const button of document.querySelectorAll("[data-portrait]")) {
        button.setAttribute("aria-label", `${nameOf(button.dataset.portrait)} 이미지 바꾸기`);
      }
    }

    pair.addEventListener("click", () => {
      const input = document.createElement("input");
      input.className = "reader-pair-input";
      input.value = brand.pair || "ENTY";
      input.maxLength = 40;
      input.setAttribute("aria-label", "페어명");

      let settled = false;
      const commit = save => {
        if (settled) return;
        settled = true;
        if (save) {
          brand.pair = input.value.trim() || "ENTY";
          writeJson(BRAND_KEY, brand);
        }
        input.replaceWith(pair);
        paintNames();
      };

      input.addEventListener("keydown", event => {
        if (event.key === "Enter") commit(true);
        if (event.key === "Escape") commit(false);
      });
      input.addEventListener("blur", () => commit(true));

      pair.replaceWith(input);
      input.focus();
      input.select();
    });

    const byFile = new Map(MANIFEST.logs.map(log => [log.file, log]));

    function paintLists() {
      for (const box of document.querySelectorAll("[data-list]")) {
        const character = box.dataset.list;
        const mine = MANIFEST.logs.filter(log => log.character === character);

        if (!mine.length) {
          box.innerHTML =
            `<p class="reader-none">${escapeHtml(nameOf(character))}이(가) 시작한 대화가 없습니다.</p>`;
          continue;
        }

        let month = null;
        const parts = [];

        for (const log of mine) {
          if (log.month !== month) {
            month = log.month;
            parts.push(`<div class="reader-month">${month}월</div>`);
          }
          const gens = Object.entries(log.gens)
            .map(([name, gen]) => `${nameOf(name)} ${gen}번`).join(", ");

          parts.push(`
            <button type="button" class="reader-item" data-file="${escapeHtml(log.file)}"
                    title="${escapeHtml(log.label)} · 메시지 ${log.count}개 · 프로필 ${escapeHtml(gens)}"
                    aria-current="false">
              <span class="reader-avatar" style="background-image:url('${escapeHtml(log.avatar)}')"></span>
              <span class="reader-line">${escapeHtml(log.text)}</span>
              <span class="reader-when">${escapeHtml(log.label)} ${escapeHtml(clockOf(log.stamp))}</span>
              <span class="reader-badge">${log.count.toLocaleString("ko-KR")}</span>
            </button>
          `);
        }
        box.innerHTML = parts.join("");
      }
      markCurrent();
    }

    let openFile = null;

    function markCurrent() {
      for (const item of document.querySelectorAll(".reader-item")) {
        item.setAttribute("aria-current", String(item.dataset.file === openFile));
      }
    }

    function open(file, { push = true, jump = "" } = {}) {
      const log = byFile.get(file);
      if (!log) return;

      openFile = file;
      frame.src = file + (jump ? `?${jump}` : "");
      frame.hidden = false;
      empty.hidden = true;

      title.textContent = log.label;
      sub.textContent = `${log.speaker} · 메시지 ${log.count.toLocaleString("ko-KR")}개`;
      reader.dataset.open = "true";
      markCurrent();

      if (push) {
        const hash = `#log=${encodeURIComponent(file)}`;
        if (location.hash.split("&")[0] !== hash) history.replaceState(null, "", hash);
      }
    }

    function close() {
      reader.dataset.open = "false";
      openFile = null;
      markCurrent();
    }

    document.addEventListener("click", event => {
      const item = event.target.closest(".reader-item");
      if (item) {
        open(item.dataset.file);
        return;
      }

      const hit = event.target.closest(".enty-search-result");
      if (hit) {
        event.preventDefault();
        const [file, query] = hit.getAttribute("href").split("?");
        open(file, { jump: query || "" });
      }
    });

    back.addEventListener("click", close);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && reader.dataset.open === "true" && !wide.matches) close();
    });

    window.addEventListener("enty-brand-change", () => {
      brand = readJson(BRAND_KEY);
      paintNames();
      paintLists();
    });

    window.addEventListener("storage", event => {
      if (event.key === BRAND_KEY) {
        brand = readJson(BRAND_KEY);
        paintNames();
        paintLists();
      } else if (event.key === IMAGE_KEY) {
        images = readJson(IMAGE_KEY);
        paintImages();
      }
    });

    paintNames();
    paintImages();
    paintLists();

    const wanted = (location.hash.match(/log=([^&]+)/) || [])[1];
    if (wanted) open(decodeURIComponent(wanted), { push: false });

    else if (wide.matches && MANIFEST.logs.length) {
      open(MANIFEST.logs[0].file, { push: false });
    }
  }
})();
