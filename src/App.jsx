import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing'; 
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Services } from './pages/Services';
import { Profile } from './pages/Profile';
import { Pricing } from './pages/Pricing';
import { Terms } from './pages/Terms';
import { Admin } from './pages/Admin';
import { SetupPro } from './pages/SetupPro';
import { AdminDashboard } from './pages/AdminDashboard'; 
import { Billing } from './pages/Billing'; 
import { SalesDashboard } from './pages/SalesDashboard'; 
import { JoinSales } from './pages/JoinSales'; 
import { Support } from './pages/Support'; 
import { SalesCRM } from './pages/SalesCRM'; 
import { SalesAnalytics } from './pages/SalesAnalytics'; 

// IMPORTAÇÃO DA NOVA PÁGINA DE NOTIFICAÇÕES
import { Notifications } from './pages/Notifications';

// COMPONENTES GLOBAIS
import { CookieConsent } from './components/ui/CookieConsent';
import { PWAInstallPrompt } from './components/ui/PWAInstallPrompt';

// NOVAS PÁGINAS
import { Customers } from './pages/Customers';
import { Messages } from './pages/Messages';

function App() {
  return (
    <BrowserRouter>
      {/* AVISO DE COOKIES (Global) */}
      <CookieConsent />

      {/* PROMPT DE INSTALAÇÃO PWA (Global) */}
      <PWAInstallPrompt />

      <Routes>
        {/* ROTAS PÚBLICAS (Conversão e Ajuda) */}
        <Route path="/" element={<Landing />} />
        <Route path="/join-sales" element={<JoinSales />} />
        <Route path="/support" element={<Support />} />
        
        {/* ROTAS DE ACESSO */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* DASHBOARD PRINCIPAL (BARBEIRO) */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* ROTAS DE GESTÃO E CRM */}
        <Route path="/customers" element={<Customers />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/notifications" element={<Notifications />} /> {/* Nova Rota: Caixa de Entrada da IA */}
        <Route path="/services" element={<Services />} />
        
        {/* CONFIGURAÇÕES E PERFIL */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/setup-pro" element={<SetupPro />} />
        <Route path="/billing" element={<Billing />} /> 
        
        {/* DEPARTAMENTO COMERCIAL (VENDEDOR) */}
        <Route path="/sales-console" element={<SalesDashboard />} /> 
        <Route path="/sales-crm" element={<SalesCRM />} /> 
        <Route path="/sales-analytics" element={<SalesAnalytics />} /> 
        
        {/* INSTITUCIONAL E ADMIN */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/admin" element={<Admin />} /> 
        <Route path="/admin-dashboard" element={<AdminDashboard />} /> 
      </Routes>
    </BrowserRouter>
  );
}

export default App;