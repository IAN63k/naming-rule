import { loadNames, saveNames, loadPrefs, savePrefs, emptyPrefs } from './storage.js';
import { pickWinner, targetRotation, indexAtPointer, spinDuration } from './picker.js';
import { Wheel } from './wheel.js';
import { launchConfetti, stopConfetti } from './confetti.js';
import { initPrefsPanel } from './prefs-panel.js';
import { parseCsv } from './csv.js';

const MAX_NAMES = 100;
const MAX_FILE_BYTES = 1024 * 1024;
const MIN_TO_SPIN = 2;

const $ = (id) => document.getElementById(id);
const el = {
  title: $('app-title'),
  canvas: $('wheel'),
  spinBtn: $('spin-btn'),
  spinHint: $('spin-hint'),
  editor: $('editor'),
  addForm: $('add-form'),
  nameInput: $('name-input'),
  bulkInput: $('bulk-input'),
  bulkBtn: $('bulk-btn'),
  csvInput: $('csv-input'),
  message: $('message'),
  list: $('names-list'),
  emptyList: $('empty-list'),
  count: $('names-count'),
  clearBtn: $('clear-btn'),
  winnerDialog: $('winner-dialog'),
  winnerName: $('winner-name'),
  removeWinnerBtn: $('remove-winner-btn'),
  closeWinnerBtn: $('close-winner-btn'),
  confetti: $('confetti'),
};

const state = {
  names: loadNames(),
  prefs: loadPrefs(),
  spinning: false,
  lastWinner: null,
};

const wheel = new Wheel(el.canvas);

const normalize = (raw) => raw.replace(/\s+/g, ' ').trim();
const sameName = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'accent' }) === 0;

function showMessage(text, type = 'info') {
  el.message.textContent = text;
  el.message.dataset.type = type;
}

/** Limpia ajustes que apunten a nombres que ya no están en la lista. */
function prunePrefs() {
  const { prefs, names } = state;
  if (prefs.target && !names.includes(prefs.target)) prefs.target = null;
  for (const name of Object.keys(prefs.weights)) {
    if (!names.includes(name)) delete prefs.weights[name];
  }
  savePrefs(prefs);
}

function addNames(rawList) {
  const added = [];
  const duplicates = [];
  let overflow = false;

  for (const raw of rawList) {
    const name = normalize(raw);
    if (!name) continue;
    if ([...state.names, ...added].some((n) => sameName(n, name))) {
      duplicates.push(name);
      continue;
    }
    if (state.names.length + added.length >= MAX_NAMES) {
      overflow = true;
      break;
    }
    added.push(name);
  }

  state.names.push(...added);
  commitNames();

  const parts = [];
  if (added.length) parts.push(added.length === 1 ? `Agregado: ${added[0]}.` : `Agregados ${added.length} nombres.`);
  if (duplicates.length) parts.push(`Duplicado${duplicates.length > 1 ? 's' : ''} ignorado${duplicates.length > 1 ? 's' : ''}: ${duplicates.join(', ')}.`);
  if (overflow) parts.push(`Máximo ${MAX_NAMES} nombres.`);
  if (!parts.length) parts.push('No hay nombres válidos para agregar.');
  showMessage(parts.join(' '), duplicates.length || overflow || !added.length ? 'warn' : 'ok');
  return added.length;
}

function removeName(name) {
  state.names = state.names.filter((n) => n !== name);
  commitNames();
}

function commitNames() {
  saveNames(state.names);
  prunePrefs();
  render();
  panel.refresh();
}

function renderList() {
  el.list.replaceChildren(...state.names.map((name) => {
    const li = document.createElement('li');
    li.className = 'name-item';
    const span = document.createElement('span');
    span.className = 'name-text';
    span.textContent = name;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-icon';
    btn.setAttribute('aria-label', `Eliminar ${name}`);
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      removeName(name);
      showMessage(`Eliminado: ${name}.`);
    });
    li.append(span, btn);
    return li;
  }));
}

function render() {
  const count = state.names.length;
  renderList();
  wheel.setNames(state.names);
  el.count.textContent = count;
  el.emptyList.hidden = count > 0;
  el.clearBtn.hidden = count === 0;
  el.canvas.setAttribute('aria-label', count ? `Ruleta con ${count} nombres` : 'Ruleta sin nombres');
  updateSpinControls();
}

function updateSpinControls() {
  const enough = state.names.length >= MIN_TO_SPIN;
  el.spinBtn.disabled = state.spinning || !enough;
  el.spinBtn.textContent = state.spinning ? 'Girando…' : 'Girar';
  el.editor.disabled = state.spinning;
  el.spinHint.hidden = enough;
}

async function spin() {
  if (state.spinning || state.names.length < MIN_TO_SPIN) return;
  const names = [...state.names];
  const index = pickWinner(names, state.prefs);

  if (state.prefs.target && state.prefs.mode === 'once') {
    state.prefs.target = null;
    savePrefs(state.prefs);
  }

  state.spinning = true;
  updateSpinControls();
  const final = targetRotation(index, names.length, wheel.rotation);
  const rotation = await wheel.spin(final, spinDuration());
  state.spinning = false;
  updateSpinControls();

  showWinner(names[indexAtPointer(rotation, names.length)]);
}

function showWinner(name) {
  state.lastWinner = name;
  el.winnerName.textContent = name;
  el.winnerDialog.showModal();
  el.closeWinnerBtn.focus();
  launchConfetti(el.confetti);
}

function closeWinner() {
  if (el.winnerDialog.open) el.winnerDialog.close();
}

el.addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (addNames([el.nameInput.value])) el.nameInput.value = '';
  el.nameInput.focus();
});

el.bulkBtn.addEventListener('click', () => {
  if (addNames(el.bulkInput.value.split(/\r?\n/))) el.bulkInput.value = '';
});

el.csvInput.addEventListener('change', async () => {
  const [file] = el.csvInput.files;
  el.csvInput.value = '';
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    showMessage('El archivo es demasiado grande (máximo 1 MB).', 'warn');
    return;
  }
  try {
    addNames(parseCsv(await file.text()));
  } catch {
    showMessage('No se pudo leer el archivo.', 'warn');
  }
});

el.clearBtn.addEventListener('click', () => {
  state.names = [];
  state.prefs = emptyPrefs();
  commitNames();
  showMessage('Lista vaciada.');
});

el.spinBtn.addEventListener('click', spin);

el.removeWinnerBtn.addEventListener('click', () => {
  if (state.lastWinner) {
    removeName(state.lastWinner);
    showMessage(`Quitado de la lista: ${state.lastWinner}.`);
  }
  closeWinner();
});

el.closeWinnerBtn.addEventListener('click', closeWinner);
el.winnerDialog.addEventListener('close', () => {
  stopConfetti(el.confetti);
  el.spinBtn.focus();
});
el.winnerDialog.addEventListener('click', (event) => {
  if (event.target === el.winnerDialog || event.target === el.confetti) closeWinner();
});

const panel = initPrefsPanel({
  getNames: () => state.names,
  getPrefs: () => state.prefs,
  onChange: () => savePrefs(state.prefs),
  trigger: el.title,
});

prunePrefs();
render();
