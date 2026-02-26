import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  LogOut, 
  User, 
  Zap, 
  ShieldAlert, 
  FileText, 
  Briefcase, 
  Users,
  MessageSquare,
  Sparkles,
  BarChart3,
  CreditCard,
  TrendingUp,
  HelpCircle,
  X,
  ShieldCheck,
  Clock,
  LayoutDashboard,
  Settings,
  Bell,    // Ícone para Notificações
  QrCode   // Ícone para Compartilhar/QR
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext'; 
import { PWAInstallButton } from './PWAInstallButton';

export function Sidebar({ onClose }) {
  const location = useLocation(); 
  const navigate = useNavigate();
  const { profile } = useAuth(); 

  // DEFINIÇÃO DE PERMISSÕES
  const isAdmin = profile?.role === 'admin';
  const isPro = profile?.plan === 'pro';
  const isSales = profile?.role === 'sales';

  // --- CONSTRUÇÃO DINÂMICA DO MENU ---
  let menuItems = [];

  if (isAdmin) {
    // MENU ADMIN (DONO DO SAAS)
    menuItems = [
      { path: '/admin', icon: ShieldAlert, label: 'Management' },      
      { path: '/admin-dashboard', icon: BarChart3, label: 'BI Analytics' },
      { path: '/profile', icon: User, label: 'My Admin Profile' },
      { path: '/support', icon: HelpCircle, label: 'Help Center' },
      { path: '/terms', icon: FileText, label: 'Legal' },
    ];
  } else if (isSales) {
    // MENU COMERCIAL (VENDEDOR)
    // O QR Code do vendedor já fica dentro do "Sales Console"
    menuItems = [
      { path: '/sales-console', icon: TrendingUp, label: 'Sales Console' },
      { path: '/sales-crm', icon: Users, label: 'My Network' },
      { path: '/sales-analytics', icon: BarChart3, label: 'Performance' },
      { path: '/profile', icon: User, label: 'My Profile' },
      { path: '/support', icon: HelpCircle, label: 'Help Center' },
      { path: '/terms', icon: FileText, label: 'Legal' },
    ];
  } else {
    // MENU PROFISSIONAL (BARBEIRO)
    menuItems = [
      { path: '/dashboard', icon: Calendar, label: 'Schedule' },
      { path: '/notifications', icon: Bell, label: 'Inbox & Alerts' }, // Nova: Notificações da IA
      { path: '/messages', icon: MessageSquare, label: 'Live Chat' },
      { path: '/customers', icon: Users, label: 'Customers' },
      { path: '/services', icon: Briefcase, label: 'Services' },
      { path: '/setup-pro', icon: QrCode, label: 'My Link & QR' }, // Nova: Local para baixar o QR Code
      { path: '/profile', icon: User, label: 'Profile' },
      isPro 
        ? { path: '/billing', icon: CreditCard, label: 'Billing' }
        : { path: '/pricing', icon: Zap, label: 'Plans' },
      { path: '/support', icon: HelpCircle, label: 'Help Center' },
      { path: '/terms', icon: FileText, label: 'Legal' },
    ];
  }

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <aside className="w-64 bg-barber-black border-r border-zinc-800 flex flex-col h-full shadow-2xl">
      
      {/* HEADER DA SIDEBAR DINÂMICO */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-zinc-800">
        <div className="flex items-center gap-2">
            <Sparkles className={isAdmin ? "text-barber-red" : "text-barber-gold"} size={20} />
            <h1 className="text-xl font-black text-barber-white tracking-tighter uppercase italic">
              {isAdmin ? 'SCHEDY ADMIN' : isSales ? 'SCHEDY PARTNER' : 'SCHEDY'}
            </h1>
        </div>
        
        <button 
          onClick={onClose} 
          className="lg:hidden p-2 text-zinc-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* NAVEGAÇÃO PRINCIPAL */}
      <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-barber-red text-white shadow-lg shadow-red-900/30 translate-x-1' 
                  : 'text-barber-gray hover:bg-zinc-800/50 hover:text-white font-medium'
              }`}
            >
              <item.icon size={20} />
              <span className="font-bold uppercase tracking-tight italic text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ÁREA INFERIOR: IDENTIFICAÇÃO DO USUÁRIO */}
      <div className="p-4 border-t border-zinc-800 flex flex-col gap-4">
        
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 shadow-inner">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-black font-black italic shadow-lg shrink-0 ${isAdmin ? 'bg-barber-red' : 'bg-barber-gold'}`}>
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-white uppercase truncate italic leading-tight">
                {profile?.name || 'User'}
              </p>
              <p className="text-[9px] text-zinc-500 truncate font-medium">
                {profile?.email}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              isAdmin ? 'bg-barber-red' : profile?.status === 'active' ? 'bg-green-500' : 'bg-barber-gold animate-pulse'
            }`} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 italic">
              {isAdmin ? 'System Owner' : `Account: ${profile?.status === 'active' ? 'Verified' : 'Pending'}`}
            </span>
          </div>
        </div>

        <PWAInstallButton />

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all font-bold uppercase italic text-sm"
        >
          <LogOut size={20} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}