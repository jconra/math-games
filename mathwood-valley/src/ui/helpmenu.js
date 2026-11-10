// helpmenu.js: THE HELP BUTTON. A "?" always in the top corner while playing (beside the Menu button; in a builder's
// top bar; in the lock box's top strip), by touch, mouse or the ? key (the / key, with or without Shift). It opens a
// menu, the game waiting meanwhile, with (src/helpplan.js sectionsFor):
//   Old Hob says        what Hob just said here, and his tip for this job (open)
//   An example          a question like the one on screen, at the rider's level, made by the job's own question maker,
//                       with its answer; then the helpers that already teach it, one press each: Work it out (the
//                       example's sum, or the one on screen), the job's own Help picture, a builder's Show me
//   Skip                a new question, a little easier (main.js: a gentle miss for the level, src/levels/model.js
//                       skipLevel; the job deals again)
//   Tell us             the old "Confusing?" report: the question on screen filled in (src/ui/flag.js questionNow), or
//                       with none up, the job and a short line about the build; sent as the chip's mark was
//   The video           the how-to video's thumbnail in a YouTube frame, opening this job's chapter in a new tab
//                       (hidden until src/helpplan.js HOWTO has a video id)
//   External Links      not yet (src/helpplan.js LINKS is empty: the game's maker said hold off)
// The "?" draws attention, gently, while the rider seems stuck (src/helpplan.js STUCK): a slowly turning arc round it
// (HELPQ.look 'arc', the default) or a slow pulse ('pulse'). Never a flash: one turn in 3 s, or one swell in 2.6 s;
// with "reduce motion" asked for, a steady ring. Every part closes with the X, Esc, or a tap outside.
//
//   const H = makeHelpMenu({ host, context, onOpen, onClose, watch, look })
//     host()      the element the "?" goes in now, or null (hidden: the title, the pause menu ...)
//     context()   what the menu shows, read as it opens (main.js helpContext): { job, name, q, hob: { now, tip, other }, example:
//                 { first, next() } | null, helpers: [{ label, line, run }], skip: fn | null, summary, build, video:
//                 { link, at, length, name, pic } | null, links, place, tier }
//     onOpen() / onClose()   the game waits while it is open
//     watch       the "seems stuck" watch (helpplan.js makeStuckWatch): its light, and opened() as the menu opens
//   H.button, H.menu, H.update() (a few times a second: the host, the light), H.open(), H.close(), H.toggle(),
//   H.isOpen(), H.look(name), H.state() (for rigs), H.dispose()

import { sectionsFor, reportOf, clockText, sumIn } from '../helpplan.js';
import { NO_NAMES, hush, ensureCss as ensureFbCss, sendQuestion } from './flag.js';
import { HOB_FACE } from './hud.js';

export const HELPQ = { look: 'arc', keys: ['Slash', 'NumpadDivide'], keyLabel: '?' };

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const X_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const Q_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 9.1c0-2.1 1.5-3.6 3.5-3.6s3.5 1.3 3.5 3.2c0 2.6-3.3 2.9-3.3 5.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12.3" cy="18.4" r="1.6" fill="currentColor"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 68 48" aria-hidden="true"><path d="M66.5 7.7c-.8-2.9-3-5.2-5.9-6C55.3.3 34 .3 34 .3s-21.3 0-26.6 1.4c-2.9.8-5.1 3.1-5.9 6C0 13 0 24 0 24s0 11 1.5 16.3c.8 2.9 3 5.2 5.9 6C12.7 47.7 34 47.7 34 47.7s21.3 0 26.6-1.4c2.9-.8 5.1-3.1 5.9-6C68 35 68 24 68 24s0-11-1.5-16.3z" fill="#f00"/><path d="M27 34.2V13.8L45 24z" fill="#fff"/></svg>';

