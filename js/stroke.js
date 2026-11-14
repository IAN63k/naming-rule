import { isTooShort } from './gesture.js';

/**
 * Captura trazos con Pointer Events (mouse, touch y lápiz) sobre `el`.
 * Las coordenadas son px relativos al elemento.
 */
export function trackStrokes(el, { enabled = () => true, onStart, onMove, onEnd }) {
  let active = null;

  const toPoint = (event, rect) => ({ x: event.clientX - rect.left, y: event.clientY - rect.top });

  el.addEventListener('pointerdown', (event) => {
    if (active || !enabled()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = el.getBoundingClientRect();
    active = { id: event.pointerId, type: event.pointerType, rect, points: [toPoint(event, rect)] };
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // Algunos punteros no admiten captura; el trazo sigue funcionando.
    }
    onStart?.(active, event);
  });

  el.addEventListener('pointermove', (event) => {
    if (!active || event.pointerId !== active.id) return;
    const coalesced = event.getCoalescedEvents?.();
    const events = coalesced && coalesced.length ? coalesced : [event];
    for (const e of events) active.points.push(toPoint(e, active.rect));
    onMove?.(active, event);
  });

  const finish = (event) => {
    if (!active || event.pointerId !== active.id) return;
    const stroke = active;
    active = null;
    onEnd?.(stroke, event);
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

/**
 * Agrupa trazos en gestos de 1 o 2 trazos. Tras el primer trazo espera
 * `getWindowMs()` por un segundo; si empieza otro trazo, la espera se pausa
 * y el gesto se entrega al terminarlo. Los toques sueltos se ignoran.
 */
export function createGestureSession({ getWindowMs, onGesture }) {
  let strokes = [];
  let timer = 0;

  const flush = () => {
    clearTimeout(timer);
    timer = 0;
    const gesture = strokes;
    strokes = [];
    if (gesture.length) onGesture(gesture);
  };

  return {
    strokeStarted() {
      clearTimeout(timer);
      timer = 0;
    },
    strokeEnded(points) {
      if (strokes.length === 0) {
        if (isTooShort(points)) return;
        strokes.push(points);
        timer = setTimeout(flush, getWindowMs());
      } else {
        strokes.push(points);
        flush();
      }
    },
    /** Entrega ya el gesto pendiente, sin esperar el resto de la ventana. */
    flush,
    cancel() {
      clearTimeout(timer);
      timer = 0;
      strokes = [];
    },
  };
}
