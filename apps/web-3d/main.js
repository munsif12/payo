/* =====================================================================
   PAYO 3D  ·  "The conversation is the interface."
   One WebGL world behind fixed HTML chapter overlays.
   Native scroll drives a single scalar; every 3D state is a function of it.

   Query harness
     ?chapter=1..7   jump to the middle of a chapter and freeze
     ?t=<seconds>    freeze the phone screen sequence at t seconds
     ?reduce=1       static 2D fallback, no canvas
     ?lite=1         force the low-cost scene
     ?debug=1        show the HUD (draw calls, triangles, fps, errors)
     ?vw=N           render the layout at N css pixels wide
   ===================================================================== */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const Q = new URLSearchParams(location.search);
const root = document.documentElement;
const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const ease  = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   /* inOutCubic */
const easeOut = t => 1 - Math.pow(1 - t, 3);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

const CH = 7;
const C = {
  navy:     0x0d2a3d,
  navyDeep: 0x08192a,
  bodyDark: 0x0b1622,   /* phone body */
  titanium: 0x8c949c,   /* phone rail */
  fog:      0x06131f,
  cream:    0xf7f4ee,
  amber:    0xf2a93b,
  amberDeep:0xc9821a,
  warmWhite:0xfff1d8,
  ink:      0x0e2233,
  green:    0x1b9a6b
};

/* ------------------------------------------------------------------ *
 * 1 · LAYOUT WIDTH OVERRIDE (must run before any width is measured)
 * ------------------------------------------------------------------ */
const qVW = parseFloat(Q.get('vw'));
if (qVW > 0 && window.innerWidth > qVW) root.style.zoom = String(window.innerWidth / qVW);
const VW = qVW > 0 ? Math.min(qVW, window.innerWidth) : window.innerWidth;

/* ------------------------------------------------------------------ *
 * 2 · CAPABILITY DETECTION
 * ------------------------------------------------------------------ */
function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
}

const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = VW <= 900;
const touch  = window.matchMedia && window.matchMedia('(hover: none)').matches;
const fewCores = (navigator.hardwareConcurrency || 8) <= 4;

const WEBGL = hasWebGL2();
const LITE  = Q.get('lite') === '1' || narrow || fewCores;
const NO3D  = !WEBGL || !window.gsap || !window.ScrollTrigger;
const START_STATIC = NO3D || Q.get('reduce') === '1' || prefersReduce;
const FLOW = narrow;   /* narrow viewports read the chapters as a normal flowing page */

/* frozen deterministic mode for screenshots */
const qChapter = Q.get('chapter');
const qT = Q.get('t');
const FROZEN = qChapter !== null || qT !== null;
const HERO_T = qT !== null ? parseFloat(qT) : 6.0;

const loaderEl = $('#loader');
const barEl = $('#ldbar');
const motionBtn = $('#motion');
const railDots = $$('#rail .dot');
const sections = $$('.ch');

function goStatic(reason) {
  root.classList.add('static');
  if (loaderEl) loaderEl.classList.add('gone');
  if (motionBtn) motionBtn.setAttribute('aria-pressed', 'true');
  window.__mode = 'static:' + reason;
  window.__ready = true;
}

/* ------------------------------------------------------------------ *
 * 3 · THE PHONE SCREEN SEQUENCE  ·  real app captures, cross-faded
 *     Filenames only. Higher-resolution captures with the same names
 *     drop straight in: every size below is read off the decoded image.
 * ------------------------------------------------------------------ */
const SEQ = [
  'home-greet',      /* 0 */
  'home-listening',  /* 1 */
  'send-chips',      /* 2 */
  'send-pin-sheet',  /* 3 */
  'send-receipt',    /* 4 */
  'urdu',            /* 5 */
  'digest'           /* 6 */
];
const IDX = {}; SEQ.forEach((n, i) => { IDX[n] = i; });
const HOLD = 2.4, FADE = 0.5;

/* what the particle field reads back out of the screen */
const screenState = { listening: 0, amp: 0, frame: 0 };

/* ------------------------------------------------------------------ *
 * 4 · SMALL GENERATED TEXTURES
 * ------------------------------------------------------------------ */
function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function rrPath(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y,     x + w, y + h, r);
  g.arcTo(x + w, y + h, x,     y + h, r);
  g.arcTo(x,     y + h, x,     y,     r);
  g.arcTo(x,     y,     x + w, y,     r);
  g.closePath();
}

/* white rounded rect on black: an alpha mask for the screen and the shots */
function roundedMaskTexture(px, aspect, radiusFrac) {
  const w = px, h = Math.round(px * aspect);
  const [c, g] = canvas2d(w, h);
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  rrPath(g, 0.5, 0.5, w - 1, h - 1, radiusFrac * w);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/* soft round glow, the particle sprite */
function glowSpriteTexture(px) {
  const [c, g] = canvas2d(px, px);
  const r = px / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0.00, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.86)');
  gr.addColorStop(0.42, 'rgba(255,255,255,0.32)');
  gr.addColorStop(0.72, 'rgba(255,255,255,0.06)');
  gr.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, px, px);
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* a real lens-bokeh disc: an almost flat body, a faintly brighter rim just
   inside the edge, then a long feather to zero so no edge is ever visible */
function bokehSpriteTexture(px) {
  const [c, g] = canvas2d(px, px);
  const r = px / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0.00, 'rgba(255,255,255,0.46)');
  gr.addColorStop(0.26, 'rgba(255,255,255,0.48)');
  gr.addColorStop(0.44, 'rgba(255,255,255,0.54)');
  gr.addColorStop(0.56, 'rgba(255,255,255,0.62)');   /* the rim: a lift, never a line */
  gr.addColorStop(0.65, 'rgba(255,255,255,0.51)');
  gr.addColorStop(0.76, 'rgba(255,255,255,0.30)');
  gr.addColorStop(0.86, 'rgba(255,255,255,0.13)');
  gr.addColorStop(0.94, 'rgba(255,255,255,0.035)');
  gr.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, px, px);
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/* the alpha for the phone's reflection: the rounded silhouette, multiplied by
   a gradient that is gone within `fade` of the plane's height */
function reflectionMaskTexture(px, aspect, radiusFrac, fade) {
  const w = px, h = Math.round(px * aspect);
  const [c, g] = canvas2d(w, h);
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  /* v = 0 is the bottom row of the canvas, and that is the edge that touches
     the phone once the plane is mirrored, so the gradient runs bottom-up */
  const gr = g.createLinearGradient(0, h, 0, h * (1 - fade));
  gr.addColorStop(0.00, 'rgba(255,255,255,1)');
  gr.addColorStop(0.22, 'rgba(255,255,255,0.52)');
  gr.addColorStop(0.48, 'rgba(255,255,255,0.18)');
  gr.addColorStop(0.74, 'rgba(255,255,255,0.05)');
  gr.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.save();
  rrPath(g, 0.5, 0.5, w - 1, h - 1, radiusFrac * w);
  g.clip();
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.restore();
  /* melt the two vertical sides as well, or the reflection reads as a slab */
  g.globalCompositeOperation = 'multiply';
  const hg = g.createLinearGradient(0, 0, w, 0);
  const stops = [[0, '#000000'], [0.07, '#2b2b2b'], [0.17, '#9a9a9a'], [0.31, '#f2f2f2'],
                 [0.50, '#ffffff'],
                 [0.69, '#f2f2f2'], [0.83, '#9a9a9a'], [0.93, '#2b2b2b'], [1, '#000000']];
  stops.forEach(st => hg.addColorStop(st[0], st[1]));
  g.fillStyle = hg; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* a diagonal sheen band that tiles seamlessly in x, for the glass overlay */
function sheenTexture() {
  const [c, g] = canvas2d(256, 256);
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.save();
  g.translate(128, 128); g.rotate(-1.16); g.translate(-128, -128);
  const gr = g.createLinearGradient(0, -60, 0, 316);
  gr.addColorStop(0.00, 'rgba(0,0,0,0)');
  gr.addColorStop(0.28, 'rgba(255,255,255,0.00)');
  gr.addColorStop(0.40, 'rgba(255,255,255,0.07)');
  gr.addColorStop(0.47, 'rgba(255,255,255,0.34)');
  gr.addColorStop(0.50, 'rgba(255,255,255,0.72)');
  gr.addColorStop(0.53, 'rgba(255,255,255,0.34)');
  gr.addColorStop(0.60, 'rgba(255,255,255,0.07)');
  gr.addColorStop(0.72, 'rgba(255,255,255,0.00)');
  gr.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(-120, -120, 500, 500);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* soft drop shadow + a hairline rim, drawn behind every chapter-6 screenshot */
function shotBackdropTexture(aspect) {
  const P = 1.28;                       /* the plane is P times the shot */
  const w = 420, h = Math.round(420 * aspect);
  const W = Math.round(w * P), H = Math.round(h * P);
  const [c, g] = canvas2d(W, H);
  const x = (W - w) / 2, y = (H - h) / 2;
  const r = w * 0.135;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.72)';
  g.shadowBlur = w * 0.20;
  g.shadowOffsetY = h * 0.030;
  g.fillStyle = 'rgba(0,0,0,0.9)';
  rrPath(g, x, y, w, h, r); g.fill();
  rrPath(g, x, y, w, h, r); g.fill();
  g.restore();
  /* hairline rim, just outside the screenshot silhouette */
  g.strokeStyle = 'rgba(233,244,252,0.9)';
  g.lineWidth = 5;
  rrPath(g, x - 2, y - 2, w + 4, h + 4, r + 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex: t, pad: P };
}

/* the little live waveform that sits on the screen while it is listening */
function waveCanvas() {
  const [c, g] = canvas2d(320, 64);
  return { c, g, tex: null };
}
function paintWave(w, t) {
  const g = w.g;
  g.clearRect(0, 0, 320, 64);
  const n = 22, gap = 320 / n;
  for (let i = 0; i < n; i++) {
    const s = 0.16 + 0.84 * Math.abs(Math.sin(t * (2.1 + i * 0.23) + i * 0.8));
    const bh = 8 + 44 * s * s;
    const a = 0.35 + 0.55 * s;
    g.fillStyle = 'rgba(242,169,59,' + a.toFixed(3) + ')';
    rrPath(g, i * gap + gap * 0.28, 32 - bh / 2, gap * 0.44, bh, gap * 0.22);
    g.fill();
  }
  if (w.tex) w.tex.needsUpdate = true;
}

/* ------------------------------------------------------------------ *
 * 4b · CHAPTER 4 CANVASES
 *      Every word on the five stations is painted here and used as a
 *      texture. No TextGeometry, no DOM text inside the scene.
 * ------------------------------------------------------------------ */
const UI_FONT   = '"Plus Jakarta Sans",-apple-system,"Helvetica Neue",Arial,sans-serif';
const URDU_FONT = '"Noto Nastaliq Urdu","Jameel Noori Nastaleeq",serif';

/* the Urdu chips cannot be painted until the Nastaliq face has actually
   arrived, so every chip is painted twice: once now, once on this promise */
const urduReady = (document.fonts && document.fonts.load)
  ? Promise.all([
      document.fonts.load('600 64px "Noto Nastaliq Urdu"', 'بھیجو روپے ایک ہزار کو سارہ'),
      document.fonts.load('400 64px "Noto Nastaliq Urdu"', 'بھیجو روپے ایک ہزار کو سارہ')
    ]).catch(() => null)
  : Promise.resolve(null);

function texFromCanvas(c, aniso) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (aniso) t.anisotropy = aniso;
  return t;
}
function trackLetters(g, v) { try { g.letterSpacing = v; } catch (e) {} }

/* one Urdu word, white, on nothing: the face of a glass chip */
function paintUrduWord(c, word) {
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = '600 ' + Math.round(h * 0.40) + 'px ' + URDU_FONT;
  g.shadowColor = 'rgba(150,196,240,0.60)';
  g.shadowBlur = h * 0.09;
  g.fillStyle = '#ffffff';
  g.fillText(word, w / 2, h * 0.70);
  g.shadowBlur = 0;
  return g.measureText(word).width / w;
}

