import { FACTORY_TEMPLATES, makeTemplate } from './gesture.js';
import { loadTemplates, saveTemplates, clearTemplates } from './storage.js';

let custom = loadTemplates()
  .map((t) => makeTemplate(t.name, t.points))
  .filter((t) => t.points);

export const templates = {
  all: () => [...FACTORY_TEMPLATES, ...custom],
  custom: () => custom,
  add(list) {
    custom = [...custom, ...list.filter((t) => t.points)];
    saveTemplates(custom);
  },
  reset() {
    custom = [];
    clearTemplates();
  },
};
