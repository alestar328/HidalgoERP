import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@ui5/webcomponents-react';
import type { GuideStep } from './guides';

interface Props {
  guideTitle: string;
  step: GuideStep;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Cuánto se espera a que aparezca el elemento (las pantallas cargan por partes). */
const FIND_TIMEOUT = 2500;
/** Si en este tiempo no apareció, la tarjeta se muestra al centro (sin dejar la pantalla vacía). */
const SHOW_AFTER = 400;
const PAD = 6;
const GAP = 12;
const MARGIN = 16;

function findTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

/** Recorte del elemento dentro de la ventana, con un poco de aire alrededor. */
function measure(el: HTMLElement): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const top = Math.max(r.top - PAD, 0);
  const left = Math.max(r.left - PAD, 0);
  const bottom = Math.min(r.bottom + PAD, window.innerHeight);
  const right = Math.min(r.right + PAD, window.innerWidth);
  if (bottom <= top || right <= left) return null;
  return { top, left, width: right - left, height: bottom - top };
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/**
 * Paso de un recorrido: oscurece la pantalla, deja a la vista el elemento del paso y muestra
 * una tarjeta con la explicación. Si el elemento no aparece, la tarjeta va al centro.
 */
export function TourOverlay({ guideTitle, step, index, total, onNext, onPrev, onClose }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const [searching, setSearching] = useState(Boolean(step.target));
  const [cardPos, setCardPos] = useState<CSSProperties>({});
  const cardRef = useRef<HTMLDivElement>(null);
  const last = index === total - 1;

  // Buscar el elemento, llevarlo a la vista y seguir su posición (scroll, giro del celular, carga).
  useEffect(() => {
    if (!step.target) return;
    let el: HTMLElement | null = null;
    const startedAt = performance.now();
    const tick = () => {
      if ((!el || !el.isConnected) && performance.now() - startedAt < FIND_TIMEOUT) {
        el = findTarget(step.target!);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setSearching(false);
        } else if (performance.now() - startedAt > SHOW_AFTER) {
          // Se muestra al centro mientras se sigue buscando; si aparece, la tarjeta se mueve.
          setSearching(false);
        }
      }
      const next = el ? measure(el) : null;
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    };
    tick();
    const timer = window.setInterval(tick, 150);
    return () => window.clearInterval(timer);
  }, [step.target]);

  // Ubicar la tarjeta: en el celular, arriba o abajo de la pantalla (lejos del elemento);
  // en pantallas anchas, junto al elemento.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = card.offsetHeight;
    const w = card.offsetWidth;
    if (!box) {
      setCardPos({ top: Math.max((vh - h) / 2, MARGIN), left: Math.max((vw - w) / 2, MARGIN) });
      return;
    }
    if (vw < 640) {
      const targetBelowMiddle = box.top + box.height / 2 > vh / 2;
      setCardPos(targetBelowMiddle ? { top: MARGIN, left: MARGIN, right: MARGIN } : { bottom: MARGIN, left: MARGIN, right: MARGIN });
      return;
    }
    const left = Math.min(Math.max(box.left, MARGIN), vw - w - MARGIN);
    if (box.top + box.height + GAP + h <= vh - MARGIN) setCardPos({ top: box.top + box.height + GAP, left });
    else if (box.top - GAP - h >= MARGIN) setCardPos({ top: box.top - GAP - h, left });
    else setCardPos({ bottom: MARGIN, left: Math.max((vw - w) / 2, MARGIN) });
  }, [box, searching]);

  // Teclado: Escape sale; flechas avanzan y retroceden.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && !step.waitFor) onNext();
      else if (e.key === 'ArrowLeft' && index > 0) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose, onNext, onPrev, step.waitFor]);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  // Mientras busca, no se muestra nada al centro (evita un salto de la tarjeta).
  if (searching) return <div className="tour-blocker" aria-hidden="true" />;

  // Bloqueo de toques fuera del elemento; en los pasos que esperan un toque, el elemento queda libre.
  const blockers = box
    ? step.waitFor
      ? [
          { top: 0, left: 0, right: 0, height: box.top },
          { top: box.top + box.height, left: 0, right: 0, bottom: 0 },
          { top: box.top, left: 0, width: box.left, height: box.height },
          { top: box.top, left: box.left + box.width, right: 0, height: box.height },
        ]
      : [{ inset: 0 }]
    : [];

  const titleId = 'tour-title';
  return (
    <div className="tour" role="presentation">
      {box ? (
        <div className="tour-spot" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
      ) : (
        <div className="tour-backdrop" />
      )}
      {blockers.map((style, i) => (
        <div key={i} className="tour-blocker" style={style as CSSProperties} aria-hidden="true" />
      ))}

      <div
        ref={cardRef}
        className="tour-card"
        style={cardPos}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <p className="tour-card__meta">
          {guideTitle} · {index + 1} de {total}
        </p>
        <h2 id={titleId} className="tour-card__title">
          {step.title}
        </h2>
        <p className="tour-card__text" aria-live="polite">
          {step.text}
        </p>
        {step.waitFor && <p className="tour-card__hint">👆 {step.waitFor.hint}</p>}
        <div className="tour-card__dots" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i === index ? 'on' : undefined} />
          ))}
        </div>
        <div className="tour-card__actions">
          <Button design="Transparent" onClick={onClose}>
            Salir
          </Button>
          <span className="grow" />
          {index > 0 && <Button onClick={onPrev}>Anterior</Button>}
          <Button design="Emphasized" onClick={onNext}>
            {last ? 'Terminar' : step.waitFor ? 'Saltar' : 'Siguiente'}
          </Button>
        </div>
      </div>
    </div>
  );
}
