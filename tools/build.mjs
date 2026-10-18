// Static site builder. Usage: node tools/build.mjs   (output: ./dist)
// Content: data/*.json (drugs, lasa, index shards) + i18n/<lang>/*.json (texts) + config/*.json (branding, codes).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { illustrate } from '../js/svg.js';
const require = createRequire(import.meta.url); const qrcode = require('./vendor/qrcode.cjs');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const OUT = path.join(ROOT, 'dist');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SITE = J('config/site.json'), CODES = J('config/codes.json'), LANG = 'zh-TW';
const C = J(`i18n/${LANG}/common.json`), U = C.ui, GL = J(`i18n/${LANG}/glossary.json`), HA = J(`i18n/${LANG}/high-alert.json`);
const DR = J('data/drugs.json'), DRUGS = DR.drugs, LASA = J('data/lasa.json'), META = J('data/index/meta.json');
const T = {}; for (const f of ['inhaled', 'injection', 'oral', 'other']) Object.assign(T, J(`i18n/${LANG}/techniques/${f}.json`));
T['easyhaler'] = { ...T['dpi-generic'], alias: 'dpi-generic' };
const VER = SITE.version, BUILT = new Date().toISOString().slice(0, 10);
const GROUPS = { inhaled: '吸入劑', injection: '注射（自行皮下注射）', oral: '口服', topical: '皮膚外用', eye: '眼用', ear: '耳用', nose: '鼻用', rectal: '肛門用', vaginal: '陰道用' };
const CHIPS = { dpi: U.chip_dpi, smi: U.chip_smi, pmdi: U.chip_pmdi, insulin: U.chip_insulin };
const TECH_DRUGS = {}; for (const d of DRUGS) (TECH_DRUGS[d.technique] ||= []).push(d);
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
let warnings = [];

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let glN = 0;
function rich(s) { // escape + [[glossary]] tooltips + {審核中} marker
  return esc(s).replaceAll(NV, nvHtml()).replace(/\[\[([^\]]+)\]\]/g, (m, term) => {
    const def = GL[term]; if (!def) { warnings.push('glossary missing: ' + term); return term; }
    const id = 'g' + (++glN);
    return `<span class="gl"><button type="button" class="gl-btn" aria-expanded="false" aria-controls="${id}" title="${esc(def)}">${esc(term)}</button><span class="gl-pop" id="${id}" role="tooltip" hidden>${esc(def)}</span></span>`;
  });
}
const NV = '{審核中}';
const nvHtml = () => `<span class="nv">${esc(U.nvMark)}</span>`;
const plain = s => String(s ?? '').replace(/\[\[([^\]]+)\]\]/g, '$1').replaceAll(NV, '（' + U.nvMark + '）');
// v1.1: phone only when the hospital has filled it in (config/site.json)
const PHONE_SET = !!(SITE.consultPhone && !/請填入/.test(SITE.consultPhone) && SITE.consultPhoneHref);
const phoneHtml = () => PHONE_SET ? `<a class="tel" href="${esc(SITE.consultPhoneHref)}">📞 ${esc(SITE.consultPhone)}</a>${SITE.consultHours && !/請填入/.test(SITE.consultHours) ? `（${esc(SITE.consultHours)}）` : ''}` : esc(U.phoneFallback);
const phoneBtn = () => PHONE_SET ? `<p><a class="btn call-pharm" href="${esc(SITE.consultPhoneHref)}">📞 ${U.callPharmacy}：${esc(SITE.consultPhone)}</a></p>` : `<p class="small">${esc(U.contact)}：${esc(U.phoneFallback)}</p>`;
// numbers shown inside an illustration always come from that step's own text (never hard-coded in the scene)
function numLabel(t) {
  const x = plain(t);
  let m = x.match(/數到\s*(\d+)/); if (m) return '數到 ' + m[1];
  m = x.match(/(至少|最多|超過)?\s*約?\s*(\d+(?:\s*[–-]\s*\d+)?)\s*(秒|分鐘)/);
  if (!m) return undefined;
  return (m[1] === '至少' ? '≥' : m[1] === '最多' ? '≤' : '') + m[2].replace(/\s/g, '') + (m[3] === '秒' ? ' s' : ' min');
}
// patient wording: 仿單 -> 說明書; the first visible occurrence on a page keeps the official word in brackets
function plainTerms(html) {
  const KEEP = '\u0002';
  html = html.replace(/藥品仿單查詢平台|仿單查詢平台/g, '許可證查詢').replace(/仿單(加刊|查詢)/g, '說明書$1').replaceAll('（仿單）', KEEP).replace(/台灣仿單/g, '台灣說明書').replace(/食藥署(核准)?仿單/g, '食藥署核准說明書');
  let first = !html.includes(KEEP);
  html = html.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag ? tag.replace(/仿單/g, '說明書') : txt.replace(/仿單/g, () => { if (first) { first = false; return '藥盒裡的說明書（仿單）'; } return '說明書'; }));
  return html.replaceAll(KEEP, '（仿單）');
}
const tsvFile = tm => false; // teammate SVG set retired (2026-10-18); all steps use our own inline scenes (js/svg.js)
function qrSvg(url, cell = 4) { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }).replace('<svg ', `<svg role="img" aria-label="QR Code：${esc(url)}" `); }
function write(rel, html) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); }
const linkify = s => rich(s).replace(/https?:\/\/[^\s（）()，；、<]+/g, u => { const h = u.replace(/&amp;/g, '&'); return `<a href="${esc(h)}" target="_blank" rel="noopener">${u}</a>`; });
const srcList = arr => arr && arr.length ? `<ul class="srcs">${arr.map(x => `<li>${linkify(x)}</li>`).join('')}</ul>` : '';
const ul = (arr, cls = '') => arr && arr.length ? `<ul class="${cls}">${arr.map(x => `<li>${rich(x)}</li>`).join('')}</ul>` : '';
const sec = (id, title, body, extra = '') => body ? `<section class="card sec" id="${id}" aria-labelledby="${id}-h"${extra}><div class="sec-head"><h2 id="${id}-h">${esc(title)}</h2><button type="button" class="tts-sec" data-tts="${id}" aria-label="${esc(U.readSection)}：${esc(title)}">${U.readSection}</button></div>${body}</section>` : '';
const vlist = (arr, d) => (arr || []).filter(x => d.rinse || !/含類固醇|吸入型類固醇|口腔念珠菌|鵝口瘡/.test(x)).filter(x => d.mix || !/預混型/.test(x));
const roleBadge = r => r === 'reliever' ? `<span class="badge b-rescue">🚑 ${U.rescue}</span>` : r === 'mart' ? `<span class="badge b-mart">⚠ ${U.martTitle}</span>` : (['maintenance', 'copd', 'copdOnly'].includes(r) ? `<span class="badge b-notrescue">⚠ ${U.notRescue}</span>` : '');
const haBadge = `<span class="badge b-ha" title="${esc(GL['高警訊藥品'])}">❗ ${U.highAlert}</span>`;

