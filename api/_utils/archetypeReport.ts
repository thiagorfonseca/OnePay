type RespondentLike = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  scores?: Record<string, number>;
  top_profile?: string | null;
  top_profiles?: string[] | null;
};

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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const safeLabel = (value: string) => PROFILE_LABELS[value] || value;

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const normalizeScores = (raw: unknown): Record<string, number> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return normalizeScores(parsed);
    } catch {
      return {};
    }
  }
  if (typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
    key,
    typeof value === 'string' ? Number(value) : Number(value || 0),
  ]);
  return Object.fromEntries(entries);
};

export const buildArchetypeSummary = (respondent: RespondentLike) => {
  const scores = normalizeScores(respondent?.scores);
  const entries = Object.entries(scores).map(([key, value]) => ({
    key,
    label: safeLabel(key),
    score: Number(value || 0),
  }));
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

  const topProfileKey = respondent?.top_profile || profile1?.key || '';
  const topLabel = topProfileKey === 'EMPATE' ? 'Empate técnico' : safeLabel(topProfileKey) || '-';
  const summaryText = topProfileKey === 'EMPATE' ? PROFILE_TEXT.EMPATE : PROFILE_TEXT[topProfileKey] || '';
  const topProfilesList =
    topProfileKey === 'EMPATE' && respondent?.top_profiles?.length
      ? respondent.top_profiles.map((profile) => safeLabel(profile)).join(', ')
      : topLabel;

  return {
    entries,
    totalScore,
    profile1,
    profile2,
    profile1Percent,
    profile2Percent,
    topLabel,
    summaryText,
    topProfilesList,
  };
};

export const buildArchetypeResultHtml = (respondent: RespondentLike) => {
  const summary = buildArchetypeSummary(respondent);
  const name = respondent?.name || '-';
  const email = respondent?.email || '-';
  const phone = respondent?.phone || '-';
  const createdAt = formatDate(respondent?.created_at);

  const scoreLines = summary.entries
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((item) => {
      const percent = Math.round((item.score / summary.totalScore) * 100);
      return `<p>${escapeHtml(item.label)}: ${percent}%</p>`;
    })
    .join('');

  const profile1Label = summary.profile1 ? summary.profile1.label : 'Não informado';
  const profile2Label = summary.profile2 ? summary.profile2.label : 'Não informado';
  const profile1Text = summary.profile1 ? PROFILE_TEXT[summary.profile1.key] || '' : '';
  const profile2Text = summary.profile2 ? PROFILE_TEXT[summary.profile2.key] || '' : '';

  return `
    <h2>Resultado do Teste de Perfil</h2>
    <p><strong>Respondente:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>WhatsApp:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Data:</strong> ${escapeHtml(createdAt)}</p>
    <h3>Resumo</h3>
    <p><strong>Perfil vencedor:</strong> ${escapeHtml(summary.topLabel)}</p>
    <p>${escapeHtml(summary.summaryText || '')}</p>
    <p><strong>Perfis em destaque:</strong> ${escapeHtml(summary.topProfilesList)}</p>
    <h3>Perfis</h3>
    <p><strong>Perfil 1:</strong> ${escapeHtml(profile1Label)}${summary.profile1Percent !== null ? ` • ${summary.profile1Percent}%` : ''}</p>
    <p>${escapeHtml(profile1Text)}</p>
    <p><strong>Perfil 2:</strong> ${escapeHtml(profile2Label)}${summary.profile2Percent !== null ? ` • ${summary.profile2Percent}%` : ''}</p>
    <p>${escapeHtml(profile2Text)}</p>
    <h3>Pontuação</h3>
    ${scoreLines || '<p>Sem pontuação registrada.</p>'}
  `;
};

export const buildArchetypeEmailHtml = (respondent: RespondentLike) => {
  const summary = buildArchetypeSummary(respondent);
  const name = respondent?.name || 'respondente';
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Resultado do Teste de Perfil</h2>
      <p>Olá ${escapeHtml(name)}! Segue em anexo o seu resultado.</p>
      <p><strong>Perfil vencedor:</strong> ${escapeHtml(summary.topLabel)}</p>
      <p>${escapeHtml(summary.summaryText || '')}</p>
      <p><strong>Perfis em destaque:</strong> ${escapeHtml(summary.topProfilesList)}</p>
    </div>
  `;
};
