import { PageHeader } from './PageHeader';
import { EmptyState } from './Fields';

/** Marcador de las pantallas que llegan en fases siguientes. */
export function ComingSoon({ title, phase, back }: { title: string; phase: string; back?: string }) {
  return (
    <div className="page">
      <PageHeader title={title} back={back} />
      <EmptyState title="Todavía no disponible" text={`Esta pantalla llega en ${phase}.`} />
    </div>
  );
}
