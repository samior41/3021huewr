/* 모든 로그 HTML에 컬러 콘솔을 붙이고, 아바타 목록을 만들어 냅니다.
 * 실행:  node apply_theme.js 또는 .\apply_theme.ps1
*/

const fs = require("fs");
const path = require("path");

const ROOT = process.env.ENTY_ROOT || __dirname;
const LOGS_DIR = path.join(ROOT, "toots");
const LOGS_PREFIX = "toots/";
const ASSET_PREFIX = "../";
const MARK = "enty-theme-boot";

fs.mkdirSync(LOGS_DIR, { recursive: true });

// 캐릭터 등록 시, 아래의 label과 account를 수정해주세요.
// 색상 코드는 홈페이지 내부에서 직접 수정이 가능하니 반드시 여기서 설정할 필요는 없습니다.
// 아래 CHARACTERS를 하나라도 수정했을 경우에는, node apply_theme.js 를 실행합니다.
const CHARACTERS = {
  char1: { label: "제일린 리우", account: "@A_0044", side: "left", colorLight: "#2f6690", colorDark: "#7fbbe8" },
  char2: { label: "해나 라스커", account: "@O_Hayne", side: "right", colorLight: "#8c4a63", colorDark: "#dd93ab" },
};

{
  const sides = Object.values(CHARACTERS).map(c => c.side);
  if (sides.filter(s => s === "left").length !== 1 || sides.filter(s => s === "right").length !== 1) {
    console.error("CHARACTERS 는 side: \"left\" 하나, side: \"right\" 하나로 정확히 설정해야 합니다.");
    process.exit(1);
  }
}

