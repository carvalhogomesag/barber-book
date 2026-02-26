import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { 
  Bell, 
  Check, 
  Trash2, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications, markNotificationAsRead, deleteNotification } from '../services/notificationService';

export function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const data = await getNotifications(user.uid);
      setNotifications(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    // Atualiza visualmente na hora (Optimistic UI)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    // Atualiza no banco
    await markNotificationAsRead(user.uid, id);
  };

  const handleDelete = async (id) => {
    if(!confirm("Delete this message?")) return;
    setNotifications(prev => prev.filter(n => n.id !== id));
    await deleteNotification(user.uid, id);
  };

  // Helper para ícones dinâmicos
  const getIcon = (type) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="text-red-500" size={20} />;
      case 'success': return <CheckCircle className="text-green-500" size={20} />;
      default: return <Info className="text-blue-400" size={20} />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppLayout>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter flex items-center gap-3">
            <Bell className="text-barber-gold" size={24} />
            AI Inbox
          </h1>
          <p className="text-barber-gray font-medium italic text-sm">
            Messages and alerts from your AI Concierge
          </p>
        </div>
        
        {unreadCount > 0 && (
            <div className="bg-barber-gold/10 border border-barber-gold/20 px-4 py-2 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-barber-gold">
                    {unreadCount} Unread
                </p>
            </div>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-barber-gold" size={32} />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-24 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-[3rem]">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="text-zinc-700" size={24} />
          </div>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs italic">
            All caught up! No new messages.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl mx-auto">
          {notifications.map((note) => (
            <div 
              key={note.id} 
              className={`
                relative p-6 rounded-2xl border transition-all duration-300
                ${note.read 
                  ? 'bg-barber-black border-zinc-800 opacity-70 hover:opacity-100' 
                  : 'bg-zinc-900 border-barber-gold/30 shadow-lg shadow-barber-gold/5'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Ícone Lateral */}
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center shrink-0 border
                  ${note.read ? 'bg-zinc-800 border-zinc-700 grayscale' : 'bg-black border-zinc-800'}
                `}>
                  {getIcon(note.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-sm font-black uppercase italic tracking-wide ${note.read ? 'text-zinc-400' : 'text-white'}`}>
                      {note.title}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
                        <Clock size={10} />
                        {note.createdAt ? formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }) : 'Just now'}
                    </div>
                  </div>
                  
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    {note.message}
                  </p>

                  <div className="flex gap-2 justify-end">
                    {!note.read && (
                      <button 
                        onClick={() => handleMarkAsRead(note.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-green-500/10 hover:text-green-500 text-zinc-400 text-[10px] font-black uppercase transition-colors"
                      >
                        <Check size={12} /> Mark as Read
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(note.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/10 hover:text-red-500 text-zinc-400 text-[10px] font-black uppercase transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Bolinha de "Novo" */}
              {!note.read && (
                <div className="absolute top-4 right-4 w-2 h-2 bg-barber-gold rounded-full animate-pulse" />
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}