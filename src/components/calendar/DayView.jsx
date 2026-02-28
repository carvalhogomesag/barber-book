import React, { useRef } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { 
  hoursArray, 
  getNewStartTime, 
  START_HOUR, 
  getPositionFromTime,
  PIXELS_PER_HOUR
} from '../../utils/timeGrid'; 
import { AppointmentCard } from './AppointmentCard';
import { addDays, format, isSameDay, setHours, setMinutes, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export function DayView({ 
  appointments, 
  onAppointmentMove, 
  onAppointmentClick, 
  onTimeSlotClick, 
  onComplete, 
  onDelete,   
  startDate = new Date(),
  onNavigate, // Função para mudar a semana
  businessHours,
  timezone = "Europe/Lisbon"
}) {
  const scrollContainerRef = useRef(null);
  
  // SEMPRE exibe 7 dias, começando no Domingo
  const firstDayOfWeek = startOfWeek(startDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(firstDayOfWeek, i));

  // Sensores de D&D configurados para precisão
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragEnd = (event) => {
    const { active, delta } = event;
    if (!delta.y) return;
    const appointment = active.data.current;
    const newStartTime = getNewStartTime(appointment.startTime, delta.y, PIXELS_PER_HOUR);
    if (onAppointmentMove) onAppointmentMove(appointment.id, newStartTime);
  };

  const handleGridClick = (e, dayDate) => {
    // Evita disparar se clicar no card
    if (e.target.closest('[data-appointment-card]')) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top; 
    
    const hoursPassed = offsetY / PIXELS_PER_HOUR;
    const hour = Math.floor(hoursPassed) + START_HOUR;
    const minutes = Math.floor((hoursPassed % 1) * 60);
    const roundedMinutes = Math.round(minutes / 15) * 15;
    
    let clickedDate = setHours(dayDate, hour);
    clickedDate = setMinutes(clickedDate, roundedMinutes);
    clickedDate.setSeconds(0);
    clickedDate.setMilliseconds(0);
    
    if (onTimeSlotClick) onTimeSlotClick(clickedDate);
  };

  const getTop = (timeStr) => {
    if (!timeStr || timeStr === "none") return 0;
    // Criamos uma data fictícia apenas para calcular a posição relativa à START_HOUR
    const dummyDate = `2026-01-01T${timeStr}:00`;
    return getPositionFromTime(dummyDate, PIXELS_PER_HOUR);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full bg-white rounded-[32px] border border-schedy-border shadow-premium overflow-hidden">
        
        {/* HEADER MINIMALISTA (UMA LINHA) */}
        <div className="flex items-center justify-between px-8 h-20 border-b border-schedy-border shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <div className="bg-schedy-black p-2 rounded-xl text-white">
              <CalendarIcon size={20} />
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-schedy-black">
              {format(firstDayOfWeek, 'MMMM yyyy')}
            </h2>
          </div>
          
          <div className="flex items-center bg-schedy-canvas p-1 rounded-2xl border border-schedy-border">
            <button 
              onClick={() => onNavigate(addDays(startDate, -7))}
              className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-schedy-black"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => onNavigate(new Date())}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white rounded-xl transition-all"
            >
              Today
            </button>
            <button 
              onClick={() => onNavigate(addDays(startDate, 7))}
              className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-schedy-black"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* DIAS DA SEMANA (STICKY) */}
        <div className="flex border-b border-schedy-border bg-white z-20">
          <div className="w-20 shrink-0 border-r border-schedy-border" />
          {days.map((day, index) => (
            <div key={index} className="flex-1 py-4 text-center border-r border-schedy-border last:border-r-0">
              <span className="block text-[10px] text-schedy-gray uppercase font-black tracking-[0.2em] mb-1">
                {format(day, 'EEE')}
              </span>
              <span className={`
                inline-flex items-center justify-center w-10 h-10 rounded-full font-black text-lg
                ${isSameDay(day, new Date()) ? 'bg-schedy-black text-white shadow-vivid' : 'text-schedy-black'}
              `}>
                {format(day, 'dd')}
              </span>
            </div>
          ))}
        </div>

        {/* ÁREA DE SCROLL (GRADE HORÁRIA) */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto relative bg-white select-none custom-scrollbar"
        >
          <div className="flex relative" style={{ height: hoursArray.length * PIXELS_PER_HOUR }}>
            
            {/* EIXO DE HORAS (FIXO À ESQUERDA) */}
            <div className="w-20 shrink-0 border-r border-schedy-border bg-white sticky left-0 z-10">
              {hoursArray.map((hour) => (
                <div 
                  key={hour} 
                  className="absolute w-full text-center text-[11px] font-black text-schedy-gray -mt-2.5" 
                  style={{ top: (hour - START_HOUR) * PIXELS_PER_HOUR }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* COLUNAS DOS DIAS */}
            {days.map((day, colIndex) => {
              const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.startTime), day));

              return (
                <div 
                  key={colIndex} 
                  className="flex-1 relative border-r border-schedy-border last:border-r-0 hover:bg-schedy-canvas/30 transition-colors" 
                  onClick={(e) => handleGridClick(e, day)}
                >
                  {/* LINHAS HORIZONTAIS DE FUNDO */}
                  {hoursArray.map((hour) => (
                    <div 
                      key={hour} 
                      className="absolute w-full border-b border-schedy-border/50" 
                      style={{ top: (hour - START_HOUR) * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }} 
                    />
                  ))}

                  {/* FAIXA DE BREAK (OPCIONAL) */}
                  {businessHours?.break && (
                    (() => {
                      const [bStart, bEnd] = businessHours.break.split('-');
                      const bTop = getTop(bStart);
                      const bHeight = getTop(bEnd) - bTop;
                      return (
                        <div
                          className="absolute w-full bg-schedy-canvas/50 z-0 pointer-events-none flex items-center justify-center border-y border-schedy-border/30"
                          style={{ top: bTop, height: bHeight }}
                        >
                          <span className="text-[8px] font-black uppercase tracking-[0.4em] text-schedy-gray/40 rotate-90 lg:rotate-0">
                            Closed
                          </span>
                        </div>
                      );
                    })()
                  )}

                  {/* CARDS DE AGENDAMENTO */}
                  {dayAppointments.map((apt) => (
                    <div key={apt.id} data-appointment-card>
                        <AppointmentCard 
                          appointment={apt} 
                          onComplete={onComplete} 
                          onDelete={onDelete}     
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (onAppointmentClick) onAppointmentClick(apt); 
                          }} 
                        />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DndContext>
  );
}