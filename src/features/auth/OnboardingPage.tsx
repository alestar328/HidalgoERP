import { useState, type FormEvent } from 'react';
import { Button, MessageStrip } from '@ui5/webcomponents-react';
import { APP } from '../../config/app';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { TextField } from '../../components/Fields';
import { useAuth } from './AuthProvider';

export function OnboardingPage() {
  const { user, refreshMembership, signOut } = useAuth();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() === '') {
      setError('Escribe el nombre de tu negocio.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('create_organization', {
      p_name: name,
      p_phone: phone,
      p_display_name: displayName,
    });
    if (err) {
      setBusy(false);
      setError(errorMessage(err));
      return;
    }
    await refreshMembership();
  };

  return (
    <main className="screen-center">
      <div className="brand">
        <img src="/icon.svg" alt="" />
        <h1>Crea tu negocio</h1>
        <p className="muted">Solo toma un momento. Después podrás cambiar estos datos.</p>
      </div>

      {error && (
        <MessageStrip design="Negative" hideCloseButton>
          {error}
        </MessageStrip>
      )}

      <form className="stack" onSubmit={submit} noValidate>
        <TextField
          label="Nombre del negocio"
          value={name}
          onChange={setName}
          placeholder="Ej.: Uniformes y Útiles Rosita"
          required
          maxlength={80}
        />
        <TextField label="Tu nombre" value={displayName} onChange={setDisplayName} placeholder="Ej.: Rosa" maxlength={60} />
        <TextField
          label="Celular del negocio"
          type="Tel"
          value={phone}
          onChange={setPhone}
          placeholder="987 654 321"
          hint="Opcional. Saldrá en tus notas de venta."
          maxlength={20}
        />
        <Button design="Emphasized" className="btn-big" type="Submit" disabled={busy}>
          {busy ? 'Creando…' : `Empezar a usar ${APP.name}`}
        </Button>
      </form>

      <p className="muted center">
        Entraste como {user?.email}.{' '}
        ¿Trabajas en el negocio de otra persona? Pídele que te invite con este correo.
      </p>
      <Button design="Transparent" className="btn-block" onClick={() => void signOut()}>
        Salir
      </Button>
    </main>
  );
}