function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('bmq-css')) return;
  const s = document.createElement('style'); s.id = 'bmq-css';
  s.textContent = `
.bmq-btn { position: relative; flex: none; display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border-radius: 50%; cursor: pointer;
  pointer-events: auto; color: #f3c56b; background: rgba(36, 24, 14, 0.86); border: 2px solid #c89236; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.bmq-btn svg { width: 24px; height: 24px; }
.bmq-btn:hover, .bmq-btn:focus-visible { color: #ffe1a0; border-color: #f3c56b; outline: none; }
.bmq-btn[hidden] { display: none; }
.bmq-btn.is-open { background: #6d4b2b; color: #fff4dc; }
/* (the attention: a slowly turning arc, or a slow swell; never a flash, and nothing that moves with "reduce motion") */
.bmq-btn::before { content: ''; position: absolute; inset: -7px; border-radius: 50%; opacity: 0; pointer-events: none; transition: opacity 0.6s ease; }
.bmq-btn.is-stuck.is-arc::before { opacity: 1; background: conic-gradient(from 0deg, rgba(243, 197, 107, 0) 0deg, rgba(243, 197, 107, 0) 200deg, #f3c56b 330deg, #fff1c8 355deg, rgba(243, 197, 107, 0) 360deg);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px)); mask: radial-gradient(closest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px));
  animation: bmq-turn 3s linear infinite; }
.bmq-btn.is-stuck.is-pulse { animation: bmq-swell 2.6s ease-in-out infinite; }
@keyframes bmq-turn { to { transform: rotate(360deg); } }
@keyframes bmq-swell { 0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 0 rgba(243, 197, 107, 0); transform: scale(1); }
  50% { box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 7px rgba(243, 197, 107, 0.38); transform: scale(1.07); } }
@media (prefers-reduced-motion: reduce) { .bmq-btn.is-stuck.is-arc::before, .bmq-btn.is-stuck.is-pulse { animation: none; }
  .bmq-btn.is-stuck { box-shadow: 0 0 0 4px rgba(243, 197, 107, 0.6); } }
@media (pointer: coarse) { .bmq-btn { width: 44px; height: 44px; } }
/* (where it sits: beside the HUD's Menu button; in a builder's top bar; in the lock box's strip) */
.bmh-corner-row { display: flex; align-items: center; gap: 8px; }
.bmh-corner-row .bmq-btn { order: -1; }
.bsite .tools .bmq-btn { width: 36px; height: 36px; border-width: 1.5px; box-shadow: none; }
.bsite .tools .bmq-btn svg { width: 22px; height: 22px; }
.lbx-right .bmq-btn { width: 42px; height: 42px; }

.bmq-menu { position: fixed; z-index: 96; top: 62px; right: 12px; width: min(380px, calc(100vw - 24px)); max-height: calc(100vh - 74px); overflow: auto;
  overscroll-behavior: contain; box-sizing: border-box; padding: 10px 12px 12px; border-radius: 12px; pointer-events: auto;
  background: #f6ecd6; color: #2c1d12; border: 1px solid #a8865a; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  font: 500 15px/1.35 Bitter, Georgia, serif; animation: bmq-in 0.18s ease-out; }
@keyframes bmq-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.bmq-menu[hidden], .bmq-menu [hidden] { display: none !important; }
.bmq-head { display: flex; align-items: baseline; gap: 8px; padding-right: 40px; margin-bottom: 8px; }
.bmq-head b { font: 400 22px/1.1 Rye, Smokum, Georgia, serif; color: #4a2d14; }
.bmq-head span { font-size: 14px; color: #5d4a36; }
.bmq-x { position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; padding: 0; display: grid; place-items: center; border-radius: 50%; cursor: pointer;
  color: #f6edd6; background: rgba(30, 20, 12, 0.92); border: 2px solid #e2ad4c; }
.bmq-x svg { width: 14px; height: 14px; }
.bmq-sec { border-top: 1px solid rgba(168, 134, 90, 0.55); padding: 9px 0 3px; }
.bmq-sec:first-of-type { border-top: 0; padding-top: 2px; }
.bmq-sec > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; font: 700 16px/1.25 Bitter, Georgia, serif; color: #3b2a1e; padding: 2px 0 6px; }
.bmq-sec > summary::-webkit-details-marker { display: none; }
.bmq-sec > summary::before { content: ''; flex: none; width: 0; height: 0; border-left: 7px solid #8a6a3a; border-top: 5px solid transparent; border-bottom: 5px solid transparent; transition: transform 0.15s; }
.bmq-sec[open] > summary::before { transform: rotate(90deg); }
.bmq-sec > summary small { font: 500 13px Bitter, Georgia, serif; color: #6d5a44; margin-left: auto; }
.bmq-hob { display: flex; gap: 10px; align-items: flex-start; }
.bmq-hob .bmq-face svg { width: 44px; height: 44px; display: block; }
.bmq-hob p { margin: 2px 0 4px; }
.bmq-hob .bmq-who { font: 700 13px Bitter, Georgia, serif; color: #8a6a3a; letter-spacing: 0.02em; }
.bmq-hob .bmq-now { font-style: italic; }
.bmq-ex { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 8px 10px; border-radius: 8px; background: #fffaf0; border: 1px solid #d9c39b; }
.bmq-ex .q { font-weight: 600; }
.bmq-ex .a { color: #3f6a26; font-weight: 700; }
.bmq-ex .a::before { content: '→ '; color: #8a7558; font-weight: 500; }
.bmq-lead { font-size: 13.5px; color: #5d4a36; margin: 0 0 6px; }
.bmq-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.bmq-menu button.bmq-b, .bmq-menu a.bmq-b { font: 600 14px Bitter, Georgia, serif; color: #f4e8cf; background: #6d4b2b; border: 1px solid #3b2a1e; border-radius: 7px;
  padding: 7px 12px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.bmq-menu button.bmq-b:hover { background: #82593a; }
.bmq-menu button.bmq-b.is-plain { background: transparent; color: #4a2d14; border-color: #a8865a; }
.bmq-skip button.bmq-b { font-size: 15px; padding: 9px 14px; }
.bmq-skip small, .bmq-small { display: block; font-size: 13px; color: #5d4a36; margin-top: 4px; }
.bmq-about { padding: 7px 9px; border-radius: 7px; background: #fffaf0; border: 1px dashed #c9ad7f; font-size: 14px; margin-bottom: 7px; }
.bmq-about i { display: block; font-style: normal; font: 700 12px Bitter, Georgia, serif; color: #8a6a3a; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
.bmq-form textarea { width: 100%; box-sizing: border-box; min-height: 64px; resize: vertical; font: 500 15px/1.35 Bitter, Georgia, serif;
  padding: 7px 9px; border: 1px solid #a8865a; border-radius: 6px; background: #fffaf0; color: #2c1d12; }
.bmq-form .bmq-row { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.bmq-form .bmq-sent { color: #4f7a32; font-weight: 700; }
.bmq-yt { display: block; position: relative; width: 100%; max-width: 300px; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; text-decoration: none;
  background: radial-gradient(ellipse at 50% 40%, #6b4a2a 0%, #2b1c10 75%) #2b1c10; border: 1px solid #1a1a1a; box-shadow: 0 3px 10px rgba(0,0,0,0.35); color: #fff; }
.bmq-yt img { position: absolute; left: 50%; top: 46%; width: 46%; transform: translate(-50%, -50%); opacity: 0.92; }
.bmq-yt .bmq-yt-title { position: absolute; left: 0; right: 0; top: 0; padding: 7px 10px 18px; font: 600 13px/1.25 Roboto, Arial, sans-serif; color: #fff;
  background: linear-gradient(rgba(0,0,0,0.75), rgba(0,0,0,0)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bmq-yt .bmq-yt-play { position: absolute; left: 50%; top: 50%; width: 64px; height: 45px; transform: translate(-50%, -50%); }
.bmq-yt .bmq-yt-play svg { width: 100%; height: 100%; display: block; }
.bmq-yt .bmq-yt-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 30px; background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.85)); }
.bmq-yt .bmq-yt-track { position: absolute; left: 8px; right: 8px; bottom: 25px; height: 3px; background: rgba(255,255,255,0.3); }
.bmq-yt .bmq-yt-track i { position: absolute; left: 0; top: 0; bottom: 0; background: #f00; }
.bmq-yt .bmq-yt-track b { position: absolute; top: 50%; width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; border-radius: 50%; background: #f00; }
.bmq-yt .bmq-yt-time { position: absolute; left: 30px; bottom: 6px; font: 500 11.5px Roboto, Arial, sans-serif; color: #eee; }
.bmq-yt .bmq-yt-tri { position: absolute; left: 10px; bottom: 7px; width: 0; height: 0; border-left: 10px solid #fff; border-top: 6px solid transparent; border-bottom: 6px solid transparent; }
.bmq-yt .bmq-yt-logo { position: absolute; right: 9px; bottom: 6px; font: 700 11.5px Roboto, Arial, sans-serif; color: #fff; letter-spacing: -0.02em; }
.bmq-yt .bmq-yt-logo::before { content: ''; display: inline-block; width: 15px; height: 10px; margin-right: 3px; vertical-align: -1px; border-radius: 3px; background: #f00; }
.bmq-yt:hover .bmq-yt-play path:first-child, .bmq-yt:focus-visible .bmq-yt-play path:first-child { fill: #ff2b2b; }
@media (max-width: 480px), (max-height: 480px) { .bmq-menu { top: 56px; right: 8px; width: calc(100vw - 16px); max-height: calc(100vh - 66px); font-size: 14.5px; } }
`;
  document.head.appendChild(s);
}