const INK = "#0d141d";
function relativeLuminance(hex) {
  const channel = i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function readableOn(hex) {
  const bg = relativeLuminance(hex);
  const onWhite = 1.05 / (bg + 0.05);
  const onInk = (bg + 0.05) / (relativeLuminance(INK) + 0.05);
  return onWhite >= onInk ? "#ffffff" : INK;
}

function buildBootLines() {
  const ids = Object.keys(CHARACTERS);
  const accounts = Object.fromEntries(ids.map(id => [id, CHARACTERS[id].account]));
  const isCharacterKey = ids.map(id => `key === "${id}"`).join(" || ") || "false";

  return [
  `  <script id="${MARK}">`,
  `    (function () {`,
  `      var root = document.documentElement;`,
  `      function readable(hex) {`,
  `        var f = function (i) {`,
  `          var v = parseInt(hex.substr(i, 2), 16) / 255;`,
  `          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);`,
  `        };`,
  `        var L = 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);`,
  `        return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0567 ? "#ffffff" : "#0d141d";`,
  `      }`,
  `      try {`,
  `        var hash = (location.hash.match(/theme=([^&]+)/) || [])[1];`,
  `        var raw = hash`,
  `          ? atob(decodeURIComponent(hash))`,
  `          : localStorage.getItem("enty-theme") || "{}";`,
  `        var state = JSON.parse(raw) || {};`,
  `        var mode = state.mode || "auto";`,
  `        if (mode === "auto") {`,
  `          mode = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";`,
  `        }`,
  `        root.setAttribute("data-theme", mode);`,
  `        var custom = (state.custom || {})[mode] || {};`,
  `        for (var key in custom) {`,
  `          if (!/^#[0-9a-f]{6}$/i.test(custom[key])) continue;`,
  `          root.style.setProperty("--accent-" + key, custom[key]);`,
  `          if (${isCharacterKey}) {`,
  `            root.style.setProperty("--on-" + key, readable(custom[key]));`,
  `          }`,
  `        }`,
  `      } catch (e) {`,
  `      }`,
  `      try {`,
  `        var saved = JSON.parse(localStorage.getItem("enty-avatars") || "{}");`,
  `        var rules = "";`,
  `        var accounts = ${JSON.stringify(accounts)};`,
  `        for (var name in accounts) {`,
  `          var gen = root.getAttribute("data-gen-" + name);`,
  `          var url = gen && saved[name + ":" + gen];`,
  `          if (!url || url.slice(0, 11) !== "data:image/") continue;`,
  `          var at = '.ttobot-status[data-account="' + accounts[name] + '"] .ttobot-avatar';`,
  `          rules += at + '{background-image:url("' + url + '");background-size:cover;background-position:center}';`,
  `          rules += at + " img{visibility:hidden}";`,
  `        }`,
  `        if (rules) {`,
  `          var style = document.createElement("style");`,
  `          style.id = "enty-avatar-style";`,
  `          style.textContent = rules;`,
  `          document.head.appendChild(style);`,
  `        }`,
  `      } catch (e) {`,
  `      }`,
  `      try {`,
  `        if (window.self !== window.top) root.classList.add("in-pane");`,
  `      } catch (e) {`,
  `        root.classList.add("in-pane");`,
  `      }`,
  `    })();`,
  `  </script>`,
  ];
}

const files = fs
  .readdirSync(LOGS_DIR)
  .filter(name => name.endsWith(".html") && !name.startsWith("_"));

if (!files.length) {
  console.error(`toots/ 안에서 HTML 파일을 찾지 못했습니다. (${LOGS_DIR})`);
  process.exit(1);
}

function pageTitle(name) {
  const m = name.match(/^(\d{1,2})(\d{2})(?:_(\d+))?\.html$/);
  if (!m) return name.replace(/\.html$/, "");
  const base = `${+m[1]}월 ${+m[2]}일`;
  return m[3] ? `${base} (${+m[3]}편)` : base;
}

for (const name of files) {
  const file = path.join(LOGS_DIR, name);
  const raw = fs.readFileSync(file, "utf8");
  if (/<!doctype/i.test(raw) || /<html[\s>]/i.test(raw)) continue;

  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const body = raw.replace(/^﻿/, "").replace(/^(?:\r?\n)+/, "").replace(/\s+$/, "");
  const wrapped = [
    `<!DOCTYPE html>`,
    `<html lang="ko">`,
    `<head>`,
    `  <meta charset="UTF-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    `  <title>${pageTitle(name)}</title>`,
    `  <link rel="stylesheet" href="${ASSET_PREFIX}style/ttobot.css">`,
    `</head>`,
    `<body>`,
    body,
    `</body>`,
    `</html>`,
    ``,
  ].join(eol);

  fs.writeFileSync(file, wrapped, "utf8");
  console.log(`  뼈대 생성: ${name}  <title>${pageTitle(name)}</title>`);
}

const pages = {};
const gensByCharacter = {};
const namesByCharacter = {};
for (const name of Object.keys(CHARACTERS)) {
  gensByCharacter[name] = new Set();
  namesByCharacter[name] = new Map();
}

for (const name of files) {
  const html = fs.readFileSync(path.join(LOGS_DIR, name), "utf8");
  const found = {};
  for (const character of Object.keys(CHARACTERS)) {
    const hits = [...html.matchAll(new RegExp(`(?:\\.\\./)*images/${character}_(\\d+)\\.png`, "g"))]
      .map(m => m[1]);
    if (!hits.length) continue;

    const unique = [...new Set(hits)];
    if (unique.length > 1) {
      console.warn(`  주의: ${name} 안에서 ${character} 세대가 섞여 있습니다 — ${unique.join(", ")}`);
    }
    found[character] = unique[0];
    for (const gen of unique) gensByCharacter[character].add(gen);

    const account = CHARACTERS[character].account;
    const shown = [...html.matchAll(
      new RegExp(`data-account="${account}">[\\s\\S]*?class="ttobot-name">([\\s\\S]*?)</div>`, "g")
    )].map(m => m[1].replace(/<[^>]*>/g, "").trim());
    for (const label of shown) {
      if (label) namesByCharacter[character].set(label, (namesByCharacter[character].get(label) || 0) + 1);
    }
  }
  if (Object.keys(found).length) pages[name] = found;
}

let injected = 0;
let skipped = 0;

for (const name of files) {
  const file = path.join(LOGS_DIR, name);
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const boot = buildBootLines().join(eol) + eol;

  html = html.replace(/(?:\.\.\/)*images\//g, `${ASSET_PREFIX}images/`);
  html = html.replace(/(?:\.\.\/)*style\/ttobot\.css/g, `${ASSET_PREFIX}style/ttobot.css`);

  const gens = pages[name] || {};
  html = html.replace(/<html([^>]*)>/i, (_match, attrs) => {
    let cleaned = attrs.replace(/\s+data-gen-[a-z]+="[^"]*"/g, "");
    for (const [character, gen] of Object.entries(gens)) {
      cleaned += ` data-gen-${character}="${gen}"`;
    }
    return `<html${cleaned}>`;
  });

  const existing = new RegExp(`[ \\t]*<script id="${MARK}">[\\s\\S]*?</script>\\r?\\n`);
  if (existing.test(html)) {
    html = html.replace(existing, boot);
  } else {
    const link = html.match(/^[ \t]*<link[^>]+ttobot\.css[^>]*>[ \t]*\r?\n/m);
    if (link) {
      html = html.replace(link[0], boot + link[0]);
    } else if (/<\/head>/i.test(html)) {
      html = html.replace(/([ \t]*)<\/head>/i, `${boot}$1</head>`);
    } else {
      console.warn(`  건너뜀: ${name} — <head> 를 찾지 못했습니다.`);
      skipped++;
      continue;
    }
  }

  html = html.replace(
    /[ \t]*<script[^>]+src=["'](?:\.\.\/)*(?:avatars|manifest|reader|search|theme)\.js["']\s*><\/script>[ \t]*\r?\n/g,
    ""
  );
  const scripts = ["search.js", "manifest.js"];
  if (/class="[^"]*reader-page/.test(html)) scripts.push("reader.js");
  scripts.push("theme.js");

  const tags = scripts.map(src => `  <script src="${ASSET_PREFIX}${src}"></script>${eol}`).join("");
  html = /<\/body>/i.test(html)
    ? html.replace(/([ \t]*)<\/body>/i, `${tags}$1</body>`)
    : html + tags;

  if (html === before) {
    console.log(`  변경 없음: ${name}`);
    skipped++;
    continue;
  }

  fs.writeFileSync(file, html, "utf8");
  console.log(`  적용: ${name}  (${eol === "\r\n" ? "CRLF" : "LF"})${Object.keys(gens).length ? `  세대 ${JSON.stringify(gens)}` : ""}`);
  injected++;
}

const stripTags = html => html.replace(/<[^>]*>/g, "");

const decode = text => text
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

function parseStamp(stamp) {
  const match = stamp.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
  if (!match) return null;
  return { year: +match[1], month: +match[2], day: +match[3] };
}

const logs = [];

for (const name of files) {
  const html = fs.readFileSync(path.join(LOGS_DIR, name), "utf8");
  const count = (html.match(/class="ttobot-status"/g) || []).length;
  if (!count) continue;

  const first = html.match(
    /<div class="ttobot-status" data-account="([^"]+)">([\s\S]*?)<div class="ttobot-time">([^<]*)<\/div>/
  );
  if (!first) {
    console.warn(`  주의: ${name} 첫 메시지를 읽지 못했습니다.`);
    continue;
  }

  const [, account, body, stamp] = first;
  const avatar = (body.match(/class="ttobot-avatar"><img src="([^"]+)"/) || [])[1] || "";
  const character = Object.keys(CHARACTERS).find(id => CHARACTERS[id].account === account) || "";
  const speaker = decode(stripTags((body.match(/class="ttobot-name">([\s\S]*?)<\/div>/) || [])[1] || "")).trim();
  const text = decode(stripTags((body.match(/class="ttobot-content-text">([\s\S]*?)<\/div>/) || [])[1] || ""))
    .replace(/\s+/g, " ").trim();

  const when = parseStamp(stamp.trim());
  const part = (name.match(/_(\d+)\.html$/) || [])[1];

  logs.push({
    file: LOGS_PREFIX + name,
    month: when ? when.month : 0,
    day: when ? when.day : 0,
    part: part ? Number(part) : null,
    label: when
      ? `${when.month}월 ${when.day}일` + (part ? ` (${Number(part)}편)` : "")
      : name.replace(/\.html$/, ""),
    stamp: stamp.trim(),
    account,
    character,
    speaker,
    avatar,
    text,
    count,
    gens: pages[name] || {},
  });
}

logs.sort((a, b) => a.month - b.month || a.day - b.day || (a.part || 0) - (b.part || 0));

const manifest = { characters: {}, pages, logs };
for (const [name, meta] of Object.entries(CHARACTERS)) {
  const shown = [...namesByCharacter[name].entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
  manifest.characters[name] = {
    label: shown.length ? shown.join(" · ") : meta.label,
    names: shown,
    account: meta.account,
    side: meta.side,
    gens: [...gensByCharacter[name]].sort(),
  };
}

fs.writeFileSync(
  path.join(ROOT, "manifest.js"),
    "window.ENTY_MANIFEST = " + JSON.stringify(manifest, null, 2) + ";\n",
  "utf8"
);

const stale = path.join(ROOT, "avatars.js");
if (fs.existsSync(stale)) {
  fs.unlinkSync(stale);
  console.log("  제거: avatars.js");
}

const [leftId, leftMeta] = Object.entries(CHARACTERS).find(([, c]) => c.side === "left");
const [rightId, rightMeta] = Object.entries(CHARACTERS).find(([, c]) => c.side === "right");

const TOKENS = {
  LEFT_ID: leftId,
  LEFT_LABEL: leftMeta.label,
  LEFT_ACCOUNT: leftMeta.account,
  LEFT_COLOR_LIGHT: leftMeta.colorLight,
  LEFT_COLOR_DARK: leftMeta.colorDark,
  LEFT_ON_LIGHT: readableOn(leftMeta.colorLight),
  LEFT_ON_DARK: readableOn(leftMeta.colorDark),
  RIGHT_ID: rightId,
  RIGHT_LABEL: rightMeta.label,
  RIGHT_ACCOUNT: rightMeta.account,
  RIGHT_COLOR_LIGHT: rightMeta.colorLight,
  RIGHT_COLOR_DARK: rightMeta.colorDark,
  RIGHT_ON_LIGHT: readableOn(rightMeta.colorLight),
  RIGHT_ON_DARK: readableOn(rightMeta.colorDark),
};

function renderTemplate(templateName, outName, extraTokens) {
  const templatePath = path.join(ROOT, templateName);
  if (!fs.existsSync(templatePath)) {
    console.warn(`  건너뜀: ${templateName} 를 찾지 못했습니다.`);
    return;
  }
  let text = fs.readFileSync(templatePath, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const tokens = { ...TOKENS, ...extraTokens(eol) };
  for (const [key, value] of Object.entries(tokens)) {
    text = text.split(`__${key}__`).join(value);
  }
  const missing = text.match(/__[A-Z_]+__/);
  if (missing) {
    console.warn(`  주의: ${outName} 에 채워지지 않은 자리표시자 ${missing[0]} 가 남아 있습니다.`);
  }
  fs.writeFileSync(path.join(ROOT, outName), text, "utf8");
  console.log(`  생성: ${outName}`);
}

renderTemplate("style/ttobot.template.css", "style/ttobot.css", () => ({}));
renderTemplate("index.template.html", "index.html", eol => ({
  BOOT_SNIPPET: buildBootLines().join(eol),
}));

console.log(`\n로그 ${logs.length}개, ` +
  Object.values(manifest.characters).map(v => `${v.label} ${v.gens.length}세대`).join(", "));
console.log(`완료 — 적용 ${injected}개, 건너뜀 ${skipped}개.`);
