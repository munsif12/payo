/* PAYO landing page motion.
   GSAP 3.13 core + ScrollTrigger (CDN, pinned). Transform/opacity only.
   Harness: ?t=N freezes the page-load timeline, ?mock=N freezes the phone loop. */
(function () {
  'use strict';

  var root = document.documentElement;
  var q = new URLSearchParams(location.search);

  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.add('no-motion');
    window.__ready = true;
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var reduce =
    q.get('reduce') === '1' ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var EASE = 'power3.out'; /* visual twin of cubic-bezier(.2,0,0,1) */
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------- text splitting ---------------- */

  function splitInto(el, parts) {
    el.textContent = '';
    var out = [];
    parts.forEach(function (p, i) {
      var s = document.createElement('span');
      s.textContent = p + (i < parts.length - 1 ? ' ' : '');
      el.appendChild(s);
      out.push(s);
    });
    return out;
  }

  function splitChars(el, text) {
    el.textContent = '';
    var out = [];
    text.split('').forEach(function (ch) {
      var s = document.createElement('span');
      s.textContent = ch;
      el.appendChild(s);
      out.push(s);
    });
    return out;
  }

  function splitWords(el, text) {
    return splitInto(el, text.split(' '));
  }

  /* hero headline: word-by-word rise */
  var heroWords = [];
  var heroH = $('#hero-h');
  if (heroH) heroWords = splitWords(heroH, heroH.textContent.trim());

  /* mock text nodes */
  $$('[data-type]').forEach(function (el) { el.__spans = splitChars(el, el.getAttribute('data-type')); });
  $$('[data-type-words]').forEach(function (el) { el.__spans = splitWords(el, el.getAttribute('data-type-words')); });
  $$('[data-words]').forEach(function (el) { el.__spans = splitWords(el, el.getAttribute('data-words')); });

  /* ---------------- the phone mock ---------------- */

  var screen = $('#screen');
  var mockTl = null;

  function buildMock() {
    if (!screen) return null;

    /* the ambient loops are CSS keyframes on transform only; GSAP fades them in and out */
    $$('.wave, .swave', screen).forEach(function (w) { w.classList.add('wavego'); });
    $$('.b.think', screen).forEach(function (t) { t.classList.add('thinkgo'); });
    var micbox = $('.micbox', screen);
    if (micbox) micbox.classList.add('ringgo');

    var lwave = $('.lwave', screen);
    var rings = $$('.ring', screen);
    var statuses = $$('.status', screen);
    var langs = $$('.lang', screen);
    var pinEn = $('.pin-en', screen);
    var pinUr = $('.pin-ur', screen);

    /* initial state, before the loop ever runs: nothing showing but the dock */
    gsap.set($$('.conv, .pin, .b, .card-c, .card-r, .say, .ring, .lwave', screen), { autoAlpha: 0 });
    gsap.set($$('.pin', screen), { yPercent: 100 });
    gsap.set($$('.pd i', screen), { scale: 0 });
    gsap.set($$('.status, .lang, .caret', screen), { autoAlpha: 0 });
    gsap.set($$('.type span, .sline span', screen), { autoAlpha: 0 });

    var tl = gsap.timeline({ repeat: -1, paused: true });

    function turn(convSel, pinEl, langEl, st) {
      var conv = $(convSel, screen);
      var hello = $('.hello', conv);
      var said = $('.said', conv);
      var typed = $('.type', conv).__spans;
      var caret = $('.caret', conv);
      var think = $('.think', conv);
      var card = $('.card-c', conv);
      var receipt = $('.card-r', conv);
      var say = $('.say', conv);
      var swave = $('.swave', conv);
      var words = $('.sline', conv).__spans;
      var dots = $$('.pd i', pinEl);
      var b = tl.duration(); /* block start */

      /* reset: everything for this turn hidden, the thread itself shown */
      tl.set(conv, { autoAlpha: 1 }, b)
        .set([hello, said, think, card, receipt, say], { autoAlpha: 0, y: 10 }, b)
        .set(typed.concat(words), { autoAlpha: 0 }, b)
        .set(caret, { autoAlpha: 0 }, b)
        .set(dots, { scale: 0 }, b)
        .set(pinEl, { autoAlpha: 1, yPercent: 100 }, b)
        .set(statuses, { autoAlpha: 0 }, b)
        .set(langs, { autoAlpha: 0 }, b);

      /* a. listening: mic rings + waveform */
      tl.to(langEl, { autoAlpha: 1, duration: 0.25 }, b)
        .to(st.listen, { autoAlpha: 1, duration: 0.25 }, b)
        .to([lwave].concat(rings), { autoAlpha: 1, duration: 0.3 }, b)
        .to(hello, { autoAlpha: 1, y: 0, duration: 0.3, ease: EASE }, b + 0.1);

      /* b. the line types in */
      tl.to(said, { autoAlpha: 1, y: 0, duration: 0.28, ease: EASE }, b + 0.85)
        .to(caret, { autoAlpha: 1, duration: 0.1 }, b + 0.9)
        .to(typed, { autoAlpha: 1, duration: 0.01, stagger: 0.032 }, b + 1.0);

      var typeEnd = b + 1.0 + typed.length * 0.032 + 0.1;

      /* c. thinking */
      tl.to([caret, lwave].concat(rings), { autoAlpha: 0, duration: 0.22 }, typeEnd)
        .to(st.listen, { autoAlpha: 0, duration: 0.2 }, typeEnd)
        .to(st.think, { autoAlpha: 1, duration: 0.2 }, typeEnd + 0.05)
        .to(think, { autoAlpha: 1, y: 0, duration: 0.26, ease: EASE }, typeEnd + 0.1);

      var c0 = typeEnd + 1.05;

      /* d. confirmation card slides up over the thinking bubble */
      tl.to(think, { autoAlpha: 0, duration: 0.2 }, c0)
        .to(st.think, { autoAlpha: 0, duration: 0.2 }, c0)
        .to(st.pin, { autoAlpha: 1, duration: 0.22 }, c0 + 0.1)
        .fromTo(card, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: EASE }, c0 + 0.05);

      var p0 = c0 + 0.85;

      /* e. PIN sheet rises, four dots fill */
      tl.to(pinEl, { yPercent: 0, duration: 0.32, ease: EASE }, p0)
        .to(dots, { scale: 1, duration: 0.22, ease: 'back.out(2)', stagger: 0.24 }, p0 + 0.42)
        .to(pinEl, { yPercent: 100, duration: 0.3, ease: 'power2.in' }, p0 + 1.75);

      var r0 = p0 + 2.0;

      /* f. receipt */
      tl.fromTo(receipt, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: EASE }, r0)
        .to(st.pin, { autoAlpha: 0, duration: 0.2 }, r0 + 0.25)
        .to(st.speak, { autoAlpha: 1, duration: 0.22 }, r0 + 0.35);

      var s0 = r0 + 0.5;

      /* g. spoken reply, word by word, under a small waveform */
      tl.to(say, { autoAlpha: 1, y: 0, duration: 0.26, ease: EASE }, s0)
        .to(words, { autoAlpha: 1, y: 0, duration: 0.28, ease: EASE, stagger: 0.07 }, s0 + 0.1);

      var e0 = s0 + 0.4 + words.length * 0.07 + 0.5;

      /* back to listening, then hand over to the next language */
      tl.to(st.speak, { autoAlpha: 0, duration: 0.2 }, e0)
        .to(st.listen, { autoAlpha: 1, duration: 0.22 }, e0 + 0.05)
        .to([lwave].concat(rings), { autoAlpha: 1, duration: 0.3 }, e0 + 0.05)
        .to(conv, { autoAlpha: 0, duration: 0.45 }, e0 + 1.25)
        .to(langEl, { autoAlpha: 0, duration: 0.3 }, e0 + 1.25)
        .to({ v: 0 }, { v: 1, duration: 0.4, ease: 'none' }, e0 + 1.7);
    }

    turn('.conv-en', pinEn, $('.lang-en', screen), {
      listen: $('.st-listen', screen),
      think: $('.st-think', screen),
      pin: $('.st-pin', screen),
      speak: $('.st-speak', screen)
    });

    turn('.conv-ur', pinUr, $('.lang-ur', screen), {
      listen: $('.st-listen-ur', screen),
      think: $('.st-think-ur', screen),
      pin: $('.st-pin-ur', screen),
      speak: $('.st-speak-ur', screen)
    });

    return tl;
  }

  function staticMock() {
    if (!screen) return;
    gsap.set($$('.conv-ur, .pin, .ring, .lwave, .b.think, .lang-ur', screen), { autoAlpha: 0 });
    gsap.set($$('.conv-en, .conv-en > *, .conv-en .say, .lang-en, .st-listen', screen), { autoAlpha: 1, y: 0 });
    gsap.set($$('.conv-en .type span, .conv-en .sline span, .conv-en .swave', screen), { autoAlpha: 1, y: 0 });
    gsap.set($$('.conv-en .caret', screen), { autoAlpha: 0 });
    gsap.set($$('.st-think, .st-pin, .st-speak, .st-listen-ur, .st-think-ur, .st-pin-ur, .st-speak-ur', screen), { autoAlpha: 0 });
  }

  /* pause / play control (WCAG 2.2.2 for looping motion) */
  var toggle = document.getElementById('mockToggle');
  function wireToggle() {
    if (!toggle) return;
    if (!mockTl) { toggle.hidden = true; return; }
    toggle.addEventListener('click', function () {
      var paused = mockTl.paused();
      if (paused) {
        mockTl.play();
        screen.classList.remove('frozen');
        toggle.textContent = 'Pause the demo';
        toggle.setAttribute('aria-label', 'Pause the looping demo');
      } else {
        mockTl.pause();
        screen.classList.add('frozen');
        toggle.textContent = 'Play the demo';
        toggle.setAttribute('aria-label', 'Play the looping demo');
      }
    });
  }

  /* ---------------- page-load choreography ---------------- */

  var load = gsap.timeline({ defaults: { ease: EASE } });

  if (reduce) {
    root.classList.add('no-motion');
    gsap.set('[data-hero], [data-reveal], [data-reveal-item]', { clearProps: 'opacity' });
    gsap.set(heroWords, { clearProps: 'all' });
    staticMock();
    if (toggle) toggle.hidden = true;
  } else {
    mockTl = buildMock();
    wireToggle();

    load.fromTo('[data-hero="1"]', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45 })
      .set('[data-hero="2"]', { autoAlpha: 1 }, 0.1)
      .fromTo(heroWords, { autoAlpha: 0, yPercent: 42 }, { autoAlpha: 1, yPercent: 0, duration: 0.62, stagger: 0.06 }, 0.12)
      .fromTo('[data-hero="3"]', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.42)
      .fromTo('[data-hero="4"]', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.52)
      .fromTo('[data-hero="5"]', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.6)
      .fromTo('[data-hero="6"]', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.68)
      .fromTo('[data-hero="7"]', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.34);

    if (mockTl && q.get('mock') === null) {
      gsap.delayedCall(1.0, function () { mockTl.play(0); });
    }
  }

  /* ---------------- scroll reveals ---------------- */

  if (!reduce) {
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: function (els) {
        gsap.fromTo(els, { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE, stagger: 0.06, overwrite: true });
      }
    });

    $$('[data-reveal-group]').forEach(function (group) {
      var items = $$('[data-reveal-item]', group);
      if (!items.length) return;
      ScrollTrigger.create({
        trigger: group,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.fromTo(items, { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE, stagger: 0.06, overwrite: true });
        }
      });
    });

    /* the connector line draws as the flow scrolls through */
    var flow = $('.flow');
    var fline = $('.flowline line');
    if (flow && fline) {
      gsap.to(fline, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: { trigger: flow, start: 'top 80%', end: 'bottom 70%', scrub: 0.6 }
      });
    }
  }

  /* ---------------- count-up on the numbers ---------------- */

  $$('.num[data-count]').forEach(function (el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (reduce || isNaN(target)) return;
    var box = { v: 0 };
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: function () {
        gsap.to(box, {
          v: target,
          duration: 1.1,
          ease: 'power2.out',
          onUpdate: function () { el.textContent = Math.round(box.v); },
          onComplete: function () { el.textContent = target; }
        });
      }
    });
  });

  /* ---------------- nav highlights the active section ---------------- */

  $$('.navlinks a').forEach(function (link) {
    var id = link.getAttribute('href');
    if (!id || id.charAt(0) !== '#') return;
    var sec = document.querySelector(id);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: function (self) { link.classList.toggle('on', self.isActive); }
    });
  });

  /* ---------------- screenshot harness ---------------- */

  var t = q.get('t');
  if (t !== null) { load.pause(); load.seek(parseFloat(t), false); }

  var m = q.get('mock');
  if (m !== null && mockTl) {
    mockTl.pause();
    mockTl.seek(parseFloat(m), false);
    if (toggle) { toggle.textContent = 'Play the demo'; }
  }

  if (q.get('debug') === '1') {
    console.log('load duration', load.duration(), 'mock duration', mockTl ? mockTl.duration() : 0);
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  window.__mock = mockTl;
  window.__ready = true;
})();
