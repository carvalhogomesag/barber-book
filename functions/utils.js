/**
 * functions/src/utils.js
 * Motor de Precisão Temporal com Injeção de Sugestões (Golden Slots)
 */

exports.getSchedulerContext = (timezone = "UTC", barberData = {}) => {
    const agoraUTC = new Date();
    
    // 1. ÂNCORA HOJE & HORA LOCAL
    const hojeLocalISO = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(agoraUTC);

    const currentTimeLocal = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(agoraUTC);

    // 2. GERAÇÃO DO CALENDÁRIO (10 DIAS)
    const dateMenu = [];
    const workDays = barberData.settings?.businessHours?.days || [1, 2, 3, 4, 5];

    for (let i = 0; i < 10; i++) {
        const refDate = new Date(`${hojeLocalISO}T12:00:00`);
        refDate.setDate(refDate.getDate() + i);

        const isoDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(refDate);

        const dayOfWeek = refDate.getDay();
        const dayName = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(refDate);

        dateMenu.push({
            option: i + 1,
            label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayName,
            iso: isoDate,
            dayOfWeek,
            isOpen: workDays.includes(dayOfWeek)
        });
    }

    // 3. LÓGICA DE GOLDEN SLOTS (Sugestões de Conversão Rápida)
    // Criamos 3 sugestões baseadas no horário comercial para a IA ser direta
    const openTime = barberData.settings?.businessHours?.open || "09:00";
    const closeTime = barberData.settings?.businessHours?.close || "18:00";
    
    // Se hoje ainda está aberto, sugerimos hoje. Se não, sugerimos amanhã.
    const suggestionDay = (currentTimeLocal < closeTime) ? dateMenu[0] : dateMenu[1];
    const goldenSlots = [
        `${suggestionDay.label} at ${openTime}`,
        `${suggestionDay.label} at 11:00`,
        `${suggestionDay.label} at 15:00`
    ].join(", ");

    return {
        hojeLocalISO,
        currentTimeLocal,
        dateMenu,
        goldenSlots, // Sugestões prontas para o Prompt
        dateMenuString: dateMenu.map(d => `${d.option}) ${d.label} (${d.iso}) - ${d.isOpen ? '[ABERTO]' : '[FECHADO]'}`).join("\n")
    };
};