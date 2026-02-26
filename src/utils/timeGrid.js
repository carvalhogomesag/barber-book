import { setHours, startOfDay } from 'date-fns';

// Configurações do Calendário
export const START_HOUR = 0; 
export const END_HOUR = 23;  

// Mudança de estratégia: Em vez de um número fixo, definimos quantas horas queremos ver.
// Se quisermos ver 10 horas, calculamos a altura dinamicamente no componente.
// Por padrão, manteremos 90 para telas grandes, mas o DayView agora vai ajustar isso.
export const PIXELS_PER_HOUR = 90; 

/**
 * Calcula a posição (TOP) de um horário específico no grid.
 * @param {string | Date} dateString - Data no formato ISO ou objeto Date
 * @param {number} customPixelsPerHour - (Opcional) Valor customizado de pixels por hora
 */
export const getPositionFromTime = (dateString, customPixelsPerHour = PIXELS_PER_HOUR) => {
  const date = new Date(dateString);
  const startOfDayDate = setHours(startOfDay(date), START_HOUR);
  
  // Diferença em milissegundos convertida para horas decimais (ex: 10:30 = 10.5)
  const diffInHours = (date - startOfDayDate) / (1000 * 60 * 60);
  
  return diffInHours * customPixelsPerHour;
};

/**
 * Calcula a posição da "Linha de Agora" (Time Indicator)
 */
export const getNowPosition = (timezone, customPixelsPerHour = PIXELS_PER_HOUR) => {
  const now = new Date();
  // Obtém a hora local no fuso horário do profissional
  const localTimeString = now.toLocaleString("en-US", { timeZone: timezone });
  const localDate = new Date(localTimeString);
  
  return getPositionFromTime(localDate, customPixelsPerHour);
};

/**
 * Calcula a altura do card baseada na duração do serviço
 */
export const getHeightFromDuration = (durationInMinutes, customPixelsPerHour = PIXELS_PER_HOUR) => {
  return (durationInMinutes / 60) * customPixelsPerHour;
};

/**
 * Gera a lista de horas (00:00 a 23:00)
 */
export const hoursArray = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i
);

/**
 * Converte o movimento de pixels de volta para um horário ISO.
 * Usado para o Drag & Drop.
 */
export const getNewStartTime = (originalStartTime, pixelsMoved, customPixelsPerHour = PIXELS_PER_HOUR) => {
  const originalDate = new Date(originalStartTime);
  
  // Converte pixels movidos em minutos
  const minutesMoved = (pixelsMoved / customPixelsPerHour) * 60;
  
  // Adiciona os minutos à data original
  const newDate = new Date(originalDate.getTime() + minutesMoved * 60000);
  
  // Imã de 15 minutos (Snap)
  const minutes = newDate.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  newDate.setMinutes(roundedMinutes);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  
  // Retorna ISO formatado corretamente (sem problemas de fuso)
  return newDate.toISOString();
};

/**
 * Formata a exibição de hora para o usuário
 */
export const formatTimeDisplay = (isoString) => {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};