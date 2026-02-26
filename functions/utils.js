/**
 * functions/utils.js
 * Utilitários de Data e Hora para o Schedy AI
 */

exports.getSchedulerContext = (timezone) => {
    const agoraUTC = new Date();

    // 1. Obtém a data HOJE no fuso horário do profissional (Formato YYYY-MM-DD)
    // Usamos 'en-CA' pois é o único locale que o Intl retorna nativamente como YYYY-MM-DD
    const hojeLocalISO = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(agoraUTC);

    // 2. Obtém a hora atual no fuso do profissional (Formato HH:mm)
    const currentTimeLocal = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(agoraUTC);

    // 3. Gera o Menu de 9 Dias ancorado no "Hoje Local" absoluto
    const dateMenu = [];
    for (let i = 0; i < 9; i++) {
        // Ancoramos no meio-dia do dia calculado para evitar problemas de fuso na virada do dia
        const d = new Date(hojeLocalISO + "T12:00:00");
        d.setDate(d.getDate() + i);

        // Formata o ISO do dia do menu
        const iso = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);

        // Gera a etiqueta amigável (Today, Tomorrow ou Weekday)
        let label;
        if (i === 0) label = "Today";
        else if (i === 1) label = "Tomorrow";
        else {
            label = new Intl.DateTimeFormat('en-US', { 
                timeZone: timezone, 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
            }).format(d);
        }

        dateMenu.push({ index: i + 1, label, iso });
    }

    const dateMenuString = dateMenu.map(d => `${d.index}) ${d.label} (${d.iso})`).join("\n");

    return {
        hojeLocalISO,
        currentTimeLocal,
        dateMenu,
        dateMenuString
    };
};