// ---------- layout ----------
function layout({ rel, title, desc = '', body, cls = '', canonical = '', noindexSearch = false }) {
  const depth = rel.split('/').length - 1; const B = depth ? '../'.repeat(depth) : './';
  const url = SITE.baseUrl + rel.replace(/index\.html$/, '');
  const langs = SITE.languages.map(l => `<option value="${l.code}"${l.code === LANG ? ' selected' : ''}${l.enabled ? '' : ' disabled'}>${esc(l.label)}${l.enabled ? '' : '（準備中）'}</option>`).join('');
  return `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}｜${esc(SITE.hospitalShort)} ${esc(U.siteTitle)}</title><meta name="description" content="${esc(desc || U.homeIntro)}">
<link rel="canonical" href="${esc(canonical || url)}"><meta name="theme-color" content="${SITE.colors.primary}">
<link rel="stylesheet" href="${B}css/style.css?v=${VER}"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%92%8A%3C/text%3E%3C/svg%3E"><link rel="manifest" href="${B}manifest.webmanifest">
<style>:root{--primary:${SITE.colors.primary};--accent:${SITE.colors.accent};--bg:${SITE.colors.bg}}</style>
<script>try{if(localStorage.getItem('lt')==='1')document.documentElement.classList.add('lt')}catch(e){}</script>
</head><body class="${cls}" data-base="${B}" data-ver="${VER}" data-url="${esc(url)}">
<a class="skip" href="#main">${U.skip}</a>
<div class="beta-banner" role="note"><strong>測試版 v${VER}</strong> — 尚未經醫師／藥師正式審核，請勿用於實際用藥決策，實際用法以醫師處方與藥師指導為準</div>
<header class="top"><div class="wrap top-in">
<a class="brand" href="${B}">${SITE.logo ? `<img src="${B}${esc(SITE.logo)}" alt="" height="40">` : '<span class="logo" aria-hidden="true">💊</span>'}<span><b>${esc(SITE.hospitalName)}</b><small>${esc(U.siteTitle)}</small></span></a>
<div class="tools" role="group" aria-label="顯示設定">
<button type="button" id="lt-btn" class="tbtn" aria-pressed="false">${U.largeText}</button>
<label class="tbtn lang"><span class="sr">${U.language}</span><select id="lang-sel" aria-label="${U.language}">${langs}</select></label>
<label class="tbtn bil" title="其他語言上線後可開啟"><input type="checkbox" id="bil" disabled> ${U.bilingual}</label>
</div></div></header>
<div id="notice" class="wrap notice" role="status" aria-live="polite" hidden></div>
<aside class="wrap emerg" aria-labelledby="emerg-h"><h2 id="emerg-h" class="sr">${C.emergency.title}</h2>
<div class="emerg-bar"><p class="emerg-line"><b>🔴 ${esc(C.emergency.bar)}</b></p><a class="call" href="tel:119" aria-label="撥打 119">📞 119</a></div>
<details class="emerg-more"><summary>哪些情況要打 119？誤食怎麼辦？</summary><p><b>${esc(C.emergency.lines[0].replace(/^🔴\s*/, ''))}</b></p>
<p class="small">${esc(C.emergency.lines[1])} <a href="${SITE.poisonCenter.href}">${esc(SITE.poisonCenter.phone)}</a></p></details></aside>
<main id="main" class="wrap" tabindex="-1">${plainTerms(body)}</main>
<footer class="foot"><div class="wrap">
<p class="print-only pfoot">${esc(SITE.hospitalName)}｜${U.version} v${VER}｜${U.effective} ${SITE.effective}｜${U.reviewStatus}：尚未審核｜${U.contact}：${PHONE_SET ? esc(SITE.consultPhone) : esc(U.phoneFallback)}｜${esc(url)}</p>
<p><b>${U.doseRule}</b></p><p>${U.firstUse}</p>
<p>${U.contact}：${phoneHtml()}｜${esc(SITE.poisonCenter.name)} <a href="${SITE.poisonCenter.href}">${esc(SITE.poisonCenter.phone)}</a></p>
<p class="small">${U.disclaimer}</p>
<nav class="fnav" aria-label="網站資訊"><a href="${B}glossary/">${U.glossary}</a><a href="${B}high-alert/">${U.highAlertH}</a><a href="${B}disposal/">${U.disposal}</a><a href="${B}qr/">${U.qrSheet}</a><a href="${B}print/">${U.printAll}</a><a href="${B}about/">${U.about}</a><a href="${B}changelog/">${U.changelog}</a></nav>
<p class="small">${U.version} v${VER}｜${U.effective} ${SITE.effective}｜${U.reviewStatus}：${U.notReviewed}｜無追蹤、不收集個資</p>
</div></footer>
<script src="${B}js/app.js?v=${VER}" defer></script></body></html>`;
}

// ---------- steps ----------
function stepFig(st, opts, alt, forceInline) {
  if (!forceInline && tsvFile(st.tm)) return `<img class="ill" src="${opts.B}img/s/${st.tm}.svg" alt="${esc(alt)}" width="400" height="400" loading="lazy" decoding="async">`;
  let svg = illustrate(st.img || 'generic-device', opts, alt);
  const markers = (svg.match(/class="callout"/g) || []).length;
  if (markers !== (st.c || []).length) { svg = svg.replace(/<g class="callout">.*?<\/g>/g, ''); st._noLegend = true; }
  return svg;
}
function renderSteps(steps, opts, idp) {
  if (!steps || !steps.length) return '';
  return `<ol class="steps">${steps.map((st, i) => {
    if (typeof st === 'string') st = { t: st };
    const alt = `步驟 ${i + 1}：${plain(st.t)}`;
    const inline = !tsvFile(st.tm) || st.forceInline;
    const pu = plain(st.t).match(/轉到\s*(\d+)\s*單位/), mx = plain(st.t).match(/(\d+)\s*次/);
    const o2 = { ...opts, step: i + 1, label: numLabel(st.t), primeUnits: pu ? pu[1] : undefined, mixN: mx ? mx[1] : undefined };
    const figHtml = (st.img || st.tm) ? stepFig(st, o2, alt, st.forceInline) : '';
    const fig = (st.img || st.tm) ? `<figure class="fig">${figHtml}${inline && !st._noLegend && st.c && st.c.length && st.img ? `<figcaption><ol class="callouts" type="A">${st.c.map(c => `<li>${esc(c)}</li>`).join('')}</ol></figcaption>` : ''}</figure>` : '';
    return `<li class="step" id="${idp}-${i + 1}">${fig}<div class="st-t"><span class="st-n" aria-hidden="true">${i + 1}</span><p>${rich(st.t)}</p></div></li>`;
  }).join('')}</ol>`;
}
function triageBox(key, extraRed = [], key2) {
  const t = C.triage[key] || C.triage.general, t2 = key2 ? C.triage[key2] : null;
  const red = [...extraRed, ...(t.red || []), ...(t2?.red || [])], orange = [...(t.orange || []), ...(t2?.orange || [])], yellow = [...(t.yellow || []), ...(t2?.yellow || [])];
  return `<div class="tri"><div class="tri-r"><h3>🔴 ${U.red}</h3>${ul(red)}${t.redWait ? `<p class="wait">${esc(t.redWait)}</p>` : ''}<a class="call" href="tel:119">📞 撥打 119</a></div>
<div class="tri-o"><h3>🟠 ${U.orange}</h3>${ul(orange)}</div><div class="tri-y"><h3>🟡 ${U.yellow}</h3>${ul(yellow)}</div></div>`;
}
function hypoBox() { const h = C.hypo; return `<div class="hypo"><h3>${esc(h.title)}</h3><p>${esc(h.signs)}</p><ol>${h.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="redline">${esc(C.triage.insulin.redWait)}</p></div>`; }

