import {
  DAY_LETTERS, DAY_NAMES, WEEK_ORDER, MODES,
  sideLabel, targetText, prescription, totalSets, estimateMinutes, slugify, defaultRoutines,
  isCircuit, circuitIntervals, circuitSeconds, durationText,
} from './data.js';
import * as store from './store.js';
import * as signal from './signal.js';

const app = document.getElementById('app');
const sheet = document.getElementById('sheet');
const srStatus = document.getElementById('sr-status');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const WALLS = { azul: '#0b2e8a', amarillo: '#ffcd00', rosa: '#c8005f', verde: '#0a6b38' };

let db = store.load();
let active = store.loadActive();
// Un circuito que quedó corriendo al cerrar la app vuelve en pausa, en la fase donde iba,
// en vez de "correr" de golpe los intervalos que no hiciste.
if (active?.kind === 'circuit' && !active.paused) {
  const left = active.phaseEnd - Date.now();
  active.paused = true;
  active.pausedLeft = left > 0 ? left : active.phaseTotal;
  store.saveActive(active);
}
let lastDone = null;
let ticker = null;
let currentWall = null;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const routineById = (id) => db.routines.find((r) => r.id === id);
// Las rutinas de fuerza siguen la rotación por días; los circuitos van a demanda.
const strengthRoutines = () => db.routines.filter((r) => !isCircuit(r));
const expressRoutine = () => db.routines.find(isCircuit);
const isCircuitSession = (s) => s?.kind === 'circuit';
/** "10 intervalos" en un circuito, "17 series" en fuerza. */
const unitsText = (n, circuit) => plural(n, circuit ? 'intervalo' : 'serie', circuit ? 'intervalos' : 'series');

function fmtClock(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDate(d, opts) {
  return new Intl.DateTimeFormat('es-MX', opts).format(d);
}

function daysText(days) {
  const ordered = WEEK_ORDER.filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]);
  if (!ordered.length) return 'Sin días asignados';
  if (ordered.length === 1) return cap(ordered[0]);
  return cap(ordered.slice(0, -1).join(', ') + ' y ' + ordered[ordered.length - 1]);
}

function announce(text) {
  srStatus.textContent = '';
  requestAnimationFrame(() => { srStatus.textContent = text; });
}

let toastTimer = null;
function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  announce(text);
}

function persist() {
  if (!store.save()) toast('No se pudo guardar: el teléfono no tiene espacio.');
}

const ICON = {
  hoy: '<path d="M4 7.5h16M8 3v3M16 3v3"/><rect x="4" y="5" width="16" height="15" rx="2"/><rect x="8" y="11" width="4" height="4" rx=".5" fill="currentColor" stroke="none"/>',
  historial: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  rutinas: '<path d="M8.5 9.2V8a3.5 3.5 0 0 1 7 0v1.2"/><path d="M7.6 9.5h8.8a5.5 5.5 0 1 1-8.8 0Z"/>',
  ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  menos: '<path d="M5 12h14"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  arriba: '<path d="m6 14 6-6 6 6"/>',
  abajo: '<path d="m6 10 6 6 6-6"/>',
  quitar: '<path d="M6 6l12 12M18 6 6 18"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  reloj: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 3h5M18 6.5l1.5-1.5"/>',
};
const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

// ---------------------------------------------------------------------------
// Montaje de pantallas y "la repintada"
// ---------------------------------------------------------------------------

function mount(html, wall, { paint = false, keepScroll = false, focus = true } = {}) {
  const prev = app.querySelector('.screen:last-child');
  const scroll = keepScroll && prev ? prev.scrollTop : 0;
  const el = document.createElement('section');
  el.className = `screen wall-${wall}`;
  el.innerHTML = html;
  const animate = paint && prev && currentWall && currentWall !== wall && !reduceMotion.matches;
  if (animate) {
    el.classList.add('painting');
    app.append(el);
    const finish = () => {
      el.classList.remove('painting');
      app.querySelectorAll('.screen').forEach((s) => { if (s !== el) s.remove(); });
    };
    el.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 700);
  } else {
    app.replaceChildren(el);
    if (scroll) el.scrollTop = scroll;
  }
  currentWall = wall;
  themeMeta.setAttribute('content', WALLS[wall]);
  document.body.dataset.wall = wall;
  if (focus) {
    const h = el.querySelector('h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  return el;
}

function shell(tab, inner) {
  const tabs = [
    ['hoy', 'Hoy', '#/hoy'],
    ['historial', 'Historial', '#/historial'],
    ['rutinas', 'Rutinas', '#/rutinas'],
    ['ajustes', 'Ajustes', '#/ajustes'],
  ];
  return `
    <main class="shell" id="contenido">${inner}</main>
    <nav class="tabbar" aria-label="Secciones">
      ${tabs.map(([id, label, href]) => `
        <a href="${href}" class="tab" data-testid="tab-${id}" ${tab === id ? 'aria-current="page"' : ''}>
          ${icon(id)}<span>${label}</span>
        </a>`).join('')}
    </nav>`;
}

// ---------------------------------------------------------------------------
// Hoy
// ---------------------------------------------------------------------------

function weekStrip(now) {
  const ws = store.weekStart(now);
  const doneDays = new Set(store.sessionsInWeek(db.sessions, ws).map((s) => store.dayKey(s.start)));
  const todayKey = store.dayKey(now);
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const key = store.dayKey(d);
    const planned = db.routines.filter((r) => r.days.includes(dow)).map((r) => r.id).join('');
    const done = doneDays.has(key);
    const label = `${cap(DAY_NAMES[dow])}${planned ? `, toca ${planned}` : ''}${done ? ', entrenaste' : ''}${key === todayKey ? ', hoy' : ''}`;
    cells.push(`
      <li class="day${done ? ' is-done' : ''}${key === todayKey ? ' is-today' : ''}" aria-label="${esc(label)}">
        <span class="day-letter" aria-hidden="true">${DAY_LETTERS[dow]}</span>
        <span class="day-plan" aria-hidden="true">${esc(planned) || '·'}</span>
      </li>`);
  }
  const count = store.sessionsInWeek(db.sessions, ws).length;
  return `
    <section class="week" aria-label="Esta semana">
      <ol class="week-strip">${cells.join('')}</ol>
      <p class="week-count" data-testid="week-count"><span class="num">${count}</span> de ${store.WEEKLY_GOAL} esta semana</p>
    </section>`;
}

function planList(r) {
  return `
    <ol class="plan">
      ${r.exercises.map((ex) => `
        <li><span class="plan-name">${esc(ex.name)}</span><span class="plan-rx">${esc(prescription(ex))}</span></li>`).join('')}
    </ol>
    <p class="plan-meta">${plural(totalSets(r), 'serie', 'series')} · ≈ ${estimateMinutes(r)} min · descanso ${r.rest} s</p>`;
}

function nextTraining(now) {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const r = db.routines.find((x) => x.days.includes(d.getDay()));
    if (r) return { day: i === 1 ? 'mañana' : DAY_NAMES[d.getDay()], routine: r };
  }
  return null;
}

