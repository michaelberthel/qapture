
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface Catalog {
    _id: string;
    name: string;
    projects: string[];
    jsonData: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CustomTeam {
    _id: string;
    name: string;
    description?: string;
    createdAt?: string;
}

export const adminApi = {
    // --- Catalogs ---
    async getCatalogs(): Promise<Catalog[]> {
        const response = await fetch(`${API_URL}/api/admin/catalogs`);
        if (!response.ok) throw new Error('Failed to fetch catalogs');
        return await response.json();
    },

    async createCatalog(data: Omit<Catalog, '_id'>): Promise<Catalog> {
        const response = await fetch(`${API_URL}/api/admin/catalogs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create catalog');
        return await response.json();
    },

    async updateCatalog(id: string, data: Partial<Catalog>): Promise<Catalog> {
        const response = await fetch(`${API_URL}/api/admin/catalogs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update catalog');
        return await response.json();
    },

    async deleteCatalog(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/api/admin/catalogs/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete catalog');
    },

    // --- Custom Teams ---
    async getCustomTeams(): Promise<CustomTeam[]> {
        const response = await fetch(`${API_URL}/api/admin/teams`);
        if (!response.ok) throw new Error('Failed to fetch custom teams');
        return await response.json();
    },

    async createCustomTeam(data: Omit<CustomTeam, '_id'>): Promise<CustomTeam> {
        const response = await fetch(`${API_URL}/api/admin/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create custom team');
        return await response.json();
    },

    async deleteCustomTeam(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/api/admin/teams/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete custom team');
    }
};