// Adapt technique steps for a specific drug
function drugUseSteps(t, d) {
  let steps = (t.use || []).map(s => ({ ...s }));
  if (t === T.pmdi) {
    if (d.shake !== true) steps = steps.filter(s => s.id !== 'shake');
    steps = steps.map(s => {
      if (s.img !== 'repeat-cycle') return s;
      let x = s.t;
      x = d.gap ? x.replace('等約 30 秒', '等' + d.gap) : d.gapNoInsert ? x.replace('等約 30 秒，', '') : x.replace('等約 30 秒', '等一下（一般建議約 30 秒）');
      if (d.shake !== true) x = x.replace('從「搖勻」那一步', '從「吐氣」那一步');
      return { ...s, t: x };
    });
    if (d.hold) steps = steps.map(s => s.img === 'hold-breath' ? { ...s, t: `移開吸入器，閉上嘴巴，閉氣${d.hold}。`, tm: undefined } : s);
    if (d.inhaleText) steps = steps.map(s => s.img === 'press-inhale-slow' ? { ...s, t: d.inhaleText + '不要吸太快。', c: ['吸氣開始時按 1 下'] } : s);
  }
  if (!d.rinse) steps = steps.filter(s => s.id !== 'rinse');
  steps = steps.map(s => ({ ...s, c: s.c }));
  if (t === T['insulin-pen']) {
    steps = steps.filter(s => s.id !== 'mix' || d.mix).map(s => {
      if (s.id === 'mix') return { ...s, t: '只有乳白色的預混型需要混勻：' + d.mix };
      if (s.img === 'pen-check' && !d.mix) return { ...s, t: s.t.replace(/；預混型（乳白色）應該混勻後呈均勻乳白色/, '') };
      if (s.img === 'pen-prime') {
        const head = d.test ? `[[安全測試]]：每次注射前，轉到 ${d.test}${d.testNote ? `（${d.testNote}）` : ''}，針頭朝上，輕彈筆芯讓氣泡升上去，把注射鈕按到底，確認針尖出現藥滴。` : `[[安全測試]]：${d.testText || '每次注射前都要做，看到藥滴才注射；單位數請依盒內使用說明書。'}針頭朝上，輕彈筆芯讓氣泡升上去，把注射鈕按到底，確認針尖出現藥滴。`;
        const next = '換一個新針頭再試；換了新針頭還是沒有藥滴，這支筆先不要用，改用新的一支筆，並把這支筆帶去問藥師。';
        const n = (d.retries || '').match(/(\d+)\s*次/), orig = /原廠/.test(d.retries || '');
        const tail = d.retryNeedleFirst ? '沒有藥滴：換新針頭並重做，但總共不要超過 6 次（台灣說明書）；仍沒有，這支筆可能有問題，改用新的一支筆並問藥師。' : n ? `沒有藥滴就再做一次，最多 ${n[1]} 次${orig ? '（原廠使用說明，非台灣版）' : ''}；仍然沒有就${next}` : '沒有藥滴：重複到出現藥滴；重複幾次仍沒有：換新針頭再試；還是沒有：換一支新筆，並問藥師。';
        return { ...s, t: head + tail, forceInline: true, img: 'pen-prime' };
      }
      if (s.id === 'hold') return { ...s, t: `按住注射鈕，劑量視窗回到 0 後，針頭繼續留在皮膚內「${d.hold}」${d.holdNote ? `（${d.holdNote}）` : ''}再拔出，確保藥全部打進去。拔出後不要揉。`, forceInline: true };
      return s;
    });
  }
  return steps;
}
function spacerSteps(t, d) { return (t.spacer || []).map(s => d.shake === true ? s : { ...s, t: s.t.replace('搖勻後把', '把').replace('每一下之間重新搖勻。', '') }); }
function stepOpts(t, d, B) { return { B, accent: t.accent, device: t.device, cloudy: d?.role === 'insulinMix', roomTemp: d ? (((d.storage || []).join(' ').match(/(\d\d)°C 以下/) || [])[1] ? (d.storage.join(' ').match(/(\d\d)°C 以下/))[1] : undefined) : undefined }; }

