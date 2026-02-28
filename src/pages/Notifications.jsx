import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { 
  Bell, 
  Check, 
  Trash2, 
  AlertOctagon, 
  UserPlus, 
  ZapOff,
  MessageSquare,
  Clock,
  Loader2,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale'; // Para datas amigáveis em PT
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export function Notifications() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    const alertsRef = collection(db, 'barbers', profile.id, 'alerts');
    const q = query(alertsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alertsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAlerts(alertsData);
      setLoading(false);
    }, (error) => {
      console.error("Alert Stream Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.id]);

  const handleMarkAsResolved = async (alertId) => {
    try {
      const alertRef = doc(db, 'barbers', profile.id, 'alerts', alertId);
      await updateDoc(alertRef, { resolved: true });
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (alertId) => {
    if(!confirm("Remover este alerta permanentemente?")) return;
    try {
      const alertRef = doc(db, 'barbers', profile.id, 'alerts', alertId);
      await deleteDoc(alertRef);
    } catch (error) { console.error(error); }
  };

  const getAlertConfig = (type) => {
    switch (type) {
      case 'HUMAN_INTERVENTION_REQUIRED':
        return {
          icon: <UserPlus size={20} />,
          label: "Atenção Manual",
          colorClass: "bg-service-amber",
          borderClass: "border-service-amber/20"
        };
      case 'CIRCUIT_BREAKER_FAILURE':
        return {
          icon: <ZapOff size={20} />,
          label: "Falha Crítica",
          colorClass: "bg-schedy-danger",
          borderClass: "border-schedy-danger/20"
        };
      case 'IA_STUCK':
        return {
          icon: <AlertOctagon size={20} />,
          label: "IA Estagnada",
          colorClass: "bg-service-orange",
          borderClass: "border-service-orange/20"
        };
      default:
        return {
          icon: <Bell size={20} />,
          label: "Notificação",
          colorClass: "bg-schedy-gray",
          borderClass: "border-schedy-border"
        };
    }
  };

  const unresolvedCount = alerts.filter(a => !a.resolved).length;

  return (
    <AppLayout>
      {/* HEADER MINIMALISTA (UMA LINHA) */}
      <header className="flex items-center justify-between mb-8 bg-white p-6 rounded-[24px] border border-schedy-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-schedy-black p-2.5 rounded-xl text-white relative">
            <Bell size={20} />
            {unresolvedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-schedy-danger rounded-full border-2 border-white animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-black text-schedy-black tracking-tighter uppercase italic leading-none">Inbox & Alertas</h1>
            <p className="text-[10px] font-bold text-schedy-gray uppercase tracking-widest mt-1">Centro de Comando IA</p>
          </div>
        </div>

        {unresolvedCount > 0 && (
            <div className="hidden md:flex items-center gap-2 bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                <ShieldAlert size={14} className="text-schedy-danger" />
                <span className="text-[10px] font-black uppercase tracking-widest text-schedy-danger">
                    {unresolvedCount} Ações Pendentes
                </span>
            </div>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-schedy-black" size={32} />
            <p className="text-schedy-gray text-[10px] font-black uppercase tracking-[0.3em]">Sincronizando Alertas...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-32 bg-white border-2 border-dashed border-schedy-border rounded-[40px]">
          <div className="w-16 h-16 bg-schedy-canvas rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="text-schedy-gray" size={32} />
          </div>
          <p className="text-schedy-black font-black uppercase tracking-tighter text-xl italic">Tudo sob controle</p>
          <p className="text-schedy-gray font-bold uppercase tracking-widest text-[10px] mt-2">Nenhum alerta detectado no momento.</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-5xl mx-auto pb-12">
          {alerts.map((alert) => {
            const config = getAlertConfig(alert.type);
            return (
              <div 
                key={alert.id} 
                className={`
                  group bg-white border-2 rounded-[32px] p-6 transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-premium
                  ${alert.resolved ? 'opacity-50 grayscale' : config.borderClass}
                `}
              >
                {/* Ear de Status Lateral */}
                <div className={`absolute left-0 top-0 bottom-0 w-3 ${alert.resolved ? 'bg-schedy-border' : config.colorClass}`} />

                <div className="flex flex-col lg:flex-row lg:items-center gap-6 pl-4">
                  
                  {/* Ícone de Categoria */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${alert.resolved ? 'bg-schedy-canvas text-schedy-gray' : `${config.colorClass} text-white`}`}>
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${alert.resolved ? 'text-schedy-gray' : 'text-schedy-black'}`}>
                          {config.label}
                        </span>
                        <div className="h-1 w-1 bg-schedy-border rounded-full" />
                        <div className="flex items-center gap-1.5 text-[10px] text-schedy-gray font-bold italic">
                            <Clock size={12} />
                            {alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: ptBR }) : 'Agora'}
                        </div>
                      </div>
                    </div>
                    
                    <h3 className={`text-lg font-black uppercase italic tracking-tight mb-2 ${alert.resolved ? 'text-schedy-gray' : 'text-schedy-black'}`}>
                      {alert.reason?.replace(/_/g, ' ') || "Intervenção Necessária"}
                    </h3>
                    
                    <p className="text-sm text-schedy-gray font-medium leading-relaxed max-w-2xl">
                      {alert.description || `O cliente ${alert.clientPhone} precisa de suporte humano.`}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link to="/messages">
                      <Button variant="primary" className="h-12 px-6 text-[10px] w-auto shadow-vivid">
                        Assumir Chat <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </Link>
                    
                    {!alert.resolved && (
                      <button 
                        onClick={() => handleMarkAsResolved(alert.id)}
                        className="p-3 bg-schedy-canvas text-schedy-black border border-schedy-border rounded-xl hover:bg-schedy-black hover:text-white transition-all"
                        title="Marcar como resolvido"
                      >
                        <Check size={20} />
                      </button>
                    )}

                    <button 
                      onClick={() => handleDelete(alert.id)}
                      className="p-3 bg-red-50 text-schedy-danger border border-red-100 rounded-xl hover:bg-schedy-danger hover:text-white transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}