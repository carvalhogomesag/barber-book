import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
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
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export function Notifications() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. ESCUTA EM TEMPO REAL (Observabilidade Enterprise)
  useEffect(() => {
    if (!profile?.id) return;

    // Conecta na subcoleção de alertas que o nosso backend popula
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
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (alertId) => {
    if(!confirm("Remover este alerta permanentemente?")) return;
    try {
      const alertRef = doc(db, 'barbers', profile.id, 'alerts', alertId);
      await deleteDoc(alertRef);
    } catch (error) {
      console.error(error);
    }
  };

  // 2. MAPEAMENTO DE CATEGORIAS (Circuit Breaker / Governor / HITL)
  const getAlertConfig = (type) => {
    switch (type) {
      case 'HUMAN_INTERVENTION_REQUIRED':
        return {
          icon: <UserPlus className="text-barber-gold" size={20} />,
          label: "Transbordo Humano",
          color: "border-barber-gold/30 bg-barber-gold/5"
        };
      case 'CIRCUIT_BREAKER_FAILURE':
        return {
          icon: <ZapOff className="text-red-500" size={20} />,
          label: "Falha de Sistema",
          color: "border-red-500/30 bg-red-500/5"
        };
      case 'IA_STUCK':
        return {
          icon: <AlertOctagon className="text-orange-500" size={20} />,
          label: "IA Estagnada",
          color: "border-orange-500/30 bg-orange-500/5"
        };
      default:
        return {
          icon: <Bell className="text-zinc-500" size={20} />,
          label: "Notificação",
          color: "border-zinc-800 bg-zinc-900/50"
        };
    }
  };

  const unresolvedCount = alerts.filter(a => !a.resolved).length;

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter flex items-center gap-3">
            <Bell className="text-barber-gold" size={24} />
            Command Center
          </h1>
          <p className="text-barber-gray font-bold uppercase tracking-widest text-[10px] opacity-70 italic">
            Monitoring AI reliability and customer escalations
          </p>
        </div>
        
        {unresolvedCount > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl animate-pulse">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-500">
                    {unresolvedCount} Actions Required
                </p>
            </div>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-barber-gold" size={32} />
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">Syncing Alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-24 bg-zinc-900/10 border-2 border-dashed border-zinc-800 rounded-[3rem]">
          <Bell className="text-zinc-800 mx-auto mb-4" size={48} />
          <p className="text-zinc-600 font-black uppercase tracking-widest text-xs italic">
            Systems Operational. No alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl mx-auto">
          {alerts.map((alert) => {
            const config = getAlertConfig(alert.type);
            return (
              <div 
                key={alert.id} 
                className={`
                  relative p-6 rounded-3xl border transition-all duration-300
                  ${alert.resolved ? 'bg-barber-black border-zinc-800 opacity-50 grayscale' : config.color}
                `}
              >
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  {/* Badge de Tipo */}
                  <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-barber-gold mb-1 block">
                          {config.label}
                        </span>
                        <h3 className={`text-base font-black uppercase italic tracking-wide ${alert.resolved ? 'text-zinc-500' : 'text-white'}`}>
                          {alert.reason?.replace(/_/g, ' ') || "Action Required"}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold whitespace-nowrap bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
                          <Clock size={10} />
                          {alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true }) : 'Now'}
                      </div>
                    </div>
                    
                    <p className="text-xs text-zinc-400 leading-relaxed font-medium mb-6 italic">
                      {alert.description || `O cliente ${alert.clientPhone} precisa de atenção manual.`}
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <Link 
                        to="/messages" 
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-barber-white text-black text-[10px] font-black uppercase hover:bg-barber-gold transition-colors shadow-lg shadow-white/5"
                      >
                        <MessageSquare size={14} /> Take Over Chat <ChevronRight size={14} />
                      </Link>
                      
                      {!alert.resolved && (
                        <button 
                          onClick={() => handleMarkAsResolved(alert.id)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black uppercase transition-colors"
                        >
                          <Check size={14} /> Resolve
                        </button>
                      )}

                      <button 
                        onClick={() => handleDelete(alert.id)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-red-500/10 hover:text-red-500 text-zinc-500 text-[10px] font-black uppercase transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {!alert.resolved && (
                  <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}