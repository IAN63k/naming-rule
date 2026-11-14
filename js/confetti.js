const COLORS = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#3a86ff', '#9d4edd', '#d63384'];
const DURATION = 3500;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function createParticle(width, height) {
  return {
    x: width / 2 + (Math.random() - 0.5) * width * 0.3,
    y: height * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 4,
    size: 6 + Math.random() * 6,
    angle: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

let frame = 0;

export function stopConfetti(canvas) {
  cancelAnimationFrame(frame);
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

export function launchConfetti(canvas, count = 160) {
  if (reducedMotion()) return;
  cancelAnimationFrame(frame);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = Array.from({ length: count }, () => createParticle(width, height));
  const start = performance.now();

  const step = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
    for (const p of particles) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (elapsed < DURATION) frame = requestAnimationFrame(step);
    else ctx.clearRect(0, 0, width, height);
  };
  frame = requestAnimationFrame(step);
}
