// Avisos: sonido con Web Audio y vibración cuando el dispositivo la tiene.
let ctx = null;

/** iOS solo deja sonar audio que se desbloqueó con un toque. Llamar en cada gesto de inicio. */
export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    try { ctx = new AC(); } catch { ctx = null; return; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function tone(freq, start, dur, gain = 0.35) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Pitido corto de cuenta regresiva (3, 2, 1). */
export function tick(settings) {
  if (!settings.sound || !ctx) return;
  tone(660, ctx.currentTime, 0.09, 0.2);
}

/** Aviso de fin: tres tonos subiendo + vibración. */
export function done(settings) {
  if (settings.sound && ctx) {
    const t = ctx.currentTime;
    tone(784, t, 0.16);
    tone(988, t + 0.2, 0.16);
    tone(1319, t + 0.4, 0.42);
  }
  if (settings.vibrate && 'vibrate' in navigator) {
    try { navigator.vibrate([220, 90, 220, 90, 420]); } catch { /* sin vibración */ }
  }
}

function buzz(settings, pattern) {
  if (settings.vibrate && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* sin vibración */ }
  }
}

/** Circuito, trabajo → descanso: dos tonos bajando + vibración doble. */
export function toRest(settings) {
  if (settings.sound && ctx) {
    const t = ctx.currentTime;
    tone(988, t, 0.14);
    tone(659, t + 0.18, 0.32);
  }
  buzz(settings, [200, 90, 200]);
}

/** Circuito, descanso → trabajo: dos tonos subiendo + vibración larga. */
export function toWork(settings) {
  if (settings.sound && ctx) {
    const t = ctx.currentTime;
    tone(784, t, 0.14);
    tone(1175, t + 0.18, 0.32);
  }
  buzz(settings, [420]);
}

// ---- Pantalla encendida (Wake Lock) ----------------------------------------

let lock = null;
let wanted = false;

async function acquire() {
  if (!wanted || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch {
    lock = null;
  }
}

export function keepAwake(on) {
  wanted = on;
  if (on) acquire();
  else if (lock) {
    lock.release().catch(() => {});
    lock = null;
  }
}

export function wakeLockSupported() {
  return 'wakeLock' in navigator;
}

// Al volver a la pestaña el sistema suelta el bloqueo: se pide de nuevo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') acquire();
});
