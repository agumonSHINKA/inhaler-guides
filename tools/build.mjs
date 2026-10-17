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
function rich(s) { // escape + [[glossary]] tooltips
  return esc(s).replace(/\[\[([^\]]+)\]\]/g, (m, term) => {
    const def = GL[term]; if (!def) { warnings.push('glossary missing: ' + term); return term; }
    const id = 'g' + (++glN);
    return `<span class="gl"><button type="button" class="gl-btn" aria-expanded="false" aria-controls="${id}" title="${esc(def)}">${esc(term)}</button><span class="gl-pop" id="${id}" role="tooltip" hidden>${esc(def)}</span></span>`;
  });
}
const plain = s => String(s ?? '').replace(/\[\[([^\]]+)\]\]/g, '$1');
const tsvFile = tm => false; // teammate SVG set retired (2026-10-18); all steps use our own inline scenes (js/svg.js)
function qrSvg(url, cell = 4) { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }).replace('<svg ', `<svg role="img" aria-label="QR Code：${esc(url)}" `); }
function write(rel, html) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); }
const ul = (arr, cls = '') => arr && arr.length ? `<ul class="${cls}">${arr.map(x => `<li>${rich(x)}</li>`).join('')}</ul>` : '';
const sec = (id, title, body, extra = '') => body ? `<section class="card sec" id="${id}" aria-labelledby="${id}-h"${extra}><div class="sec-head"><h2 id="${id}-h">${esc(title)}</h2><button type="button" class="tts-sec" data-tts="${id}" aria-label="${esc(U.readSection)}：${esc(title)}">${U.readSection}</button></div>${body}</section>` : '';
const roleBadge = r => r === 'reliever' ? `<span class="badge b-rescue">🚑 ${U.rescue}</span>` : (['maintenance', 'copd', 'copdOnly', 'mart'].includes(r) ? `<span class="badge b-notrescue">⚠ ${U.notRescue}</span>` : '');
const haBadge = `<span class="badge b-ha" title="${esc(GL['高警訊藥品'])}">❗ ${U.highAlert}</span>`;

