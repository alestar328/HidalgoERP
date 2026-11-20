import { useState } from 'react';
import { Navigate } from 'react-router';
import { Button, Dialog, MessageStrip, Switch } from '@ui5/webcomponents-react';
import { PageHeader } from '../../components/PageHeader';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../lib/errors';
import { useShop } from '../../features/auth/AuthProvider';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_IDS,
  CORE_MODULES,
  MODULES,
  OPTIONAL_MODULES,
  type BusinessType,
  type ModuleId,
} from '../catalog';
import { presetModules, planToggle, type ModuleChange } from '../resolve';
import { useModules } from '../ModulesProvider';

const titles = (ids: ModuleId[]) => ids.map((id) => MODULES[id].title).join(', ');

function ModuleRow({
  id,
  checked,
  disabled,
  onToggle,
}: {
  id: ModuleId;
  checked: boolean;
  disabled?: boolean;
  onToggle?: (enable: boolean) => void;
}) {
  const m = MODULES[id];
  const labelId = `mod-${id}`;
  return (
    <li className="module-row">
      <div className="grow">
        <p id={labelId} className="list-item__title">
          {m.title}
          {m.status === 'soon' && <span className="badge">Pronto</span>}
        </p>
        <p className="muted">{m.description}</p>
        {m.requires.length > 0 && !m.core && <p className="module-row__req">Requiere: {titles(m.requires)}</p>}
      </div>
      <Switch
        accessibleNameRef={labelId}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle?.(e.target.checked)}
      />
    </li>
  );
}

