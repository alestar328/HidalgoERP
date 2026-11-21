import { Suspense } from 'react';
import { Link } from 'react-router';
import { Icon } from '@ui5/webcomponents-react';
import { APP } from '../config/app';
import { useShop } from '../features/auth/AuthProvider';
import { BUSINESS_TYPES, MODULES, SPACES } from '../modules/catalog';
import { useModules } from '../modules/ModulesProvider';
import { visibleTiles } from '../modules/registry';
import { useStockAlerts } from '../modules/reposicion/module';
import { Tile } from './Tile';
import { HelpButton } from '../components/PageHeader';
import { lazyPage } from '../modules/lazy';
import { useTutorial } from '../tutorial/TutorialProvider';

// Solo se descarga la primera vez (el diálogo de UI5 pesa en el celular).
const WelcomeDialog = lazyPage(() => import('../tutorial/WelcomeDialog'), 'WelcomeDialog');

const todayFmt = new Intl.DateTimeFormat(APP.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: APP.timeZone });

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: APP.timeZone }).format(new Date()));
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Aviso de stock: lleva a Reposición si el módulo está activo; si no, a la lista filtrada. */
function StockAlert({ toReposicion }: { toReposicion: boolean }) {
  const alerts = useStockAlerts();
  if (!alerts) return null;
  const n = alerts.low + alerts.out;
  if (n === 0) return null;
  return (
    <Link className="lp-alert" data-tour="lp-alert" to={toReposicion ? '/reposicion' : '/productos?ver=bajo'}>
      <Icon name="alert" aria-hidden="true" />
      <span className="grow">
        {n === 1 ? '1 producto' : `${n} productos`} {alerts.out > 0 ? `(${alerts.out} agotados)` : ''} en su stock mínimo
      </span>
      <strong>{toReposicion ? 'Reponer' : 'Ver'}</strong>
    </Link>
  );
}

/** Inicio: las apps de los módulos activos, agrupadas por espacio, al estilo de un launchpad. */
export function Launchpad() {
  const { organization, displayName, isOwner } = useShop();
  const { active, isActive, businessType } = useModules();
  const { progress, ready } = useTutorial();
  const tiles = visibleTiles(active, isOwner);
  const spaces = SPACES.map((s) => ({ ...s, tiles: tiles.filter((t) => MODULES[t.module].space === s.id) })).filter(
    (s) => s.tiles.length > 0,
  );

  return (
    <div className="page page--wide">
      <header className="lp-shell" data-tour="lp-shell">
        <span className="lp-shell__logo" aria-hidden="true">
          {APP.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </span>
        <span className="grow">
          <span className="lp-shell__name">{organization.name}</span>
          <span className="lp-shell__sub">
            {APP.name} · {BUSINESS_TYPES[businessType].title}
          </span>
        </span>
        <HelpButton />
      </header>

      <nav className="lp-spaces" aria-label="Espacios">
        {spaces.map((s) => (
          <a key={s.id} href={`#espacio-${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>

      <div className="content lp">
        <div>
          <p className="muted lp-date">{todayFmt.format(new Date())}</p>
          <h1 className="lp-hello">
            {greeting()}
            {displayName ? `, ${displayName}` : ''}
          </h1>
        </div>

        <StockAlert toReposicion={isActive('reposicion')} />

        <div className="lp-apps" data-tour="lp-apps">
          {spaces.map((s) => (
            <section key={s.id} id={`espacio-${s.id}`} className="lp-group" aria-labelledby={`t-${s.id}`}>
              <h2 id={`t-${s.id}`} className="lp-group__title">
                {s.title}
              </h2>
              <div className="lp-tiles">
                {s.tiles.map((t) => (
                  <Tile key={`${t.module}-${t.id}`} tile={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {ready && !progress.welcomeSeen && (
        <Suspense fallback={null}>
          <WelcomeDialog />
        </Suspense>
      )}
    </div>
  );
}