function viewToday() {
  const now = new Date();
  const dow = now.getDay();
  const todays = strengthRoutines().filter((r) => r.days.includes(dow));
  const suggested = todays[0];
  const others = strengthRoutines().filter((r) => r !== suggested);
  const express = expressRoutine();
  const dateText = cap(fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' }));

  let resume = '';
  if (active) {
    const done = active.log.length;
    resume = `
      <section class="resume" aria-label="Sesión sin terminar">
        <p><strong>${esc(active.routine.name)} sin terminar.</strong> Llevas ${done} de ${unitsText(totalSets(active.routine), isCircuit(active.routine))}.</p>
        <a class="btn btn-ink" href="#/sesion" data-testid="resume-session">Continuar sesión</a>
      </section>`;
  }

  let main;
  if (suggested) {
    main = `
      <section class="rotulo" aria-labelledby="rotulo-h">
        <h1 id="rotulo-h" class="rotulo-h"><span class="rotulo-small">Hoy toca</span>
          <span class="rotulo-big" data-testid="suggested-routine" data-routine="${esc(suggested.id)}">${esc(suggested.name)}</span></h1>
        ${planList(suggested)}
      </section>
      ${others.length ? `
        <section class="alt" aria-label="Otras rutinas">
          <h2 class="alt-h">¿Prefieres otra?</h2>
          <div class="alt-list">
            ${others.map((r) => `<button class="btn btn-line" data-action="start" data-routine="${esc(r.id)}" data-testid="choose-routine">Hacer ${esc(r.name)}</button>`).join('')}
          </div>
        </section>` : ''}
      <div class="dock">
        <button class="btn plate" data-action="start" data-routine="${esc(suggested.id)}" data-testid="start-routine"${active ? ' disabled' : ''}>Empezar ${esc(suggested.name)}</button>
      </div>`;
  } else {
    const next = nextTraining(now);
    main = `
      <section class="rotulo" aria-labelledby="rotulo-h">
        <h1 id="rotulo-h" class="rotulo-h"><span class="rotulo-small">Hoy</span>
          <span class="rotulo-big" data-testid="suggested-routine" data-routine="descanso">Descanso</span></h1>
        <p class="rest-note">Hoy no toca entrenar${next ? `. Lo que sigue: <strong>${esc(next.routine.name)}</strong> ${next.day === 'mañana' ? 'mañana' : 'el ' + esc(next.day)}` : ''}.</p>
      </section>
      <section class="alt" aria-label="Entrenar de todos modos">
        <h2 class="alt-h">¿Quieres entrenar de todos modos?</h2>
        <div class="choose-list">
          ${strengthRoutines().map((r) => `
            <button class="choose" data-action="start" data-routine="${esc(r.id)}" data-testid="choose-routine"${active ? ' disabled' : ''}>
              <span class="choose-name">${esc(r.name)}</span>
              <span class="choose-meta">${plural(r.exercises.length, 'ejercicio', 'ejercicios')} · ≈ ${estimateMinutes(r)} min</span>
            </button>`).join('')}
        </div>
      </section>`;
  }

  return shell('hoy', `
    <header class="topline">
      <p class="date">${esc(dateText)}</p>
      ${express ? `
      <button class="btn btn-line btn-quick" data-action="start" data-routine="${esc(express.id)}" data-testid="quick-routine"
        aria-label="Poco tiempo: ${esc(express.name)}, ${esc(durationText(circuitSeconds(express)))}"${active ? ' disabled' : ''}>${icon('reloj')}<span>Poco tiempo</span></button>` : ''}
    </header>
    ${weekStrip(now)}
    ${resume}
    ${main}`);
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

function startSession(routineId) {
  const r = routineById(routineId);
  if (!r || !r.exercises.length) { toast('Esta rutina no tiene ejercicios.'); return; }
  signal.unlockAudio();
  active = {
    id: `s-${Date.now()}`,
    routine: JSON.parse(JSON.stringify(r)),
    ex: 0,
    set: 0,
    phase: 'work',
    startedAt: new Date().toISOString(),
    log: [],
  };
  if (isCircuit(r)) {
    // El circuito corre solo desde ya: cada fase termina en phaseEnd y encadena la siguiente.
    Object.assign(active, { kind: 'circuit', round: 0, paused: false, pausedLeft: null, beep: null });
    active.phaseTotal = r.work * 1000;
    active.phaseEnd = Date.now() + active.phaseTotal;
  }
  store.saveActive(active);
  if (location.hash === '#/sesion') route();
  else location.hash = '#/sesion';
}

const curEx = () => active.routine.exercises[active.ex];
const isLastSet = () => active.ex === active.routine.exercises.length - 1 && active.set === curEx().sets - 1;

function nextPointer() {
  const ex = curEx();
  if (active.set < ex.sets - 1) return { ex: active.ex, set: active.set + 1 };
  return { ex: active.ex + 1, set: 0 };
}

function defaultReps(ex, setIndex) {
  const last = store.lastFor(ex.id).reps || [];
  const prev = last[setIndex] ?? last.find((n) => n != null);
  if (ex.mode === 'reps') return ex.reps;
  if (ex.mode === 'range') return prev != null ? clamp(prev, 1, 999) : ex.reps;
  return prev != null ? prev : 10;
}

function sessionTop() {
  const total = active.routine.exercises.length;
  return `
    <header class="sbar">
      <button class="btn-quiet" data-action="exit-session" data-testid="exit-session">${active.kind === 'circuit' ? 'Terminar' : 'Salir'}</button>
      <p class="sbar-pos">Ejercicio ${Math.min(active.ex + 1, total)} de ${total}</p>
      <p class="sbar-clock" aria-label="Tiempo de sesión"><span data-elapsed>${fmtClock((Date.now() - new Date(active.startedAt)) / 1000)}</span></p>
    </header>`;
}

function pips(ex, current) {
  return `<ol class="pips" aria-hidden="true">${Array.from({ length: ex.sets }, (_, i) =>
    `<li class="${i < current ? 'is-done' : i === current ? 'is-now' : ''}"></li>`).join('')}</ol>`;
}

function digits(text) {
  return [...text].map((c) => `<span class="${c === ':' ? 'colon' : 'cell'}">${c}</span>`).join('');
}

function viewWork() {
  const ex = curEx();
  const side = sideLabel(ex);
  const last = store.lastFor(ex.id);
  const timed = ex.mode === 'time';
  const running = active.phase === 'timed';
  const kg = last.kg ?? '';

  let body;
  if (timed) {
    const left = running ? Math.ceil((active.timedEnd - Date.now()) / 1000) : ex.seconds;
    body = `
      <div class="target target-time">
        <div class="timer" data-testid="timer" role="timer" aria-label="Tiempo restante">${digits(fmtClock(left))}</div>
        <p class="target-unit">${running ? 'Aguanta' : `${ex.seconds} segundos${side ? ' ' + esc(side) : ''}`}</p>
      </div>
      <div class="dock">
        ${running
          ? `<button class="btn plate" data-action="stop-timed" data-testid="stop-timer">Terminar antes</button>`
          : `<button class="btn plate" data-action="start-timed" data-testid="start-timer">Empezar ${ex.seconds} s</button>`}
      </div>`;
  } else {
    const reps = defaultReps(ex, active.set);
    const tgt = targetText(ex);
    body = `
      <div class="target">
        <p class="target-num${ex.mode === 'max' ? ' is-word' : ''}" data-testid="target">${esc(tgt)}</p>
        <p class="target-unit">${ex.mode === 'max' ? 'repeticiones, las que salgan' : 'repeticiones'}${side ? ` <strong>${esc(side)}</strong>` : ''}</p>
      </div>
      <form class="log" data-form="set" autocomplete="off">
        <div class="field">
          <label for="f-reps">Hiciste</label>
          <div class="stepper">
            <button type="button" class="step" data-action="step" data-for="f-reps" data-delta="-1" aria-label="Una repetición menos">${icon('menos')}</button>
            <input id="f-reps" name="reps" type="number" inputmode="numeric" min="0" max="999" value="${esc(reps)}" data-testid="reps-input">
            <button type="button" class="step" data-action="step" data-for="f-reps" data-delta="1" aria-label="Una repetición más">${icon('mas')}</button>
          </div>
        </div>
        ${ex.weighted ? `
        <div class="field">
          <label for="f-kg">Kettlebell <span class="opt">kg, opcional</span></label>
          <div class="stepper">
            <button type="button" class="step" data-action="step" data-for="f-kg" data-delta="-2" aria-label="Dos kilos menos">${icon('menos')}</button>
            <input id="f-kg" name="kg" type="number" inputmode="decimal" min="0" max="200" step="0.5" value="${esc(kg)}" placeholder="—" data-testid="kg-input">
            <button type="button" class="step" data-action="step" data-for="f-kg" data-delta="2" aria-label="Dos kilos más">${icon('mas')}</button>
          </div>
        </div>` : ''}
      </form>
      <div class="dock">
        <button class="btn plate" data-action="finish-set" data-testid="finish-set">${isLastSet() ? 'Terminé la última' : 'Terminé la serie'}</button>
      </div>`;
  }

  return `
    ${sessionTop()}
    <main class="session" data-testid="session" data-phase="${active.phase}">
      <h1 class="ex-name">${esc(ex.name)}</h1>
      <div class="setline">
        <p class="setline-text" data-testid="set-label">Serie ${active.set + 1} de ${ex.sets}</p>
        ${pips(ex, active.set)}
      </div>
      ${body}
    </main>`;
}

function targetWithUnit(ex) {
  const side = sideLabel(ex);
  const t = ex.mode === 'time' ? targetText(ex) : ex.mode === 'max' ? 'al máximo' : `${targetText(ex)} reps`;
  return side ? `${t} ${side}` : t;
}

function viewRest() {
  const ex = curEx();
  const left = Math.ceil((active.restEnd - Date.now()) / 1000);
  const firstOfEx = active.set === 0;
  return `
    <div class="rise" aria-hidden="true"><div class="rise-fill" data-rise></div></div>
    ${sessionTop()}
    <main class="session session-rest" data-testid="session" data-phase="rest">
      <h1 class="ex-name">Descansa</h1>
      <div class="target target-time">
        <div class="timer" data-testid="timer" role="timer" aria-label="Descanso restante">${digits(fmtClock(left))}</div>
      </div>
      <p class="next" data-testid="next-up">
        <span class="next-what">Sigue: ${esc(ex.name)}</span>
        <span class="next-detail">${firstOfEx ? esc(prescription(ex)) : `Serie ${active.set + 1} de ${ex.sets} · ${esc(targetWithUnit(ex))}`}</span></p>
      <div class="dock dock-pair">
        <button class="btn btn-line" data-action="extend-rest" data-testid="extend-rest">+15 s</button>
        <button class="btn plate" data-action="skip-rest" data-testid="skip-rest">Saltar descanso</button>
      </div>
    </main>`;
}

// ---- Circuito (Rutina Express): corre solo, 40/20, ronda tras ronda --------

function circuitLeftMs() {
  return active.paused ? active.pausedLeft : Math.max(0, active.phaseEnd - Date.now());
}

/** Qué viene después del intervalo de trabajo en curso. */
function circuitAfterWork() {
  const r = active.routine;
  const n = r.exercises.length;
  const lastOfRound = active.ex === n - 1;
  if (lastOfRound && active.round === r.rounds - 1) {
    return { what: 'Último ejercicio', detail: 'Al sonar, terminaste' };
  }
  const next = lastOfRound ? r.exercises[0] : r.exercises[active.ex + 1];
  const pre = r.rest ? `Tras ${r.rest} s de descanso` : 'Sin descanso';
  return {
    what: `Sigue: ${next.name}`,
    detail: lastOfRound ? `${pre} · ronda ${active.round + 2}` : pre,
  };
}

function viewCircuit() {
  const r = active.routine;
  const ex = curEx();
  const rest = active.phase === 'rest';
  const left = Math.ceil(circuitLeftMs() / 1000);
  const round = `Ronda ${active.round + 1} de ${r.rounds}`;
  const pauseBtn = active.paused
    ? '<button class="btn plate" data-action="resume-circuit" data-testid="resume-circuit">Seguir</button>'
    : '<button class="btn plate" data-action="pause-circuit" data-testid="pause-circuit">Pausa</button>';
  const state = active.paused ? 'En pausa' : rest ? 'Respira, ya viene' : 'Dale hasta que suene';

  if (rest) {
    const firstOfRound = active.ex === 0;
    // La pintura ya subida se dibuja desde el render: en pausa el ticker no la actualiza.
    const risen = (1 - circuitLeftMs() / active.phaseTotal).toFixed(4);
    return `
      <div class="rise" aria-hidden="true"><div class="rise-fill" data-rise style="transform: scaleY(${risen})"></div></div>
      ${sessionTop()}
      <main class="session session-rest session-circuit" data-testid="session" data-phase="rest" data-paused="${!!active.paused}">
        <h1 class="ex-name" data-testid="circuit-phase">Descanso</h1>
        <p class="setline-text" data-testid="circuit-round">${round}</p>
        <div class="target target-time">
          <div class="timer" data-testid="timer" role="timer" aria-label="Descanso restante">${digits(fmtClock(left))}</div>
          <p class="target-unit" data-testid="circuit-state">${state}</p>
        </div>
        <p class="next" data-testid="next-up">
          <span class="next-what">Sigue: ${esc(ex.name)}</span>
          <span class="next-detail">${firstOfRound ? `Empieza la ronda ${active.round + 1} · ` : ''}${r.work} s de trabajo</span></p>
        <div class="dock">${pauseBtn}</div>
      </main>`;
  }

  const after = circuitAfterWork();
  return `
    ${sessionTop()}
    <main class="session session-circuit" data-testid="session" data-phase="work" data-paused="${!!active.paused}">
      <h1 class="ex-name" data-testid="circuit-exercise">${esc(ex.name)}</h1>
      <div class="setline">
        <p class="phase-tag" data-testid="circuit-phase">Trabajo</p>
        <p class="setline-text" data-testid="circuit-round">${round}</p>
      </div>
      <div class="target target-time">
        <div class="timer" data-testid="timer" role="timer" aria-label="Trabajo restante">${digits(fmtClock(left))}</div>
        <p class="target-unit" data-testid="circuit-state">${state}</p>
      </div>
      <p class="next" data-testid="next-up">
        <span class="next-what">${esc(after.what)}</span>
        <span class="next-detail">${esc(after.detail)}</span></p>
      <div class="dock">${pauseBtn}</div>
    </main>`;
}

/**
 * Cierra la fase en curso y abre la siguiente. La nueva fase empieza en el phaseEnd
 * anterior, no en "ahora": el circuito no acumula retraso aunque el temporizador se atrase.
 * Devuelve 'rest', 'work' o 'done'.
 */
function advanceCircuit() {
  const r = active.routine;
  const n = r.exercises.length;
  if (active.phase === 'work') {
    const ex = curEx();
    active.log.push({ exId: ex.id, exName: ex.name, set: active.round + 1, seconds: r.work });
    if (active.ex === n - 1 && active.round === r.rounds - 1) return 'done';
    if (active.ex === n - 1) { active.ex = 0; active.round += 1; } else active.ex += 1;
    if (r.rest > 0) {
      active.phase = 'rest';
      active.phaseTotal = r.rest * 1000;
    } else {
      active.phaseTotal = r.work * 1000;
    }
  } else {
    active.phase = 'work';
    active.phaseTotal = r.work * 1000;
  }
  active.phaseEnd += active.phaseTotal;
  active.beep = null;
  return active.phase;
}

function tickCircuit(now) {
  if (active.paused) return;
  let changed = null;
  while (active && !active.paused && now >= active.phaseEnd) {
    changed = advanceCircuit();
    if (changed === 'done') {
      signal.done(db.settings);
      complete(false);
      return;
    }
  }
  if (changed) {
    store.saveActive(active);
    if (changed === 'rest') {
      signal.toRest(db.settings);
      announce(`Descanso de ${active.routine.rest} segundos. Sigue ${curEx().name}.`);
    } else {
      signal.toWork(db.settings);
      announce(`Trabajo: ${curEx().name}, ronda ${active.round + 1}.`);
    }
    renderSession();
    return;
  }
  updateCountdown(active.phaseEnd - now, active.phaseTotal);
}

function pauseCircuit() {
  if (!active || active.kind !== 'circuit' || active.paused) return;
  active.paused = true;
  active.pausedLeft = Math.max(0, active.phaseEnd - Date.now());
  store.saveActive(active);
  renderSession(false);
  announce('En pausa.');
}

function resumeCircuit() {
  if (!active || active.kind !== 'circuit' || !active.paused) return;
  signal.unlockAudio();
  active.paused = false;
  active.phaseEnd = Date.now() + active.pausedLeft;
  active.pausedLeft = null;
  active.beep = null;
  store.saveActive(active);
  renderSession(false);
  announce('Sigue el circuito.');
}

function viewDone() {
  const s = lastDone;
  if (!s) return null;
  const now = new Date();
  const count = store.sessionsInWeek(db.sessions, store.weekStart(now)).length;
  const st = store.streak(db.sessions, now);
  const mins = Math.max(1, Math.round(s.durationSec / 60));
  const goal = count >= store.WEEKLY_GOAL;
  return `
    <main class="session session-done" data-testid="session-done">
      <h1 class="ex-name done-h">${s.partial ? 'Guardado' : 'Listo'}</h1>
      <p class="done-sub">${esc(s.routineName)}${s.partial ? ', sesión parcial' : ''}</p>
      <div class="streak done-lines">
        <p class="streak-line"><span class="num">${mins}</span> min · <span class="num">${s.sets.length}</span> ${unitsText(s.sets.length, isCircuitSession(s)).replace(/^\d+ /, '')}</p>
        <p class="streak-line"><span class="num">${count}</span> de ${store.WEEKLY_GOAL} esta semana</p>
        ${st ? `<p class="streak-line"><span class="num">${st}</span> ${st === 1 ? 'semana' : 'semanas'} de racha</p>` : ''}
      </div>
      <p class="done-note">${goal
        ? 'Meta de la semana cumplida.'
        : `Te ${store.WEEKLY_GOAL - count === 1 ? 'falta 1 sesión' : `faltan ${store.WEEKLY_GOAL - count} sesiones`} para la meta de la semana.`}</p>
      <div class="dock dock-stack">
        <a class="btn plate" href="#/historial" data-testid="go-history">Ver historial</a>
        <a class="btn btn-line" href="#/hoy">Volver a Hoy</a>
      </div>
    </main>`;
}

function renderSession(paint = true) {
  if (!active) {
    if (lastDone) {
      mount(viewDone(), 'verde', { paint });
      stopTicker();
      return;
    }
    location.replace('#/hoy');
    return;
  }
  signal.keepAwake(true);
  if (active.kind === 'circuit') mount(viewCircuit(), active.phase === 'rest' ? 'rosa' : 'amarillo', { paint });
  else if (active.phase === 'rest') mount(viewRest(), 'rosa', { paint });
  else mount(viewWork(), 'amarillo', { paint });
  startTicker();
  tick();
}

function readNumber(id) {
  const el = document.getElementById(id);
  if (!el || el.value.trim() === '') return null;
  const n = Number(el.value.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function logSet(entry) {
  const ex = curEx();
  active.log.push({ exId: ex.id, exName: ex.name, set: active.set + 1, ...entry });
  store.remember(ex.id, active.set, entry.reps ?? null, entry.kg ?? null);
  persist();
  if (isLastSet()) { complete(false); return; }
  const next = nextPointer();
  active.ex = next.ex;
  active.set = next.set;
  active.phase = 'rest';
  active.restTotal = active.routine.rest * 1000;
  active.restEnd = Date.now() + active.restTotal;
  active.beep = null;
  store.saveActive(active);
  renderSession();
  announce(`Descanso de ${active.routine.rest} segundos.`);
}

function finishSet() {
  const ex = curEx();
  if (ex.mode === 'time') return;
  const reps = readNumber('f-reps');
  const kg = ex.weighted ? readNumber('f-kg') : null;
  signal.unlockAudio();
  logSet({ reps, kg });
}

function startTimed() {
  const ex = curEx();
  signal.unlockAudio();
  active.phase = 'timed';
  active.timedTotal = ex.seconds * 1000;
  active.timedEnd = Date.now() + active.timedTotal;
  active.beep = null;
  store.saveActive(active);
  renderSession(false);
}

function endTimed(early) {
  const ex = curEx();
  const done = early ? Math.round((active.timedTotal - Math.max(0, active.timedEnd - Date.now())) / 1000) : ex.seconds;
  if (!early) signal.done(db.settings);
  logSet({ seconds: done });
}

function endRest() {
  active.phase = 'work';
  active.restEnd = null;
  store.saveActive(active);
  renderSession();
  announce(`A trabajar: ${curEx().name}, serie ${active.set + 1}.`);
}

function complete(partial) {
  const end = new Date();
  const record = {
    id: active.id,
    routineId: active.routine.id,
    routineName: active.routine.name,
    start: active.startedAt,
    end: end.toISOString(),
    durationSec: Math.round((end - new Date(active.startedAt)) / 1000),
    partial: !!partial,
    sets: active.log,
  };
  if (active.kind === 'circuit') record.kind = 'circuit';
  db.sessions.push(record);
  persist();
  active = null;
  store.saveActive(null);
  signal.keepAwake(false);
  lastDone = record;
  stopTicker();
  renderSession();
  announce('Sesión guardada en el historial.');
}

function startTicker() {
  if (!ticker) ticker = setInterval(tick, 200);
}

function stopTicker() {
  clearInterval(ticker);
  ticker = null;
}

function tick() {
  if (!active) { stopTicker(); return; }
  const now = Date.now();
  const elapsed = app.querySelector('[data-elapsed]');
  if (elapsed) elapsed.textContent = fmtClock((now - new Date(active.startedAt)) / 1000);
  if (active.kind === 'circuit') { tickCircuit(now); return; }

  let end; let total;
  if (active.phase === 'rest') { end = active.restEnd; total = active.restTotal; }
  else if (active.phase === 'timed') { end = active.timedEnd; total = active.timedTotal; }
  else return;

  const leftMs = updateCountdown(end - now, total);
  if (leftMs <= 0) {
    if (active.phase === 'rest') { signal.done(db.settings); endRest(); }
    else endTimed(false);
  }
}

/** Pinta el reloj y la pintura que sube; pita en 3, 2, 1. Devuelve los ms que faltan. */
function updateCountdown(remainingMs, total) {
  const leftMs = Math.max(0, remainingMs);
  const leftSec = Math.ceil(leftMs / 1000);
  const timer = app.querySelector('.screen:last-child [data-testid="timer"]');
  if (timer) {
    const text = fmtClock(leftSec);
    if (timer.dataset.shown !== text) {
      timer.innerHTML = digits(text);
      timer.dataset.shown = text;
    }
  }
  const rise = app.querySelector('.screen:last-child [data-rise]');
  if (rise) rise.style.transform = `scaleY(${(1 - leftMs / total).toFixed(4)})`;

  if (leftSec > 0 && leftSec <= 3 && active.beep !== leftSec) {
    active.beep = leftSec;
    signal.tick(db.settings);
  }
  return leftMs;
}

let autoPaused = false;
function openExitSheet() {
  const n = active.log.length;
  if (active.kind === 'circuit') {
    // Mientras decides, el circuito se detiene; si sigues, retoma donde iba.
    autoPaused = !active.paused;
    pauseCircuit();
    openSheet(`
      <h2 id="sheet-title">¿Terminar el circuito?</h2>
      <p>${n ? `Llevas ${n} de ${unitsText(circuitIntervals(active.routine), true)}. Puedes guardarlos como sesión parcial.` : 'Todavía no terminas ningún ejercicio.'}</p>
      <div class="sheet-actions">
        ${n ? '<button class="btn plate" data-action="save-partial" data-testid="save-partial">Terminar y guardar</button>' : ''}
        <button class="btn btn-line" data-action="close-sheet">Seguir entrenando</button>
        <button class="btn btn-danger" data-action="discard-session">Descartar sesión</button>
      </div>`);
    return;
  }
  openSheet(`
    <h2 id="sheet-title">¿Salir de la sesión?</h2>
    <p>${n ? `Llevas ${n} ${n === 1 ? 'serie' : 'series'}. Puedes guardarlas como sesión parcial.` : 'Todavía no anotas ninguna serie.'}</p>
    <div class="sheet-actions">
      ${n ? '<button class="btn plate" data-action="save-partial" data-testid="save-partial">Guardar lo que llevo</button>' : ''}
      <button class="btn btn-line" data-action="close-sheet">Seguir entrenando</button>
      <button class="btn btn-danger" data-action="discard-session">Descartar sesión</button>
    </div>`);
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------

function summarizeSets(sets) {
  const groups = [];
  for (const s of sets) {
    let g = groups.find((x) => x.exId === s.exId);
    if (!g) { g = { exId: s.exId, name: s.exName, items: [], kg: [] }; groups.push(g); }
    g.items.push(s.seconds != null ? `${s.seconds} s` : s.reps != null ? String(s.reps) : '—');
    if (s.kg != null) g.kg.push(s.kg);
  }
  return groups.map((g) => {
    const kgs = [...new Set(g.kg)];
    return `<li><span class="h-ex">${esc(g.name)}</span><span class="h-sets">${esc(g.items.join(' · '))}${kgs.length ? ` <span class="h-kg">${esc(kgs.join('/'))} kg</span>` : ''}</span></li>`;
  }).join('');
}

function viewHistory() {
  const now = new Date();
  const weeks = store.recentWeeks(db.sessions, now, 8);
  const st = store.streak(db.sessions, now);
  const thisWeek = weeks[weeks.length - 1].count;
  const list = [...db.sessions].sort((a, b) => new Date(b.start) - new Date(a.start));

  const grid = `
    <figure class="weeks" aria-labelledby="weeks-cap">
      <ol class="weeks-grid">
        ${weeks.map((w) => `
          <li class="wk${w.current ? ' is-current' : ''}${w.count >= store.WEEKLY_GOAL ? ' is-met' : ''}"
              aria-label="Semana del ${esc(fmtDate(w.start, { day: 'numeric', month: 'short' }))}: ${w.count} ${w.count === 1 ? 'sesión' : 'sesiones'}">
            <span class="wk-cells" aria-hidden="true">${[2, 1, 0].map((i) => `<span class="${w.count > i ? 'on' : ''}"></span>`).join('')}</span>
            <span class="wk-label" aria-hidden="true">${esc(fmtDate(w.start, { day: 'numeric' }))}</span>
          </li>`).join('')}
      </ol>
      <figcaption id="weeks-cap">Últimas 8 semanas, por lunes. Cada cuadro es una sesión; la meta son ${store.WEEKLY_GOAL}.</figcaption>
    </figure>`;

  const sessions = list.length ? `
    <ol class="h-list">
      ${list.map((s) => {
        const d = new Date(s.start);
        return `
        <li class="h-item">
          <details>
            <summary>
              <span class="h-date">${esc(cap(fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })))}</span>
              <span class="h-name">${esc(s.routineName)}${isCircuitSession(s) ? ' <span class="h-tag h-tag-express" data-testid="express-tag">Express</span>' : ''}${s.partial ? ' <span class="h-tag">parcial</span>' : ''}</span>
              <span class="h-meta">${Math.max(1, Math.round(s.durationSec / 60))} min · ${unitsText(s.sets.length, isCircuitSession(s))}</span>
            </summary>
            <ul class="h-detail">${summarizeSets(s.sets)}</ul>
            <button class="btn-quiet btn-quiet-danger" data-action="delete-session" data-id="${esc(s.id)}">Borrar esta sesión</button>
          </details>
        </li>`;
      }).join('')}
    </ol>` : `
    <div class="empty">
      <p><strong>Aún no hay sesiones.</strong> Cada sesión que termines aparece aquí con sus series, repeticiones y peso.</p>
      <a class="btn btn-line" href="#/hoy">Ir a Hoy</a>
    </div>`;

  return shell('historial', `
    <header class="page-head"><h1 class="page-h">Historial</h1></header>
    <section class="streak" data-testid="streak" aria-label="Racha">
      <p class="streak-line"><span class="num">${thisWeek}</span> de ${store.WEEKLY_GOAL} esta semana</p>
      <p class="streak-line"><span class="num" data-testid="streak-weeks">${st}</span> ${st === 1 ? 'semana' : 'semanas'} de racha</p>
    </section>
    ${grid}
    <section aria-labelledby="h-sessions" data-testid="history">
      <h2 id="h-sessions" class="sec-h">Sesiones <span class="sec-count">${list.length}</span></h2>
      ${sessions}
    </section>`);
}

// ---------------------------------------------------------------------------
// Rutinas
// ---------------------------------------------------------------------------

function viewRoutines() {
  return shell('rutinas', `
    <header class="page-head"><h1 class="page-h">Rutinas</h1></header>
    <ol class="r-list">
      ${db.routines.map((r) => `
        <li class="r-item">
          <h2 class="r-name">${esc(r.name)}</h2>
          <p class="r-days">${isCircuit(r) ? 'A demanda, con “Poco tiempo” en Hoy' : esc(daysText(r.days))}</p>
          <p class="r-meta">${isCircuit(r)
            ? `Circuito · ${plural(r.exercises.length, 'ejercicio', 'ejercicios')} · ${plural(r.rounds, 'ronda', 'rondas')} · ${r.work} s trabajo / ${r.rest} s descanso · ${durationText(circuitSeconds(r))}`
            : `${plural(r.exercises.length, 'ejercicio', 'ejercicios')} · ${plural(totalSets(r), 'serie', 'series')} · ≈ ${estimateMinutes(r)} min · descanso ${r.rest} s`}</p>
          <a class="btn btn-line" href="#/rutinas/${encodeURIComponent(r.id)}" data-testid="edit-routine-${esc(r.id)}">Editar ${esc(r.name)}</a>
        </li>`).join('')}
    </ol>
    <div class="page-actions">
      <button class="btn btn-line" data-action="add-routine">Nueva rutina</button>
    </div>`);
}

function exEditor(ex, i, n) {
  const id = `e${i}`;
  const modeOpts = Object.entries(MODES).map(([k, v]) => `<option value="${k}"${ex.mode === k ? ' selected' : ''}>${v}</option>`).join('');
  let target = '';
  if (ex.mode === 'reps') {
    target = numField(`${id}-reps`, 'Reps', ex.reps, 1, 100, 1, i, 'reps');
  } else if (ex.mode === 'range') {
    target = numField(`${id}-min`, 'Mínimo', ex.reps, 1, 100, 1, i, 'reps') + numField(`${id}-max`, 'Máximo', ex.repsMax, 1, 100, 1, i, 'repsMax');
  } else if (ex.mode === 'time') {
    target = numField(`${id}-sec`, 'Segundos', ex.seconds, 5, 600, 5, i, 'seconds');
  }
  return `
    <li class="ex-edit">
      <div class="ex-edit-head">
        <span class="ex-edit-n num" aria-hidden="true">${i + 1}</span>
        <label class="sr-only" for="${id}-name">Nombre del ejercicio ${i + 1}</label>
        <input class="ex-edit-name" id="${id}-name" type="text" value="${esc(ex.name)}" data-ex="${i}" data-field="name" maxlength="60" required>
      </div>
      <div class="ex-edit-grid">
        <div class="mini mini-mode">
          <label for="${id}-mode">Tipo</label>
          <select id="${id}-mode" data-ex="${i}" data-field="mode">${modeOpts}</select>
        </div>
        ${numField(`${id}-sets`, 'Series', ex.sets, 1, 10, 1, i, 'sets')}
        ${target}
      </div>
      <div class="ex-edit-checks">
        <label class="check"><input type="checkbox" data-ex="${i}" data-field="perSide"${ex.perSide ? ' checked' : ''}> Por lado</label>
        <label class="check"><input type="checkbox" data-ex="${i}" data-field="weighted"${ex.weighted ? ' checked' : ''}> Con kettlebell</label>
      </div>
      <div class="ex-edit-actions">
        <button type="button" class="icon-btn" data-action="ex-up" data-ex="${i}" aria-label="Subir ${esc(ex.name)}"${i === 0 ? ' disabled' : ''}>${icon('arriba')}</button>
        <button type="button" class="icon-btn" data-action="ex-down" data-ex="${i}" aria-label="Bajar ${esc(ex.name)}"${i === n - 1 ? ' disabled' : ''}>${icon('abajo')}</button>
        <button type="button" class="btn-quiet btn-quiet-danger" data-action="ex-remove" data-ex="${i}">Quitar</button>
      </div>
    </li>`;
}

function numField(id, label, value, min, max, step, i, field) {
  return `
    <div class="mini">
      <label for="${id}">${label}</label>
      <input id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" step="${step}" value="${esc(value ?? '')}" data-ex="${i}" data-field="${field}">
    </div>`;
}

function circuitExEditor(ex, i, n) {
  const id = `e${i}`;
  return `
    <li class="ex-edit ex-edit-circuit">
      <div class="ex-edit-head">
        <span class="ex-edit-n num" aria-hidden="true">${i + 1}</span>
        <label class="sr-only" for="${id}-name">Nombre del ejercicio ${i + 1}</label>
        <input class="ex-edit-name" id="${id}-name" type="text" value="${esc(ex.name)}" data-ex="${i}" data-field="name" maxlength="60" required>
      </div>
      <div class="ex-edit-actions">
        <button type="button" class="icon-btn" data-action="ex-up" data-ex="${i}" aria-label="Subir ${esc(ex.name)}"${i === 0 ? ' disabled' : ''}>${icon('arriba')}</button>
        <button type="button" class="icon-btn" data-action="ex-down" data-ex="${i}" aria-label="Bajar ${esc(ex.name)}"${i === n - 1 ? ' disabled' : ''}>${icon('abajo')}</button>
        <button type="button" class="btn-quiet btn-quiet-danger" data-action="ex-remove" data-ex="${i}">Quitar</button>
      </div>
    </li>`;
}

function smallStepper(id, label, value, min, max, step, rfield, unit) {
  return `
    <div class="mini mini-wide">
      <label for="${id}">${label}</label>
      <div class="stepper stepper-small">
        <button type="button" class="step" data-action="step" data-for="${id}" data-delta="-${step}" aria-label="${unit[0]}">${icon('menos')}</button>
        <input id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" step="${step}" value="${value}" data-rfield="${rfield}">
        <button type="button" class="step" data-action="step" data-for="${id}" data-delta="${step}" aria-label="${unit[1]}">${icon('mas')}</button>
      </div>
    </div>`;
}

function circuitMeta(r) {
  return `${plural(totalSets(r), 'intervalo', 'intervalos')} · ${durationText(circuitSeconds(r))}`;
}

function viewCircuitEdit(r) {
  return shell('rutinas', `
    <header class="page-head page-head-back">
      <a class="back" href="#/rutinas">${icon('atras')}<span>Rutinas</span></a>
      <h1 class="page-h">${esc(r.name)}</h1>
    </header>
    <form class="editor" data-form="routine" data-routine="${esc(r.id)}" autocomplete="off" novalidate>
      <div class="mini mini-wide">
        <label for="r-name">Nombre</label>
        <input id="r-name" type="text" value="${esc(r.name)}" data-rfield="name" maxlength="40" required>
      </div>
      <p class="hint">Circuito a demanda: no se asigna a días. Empiézalo con “Poco tiempo” en Hoy; corre solo de principio a fin.</p>
      ${smallStepper('r-rounds', 'Rondas', r.rounds, 1, 10, 1, 'rounds', ['Una ronda menos', 'Una ronda más'])}
      ${smallStepper('r-work', 'Trabajo por ejercicio, en segundos', r.work, 10, 180, 5, 'work', ['Cinco segundos menos de trabajo', 'Cinco segundos más de trabajo'])}
      ${smallStepper('r-rest', 'Descanso después de cada ejercicio, en segundos', r.rest, 0, 120, 5, 'rest', ['Cinco segundos menos de descanso', 'Cinco segundos más de descanso'])}
      <h2 class="sec-h">Ejercicios <span class="sec-count">${r.exercises.length}</span></h2>
      ${r.exercises.length ? `<ol class="ex-list">${r.exercises.map((ex, i) => circuitExEditor(ex, i, r.exercises.length)).join('')}</ol>`
        : '<p class="empty-inline">Sin ejercicios. Agrega el primero.</p>'}
      <button type="button" class="btn btn-line" data-action="ex-add">${icon('mas')} Agregar ejercicio</button>
      <p class="plan-meta" data-estimate>${circuitMeta(r)}</p>
      <p class="saved-note" data-saved aria-live="polite">Los cambios se guardan solos.</p>
    </form>`);
}

function viewRoutineEdit(id) {
  const r = routineById(id);
  if (!r) return null;
  if (isCircuit(r)) return viewCircuitEdit(r);
  return shell('rutinas', `
    <header class="page-head page-head-back">
      <a class="back" href="#/rutinas">${icon('atras')}<span>Rutinas</span></a>
      <h1 class="page-h">${esc(r.name)}</h1>
    </header>
    <form class="editor" data-form="routine" data-routine="${esc(r.id)}" autocomplete="off" novalidate>
      <div class="mini mini-wide">
        <label for="r-name">Nombre</label>
        <input id="r-name" type="text" value="${esc(r.name)}" data-rfield="name" maxlength="40" required>
      </div>
      <fieldset class="days">
        <legend>Días que toca</legend>
        <div class="days-row">
          ${WEEK_ORDER.map((d) => `<button type="button" class="day-toggle" data-action="toggle-day" data-day="${d}" aria-pressed="${r.days.includes(d)}" aria-label="${cap(DAY_NAMES[d])}">${DAY_LETTERS[d]}</button>`).join('')}
        </div>
      </fieldset>
      <div class="mini mini-wide">
        <label for="r-rest">Descanso entre series, en segundos</label>
        <div class="stepper stepper-small">
          <button type="button" class="step" data-action="step" data-for="r-rest" data-delta="-5" aria-label="Cinco segundos menos">${icon('menos')}</button>
          <input id="r-rest" type="number" inputmode="numeric" min="15" max="180" step="5" value="${r.rest}" data-rfield="rest">
          <button type="button" class="step" data-action="step" data-for="r-rest" data-delta="5" aria-label="Cinco segundos más">${icon('mas')}</button>
        </div>
      </div>
      <h2 class="sec-h">Ejercicios <span class="sec-count">${r.exercises.length}</span></h2>
      ${r.exercises.length ? `<ol class="ex-list">${r.exercises.map((ex, i) => exEditor(ex, i, r.exercises.length)).join('')}</ol>`
        : '<p class="empty-inline">Sin ejercicios. Agrega el primero.</p>'}
      <button type="button" class="btn btn-line" data-action="ex-add">${icon('mas')} Agregar ejercicio</button>
      <p class="plan-meta" data-estimate>${plural(totalSets(r), 'serie', 'series')} · ≈ ${estimateMinutes(r)} min</p>
      <p class="saved-note" data-saved aria-live="polite">Los cambios se guardan solos.</p>
      <div class="danger-zone">
        <button type="button" class="btn-quiet btn-quiet-danger" data-action="delete-routine">Borrar ${esc(r.name)}</button>
      </div>
    </form>`);
}

function editingRoutine() {
  const form = app.querySelector('[data-form="routine"]');
  return form ? routineById(form.dataset.routine) : null;
}

function rerenderEditor() {
  const r = editingRoutine();
  if (r) mount(viewRoutineEdit(r.id), 'azul', { keepScroll: true, focus: false });
}

function markSaved() {
  const r = editingRoutine();
  const est = app.querySelector('[data-estimate]');
  if (r && est) est.textContent = isCircuit(r) ? circuitMeta(r) : `${plural(totalSets(r), 'serie', 'series')} · ≈ ${estimateMinutes(r)} min`;
  const note = app.querySelector('[data-saved]');
  if (note) note.textContent = 'Cambios guardados.';
}

function applyExerciseField(r, i, field, el) {
  const ex = r.exercises[i];
  if (!ex) return false;
  if (field === 'name') {
    const v = el.value.trim();
    if (!v) { el.value = ex.name; return false; }
    ex.name = v;
    // Las etiquetas de los botones de esa fila nombran el ejercicio: se actualizan.
    const row = el.closest('.ex-edit');
    row?.querySelector('[data-action="ex-up"]')?.setAttribute('aria-label', `Subir ${v}`);
    row?.querySelector('[data-action="ex-down"]')?.setAttribute('aria-label', `Bajar ${v}`);
    return false;
  }
  if (field === 'perSide' || field === 'weighted') { ex[field] = el.checked; return false; }
  if (field === 'mode') {
    ex.mode = el.value;
    if (ex.mode === 'reps' && !ex.reps) ex.reps = 10;
    if (ex.mode === 'range') { ex.reps = ex.reps || 5; ex.repsMax = Math.max(ex.repsMax || 8, ex.reps); }
    if (ex.mode === 'time' && !ex.seconds) ex.seconds = 30;
    return true;
  }
  const limits = { sets: [1, 10], reps: [1, 100], repsMax: [1, 100], seconds: [5, 600] }[field];
  if (!limits) return false;
  const n = Math.round(Number(el.value));
  const v = Number.isFinite(n) && el.value !== '' ? clamp(n, ...limits) : ex[field] ?? limits[0];
  ex[field] = v;
  el.value = v;
  if (ex.mode === 'range' && ex.repsMax < ex.reps) {
    if (field === 'repsMax') ex.reps = ex.repsMax; else ex.repsMax = ex.reps;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

function viewSettings() {
  const s = db.settings;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return shell('ajustes', `
    <header class="page-head"><h1 class="page-h">Ajustes</h1></header>
    <section class="group" aria-labelledby="g-avisos">
      <h2 id="g-avisos" class="sec-h">Avisos al terminar</h2>
      <label class="switch"><input type="checkbox" role="switch" data-setting="sound"${s.sound ? ' checked' : ''}><span>Sonido</span></label>
      <label class="switch"><input type="checkbox" role="switch" data-setting="vibrate"${s.vibrate ? ' checked' : ''}><span>Vibración <span class="opt">(el iPhone no la permite en la web)</span></span></label>
      <button class="btn btn-line" data-action="test-signal">Probar aviso</button>
      <p class="hint">${signal.wakeLockSupported()
        ? 'Durante la sesión la pantalla se queda encendida.'
        : 'Este navegador no puede mantener la pantalla encendida; ajusta el bloqueo automático del teléfono mientras entrenas.'}</p>
    </section>
    <section class="group" aria-labelledby="g-datos">
      <h2 id="g-datos" class="sec-h">Tus datos</h2>
      <p class="hint">Viven solo en este teléfono: ${db.sessions.length} ${db.sessions.length === 1 ? 'sesión' : 'sesiones'} y ${db.routines.length} rutinas. Exporta un respaldo de vez en cuando.</p>
      <button class="btn btn-line" data-action="export" data-testid="export">Exportar respaldo (JSON)</button>
      <label class="btn btn-line file-btn" data-testid="import">Importar respaldo
        <input type="file" accept="application/json,.json" data-action="import" class="sr-only">
      </label>
      <button class="btn-quiet" data-action="restore-routines">Restaurar rutinas originales</button>
    </section>
    ${standalone ? '' : `
    <section class="group" aria-labelledby="g-instalar">
      <h2 id="g-instalar" class="sec-h">Instalar en el iPhone</h2>
      <ol class="steps">
        <li>Abre esta página en Safari.</li>
        <li>Toca Compartir y luego “Agregar a inicio”.</li>
        <li>Ábrela desde el ícono: funciona sin internet.</li>
      </ol>
    </section>`}`);
}

function exportData() {
  const text = store.exportJSON();
  const name = `entrenos-respaldo-${store.dayKey(new Date())}.json`;
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Respaldo exportado.');
}

let pendingImport = null;
async function importFile(file) {
  if (!file) return;
  const text = await file.text();
  const res = store.parseBackup(text);
  if (!res.ok) { toast(res.error); return; }
  pendingImport = res.data;
  openSheet(`
    <h2 id="sheet-title">¿Reemplazar tus datos?</h2>
    <p>El respaldo trae ${res.data.sessions.length} sesiones y ${res.data.routines.length} rutinas. Lo que hay ahora en este teléfono (${db.sessions.length} sesiones) se reemplaza.</p>
    <div class="sheet-actions">
      <button class="btn plate" data-action="confirm-import" data-testid="confirm-import">Reemplazar</button>
      <button class="btn btn-line" data-action="close-sheet">Cancelar</button>
    </div>`);
}

// ---------------------------------------------------------------------------
// Hoja inferior (dialog)
// ---------------------------------------------------------------------------

let sheetConfirm = null;
function openSheet(html, onConfirm = null) {
  sheet.innerHTML = `<div class="sheet-body">${html}</div>`;
  sheetConfirm = onConfirm;
  if (!sheet.open) sheet.showModal();
}

function closeSheet() {
  if (sheet.open) sheet.close();
  sheet.replaceChildren();
  sheetConfirm = null;
}

function confirmSheet(title, text, label, fn) {
  openSheet(`
    <h2 id="sheet-title">${esc(title)}</h2>
    <p>${esc(text)}</p>
    <div class="sheet-actions">
      <button class="btn btn-danger-solid" data-action="sheet-yes">${esc(label)}</button>
      <button class="btn btn-line" data-action="close-sheet">Cancelar</button>
    </div>`, fn);
}

sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
// Al cerrar la hoja de salida sin terminar (botón, velo o Escape), el circuito retoma.
sheet.addEventListener('close', () => {
  if (autoPaused && active?.kind === 'circuit') resumeCircuit();
  autoPaused = false;
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function route() {
  const hash = location.hash || '#/hoy';
  closeSheet();
  if (hash !== '#/sesion') {
    stopTicker();
    if (!active) signal.keepAwake(false);
    if (lastDone && hash !== '#/sesion') lastDone = null;
  }
  if (hash === '#/sesion') { renderSession(true); return; }
  if (hash === '#/historial') { mount(viewHistory(), 'azul', { paint: true }); return; }
  if (hash === '#/rutinas') { mount(viewRoutines(), 'azul', { paint: true }); return; }
  if (hash.startsWith('#/rutinas/')) {
    const html = viewRoutineEdit(decodeURIComponent(hash.slice(10)));
    if (html) { mount(html, 'azul', { paint: true }); return; }
    location.replace('#/rutinas');
    return;
  }
  if (hash === '#/ajustes') { mount(viewSettings(), 'azul', { paint: true }); return; }
  mount(viewToday(), 'azul', { paint: true });
}

window.addEventListener('hashchange', route);

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t || t.disabled || t.matches('input[type="file"]')) return;
  const a = t.dataset.action;
  const r = editingRoutine();

  switch (a) {
    case 'start':
      if (active) { location.hash = '#/sesion'; return; }
      startSession(t.dataset.routine);
      break;
    case 'finish-set': finishSet(); break;
    case 'pause-circuit': pauseCircuit(); break;
    case 'resume-circuit': resumeCircuit(); break;
    case 'start-timed': startTimed(); break;
    case 'stop-timed': endTimed(true); break;
    case 'skip-rest': endRest(); break;
    case 'extend-rest':
      active.restEnd += 15000;
      active.restTotal += 15000;
      store.saveActive(active);
      tick();
      announce('Quince segundos más de descanso.');
      break;
    case 'exit-session': openExitSheet(); break;
    case 'save-partial': closeSheet(); complete(true); break;
    case 'discard-session':
      closeSheet();
      active = null;
      store.saveActive(null);
      signal.keepAwake(false);
      stopTicker();
      location.hash = '#/hoy';
      toast('Sesión descartada.');
      break;
    case 'close-sheet': closeSheet(); break;
    case 'sheet-yes': {
      const fn = sheetConfirm;
      closeSheet();
      if (fn) fn();
      break;
    }
    case 'step': {
      const input = document.getElementById(t.dataset.for);
      if (!input) return;
      const delta = Number(t.dataset.delta);
      const min = Number(input.min || 0);
      const max = Number(input.max || 999);
      let v = input.value === '' ? null : Number(input.value);
      if (v == null) v = input.id === 'f-kg' ? (delta > 0 ? 8 : null) : 0;
      else v = clamp(v + delta, min, max);
      input.value = v ?? '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
    case 'delete-session':
      confirmSheet('¿Borrar esta sesión?', 'Se quita del historial y de la racha. No se puede deshacer.', 'Borrar sesión', () => {
        db.sessions = db.sessions.filter((s) => s.id !== t.dataset.id);
        persist();
        mount(viewHistory(), 'azul', { keepScroll: true, focus: false });
        toast('Sesión borrada.');
      });
      break;
    case 'add-routine': {
      const used = new Set(db.routines.map((x) => x.id));
      let id = 'C';
      for (const c of 'CDEFGHIJKLMNOPQRSTUVWXYZ') { if (!used.has(c)) { id = c; break; } }
      if (used.has(id)) id = `R${Date.now()}`;
      db.routines.push({ id, name: `Rutina ${id}`, days: [], rest: 40, exercises: [] });
      persist();
      location.hash = `#/rutinas/${encodeURIComponent(id)}`;
      break;
    }
    case 'toggle-day': {
      if (!r) return;
      const d = Number(t.dataset.day);
      r.days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort();
      t.setAttribute('aria-pressed', String(r.days.includes(d)));
      persist();
      markSaved();
      break;
    }
    case 'ex-up':
    case 'ex-down': {
      if (!r) return;
      const i = Number(t.dataset.ex);
      const j = a === 'ex-up' ? i - 1 : i + 1;
      if (j < 0 || j >= r.exercises.length) return;
      [r.exercises[i], r.exercises[j]] = [r.exercises[j], r.exercises[i]];
      persist();
      rerenderEditor();
      app.querySelector(`[data-action="${a}"][data-ex="${j}"]`)?.focus();
      break;
    }
    case 'ex-remove': {
      if (!r) return;
      const i = Number(t.dataset.ex);
      const name = r.exercises[i]?.name;
      r.exercises.splice(i, 1);
      persist();
      rerenderEditor();
      toast(`Quitaste ${name}.`);
      break;
    }
    case 'ex-add': {
      if (!r) return;
      const name = 'Ejercicio nuevo';
      let id = slugify(name);
      const ids = new Set(r.exercises.map((x) => x.id));
      while (ids.has(id)) id = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
      r.exercises.push(isCircuit(r) ? { id, name } : { id, name, sets: 3, mode: 'reps', reps: 10, weighted: false });
      persist();
      rerenderEditor();
      const inputs = app.querySelectorAll('.ex-edit-name');
      const last = inputs[inputs.length - 1];
      if (last) { last.focus(); last.select(); }
      break;
    }
    case 'delete-routine':
      if (!r) return;
      if (db.routines.length === 1) { toast('Necesitas al menos una rutina.'); return; }
      confirmSheet(`¿Borrar ${r.name}?`, 'Tu historial se queda como está. La rutina no se puede recuperar, salvo con “Restaurar rutinas originales” si era la A o la B.', 'Borrar rutina', () => {
        db.routines = db.routines.filter((x) => x !== r);
        persist();
        location.hash = '#/rutinas';
        toast('Rutina borrada.');
      });
      break;
    case 'test-signal':
      signal.unlockAudio();
      signal.done(db.settings);
      break;
    case 'export': exportData(); break;
    case 'confirm-import':
      if (pendingImport && store.replaceAll(pendingImport)) {
        db = store.load();
        pendingImport = null;
        closeSheet();
        mount(viewSettings(), 'azul', { focus: false });
        toast('Respaldo importado.');
      } else {
        closeSheet();
        toast('No se pudo importar el respaldo.');
      }
      break;
    case 'restore-routines':
      confirmSheet('¿Restaurar las rutinas originales?', 'Las rutinas A, B y Express vuelven a como venían; las que agregaste se borran. El historial no cambia.', 'Restaurar', () => {
        db.routines = defaultRoutines();
        persist();
        toast('Rutinas restauradas.');
      });
      break;
    default:
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('[data-action="import"]')) { importFile(el.files[0]); el.value = ''; return; }
  if (el.matches('[data-setting]')) {
    db.settings[el.dataset.setting] = el.checked;
    persist();
    return;
  }
  const r = editingRoutine();
  if (!r) return;
  if (el.dataset.rfield === 'name') {
    const v = el.value.trim();
    if (!v) { el.value = r.name; toast('El nombre no puede quedar vacío.'); return; }
    r.name = v;
    const h = app.querySelector('.page-h');
    if (h) h.textContent = v;
  } else if (['rest', 'rounds', 'work'].includes(el.dataset.rfield)) {
    const f = el.dataset.rfield;
    const limits = isCircuit(r) ? { rest: [0, 120], rounds: [1, 10], work: [10, 180] }[f] : f === 'rest' ? [15, 180] : null;
    if (!limits) return;
    const n = Math.round(Number(el.value));
    r[f] = Number.isFinite(n) && el.value !== '' ? clamp(n, ...limits) : r[f];
    el.value = r[f];
  } else if (el.dataset.field) {
    const needsRerender = applyExerciseField(r, Number(el.dataset.ex), el.dataset.field, el);
    persist();
    if (needsRerender) { rerenderEditor(); return; }
  } else {
    return;
  }
  persist();
  markSaved();
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.dataset.form === 'set') finishSet();
});

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}

route();
