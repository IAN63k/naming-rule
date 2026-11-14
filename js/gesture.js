// Reconocedor de trazos basado en $1 Unistroke Recognizer
// (Wobbrock, Wilson y Li, 2007), adaptado a dígitos:
// - No se normaliza la rotación (en $1 original un 6 y un 9, o un 1 y una
//   línea horizontal, serían el mismo trazo); solo se busca el mejor ángulo
//   dentro de ±ANGLE_RANGE para tolerar escritura inclinada.
// - El escalado es uniforme para no deformar trazos casi rectos (1, línea).

export const NUM_POINTS = 64;
export const SQUARE_SIZE = 250;
export const DEFAULT_THRESHOLD = 0.8;
export const CLEAR = 'clear';
export const MIN_STROKE_LENGTH = 40; // px de pantalla
export const MIN_STROKE_SPAN = 18;   // px de pantalla

const ANGLE_RANGE = deg(20);
const ANGLE_PRECISION = deg(2);
const PHI = 0.5 * (-1 + Math.sqrt(5));
const HALF_DIAGONAL = 0.5 * Math.sqrt(2 * SQUARE_SIZE ** 2);

function deg(d) {
  return (d * Math.PI) / 180;
}

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export function pathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
  return length;
}

function boundingBox(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function centroid(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function resample(points, n) {
  const interval = pathLength(points) / (n - 1);
  const src = points.map((p) => ({ x: p.x, y: p.y }));
  const out = [{ ...src[0] }];
  let accumulated = 0;
  for (let i = 1; i < src.length; i++) {
    const d = distance(src[i - 1], src[i]);
    if (d > 0 && accumulated + d >= interval) {
      const t = (interval - accumulated) / d;
      const q = {
        x: src[i - 1].x + t * (src[i].x - src[i - 1].x),
        y: src[i - 1].y + t * (src[i].y - src[i - 1].y),
      };
      out.push(q);
      src.splice(i, 0, q);
      accumulated = 0;
    } else {
      accumulated += d;
    }
  }
  while (out.length < n) out.push({ ...src[src.length - 1] });
  return out.slice(0, n);
}

function rotateBy(points, angle) {
  const c = centroid(points);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function scaleUniform(points, size) {
  const box = boundingBox(points);
  const scale = size / Math.max(box.width, box.height);
  return points.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

function translateToOrigin(points) {
  const c = centroid(points);
  return points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}

/** Convierte un trazo crudo en la forma canónica que compara el reconocedor. */
export function normalizeStroke(points) {
  if (points.length < 2 || pathLength(points) === 0) return null;
  const resampled = resample(points, NUM_POINTS);
  return translateToOrigin(scaleUniform(resampled, SQUARE_SIZE));
}

function pathDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += distance(a[i], b[i]);
  return d / a.length;
}

function distanceAtAngle(points, template, angle) {
  return pathDistance(rotateBy(points, angle), template);
}

/** Búsqueda por sección áurea del ángulo que minimiza la distancia. */
function distanceAtBestAngle(points, template) {
  let a = -ANGLE_RANGE;
  let b = ANGLE_RANGE;
  let x1 = PHI * a + (1 - PHI) * b;
  let f1 = distanceAtAngle(points, template, x1);
  let x2 = (1 - PHI) * a + PHI * b;
  let f2 = distanceAtAngle(points, template, x2);
  while (Math.abs(b - a) > ANGLE_PRECISION) {
    if (f1 < f2) {
      b = x2; x2 = x1; f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceAtAngle(points, template, x1);
    } else {
      a = x1; x1 = x2; f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceAtAngle(points, template, x2);
    }
  }
  return Math.min(f1, f2);
}

/** true si el trazo es demasiado pequeño para ser un gesto (clic, tap). */
export function isTooShort(points) {
  if (points.length < 2) return true;
  const box = boundingBox(points);
  return pathLength(points) < MIN_STROKE_LENGTH || Math.max(box.width, box.height) < MIN_STROKE_SPAN;
}

export function makeTemplate(name, points) {
  return { name, points: normalizeStroke(points) };
}

/**
 * Compara el trazo con las plantillas.
 * Devuelve { name, score, ranking } (ranking: mejor score por nombre, de mayor
 * a menor), o null si el trazo es inválido.
 */
export function recognize(points, templates) {
  if (isTooShort(points)) return null;
  const candidate = normalizeStroke(points);
  if (!candidate) return null;
  const bestByName = new Map();
  for (const template of templates) {
    if (!template.points) continue;
    const d = distanceAtBestAngle(candidate, template.points);
    const score = Math.max(0, 1 - d / HALF_DIAGONAL);
    if (score > (bestByName.get(template.name) ?? -1)) bestByName.set(template.name, score);
  }
  if (bestByName.size === 0) return null;
  const ranking = [...bestByName].map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);
  return { name: ranking[0].name, score: ranking[0].score, ranking };
}

// ---------------------------------------------------------------------------
// Plantillas de fábrica (coordenadas de pantalla: y crece hacia abajo,
// ángulos en grados con 0 = derecha y 90 = abajo).

function line(...vertices) {
  const out = [];
  for (let i = 1; i < vertices.length; i++) {
    const [x0, y0] = vertices[i - 1];
    const [x1, y1] = vertices[i];
    const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      out.push({ x: x0 + ((x1 - x0) * s) / steps, y: y0 + ((y1 - y0) * s) / steps });
    }
  }
  return out;
}

function arc(cx, cy, rx, ry, fromDeg, toDeg) {
  const steps = Math.max(8, Math.ceil(Math.abs(toDeg - fromDeg) / 5));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = deg(fromDeg + ((toDeg - fromDeg) * i) / steps);
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

const join = (...parts) => parts.flat();
const at = (points) => [points[points.length - 1].x, points[points.length - 1].y];

function figureEight(direction) {
  return Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * Math.PI * 2;
    return { x: 50 - direction * 32 * Math.sin(2 * t), y: 75 - 70 * Math.cos(t) };
  });
}

