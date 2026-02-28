import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { DayView } from '../components/calendar/DayView';
import { AppointmentModal } from '../components/dashboard/AppointmentModal';
import { BlockModal } from '../components/dashboard/BlockModal';
import { Button } from '../components/ui/Button';
import { Plus, Lock, Sun } from 'lucide-react';
import { format, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { 
  getServices, 
  addAppointment, 
  getAppointments, 
  updateAppointmentTime,
  updateAppointmentFull,
  deleteAppointment,
  getProfessionalProfile,
  addBlockedTime 
} from '../services/professionalService'; 

export function Dashboard() {
  // --- ESTADOS DE DADOS ---
  const [profile, setProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [businessHours, setBusinessHours] = useState({ open: "07:00", close: "22:00", break: "12:00-13:00" });

  // --- ESTADOS DE UI ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [modalInitialDate, setModalInitialDate] = useState(new Date());

  const timezone = profile?.timezone || 'Europe/Lisbon';

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    loadInitialData();
    const interval = setInterval(refreshAppointments, 15000); 
    return () => clearInterval(interval);
  }, []); 

  const loadInitialData = async () => {
    try {
      const prof = await getProfessionalProfile();
      if (prof) {
        setProfile(prof);
        if (prof.settings?.businessHours) {
          setBusinessHours(prev => ({ ...prev, ...prof.settings.businessHours }));
        }
      }
      const servicesData = await getServices();
      setServices(servicesData);
      await refreshAppointments();
    } catch (error) { console.error("Sync Error:", error); }
  };

  const refreshAppointments = async () => {
    try {
      const data = await getAppointments();
      setAppointments(data || []);
    } catch (error) { console.error("Fetch Error:", error); }
  };

  // --- HELPERS ---
  const getNowInTimezone = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
  };

  const appointmentsWithColors = appointments.map(apt => {
    const service = services.find(s => s.name === apt.serviceName);
    return { ...apt, color: service?.color || 'emerald' };
  });

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const filteredAppointments = appointmentsWithColors.filter(apt => {
    const date = new Date(apt.startTime);
    return date >= weekStart && date <= weekEnd;
  });

  // --- HANDLERS (LÓGICA RESTAURADA) ---

  // 1. Deletar Agendamento ou Bloqueio
  const handleQuickDelete = async (id) => {
    if (!confirm("Deseja realmente remover este item da agenda?")) return;
    try {
      await deleteAppointment(id);
      await refreshAppointments();
      setIsModalOpen(false);
    } catch (error) { alert("Erro ao deletar."); }
  };

  // 2. Salvar Agendamento Manual
  const handleSaveAppointment = async (formData) => {
    const { clientName, selectedServiceIds, time, notes, formDate } = formData;
    const selectedData = services.filter(s => selectedServiceIds.includes(s.id));
    
    if (selectedData.length === 0) return alert("Selecione ao menos um serviço.");

    const totalDuration = selectedData.reduce((acc, s) => acc + s.duration, 0);
    const totalPrice = selectedData.reduce((acc, s) => acc + s.price, 0);
    const combinedServiceName = selectedData.map(s => s.name).join(' + ');
    const fullStartDateStr = `${format(formDate, 'yyyy-MM-dd')}T${time}:00`;

    setLoading(true);
    try {
      const aptData = {
        clientName, serviceName: combinedServiceName, price: totalPrice,
        duration: totalDuration, startTime: fullStartDateStr, notes,
        status: editingAppointment ? editingAppointment.status : 'scheduled'
      };
      
      if (editingAppointment) await updateAppointmentFull(editingAppointment.id, aptData);
      else await addAppointment(aptData);
      
      await refreshAppointments();
      setIsModalOpen(false);
    } catch (error) { alert("Erro ao salvar."); } 
    finally { setLoading(false); }
  };

  // 3. Salvar Bloqueio de Agenda
  const handleSaveBlock = async (formData) => {
    const { blockTime, blockDuration, blockRecurrence, blockOccurrences, blockNotes, formDate } = formData;
    const fullStartDateStr = `${format(formDate, 'yyyy-MM-dd')}T${blockTime}:00`;
    
    setLoading(true);
    try {
      await addBlockedTime({
        startTime: fullStartDateStr, 
        duration: parseInt(blockDuration), 
        notes: blockNotes,
        recurrence: blockRecurrence, 
        occurrences: parseInt(blockOccurrences)
      });
      await refreshAppointments();
      setIsBlockModalOpen(false);
    } catch (error) { alert("Erro ao bloquear horário."); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout>
      {/* HEADER PREMIUM */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-[24px] border border-schedy-border shadow-sm">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-schedy-black leading-none">
              {profile?.barberShopName || 'Schedule'}
            </h1>
            <p className="text-[10px] font-bold text-schedy-gray uppercase tracking-widest mt-1 flex items-center gap-1">
              <Sun size={10} /> {profile?.country === 'PT' ? 'Lisbon' : 'Miami'} Time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setModalInitialDate(selectedDate); setIsBlockModalOpen(true); }}
            className="flex items-center gap-2 px-4 h-12 bg-schedy-canvas text-schedy-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-schedy-black hover:text-white transition-all"
          >
            <Lock size={14} /> Block
          </button>
          <Button 
            onClick={() => { setEditingAppointment(null); setModalInitialDate(getNowInTimezone()); setIsModalOpen(true); }}
            className="w-auto px-6 h-12 shadow-vivid"
          >
            <Plus size={18} className="mr-2" /> New Booking
          </Button>
        </div>
      </div>

      {/* CALENDÁRIO 7 DIAS */}
      <div className="flex-1 min-h-0">
        <DayView 
          appointments={filteredAppointments} 
          onAppointmentMove={async (id, newStart) => {
             await updateAppointmentTime(id, newStart);
             refreshAppointments();
          }}
          onAppointmentClick={(apt) => {
            if (apt.type === 'block') return handleQuickDelete(apt.id);
            setEditingAppointment(apt);
            setIsModalOpen(true);
          }}
          onTimeSlotClick={(date) => {
            setEditingAppointment(null);
            setModalInitialDate(date);
            setIsModalOpen(true);
          }} 
          onNavigate={setSelectedDate}
          startDate={selectedDate} 
          businessHours={businessHours}
          timezone={timezone} 
        />
      </div>

      {/* MODAL DE AGENDAMENTO */}
      <AppointmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingAppointment={editingAppointment}
        services={services}
        currency={profile?.currency || '$'}
        onSave={handleSaveAppointment}
        onDelete={handleQuickDelete}
        initialDate={modalInitialDate}
        loading={loading}
      />

      {/* MODAL DE BLOQUEIO */}
      <BlockModal 
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onSave={handleSaveBlock}
        initialDate={modalInitialDate}
        loading={loading}
      />
    </AppLayout>
  );
}