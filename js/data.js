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
    defaultExpress(),
    defaultDespertar(),
    defaultCore4(),
    defaultPiso(),
  ];
}

/**
 * Rutina C · Core 4: circuito de fuerza por rondas con 1 kettlebell, a demanda (sin días).
 * Completa: calentamiento opcional de 3 min y 4 rondas de los 4 ejercicios seguidos, con
 * 75 s de descanso entre rondas. Modo corto: el mismo circuito en AMRAP de 15 min.
 * A diferencia de Despertar, cuenta para la meta semanal y la racha.
 */
export const CORE4_ID = 'core4';
export function defaultCore4() {
  return {
    id: CORE4_ID,
    kind: 'rounds',
    mark: 'C', // letra en la tira de la semana si se le asignan días
    name: 'Rutina C · Core 4',
    days: [],
    rounds: 4,
    rest: 75,
    warmup: 180,
    amrapMinutes: 15,
    exercises: [
      { id: 'c-thruster', name: 'Thruster con kettlebell', mode: 'reps', reps: 10, weighted: true, note: 'Agarrada de los cuernos frente al pecho: sentadilla y, al subir, empuja arriba.' },
      { id: 'c-remo', name: 'Remo a un brazo con kettlebell', mode: 'reps', reps: 10, perSide: true, weighted: true },
      { id: 'c-lagartijas', name: 'Lagartijas', mode: 'max', goal: 12, weighted: false },
      { id: 'c-swings', name: 'Swings', mode: 'reps', reps: 15, weighted: true },
    ],
  };
}

/**
 * Rutina Express: circuito de emergencia, a demanda (sin días).
 * 2 rondas de 35 s de trabajo y 15 s de descanso por ejercicio, sin descanso extra entre rondas.
 */
export const EXPRESS_ID = 'express';
export function defaultExpress() {
  return {
    id: EXPRESS_ID,
    kind: 'circuit',
    name: 'Rutina Express',
    days: [],
    rounds: 2,
    work: 35,
    rest: 15,
    exercises: [
      { id: 'x-swings', name: 'Swings con kettlebell' },
      { id: 'x-goblet', name: 'Sentadilla goblet' },
      { id: 'x-lagartijas', name: 'Lagartijas' },
      { id: 'x-dominadas', name: 'Dominadas o colgada en barra' },
      { id: 'x-plancha', name: 'Plancha' },
    ],
  };
}

/**
 * Despertar: circuito de movilidad sin equipo, a demanda (sin días).
 * 1 ronda de 30 s por ejercicio con 10 s de transición: 4 min 30 s.
 * `mobility` la saca de la meta semanal y de la racha, que son de fuerza.
 */
export const DESPERTAR_ID = 'despertar';
export function defaultDespertar() {
  return {
    id: DESPERTAR_ID,
    kind: 'circuit',
    mobility: true,
    name: 'Despertar',
    days: [],
    rounds: 1,
    work: 30,
    rest: 10,
    exercises: [
      { id: 'd-ondas', name: 'Ondas corporales', note: 'Dobla la cadera con los brazos colgando y sube arqueándote un poco con los brazos arriba, en forma de ola.' },
      { id: 'd-saltitos', name: 'Saltitos suaves', note: 'En el lugar, con los brazos sueltos y los pies apenas despegándose del piso.' },
      { id: 'd-cuello', name: 'Toquecitos en el cuello', note: 'Cabeza un poco hacia arriba, golpecitos suaves con las yemas al frente y a los lados.' },
      { id: 'd-giros', name: 'Giros de tronco', note: 'Sueltos, dejando que los brazos golpeen suave el torso.' },
      { id: 'd-brazos', name: 'Balanceo de brazos', note: 'Alternado, uno adelante y arriba y el otro atrás.' },
      { id: 'd-axila', name: 'Toquecitos en la axila', note: 'Con el brazo contrario arriba, 15 s de cada lado.' },
      { id: 'd-marcha', name: 'Marcha en el sitio', note: 'Subiendo rodillas y con brazo contrario.' },
    ],
  };
}

/**
 * Piso pélvico: sesión guiada de movilidad, a demanda (sin días). Como Despertar, lleva
 * `mobility` y no cuenta para la meta semanal ni la racha. Como la Rutina C, tiene dos modos
 * que se eligen en una hoja al empezar: Principiante (default) e Intermedio.
 * Cada paso es un bloque cronometrado (`seconds`) o una serie de intervalos (`reps` × `work`
 * de trabajo + `rest` de descanso, guiados uno por uno). Los textos de cada paso viven en
 * `exercises`; los modos solo dicen qué pasos van y con qué tiempos.
 */