// ---------- drug page ----------
function lasaBox(d, B) {
  if (!d.lasa?.length) return '';
  const items = d.lasa.map(g => LASA[g]).filter(Boolean);
  const pl = `<p class="print-only lasa-p">⚠ ${U.lasa}：${items.map(it => esc(it.t)).join('；')}（請核對藥袋上的藥名與含量）</p>`;
  return pl + `<div class="lasa" role="note"><h2 class="h3">⚠ ${U.lasa}</h2><p>${U.lasaText}</p><ul>${items.map(it => `<li><b>${esc(it.t)}</b>：${esc(it.x)} ${it.m.filter(s => s !== d.slug).map(s => { const o = DRUGS.find(x => x.slug === s); return o ? `<a href="${B}d/${s}/">${esc(o.brand)}</a>` : ''; }).join('、')}</li>`).join('')}</ul></div>`;
}
function metaLine(v) { return `<p class="small">${U.reviewStatus}：<b>${U.notReviewed}</b>｜${U.contentVersion} v${v || VER}｜${U.effective} ${SITE.effective}</p>`; }
const HA_OF = { 'insulin-pen': 'insulin-glp1', 'injection-pen': 'insulin-glp1', 'vial-syringe': 'insulin-glp1', 'prefilled-syringe': 'lmwh', 'epinephrine-autoinjector': 'epinephrine', 'transdermal-patch': 'fentanyl' };
function haLinkCard(id, B, d) {
  const c = HA.classes.find(x => x.id === id); if (!c) return '';
  // on a single-drug page, drop lines that name a different specific product (e.g. Mounjaro on an insulin page)
  const only = arr => d ? (arr || []).filter(x => !/Mounjaro|Ozempic|Trulicity|Victoza|Saxenda|Wegovy/.test(x) || new RegExp(d.slug.split('-')[0], 'i').test(x)) : arr;
  const head = c.id === 'insulin-glp1' && d && d.chip === 'insulin' && d.role !== 'insulinCombo' ? '❗ 胰島素：用太多、重複打、交互作用' : `❗ 用太多、重複用、交互作用（${c.title}）`;
  return sec('ha', head, `${ul(only(c.overdose))}<h3>重要交互作用</h3>${ul(only(c.interactions))}<p><a class="btn" href="${B}high-alert/${c.id}/">看完整高警訊安全須知 →</a></p>`);
}
function counterBox(key, name, total) {
  return `<div class="counter no-print" data-key="cnt-${esc(key)}"><h3>噴數計數器（只存在這台手機，不會上傳）</h3><p class="small">${total ? `本品一支共 ${total} 噴（已先填好；藥盒寫的不同就改）。` : '拿到新藥時輸入總噴數（看藥盒）。'}每用 1 下按「＋1」。</p>
<p><label>總噴數 <input type="number" inputmode="numeric" min="1" max="999" class="cnt-total" aria-label="總噴數"${total ? ` data-default="${total}" placeholder="${total}"` : ''}></label></p>
<p class="cnt-show" aria-live="polite">已用 <b class="cnt-used">0</b> 下<span class="cnt-left"></span></p>
<p><button type="button" class="btn cnt-plus">＋1 用了 1 下</button> <button type="button" class="btn cnt-minus">−1 按錯了</button> <button type="button" class="btn cnt-reset">換新的一支，歸零</button></p>
<p><a class="btn" href="${'../../'}print/tally/">🖨 列印紙本計數表</a></p></div>`;
}
function abbr(d) { const a = []; if (d.technique === 'pmdi') a.push('定量噴霧吸入器＝pMDI'); if (/copd/i.test(d.role || '')) a.push('慢性阻塞性肺病＝COPD'); if (d.lasa?.length) a.push('名稱或外觀很像的藥＝LASA'); if (d.role === 'mart') a.push('保養加緩解＝MART'); return a.length ? `<div><dt>英文簡稱</dt><dd>${esc(a.join('；'))}</dd></div>` : ''; }
function penEmpty(arr, d) {
  return (arr || []).map((x, i) => {
    if (i !== 0) return x;
    if (d.remainTW) x = x.replace('（多數注射筆的設計；以本筆說明書為準）', '（台灣說明書）');
    if (d.splitOK) x = x.replace(/這時不要用這支打一部分再自己估算.*$/, '本筆的台灣說明書寫兩種做法：① 先把這支剩下的打完，再用新筆補足不夠的單位；② 直接用新筆打完整劑量。補打的單位要自己算，不確定就選 ②，並問藥師。');
    return x; });
}
function drugPage(d) {
  const rel = `d/${d.slug}/index.html`, B = '../../', t = T[d.technique]; if (!t) throw new Error('no technique ' + d.technique);
  const opts = stepOpts(t, d, B), url = SITE.baseUrl + `d/${d.slug}/`;
  const isPen = d.technique === 'insulin-pen';
  const roleTxt = d.roleText || C.roles[d.role] || '';
  const roleBox = roleTxt ? `<div class="role role-${d.role}" role="note"><b>${d.role === 'reliever' ? '🚑 ' + U.rescue : (isPen ? '💉 ' : d.role === 'mart' ? '⚠ ' + U.martTitle : '⚠ ' + U.notRescue)}</b><p>${esc(roleTxt)}</p>${d.role === 'reliever' ? `<p class="redline">${U.relieverRed}</p>` : ''}</div>` : '';
  const warn = (d.warn || []).length ? `<div class="warnbox" role="note">${ul(d.warn)}</div>` : '';
  let keyPts = vlist(t.keyPoints, d);
  if (t === T.pmdi) keyPts = keyPts.map(k => {
    if (/^按壓前先搖勻/.test(k)) return d.shake === true ? '按壓前先搖勻' : d.shakeNote ? '本品是溶液型，台灣說明書的步驟沒有要求先搖' : '本品不用先搖（見下方「每次使用步驟」說明）';
    if (/^開始慢慢吸氣的同時按 1 下/.test(k) && d.inhaleText) return d.inhaleText.replace(/。$/, '');
    if (/^閉氣約 10 秒/.test(k) && d.hold) return `閉氣${d.hold}，再慢慢吐氣`;
    return k; });
  if (d.role === 'reliever') keyPts.push('用了還是喘、沒有緩解：立即撥打 119');
  if (isPen) {
    keyPts.splice(1, 1, d.test ? `每次換新針頭，安全測試 ${d.test}${d.testNote ? `（${d.testNote}）` : ''}（看到藥滴）` : `每次換新針頭，都要做安全測試，看到藥滴才注射（單位數依盒內說明書）${NV}`);
    keyPts.splice(3, 1, `垂直刺入，按到底並停留「${d.hold}」${d.holdNote ? `（${d.holdNote}）` : ''}`);
    if (d.mix) keyPts.splice(1, 0, '預混型（乳白色）：注射前要先混勻（方法見步驟）');
    keyPts.push(U.noDouble); }
  if (d.role === 'insulinWeekly') keyPts.unshift('一週只打一次，不是每天打');
  const prep = d.prep || t.prep;
  const use = drugUseSteps(t, d);
  const spacer = d.technique === 'pmdi' ? renderSteps(spacerSteps(t, d), opts, 'sp') + ul(d.spacerNote) : '';
  const empty = d.empty || (isPen ? penEmpty(t.empty, d) : t.empty), cleaning = d.cleaning || t.cleaning, storage = [...(d.storage || []), ...(t.storage || []).filter(s => !d.storage || /兒童/.test(s))];
  const counter = ['pmdi'].includes(d.technique) ? counterBox(d.slug, d.brand, d.puffs) : '';
  const shakeNote = d.shakeNote && t === T.pmdi ? `<p class="note" role="note">ⓘ ${esc(d.shakeNote)}</p>` : '';
  const triExtra = d.role === 'reliever' ? [U.relieverRed] : [];
  const video = d.video ? `<p><a class="btn" href="${esc(d.video)}" target="_blank" rel="noopener">▶ ${U.video}（${esc(d.brand)}）↗</a></p><p class="small">${esc(d.videoNote || '')} ${U.videoNote} 影片連結只核對過標題${d.videoChecked ? `（${d.videoChecked} 核對）` : ''}，影片內容尚待藥師核對。</p><div class="print-only">${qrSvg(d.video, 2)}</div>` : `<p>${U.noVideo}</p>`;
  const missedBody = Array.isArray(d.missed) ? ul(d.missed) : `<p>${rich(d.missed || U.missedAsk)}</p>`;
  const missed = isPen ? sec('missed', U.missedPen, `<p class="redline">${U.noDouble}</p>${missedBody}${ul(C.missed.slice(1, 2))}`) : (d.missed ? sec('missed', U.missed, missedBody) : (Array.isArray(t.missed) && d.role !== 'reliever' ? sec('missed', U.missed, ul(t.missed)) : (d.role === 'reliever' ? sec('missed', U.missed, ul(t.missed ? t.missed.slice(-1) : [])) : '')));
  const haCard = isPen || d.highAlert ? haLinkCard(HA_OF[d.technique], B, d) : '';
  const body = `<nav class="crumb no-print"><a href="${B}">${U.back}</a></nav>
<article class="drug${isPen ? ' pen' : ''}" data-slug="${d.slug}">
<header class="dh"><p class="eyebrow">${esc(d.category)}${d.role === 'insulinCombo' ? '｜胰島素＋GLP-1 複方' : ''}</p><h1>${esc(d.brand)}<span class="zh">${esc(d.zhName)}</span></h1>
<p class="badges">${roleBadge(d.role)}${d.highAlert ? haBadge : ''}${d.lasa?.length ? `<span class="badge b-lasa">👀 名稱或外觀相似</span>` : ''}</p></header>
<div class="idbox card"><dl><div><dt>${U.strength}</dt><dd>${esc(d.strength)}</dd></div><div><dt>${U.technique}</dt><dd><a href="${B}t/${d.technique}/">${esc(t.title)}</a></dd></div></dl>
<details class="adv"><summary>進階資訊（成分、許可證字號）</summary><dl><div><dt>${U.ingredient}</dt><dd>${esc(d.ingredient)}</dd></div><div><dt>${U.license}（藥品身分證號）</dt><dd>${esc(d.license)}</dd></div>${abbr(d)}</dl></details>
<p class="check">✅ ${U.checkDrug}</p></div>
${roleBox}${warn}${lasaBox(d, B)}
<div class="actions no-print"><button type="button" class="btn tts-all">${U.readAll}</button><button type="button" class="btn tts-stop" hidden>${U.stop}</button><button type="button" class="btn" data-print>🖨 ${U.print}</button><a class="btn" href="#qr">${U.qr}</a></div>
${sec('key', U.keySteps, (isPen && d.hold ? `<p class="holdbig">⏱ ${esc(d.brand)}：打完停留 ${esc(d.hold)}</p>` : '') + `<ol class="keypts">${keyPts.map(k => `<li>${rich(k)}</li>`).join('')}</ol>`)}
${sec('purpose', U.purpose, `<p>${rich(d.purpose)}</p>${ul(d.usual)}<p class="dose">${U.doseRule}</p>`)}
${sec('prep', U.prep, renderSteps(prep, opts, 'pr'))}
${sec('use', U.use, shakeNote + renderSteps(use, opts, 'st'))}
${isPen ? sec('hypo', '低血糖', hypoBox()) : ''}
${missed}${haCard}
${spacer ? sec('spacer', U.spacer, spacer) : ''}
${sec('empty', U.empty, ul(empty) + counter)}
${sec('cleaning', U.cleaning, ul(cleaning))}
${sec('storage', U.storage, ul(storage))}
${isPen ? sec('sharps', U.disposal, ul(C.disposal.sharps) + `<p><a href="${B}disposal/">${U.disposal} →</a></p>`) : ''}
${sec('mistakes', U.mistakes, ul(vlist(t.mistakes, d)))}
${sec('side', U.side, ul(vlist([...(d.side || []), ...(t.side || []).filter(x => !d.sideExclude || !x.includes(d.sideExclude))], d)))}
${sec('triage', U.triage, triageBox(t.triage, triExtra, d.triage2))}
${sec('video', U.video, video, ' data-noprint="1"')}
<section class="card sec meta" id="sources"><h2>${U.sources}</h2>${srcList([...(d.sources || []), ...(t.sources || []).filter(x => !(d.sources || []).includes(x))])}
<p><a class="btn" href="${esc(d.insert)}" target="_blank" rel="noopener">${U.insert}</a></p>
${metaLine(d.version)}</section>
<section class="card sec qr" id="qr"><h2>${U.qr}</h2><div class="qrimg">${qrSvg(url + '?src=qr')}</div><p class="small">${U.qrHint}<br>${esc(url)}</p></section>
</article>`;
  write(rel, layout({ rel, title: `${d.brand} ${d.zhName}`, desc: `${d.zhName}（${d.ingredient}）使用方法、步驟圖解、保存、何時就醫`, body, cls: 'p-drug' }));
}

