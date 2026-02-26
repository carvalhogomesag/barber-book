import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CheckSquare, Square, Clock, StickyNote, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export function AppointmentModal({ 
  isOpen, 
  onClose, 
  editingAppointment, 
  services, 
  currency, 
  onSave, 
  onDelete,
  initialDate,
  loading 
}) {
  const [clientName, setClientName] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]); 
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [formDate, setFormDate] = useState(new Date());

  // Sincroniza os campos quando o modal abre para editar ou criar
  useEffect(() => {
    if (isOpen) {
      if (editingAppointment) {
        setClientName(editingAppointment.clientName);
        const individualServices = editingAppointment.serviceName.split(' + ');
        const matchedIds = services.filter(s => individualServices.includes(s.name)).map(s => s.id);
        setSelectedServiceIds(matchedIds);
        setTime(format(new Date(editingAppointment.startTime), 'HH:mm'));
        setFormDate(new Date(editingAppointment.startTime));
        setNotes(editingAppointment.notes || '');
      } else {
        setClientName('');
        setSelectedServiceIds([]);
        setTime(format(initialDate, 'HH:mm'));
        setFormDate(initialDate);
        setNotes('');
      }
    }
  }, [isOpen, editingAppointment, initialDate, services]);

  const toggleService = (serviceId) => {
    setSelectedServiceIds(prev => 
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      clientName,
      selectedServiceIds,
      time,
      notes,
      formDate
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingAppointment ? "Edit Appointment" : "New Appointment"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-barber-gray font-black uppercase tracking-widest italic">Appointment Date</label>
          <input 
            type="date" 
            value={format(formDate, 'yyyy-MM-dd')}
            onChange={(e) => {
              const [year, month, day] = e.target.value.split('-').map(Number);
              setFormDate(new Date(year, month - 1, day));
            }}
            className="bg-barber-black border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-barber-gold transition-colors"
            required 
          />
        </div>

        <Input label="CLIENT NAME" placeholder="Ex: John Doe" value={clientName} onChange={e => setClientName(e.target.value)} required />
        
        <div className="w-full">
          <label className="text-[10px] text-barber-gray font-black uppercase mb-2 block tracking-widest italic">Select Services (Combo)</label>
          <div className="grid grid-cols-1 gap-2 max-h-40 md:max-h-44 overflow-y-auto pr-2 custom-scrollbar">
            {services.map(service => {
              const isSelected = selectedServiceIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                    isSelected ? 'bg-barber-gold/20 border-barber-gold text-barber-gold' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3 text-left">
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    <span className="text-sm font-bold uppercase tracking-tight">{service.name}</span>
                  </div>
                  <span className="text-xs font-black">{currency}{service.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="TIME" type="time" value={time} onChange={e => setTime(e.target.value)} required />
          <div className="flex flex-col justify-end pb-1 px-1">
             <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest italic">Duration</span>
             <div className="flex items-center gap-1.5 text-barber-gold font-bold">
                <Clock size={14} />
                <span className="text-sm">
                  {services.filter(s => selectedServiceIds.includes(s.id)).reduce((acc, s) => acc + s.duration, 0)} min
                </span>
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-barber-gray font-black uppercase mb-1 flex items-center gap-1 tracking-widest italic">
            <StickyNote size={12} className="text-barber-gold" /> Notes
          </label>
          <textarea 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Special requests..."
            className="bg-barber-black border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-barber-gold transition-colors min-h-[60px] resize-none"
          />
        </div>

        <div className="flex gap-2 mt-2 pt-4 border-t border-zinc-800">
          {editingAppointment && (
            <button type="button" onClick={() => onDelete(editingAppointment.id)} className="bg-zinc-800 text-red-500 px-4 rounded-xl hover:bg-red-500/20 transition-all border border-transparent hover:border-red-500/50">
              <Trash2 size={20} />
            </button>
          )}
          <Button type="submit" loading={loading} className="flex-1 h-12 md:h-14 text-base md:text-lg font-black uppercase tracking-tighter italic">
            {editingAppointment ? "UPDATE" : "CONFIRM"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}