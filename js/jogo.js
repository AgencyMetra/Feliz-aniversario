/* =====================================================================
   jogo.js — mini-jogo "Reino Encantado"

   Um unicórnio percorre um reino de fantasia (céu, lua, montanhas,
   castelo, cristais) coletando corações mágicos.
   Desktop: WASD ou setas.  Celular: joystick virtual.

   Depende do main.js (objeto "Encanto").
   ===================================================================== */

// ==============================
// PERSONALIZAÇÃO
// ==============================
const heartsToCollect = 10;   // quantos corações mágicos existem no reino
// ==============================

(function () {
  'use strict';

  const E = Encanto;
  const TAU = E.TAU, COLORS = E.COLORS;
  const rand = E.rand, pick = E.pick, clamp = E.clamp, lerp = E.lerp;
  const glowSprite = E.glowSprite, drawStar4 = E.drawStar4, fillHeart = E.fillHeart;
  const reduceMotion = E.reduceMotion;
  const $ = function (id) { return document.getElementById(id); };

  const wrap = $('gameWrap');
  const canvas = $('gameCanvas');
  const fxCanvas = $('gameFx');
  if (!wrap || !canvas || !fxCanvas) return;

  const ctx = canvas.getContext('2d');
  const fx = new E.ParticleLayer(fxCanvas, { max: 420 });

  const startOverlay = $('startOverlay');
  const winOverlay = $('winOverlay');
  const startBtn = $('startBtn');
  const againBtn = $('againBtn');
  const hud = $('gameHud');
  const hudCount = $('hudCount');
  const hudPips = $('hudPips');
  const statusEl = $('gameStatus');
  const stick = $('joystick');
  const knob = $('joystickKnob');
  const winFxCanvas = $('winFx');
  const winFx = winFxCanvas ? new E.ParticleLayer(winFxCanvas, { max: 380 }) : null;

  /* Marca dispositivos de toque (mostra o joystick e o texto de instruções) */
  if (E.isTouch) document.documentElement.classList.add('is-touch');
  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') document.documentElement.classList.add('is-touch');
  }, { passive: true });

  /* ---------------------------------------------------------------
     Estado geral
     --------------------------------------------------------------- */
  let vw = 1, vh = 1, dpr = 1, S = 1, y0 = 300, gh = 300;
  let worldW = 2400, camMax = 1600, camX = 0;
  let time = 0, last = 0, raf = 0, running = false;
  let state = 'ready';            // ready | play | win
  let collected = 0;

  const player = { u: .3, t: .55, dir: 1, ph: 0, run: 0, vx: 0, vt: 0 };
  let hearts = [], decor = [], npcs = [], grass = [], clouds = [], flyers = [], stars = [], flies = [], rings = [];
  let skyImg = null, groundImg = null;
  const layers = [];              // { img, f }
  let compassT = 0;

  /* ---------------------------------------------------------------
     Entrada: teclado + joystick
     --------------------------------------------------------------- */
  const keys = {};
  const stickVec = { x: 0, y: 0 };
  const KEYMAP = {
    ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r',
    ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd'
  };
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = KEYMAP[e.key];
    if (!k) return;
    keys[k] = true;
    if (state === 'play') e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    const k = KEYMAP[e.key];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', function () { keys.l = keys.r = keys.u = keys.d = false; stickVec.x = stickVec.y = 0; });

  (function initStick() {
    if (!stick || !knob) return;
    let id = null;
    const R = 39;
    function set(e) {
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      knob.style.setProperty('--kx', dx.toFixed(1) + 'px');
      knob.style.setProperty('--ky', dy.toFixed(1) + 'px');
      const nx = dx / R, ny = dy / R;
      const m = Math.hypot(nx, ny);
      if (m < .14) { stickVec.x = stickVec.y = 0; } else { stickVec.x = nx; stickVec.y = ny; }
    }
    function reset() {
      id = null;
      knob.style.setProperty('--kx', '0px');
      knob.style.setProperty('--ky', '0px');
      stickVec.x = stickVec.y = 0;
    }
    stick.addEventListener('pointerdown', function (e) {
      if (id !== null) return;
      id = e.pointerId;
      try { stick.setPointerCapture(id); } catch (err) { /* ignora */ }
      set(e);
      e.preventDefault();
    });
    stick.addEventListener('pointermove', function (e) { if (e.pointerId === id) { set(e); e.preventDefault(); } });
    stick.addEventListener('pointerup', function (e) { if (e.pointerId === id) reset(); });
    stick.addEventListener('pointercancel', function (e) { if (e.pointerId === id) reset(); });
    stick.addEventListener('lostpointercapture', reset);
  })();

  /* ---------------------------------------------------------------
     Layout dependente do tamanho da tela
     --------------------------------------------------------------- */
  const persp = function (t) { return .58 + .56 * t; };
  const groundY = function (t) { return y0 + t * gh; };
  const UNIT = .68;   // tamanho do pônei em relação às unidades de desenho

  function layout() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    vw = r.width; vh = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.resize();
    if (winFx) winFx.resize();
    S = clamp(Math.min(vw / 700, vh / 560), .72, 1.3);
    y0 = Math.round(vh * .44);
    gh = vh - y0;
    worldW = Math.max(2200, Math.round(vw * 3.2));
    camMax = Math.max(0, worldW - vw);
    buildLayers();
    if (!running) draw();
  }

  /* Ruído de montanhas (soma de senos com fases sorteadas) */
  function makeRidge(seed) {
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push({ f: (.8 + i * 1.35 + Math.random() * .5), a: 1 / (1 + i * .9), p: Math.random() * TAU + seed });
    return function (x) {
      let s = 0, n = 0;
      for (let i = 0; i < parts.length; i++) { s += Math.sin(x * parts[i].f + parts[i].p) * parts[i].a; n += parts[i].a; }
      return s / n;   // -1..1
    };
  }

  function buildLayers() {
    // ---- céu (estático) ----
    skyImg = document.createElement('canvas');
    skyImg.width = Math.ceil(vw); skyImg.height = Math.ceil(y0 + 40);
    let g = skyImg.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, y0 + 40);
    sky.addColorStop(0, '#07020c');
    sky.addColorStop(.45, '#1a0629');
    sky.addColorStop(.8, '#3d0f52');
    sky.addColorStop(1, '#7a1f6c');
    g.fillStyle = sky; g.fillRect(0, 0, vw, y0 + 40);
    g.globalCompositeOperation = 'lighter';
    // auroras suaves
    const aur = function (cx, cy, rx, ry, rot, hex, a) {
      g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(rx / ry, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
      gr.addColorStop(0, E.rgba(hex, a)); gr.addColorStop(.6, E.rgba(hex, a * .3)); gr.addColorStop(1, E.rgba(hex, 0));
      g.fillStyle = gr; g.fillRect(-ry, -ry, ry * 2, ry * 2); g.restore();
    };
    aur(vw * .3, y0 * .42, vw * .55, y0 * .3, -.18, COLORS.violet, .45);
    aur(vw * .75, y0 * .3, vw * .5, y0 * .26, .22, COLORS.roseDark, .32);
    aur(vw * .5, y0 * .85, vw * .8, y0 * .2, 0, COLORS.magenta, .22);
    // lua grande
    const mr = clamp(vw * .055, 26, 62), mx = vw * .2, my = y0 * .32;
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glowSprite(COLORS.rose, 128), mx - mr * 4.4, my - mr * 4.4, mr * 8.8, mr * 8.8);
    g.drawImage(glowSprite(COLORS.neon, 128), mx - mr * 6.5, my - mr * 6.5, mr * 13, mr * 13);
    g.globalCompositeOperation = 'source-over';
    const mg = g.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
    mg.addColorStop(0, '#FFF9FD'); mg.addColorStop(1, '#F1CDE6');
    g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    g.fillStyle = 'rgba(181,27,99,.12)';
    [[-.3, -.1, .2], [.25, .25, .15], [.1, -.35, .12]].forEach(function (c) {
      g.beginPath(); g.arc(mx + c[0] * mr, my + c[1] * mr, c[2] * mr, 0, TAU); g.fill();
    });

    // ---- camadas de montanhas / castelo ----
    layers.length = 0;
    const mk = function (f, drawFn) {
      const w = Math.ceil(vw + camMax * f);
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.ceil(y0 + 24);
      drawFn(c.getContext('2d'), w, c.height);
      layers.push({ img: c, f: f });
    };

    // montanhas distantes
    mk(.14, function (c, w, h) {
      const ridge = makeRidge(1.3);
      const grad = c.createLinearGradient(0, y0 * .3, 0, h);
      grad.addColorStop(0, '#4a1670'); grad.addColorStop(1, '#2a0c40');
      c.fillStyle = grad;
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) c.lineTo(x, y0 - 16 - (ridge(x / (vw * .11)) * .5 + .5) * y0 * .34);
      c.lineTo(w, h); c.closePath(); c.fill();
      // neblina no pé
      const mist = c.createLinearGradient(0, y0 - 80, 0, h);
      mist.addColorStop(0, 'rgba(232,62,140,0)'); mist.addColorStop(1, 'rgba(232,62,140,.28)');
      c.fillStyle = mist; c.fillRect(0, y0 - 80, w, 104);
    });

    // colina + castelo
    mk(.26, function (c, w, h) {
      const ridge = makeRidge(4.1);
      const hill = function (x) { return y0 - 8 - (ridge(x / (vw * .2)) * .5 + .5) * y0 * .16; };
      const cx = clamp(vw * .7 + camMax * .26 * .16, 160, w - 160);
      const cbase = hill(cx);
      const u = clamp(vw / 520, .7, 1.5) * (y0 / 300);
      // brilho atrás do castelo
      c.globalCompositeOperation = 'lighter';
      c.drawImage(glowSprite(COLORS.magenta, 128), cx - 190 * u, cbase - 210 * u, 380 * u, 300 * u);
      c.globalCompositeOperation = 'source-over';
      // colina
      const g2 = c.createLinearGradient(0, y0 * .5, 0, h);
      g2.addColorStop(0, '#2a0c40'); g2.addColorStop(1, '#170622');
      c.fillStyle = g2;
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) c.lineTo(x, hill(x));
      c.lineTo(w, h); c.closePath(); c.fill();
      // castelo (silhueta com brilho rosado)
      c.save();
      c.shadowColor = 'rgba(232,62,140,.55)'; c.shadowBlur = 26 * u;
      c.fillStyle = '#1b0a2c';
      const rect = function (x, y, ww, hh) { c.fillRect(cx + x * u, cbase + y * u, ww * u, hh * u); };
      const cone = function (x, y, ww, hh) {
        c.beginPath(); c.moveTo(cx + (x - ww / 2) * u, cbase + y * u); c.lineTo(cx + x * u, cbase + (y - hh) * u);
        c.lineTo(cx + (x + ww / 2) * u, cbase + y * u); c.closePath(); c.fill();
      };
      rect(-60, -70, 120, 80);            // corpo principal
      rect(-88, -104, 26, 114); cone(-75, -104, 34, 40);
      rect(62, -104, 26, 114); cone(75, -104, 34, 40);
      rect(-18, -142, 36, 152); cone(0, -142, 48, 64);   // torre central
      rect(-46, -92, 18, 30); cone(-37, -92, 24, 26);
      rect(28, -92, 18, 30); cone(37, -92, 24, 26);
      // ameias
      for (let i = -3; i <= 3; i++) rect(i * 16 - 5, -78, 10, 8);
      c.restore();
      // janelas acesas
      c.fillStyle = '#FFC4E3';
      [[-8, -118, 16, 4], [-8, -100, 16, 4], [-6, -50, 12, 4], [-42, -50, 8, 3], [34, -50, 8, 3], [-75, -86, 6, 3], [75, -86, 6, 3], [-75, -70, 6, 3], [75, -70, 6, 3], [-37, -74, 5, 3], [37, -74, 5, 3]].forEach(function (a) {
        c.fillRect(cx + a[0] * u, cbase + a[1] * u, a[2] * u * .9, a[3] * u * 1.4);
      });
      // porta
      c.beginPath(); c.arc(cx, cbase + 4 * u, 12 * u, Math.PI, 0); c.lineTo(cx + 12 * u, cbase + 10 * u); c.lineTo(cx - 12 * u, cbase + 10 * u); c.closePath();
      c.fillStyle = '#E83E8C'; c.globalAlpha = .75; c.fill(); c.globalAlpha = 1;
      // bandeirinhas
      c.fillStyle = COLORS.magenta;
      [[0, -206], [-75, -144], [75, -144]].forEach(function (p) {
        c.beginPath(); c.moveTo(cx + p[0] * u, cbase + p[1] * u); c.lineTo(cx + (p[0] + 22) * u, cbase + (p[1] + 6) * u); c.lineTo(cx + p[0] * u, cbase + (p[1] + 12) * u); c.closePath(); c.fill();
        c.fillRect(cx + p[0] * u - .8 * u, cbase + p[1] * u, 1.6 * u, 16 * u);
      });
    });

    // colinas próximas, com silhuetas de árvores
    mk(.42, function (c, w, h) {
      const ridge = makeRidge(7.7);
      const top = function (x) { return y0 - 2 - (ridge(x / (vw * .16)) * .5 + .5) * y0 * .1; };
      const g3 = c.createLinearGradient(0, y0 * .6, 0, h);
      g3.addColorStop(0, '#1d0730'); g3.addColorStop(1, '#100419');
      c.fillStyle = g3;
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 5) c.lineTo(x, top(x));
      c.lineTo(w, h); c.closePath(); c.fill();
      // pinheiros
      c.fillStyle = '#12041c';
      for (let x = 20; x < w; x += rand(36, 78)) {
        const b = top(x) + 4, th = rand(22, 54) * clamp(y0 / 300, .7, 1.4);
        c.beginPath(); c.moveTo(x, b - th); c.lineTo(x - th * .28, b); c.lineTo(x + th * .28, b); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(x, b - th * 1.18); c.lineTo(x - th * .2, b - th * .35); c.lineTo(x + th * .2, b - th * .35); c.closePath(); c.fill();
      }
    });

    // ---- chão ----
    groundImg = document.createElement('canvas');
    groundImg.width = Math.ceil(vw); groundImg.height = Math.ceil(gh + 2);
    g = groundImg.getContext('2d');
    const gg = g.createLinearGradient(0, 0, 0, gh);
    gg.addColorStop(0, '#3a1256'); gg.addColorStop(.18, '#2a0b3f'); gg.addColorStop(1, '#0c0313');
    g.fillStyle = gg; g.fillRect(0, 0, vw, gh + 2);
    const hz = g.createLinearGradient(0, 0, 0, gh * .3);
    hz.addColorStop(0, 'rgba(232,62,140,.5)'); hz.addColorStop(1, 'rgba(232,62,140,0)');
    g.fillStyle = hz; g.fillRect(0, 0, vw, gh * .3);

    if (!hearts.length) buildWorld();
  }

  /* ---------------------------------------------------------------
     Mundo (posições em "u" = fração da largura do mundo, "t" = profundidade)
     --------------------------------------------------------------- */
  function buildWorld() {
    hearts = []; decor = []; npcs = []; grass = []; clouds = []; flyers = []; stars = []; flies = [];
    // corações: espalhados por todo o mundo; o primeiro já aparece na tela inicial
    for (let i = 0; i < heartsToCollect; i++) {
      const slot = (i + .5) / heartsToCollect;
      const u = i === 0 ? .42 : clamp(.08 + slot * .86 + rand(-.03, .03), .06, .95);
      hearts.push({ u: u, t: i === 0 ? .62 : rand(.14, .9), ph: rand(0, TAU), got: false, pop: 0 });
    }
    // cristais e árvores mágicas
    for (let i = 0; i < 20; i++) decor.push({ k: 'crystal', u: rand(.03, .97), t: rand(.1, .95), s: rand(.7, 1.3), hue: Math.random(), seed: rand(0, TAU) });
    for (let i = 0; i < 10; i++) decor.push({ k: 'tree', u: rand(.02, .98), t: rand(.06, .3), s: rand(.9, 1.5), seed: rand(0, TAU) });
    for (let i = 0; i < 4; i++) decor.push({ k: 'tree', u: rand(.02, .98), t: rand(.8, .98), s: rand(1, 1.5), seed: rand(0, TAU) });
    for (let i = 0; i < 46; i++) decor.push({ k: 'flower', u: rand(.01, .99), t: rand(.08, .97), s: rand(.7, 1.2), c: pick([COLORS.rose, COLORS.magenta, COLORS.neon]), seed: rand(0, TAU) });
    // pôneis pastando
    [[.26, .82, ['#FCE9F5', '#EBC6E4'], [COLORS.rose, COLORS.magenta, COLORS.neon], false],
     [.55, .3, ['#E9DCFA', '#C9B0EE'], [COLORS.neon, COLORS.violet, COLORS.rose], true],
     [.78, .88, ['#FFE6F1', '#F2B9D8'], [COLORS.magenta, COLORS.rose, COLORS.ivory], false],
     [.9, .4, ['#EDE3FB', '#D3BEF1'], [COLORS.violet, COLORS.neon, COLORS.rose], false]
    ].forEach(function (n, i) {
      npcs.push({ u: n[0], t: n[1], coat: n[2], mane: n[3], wings: n[4], dir: i % 2 ? -1 : 1, seed: i * 1.7 });
    });
    for (let i = 0; i < 130; i++) grass.push({ u: rand(0, 1), t: rand(0, 1), s: rand(.6, 1.4), a: rand(.15, .5), c: Math.random() < .3 ? COLORS.rose : COLORS.neon });
    for (let i = 0; i < 7; i++) clouds.push({ x: rand(0, 1), y: rand(.06, .5), s: rand(.7, 1.5), v: rand(3, 9), a: rand(.07, .16) });
    for (let i = 0; i < 2; i++) flyers.push({ x: rand(0, 1), y: rand(.14, .32), v: rand(26, 44) * (i ? -1 : 1), s: rand(.36, .48), ph: rand(0, TAU) });
    for (let i = 0; i < 90; i++) stars.push({ x: rand(0, 1), y: rand(0, .8), r: rand(.4, 1.5), a: rand(.35, 1), tw: rand(.6, 2.4), ph: rand(0, TAU) });
    for (let i = 0; i < 46; i++) flies.push({ x: rand(0, 1), y: rand(.35, 1), ph: rand(0, TAU), sp: rand(.3, .9), c: Math.random() < .5 ? COLORS.rose : COLORS.neon, r: rand(1.4, 3) });
  }

  /* ---------------------------------------------------------------
     Desenho do pônei / unicórnio / pégaso (vetorial)
     Coordenadas locais: origem no chão, olhando para a direita.
     --------------------------------------------------------------- */
  function poly(c, pts) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }

  function drawLeg(c, hx, hy, ph, run, dark, coat) {
    const sw = .55 * run + .05;
    const a1 = Math.sin(ph) * sw;
    const bend = Math.max(0, Math.cos(ph)) * run * .95;
    const ux = hx + Math.sin(a1) * 23, uy = hy + Math.cos(a1) * 23;
    const a2 = a1 - bend;
    const fxp = ux + Math.sin(a2) * 23, fyp = uy + Math.cos(a2) * 23;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = dark ? coat[2] : coat[1];
    c.lineWidth = 9; c.beginPath(); c.moveTo(hx, hy); c.lineTo(ux, uy); c.stroke();
    c.lineWidth = 6.4; c.beginPath(); c.moveTo(ux, uy); c.lineTo(fxp, fyp); c.stroke();
    c.fillStyle = dark ? '#3a1552' : '#5a2379';
    c.beginPath(); c.ellipse(fxp + 1.6, fyp + 1, 5.2, 3.6, 0, 0, TAU); c.fill();
  }

  function drawWing(c, o, far) {
    const flap = (o.flying ? Math.sin(o.t * 7 + (o.seed || 0)) * .55 : Math.sin(o.t * 1.3 + (o.seed || 0)) * .05) - (far ? .12 : 0);
    c.save();
    c.translate(10, -80);
    c.rotate(-.5 - flap);
    const g = c.createLinearGradient(0, 0, -60, -60);
    g.addColorStop(0, far ? 'rgba(206,182,242,.85)' : 'rgba(255,240,251,.95)');
    g.addColorStop(1, far ? 'rgba(168,85,247,.55)' : 'rgba(247,168,213,.7)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-14, -24, -30, -56, -70, -72);
    c.bezierCurveTo(-58, -56, -60, -48, -52, -40);
    c.bezierCurveTo(-48, -32, -44, -30, -38, -24);
    c.bezierCurveTo(-34, -14, -22, -6, -8, 4);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(181,27,99,.25)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-8, -4); c.lineTo(-52, -52); c.moveTo(-6, 0); c.lineTo(-38, -30); c.stroke();
    c.restore();
  }

  /* o = { x, y, k, dir, t, ph, run, coat:[claro, médio, sombra], mane:[3 cores], horn, wings, flying, seed } */
  function drawPony(c, o) {
    const t = o.t, run = o.run || 0, seed = o.seed || 0;
    const wv = Math.sin(t * 3.1 + seed) * (.6 + run * 1.2);
    const bob = o.flying ? Math.sin(t * 7 + seed) * 3 : Math.abs(Math.sin(o.ph)) * 3.2 * run + Math.sin(t * 1.7 + seed) * .7;
    c.save();
    c.translate(o.x, o.y);
    c.scale(o.k * o.dir, o.k);
    const coat = o.coat;

    if (o.wings) drawWing(c, o, true);

    // pernas do lado de trás (mais escuras)
    const hipB = -46 - bob, hipF = -46 - bob;
    const ph = o.ph;
    if (!o.flying) {
      drawLeg(c, 14, hipF, ph + Math.PI, run, true, coat);
      drawLeg(c, -16, hipB, ph, run, true, coat);
    } else {
      drawLeg(c, 14, hipF, .8, .35, true, coat);
      drawLeg(c, -16, hipB, -.5, .3, true, coat);
    }

    c.save();
    c.translate(0, -bob);

    // cauda
    const tail = function (col, len, off) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(-38, -70 + off);
      c.bezierCurveTo(-62 + wv * 3, -70 + off, -80 + wv * 6, -40 + off, -66 + wv * 9, -8 + len);
      c.bezierCurveTo(-60 + wv * 4, -32 + off, -50, -50 + off, -36, -56 + off);
      c.closePath(); c.fill();
    };
    tail(o.mane[1], 8, 0);
    tail(o.mane[0], -6, 3);

    // crina (atrás do pescoço)
    const mane = function (col, sc, dx) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(60, -134);
      c.bezierCurveTo(46 + dx, -142, 28 + wv * 3, -132, 20 + wv * 4 + dx, -108);
      c.bezierCurveTo(14 + wv * 5, -92, 10 + wv * 6 - dx, -80 + sc, 16 + wv * 7 - dx, -66 + sc);
      c.bezierCurveTo(26 + wv * 3, -84, 36, -98, 46, -110);
      c.bezierCurveTo(52, -118, 56, -124, 60, -134);
      c.closePath(); c.fill();
    };
    mane(o.mane[1], 8, -4);
    mane(o.mane[0], 0, 0);

    // asa mais próxima vem depois do corpo (desenhada mais abaixo)

    // tronco
    const body = c.createLinearGradient(0, -90, 0, -28);
    body.addColorStop(0, coat[0]); body.addColorStop(1, coat[1]);
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-40, -52);
    c.bezierCurveTo(-42, -80, -10, -88, 14, -86);
    c.bezierCurveTo(30, -86, 40, -78, 42, -62);
    c.bezierCurveTo(44, -42, 30, -30, 6, -30);
    c.bezierCurveTo(-20, -28, -42, -32, -40, -52);
    c.closePath(); c.fill();
    // pescoço
    c.beginPath();
    c.moveTo(18, -84);
    c.bezierCurveTo(30, -98, 40, -118, 50, -128);
    c.lineTo(68, -114);
    c.bezierCurveTo(62, -98, 56, -82, 46, -62);
    c.closePath(); c.fill();
    // cabeça
    const head = c.createLinearGradient(50, -134, 90, -94);
    head.addColorStop(0, coat[0]); head.addColorStop(1, coat[1]);
    c.fillStyle = head;
    c.beginPath();
    c.moveTo(46, -126);
    c.bezierCurveTo(54, -136, 70, -136, 80, -122);
    c.bezierCurveTo(88, -113, 95, -109, 93, -100);
    c.bezierCurveTo(91, -93, 81, -93, 74, -97);
    c.bezierCurveTo(66, -101, 58, -103, 50, -107);
    c.closePath(); c.fill();
    // orelha
    c.fillStyle = coat[1];
    poly(c, [[52, -130], [57, -148], [67, -133]]); c.fill();
    c.fillStyle = 'rgba(232,62,140,.35)';
    poly(c, [[56, -133], [58, -143], [63, -134]]); c.fill();
    // olho
    c.fillStyle = '#2b0b3d';
    c.beginPath(); c.ellipse(70, -118, 3.6, 4.6, .2, 0, TAU); c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath(); c.arc(71.2, -119.8, 1.4, 0, TAU); c.fill();
    c.strokeStyle = '#2b0b3d'; c.lineWidth = 1.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(66, -123); c.quadraticCurveTo(70, -126, 75, -123); c.stroke();
    // bochecha + nariz
    c.fillStyle = 'rgba(232,62,140,.32)';
    c.beginPath(); c.ellipse(74, -108, 5, 3.2, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(120,30,100,.55)';
    c.beginPath(); c.arc(89, -103, 1.5, 0, TAU); c.fill();
    // topete
    c.fillStyle = o.mane[0];
    c.beginPath();
    c.moveTo(62, -134);
    c.bezierCurveTo(72, -144 + wv, 90, -136, 86, -119);
    c.bezierCurveTo(82, -128, 72, -129, 62, -134);
    c.closePath(); c.fill();

    // marca no quadril
    c.fillStyle = o.mane[0];
    c.save(); c.translate(-22, -56); c.scale(.55, .55); c.rotate(-.2);
    drawStar4(c, 0, 0, 10, 0);
    c.restore();

    // chifre
    if (o.horn) {
      const hg = c.createLinearGradient(70, -134, 84, -172);
      hg.addColorStop(0, '#FFE9B8'); hg.addColorStop(.5, '#F7A8D5'); hg.addColorStop(1, '#FFFFFF');
      c.fillStyle = hg;
      poly(c, [[67, -133], [84, -174], [76, -131]]); c.fill();
      c.strokeStyle = 'rgba(181,27,99,.45)'; c.lineWidth = 1.1;
      for (let i = 1; i <= 4; i++) {
        const yy = -133 - i * 8.6, xx = 71.4 + i * 3.1;
        c.beginPath(); c.moveTo(xx - 2.6, yy + 2); c.lineTo(xx + 2.6, yy - 2); c.stroke();
      }
    }

    // asa de frente
    if (o.wings) drawWing(c, o, false);

    c.restore();

    // pernas do lado de frente
    if (!o.flying) {
      drawLeg(c, 24, hipF, ph, run, false, coat);
      drawLeg(c, -26, hipB, ph + Math.PI, run, false, coat);
    } else {
      drawLeg(c, 24, hipF, -.4, .3, false, coat);
      drawLeg(c, -26, hipB, .6, .35, false, coat);
    }
    c.restore();
  }

  /* ---------------------------------------------------------------
     Decoração: cristais, árvores, flores, coração coletável
     --------------------------------------------------------------- */
  function drawCrystal(c, x, y, k, d) {
    const pulse = .75 + .25 * Math.sin(time * 1.6 + d.seed);
    const col1 = d.hue < .5 ? COLORS.neon : COLORS.magenta;
    const col2 = d.hue < .5 ? COLORS.rose : COLORS.neon;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = .55 * pulse;
    const gs = 120 * k;
    c.drawImage(glowSprite(col1, 64), x - gs / 2, y - gs * .7, gs, gs);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const shard = function (dx, h, w, col) {
      const g = c.createLinearGradient(x + dx * k, y, x + dx * k, y - h * k);
      g.addColorStop(0, E.rgba(col, .55)); g.addColorStop(1, E.rgba(COLORS.ivory, .95));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x + (dx - w) * k, y);
      c.lineTo(x + (dx - w * .7) * k, y - h * .78 * k);
      c.lineTo(x + dx * k, y - h * k);
      c.lineTo(x + (dx + w * .7) * k, y - h * .78 * k);
      c.lineTo(x + (dx + w) * k, y);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.28)';
      c.beginPath(); c.moveTo(x + dx * k, y - h * k); c.lineTo(x + (dx - w * .7) * k, y - h * .78 * k); c.lineTo(x + (dx - w * .2) * k, y); c.lineTo(x + dx * k, y - h * .2 * k); c.closePath(); c.fill();
    };
    shard(-13, 34, 7, col2);
    shard(14, 28, 6, col2);
    shard(0, 54, 10, col1);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = pulse;
    c.fillStyle = COLORS.ivory;
    drawStar4(c, x + 3 * k, y - 44 * k, 6 * k * (.6 + pulse * .6), time * .4);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  function drawTree(c, x, y, k, d) {
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath(); c.ellipse(x, y, 34 * k, 8 * k, 0, 0, TAU); c.fill();
    const tg = c.createLinearGradient(x - 8 * k, 0, x + 8 * k, 0);
    tg.addColorStop(0, '#1d0a2c'); tg.addColorStop(1, '#3a1552');
    c.fillStyle = tg;
    c.beginPath();
    c.moveTo(x - 9 * k, y); c.quadraticCurveTo(x - 5 * k, y - 40 * k, x - 3 * k, y - 76 * k);
    c.lineTo(x + 4 * k, y - 76 * k); c.quadraticCurveTo(x + 6 * k, y - 40 * k, x + 10 * k, y); c.closePath(); c.fill();
    const blob = function (bx, by, r, c1, c2) {
      const g = c.createRadialGradient(x + bx * k - r * k * .3, y + by * k - r * k * .3, r * k * .1, x + bx * k, y + by * k, r * k);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      c.fillStyle = g;
      c.beginPath(); c.arc(x + bx * k, y + by * k, r * k, 0, TAU); c.fill();
    };
    blob(-20, -88, 30, '#5a1d82', '#2a0b3f');
    blob(22, -92, 32, '#6b2496', '#2a0b3f');
    blob(0, -110, 34, '#7a2ba8', '#321048');
    // luzinhas
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const a = d.seed + i * 1.9;
      const px = x + Math.cos(a) * (18 + (i % 3) * 14) * k;
      const py = y - 96 * k + Math.sin(a * 1.3) * 30 * k;
      c.globalAlpha = .5 + .5 * Math.sin(time * 1.4 + i + d.seed);
      const s = 12 * k;
      c.drawImage(glowSprite(i % 2 ? COLORS.rose : COLORS.neon, 32), px - s / 2, py - s / 2, s, s);
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  function drawFlower(c, x, y, k, d) {
    c.strokeStyle = 'rgba(90,35,121,.9)'; c.lineWidth = 1.6 * k; c.lineCap = 'round';
    const sway = Math.sin(time * 1.2 + d.seed) * 2 * k;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + sway, y - 8 * k, x + sway * 1.4, y - 15 * k); c.stroke();
    c.globalCompositeOperation = 'lighter';
    const gs = 26 * k;
    c.globalAlpha = .55 + .3 * Math.sin(time * 1.8 + d.seed);
    c.drawImage(glowSprite(d.c, 32), x + sway * 1.4 - gs / 2, y - 15 * k - gs / 2, gs, gs);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = d.c;
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      c.beginPath(); c.arc(x + sway * 1.4 + Math.cos(a) * 3 * k, y - 15 * k + Math.sin(a) * 3 * k, 2.2 * k, 0, TAU); c.fill();
    }
    c.fillStyle = '#FFF4FB';
    c.beginPath(); c.arc(x + sway * 1.4, y - 15 * k, 1.5 * k, 0, TAU); c.fill();
  }

  function drawHeartItem(c, x, y, k, h) {
    const bobY = Math.sin(time * 2 + h.ph) * 6 * k;
    const hy = y - 58 * k + bobY;
    // sombra
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.ellipse(x, y, 15 * k, 4.5 * k, 0, 0, TAU); c.fill();
    // brilho
    c.globalCompositeOperation = 'lighter';
    const pulse = 1 + .1 * Math.sin(time * 3 + h.ph);
    let gs = 132 * k * pulse;
    c.globalAlpha = .95;
    c.drawImage(glowSprite(COLORS.magenta, 128), x - gs / 2, hy - gs / 2, gs, gs);
    gs = 210 * k;
    c.globalAlpha = .28;
    c.drawImage(glowSprite(COLORS.neon, 128), x - gs / 2, hy - gs / 2, gs, gs);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    // coração
    const sz = 40 * k * pulse;
    const g = c.createRadialGradient(x - sz * .18, hy - sz * .2, sz * .05, x, hy, sz * .62);
    g.addColorStop(0, '#FFE4F3'); g.addColorStop(.42, '#FF5FAE'); g.addColorStop(1, COLORS.magenta);
    c.fillStyle = g;
    fillHeart(c, x, hy, sz, Math.sin(time * 1.5 + h.ph) * .12);
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath(); c.ellipse(x - sz * .2, hy - sz * .2, sz * .09, sz * .05, -.7, 0, TAU); c.fill();
    // faíscas em órbita
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = COLORS.ivory;
    for (let i = 0; i < 3; i++) {
      const a = time * 1.3 + h.ph + i * (TAU / 3);
      drawStar4(c, x + Math.cos(a) * sz * .85, hy + Math.sin(a) * sz * .55, 4.2 * k, a);
    }
    c.globalCompositeOperation = 'source-over';
  }

  /* ---------------------------------------------------------------
     Lógica de jogo
     --------------------------------------------------------------- */
  function buildPips() {
    hudPips.textContent = '';
    for (let i = 0; i < heartsToCollect; i++) {
      const s = document.createElement('span');
      s.className = 'pip';
      s.textContent = '♥';
      hudPips.appendChild(s);
    }
  }

  function updateHud(pop) {
    hudCount.textContent = collected + ' / ' + heartsToCollect;
    const pips = hudPips.children;
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < collected);
    if (pop) {
      hudCount.classList.remove('pop'); void hudCount.offsetWidth; hudCount.classList.add('pop');
    }
    if (statusEl) statusEl.textContent = 'Você coletou ' + collected + ' de ' + heartsToCollect + ' corações.';
  }

  function toScreen(u, t) { return { x: u * worldW - camX, y: groundY(t) }; }

  function collect(h) {
    h.got = true; h.pop = 1;
    collected++;
    const k = S * persp(h.t) * UNIT * 1.6;
    const p = toScreen(h.u, h.t);
    const cy = p.y - 58 * k;
    fx.emit(p.x, cy, 34, { speed: [50, 260], size: [1.6, 4.2], life: [.9, 1.8], gravity: 30, type: ['spark', 'star', 'heart'] });
    fx.emitHeart(p.x, cy, 90 * S, 26, { speed: 1.2, gravity: 8, minLife: 1.2, maxLife: 2 });
    rings.push({ u: h.u, t: h.t, age: 0 });
    updateHud(true);
    if (collected >= heartsToCollect) {
      state = 'win';
      setTimeout(showWin, reduceMotion ? 300 : 1300);
    }
  }

  function step(dt) {
    time += dt;
    // entrada
    let ix = 0, iy = 0;
    if (state === 'play') {
      if (keys.l) ix -= 1; if (keys.r) ix += 1;
      if (keys.u) iy -= 1; if (keys.d) iy += 1;
      ix += stickVec.x; iy += stickVec.y;
      const m = Math.hypot(ix, iy);
      if (m > 1) { ix /= m; iy /= m; }
    }
    const spd = 300 * S;                     // px/s em x
    const spdT = 200 * S / gh;               // profundidade por segundo
    const ax = 1 - Math.exp(-dt * 9);
    player.vx += (ix * spd - player.vx) * ax;
    player.vt += (iy * spdT - player.vt) * ax;
    player.u = clamp(player.u + (player.vx * dt) / worldW, 70 / worldW, 1 - 70 / worldW);
    player.t = clamp(player.t + player.vt * dt, .1, .96);
    const speedN = clamp(Math.hypot(player.vx / spd, player.vt / spdT * .7), 0, 1);
    player.run += (speedN - player.run) * (1 - Math.exp(-dt * 10));
    player.ph += dt * (4 + player.run * 9) * (player.run > .05 ? 1 : .2);
    if (Math.abs(ix) > .2) player.dir = ix > 0 ? 1 : -1;

    // câmera
    const targetCam = clamp(player.u * worldW - vw * .5, 0, camMax);
    camX += (targetCam - camX) * (1 - Math.exp(-dt * 5));

    // coleta
    if (state === 'play') {
      const px = player.u * worldW, py = groundY(player.t);
      const kp = S * persp(player.t) * UNIT;
      for (let i = 0; i < hearts.length; i++) {
        const h = hearts[i];
        if (h.got) continue;
        const dx = h.u * worldW - px;
        const dy = (groundY(h.t) - py) * 1.7;
        const r = 62 * kp + 14;
        if (dx * dx + dy * dy < r * r) collect(h);
      }
    }
    hearts.forEach(function (h) { if (h.pop > 0) h.pop = Math.max(0, h.pop - dt * 1.4); });
    rings.forEach(function (r) { r.age += dt; });
    rings = rings.filter(function (r) { return r.age < 1.1; });

    // rastro mágico
    if (!reduceMotion && player.run > .3 && Math.random() < dt * 30) {
      const p = toScreen(player.u, player.t);
      const kp = S * persp(player.t) * UNIT;
      fx.emit(p.x - player.dir * 30 * kp, p.y - 4 * kp, 1, {
        speed: [8, 40], size: [1, 2.4], life: [.6, 1.2], gravity: -10,
        colors: [COLORS.rose, COLORS.neon, COLORS.ivory], type: ['spark', 'star']
      });
    }
    // brilho do chifre
    if (!reduceMotion && Math.random() < dt * 9) {
      const p = toScreen(player.u, player.t);
      const kp = S * persp(player.t) * UNIT;
      fx.emit(p.x + player.dir * 84 * kp, p.y - 174 * kp, 1, {
        speed: [6, 30], size: [1, 2.2], life: [.8, 1.4], gravity: 6,
        colors: [COLORS.ivory, COLORS.rose], type: ['spark', 'star']
      });
    }
    clouds.forEach(function (c) { c.x = (c.x + c.v * dt / vw + 1) % 1; });
    flyers.forEach(function (f) { f.x += f.v * dt / vw; if (f.x > 1.15) f.x = -.15; if (f.x < -.15) f.x = 1.15; });
  }

  /* ---------------------------------------------------------------
     Desenho principal
     --------------------------------------------------------------- */
  const COAT_PLAYER = ['#FFF6FC', '#EDD0EE', '#C9A4DA'];
  const MANE_PLAYER = [COLORS.magenta, COLORS.neon, COLORS.rose];
  const COAT_SKY = ['#F3EEFF', '#D8C9F5', '#B5A0E3'];

  function draw() {
    const c = ctx;
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, vw, vh);

    // céu
    c.drawImage(skyImg, 0, 0, vw, y0 + 40);
    // estrelas (cintilam)
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      c.globalAlpha = s.a * (reduceMotion ? .8 : .5 + .5 * Math.sin(time * s.tw + s.ph));
      c.fillStyle = '#FFF4FB';
      c.beginPath(); c.arc(((s.x * vw - camX * .02) % vw + vw) % vw, s.y * y0, s.r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    // nuvens
    c.globalCompositeOperation = 'lighter';
    clouds.forEach(function (cl) {
      const w = 260 * cl.s * clamp(vw / 800, .6, 1.3), h = 56 * cl.s;
      const x = ((cl.x * (vw + w * 2) - w - camX * .07) % (vw + w * 2) + (vw + w * 2)) % (vw + w * 2) - w;
      c.globalAlpha = cl.a;
      c.drawImage(glowSprite(COLORS.rose, 64), x, cl.y * y0 - h / 2, w, h);
      c.drawImage(glowSprite(COLORS.neon, 64), x + w * .25, cl.y * y0 - h * .8, w * .6, h * .9);
    });
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    // pégasos voando
    flyers.forEach(function (f) {
      const x = f.x * vw, y = f.y * y0 + Math.sin(time * .8 + f.ph) * 8;
      const dirF = f.v >= 0 ? 1 : -1;
      c.globalAlpha = .9;
      drawPony(c, {
        x: x, y: y + 60 * f.s * S, k: f.s * S * UNIT * 1.1, dir: dirF, t: time, ph: 0, run: 0,
        coat: COAT_SKY, mane: [COLORS.neon, COLORS.rose, COLORS.magenta], horn: false, wings: true, flying: true, seed: f.ph
      });
      c.globalAlpha = 1;
    });

    // montanhas, castelo e colinas (parallax)
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      c.drawImage(L.img, -camX * L.f, 0);
    }

    // chão
    c.drawImage(groundImg, 0, y0, vw, gh + 2);
    // névoa do horizonte
    const fog = c.createLinearGradient(0, y0 - 26, 0, y0 + gh * .22);
    fog.addColorStop(0, 'rgba(247,168,213,0)');
    fog.addColorStop(.35, 'rgba(232,62,140,.22)');
    fog.addColorStop(1, 'rgba(109,25,168,0)');
    c.fillStyle = fog; c.fillRect(0, y0 - 26, vw, gh * .22 + 26);

    // tufos de grama (só os visíveis)
    c.lineCap = 'round';
    for (let i = 0; i < grass.length; i++) {
      const g = grass[i];
      const x = g.u * worldW - camX;
      if (x < -20 || x > vw + 20) continue;
      const y = groundY(g.t), k = S * persp(g.t);
      c.strokeStyle = E.rgba(g.c, g.a); c.lineWidth = 1.4 * k;
      const sw = Math.sin(time * 1.4 + g.u * 40) * 2 * k;
      c.beginPath();
      c.moveTo(x - 3 * k, y); c.quadraticCurveTo(x - 3 * k + sw * .5, y - 7 * k * g.s, x - 5 * k + sw, y - 12 * k * g.s);
      c.moveTo(x, y); c.quadraticCurveTo(x + sw * .5, y - 10 * k * g.s, x + sw, y - 17 * k * g.s);
      c.moveTo(x + 3 * k, y); c.quadraticCurveTo(x + 3 * k + sw * .5, y - 7 * k * g.s, x + 5 * k + sw, y - 12 * k * g.s);
      c.stroke();
    }

    // objetos ordenados por profundidade
    const items = [];
    const inView = function (x, m) { return x > -m && x < vw + m; };
    decor.forEach(function (d) { const x = d.u * worldW - camX; if (inView(x, 140)) items.push({ t: d.t, x: x, d: d, kind: d.k }); });
    npcs.forEach(function (n) { const x = n.u * worldW - camX; if (inView(x, 180)) items.push({ t: n.t, x: x, d: n, kind: 'npc' }); });
    hearts.forEach(function (h) { if (h.got) return; const x = h.u * worldW - camX; if (inView(x, 120)) items.push({ t: h.t, x: x, d: h, kind: 'heart' }); });
    items.push({ t: player.t, x: player.u * worldW - camX, d: player, kind: 'player' });
    items.sort(function (a, b) { return a.t - b.t; });

    // anéis de coleta (no chão)
    rings.forEach(function (r) {
      const x = r.u * worldW - camX, y = groundY(r.t), k = S * persp(r.t);
      const e = 1 - Math.pow(1 - r.age / 1.1, 3);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = (1 - r.age / 1.1) * .8;
      c.strokeStyle = COLORS.rose; c.lineWidth = 2.5 * k;
      c.beginPath(); c.ellipse(x, y, e * 130 * k, e * 42 * k, 0, 0, TAU); c.stroke();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    });

    for (let i = 0; i < items.length; i++) {
      const it = items[i], y = groundY(it.t), k = S * persp(it.t);
      if (it.kind === 'crystal') drawCrystal(c, it.x, y, k * 1.1 * it.d.s, it.d);
      else if (it.kind === 'tree') drawTree(c, it.x, y, k * .9 * it.d.s, it.d);
      else if (it.kind === 'flower') drawFlower(c, it.x, y, k * 1.15 * it.d.s, it.d);
      else if (it.kind === 'heart') drawHeartItem(c, it.x, y, k * 1.6, it.d);
      else if (it.kind === 'npc') {
        c.fillStyle = 'rgba(0,0,0,.32)';
        c.beginPath(); c.ellipse(it.x, y, 46 * k * UNIT, 9 * k * UNIT, 0, 0, TAU); c.fill();
        drawPony(c, { x: it.x, y: y, k: k * UNIT * .86, dir: it.d.dir, t: time, ph: 0, run: 0, coat: it.d.coat, mane: it.d.mane, horn: false, wings: it.d.wings, seed: it.d.seed });
      } else {
        const kp = k * UNIT;
        // sombra + aura
        c.fillStyle = 'rgba(0,0,0,.4)';
        c.beginPath(); c.ellipse(it.x, y, 50 * kp, 10 * kp, 0, 0, TAU); c.fill();
        c.globalCompositeOperation = 'lighter';
        const gs = 240 * kp;
        c.globalAlpha = .38;
        c.drawImage(glowSprite(COLORS.neon, 128), it.x - gs / 2, y - gs * .72, gs, gs);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        drawPony(c, {
          x: it.x, y: y, k: kp, dir: player.dir, t: time, ph: player.ph, run: player.run,
          coat: COAT_PLAYER, mane: MANE_PLAYER, horn: true, wings: false, seed: 0
        });
        // brilho na ponta do chifre
        c.globalCompositeOperation = 'lighter';
        const hx = it.x + player.dir * 84 * kp, hy = y - 174 * kp;
        const hs = 46 * kp * (.85 + .15 * Math.sin(time * 4));
        c.drawImage(glowSprite(COLORS.ivory, 64), hx - hs / 2, hy - hs / 2, hs, hs);
        c.fillStyle = COLORS.ivory;
        drawStar4(c, hx, hy, 9 * kp, time * .8);
        c.globalCompositeOperation = 'source-over';
      }
    }

    // vaga-lumes em primeiro plano
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      const x = (((f.x * (vw + 200) - camX * 1.15 + Math.sin(time * f.sp + f.ph) * 30) % (vw + 200)) + (vw + 200)) % (vw + 200) - 100;
      const y = y0 * .9 + f.y * (vh - y0 * .9) + Math.cos(time * f.sp * 1.3 + f.ph) * 14;
      c.globalAlpha = .35 + .65 * Math.abs(Math.sin(time * f.sp * 2 + f.ph));
      const s = f.r * 6 * S;
      c.drawImage(glowSprite(f.c, 32), x - s, y - s, s * 2, s * 2);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

    // vinheta
    const vg = c.createRadialGradient(vw / 2, vh * .55, Math.min(vw, vh) * .35, vw / 2, vh * .55, Math.max(vw, vh) * .78);
    vg.addColorStop(0, 'rgba(8,5,9,0)'); vg.addColorStop(1, 'rgba(8,5,9,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, vw, vh);

    drawCompass(c);
  }

  /* Setinha nas bordas que aponta para o coração mais próximo fora da tela */
  function drawCompass(c) {
    if (state !== 'play') return;
    let best = null, bd = 1e9;
    const px = player.u * worldW;
    hearts.forEach(function (h) {
      if (h.got) return;
      const d = Math.abs(h.u * worldW - px);
      if (d < bd) { bd = d; best = h; }
    });
    if (!best) return;
    const sx = best.u * worldW - camX;
    if (sx > 40 && sx < vw - 40) return;
    const left = sx <= 40;
    const x = left ? 34 : vw - 34;
    const y = clamp(groundY(best.t) - 50 * S, 96, vh - 120);
    const pulse = .6 + .4 * Math.sin(time * 4);
    c.save();
    c.globalAlpha = .55 + .4 * pulse;
    c.globalCompositeOperation = 'lighter';
    const gs = 70;
    c.drawImage(glowSprite(COLORS.magenta, 64), x - gs / 2, y - gs / 2, gs, gs);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = COLORS.rose;
    fillHeart(c, x + (left ? 6 : -6), y, 22, 0);
    c.restore();
    // chevron
    c.save();
    c.globalAlpha = .5 + .4 * pulse;
    c.strokeStyle = COLORS.rose; c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
    const ax = left ? 16 : vw - 16;
    c.beginPath();
    c.moveTo(ax + (left ? 6 : -6), y - 9); c.lineTo(ax, y); c.lineTo(ax + (left ? 6 : -6), y + 9);
    c.stroke();
    c.restore();
  }

  /* ---------------------------------------------------------------
     Laço principal
     --------------------------------------------------------------- */
  function frame(now) {
    if (!running) return;
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000));
    last = now;
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }
  function startLoop() {
    if (running) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() { running = false; cancelAnimationFrame(raf); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopLoop(); else startLoop(); });

  /* ---------------------------------------------------------------
     Telas: início e vitória
     --------------------------------------------------------------- */
  function startGame() {
    if (state === 'play') return;
    state = 'play';
    startOverlay.classList.add('is-hidden');
    startOverlay.setAttribute('aria-hidden', 'true');
    hud.classList.remove('is-hidden');
    if (statusEl) statusEl.textContent = 'Jogo iniciado. Colete ' + heartsToCollect + ' corações.';
    canvas.focus({ preventScroll: true });
  }

  const winTimers = [];
  let winLoop = 0;
  function showWin() {
    winOverlay.classList.remove('is-hidden');
    winOverlay.setAttribute('aria-hidden', 'false');
    hud.classList.add('is-hidden');
    const l1 = $('winLine1'), l2 = $('winLine2'), l3 = $('winLine3'), acts = $('winActions');
    const at = function (ms, fn) { winTimers.push(setTimeout(fn, reduceMotion ? Math.min(ms, 400) : ms)); };
    at(500, function () { l1.classList.add('show'); burstWin(); });
    at(3200, function () { l2.classList.add('show'); });
    at(6200, function () { l3.classList.add('show'); burstWin(); burstWin(); });
    at(8600, function () { acts.classList.add('show'); (againBtn.previousElementSibling || againBtn).focus({ preventScroll: true }); });
    if (winFx && !reduceMotion) {
      winLoop = setInterval(function () {
        winFx.emit(rand(0, winFx.w), winFx.h + 10, 1, {
          angle: -Math.PI / 2, spread: .7, speed: [40, 120], size: [1.6, 3.4], life: [3, 5],
          colors: [COLORS.magenta, COLORS.rose, COLORS.neon], gravity: -10, type: ['heart', 'spark']
        });
      }, 240);
    }
  }
  function burstWin() {
    if (!winFx) return;
    winFx.resize();
    winFx.emitHeart(winFx.w / 2, winFx.h * .42, Math.min(winFx.w, winFx.h) * .5, 120, { speed: 1.5, gravity: 5 });
    winFx.emit(winFx.w / 2, winFx.h * .42, 60, { speed: [60, 280], size: [1.6, 4], life: [1, 2.4], gravity: 24, type: ['spark', 'star', 'heart'] });
  }

  function resetGame() {
    winTimers.forEach(clearTimeout); winTimers.length = 0;
    clearInterval(winLoop);
    if (winFx) winFx.clear();
    fx.clear();
    ['winLine1', 'winLine2', 'winLine3', 'winActions'].forEach(function (id) { $(id).classList.remove('show'); });
    winOverlay.classList.add('is-hidden');
    winOverlay.setAttribute('aria-hidden', 'true');
    collected = 0; rings = [];
    player.u = .3; player.t = .55; player.dir = 1; player.vx = player.vt = 0;
    camX = 0;
    hearts = []; buildWorld();
    buildPips(); updateHud(false);
    hud.classList.remove('is-hidden');
    state = 'play';
  }

  startBtn.addEventListener('click', startGame);
  againBtn.addEventListener('click', resetGame);
  window.addEventListener('resize', E.debounce(layout, 160));

  /* ---------------------------------------------------------------
     Início
     --------------------------------------------------------------- */
  buildPips();
  updateHud(false);
  layout();
  camX = clamp(player.u * worldW - vw * .5, 0, camMax);
  startLoop();
  startBtn.focus({ preventScroll: true });
})();
