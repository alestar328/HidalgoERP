import { Navigate, Route, Routes } from 'react-router';
import { BusyIndicator, Button, MessageStrip } from '@ui5/webcomponents-react';
import { APP } from './config/app';
import { isSupabaseConfigured } from './lib/supabase';
import { errorMessage } from './lib/errors';
import { AppShell } from './components/AppShell';
import { useAuth } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { OnboardingPage } from './features/auth/OnboardingPage';
import { MorePage } from './features/settings/MorePage';
import { MODULE_IDS } from './modules/catalog';
import { ModulesProvider } from './modules/ModulesProvider';
import { MODULE_UI } from './modules/registry';
import { Launchpad } from './shell/Launchpad';
import { ModuleGate } from './shell/ModuleGate';
import { lazyPage } from './modules/lazy';
import { TutorialProvider } from './tutorial/TutorialProvider';

const HelpCenterPage = lazyPage(() => import('./tutorial/HelpCenterPage'), 'HelpCenterPage');

/** Todas las rutas de todos los módulos; ModuleGate decide si se puede entrar según el negocio. */
const moduleRoutes = MODULE_IDS.flatMap((id) =>
  MODULE_UI[id].routes.map((r) => (
    <Route
      key={`${id}:${r.path}`}
      path={r.path}
      element={<ModuleGate modules={[id, ...(r.requires ?? [])]}>{r.element}</ModuleGate>}
    />
  )),
);

function SetupNeeded() {
  return (
    <main className="screen-center">
      <div className="brand">
        <img src="/icon.svg" alt="" />
        <h1>{APP.name}</h1>
      </div>
      <MessageStrip design="Critical" hideCloseButton>
        Falta conectar la base de datos (Supabase).
      </MessageStrip>
      <p>
        Crea el archivo <strong>.env.local</strong> en la carpeta del proyecto con estos dos valores y reinicia{' '}
        <strong>npm run dev</strong>:
      </p>
      <code className="block">
        {'VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co\nVITE_SUPABASE_ANON_KEY=tu-clave-publica'}
      </code>
      <p className="muted">Los pasos completos están en el README, sección “Crear el proyecto en Supabase”.</p>
    </main>
  );
}

export function App() {
  const { loading, user, membership, membershipError, refreshMembership, signOut } = useAuth();

  if (!isSupabaseConfigured) return <SetupNeeded />;

  if (loading) {
    return (
      <main className="screen-center" aria-busy="true">
        <BusyIndicator active delay={300} size="L" />
      </main>
    );
  }

  if (!user) return <LoginPage />;

  if (membershipError) {
    return (
      <main className="screen-center">
        <MessageStrip design="Negative" hideCloseButton>
          No se pudo cargar tu negocio. {errorMessage(membershipError)}
        </MessageStrip>
        <Button design="Emphasized" className="btn-big" onClick={() => void refreshMembership()}>
          Reintentar
        </Button>
        <Button design="Transparent" onClick={() => void signOut()}>
          Salir
        </Button>
      </main>
    );
  }

  if (!membership) return <OnboardingPage />;

  return (
    <ModulesProvider>
      <TutorialProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Launchpad />} />
            {moduleRoutes}
            <Route path="mas" element={<MorePage />} />
            <Route path="ayuda" element={<HelpCenterPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </TutorialProvider>
    </ModulesProvider>
  );
}
