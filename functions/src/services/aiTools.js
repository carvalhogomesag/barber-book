/**
 * functions/src/services/aiTools.js
 * Repositório exclusivo das ferramentas (Functions Calling) do Gemini
 */

const isOverlapping = (startA, durationA, startB, durationB) => {
    const aBegin = new Date(startA).getTime();
    const aEnd = aBegin + (durationA * 60000);
    const bBegin = new Date(startB).getTime();
    const bEnd = bBegin + (durationB * 60000);
    return (aBegin < bEnd && aEnd > bBegin);
};
  
const setupTools = (db, barberId, timezone, mappingRef, fromNumber) => {
    return {
        save_client_identity: async (args) => {
            await mappingRef.set({ clientName: args.name }, { merge: true });
            const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
            await customerRef.set({ name: args.name, phone: fromNumber, updatedAt: new Date().toISOString() }, { merge: true });
            return `SUCCESS: Client name saved as ${args.name}.`;
        },
  
        // NOVA FERRAMENTA: A IA deve checar um dia específico antes de confirmar
        check_day_availability: async (args) => {
            const targetDateStr = args.dateISO.split('T')[0]; // Pega só o YYYY-MM-DD
            const snap = await db.collection("barbers").doc(barberId).collection("appointments")
                .where("startTime", ">=", `${targetDateStr}T00:00:00`)
                .where("startTime", "<=", `${targetDateStr}T23:59:59`)
                .where("status", "in", ["CONFIRMED", "scheduled", "PENDING"]).get();
            
            if (snap.empty) return `VERDICT: ALL SLOTS FREE on ${targetDateStr}.`;
            const busySlots = snap.docs.map(doc => doc.data().startTime);
            return `VERDICT: Busy slots on ${targetDateStr}: ${JSON.stringify(busySlots)}`;
        },
  
        create_appointment: async (args) => {
            const requestedStart = args.startTime;
            const requestedDuration = parseInt(args.duration);
            const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
            if (new Date(requestedStart) < nowLocal) return "ERROR: PAST_DATE";
  
            try {
                return await db.runTransaction(async (transaction) => {
                    const appointmentsRef = db.collection("barbers").doc(barberId).collection("appointments");
                    const snapshot = await transaction.get(appointmentsRef);
                    let conflictFound = false;
                    
                    snapshot.forEach(doc => {
                        const existing = doc.data();
                        if (existing.status !== 'CANCELLED' && isOverlapping(requestedStart, requestedDuration, existing.startTime, existing.duration)) {
                            conflictFound = true;
                        }
                    });
                    
                    if (conflictFound) return "ERROR: SLOT_OCCUPIED_CHOOSE_ANOTHER_TIME";
                    
                    const newDocRef = appointmentsRef.doc();
                    transaction.set(newDocRef, { 
                        ...args, 
                        clientPhone: fromNumber, // FATAL BUG FIXED: Agora a IA consegue achar depois!
                        source: 'ai_enterprise', 
                        createdAt: new Date().toISOString(), 
                        status: 'scheduled' 
                    });
                    return "SUCCESS: APPOINTMENT_CREATED. Inform the client it is confirmed.";
                });
            } catch (e) { return "ERROR: SYNC_FAIL"; }
        },
  
        update_appointment: async (args) => {
            const requestedStart = args.newStartTime;
            const ref = db.collection("barbers").doc(barberId).collection("appointments");
            try {
                return await db.runTransaction(async (transaction) => {
                    const query = ref.where("clientPhone", "==", fromNumber).where("status", "in", ["CONFIRMED", "scheduled"]);
                    const userDocs = await transaction.get(query);
                    
                    if (userDocs.empty) return "ERROR: NOT_FOUND. The user has no active appointments.";
                    
                    const targetDoc = userDocs.docs[0];
                    transaction.update(targetDoc.ref, { startTime: requestedStart, updatedAt: new Date().toISOString() });
                    return "SUCCESS: APPOINTMENT_RESCHEDULED. Inform the client.";
                });
            } catch (e) { return "ERROR: FAIL"; }
        },
  
        delete_appointment: async () => {
            const ref = db.collection("barbers").doc(barberId).collection("appointments");
            const snapshot = await ref.where("clientPhone", "==", fromNumber).where("status", "in", ["CONFIRMED", "scheduled"]).limit(1).get();
            if (snapshot.empty) return "ERROR: NOT_FOUND";
            
            await snapshot.docs[0].ref.update({ status: "CANCELLED", updatedAt: new Date().toISOString() });
            return "SUCCESS: APPOINTMENT_CANCELLED. Inform the client.";
        }
    };
};
  
const toolsDeclaration =[
    { 
        name: "save_client_identity", 
        description: "Registers client name. CALL THIS IMMEDIATELY when user says their name.", 
        parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } 
    },
    { 
        name: "check_day_availability", 
        description: "Checks which times are busy on a specific date. ALWAYS call this before confirming an appointment.", 
        parameters: { type: "object", properties: { dateISO: { type: "string", description: "Format: YYYY-MM-DD" } }, required:["dateISO"] } 
    },
    { 
        name: "create_appointment", 
        description: "Persists NEW booking in the database. Call this when user agrees to time and service.", 
        parameters: { 
            type: "object", 
            properties: { 
                clientName: { type: "string" }, 
                serviceName: { type: "string" }, 
                startTime: { type: "string", description: "ISO format: YYYY-MM-DDTHH:MM:00" }, 
                price: { type: "number" }, 
                duration: { type: "number" } 
            }, 
            required: ["clientName", "serviceName", "startTime", "duration", "price"] 
        } 
    },
    { 
        name: "update_appointment", 
        description: "Changes the time of an EXISTING booking for this user.", 
        parameters: { type: "object", properties: { newStartTime: { type: "string", description: "ISO: YYYY-MM-DDTHH:MM:00" } }, required: ["newStartTime"] } 
    },
    { 
        name: "delete_appointment", 
        description: "Cancels the user's existing booking." 
    }
];
  
module.exports = { setupTools, toolsDeclaration };