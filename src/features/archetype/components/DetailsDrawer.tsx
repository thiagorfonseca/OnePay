import React from 'react';
import { X } from 'lucide-react';
import ResultChart from './ResultChart';
import type { ArchetypeRespondentRow } from '../types';
import { useModalControls } from '../../../../hooks/useModalControls';
import { supabase } from '../../../../lib/supabase';

const PROFILE_TEXT: Record<string, string> = {
  FACILITADOR: 'Você valoriza harmonia, colaboração e equilíbrio nas relações.',
  ANALISTA: 'Você é detalhista, analítico e gosta de decisões bem fundamentadas.',
  REALIZADOR: 'Você é orientado a resultados, pragmático e gosta de desafios.',
  VISIONÁRIO: 'Você é criativo, comunicativo e busca inspirar pessoas ao redor.',
  EMPATE: 'Seus resultados ficaram equilibrados entre mais de um perfil.',
};

const PROFILE_LABELS: Record<string, string> = {
  FACILITADOR: 'Facilitador',
  ANALISTA: 'Analista',
  REALIZADOR: 'Realizador',
  VISIONÁRIO: 'Visionário',
};

interface DetailsDrawerProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  respondent: ArchetypeRespondentRow | null;
}

const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ open, loading, onClose, respondent }) => {
  useModalControls({ isOpen: open, onClose });

  if (!open) return null;

  const scores = respondent?.scores || null;
  const entries = scores
    ? Object.entries(scores).map(([key, value]) => ({
      key,
      label: PROFILE_LABELS[key] || key,
      score: Number(value || 0),
    }))
    : [];
  const totalScore = entries.reduce((acc, item) => acc + item.score, 0) || 1;
  const sorted = entries.slice().sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const topProfiles = sorted.filter((item) => item.score === topScore);
  const secondScore = sorted.find((item) => item.score < topScore)?.score ?? null;
  const secondProfiles = secondScore === null ? [] : sorted.filter((item) => item.score === secondScore);
  const profile1 = topProfiles[0] || null;
  const profile2 = topProfiles[1] || secondProfiles[0] || null;
  const profile1Percent = profile1 ? Math.round((profile1.score / totalScore) * 100) : null;
  const profile2Percent = profile2 ? Math.round((profile2.score / totalScore) * 100) : null;
  const winnerLabel =
    respondent?.top_profile === 'EMPATE'
      ? 'Empate técnico'
      : PROFILE_LABELS[respondent?.top_profile || ''] || respondent?.top_profile || '-';

  const handleDownloadPdf = async () => {
    if (!respondent) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      alert('Sessão inválida.');
      return;
    }
    const response = await fetch(`/api/internal/archetype-result-pdf?respondentId=${respondent.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      alert(body?.error || 'Não foi possível gerar o PDF.');
      return;
    }
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resultado-perfil-${respondent.name || 'respondente'}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleResendPdf = async () => {
    if (!respondent) return;
    if (!respondent.email) {
      alert('Respondente sem e-mail cadastrado.');
      return;
    }
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      alert('Sessão inválida.');
      return;
    }
    if (!confirm(`Reenviar resultado para ${respondent.email}?`)) return;
    const response = await fetch('/api/internal/send-archetype-result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ respondentId: respondent.id, to: respondent.email }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      alert(body?.error || 'Não foi possível reenviar o resultado.');
      return;
    }
    alert('Resultado reenviado com sucesso.');
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-xl p-6 overflow-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
        >
          <X size={18} />
        </button>
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Detalhes do respondente</h3>
            <p className="text-sm text-gray-500">Resultados individuais do teste.</p>
          </div>
          {loading && <p className="text-sm text-gray-500">Carregando detalhes...</p>}
          {!loading && respondent && (
            <>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Nome</p>
                  <p className="text-sm font-medium text-gray-800">{respondent.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm text-gray-700">{respondent.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">WhatsApp</p>
                  <p className="text-sm text-gray-700">{respondent.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Perfil vencedor</p>
                  <p className="text-sm font-semibold text-gray-800">{winnerLabel}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResendPdf}
                  disabled={!respondent.email}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Reenviar arquivo
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700"
                >
                  Baixar em PDF
                </button>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 bg-gray-50 rounded-lg border border-gray-100 p-3">
                    <p className="text-xs text-gray-400">Perfil 1</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {profile1 ? profile1.label : 'Não informado'}
                      {profile1Percent !== null ? ` • ${profile1Percent}%` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {profile1 ? PROFILE_TEXT[profile1.key] || '' : ''}
                    </p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg border border-gray-100 p-3">
                    <p className="text-xs text-gray-400">Perfil 2</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {profile2 ? profile2.label : 'Não informado'}
                      {profile2Percent !== null ? ` • ${profile2Percent}%` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {profile2 ? PROFILE_TEXT[profile2.key] || '' : ''}
                    </p>
                  </div>
                </div>
                {respondent.top_profile === 'EMPATE' && respondent.top_profiles?.length ? (
                  <p className="text-xs text-amber-600">
                    Empate entre: {respondent.top_profiles.map((p) => PROFILE_LABELS[p] || p).join(', ')}.
                  </p>
                ) : null}
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <ResultChart scores={respondent.scores} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailsDrawer;
