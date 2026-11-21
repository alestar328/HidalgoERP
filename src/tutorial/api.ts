import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useShop } from '../features/auth/AuthProvider';
import type { Role } from '../lib/types';
import type { TutorialProgress } from './progress';

export interface GuideRecord {
  user_id: string;
  guide_id: string;
  first_completed_at: string;
  last_completed_at: string;
  times_completed: number;
}

export const tutorialKey = (orgId: string, userId: string) => ['tutorial', orgId, userId] as const;
export const teamTutorialKey = (orgId: string) => ['tutorial-team', orgId] as const;

/**
 * Progreso del usuario guardado en la base. null si no se pudo leer (sin conexión, o la
 * migración 0004 aún no está aplicada): entonces la app usa solo lo del equipo.
 */
export function useServerProgress() {
  const { orgId, user } = useShop();
  return useQuery({
    queryKey: tutorialKey(orgId, user.id),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<TutorialProgress | null> => {
      const [rows, me] = await Promise.all([
        supabase
          .from('tutorial_progress')
          .select('guide_id, last_completed_at')
          .eq('organization_id', orgId)
          .eq('user_id', user.id),
        supabase
          .from('memberships')
          .select('tutorial_welcome_at')
          .eq('organization_id', orgId)
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (rows.error || me.error) return null;
      const done: Record<string, string> = {};
      for (const r of rows.data as { guide_id: string; last_completed_at: string }[]) done[r.guide_id] = r.last_completed_at;
      return { welcomeSeen: Boolean((me.data as { tutorial_welcome_at: string | null } | null)?.tutorial_welcome_at), done };
    },
  });
}

export async function completeGuide(orgId: string, guideId: string) {
  const { error } = await supabase.rpc('complete_guide', { p_org: orgId, p_guide: guideId });
  if (error) throw error;
}

export async function syncProgress(orgId: string, guides: string[], welcome: boolean) {
  const { error } = await supabase.rpc('sync_tutorial_progress', { p_org: orgId, p_guides: guides, p_welcome: welcome });
  if (error) throw error;
}

export async function setWelcome(orgId: string, seen: boolean) {
  const { error } = await supabase.rpc('set_tutorial_welcome', { p_org: orgId, p_seen: seen });
  if (error) throw error;
}

export interface TeamMemberProgress {
  userId: string;
  name: string;
  role: Role;
  welcomeAt: string | null;
  guides: GuideRecord[];
}

/** Avance de todo el equipo (solo el dueño puede leerlo). */
export function useTeamProgress(enabled: boolean) {
  const { orgId } = useShop();
  return useQuery({
    queryKey: teamTutorialKey(orgId),
    enabled,
    queryFn: async (): Promise<TeamMemberProgress[]> => {
      const [members, rows] = await Promise.all([
        supabase
          .from('memberships')
          .select('user_id, role, display_name, email, tutorial_welcome_at')
          .eq('organization_id', orgId)
          .order('created_at'),
        supabase
          .from('tutorial_progress')
          .select('user_id, guide_id, first_completed_at, last_completed_at, times_completed')
          .eq('organization_id', orgId)
          .order('last_completed_at', { ascending: false }),
      ]);
      if (members.error) throw members.error;
      if (rows.error) throw rows.error;
      const byUser = new Map<string, GuideRecord[]>();
      for (const r of rows.data as GuideRecord[]) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
      return (
        members.data as { user_id: string; role: Role; display_name: string | null; email: string | null; tutorial_welcome_at: string | null }[]
      ).map((m) => ({
        userId: m.user_id,
        name: m.display_name || m.email || 'Sin nombre',
        role: m.role,
        welcomeAt: m.tutorial_welcome_at,
        guides: byUser.get(m.user_id) ?? [],
      }));
    },
  });
}
