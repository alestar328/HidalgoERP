import { useSearchParams } from 'react-router';
import { Button, Icon } from '@ui5/webcomponents-react';
import { PageHeader } from '../components/PageHeader';
import { useShop } from '../features/auth/AuthProvider';
import { MODULES, SPACES } from '../modules/catalog';
import { useModules } from '../modules/ModulesProvider';
import { guideSteps, guidesForPath, upcomingGuides, visibleGuides, WELCOME_GUIDE_ID, type Guide } from './guides';
import { useTutorial } from './TutorialProvider';
import { TeamProgress } from './TeamProgress';
import { formatDate } from '../lib/format';

function GuideRow({ guide }: { guide: Guide }) {
  const { start, doneAt, isDone } = useTutorial();
  const { isOwner } = useShop();
  const { active } = useModules();
  const steps = guideSteps(guide, { active, isOwner }).length;
  const done = isDone(guide.id);
  const at = doneAt(guide.id);
  return (
    <li>
      <button type="button" className="list-item" onClick={() => start(guide.id)}>
        <span className="help-icon" aria-hidden="true">
          <Icon name={guide.icon} />
        </span>
        <span className="list-item__main">
          <span className="list-item__title" style={{ display: 'block' }}>
            {guide.title}
          </span>
          <span className="list-item__sub" style={{ display: 'block' }}>
            {guide.summary} · {steps} {steps === 1 ? 'paso' : 'pasos'}
          </span>
          {at && (
            <span className="list-item__sub help-when" style={{ display: 'block' }}>
              Vista el {formatDate(at)}
            </span>
          )}
        </span>
        {done ? (
          <span className="help-done" role="img" aria-label="Vista">
            <Icon name="accept" />
          </span>
        ) : (
          <span className="badge">Nueva</span>
        )}
        <Icon name="slim-arrow-right" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Centro de ayuda: todas las guías de las apps activas, con lo ya visto marcado. */
export function HelpCenterPage() {
  const { isOwner } = useShop();
  const { active } = useModules();
  const { start, isDone, offerWelcomeAgain, progress } = useTutorial();
  const [params] = useSearchParams();
  const from = params.get('desde');

  const guides = visibleGuides({ active, isOwner });
  const welcome = guides.find((g) => g.id === WELCOME_GUIDE_ID);
  const rest = guides.filter((g) => g.id !== WELCOME_GUIDE_ID);
  const here = from ? guidesForPath(from, rest) : [];
  const doneCount = guides.filter((g) => isDone(g.id)).length;
  const upcoming = upcomingGuides(active);

  const bySpace = SPACES.map((s) => ({
    ...s,
    guides: rest.filter((g) => g.module && MODULES[g.module].space === s.id),
  })).filter((s) => s.guides.length > 0);

  return (
    <div className="page">
      <PageHeader title="Tutoriales" back="/mas" help={false} />
      <div className="content">
        {welcome && (
          <section className="card help-hero">
            <div className="grow">
              <h2 className="help-hero__title">¿Primera vez aquí?</h2>
              <p className="muted">Un recorrido de un minuto por la app.</p>
            </div>
            <Button design="Emphasized" icon="media-play" onClick={() => start(welcome.id)}>
              {isDone(welcome.id) ? 'Repetir' : 'Empezar'}
            </Button>
          </section>
        )}

        <div className="help-progress">
          <span className="muted">
            {doneCount} de {guides.length} guías vistas
          </span>
          <progress max={guides.length} value={doneCount} aria-label="Guías vistas" />
        </div>

        <div className="stack" data-tour="help-list">
          {here.length > 0 && (
            <section className="stack" style={{ gap: '0.5rem' }}>
              <p className="section-title">Para la pantalla donde estabas</p>
              <div className="card card--flush">
                <ul className="list">
                  {here.map((g) => (
                    <GuideRow key={g.id} guide={g} />
                  ))}
                </ul>
              </div>
            </section>
          )}

          {bySpace.map((s) => (
            <section key={s.id} className="stack" style={{ gap: '0.5rem' }}>
              <p className="section-title">{s.title}</p>
              <div className="card card--flush">
                <ul className="list">
                  {s.guides.map((g) => (
                    <GuideRow key={g.id} guide={g} />
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        {upcoming.length > 0 && (
          <section className="stack" style={{ gap: '0.5rem' }}>
            <p className="section-title">Próximamente</p>
            <div className="card card--flush">
              <ul className="list">
                {upcoming.map((id) => (
                  <li key={id}>
                    <div className="list-item" aria-disabled="true">
                      <span className="help-icon" aria-hidden="true">
                        <Icon name="lightbulb" />
                      </span>
                      <span className="list-item__main">
                        <span className="list-item__title" style={{ display: 'block' }}>
                          {MODULES[id].title}
                        </span>
                        <span className="list-item__sub" style={{ display: 'block' }}>
                          Su guía llega junto con la app, en {MODULES[id].phase ?? 'una próxima versión'}.
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {isOwner && <TeamProgress />}

        {progress.welcomeSeen && (
          <Button design="Transparent" className="btn-block" onClick={offerWelcomeAgain}>
            Volver a mostrar la bienvenida al entrar
          </Button>
        )}
      </div>
    </div>
  );
}
