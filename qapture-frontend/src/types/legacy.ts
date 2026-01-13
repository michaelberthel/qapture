export interface LegacyEmployee {
    id: number;
    personioid: number;
    email: string;
    vorname: string;
    nachname: string;
    name: string;
    team: string;
    status: string;
    position: string;
}

export interface LegacyCatalog {
    id: number;
    Projekt: string;
    Name: string;
    Jsondata: string; // JSON string containing the survey definition
    isactive: number;
}
