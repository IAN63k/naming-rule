import { TAU, mod } from './picker.js';

const PALETTE = [
  '#e63946', '#f4a261', '#e9c46a', '#8ac926', '#2a9d8f', '#00b4d8',
  '#3a86ff', '#5e60ce', '#9d4edd', '#d63384', '#ff7b54', '#43aa8b',
];

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

function textColorFor(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.36 ? '#111827' : '#ffffff';
}

/** Color de la porción i evitando que la última y la primera coincidan. */
export function sliceColor(i, count) {
  const len = PALETTE.length;
  if (count > 1 && i === count - 1 && i % len === 0) {
    return PALETTE[(i + Math.floor(len / 2)) % len];
  }
  return PALETTE[i % len];
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

export class Wheel {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.names = [];
    this.rotation = 0;
    this.offset = 0; // Desvío temporal al arrastrar; no altera `rotation`.
    this.settleFrame = 0;
    this.size = 0;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  setNames(names) {
    this.names = [...names];
    this.draw();
  }

  resize() {
    const size = Math.round(this.canvas.clientWidth);
    if (!size || size === this.size) return;
    const dpr = window.devicePixelRatio || 1;
    this.size = size;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  draw() {
    const { ctx, size, names } = this;
    if (!size) return;
    const c = size / 2;
    const radius = c - 4;
    ctx.clearRect(0, 0, size, size);

    if (names.length === 0) {
      this.drawPlaceholder(c, radius);
    } else {
      names.forEach((name, i) => this.drawSlice(name, i, c, radius));
    }
    this.drawHub(c, radius);
  }

  drawPlaceholder(c, radius) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, TAU);
    ctx.fillStyle = '#e5e7eb';
    ctx.fill();
  }

  drawSlice(name, i, c, radius) {
    const { ctx } = this;
    const count = this.names.length;
    const slice = TAU / count;
    // -π/2 coloca el inicio de la porción 0 bajo el puntero superior.
    const start = this.rotation + this.offset - Math.PI / 2 + i * slice;
    const color = sliceColor(i, count);

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (count > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, radius / 150);
      ctx.stroke();
    }

    const scale = radius / 220;
    const arcAtText = slice * radius * 0.7;
    const fontSize = Math.max(9, Math.min(22 * scale, arcAtText * 0.55));
    const padding = radius * 0.06;
    const maxWidth = radius * 0.78 - padding;

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(start + slice / 2);
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColorFor(color);
    ctx.fillText(fitText(ctx, name, maxWidth), radius - padding, 0);
    ctx.restore();
  }

  drawHub(c, radius) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(c, c, radius * 0.12, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(c, c, radius * 0.05, 0, TAU);
    ctx.fillStyle = '#1f2937';
    ctx.fill();
  }

  /** Desvía la ruleta temporalmente (arrastre). */
  setOffset(offset) {
    cancelAnimationFrame(this.settleFrame);
    this.offset = offset;
    this.draw();
  }

  /** Devuelve suavemente la ruleta a su posición tras un arrastre. */
  settle(duration = 280) {
    cancelAnimationFrame(this.settleFrame);
    const from = this.offset;
    if (!from) return;
    const startTime = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      this.offset = from * (1 - easeOutCubic(t));
      this.draw();
      if (t < 1) this.settleFrame = requestAnimationFrame(step);
    };
    this.settleFrame = requestAnimationFrame(step);
  }

  /** Anima hasta `target` en `duration` ms. Resuelve al detenerse. */
  spin(target, duration) {
    cancelAnimationFrame(this.settleFrame);
    this.offset = 0;
    const from = this.rotation;
    const distance = target - from;
    const startTime = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        this.rotation = from + distance * easeOutCubic(t);
        this.draw();
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          this.rotation = mod(target, TAU);
          resolve(this.rotation);
        }
      };
      requestAnimationFrame(step);
    });
  }
}
