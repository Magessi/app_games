// Game feel: synthesized sound (no assets), confetti, haptics, screen shake.

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

function blip(freq, { duration = 0.12, type = 'sine', gain = 0.15, when = 0 } = {}) {
  const ac = ctx();
  if (!ac || muted) return;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const t0 = ac.currentTime + when;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sound = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    localStorage.setItem('tl.muted', muted ? '1' : '0');
    return muted;
  },
  select() { blip(660, { duration: 0.06, gain: 0.07 }); },
  // Pitch rises with the piece hierarchy: green < yellow < red.
  place(color) { blip([0, 330, 415, 523][color] || 330, { duration: 0.14 }); },
  invalid() { blip(110, { duration: 0.18, type: 'square', gain: 0.08 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => blip(f, { when: i * 0.11, duration: 0.22 })); },
  lose() { [392, 330, 262].forEach((f, i) => blip(f, { when: i * 0.16, duration: 0.25, type: 'triangle' })); },
};

// --- Haptics ----------------------------------------------------------------

export function vibrate(pattern) {
  navigator.vibrate?.(pattern);
}

// --- Screen shake -----------------------------------------------------------

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

// --- Confetti ---------------------------------------------------------------

const COLORS = ['#34d399', '#fbbf24', '#ef4444', '#6366f1', '#a78bfa'];
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

  const parts = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 5 + 3,
    speed: Math.random() * 3 + 2,
    drift: Math.random() * Math.PI * 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tiltAngle: 0,
    tiltInc: Math.random() * 0.07 + 0.05,
  }));

  const step = () => {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    // iterate backwards so removals don't skip elements
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.y += p.speed;
      p.x += Math.sin(p.drift) * 0.5;
      p.tiltAngle += p.tiltInc;
      const tilt = Math.sin(p.tiltAngle) * 15;
      ctx2d.beginPath();
      ctx2d.lineWidth = p.size;
      ctx2d.strokeStyle = p.color;
      ctx2d.moveTo(p.x + tilt + p.size / 2, p.y);
      ctx2d.lineTo(p.x + tilt - p.size / 2, p.y + tilt + p.size / 2);
      ctx2d.stroke();
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
