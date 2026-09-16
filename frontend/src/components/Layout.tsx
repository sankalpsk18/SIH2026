// ============================================================================
// ADALAT360 - Layout Component
// Main application layout with sidebar navigation
// ============================================================================

import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Search,
  History,
  GitBranch,
  ShieldCheck,
  FileCheck,
  ClipboardList,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Shield,
  Users,
  Database,
  Network,
  HelpCircle,
  Scale,
  FileSignature,
} from 'lucide-react';
import { UserRole, ROLE_PERMISSIONS } from '../types';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'] },
  { name: 'Cases', href: '/cases', icon: FolderKanban, roles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'] },
  { name: 'Search', href: '/search', icon: Search, roles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'] },
  { name: 'Documents', href: '/documents', icon: FileText, roles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'CENTRAL_ADMIN'] },
  { name: 'Evidence', href: '/evidence', icon: ShieldCheck, roles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'] },
  { name: 'Timeline', href: '/timeline', icon: History, roles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'] },
  { name: 'Entity Graph', href: '/entity-graph', icon: GitBranch, roles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'] },
  { name: 'BSA Certificates', href: '/bsa', icon: FileSignature, roles: ['PROSECUTOR', 'COURT', 'CENTRAL_ADMIN'] },
  { name: 'RTI Requests', href: '/rti', icon: ClipboardList, roles: ['INVESTIGATING_OFFICER', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'] },
];

const adminNavigation = [
  { name: 'Audit Logs', href: '/audit', icon: Shield, roles: ['CENTRAL_ADMIN', 'AUDITOR'] },
  { name: 'User Management', href: '/admin/users', icon: Users, roles: ['CENTRAL_ADMIN', 'AUDITOR'] },
  { name: 'System Config', href: '/admin/config', icon: Database, roles: ['CENTRAL_ADMIN'] },
  { name: 'Blockchain', href: '/admin/blockchain', icon: Network, roles: ['CENTRAL_ADMIN', 'AUDITOR'] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userRole = user?.role ?? 'INVESTIGATING_OFFICER';

  const filteredNav = navigation.filter(item => item.roles.includes(userRole));
  const filteredAdminNav = adminNavigation.filter(item => item.roles.includes(userRole));

  const hasPermission = (permission: string) => {
    if (!user) return false;
    const permissions = ROLE_PERMISSIONS[userRole] ?? ROLE_PERMISSIONS.INVESTIGATING_OFFICER;
    return Boolean((permissions as unknown as Record<string, boolean>)[permission]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">ADALAT360</span>
            </NavLink>
            <button
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
            {filteredNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                }
                title={item.name}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {item.name}
              </NavLink>
            ))}

            {/* Admin section */}
            {filteredAdminNav.length > 0 && (
              <>
                <div className="border-t border-gray-200 my-4 pt-4">
                  <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Administration
                  </h3>
                  {filteredAdminNav.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                      }
                      title={item.name}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              </>
            )}

            {/* Profile & Settings */}
            <div className="border-t border-gray-200 pt-4">
              <NavLink to="/profile" className="sidebar-link">
                <User className="w-5 h-5 flex-shrink-0" />
                Profile
              </NavLink>
              <NavLink to="/settings" className="sidebar-link">
                <Settings className="w-5 h-5 flex-shrink-0" />
                Settings
              </NavLink>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-500">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">ADALAT360</p>
                <p className="text-xs">v1.0.0</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Page title */}
            <div className="flex-1 lg:flex-none">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {getPageTitle(location.pathname)}
              </h1>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-danger-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  className="flex items-center gap-3 p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {user?.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium">{user?.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{formatRole(user?.role)}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {userMenuOpen && (
                  <div className="dropdown-menu">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium">{user?.full_name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      <p className="text-xs text-gray-500 capitalize">{formatRole(user?.role)}</p>
                    </div>
                    <NavLink to="/profile" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                      <User className="w-4 h-4" />
                      Profile
                    </NavLink>
                    <NavLink to="/settings" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                      <Settings className="w-4 h-4" />
                      Settings
                    </NavLink>
                    <div className="border-t border-gray-100" />
                    <button
                      className="dropdown-item w-full text-left text-danger-600"
                      onClick={logout}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/cases': 'Cases',
    '/search': 'Search',
    '/documents': 'Documents',
    '/evidence': 'Evidence',
    '/timeline': 'Timeline',
    '/entity-graph': 'Entity Graph',
    '/bsa': 'BSA Certificates',
    '/rti': 'RTI Requests',
    '/audit': 'Audit Logs',
    '/admin/users': 'User Management',
    '/admin/config': 'System Configuration',
    '/admin/blockchain': 'Blockchain Network',
    '/profile': 'Profile',
    '/settings': 'Settings',
  };

  // Match dynamic routes
  if (pathname.match(/^\/cases\/[^/]+$/)) return 'Case Details';
  if (pathname.match(/^\/cases\/[^/]+\/documents$/)) return 'Documents';
  if (pathname.match(/^\/documents\/[^/]+$/)) return 'Document Details';
  if (pathname.match(/^\/cases\/[^/]+\/evidence$/)) return 'Evidence';
  if (pathname.match(/^\/evidence\/[^/]+$/)) return 'Evidence Details';
  if (pathname.match(/^\/cases\/[^/]+\/timeline$/)) return 'Timeline';
  if (pathname.match(/^\/cases\/[^/]+\/entity-graph$/)) return 'Entity Graph';
  if (pathname.match(/^\/bsa\/[^/]+$/)) return 'BSA Certificate';

  return titles[pathname] || 'ADALAT360';
}

function formatRole(role?: string): string {
  if (!role) return '';
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}