// ---------- technique page ----------
function techPage(id) {
  const t = T[id]; if (t.alias) { write(`t/${id}/index.html`, redirectPage(`t/${id}/index.html`, `../${t.alias}/`)); return; }
  const rel = `t/${id}/index.html`, B = '../../', opts = stepOpts(t, null, B), url = SITE.baseUrl + `t/${id}/`;
  const ds = TECH_DRUGS[id] || [];
  const isPen = id === 'insulin-pen' || id === 'vial-syringe';
  const body = `<nav class="crumb no-print"><a href="${B}">${U.back}</a></nav>
<article class="tech" data-tech="${id}">
<header class="dh"><p class="eyebrow">${esc(GROUPS[t.group] || '')}｜${U.technique}</p><h1>${esc(t.title)}</h1><p class="badges">${t.highAlert ? haBadge : ''}</p></header>
<div id="product" class="idbox card" hidden></div>
<div class="role" role="note"><p>${rich(t.summary)}</p><p class="small">${U.indexOnlyNote}</p>${t.products ? `<details class="adv"><summary>進階資訊（台灣的產品、許可證字號）</summary>${ul(t.products)}</details>` : ''}</div>
<div class="actions no-print"><button type="button" class="btn tts-all">${U.readAll}</button><button type="button" class="btn tts-stop" hidden>${U.stop}</button><button type="button" class="btn" data-print>🖨 ${U.print}</button></div>
${sec('key', U.keySteps, `<ol class="keypts">${(t.keyPoints || []).map(k => `<li>${rich(k)}</li>`).join('')}</ol>`)}
${sec('prep', U.prep, renderSteps(t.prep, opts, 'pr'))}
${sec('use', U.use, renderSteps(t.use, opts, 'st'))}
${isPen ? sec('hypo', '低血糖', hypoBox()) : ''}
${t.spacer ? sec('spacer', U.spacer, renderSteps(t.spacer, opts, 'sp')) : ''}
${sec('empty', U.empty, ul(t.empty))}${sec('cleaning', U.cleaning, ul(t.cleaning))}${sec('storage', U.storage, ul(t.storage))}
${sec('mistakes', U.mistakes, ul(t.mistakes))}${sec('side', U.side, ul(t.side))}${t.interactions ? sec('inter', '重要交互作用', ul(t.interactions)) : ''}${t.overdose ? sec('over', '用太多了', ul(t.overdose)) : ''}
${Array.isArray(t.missed) ? sec('missed', U.missed, ul(t.missed)) : t.highAlert ? '' : sec('missed', U.missed, ul(C.missed))}
${HA_OF[id] ? haLinkCard(HA_OF[id], B) : ''}
${t.device === 'pmdi' ? sec('counter', '噴數計數', counterBox('t-' + id)) : ''}
${sec('triage', U.triage, triageBox(t.triage))}
${ds.length ? sec('drugs', '這個裝置的詳細藥品頁', `<ul class="links">${ds.map(d => `<li><a href="${B}d/${d.slug}/">${esc(d.brand)} ${esc(d.zhName)}</a></li>`).join('')}</ul>`) : ''}
<section class="card sec meta" id="sources"><h2>${U.sources}</h2>${srcList([...(t.sources || []).filter(s => !/\.md|qa\//.test(s)), ...ds.map(d => `${d.brand} 台灣說明書（${d.license}）：${d.insert}（2026-10-17 查詢）`)])}${metaLine()}</section>
<section class="card sec qr" id="qr"><h2>${U.qr}</h2><div class="qrimg">${qrSvg(url + '?src=qr')}</div><p class="small">${esc(url)}</p></section>
</article>`;
  write(rel, layout({ rel, title: t.title, desc: t.summary, body, cls: 'p-tech' }));
}
function redirectPage(rel, to) { return `<!doctype html><html lang="zh-Hant-TW"><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${to}"><link rel="canonical" href="${to}"><title>轉址</title><a href="${to}">前往新頁面</a></html>`; }

