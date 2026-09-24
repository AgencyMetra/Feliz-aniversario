/* =====================================================================
   main.js — recursos compartilhados por TODAS as páginas
   (menu, partículas, música, coração flutuante, segredo, abertura,
   contagem do tempo juntos, transições entre páginas).

   Este arquivo é carregado ANTES dos scripts específicos de cada página.
   ===================================================================== */

// ==============================
// PERSONALIZAÇÃO
// ==============================

// Nome dela. Enquanto estiver "NOME DELA", o site usa palavras carinhosas no lugar.
const girlfriendName = "NOME DELA";

// Data em que vocês começaram. Formato: "ANO-MÊS-DIA" (ex.: "2024-05-10")
// ou com hora, para ficar ainda mais exato (ex.: "2024-05-10 20:30").
const relationshipStart = "202X-XX-XX";

// Mensagem principal. Aparece na abertura e no título da página inicial.
// Dica: a vírgula quebra a linha, e a última palavra ganha o brilho.
const birthdayMessage = "Feliz aniversário, meu amor.";

// Mensagem da tela secreta (5 cliques no coração ♡ do logo, no topo da página).
const secretMessage = "Eu escolheria você em todas as vidas.";

// Música de fundo (opcional). Coloque o arquivo em assets/ com este nome.
// Se o arquivo não existir, o site continua funcionando normalmente.
const backgroundMusic = "assets/musica.mp3";

// Frases que aparecem quando ela toca no coração flutuante. Edite à vontade.
const loveMessages = [
  "Eu te amo.",
  "Você é especial.",
  "Meu lugar favorito é perto de você.",
  "♡",
  "Você deixa tudo mais bonito.",
  "Você é a melhor parte dos meus dias.",
  "Que sorte a minha ter você."
];

// ==============================
// FIM DA PERSONALIZAÇÃO
// ==============================

