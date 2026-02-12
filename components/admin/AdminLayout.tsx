import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Shield,
  Building2,
  Users,
  LayoutDashboard,
  LogOut,
  Menu,
  BookOpen,
  Package,
  User,
  Calendar,
  FileText,
  ClipboardList,
  Briefcase,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../src/auth/AuthProvider';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({ Comercial: true });
  const { hasAdminPageAccess } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Clínicas', href: '/admin/clinics', icon: Building2 },
    { name: 'Usuários', href: '/admin/users', icon: Users },
    { name: 'Equipe', href: '/admin/team', icon: Users },
    { name: 'Agenda', href: '/admin/agenda', icon: Calendar, highlight: true },
    { name: 'Pacotes', href: '/admin/packages', icon: Package },
    { name: 'Conteúdos', href: '/admin/content', icon: BookOpen },
    {
      name: 'Comercial',
      icon: Briefcase,
      children: [
        { name: 'Clientes', href: '/admin/clientes', icon: Users },
        { name: 'Contratos', href: '/admin/contratos', icon: FileText },
        { name: 'Propostas', href: '/admin/propostas', icon: ClipboardList },
      ],
    },
    { name: 'Perfil', href: '/admin/profile', icon: User },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);
  const visibleNavigation = navigation
    .map((item: any) => {
      if (!item.children) return item;
      const children = item.children.filter((child: any) => hasAdminPageAccess(child.href));
      return { ...item, children };
    })
    .filter((item: any) => {
      if (!item.children) return hasAdminPageAccess(item.href);
      return item.children.length > 0;
    });

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="admin-sidebar"
      >
        <Menu size={24} />
      </button>

      <aside
        id="admin-sidebar"
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:block
        `}
        aria-hidden={!isMobileMenuOpen && typeof window !== 'undefined' && window.innerWidth < 1024}
      >
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center px-4 border-b border-gray-100">
            <div className="flex items-center gap-2 text-brand-600 font-bold text-xl">
              <Shield size={20} />
              Admin
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {visibleNavigation.map((item: any) => {
              if (item.children) {
                const isGroupOpen = openGroups[item.name] ?? false;
                const isChildActive = item.children.some((child: any) => isActive(child.href));
                return (
                  <div key={item.name} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.name)}
                      className={`
                        w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors
                        ${isChildActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      `}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon size={18} />
                        {item.name}
                      </span>
                      {isGroupOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {isGroupOpen ? (
                      <div className="pl-6 space-y-1">
                        {item.children.map((child: any) => (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={`
                              flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors
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
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors
                    ${item.highlight
                      ? (isActive(item.href)
                        ? 'bg-amber-700 text-white'
                        : 'bg-amber-600 text-white hover:bg-amber-700')
                      : (isActive(item.href)
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}
                  `}
                >
                  <item.icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto lg:ml-64">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:hidden">
          <div className="w-8"></div>
          <span className="font-semibold text-gray-700">Admin</span>
        </header>
        <div className="pt-20 lg:pt-6 pb-4 md:pb-8 px-4 md:px-6 max-w-screen-2xl mx-auto space-y-3">
          <Outlet />
        </div>
      </main>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default AdminLayout;
