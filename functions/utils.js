/**
 * functions/src/utils.js
 * Motor de Precisão Temporal para Schedy AI (International Concierge)
 */

exports.getSchedulerContext = (timezone = "UTC") => {
    // 1. Instância de tempo absoluto (Ponto Zero)
    const agoraUTC = new Date();

    // 2. ÂNCORA HOJE (Data Local do Profissional)
    // Usamos en-CA para garantir o padrão ISO-8601 (YYYY-MM-DD) sem manipulação de string complexa
    const hojeLocalISO = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(agoraUTC);

    // 3. HORA LOCAL (HH:mm)
    // Importante: A IA precisa saber exatamente que horas são lá para não agendar no passado
    const currentTimeLocal = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(agoraUTC);

    // 4. DIA DA SEMANA ATUAL (0-6)
    // 0 = Sunday, 1 = Monday...
    // Essencial para bater com as configurações de 'days' [1,2,3,4,5] do barbeiro
    const currentDayOfWeek = new Date(agoraUTC.toLocaleString("en-US", { timeZone: timezone })).getDay();

    // 5. GERAÇÃO DO CALENDÁRIO DINÂMICO (Look-up Table para a IA)
    // Geramos 10 dias de opções para cobrir feriados e fins de semana
    const dateMenu = [];
    for (let i = 0; i < 10; i++) {
        // Âncora de Meio-dia: Evita que o fuso pule o dia por causa de 1 ou 2 horas de diferença
        const refDate = new Date(`${hojeLocalISO}T12:00:00`);
        refDate.setDate(refDate.getDate() + i);

        const isoDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(refDate);

        const dayName = new Intl.DateTimeFormat('en-US', { 
            timeZone: timezone, 
            weekday: 'long' 
        }).format(refDate);

        const numericDay = refDate.getDay();

        let friendlyLabel;
        if (i === 0) friendlyLabel = "Today";
        else if (i === 1) friendlyLabel = "Tomorrow";
        else friendlyLabel = dayName;

        dateMenu.push({
            option: i + 1,
            label: friendlyLabel,
            iso: isoDate,
            dayOfWeek: numericDay
        });
    }

    // String formatada para o System Prompt da IA (Contexto de Decisão)
    const dateMenuString = dateMenu
        .map(d => `${d.option}) ${d.label} - ${d.iso} (${d.dayOfWeek})`)
        .join("\n");

    return {
        hojeLocalISO,         // YYYY-MM-DD
        currentTimeLocal,    // HH:mm
        currentDayOfWeek,    // 0-6
        dateMenu,            // Array de objetos para ferramentas
        dateMenuString       // Texto pronto para o Prompt
    };
};