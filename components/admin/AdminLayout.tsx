import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Shield, Building2, Users, LayoutDashboard, LogOut, Menu, BookOpen, Package, User, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../src/auth/AuthProvider';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { hasAdminPageAccess } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Clínicas', href: '/admin/clinics', icon: Building2 },
    { name: 'Usuários', href: '/admin/users', icon: Users },
    { name: 'Equipe', href: '/admin/team', icon: Users },
    { name: 'Agenda', href: '/admin/agenda', icon: Calendar, highlight: true },
    { name: 'Pacotes', href: '/admin/packages', icon: Package },
    { name: 'Conteúdos', href: '/admin/content', icon: BookOpen },
    { name: 'Perfil', href: '/admin/profile', icon: User },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);
  const visibleNavigation = navigation.filter((item) => hasAdminPageAccess(item.href));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu size={24} />
      </button>

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:block
        `}
      >
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center px-4 border-b border-gray-100">
            <div className="flex items-center gap-2 text-brand-600 font-bold text-xl">
              <Shield size={20} />
              Admin
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {visibleNavigation.map((item) => (
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
            ))}
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 lg:hidden">
          <div className="w-8"></div>
          <span className="font-semibold text-gray-700">Admin</span>
        </header>
        <div className="py-4 md:py-8 px-4 md:px-6 max-w-screen-2xl mx-auto space-y-3">
          <Outlet />
        </div>
      </main>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminLayout;
