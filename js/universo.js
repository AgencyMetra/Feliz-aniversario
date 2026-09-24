/* =====================================================================
   universo.js — página "Nosso Universo"

   1) Céu interativo: estrelas, nebulosas, lua, meteoros e duas luzes que
      se aproximam a cada toque até explodirem em um coração de partículas.
   2) "Um pequeno universo para você": tela escura em que as estrelas
      formam um coração enquanto três frases aparecem (cerca de 12 s).

   Depende do main.js (objeto "Encanto").
   ===================================================================== */

// ==============================
// PERSONALIZAÇÃO
// ==============================
const universeFinalMessage = "E foi assim que dois universos se encontraram.";
const cosmosLines = ["Você.", "Meu lugar favorito no universo.", "Feliz aniversário."];
// ==============================

(function () {
  'use strict';

  const E = Encanto;
  const TAU = E.TAU, COLORS = E.COLORS, rand = E.rand, pick = E.pick, clamp = E.clamp, lerp = E.lerp;
  const easeInOut = E.easeInOut, glowSprite = E.glowSprite, drawStar4 = E.drawStar4;
  const reduceMotion = E.reduceMotion;
  const $ = function (id) { return document.getElementById(id); };

  /* Ajusta o texto das frases da experiência (se o usuário alterou acima) */
  [$('cosmosLine1'), $('cosmosLine2'), $('cosmosLine3')].forEach(function (el, i) {
    if (el && cosmosLines[i]) el.textContent = cosmosLines[i];
  });

  /* =================================================================
     1) CÉU INTERATIVO
     ================================================================= */
  const stage = $('universeStage');
  const cv = $('universeCanvas');
  const fxCv = $('universeFx');
  if (stage && cv && fxCv) initSky();

  function initSky() {
    const ctx = cv.getContext('2d');
    const fx = new E.ParticleLayer(fxCv, { max: 700 });
    const hint = $('meetHint');
    const message = $('meetMessage');
    const actions = $('meetActions');
    const againBtn = $('meetAgain');

    let w = 1, h = 1, dpr = 1;
    let stars = [], nebula = null, moon = null, moonR = 30, meteors = [];
    let time = 0, last = 0, raf = 0, running = false, paused = false, visible = true;
    let offX = 0, offY = 0, tx = 0, ty = 0;
    let progress = 0, target = 0, step = 0, merged = false, mergeT = 0, flash = 0;
    let sparkT = 0, nextMeteor = 1.2, heartT = 0, rings = [];
    const timers = [];

    const STEPS = [.3, .58, .82, 1];
    const HINTS = [
      'Toque para aproximar as duas luzes ✦',
      'Elas já sentem uma à outra…',
      'Mais perto…',
      'Só mais um toque.'
    ];
    const lights = [
      { sx: .14, sy: .72, color: COLORS.neon, core: '#EBD9FF', ph: 0 },
      { sx: .86, sy: .42, color: COLORS.magenta, core: '#FFD3EB', ph: 2.1 }
    ];
    const meet = { x: .5, y: .55 };

    /* ---------- Construção (depende do tamanho) ---------- */
    function buildStars() {
      const n = clamp(Math.round((w * h) / 4600), 90, 300);
      stars = [];
      for (let i = 0; i < n; i++) {
        const d = rand(.15, 1);
        const q = Math.random();
        stars.push({
          x: rand(0, w), y: rand(0, h), d: d,
          r: .3 + d * rand(.6, 1.5),
          a: rand(.35, 1), tw: rand(.6, 2.4), ph: rand(0, TAU),
          c: q < .2 ? COLORS.rose : (q < .34 ? '#C9A6FF' : COLORS.ivory)
        });
      }
    }

    function buildNebula() {
      nebula = document.createElement('canvas');
      nebula.width = Math.max(2, Math.ceil(w / 2));
      nebula.height = Math.max(2, Math.ceil(h / 2));
      const g = nebula.getContext('2d');
      const nw = nebula.width, nh = nebula.height, m = Math.max(nw, nh);
      const base = g.createLinearGradient(0, 0, 0, nh);
      base.addColorStop(0, '#0a0311');
      base.addColorStop(.55, '#12061c');
      base.addColorStop(1, '#1a0824');
      g.fillStyle = base;
      g.fillRect(0, 0, nw, nh);
      g.globalCompositeOperation = 'lighter';
      const blob = function (x, y, r, hex, a) {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, E.rgba(hex, a));
        gr.addColorStop(.5, E.rgba(hex, a * .38));
        gr.addColorStop(1, E.rgba(hex, 0));
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      };
      blob(nw * .16, nh * .28, m * .55, COLORS.violet, .55);
      blob(nw * .82, nh * .70, m * .62, COLORS.roseDark, .34);
      blob(nw * .55, nh * .18, m * .42, COLORS.neon, .22);
      blob(nw * .30, nh * .88, m * .40, COLORS.violet, .36);
      blob(nw * .92, nh * .14, m * .30, COLORS.magenta, .16);
      // faixa diagonal (uma "via láctea")
      g.save();
      g.translate(nw * .5, nh * .5);
      g.rotate(-.5);
      g.scale(1, .16);
      const band = g.createRadialGradient(0, 0, 0, 0, 0, m * .85);
      band.addColorStop(0, E.rgba(COLORS.rose, .30));
      band.addColorStop(.45, E.rgba(COLORS.neon, .12));
      band.addColorStop(1, E.rgba(COLORS.neon, 0));
      g.fillStyle = band;
      g.fillRect(-m, -m, m * 2, m * 2);
      g.restore();
    }

    function buildMoon() {
      moonR = clamp(Math.min(w, h) * .055, 22, 46);
      moon = document.createElement('canvas');
      moon.width = moon.height = Math.ceil(moonR * 2 + 8);
      const m = moon.getContext('2d');
      const c = moonR + 4;
      m.fillStyle = COLORS.ivory;
      m.beginPath(); m.arc(c, c, moonR, 0, TAU); m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.beginPath(); m.arc(c + moonR * .42, c - moonR * .12, moonR * .92, 0, TAU); m.fill();
    }

    function resize() {
      const r = stage.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (stars.length && Math.abs(r.width - w) < 2 && Math.abs(r.height - h) < 140) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars(); buildNebula(); buildMoon();
      fx.resize();
      if (!running) draw(0);
    }

    /* ---------- Estado das luzes ---------- */
    function lightPos(i) {
      const L = lights[i];
      const e = easeInOut(clamp(progress, 0, 1));
      const bob = reduceMotion ? 0 : (1 - e * .75) * 9;
      return {
        x: lerp(L.sx * w, meet.x * w, e) + Math.cos(time * .7 + L.ph) * bob,
        y: lerp(L.sy * h, meet.y * h, e) + Math.sin(time * .9 + L.ph) * bob
      };
    }

    function setHint(text) {
      hint.classList.remove('is-gone');
      hint.textContent = text;
    }

    function advance(ev) {
      if (merged) return;
      if (step < STEPS.length) {
        target = STEPS[step];
        step++;
        setHint(step < STEPS.length ? HINTS[step] : 'Agora…');
        if (ev && ev.clientX != null) {
          const r = fxCv.getBoundingClientRect();
          fx.emit(ev.clientX - r.left, ev.clientY - r.top, 12, {
            speed: [30, 120], size: [1.4, 3.2], life: [.7, 1.4], gravity: -8,
            colors: [COLORS.rose, COLORS.neon, COLORS.ivory], type: ['spark', 'star']
          });
        }
      }
    }

    function doMerge() {
      merged = true; mergeT = 0; flash = 1; heartT = 0;
      const mx = meet.x * w, my = meet.y * h;
      const size = Math.min(w, h) * .6;
      fx.emitHeart(mx, my, size, 240, { speed: 1.55, gravity: 4, minLife: 2.6, maxLife: 4 });
      timers.push(setTimeout(function () {
        fx.emitHeart(mx, my, size * .6, 130, {
          speed: 1.35, colors: [COLORS.ivory, COLORS.rose], type: ['spark', 'star'], minLife: 2.2, maxLife: 3.4
        });
      }, 260));
      fx.emit(mx, my, 110, {
        speed: [60, 320], size: [1.4, 3.8], life: [1, 2.4], gravity: 20, type: ['spark', 'star', 'heart']
      });
      rings.push({ t: 0 }, { t: -.28 });
      hint.classList.add('is-gone');
      timers.push(setTimeout(function () {
        message.textContent = universeFinalMessage;
        message.classList.add('show');
      }, reduceMotion ? 0 : 900));
      timers.push(setTimeout(function () { actions.hidden = false; }, reduceMotion ? 0 : 3000));
    }

    function restart() {
      timers.forEach(clearTimeout); timers.length = 0;
      progress = 0; target = 0; step = 0; merged = false; mergeT = 0; flash = 0; rings = [];
      fx.clear();
      message.classList.remove('show');
      message.textContent = '';
      actions.hidden = true;
      setHint(HINTS[0]);
      stage.focus({ preventScroll: true });
    }

    /* ---------- Meteoros ---------- */
    function spawnMeteor() {
      const dir = Math.random() < .5 ? 1 : -1;
      const ang = rand(.32, .6);
      const sp = rand(520, 860);
      meteors.push({
        x: dir > 0 ? rand(-40, w * .55) : rand(w * .45, w + 40),
        y: rand(-20, h * .36),
        vx: Math.cos(ang) * sp * dir, vy: Math.sin(ang) * sp,
        len: rand(90, 190), age: 0, life: rand(.7, 1.15)
      });
    }

    /* ---------- Atualização e desenho ---------- */
    function update(dt) {
      time += dt;
      offX += (tx - offX) * (1 - Math.exp(-dt * 3));
      offY += (ty - offY) * (1 - Math.exp(-dt * 3));

      if (progress < target) {
        progress = Math.min(target, progress + (target - progress) * (1 - Math.exp(-dt * 2.4)) + dt * .02);
        if (target - progress < .0015) progress = target;
      }
      if (target >= 1 && progress >= 1 && !merged) doMerge();

      // rastro de brilho atrás das luzes
      sparkT += dt;
      if (sparkT > .06 && !merged && !reduceMotion) {
        sparkT = 0;
        for (let i = 0; i < 2; i++) {
          const p = lightPos(i);
          fx.emit(p.x, p.y, 1, {
            speed: [4, 22], size: [1, 2.4], life: [.8, 1.5], gravity: 0,
            colors: [lights[i].color, COLORS.ivory], type: 'spark'
          });
        }
      }

      if (merged) {
        mergeT += dt;
        flash = Math.max(0, flash - dt * .9);
        heartT += dt;
        if (heartT > .55 && !reduceMotion) {
          heartT = 0;
          fx.emit(meet.x * w + rand(-24, 24), meet.y * h, 1, {
            angle: -Math.PI / 2, spread: 1.3, speed: [20, 64], size: [1.6, 3], life: [2, 3.4], gravity: -8,
            colors: [COLORS.magenta, COLORS.rose], type: 'heart'
          });
        }
      }
      rings.forEach(function (r) { r.t += dt * .55; });
      rings = rings.filter(function (r) { return r.t < 1; });

      if (!reduceMotion) {
        nextMeteor -= dt;
        if (nextMeteor <= 0) { spawnMeteor(); nextMeteor = rand(2.6, 6.2); }
        meteors.forEach(function (m) { m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt; });
        meteors = meteors.filter(function (m) { return m.age < m.life; });
      }
    }

    function drawLight(x, y, L, scale, beat) {
      const pulse = (reduceMotion ? 1 : 1 + .08 * Math.sin(time * 2 + L.ph)) * (beat || 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .95;
      const s = 150 * scale * pulse;
      ctx.drawImage(glowSprite(L.color, 128), x - s / 2, y - s / 2, s, s);
      ctx.globalAlpha = 1;
      const s2 = 58 * scale * pulse;
      ctx.drawImage(glowSprite('#FFFFFF', 64), x - s2 / 2, y - s2 / 2, s2, s2);
      ctx.fillStyle = L.core;
      drawStar4(ctx, x, y, 24 * scale * pulse, time * .12);
      ctx.globalCompositeOperation = 'source-over';
    }

    function draw() {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const sc = window.pageYOffset || 0;

      // nebulosa (com leve parallax)
      ctx.drawImage(nebula, -w * .05 - offX * 12, -h * .05 - offY * 8 - sc * .04, w * 1.1, h * 1.1);

      // lua
      const mx = w * .86, my = clamp(h * .24, 120, 220);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .55;
      ctx.drawImage(glowSprite(COLORS.rose, 128), mx - moonR * 3.6, my - moonR * 3.6, moonR * 7.2, moonR * 7.2);
      ctx.globalAlpha = .35;
      ctx.drawImage(glowSprite(COLORS.neon, 128), mx - moonR * 5, my - moonR * 5, moonR * 10, moonR * 10);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = .95;
      ctx.save();
      ctx.translate(mx - offX * 5, my - offY * 4);
      ctx.rotate(-.28);
      ctx.drawImage(moon, -moon.width / 2, -moon.height / 2);
      ctx.restore();

      // estrelas com profundidade
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const x = (((s.x + offX * s.d * 26) % w) + w) % w;
        const y = (((s.y + offY * s.d * 16 - sc * .1 * s.d) % h) + h) % h;
        const tw = reduceMotion ? .8 : .55 + .45 * Math.sin(time * s.tw + s.ph);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, TAU);
        ctx.fill();
        if (s.r > 1.2) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowSprite(COLORS.neon, 32), x - 9, y - 9, 18, 18);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.globalAlpha = 1;

      // meteoros
      ctx.globalCompositeOperation = 'lighter';
      meteors.forEach(function (m) {
        const k = m.age / m.life;
        const a = k < .15 ? k / .15 : 1 - (k - .15) / .85;
        const sp = Math.hypot(m.vx, m.vy);
        const tx2 = m.x - (m.vx / sp) * m.len, ty2 = m.y - (m.vy / sp) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tx2, ty2);
        g.addColorStop(0, 'rgba(255,244,251,' + (.95 * a).toFixed(3) + ')');
        g.addColorStop(.4, 'rgba(247,168,213,' + (.4 * a).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx2, ty2); ctx.stroke();
        ctx.globalAlpha = a;
        ctx.drawImage(glowSprite(COLORS.ivory, 32), m.x - 9, m.y - 9, 18, 18);
        ctx.globalAlpha = 1;
      });
      ctx.globalCompositeOperation = 'source-over';

      // luzes
      const scale = clamp(Math.min(w, h) / 700, .72, 1.25);
      if (!merged) {
        const a = lightPos(0), b = lightPos(1);
        const lineA = .16 * (1 - clamp(progress, 0, 1));
        if (lineA > .005) {
          const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          g.addColorStop(0, E.rgba(COLORS.neon, lineA));
          g.addColorStop(.5, E.rgba(COLORS.ivory, lineA * .3));
          g.addColorStop(1, E.rgba(COLORS.magenta, lineA));
          ctx.strokeStyle = g; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        drawLight(a.x, a.y, lights[0], scale * (1 + progress * .25));
        drawLight(b.x, b.y, lights[1], scale * (1 + progress * .25));
      } else {
        const mxp = meet.x * w, myp = meet.y * h;
        const beat = reduceMotion ? 1 : 1 + .09 * Math.pow(Math.abs(Math.sin(time * 2.1)), 10);
        drawLight(mxp, myp, lights[0], scale * 1.7, beat);
        drawLight(mxp, myp, lights[1], scale * 1.35, beat);
        // ondas de choque
        rings.forEach(function (r) {
          if (r.t <= 0) return;
          const e = 1 - Math.pow(1 - r.t, 3);
          ctx.globalAlpha = (1 - r.t) * .7;
          ctx.strokeStyle = COLORS.rose;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(mxp, myp, e * Math.max(w, h) * .55, 0, TAU); ctx.stroke();
        });
        ctx.globalAlpha = 1;
        // clarão
        if (flash > .01) {
          const fr = Math.max(w, h) * (.25 + (1 - flash) * .45);
          const g = ctx.createRadialGradient(mxp, myp, 0, mxp, myp, fr);
          g.addColorStop(0, 'rgba(255,244,251,' + (flash * .9).toFixed(3) + ')');
          g.addColorStop(.4, 'rgba(232,62,140,' + (flash * .35).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(168,85,247,0)');
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = g;
          ctx.fillRect(mxp - fr, myp - fr, fr * 2, fr * 2);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    /* ---------- Laço de animação ---------- */
    function frame(now) {
      if (!running) return;
      const dt = Math.min(.05, Math.max(.001, (now - last) / 1000));
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      const should = visible && !paused && !document.hidden;
      if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 }).observe(stage);
    }
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', E.debounce(resize, 180));
    window.universeSetPaused = function (p) { paused = p; sync(); };

    /* ---------- Interação ---------- */
    stage.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('button, a')) return;
      advance(e);
    });
    stage.addEventListener('keydown', function (e) {
      if (e.target !== stage) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(null); }
    });
    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      const r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - .5) * 2;
      ty = ((e.clientY - r.top) / r.height - .5) * 2;
    });
    stage.addEventListener('pointerleave', function () { tx = 0; ty = 0; });
    againBtn.addEventListener('click', restart);

    resize();
    draw();
    sync();
  }

  /* =================================================================
     2) UM PEQUENO UNIVERSO PARA VOCÊ
     ================================================================= */
  const overlay = $('cosmosOverlay');
  const ccv = $('cosmosCanvas');
  const openBtn = $('cosmosOpen');
  if (overlay && ccv && openBtn) initCosmos();

  function initCosmos() {
    const cctx = ccv.getContext('2d');
    const closeBtn = $('cosmosClose');
    const backBtn = $('cosmosBack');
    const endEl = $('cosmosEnd');
    const lines = [$('cosmosLine1'), $('cosmosLine2'), $('cosmosLine3')];

    let cw = 1, ch = 1, cdpr = 1;
    let heartStars = [], dust = [], hcx = 0, hcy = 0, hsize = 100;
    let isOpen = false, raf = 0, running = false, t0 = 0, opener = null, stopTimer = 0;
    let timers = [];

    const T_START = 1.2;   // as estrelas começam a viajar
    const T_FORMED = 8.0;  // coração completo
    const later = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    const clearTimers = function () { timers.forEach(clearTimeout); timers = []; };

    function build() {
      hsize = Math.min(cw * .8, ch * .5);
      hcx = cw / 2;
      hcy = ch * .36;
      const s = hsize / 32;
      heartStars = [];
      const nOut = 170, nIn = 100;
      const cols = [COLORS.ivory, COLORS.rose, COLORS.magenta, COLORS.neon, COLORS.ivory];
      for (let i = 0; i < nOut + nIn; i++) {
        let hp, k;
        if (i < nOut) {
          hp = E.heartPoint((i / nOut) * TAU + rand(-.02, .02));
          k = 1 + rand(-.025, .025);
        } else {
          hp = E.heartPoint(rand(0, TAU));
          k = Math.sqrt(Math.random()) * .9;
        }
        heartStars.push({
          tx: hp.x * k * s, ty: (hp.y - 2.5) * k * s,
          sx: rand(0, cw), sy: rand(0, ch),
          curve: rand(-90, 90),
          delay: rand(0, 2.6), dur: rand(3.2, 4.6),
          r: rand(.7, i < nOut ? 2 : 1.5),
          c: pick(cols), tw: rand(.8, 2.6), ph: rand(0, TAU)
        });
      }
      dust = [];
      const nd = clamp(Math.round((cw * ch) / 9000), 50, 150);
      for (let i = 0; i < nd; i++) {
        dust.push({ x: rand(0, cw), y: rand(0, ch), r: rand(.3, 1.2), a: rand(.2, .7), tw: rand(.5, 2), ph: rand(0, TAU), c: Math.random() < .25 ? COLORS.rose : COLORS.ivory });
      }
    }

    function resize() {
      const r = overlay.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      cdpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = r.width; ch = r.height;
      ccv.width = Math.round(cw * cdpr);
      ccv.height = Math.round(ch * cdpr);
      cctx.setTransform(cdpr, 0, 0, cdpr, 0, 0);
      build();
    }

    function draw(t) {
      cctx.globalAlpha = 1;
      cctx.globalCompositeOperation = 'source-over';
      cctx.fillStyle = '#030105';
      cctx.fillRect(0, 0, cw, ch);

      // névoa sutil atrás do coração
      const fog = clamp((t - 3) / 5, 0, 1);
      if (fog > 0) {
        cctx.globalCompositeOperation = 'lighter';
        const fr = hsize * 1.1;
        const g = cctx.createRadialGradient(hcx, hcy, 0, hcx, hcy, fr);
        g.addColorStop(0, 'rgba(109,25,168,' + (.34 * fog).toFixed(3) + ')');
        g.addColorStop(.55, 'rgba(181,27,99,' + (.12 * fog).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(109,25,168,0)');
        cctx.fillStyle = g;
        cctx.fillRect(hcx - fr, hcy - fr, fr * 2, fr * 2);
        cctx.globalCompositeOperation = 'source-over';
      }

      // poeira estelar de fundo
      for (let i = 0; i < dust.length; i++) {
        const d = dust[i];
        cctx.globalAlpha = d.a * (reduceMotion ? .8 : .5 + .5 * Math.sin(t * d.tw + d.ph));
        cctx.fillStyle = d.c;
        cctx.beginPath(); cctx.arc(d.x, d.y, d.r, 0, TAU); cctx.fill();
      }

      // pulsação do coração já formado
      const formed = clamp((t - T_FORMED) / 1.2, 0, 1);
      const beat = reduceMotion ? 1 : 1 + formed * .045 * Math.pow(Math.abs(Math.sin(t * 2.2)), 8);

      // preenchimento suave do coração (aparece quando forma)
      if (formed > 0) {
        cctx.globalCompositeOperation = 'lighter';
        cctx.globalAlpha = formed * .07;
        cctx.fillStyle = COLORS.magenta;
        E.fillHeart(cctx, hcx, hcy, hsize * beat, 0);
        cctx.globalCompositeOperation = 'source-over';
      }

      // estrelas que formam o coração
      for (let i = 0; i < heartStars.length; i++) {
        const s = heartStars[i];
        const p = clamp((t - T_START - s.delay) / s.dur, 0, 1);
        const e = easeInOut(p);
        const swirl = Math.sin(e * Math.PI) * s.curve;
        const dx = s.tx * beat, dy = s.ty * beat;
        const x = lerp(s.sx, hcx + dx, e) + swirl * .6;
        const y = lerp(s.sy, hcy + dy, e) + swirl * .4 * (s.curve < 0 ? -1 : 1);
        const tw = reduceMotion ? .9 : .6 + .4 * Math.sin(t * s.tw + s.ph);
        const fin = p >= 1;
        cctx.globalAlpha = clamp(.55 + e * .45, 0, 1) * tw;
        cctx.fillStyle = s.c;
        cctx.beginPath();
        cctx.arc(x, y, s.r * (fin ? 1.15 : 1), 0, TAU);
        cctx.fill();
        if (s.r > 1.1 || fin) {
          cctx.globalCompositeOperation = 'lighter';
          cctx.globalAlpha = (fin ? .8 : .4) * tw;
          const gs = s.r * (fin ? 9 : 6);
          cctx.drawImage(glowSprite(s.c === COLORS.ivory ? COLORS.rose : s.c, 32), x - gs, y - gs, gs * 2, gs * 2);
          cctx.globalCompositeOperation = 'source-over';
        }
      }
      cctx.globalAlpha = 1;
    }

    function frame(now) {
      if (!running) return;
      draw((now - t0) / 1000);
      raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stopLoop() { running = false; cancelAnimationFrame(raf); }

    function showLine(i, on) { if (lines[i]) lines[i].classList.toggle('show', on); }

    function open() {
      if (isOpen) return;
      isOpen = true;
      opener = document.activeElement;
      clearTimeout(stopTimer);
      clearTimers();
      lines.forEach(function (_, i) { showLine(i, false); });
      endEl.classList.remove('show');
      if (window.universeSetPaused) window.universeSetPaused(true);

      resize();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      t0 = performance.now();
      startLoop();
      closeBtn.focus({ preventScroll: true });

      const q = reduceMotion ? .35 : 1; // com movimento reduzido, tudo mais curto
      later(2200 * q, function () { showLine(0, true); });
      later(5200 * q, function () { showLine(0, false); });
      later(5900 * q, function () { showLine(1, true); });
      later(9400 * q, function () { showLine(1, false); });
      later(10100 * q, function () { showLine(2, true); });
      later(12400 * q, function () { endEl.classList.add('show'); });
      if (reduceMotion) later(0, function () { t0 = performance.now() - 20000; });
    }

    function close(backToSky) {
      if (!isOpen) return;
      isOpen = false;
      clearTimers();
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      lines.forEach(function (_, i) { showLine(i, false); });
      endEl.classList.remove('show');
      document.documentElement.style.overflow = '';
      stopTimer = setTimeout(stopLoop, 1200);
      if (window.universeSetPaused) window.universeSetPaused(false);
      const st = $('universeStage');
      if (backToSky && st) {
        st.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        st.focus({ preventScroll: true });
      } else if (opener && opener.focus) {
        opener.focus({ preventScroll: true });
      }
    }

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', function () { close(false); });
    backBtn.addEventListener('click', function () { close(true); });

    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
      if (e.key === 'Tab') {
        const items = [closeBtn];
        if (endEl.classList.contains('show')) items.push(backBtn);
        const idx = items.indexOf(document.activeElement);
        e.preventDefault();
        let n = idx + (e.shiftKey ? -1 : 1);
        if (n < 0) n = items.length - 1;
        if (n >= items.length) n = 0;
        items[n].focus();
      }
    });

    window.addEventListener('resize', E.debounce(function () { if (isOpen) resize(); }, 200));
    resize();
  }
})();
