import React, { useEffect, useMemo, useState } from 'react';
import { Download, Maximize2, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '../../../auth/AuthProvider';
import { fetchRespondentDetail, fetchRespondents, listPublicLinks } from '../archetypeService';
import type { ArchetypeRespondentRow, PublicLinkRow } from '../types';
import FiltersBar, { ArchetypeFilters } from '../components/FiltersBar';
import RespondentsTable from '../components/RespondentsTable';
import DetailsDrawer from '../components/DetailsDrawer';
import { useModalControls } from '../../../../hooks/useModalControls';

const toCsvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const PieTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = item?.name || item?.payload?.name;
  const value = item?.value ?? 0;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm text-xs">
      <div className="font-semibold text-gray-700">{name}</div>
      <div className="text-gray-500">{value} respostas</div>
    </div>
  );
};

const AnalyticsArchetypePage: React.FC = () => {
  const { effectiveClinicId: clinicId, isSystemAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ArchetypeRespondentRow[]>([]);
  const [links, setLinks] = useState<PublicLinkRow[]>([]);
  const [filters, setFilters] = useState<ArchetypeFilters>({
    dateFrom: '',
    dateTo: '',
    topProfile: '',
    audienceType: '',
    search: '',
    token: '',
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRespondent, setDetailRespondent] = useState<ArchetypeRespondentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPieExpanded, setIsPieExpanded] = useState(false);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const pieModalControls = useModalControls({
    isOpen: isPieExpanded,
    onClose: () => setIsPieExpanded(false),
  });

  const barModalControls = useModalControls({
    isOpen: isBarExpanded,
    onClose: () => setIsBarExpanded(false),
  });

  const reportModalControls = useModalControls({
    isOpen: isReportOpen,
    onClose: () => setIsReportOpen(false),
  });

  useEffect(() => {
    if (!clinicId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [respondents, publicLinks] = await Promise.all([
          fetchRespondents({ clinicId }),
          listPublicLinks(clinicId),
        ]);
        if (!active) return;
        setRows(respondents);
        setLinks(publicLinks);
      } catch (err) {
        console.error(err);
        if (active) setError('Não foi possível carregar os dados de analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [clinicId]);

  const filteredRows = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;

    return rows.filter((row) => {
      const created = new Date(row.created_at);
      if (fromDate && created < fromDate) return false;
      if (toDate && created > toDate) return false;
      if (filters.topProfile && row.top_profile !== filters.topProfile) return false;
      if (filters.audienceType && row.audience_type !== filters.audienceType) return false;
      if (filters.token && row.public_token !== filters.token) return false;
      if (term) {
        const haystack = `${row.name} ${row.email || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const metrics = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let last7 = 0;
    let last30 = 0;

    filteredRows.forEach((row) => {
      const created = new Date(row.created_at);
      if (created >= sevenDaysAgo) last7 += 1;
      if (created >= thirtyDaysAgo) last30 += 1;
    });

    return {
      total: filteredRows.length,
      last7,
      last30,
    };
  }, [filteredRows]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {
      FACILITADOR: 0,
      ANALISTA: 0,
      REALIZADOR: 0,
      VISIONÁRIO: 0,
      EMPATE: 0,
    };
    filteredRows.forEach((row) => {
      counts[row.top_profile] = (counts[row.top_profile] || 0) + 1;
    });
    return [
      { name: 'Facilitador', value: counts.FACILITADOR, color: '#22c55e' },
      { name: 'Analista', value: counts.ANALISTA, color: '#0ea5e9' },
      { name: 'Realizador', value: counts.REALIZADOR, color: '#f97316' },
      { name: 'Visionário', value: counts.VISIONÁRIO, color: '#a855f7' },
      { name: 'Empate', value: counts.EMPATE, color: '#94a3b8' },
    ];
  }, [filteredRows]);

  const averageScores = useMemo(() => {
    const totals = {
      FACILITADOR: 0,
      ANALISTA: 0,
      REALIZADOR: 0,
      VISIONÁRIO: 0,
    };
    filteredRows.forEach((row) => {
      totals.FACILITADOR += row.scores?.FACILITADOR ?? 0;
      totals.ANALISTA += row.scores?.ANALISTA ?? 0;
      totals.REALIZADOR += row.scores?.REALIZADOR ?? 0;
      totals.VISIONÁRIO += row.scores?.VISIONÁRIO ?? 0;
    });
    const divisor = filteredRows.length || 1;
    return [
      { name: 'Facilitador', value: totals.FACILITADOR / divisor, color: '#22c55e' },
      { name: 'Analista', value: totals.ANALISTA / divisor, color: '#0ea5e9' },
      { name: 'Realizador', value: totals.REALIZADOR / divisor, color: '#f97316' },
      { name: 'Visionário', value: totals.VISIONÁRIO / divisor, color: '#a855f7' },
    ];
  }, [filteredRows]);

  const handleExportCsv = () => {
    const header = [
      'Data',
      'Nome',
      'Email',
      'WhatsApp',
      'Audiência',
      'Perfil vencedor',
      'Facilitador',
      'Analista',
      'Realizador',
      'Visionário',
      'Token',
    ];
    const body = filteredRows.map((row) => [
      toCsvCell(row.created_at),
      toCsvCell(row.name),
      toCsvCell(row.email || ''),
      toCsvCell(row.phone || ''),
      toCsvCell(row.audience_type),
      toCsvCell(row.top_profile),
      toCsvCell(row.scores?.FACILITADOR ?? 0),
      toCsvCell(row.scores?.ANALISTA ?? 0),
      toCsvCell(row.scores?.REALIZADOR ?? 0),
      toCsvCell(row.scores?.VISIONÁRIO ?? 0),
      toCsvCell(row.public_token),
    ].join(','));
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'perfil-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openDetails = async (row: ArchetypeRespondentRow) => {
    if (!clinicId) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRespondent(row);
    try {
      const detail = await fetchRespondentDetail(row.id, clinicId);
      if (!detail) return;
      setDetailRespondent(detail as ArchetypeRespondentRow);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os detalhes do respondente.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Carregando analytics...</div>;
  }

  if (!clinicId) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-500">Selecione uma clínica para visualizar os dados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isSystemAdmin && (
        <p className="text-xs text-gray-400">Visualizando dados da clínica selecionada.</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400">Total de respostas</p>
          <p className="text-2xl font-semibold text-gray-800">{metrics.total}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400">Últimos 7 dias</p>
          <p className="text-2xl font-semibold text-gray-800">{metrics.last7}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400">Últimos 30 dias</p>
          <p className="text-2xl font-semibold text-gray-800">{metrics.last30}</p>
        </div>
      </div>
      <p className="text-xs text-gray-400">Indicadores e gráficos consideram os filtros aplicados.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Perfil predominante na clinica</h3>
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="mt-3 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
              >
                Ler relatório
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsPieExpanded(true)}
              className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center"
              aria-label="Expandir gráfico de perfil predominante"
              title="Expandir"
            >
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Média de pontuação por perfil</h3>
            <button
              type="button"
              onClick={() => setIsBarExpanded(true)}
              className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center"
              aria-label="Expandir gráfico de média por perfil"
              title="Expandir"
            >
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={averageScores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)} pontos`, 'Média']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {averageScores.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {isPieExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-6"
          onClick={pieModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Perfil predominante na clinica</h3>
              <button
                type="button"
                onClick={() => setIsPieExpanded(false)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                aria-label="Fechar gráfico"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={90} outerRadius={140} paddingAngle={3}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {isBarExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-6"
          onClick={barModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Média de pontuação por perfil</h3>
              <button
                type="button"
                onClick={() => setIsBarExpanded(false)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                aria-label="Fechar gráfico"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={averageScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)} pontos`, 'Média']} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {averageScores.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {isReportOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-6 flex items-center justify-center"
          onClick={reportModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Ler relatório</h3>
                <p className="text-sm text-gray-500">Entenda os padrões comportamentais e seus impactos.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                aria-label="Fechar relatório"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 text-sm text-gray-700">
              <p>
                Abaixo estão os 4 cruzamentos e como costumam aparecer no dia a dia — e como isso bate direto no
                resultado.
              </p>

              <div>
                <h4 className="text-base font-semibold text-gray-800">1) Clínica mais <strong>Realizadora + Visionária</strong></h4>
                <p className="mt-2"><strong>Como ela funciona:</strong> energia alta, foco em crescimento, metas agressivas, decide rápido e coloca pra rodar. É aquela clínica que fala “bora” antes de terminar a frase.</p>
                <p className="mt-3 font-semibold text-gray-800">Traços comportamentais na prática</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Lança serviços, campanhas e parcerias com facilidade</li>
                  <li>Cobra performance da equipe e acelera a agenda</li>
                  <li>Tem sede de expansão (unidade, sala nova, novos procedimentos, novos canais)</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">Impacto nos resultados (o lado bom)</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Cresce rápido, fatura forte, cria movimento e posicionamento</li>
                  <li>Tem mais facilidade em vender, negociar, elevar ticket e fazer a clínica “aparecer”</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">Riscos que sabotam o lucro</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Cresce “pra fora” antes de arrumar “pra dentro” (processo, qualidade, padrão)</li>
                  <li>Pode gerar <strong>retrabalho</strong>, <strong>equipe estressada</strong>, e <strong>experiência inconsistente</strong></li>
                  <li>Alta chance de virar clínica “dependente do dono”: tudo passa na cabeça do líder</li>
                </ul>
                <p className="mt-3"><strong>Sinal clássico:</strong> faturamento sobe… mas o caos sobe junto.</p>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-base font-semibold text-gray-800">2) Clínica mais <strong>Realizadora + Analista</strong></h4>
                <p className="mt-2"><strong>Como ela funciona:</strong> execução forte com régua alta. É a clínica que quer resultado, mas não “no chute”: quer número, controle e previsibilidade.</p>
                <p className="mt-3 font-semibold text-gray-800">Traços comportamentais na prática</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Metas e indicadores (conversão, taxa de retorno, ocupação, margem)</li>
                  <li>Processos mais claros e cobrança por padrão</li>
                  <li>A clínica tende a ser mais organizada em agenda, estoque, financeiro e gestão</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">Impacto nos resultados (o lado bom)</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Aumenta eficiência e margem, reduz desperdício e melhora previsibilidade</li>
                  <li>Crescimento mais sustentável (menos “pico” e “vale”)</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">Riscos que travam crescimento</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Pode ficar “perfeccionista demais” e demorar pra decidir</li>
                  <li>Pode virar uma clínica ótima… porém lenta pra inovar e testar novas oportunidades</li>
                  <li>A equipe pode sentir clima de cobrança/frieza se faltar lado humano</li>
                </ul>
                <p className="mt-3"><strong>Sinal clássico:</strong> a clínica roda bem, mas às vezes perde timing por excesso de cautela.</p>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-base font-semibold text-gray-800">3) Clínica mais <strong>Analista + Facilitadora</strong></h4>
                <p className="mt-2"><strong>Como ela funciona:</strong> cuidadosa, consistente, boa de processo e muito forte em experiência do paciente. É a clínica que quer “fazer direito” e com qualidade humana.</p>
                <p className="mt-3 font-semibold text-gray-800">Traços comportamentais na prática</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Atendimento e jornada bem estruturados</li>
                  <li>Treinamento, padronização e comunicação interna mais suaves</li>
                  <li>Decisões com mais prudência e menos impulso</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">Impacto nos resultados (o lado bom)</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Excelente retenção, reputação e indicação</li>
                  <li>Menos reclamação, mais fidelização, mais “clínica redonda”</li>
                  <li>Equipe tende a ter menos rotatividade, porque o clima é bom</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">Riscos que seguram faturamento</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Pode ter medo de “pegar pesado” em cobrança, preço e negociação</li>
                  <li>Pode evitar conflitos e manter gente fraca na equipe por tempo demais</li>
                  <li>Às vezes vira clínica “queridinha”… mas com lucro abaixo do potencial</li>
                </ul>
                <p className="mt-3"><strong>Sinal clássico:</strong> todo mundo ama a clínica, mas o caixa não acompanha o carinho.</p>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-base font-semibold text-gray-800">4) Clínica mais <strong>Facilitadora + Visionária</strong></h4>
                <p className="mt-2"><strong>Como ela funciona:</strong> carismática, criativa, muito forte em relacionamento e comunidade. É a clínica que cria conexão e engaja — equipe e pacientes compram a ideia.</p>
                <p className="mt-3 font-semibold text-gray-800">Traços comportamentais na prática</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Humanização forte, comunicação boa, clima leve</li>
                  <li>Inovação em experiência: novos formatos, eventos, conteúdo, comunidade</li>
                  <li>Boa para gerar demanda orgânica (indicação, redes sociais, relacionamento)</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">Impacto nos resultados (o lado bom)</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Marca forte, pacientes fiéis, time engajado</li>
                  <li>Cria diferenciação real e posicionamento com propósito</li>
                  <li>Excelente pra programas de recorrência quando bem estruturado</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">Riscos que viram “bonito por fora”</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Pode faltar disciplina de execução e controle (financeiro, agenda, DRE, processos)</li>
                  <li>Pode começar muita coisa e terminar pouca (síndrome do “projeto lindo”)</li>
                  <li>Se não tiver alguém puxando para métrica, vira clínica “movimentada” e pouco lucrativa</li>
                </ul>
                <p className="mt-3"><strong>Sinal clássico:</strong> tem amor, tem visão, tem paciente… mas falta motor e painel de controle.</p>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-base font-semibold text-gray-800">Fechando a conta (bem direto)</h4>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><strong>Realizadora + Visionária</strong> = crescimento rápido, risco de caos.</li>
                  <li><strong>Realizadora + Analista</strong> = performance com controle, risco de rigidez/lentidão.</li>
                  <li><strong>Analista + Facilitadora</strong> = excelência e retenção, risco de subprecificar e evitar confronto.</li>
                  <li><strong>Facilitadora + Visionária</strong> = marca e comunidade, risco de falta de processo e números.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <FiltersBar
        filters={filters}
        tokens={links.map((link) => link.token)}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{filteredRows.length} respondentes encontrados</p>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      <RespondentsTable rows={filteredRows} onOpenDetails={openDetails} />

      <DetailsDrawer
        open={detailOpen}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        respondent={detailRespondent}
      />
    </div>
  );
};

export default AnalyticsArchetypePage;
