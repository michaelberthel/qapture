
import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api/admin';

const DIMENSIONS = [
    { name: 'Fachliches & Prozesse', color: '#2196f3' },
    { name: 'System & Datenpflege', color: '#4caf50' },
    { name: 'Kommunikation', color: '#ff9800' },
    { name: 'Gesprächsstruktur', color: '#9c27b0' },
    { name: 'Dokumentation & Aktivitäten', color: '#f44336' }
];

const MAPPINGS = {
    'Fachliches & Prozesse': [
        'Fachlichkeit und System',
        'Fachlichkeit/ Prozesse',
        'Beratungs- und Systemprozesse',
        'Prozessumsetzung',
        'Lösungsfindung- und beschreibung',
        'Prüfschritte',
        'Recht auf Auskunft',
        'OSC',
        'Folgeprozess Ersatzteilbestellung',
        'Folgeprozess Serviceinsatz',
        'Folgeprozesse Auswahl'
    ],
    'System & Datenpflege': [
        'Dateneingabe',
        'Dateneingaben',
        'Aktion'
    ],
    'Kommunikation': [
        'Kommunikation',
        'Gesprächsführung',
        'Kundenkorrepondenz',
        'Antwort',
        'Herausforderungen'
    ],
    'Gesprächsstruktur': [
        'Einstieg',
        'Ausstieg',
        'Abschluss'
    ],
    'Dokumentation & Aktivitäten': [
        'Aktivität E-Mail Bearbeitung',
        'Aktivität Kundenantwort',
        'Aktivität SMS',
        'Aktivität Weiterleitung',
        'Analyse',
        'Coach-the-Coach',
        'Kategorien',
        'Kriterien',
        'Weiteren Aktivitäten'
    ]
};

async function seed() {
    console.log('Starting seed...');

    const dimIds = {};

    // 1. Create Dimensions
    for (const dim of DIMENSIONS) {
        // Check if exists first? API allows create. We might duplicate if we just blindly create.
        // Let's first GET dimensions to see if they exist.
        // For simplicity in this one-off, I'll rely on the user to clear DB or just accept duplicates (which users might delete manually)
        // OR better: Check via GET /dimensions

        let id = null;
        try {
            const res = await fetch(`${API_URL}/dimensions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dim)
            });
            const data = await res.json();
            id = data._id;
            console.log(`Created dimension: ${dim.name} (${id})`);
        } catch (e) {
            console.error(`Failed to create dimension ${dim.name}`, e);
        }

        if (id) {
            dimIds[dim.name] = id;
        }
    }

    // 2. Create Mappings
    for (const [dimName, categories] of Object.entries(MAPPINGS)) {
        const dimId = dimIds[dimName];
        if (!dimId) {
            console.error(`Skipping mappings for ${dimName} - no ID`);
            continue;
        }

        for (const cat of categories) {
            try {
                await fetch(`${API_URL}/mappings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        categoryName: cat,
                        dimensionId: dimId
                    })
                });
                console.log(`Mapped '${cat}' -> '${dimName}'`);
            } catch (e) {
                console.error(`Failed to map ${cat}`, e);
            }
        }
    }

    console.log('Done.');
}

seed();
