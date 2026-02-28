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
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react';

// MEDIDA DE OURO: A largura da coluna de horas deve ser idêntica em todos os níveis
const TIME_COLUMN_WIDTH = 'w-16 md:w-20'; 

export function DayView({ 
  appointments, 
  onAppointmentMove, 
  onAppointmentClick, 
  onTimeSlotClick, 
  onComplete, 
  onDelete,   
  startDate = new Date(),
  onNavigate,
  businessHours,
  timezone = "Europe/Lisbon"
}) {
  const scrollContainerRef = useRef(null);
  const firstDayOfWeek = startOfWeek(startDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(firstDayOfWeek, i));

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
    return getPositionFromTime(`2026-01-01T${timeStr}:00`, PIXELS_PER_HOUR);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full bg-white rounded-[24px] border border-schedy-border shadow-premium overflow-hidden transition-all">
        
        {/* 1. HEADER SLIM (ESTILO AVEC) - Reduzido de h-20 para h-14 */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-schedy-border shrink-0 bg-white z-30">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black uppercase italic tracking-tighter text-schedy-black">
              {format(firstDayOfWeek, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-schedy-canvas p-1 rounded-xl border border-schedy-border">
                <button onClick={() => onNavigate(addDays(startDate, -7))} className="p-1.5 hover:bg-white rounded-lg text-schedy-black transition-all">
                    <ChevronLeft size={16} />
                </button>
                <button onClick={() => onNavigate(new Date())} className="px-3 text-[9px] font-black uppercase tracking-widest text-schedy-black">
                    Hoje
                </button>
                <button onClick={() => onNavigate(addDays(startDate, 7))} className="p-1.5 hover:bg-white rounded-lg text-schedy-black transition-all">
                    <ChevronRight size={16} />
                </button>
            </div>
            <button className="p-2 bg-schedy-canvas border border-schedy-border rounded-xl text-schedy-gray hover:text-schedy-black transition-all">
                <Filter size={16} />
            </button>
          </div>
        </div>

        {/* 2. DIAS DA SEMANA (HEADER DA GRADE) - Alinhamento Matemático */}
        <div className="flex border-b border-schedy-border bg-white z-20 shadow-sm">
          <div className={`${TIME_COLUMN_WIDTH} shrink-0 border-r border-schedy-border bg-schedy-canvas/10`} />
          <div className="flex-1 grid grid-cols-7">
            {days.map((day, index) => (
              <div key={index} className="py-2 text-center border-r border-schedy-border last:border-r-0">
                <span className="block text-[8px] font-black text-schedy-gray uppercase tracking-widest">
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span className={`
                  inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs mt-0.5
                  ${isSameDay(day, new Date()) ? 'bg-schedy-black text-white' : 'text-schedy-black'}
                `}>
                  {format(day, 'dd')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. ÁREA DA GRADE (SCROLL) */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative bg-white select-none custom-scrollbar">
          <div className="flex relative" style={{ height: hoursArray.length * PIXELS_PER_HOUR }}>
            
            {/* EIXO DE HORAS (FIXO) */}
            <div className={`${TIME_COLUMN_WIDTH} shrink-0 border-r border-schedy-border bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]`}>
              {hoursArray.map((hour) => (
                <div 
                  key={hour} 
                  className="absolute w-full text-center text-[9px] font-black text-schedy-gray/50 -mt-2.5" 
                  style={{ top: (hour - START_HOUR) * PIXELS_PER_HOUR }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* COLUNAS DOS DIAS (GRID REAL) */}
            <div className="flex-1 grid grid-cols-7 h-full">
                {days.map((day, colIndex) => {
                  const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.startTime), day));
                  return (
                    <div 
                      key={colIndex} 
                      className="relative border-r border-schedy-border last:border-r-0 hover:bg-schedy-canvas/20 transition-colors" 
                      onClick={(e) => handleGridClick(e, day)}
                    >
                      {/* LINHAS HORIZONTAIS DE FUNDO */}
                      {hoursArray.map((hour) => (
                        <div 
                          key={hour} 
                          className="absolute w-full border-b border-schedy-border/30" 
                          style={{ top: (hour - START_HOUR) * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }} 
                        />
                      ))}

                      {/* CARDS */}
                      {dayAppointments.map((apt) => (
                        <div key={apt.id} data-appointment-card>
                            <AppointmentCard 
                                appointment={apt} 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAppointmentClick(apt);
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
      </div>
    </DndContext>
  );
}