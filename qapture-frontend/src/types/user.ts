export interface User {
    id?: number;
    azureAdObjectId: string;
    email: string;
    displayName: string;
    role: 'Admin' | 'ProjektQM' | 'ProjektKoordinator' | 'Mitarbeiter';
    teams?: UserTeam[];
}

export interface Team {
    id: number;
    name: string;
    description?: string;
}

export interface UserTeam {
    teamId: number;
    team: Team;
    isManager: boolean;
}
