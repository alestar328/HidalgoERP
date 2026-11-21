import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast';
import { useShop } from '../features/auth/AuthProvider';
import { useModules } from '../modules/ModulesProvider';
import { getGuide, guideSteps, type Guide, type GuideStep } from './guides';
import { completeGuide, setWelcome, syncProgress, teamTutorialKey, tutorialKey, useServerProgress } from './api';
import { loadProgress, mergeProgress, pendingSync, saveProgress, type TutorialProgress } from './progress';
import { TourOverlay } from './TourOverlay';

interface Running {
  guide: Guide;
  steps: GuideStep[];
  index: number;
}

interface TutorialState {
  progress: TutorialProgress;
  /** false mientras se lee el progreso de la base (para no ofrecer la bienvenida de más). */
  ready: boolean;
  isDone: (guideId: string) => boolean;
  /** Fecha de la última vez que terminó la guía (ISO), o null. */
  doneAt: (guideId: string) => string | null;
  /** Abre una guía desde el primer paso. */
  start: (guideId: string) => void;
  /** Marca la bienvenida como ofrecida (el usuario dijo "ahora no"). */
  dismissWelcome: () => void;
  /** Vuelve a ofrecer la bienvenida. El historial de guías no se borra. */
  offerWelcomeAgain: () => void;
  running: boolean;
}

const TutorialContext = createContext<TutorialState | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, isOwner, orgId } = useShop();
  const queryClient = useQueryClient();
  const server = useServerProgress();
  const { active } = useModules();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [local, setLocal] = useState<TutorialProgress>(() => loadProgress(user.id));
  const progress = useMemo(() => mergeProgress(local, server.data ?? null), [local, server.data]);
  const [run, setRun] = useState<Running | null>(null);

  const update = useCallback(
    (fn: (p: TutorialProgress) => TutorialProgress) =>
      setLocal((prev) => {
        const next = fn(prev);
        saveProgress(user.id, next);
        return next;
      }),
    [user.id],
  );

  // Las escrituras en la base son "mejor esfuerzo": si fallan (sin conexión, migración sin
  // aplicar), queda la copia del equipo y se sube en la próxima carga.
  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: tutorialKey(orgId, user.id) }),
        queryClient.invalidateQueries({ queryKey: teamTutorialKey(orgId) }),
      ]),
    [queryClient, orgId, user.id],
  );
  const remote = useCallback(
    (fn: () => Promise<void>) => {
      fn().then(refresh, () => undefined);
    },
    [refresh],
  );

  // Subir lo que el equipo tenía y la base no (progreso sin conexión o de antes de 0004). Una vez.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current || !server.data) return;
    synced.current = true;
    const pending = pendingSync(local, server.data);
    if (pending.guides.length > 0 || pending.welcome) remote(() => syncProgress(orgId, pending.guides, pending.welcome));
  }, [server.data, local, orgId, remote]);

  const markWelcomeSeen = useCallback(() => {
    update((p) => ({ ...p, welcomeSeen: true }));
    remote(() => setWelcome(orgId, true));
  }, [update, remote, orgId]);

  const start = useCallback(
    (guideId: string) => {
      const guide = getGuide(guideId);
      if (!guide) return;
      const steps = guideSteps(guide, { active, isOwner });
      if (steps.length === 0) return;
      if (!progress.welcomeSeen) markWelcomeSeen();
      setRun({ guide, steps, index: 0 });
    },
    [active, isOwner, progress.welcomeSeen, markWelcomeSeen],
  );

  const step = run ? run.steps[run.index] : null;

  // Cada paso abre su pantalla si hace falta. Solo al cambiar de paso: si el usuario se mueve
  // dentro del paso, no se le regresa.
  // (navigate cambia en cada navegación: se lee de una ref para no repetir el efecto).
  const pathname = location.pathname;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    if (step?.route && window.location.pathname !== step.route) navigateRef.current(step.route);
  }, [step]);

  // Pasos que esperan a que el usuario toque algo: avanzan al llegar a la ruta esperada.
  // Solo cuentan las llegadas hechas durante el paso (al volver con "Anterior" desde la ficha,
  // todavía se está en la ruta esperada y no debe saltar otra vez).
  const armed = useRef(false);
  useEffect(() => {
    armed.current = false;
  }, [step]);
  useEffect(() => {
    if (!step?.waitFor) return;
    if (!new RegExp(step.waitFor.path).test(pathname)) {
      armed.current = true;
    } else if (armed.current) {
      armed.current = false;
      setRun((r) => (r && r.index < r.steps.length - 1 ? { ...r, index: r.index + 1 } : r));
    }
  }, [pathname, step]);

  const close = useCallback(() => setRun(null), []);

  const next = useCallback(() => {
    if (!run) return;
    if (run.index < run.steps.length - 1) {
      setRun({ ...run, index: run.index + 1 });
      return;
    }
    const id = run.guide.id;
    update((p) => ({ ...p, done: { ...p.done, [id]: new Date().toISOString() } }));
    remote(() => completeGuide(orgId, id));
    setRun(null);
    toast(`Guía completada: ${run.guide.title}`);
  }, [run, toast, update, remote, orgId]);

  const prev = useCallback(() => {
    setRun((r) => (r && r.index > 0 ? { ...r, index: r.index - 1 } : r));
  }, []);

  const value = useMemo<TutorialState>(
    () => ({
      progress,
      ready: !server.isPending,
      isDone: (id) => id in progress.done,
      doneAt: (id) => progress.done[id] || null,
      start,
      dismissWelcome: markWelcomeSeen,
      offerWelcomeAgain: () => {
        update((p) => ({ ...p, welcomeSeen: false }));
        remote(() => setWelcome(orgId, false));
      },
      running: run !== null,
    }),
    [progress, server.isPending, start, markWelcomeSeen, update, remote, orgId, run],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {run && step && (
        <TourOverlay
          key={`${run.guide.id}:${run.index}`}
          guideTitle={run.guide.title}
          step={step}
          index={run.index}
          total={run.steps.length}
          onNext={next}
          onPrev={prev}
          onClose={close}
        />
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialState {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial fuera de TutorialProvider');
  return ctx;
}
