import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Download, Plus, Search, Users, Eye, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';
import RichTextEditor from '../components/RichTextEditor';
import { useModalControls } from '../hooks/useModalControls';

type FeedbackType = 'Positivo' | 'Construtivo' | 'Corretivo' | 'Outros';

const FEEDBACK_TYPES: FeedbackType[] = ['Positivo', 'Construtivo', 'Corretivo', 'Outros'];

const getInitials = (name: string) => {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const parts = cleaned.split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const scoreBubbleClass = (score?: number | null) => {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-400';
  if (score >= 9) return 'bg-emerald-100 text-emerald-700';
  if (score >= 7) return 'bg-lime-100 text-lime-700';
  if (score >= 5) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
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
          {options.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">Nenhum colaborador disponível.</p>}
        </div>
      )}
    </div>
  );
};

const HRFeedback: React.FC = () => {
  const { effectiveClinicId: clinicId, clinicUser, user, isSystemAdmin, role } = useAuth();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [clinicUsers, setClinicUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailFeedback, setDetailFeedback] = useState<any | null>(null);

  const formModalControls = useModalControls({
    isOpen: showModal,
    onClose: () => {
      setShowModal(false);
      setEditingId(null);
    },
  });

  const detailModalControls = useModalControls({
    isOpen: !!detailFeedback,
    onClose: () => setDetailFeedback(null),
  });

  const [filters, setFilters] = useState({
    departmentId: '',
    leaderId: '',
    type: '',
    dateStart: '',
    dateEnd: '',
    search: '',
  });

  const [form, setForm] = useState({
    subjectId: '',
    departmentId: '',
    leaderId: '',
    type: '' as FeedbackType | '',
    feedbackDate: '',
    scorePersonal: '',
    scoreManagement: '',
    result: '',
    description: '',
    participants: [] as string[],
  });

  const formatCsvValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[";\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const exportFeedbacks = (format: 'csv' | 'pdf') => {
    const headers = [
      'Nome',
      'Departamento',
      'Data',
      'Tipo',
      'Resultado',
      'Nota pessoal',
      'Nota gestão',
      'Líder',
    ];
    const rows = filteredFeedbacks.map((fb) => [
      fb.subject?.name || fb.subject?.email || '',
      fb.department?.name || '',
      formatDate(fb.feedback_date),
      fb.feedback_type || '',
      fb.result || '',
      fb.score_personal ?? '',
      fb.score_management ?? '',
      fb.leader?.name || '',
    ]);

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
      link.setAttribute('download', 'feedbacks.csv');
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
      <html><head><title>Relatório de feedbacks</title>
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;}th,td{border:1px solid #ddd;padding:6px;font-size:12px;}th{background:#f3f4f6;text-align:left;}</style>
      </head><body>
      <h3>Relatório de feedbacks (filtrado)</h3>
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${htmlRows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const participantOptions = useMemo(
    () =>
      clinicUsers.map((u) => ({
        value: u.id,
        label: u.name || u.email,
        subLabel: u.email,
        avatar: u.avatar_url,
      })),
    [clinicUsers]
  );

  const departmentOptions = useMemo(() => departments, [departments]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      if (filters.departmentId && fb.department_id !== filters.departmentId) return false;
      if (filters.leaderId && fb.leader_id !== filters.leaderId) return false;
      if (filters.type && fb.feedback_type !== filters.type) return false;
      if (filters.dateStart && (!fb.feedback_date || fb.feedback_date < filters.dateStart)) return false;
      if (filters.dateEnd && (!fb.feedback_date || fb.feedback_date > filters.dateEnd)) return false;
      if (filters.search) {
        const needle = filters.search.toLowerCase();
        const haystack = [
          fb.subject?.name,
          fb.subject?.email,
          fb.department?.name,
          fb.feedback_type,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [feedbacks, filters]);

  const canManage = (fb: any) => {
    if (isSystemAdmin) return true;
    if (fb.created_by && fb.created_by === user?.id) return true;
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

  const loadFeedbacks = async () => {
    if (!clinicId) {
      setFeedbacks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('hr_feedbacks')
      .select(
        `
        *,
        subject:clinic_users!hr_feedbacks_subject_user_id_fkey (id, name, email, avatar_url),
        leader:clinic_users!hr_feedbacks_leader_id_fkey (id, name, email, avatar_url),
        department:hr_departments!hr_feedbacks_department_id_fkey (id, name),
        participants:hr_feedback_participants!hr_feedback_participants_feedback_id_fkey (
          clinic_user_id,
          clinic_users (id, name, email, avatar_url)
        )
      `
      )
      .eq('clinic_id', clinicId)
      .order('feedback_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      const currentClinicUserId = clinicUser?.id;
      const filtered = isSystemAdmin
        ? data
        : data.filter((fb: any) => {
            if (!currentClinicUserId) return true;
            const isParticipant = (fb.participants || []).some(
              (p: any) => p.clinic_user_id === currentClinicUserId
            );
            const isCreator = fb.created_by && fb.created_by === user?.id;
            return isParticipant || isCreator;
          });
      setFeedbacks(filtered as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadClinicUsers();
    loadDepartments();
  }, [clinicId]);

  useEffect(() => {
    loadFeedbacks();
  }, [clinicId]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormError(null);
    setForm({
      subjectId: '',
      departmentId: '',
      leaderId: '',
      type: '',
      feedbackDate: '',
      scorePersonal: '',
      scoreManagement: '',
      result: '',
      description: '',
      participants: [],
    });
    setShowModal(true);
  };

  const openEditModal = (fb: any) => {
    setEditingId(fb.id);
    setFormError(null);
    setForm({
      subjectId: fb.subject_user_id || '',
      departmentId: fb.department_id || '',
      leaderId: fb.leader_id || '',
      type: (fb.feedback_type as FeedbackType) || '',
      feedbackDate: fb.feedback_date || '',
      scorePersonal: fb.score_personal != null ? String(fb.score_personal) : '',
      scoreManagement: fb.score_management != null ? String(fb.score_management) : '',
      result: fb.result || '',
      description: fb.description || '',
      participants: (fb.participants || []).map((p: any) => p.clinic_user_id),
    });
    setShowModal(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!clinicId) {
      setFormError('Nenhuma clínica ativa para salvar feedback.');
      return;
    }
    if (!form.subjectId) {
      setFormError('Selecione quem recebe o feedback.');
      return;
    }
    if (!form.feedbackDate) {
      setFormError('Informe a data do feedback.');
      return;
    }

    const participantIds = Array.from(
      new Set(
        [
          ...form.participants,
          form.subjectId,
          form.leaderId,
          clinicUser?.id,
        ].filter(Boolean) as string[]
      )
    );

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        clinic_id: clinicId,
        subject_user_id: form.subjectId,
        department_id: form.departmentId || null,
        leader_id: form.leaderId || null,
        feedback_type: form.type || null,
        feedback_date: form.feedbackDate,
        score_personal: form.scorePersonal ? Number(form.scorePersonal) : null,
        score_management: form.scoreManagement ? Number(form.scoreManagement) : null,
        result: form.result || null,
        description: form.description || null,
      };

      let feedbackId = editingId;
      if (editingId) {
        const { error } = await supabase.from('hr_feedbacks').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('hr_feedbacks')
          .insert({ ...payload, created_by: user?.id || null })
          .select('id')
          .maybeSingle();
        if (error) throw error;
        feedbackId = data?.id || null;
      }

      if (feedbackId) {
        await supabase.from('hr_feedback_participants').delete().eq('feedback_id', feedbackId);
        if (participantIds.length) {
          const rows = participantIds.map((id) => ({
            feedback_id: feedbackId,
            clinic_user_id: id,
          }));
          const { error } = await supabase.from('hr_feedback_participants').insert(rows);
          if (error) throw error;
        }
      }

      setShowModal(false);
      setEditingId(null);
      setForm({
        subjectId: '',
        departmentId: '',
        leaderId: '',
        type: '',
        feedbackDate: '',
        scorePersonal: '',
        scoreManagement: '',
        result: '',
        description: '',
        participants: [],
      });
      loadFeedbacks();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-600 font-semibold">Recursos Humanos</p>
          <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
          <p className="text-sm text-gray-500">Registre avaliações individuais e planos de ação.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 flex items-center gap-2"
        >
          <Plus size={16} /> Novo feedback
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
            <select
              value={filters.departmentId}
              onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[180px] w-full sm:w-auto"
            >
            <option value="">Departamento</option>
            {departmentOptions.map((dep: any) => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
              </option>
            ))}
          </select>
            <select
              value={filters.leaderId}
              onChange={(e) => setFilters((prev) => ({ ...prev, leaderId: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[180px] w-full sm:w-auto"
            >
            <option value="">Líder</option>
            {clinicUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
            <select
              value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[180px] w-full sm:w-auto"
            >
            <option value="">Tipo de feedback</option>
            {FEEDBACK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.dateStart}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateStart: e.target.value }))}
                className="px-2 py-1 border border-gray-200 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-400">até</span>
              <input
                type="date"
                value={filters.dateEnd}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateEnd: e.target.value }))}
                className="px-2 py-1 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar por colaboradores"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportFeedbacks('pdf')}
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
            >
              <Download size={14} /> PDF
            </button>
            <button
              type="button"
              onClick={() => exportFeedbacks('csv')}
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
            >
              <Download size={14} /> CSV
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400">Somente as pessoas registradas podem visualizar o feedback.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm font-semibold text-gray-800">Histórico de feedbacks</p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users size={16} />
            {filteredFeedbacks.length} registros
          </div>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Carregando feedbacks...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden md:block">
              <div className="flex flex-wrap items-center gap-4 min-w-0">
                <div className="w-10">#</div>
                <div className="min-w-[200px] max-w-[240px] truncate">Colaborador</div>
                <div className="min-w-[160px] max-w-[200px] truncate">Data</div>
                <div className="min-w-[160px] max-w-[200px] truncate">Tipo</div>
                <div className="min-w-[160px] max-w-[220px] truncate">Resultado</div>
                <div className="min-w-[80px] text-center">Nota</div>
                <div className="ml-auto">Ações</div>
              </div>
            </div>
            {filteredFeedbacks.map((fb: any, idx: number) => (
              <div key={fb.id} className="px-4 sm:px-6 py-4 flex flex-col md:flex-row md:flex-wrap md:items-center gap-4 hover:bg-gray-50 min-w-0">
                <div className="w-10 text-sm text-gray-400">#{String(idx + 1).padStart(2, '0')}</div>
                <div className="flex items-center gap-3 md:min-w-[200px] md:max-w-[240px] min-w-0">
                  {fb.subject?.avatar_url ? (
                    <img src={fb.subject.avatar_url} alt={fb.subject.name} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-semibold">
                      {getInitials(fb.subject?.name || fb.subject?.email || 'CL')}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{fb.subject?.name || fb.subject?.email}</p>
                    <p className="text-xs text-gray-500 truncate">{fb.department?.name || 'Sem departamento'}</p>
                  </div>
                </div>
                <div className="md:min-w-[160px] md:max-w-[200px] min-w-0 text-sm text-gray-700 truncate">{formatDate(fb.feedback_date)}</div>
                <div className="md:min-w-[160px] md:max-w-[200px] min-w-0 text-sm text-gray-700 truncate">{fb.feedback_type || 'Não informado'}</div>
                <div className="md:min-w-[160px] md:max-w-[220px] min-w-0 text-sm text-gray-500 truncate">{fb.result || 'Não informado'}</div>
                <div className="md:min-w-[80px] flex justify-start md:justify-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${scoreBubbleClass(fb.score_management ?? fb.score_personal)}`}>
                    {fb.score_management ?? fb.score_personal ?? '--'}
                  </span>
                </div>
                <div className="md:ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailFeedback(fb)}
                    className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center"
                    aria-label="Ver"
                    title="Ver"
                  >
                    <Eye size={16} />
                  </button>
                  {canManage(fb) && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(fb)}
                        className="w-9 h-9 rounded-full border border-brand-100 text-brand-600 hover:border-brand-200 flex items-center justify-center"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Excluir feedback?')) return;
                          const { error } = await supabase.from('hr_feedbacks').delete().eq('id', fb.id);
                          if (!error) loadFeedbacks();
                        }}
                        className="w-9 h-9 rounded-full border border-rose-100 text-rose-600 hover:border-rose-200 flex items-center justify-center"
                        aria-label="Apagar"
                        title="Apagar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredFeedbacks.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-gray-400">Nenhum feedback encontrado.</div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
          onClick={formModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Editar feedback' : 'Novo feedback'}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quem recebe o feedback?</label>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm((prev) => ({ ...prev, subjectId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Selecione o colaborador</option>
                  {clinicUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm((prev) => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Selecione</option>
                    {departmentOptions.map((dep: any) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as FeedbackType }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Selecione</option>
                    {FEEDBACK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Líder</label>
                  <select
                    value={form.leaderId}
                    onChange={(e) => setForm((prev) => ({ ...prev, leaderId: e.target.value }))}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={form.feedbackDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, feedbackDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nota pessoal</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={form.scorePersonal}
                    onChange={(e) => setForm((prev) => ({ ...prev, scorePersonal: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nota da gestão</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={form.scoreManagement}
                    onChange={(e) => setForm((prev) => ({ ...prev, scoreManagement: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resultado</label>
                <input
                  value={form.result}
                  onChange={(e) => setForm((prev) => ({ ...prev, result: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Não informado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do feedback/Plano de ação</label>
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
                  placeholder="Descreva o feedback e o plano de ação"
                  minHeight={140}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participantes</label>
                <MultiSelect
                  options={participantOptions}
                  value={form.participants}
                  onChange={(next) => setForm((prev) => ({ ...prev, participants: next }))}
                  placeholder="Selecione os participantes"
                />
                <p className="text-xs text-gray-400 mt-2">Somente participantes poderão visualizar o feedback.</p>
              </div>
              {formError && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">{formError}</div>}
              <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? 'Editar feedback' : 'Criar feedback'}
              </button>
            </form>
          </div>
        </div>
      )}

      {detailFeedback && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
          onClick={detailModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">Feedback</p>
                <h3 className="text-xl font-semibold text-gray-900">{detailFeedback.subject?.name || 'Colaborador'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailFeedback(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Departamento</p>
                <p className="text-sm font-semibold text-gray-900">{detailFeedback.department?.name || 'Não informado'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Tipo</p>
                <p className="text-sm font-semibold text-gray-900">{detailFeedback.feedback_type || 'Não informado'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Data</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(detailFeedback.feedback_date)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Nota pessoal</p>
                <p className="text-sm font-semibold text-gray-900">{detailFeedback.score_personal ?? '--'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Nota da gestão</p>
                <p className="text-sm font-semibold text-gray-900">{detailFeedback.score_management ?? '--'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="text-xs text-gray-500 mb-2">Descrição / Plano de ação</p>
              {detailFeedback.description ? (
                <div
                  className="text-sm text-gray-700 rte-content"
                  dangerouslySetInnerHTML={{ __html: detailFeedback.description }}
                />
              ) : (
                <p className="text-sm text-gray-700">Sem descrição.</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="text-xs text-gray-500 mb-2">Participantes</p>
              <div className="flex flex-wrap gap-2">
                {(detailFeedback.participants || []).map((p: any) => (
                  <span key={p.clinic_user_id} className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                    {p.clinic_users?.name || p.clinic_users?.email || 'Participante'}
                  </span>
                ))}
                {(detailFeedback.participants || []).length === 0 && (
                  <span className="text-xs text-gray-400">Nenhum participante informado.</span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailFeedback(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
              >
                Fechar
              </button>
              {canManage(detailFeedback) && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailFeedback(null);
                    openEditModal(detailFeedback);
                  }}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg"
                >
                  Editar feedback
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRFeedback;
