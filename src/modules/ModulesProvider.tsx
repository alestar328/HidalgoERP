import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth, useShop } from '../features/auth/AuthProvider';
import type { BusinessType, ModuleId } from './catalog';
import { activeModules, toOverrides, type ModuleOverrides } from './resolve';

interface ModulesState {
  businessType: BusinessType;
  /** Módulos encendidos (paquete del rubro + decisiones del dueño). */
  active: Set<ModuleId>;
  overrides: ModuleOverrides;
  isActive: (id: ModuleId) => boolean;
  /** true mientras se cargan las decisiones guardadas por primera vez. */
  loading: boolean;
  setModules: (modules: ModuleId[], enabled: boolean) => Promise<void>;
  /** Cambia el rubro y vuelve a su paquete de módulos. */
  applyBusinessType: (type: BusinessType) => Promise<void>;
}

const ModulesContext = createContext<ModulesState | null>(null);

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { orgId, organization } = useShop();
  const { refreshMembership } = useAuth();
  const queryClient = useQueryClient();

  const rows = useQuery({
    queryKey: ['modules', orgId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_modules')
        .select('module_id, enabled')
        .eq('organization_id', orgId);
      if (error) throw error;
      return data as { module_id: string; enabled: boolean }[];
    },
  });

  const value = useMemo<ModulesState>(() => {
    // Si no se pudo leer (p. ej. sin conexión), se usa el paquete del rubro.
    const overrides = toOverrides(rows.data ?? []);
    const active = activeModules(organization.business_type, overrides);
    return {
      businessType: organization.business_type,
      active,
      overrides,
      isActive: (id) => active.has(id),
      loading: rows.isPending,
      setModules: async (modules, enabled) => {
        const { error } = await supabase.rpc('set_modules', { p_org: orgId, p_modules: modules, p_enabled: enabled });
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['modules', orgId] });
      },
      applyBusinessType: async (type) => {
        const { error } = await supabase.rpc('set_business_type', { p_org: orgId, p_business_type: type });
        if (error) throw error;
        await Promise.all([queryClient.invalidateQueries({ queryKey: ['modules', orgId] }), refreshMembership()]);
      },
    };
  }, [rows.data, rows.isPending, organization.business_type, orgId, queryClient, refreshMembership]);

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules(): ModulesState {
  const ctx = useContext(ModulesContext);
  if (!ctx) throw new Error('useModules fuera de ModulesProvider');
  return ctx;
}
