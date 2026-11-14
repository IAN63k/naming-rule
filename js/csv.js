// Lectura de archivos de texto separados por comas (o punto y coma, como exporta
// Excel en español). Cada celda no vacía se toma como un nombre.

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

/** Devuelve todas las celdas del CSV, respetando comillas ("Pérez, Ana"). */
export function parseCsv(text) {
  const source = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(source);
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === delimiter || ch === '\n' || ch === '\r') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim()).filter(Boolean);
}
