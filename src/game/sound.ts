// Tiny synthesized sound effects. No audio files; nothing plays until the
// player has clicked (browsers require that).
let ctx: AudioContext | null = null;
let muted = false;
let last: Record<string, number> = {};

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function ensure(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  const ac = ensure();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

const SOUNDS: Record<string, () => void> = {
  gather: () => tone(520 + Math.random() * 80, 0.09, 'triangle', 0.12, 180),
  place: () => { tone(150, 0.14, 'sine', 0.2, -60); tone(300, 0.06, 'triangle', 0.08); },
  grab: () => tone(340, 0.05, 'sine', 0.06, 60),
  breakdown: () => { tone(260, 0.08, 'square', 0.05, -120); tone(180, 0.1, 'square', 0.05, -80, 0.05); },
  eat: () => { tone(420, 0.1, 'sine', 0.16, -220); tone(240, 0.12, 'sine', 0.12, -120, 0.08); },
  hurt: () => tone(900, 0.05, 'sawtooth', 0.05, -500),
  die: () => { tone(300, 0.3, 'sawtooth', 0.09, -240); },
  ask: () => tone(660, 0.07, 'sine', 0.07, 120),
  answer: () => { tone(520, 0.08, 'sine', 0.07); tone(780, 0.12, 'sine', 0.07, 0, 0.08); },
  dusk: () => { tone(220, 0.9, 'sine', 0.12, -90); tone(165, 1.1, 'sine', 0.1, -60, 0.15); },
  raid: () => { for (let k = 0; k < 3; k++) tone(90, 0.16, 'sine', 0.25, -30, k * 0.22); },
  dawn: () => { [392, 494, 587, 784].forEach((f, k) => tone(f, 0.35, 'triangle', 0.09, 0, k * 0.11)); },
  deny: () => tone(160, 0.12, 'square', 0.05, -40),
};

/** play a named effect, at most once per `gap` seconds */
export function sfx(name: string, gap = 0.04) {
  const now = performance.now() / 1000;
  if (now - (last[name] ?? -1) < gap) return;
  last[name] = now;
  SOUNDS[name]?.();
}