// ---------- home ----------
function home() {
  const rel = 'index.html', B = './';
  const cards = DRUGS.map(d => `<li class="dcard" data-chip="${d.chip}" data-s="${esc([d.brand, d.zhName, d.ingredient, d.category, CHIPS[d.chip], T[d.technique].title, d.role === 'insulinCombo' ? 'GLP-1' : '', d.license].join(' ').toLowerCase())}"><a href="d/${d.slug}/"><span class="cat">${esc(d.category)}</span><b>${esc(d.brand)}</b><span class="zh">${esc(d.zhName)}</span><span class="ing">${esc(d.ingredient)}</span><span class="badges">${roleBadge(d.role)}${d.highAlert ? haBadge : ''}</span></a></li>`).join('');
  const groups = {}; for (const [id, t] of Object.entries(T)) if (!t.alias) (groups[t.group] ||= []).push([id, t]);
  const tech = Object.entries(groups).map(([g, list]) => `<div class="tgroup" id="forms-${g}"><h3>${esc(GROUPS[g])}</h3><ul class="links">${list.map(([id, t]) => `<li data-g="${g}" data-s="${esc((t.title + ' ' + GROUPS[g] + ' ' + (t.chipWords || '')).toLowerCase())}"><a href="t/${id}/">${esc(t.title)}</a></li>`).join('')}</ul></div>`).join('');
  const body = `<h1 class="home-h1">${U.homeH1}</h1>
<div class="search card" role="search"><label for="q" class="ql">${U.searchLabel}</label><input id="q" type="search" autocomplete="off" placeholder="${esc(U.searchPlaceholder)}" aria-describedby="q-count">
<div class="chips" role="group" aria-label="類別篩選"><button type="button" class="chip" data-chip="" aria-pressed="true">${U.all}</button>${Object.entries(CHIPS).map(([k, v]) => `<button type="button" class="chip" data-chip="${k}" aria-pressed="false">${esc(v)}</button>`).join('')}</div>
<div class="chips formchips" role="group" aria-label="其他劑型的使用方法">${[['eye-drops', '眼藥水'], ['suppository', '塞劑'], ['nasal-spray', '鼻噴劑'], ['transdermal-patch', '貼片']].filter(([id]) => T[id]).map(([id, n]) => `<a class="chip formchip" href="t/${id}/">${n} →</a>`).join('')}</div>
<p id="q-count" class="small" aria-live="polite"></p></div>
<div id="tech-hits" class="card" hidden></div>
<p id="noresult" class="warnbox" hidden>${U.noResult}</p>
<p class="lead">${U.homeIntro}</p>
<section aria-labelledby="tech-h" class="card"><h2 id="tech-h">${U.techniquesH}</h2>${tech}</section>
<section aria-labelledby="feat-h"><h2 id="feat-h">${U.featured}</h2><ul id="cards" class="cards">${cards}</ul></section>
<section aria-labelledby="idx-h" class="card"><h2 id="idx-h">${U.indexH}</h2><p class="small">${U.indexIntro.replace('{n}', META.included.toLocaleString())}　資料來源：${esc(META.source)}，下載日 ${META.downloaded}。</p><p id="idx-hint" class="small">${U.indexSearchHint}</p><ol id="idx" class="idx"></ol><button type="button" id="idx-more" class="btn" hidden>顯示更多</button></section>
<section class="card"><h2>${U.highAlertH}</h2><ul class="links">${HA.classes.map(c => `<li data-s="${esc((c.title + ' ' + c.examples).toLowerCase())}"><a href="high-alert/${c.id}/">${esc(c.title)}</a></li>`).join('')}</ul></section>`;
  write(rel, layout({ rel, title: U.homeH1, body, cls: 'p-home' }));
}

