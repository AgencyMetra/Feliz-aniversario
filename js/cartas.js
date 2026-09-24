/* =====================================================================
   cartas.js — página de cartas (envelopes que se abrem em um modal)

   Depende do main.js (carregado antes), que fornece o objeto "Encanto".
   ===================================================================== */

// ==============================
// PERSONALIZAÇÃO DAS CARTAS
// ==============================
// Cada carta tem "title" (título do envelope) e "text" (o conteúdo).
// Para separar parágrafos, deixe uma linha em branco entre eles (\n\n).
// Você pode adicionar, remover ou reordenar cartas livremente.

const letters = [
  {
    title: "Quando eu penso em você",
    text:
      "Quando eu penso em você, o mundo desacelera. É como se todas as minhas preocupações resolvessem, por alguns segundos, fazer silêncio só para que eu possa ouvir o meu próprio coração dizendo o seu nome.\n\n" +
      "Eu penso em você de manhã, quando ainda estou entre o sono e o dia. Penso em você no meio da tarde, sem motivo nenhum, e sorrio à toa. Penso em você à noite, e é aí que eu tenho mais certeza: você virou o meu lugar favorito.\n\n" +
      "Não sei explicar direito o que você faz comigo. Só sei que, antes de você, eu vivia. Depois de você, eu passei a sentir a vida.\n\n" +
      "Feliz aniversário, meu amor."
  },
  {
    title: "Coisas que amo em você",
    text:
      "Eu amo o jeito como você ri quando algo realmente te pega de surpresa.\n\n" +
      "Amo a sua forma de ser diferente de todo mundo, sem pedir desculpas por isso. O estilo, o olhar, a atitude: tudo em você é autêntico, e isso é raro.\n\n" +
      "Amo o seu cuidado, mesmo quando você tenta disfarçar de indiferença.\n\n" +
      "Amo a sua força, e amo ainda mais os momentos em que você me deixa ver que também precisa de colo.\n\n" +
      "Amo as pequenas manias que só eu conheço e que guardo como se fossem tesouros.\n\n" +
      "E amo, principalmente, a forma como você faz o meu coração se sentir em casa.\n\n" +
      "A lista é infinita. Eu só parei aqui porque o papel acabou, não o amor."
  },
  {
    title: "Se você algum dia duvidar",
    text:
      "Se você algum dia duvidar, lembre-se disto:\n\n" +
      "Você é amada. Não porque faz tudo certo, nem porque é forte o tempo inteiro, mas porque é você.\n\n" +
      "Se um dia o espelho não te mostrar o que eu vejo, feche os olhos e confie em mim. Eu vejo a pessoa mais linda, intensa, com luz e sombra na medida exata, e não trocaria nenhuma parte.\n\n" +
      "Se a cabeça disser que você é demais, ou que não é suficiente, saiba que as duas coisas são mentira. Você é exatamente o que eu escolhi.\n\n" +
      "E se a dúvida for sobre nós, sobre o meu amor: eu escolho você hoje, e amanhã, e nos dias em que nem eu me entender direito.\n\n" +
      "Fica comigo. Eu fico contigo."
  },
  {
    title: "Para os nossos dias difíceis",
    text:
      "Vai ter dia difícil. Eu sei. Vai ter dia em que nada vai dar certo, em que o cansaço vai pesar mais que a vontade, em que você vai querer sumir do mundo por algumas horas.\n\n" +
      "Nesses dias, eu não quero consertar você, porque você não está quebrada. Quero sentar ao seu lado, ficar em silêncio se for preciso, e te lembrar que você não está sozinha.\n\n" +
      "Você não precisa ser forte o tempo todo comigo. Pode chorar, pode reclamar, pode ficar quieta. Eu vou estar aqui.\n\n" +
      "Todo mundo merece um lugar seguro. Eu quero ser o seu.\n\n" +
      "E quando a tempestade passar, como sempre passa, a gente respira fundo, olha para o céu e lembra que atravessou mais uma juntos."
  },
  {
    title: "Para o nosso futuro",
    text:
      "Eu não sei exatamente o que o futuro guarda. Mas sei quem eu quero ao meu lado quando ele chegar.\n\n" +
      "Quero viajar com você para lugares que a gente nunca viu, e voltar para casa percebendo que o melhor lugar continua sendo perto de você.\n\n" +
      "Quero envelhecer sabendo que cada história e cada risada tem o seu nome escrito em algum canto.\n\n" +
      "Quero sonhos grandes, planos pequenos e um monte de dias comuns que, com você, viram extraordinários.\n\n" +
      "Que este aniversário seja só mais um capítulo de uma história enorme. E que a gente continue escrevendo juntos, página por página, até a última.\n\n" +
      "Eu te amo. Hoje, amanhã e em todos os universos possíveis."
  }
];

