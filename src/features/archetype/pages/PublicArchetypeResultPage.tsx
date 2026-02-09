import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import ResultChart from '../components/ResultChart';
import type { ArchetypeResult } from '../types';

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

const PublicArchetypeResultPage: React.FC = () => {
  const { publicToken } = useParams();
  const location = useLocation();
  const [result, setResult] = useState<ArchetypeResult | null>(null);

  useEffect(() => {
    const stateResult = (location.state as any)?.result as ArchetypeResult | undefined;
    if (stateResult) {
      setResult(stateResult);
      return;
    }
    if (!publicToken) return;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(`archetypeResult:${publicToken}`) : null;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setResult(parsed);
    } catch {
      // ignore
    }
  }, [location.state, publicToken]);

  const summaryText = useMemo(() => {
    if (!result) return '';
    if (result.topProfile === 'EMPATE') return PROFILE_TEXT.EMPATE;
    return PROFILE_TEXT[result.topProfile] || '';
  }, [result]);

  const ranking = useMemo(() => {
    if (!result) return null;
    const entries = Object.entries(result.scores).map(([key, value]) => ({
      key,
      label: PROFILE_LABELS[key] || key,
      score: value,
      percentage: result.percentages?.[key as keyof typeof result.percentages] ?? 0,
    }));
    const sorted = entries.sort((a, b) => b.score - a.score);
    const topScore = sorted[0]?.score ?? 0;
    const topProfiles = sorted.filter((item) => item.score === topScore);
    const secondScore = sorted.find((item) => item.score < topScore)?.score ?? null;
    const secondProfiles = secondScore === null ? [] : sorted.filter((item) => item.score === secondScore);
    return { sorted, topProfiles, secondProfiles };
  }, [result]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-gray-800">Resultado indisponível</h1>
          <p className="text-sm text-gray-500">Volte ao link do teste para gerar o resultado.</p>
          {publicToken && (
            <Link
              to={`/public/perfil/${publicToken}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm"
            >
              Refazer teste
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <header className="space-y-3 text-center">
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold uppercase tracking-wide">
            Resultado do teste
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">Seu resultado</h1>
          <p className="text-gray-500">Veja quais perfis se destacaram para você.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Perfil predominante</p>
              {result.topProfile === 'EMPATE' ? (
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">Empate técnico</h2>
                  <p className="text-sm text-gray-500">
                    {result.topProfiles.map((profile) => PROFILE_LABELS[profile] || profile).join(', ')}
                  </p>
                </div>
              ) : (
                <h2 className="text-2xl font-semibold text-gray-800">{PROFILE_LABELS[result.topProfile] || result.topProfile}</h2>
              )}
              <p className="text-sm text-gray-500 max-w-lg">{summaryText}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-brand-50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-brand-600">1º perfil</p>
                <p className="text-lg font-semibold text-gray-800">
                  {ranking?.topProfiles.length === 1
                    ? ranking.topProfiles[0].label
                    : 'Empate'}
                </p>
                {ranking?.topProfiles.length === 1 ? (
                  <>
                    <p className="text-xs text-gray-500">{ranking.topProfiles[0].percentage.toFixed(0)}% das respostas</p>
                    <p className="text-xs text-gray-600 mt-2">{PROFILE_TEXT[ranking.topProfiles[0].key] || ''}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    {ranking?.topProfiles.map((item) => item.label).join(', ')}
                  </p>
                )}
              </div>
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">2º perfil</p>
                {ranking?.secondProfiles.length ? (
                  <>
                    <p className="text-lg font-semibold text-gray-800">
                      {ranking.secondProfiles.length === 1 ? ranking.secondProfiles[0].label : 'Empate'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {ranking.secondProfiles.length === 1
                        ? `${ranking.secondProfiles[0].percentage.toFixed(0)}% das respostas`
                        : ranking.secondProfiles.map((item) => item.label).join(', ')}
                    </p>
                    {ranking.secondProfiles.length === 1 && (
                      <p className="text-xs text-gray-600 mt-2">{PROFILE_TEXT[ranking.secondProfiles[0].key] || ''}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Sem segundo perfil destacado.</p>
                )}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <ResultChart scores={result.scores} />
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pontuação detalhada</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              {Object.entries(result.percentages).map(([profile, value]) => (
                <div key={profile} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{PROFILE_LABELS[profile] || profile}</p>
                  <p className="text-lg font-semibold text-gray-800">{value.toFixed(0)}%</p>
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-500">
              Use este resultado como referência para entender seus pontos fortes e como se comunica em equipe.
            </div>
          </div>
        </div>

        {publicToken && (
          <Link
            to={`/public/perfil/${publicToken}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-200 text-gray-600"
          >
            Refazer teste
          </Link>
        )}
      </div>
    </div>
  );
};

export default PublicArchetypeResultPage;