/* a slot card: label, value, and either a green tick or an amber question */
function slotCanvas(label, value, empty) {
  const W = 720, H = 226, p = 12, r = 40;
  const [c, g] = canvas2d(W, H);
  const grad = g.createLinearGradient(0, 0, W * 0.7, H);
  if (empty) {
    grad.addColorStop(0.00, 'rgba(242,169,59,0.30)');
    grad.addColorStop(0.52, 'rgba(200,132,42,0.11)');
    grad.addColorStop(1.00, 'rgba(242,169,59,0.20)');
  } else {
    grad.addColorStop(0.00, 'rgba(150,190,228,0.26)');
    grad.addColorStop(0.52, 'rgba(96,138,180,0.12)');
    grad.addColorStop(1.00, 'rgba(70,110,150,0.20)');
  }
  rrPath(g, p, p, W - p * 2, H - p * 2, r);
  g.fillStyle = grad; g.fill();
  g.lineWidth = 3.2;
  g.strokeStyle = empty ? 'rgba(246,186,96,0.92)' : 'rgba(178,212,244,0.40)';
  g.stroke();
  /* the inner top highlight every glass surface on this page carries */
  g.save();
  rrPath(g, p, p, W - p * 2, H - p * 2, r); g.clip();
  const hi = g.createLinearGradient(0, p, 0, p + 42);
  hi.addColorStop(0, empty ? 'rgba(255,214,150,0.50)' : 'rgba(255,255,255,0.38)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi; g.fillRect(p, p, W - p * 2, 42);
  g.restore();

  trackLetters(g, '6px');
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '700 25px ' + UI_FONT;
  g.fillStyle = empty ? 'rgba(255,208,138,0.94)' : 'rgba(176,197,214,0.86)';
  g.fillText(label.toUpperCase(), 46, 88);
  trackLetters(g, '0px');
  g.font = (empty ? '500 ' : '600 ') + '54px ' + UI_FONT;
  g.fillStyle = empty ? '#FFD08A' : '#ffffff';
  g.fillText(value, 44, 158);

  if (!empty) {
    const cx = W - 74, cy = H / 2, rr = 27;
    g.beginPath(); g.arc(cx, cy, rr, 0, 6.2832);
    g.fillStyle = 'rgba(150,206,168,0.20)'; g.fill();
    g.lineWidth = 2.4; g.strokeStyle = 'rgba(150,206,168,0.60)'; g.stroke();
    g.beginPath();
    g.moveTo(cx - 12, cy + 1); g.lineTo(cx - 3.5, cy + 9); g.lineTo(cx + 12, cy - 9);
    g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#9AD6B2'; g.stroke();
  }
  return c;
}

/* a station-3 panel face: number at the top, small caps label at the foot */
function panelCanvas(num, label, lit) {
  const W = 300, H = 840, p = 6, r = 22;
  const [c, g] = canvas2d(W, H);
  const grad = g.createLinearGradient(0, 0, W, H);
  if (lit) {
    grad.addColorStop(0.00, 'rgba(242,169,59,0.34)');
    grad.addColorStop(0.48, 'rgba(200,132,42,0.09)');
    grad.addColorStop(1.00, 'rgba(242,169,59,0.20)');
  } else {
    grad.addColorStop(0.00, 'rgba(178,212,246,0.20)');
    grad.addColorStop(0.46, 'rgba(96,140,182,0.07)');
    grad.addColorStop(1.00, 'rgba(62,102,142,0.16)');
  }
  rrPath(g, p, p, W - p * 2, H - p * 2, r);
  g.fillStyle = grad; g.fill();
  g.lineWidth = 2.6;
  g.strokeStyle = lit ? 'rgba(246,186,96,0.86)' : 'rgba(180,214,246,0.34)';
  g.stroke();
  g.save();
  rrPath(g, p, p, W - p * 2, H - p * 2, r); g.clip();
  const hi = g.createLinearGradient(0, p, 0, p + 40);
  hi.addColorStop(0, lit ? 'rgba(255,214,150,0.55)' : 'rgba(255,255,255,0.36)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi; g.fillRect(p, p, W - p * 2, 40);
  g.restore();

  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  trackLetters(g, '4px');
  g.font = '600 21px ' + UI_FONT;
  g.fillStyle = lit ? 'rgba(242,169,59,0.70)' : 'rgba(159,182,201,0.46)';
  g.fillText(num, W / 2, 54);
  trackLetters(g, '5px');
  g.font = '700 23px ' + UI_FONT;
  g.fillStyle = lit ? '#FFD08A' : 'rgba(200,222,242,0.66)';
  const lines = label.split('\n');
  for (let i = 0; i < lines.length; i++) {
    g.fillText(lines[i], W / 2, H - 42 - (lines.length - 1 - i) * 30);
  }
  trackLetters(g, '0px');
  return c;
}

/* the capsule badge on station 3 */
function badgeCanvas() {
  const W = 520, H = 150;
  const [c, g] = canvas2d(W, H);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(4,14,26,0.95)'; g.shadowBlur = 14;
  trackLetters(g, '7px');
  g.font = '700 26px ' + UI_FONT;
  g.fillStyle = 'rgba(255,214,150,0.95)';
  g.fillText('CARRYING', 16, 58);
  trackLetters(g, '0px');
  g.font = '700 52px ' + UI_FONT;
  g.fillStyle = '#ffffff';
  g.fillText('your token', 14, 118);
  g.shadowBlur = 0;
  return c;
}

/* the station-4 receipt, redrawn rather than cropped so it stays legible
   at any size the card lands on */
function receiptCanvas() {
  const W = 640, H = 380, p = 8, r = 34;
  const [c, g] = canvas2d(W, H);
  const grad = g.createLinearGradient(0, 0, W * 0.5, H);
  grad.addColorStop(0.00, '#FFFFFF');
  grad.addColorStop(0.62, '#F7F3EB');
  grad.addColorStop(1.00, '#F1ECE1');
  rrPath(g, p, p, W - p * 2, H - p * 2, r);
  g.fillStyle = grad; g.fill();
  g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,255,255,0.92)'; g.stroke();

  const cx = W / 2, cy = 104, rr = 34;
  g.beginPath(); g.arc(cx, cy, rr, 0, 6.2832);
  g.fillStyle = 'rgba(154,214,178,0.42)'; g.fill();
  g.beginPath();
  g.moveTo(cx - 15, cy + 1); g.lineTo(cx - 4, cy + 12); g.lineTo(cx + 16, cy - 12);
  g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#2E7D52'; g.stroke();

  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '500 30px ' + UI_FONT;
  g.fillStyle = '#33475B';
  g.fillText('Send Rs1,000 to Sara Khan', cx, 190);
  g.font = '800 56px ' + UI_FONT;
  g.fillStyle = '#10243A';
  g.fillText('Rs1,000', cx, 254);

  trackLetters(g, '2px');
  g.font = '600 22px ' + UI_FONT;
  const ref = 'PAYO-X25CK477MU';
  const rw = g.measureText(ref).width + 44;
  rrPath(g, cx - rw / 2, 288, rw, 44, 12);
  g.fillStyle = 'rgba(16,36,58,0.08)'; g.fill();
  g.fillStyle = '#5B7186';
  g.fillText(ref, cx, 318);
  trackLetters(g, '0px');
  return c;
}

/* a lit ribbon: one horizontal envelope multiplied by a vertical falloff */
function beamCanvas(soft) {
  const W = 512, H = 128;
  const [c, g] = canvas2d(W, H);
  const hg = g.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0.00, 'rgba(255,236,206,0)');
  hg.addColorStop(0.09, 'rgba(255,228,182,0.62)');
  hg.addColorStop(0.40, 'rgba(255,255,255,1)');
  hg.addColorStop(0.70, 'rgba(255,214,150,0.58)');
  hg.addColorStop(0.92, 'rgba(242,169,59,0.14)');
  hg.addColorStop(1.00, 'rgba(242,169,59,0)');
  g.fillStyle = hg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  const vg = g.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0.00, 'rgba(0,0,0,0)');
  vg.addColorStop(0.34, 'rgba(0,0,0,' + soft + ')');
  vg.addColorStop(0.50, 'rgba(0,0,0,1)');
  vg.addColorStop(0.66, 'rgba(0,0,0,' + soft + ')');
  vg.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  return c;
}

/* the alpha strip that turns a tube into a dashed thread */
function dashTexture() {
  const [c, g] = canvas2d(32, 4);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 13, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
}

/* ------------------------------------------------------------------ *
 * 5 · ROUNDED SLAB GEOMETRY
 *     RoundedBoxGeometry clamps its radius to half the smallest side,
 *     so on a 0.26-deep phone it can never round more than 4% of the
 *     width. That is what made the old phone read as a box. An extruded
 *     rounded rect has no such limit.
 * ------------------------------------------------------------------ */
