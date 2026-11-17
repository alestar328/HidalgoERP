import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, MessageStrip } from '@ui5/webcomponents-react';
import { PageHeader } from '../../components/PageHeader';
import { TextField } from '../../components/Fields';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import type { Invitation, Member } from '../../lib/types';
import { useAuth, useShop } from '../auth/AuthProvider';

export function SettingsPage() {
  const { orgId, organization, isOwner, user } = useShop();
  const { refreshMembership } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState(organization.name);
  const [phone, setPhone] = useState(organization.phone ?? '');
  const [address, setAddress] = useState(organization.address ?? '');
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  useEffect(() => {
    setName(organization.name);
    setPhone(organization.phone ?? '');
    setAddress(organization.address ?? '');
  }, [organization]);

  const team = useQuery({
    queryKey: ['team', orgId],
    enabled: isOwner,
    queryFn: async (): Promise<{ members: Member[]; invitations: Invitation[] }> => {
      const [members, invitations] = await Promise.all([
        supabase
          .from('memberships')
          .select('id, user_id, role, display_name, email')
          .eq('organization_id', orgId)
          .order('created_at'),
        supabase
          .from('invitations')
          .select('id, email, accepted_at')
          .eq('organization_id', orgId)
          .is('accepted_at', null)
          .order('created_at'),
      ]);
      if (members.error) throw members.error;
      if (invitations.error) throw invitations.error;
      return { members: members.data as Member[], invitations: invitations.data as Invitation[] };
    },
  });

  if (!isOwner) return <Navigate to="/mas" replace />;

  const saveOrg = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() === '') {
      setOrgError('Escribe el nombre del negocio.');
      return;
    }
    setSavingOrg(true);
    setOrgError(null);
    const { error } = await supabase
      .from('organizations')
      .update({ name: name.trim(), phone: phone.trim() || null, address: address.trim() || null })
      .eq('id', orgId);
    setSavingOrg(false);
    if (error) {
      setOrgError(errorMessage(error));
      return;
    }
    await refreshMembership();
    toast('Datos guardados');
  };

  const refreshTeam = () => queryClient.invalidateQueries({ queryKey: ['team', orgId] });

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setTeamError('Escribe un correo válido.');
      return;
    }
    if (team.data?.members.some((m) => m.email === email)) {
      setTeamError('Esa persona ya está en tu negocio.');
      return;
    }
    setTeamBusy(true);
    setTeamError(null);
    const { error } = await supabase.from('invitations').insert({ organization_id: orgId, email, role: 'seller' });
    setTeamBusy(false);
    if (error) {
      setTeamError(errorMessage(error));
      return;
    }
    setInviteEmail('');
    await refreshTeam();
    toast('Invitación guardada');
  };

  const remove = async (table: 'memberships' | 'invitations', rowId: string) => {
    setTeamBusy(true);
    setTeamError(null);
    const { error } = await supabase.from(table).delete().eq('id', rowId);
    setTeamBusy(false);
    if (error) setTeamError(errorMessage(error));
    else await refreshTeam();
  };

  return (
    <div className="page">
      <PageHeader title="Mi negocio" back="/mas" />
      <div className="content">
        <form className="card stack" onSubmit={saveOrg} noValidate>
          <h2>Datos del negocio</h2>
          {orgError && (
            <MessageStrip design="Negative" hideCloseButton>
              {orgError}
            </MessageStrip>
          )}
          <TextField label="Nombre" value={name} onChange={setName} required maxlength={80} />
          <TextField label="Celular" type="Tel" value={phone} onChange={setPhone} maxlength={20} />
          <TextField
            label="Dirección"
            value={address}
            onChange={setAddress}
            placeholder="Ej.: Galería El Progreso, stand 214"
            maxlength={120}
          />
          <Button design="Emphasized" type="Submit" disabled={savingOrg}>
            {savingOrg ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>

        <section className="card stack">
          <h2>Vendedores</h2>
          <p className="muted">
            Un vendedor registra ventas y consulta el stock. No ve costos ni puede borrar o anular.
          </p>
          {teamError && (
            <MessageStrip design="Negative" hideCloseButton>
              {teamError}
            </MessageStrip>
          )}
          {team.isError && <p className="muted">{errorMessage(team.error)}</p>}

          {team.data && (
            <ul className="list">
              {team.data.members.map((m) => (
                <li key={m.id}>
                  <div className="list-item" style={{ cursor: 'default', paddingInline: 0 }}>
                    <span className="list-item__main">
                      <span className="list-item__title" style={{ display: 'block' }}>
                        {m.display_name || m.email || 'Sin nombre'}
                        {m.user_id === user.id ? ' (tú)' : ''}
                      </span>
                      <span className="list-item__sub" style={{ display: 'block' }}>
                        {m.role === 'owner' ? 'Dueño' : 'Vendedor'}
                        {m.display_name && m.email ? ` · ${m.email}` : ''}
                      </span>
                    </span>
                    {m.role !== 'owner' && (
                      <Button
                        design="Transparent"
                        icon="delete"
                        accessibleName={`Quitar a ${m.email ?? 'vendedor'}`}
                        tooltip="Quitar"
                        disabled={teamBusy}
                        onClick={() => void remove('memberships', m.id)}
                      />
                    )}
                  </div>
                </li>
              ))}
              {team.data.invitations.map((i) => (
                <li key={i.id}>
                  <div className="list-item" style={{ cursor: 'default', paddingInline: 0 }}>
                    <span className="list-item__main">
                      <span className="list-item__title" style={{ display: 'block' }}>
                        {i.email}
                      </span>
                      <span className="list-item__sub" style={{ display: 'block' }}>
                        Invitado · aún no ha entrado
                      </span>
                    </span>
                    <Button
                      design="Transparent"
                      icon="delete"
                      accessibleName={`Cancelar invitación de ${i.email}`}
                      tooltip="Cancelar invitación"
                      disabled={teamBusy}
                      onClick={() => void remove('invitations', i.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form className="stack" onSubmit={invite} noValidate>
            <TextField
              label="Invitar vendedor por correo"
              type="Email"
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="vendedor@correo.com"
              hint="Dile que entre a la app con ese mismo correo: quedará dentro de tu negocio."
            />
            <Button type="Submit" icon="employee" disabled={teamBusy}>
              Invitar
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