export const PISO_ID = 'piso';
export const PISO_CUES = {
  ubicar: 'Aprieta como si quisieras cortar el chorro al orinar, o como si aguantaras un gas. Sientes un alce en la base, hacia adentro y arriba. Glúteos, panza y muslos se quedan suaves. Sigues respirando. Para comprobarlo, hazlo una sola vez al orinar y suelta; no lo uses como ejercicio de cada día.',
  soltar: 'Suelta del todo, como si dejaras salir un gas con suavidad o empezaras a orinar, sin pujar. El piso baja. Eso también se entrena.',
  postura: 'Postura: recostado con rodillas flexionadas o sentado en una silla firme. De pie, hasta intermedio.',
  aviso: [
    'Para si hay dolor, ardor, más urgencia para orinar, o no puedes relajar el músculo después. No hagas la sesión mientras orinas (salvo esa prueba única para ubicar). No dejes el músculo apretado todo el día.',
    'Si hay dolor pélvico, sangre, problemas para orinar o esto empeora, consulta a un médico (urólogo o fisioterapeuta de piso pélvico). Esto no sustituye una valoración médica.',
  ],
};
/** Nota que aparece al terminar la sesión. No se cronometra. */
export const CONTROL_NOTE = {
  title: 'Control',
  intro: 'Entrena esto a solas, con calma, no con prisa.',
  steps: [
    'Estimula con suavidad y califica la intensidad del 1 al 10.',
    'Al llegar a 6 o 7, para. Nada de seguir ‘un poquito más’.',
    'Haz el freno: aprieta el piso pélvico 5 segundos y exhala largo. Si sientes el piso ya muy apretado, haz lo contrario: suéltalo del todo y respira.',
    'Espera a que baje a 4 o 5.',
    'Retoma. Repite la pausa 3 o 4 veces.',
    'En la última puedes continuar hasta el final.',
  ],
  outro: [
    'Hazlo 1 o 2 veces por semana, además de la sesión diaria. El objetivo no es aguantar a fuerzas, sino reconocer la subida a tiempo y bajarla. Si te pasas del punto, no pasa nada: la próxima para un poco antes.',
    'Si contienes la respiración o aprietas la panza, la intensidad sube más rápido. Inhala por la nariz, exhala más largo que la inhalación.',
  ],
};
export function defaultPiso() {
  return {
    id: PISO_ID,
    kind: 'guided',
    mobility: true,
    name: 'Piso pélvico',
    days: [],
    defaultMode: 'principiante',
    exercises: [
      { id: 'p-localiza', name: 'Localiza', note: 'Siéntate o recuéstate con rodillas flexionadas. Aprieta suave 3 veces para ubicar el músculo. No aprietes glúteos ni panza. Respira.' },
      { id: 'p-suelta', name: 'Suelta del todo', note: 'Inhala por la nariz y deja que el piso baje. Exhala largo. No empujes hacia abajo con fuerza. Solo suelta.' },
      { id: 'p-lentas', name: 'Contracciones lentas', unit: 'intervalo', workWord: 'Aprieta', restWord: 'Suelta', note: 'Aprieta hacia adentro y arriba. Aguanta. Suelta por completo antes de la siguiente. Cara y hombros relajados. No contengas la respiración.' },
      { id: 'p-pulsos', name: 'Pulsos rápidos', unit: 'ronda', workWord: 'Pulsos', restWord: 'Descanso', note: 'Aprieta y suelta rápido, sin aguantar. Como un parpadeo abajo. Si se fatiga, para y suelta.' },
      { id: 'p-elevador', name: 'Elevador', unit: 'intervalo', workWord: 'Trabajo', restWord: 'Descanso', note: 'Aprieta un poco (piso 1), un poco más (piso 2), al máximo (piso 3). Baja igual de lento. No subas de golpe.' },
      { id: 'p-freno', name: 'El freno', unit: 'intervalo', workWord: 'Aprieta firme', restWord: 'Suelta', note: 'Aprieta firme, como pisar el freno, y exhala largo por la boca. Luego suelta del todo. Así se entrena parar cuando la intensidad sube.' },
      { id: 'p-respira', name: 'Respira y suelta', note: 'Mano en el abdomen. Inhala y la panza sube; el piso está suelto. Exhala más largo que la inhalación. Termina más suelto que tenso.' },
    ],
    modes: [
      {
        id: 'principiante',
        name: 'Principiante',
        steps: [
          { ex: 'p-localiza', seconds: 40 },
          { ex: 'p-suelta', seconds: 40 },
          { ex: 'p-lentas', reps: 10, work: 5, rest: 10 },
          { ex: 'p-pulsos', reps: 3, work: 15, rest: 15 },
          { ex: 'p-freno', reps: 6, work: 5, rest: 10 },
          { ex: 'p-respira', seconds: 60 },
        ],
      },
      {
        id: 'intermedio',
        name: 'Intermedio',
        steps: [
          { ex: 'p-localiza', seconds: 30 },
          { ex: 'p-suelta', seconds: 40 },
          { ex: 'p-lentas', reps: 10, work: 10, rest: 10 },
          { ex: 'p-pulsos', reps: 3, work: 20, rest: 15 },
          { ex: 'p-elevador', reps: 5, work: 12, rest: 6 },
          { ex: 'p-freno', reps: 6, work: 8, rest: 10 },
          { ex: 'p-respira', seconds: 60 },
        ],
      },
    ],
  };
}

