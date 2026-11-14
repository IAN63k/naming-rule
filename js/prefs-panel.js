import { resolveWeights } from './picker.js';
import { initGestureSettings } from './prefs-gestures.js';

const CLICKS_TO_OPEN = 5;
const CLICK_GAP_MS = 600;

/**
 * Panel de ajustes. Recibe accesos al estado de la app para no duplicarlo.
 * @param {{ getNames: () => string[], getPrefs: () => object, onChange: () => void,
 *           onReset: () => void, templates: object, trigger: HTMLElement }} deps
 */
export function initPrefsPanel({ getNames, getPrefs, onChange, onReset, templates, trigger }) {
  const dialog = document.getElementById('prefs-dialog');
  const targetSelect = document.getElementById('pf-target');
  const modeInputs = dialog.querySelectorAll('input[name="pf-mode"]');
  const weightsBox = document.getElementById('pf-weights');
  const totalEl = document.getElementById('pf-total');
  const resetBtn = document.getElementById('pf-reset');

  const gestures = initGestureSettings({ getPrefs, onChange, templates });
  dialog.addEventListener('close', () => gestures.close());

  const format = (n) => n.toLocaleString('es', { maximumFractionDigits: 1 });

  function renderTarget() {
    const prefs = getPrefs();
    targetSelect.replaceChildren(new Option('— Ninguno —', ''));
    for (const name of getNames()) {
      targetSelect.add(new Option(name, name, false, name === prefs.target));
    }
    modeInputs.forEach((input) => { input.checked = input.value === prefs.mode; });
  }

  function renderWeights() {
    const names = getNames();
    const prefs = getPrefs();
    const equalShare = names.length ? 100 / names.length : 0;
    weightsBox.replaceChildren(...names.map((name, i) => {
      const row = document.createElement('div');
      row.className = 'weight-row';
      const id = `pf-w-${i}`;
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = name;
      const input = document.createElement('input');
      input.id = id;
      input.className = 'input input-sm';
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.step = 'any';
      input.inputMode = 'decimal';
      input.placeholder = format(equalShare);
      input.dataset.name = name;
      if (Object.hasOwn(prefs.weights, name)) input.value = prefs.weights[name];
      const effective = document.createElement('span');
      effective.className = 'weight-effective';
      effective.dataset.effective = name;
      row.append(label, input, effective);
      return row;
    }));
    updateTotals();
  }

  function updateTotals() {
    const names = getNames();
    const { weights } = getPrefs();
    const equalShare = names.length ? 100 / names.length : 0;
    const sum = names.reduce((acc, name) => (
      acc + (Object.hasOwn(weights, name) ? Number(weights[name]) || 0 : equalShare)
    ), 0);
    const probabilities = resolveWeights(names, weights);

    names.forEach((name, i) => {
      const el = weightsBox.querySelector(`[data-effective="${CSS.escape(name)}"]`);
      if (el) el.textContent = probabilities ? `${format(probabilities[i] * 100)}%` : '';
    });

    if (Object.keys(weights).length === 0) {
      totalEl.textContent = 'Sin porcentajes: todos tienen la misma probabilidad.';
    } else if (!probabilities) {
      totalEl.textContent = `Suma: ${format(sum)}%. Todo en 0: se usará azar uniforme.`;
    } else if (Math.abs(sum - 100) < 0.01) {
      totalEl.textContent = 'Suma: 100%.';
    } else {
      totalEl.textContent = `Suma: ${format(sum)}%. Se normalizará automáticamente a 100%.`;
    }
  }

  targetSelect.addEventListener('change', () => {
    getPrefs().target = targetSelect.value || null;
    onChange();
  });

  modeInputs.forEach((input) => input.addEventListener('change', () => {
    if (input.checked) getPrefs().mode = input.value;
    onChange();
  }));

  weightsBox.addEventListener('input', (event) => {
    const input = event.target;
    if (!input.dataset.name) return;
    const { weights } = getPrefs();
    const value = Number(input.value);
    if (input.value === '' || !Number.isFinite(value) || value < 0) {
      delete weights[input.dataset.name];
    } else {
      weights[input.dataset.name] = value;
    }
    updateTotals();
    onChange();
  });

  resetBtn.addEventListener('click', () => {
    const prefs = getPrefs();
    prefs.target = null;
    prefs.mode = 'once';
    prefs.weights = {};
    onChange();
    onReset();
    render();
  });

  function render() {
    renderTarget();
    renderWeights();
  }

  function open() {
    if (dialog.open) return;
    render();
    dialog.showModal();
    gestures.open();
  }

  function toggle() {
    if (dialog.open) dialog.close();
    else open();
  }

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyA') {
      event.preventDefault();
      toggle();
    }
  });

  let clicks = 0;
  let lastClick = 0;
  trigger.addEventListener('click', () => {
    const now = performance.now();
    clicks = now - lastClick < CLICK_GAP_MS ? clicks + 1 : 1;
    lastClick = now;
    if (clicks >= CLICKS_TO_OPEN) {
      clicks = 0;
      open();
    }
  });

  return { refresh: () => dialog.open && render() };
}
