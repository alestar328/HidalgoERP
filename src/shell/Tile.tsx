import { Link } from 'react-router';
import { Icon } from '@ui5/webcomponents-react';
import { MODULES } from '../modules/catalog';
import type { VisibleTile } from '../modules/registry';
import type { KpiValue } from '../modules/types';

const noKpi = (): KpiValue | null => null;

/** Tile del launchpad: título, subtítulo y abajo un indicador o el ícono. */
export function Tile({ tile }: { tile: VisibleTile }) {
  // Siempre se llama un hook (el de este tile no cambia entre renders).
  const useKpi = tile.useKpi ?? noKpi;
  const kpi = useKpi();
  const soon = tile.soon || MODULES[tile.module].status === 'soon';

  return (
    <Link className={`lp-tile${tile.primary ? ' lp-tile--primary' : ''}`} to={tile.to}>
      <span className="lp-tile__head">
        <span className="lp-tile__title">{tile.title}</span>
        {tile.subtitle && <span className="lp-tile__sub">{tile.subtitle}</span>}
      </span>
      <span className="lp-tile__foot">
        {soon ? (
          <span className="badge">Pronto</span>
        ) : kpi ? (
          <span className={`lp-kpi lp-kpi--${kpi.tone ?? 'neutral'}`}>
            {kpi.value}
            {kpi.unit && <span className="lp-kpi__unit">{kpi.unit}</span>}
          </span>
        ) : (
          <span />
        )}
        <Icon name={tile.icon} className="lp-tile__icon" aria-hidden="true" />
      </span>
    </Link>
  );
}