// ---------- other pages ----------
function simple(rel, title, body, cls = 'p-simple') { write(rel, layout({ rel, title, body: `<nav class="crumb no-print"><a href="${'../'.repeat(rel.split('/').length - 1)}">${U.back}</a></nav><h1>${esc(title)}</h1>` + body, cls })); }
function highAlert() {
  const B = '../';
  simple('high-alert/index.html', U.highAlertH, `<p class="lead">${esc(HA.intro)}</p><ul class="cards">${HA.classes.map(c => `<li class="dcard"><a href="${c.id}/"><span class="cat">❗ ${U.highAlert}</span><b>${esc(c.title)}</b><span class="ing">${esc(c.examples)}</span></a></li>`).join('')}</ul>`);
  for (const c of HA.classes) {
    const rel = `high-alert/${c.id}/index.html`, BB = '../../';
    const body = `<nav class="crumb no-print"><a href="../">← ${U.highAlertH}</a></nav><article><header class="dh"><p class="eyebrow">❗ ${U.highAlert}</p><h1>${esc(c.title)}</h1><p>${esc(c.examples)}</p></header>
<div class="actions no-print"><button type="button" class="btn tts-all">${U.readAll}</button><button type="button" class="btn tts-stop" hidden>${U.stop}</button><button type="button" class="btn" data-print>🖨 ${U.print}</button><a class="btn" href="${BB}t/${c.technique}/">${U.openTechnique}</a></div>
${sec('k', '必知安全重點', ul(c.key))}${sec('m', U.missed, ul(c.missed))}${sec('o', '用太多或重複用了', ul(c.overdose))}
${sec('c', '立即就醫／撥打 119', `<div class="tri"><div class="tri-r">${ul(c.call)}<a class="call" href="tel:119">📞 撥打 119</a></div></div>`)}
${c.id === 'insulin-glp1' || c.id === 'oral-hypoglycemics' ? sec('h', '低血糖', hypoBox()) : ''}
${sec('i', '重要交互作用', ul(c.interactions))}${sec('s', '保存與丟棄', ul(c.storage) + `<p><a href="${BB}disposal/">${U.disposal} →</a></p>`)}
${sec('tr', U.triage, triageBox(c.triage))}
<section class="card sec meta"><h2>${U.sources}</h2>${srcList(c.sources)}${metaLine()}</section></article>`;
    write(rel, layout({ rel, title: c.title + '｜' + U.highAlert, body, cls: 'p-ha' }));
  }
}
function disposal() {
  const D = C.disposal;
  simple('disposal/index.html', D.title, `${sec('a', '一般藥品：隨一般垃圾焚化', ul(D.routeB))}${sec('b', '特殊藥品：交回醫院、診所、衛生所或檢收站藥局', ul(D.routeA))}${sec('c', '針頭、針筒、注射筆等尖銳物', ul(D.sharps))}<p class="warnbox">${esc(D.never)}</p><p class="small">${linkify(D.sourcesLine)}</p>`);
}
function glossary() { simple('glossary/index.html', U.glossary, `<dl class="gloss">${Object.entries(GL).map(([k, v]) => `<div id="${encodeURIComponent(k)}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`); }
function qrSheet() {
  const all = [...DRUGS.map(d => [`d/${d.slug}/`, d.brand, d.zhName]), ...Object.entries(T).filter(([, t]) => !t.alias).map(([id, t]) => [`t/${id}/`, t.title, U.technique])];
  simple('qr/index.html', U.qrSheet, `<p class="no-print">${U.printTip}</p><p class="no-print"><button type="button" class="btn" data-print>🖨 列印 QR 一覽表</button></p><ul class="qrsheet">${all.map(([p, a, b]) => `<li>${qrSvg(SITE.baseUrl + p + '?src=qr', 2)}<b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ul>`, 'p-qr');
}
function printPages() {
  const sets = { inhalers: ['全部吸入劑（25 項）', DRUGS.filter(d => d.chip !== 'insulin')], insulin: ['全部胰島素注射筆（15 項）', DRUGS.filter(d => d.chip === 'insulin')] };
  simple('print/index.html', U.printAll, `<p>${U.printTip}</p><ul class="links">${Object.entries(sets).map(([k, [n]]) => `<li><a href="${k}/">${esc(n)}</a></li>`).join('')}</ul><h2>單一藥品 A4 衛教單</h2><ul class="links">${DRUGS.map(d => `<li><a href="../d/${d.slug}/?print=1">${esc(d.brand)} ${esc(d.zhName)}</a></li>`).join('')}</ul>`);
  for (const [k, [n, list]] of Object.entries(sets)) {
    const frames = list.map(d => { const h = fs.readFileSync(path.join(OUT, `d/${d.slug}/index.html`), 'utf8'); const art = h.match(/<article[\s\S]*<\/article>/)[0]; return `<div class="pbreak">${art.replaceAll('../../', '../../')}</div>`; }).join('');
    write(`print/${k}/index.html`, layout({ rel: `print/${k}/index.html`, title: n, body: `<p class="no-print"><button type="button" class="btn" data-print>🖨 ${esc(n)}</button> ${U.printTip}</p>${frames}`, cls: 'p-printset' }));
  }
}
function about() {
  const sk = Object.entries(META.skipped).map(([k, v]) => `${k}：${v}`).join('；');
  simple('about/index.html', U.about, `
${sec('a1', '這個網站是什麼', `<p>${esc(SITE.hospitalName)}提供的病人自行用藥衛教網站：免登入、不收集個人資料、沒有追蹤程式。內容是一般衛教，不能取代醫師與藥師的個別指導。</p>`)}
${sec('a2', '內容來源與優先順序', ul(['① 台灣食藥署核准仿單（食藥署西藥、醫療器材及化粧品許可證查詢 https://mcp.fda.gov.tw/ ，2026-10-17 下載）。每個藥品頁都有該藥的食藥署仿單連結。', '② 原廠病人使用說明：台灣仿單沒有收錄使用步驟時才參考，頁面會標示「原廠使用說明，非台灣版」。', '③ 權威指引（GINA、FITTER、ADA、NHS、MedlinePlus、ISMP 等）。各醫院衛教單只用來核對步驟順序，不作為事實來源。', '無法從台灣仿單確認的內容，頁面會標示「' + U.nvMark + '」。', '國外版本（美、加、英、歐盟）只在台灣仿單沒有寫時參考，並在頁面標示「非台灣版」；網站不把推論寫成「仿單規定」。', '舊網站的 A4 衛教單不是仿單，不作為事實來源。', '影片只連結與該裝置相符的台灣胸腔暨重症加護醫學會影片（影片連結經標題比對；影片內容尚待藥師核對）；沒有相符影片時不放連結並說明。']))}
${sec('a3', '藥品索引（食藥署開放資料）', `<p>資料集：${esc(META.source)}（https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=36&logType=3），下載日 ${META.downloaded}。原始 ${META.total_rows.toLocaleString()} 列，收錄 ${META.included.toLocaleString()} 項。</p>${ul(['只收「未註銷」許可證。', '排除：原料藥、硬空膠囊、體外診斷試劑；藥品類別為「限由醫師使用」「由醫師或檢驗師使用」「限由牙醫師使用」「製劑原料」「調劑專用」者（病人可自行注射的胰島素、GLP-1、生物製劑、低分子量肝素、腎上腺素筆等，依成分例外收錄）；品名含「診斷」者；靜脈輸注與濃縮注射液。', '依「劑型」欄與品名關鍵字對應到使用方法頁（例如 Respimat、Turbuhaler、Ellipta 等品牌裝置；眼藥水、塞劑、貼片等劑型）。劑型欄是自由文字，對應規則可能有誤，個別產品以仿單為準。', '索引項目沒有個別劑量資訊：一律「依處方與仿單」，並提供食藥署仿單查詢連結。', `排除統計：${sk}。`]) }`)}
${sec('a4', '審核流程', ul(['每頁標示內容版本、發布日（YYYY-MM-DD）與審核狀態。目前所有頁面都是「尚未審核（尚未經醫師／藥師正式審核）」；經藥師（注射與高警訊頁另需醫師）簽核後，才會改為「已審核」並顯示審核日期。', '待確認項目由網站維護者集中整理；未確認的內容不寫成事實，而是標示「' + U.nvMark + '」。', '內容以 JSON 檔管理（data/drugs.json、i18n/zh-TW/*.json），藥師可直接編修；醫院名稱、顏色、電話在 config/site.json；院內藥品代碼對應在 config/codes.json。', '病人端沒有登入；未來若有後台編修系統，會與病人端分開。']))}
${sec('a5', 'QR Code 與院內藥品代碼', ul(['QR Code 只包含網址與頁面代號（加上 src=qr），不含任何個人資料。', `院內藥品代碼：網址加上 ?code=代碼（例如 ${SITE.baseUrl}?code=TEST-INH-001），會依 config/codes.json 轉到對應頁面；停用的代碼顯示停用說明，不明代碼顯示安全的找不到頁面。目前代碼為示範用。`]))}
${sec('a6', '多語言', `<p>v1 只提供繁體中文。架構已預備多語（每種語言一組 JSON、語言選單、雙語對照），其他語言尚未翻譯，選單中顯示「準備中」。</p>`)}`);
}
function changelog() { simple('changelog/index.html', U.changelog, CHANGES.map(([v, date, items]) => `<h2>v${v}（${date}）</h2>${ul(items)}`).join('')); }
function tally() {
  const cells = Array.from({ length: 200 }, (_, i) => `<td>${i + 1}</td>`);
  const rows = []; for (let r = 0; r < 20; r++) rows.push(`<tr>${cells.slice(r * 10, r * 10 + 10).join('')}</tr>`);
  simple('print/tally/index.html', '吸入器噴數計數表', `<p>藥名：＿＿＿＿＿＿＿＿　總噴數：＿＿＿＿　開始日期：＿＿＿＿</p><p class="small">每用 1 下，就把一格劃掉。劃到總噴數就換新的一支（即使搖起來還有聲音）。</p><p class="no-print"><button type="button" class="btn" data-print>🖨 列印計數表</button></p><table class="tally" aria-label="噴數計數格">${rows.join('')}</table>`);
}
const CHANGES = [
 ['1.2.0', '2026-10-18', [
  '每一頁最上方的緊急橫幅直接寫出要打 119 的情況（呼吸困難、胸痛、意識不清、抽搐、臉歪手無力、嚴重過敏）。',
  'Symbicort 都保、Foster 等可當「保養加緩解」的藥，標示改為「保養藥；能否也當急救用，依醫師處方」。',
  '吸入劑「忘記用藥」改成：各藥補用方式不同，看本藥品頁；Onbrez、Ultibro、Enerzair、Trimbow 依台灣說明書寫出補用方式。',
  '舌下硝化甘油：依台灣說明書寫出等救護車時每 5 分鐘再含 1 顆、15 分鐘內最多 3 顆；吃過威而鋼、犀利士等同類藥或 riociguat 不可含；保存、交互作用、用太多怎麼辦；列出台灣的產品。',
  '腎上腺素注射筆：壓住 3 秒依台灣說明書（201811V2），拔出後按摩 10 秒；第二支的時機；台灣有單支與 2 支盒裝。',
  '「尚待確認」標示改成同一句：「這一點本院藥師／醫師還在確認；請先照盒內說明書做，或問藥師」。',
  '胰島素筆：剩下的量不夠時怎麼辦，依各筆台灣說明書寫；安全測試沒有藥滴的下一步（FlexPen 依說明書最多 6 次）；每支筆的停留秒數放大顯示；要不要捏皮的判斷方式。',
  '資料來源加上可點的網址與查詢日期；使用方法頁列出各藥的台灣說明書連結。',
  '步驟圖：修正 Breezhaler、Ellipta、都保、Respimat、塞劑、胰島素筆等圖；圖的文字說明改成中文，朗讀時不再念圖。',
  'A4 列印：內文至少 9 點字、頁尾至少 8 點字，列出名稱相似藥提醒；「生效日」改為「發布日」。',
  '大字模式放大上方按鈕與橫幅；首頁可直接找眼藥水、塞劑、鼻噴劑、貼片；定量噴霧吸入器計數器預先填好總噴數。',
  '用詞更白話（慢性阻塞性肺病、拿來吃等）；眼藥水加上兩眼都要點；塞劑加上洗手、手套、塞完盡量忍住不要馬上上廁所。'
 ]],
 ['1.1.0', '2026-10-18', [
  '修正 Spiriva（適喘樂舒沛噴吸入劑）與 Spiolto（適倍樂舒沛噴吸入劑）中文品名對調。',
  '胰島素筆：安全測試的單位數只看各藥品頁（名詞解釋不再寫固定 2 單位）；Awiqli 依台灣說明書寫明忘記打怎麼補（第 1 型、第 2 型不同），並提醒第一次的一次性額外劑量第二次起不要再加；沒有藥滴時的下一步（換針頭、換筆、問藥師）；要不要捏皮的預設做法。',
  '預充填針筒（低分子量肝素）：劑量是整支時不用推掉空氣泡；劑量比整支少，要先丟掉多餘藥液。',
  '腎上腺素注射筆：打完 5–15 分鐘沒改善或變嚴重，在另一側大腿打第二支；抗過敏藥、吸入劑不能取代腎上腺素；壓住秒數與保存溫度寫出數字。舌下硝化甘油：吃過威而鋼、犀利士等藥不可含；頭暈要躺下抬腳。',
  '各使用方法頁的「忘記用藥」改成依藥品類別寫（急救藥、胰島素、貼片不同）。',
  'Symbicort 吸入劑（Rapihaler）、Trimbow 改標示為每天規律使用的保養藥；Trimbow 也用於成人氣喘，未開封要冷藏。Enerzair 加上漱口步驟。Alvesco、Foster、Trimbow 不再出現互相矛盾的「搖勻」說法。',
  '每支藥只顯示和它有關的提醒（例如不含類固醇的藥不再出現漱口、預混型混勻只出現在預混型胰島素）。',
  '步驟圖：修正胰島素筆排氣方向（針頭朝上）、膠囊吸入器方向、眼藥水與塞劑圖；圖上的秒數改由該步驟文字帶入；每張圖加步驟號，部位標示改用 A、B、C。',
  '無法從台灣說明書確認的內容加上「ⓘ 尚待本院藥師確認」標示；專有名詞改用白話（例如「藥盒裡的說明書」）。',
  '頁面不再顯示內部工作檔案名稱；審核狀態改標示「尚未經醫師／藥師正式審核」；版本與生效日統一為 YYYY-MM-DD。',
  '用藥諮詢電話未設定時，顯示「請打藥袋上印的藥局電話」。首頁搜尋移到最上面，緊急資訊改成可展開的橫幅，並可依劑型（眼藥、塞劑、鼻噴劑、貼片等）找使用方法。',
  '新增吸入器噴數計數器（只存在自己的手機）與可列印的計數表；A4 列印改成精簡版。'
 ]],
 ['1.0.0', '2026-10-18', ['全新網站：取代舊版（免登入、真文字取代圖片、手機大字、朗讀、列印 A4）。', '40 項重點吸入劑與胰島素筆的詳細頁，依台灣仿單與事實查核清單修正（例如 Toujeo 安全測試 3 單位、NovoRapid 使用中可冷藏、NovoMix 30 混勻方式、Foster NEXThaler 開蓋未吸不會少劑量、Foster 定量吸入劑領藥後 5 個月、Anoro 長而穩定深吸、Ellipta 各品牌開封期限）。', '依劑型的使用方法頁（吸入、注射、口服、外用、眼耳鼻、肛門、陰道）。', '食藥署開放資料藥品索引，可搜尋所有自行使用劑型。', '高警訊藥品專區、LASA 提示、三級就醫警訊、全站緊急資訊、剩藥丟棄兩種方式。', '院內藥品代碼（?code=）對應、QR 一覽表、列印合輯。']]
];
function errorPages() {
  write('404.html', layout({ rel: '404.html', title: '找不到頁面', body: `<h1>找不到頁面</h1><p class="warnbox">${U.notFound}</p>${phoneBtn()}<p><a class="btn" href="${SITE.baseUrl}">${U.back}</a></p><script>(function(){var m=location.pathname.match(/\\/([a-z0-9-]+)\\/?$/);})()</script>`, cls: 'p-404' }).replaceAll('href="./', `href="${SITE.baseUrl}`).replaceAll('src="./', `src="${SITE.baseUrl}`));
  simple('offline/index.html', '目前離線', `<p class="warnbox">${U.offline}</p>${phoneBtn()}`);
}

// ---------- assets / data ----------
function assets() {
  for (const d of ['css', 'js'].filter(x => fs.existsSync(path.join(ROOT, x)))) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'data/index'), { recursive: true });
  for (const f of ['oral', 'topical', 'other', 'meta']) fs.copyFileSync(path.join(ROOT, `data/index/${f}.json`), path.join(OUT, `data/index/${f}.json`));
  const techTitles = Object.fromEntries(Object.entries(T).map(([k, t]) => [k, t.title]));
  fs.writeFileSync(path.join(OUT, 'data/app.json'), JSON.stringify({ version: VER, techTitles, codes: CODES.codes, langs: SITE.languages, slugs: DRUGS.map(d => d.slug), ui: { notFound: U.notFound, retired: U.retired, updated: U.updated, langNotAvailable: U.langNotAvailable, ttsUnavailable: U.ttsUnavailable, showing: U.showing, indexLoading: U.indexLoading, indexSearchHint: U.indexSearchHint, openTechnique: U.openTechnique, insert: U.insert, license: U.license, ingredient: U.ingredient, form: U.form, indexOnlyNote: U.indexOnlyNote, checkDrug: U.checkDrug, phone: PHONE_SET ? SITE.consultPhone : '', phoneHref: PHONE_SET ? SITE.consultPhoneHref : '', phoneFallback: U.phoneFallback } }));
  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({ name: SITE.hospitalShort + ' ' + U.siteTitle, short_name: '用藥衛教', start_url: './', display: 'standalone', background_color: SITE.colors.bg, theme_color: SITE.colors.primary, lang: 'zh-Hant-TW', icons: [] }));
  { const h = createHash('sha1');
    for (const f of ['css/style.css', 'js/app.js', 'js/svg.js', 'js/sw.js']) h.update(fs.readFileSync(path.join(ROOT, f)));
    fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync(path.join(ROOT, 'js/sw.js'), 'utf8').replace("const V = 'v1.0.0';", `const V = 'v1-${h.digest('hex').slice(0, 10)}';`)); }
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');
}

home(); for (const d of DRUGS) drugPage(d); for (const id of Object.keys(T)) techPage(id);
highAlert(); disposal(); glossary(); qrSheet(); printPages(); tally(); about(); changelog(); errorPages(); assets();
const pages = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(path.relative(OUT, p)); } })(OUT);
fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(pages.sort()));
console.log('pages', pages.length, 'warnings', [...new Set(warnings)]);
