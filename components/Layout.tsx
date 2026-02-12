import React from 'react';
import { LayoutDashboard, Wallet, TrendingUp, TrendingDown, FileText, Settings, LogOut, Menu, ChevronsLeft, ChevronsRight, BarChart2, Briefcase, ChevronDown, ChevronRight, Tag, User, CheckSquare, BookOpen, Users, MessageCircle, Calculator, Target, Calendar, ClipboardList, Boxes, Truck, AlertTriangle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ClinicSwitcher from './admin/ClinicSwitcher';
import { useAuth } from '../src/auth/AuthProvider';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { isSystemAdmin, isAdmin, hasPageAccess, clinic, user, profile, clinicUser, selectedClinicId, setSelectedClinicId } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = window.localStorage.getItem('sidebarExpandedSections');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') return {};
      const openEntry = Object.entries(parsed).find(([, value]) => value);
      return openEntry ? { [openEntry[0]]: true } : {};
    } catch {
      return {};
    }
  });

  const navigation = [
    {
      name: 'AGENDA',
      href: '/app/agenda',
      icon: Calendar,
      variant: 'highlight-amber',
    },
    {
      name: 'VENDAS',
      href: '/incomes?new=1',
      icon: TrendingUp,
      variant: 'highlight',
    },
    {
      name: 'Financeiro',
      href: '/',
      icon: Wallet,
      children: [
        { name: 'Dash Financeiro', href: '/', icon: LayoutDashboard },
        { name: 'Relatório de Atendimento', href: '/reports/attendance', icon: ClipboardList },
        { name: 'Receitas', href: '/incomes', icon: TrendingUp },
        { name: 'Despesas', href: '/expenses', icon: TrendingDown },
        { name: 'Análise de cartão', href: '/card-analysis', icon: BarChart2 },
        { name: 'Conciliação bancária', href: '/reconciliation', icon: FileText },
        { name: 'Contas bancárias', href: '/accounts', icon: Wallet },
      ],
    },
    {
      name: 'Comercial',
      href: '/commercial/dashboard',
      icon: Briefcase,
      children: [
        { name: 'Dash comercial', href: '/commercial/dashboard', icon: BarChart2 },
        { name: 'Ranking dos clientes', href: '/commercial/ranking', icon: FileText },
        { name: 'Recorrência', href: '/commercial/recurrence', icon: TrendingUp },
        { name: 'Geolocalização', href: '/commercial/geo', icon: FileText },
      ],
    },
    {
      name: 'Recursos Humanos',
      href: '/hr/feedback',
      icon: Users,
      children: [
        { name: 'Feedback', href: '/hr/feedback', icon: MessageCircle },
        { name: 'Reuniões', href: '/hr/meetings', icon: Calendar },
        { name: 'Arquétipos', href: '/hr/archetypes', icon: Target },
        { name: 'Teoria de valores', href: '/hr/values', icon: BookOpen },
      ],
    },
    {
      name: 'Precificação',
      href: '/pricing/calculator',
      icon: Calculator,
      children: [
        { name: 'Calculadora', href: '/pricing/calculator', icon: Calculator },
        { name: 'Procedimentos', href: '/pricing/procedures', icon: FileText },
        { name: 'Gastos', href: '/pricing/expenses', icon: Wallet },
        { name: 'Matriz de Foco', href: '/pricing/focus-matrix', icon: Target },
      ],
    },
    {
      name: 'Conteúdos',
      href: '/contents/courses',
      icon: BookOpen,
      children: [
        { name: 'Cursos', href: '/contents/courses', icon: FileText },
        { name: 'Treinamentos', href: '/contents/trainings', icon: TrendingUp },
      ],
    },
    {
      name: 'ASSISTENTE AI',
      href: '/assistant',
      icon: MessageCircle,
      variant: 'highlight',
    },
    {
      name: 'ESTOQUE',
      href: '/app/estoque',
      icon: Boxes,
      children: [
        { name: 'Dashboard', href: '/app/estoque', icon: LayoutDashboard },
        { name: 'Catálogo de Itens', href: '/app/estoque/itens', icon: Tag },
        { name: 'Fornecedores', href: '/app/estoque/fornecedores', icon: Truck },
        { name: 'Compras', href: '/app/estoque/compras', icon: FileText },
        { name: 'Estoque & Lotes', href: '/app/estoque/estoque', icon: Boxes },
        { name: 'Movimentações', href: '/app/estoque/movimentacoes', icon: ClipboardList },
        { name: 'Baixa Manual', href: '/app/estoque/baixa', icon: CheckSquare },
        { name: 'Contagem Cíclica', href: '/app/estoque/contagens', icon: ClipboardList },
        { name: 'Alertas', href: '/app/estoque/alertas', icon: AlertTriangle },
        { name: 'Insights IA', href: '/app/estoque/insights', icon: BarChart2 },
        { name: 'Receitas', href: '/app/estoque/receitas', icon: BookOpen },
      ],
    },
    {
      name: 'Minha Clínica',
      href: '/settings',
      icon: Settings,
      children: [
        { name: 'Informações gerais', href: '/settings?section=geral', icon: FileText },
        { name: 'Colaboradores', href: '/hr/collaborators', icon: Users },
        { name: 'Departamentos', href: '/hr/departments', icon: Tag },
        { name: 'Serviços e Produtos', href: '/pricing/procedures', icon: CheckSquare },
      ],
    },
    { name: 'Meu perfil', href: '/profile', icon: User },
  ];

  const isActive = (path: string) => {
    const current = `${location.pathname}${location.search}`;
    if (path.includes('?')) return current === path;
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  const formatDisplayName = (fullName: string) => {
    const cleaned = fullName.trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    const parts = cleaned.split(' ');
    if (parts.length === 1) return parts[0];
    if (parts.length === 2 && cleaned.length <= 20) return cleaned;
    const initials = parts
      .slice(1)
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .join('.');
    return initials ? `${parts[0]} ${initials}.` : parts[0];
  };

  const rawDisplayName =
    profile?.full_name?.trim() ||
    clinicUser?.name?.trim() ||
    (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '') ||
    (typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '') ||
    '';
  const displayName = formatDisplayName(rawDisplayName) || (user?.email ? user.email.split('@')[0] : '');
  const displayEmail = user?.email || clinicUser?.email || '';
  const displayClinic = clinic?.name?.trim() || '';
  const vendasReturnTo = `${location.pathname}${location.search}`;
  const vendasHref = `/incomes?new=1&return_to=${encodeURIComponent(vendasReturnTo)}`;

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const nextValue = !(prev[name] ?? false);
      const next = { [name]: nextValue };
      if (typeof window !== 'undefined') {
        const persisted = nextValue ? next : {};
        window.localStorage.setItem('sidebarExpandedSections', JSON.stringify(persisted));
      }
      return next;
    });
  };

  const filteredNavigation = React.useMemo(() => {
    return navigation
      .map((item) => {
        if (!item.children) return item;
        const visibleChildren = item.children.filter((child: any) => {
          if (child.adminOnly && !isAdmin) return false;
          return hasPageAccess(child.href);
        });
        return { ...item, children: visibleChildren };
      })
      .filter((item) => {
        if (!item.children) return hasPageAccess(item.href);
        return hasPageAccess(item.href) || item.children.length > 0;
      });
  }, [hasPageAccess, navigation]);

  const openParentForActive = React.useMemo(() => {
    const parents: Record<string, boolean> = {};
    filteredNavigation.forEach(item => {
      if (!item.children) return;
      // Abre se rota filha está ativa ou se o próprio pai é a rota atual (ex.: /settings)
      if (isActive(item.href) || item.children.some(child => isActive(child.href))) {
        parents[item.name] = true;
      }
    });
    return parents;
  }, [filteredNavigation, location.pathname]);

  const hasManualExpand = React.useMemo(() => Object.values(expanded).some(Boolean), [expanded]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Menu Button */}
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu size={24} />
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:block
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
      `}>
        <div className="h-full flex flex-col">
          <div className="sticky top-0 z-10 relative h-20 flex items-center px-6 border-b border-gray-100 bg-white">
            <Link
              to="/"
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-brand-600 font-bold text-xl"
              aria-label="Ir para a página inicial"
            >
              <img
                src="/onefinc_azul.png"
                alt="OneFinc"
                className={`object-contain ${isCollapsed ? 'w-7 h-7' : 'w-8 h-8'}`}
              />
              {!isCollapsed && 'OneFinc'}
            </Link>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:inline-flex absolute right-4 text-gray-400 hover:text-gray-600"
              aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
          </div>

          <nav className="flex-1 px-4 pt-8 pb-6 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isParentActive = openParentForActive[item.name];
              const isExpanded = hasManualExpand ? !!expanded[item.name] : (expanded[item.name] ?? isParentActive);
              const hasChildren = !!(item.children && item.children.length);
              const isConfig = item.name === 'Minha Clínica';
              const isFinanceiro = item.name === 'Financeiro';
              const isHighlight = item.variant === 'highlight' || item.variant === 'highlight-amber';
              const highlightTone = item.variant === 'highlight-amber' ? 'amber' : 'brand';
              const itemHref = item.name === 'VENDAS' ? vendasHref : item.href;
              const parentHref = hasPageAccess(item.href) ? item.href : (item.children?.[0]?.href || item.href);
              return (
                <div key={item.name}>
                  {hasChildren && (isConfig || isFinanceiro) ? (
                    <div className={`
                      flex items-center gap-3 ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium rounded-lg transition-colors
                      ${isActive(item.href) 
                        ? 'bg-brand-50 text-brand-700' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                    `}>
                      <Link
                        to={parentHref}
                        className={`flex items-center gap-3 ${isCollapsed ? 'justify-center w-full' : 'flex-1'}`}
                      >
                        <item.icon size={20} />
                        {!isCollapsed && <span>{item.name}</span>}
                      </Link>
                      {!isCollapsed && (
                        <button onClick={() => toggleExpand(item.name)} className="text-gray-500 hover:text-gray-700">
                          {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                        </button>
                      )}
                    </div>
                  ) : hasChildren ? (
                    <div
                      className={`
                        flex items-center gap-3 ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer
                        ${isActive(item.href) 
                          ? 'bg-brand-50 text-brand-700' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      `}
                      onClick={() => toggleExpand(item.name)}
                    >
                      <item.icon size={20} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1">{item.name}</span>
                          {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                        </>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={itemHref}
                      className={`
                        flex items-center gap-3 ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium rounded-lg transition-colors
                        ${isHighlight
                          ? (highlightTone === 'amber'
                            ? (isActive(item.href)
                              ? 'bg-amber-700 text-white'
                              : 'bg-amber-600 text-white hover:bg-amber-700')
                            : (isActive(item.href)
                              ? 'bg-brand-700 text-white'
                              : 'bg-brand-600 text-white hover:bg-brand-700'))
                          : (isActive(item.href)
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}
                        ${isHighlight ? 'shadow-sm' : ''}
                      `}
                    >
                      <item.icon size={20} />
                      {!isCollapsed && item.name}
                    </Link>
                  )}
                  {!isCollapsed && hasChildren && isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children!.map((child: any) => (
                        <Link
                          key={child.name}
                          to={child.href}
                          className={`
                            flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors
                            ${isActive(child.href)
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                          `}
                        >
                          <child.icon size={16} />
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100">
            {!isCollapsed && (displayName || displayEmail) && (
              <div className="mb-3 px-4 py-2 rounded-lg bg-gray-50">
                {displayName && (
                  <div className="text-sm font-medium text-gray-700 leading-tight">{displayName}</div>
                )}
                {displayEmail && (
                  <div className="text-xs text-gray-500 break-all leading-tight">{displayEmail}</div>
                )}
                {displayClinic && (
                  <div className="text-xs text-gray-500 leading-tight">Clínica: {displayClinic}</div>
                )}
              </div>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className={`w-full text-left flex items-center gap-3 ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors`}
            >
              <LogOut size={20} />
              {!isCollapsed && 'Sair'}
            </button>
            {!isCollapsed && (
              <div className="mt-4 px-4 text-xs text-gray-400 text-center">
                {clinic?.name || 'Clínica'}<br/>
                v1.0.0
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 lg:hidden">
          <div className="w-8"></div> {/* Spacer for menu button */}
          <span className="font-semibold text-gray-700">OneFinc</span>
        </header>
        <div className="py-4 md:py-8 px-4 md:px-6 max-w-screen-2xl mx-auto space-y-3">
          {isSystemAdmin && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <ClinicSwitcher />
              </div>
              {selectedClinicId && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                  <span>Você está acessando uma clínica selecionada.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClinicId(null);
                      navigate('/admin/clinics');
                    }}
                    className="px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Retornar Admin
                  </button>
                </div>
              )}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
