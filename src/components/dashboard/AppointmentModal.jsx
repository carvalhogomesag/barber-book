import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CheckSquare, Clock, StickyNote, Trash2, Calendar as CalIcon } from 'lucide-react';
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

  const totalDuration = services
    .filter(s => selectedServiceIds.includes(s.id))
    .reduce((acc, s) => acc + s.duration, 0);

  const totalPrice = services
    .filter(s => selectedServiceIds.includes(s.id))
    .reduce((acc, s) => acc + s.price, 0);

  // FOOTER FIXO: Ações sempre visíveis no rodapé do modal
  const modalFooter = (
    <div className="flex items-center justify-between gap-4 w-full">
      {editingAppointment ? (
        <button 
          type="button" 
          onClick={() => onDelete(editingAppointment.id)} 
          className="flex items-center gap-2 px-6 h-14 bg-red-50 text-schedy-danger rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-schedy-danger hover:text-white transition-all"
        >
          <Trash2 size={18} /> Delete Appointment
        </button>
      ) : (
        <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-schedy-gray tracking-widest">Total Estimate</span>
            <span className="text-2xl font-black text-schedy-black italic">{currency}{totalPrice}</span>
        </div>
      )}
      
      <Button 
        onClick={(e) => {
            e.preventDefault();
            onSave({ clientName, selectedServiceIds, time, notes, formDate });
        }} 
        loading={loading} 
        className="flex-1 max-w-[260px] h-14 shadow-vivid"
      >
        {editingAppointment ? "UPDATE BOOKING" : "CONFIRM BOOKING"}
      </Button>
    </div>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingAppointment ? "Manage Appointment" : "New Direct Booking"}
      footer={modalFooter}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        
        {/* COLUNA ESQUERDA: CLIENTE E SERVIÇOS */}
        <div className="space-y-6">
          <Input 
            label="Client Name" 
            placeholder="Search or type name..." 
            value={clientName} 
            onChange={e => setClientName(e.target.value)} 
            required 
          />
          
          <div className="space-y-3">
            {/* CORREÇÃO AQUI: Removido 'block' onde existia 'flex' */}
            <label className="text-[10px] text-schedy-gray font-black uppercase tracking-widest flex items-center gap-2 ml-1">
              Select Services (Combo)
            </label>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
              {services.map(service => {
                const isSelected = selectedServiceIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={`
                        w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all
                        ${isSelected 
                            ? `border-service-${service.color} bg-service-${service.color}/5 text-schedy-black` 
                            : 'border-schedy-canvas bg-schedy-canvas/30 text-schedy-gray hover:border-schedy-border'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? `bg-service-${service.color} border-service-${service.color}` : 'border-schedy-border bg-white'}`}>
                        {isSelected && <CheckSquare size={14} className="text-white" />}
                      </div>
                      <span className="text-[11px] font-black uppercase italic tracking-tight">{service.name}</span>
                    </div>
                    <span className="text-xs font-black tabular-nums">{currency}{service.price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: DATA, HORA E NOTAS */}
        <div className="space-y-6">
          <div className="space-y-6">
             <div className="space-y-2">
                <label className="text-[10px] text-schedy-gray font-black uppercase tracking-widest flex items-center gap-2 ml-1">
                  <CalIcon size={12} /> Appointment Date
                </label>
                <div className="relative">
                    <input 
                        type="date" 
                        value={format(formDate, 'yyyy-MM-dd')}
                        onChange={(e) => {
                            const [year, month, day] = e.target.value.split('-').map(Number);
                            setFormDate(new Date(year, month - 1, day));
                        }}
                        className="w-full bg-schedy-canvas border-2 border-schedy-border rounded-2xl p-4 text-schedy-black font-bold text-sm outline-none focus:border-schedy-black transition-all"
                        required 
                    />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <Input label="Time" type="time" value={time} onChange={e => setTime(e.target.value)} required />
                <div className="bg-schedy-canvas/50 rounded-2xl p-4 flex flex-col justify-center border border-schedy-border/50">
                    <label className="text-[9px] text-schedy-gray font-black uppercase tracking-widest leading-none mb-1">Duration</label>
                    <div className="flex items-center gap-2 text-schedy-black">
                        <Clock size={14} />
                        <span className="text-sm font-black italic">{totalDuration} MIN</span>
                    </div>
                </div>
             </div>
          </div>

          <div className="space-y-2">
            {/* CORREÇÃO AQUI: Removido 'block' onde existia 'flex' */}
            <label className="text-[10px] text-schedy-gray font-black uppercase tracking-widest flex items-center gap-2 ml-1">
              <StickyNote size={12} /> Notes
            </label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special requests..."
              className="w-full bg-schedy-canvas border-2 border-schedy-border rounded-2xl p-4 text-sm font-bold text-schedy-black outline-none focus:border-schedy-black transition-all min-h-[100px] resize-none placeholder:text-schedy-gray/30"
            />
          </div>
        </div>

      </div>
    </Modal>
  );
}