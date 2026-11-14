// Lógica pura de selección y geometría. No toca el DOM ni el canvas.

export const TAU = Math.PI * 2;

export const mod = (value, m) => ((value % m) + m) % m;

/**
 * Convierte los porcentajes guardados en probabilidades normalizadas.
 * Un nombre sin valor recibe la parte igualitaria (100 / n).
 * Devuelve null si no hay porcentajes o si todos suman 0.
 */
export function resolveWeights(names, weights) {
  if (!weights || Object.keys(weights).length === 0 || names.length === 0) return null;
  const equalShare = 100 / names.length;
  const values = names.map((name) => {
    if (!Object.hasOwn(weights, name)) return equalShare;
    const v = Number(weights[name]);
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return null;
  return values.map((v) => v / total);
}

function weightedIndex(probabilities, rng) {
  let r = rng();
  let lastPositive = -1;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] <= 0) continue;
    lastPositive = i;
    r -= probabilities[i];
    if (r < 0) return i;
  }
  return lastPositive; // Solo por redondeo de coma flotante.
}

/**
 * Decide el índice ganador.
 * Prioridad: armado (`armed`) > nombre fijado (`target`) > porcentajes > uniforme.
 */
export function pickWinner(names, prefs = {}, rng = Math.random) {
  if (names.length === 0) return -1;
  for (const name of [prefs.armed, prefs.target]) {
    const fixed = name ? names.indexOf(name) : -1;
    if (fixed !== -1) return fixed;
  }
  const probabilities = resolveWeights(names, prefs.weights);
  if (probabilities) return weightedIndex(probabilities, rng);
  return Math.floor(rng() * names.length);
}

/**
 * Índice de la porción que queda bajo el puntero (arriba) para una rotación dada.
 * La porción i ocupa [i·s, (i+1)·s) medida en sentido horario desde el puntero
 * cuando la rotación es 0.
 */
export function indexAtPointer(rotation, count) {
  const slice = TAU / count;
  return Math.floor(mod(-rotation, TAU) / slice) % count;
}

/**
 * Rotación final para que el puntero caiga dentro de la porción `index`,
 * entre el 10% y el 90% de su ancho, tras 5–8 vueltas completas.
 */
export function targetRotation(index, count, current, rng = Math.random) {
  const slice = TAU / count;
  const offset = (0.1 + 0.8 * rng()) * slice;
  const target = mod(-(index * slice + offset), TAU);
  const delta = mod(target - mod(current, TAU), TAU);
  const turns = 5 + Math.floor(rng() * 3);
  return current + turns * TAU + delta;
}

export const spinDuration = (rng = Math.random) => 4000 + rng() * 2000;
