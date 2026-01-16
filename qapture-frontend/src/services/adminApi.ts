
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface Catalog {
    _id: string;
    name: string;
    projects: string[];
    jsonData: string;
    isActive?: boolean;
    version?: number;
    rootId?: string;
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

    async duplicateCatalog(id: string, newName?: string): Promise<Catalog> {
        const response = await fetch(`${API_URL}/api/admin/catalogs/${id}/duplicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName })
        });
        if (!response.ok) throw new Error('Failed to duplicate catalog');
        return await response.json();
    },

    async createNewVersion(id: string): Promise<Catalog> {
        const response = await fetch(`${API_URL}/api/admin/catalogs/${id}/version`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to create new version');
        return await response.json();
    },

    // --- Dimensions & Mappings ---
    async getDimensions() {
        const response = await fetch(`${API_URL}/api/admin/dimensions`, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch dimensions');
        return response.json();
    },

    async saveDimension(data: any) {
        const response = await fetch(`${API_URL}/api/admin/dimensions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to save dimension');
        return response.json();
    },

    async deleteDimension(id: string) {
        const response = await fetch(`${API_URL}/api/admin/dimensions/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to delete dimension');
    },

    async getMappings() {
        const response = await fetch(`${API_URL}/api/admin/mappings`, { headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch mappings');
        return response.json();
    },

    async saveMapping(categoryName: string, dimensionId: string | null) {
        const response = await fetch(`${API_URL}/api/admin/mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryName, dimensionId })
        });
        if (!response.ok) throw new Error('Failed to save mapping');
        return await response.json();
    },

    async getMissingCatalogs(): Promise<{ name: string; count: number }[]> {
        const response = await fetch(`${API_URL}/api/admin/analysis/missing-catalogs`);
        if (!response.ok) throw new Error('Failed to fetch analysis');
        return await response.json();
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