export function buildFactoryStrokes() {
  const two = arc(50, 42, 36, 36, 195, 395);
  const threeTop = arc(50, 38, 32, 32, 210, 450);
  const fiveTop = line([85, 0], [18, 0], [14, 62]);
  const sixDown = line([78, 0], [38, 40], [15, 105]);
  const sixCurve = arc(75, 105, 60, 105, 245, 180);
  const nineLoop = arc(48, 40, 36, 36, -15, -375);
  const flatThree = line([10, 2], [85, 2], [45, 62]);

  return [
    ['0', arc(50, 75, 40, 72, -90, -450)],
    ['0', arc(50, 75, 40, 72, -90, 270)],
    ['0', arc(50, 75, 40, 72, -60, -420)],
    ['1', line([50, 0], [50, 150])],
    ['1', line([28, 28], [52, 0], [52, 150])],
    ['1', line([32, 22], [50, 0], [46, 150])],
    ['2', join(two, line(at(two), [10, 150], [92, 150]))],
    ['2', line([12, 30], [50, 2], [86, 30], [10, 150], [92, 150])],
    ['2', join(arc(50, 42, 36, 36, 200, 380), line([86, 42], [12, 150], [90, 140]))],
    ['3', join(threeTop, arc(50, 108, 40, 38, 270, 520))],
    ['3', join(flatThree, arc(50, 104, 40, 42, 255, 520))],
    ['3', join(arc(48, 38, 30, 34, 200, 450), arc(48, 110, 38, 38, 270, 500))],
    ['4', line([70, 150], [70, 0], [5, 100], [95, 100])],
    ['4', line([65, 0], [5, 100], [95, 100], [70, 100], [70, 150])],
    ['4', line([15, 0], [10, 88], [85, 88], [85, 0], [85, 150])],
    ['5', join(fiveTop, arc(48, 104, 40, 42, 228, 520))],
    ['5', join(line([18, 0], [14, 62]), arc(48, 104, 40, 42, 228, 520))],
    ['5', join(line([85, 0], [18, 0], [14, 62], [60, 62]), arc(55, 106, 32, 44, 280, 520))],
    ['6', join(sixDown, arc(50, 110, 36, 36, 180, -180))],
    ['6', join(sixCurve, arc(50, 112, 36, 34, 180, -180))],
    ['6', join(line([75, 0], [20, 95]), arc(50, 112, 32, 34, 190, -160))],
    ['7', line([10, 5], [90, 5], [35, 150])],
    ['7', line([10, 22], [10, 5], [90, 5], [35, 150])],
    ['7', line([10, 5], [90, 5], [62, 70], [48, 150])],
    ['8', figureEight(1)],
    ['8', figureEight(-1)],
    ['9', join(nineLoop, line(at(nineLoop), [82, 150]))],
    ['9', join(nineLoop, line(at(nineLoop), [70, 150]))],
    ['9', join(arc(48, 40, 36, 36, -40, -400), line([79, 22], [78, 150]))],
  ];
}

