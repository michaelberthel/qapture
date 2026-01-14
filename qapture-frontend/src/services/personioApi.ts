const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface Employee {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    position: string;
    role: string;
    teams: { team: { name: string } }[];
    rawTeams: string[];
    isOverridden?: boolean;
}

export const personioApi = {
    async getEmployees(): Promise<Employee[]> {
        const response = await fetch(`${API_URL}/api/employees`);
        if (!response.ok) throw new Error('Failed to fetch employees');
        return await response.json();
    },

    async getUser(email: string): Promise<Employee> {
        const response = await fetch(`${API_URL}/api/employees/me?user=${encodeURIComponent(email)}`);
        if (!response.ok) throw new Error('Failed to fetch user');
        return await response.json();
    },

    async saveOverride(email: string, role: string, teams: string[]): Promise<void> {
        const response = await fetch(`${API_URL}/api/employees/overrides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role, teams })
        });
        if (!response.ok) throw new Error('Failed to save override');
    },

    async deleteOverride(email: string): Promise<void> {
        const response = await fetch(`${API_URL}/api/employees/overrides/${encodeURIComponent(email)}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete override');
    },

    async syncEmployees(): Promise<void> {
        const response = await fetch(`${API_URL}/api/employees/sync`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to sync employees');
    },

    async getLastSync(): Promise<{ lastSync: string | null }> {
        const response = await fetch(`${API_URL}/api/employees/status`);
        if (!response.ok) throw new Error('Failed to fetch sync status');
        return await response.json();
    }
};
