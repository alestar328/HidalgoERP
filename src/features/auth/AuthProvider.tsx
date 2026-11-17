import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Organization, Role } from '../../lib/types';

export interface Membership {
  organization: Organization;
  role: Role;
  displayName: string | null;
}

interface AuthState {
  /** true mientras se averigua si hay sesión y negocio. */
  loading: boolean;
  user: User | null;
  membership: Membership | null;
  membershipError: unknown;
  refreshMembership: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface MembershipRow {
  role: Role;
  display_name: string | null;
  organizations: Organization | Organization[] | null;
}

async function loadMembership(userId: string): Promise<Membership | null> {
  const query = () =>
    supabase
      .from('memberships')
      .select('role, display_name, organizations(id, name, phone, address)')
      .eq('user_id', userId)
      .order('created_at')
      .limit(1);

  let { data, error } = await query();
  if (error) throw error;

  // Sin negocio todavía: quizá el dueño lo invitó como vendedor.
  if (!data || data.length === 0) {
    const { data: accepted, error: rpcError } = await supabase.rpc('accept_invitations');
    if (rpcError) throw rpcError;
    if (!accepted) return null;
    ({ data, error } = await query());
    if (error) throw error;
  }

  const row = (data?.[0] ?? null) as MembershipRow | null;
  const org = Array.isArray(row?.organizations) ? row?.organizations[0] : row?.organizations;
  if (!row || !org) return null;
  return { organization: org, role: row.role, displayName: row.display_name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(isSupabaseConfigured);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const membershipQuery = useQuery({
    queryKey: ['membership', userId],
    queryFn: () => loadMembership(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  const value = useMemo<AuthState>(
    () => ({
      loading: sessionLoading || (Boolean(userId) && membershipQuery.isPending),
      user: session?.user ?? null,
      membership: membershipQuery.data ?? null,
      membershipError: membershipQuery.error,
      refreshMembership: async () => {
        await queryClient.invalidateQueries({ queryKey: ['membership'] });
      },
      signOut: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
      },
    }),
    [sessionLoading, userId, session, membershipQuery.isPending, membershipQuery.data, membershipQuery.error, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}

/** Para pantallas internas: el negocio y el rol siempre existen. */
export function useShop() {
  const { membership, user } = useAuth();
  if (!membership || !user) throw new Error('useShop requiere sesión con negocio');
  return {
    orgId: membership.organization.id,
    organization: membership.organization,
    role: membership.role,
    isOwner: membership.role === 'owner',
    displayName: membership.displayName,
    user,
  };
}
