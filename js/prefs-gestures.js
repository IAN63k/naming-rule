import { interpretGesture, makeTemplate, CLEAR } from './gesture.js';
import { trackStrokes, createGestureSession } from './stroke.js';

const SAMPLES_PER_DIGIT = 3;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * Sección "Gestos" del panel: activar, umbral, ventana, prueba y entrenamiento.
 * @param {{ getPrefs: () => object, onChange: () => void, templates: object }} deps
 */
export function initGestureSettings({ getPrefs, onChange, templates }) {
  const enabledInput = document.getElementById('pf-g-on');
  const thresholdInput = document.getElementById('pf-g-th');
  const thresholdOut = document.getElementById('pf-g-th-out');
  const windowInput = document.getElementById('pf-g-win');
  const windowOut = document.getElementById('pf-g-win-out');
  const pad = document.getElementById('pf-pad');
  const status = document.getElementById('pf-pad-status');
  const digitSelect = document.getElementById('pf-train-digit');
  const trainBtn = document.getElementById('pf-train');
  const testBtn = document.getElementById('pf-test');
  const customCount = document.getElementById('pf-custom-count');
  const resetBtn = document.getElementById('pf-templates-reset');
  const ctx = pad.getContext('2d');

  let mode = 'test';
  let training = null; // { digit, samples: [] }
  let clearOnNextStroke = true;

  DIGITS.forEach((d) => digitSelect.add(new Option(d, d)));

  const gesture = () => getPrefs().gesture;

  function renderSettings() {
    const { enabled, threshold, windowMs } = gesture();
    enabledInput.checked = enabled;
    thresholdInput.value = threshold;
    thresholdOut.textContent = threshold.toFixed(2);
    windowInput.value = windowMs;
    windowOut.textContent = `${windowMs} ms`;
  }

  function renderCustomCount() {
    const custom = templates.custom();
    if (!custom.length) {
      customCount.textContent = 'Plantillas propias: ninguna (se usan las de fábrica).';
      resetBtn.disabled = true;
      return;
    }
    const byDigit = {};
    for (const t of custom) byDigit[t.name] = (byDigit[t.name] || 0) + 1;
    const detail = DIGITS.filter((d) => byDigit[d]).map((d) => `${d}×${byDigit[d]}`).join(', ');
    customCount.textContent = `Plantillas propias: ${custom.length} (${detail}).`;
    resetBtn.disabled = false;
  }

  // --- Lienzo de prueba -----------------------------------------------------
  function preparePad() {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = pad.getBoundingClientRect();
    pad.width = Math.round(width * dpr);
    pad.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = getComputedStyle(pad).color;
  }

  function clearPad() {
    ctx.clearRect(0, 0, pad.width, pad.height);
  }

  function drawSegment(points) {
    const n = points.length;
    if (n < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[n - 2].x, points[n - 2].y);
    ctx.lineTo(points[n - 1].x, points[n - 1].y);
    ctx.stroke();
  }

  // --- Interpretación -------------------------------------------------------
  function describeTest(strokes) {
    const { threshold } = gesture();
    const r = interpretGesture(strokes, templates.all(), threshold);
    if (strokes.length === 2) {
      return r.result === '7'
        ? 'Reconocido: 7 · raya cruzada: sí.'
        : 'Segundo trazo no válido como raya del 7 (debe ser casi horizontal, más corto y cruzar el primero). No se arma nada.';
    }
    if (r.result === CLEAR) return 'Zigzag: desarmar.';
    if (r.result) {
      const note = r.best === '7' ? ' (forma de 7 sin raya: cuenta como 1)' : '';
      return `Reconocido: ${r.result}${note} · score ${r.score.toFixed(2)} · raya cruzada: no.`;
    }
    if (r.best && r.score >= threshold) {
      return `Ambiguo entre ${r.best} y ${r.rival} (diferencia ${r.margin.toFixed(2)}). No se arma nada; prueba a entrenar ese dígito.`;
    }
    return `Sin coincidencia: mejor ${r.best ?? '—'} con score ${r.score.toFixed(2)} (umbral ${threshold.toFixed(2)}). No se arma nada.`;
  }

  function handleTraining(strokes) {
    const { digit, samples } = training;
    const needsBar = digit === '7';
    if (needsBar) {
      const r = interpretGesture(strokes, templates.all(), gesture().threshold);
      if (strokes.length !== 2 || r.result !== '7') {
        status.textContent = `El 7 va en dos trazos: el 7 y luego una raya corta cruzando la diagonal. Repite la muestra ${samples.length + 1}/${SAMPLES_PER_DIGIT}.`;
        return;
      }
    } else if (strokes.length !== 1) {
      status.textContent = `El ${digit} va en un solo trazo. Repite la muestra ${samples.length + 1}/${SAMPLES_PER_DIGIT}.`;
      return;
    }

    samples.push(strokes[0]);
    if (samples.length < SAMPLES_PER_DIGIT) {
      status.textContent = `Muestra ${samples.length}/${SAMPLES_PER_DIGIT} guardada${needsBar ? ' (raya detectada)' : ''}. Dibuja el ${digit} otra vez.`;
      return;
    }
    templates.add(samples.map((points) => makeTemplate(digit, points)));
    training = null;
    mode = 'test';
    status.textContent = `Listo: ${SAMPLES_PER_DIGIT} plantillas propias para el ${digit}. Modo prueba.`;
    renderCustomCount();
  }

  const session = createGestureSession({
    getWindowMs: () => gesture().windowMs,
    onGesture: (strokes) => {
      clearOnNextStroke = true;
      if (mode === 'train' && training) handleTraining(strokes);
      else status.textContent = describeTest(strokes);
    },
  });

  trackStrokes(pad, {
    onStart: (stroke) => {
      session.strokeStarted();
      if (clearOnNextStroke) {
        clearPad();
        clearOnNextStroke = false;
      }
      ctx.beginPath();
      ctx.arc(stroke.points[0].x, stroke.points[0].y, 1, 0, Math.PI * 2);
      ctx.stroke();
    },
    onMove: (stroke) => drawSegment(stroke.points),
    onEnd: (stroke) => session.strokeEnded(stroke.points),
  });

  // --- Controles --------------------------------------------------------------
  enabledInput.addEventListener('change', () => {
    gesture().enabled = enabledInput.checked;
    onChange();
  });

  thresholdInput.addEventListener('input', () => {
    gesture().threshold = Number(thresholdInput.value);
    thresholdOut.textContent = gesture().threshold.toFixed(2);
    onChange();
  });

  windowInput.addEventListener('input', () => {
    gesture().windowMs = Number(windowInput.value);
    windowOut.textContent = `${gesture().windowMs} ms`;
    onChange();
  });

  trainBtn.addEventListener('click', () => {
    session.cancel();
    clearPad();
    mode = 'train';
    training = { digit: digitSelect.value, samples: [] };
    status.textContent = training.digit === '7'
      ? `Entrenando el 7: dibuja el 7 y después la raya cruzada (muestra 1/${SAMPLES_PER_DIGIT}).`
      : `Entrenando el ${training.digit}: dibújalo en un solo trazo (muestra 1/${SAMPLES_PER_DIGIT}).`;
  });

  testBtn.addEventListener('click', () => {
    session.cancel();
    clearPad();
    mode = 'test';
    training = null;
    status.textContent = 'Modo prueba: dibuja un dígito (el 7 con raya cruzada) o un zigzag.';
  });

  resetBtn.addEventListener('click', () => {
    templates.reset();
    renderCustomCount();
    status.textContent = 'Plantillas propias borradas. Se usan las de fábrica.';
  });

  return {
    /** Llamar al abrir el panel (el lienzo necesita estar visible para medirse). */
    open() {
      renderSettings();
      renderCustomCount();
      preparePad();
      session.cancel();
      mode = 'test';
      training = null;
      clearOnNextStroke = true;
      status.textContent = 'Modo prueba: dibuja un dígito (el 7 con raya cruzada) o un zigzag.';
    },
    close() {
      session.cancel();
    },
  };
}
