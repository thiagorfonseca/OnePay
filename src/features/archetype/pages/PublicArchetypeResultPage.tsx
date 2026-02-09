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

  const downloadPdf = () => {
    if (!result) return;
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const logoUrl = `${window.location.origin}/logo-onefinc.png`;
    const now = new Date();
    const dateLabel = now.toLocaleDateString('pt-BR');
    const topProfileLabel =
      result.topProfile === 'EMPATE'
        ? 'Empate técnico'
        : PROFILE_LABELS[result.topProfile] || result.topProfile;
    const topProfilesList =
      result.topProfile === 'EMPATE' && result.topProfiles.length
        ? result.topProfiles.map((profile) => PROFILE_LABELS[profile] || profile).join(', ')
        : topProfileLabel;

    const sortedScores = Object.entries(result.percentages)
      .map(([profile, value]) => ({
        profile,
        label: PROFILE_LABELS[profile] || profile,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const rowsHtml = sortedScores
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.label)}</td>
            <td>${item.value.toFixed(0)}%</td>
          </tr>
        `
      )
      .join('');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Resultado do Teste de Perfil</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              color: #111827;
              padding: 32px;
            }
            .header {
              display: flex;
              align-items: center;
              gap: 16px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .logo {
              width: 56px;
              height: 56px;
              object-fit: contain;
            }
            .brand h1 {
              margin: 0;
              font-size: 22px;
            }
            .brand p {
              margin: 4px 0 0;
              color: #6b7280;
              font-size: 12px;
            }
            h2 {
              margin: 0 0 8px;
              font-size: 20px;
            }
            .section {
              margin-bottom: 20px;
            }
            .tag {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 999px;
              background: #eef2ff;
              color: #4338ca;
              font-size: 11px;
              font-weight: 600;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              margin-bottom: 10px;
            }
            .summary {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 16px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 8px;
              text-align: left;
            }
            th {
              background: #f3f4f6;
              font-weight: 600;
            }
            .footer {
              margin-top: 32px;
              font-size: 11px;
              color: #9ca3af;
              border-top: 1px solid #e5e7eb;
              padding-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" alt="OneFinc" class="logo" />
            <div class="brand">
              <h1>OneFinc</h1>
              <p>Resultado do Teste de Perfil</p>
            </div>
          </div>

          <div class="section">
            <span class="tag">Resumo</span>
            <div class="summary">
              <h2>${escapeHtml(topProfileLabel)}</h2>
              <p>${escapeHtml(summaryText || '')}</p>
              <p><strong>Perfis em destaque:</strong> ${escapeHtml(topProfilesList)}</p>
            </div>
          </div>

          <div class="section">
            <span class="tag">Pontuação</span>
            <table>
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>Percentual</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Relatório gerado em ${escapeHtml(dateLabel)}.
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

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
          <button
            type="button"
            onClick={downloadPdf}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-200 text-gray-600"
          >
            Baixar PDF
          </button>
        )}
      </div>
    </div>
  );
};

export default PublicArchetypeResultPage;
