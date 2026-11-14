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

export function emptyPrefs() {
  return { target: null, mode: 'once', weights: {} };
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
  return prefs;
}

export function savePrefs(prefs) {
  write(UI_KEY, { t: prefs.target, m: prefs.mode, w: prefs.weights });
}
