// Rutinas por defecto y utilidades de descripción.
// Días: 0 = domingo … 6 = sábado (como Date#getDay).

export const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Orden de la semana para mostrar: lunes primero.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const MODES = {
  reps: 'Repeticiones',
  max: 'Al máximo',
  range: 'Rango',
  time: 'Tiempo',
};

export function defaultRoutines() {
  return [
    {
      id: 'A',
      name: 'Rutina A',
      days: [1, 5],
      rest: 40,
      exercises: [
        { id: 'goblet', name: 'Sentadilla goblet', sets: 3, mode: 'reps', reps: 10, weighted: true },
        { id: 'lagartijas', name: 'Lagartijas', sets: 3, mode: 'max', weighted: false },
        { id: 'peso-muerto', name: 'Peso muerto con kettlebell', sets: 3, mode: 'reps', reps: 12, weighted: true },
        { id: 'remo', name: 'Remo a una mano', sets: 3, mode: 'reps', reps: 10, perSide: true, weighted: true },
        { id: 'dominadas-supinas', name: 'Dominadas supinas', sets: 2, mode: 'max', weighted: false },
        { id: 'plancha', name: 'Plancha', sets: 3, mode: 'time', seconds: 30, weighted: false },
      ],
    },
    {
      id: 'B',
      name: 'Rutina B',
      days: [3],
      rest: 40,
      exercises: [
        { id: 'swings', name: 'Swings', sets: 4, mode: 'reps', reps: 15, weighted: true },
        { id: 'press-hombro', name: 'Press de hombro', sets: 3, mode: 'reps', reps: 8, perSide: true, weighted: true },
        { id: 'zancadas', name: 'Zancadas', sets: 3, mode: 'reps', reps: 8, perSide: true, perSideLabel: 'por pierna', weighted: true },
        { id: 'dominadas', name: 'Dominadas', sets: 3, mode: 'range', reps: 5, repsMax: 8, weighted: false },
        { id: 'escaladores', name: 'Escaladores', sets: 3, mode: 'time', seconds: 30, weighted: false },
      ],
    },
  ];
}

export function sideLabel(ex) {
  if (!ex.perSide) return '';
  return ex.perSideLabel || 'por lado';
}

/** Meta de una serie en texto corto: "10", "MÁX", "5–8", "30 s". */
export function targetText(ex) {
  switch (ex.mode) {
    case 'max': return 'Máx';
    case 'range': return `${ex.reps}–${ex.repsMax}`;
    case 'time': return `${ex.seconds} s`;
    default: return String(ex.reps);
  }
}

/** "3 × 10 por lado", "2 × máx", "3 × 30 s". */
export function prescription(ex) {
  const t = ex.mode === 'max' ? 'máx' : targetText(ex);
  const side = sideLabel(ex);
  return `${ex.sets} × ${t}${side ? ' ' + side : ''}`;
}

export function totalSets(routine) {
  return routine.exercises.reduce((n, ex) => n + ex.sets, 0);
}

/** Duración estimada en minutos (trabajo aproximado por serie + descansos). */
export function estimateMinutes(routine) {
  let work = 0;
  for (const ex of routine.exercises) {
    let perSet;
    if (ex.mode === 'time') perSet = ex.seconds + 10;
    else if (ex.mode === 'max') perSet = 30;
    else perSet = Math.max(20, Math.round((ex.mode === 'range' ? ex.repsMax : ex.reps) * 2.5)) + 5;
    if (ex.perSide) perSet = perSet * 2 - 5;
    work += perSet * ex.sets;
  }
  const rests = Math.max(0, totalSets(routine) - 1) * routine.rest;
  return Math.round((work + rests) / 60);
}

export function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40) || 'ejercicio';
}
