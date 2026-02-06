import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Download, Link2, Plus, Search, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';

type MeetingStatus = 'Agendada' | 'Em andamento' | 'Finalizada' | 'Cancelada';

type MeetingForm = {
  title: string;
  department: string;
  meetingType: string;
  meetingDate: string;
  meetingTime: string;
  status: MeetingStatus;
  meetingLink: string;
  conductorId: string;
  participantIds: string[];
  agenda: string;
  nextSteps: string;
};

const STATUS_OPTIONS: { value: MeetingStatus; label: string }[] = [
  { value: 'Agendada', label: 'Agendada' },
  { value: 'Em andamento', label: 'Em curso' },
  { value: 'Finalizada', label: 'Finalizada' },
  { value: 'Cancelada', label: 'Cancelada' },
];

const getInitials = (name: string) => {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const parts = cleaned.split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const formatTime = (value?: string | null) => {
  if (!value) return '--:--';
  const raw = value.split(':');
  if (raw.length >= 2) return `${raw[0].padStart(2, '0')}:${raw[1].padStart(2, '0')}`;
  return value;
};

const MultiSelect: React.FC<{
  options: { value: string; label: string; subLabel?: string; avatar?: string | null }[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}> = ({ options, value, onChange, placeholder = 'Selecione' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.filter((opt) => value.includes(opt.value));

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white focus:ring-brand-500 outline-none"
      >
        {selected.length === 0 && <span className="text-gray-400">{placeholder}</span>}
        {selected.length > 0 && (
          <span className="text-gray-700">
            {selected.slice(0, 2).map((opt) => opt.label).join(', ')}
            {selected.length > 2 ? ` +${selected.length - 2}` : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...value, opt.value]);
                    else onChange(value.filter((id) => id !== opt.value));
                  }}
                />
                <span className="flex items-center gap-2">
                  {opt.avatar ? (
                    <img src={opt.avatar} alt={opt.label} className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-semibold">
                      {getInitials(opt.label)}
                    </span>
                  )}
                  <span className="flex flex-col">
                    <span className="font-medium text-gray-800">{opt.label}</span>
                    {opt.subLabel && <span className="text-[11px] text-gray-400">{opt.subLabel}</span>}
                  </span>
                </span>
              </label>
            );
          })}
          {options.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">Nenhum participante disponível.</p>}
        </div>
      )}
    </div>
  );
};

