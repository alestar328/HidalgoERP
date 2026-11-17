import { Navigate, Route, Routes } from 'react-router';
import { BusyIndicator, Button, MessageStrip } from '@ui5/webcomponents-react';
import { APP } from './config/app';
import { isSupabaseConfigured } from './lib/supabase';
import { errorMessage } from './lib/errors';
import { AppShell } from './components/AppShell';
import { ComingSoon } from './components/ComingSoon';
import { useAuth } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { OnboardingPage } from './features/auth/OnboardingPage';
import { HomePage } from './features/dashboard/HomePage';
import { ProductsPage } from './features/products/ProductsPage';
import { ProductDetailPage } from './features/products/ProductDetailPage';
import { ProductFormPage } from './features/products/ProductFormPage';
import { MorePage } from './features/settings/MorePage';
import { SettingsPage } from './features/settings/SettingsPage';

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
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="productos/nuevo" element={<ProductFormPage />} />
        <Route path="productos/:id" element={<ProductDetailPage />} />
        <Route path="productos/:id/editar" element={<ProductFormPage />} />
        <Route path="productos/:id/variante" element={<ProductFormPage variantOf />} />
        <Route path="vender" element={<ComingSoon title="Vender" phase="la fase (b): ventas y pedidos" />} />
        <Route path="ventas" element={<ComingSoon title="Ventas" phase="la fase (b): ventas y pedidos" back="/mas" />} />
        <Route path="pedidos" element={<ComingSoon title="Pedidos" phase="la fase (b): ventas y pedidos" back="/mas" />} />
        <Route path="caja" element={<ComingSoon title="Caja" phase="la fase (c): caja diaria" back="/mas" />} />
        <Route path="fiados" element={<ComingSoon title="Fiados" phase="la fase (d): fiados y cobros" />} />
        <Route path="importar" element={<ComingSoon title="Importar Excel" phase="la fase (f): importación" back="/mas" />} />
        <Route path="mas" element={<MorePage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