const Encanto = (function () {
  'use strict';

  const root = document.documentElement;
  const TAU = Math.PI * 2;

  /* -------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------- */
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  const COLORS = {
    neon: '#A855F7', magenta: '#E83E8C', rose: '#F7A8D5',
    violet: '#6D19A8', roseDark: '#B51B63', ivory: '#FFF4FB'
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function debounce(fn, ms) {
    let id = 0;
    return function () {
      const args = arguments;
      clearTimeout(id);
      id = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  // sessionStorage pode falhar em alguns navegadores quando o arquivo é aberto direto
  const store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* ignora */ } }
  };

  const hasName = typeof girlfriendName === 'string' &&
    girlfriendName.trim() !== '' && girlfriendName.trim().toUpperCase() !== 'NOME DELA';
  const name = hasName ? girlfriendName.trim() : null;

  function rgba(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* Coração paramétrico (curva clássica). Largura ≈ 32, altura ≈ 29. */
  const HEART = new Path2D();
  (function buildHeart() {
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * TAU;
      const p = heartPoint(t);
      if (i === 0) HEART.moveTo(p.x, p.y); else HEART.lineTo(p.x, p.y);
    }
    HEART.closePath();
  })();

  function heartPoint(t) {
    return {
      x: 16 * Math.pow(Math.sin(t), 3),
      y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    };
  }

  /* Preenche um coração centrado em (x, y) com largura "size" (px). */
  function fillHeart(ctx, x, y, size, rot) {
    const s = size / 32;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.translate(0, -2.5);
    ctx.fill(HEART);
    ctx.restore();
  }

  /* Pequeno brilho pré-renderizado (muito mais barato que shadowBlur). */
  const glowCache = {};
  function glowSprite(color, size) {
    size = size || 64;
    const key = color + '|' + size;
    if (glowCache[key]) return glowCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const r = size / 2;
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, rgba(color, 1));
    grd.addColorStop(.25, rgba(color, .55));
    grd.addColorStop(.6, rgba(color, .14));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    glowCache[key] = c;
    return c;
  }

  function drawStar4(ctx, x, y, r, rot) {
    const q = r * .28;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(q, -q); ctx.lineTo(r, 0); ctx.lineTo(q, q);
    ctx.lineTo(0, r); ctx.lineTo(-q, q); ctx.lineTo(-r, 0); ctx.lineTo(-q, -q);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* -------------------------------------------------------------------
     Sistema de partículas leve (só anima enquanto houver partículas)
     ------------------------------------------------------------------- */
  class ParticleLayer {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.parts = [];
      this.running = false;
      this.last = 0;
      this.max = (opts && opts.max) || 360;
      this.loop = this.loop.bind(this);
      this.resize();
      window.addEventListener('resize', debounce(this.resize.bind(this), 150));
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    /* Emite "count" partículas a partir de (x, y). */
    emit(x, y, count, o) {
      o = o || {};
      const sp = o.speed || [30, 120];
      const sz = o.size || [2, 5];
      const lf = o.life || [.9, 1.7];
      const colors = o.colors || [COLORS.neon, COLORS.magenta, COLORS.rose];
      const a0 = o.angle != null ? o.angle : 0;
      const spread = o.spread != null ? o.spread : TAU;
      const n = reduceMotion ? Math.ceil(count * .35) : count;
      for (let i = 0; i < n; i++) {
        const ang = a0 + (Math.random() - .5) * spread;
        const s = rand(sp[0], sp[1]);
        this.parts.push({
          x: x, y: y,
          vx: Math.cos(ang) * s, vy: Math.sin(ang) * s,
          g: o.gravity || 0,
          drag: o.drag != null ? o.drag : .8,
          size: rand(sz[0], sz[1]),
          age: 0, life: rand(lf[0], lf[1]),
          color: pick(colors),
          type: Array.isArray(o.type) ? pick(o.type) : (o.type || 'spark'),
          rot: rand(0, TAU), vr: rand(-2, 2)
        });
      }
      this.trim();
      this.start();
    }

    /* Explosão em formato de coração: as partículas saem seguindo o contorno. */
    emitHeart(x, y, size, count, o) {
      o = o || {};
      const colors = o.colors || [COLORS.magenta, COLORS.rose, COLORS.neon, COLORS.ivory];
      const n = reduceMotion ? Math.ceil(count * .4) : count;
      const k = (size / 32) * (o.speed || 1.6);
      for (let i = 0; i < n; i++) {
        const hp = heartPoint((i / n) * TAU);
        const j = rand(.94, 1.04);
        this.parts.push({
          x: x, y: y,
          vx: hp.x * k * j, vy: (hp.y - 2.5) * k * j,
          g: o.gravity || 6,
          drag: o.drag != null ? o.drag : 1.1,
          size: rand(o.minSize || 2, o.maxSize || 4.2),
          age: 0, life: rand(o.minLife || 2.2, o.maxLife || 3.4),
          color: pick(colors),
          type: Array.isArray(o.type) ? pick(o.type) : (o.type || 'spark'),
          rot: rand(0, TAU), vr: rand(-1, 1)
        });
      }
      this.trim();
      this.start();
    }

    trim() {
      if (this.parts.length > this.max) this.parts.splice(0, this.parts.length - this.max);
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.loop);
    }

    clear() {
      this.parts.length = 0;
      this.ctx.clearRect(0, 0, this.w, this.h);
    }

    loop(t) {
      const dt = Math.min(.05, Math.max(.001, (t - this.last) / 1000));
      this.last = t;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      const arr = this.parts;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.age += dt;
        if (p.age >= p.life) { arr.splice(i, 1); continue; }
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k;
        p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const life = p.age / p.life;
        const a = life < .12 ? life / .12 : 1 - (life - .12) / .88;
        ctx.globalAlpha = Math.max(0, a);
        if (p.type === 'spark') {
          ctx.globalCompositeOperation = 'lighter';
          const s = p.size * 4;
          ctx.drawImage(glowSprite(p.color, 32), p.x - s / 2, p.y - s / 2, s, s);
        } else if (p.type === 'star') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = p.color;
          drawStar4(ctx, p.x, p.y, p.size * 2.2, p.rot * .3);
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = p.color;
          fillHeart(ctx, p.x, p.y, p.size * 3.2, p.rot * .25);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (arr.length) {
        requestAnimationFrame(this.loop);
      } else {
        this.running = false;
        ctx.clearRect(0, 0, this.w, this.h);
      }
    }
  }

  /* -------------------------------------------------------------------
     Campo de estrelas / névoa / corações discretos (fundo de página e
     de seções). Só anima enquanto estiver ativo (start/stop).
     ------------------------------------------------------------------- */
  function createField(canvas, opts) {
    const o = Object.assign({ density: 24000, min: 24, max: 90, hearts: 4 }, opts || {});
    const ctx = canvas.getContext('2d');
    let w = 1, h = 1, dpr = 1, items = [], running = false, raf = 0, last = 0, time = 0;

    function build() {
      items = [];
      const n = clamp(Math.round((w * h) / o.density), o.min, o.max);
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        if (r < .58) {
          items.push({ k: 0, x: rand(0, w), y: rand(0, h), r: rand(.4, 1.5), a: rand(.35, .95), tw: rand(.6, 2.2), ph: rand(0, TAU), c: Math.random() < .25 ? COLORS.rose : COLORS.ivory });
        } else {
          items.push({ k: 1, x: rand(0, w), y: rand(0, h), s: rand(14, 44), a: rand(.1, .3), vx: rand(-6, 6), vy: rand(-14, -3), c: pick([COLORS.neon, COLORS.magenta, COLORS.rose, COLORS.violet]) });
        }
      }
      for (let i = 0; i < o.hearts; i++) {
        items.push({ k: 2, x: rand(0, w), x0: 0, y: rand(0, h), s: rand(9, 17), a: rand(.08, .17), vy: rand(-16, -7), sw: rand(8, 26), ph: rand(0, TAU), c: pick([COLORS.magenta, COLORS.rose]) });
        items[items.length - 1].x0 = items[items.length - 1].x;
      }
    }

    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.k === 0) {
          ctx.globalAlpha = it.a * (.55 + .45 * Math.sin(time * it.tw + it.ph));
          ctx.fillStyle = it.c;
          ctx.beginPath();
          ctx.arc(it.x, it.y, it.r, 0, TAU);
          ctx.fill();
          if (it.r > 1.15) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(glowSprite(COLORS.neon, 32), it.x - 8, it.y - 8, 16, 16);
            ctx.globalCompositeOperation = 'source-over';
          }
        } else if (it.k === 1) {
          it.x += it.vx * dt; it.y += it.vy * dt;
          if (it.y < -it.s) { it.y = h + it.s; it.x = rand(0, w); }
          if (it.x < -it.s) it.x = w + it.s; else if (it.x > w + it.s) it.x = -it.s;
          ctx.globalAlpha = it.a;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowSprite(it.c, 64), it.x - it.s, it.y - it.s, it.s * 2, it.s * 2);
          ctx.globalCompositeOperation = 'source-over';
        } else {
          it.y += it.vy * dt;
          if (it.y < -20) { it.y = h + 20; it.x0 = rand(0, w); }
          it.x = it.x0 + Math.sin(time * .6 + it.ph) * it.sw;
          ctx.globalAlpha = it.a;
          ctx.fillStyle = it.c;
          fillHeart(ctx, it.x, it.y, it.s, Math.sin(time * .5 + it.ph) * .25);
        }
      }
      ctx.globalAlpha = 1;
    }

    function step(t) {
      const dt = Math.min(.05, Math.max(.001, (t - last) / 1000));
      last = t; time += dt;
      draw(dt);
      raf = requestAnimationFrame(step);
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      // Ignora pequenas mudanças de altura (barra de endereço do celular)
      if (items.length && Math.abs(r.width - w) < 2 && Math.abs(r.height - h) < 140) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (!running) draw(0);
    }

    function start() {
      resize();
      if (reduceMotion) { draw(0); return; }
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    window.addEventListener('resize', debounce(resize, 200));
    resize();
    return { start: start, stop: stop, resize: resize };
  }

  /* -------------------------------------------------------------------
     Texto: dividir em letras, digitar, montar palavras
     ------------------------------------------------------------------- */
  function cleanText(el) {
    return el.textContent.trim().split('\n').map(function (s) { return s.trim(); }).join('\n');
  }

  /* Divide o texto em <span class="word"><span class="char">…</span></span>. */
  function splitText(el, startIndex) {
    const text = cleanText(el);
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text.replace(/\s+/g, ' ');
    el.appendChild(sr);
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    el.appendChild(vis);
    let i = startIndex || 0;
    const chars = [];
    text.split(/(\s+)/).forEach(function (tok) {
      if (tok === '') return;
      if (/^\s+$/.test(tok)) {
        vis.appendChild(tok.indexOf('\n') > -1 ? document.createElement('br') : document.createTextNode(' '));
        return;
      }
      const w = document.createElement('span');
      w.className = 'word';
      Array.from(tok).forEach(function (ch) {
        const s = document.createElement('span');
        s.className = 'char';
        s.textContent = ch;
        s.style.setProperty('--i', i);
        i++;
        w.appendChild(s);
        chars.push(s);
      });
      vis.appendChild(w);
    });
    return { next: i, chars: chars };
  }

  /* Escreve o texto letra por letra (efeito máquina de escrever). */
  function typeMessage(el, text, speed, startDelay, done) {
    if (reduceMotion) { el.textContent = text; if (done) done(); return; }
    el.textContent = '';
    let i = 0;
    function tick() {
      i++;
      el.textContent = text.slice(0, i);
      if (i < text.length) {
        const ch = text.charAt(i - 1);
        setTimeout(tick, speed + (/[.,!?]/.test(ch) ? 260 : 0));
      } else if (done) { done(); }
    }
    setTimeout(tick, startDelay || 0);
  }

  /* Monta "Feliz aniversário," / "meu amor." em linhas; a última palavra brilha. */
  function renderMessage(el, message) {
    const parts = message.split(/,\s*/);
    el.textContent = '';
    parts.forEach(function (part, idx) {
      const line = document.createElement('span');
      line.className = 'line';
      const text = idx < parts.length - 1 ? part + ',' : part;
      if (idx === parts.length - 1) {
        const m = text.match(/^(.*?)(\S+)$/);
        if (m) {
          line.appendChild(document.createTextNode(m[1]));
          const g = document.createElement('em');
          g.className = 'glow-word';
          g.textContent = m[2];
          line.appendChild(g);
        } else { line.textContent = text; }
      } else { line.textContent = text; }
      el.appendChild(line);
    });
    el.setAttribute('aria-label', message);
  }

  /* Cria palavras <span class="w"> para a abertura (revelação palavra por palavra). */
  function buildWords(el, text, glowLast) {
    el.textContent = '';
    const words = text.split(/\s+/).filter(Boolean);
    words.forEach(function (word, i) {
      const w = document.createElement('span');
      w.className = 'w';
      w.style.setProperty('--i', i);
      if (glowLast && i === words.length - 1) {
        const g = document.createElement('em');
        g.className = 'glow-word';
        g.textContent = word;
        w.appendChild(g);
      } else { w.textContent = word; }
      el.appendChild(w);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.setAttribute('aria-label', text);
  }

  /* -------------------------------------------------------------------
     Toast e corações flutuantes
     ------------------------------------------------------------------- */
  let toastEl = null, toastTimer = 0, heartsLayer = null, lastMsg = -1;

  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement('div');
    toastEl.className = 'love-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function showToast(text, ms) {
    const el = ensureToast();
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 2600);
  }

  function nextLoveMessage() {
    if (!loveMessages.length) return '♡';
    let i;
    do { i = Math.floor(Math.random() * loveMessages.length); }
    while (i === lastMsg && loveMessages.length > 1);
    lastMsg = i;
    return loveMessages[i];
  }

  function spawnHearts() {
    if (reduceMotion || !heartsLayer) return;
    const small = window.innerWidth < 600;
    const n = small ? 10 : 16;
    const glyphs = ['♥', '♡', '♥'];
    const colors = [COLORS.magenta, COLORS.rose, COLORS.neon, COLORS.roseDark];
    while (heartsLayer.childElementCount > 60) heartsLayer.removeChild(heartsLayer.firstChild);
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'float-heart';
      s.textContent = pick(glyphs);
      s.style.setProperty('--x', rand(6, 94).toFixed(1) + '%');
      s.style.setProperty('--s', rand(16, 38).toFixed(0) + 'px');
      s.style.setProperty('--c', pick(colors));
      s.style.setProperty('--t', rand(3.2, 5.4).toFixed(2) + 's');
      s.style.setProperty('--dl', rand(0, .9).toFixed(2) + 's');
      s.style.setProperty('--sway', rand(-70, 70).toFixed(0) + 'px');
      s.style.setProperty('--rot', rand(-25, 25).toFixed(0) + 'deg');
      s.addEventListener('animationend', function () { s.remove(); });
      heartsLayer.appendChild(s);
    }
  }

  function initFab() {
    heartsLayer = document.createElement('div');
    heartsLayer.className = 'hearts-layer';
    heartsLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(heartsLayer);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'fab-heart';
    fab.setAttribute('aria-label', 'Enviar corações');
    fab.innerHTML = '<span aria-hidden="true">♡</span>';
    fab.addEventListener('click', function () {
      spawnHearts();
      showToast(nextLoveMessage());
      if (navigator.vibrate && isTouch) { try { navigator.vibrate(18); } catch (e) { /* ignora */ } }
    });
    document.body.appendChild(fab);
    ensureToast();
  }

  /* -------------------------------------------------------------------
     Segredo: 5 cliques no coração do logo
     ------------------------------------------------------------------- */
  let secretEl = null, secretLayer = null, secretTimers = [], secretOpener = null;

  function ensureSecret() {
    if (secretEl) return secretEl;
    secretEl = document.createElement('div');
    secretEl.className = 'secret';
    secretEl.setAttribute('role', 'dialog');
    secretEl.setAttribute('aria-modal', 'true');
    secretEl.setAttribute('aria-labelledby', 'secretTitle');
    secretEl.tabIndex = -1;
    secretEl.innerHTML =
      '<canvas class="secret-canvas" aria-hidden="true"></canvas>' +
      '<div class="secret-rings" aria-hidden="true"><span style="--i:0"></span><span style="--i:1"></span><span style="--i:2"></span><span style="--i:3"></span></div>' +
      '<div class="secret-content">' +
      '<span class="secret-heart" aria-hidden="true">♥</span>' +
      '<h2 class="secret-title" id="secretTitle">Você encontrou um segredo.</h2>' +
      '<p class="secret-message" aria-live="polite"></p>' +
      '<button type="button" class="btn btn-ghost secret-close">Guardar segredo ♡</button>' +
      '</div>';
    document.body.appendChild(secretEl);
    secretLayer = new ParticleLayer(secretEl.querySelector('.secret-canvas'), { max: 520 });
    secretEl.querySelector('.secret-close').addEventListener('click', closeSecret);
    secretEl.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); secretEl.querySelector('.secret-close').focus(); }
    });
    return secretEl;
  }

  function openSecret() {
    const el = ensureSecret();
    if (el.classList.contains('is-open')) return;
    secretOpener = document.activeElement;
    document.body.style.overflow = 'hidden';
    el.classList.add('is-open');
    secretLayer.resize();
    secretLayer.clear();
    const msg = el.querySelector('.secret-message');
    const btn = el.querySelector('.secret-close');
    btn.classList.remove('show');
    msg.textContent = '';
    el.focus();

    const cx = secretLayer.w / 2, cy = secretLayer.h / 2 - Math.min(40, secretLayer.h * .05);
    const size = Math.min(secretLayer.w, secretLayer.h) * .95;
    const at = function (ms, fn) { secretTimers.push(setTimeout(fn, ms)); };
    at(500, function () { secretLayer.emitHeart(cx, cy, size, 90, { speed: 1.5 }); });
    at(2100, function () { secretLayer.emitHeart(cx, cy, size * .8, 70, { speed: 1.5, colors: [COLORS.rose, COLORS.ivory, COLORS.neon] }); });
    at(3900, function () { secretLayer.emitHeart(cx, cy, size * 1.1, 110, { speed: 1.6 }); });
    at(1700, function () { typeMessage(msg, secretMessage, 62, 0, function () { btn.classList.add('show'); btn.focus(); }); });
    at(9000, function () { btn.classList.add('show'); });
  }

  function closeSecret() {
    if (!secretEl) return;
    secretTimers.forEach(clearTimeout);
    secretTimers = [];
    secretEl.classList.remove('is-open');
    document.body.style.overflow = '';
    if (secretOpener && secretOpener.focus) secretOpener.focus();
  }

  function initSecret() {
    const heart = document.getElementById('brandHeart');
    if (!heart) return;
    let count = 0, timer = 0;
    heart.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      count++;
      heart.classList.remove('pulse');
      void heart.offsetWidth;
      heart.classList.add('pulse');
      clearTimeout(timer);
      timer = setTimeout(function () { count = 0; }, 2400);
      if (count >= 5) { count = 0; openSecret(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && secretEl && secretEl.classList.contains('is-open')) closeSecret();
    });
  }

  /* -------------------------------------------------------------------
     Menu, cabeçalho, transições entre páginas
     ------------------------------------------------------------------- */
  function initNav() {
    const btn = document.querySelector('.nav-toggle');
    const nav = document.getElementById('siteNav');
    if (!btn || !nav) return;
    const setOpen = function (open) {
      document.body.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    };
    btn.addEventListener('click', function () { setOpen(!document.body.classList.contains('nav-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { setOpen(false); btn.focus(); }
    });
    window.matchMedia('(min-width: 860px)').addEventListener
      ? window.matchMedia('(min-width: 860px)').addEventListener('change', function (e) { if (e.matches) setOpen(false); })
      : window.addEventListener('resize', function () { if (window.innerWidth >= 860) setOpen(false); });
  }

  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const update = function () { header.classList.toggle('is-scrolled', window.scrollY > 20); };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function initTransitions() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add('is-ready'); });
    });
    window.addEventListener('pageshow', function () {
      root.classList.remove('is-leaving');
      root.classList.add('is-ready');
    });
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;
      let url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (url.protocol !== window.location.protocol) return;
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      e.preventDefault();
      saveMusicTime();
      root.classList.add('is-leaving');
      setTimeout(function () { window.location.href = a.href; }, reduceMotion ? 0 : 380);
    });
  }

  /* -------------------------------------------------------------------
     Revelação ao rolar (IntersectionObserver)
     ------------------------------------------------------------------- */
  function initReveal() {
    const els = Array.prototype.slice.call(document.querySelectorAll('.reveal, [data-reveal]'));
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: .2, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  function initQuotes() {
    document.querySelectorAll('.quote').forEach(function (q) {
      let idx = 0;
      q.querySelectorAll('[data-split]').forEach(function (line) {
        idx = splitText(line, idx).next;
      });
    });
  }

  function initSectionFields() {
    document.querySelectorAll('.section-canvas').forEach(function (canvas) {
      const field = createField(canvas, { density: 9000, min: 40, max: 130, hearts: 6 });
      const host = canvas.parentElement;
      if (!('IntersectionObserver' in window)) { field.start(); return; }
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) field.start(); else field.stop(); });
      }, { threshold: 0 }).observe(host);
    });
  }

  function initBackground() {
    const canvas = document.getElementById('fx-canvas');
    if (!canvas) return;
    const field = createField(canvas, { density: 21000, min: 30, max: 110, hearts: isTouch ? 3 : 5 });
    field.start();
  }

  /* -------------------------------------------------------------------
     Nome, brilho dos cards, paralaxe
     ------------------------------------------------------------------- */
  function initName() {
    if (!name) return;
    document.querySelectorAll('[data-name]').forEach(function (el) { el.textContent = name; });
  }

  function initCardGlow() {
    document.querySelectorAll('.glass-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  function initParallax() {
    if (reduceMotion) return;
    const els = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (!els.length) return;
    let ticking = false;
    const update = function () {
      ticking = false;
      const vh = window.innerHeight;
      els.forEach(function (el) {
        const host = el.parentElement.getBoundingClientRect();
        const f = parseFloat(el.getAttribute('data-parallax')) || 0;
        el.style.setProperty('--py', (((host.top + host.height / 2) - vh / 2) * f).toFixed(1) + 'px');
      });
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* -------------------------------------------------------------------
     Música (opcional, nunca inicia sozinha na primeira visita)
     ------------------------------------------------------------------- */
  let musicAudio = null, musicPlaying = false;
  const MUSIC_KEY = 'para-ela-musica';
  const MUSIC_TIME = 'para-ela-musica-t';

  function saveMusicTime() {
    if (musicAudio && musicPlaying && !isNaN(musicAudio.currentTime)) store.set(MUSIC_TIME, String(musicAudio.currentTime));
  }

  function initMusic() {
    const btn = document.getElementById('musicBtn');
    if (!btn) return;
    let waiting = false, pendingSeek = 0;

    function setUI(on) {
      musicPlaying = on;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Pausar música' : 'Tocar música');
    }

    function onError() {
      setUI(false);
      cleanupWaiting();
      btn.classList.add('is-unavailable');
      btn.title = 'Música indisponível';
      store.set(MUSIC_KEY, 'off');
      showToast('Ainda não há música por aqui ♫');
    }

    function ensureAudio() {
      if (musicAudio) return musicAudio;
      musicAudio = new Audio();
      musicAudio.loop = true;
      musicAudio.volume = .55;
      musicAudio.preload = 'none';
      musicAudio.addEventListener('error', onError);
      musicAudio.addEventListener('loadedmetadata', function () {
        if (pendingSeek > 0) { try { musicAudio.currentTime = pendingSeek; } catch (e) { /* ignora */ } pendingSeek = 0; }
      });
      musicAudio.src = backgroundMusic;
      return musicAudio;
    }

    function play(fromSaved) {
      const a = ensureAudio();
      let p;
      try { p = a.play(); } catch (e) { onError(); return; }
      if (p && p.then) {
        p.then(function () { setUI(true); store.set(MUSIC_KEY, 'on'); cleanupWaiting(); })
          .catch(function () { if (fromSaved) armResume(); else setUI(false); });
      } else { setUI(true); store.set(MUSIC_KEY, 'on'); }
    }

    // Se a música estava ligada na página anterior, o navegador pode bloquear o
    // retorno automático. Nesse caso, ela volta assim que houver o primeiro toque.
    const onGesture = function (e) {
      if (btn.contains(e.target)) return;
      cleanupWaiting();
      play(false);
    };
    function armResume() {
      if (waiting) return;
      waiting = true;
      setUI(true);
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, onGesture, { passive: true }); });
    }
    function cleanupWaiting() {
      if (!waiting) return;
      waiting = false;
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.removeEventListener(ev, onGesture); });
    }

    btn.addEventListener('click', function () {
      if (waiting) { cleanupWaiting(); setUI(false); store.set(MUSIC_KEY, 'off'); return; }
      if (musicPlaying) {
        if (musicAudio) musicAudio.pause();
        setUI(false);
        store.set(MUSIC_KEY, 'off');
      } else {
        play(false);
      }
    });

    window.addEventListener('pagehide', saveMusicTime);

    if (store.get(MUSIC_KEY) === 'on') {
      pendingSeek = parseFloat(store.get(MUSIC_TIME)) || 0;
      play(true);
    }
  }

  /* -------------------------------------------------------------------
     Página inicial: título, abertura, retrato, contagem
     ------------------------------------------------------------------- */
  function initHeroTitle() {
    const title = document.getElementById('heroTitle');
    if (title && typeof birthdayMessage === 'string' && birthdayMessage.trim()) {
      renderMessage(title, birthdayMessage.trim());
    }
  }

  function startHero() {
    document.body.classList.add('hero-play');
    const sub = document.getElementById('heroSub');
    if (!sub || sub.dataset.typed) return;
    sub.dataset.typed = '1';
    const res = splitText(sub, 0);
    if (reduceMotion) { res.chars.forEach(function (c) { c.classList.add('is-on'); }); return; }
    let i = 0;
    function next() {
      if (i >= res.chars.length) return;
      const c = res.chars[i++];
      c.classList.add('is-on');
      const t = c.textContent;
      setTimeout(next, 34 + (/[.,]/.test(t) ? 300 : 0));
    }
    setTimeout(next, 1500);
  }

  function initIntro() {
    const intro = document.getElementById('intro');
    if (!intro) { if (document.querySelector('.hero')) startHero(); return; }

    const forced = /[?&]intro/.test(window.location.search);
    const seen = store.get('para-ela-intro') === '1' && !forced;
    if (reduceMotion || seen) {
      intro.remove();
      startHero();
      return;
    }

    const line1 = intro.querySelector('.intro-line-1');
    const line2 = intro.querySelector('.intro-line-2');
    buildWords(line1, cleanText(line1).replace(/\s+/g, ' '), false);
    buildWords(line2, (birthdayMessage || 'Feliz aniversário, meu amor.').trim(), true);

    const canvas = intro.querySelector('canvas');
    let field = null;
    if (canvas) { field = createField(canvas, { density: 8000, min: 40, max: 150, hearts: 0 }); field.start(); }

    document.body.classList.add('intro-active');
    let finished = false;
    const timers = [];
    const at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      store.set('para-ela-intro', '1');
      intro.classList.add('is-leaving');
      document.body.classList.remove('intro-active');
      setTimeout(startHero, 350);
      setTimeout(function () { if (field) field.stop(); intro.remove(); }, 1500);
    }

    at(1000, function () { intro.classList.add('show-1'); });
    at(4700, function () { intro.classList.add('hide-1'); });
    at(5500, function () { intro.classList.add('show-2'); });
    at(9600, finish);

    intro.addEventListener('click', finish);
    document.addEventListener('keydown', function (e) {
      if (!finished && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); finish(); }
    });
  }

  function initPortrait() {
    const wrap = document.getElementById('portrait');
    if (!wrap) return;
    const canvas = wrap.querySelector('.portrait-canvas');
    const layer = new ParticleLayer(canvas, { max: 240 });
    const colors = [COLORS.neon, COLORS.magenta, COLORS.rose, COLORS.ivory];
    let lastEmit = 0, touchTimer = 0, inView = false;

    const toCanvas = function (e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    wrap.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;
      wrap.classList.add('is-hover');
    });
    wrap.addEventListener('pointerleave', function () {
      wrap.classList.remove('is-hover', 'is-tilting');
      wrap.style.setProperty('--rx', '0deg');
      wrap.style.setProperty('--ry', '0deg');
    });
    wrap.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      const r = wrap.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      if (!reduceMotion) {
        wrap.classList.add('is-tilting');
        wrap.style.setProperty('--rx', (-py * 7).toFixed(2) + 'deg');
        wrap.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg');
      }
      const now = performance.now();
      if (!reduceMotion && now - lastEmit > 55) {
        lastEmit = now;
        const p = toCanvas(e);
        layer.emit(p.x, p.y, 2, { speed: [10, 50], size: [1.6, 3.4], life: [.8, 1.5], colors: colors, gravity: -14, type: ['spark', 'spark', 'star'] });
      }
    });

    // Toque (celular): brilho + zoom suave + faíscas no ponto tocado
    wrap.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      wrap.classList.add('is-touched');
      clearTimeout(touchTimer);
      touchTimer = setTimeout(function () { wrap.classList.remove('is-touched'); }, 2400);
      const p = toCanvas(e);
      layer.emit(p.x, p.y, 18, { speed: [30, 130], size: [2, 4.5], life: [1, 1.9], colors: colors, gravity: -10, type: ['spark', 'star', 'heart'] });
    });

    // Faíscas ambiente ao redor da moldura (só enquanto visível)
    if (!reduceMotion) {
      setInterval(function () {
        if (!inView || document.hidden) return;
        const a = rand(0, TAU);
        const cx = layer.w / 2, cy = layer.h / 2;
        layer.emit(cx + Math.cos(a) * layer.w * .4, cy + Math.sin(a) * layer.h * .4, 1, {
          speed: [6, 22], size: [1.4, 3], life: [1.6, 2.8], colors: colors, gravity: -9, type: ['spark', 'spark', 'star']
        });
      }, 260);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
        }, { threshold: 0 }).observe(wrap);
      } else { inView = true; }
    }
  }

  function parseStart(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/.exec(String(str).trim());
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function initCountdown() {
    const box = document.getElementById('countdown');
    if (!box) return;
    const els = {
      days: box.querySelector('[data-unit="days"]'),
      hours: box.querySelector('[data-unit="hours"]'),
      minutes: box.querySelector('[data-unit="minutes"]'),
      seconds: box.querySelector('[data-unit="seconds"]')
    };
    const note = document.getElementById('countNote');
    const start = parseStart(relationshipStart);

    if (!start) {
      Object.keys(els).forEach(function (k) { els[k].textContent = '--'; });
      if (note) note.textContent = 'Defina a data em js/main.js (relationshipStart) ♡';
      return;
    }

    const fmt = {
      days: function (v) { return v.toLocaleString('pt-BR'); },
      hours: function (v) { return String(v).padStart(2, '0'); },
      minutes: function (v) { return String(v).padStart(2, '0'); },
      seconds: function (v) { return String(v).padStart(2, '0'); }
    };

    function values() {
      const s = Math.floor(Math.max(0, Date.now() - start.getTime()) / 1000);
      return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
    }

    function render(v, tick) {
      Object.keys(els).forEach(function (k) {
        const txt = fmt[k](v[k]);
        if (els[k].textContent !== txt) {
          els[k].textContent = txt;
          if (tick && !reduceMotion) {
            els[k].classList.remove('tick');
            void els[k].offsetWidth;
            els[k].classList.add('tick');
          }
        }
      });
    }

    function live() {
      render(values(), false);
      setInterval(function () { render(values(), true); }, 1000);
    }

    function countUp() {
      if (reduceMotion) { live(); return; }
      const target = values();
      const t0 = performance.now();
      const dur = 2300;
      (function frame(now) {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);
        render({
          days: Math.round(target.days * e), hours: Math.round(target.hours * e),
          minutes: Math.round(target.minutes * e), seconds: Math.round(target.seconds * e)
        }, false);
        if (p < 1) requestAnimationFrame(frame); else live();
      })(t0);
    }

    render({ days: 0, hours: 0, minutes: 0, seconds: 0 }, false);
    if (!('IntersectionObserver' in window)) { live(); return; }
    const io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); countUp(); }
    }, { threshold: .35 });
    io.observe(box);
  }

  /* -------------------------------------------------------------------
     Inicialização
     ------------------------------------------------------------------- */
  function boot() {
    root.classList.add('js');
    [
      initName, initNav, initHeaderScroll, initBackground, initTransitions,
      initQuotes, initReveal, initSectionFields, initFab, initSecret, initMusic,
      initHeroTitle, initIntro, initPortrait, initParallax, initCardGlow, initCountdown
    ].forEach(function (fn) {
      try { fn(); } catch (err) { if (window.console) console.error('[Para Ela] ' + fn.name + ':', err); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* API pública para os scripts das outras páginas */
  return {
    reduceMotion: reduceMotion, isTouch: isTouch, COLORS: COLORS, TAU: TAU, name: name,
    rand: rand, pick: pick, clamp: clamp, lerp: lerp, easeInOut: easeInOut, easeOut: easeOut, debounce: debounce,
    rgba: rgba, HEART: HEART, heartPoint: heartPoint, fillHeart: fillHeart, drawStar4: drawStar4, glowSprite: glowSprite,
    ParticleLayer: ParticleLayer, createField: createField, showToast: showToast, typeMessage: typeMessage
  };
})();
