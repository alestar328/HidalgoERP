import { BusyIndicator } from '@ui5/webcomponents-react';
import { useShop } from '../features/auth/AuthProvider';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { useModules } from '../modules/ModulesProvider';
import { useTeamProgress } from './api';
import { visibleGuides } from './guides';

/** Para el dueño: qué guías terminó cada persona del negocio y cuándo. */
export function TeamProgress() {
  const { user } = useShop();
  const { active } = useModules();
  const team = useTeamProgress(true);

  return (
    <section className="stack" style={{ gap: '0.5rem' }} aria-labelledby="team-progress-title">
      <p id="team-progress-title" className="section-title">
        Avance de tu equipo
      </p>
      {team.isPending && <BusyIndicator active delay={200} />}
      {team.isError && (
        <p className="muted">
          No se pudo cargar el avance del equipo. {errorMessage(team.error)}
        </p>
      )}
      {team.data && (
        <div className="card card--flush">
          <ul className="list">
            {team.data.map((m) => {
              // Cada uno se mide con las guías que le tocan según su rol y las apps activas.
              const theirs = visibleGuides({ active, isOwner: m.role === 'owner' });
              const done = m.guides.filter((g) => theirs.some((t) => t.id === g.guide_id));
              const last = done[0];
              return (
                <li key={m.userId}>
                  <details className="team-row">
                    <summary className="list-item">
                      <span className="list-item__main">
                        <span className="list-item__title" style={{ display: 'block' }}>
                          {m.name}
                          {m.userId === user.id ? ' (tú)' : ''}
                        </span>
                        <span className="list-item__sub" style={{ display: 'block' }}>
                          {m.role === 'owner' ? 'Dueño' : 'Vendedor'} · {done.length} de {theirs.length} guías
                          {last ? ` · última el ${formatDate(last.last_completed_at)}` : m.welcomeAt ? '' : ' · aún no empieza'}
                        </span>
                        <progress
                          className="team-row__bar"
                          max={theirs.length}
                          value={done.length}
                          aria-label={`Avance de ${m.name}`}
                        />
                      </span>
                    </summary>
                    <ul className="team-row__guides">
                      {theirs.map((g) => {
                        const rec = m.guides.find((r) => r.guide_id === g.id);
                        return (
                          <li key={g.id}>
                            <span className={rec ? 'team-row__ok' : 'team-row__no'} aria-hidden="true">
                              {rec ? '✓' : '—'}
                            </span>
                            <span className="grow">{g.title}</span>
                            <span className="muted">
                              {rec
                                ? `${formatDate(rec.first_completed_at)}${rec.times_completed > 1 ? ` · ${rec.times_completed} veces` : ''}`
                                : 'Pendiente'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