// ---------- layout ----------
function layout({ rel, title, desc = '', body, cls = '', canonical = '', noindexSearch = false }) {
  const depth = rel.split('/').length - 1; const B = depth ? '../'.repeat(depth) : './';
  const url = SITE.baseUrl + rel.replace(/index\.html$/, '');
  const langs = SITE.languages.map(l => `<option value="${l.code}"${l.code === LANG ? ' selected' : ''}${l.enabled ? '' : ' disabled'}>${esc(l.label)}${l.enabled ? '' : '（準備中）'}</option>`).join('');
  const phone = SITE.consultPhoneHref ? `<a href="${esc(SITE.consultPhoneHref)}">${esc(SITE.consultPhone)}</a>` : esc(SITE.consultPhone);
  return `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}｜${esc(SITE.hospitalShort)} ${esc(U.siteTitle)}</title><meta name="description" content="${esc(desc || U.homeIntro)}">
<link rel="canonical" href="${esc(canonical || url)}"><meta name="theme-color" content="${SITE.colors.primary}">
<link rel="stylesheet" href="${B}css/style.css?v=${VER}"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%92%8A%3C/text%3E%3C/svg%3E"><link rel="manifest" href="${B}manifest.webmanifest">
<style>:root{--primary:${SITE.colors.primary};--accent:${SITE.colors.accent};--bg:${SITE.colors.bg}}</style>
<script>try{if(localStorage.getItem('lt')==='1')document.documentElement.classList.add('lt')}catch(e){}</script>
</head><body class="${cls}" data-base="${B}" data-ver="${VER}" data-url="${esc(url)}">
<a class="skip" href="#main">${U.skip}</a>
<div class="beta-banner" role="note"><strong>測試版 v1</strong> — 尚未經藥師正式審核，請勿用於實際用藥決策，實際用法以醫師處方與藥師指導為準</div>
<header class="top"><div class="wrap top-in">
<a class="brand" href="${B}">${SITE.logo ? `<img src="${B}${esc(SITE.logo)}" alt="" height="40">` : '<span class="logo" aria-hidden="true">💊</span>'}<span><b>${esc(SITE.hospitalName)}</b><small>${esc(U.siteTitle)}</small></span></a>
<div class="tools" role="group" aria-label="顯示設定">
<button type="button" id="lt-btn" class="tbtn" aria-pressed="false">${U.largeText}</button>
<label class="tbtn lang"><span class="sr">${U.language}</span><select id="lang-sel" aria-label="${U.language}">${langs}</select></label>
<label class="tbtn bil" title="其他語言上線後可開啟"><input type="checkbox" id="bil" disabled> ${U.bilingual}</label>
</div></div></header>
<div id="notice" class="wrap notice" role="status" aria-live="polite" hidden></div>
<aside class="wrap emerg" aria-labelledby="emerg-h"><h2 id="emerg-h" class="sr">${C.emergency.title}</h2>
<p><b>🔴 ${C.emergency.lines[0].replace(/^🔴\s*/, '')}</b> <a class="call" href="tel:119">📞 撥打 119</a></p>
<p class="small">${esc(C.emergency.lines[1])} <a href="${SITE.poisonCenter.href}">${esc(SITE.poisonCenter.phone)}</a></p></aside>
<main id="main" class="wrap" tabindex="-1">${body}</main>
<footer class="foot"><div class="wrap">
<p class="print-only pfoot">${esc(SITE.hospitalName)}｜${U.version} v${VER}｜${U.lastReviewed} ${SITE.lastReviewed}｜${U.effective} ${SITE.effective}｜${esc(url)}</p>
<p><b>${U.doseRule}</b></p><p>${U.firstUse}</p>
<p>${U.contact}：${phone}（${esc(SITE.consultHours)}）｜${esc(SITE.poisonCenter.name)} <a href="${SITE.poisonCenter.href}">${esc(SITE.poisonCenter.phone)}</a></p>
<p class="small">${U.disclaimer}</p>
<nav class="fnav" aria-label="網站資訊"><a href="${B}glossary/">${U.glossary}</a><a href="${B}high-alert/">${U.highAlertH}</a><a href="${B}disposal/">${U.disposal}</a><a href="${B}qr/">${U.qrSheet}</a><a href="${B}print/">${U.printAll}</a><a href="${B}about/">${U.about}</a><a href="${B}changelog/">${U.changelog}</a></nav>
<p class="small">${U.version} v${VER}｜${U.lastReviewed} ${SITE.lastReviewed}｜${U.effective} ${SITE.effective}｜無追蹤、不收集個資</p>
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
    const figHtml = (st.img || st.tm) ? stepFig(st, opts, alt, st.forceInline) : '';
    const fig = (st.img || st.tm) ? `<figure class="fig">${figHtml}${inline && !st._noLegend && st.c && st.c.length && st.img ? `<figcaption><ol class="callouts">${st.c.map(c => `<li>${esc(c)}</li>`).join('')}</ol></figcaption>` : ''}</figure>` : '';
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
    if (d.shake === false) steps = steps.filter(s => s.id !== 'shake');
    if (d.shake === 'check') steps = steps.map(s => s.id === 'shake' ? { ...s, t: '本品為溶液型噴霧，是否需要搖勻、怎麼搖，請依仿單或藥師說明（待藥師確認）。' } : s);
    steps = steps.map(s => s.img === 'wait-repeat' && d.gap ? { ...s, t: s.t.replace('約 30 秒（依仿單）', d.gap) } : s);
    if (d.hold) steps = steps.map(s => s.img === 'hold-breath' ? { ...s, t: `移開吸入器，閉上嘴巴，閉氣${d.hold}。`, tm: undefined } : s);
  }
  if (!d.rinse) steps = steps.filter(s => s.id !== 'rinse');
  if (t === T['insulin-pen']) {
    steps = steps.filter(s => s.id !== 'mix' || d.mix).map(s => {
      if (s.id === 'mix') return { ...s, t: '只有乳白色的預混型需要混勻：' + d.mix };
      if (s.img === 'pen-prime') { const two = /^2 單位/.test(d.test || ''); return { ...s, t: `[[安全測試]]：每次注射前，轉到 ${d.test}${d.testNote ? `（${d.testNote}）` : ''}，針頭朝上，輕彈筆芯讓氣泡升上去，把注射鈕按到底，確認針尖出現藥滴。${d.retries ? `沒有藥滴：${d.retries}。` : '沒有藥滴就再做一次，仍沒有就換新針頭或詢問藥師。'}`, forceInline: !two, img: 'pen-prime' }; }
      if (s.id === 'hold') return { ...s, t: `按住注射鈕，劑量視窗回到 0 後，針頭繼續留在皮膚內「${d.hold}」再拔出，確保藥全部打進去。拔出後不要揉。`, forceInline: true };
      return s;
    });
  }
  return steps;
}
function stepOpts(t, d, B) { return { B, accent: t.accent, device: t.device, hold: d?.hold && /\d/.test(d.hold) ? d.hold.replace(/[^\d]/g, '') + ' 秒' : undefined, primeUnits: d?.test ? (d.test.match(/^\d+/) || ['?'])[0] : '2', cloudy: d?.role === 'insulinMix', roomTemp: d ? (((d.storage || []).join(' ').match(/(\d\d)°C 以下/) || [])[1] ? (d.storage.join(' ').match(/(\d\d)°C 以下/))[1] : undefined) : undefined }; }

// ---------- drug page ----------
function lasaBox(d, B) {
  if (!d.lasa?.length) return '';
  const items = d.lasa.map(g => LASA[g]).filter(Boolean);
  return `<div class="lasa" role="note"><h3>⚠ ${U.lasa}</h3><p>${U.lasaText}</p><ul>${items.map(it => `<li><b>${esc(it.t)}</b>：${esc(it.x)} ${it.m.filter(s => s !== d.slug).map(s => { const o = DRUGS.find(x => x.slug === s); return o ? `<a href="${B}d/${s}/">${esc(o.brand)}</a>` : ''; }).join('、')}</li>`).join('')}</ul></div>`;
}
function drugPage(d) {
  const rel = `d/${d.slug}/index.html`, B = '../../', t = T[d.technique]; if (!t) throw new Error('no technique ' + d.technique);
  const opts = stepOpts(t, d, B), url = SITE.baseUrl + `d/${d.slug}/`;
  const isPen = d.technique === 'insulin-pen';
  const roleTxt = C.roles[d.role] || '';
  const roleBox = roleTxt ? `<div class="role role-${d.role}" role="note"><b>${d.role === 'reliever' ? '🚑 ' + U.rescue : (isPen ? '💉 ' : '⚠ ' + U.notRescue)}</b><p>${esc(roleTxt)}</p>${d.role === 'reliever' ? `<p class="redline">${U.relieverRed}</p>` : ''}</div>` : '';
  const warn = (d.warn || []).length ? `<div class="warnbox" role="note">${ul(d.warn)}</div>` : '';
  const keyPts = [...(t.keyPoints || [])];
  if (d.role === 'reliever') keyPts.push('用了還是喘、沒有緩解：立即撥打 119');
  if (isPen) { keyPts.splice(1, 1, `每次換新針頭，安全測試 ${d.test}（看到藥滴）`); keyPts.splice(3, 1, `垂直刺入，按到底並停留「${d.hold}」`); keyPts.push(U.noDouble); }
  if (d.role === 'insulinWeekly') keyPts.unshift('一週只打一次，不是每天打');
  const prep = d.prep || t.prep;
  const use = drugUseSteps(t, d);
  const spacer = d.technique === 'pmdi' ? renderSteps(t.spacer, opts, 'sp') + ul(d.spacerNote) : '';
  const empty = d.empty || t.empty, cleaning = d.cleaning || t.cleaning, storage = [...(d.storage || []), ...(t.storage || []).filter(s => !d.storage || /兒童/.test(s))];
  const triExtra = d.role === 'reliever' ? [U.relieverRed] : [];
  const video = d.video ? `<p><a class="btn" href="${esc(d.video)}" target="_blank" rel="noopener">▶ ${U.video}（${esc(d.brand)}）↗</a></p><p class="small">${esc(d.videoNote || '')} ${U.videoNote}</p><div class="print-only">${qrSvg(d.video, 2)}</div>` : `<p>${U.noVideo}</p>`;
  const missed = isPen ? sec('missed', U.missedPen, `<p class="redline">${U.noDouble}</p><p>${esc(d.missed || U.missedAsk)}</p>${ul(C.missed.slice(1, 2))}`) : '';
  const body = `<nav class="crumb no-print"><a href="${B}">${U.back}</a></nav>
<article class="drug" data-slug="${d.slug}">
<header class="dh"><p class="eyebrow">${esc(d.category)}${d.role === 'insulinCombo' ? '｜胰島素＋GLP-1 複方' : ''}</p><h1>${esc(d.brand)}<span class="zh">${esc(d.zhName)}</span></h1>
<p class="badges">${roleBadge(d.role)}${d.highAlert ? haBadge : ''}${d.lasa?.length ? `<span class="badge b-lasa">👀 LASA</span>` : ''}</p></header>
<div class="idbox card"><dl><div><dt>${U.ingredient}</dt><dd>${esc(d.ingredient)}</dd></div><div><dt>${U.strength}</dt><dd>${esc(d.strength)}</dd></div><div><dt>${U.license}</dt><dd>${esc(d.license)}</dd></div><div><dt>${U.technique}</dt><dd><a href="${B}t/${d.technique}/">${esc(t.title)}</a></dd></div></dl>
<p class="check">✅ ${U.checkDrug}</p></div>
${roleBox}${warn}${lasaBox(d, B)}
<div class="actions no-print"><button type="button" class="btn tts-all">${U.readAll}</button><button type="button" class="btn tts-stop" hidden>${U.stop}</button><button type="button" class="btn" data-print>🖨 ${U.print}</button><a class="btn" href="#qr">${U.qr}</a></div>
${sec('key', U.keySteps, `<ol class="keypts">${keyPts.map(k => `<li>${rich(k)}</li>`).join('')}</ol>`)}
${sec('purpose', U.purpose, `<p>${rich(d.purpose)}</p>${ul(d.usual)}<p class="dose">${U.doseRule}</p>`)}
${sec('prep', U.prep, renderSteps(prep, opts, 'pr'))}
${sec('use', U.use, renderSteps(use, opts, 'st'))}
${isPen ? sec('hypo', '低血糖', hypoBox()) : ''}
${missed}
${spacer ? sec('spacer', U.spacer, spacer) : ''}
${sec('empty', U.empty, ul(empty))}
${sec('cleaning', U.cleaning, ul(cleaning))}
${sec('storage', U.storage, ul(storage))}
${isPen ? sec('sharps', U.disposal, ul(C.disposal.sharps) + `<p><a href="${B}disposal/">${U.disposal} →</a></p>`) : ''}
${sec('mistakes', U.mistakes, ul(t.mistakes))}
${sec('side', U.side, ul([...(d.side || []), ...(t.side || [])]))}
${sec('triage', U.triage, triageBox(t.triage, triExtra, d.triage2))}
${sec('video', U.video, video, ' data-noprint="1"')}
<section class="card sec meta" id="sources"><h2>${U.sources}</h2>${ul([...(d.sources || []), ...(t.sources || [])])}
<p><a class="btn" href="${esc(d.insert)}" target="_blank" rel="noopener">${U.insert}</a></p>
<p class="small">${U.reviewStatus}：<b>草稿，藥師審核中</b>｜${U.lastReviewed}：${SITE.lastReviewed}｜${U.version} v${VER}｜${U.effective} ${SITE.effective}</p></section>
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
<div class="role" role="note"><p>${rich(t.summary)}</p><p class="small">${U.indexOnlyNote}</p></div>
<div class="actions no-print"><button type="button" class="btn tts-all">${U.readAll}</button><button type="button" class="btn tts-stop" hidden>${U.stop}</button><button type="button" class="btn" data-print>🖨 ${U.print}</button></div>
${sec('key', U.keySteps, `<ol class="keypts">${(t.keyPoints || []).map(k => `<li>${rich(k)}</li>`).join('')}</ol>`)}
${sec('prep', U.prep, renderSteps(t.prep, opts, 'pr'))}
${sec('use', U.use, renderSteps(t.use, opts, 'st'))}
${isPen ? sec('hypo', '低血糖', hypoBox()) : ''}
${t.spacer ? sec('spacer', U.spacer, renderSteps(t.spacer, opts, 'sp')) : ''}
${sec('empty', U.empty, ul(t.empty))}${sec('cleaning', U.cleaning, ul(t.cleaning))}${sec('storage', U.storage, ul(t.storage))}
${sec('mistakes', U.mistakes, ul(t.mistakes))}${sec('side', U.side, ul(t.side))}
${sec('missed', U.missed, ul(C.missed))}
${sec('triage', U.triage, triageBox(t.triage))}
${ds.length ? sec('drugs', '這個裝置的詳細藥品頁', `<ul class="links">${ds.map(d => `<li><a href="${B}d/${d.slug}/">${esc(d.brand)} ${esc(d.zhName)}</a></li>`).join('')}</ul>`) : ''}
<section class="card sec meta" id="sources"><h2>${U.sources}</h2>${ul(t.sources)}<p class="small">${U.reviewStatus}：<b>草稿，藥師審核中</b>｜${U.lastReviewed}：${SITE.lastReviewed}｜${U.version} v${VER}</p></section>
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
  const tech = Object.entries(groups).map(([g, list]) => `<div class="tgroup"><h3>${esc(GROUPS[g])}</h3><ul class="links">${list.map(([id, t]) => `<li data-s="${esc((t.title + ' ' + GROUPS[g]).toLowerCase())}"><a href="t/${id}/">${esc(t.title)}</a></li>`).join('')}</ul></div>`).join('');
  const body = `<h1>${U.homeH1}</h1><p class="lead">${U.homeIntro}</p>
<div class="search card" role="search"><label for="q" class="ql">${U.searchLabel}</label><input id="q" type="search" autocomplete="off" placeholder="${esc(U.searchPlaceholder)}" aria-describedby="q-count">
<div class="chips" role="group" aria-label="類別篩選"><button type="button" class="chip" data-chip="" aria-pressed="true">${U.all}</button>${Object.entries(CHIPS).map(([k, v]) => `<button type="button" class="chip" data-chip="${k}" aria-pressed="false">${esc(v)}</button>`).join('')}</div>
<p id="q-count" class="small" aria-live="polite"></p></div>
<p id="noresult" class="warnbox" hidden>${U.noResult}</p>
<section aria-labelledby="feat-h"><h2 id="feat-h">${U.featured}</h2><ul id="cards" class="cards">${cards}</ul></section>
<section aria-labelledby="idx-h" class="card"><h2 id="idx-h">${U.indexH}</h2><p class="small">${U.indexIntro.replace('{n}', META.included.toLocaleString())}　資料來源：${esc(META.source)}，下載日 ${META.downloaded}。</p><p id="idx-hint" class="small">${U.indexSearchHint}</p><ol id="idx" class="idx"></ol><button type="button" id="idx-more" class="btn" hidden>顯示更多</button></section>
<section aria-labelledby="tech-h" class="card"><h2 id="tech-h">${U.techniquesH}</h2>${tech}</section>
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
<section class="card sec meta"><h2>${U.sources}</h2>${ul(c.sources)}<p class="small">${U.reviewStatus}：<b>草稿，藥師／醫師審核中</b>｜${U.lastReviewed}：${SITE.lastReviewed}｜${U.version} v${VER}</p></section></article>`;
    write(rel, layout({ rel, title: c.title + '｜' + U.highAlert, body, cls: 'p-ha' }));
  }
}
function disposal() {
  const D = C.disposal;
  simple('disposal/index.html', D.title, `${sec('a', '一般藥品：隨一般垃圾焚化', ul(D.routeB))}${sec('b', '特殊藥品：交回醫院、診所、衛生所或檢收站藥局', ul(D.routeA))}${sec('c', '針頭、針筒、注射筆等尖銳物', ul(D.sharps))}<p class="warnbox">${esc(D.never)}</p><p class="small">資料來源：食藥署、衛生福利部、環境部「廢棄藥品處理」宣導；各縣市衛生局公告。</p>`);
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
${sec('a2', '內容來源與優先順序', ul(['① 台灣食藥署核准仿單（藥品仿單查詢平台 mcp.fda.gov.tw，2026-10-17 下載，存檔於審核資料夾）。', '② 原廠台灣版病人使用說明。', '③ 權威指引（GINA、FITTER、ADA、NHS、MedlinePlus、ISMP 等）與台灣醫學中心衛教。', '國外版本（美、加、英、歐盟）只在台灣仿單沒有寫時參考，並在頁面標示「非台灣版」；網站不把推論寫成「仿單規定」。', '舊網站的 A4 衛教單不是仿單，不作為事實來源。', '影片只連結與該裝置相符、經查核的台灣胸腔暨重症加護醫學會影片；沒有相符影片時不放連結並說明。']))}
${sec('a3', '藥品索引（食藥署開放資料）', `<p>資料集：${esc(META.source)}（https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=36&logType=3），下載日 ${META.downloaded}。原始 ${META.total_rows.toLocaleString()} 列，收錄 ${META.included.toLocaleString()} 項。</p>${ul(['只收「未註銷」許可證。', '排除：原料藥、硬空膠囊、體外診斷試劑；藥品類別為「限由醫師使用」「由醫師或檢驗師使用」「限由牙醫師使用」「製劑原料」「調劑專用」者（病人可自行注射的胰島素、GLP-1、生物製劑、低分子量肝素、腎上腺素筆等，依成分例外收錄）；品名含「診斷」者；靜脈輸注與濃縮注射液。', '依「劑型」欄與品名關鍵字對應到使用方法頁（例如 Respimat、Turbuhaler、Ellipta 等品牌裝置；眼藥水、塞劑、貼片等劑型）。劑型欄是自由文字，對應規則可能有誤，個別產品以仿單為準。', '索引項目沒有個別劑量資訊：一律「依處方與仿單」，並提供食藥署仿單查詢連結。', `排除統計：${sk}。`]) }`)}
${sec('a4', '審核流程', ul(['每頁標示版本、最後審閱日期、生效日與藥師審核狀態。v1 所有頁面狀態為「草稿，藥師審核中」，需經藥師（注射與高警訊頁另需醫師）簽核後才改為「已審核」。', '待確認項目集中列在 REVIEW_NOTES.md；未確認的內容不寫成事實，而是請病人依仿單或詢問藥師。', '內容以 JSON 檔管理（data/drugs.json、i18n/zh-TW/*.json），藥師可直接編修；醫院名稱、顏色、電話在 config/site.json；院內藥品代碼對應在 config/codes.json。', '病人端沒有登入；未來若有後台編修系統，會與病人端分開。']))}
${sec('a5', 'QR Code 與院內藥品代碼', ul(['QR Code 只包含網址與頁面代號（加上 src=qr），不含任何個人資料。', `院內藥品代碼：網址加上 ?code=代碼（例如 ${SITE.baseUrl}?code=TEST-INH-001），會依 config/codes.json 轉到對應頁面；停用的代碼顯示停用說明，不明代碼顯示安全的找不到頁面。目前代碼為示範用。`]))}
${sec('a6', '多語言', `<p>v1 只提供繁體中文。架構已預備多語（每種語言一組 JSON、語言選單、雙語對照），其他語言尚未翻譯，選單中顯示「準備中」。</p>`)}`);
}
function changelog() { simple('changelog/index.html', U.changelog, `<h2>v${VER}（${SITE.effective}）</h2>${ul(['全新網站：取代舊版（免登入、真文字取代圖片、手機大字、朗讀、列印 A4）。', '40 項重點吸入劑與胰島素筆的詳細頁，依台灣仿單與事實查核清單修正（例如 Toujeo 安全測試 3 單位、NovoRapid 使用中可冷藏、NovoMix 30 混勻方式、Foster NEXThaler 開蓋未吸不會少劑量、Foster 定量吸入劑領藥後 5 個月、Anoro 長而穩定深吸、Ellipta 各品牌開封期限）。', '依劑型的使用方法頁（吸入、注射、口服、外用、眼耳鼻、肛門、陰道）。', '食藥署開放資料藥品索引，可搜尋所有自行使用劑型。', '高警訊藥品專區、LASA 提示、三級就醫警訊、全站緊急資訊、剩藥丟棄兩種方式。', '院內藥品代碼（?code=）對應、QR 一覽表、列印合輯。'])}`); }
function errorPages() {
  write('404.html', layout({ rel: '404.html', title: '找不到頁面', body: `<h1>找不到頁面</h1><p class="warnbox">${U.notFound}</p><p><a class="btn" href="${SITE.baseUrl}">${U.back}</a></p><script>(function(){var m=location.pathname.match(/\\/([a-z0-9-]+)\\/?$/);})()</script>`, cls: 'p-404' }).replaceAll('href="./', `href="${SITE.baseUrl}`).replaceAll('src="./', `src="${SITE.baseUrl}`));
  simple('offline/index.html', '目前離線', `<p class="warnbox">${U.offline}</p>`);
}