/** Ajustes › Módulos: rubro del negocio, núcleo y módulos opcionales con sus dependencias. */
export function ModulesPage() {
  const { isOwner } = useShop();
  const { active, businessType, overrides, setModules, applyBusinessType } = useModules();
  const toast = useToast();

  const [pending, setPending] = useState<ModuleChange | null>(null);
  const [pendingType, setPendingType] = useState<BusinessType | null>(null);
  const [selectedType, setSelectedType] = useState<BusinessType>(businessType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cambia para que los interruptores vuelvan a su estado si se cancela o falla.
  const [resetKey, setResetKey] = useState(0);

  if (!isOwner) return <Navigate to="/mas" replace />;

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast(ok);
    } catch (err) {
      setError(errorMessage(err));
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
      setPending(null);
      setPendingType(null);
    }
  };

  const toggle = (id: ModuleId, enable: boolean) => {
    const plan = planToggle(active, id, enable);
    if (!plan) return;
    if (plan.alsoChanged.length > 0) setPending(plan);
    else void run(() => setModules(plan.modules, plan.enabled), enable ? 'Módulo activado' : 'Módulo desactivado');
  };

  const cancel = () => {
    setPending(null);
    setPendingType(null);
    setResetKey((k) => k + 1);
  };

  const hasOverrides = Object.keys(overrides).length > 0;
  const typeChanged = selectedType !== businessType;
  const preview = presetModules(selectedType);

  return (
    <div className="page">
      <PageHeader title="Módulos" back="/mas" />
      <div className="content">
        <p className="muted">
          Enciende solo lo que usa tu negocio. Las apps apagadas desaparecen del inicio, pero tus datos no se borran.
        </p>
        {error && (
          <MessageStrip design="Negative" hideCloseButton>
            {error}
          </MessageStrip>
        )}

        <section className="card stack" aria-labelledby="rubro-title">
          <h2 id="rubro-title">Tipo de negocio</h2>
          <div className="chips chips--wrap" role="group" aria-label="Tipo de negocio">
            {BUSINESS_TYPE_IDS.map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                aria-pressed={selectedType === t}
                onClick={() => setSelectedType(t)}
              >
                {BUSINESS_TYPES[t].title}
              </button>
            ))}
          </div>
          <p className="muted">{BUSINESS_TYPES[selectedType].example}.</p>
          {(typeChanged || hasOverrides) && (
            <Button className="btn-block" disabled={busy} onClick={() => setPendingType(selectedType)}>
              {typeChanged ? `Usar el paquete de ${BUSINESS_TYPES[selectedType].title}` : 'Volver al paquete de mi rubro'}
            </Button>
          )}
        </section>

        <section className="card stack" aria-labelledby="core-title" key={`core-${resetKey}`}>
          <h2 id="core-title">Núcleo · siempre activo</h2>
          <ul className="list">
            {CORE_MODULES.map((id) => (
              <ModuleRow key={id} id={id} checked disabled />
            ))}
          </ul>
        </section>

        <section className="card stack" aria-labelledby="opt-title">
          <h2 id="opt-title">
            Opcionales · {OPTIONAL_MODULES.filter((id) => active.has(id)).length} de {OPTIONAL_MODULES.length} activos
          </h2>
          <ul className="list" key={`opt-${resetKey}`}>
            {OPTIONAL_MODULES.map((id) => (
              <ModuleRow
                key={id}
                id={id}
                checked={active.has(id)}
                disabled={busy}
                onToggle={(enable) => toggle(id, enable)}
              />
            ))}
          </ul>
        </section>

        <section className="card stack" aria-labelledby="pack-title">
          <h2 id="pack-title">Paquetes por rubro</h2>
          <p className="muted">Lo que viene encendido al crear el negocio. El núcleo está en todos.</p>
          <div className="table-scroll">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col">Módulo</th>
                  {BUSINESS_TYPE_IDS.map((t) => (
                    <th key={t} scope="col" aria-current={t === businessType ? 'true' : undefined}>
                      {BUSINESS_TYPES[t].short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OPTIONAL_MODULES.map((id) => (
                  <tr key={id}>
                    <th scope="row">{MODULES[id].title}</th>
                    {BUSINESS_TYPE_IDS.map((t) => (
                      <td key={t}>
                        {BUSINESS_TYPES[t].modules.includes(id) ? (
                          <span className="matrix__on" role="img" aria-label="Incluido">
                            ✓
                          </span>
                        ) : (
                          <span className="matrix__off" role="img" aria-label="No incluido">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog
        open={Boolean(pending)}
        headerText={pending?.enabled ? 'Activar también' : 'Desactivar también'}
        onClose={cancel}
        footer={
          <div className="dialog-footer">
            <Button design="Transparent" onClick={cancel} disabled={busy}>
              Cancelar
            </Button>
            <Button
              design="Emphasized"
              disabled={busy}
              onClick={() =>
                pending &&
                void run(
                  () => setModules(pending.modules, pending.enabled),
                  pending.enabled ? 'Módulos activados' : 'Módulos desactivados',
                )
              }
            >
              {pending?.enabled ? 'Activar' : 'Desactivar'}
            </Button>
          </div>
        }
      >
        {pending && (
          <div className="dialog-body">
            <p>
              {pending.enabled
                ? `${MODULES[pending.modules[0]].title} necesita: ${titles(pending.alsoChanged)}. Se activarán juntos.`
                : `${titles(pending.alsoChanged)} depende de ${MODULES[pending.modules[0]].title}. Se desactivarán juntos.`}
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(pendingType)}
        headerText="Cambiar paquete"
        onClose={cancel}
        footer={
          <div className="dialog-footer">
            <Button design="Transparent" onClick={cancel} disabled={busy}>
              Cancelar
            </Button>
            <Button
              design="Emphasized"
              disabled={busy}
              onClick={() => pendingType && void run(() => applyBusinessType(pendingType), 'Paquete aplicado')}
            >
              Aplicar
            </Button>
          </div>
        }
      >
        {pendingType && (
          <div className="dialog-body">
            <p>
              Quedarán activos el núcleo y:{' '}
              <strong>{titles(OPTIONAL_MODULES.filter((id) => preview.has(id))) || 'ningún opcional'}</strong>.
            </p>
            <p className="muted">Los cambios que hiciste a mano se reemplazan. Tus datos no se borran.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
