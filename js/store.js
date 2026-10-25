// Persistencia local (localStorage), estadísticas semanales y respaldo JSON.
import { defaultRoutines } from './data.js';

const KEY = 'entrenos.v1';
const ACTIVE_KEY = 'entrenos.activa.v1';
export const SCHEMA = 1;
export const WEEKLY_GOAL = 3;

function blank() {
  return {
    schema: SCHEMA,
    routines: defaultRoutines(),
    sessions: [],
    last: {}, // por ejercicio: { kg, reps: [por serie] }
    settings: { sound: true, vibrate: true },
  };
}

let db = null;

export function load() {
  if (db) return db;
  try {
    const raw = localStorage.getItem(KEY);
    db = raw ? normalize(JSON.parse(raw)) : blank();
  } catch {
    db = blank();
  }
  return db;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

function normalize(data) {
  const base = blank();
  if (!data || typeof data !== 'object') return base;
  return {
    schema: SCHEMA,
    routines: Array.isArray(data.routines) && data.routines.length ? data.routines : base.routines,
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    last: data.last && typeof data.last === 'object' ? data.last : {},
    settings: { ...base.settings, ...(data.settings || {}) },
  };
}

// ---- Sesión en curso -------------------------------------------------------

export function loadActive() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActive(active) {
  try {
    if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* sin espacio: la sesión sigue en memoria */ }
}

// ---- Último valor usado por ejercicio --------------------------------------

export function lastFor(exId) {
  return load().last[exId] || {};
}

export function remember(exId, setIndex, reps, kg) {
  const d = load();
  const entry = d.last[exId] || { reps: [] };
  if (reps != null) {
    entry.reps = entry.reps || [];
    entry.reps[setIndex] = reps;
  }
  if (kg != null) entry.kg = kg;
  d.last[exId] = entry;
}

// ---- Semanas (lunes a domingo, hora local) ---------------------------------

export function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - offset);
  return d;
}

export function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sessionsInWeek(sessions, ws) {
  const start = ws.getTime();
  const end = new Date(ws);
  end.setDate(end.getDate() + 7);
  return sessions.filter((s) => {
    const t = new Date(s.start).getTime();
    return t >= start && t < end.getTime();
  });
}

/** Semanas recientes (la más antigua primero) con su conteo de sesiones. */
export function recentWeeks(sessions, now, count = 8) {
  const out = [];
  const ws = weekStart(now);
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(ws);
    start.setDate(start.getDate() - i * 7);
    out.push({ start, count: sessionsInWeek(sessions, start).length, current: i === 0 });
  }
  return out;
}

/**
 * Racha: semanas seguidas que cumplieron la meta. La semana en curso suma si ya
 * la cumplió; si todavía no, no rompe la racha.
 */
export function streak(sessions, now) {
  let n = 0;
  const ws = weekStart(now);
  if (sessionsInWeek(sessions, ws).length >= WEEKLY_GOAL) n++;
  const cursor = new Date(ws);
  for (let i = 0; i < 520; i++) {
    cursor.setDate(cursor.getDate() - 7);
    if (sessionsInWeek(sessions, cursor).length >= WEEKLY_GOAL) n++;
    else break;
  }
  return n;
}

// ---- Respaldo ---------------------------------------------------------------

export function exportJSON() {
  const d = load();
  return JSON.stringify({ app: 'entrenos', schema: SCHEMA, exportedAt: new Date().toISOString(), ...d }, null, 2);
}

/** Valida un respaldo. Devuelve { ok, data, error }. No escribe nada. */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' };
  }
  if (!parsed || parsed.app !== 'entrenos') {
    return { ok: false, error: 'Este archivo no es un respaldo de Entrenos.' };
  }
  if (!Array.isArray(parsed.routines) || !Array.isArray(parsed.sessions)) {
    return { ok: false, error: 'Al respaldo le faltan rutinas o sesiones.' };
  }
  const badRoutine = parsed.routines.find((r) => !r || !r.id || !Array.isArray(r.exercises));
  if (badRoutine) return { ok: false, error: 'Una de las rutinas del respaldo está incompleta.' };
  return { ok: true, data: normalize(parsed) };
}

export function replaceAll(data) {
  db = normalize(data);
  return save();
}