export function makeHelpMenu({ host = () => null, context = () => ({}), onOpen = () => {}, onClose = () => {}, watch = null, look = HELPQ.look } = {}) {
  ensureCss(); ensureFbCss();
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'bmq-btn'; btn.hidden = true;
  btn.innerHTML = Q_SVG;
  btn.setAttribute('aria-label', 'Help'); btn.setAttribute('aria-haspopup', 'dialog'); btn.title = 'Help (the ? key)';
  hush(btn);
  const menu = document.createElement('div');
  menu.className = 'bmq-menu'; menu.hidden = true; menu.tabIndex = -1;
  menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Help');
  hush(menu);
  document.body.appendChild(menu);
  let lookNow = look === 'pulse' ? 'pulse' : 'arc';
  let ctx = null, opened = false;

  // ── THE BUTTON: hosted where the screen has room for it, lit while the rider seems stuck ───────────────────────────
  function place() {
    let h = null; try { h = host(); } catch (e) { h = null; }
    if (!h) { if (!btn.hidden) btn.hidden = true; if (opened) H.close(); return; }
    if (btn.parentNode !== h) h.appendChild(btn);
    if (btn.hidden) btn.hidden = false;
  }
  function light() {
    const on = !!(watch && watch.on) && !opened;
    btn.classList.toggle('is-stuck', on);
    btn.classList.toggle('is-arc', lookNow === 'arc');
    btn.classList.toggle('is-pulse', lookNow === 'pulse');
  }
  btn.addEventListener('click', (e) => { e.preventDefault(); btn.blur(); H.toggle(); });

  // ── THE MENU ──────────────────────────────────────────────────────────────────────────────────────────────────
  function sec(id, title, body, { fold = false, open = false, small = '' } = {}) {
    if (!fold) return `<section class="bmq-sec bmq-${id}" data-sec="${id}">${body}</section>`;
    return `<details class="bmq-sec bmq-${id}" data-sec="${id}"${open ? ' open' : ''}><summary>${esc(title)}${small ? `<small>${esc(small)}</small>` : ''}</summary>${body}</details>`;
  }
  // h: { now (what Hob just said here), tip (his tip for this job), other: { who, text } (the builder's own person) }
  function hobPart(c) {
    const h = c.hob || {}, now = h.now && h.now !== h.tip ? h.now : null, o = h.other && h.other.text ? h.other : null;
    return `<div class="bmq-face">${HOB_FACE}</div><div><div class="bmq-who">Old Hob says</div>
      ${now ? `<p class="bmq-now">“${esc(now)}”</p>` : ''}<p class="bmq-tip">${esc(h.tip || 'Take your time, partner. There\'s no rush out here.')}</p>
      ${o ? `<div class="bmq-who">${esc(o.who)}</div><p class="bmq-now">“${esc(o.text)}”</p>` : ''}</div>`;
  }
  function examplePart(c) {
    const ex = c.example && c.example.first;
    const helpers = (c.helpers || []).map((x, i) => `<button type="button" class="bmq-b${i ? ' is-plain' : ''}" data-helper="${i}" title="${esc(x.line || '')}">${esc(x.label)}</button>`).join('');
    return `${ex ? `<p class="bmq-lead">${esc(c.example.lead || 'A question like this one, at your level, and its answer:')}</p>
      <div class="bmq-ex" data-ex><span class="q"></span><span class="a"></span></div>
      <div class="bmq-btns"><button type="button" class="bmq-b is-plain" data-do="another">Another example</button><button type="button" class="bmq-b is-plain" data-do="workex" hidden>Work this one out with me</button></div>` : ''}
      ${helpers ? `${ex ? '<p class="bmq-lead" style="margin-top:10px">For the one on your screen:</p>' : ''}<div class="bmq-btns">${helpers}</div>` : ''}`;
  }
  function reportPart(c) {
    const about = c.q ? c.q.text : c.summary;
    return `<div class="bmq-form" data-bmfb-form="1">
      <div class="bmq-about"><i>${c.q ? 'The question on your screen' : esc(c.name || 'Where you are')}</i>${esc(about || 'No question up just now')}</div>
      <textarea maxlength="300" data-bmfb-type="1" placeholder="What was confusing? (or leave it empty and just press Send)" aria-label="What was confusing"></textarea>
      <small class="bmq-small">${NO_NAMES}</small>
      <div class="bmq-row"><button type="button" class="bmq-b" data-bmfb-send="1">Send</button><span class="bmq-small bmq-what">${c.q ? 'The question is sent with it.' : 'Which job, and your build, are sent with it.'}</span></div></div>`;
  }
  function videoPart(c) {
    const v = c.video, frac = v.length && v.at != null ? Math.max(0, Math.min(1, v.at / v.length)) : 0;
    const time = v.at != null ? `${clockText(v.at)}${v.length ? ` / ${clockText(v.length)}` : ''}` : v.length ? `0:00 / ${clockText(v.length)}` : '';
    return `<a class="bmq-yt" href="${esc(v.link)}" target="_blank" rel="noopener noreferrer" aria-label="Watch how ${esc(v.name || 'this job')} works, on YouTube (opens a new tab)">
        ${v.pic ? `<img src="${esc(v.pic)}" alt="">` : ''}<span class="bmq-yt-title">How to play: ${esc(v.name || 'Mathwood Valley')}</span>
        <span class="bmq-yt-play">${PLAY_SVG}</span><span class="bmq-yt-bar"></span>
        <span class="bmq-yt-track"><i style="width:${(frac * 100).toFixed(1)}%"></i><b style="left:${(frac * 100).toFixed(1)}%"></b></span>
        <span class="bmq-yt-tri"></span>${time ? `<span class="bmq-yt-time">${time}</span>` : ''}<span class="bmq-yt-logo">YouTube</span></a>
      <small class="bmq-small">Watch how ${esc(v.name || 'this job')} works. It opens YouTube in a new tab.</small>`;
  }
  function linksPart(c) {
    return `<ul class="bmq-links">${c.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>${l.line ? ` <small>${esc(l.line)}</small>` : ''}</li>`).join('')}</ul>`;
  }

  function build(c) {
    const parts = sectionsFor({ example: !!(c.example && c.example.first) || !!(c.helpers && c.helpers.length), skip: !!(c.q && c.skip), video: !!(c.video && c.video.link), links: c.links });
    const html = parts.map((p) => {
      if (p.id === 'hob') return sec('hob', '', hobPart(c));
      if (p.id === 'example') return sec('example', c.example && c.example.first ? 'An example' : 'Show me how', examplePart(c), p);
      if (p.id === 'skip') return sec('skip', '', '<button type="button" class="bmq-b" data-do="skip">Skip to a new question</button><small>You get a new one, a little easier. No harm done.</small><small class="bmq-skipno" hidden></small>');
      if (p.id === 'report') return sec('report', c.q ? 'Is this question confusing?' : 'Something confusing here?', reportPart(c), { ...p, small: 'tell us' });
      if (p.id === 'video') return sec('video', '', videoPart(c));
      if (p.id === 'links') return sec('links', 'External Links', linksPart(c), p);   // (none yet: helpplan.js LINKS)
      return '';
    }).join('');
    menu.innerHTML = `<button type="button" class="bmq-x" aria-label="Close the help" title="Close (Esc)">${X_SVG}</button>
      <div class="bmq-head"><b>Help</b><span>${esc(c.name || '')}</span></div>${html}`;
    // the example
    if (menu.querySelector('[data-ex]')) showEx(c.example.first);
    // the form: sent the way the old chip's mark was (an empty box sends the mark on its own)
    const form = menu.querySelector('.bmq-form');
    if (form) {
      const area = form.querySelector('textarea'), what = form.querySelector('.bmq-what');
      form.querySelector('[data-bmfb-send]').addEventListener('click', () => {
        sendQuestion(reportOf({ q: c.q, job: c.job, summary: c.summary, build: c.build, note: area.value, place: c.place, tier: c.tier }));
        sent = (sent || 0) + 1;
        area.value = ''; what.textContent = 'Sent, thank you!'; what.classList.add('bmq-sent');
      });
    }
  }
  let sent = 0, exNow = null;
  function showEx(e) {
    const exEl = menu.querySelector('[data-ex]');
    exNow = e; if (!exEl || !e) return;
    exEl.querySelector('.q').textContent = e.q; exEl.querySelector('.a').textContent = e.a;
    const w = menu.querySelector('[data-do="workex"]'); if (w) w.hidden = !(ctx && ctx.workOn && sumIn(e.q));
  }
  // the menu's buttons (one listener for every opening: what they do is the context read as it opened)
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button'), c = ctx; if (!b || !c) return;
    if (b.classList.contains('bmq-x')) { H.close(); return; }
    const d = b.dataset.do;
    if (d === 'another') { try { showEx(c.example.next()); } catch (err) { console.error(err); } return; }
    if (d === 'workex') { const s = exNow && sumIn(exNow.q); if (s) { H.close(); c.workOn(s); } return; }
    if (d === 'skip') {
      let ok = false; try { ok = !!c.skip(); } catch (err) { console.error(err); }
      if (ok) { H.close(); return; }
      const no = menu.querySelector('.bmq-skipno'); if (no) { no.hidden = false; no.textContent = "This one is already started, so it can't be swapped. Finish it, or press Work it out."; }
      return;
    }
    if (b.dataset.helper != null) { const x = (c.helpers || [])[+b.dataset.helper]; if (x) { H.close(); try { x.run(); } catch (err) { console.error(err); } } }
  });

  // a tap outside closes it, and that tap does nothing else (its click, a builder's drag, a coin under it)
  let eatUntil = 0;
  const outside = (e) => { if (!opened || menu.contains(e.target) || btn.contains(e.target)) return; e.preventDefault(); e.stopPropagation(); H.close(); eatUntil = performance.now() + 600; };
  const eat = (e) => { if (performance.now() > eatUntil) return; e.stopPropagation(); if (e.cancelable) e.preventDefault(); if (e.type === 'click') eatUntil = 0; };
  for (const t of ['pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend']) addEventListener(t, eat, { capture: true, passive: false });
  const H = {
    button: btn, menu,
    isOpen: () => opened,
    open() {
      if (opened || btn.hidden) return false;
      try { ctx = context() || {}; } catch (e) { console.error(e); ctx = {}; }   // (read before the game waits: a paused game has no question up)
      build(ctx);
      opened = true; menu.hidden = false; btn.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
      if (watch) watch.opened();
      light();
      try { onOpen(); } catch (e) { console.error(e); }
      const r = btn.getBoundingClientRect();
      // (under the button, against the screen's right edge: clear of the job card in the middle where there is room)
      if (r.width) menu.style.top = `${Math.round(Math.min(r.bottom + 8, innerHeight * 0.4))}px`;
      addEventListener('pointerdown', outside, true);
      setTimeout(() => { try { menu.focus({ preventScroll: true }); } catch (e) { /* */ } }, 0);
      return true;
    },
    close() {
      if (!opened) return false;
      opened = false; menu.hidden = true; menu.innerHTML = ''; ctx = null;
      btn.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false');
      removeEventListener('pointerdown', outside, true);
      try { onClose(); } catch (e) { console.error(e); }
      light();
      return true;
    },
    toggle() { return opened ? H.close() : H.open(); },
    update() { place(); light(); },
    look(name) { lookNow = name === 'pulse' ? 'pulse' : 'arc'; light(); return lookNow; },
    state: () => ({ shown: !btn.hidden && !!btn.isConnected, host: btn.parentNode ? btn.parentNode.className || btn.parentNode.id : null, open: opened, stuck: btn.classList.contains('is-stuck'), look: lookNow,
      parts: opened ? [...menu.querySelectorAll('[data-sec]')].map((e) => ({ id: e.dataset.sec, open: e.tagName === 'DETAILS' ? e.open : true })) : [],
      about: opened ? (menu.querySelector('.bmq-about') || {}).textContent || null : null, sent, rect: (({ left, top, right, bottom }) => ({ left, top, right, bottom }))(btn.getBoundingClientRect()) }),
    dispose() { H.close(); btn.remove(); menu.remove(); removeEventListener('keydown', onKey, true); for (const t of ['pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend']) removeEventListener(t, eat, { capture: true }); },
  };
  // the ? key (the / key, with or without Shift) opens and closes it; Esc closes it first, before anything else's Esc.
  // While it is open no key reaches the game, a builder or a lock box (the menu's own buttons and box still get theirs)
  const typingIn = (t) => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  const onKey = (e) => {
    if (opened && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); H.close(); return; }
    const mine = HELPQ.keys.includes(e.code) && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !typingIn(e.target) && (opened || !btn.hidden);
    if (mine) { e.preventDefault(); e.stopImmediatePropagation(); H.toggle(); return; }
    if (opened && !menu.contains(e.target)) e.stopImmediatePropagation();
  };
  addEventListener('keydown', onKey, true);
  return H;
}