// ---------- assets / data ----------
function assets() {
  for (const d of ['css', 'js'].filter(x => fs.existsSync(path.join(ROOT, x)))) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'data/index'), { recursive: true });
  for (const f of ['oral', 'topical', 'other', 'meta']) fs.copyFileSync(path.join(ROOT, `data/index/${f}.json`), path.join(OUT, `data/index/${f}.json`));
  const techTitles = Object.fromEntries(Object.entries(T).map(([k, t]) => [k, t.title]));
  fs.writeFileSync(path.join(OUT, 'data/app.json'), JSON.stringify({ version: VER, techTitles, codes: CODES.codes, langs: SITE.languages, slugs: DRUGS.map(d => d.slug), ui: { notFound: U.notFound, retired: U.retired, updated: U.updated, langNotAvailable: U.langNotAvailable, ttsUnavailable: U.ttsUnavailable, showing: U.showing, indexLoading: U.indexLoading, indexSearchHint: U.indexSearchHint, openTechnique: U.openTechnique, insert: U.insert, license: U.license, ingredient: U.ingredient, form: U.form, indexOnlyNote: U.indexOnlyNote, checkDrug: U.checkDrug } }));
  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({ name: SITE.hospitalShort + ' ' + U.siteTitle, short_name: '用藥衛教', start_url: './', display: 'standalone', background_color: SITE.colors.bg, theme_color: SITE.colors.primary, lang: 'zh-Hant-TW', icons: [] }));
  { const h = createHash('sha1');
    for (const f of ['css/style.css', 'js/app.js', 'js/svg.js', 'js/sw.js']) h.update(fs.readFileSync(path.join(ROOT, f)));
    fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync(path.join(ROOT, 'js/sw.js'), 'utf8').replace("const V = 'v1.0.0';", `const V = 'v1-${h.digest('hex').slice(0, 10)}';`)); }
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');
}

home(); for (const d of DRUGS) drugPage(d); for (const id of Object.keys(T)) techPage(id);
highAlert(); disposal(); glossary(); qrSheet(); printPages(); about(); changelog(); errorPages(); assets();
const pages = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(path.relative(OUT, p)); } })(OUT);
fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(pages.sort()));
console.log('pages', pages.length, 'warnings', [...new Set(warnings)]);