export const FACTORY_TEMPLATES = buildFactoryStrokes().map(([name, points]) => makeTemplate(name, points));

// ---------------------------------------------------------------------------
// Reglas geométricas que no dependen de $1.

const MAX_BAR_ANGLE = deg(25);
const MIN_BAR_LENGTH = 8;
const ZIGZAG_MIN_TURNS = 3;
const ZIGZAG_MIN_SWING = 8; // px que debe retroceder para contar un cambio de sentido
const AMBIGUITY_MARGIN = 0.05;

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function segmentsIntersect(p1, p2, q1, q2) {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/**
 * ¿El trazo `bar` es la raya del 7 sobre `stem`?
 * Casi horizontal, más corta que el trazo principal y cruzándolo.
 */
export function isCrossBar(bar, stem) {
  if (bar.length < 2 || stem.length < 2) return false;
  const start = bar[0];
  const end = bar[bar.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.hypot(dx, dy) < MIN_BAR_LENGTH) return false;
  const angle = Math.abs(Math.atan2(dy, dx));
  if (Math.min(angle, Math.PI - angle) >= MAX_BAR_ANGLE) return false;
  if (pathLength(bar) >= pathLength(stem)) return false;
  for (let i = 1; i < stem.length; i++) {
    if (segmentsIntersect(start, end, stem[i - 1], stem[i])) return true;
  }
  return false;
}

/** Cuenta cambios de sentido en X, con histéresis para ignorar temblores. */
function horizontalTurns(points) {
  let turns = 0;
  let direction = 0;
  let extreme = points[0].x;
  for (const { x } of points) {
    if (direction === 0) {
      if (Math.abs(x - extreme) >= ZIGZAG_MIN_SWING) {
        direction = Math.sign(x - extreme);
        extreme = x;
      }
    } else if ((x - extreme) * direction > 0) {
      extreme = x; // Sigue avanzando en el mismo sentido.
    } else if (Math.abs(x - extreme) >= ZIGZAG_MIN_SWING) {
      turns++;
      direction = -direction;
      extreme = x;
    }
  }
  return turns;
}

/** Zigzag horizontal ("borrar"): 3+ cambios de sentido en X, recorrido mayormente horizontal. */
export function isZigzag(points) {
  if (points.length < 4) return false;
  // Se simplifica a pasos de ~6 px para que el temblor no sume recorrido.
  const simplified = [points[0]];
  for (const p of points) {
    if (distance(p, simplified[simplified.length - 1]) >= 6) simplified.push(p);
  }
  let travelX = 0;
  let travelY = 0;
  for (let i = 1; i < simplified.length; i++) {
    travelX += Math.abs(simplified[i].x - simplified[i - 1].x);
    travelY += Math.abs(simplified[i].y - simplified[i - 1].y);
  }
  return travelX >= 2 * travelY && horizontalTurns(points) >= ZIGZAG_MIN_TURNS;
}

/** El 7 sin raya cuenta como 1, así que para decidir son el mismo resultado. */
const asResult = (name) => (name === '7' ? '1' : name);

/**
 * Interpreta un gesto completo (1 o 2 trazos).
 * Devuelve { result, score, crossed, best } donde result es '0'–'9', CLEAR o null.
 * - 2 trazos: solo es válido si el segundo es la raya del 7; si no, se descarta.
 * - 1 trazo: zigzag = CLEAR; si no, $1. Un 7 sin raya cuenta como 1.
 * - Si otro dígito queda a menos de AMBIGUITY_MARGIN del mejor, no se arma nada.
 */
export function interpretGesture(strokes, templates, threshold = DEFAULT_THRESHOLD) {
  const [first, second] = strokes;
  const none = { result: null, score: 0, crossed: false };
  if (!first || isTooShort(first)) return none;

  if (second) {
    return isCrossBar(second, first)
      ? { result: '7', score: 1, crossed: true }
      : none;
  }

  if (isZigzag(first)) return { result: CLEAR, score: 1, crossed: false };

  const match = recognize(first, templates);
  if (!match) return none;
  const result = asResult(match.name);
  const rival = match.ranking.find((r) => asResult(r.name) !== result);
  const margin = rival ? match.score - rival.score : 1;
  const info = { score: match.score, crossed: false, best: match.name, rival: rival?.name, margin };
  if (match.score < threshold || margin < AMBIGUITY_MARGIN) return { ...info, result: null };
  return { ...info, result };
}
