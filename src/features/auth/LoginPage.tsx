import { useState, type FormEvent } from 'react';
import { Button, MessageStrip } from '@ui5/webcomponents-react';
import { APP } from '../../config/app';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { TextField } from '../../components/Fields';

/**
 * Ingreso sin contraseña: llega un correo con un enlace y un código.
 * El código sirve cuando el enlace se abre en otro navegador (pasa con la app instalada).
 * Para OTP por celular: FEATURES.phoneOtp + signInWithOtp({ phone }) con el mismo flujo de código.
 */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendLink = async (e?: FormEvent) => {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setError('Escribe un correo válido.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    setBusy(false);
    if (err) setError(errorMessage(err));
    else setSentTo(clean);
  };

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setError(errorMessage(err));
  };

  return (
    <main className="screen-center">
      <div className="brand">
        <img src="/icon.svg" alt="" />
        <h1>{APP.name}</h1>
        <p className="muted">{APP.tagline}</p>
      </div>

      {error && (
        <MessageStrip design="Negative" hideCloseButton>
          {error}
        </MessageStrip>
      )}

      {!sentTo ? (
        <form className="stack" onSubmit={sendLink} noValidate>
          <TextField
            label="Tu correo"
            type="Email"
            value={email}
            onChange={setEmail}
            placeholder="nombre@correo.com"
            required
          />
          <Button design="Emphasized" className="btn-big" type="Submit" disabled={busy} icon="email">
            {busy ? 'Enviando…' : 'Entrar'}
          </Button>
          <p className="muted center">Te enviaremos un enlace para entrar. Sin contraseñas.</p>
        </form>
      ) : (
        <form className="stack" onSubmit={verifyCode} noValidate>
          <MessageStrip design="Positive" hideCloseButton>
            Revisa tu correo <strong>{sentTo}</strong> y toca el enlace para entrar.
          </MessageStrip>
          <TextField
            label="O escribe el código del correo"
            type="Number"
            value={code}
            onChange={setCode}
            placeholder="Código"
            maxlength={8}
          />
          <Button design="Emphasized" className="btn-big" type="Submit" disabled={busy || code.trim().length < 6}>
            {busy ? 'Verificando…' : 'Entrar con código'}
          </Button>
          <Button
            design="Transparent"
            className="btn-block"
            disabled={busy}
            onClick={() => {
              setSentTo(null);
              setCode('');
              setError(null);
            }}
          >
            Usar otro correo
          </Button>
        </form>
      )}
    </main>
  );
}