export const isCircuit = (r) => r?.kind === 'circuit';
/** Circuito de fuerza por rondas (Rutina C): se elige junto a A y B y cuenta para la meta. */
export const isRounds = (r) => r?.kind === 'rounds';
/** Circuito de movilidad (Despertar): no cuenta para la meta ni la racha. */
export const isMobility = (r) => isCircuit(r) && r.mobility === true;

/** Sesión guiada por pasos (Piso pélvico): movilidad con modos; no cuenta para la meta ni la racha. */
export const isGuided = (r) => r?.kind === 'guided';

/** Modo de una sesión guiada; sin id (o si no existe), el default. */
export function guidedMode(r, modeId) {
  const modes = r.modes || [];
  return modes.find((m) => m.id === modeId) || modes.find((m) => m.id === r.defaultMode) || modes[0];
}

/** Segundos de un paso: un bloque, o intervalos de trabajo + descanso (cada uno con su descanso). */
export const stepSeconds = (st) => (st.reps ? st.reps * (st.work + st.rest) : st.seconds);

/** Duración de un modo en segundos: suma de sus pasos. */
export function guidedSeconds(r, modeId) {
  return guidedMode(r, modeId).steps.reduce((n, st) => n + stepSeconds(st), 0);
}

/**
 * Línea de tiempo de un modo: una fase por bloque y dos por intervalo (trabajo, descanso).
 * `step` es el índice del paso; `rep` el intervalo (desde 0).
 */
export function guidedPlan(r, modeId) {
  const out = [];
  guidedMode(r, modeId).steps.forEach((st, step) => {
    if (!st.reps) { out.push({ step, phase: 'block', ms: st.seconds * 1000 }); return; }
    for (let rep = 0; rep < st.reps; rep++) {
      out.push({ step, rep, phase: 'work', ms: st.work * 1000 });
      if (st.rest) out.push({ step, rep, phase: 'rest', ms: st.rest * 1000 });
    }
  });
  return out;
}

/** Intervalos de trabajo de un circuito (rondas × ejercicios). */
export function circuitIntervals(r) {
  return r.rounds * r.exercises.length;
}

/** Duración real del circuito en segundos: no hay descanso después del último ejercicio. */
export function circuitSeconds(r) {
  const n = circuitIntervals(r);
  return n * r.work + Math.max(0, n - 1) * r.rest;
}

/**
 * Segundos estimados de una vuelta a un ejercicio de un circuito por rondas: unos 3 s por
 * repetición (las dos manos si es por lado) más 30 s para tomar la kettlebell y acomodarse.
 */
function roundExerciseSeconds(ex) {
  const sides = ex.perSide ? 2 : 1;
  if (ex.mode === 'time') return ex.seconds * sides + 30;
  const reps = ex.mode === 'max' ? (ex.goal || 10) : ex.mode === 'range' ? ex.repsMax : ex.reps;
  return reps * sides * 3 + 30;
}

/** Duración estimada de la versión completa: calentamiento + rondas + descansos entre rondas. */
export function roundsSeconds(r) {
  const round = r.exercises.reduce((n, ex) => n + roundExerciseSeconds(ex), 0);
  return (r.warmup || 0) + r.rounds * round + Math.max(0, r.rounds - 1) * r.rest;
}

/** "8 min 5 s", "10 min". */
export function durationText(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
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

/** Meta por ronda en un circuito por rondas: "10 por lado", "máx · meta 12", "15". */
export function roundTarget(ex) {
  const side = sideLabel(ex);
  const t = ex.mode === 'max' ? (ex.goal ? `máx · meta ${ex.goal}` : 'máx') : targetText(ex);
  return `${t}${side ? ' ' + side : ''}`;
}

/** "3 × 10 por lado", "2 × máx", "3 × 30 s". */
export function prescription(ex) {
  const t = ex.mode === 'max' ? 'máx' : targetText(ex);
  const side = sideLabel(ex);
  return `${ex.sets} × ${t}${side ? ' ' + side : ''}`;
}

/** Series de una rutina de fuerza; en un circuito, sus intervalos de trabajo. */
export function totalSets(routine) {
  if (isGuided(routine)) return guidedMode(routine).steps.length;
  if (isCircuit(routine)) return circuitIntervals(routine);
  if (isRounds(routine)) return routine.rounds * routine.exercises.length;
  return routine.exercises.reduce((n, ex) => n + ex.sets, 0);
}

/** Duración estimada en minutos (trabajo aproximado por serie + descansos). */
export function estimateMinutes(routine) {
  if (isGuided(routine)) return Math.round(guidedSeconds(routine) / 60);
  if (isCircuit(routine)) return Math.round(circuitSeconds(routine) / 60);
  if (isRounds(routine)) return Math.round(roundsSeconds(routine) / 60);
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
