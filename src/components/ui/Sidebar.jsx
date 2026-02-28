import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, LogOut, User, Zap, ShieldAlert, FileText, 
  Briefcase, Users, MessageSquare, Sparkles, BarChart3, 
  CreditCard, TrendingUp, HelpCircle, X, Bell, QrCode,
  ChevronRight, ChevronLeft, Menu
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext'; 
import { PWAInstallButton } from './PWAInstallButton';

export function Sidebar({ isCollapsed, toggleCollapse, onCloseMobile }) {
  const location = useLocation(); 
  const navigate = useNavigate();
  const { profile } = useAuth(); 

  const isAdmin = profile?.role === 'admin';
  const isPro = profile?.plan === 'pro';
  const isSales = profile?.role === 'sales';

  let menuItems = [];

  if (isAdmin) {
    menuItems = [
      { path: '/admin', icon: ShieldAlert, label: 'Management' },      
      { path: '/admin-dashboard', icon: BarChart3, label: 'Analytics' },
      { path: '/profile', icon: User, label: 'Settings' },
    ];
  } else if (isSales) {
    menuItems = [
      { path: '/sales-console', icon: TrendingUp, label: 'Dashboard' },
      { path: '/sales-crm', icon: Users, label: 'Network' },
      { path: '/sales-analytics', icon: BarChart3, label: 'Reports' },
      { path: '/profile', icon: User, label: 'Profile' },
    ];
  } else {
    menuItems = [
      { path: '/dashboard', icon: Calendar, label: 'Schedule' },
      { path: '/notifications', icon: Bell, label: 'Inbox' },
      { path: '/messages', icon: MessageSquare, label: 'Live Chat' },
      { path: '/customers', icon: Users, label: 'Customers' },
      { path: '/services', icon: Briefcase, label: 'Services' },
      { path: '/setup-pro', icon: QrCode, label: 'My QR' },
      { path: '/profile', icon: User, label: 'Profile' },
      isPro 
        ? { path: '/billing', icon: CreditCard, label: 'Billing' }
        : { path: '/pricing', icon: Zap, label: 'Plans' },
    ];
  }

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      
      {/* Botão para Expandir/Retrair (Apenas Desktop) */}
      <button 
        onClick={toggleCollapse}
        className="hidden lg:flex absolute -right-3 top-10 w-6 h-6 bg-schedy-black text-white rounded-full items-center justify-center shadow-vivid z-50 hover:scale-110 transition-transform"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* HEADER: LOGO */}
      <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'px-6'} border-b border-schedy-border shrink-0`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-schedy-black text-white rounded-lg flex items-center justify-center font-black italic text-xs shrink-0">
            S
          </div>
          {!isCollapsed && (
            <span className="font-black text-xl tracking-tighter text-schedy-black animate-in fade-in slide-in-from-left-2">
              SCHEDY
            </span>
          )}
        </div>
      </div>

      {/* NAVEGAÇÃO */}
      <nav className="flex-1 py-6 flex flex-col gap-1 px-3 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              title={isCollapsed ? item.label : ''}
              className={`
                flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-schedy-black text-white shadow-vivid' 
                  : 'text-schedy-gray hover:bg-schedy-canvas hover:text-schedy-black'
                }
                ${isCollapsed ? 'justify-center' : 'justify-start'}
              `}
            >
              <item.icon size={20} className={isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
              {!isCollapsed && (
                <span className="font-bold uppercase tracking-tight text-[11px] whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* FOOTER: PROFILE & LOGOUT */}
      <div className="p-3 border-t border-schedy-border flex flex-col gap-2">
        
        {/* Profile Card */}
        <div className={`
          flex items-center gap-3 rounded-2xl transition-all
          ${isCollapsed ? 'justify-center p-1' : 'bg-schedy-canvas p-3'}
        `}>
          <div className={`
            rounded-xl flex items-center justify-center font-black text-white shadow-sm shrink-0
            ${isAdmin ? 'bg-schedy-danger' : 'bg-schedy-black'}
            ${isCollapsed ? 'w-10 h-10 text-xs' : 'w-9 h-9 text-[10px]'}
          `}>
            {profile?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          
          {!isCollapsed && (
            <div className="min-w-0 animate-in fade-in slide-in-from-left-2">
              <p className="text-[10px] font-black text-schedy-black uppercase truncate leading-tight">
                {profile?.name || 'User'}
              </p>
              <p className="text-[9px] text-schedy-gray truncate">
                {profile?.email}
              </p>
            </div>
          )}
        </div>

        <button 
          onClick={handleLogout}
          title={isCollapsed ? 'Log Out' : ''}
          className={`
            flex items-center gap-3 px-3 py-3 text-schedy-gray hover:text-schedy-danger hover:bg-red-50 rounded-xl transition-all font-bold uppercase text-[10px]
            ${isCollapsed ? 'justify-center' : 'justify-start'}
          `}
        >
          <LogOut size={20} />
          {!isCollapsed && <span className="animate-in fade-in slide-in-from-left-2">Sign Out</span>}
        </button>
      </div>
    </div>
  );
}