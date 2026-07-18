// Game feel: sparse music-box / soft-bell tones (no assets), a gentle
// petal-fall celebration, haptics, and soft screen motion.

// --- Sound (Web Audio) ------------------------------------------------------

let audioCtx = null;
let muted = localStorage.getItem('tl.muted') === '1';

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// A music-box bell: soft attack, long ring-out, with a quiet inharmonic
// partial that gives the metallic shimmer.
function bell(freq, { when = 0, duration = 1.1, gain = 0.07 } = {}) {
  const ac = ctx();
  if (!ac || muted) return;
  const t0 = ac.currentTime + when;
  for (const [mult, g] of [[1, gain], [3.01, gain * 0.18]]) {
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * mult, t0);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(g, t0 + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0004, t0 + duration);
    osc.connect(amp).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.1);
  }
}

// A low, muted wooden knock for "that cannot be built there".
function knock() {
  const ac = ctx();
  if (!ac || muted) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, t0);
  osc.frequency.exponentialRampToValueAtTime(95, t0 + 0.12);
  amp.gain.setValueAtTime(0.06, t0);
  amp.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.16);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + 0.2);
}

// Pentatonic steps: the pagoda sings higher as it grows.
const STAGE_NOTES = [0, 440, 554.4, 659.3]; // A4, C#5, E5

export const sound = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    localStorage.setItem('tl.muted', muted ? '1' : '0');
    return muted;
  },
  select() { bell(830.6, { duration: 0.35, gain: 0.03 }); },
  place(color) {
    bell(STAGE_NOTES[color] || 440);
    // Consecration: a second bell answers — the soft chime of the spire.
    if (color === 3) bell(880, { when: 0.16, duration: 1.5, gain: 0.05 });
  },
  invalid() { knock(); },
  win() { [440, 554.4, 659.3, 880].forEach((f, i) => bell(f, { when: i * 0.22, duration: 1.6 })); },
  lose() { [659.3, 554.4, 440].forEach((f, i) => bell(f, { when: i * 0.28, duration: 1.4, gain: 0.05 })); },
};

// --- Haptics ----------------------------------------------------------------

export function vibrate(pattern) {
  navigator.vibrate?.(pattern);
}

// --- Screen motion ----------------------------------------------------------

export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth; // restart the animation
  el.classList.add('shake');
}

export function flashInvalid(cellEl) {
  cellEl.classList.remove('invalid-flash');
  void cellEl.offsetWidth;
  cellEl.classList.add('invalid-flash');
}

// --- Petal fall (win celebration) ------------------------------------------

// Soft pastel petals drifting down like blossom over the water.
const PETALS = ['#f6b8a0', '#f2d0a7', '#cfe6d4', '#f7e3c8', '#e8b4a4'];
let confettiRaf = null;

export function startConfetti() {
  let canvas = document.getElementById('confetti');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti';
    document.body.appendChild(canvas);
  }
  const ctx2d = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const parts = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 4 + 2.5,
    speed: Math.random() * 1.1 + 0.6,
    drift: Math.random() * Math.PI * 2,
    driftSpeed: Math.random() * 0.02 + 0.008,
    color: PETALS[Math.floor(Math.random() * PETALS.length)],
    tilt: Math.random() * Math.PI,
  }));

  const step = () => {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    // iterate backwards so removals don't skip elements
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.y += p.speed;
      p.drift += p.driftSpeed;
      p.x += Math.sin(p.drift) * 0.9;
      p.tilt += 0.02;
      ctx2d.save();
      ctx2d.translate(p.x, p.y);
      ctx2d.rotate(Math.sin(p.tilt) * 0.6);
      ctx2d.fillStyle = p.color;
      ctx2d.globalAlpha = 0.85;
      ctx2d.beginPath();
      ctx2d.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.restore();
      if (p.y > canvas.height) parts.splice(i, 1);
    }
    if (parts.length > 0) confettiRaf = requestAnimationFrame(step);
    else stopConfetti();
  };
  stopConfetti();
  confettiRaf = requestAnimationFrame(step);
}

export function stopConfetti() {
  if (confettiRaf) cancelAnimationFrame(confettiRaf);
  confettiRaf = null;
  document.getElementById('confetti')?.remove();
}