const HRMeetings: React.FC = () => {
  const { effectiveClinicId: clinicId, clinicUser, user, isSystemAdmin, role } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [clinicUsers, setClinicUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailMeeting, setDetailMeeting] = useState<any | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    department: '',
    leaderId: '',
    meetingType: '',
    date: '',
    status: '',
    participantId: '',
  });

  const [form, setForm] = useState<MeetingForm>({
    title: '',
    department: '',
    meetingType: '',
    meetingDate: '',
    meetingTime: '',
    status: 'Agendada',
    meetingLink: '',
    conductorId: '',
    participantIds: [],
    agenda: '',
    nextSteps: '',
  });

  const departmentOptions = useMemo(() => {
    return departments.map((dep: any) => dep.name).sort();
  }, [departments]);

  const meetingTypeOptions = useMemo(
    () => [
      'Feedback',
      'Alinhamento estratégico',
      'Resultados',
      'Equipe',
      'Planejamento',
      'Treinamento',
      'Novos Projetos / Inovação',
      'Avaliação de Desempenho',
      'Outros',
    ],
    []
  );

  const participantOptions = useMemo(() => {
    return clinicUsers.map((u) => ({
      value: u.id,
      label: u.name || u.email,
      subLabel: u.email,
      avatar: u.avatar_url,
    }));
  }, [clinicUsers]);

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      if (filters.search) {
        const needle = filters.search.toLowerCase();
        const haystack = [
          meeting.title,
          meeting.department,
          meeting.meeting_type,
          meeting.conductor?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (filters.department && meeting.department !== filters.department) return false;
      if (filters.leaderId && meeting.conductor_id !== filters.leaderId) return false;
      if (filters.meetingType && meeting.meeting_type !== filters.meetingType) return false;
      if (filters.status && meeting.status !== filters.status) return false;
      if (filters.date && meeting.meeting_date !== filters.date) return false;
      if (filters.participantId) {
        const hasParticipant = (meeting.participants || []).some(
          (p: any) => p.clinic_user_id === filters.participantId
        );
        if (!hasParticipant) return false;
      }
      return true;
    });
  }, [meetings, filters]);

  const metrics = useMemo(() => {
    const total = filteredMeetings.length;
    const finished = filteredMeetings.filter((m) => m.status === 'Finalizada').length;
    const ongoing = filteredMeetings.filter((m) => m.status === 'Em andamento').length;
    const upcoming = filteredMeetings.filter((m) => m.status === 'Agendada').length;
    return { total, finished, ongoing, upcoming };
  }, [filteredMeetings]);

  const report = useMemo(() => {
    const byDepartment: Record<string, number> = {};
    const byLeader: Record<string, number> = {};
    const byType: Record<string, number> = {};
    filteredMeetings.forEach((meeting) => {
      const dep = meeting.department || 'Sem departamento';
      const leader = meeting.conductor?.name || 'Sem líder';
      const type = meeting.meeting_type || 'Sem tipo';
      byDepartment[dep] = (byDepartment[dep] || 0) + 1;
      byLeader[leader] = (byLeader[leader] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
    });
    const sortTop = (obj: Record<string, number>) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
    return {
      topDepartments: sortTop(byDepartment),
      topLeaders: sortTop(byLeader),
      topTypes: sortTop(byType),
    };
  }, [filteredMeetings]);

  const statusBadge = (status: MeetingStatus) => {
    if (status === 'Finalizada') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Em andamento') return 'bg-sky-50 text-sky-700';
    if (status === 'Cancelada') return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
  };

  const statusLabel = (status?: MeetingStatus | null) => {
    if (!status) return 'Agendada';
    const match = STATUS_OPTIONS.find((opt) => opt.value === status);
    return match?.label || status;
  };

  const formatCsvValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[";\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const exportMeetings = (format: 'csv' | 'pdf') => {
    const headers = [
      'Data',
      'Hora',
      'Título',
      'Departamento',
      'Tipo',
      'Conduzida por',
      'Status',
      'Participantes',
    ];
    const rows = filteredMeetings.map((meeting) => {
      const participantNames = (meeting.participants || [])
        .map((p: any) => p.clinic_users?.name || p.clinic_users?.email || '')
        .filter(Boolean)
        .join(', ');
      return [
        formatDate(meeting.meeting_date),
        formatTime(meeting.meeting_time),
        meeting.title || '',
        meeting.department || '',
        meeting.meeting_type || '',
        meeting.conductor?.name || '',
        statusLabel(meeting.status),
        participantNames,
      ];
    });

    if (format === 'csv') {
      const csv = [
        headers.map(formatCsvValue).join(';'),
        ...rows.map((row) => row.map(formatCsvValue).join(';')),
      ].join('\n');
      const content = `\uFEFF${csv}`;
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'reunioes-internas.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const htmlRows = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td style="padding:6px;border:1px solid #ddd;font-size:12px;">${cell}</td>`)
            .join('')}</tr>`
      )
      .join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Relatório de reuniões</title>
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;}th,td{border:1px solid #ddd;padding:6px;font-size:12px;}th{background:#f3f4f6;text-align:left;}</style>
      </head><body>
      <h3>Relatório de reuniões internas (filtrado)</h3>
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${htmlRows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const canManageMeeting = (meeting: any) => {
    if (isSystemAdmin) return true;
    if (meeting.created_by && meeting.created_by === user?.id) return true;
    return role === 'admin' || role === 'owner';
  };

  const loadClinicUsers = async () => {
    if (!clinicId) {
      setClinicUsers([]);
      return;
    }
    const { data } = await supabase
      .from('clinic_users')
      .select('id, name, email, avatar_url, user_id, ativo')
      .eq('clinic_id', clinicId)
      .eq('ativo', true)
      .order('name', { ascending: true });
    setClinicUsers((data || []) as any[]);
  };

  const loadDepartments = async () => {
    if (!clinicId) {
      setDepartments([]);
      return;
    }
    const { data } = await supabase
      .from('hr_departments')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true });
    setDepartments((data || []) as any[]);
  };

  const loadMeetings = async () => {
    if (!clinicId) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('hr_meetings')
      .select(
        `
        *,
        conductor:clinic_users!hr_meetings_conductor_id_fkey (id, name, email, avatar_url),
        participants:hr_meeting_participants (
          clinic_user_id,
          clinic_users (id, name, email, avatar_url)
        )
      `
      )
      .eq('clinic_id', clinicId)
      .order('meeting_date', { ascending: false })
      .order('meeting_time', { ascending: false });
    if (!error && data) {
      const currentClinicUserId = clinicUser?.id;
      const filtered = isSystemAdmin
        ? data
        : data.filter((m: any) => {
            if (!currentClinicUserId) return true;
            const isParticipant = (m.participants || []).some(
              (p: any) => p.clinic_user_id === currentClinicUserId
            );
            const isCreator = m.created_by && m.created_by === user?.id;
            return isParticipant || isCreator;
          });
      setMeetings(filtered as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadClinicUsers();
    loadDepartments();
  }, [clinicId]);

  useEffect(() => {
    loadMeetings();
  }, [clinicId]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormError(null);
    setForm({
      title: '',
      department: '',
      meetingType: '',
      meetingDate: '',
      meetingTime: '',
      status: 'Agendada',
      meetingLink: '',
      conductorId: '',
      participantIds: [],
      agenda: '',
      nextSteps: '',
    });
    setShowModal(true);
  };

  const openEditModal = (meeting: any) => {
    setEditingId(meeting.id);
    setFormError(null);
    setForm({
      title: meeting.title || '',
      department: meeting.department || '',
      meetingType: meeting.meeting_type || '',
      meetingDate: meeting.meeting_date || '',
      meetingTime: meeting.meeting_time || '',
      status: meeting.status || 'Agendada',
      meetingLink: meeting.meeting_link || '',
      conductorId: meeting.conductor_id || '',
      participantIds: (meeting.participants || []).map((p: any) => p.clinic_user_id),
      agenda: meeting.agenda || '',
      nextSteps: meeting.next_steps || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!clinicId) {
      setFormError('Nenhuma clínica ativa para salvar reunião.');
      return;
    }
    if (!form.title.trim()) {
      setFormError('Informe o título da reunião.');
      return;
    }
    if (!form.meetingDate) {
      setFormError('Informe a data da reunião.');
      return;
    }
    const participantIds = Array.from(
      new Set(
        [
          ...form.participantIds,
          clinicUser?.id,
        ].filter(Boolean) as string[]
      )
    );
    if (!participantIds.length) {
      setFormError('Selecione ao menos um participante.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const basePayload = {
        clinic_id: clinicId,
        title: form.title.trim(),
        department: form.department || null,
        meeting_type: form.meetingType || null,
        meeting_date: form.meetingDate,
        meeting_time: form.meetingTime || null,
        status: form.status,
        meeting_link: form.meetingLink || null,
        agenda: form.agenda || null,
        next_steps: form.nextSteps || null,
        conductor_id: form.conductorId || null,
      };

      let meetingId = editingId;
      if (editingId) {
        const { error } = await supabase.from('hr_meetings').update(basePayload).eq('id', editingId);
        if (error) throw error;
      } else {
        const payload = { ...basePayload, created_by: user?.id || null };
        const { data, error } = await supabase
          .from('hr_meetings')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        meetingId = data?.id || null;
      }

      if (meetingId) {
        await supabase.from('hr_meeting_participants').delete().eq('meeting_id', meetingId);
        const rows = participantIds.map((id) => ({
          meeting_id: meetingId,
          clinic_user_id: id,
        }));
        const { error: participantError } = await supabase.from('hr_meeting_participants').insert(rows);
        if (participantError) throw participantError;
      }

      setShowModal(false);
      setEditingId(null);
      setForm({
        title: '',
        department: '',
        meetingType: '',
        meetingDate: '',
        meetingTime: '',
        status: 'Agendada',
        meetingLink: '',
        conductorId: '',
        participantIds: [],
        agenda: '',
        nextSteps: '',
      });
      loadMeetings();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar reunião.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-600 font-semibold">Recursos Humanos</p>
          <h1 className="text-2xl font-bold text-gray-900">Reuniões internas</h1>
          <p className="text-sm text-gray-500">Registre decisões, participantes e próximos passos da equipe.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 flex items-center gap-2"
        >
          <Plus size={16} /> Adicionar reunião interna
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4">
        <div className="bg-gradient-to-br from-white via-white to-brand-50 border border-brand-100 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Visão geral</p>
              <p className="text-lg font-semibold text-gray-900">Acompanhamento das reuniões</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-900 text-white p-3">
              <p className="text-xs text-slate-200">Total</p>
              <p className="text-lg font-semibold">{metrics.total}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs text-amber-600">Agendadas</p>
              <p className="text-lg font-semibold text-amber-700">{metrics.upcoming}</p>
            </div>
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3">
              <p className="text-xs text-sky-600">Em curso</p>
              <p className="text-lg font-semibold text-sky-700">{metrics.ongoing}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-xs text-emerald-600">Finalizadas</p>
              <p className="text-lg font-semibold text-emerald-700">{metrics.finished}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Buscar por título, líder ou departamento"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 outline-none"
              />
            </div>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={filters.department}
              onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todos os departamentos</option>
              {departmentOptions.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
            <select
              value={filters.leaderId}
              onChange={(e) => setFilters((prev) => ({ ...prev, leaderId: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todos os líderes</option>
              {clinicUsers.map((userRow) => (
                <option key={userRow.id} value={userRow.id}>
                  {userRow.name || userRow.email}
                </option>
              ))}
            </select>
            <select
              value={filters.meetingType}
              onChange={(e) => setFilters((prev) => ({ ...prev, meetingType: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todos os tipos</option>
              {meetingTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todos os status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select
              value={filters.participantId}
              onChange={(e) => setFilters((prev) => ({ ...prev, participantId: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Todos os participantes</option>
              {clinicUsers.map((userRow) => (
                <option key={userRow.id} value={userRow.id}>
                  {userRow.name || userRow.email}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-400">
              Apenas participantes marcados podem acessar a pauta da reunião.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => exportMeetings('pdf')}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 flex items-center gap-2"
              >
                <Download size={14} /> PDF
              </button>
              <button
                type="button"
                onClick={() => exportMeetings('csv')}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 flex items-center gap-2"
              >
                <Download size={14} /> CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Relatório por departamento</p>
          <div className="space-y-2">
            {report.topDepartments.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{name}</span>
                <span className="font-semibold text-gray-800">{count}</span>
              </div>
            ))}
            {report.topDepartments.length === 0 && <p className="text-sm text-gray-400">Sem dados.</p>}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Relatório por líder</p>
          <div className="space-y-2">
            {report.topLeaders.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{name}</span>
                <span className="font-semibold text-gray-800">{count}</span>
              </div>
            ))}
            {report.topLeaders.length === 0 && <p className="text-sm text-gray-400">Sem dados.</p>}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Relatório por tipo</p>
          <div className="space-y-2">
            {report.topTypes.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{name}</span>
                <span className="font-semibold text-gray-800">{count}</span>
              </div>
            ))}
            {report.topTypes.length === 0 && <p className="text-sm text-gray-400">Sem dados.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Histórico de reuniões</h2>
            <p className="text-sm text-gray-500">Visualize reuniões em que você participou.</p>
          </div>
          <span className="text-sm text-gray-400">{filteredMeetings.length} registros</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Carregando reuniões...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="px-6 py-4 flex flex-wrap items-center gap-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setDetailMeeting(meeting)}
              >
                <div className="flex items-center gap-3 min-w-[160px]">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{formatDate(meeting.meeting_date)}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={12} /> {formatTime(meeting.meeting_time)}
                    </p>
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-gray-900">{meeting.title}</p>
                  <p className="text-xs text-gray-500">
                    {meeting.department || 'Sem departamento'} • {meeting.meeting_type || 'Tipo não informado'}
                  </p>
                </div>
                <div className="flex items-center gap-3 min-w-[200px]">
                  {meeting.conductor?.avatar_url ? (
                    <img
                      src={meeting.conductor.avatar_url}
                      alt={meeting.conductor.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-semibold">
                      {getInitials(meeting.conductor?.name || 'CL')}
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-800">{meeting.conductor?.name || 'Sem líder'}</p>
                    <p className="text-xs text-gray-400">Conduzida por</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(meeting.status || 'Agendada')}`}>
                  {statusLabel(meeting.status)}
                </span>
                <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setDetailMeeting(meeting)}
                    className="px-3 py-1 text-xs rounded-full border border-gray-200 text-gray-600 hover:border-gray-300"
                  >
                    Ver pauta
                  </button>
                  {canManageMeeting(meeting) && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(meeting)}
                        className="px-3 py-1 text-xs rounded-full border border-brand-100 text-brand-600 hover:border-brand-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Excluir reunião?')) return;
                          const { error } = await supabase.from('hr_meetings').delete().eq('id', meeting.id);
                          if (!error) loadMeetings();
                        }}
                        className="px-3 py-1 text-xs rounded-full border border-rose-100 text-rose-600 hover:border-rose-200"
                      >
                        Apagar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredMeetings.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-gray-400">
                Nenhuma reunião encontrada com os filtros atuais.
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Editar reunião' : 'Adicionar reunião'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    placeholder="Título da reunião"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                    <input
                      type="date"
                      value={form.meetingDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, meetingDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                    <input
                      type="time"
                      value={form.meetingTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, meetingTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Selecione</option>
                    {departmentOptions.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link da reunião</label>
                  <div className="relative">
                    <Link2 size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      value={form.meetingLink}
                      onChange={(e) => setForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="https://meet..."
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conduzida por</label>
                  <select
                    value={form.conductorId}
                    onChange={(e) => setForm((prev) => ({ ...prev, conductorId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Selecione</option>
                    {clinicUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Participantes</label>
                  <MultiSelect
                    options={participantOptions}
                    value={form.participantIds}
                    onChange={(next) => setForm((prev) => ({ ...prev, participantIds: next }))}
                    placeholder="Selecione os participantes"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de reunião</label>
                  <select
                    value={form.meetingType}
                    onChange={(e) => setForm((prev) => ({ ...prev, meetingType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Selecione</option>
                    {meetingTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as MeetingStatus }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assuntos / Pauta</label>
                <textarea
                  value={form.agenda}
                  onChange={(e) => setForm((prev) => ({ ...prev, agenda: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[90px]"
                  placeholder="Digite a pauta da reunião"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Próximos passos</label>
                <textarea
                  value={form.nextSteps}
                  onChange={(e) => setForm((prev) => ({ ...prev, nextSteps: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[90px]"
                  placeholder="Defina os próximos passos"
                />
              </div>

              {formError && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">{formError}</div>}

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Apenas participantes selecionados terão acesso à pauta.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <span className="animate-spin">⏳</span> : <Plus size={16} />}
                    {editingId ? 'Salvar' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailMeeting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">Reunião interna</p>
                <h3 className="text-xl font-semibold text-gray-900">{detailMeeting.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailMeeting(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Data</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(detailMeeting.meeting_date)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Hora</p>
                <p className="text-sm font-semibold text-gray-900">{formatTime(detailMeeting.meeting_time)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Status</p>
                <p className={`text-sm font-semibold ${statusBadge(detailMeeting.status || 'Agendada')}`}>
                  {statusLabel(detailMeeting.status)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-3 space-y-2">
                <p className="text-xs text-gray-500">Conduzida por</p>
                <div className="flex items-center gap-2">
                  {detailMeeting.conductor?.avatar_url ? (
                    <img src={detailMeeting.conductor.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-semibold">
                      {getInitials(detailMeeting.conductor?.name || 'CL')}
                    </div>
                  )}
                  <span className="text-sm text-gray-800">{detailMeeting.conductor?.name || 'Sem líder'}</span>
                </div>
                <p className="text-xs text-gray-500">Departamento</p>
                <p className="text-sm font-semibold text-gray-900">{detailMeeting.department || 'Não informado'}</p>
                <p className="text-xs text-gray-500">Tipo de reunião</p>
                <p className="text-sm font-semibold text-gray-900">{detailMeeting.meeting_type || 'Não informado'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3 space-y-2">
                <p className="text-xs text-gray-500">Participantes</p>
                <div className="flex flex-wrap gap-2">
                  {(detailMeeting.participants || []).map((p: any) => (
                    <span key={p.clinic_user_id} className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                      {p.clinic_users?.name || p.clinic_users?.email || 'Participante'}
                    </span>
                  ))}
                  {(detailMeeting.participants || []).length === 0 && (
                    <span className="text-xs text-gray-400">Nenhum participante informado.</span>
                  )}
                </div>
                {detailMeeting.meeting_link && (
                  <a
                    href={detailMeeting.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-brand-600"
                  >
                    <Link2 size={12} /> Abrir link da reunião
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500 mb-2">Assuntos / Pauta</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailMeeting.agenda || 'Sem pauta registrada.'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500 mb-2">Próximos passos</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailMeeting.next_steps || 'Nenhum próximo passo registrado.'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailMeeting(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
              >
                Fechar
              </button>
              {canManageMeeting(detailMeeting) && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailMeeting(null);
                    openEditModal(detailMeeting);
                  }}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg"
                >
                  Editar reunião
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRMeetings;
