import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { DayView } from '../components/calendar/DayView';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { AppointmentModal } from '../components/dashboard/AppointmentModal';
import { BlockModal } from '../components/dashboard/BlockModal';
import { format, addDays, subDays, isSameDay, isBefore } from 'date-fns';
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
  // --- DATA STATES ---
  const [timezone, setTimezone] = useState('America/New_York');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [currency, setCurrency] = useState('$'); 
  const [businessHours, setBusinessHours] = useState({ open: "08:00", close: "18:00", break: "12:00-13:00" });

  // --- UI STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [modalInitialDate, setModalInitialDate] = useState(new Date());

  // --- HELPERS ---
  const getNowInTimezone = (tz) => {
    const now = new Date();
    const localTime = now.toLocaleString("en-US", { timeZone: tz });
    return new Date(localTime);
  };

  const checkConflict = (startISO, duration, excludeId = null) => {
    const newBegin = new Date(startISO).getTime();
    const newEnd = newBegin + (parseInt(duration) * 60000);
    return appointments.some(apt => {
      if (apt.id === excludeId) return false; 
      const exBegin = new Date(apt.startTime).getTime();
      const exEnd = exBegin + (parseInt(apt.duration) * 60000);
      return (newBegin < exEnd && newEnd > exBegin);
    });
  };

  // --- DATA LOADING ---
  useEffect(() => {
    loadStaticData();
    const interval = setInterval(refreshAppointments, 10000); 
    return () => clearInterval(interval);
  }, [timezone]); 

  const loadStaticData = async () => {
    try {
      const profile = await getProfessionalProfile();
      if (profile) {
        setCurrency(profile.currency || '$');
        if (profile.timezone) {
            setTimezone(profile.timezone);
            setSelectedDate(getNowInTimezone(profile.timezone));
        }
        if (profile.settings?.businessHours) {
          setBusinessHours(prev => ({ ...prev, ...profile.settings.businessHours }));
        }
      }
      const servicesData = await getServices();
      setServices(servicesData);
      await refreshAppointments();
    } catch (error) { console.error("Load failed", error); }
  };

  const refreshAppointments = async () => {
    try {
      const data = await getAppointments();
      setAppointments(data);
    } catch (error) { console.error("Sync failed", error); }
  };

  // --- HANDLERS ---
  const handleSaveAppointment = async (formData) => {
    const { clientName, selectedServiceIds, time, notes, formDate } = formData;
    const selectedData = services.filter(s => selectedServiceIds.includes(s.id));
    if (selectedData.length === 0) return alert("Select a service.");
    
    const totalDuration = selectedData.reduce((acc, s) => acc + s.duration, 0);
    const totalPrice = selectedData.reduce((acc, s) => acc + s.price, 0);
    const combinedServiceName = selectedData.map(s => s.name).join(' + ');
    const fullStartDateStr = `${format(formDate, 'yyyy-MM-dd')}T${time}:00`;

    if (isBefore(new Date(fullStartDateStr), getNowInTimezone(timezone))) return alert("Past dates forbidden.");
    if (checkConflict(fullStartDateStr, totalDuration, editingAppointment?.id)) return alert("Conflict detected.");

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
    } catch (error) { alert("Save error"); } 
    finally { setLoading(false); }
  };

  const handleSaveBlock = async (formData) => {
    const { blockTime, blockDuration, blockRecurrence, blockOccurrences, blockNotes, formDate } = formData;
    const fullStartDateStr = `${format(formDate, 'yyyy-MM-dd')}T${blockTime}:00`;
    
    if (checkConflict(fullStartDateStr, blockDuration)) return alert("Conflict detected.");

    setLoading(true);
    try {
      await addBlockedTime({
        startTime: fullStartDateStr, duration: blockDuration, notes: blockNotes,
        recurrence: blockRecurrence, occurrences: blockOccurrences
      });
      await refreshAppointments();
      setIsBlockModalOpen(false);
    } catch (error) { alert("Block error"); }
    finally { setLoading(false); }
  };

  const handleQuickDelete = async (id) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteAppointment(id);
      refreshAppointments();
    } catch (error) { alert("Delete error"); }
  };

  const handleToggleComplete = async (id) => {
    const apt = appointments.find(a => a.id === id);
    if (!apt || apt.type === 'block') return;
    try {
      await updateAppointmentFull(id, { ...apt, status: apt.status === 'completed' ? 'scheduled' : 'completed' });
      refreshAppointments();
    } catch (error) { alert("Status error"); }
  };

  return (
    <AppLayout>
      <DashboardHeader 
        timezone={timezone}
        selectedDate={selectedDate}
        onPrevDay={() => setSelectedDate(prev => subDays(prev, 1))}
        onNextDay={() => setSelectedDate(prev => addDays(prev, 1))}
        onToday={() => setSelectedDate(getNowInTimezone(timezone))}
        onOpenBlock={() => { setModalInitialDate(selectedDate); setIsBlockModalOpen(true); }}
        onOpenBooking={() => { setEditingAppointment(null); setModalInitialDate(selectedDate); setIsModalOpen(true); }}
      />

      <div className="h-[calc(100vh-240px)] sm:h-[calc(100vh-210px)] min-h-[400px]">
        <DayView 
          appointments={appointments.filter(apt => isSameDay(new Date(apt.startTime), selectedDate) || isSameDay(new Date(apt.startTime), addDays(selectedDate, 1)))} 
          onAppointmentMove={async (id, newStart) => {
             // Lógica de move simplificada aqui ou mantida no DayView
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
          onComplete={handleToggleComplete}
          onDelete={handleQuickDelete}
          startDate={selectedDate} 
          businessHours={businessHours}
          timezone={timezone} 
        />
      </div>

      <AppointmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingAppointment={editingAppointment}
        services={services}
        currency={currency}
        onSave={handleSaveAppointment}
        onDelete={handleQuickDelete}
        initialDate={modalInitialDate}
        loading={loading}
      />

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