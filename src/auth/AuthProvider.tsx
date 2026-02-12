import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Database } from '../types/supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ClinicUserRow = Database['public']['Tables']['clinic_users']['Row'];
type ClinicRow = Database['public']['Tables']['clinics']['Row'];

type AuthRole = 'owner' | 'admin' | 'user';
type SystemRole = 'system_owner' | 'super_admin';
type InternalRole = 'one_doctor_admin' | 'one_doctor_sales';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  clinicUser: ClinicUserRow | null;
  clinic: ClinicRow | null;
  role: AuthRole;
  systemRole: SystemRole | null;
  isOneDoctorInternal: boolean;
  clinicId: string | null;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  allowedPages: string[];
  hasPageAccess: (page: string) => boolean;
  adminPages: string[];
  hasAdminPageAccess: (page: string) => boolean;
  clinicPackageIds: string[];
  clinicPackagePages: string[];
  effectiveClinicId: string | null; // clinic resolvida (admin usa selecionada; user usa própria)
  selectedClinicId: string | null; // null = todas (somente admin/owner)
  setSelectedClinicId: (id: string | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [clinicUser, setClinicUser] = useState<ClinicUserRow | null>(null);
  const [clinic, setClinic] = useState<ClinicRow | null>(null);
  const [clinicLoading, setClinicLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedClinicId, setSelectedClinicIdState] = useState<string | null>(null);
  const [clinicPackageIds, setClinicPackageIds] = useState<string[]>([]);
  const [clinicPackagePages, setClinicPackagePages] = useState<string[]>([]);

  const applySystemAdminInvite = async (u: User | null, currentProfile: ProfileRow | null) => {
    if (!u?.email) return null;
    if (currentProfile?.role === 'system_owner' || currentProfile?.role === 'super_admin') return null;
    const email = u.email.trim().toLowerCase();
    try {
      const { data: invite, error } = await (supabase as any)
        .from('system_admin_invites')
        .select('id, role, full_name')
        .eq('email', email)
        .maybeSingle();
      if (error || !invite) return null;
      const nextRole = invite.role === 'system_owner' ? 'system_owner' : 'super_admin';
      const nextFullName = invite.full_name?.trim() || currentProfile?.full_name || null;
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .upsert(
          { id: u.id, role: nextRole, full_name: nextFullName },
          { onConflict: 'id' }
        )
        .select('*')
        .maybeSingle();
      if (updateError) return null;
      await (supabase as any).from('system_admin_invites').delete().eq('id', invite.id);
      return (updated as ProfileRow) || { ...(currentProfile || { id: u.id } as ProfileRow), role: nextRole, full_name: nextFullName };
    } catch {
      return null;
    }
  };

  const fetchProfile = async (u: User | null) => {
    if (!u) {
      setProfile(null);
      setClinicUser(null);
      return;
    }

    // Perfil principal (profiles.id = auth user id)
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .maybeSingle();
    let resolvedProfile = (prof as ProfileRow) || null;
    const updatedProfile = await applySystemAdminInvite(u, resolvedProfile);
    if (updatedProfile) resolvedProfile = updatedProfile;
    setProfile(resolvedProfile);

    // Membership via auth.uid()
    const { data: cu } = await supabase
      .from('clinic_users')
      .select('*')
      .eq('user_id', u.id)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .maybeSingle();

    let resolved = cu ?? null;

    // Auto-associa usuário recém-criado pelo email, se ainda não houver user_id.
    const normalizedEmail = u.email?.trim().toLowerCase();
    if (!resolved && normalizedEmail) {
      const { data: byEmail } = await supabase
        .from('clinic_users')
        .select('*')
        .eq('email', normalizedEmail)
        .is('user_id', null)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byEmail) {
        const { error: linkError } = await supabase
          .from('clinic_users')
          .update({ user_id: u.id })
          .eq('id', byEmail.id);
        if (!linkError) {
          resolved = { ...byEmail, user_id: u.id };
        }
      }
    }

    setClinicUser(resolved ?? null);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    await fetchProfile(data.session?.user ?? null);
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      fetchProfile(data.session?.user ?? null).finally(() => setLoading(false));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      fetchProfile(newSession?.user ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const systemRole: SystemRole | null = useMemo(() => {
    const raw = profile?.role;
    if (raw === 'system_owner' || raw === 'super_admin') return raw;
    return null;
  }, [profile?.role]);

  const isOneDoctorInternal = useMemo(() => {
    const raw = profile?.role as InternalRole | undefined;
    return raw === 'one_doctor_admin' || raw === 'one_doctor_sales';
  }, [profile?.role]);

  const role: AuthRole = useMemo(() => {
    const rawClinicRole =
      clinicUser?.role ||
      (profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'user' ? profile?.role : null) ||
      'user';
    if (rawClinicRole === 'owner' || rawClinicRole === 'admin' || rawClinicRole === 'user') return rawClinicRole;
    return 'user';
  }, [clinicUser?.role, profile?.role]);

  const clinicId = useMemo(() => {
    return clinicUser?.clinic_id || profile?.clinic_id || null;
  }, [clinicUser?.clinic_id, profile?.clinic_id]);

  useEffect(() => {
    let active = true;
    const loadClinic = async () => {
      if (!clinicId) {
        if (active) setClinic(null);
        if (active) setClinicLoading(false);
        return;
      }
      setClinicLoading(true);
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .maybeSingle();
      if (active) {
        setClinic(data ?? null);
        setClinicLoading(false);
      }
    };
    loadClinic();
    return () => {
      active = false;
    };
  }, [clinicId]);

  useEffect(() => {
    let active = true;
    const loadPackages = async () => {
      if (!clinicId) {
        if (active) {
          setClinicPackageIds([]);
          setClinicPackagePages([]);
        }
        return;
      }
      try {
        const { data, error } = await (supabase as any)
          .from('clinic_packages')
          .select('package_id, content_packages (pages)')
          .eq('clinic_id', clinicId);
        if (!active) return;
        if (error) {
          setClinicPackageIds([]);
          setClinicPackagePages([]);
          return;
        }
        const ids = Array.from(
          new Set((data || []).map((row: any) => row.package_id).filter(Boolean))
        ) as string[];
        const pages = Array.from(
          new Set(
            (data || [])
              .flatMap((row: any) => row.content_packages?.pages || [])
              .map((page: string) => page.trim())
              .filter(Boolean)
          )
        ) as string[];
        setClinicPackageIds(ids);
        setClinicPackagePages(pages);
      } catch {
        if (active) {
          setClinicPackageIds([]);
          setClinicPackagePages([]);
        }
      }
    };
    loadPackages();
    return () => {
      active = false;
    };
  }, [clinicId]);

  const isAdmin = role === 'admin' || role === 'owner';
  const isSystemAdmin = systemRole !== null;

  const normalizePage = (page: string) => {
    const trimmed = page.trim();
    if (!trimmed) return '';
    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    switch (withSlash) {
      case '/dashboard':
        return '/';
      case '/course':
      case '/courses':
        return '/contents/courses';
      case '/training':
      case '/trainings':
        return '/contents/trainings';
      default:
        return withSlash;
    }
  };

  const normalizeAdminPage = (page: string) => {
    const trimmed = page.trim();
    if (!trimmed) return '';
    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (withSlash === '/admin') return '/admin/dashboard';
    return withSlash.startsWith('/admin') ? withSlash : `/admin${withSlash}`;
  };

  const allowedPages = useMemo(() => {
    const clinicPages = (clinic?.paginas_liberadas || []).map(normalizePage).filter(Boolean);
    const userPages = (clinicUser?.paginas_liberadas || []).map(normalizePage).filter(Boolean);
    const packagePages = (clinicPackagePages || []).map(normalizePage).filter(Boolean);
    const combinedClinicPages = Array.from(new Set([...clinicPages, ...packagePages]));
    if (!combinedClinicPages.length && !userPages.length) return [];
    if (!combinedClinicPages.length) return Array.from(new Set(userPages));
    if (!userPages.length) return Array.from(new Set(combinedClinicPages));
    const userSet = new Set(userPages);
    const intersection = combinedClinicPages.filter((page) => userSet.has(page));
    return Array.from(new Set(intersection));
  }, [clinic?.paginas_liberadas, clinicUser?.paginas_liberadas, clinicPackagePages]);

  const allowedPagesSet = useMemo(() => new Set(allowedPages), [allowedPages]);
  const hasPageRules = useMemo(() => {
    const clinicPages = (clinic?.paginas_liberadas || []).map(normalizePage).filter(Boolean);
    const userPages = (clinicUser?.paginas_liberadas || []).map(normalizePage).filter(Boolean);
    const packagePages = (clinicPackagePages || []).map(normalizePage).filter(Boolean);
    return clinicPages.length > 0 || userPages.length > 0 || packagePages.length > 0;
  }, [clinic?.paginas_liberadas, clinicUser?.paginas_liberadas, clinicPackagePages]);

  const hasPageAccess = (page: string) => {
    if (!hasPageRules) return true;
    const normalized = normalizePage(page);
    if (!normalized) return false;
    if (allowedPagesSet.has(normalized)) return true;
    const [base] = normalized.split('?');
    if (base !== normalized) {
      return allowedPagesSet.has(base);
    }
    for (const allowed of allowedPagesSet) {
      if (allowed.startsWith(`${base}?`)) return true;
    }
    return false;
  };

  const adminPages = useMemo(() => {
    const rawPages = (profile?.admin_pages || []) as string[];
    const normalized = rawPages.map(normalizeAdminPage).filter(Boolean);
    return Array.from(new Set(normalized));
  }, [profile?.admin_pages]);

  const hasAdminPageAccess = (page: string) => {
    const normalized = normalizeAdminPage(page);
    if (!normalized) return false;

    const crmPages = ['/admin/clientes', '/admin/contratos', '/admin/propostas'];

    if (isSystemAdmin) {
      if (systemRole === 'system_owner') return true;
      if (crmPages.some((allowed) => normalized.startsWith(allowed))) return true;
      if (!adminPages.length) return true;
      const [base] = normalized.split('?');
      if (adminPages.includes(base)) return true;
      return adminPages.some((allowed) => base.startsWith(allowed));
    }

    if (isOneDoctorInternal) {
      const allowedDefaults = ['/admin/clientes', '/admin/contratos', '/admin/propostas'];
      const allowed = adminPages.length ? adminPages : allowedDefaults;
      const [base] = normalized.split('?');
      if (allowed.includes(base)) return true;
      return allowed.some((allowedPage) => base.startsWith(allowedPage));
    }

    return false;
  };

  const effectiveClinicId = useMemo(() => {
    if (isSystemAdmin) return selectedClinicId ?? null;
    return clinicId;
  }, [isSystemAdmin, clinicId, selectedClinicId]);

  // Persistência do clinic selecionado (admin)
  useEffect(() => {
    if (!isSystemAdmin) {
      setSelectedClinicIdState(null);
      return;
    }
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('adminActiveClinicId') : null;
    if (saved) setSelectedClinicIdState(saved);
  }, [isSystemAdmin]);

  const setSelectedClinicId = (id: string | null) => {
    setSelectedClinicIdState(id);
    if (typeof window !== 'undefined') {
      if (id === null) window.localStorage.removeItem('adminActiveClinicId');
      else window.localStorage.setItem('adminActiveClinicId', id);
    }
  };

  // Logs de diagnóstico (apenas dev)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[auth] user', user?.id, 'role', role, 'clinic', clinicId);
    }
  }, [user?.id, role, clinicId]);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    clinicUser,
    clinic,
    role,
    systemRole,
    isOneDoctorInternal,
    clinicId,
    isAdmin,
    isSystemAdmin,
    allowedPages,
    hasPageAccess,
    adminPages,
    hasAdminPageAccess,
    clinicPackageIds,
    clinicPackagePages,
    effectiveClinicId,
    selectedClinicId,
    setSelectedClinicId,
    loading: loading || clinicLoading,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