function roundedRectShape(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function slabGeometry(w, h, d, r, bevel, curveSeg) {
  const b = Math.min(bevel, d / 2 - 0.001, r * 0.5);
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w - b * 2, h - b * 2, r - b), {
    depth: d - b * 2,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: curveSeg || 14,
    steps: 1
  });
  g.translate(0, 0, -(d - b * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ *
 * 6 · BOOT
 * ------------------------------------------------------------------ */
if (FLOW) root.classList.add('flow');

if (NO3D) {
  goStatic(!WEBGL ? 'no-webgl' : 'no-gsap');
  if (motionBtn) { motionBtn.disabled = true; motionBtn.title = 'This device has no WebGL, so the static page is already showing.'; }
} else {
  if (START_STATIC) goStatic(prefersReduce ? 'prefers-reduced-motion' : 'reduce-flag');
  boot();
}

/* ------------------------------------------------------------------ *
 * 7 · THE SCENE
 * ------------------------------------------------------------------ */
function boot() {
  const canvas = $('#stage');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(LITE ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = 0.5;
  const MAXANISO = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.fog, 13, 34);
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(0, 0.1, 12.4);

  const world = new THREE.Group();
  scene.add(world);

  /* ---- environment: the metal has to have something to reflect ---- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;

  /* ---- lights: dimmed, the environment carries the ambient now ---- */
  scene.add(new THREE.HemisphereLight(0x9ec6dd, 0x06121e, 0.42));
  const key = new THREE.DirectionalLight(0xffe8c4, 1.05);
  key.position.set(4.5, 6.5, 7.5);
  scene.add(key);
  /* faint amber rim from the lower right */
  const rimLight = new THREE.PointLight(C.amber, 34, 34, 2);
  rimLight.position.set(5.4, -3.4, 3.2);
  scene.add(rimLight);
  const fill = new THREE.PointLight(0x4f9fd0, 11, 36, 2);
  fill.position.set(-5.6, -1.6, 5.0);
  scene.add(fill);

  /* ---------------- ATMOSPHERE ----------------
     One full-screen fragment shader, drawn before the world with the depth
     test off. Three octaves of value-noise fbm, domain-warped once, give
     broad light bands that drift through one cycle a minute. The ramp is
     deep -> navy -> a teal lift on the brightest tenth, plus an amber
     warmth that only exists around the phone. There is no sprite and no
     geometry, so there is no edge to see. Grain and a vignette last.     */
  const BG_FREEZE = prefersReduce || Q.get('reduce') === '1';

  const bgUniforms = {
    uTime:         { value: 0 },
    uRes:          { value: new THREE.Vector2(1, 1) },
    uGlow:         { value: new THREE.Vector2(0.5, 0.5) },
    uGlowStrength: { value: 1.0 },
    uScroll:       { value: 0 }
  };

  const bgMat = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = vec4(position.xy, 0.0, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'precision highp float;',
      'uniform float uTime;',
      'uniform vec2  uRes;',
      'uniform vec2  uGlow;',
      'uniform float uGlowStrength;',
      'uniform float uScroll;',
      'varying vec2 vUv;',
      /* the brand, written straight in display space so the hex values land
         on screen unchanged: #06131F #0F2A3E #14405A #3A2A12 */
      'const vec3 DEEP = vec3(0.02353, 0.07451, 0.12157);',
      'const vec3 NAVY = vec3(0.05882, 0.16471, 0.24314);',
      'const vec3 TEAL = vec3(0.07843, 0.25098, 0.35294);',
      'const vec3 WARM = vec3(0.22745, 0.16471, 0.07059);',
      /* where the glow is strong the navy is pulled toward this before the
         warm is added: adding amber to a blue base only ever gives beige */
      'const vec3 GOLD = vec3(0.42000, 0.30000, 0.13000);',
      'float hash21(vec2 p) {',
      '  p = fract(p * vec2(233.34, 851.73));',
      '  p += dot(p, p + 23.45);',
      '  return fract(p.x * p.y);',
      '}',
      'float vnoise(vec2 p) {',
      '  vec2 i = floor(p), f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  float a = hash21(i);',
      '  float b = hash21(i + vec2(1.0, 0.0));',
      '  float c = hash21(i + vec2(0.0, 1.0));',
      '  float d = hash21(i + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
      '}',
      'float fbm(vec2 p) {',
      '  float v = 0.0, a = 0.56;',
      '  mat2 m = mat2(1.62, 1.18, -1.18, 1.62);',
      '  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = m * p; a *= 0.46; }',
      '  return v;',
      '}',
      'void main() {',
      '  vec2 uv = vUv;',
      '  float aspect = uRes.x / max(1.0, uRes.y);',
      '  float t = uTime / 60.0;',                    /* one drift cycle a minute */
      /* sample in a frame rotated 18 degrees and squashed, so the fbm reads
         as broad diagonal bands of light rather than as a cloud */
      '  vec2 sp = vec2(uv.x * aspect, uv.y);',
      '  vec2 q = mat2(0.951, -0.309, 0.309, 0.951) * sp;',
      '  q = vec2(q.x * 0.78, q.y * 3.05 + uScroll * 0.55);',
      '  vec2 warp = vec2(fbm(q * 0.62 + vec2(t * 0.90, -t * 0.62)),',
      '                   fbm(q * 0.62 + vec2(4.70 - t * 0.71, 2.30 + t * 0.48)));',
      '  float n = fbm(q + warp * 1.15 + vec2(t * 0.42, t * 0.95));',
      '  n = clamp((n - 0.20) * 1.75, 0.0, 1.0);',
      '  float lift = 1.0 - smoothstep(-0.14, 1.04, uv.y);',   /* 1 at the top */
      '  float band = clamp(n * 0.74 + (1.0 - lift) * 0.38, 0.0, 1.0);',
      '  vec3 col = mix(DEEP, NAVY, smoothstep(0.04, 0.62, band));',
      '  col = mix(col, TEAL, smoothstep(0.74, 1.00, band));',
      '  vec2 gd = (uv - uGlow) * vec2(aspect, 1.0);',
      '  float gl = length(gd);',
      '  float halo = pow(1.0 - smoothstep(0.0, 0.95, gl), 2.2);',
      '  float core = pow(1.0 - smoothstep(0.0, 0.42, gl), 2.6);',
      '  float gw = clamp((halo * 0.88 + core * 0.55) * uGlowStrength, 0.0, 1.0);',
      '  col = mix(col, GOLD, pow(gw, 1.8) * 0.70);',
      '  col += WARM * gw * 0.78;',
      '  float vd = length((uv - 0.5) * vec2(1.06, 1.0));',
      '  col *= 1.0 - 0.35 * smoothstep(0.16, 0.72, vd);',
      '  float g = hash21(gl_FragCoord.xy + vec2(fract(uTime * 7.13) * 311.7,',
      '                                          fract(uTime * 5.37) * 173.1));',
      '  col += (g - 0.5) * 0.015;',
      '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
      '}'
    ].join('\n')
  });

  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bgQuad.frustumCulled = false;
  bgScene.add(bgQuad);

  /* the world draws on top of the atmosphere, so nothing may clear it */
  renderer.autoClear = false;
  renderer.info.autoReset = false;

  /* where the phone is on screen, so the amber only warms the product */
  const _glowV = new THREE.Vector3();

  /* ---------------- MATERIAL SYSTEM ----------------
     One family: physical, low roughness, environment-lit. The glass
     members differ only in how much they transmit.                    */
  const GLASSY = !LITE;
  function glassMat(o) {
    return new THREE.MeshPhysicalMaterial(Object.assign({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.0,
      transmission: GLASSY ? 0.6 : 0.0,
      thickness: 0.3,
      ior: 1.35,
      transparent: true,
      opacity: GLASSY ? 1.0 : 0.42,
      clearcoat: 0.5,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.5,
      emissive: C.amber,
      emissiveIntensity: 0.0
    }, o || {}));
  }
  function solidMat(o) {
    return new THREE.MeshPhysicalMaterial(Object.assign({
      color: 0x16465f,
      roughness: 0.3,
      metalness: 0.55,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25
    }, o || {}));
  }

  /* ---------------- PHONE ----------------
     9 : 19.5, corner radius 0.16 x width, a titanium rail around a
     navy-graphite body, a screen inset by a 0.035 x width bezel.      */
  const PW = 3.05;
  const PH = PW * 2.166;
  const PD = PW * 0.085;
  const PR = PW * 0.16;
  const BEZ = PW * 0.035;

  const phoneG = new THREE.Group();
  world.add(phoneG);

  const frameMat = new THREE.MeshStandardMaterial({
    color: C.titanium, metalness: 1.0, roughness: 0.28,
    transparent: true, opacity: 1
  });
  const railMesh = new THREE.Mesh(
    slabGeometry(PW + 0.052, PH + 0.052, PD * 0.60, PR + 0.026, 0.012, 16),
    frameMat
  );
  phoneG.add(railMesh);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: C.bodyDark, metalness: 0.85, roughness: 0.35,
    clearcoat: 0.6, clearcoatRoughness: 0.18,
    transparent: true, opacity: 1
  });
  const BODY_BEVEL = 0.020;
  const body = new THREE.Mesh(slabGeometry(PW, PH, PD, PR, BODY_BEVEL, 18), bodyMat);
  phoneG.add(body);

  /* ExtrudeGeometry puts its flat cap at depth + bevelThickness, so the front
     face of the slab is exactly half the depth, bevel included */
  const FRONT_Z = PD / 2;

  /* screen: two stacked planes cross-fading between real captures */
  const screenG = new THREE.Group();
  screenG.position.z = FRONT_Z + 0.004;
  phoneG.add(screenG);

  let shotAspect = 656 / 302;              /* replaced by the first decoded image */
  let SCRW = PW - BEZ * 2, SCRH = SCRW * shotAspect;
  let screenMask = null;

  const screenMats = [];
  const screenPlanes = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.MeshBasicMaterial({
      transparent: true, toneMapped: false, depthWrite: false, fog: false, opacity: i === 0 ? 1 : 0
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    mesh.position.z = i * 0.0012;
    mesh.renderOrder = 2 + i;
    screenG.add(mesh);
    screenMats.push(m); screenPlanes.push(mesh);
  }

  /* the Dynamic Island, sitting proud of the glass */
  const islandMat = new THREE.MeshPhysicalMaterial({
    color: 0x05070a, metalness: 0.35, roughness: 0.22,
    clearcoat: 1.0, clearcoatRoughness: 0.08, transparent: true, opacity: 1
  });
  const island = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), islandMat);
  island.renderOrder = 5;
  screenG.add(island);

  /* a glass reflection that shifts with the tilt */
  const sheen = sheenTexture();
  const glassMatOverlay = new THREE.MeshBasicMaterial({
    map: sheen, transparent: true, opacity: 0.06,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false
  });
  const glassPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glassMatOverlay);
  glassPlane.position.z = 0.006;
  glassPlane.renderOrder = 6;
  screenG.add(glassPlane);

  /* the live waveform, only while the screen is listening */
  const wave = waveCanvas();
  wave.tex = new THREE.CanvasTexture(wave.c);
  wave.tex.colorSpace = THREE.SRGBColorSpace;
  wave.tex.generateMipmaps = false;
  wave.tex.minFilter = THREE.LinearFilter;
  const waveMat = new THREE.MeshBasicMaterial({
    map: wave.tex, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, fog: false
  });
  const wavePlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), waveMat);
  wavePlane.position.z = 0.0055;
  wavePlane.renderOrder = 7;
  screenG.add(wavePlane);

  /* ---------------- GROUND REFLECTION ----------------
     Two mirrored planes hanging off the phone: the body silhouette and the
     screen itself, both faded out by a gradient alpha within 1.2 units of
     the phone's bottom edge. Two draw calls, and it is what stops the phone
     reading as a sticker floating on a gradient.                         */
  const reflG = new THREE.Group();
  reflG.visible = false;
  phoneG.add(reflG);

  const REFL_FADE_UNITS = 1.2;
  const REFL_LIFT = 0.07;   /* close the hairline between the phone and its own reflection */
  const reflBodyMat = new THREE.MeshBasicMaterial({
    color: 0x1a3b50, transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, toneMapped: false, fog: false
  });
  const reflBody = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), reflBodyMat);
  reflBody.renderOrder = -3;
  reflG.add(reflBody);

  const reflScreenMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, toneMapped: false, fog: false
  });
  const reflScreen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), reflScreenMat);
  reflScreen.renderOrder = -2;
  reflG.add(reflScreen);

  reflBodyMat.alphaMap = reflectionMaskTexture(128, PH / PW, PR / PW, REFL_FADE_UNITS / PH);
  /* mirror about the phone's bottom edge: a point at y lands at -PH - y */
  reflBody.position.set(0, -PH + REFL_LIFT, -0.02);
  reflBody.scale.set(PW, -PH, 1);

  function layoutScreen() {
    SCRH = PH - BEZ * 2;
    SCRW = SCRH / shotAspect;
    /* never let the side bezel collapse or bloat */
    const side = (PW - SCRW) / 2;
    if (side < PW * 0.014) { SCRW = PW - PW * 0.028; SCRH = SCRW * shotAspect; }
    if (side > PW * 0.055) { SCRW = PW - PW * 0.110; SCRH = SCRW * shotAspect; }
    screenPlanes.forEach(m => m.scale.set(SCRW, SCRH, 1));
    glassPlane.scale.set(SCRW, SCRH, 1);
    /* the island as measured on the capture: 30.8% wide, 4.27% tall, centre 3.66% down */
    island.scale.set(SCRW * 0.308, SCRH * 0.0427, 1);
    island.position.set(0, SCRH * (0.5 - 0.0366), 0.0035);
    wavePlane.scale.set(SCRW * 0.52, SCRW * 0.52 * (64 / 320), 1);
    wavePlane.position.set(0, -SCRH * 0.12, 0.0055);

    reflScreen.position.set(0, -PH + REFL_LIFT, -0.01);
    reflScreen.scale.set(SCRW, -SCRH, 1);
    if (reflScreenMat.alphaMap) reflScreenMat.alphaMap.dispose();
    reflScreenMat.alphaMap = reflectionMaskTexture(128, SCRH / SCRW, 0.13 * PW / SCRW,
                                                   REFL_FADE_UNITS / SCRH);
    reflScreenMat.needsUpdate = true;

    if (screenMask) screenMask.dispose();
    screenMask = roundedMaskTexture(256, SCRH / SCRW, 0.13 * PW / SCRW);
    screenMats.forEach(m => { m.alphaMap = screenMask; m.needsUpdate = true; });
    glassMatOverlay.alphaMap = screenMask; glassMatOverlay.needsUpdate = true;
    /* the island keeps the same rounding language */
    if (islandMat.alphaMap) islandMat.alphaMap.dispose();
    islandMat.alphaMap = roundedMaskTexture(128, 0.0427 / 0.308, 0.5);
    islandMat.transparent = true;
    islandMat.needsUpdate = true;
  }

  /* ---------------- ATMOSPHERIC BOKEH ----------------
     Not stars. Large, soft, out-of-focus discs in three depth bands, each
     one a real lens shape (flat body, faint rim, long feather). They are
     dim enough to read as air rather than as objects, they never twinkle,
     and the far band barely reacts to the cursor so the field has depth.
     A second, much smaller layer of light dust lives only around the phone
     so the product has some life immediately next to it.                */
  function pointsMaterial(map) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap:   { value: map },
        uScale: { value: window.innerHeight * 0.5 },
        uFade:  { value: 1 }
      },
      vertexShader: [
        'attribute float aSize;',
        'attribute vec3 aColor;',
        'uniform float uScale;',
        'varying vec3 vColor;',
        'void main() {',
        '  vColor = aColor;',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = aSize * (uScale / max(0.6, -mv.z));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision mediump float;',
        'uniform sampler2D uMap;',
        'uniform float uFade;',
        'varying vec3 vColor;',
        'void main() {',
        '  float a = texture2D(uMap, gl_PointCoord).a * uFade;',
        '  if (a < 0.002) discard;',
        '  gl_FragColor = vec4(vColor, a);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending
    });
  }

  function makePoints(count, map) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    const mat = pointsMaterial(map);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return { geo, mat, pts, pos, col, siz, count };
  }

  const bokehTex = bokehSpriteTexture(128);
  const dustTex  = glowSpriteTexture(64);

  /* three depth bands: near ones are big and move most, far ones sit still */
  const BANDS = [
    { z: [-1.3,  -4.3],  s: [1.90, 2.60], par: 0.62, dim: 0.90, sx: 7.6,  sy: 4.4 },
    { z: [-5.0,  -9.2],  s: [1.30, 1.90], par: 0.33, dim: 0.74, sx: 10.0, sy: 5.8 },
    { z: [-10.4, -16.8], s: [0.90, 1.35], par: 0.12, dim: 0.55, sx: 13.4, sy: 7.8 }
  ];
  const BK_N = LITE ? 36 : 90;
  const bokeh = makePoints(BK_N, bokehTex);
  const bokehG = new THREE.Group();          /* lives in the scene, not the
                                                world, so the chapter offset
                                                never drags the air with it */
  bokehG.add(bokeh.pts);
  scene.add(bokehG);

  /* bx, by, bz, phase, speed, band */
  const bk = new Float32Array(BK_N * 6);
  const bkPush = new Float32Array(BK_N * 2);
  const amberC = new THREE.Color(C.amber);
  const warmC  = new THREE.Color(C.warmWhite);
  const tmpC   = new THREE.Color();

  (function seedBokeh() {
    for (let i = 0; i < BK_N; i++) {
      const b = i % 3;                        /* even thirds across the bands */
      const B = BANDS[b];
      const o = i * 6;
      const g2 = () => (Math.random() + Math.random() - 1);
      bk[o + 0] = g2() * B.sx;
      bk[o + 1] = g2() * B.sy - 0.3;
      bk[o + 2] = lerp(B.z[0], B.z[1], Math.random());
      bk[o + 3] = Math.random() * 6.2832;
      bk[o + 4] = 0.78 + Math.random() * 0.5;
      bk[o + 5] = b;
      bokeh.siz[i] = lerp(B.s[0], B.s[1], Math.random());
      /* warm white through to amber, and dimmer the further back it sits */
      tmpC.copy(warmC).lerp(amberC, Math.pow(Math.random(), 1.25));
      const a = (0.042 + Math.random() * 0.098) * B.dim;
      bokeh.col[i * 3 + 0] = tmpC.r * a;
      bokeh.col[i * 3 + 1] = tmpC.g * a;
      bokeh.col[i * 3 + 2] = tmpC.b * a;
    }
    bokeh.geo.attributes.aColor.needsUpdate = true;
    bokeh.geo.attributes.aSize.needsUpdate = true;
  })();

  /* light dust: small, close to the phone, never over its screen */
  const DU_N = LITE ? 54 : 120;
  const dust = makePoints(DU_N, dustTex);
  dust.pts.renderOrder = -1;
  world.add(dust.pts);
  const du = new Float32Array(DU_N * 5);      /* bx, by, bz, phase, speed */

  (function seedDust() {
    for (let i = 0; i < DU_N; i++) {
      const o = i * 5;
      let x, y, z, tries = 0;
      do {
        const a = Math.random() * 6.2832;
        const r = 1.9 + Math.pow(Math.random(), 0.7) * 2.1;   /* 1.9 .. 4.0 */
        x = Math.cos(a) * r * 1.15;
        y = Math.sin(a) * r * 1.55;
        z = -3.0 + Math.random() * 3.4;
        tries++;
      } while (tries < 8 && z > -0.3 && Math.abs(x) < 2.0 && Math.abs(y) < 3.7);
      if (z > -0.3 && Math.abs(x) < 2.0 && Math.abs(y) < 3.7) z = -1.4;
      du[o + 0] = x; du[o + 1] = y; du[o + 2] = z;
      du[o + 3] = Math.random() * 6.2832;
      du[o + 4] = 0.6 + Math.random() * 0.9;
      dust.siz[i] = 0.05 + Math.random() * 0.06;
      tmpC.copy(warmC).lerp(amberC, Math.pow(Math.random(), 1.5));
      const a2 = 0.10 + Math.random() * 0.22;                 /* <= 0.32 */
      dust.col[i * 3 + 0] = tmpC.r * a2;
      dust.col[i * 3 + 1] = tmpC.g * a2;
      dust.col[i * 3 + 2] = tmpC.b * a2;
    }
    dust.geo.attributes.aColor.needsUpdate = true;
    dust.geo.attributes.aSize.needsUpdate = true;
  })();

  /* ---------------- WALL OF SCREENS (ch2) ---------------- */
  const WCOL = 5, WROW = 4, WN = WCOL * WROW;
  const wallMat = glassMat({
    color: 0xbcd8e8, roughness: 0.22, transmission: GLASSY ? 0.72 : 0,
    thickness: 0.30, ior: 1.42, envMapIntensity: 0.40,
    opacity: GLASSY ? 1 : 0.34, transparent: true
  });
  const wall = new THREE.InstancedMesh(slabGeometry(1.46, 2.82, 0.16, 0.30, 0.03, 10), wallMat, WN);
  wall.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wall.frustumCulled = false;
  world.add(wall);

  /* ---------------- 32 CARD TILES (ch3) ---------------- */
  const TN = 32;
  const tileMat = glassMat({
    color: 0xffffff, roughness: 0.2, transmission: GLASSY ? 0.72 : 0,
    thickness: 0.3, ior: 1.42, envMapIntensity: 0.42,
    opacity: GLASSY ? 1 : 0.38
  });
  const tiles = new THREE.InstancedMesh(slabGeometry(0.66, 0.92, 0.09, 0.14, 0.02, 8), tileMat, TN);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tiles.frustumCulled = false;
  world.add(tiles);

  const glowMat = new THREE.MeshBasicMaterial({
    color: C.amber, side: THREE.BackSide, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false
  });
  const tileGlow = new THREE.InstancedMesh(
    slabGeometry(0.76, 1.02, 0.13, 0.17, 0.02, 8), glowMat, TN
  );
  tileGlow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tileGlow.frustumCulled = false;
  world.add(tileGlow);

  const tileCol = new THREE.Color();
  tiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TN * 3), 3);
  for (let i = 0; i < TN; i++) tiles.setColorAt(i, tileCol.setHex(0xffffff));
  let hoverTile = -1;

  /* ---------------- STATIONS (ch4) ----------------
     Five stations around one phone. The phone is the hero in every one of
     them and never leaves the frame; everything else is light, glass or a
     painted canvas. Chapter progress is cut into five equal segments, `raw`
     runs 0..5, and each station owns a bump centred on its own half segment,
     so ?chapter=4&at=0.1 / 0.3 / 0.5 / 0.7 / 0.9 lands on stations 1..5 and
     0.2 / 0.6 sit inside the curved camera moves between them.

     Everything hangs off phoneG, so a station is always read in the phone's
     own frame: local units are phone units, and the phone's scale (a flat
     0.94 for the whole chapter) is all that separates them from world units. */
  const dummy = new THREE.Object3D();
  const stationsG = new THREE.Group();
  phoneG.add(stationsG);
  const stationNodes = [];
  function stationSlot() {
    const g = new THREE.Group();
    g.visible = false;
    stationsG.add(g);
    stationNodes.push(g);
    return g;
  }

  /* --- one material family for the props ---
     glass without transmission: a transmissive material makes three render
     the whole scene a second time, and the budget here is 40 draw calls.  */
  const frostMat = o => glassMat(Object.assign({
    color: 0xdcecfa, roughness: 0.15, transmission: 0, thickness: 0,
    opacity: 0.30, clearcoat: 0.9, clearcoatRoughness: 0.10, envMapIntensity: 0.85
  }, o || {}));
  const addMat = o => new THREE.MeshBasicMaterial(Object.assign({
    color: C.amber, transparent: true, opacity: 1, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, fog: false
  }, o || {}));
  const flatMat = o => new THREE.MeshBasicMaterial(Object.assign({
    transparent: true, opacity: 1, depthWrite: false, toneMapped: false, fog: false
  }, o || {}));

  /* ExtrudeGeometry lays its UVs out in world x/y, so anything that carries
     a painted label is a plain plane and anything that is only glass is a slab */
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  const unitSlab  = slabGeometry(1, 1, 1, 0.30, 0.06, 6);
  const chipSlab  = slabGeometry(1, 1, 0.075, 0.15, 0.018, 10);
  const glowTex   = glowSpriteTexture(96);

  /* the mic button, read off the capture: 84% across, 88% down the screen */
  const MIC = new THREE.Vector3();
  const BARLAY = { w: 0.18, gap: 0.085, y: -1.05, z: 0.38 };

  /* =========================== 1 · LISTEN =========================== */
  const s1 = stationSlot();

  /* Five rings leaving the mic. One plane and one shader rather than five
     tori: a scaled torus thickens as it grows, and these have to thin out
     as they widen. The plane is drawn twice, once in front of the phone
     carrying the young rings and once behind it carrying the old wide ones. */
  const RIPPLE_VS = [
    'varying vec2 vUv;',
    'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');
  const RIPPLE_FS = [
    'precision highp float;',
    'uniform float uTime, uFade, uSpan, uCount, uT0, uT1;',
    'varying vec2 vUv;',
    'const vec3 AMB = vec3(0.98, 0.68, 0.28);',
    'const vec3 HOT = vec3(1.00, 0.87, 0.62);',
    'void main() {',
    '  float d = length((vUv - 0.5) * 2.0 * uSpan);',
    '  vec3 col = vec3(0.0);',
    '  for (int i = 0; i < 5; i++) {',
    '    float fi = float(i);',
    '    if (fi >= uCount) break;',
    /* one ring every fifth of a cycle: at 0.4 Hz that is a 0.5 s stagger */
    '    float t = fract(uTime * 0.4 - fi * 0.2 + 0.06);',
    '    float win = smoothstep(uT0 - 0.07, uT0 + 0.07, t) * (1.0 - smoothstep(uT1 - 0.07, uT1 + 0.07, t));',
    '    if (win < 0.002) continue;',
    '    float r = 0.022 * uSpan + t * uSpan * 0.98;',
    '    float w = mix(0.0032, 0.0009, t) * uSpan;',
    '    float e = abs(d - r);',
    '    float core = exp(-(e / w) * (e / w));',
    '    float halo = exp(-(e / (w * 11.0)) * (e / (w * 11.0))) * 0.13;',
    '    float fade = pow(1.0 - t, 1.25) * smoothstep(0.0, 0.05, t) * win;',
    '    col += (mix(AMB, HOT, 1.0 - t) * core + AMB * halo) * fade;',
    '  }',
    '  col *= uFade;',
    '  if (max(col.r, max(col.g, col.b)) < 0.004) discard;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  const R_RINGS = LITE ? 3 : 5;
  function rippleMat(t0, t1) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uFade: { value: 0 }, uSpan: { value: 7.4 },
        uCount: { value: R_RINGS }, uT0: { value: t0 }, uT1: { value: t1 }
      },
      vertexShader: RIPPLE_VS, fragmentShader: RIPPLE_FS,
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending, fog: false, toneMapped: false
    });
  }
  const rippleFrontMat = rippleMat(-1.0, 0.46);
  const rippleBackMat  = rippleMat(0.40, 2.0);
  const rippleFront = new THREE.Mesh(unitPlane, rippleFrontMat);
  const rippleBack  = new THREE.Mesh(unitPlane, rippleBackMat);
  rippleFront.renderOrder = 14;
  rippleBack.renderOrder = -6;
  rippleFront.scale.setScalar(14.8);
  rippleBack.scale.setScalar(16.4);
  /* the ripples belong to the phone, not to one station: station 5 brings
     them back faintly, so they hang a level up and are faded by hand */
  stationsG.add(rippleBack, rippleFront);

  /* Eleven glass bars floating in front of the glass, amber capped. Two
     instanced draws for the whole set.                                    */
  const N_BARS = LITE ? 7 : 11;
  const BAR_H = [0.20, 0.38, 0.64, 0.48, 0.84, 1.14, 0.72, 0.96, 0.56, 0.32, 0.18];
  const barMat = new THREE.MeshPhysicalMaterial({
    color: 0x14304c, metalness: 0.30, roughness: 0.19,
    clearcoat: 1.0, clearcoatRoughness: 0.06,
    envMapIntensity: 1.15, transparent: true, opacity: 0.92
  });
  const bars = new THREE.InstancedMesh(unitSlab, barMat, 11);
  bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bars.frustumCulled = false;
  bars.renderOrder = 12;
  const capMat = new THREE.MeshBasicMaterial({
    color: 0xf6b94b, transparent: true, opacity: 1, toneMapped: false, fog: false
  });
  const barCaps = new THREE.InstancedMesh(unitSlab, capMat, 11);
  barCaps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  barCaps.frustumCulled = false;
  barCaps.renderOrder = 13;
  s1.add(bars, barCaps);
  bars.count = barCaps.count = N_BARS;

  /* the warm light the bars throw back onto the glass */
  const micLight = new THREE.PointLight(C.amber, 0, 12, 2);
  phoneG.add(micLight);

  /* =========================== 2 · UNDERSTAND =========================== */
  const s2 = stationSlot();

  const CHIPS = [
    { w: 'بھیجو',    x: -0.56, y: 4.85, z:  0.50, s: 1.00, ry: -0.16, cw: 1.34 },
    { w: 'روپے',     x:  0.79, y: 4.17, z: -0.34, s: 0.90, ry: -0.27, cw: 1.20 },
    { w: 'ایک ہزار', x:  2.19, y: 4.98, z:  0.30, s: 1.08, ry: -0.10, cw: 1.90 },
    { w: 'کو',       x:  3.59, y: 4.12, z: -0.50, s: 0.92, ry: -0.24, cw: 0.90 },
    { w: 'سارہ',     x:  4.78, y: 4.71, z:  0.08, s: 1.00, ry: -0.18, cw: 1.28 }
  ];
  const CHIP_H = 1.22;
  const chipMat = frostMat({ color: 0xeaf4ff, opacity: 0.44, roughness: 0.10 });
  const chips = new THREE.InstancedMesh(chipSlab, chipMat, CHIPS.length);
  chips.frustumCulled = false;
  chips.renderOrder = 8;
  s2.add(chips);
  const chipTex = [], chipCanvas = [], chipTextMats = [], chipTextMeshes = [];
  CHIPS.forEach((cp, i) => {
    const cv = canvas2d(512, 256)[0];
    paintUrduWord(cv, cp.w);
    chipCanvas.push(cv);
    const t = texFromCanvas(cv, MAXANISO);
    chipTex.push(t);
    const tm = flatMat({ map: t, opacity: 1 });
    chipTextMats.push(tm);
    const m = new THREE.Mesh(unitPlane, tm);
    m.renderOrder = 9;
    m.position.set(cp.x, cp.y, cp.z + 0.06);
    m.rotation.y = cp.ry;
    m.scale.set(cp.cw * cp.s * 1.02, CHIP_H * cp.s * 0.55, 1);
    s2.add(m);
    chipTextMeshes.push(m);
    dummy.position.set(cp.x, cp.y, cp.z);
    dummy.rotation.set(0, cp.ry, 0);
    dummy.scale.set(cp.cw * cp.s, CHIP_H * cp.s, 1);
    dummy.updateMatrix();
    chips.setMatrixAt(i, dummy.matrix);
  });
  chips.instanceMatrix.needsUpdate = true;
  /* Nastaliq only exists once the webfont has landed, so paint them again */
  urduReady.then(() => {
    for (let i = 0; i < CHIPS.length; i++) {
      paintUrduWord(chipCanvas[i], CHIPS[i].w);
      chipTex[i].needsUpdate = true;
    }
  });

  const SLOTS = [
    { k: 'Amount',    v: 'Rs 1,000',    e: false, x: 6.55, y:  1.95, z: -0.9 },
    { k: 'Recipient', v: 'Sara',        e: false, x: 6.90, y: -0.02, z: -1.3 },
    { k: 'Bank',      v: 'Which bank?', e: true,  x: 7.25, y: -1.99, z: -1.7 }
  ];
  const SLOT_W = 3.85, SLOT_H = SLOT_W * (226 / 720);
  const slotMats = [];
  SLOTS.forEach(sl => {
    const mt = flatMat({ map: texFromCanvas(slotCanvas(sl.k, sl.v, sl.e), MAXANISO) });
    const m = new THREE.Mesh(unitPlane, mt);
    m.position.set(sl.x, sl.y, sl.z);
    m.rotation.y = -0.30;
    m.scale.set(SLOT_W, SLOT_H, 1);
    m.renderOrder = 8;
    s2.add(m);
    slotMats.push(mt);
  });
  /* the amber halo that keeps pulsing while the last slot is unanswered */
  const bankGlowMat = addMat({ map: glowTex, color: C.amber, opacity: 0 });
  const bankGlow = new THREE.Mesh(unitPlane, bankGlowMat);
  bankGlow.position.set(SLOTS[2].x, SLOTS[2].y, SLOTS[2].z - 0.06);
  bankGlow.rotation.y = -0.30;
  bankGlow.scale.set(SLOT_W * 2.0, SLOT_H * 3.6, 1);
  bankGlow.renderOrder = 7;
  s2.add(bankGlow);

  /* three light threads, chip to slot; the unanswered one is dashed */
  const threadMats = [];
  function thread(from, to, bow, mat) {
    const a = new THREE.Vector3(from[0], from[1], from[2]);
    const b = new THREE.Vector3(to[0], to[1], to[2]);
    const m1 = a.clone().lerp(b, 0.34).add(new THREE.Vector3(bow[0], bow[1], bow[2]));
    const m2 = a.clone().lerp(b, 0.70).add(new THREE.Vector3(bow[0] * 0.35, bow[1] * 0.35, bow[2] * 0.35));
    const curve = new THREE.CatmullRomCurve3([a, m1, m2, b], false, 'catmullrom', 0.6);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 54, 0.0085, 5, false), mat);
    mesh.renderOrder = 8;
    threadMats.push(mat);
    s2.add(mesh);
  }
  const dashTex = dashTexture();
  dashTex.repeat.set(74, 1);
  thread([2.19, 4.40, 0.30], [4.60, 1.95, -0.28], [0.35, -0.55, 0.10],
         addMat({ color: 0xffe0ae, opacity: 0.62 }));
  thread([4.78, 4.13, 0.08], [4.85, -0.02, -0.68], [0.86, -0.30, 0.10],
         addMat({ color: 0xcfe4f6, opacity: 0.46 }));
  thread([-0.56, 4.27, 0.50], [5.20, -1.99, -1.08], [-0.45, -1.45, 0.10],
         addMat({ color: C.amber, opacity: 0.72, alphaMap: dashTex }));

  /* =========================== 3 · ACT =========================== */
  const s3 = stationSlot();

  /* the tableau is lifted back up by as much as the camera drops the phone,
     so the panels sit on the middle of the frame while the phone hangs low */
  s3.position.y = 1.15;
  const PANELS = [
    { n: '01', l: 'PREPARE',       x: 5.85, y: 0.30, z: -1.1 },
    { n: '02', l: 'PIN',           x: 8.35, y: 0.42, z: -3.0 },
    { n: '03', l: 'EXECUTE\nONCE', x: 10.65, y: 0.54, z: -4.9 }
  ];
  const PANEL_W = 1.66, PANEL_H = PANEL_W * (840 / 300);
  PANELS.forEach(p => {
    const dimM = flatMat({ map: texFromCanvas(panelCanvas(p.n, p.l, false), MAXANISO), opacity: 0.9 });
    const litM = flatMat({ map: texFromCanvas(panelCanvas(p.n, p.l, true), MAXANISO), opacity: 0 });
    const a = new THREE.Mesh(unitPlane, dimM);
    a.position.set(p.x, p.y, p.z);
    a.rotation.y = 0.33;
    a.scale.set(PANEL_W, PANEL_H, 1);
    a.renderOrder = 8 - PANELS.indexOf(p) * 2;
    const b = new THREE.Mesh(unitPlane, litM);
    b.position.set(p.x, p.y, p.z + 0.014);
    b.rotation.y = 0.33;
    b.scale.set(PANEL_W, PANEL_H, 1);
    b.renderOrder = 9 - PANELS.indexOf(p) * 2;
    s3.add(a, b);
    p.dimM = dimM; p.litM = litM;
  });

  /* the contact glow the lit panel puts on the floor */
  const panelFloorMat = addMat({ map: glowTex, color: 0xffc468, opacity: 0 });
  const panelFloorGlow = new THREE.Mesh(unitPlane, panelFloorMat);
  panelFloorGlow.rotation.x = -Math.PI / 2;
  panelFloorGlow.scale.set(4.2, 3.4, 1);
  panelFloorGlow.position.y = -3.52;
  panelFloorGlow.renderOrder = 5;
  s3.add(panelFloorGlow);

  /* a faint perspective floor: one LineSegments draw, faded by vertex colour */
  const gridMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  });
  (function gridFloor() {
    const pos = [], col = [];
    const y = -3.55, x0 = 1.4, x1 = 13.8, z0 = 2.0, z1 = -12.6;
    const base = new THREE.Color(0x96c4ec);
    const fade = z => 0.06 + 0.60 * clamp(1 - (z0 - z) / (z0 - z1), 0, 1);
    const push = (ax, az, bx, bz) => {
      const fa = fade(az), fb = fade(bz);
      pos.push(ax, y, az, bx, y, bz);
      col.push(base.r * fa, base.g * fa, base.b * fa, base.r * fb, base.g * fb, base.b * fb);
    };
    for (let i = 0; i <= 12; i++) { const x = lerp(x0, x1, i / 12); push(x, z0, x, z1); }
    for (let j = 0; j <= 9; j++)  { const z = lerp(z0, z1, j / 9);  push(x0, z, x1, z); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const ls = new THREE.LineSegments(g, gridMat);
    ls.renderOrder = 4;
    s3.add(ls);
  })();

  /* the beam: a bright core ribbon inside a wide soft one */
  const beamSoftMat = addMat({ map: texFromCanvas(beamCanvas(0.55)), color: 0xffffff, opacity: 0 });
  const beamCoreMat = addMat({ map: texFromCanvas(beamCanvas(0.06)), color: 0xffffff, opacity: 0 });
  const BEAM_X0 = 0.6, BEAM_X1 = 12.2, BEAM_Y = -0.45;
  const BEAM_Z0 = -0.30, BEAM_Z1 = -4.60;
  const bMid = (BEAM_X0 + BEAM_X1) / 2, bMidZ = (BEAM_Z0 + BEAM_Z1) / 2;
  const bYaw = Math.atan2(BEAM_Z0 - BEAM_Z1, BEAM_X1 - BEAM_X0);
  const bLen = Math.hypot(BEAM_X1 - BEAM_X0, BEAM_Z1 - BEAM_Z0);
  const beamSoft = new THREE.Mesh(unitPlane, beamSoftMat);
  beamSoft.position.set(bMid, BEAM_Y, bMidZ);
  beamSoft.scale.set(bLen, 2.60, 1);
  beamSoft.rotation.set(0, bYaw, 0.045);
  beamSoft.renderOrder = 10;
  const beamCore = new THREE.Mesh(unitPlane, beamCoreMat);
  beamCore.position.set(bMid, BEAM_Y, bMidZ + 0.02);
  beamCore.scale.set(bLen, 0.30, 1);
  beamCore.rotation.set(0, bYaw, 0.045);
  beamCore.renderOrder = 11;
  s3.add(beamSoft, beamCore);

  /* the capsule carrying the token, riding the beam */
  const capsuleG = new THREE.Group();
  const capsuleShellMat = frostMat({
    color: 0x2b5c80, opacity: 0.66, roughness: 0.16, metalness: 0.28,
    envMapIntensity: 1.1, depthWrite: false
  });
  const capsuleShell = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.30, 6, 20), capsuleShellMat);
  capsuleShell.rotation.z = Math.PI / 2;
  capsuleShell.renderOrder = 12;
  const capsuleCoreMat = addMat({ color: 0xf6b23f, opacity: 1 });
  const capsuleCore = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.46, 5, 14), capsuleCoreMat);
  capsuleCore.rotation.z = Math.PI / 2;
  capsuleCore.position.set(-0.56, 0, 0.44);
  capsuleCore.renderOrder = 13;
  const capsuleBadgeMat = flatMat({ map: texFromCanvas(badgeCanvas(), MAXANISO), opacity: 1 });
  const capsuleBadge = new THREE.Mesh(unitPlane, capsuleBadgeMat);
  capsuleBadge.position.set(0.30, 0.02, 0.62);
  capsuleBadge.scale.set(2.05, 2.05 * (150 / 520), 1);
  capsuleBadge.renderOrder = 14;
  capsuleG.add(capsuleShell, capsuleCore, capsuleBadge);
  capsuleG.rotation.y = 0.30;
  s3.add(capsuleG);

  /* =========================== 4 · CARD AND REPLY =========================== */
  const s4 = stationSlot();

  const receiptTex = texFromCanvas(receiptCanvas(), MAXANISO);
  const CARD_W = 2.46, CARD_H = CARD_W * (380 / 640);
  const cardMat = flatMat({ map: receiptTex, opacity: 1 });
  const cardPlane = new THREE.Mesh(unitPlane, cardMat);
  cardPlane.renderOrder = 16;
  s4.add(cardPlane);
  const ghostMats = [], ghosts = [];
  for (let i = 0; i < 3; i++) {
    const m = flatMat({ map: receiptTex, opacity: 0 });
    const g = new THREE.Mesh(unitPlane, m);
    g.renderOrder = 15;
    s4.add(g);
    ghostMats.push(m); ghosts.push(g);
  }
  const cardUnderMat = addMat({ map: glowTex, color: 0xffcc78, opacity: 0 });
  const cardUnder = new THREE.Mesh(unitPlane, cardUnderMat);
  cardUnder.renderOrder = 14;
  s4.add(cardUnder);

  /* =========================== 5 · KEEPS LISTENING =========================== */
  const s5 = stationSlot();

  /* one stroke of light: it leaves the mic, loops out, crosses itself once
     and comes back. The upper half runs behind the phone, so the body
     occludes it and the loop reads as one object standing in space.       */
  const STROKE_PTS = [
    [ 1.01, -2.45,  0.30], [ 1.79, -2.38,  0.24], [ 2.34, -1.69,  0.02],
    [ 2.28, -0.83, -0.44], [ 1.30,  2.07, -1.12], [-0.18,  2.36, -1.22],
    [-1.36,  2.58, -1.02], [-2.44,  1.77, -0.62], [-2.52,  0.65, -0.12],
    [-2.05, -1.67,  0.36], [-1.00, -2.32,  0.56], [-0.31, -2.78,  0.63],
    [ 0.45, -2.62,  0.50]
  ];
  const strokeCurve = new THREE.CatmullRomCurve3(
    STROKE_PTS.map(p => new THREE.Vector3(p[0], p[1], p[2])), true, 'catmullrom', 0.5
  );
  const STROKE_SEG = LITE ? 140 : 240, STROKE_RAD = 6;
  const strokeMat = addMat({ color: 0xf2a93b, opacity: 0.46 });
  /* the core is normally blended: additive light cannot draw a stroke
     across the phone's own cream card, and this one crosses it twice */
  const strokeCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.90, depthWrite: false,
    toneMapped: false, fog: false, vertexColors: true
  });
  /* TubeGeometry has one radius for the whole run, so the hand-drawn
     thick-to-thin taper is painted into the vertex colours instead */
  const _tcA = new THREE.Color(), _tcB = new THREE.Color(), _tcM = new THREE.Color();
  function taperTube(geo, seg, rad, lo, dim, hot) {
    const cnt = geo.attributes.position.count;
    const col = new Float32Array(cnt * 3);
    _tcA.setHex(dim === undefined ? 0x000000 : dim);
    _tcB.setHex(hot === undefined ? 0xffffff : hot);
    for (let i = 0; i < cnt; i++) {
      const u = Math.floor(i / (rad + 1)) / seg;
      const b = lo + (1 - lo) * (0.5 + 0.5 * Math.cos((u - 0.90) * 6.2832));
      _tcM.copy(_tcA).lerp(_tcB, b);
      col[i * 3] = _tcM.r; col[i * 3 + 1] = _tcM.g; col[i * 3 + 2] = _tcM.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }
  strokeMat.vertexColors = true;
  const stroke = new THREE.Mesh(
    taperTube(new THREE.TubeGeometry(strokeCurve, STROKE_SEG, 0.040, STROKE_RAD, true),
              STROKE_SEG, STROKE_RAD, 0.30), strokeMat);
  const strokeCore = new THREE.Mesh(
    taperTube(new THREE.TubeGeometry(strokeCurve, STROKE_SEG, 0.019, 5, true),
              STROKE_SEG, 5, 0.10, 0x8a4f0a, 0xffc668), strokeCoreMat);
  stroke.renderOrder = 11; strokeCore.renderOrder = 12;
  s5.add(stroke, strokeCore);
  const STROKE_IDX = STROKE_SEG * STROKE_RAD * 6;
  const STROKE_CORE_IDX = STROKE_SEG * 5 * 6;
  const strokePulseMat = new THREE.MeshBasicMaterial({
    color: 0xfffdf6, transparent: true, opacity: 1, depthWrite: false,
    toneMapped: false, fog: false
  });
  const strokePulse = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), strokePulseMat);
  strokePulse.renderOrder = 13;
  s5.add(strokePulse);
  const _sp = new THREE.Vector3();

  /* --- anything anchored to the mic has to be re-placed when the capture
         aspect ratio lands and the screen is laid out again --- */
  function layoutStations() {
    MIC.set((0.84 - 0.5) * SCRW, (0.5 - 0.88) * SCRH, FRONT_Z + 0.02);
    rippleFront.position.set(MIC.x, MIC.y, FRONT_Z + 0.03);
    rippleBack.position.set(MIC.x, MIC.y, -PD / 2 - 1.0);
    micLight.position.set(MIC.x * 0.42, MIC.y * 0.30 + 0.25, FRONT_Z + 1.35);
    BARLAY.w = SCRW * 0.0605;
    BARLAY.gap = SCRW * 0.0285;
    BARLAY.y = -SCRH * 0.165;
    stroke.position.set(0, 0, 0);
  }

  /* ---------------- VAULT (ch5) ---------------- */
  const vaultG = new THREE.Group();
  world.add(vaultG);
  const vaultMat = glassMat({
    color: 0xbfe0f2, roughness: 0.18, metalness: 0.35,
    transmission: 0, opacity: 0.5, thickness: 0.4, clearcoat: 0.8
  });
  const vaultA = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.16, 12, 96), vaultMat);
  const vaultB = new THREE.Mesh(new THREE.TorusGeometry(4.15, 0.09, 10, 96), vaultMat.clone());
  vaultG.add(vaultA, vaultB);
  const vaultGlow = new THREE.Mesh(
    new THREE.TorusGeometry(3.74, 0.038, 8, 120),
    new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.7, toneMapped: false,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
  );
  vaultG.add(vaultGlow);

  /* ---------------- SCREENSHOT ARC (ch6) ---------------- */
  const SHOTS = [
    'send-chips', 'send-pin-sheet', 'send-receipt',
    'checkin', 'approvals-bilal', 'approved-ammi',
    'urdu', 'digest', 'wallet'
  ];
  const shotsG = new THREE.Group();
  world.add(shotsG);
  const shotMeshes = [];
  const shotBacks = [];

  /* one loading manager for every image on the page */
  const wanted = {};
  SEQ.concat(SHOTS).forEach(n => { wanted[n] = 1; });
  const NAMES = Object.keys(wanted);
  let loadedN = 0;
  function setProgress(v) { if (barEl) barEl.style.transform = 'scaleX(' + clamp(v, 0, 1) + ')'; }

  const manager = new THREE.LoadingManager();
  manager.onProgress = () => { setProgress((++loadedN) / (NAMES.length + 1)); };
  const texLoader = new THREE.TextureLoader(manager);

  const TEX = {};
  let sizedFromImage = false;
  NAMES.forEach(name => {
    TEX[name] = texLoader.load('assets/' + name + '.webp', tex => {
      const im = tex.image;
      const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
      if (!sizedFromImage && w > 0 && h > 0) {
        sizedFromImage = true;
        shotAspect = h / w;
        layoutScreen();
        layoutShots();
        layoutStations();
      }
    });
    const t = TEX[name];
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = LITE ? Math.min(4, MAXANISO) : MAXANISO;
  });

  const backdrop = shotBackdropTexture(shotAspect);
  const backMat = new THREE.MeshBasicMaterial({
    map: backdrop.tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false
  });
  let SGW = 1.62, SGH = SGW * shotAspect;

  SHOTS.forEach((name, i) => {
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backMat);
    back.position.z = -0.012;
    back.renderOrder = 0;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: TEX[name], toneMapped: false, transparent: true, opacity: 0,
        depthWrite: false, fog: false
      })
    );
    m.renderOrder = 1;
    m.add(back);
    shotsG.add(m);
    shotMeshes.push(m); shotBacks.push(back);
  });

  function layoutShots() {
    SGH = SGW * shotAspect;
    shotMeshes.forEach(m => m.scale.set(SGW, SGH, 1));
    /* the backdrop is a child, so its scale is relative to the shot */
    shotBacks.forEach(b => b.scale.set(backdrop.pad, backdrop.pad, 1));
  }
  layoutScreen();
  layoutShots();
  layoutStations();

  /* ---------------- LAYOUT / STATE ---------------- */
  const S = {
    p: 0, pT: 0,
    mx: 0, my: 0, mxT: 0, myT: 0,
    objX: 0,
    counted: false
  };
  let wide = window.innerWidth / window.innerHeight > 1.12 && VW > 900;

  const camKeys = [
    { p: [0, 0.10, 12.4], t: [0, 0.00,  0.0] },
    { p: [0, 0.45, 13.2], t: [0, 0.10,  0.0] },
    { p: [0, 1.20, 19.2], t: [0, 0.50, -2.0] },
    { p: [1.5, 0.20, 13.0], t: [0, 0.00, 0.0] },
    { p: [0, 0.00, 11.6], t: [0, 0.00,  0.0] },
    { p: [0, 0.00, 14.4], t: [0, 0.00,  0.0] },
    { p: [0, 0.10, 18.4], t: [0, 0.00, -1.2] },
    { p: [0, 0.00, 12.2], t: [0, 0.00,  0.0] }
  ];
  const objXKeys = [2.15, 2.25, 3.05, 2.55, 2.15, 2.35, 0.0, 0.0];
  const _tgt = new THREE.Vector3();
  const _rig = new THREE.Vector3(), _rigT = new THREE.Vector3();
  const AMBER = new THREE.Color(C.amber);

  /* ---------------- CHAPTER 4 RIG ----------------
     Per station: where the phone stands, and where the camera stands
     relative to it. Defining the camera against the phone rather than
     against the world means the framing of a station never changes when
     the chapter offset does.                                           */
  const ST_RIG = [
    { px:  0.00, py:  0.00, pz:  0.00, rx:  0.078, ry: -0.183, rz: -0.024, s: 1.00 },
    { px: -0.20, py: -0.10, pz:  0.00, rx:  0.050, ry: -0.120, rz: -0.016, s: 1.00 },
    { px:  0.00, py:  0.00, pz:  0.00, rx:  0.020, ry:  0.150, rz:  0.000, s: 1.00 },
    { px:  0.00, py:  0.00, pz:  0.00, rx:  0.032, ry: -0.075, rz: -0.010, s: 1.00 },
    { px:  0.00, py:  0.00, pz:  0.00, rx:  0.055, ry:  0.000, rz:  0.018, s: 1.00 }
  ];
  /* d: distance from the phone, ox: how far right of the view axis the
     phone sits, oy: camera lift, ty: how far the look target sits above
     the phone, orb: yaw of the camera around the phone                   */
  const ST_CAM = [
    { d: 13.2, ox: -2.10, oy: 0.16, ty:  0.02, orb:  0.000 },
    { d: 16.9, ox: -0.45, oy: 0.60, ty:  0.95, orb:  0.000 },
    { d: 11.9, ox:  2.60, oy: 1.42, ty:  1.52, orb:  0.000 },
    { d: 12.9, ox: -1.95, oy: 0.12, ty:  0.05, orb:  0.000 },
    { d: 13.1, ox: -1.85, oy: 0.55, ty:  0.05, orb: -0.663 }
  ];
  const ST_SCREEN = [
    IDX['home-listening'], IDX['send-chips'], IDX['send-chips'],
    IDX['send-receipt'], IDX['home-greet']
  ];
  const ST_W = [0, 0, 0, 0, 0];
  const RIG = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1 };
  const CAMR = { d: 0, ox: 0, oy: 0, ty: 0, orb: 0 };


  /* ---------------- RESIZE ---------------- */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    wide = (w / h > 1.12) && VW > 900;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(LITE ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    bgUniforms.uRes.value.set(w, h);
    /* the same world-unit -> pixel constant three's own points shader uses */
    const ps = h * 0.5 * renderer.getPixelRatio();
    bokeh.mat.uniforms.uScale.value = ps;
    dust.mat.uniforms.uScale.value = ps;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- SCROLL ----------------
     Native scrolling only. No wheel interception, no CSS smooth scroll:
     ScrollTrigger reads the page, and the scene follows through one
     damped lerp with a ~80 ms time constant.                          */
  const story = $('#story');
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger: story, start: 'top top', end: 'bottom bottom',
    onUpdate: self => { if (!FROZEN) S.pT = self.progress; }
  });

  function chapterScroll(n) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.round(max * ((n - 0.5) / CH));
  }
  function gotoChapter(n) {
    window.scrollTo({ top: chapterScroll(n), behavior: prefersReduce ? 'auto' : 'smooth' });
  }
  function pinChapter(n) {
    root.classList.add('harness');
    sections.forEach(sec => sec.classList.toggle('show', parseInt(sec.dataset.ch, 10) === n));
  }
  railDots.forEach(d => {
    d.addEventListener('click', () => gotoChapter(parseInt(d.dataset.go, 10)));
  });
  $('#rail').addEventListener('keydown', e => {
    const idx = railDots.indexOf(document.activeElement);
    if (idx < 0) return;
    let n = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = Math.min(CH, idx + 2);
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = Math.max(1, idx);
    if (e.key === 'Home') n = 1;
    if (e.key === 'End') n = CH;
    if (n > 0) {
      e.preventDefault();
      gotoChapter(n);
      railDots[n - 1].focus();
    }
  });
  $$('.navlinks a').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const secEl = document.querySelector(id);
      if (!secEl) return;
      e.preventDefault();
      gotoChapter(parseInt(secEl.dataset.ch, 10));
    });
  });

  /* ---------------- POINTER ---------------- */
  const ray = new THREE.Raycaster();
  ray.params.Points.threshold = 0.2;
  const ndc = new THREE.Vector2(-2, -2);
  const mouseWorld = new THREE.Vector3();
  const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  window.addEventListener('pointermove', e => {
    S.mxT = (e.clientX / window.innerWidth) * 2 - 1;
    S.myT = (e.clientY / window.innerHeight) * 2 - 1;
    ndc.set(S.mxT, -S.myT);
  }, { passive: true });

  /* ---------------- MOTION TOGGLE ---------------- */
  let running = !root.classList.contains('static');
  motionBtn.addEventListener('click', () => {
    const on = root.classList.toggle('static');
    motionBtn.setAttribute('aria-pressed', String(on));
    running = !on;
    if (!on) {
      resize();
      last = performance.now();
      requestAnimationFrame(frame);
    }
    ScrollTrigger.refresh();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; }
    else if (!root.classList.contains('static')) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });

  /* ---------------- HTML OVERLAY DRIVER ---------------- */
  const cols = sections.map(s => $$('.col, .shotcaps', s));
  const stationEls = $$('.ch4 .station');
  const lastVal = new Array(sections.length).fill(-1);
  let lastStation = -1;
  const n48 = $('#n48'), n32 = $('#n32');
  const finaleEls = $$('.ch7 .limits, .ch7 .tiny, .ch7 .eyebrow, .ch7 h2');
  let lastFin = -1;
  const hint = $('#scrollhint');
  const navLinks = $$('.navlinks a');

  function overlays(p) {
    const seg = p * CH;
    for (let i = 0; i < CH; i++) {
      const l = clamp(seg - i, 0, 1);
      let v;
      if (i === 0) v = 1 - smooth(0.62, 0.92, l);
      else if (i === CH - 1) v = smooth(0.04, 0.30, l);
      /* chapter 4 holds its copy for the whole chapter: stations 1 and 5
         sit at 10% and 90%, well inside the usual fade zones */
      else if (i === 3) v = smooth(0.01, 0.09, l) * (1 - smooth(0.93, 1.00, l));
      else v = smooth(0.05, 0.26, l) * (1 - smooth(0.74, 0.96, l));
      if (!FLOW && Math.abs(v - lastVal[i]) > 0.004) {
        lastVal[i] = v;
        const y = (1 - v) * 26;
        cols[i].forEach(el => {
          el.style.opacity = v.toFixed(3);
          el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
        });
      }
      const on = seg >= i && seg < i + 1;
      if (railDots[i]) railDots[i].classList.toggle('on', on);
    }
    for (let i = 0; i < navLinks.length; i++) {
      navLinks[i].classList.toggle('on', seg >= i + 1 && seg < i + 2);
    }
    const l4 = clamp(seg - 3, 0, 1);
    const si = clamp(Math.floor(l4 * 5.0), 0, 4);
    if (si !== lastStation) {
      lastStation = si;
      stationEls.forEach((el, i) => el.classList.toggle('on', i === si));
    }
    if (!S.counted && seg > 2.05) {
      S.counted = true;
      if (!prefersReduce && !FROZEN) {
        const a = { v: 0 }, b = { v: 0 };
        gsap.to(a, { v: 48, duration: 1.0, ease: 'power2.out',
          onUpdate: () => { n48.textContent = String(Math.round(a.v)); },
          onComplete: () => { n48.textContent = '48'; } });
        gsap.to(b, { v: 32, duration: 1.0, ease: 'power2.out', delay: 0.12,
          onUpdate: () => { n32.textContent = String(Math.round(b.v)); },
          onComplete: () => { n32.textContent = '32'; } });
      }
    }
    if (hint) hint.classList.toggle('gone', seg > 0.06);
    const fin = smooth(0.60, 0.88, clamp(seg - 6, 0, 1));
    if (!FLOW && Math.abs(fin - lastFin) > 0.004) {
      lastFin = fin;
      finaleEls.forEach(el => {
        el.style.opacity = (1 - fin).toFixed(3);
        el.style.transform = 'translate3d(0,' + (fin * -14).toFixed(2) + 'px,0)';
      });
    }
  }

  /* ---------------- THE SCREEN SEQUENCE ---------------- */
  const scrSeq = { a: 0, b: 0, t0: -99 };
  function setScreenTarget(idx, time) {
    if (idx === scrSeq.b) return;
    scrSeq.a = scrSeq.b;
    scrSeq.b = idx;
    scrSeq.t0 = time;
  }
  function updateScreenSequence(time, forced) {
    const want = forced >= 0 ? forced : (Math.floor(time / HOLD) % SEQ.length);
    setScreenTarget(want, time);
    const mix = FROZEN ? 1 : clamp((time - scrSeq.t0) / FADE, 0, 1);
    screenMats[0].map = TEX[SEQ[scrSeq.a]] || null;
    screenMats[1].map = TEX[SEQ[scrSeq.b]] || null;
    screenMats[1].opacity = mix;
    screenMats[0].needsUpdate = screenMats[1].needsUpdate = true;

    const dominant = mix > 0.5 ? scrSeq.b : scrSeq.a;
    screenState.frame = dominant;
    const listening = dominant === IDX['home-listening'] ? 1 : 0;
    screenState.listening = listening;
    screenState.amp = listening ? 0.55 + 0.45 * Math.abs(Math.sin(time * 2.6)) : 0;
    return { mix, listening };
  }

  /* ---------------- CHAPTER 4 HTML LAYER ----------------
     A leader line from the live copy panel to the object it describes, and
     the three captions that sit under the phone. Both are placed from the
     camera's own projection, in fractions of the canvas, so the ?vw= zoom
     never enters the arithmetic.                                          */
  const fxRoot   = $('#ch4fx');
  const leadSvg  = $('#leadsvg');
  const leadPath = $('#leadpath');
  const leadDot  = $('#leaddot');
  const capWrap  = $('#ch4caps');
  const stCapEls = $$('#ch4caps .stcap');
  const ST_ANCHOR = [
    new THREE.Vector3(),
    new THREE.Vector3(7.25, -1.99, -1.70),
    new THREE.Vector3(6.40,  0.40, -2.10),
    new THREE.Vector3(),
    new THREE.Vector3(-2.50,  0.70, -0.60)
  ];
  const _an = new THREE.Vector3(), _cap = new THREE.Vector3(), _prj = new THREE.Vector3();
  let fxShown = -1;

  function updateCh4Overlay(sv, time) {
    const on = sv > 0.02 && !FLOW && !root.classList.contains('static') ? 1 : 0;
    if (on !== fxShown) { fxShown = on; fxRoot.classList.toggle('on', !!on); }
    if (!on) return;

    /* the anchor is the weighted mix of the five station anchors, so the
       line slides across rather than jumping at a station boundary */
    ST_ANCHOR[0].copy(MIC);
    ST_ANCHOR[3].set(0, -SCRH * 0.035, FRONT_Z + 0.06);
    _an.set(0, 0, 0);
    for (let n = 0; n < 5; n++) _an.addScaledVector(ST_ANCHOR[n], ST_W[n]);
    stationsG.localToWorld(_an);
    _prj.copy(_an).project(camera);
    const ax = (_prj.x * 0.5 + 0.5) * 1000;
    const ay = (-_prj.y * 0.5 + 0.5) * 1000;

    const idx = clamp(lastStation, 0, 4);
    const el = stationEls[idx];
    const svgR = leadSvg.getBoundingClientRect();
    let ok = el && svgR.width > 1 && _prj.z < 1 && ax > -60 && ax < 1060;
    if (ok) {
      const r = el.getBoundingClientRect();
      const bx = (r.right - svgR.left) / svgR.width * 1000;
      const by = (r.top + r.height * 0.58 - svgR.top) / svgR.height * 1000;
      if (bx > ax - 30) ok = false;
      else {
        const dx = ax - bx;
        leadPath.setAttribute('d',
          'M ' + bx.toFixed(1) + ' ' + by.toFixed(1) +
          ' C ' + (bx + dx * 0.44).toFixed(1) + ' ' + by.toFixed(1) +
          ', ' + (ax - dx * 0.30).toFixed(1) + ' ' + ay.toFixed(1) +
          ', ' + ax.toFixed(1) + ' ' + ay.toFixed(1));
        leadPath.style.strokeDashoffset = BG_FREEZE ? '0' : (-(time * 16) % 22).toFixed(1);
        leadDot.setAttribute('cx', ax.toFixed(1));
        leadDot.setAttribute('cy', ay.toFixed(1));
      }
    }
    const lv = ok ? sv : 0;
    leadPath.style.opacity = (lv * 0.55).toFixed(3);
    leadDot.style.opacity = (lv * 0.80).toFixed(3);

    /* the captions hang off the bottom of the phone, wherever it is */
    _cap.set(0, -PH * 0.545, 0);
    phoneG.localToWorld(_cap);
    _prj.copy(_cap).project(camera);
    capWrap.style.left = clamp(_prj.x * 50 + 50, 8, 92).toFixed(2) + '%';
    capWrap.style.top  = clamp(-_prj.y * 50 + 50, 12, 86).toFixed(2) + '%';
    for (let n = 0; n < stCapEls.length; n++) {
      const w = ST_W[parseInt(stCapEls[n].dataset.st, 10)] * sv;
      stCapEls[n].style.opacity = w.toFixed(3);
      stCapEls[n].style.transform = 'translate3d(-50%,' + ((1 - w) * 12).toFixed(2) + 'px,0)';
    }
  }

  /* ---------------- SCENE DRIVER ---------------- */
  const _cp = new THREE.Vector3();

  function updateScene(p, time, dt) {
    const seg = p * CH;
    const i = clamp(Math.floor(seg), 0, CH - 1);
    const f = ease(clamp(seg - i, 0, 1));
    const A = camKeys[i], B = camKeys[i + 1];

    const c2 = clamp(seg - 1, 0, 1);
    const c3 = clamp(seg - 2, 0, 1);
    const c4 = clamp(seg - 3, 0, 1);
    const c5 = clamp(seg - 4, 0, 1);
    const c6 = clamp(seg - 5, 0, 1);
    const c7 = clamp(seg - 6, 0, 1);

    /* -------- CHAPTER 4 STATION RIG (the camera needs it first) --------
       Five equal segments. Each station owns a bump centred on its own half
       segment, so the five weights sum to one and the blend of them is the
       live rig: at raw4 = 0.5 station 1 owns everything, at raw4 = 1.0 the
       two neighbours share it and the camera is mid move.                 */
    const raw4 = clamp(c4 * 5, 0, 5);
    let wSum = 0;
    for (let n = 0; n < 5; n++) {
      const w = smooth(n - 0.14, n + 0.18, raw4) * (1 - smooth(n + 0.82, n + 1.14, raw4));
      ST_W[n] = w; wSum += w;
    }
    if (wSum < 1e-5) { ST_W[0] = 1; wSum = 1; }
    for (let n = 0; n < 5; n++) ST_W[n] /= wSum;
    RIG.px = RIG.py = RIG.pz = RIG.rx = RIG.ry = RIG.rz = RIG.s = 0;
    CAMR.d = CAMR.ox = CAMR.oy = CAMR.ty = CAMR.orb = 0;
    for (let n = 0; n < 5; n++) {
      const w = ST_W[n], R = ST_RIG[n], K = ST_CAM[n];
      RIG.px += R.px * w; RIG.py += R.py * w; RIG.pz += R.pz * w;
      RIG.rx += R.rx * w; RIG.ry += R.ry * w; RIG.rz += R.rz * w; RIG.s += R.s * w;
      CAMR.d += K.d * w; CAMR.ox += K.ox * w; CAMR.oy += K.oy * w;
      CAMR.ty += K.ty * w; CAMR.orb += K.orb * w;
    }
    /* the rig takes the camera over inside chapter 4 and hands it back at
       both ends, so chapters 3 and 5 are untouched */
    const stBlend = (seg > 2.999 && seg < 4.001)
      ? smooth(0.00, 0.15, c4) * (1 - smooth(0.85, 1.00, c4)) : 0;

    _cp.set(lerp(A.p[0], B.p[0], f), lerp(A.p[1], B.p[1], f), lerp(A.p[2], B.p[2], f));
    _tgt.set(lerp(A.t[0], B.t[0], f), lerp(A.t[1], B.t[1], f), lerp(A.t[2], B.t[2], f));

    S.objX = wide ? lerp(objXKeys[i], objXKeys[i + 1], f) : 0;
    if (wide && i === 5) S.objX = lerp(objXKeys[5], 0, smooth(0, 0.42, clamp(seg - 5, 0, 1)));
    world.position.x = S.objX;

    if (stBlend > 0.0005) {
      /* a move between stations bows out of the straight line: the camera
         swings back and lifts through the middle of it, then settles */
      const u4 = raw4 - Math.floor(raw4);
      const arc = smooth(0.50, 1.0, Math.abs(u4 - 0.5) * 2) *
                  ((raw4 > 0.5 && raw4 < 4.5) ? 1 : 0.3);
      const sA = Math.sin(CAMR.orb), cA = Math.cos(CAMR.orb);
      const pwx = S.objX + RIG.px * stBlend;
      const pwy = (wide ? 0 : -0.4) + RIG.py;
      const pwz = (wide ? 0 : -1.6) + RIG.pz;
      /* the camera's own right vector, so `ox` reads as "how far right of
         the view axis the phone sits" whatever the orbit angle is */
      const lx = pwx + cA * CAMR.ox, lz = pwz - sA * CAMR.ox;
      const dd = (CAMR.d + arc * 2.6) * (wide ? 1 : 0.78);
      _rig.set(lx + sA * dd, pwy + CAMR.oy + arc * 1.0, lz + cA * dd);
      _rigT.set(lx, pwy + CAMR.ty, lz);
      _cp.lerp(_rig, stBlend);
      _tgt.lerp(_rigT, stBlend);
    }
    _cp.x += S.mx * 0.30;
    _cp.y += -S.my * 0.22;
    camera.position.copy(_cp);
    camera.lookAt(_tgt);

    /* -------- THE SCREEN -------- */
    let forced = -1;
    /* each station brings up the capture it is talking about */
    if (seg >= 3 && seg < 4) forced = ST_SCREEN[clamp(Math.floor(raw4), 0, 4)];
    else if (seg >= 4 && seg < 5) forced = IDX['send-pin-sheet'];
    else if (seg >= 6.3) forced = IDX['home-greet'];
    const scr = updateScreenSequence(time, forced);

    /* -------- PHONE -------- */
    /* chapter 4 no longer sends the phone away: it is the hero of all five
       stations, so the screenshot arc is the only place the phone leaves */
    const finale = smooth(0.60, 0.88, c7);
    const phoneOut6 = smooth(0.05, 0.30, c6) * (1 - finale);
    const hide = phoneOut6;
    const vis = 1 - hide;
    phoneG.visible = vis > 0.02;
    if (phoneG.visible) {
      bodyMat.opacity = vis;
      frameMat.opacity = vis;
      islandMat.opacity = vis;
      screenMats[0].opacity = vis;
      screenMats[1].opacity = vis * scr.mix;
      glassMatOverlay.opacity = 0.06 * vis;
      waveMat.opacity = scr.listening * vis * 0.95;

      const flt = Math.sin(time * 0.34) * 0.030 + Math.sin(time * 0.19 + 1.1) * 0.010;
      /* mouse parallax tilt, +/- 6 degrees */
      const TILT = 0.1047;
      /* the finale lifts the phone clear of the sign-off and the links */
      let ppx = 0;
      let ppy = flt + hide * 2.6 + finale * 0.95 + (wide ? 0 : -0.4);
      let ppz = hide * -3.4 + (wide ? 0 : -1.6);
      let prx = S.my * TILT + Math.sin(time * 0.23) * 0.010;
      let pry = S.mx * TILT + Math.sin(time * 0.17) * 0.013 + c3 * 0.20;
      let prz = Math.sin(time * 0.13) * 0.007;
      let sc = lerp(1, 0.78, hide) * lerp(1, 0.94, smooth(0, 1, c2)) * lerp(1, 0.66, finale) * (wide ? 1 : 0.74);
      if (stBlend > 0.0005) {
        /* every station stands the phone somewhere slightly different */
        ppx = lerp(ppx, RIG.px, stBlend);
        ppy = lerp(ppy, ppy + RIG.py, stBlend);
        ppz = lerp(ppz, ppz + RIG.pz, stBlend);
        prx = lerp(prx, S.my * TILT * 0.55 + RIG.rx, stBlend);
        pry = lerp(pry, S.mx * TILT * 0.55 + RIG.ry, stBlend);
        prz = lerp(prz, RIG.rz, stBlend);
        sc  = lerp(sc, sc * RIG.s, stBlend);
      }
      phoneG.position.set(ppx, ppy, ppz);
      phoneG.rotation.set(prx, pry, prz);
      phoneG.scale.setScalar(sc);

      /* the reflection slides across as the phone tilts, plus a slow sweep */
      sheen.offset.x = (time * 0.055) % 1 - S.mx * 0.09;
      sheen.offset.y = -S.my * 0.05;
      if (scr.listening > 0) paintWave(wave, time);
    }

    /* -------- GROUND REFLECTION (ch 1, 5, 7) -------- */
    let reflW = 0;
    if (seg < 1.0)            reflW = 1 - smooth(0.52, 0.94, seg);
    else if (seg < 5.0)       reflW = smooth(3.98, 4.30, seg) * (1 - smooth(4.68, 4.96, seg));
    else if (seg >= 5.94)     reflW = smooth(5.98, 6.34, seg);
    reflW *= vis;
    reflG.visible = reflW > 0.01;
    if (reflG.visible) {
      reflBodyMat.opacity   = 0.085 * reflW;
      reflScreenMat.opacity = 0.130 * reflW;
      const domTex = screenMats[scr.mix > 0.5 ? 1 : 0].map;
      if (domTex && reflScreenMat.map !== domTex) {
        reflScreenMat.map = domTex;
        reflScreenMat.needsUpdate = true;
      }
    }

    /* -------- THE ATMOSPHERE SHADER -------- */
    /* the amber only ever warms the phone's own patch of screen */
    _glowV.set(0, 0, 0);
    phoneG.localToWorld(_glowV);
    _glowV.project(camera);
    bgUniforms.uGlow.value.set(
      clamp(_glowV.x * 0.5 + 0.5, -0.6, 1.6),
      clamp(-_glowV.y * 0.5 + 0.5, -0.6, 1.6)
    );
    /* strong where the product is the subject, weak where it is not */
    const GS = [1.00, 0.34, 0.52, 0.66, 0.95, 0.36, 1.00, 1.00];
    bgUniforms.uGlowStrength.value =
      lerp(GS[i], GS[i + 1], f) * (0.42 + 0.58 * vis) + finale * 0.55;
    bgUniforms.uScroll.value = p;
    bgUniforms.uTime.value = BG_FREEZE ? 6.0 : time;

    /* -------- BOKEH -------- */
    const halo = smooth(0.08, 0.62, c7);
    ray.setFromCamera(ndc, camera);
    ray.ray.intersectPlane(planeZ0, mouseWorld);
    const mwx = mouseWorld.x, mwy = mouseWorld.y;

    const bpos = bokeh.pos;
    for (let n = 0; n < BK_N; n++) {
      const o = n * 6;
      const ph = bk[o + 3], sp = bk[o + 4];
      const B = BANDS[bk[o + 5]];
      /* 0.02 - 0.06 units a second: slow enough that it never reads as motion */
      let x = bk[o + 0] + Math.sin(time * 0.050 * sp + ph) * 1.10;
      let y = bk[o + 1] + Math.cos(time * 0.043 * sp + ph * 1.4) * 0.82;
      let z = bk[o + 2] + Math.sin(time * 0.031 * sp + ph * 0.7) * 0.45;
      /* parallax: the cursor and the scroll, and the far band barely at all */
      x += S.mx * 1.55 * B.par;
      y += (-S.my * 1.05 - p * 2.30) * B.par;

      if (halo > 0.001) {
        const hr = 2.1 + (n / BK_N) * 2.5;
        const ha = ph * 2.3 + time * 0.05;
        x = lerp(x, Math.cos(ha) * hr, halo);
        y = lerp(y, -0.4 + Math.sin(ha) * hr * 0.82, halo);
        z = lerp(z, -3.6 + Math.sin(ph * 3.0) * 0.7, halo);
      }

      /* a very light cursor repulsion, and only on the band you can feel */
      let px = bkPush[n * 2], py = bkPush[n * 2 + 1];
      if (B.par > 0.4) {
        const dx = x - mwx, dy = y - mwy;
        const d2 = dx * dx + dy * dy;
        if (d2 < 5.2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (1 - d / 2.28) * 0.16;
          px += (dx / d) * force; py += (dy / d) * force;
        }
      }
      px *= 0.93; py *= 0.93;
      bkPush[n * 2] = px; bkPush[n * 2 + 1] = py;

      bpos[n * 3 + 0] = x + px;
      bpos[n * 3 + 1] = y + py;
      bpos[n * 3 + 2] = z;
    }
    bokeh.geo.attributes.position.needsUpdate = true;
    bokeh.mat.uniforms.uFade.value = 0.72 + 0.28 * smooth(0, 0.4, 1 - c4) + halo * 0.35;

    /* -------- LIGHT DUST, only where the phone is -------- */
    dust.pts.visible = vis > 0.05;
    if (dust.pts.visible) {
      dust.pts.position.copy(phoneG.position);
      dust.pts.scale.setScalar(phoneG.scale.x);   /* the dust keeps its 4-unit
                                                     reach as the phone scales */
      const pulse = 1 + screenState.listening * screenState.amp * 0.05;
      const dpos = dust.pos;
      for (let n = 0; n < DU_N; n++) {
        const o = n * 5;
        const ph = du[o + 3], sp = du[o + 4];
        dpos[n * 3 + 0] = (du[o + 0] + Math.sin(time * 0.085 * sp + ph) * 0.30) * pulse;
        dpos[n * 3 + 1] = (du[o + 1] + Math.cos(time * 0.071 * sp + ph * 1.6) * 0.24) * pulse;
        dpos[n * 3 + 2] = du[o + 2] + Math.sin(time * 0.052 * sp + ph * 0.6) * 0.22;
      }
      dust.geo.attributes.position.needsUpdate = true;
      dust.mat.uniforms.uFade.value = vis * (1 - halo * 0.7);
    }

    /* -------- WALL (ch2) -------- */
    const rise = smooth(0.02, 0.55, c2);
    const blow = smooth(0.68, 1.0, c2);
    wall.visible = rise > 0.003 && blow < 0.995;
    if (wall.visible) {
      for (let n = 0; n < WN; n++) {
        const cx = n % WCOL, cy = (n / WCOL) | 0;
        const stag = (cx * 0.11 + cy * 0.07);
        const r = easeOut(clamp((rise - stag) / (1 - stag || 1), 0, 1));
        const tx = (cx - (WCOL - 1) / 2) * 1.74;
        const ty = ((WROW - 1) / 2 - cy) * 3.14;
        const bo = easeOut(clamp((blow - stag * 0.4) / 0.7, 0, 1));
        dummy.position.set(
          tx + bo * tx * 2.4,
          lerp(-16, ty, r) + bo * (ty * 1.6 + 2),
          -7.2 + bo * 16
        );
        dummy.rotation.set(bo * 0.9 * (cy - 1.5), bo * 1.2 * (cx - 2), bo * 0.6);
        dummy.scale.setScalar(r * (1 - bo * 0.9));
        dummy.updateMatrix();
        wall.setMatrixAt(n, dummy.matrix);
      }
      wall.instanceMatrix.needsUpdate = true;
      wallMat.opacity = (GLASSY ? 1 : 0.34) * (1 - blow) * rise;
      wallMat.transmission = GLASSY ? 0.72 * (1 - blow) * rise : 0;
    }

    /* -------- 32 TILES (ch3) -------- */
    const tv = smooth(0.02, 0.34, c3) * (1 - smooth(0.80, 1.0, c3));
    tiles.visible = tileGlow.visible = tv > 0.01;
    if (tiles.visible) {
      for (let n = 0; n < TN; n++) {
        const ring = n < 16 ? 0 : 1;
        const idx = n % 16;
        const dir = ring === 0 ? 1 : -1;
        const a = (idx / 16) * Math.PI * 2 + time * 0.16 * dir + ring * 0.2;
        const rad = (ring === 0 ? 3.55 : 4.55) * lerp(1.9, 1.0, easeOut(tv));
        const y = (ring === 0 ? 0.95 : -0.95) + Math.sin(time * 0.7 + n) * 0.10;
        const zr = rad * 0.46;
        dummy.position.set(Math.cos(a) * rad, y, Math.sin(a) * zr - zr - 1.1);
        dummy.rotation.set(0, -a + Math.PI / 2, dir * 0.10);
        const hs = (n === hoverTile) ? 1.22 : 1.0;
        dummy.scale.setScalar(tv * hs);
        dummy.updateMatrix();
        tiles.setMatrixAt(n, dummy.matrix);
        tileGlow.setMatrixAt(n, dummy.matrix);
      }
      tiles.instanceMatrix.needsUpdate = true;
      tileGlow.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      tileMat.opacity = (GLASSY ? 1 : 0.38) * tv;
      tileMat.transmission = GLASSY ? 0.72 * tv : 0;
      glowMat.opacity = 0.30 * tv;
    }

    /* -------- STATIONS (ch4) -------- */
    const sv = smooth(0.012, 0.09, c4) * (1 - smooth(0.91, 0.995, c4));
    stationsG.visible = sv > 0.01;
    if (stationsG.visible) {
      const rt = BG_FREEZE ? 6.0 : time;
      const w1 = ST_W[0] * sv, w2 = ST_W[1] * sv, w3 = ST_W[2] * sv,
            w4 = ST_W[3] * sv, w5 = ST_W[4] * sv;

      /* ---- 1 · LISTEN ---- */
      /* the ripples are the one thing that keeps running after its station:
         station 5 brings them back at the mic, faintly */
      const rip = clamp(w1 + w5 * 0.42, 0, 1);
      rippleFront.visible = rippleBack.visible = rip > 0.012;
      if (rippleFront.visible) {
        rippleFrontMat.uniforms.uTime.value = rt;
        rippleBackMat.uniforms.uTime.value = rt;
        rippleFrontMat.uniforms.uFade.value = rip;
        rippleBackMat.uniforms.uFade.value = rip * 0.88;
      }
      s1.visible = w1 > 0.012;
      if (s1.visible) {
        const total = N_BARS * BARLAY.w + (N_BARS - 1) * BARLAY.gap;
        const x0 = -total / 2 + BARLAY.w / 2;
        for (let n = 0; n < N_BARS; n++) {
          /* a smooth pseudo-audio signal: three incommensurate sines so no
             two bars ever move together and none of it reads as a loop */
          const amp = BG_FREEZE ? 0.86 : 0.50 + 0.50 * Math.abs(
            Math.sin(rt * (2.10 + n * 0.23) + n * 0.80) * 0.62 +
            Math.sin(rt * (1.31 + n * 0.17) + n * 1.90) * 0.38);
          const h = Math.max(0.09, BAR_H[n % BAR_H.length] * amp) * easeOut(w1);
          const x = x0 + n * (BARLAY.w + BARLAY.gap);
          dummy.rotation.set(0, 0, 0);
          dummy.position.set(x, BARLAY.y + h / 2, BARLAY.z);
          dummy.scale.set(BARLAY.w, h, BARLAY.w * 0.90);
          dummy.updateMatrix();
          bars.setMatrixAt(n, dummy.matrix);
          dummy.position.set(x, BARLAY.y + h - 0.026, BARLAY.z);
          dummy.scale.set(BARLAY.w * 1.06, 0.072, BARLAY.w * 0.98);
          dummy.updateMatrix();
          barCaps.setMatrixAt(n, dummy.matrix);
        }
        bars.instanceMatrix.needsUpdate = true;
        barCaps.instanceMatrix.needsUpdate = true;
        barMat.opacity = w1;
        capMat.opacity = w1;
      }
      micLight.intensity = 19 * w1 + 6 * w5;

      /* ---- 2 · UNDERSTAND ---- */
      s2.visible = w2 > 0.012;
      if (s2.visible) {
        const e2 = easeOut(clamp(w2, 0, 1));
        chipMat.opacity = 0.44 * w2;
        for (let n = 0; n < CHIPS.length; n++) {
          const cp = CHIPS[n];
          const st = easeOut(clamp((e2 - n * 0.05) / 0.78, 0, 1));
          const drift = BG_FREEZE ? 0 : Math.sin(rt * 0.5 + n * 1.3) * 0.05;
          const y = lerp(cp.y - 3.0, cp.y, st) + drift;
          dummy.rotation.set(0, cp.ry, 0);
          dummy.position.set(cp.x, y, cp.z);
          dummy.scale.set(cp.cw * cp.s, CHIP_H * cp.s, 1);
          dummy.updateMatrix();
          chips.setMatrixAt(n, dummy.matrix);
          chipTextMeshes[n].position.set(cp.x, y, cp.z + 0.06);
          chipTextMats[n].opacity = st * w2;
        }
        chips.instanceMatrix.needsUpdate = true;
        for (let n = 0; n < slotMats.length; n++) {
          slotMats[n].opacity = easeOut(clamp((e2 - 0.20 - n * 0.10) / 0.60, 0, 1)) * w2;
        }
        const pulse = BG_FREEZE ? 0.72 : 0.50 + 0.42 * (0.5 + 0.5 * Math.sin(rt * 2.4));
        bankGlowMat.opacity = pulse * 0.34 * w2 * easeOut(clamp((e2 - 0.40) / 0.55, 0, 1));
        const tw = easeOut(clamp((e2 - 0.34) / 0.58, 0, 1)) * w2;
        threadMats[0].opacity = 0.62 * tw;
        threadMats[1].opacity = 0.46 * tw;
        threadMats[2].opacity = 0.72 * tw;
      }

      /* ---- 3 · ACT ---- */
      s3.visible = w3 > 0.012;
      if (s3.visible) {
        const u3 = BG_FREEZE ? 1 : clamp(raw4 - 2, 0, 1);
        const ride = clamp((u3 - 0.09) / 0.94, 0, 1);
        const cx = lerp(BEAM_X0 + 0.9, BEAM_X1 - 1.2, ride);
        const cz = lerp(BEAM_Z0 - 0.28, BEAM_Z1 + 0.20, ride) + 0.42;
        capsuleG.position.set(cx, BEAM_Y + 0.05, cz);
        capsuleG.scale.setScalar(lerp(0.86, 1.0, easeOut(w3)));
        capsuleShellMat.opacity = 0.66 * w3;
        capsuleCoreMat.opacity = w3;
        capsuleBadgeMat.opacity = w3;
        beamSoftMat.opacity = 0.55 * w3;
        beamCoreMat.opacity = w3;
        gridMat.opacity = 0.36 * w3;
        /* only the panel the capsule is passing lights up */
        let litX = -1, litN = -1;
        for (let n = 0; n < PANELS.length; n++) {
          const near = clamp(1 - Math.abs(cx - PANELS[n].x) / 1.90, 0, 1);
          const on = near * near * (2 - near * near);
          PANELS[n].dimM.opacity = 0.90 * w3 * (1 - on * 0.55);
          PANELS[n].litM.opacity = on * w3;
          if (on > 0.20 && on > litX) { litX = on; litN = n; }
        }
        if (litN >= 0) {
          panelFloorGlow.position.set(PANELS[litN].x - 0.2, -3.52, PANELS[litN].z + 0.5);
          panelFloorMat.opacity = litX * 0.55 * w3;
        } else {
          panelFloorMat.opacity = 0;
        }
      }

      /* ---- 4 · CARD AND REPLY ---- */
      s4.visible = w4 > 0.012;
      if (s4.visible) {
        const u4 = BG_FREEZE ? 1 : clamp(raw4 - 3, 0, 1);
        const land = easeOut(clamp((u4 - 0.06) / 0.80, 0, 1));
        const zEnd = FRONT_Z + 0.05, zStart = FRONT_Z + 0.55;
        const yEnd = -SCRH * 0.035, yStart = yEnd + 1.35;
        const z = lerp(zStart, zEnd, land);
        const y = lerp(yStart, yEnd, land);
        const s = lerp(1.22, 1.0, land);
        cardPlane.position.set(0, y, z);
        cardPlane.scale.set(CARD_W * s, CARD_H * s, 1);
        cardMat.opacity = Math.min(1, lerp(0.58, 1.14, land)) * w4;
        /* two or three fading copies of where it has just been */
        for (let n = 0; n < ghosts.length; n++) {
          const back = (n + 1) * 0.13;
          const gl = clamp(land - back, 0, 1);
          const gs = lerp(1.22, 1.0, gl);
          ghosts[n].position.set(0, lerp(yStart, yEnd, gl), lerp(zStart, zEnd, gl) - 0.004 * (n + 1));
          ghosts[n].scale.set(CARD_W * gs, CARD_H * gs, 1);
          ghostMats[n].opacity = Math.pow(1 - land, 0.45) * (0.55 - n * 0.17) * w4;
        }
        cardUnder.position.set(0, y - CARD_H * 0.52, z - 0.02);
        cardUnder.scale.set(CARD_W * 1.7, CARD_H * 1.5, 1);
        cardUnderMat.opacity = (0.48 + 0.62 * (1 - land)) * w4 * land;
      }

      /* ---- 5 · KEEPS LISTENING ---- */
      s5.visible = w5 > 0.012;
      if (s5.visible) {
        const u5 = BG_FREEZE ? 1 : clamp(raw4 - 4, 0, 1);
        const drawn = clamp((u5 - 0.04) / 0.66, 0, 1);
        const dq = easeOut(drawn);
        stroke.geometry.setDrawRange(0, Math.max(6, Math.round(STROKE_IDX * dq / 36) * 36));
        strokeCore.geometry.setDrawRange(0, Math.max(6, Math.round(STROKE_CORE_IDX * dq / 30) * 30));
        strokeMat.opacity = 0.46 * w5;
        strokeCoreMat.opacity = 0.90 * w5;
        /* one pulse running the finished part of the stroke */
        const pu = BG_FREEZE ? 0.72 : ((rt * 0.28) % 1);
        strokeCurve.getPointAt(clamp(pu * dq, 0, 0.9999), _sp);
        strokePulse.position.copy(_sp);
        strokePulse.scale.setScalar(lerp(0.6, 1.0, easeOut(w5)));
        strokePulseMat.opacity = w5 * dq;
      }
    }
    updateCh4Overlay(sv, time);

    /* -------- VAULT (ch5) -------- */
    const vv = smooth(0.06, 0.52, c5) * (1 - smooth(0.86, 1.0, c5));
    vaultG.visible = vv > 0.01;
    if (vaultG.visible) {
      const close = easeOut(smooth(0.06, 0.62, c5));
      vaultG.position.set(0, 0, 0);
      vaultG.scale.setScalar(lerp(2.3, 1.0, close));
      vaultG.rotation.x = lerp(0.95, 0.16, close) + Math.sin(time * 0.25) * 0.03;
      vaultG.rotation.y = lerp(-0.8, 0, close) + time * 0.09;
      vaultA.material.opacity = 0.62 * vv;
      vaultB.material.opacity = 0.46 * vv;
      vaultGlow.material.opacity = (0.62 + 0.28 * Math.sin(time * 1.6)) * vv;
    }

    /* -------- SCREENSHOT ARC (ch6) -------- */
    const shv = smooth(0.03, 0.30, c6) * (1 - smooth(0.88, 1.0, c6));
    shotsG.visible = shv > 0.01;
    if (shotsG.visible) {
      const straight = easeOut(smooth(0.12, 0.55, c6));
      backMat.opacity = shv * 0.85;
      for (let n = 0; n < shotMeshes.length; n++) {
        const t01 = (n - 4) / 4;                       /* -1 .. 1 */
        const arcA = t01 * 0.60;
        const R = 9.6;
        const ax = Math.sin(arcA) * R;
        const az = -R + Math.cos(arcA) * R;
        const fx = t01 * 7.6;
        const m = shotMeshes[n];
        m.position.set(
          lerp(ax, fx, straight),
          Math.sin(time * 0.5 + n * 0.7) * 0.08 + lerp(0.35, -0.55, straight),
          lerp(az, 0, straight) - 1.2
        );
        m.rotation.y = lerp(-arcA, 0, straight);
        m.rotation.z = lerp(t01 * 0.08, 0, straight);
        m.material.opacity = shv * clamp(1 - Math.abs(t01) * 0.10, 0, 1);
        const s = lerp(0.86, 1.0, straight);
        m.scale.set(SGW * s, SGH * s, 1);
      }
    }
  }

  /* ---------------- HOVER ON THE RING TILES ---------------- */
  let hoverAcc = 0;
  function updateHover(dt) {
    hoverAcc += dt;
    if (hoverAcc < 0.09) return;
    hoverAcc = 0;
    if (!tiles.visible) {
      if (hoverTile !== -1) { setTileHover(-1); document.body.style.cursor = ''; }
      return;
    }
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(tiles, false);
    const id = hit.length ? hit[0].instanceId : -1;
    if (id !== hoverTile) setTileHover(id);
  }
  function setTileHover(id) {
    if (hoverTile >= 0) tiles.setColorAt(hoverTile, tileCol.setHex(0xffffff));
    hoverTile = id;
    if (id >= 0) tiles.setColorAt(id, tileCol.setHex(0xffe0b0));
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    document.body.style.cursor = id >= 0 ? 'pointer' : '';
  }

  /* ---------------- RENDER LOOP ---------------- */
  let last = performance.now();
  const DEBUG = Q.get('debug') === '1';
  let frames = 0, fpsT = performance.now();

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;

    const time = FROZEN ? HERO_T : (now / 1000);

    if (FROZEN) {
      S.p = S.pT; S.mx = 0; S.my = 0;
    } else {
      /* frame-rate independent damping, ~80 ms time constant:
         the scene is inside 5% of the scroll position within 250 ms */
      const kp = 1 - Math.exp(-dt * 12.0);
      const km = 1 - Math.exp(-dt * 5.0);
      S.p += (S.pT - S.p) * kp;
      S.mx += (S.mxT - S.mx) * km;
      S.my += (S.myT - S.my) * km;
    }

    overlays(S.p);
    updateScene(S.p, time, FROZEN ? 0 : dt);
    if (!FROZEN) updateHover(dt);
    renderer.info.reset();
    renderer.clear();
    renderer.render(bgScene, bgCam);      /* the atmosphere, depth test off */
    renderer.render(scene, camera);       /* then the world on top of it */

    if (DEBUG) {
      frames++;
      if (now - fpsT > 500) {
        const el = $('#errlog');
        const inf = renderer.info;
        if (el) el.textContent =
          'mode ' + window.__mode + '  dpr ' + renderer.getPixelRatio() + '  vw ' + window.innerWidth + 'x' + window.innerHeight +
          '\ndraw calls ' + inf.render.calls + '   triangles ' + inf.render.triangles +
          '\ngeometries ' + inf.memory.geometries + '   textures ' + inf.memory.textures +
          '\nfps ' + Math.round(frames / ((now - fpsT) / 1000)) +
          '   p ' + S.p.toFixed(3) + '   scrollY ' + Math.round(window.scrollY) +
          '\nerrors: ' + ((window.__errors || []).length ? window.__errors.join(' | ') : 'none');
        frames = 0; fpsT = now;
      }
    }
  }

  /* ---------------- START ---------------- */
  let started = false;
  function start() {
    if (started) return;
    started = true;
    setProgress(1);
    if (loaderEl) {
      loaderEl.classList.add('gone');
      setTimeout(() => { if (loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl); }, 700);
    }
    if (!prefersReduce && !FROZEN && Q.get('intro') !== '0' && !root.classList.contains('static')) {
      setTimeout(() => gsap.set('#h1 span', { clearProps: 'all' }), 2200);
      gsap.from('#h1 span', { yPercent: 108, opacity: 0, duration: 0.9, stagger: 0.06, ease: 'power3.out', delay: 0.05, clearProps: 'transform,opacity' });
    }
    ScrollTrigger.refresh();
    if (qChapter !== null) {
      const n = clamp(parseInt(qChapter, 10) || 1, 1, CH);
      const at = Q.get('at') !== null ? clamp(parseFloat(Q.get('at')), 0, 1) : 0.5;
      S.pT = S.p = (n - 1 + at) / CH;
      pinChapter(n);
    } else if (FROZEN) {
      S.pT = S.p = 0;
    }
    last = performance.now();
    if (running) requestAnimationFrame(frame);
    window.__ready = true;
    window.__mode = root.classList.contains('static') ? 'static' : (LITE ? '3d-lite' : '3d-full');
  }

  function startWhenFontsSettle() {
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(start);
  }
  manager.onLoad = startWhenFontsSettle;
  /* a missing or broken image must never hold the loader up */
  manager.onError = () => { setProgress(1); setTimeout(startWhenFontsSettle, 120); };
  setTimeout(() => { if (!started) start(); }, 4000);

  /* expose for the screenshot harness */
  window.__payo = { S, camera, scene, renderer, gotoChapter, chapterScroll, renderer_info: () => renderer.info };
}