// Assinatura no fim de cada carta (\n quebra a linha).
const letterSignature = "Com todo o meu amor,\n♡";

// ==============================
// FIM DA PERSONALIZAÇÃO
// ==============================

(function () {
  'use strict';

  const E = (typeof Encanto !== 'undefined') ? Encanto : null;
  const reduceMotion = E ? E.reduceMotion : false;

  const grid = document.getElementById('lettersGrid');
  const modal = document.getElementById('letterModal');
  if (!grid || !modal) return;

  const paper = document.getElementById('letterPaper');
  const numEl = document.getElementById('letterNum');
  const titleEl = document.getElementById('letterTitle2');
  const bodyEl = document.getElementById('letterBody');
  const signEl = document.getElementById('letterSign');
  const prevBtn = document.getElementById('letterPrev');
  const nextBtn = document.getElementById('letterNext');
  const closeBtn = document.getElementById('letterClose');
  const envStage = document.getElementById('envStage');
  const stage = document.getElementById('letterStage');
  const particleCanvas = document.getElementById('letterParticles');
  const layer = (E && particleCanvas) ? new E.ParticleLayer(particleCanvas, { max: 320 }) : null;

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const COLORS = E ? [E.COLORS.magenta, E.COLORS.rose, E.COLORS.neon, E.COLORS.ivory] : ['#E83E8C'];

  let current = 0;
  let opener = null;
  let timers = [];
  let isOpen = false;
  let revealed = false;
  let ambient = 0;

  const later = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
  const clearTimers = function () { timers.forEach(clearTimeout); timers = []; };
  const buttons = [];

  /* ---------- Lista de envelopes ---------- */
  function buildGrid() {
    grid.textContent = '';
    letters.forEach(function (letter, i) {
      const li = document.createElement('li');
      li.className = 'reveal';
      li.style.setProperty('--d', (i % 3) * 0.12 + 's');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'envelope';
      btn.setAttribute('aria-label', 'Abrir a carta ' + (i + 1) + ': ' + letter.title);
      btn.innerHTML =
        '<span class="env-body" aria-hidden="true">' +
          '<span class="env-paper"></span><span class="env-front"></span>' +
          '<span class="env-flap"></span><span class="env-seal">♡</span>' +
        '</span>' +
        '<span class="env-caption">' +
          '<span class="env-num">Carta ' + (ROMAN[i] || (i + 1)) + '</span>' +
          '<span class="env-title"></span>' +
        '</span>';
      btn.querySelector('.env-title').textContent = letter.title;
      btn.addEventListener('click', function (e) { openLetter(i, btn, e); });

      li.appendChild(btn);
      grid.appendChild(li);
      buttons.push(btn);
    });
  }

  /* ---------- Conteúdo da carta ---------- */
  function fillBody(index) {
    const letter = letters[index];
    numEl.textContent = 'Carta ' + (ROMAN[index] || (index + 1)) + ' de ' + (ROMAN[letters.length - 1] || letters.length);
    titleEl.textContent = letter.title;
    signEl.textContent = letterSignature;
    bodyEl.textContent = '';
    String(letter.text).split(/\n\s*\n/).forEach(function (para, i) {
      const p = document.createElement('p');
      p.style.setProperty('--p', i);
      p.textContent = para.trim();
      bodyEl.appendChild(p);
    });
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === letters.length - 1;
    paper.scrollTop = 0;
  }

  /* ---------- Partículas ---------- */
  function burst(x, y, n) {
    if (!layer) return;
    layer.emit(x, y, n, {
      speed: [40, 190], size: [1.6, 4], life: [1, 2], colors: COLORS, gravity: 26,
      type: ['spark', 'spark', 'star', 'heart']
    });
  }

  function heartBurst() {
    if (!layer) return;
    layer.resize();
    layer.emitHeart(layer.w / 2, Math.min(layer.h * .46, 340), Math.min(layer.w, 520) * .36, 70, { speed: 1.5 });
  }

  function startAmbient() {
    if (!layer || reduceMotion) return;
    stopAmbient();
    ambient = setInterval(function () {
      if (document.hidden) return;
      layer.emit(Math.random() * layer.w, layer.h + 8, 1, {
        angle: -Math.PI / 2, spread: .6, speed: [24, 60], size: [1.2, 2.8], life: [3, 5],
        colors: COLORS, gravity: -6, type: ['spark', 'spark', 'star']
      });
    }, 320);
  }
  function stopAmbient() { clearInterval(ambient); ambient = 0; }

  /* ---------- Abrir / revelar / fechar ---------- */
  function reveal() {
    if (!isOpen || revealed) return;
    revealed = true;
    clearTimers();
    modal.classList.add('flap-open', 'paper-out', 'is-revealed');
    heartBurst();
    later(reduceMotion ? 0 : 900, function () { if (isOpen) paper.focus({ preventScroll: true }); });
  }

  function openLetter(index, trigger, ev) {
    if (isOpen) return;
    current = index;
    opener = trigger || null;
    isOpen = true;
    revealed = false;
    clearTimers();

    fillBody(index);
    if (layer) layer.resize();

    modal.classList.remove('is-closing', 'flap-open', 'paper-out', 'is-revealed');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    void modal.offsetWidth;
    modal.classList.add('is-open');

    if (ev && layer) {
      const r = particleCanvas.getBoundingClientRect();
      burst(ev.clientX - r.left, ev.clientY - r.top, 14);
    }

    if (trigger) trigger.classList.add('is-read');

    if (reduceMotion) {
      reveal();
    } else {
      later(950, function () { modal.classList.add('flap-open'); });
      later(1750, function () { modal.classList.add('paper-out'); });
      later(2600, reveal);
    }
    startAmbient();
    closeBtn.focus({ preventScroll: true });
  }

  function closeLetter() {
    if (!isOpen) return;
    isOpen = false;
    revealed = false;
    clearTimers();
    stopAmbient();
    modal.classList.add('is-closing');
    later(reduceMotion ? 0 : 460, function () {
      modal.classList.remove('is-open', 'is-closing', 'flap-open', 'paper-out', 'is-revealed');
      modal.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      if (layer) layer.clear();
      if (opener) opener.focus({ preventScroll: true });
    });
  }

  function go(delta) {
    if (!isOpen || !revealed) return;
    const next = current + delta;
    if (next < 0 || next >= letters.length) return;
    current = next;
    if (buttons[next]) buttons[next].classList.add('is-read');
    opener = buttons[next] || opener;
    paper.classList.add('is-switching');
    later(reduceMotion ? 0 : 230, function () {
      fillBody(current);
      const ps = bodyEl.querySelectorAll('p');
      if (!reduceMotion) {
        ps.forEach(function (p, i) {
          p.style.opacity = '0';
          p.style.transform = 'translateY(10px)';
          void p.offsetWidth;
          p.style.transitionDelay = (0.15 + i * 0.4) + 's';
          p.style.opacity = '';
          p.style.transform = '';
        });
      }
      paper.classList.remove('is-switching');
      heartBurst();
    });
  }

  /* ---------- Eventos ---------- */
  closeBtn.addEventListener('click', closeLetter);
  prevBtn.addEventListener('click', function () { go(-1); });
  nextBtn.addEventListener('click', function () { go(1); });
  envStage.addEventListener('click', reveal);
  stage.addEventListener('click', function (e) {
    if (e.target === stage) closeLetter();
  });
  modal.querySelector('.letter-backdrop').addEventListener('click', closeLetter);

  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLetter(); return; }
    if (e.key === 'ArrowRight') { go(1); return; }
    if (e.key === 'ArrowLeft') { go(-1); return; }
    if (e.key === 'Enter' && !revealed && document.activeElement === closeBtn) return;
    if (e.key === 'Tab') {
      const items = [closeBtn];
      if (revealed) { items.push(paper); if (!prevBtn.disabled) items.push(prevBtn); if (!nextBtn.disabled) items.push(nextBtn); }
      const idx = items.indexOf(document.activeElement);
      e.preventDefault();
      let n = idx + (e.shiftKey ? -1 : 1);
      if (n < 0) n = items.length - 1;
      if (n >= items.length) n = 0;
      items[n].focus();
    }
  });

  buildGrid();
})();
