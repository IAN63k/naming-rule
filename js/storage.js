const NAMES_KEY = 'ruleta.nombres';
const UI_KEY = 'ruleta.ui';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena): se ignora.
  }
}

export function loadNames() {
  const value = read(NAMES_KEY, []);
  return Array.isArray(value) ? value.filter((n) => typeof n === 'string' && n.trim()) : [];
}

export function saveNames(names) {
  write(NAMES_KEY, names);
}

const CACHE_KEY = 'ruleta.c';

export const GESTURE_DEFAULTS = Object.freeze({ enabled: true, threshold: 0.8, windowMs: 700 });

const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.min(max, Math.max(min, num)) : fallback;
};

export function emptyPrefs() {
  return { target: null, mode: 'once', weights: {}, gesture: { ...GESTURE_DEFAULTS } };
}

/** Plantillas propias: [{ name, points: [{x, y}] }]. */
export function loadTemplates() {
  const raw = read(CACHE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t.n === 'string' && Array.isArray(t.p))
    .map((t) => ({ name: t.n, points: t.p.map(([x, y]) => ({ x, y })) }))
    .filter((t) => t.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
}

export function saveTemplates(templates) {
  write(CACHE_KEY, templates.map((t) => ({
    n: t.name,
    p: t.points.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]),
  })));
}

export function clearTemplates() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Sin almacenamiento disponible: nada que borrar.
  }
}

export function loadPrefs() {
  const raw = read(UI_KEY, null);
  const prefs = emptyPrefs();
  if (!raw || typeof raw !== 'object') return prefs;
  if (typeof raw.t === 'string') prefs.target = raw.t;
  if (raw.m === 'always') prefs.mode = 'always';
  if (raw.w && typeof raw.w === 'object') {
    for (const [name, value] of Object.entries(raw.w)) {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0) prefs.weights[name] = num;
    }
  }
  if (raw.g && typeof raw.g === 'object') {
    prefs.gesture = {
      enabled: raw.g.e !== false,
      threshold: clamp(raw.g.h, 0.5, 0.99, GESTURE_DEFAULTS.threshold),
      windowMs: clamp(raw.g.v, 300, 1500, GESTURE_DEFAULTS.windowMs),
    };
  }
  return prefs;
}

export function savePrefs(prefs) {
  const { enabled, threshold, windowMs } = prefs.gesture;
  write(UI_KEY, { t: prefs.target, m: prefs.mode, w: prefs.weights, g: { e: enabled, h: threshold, v: windowMs } });
}
