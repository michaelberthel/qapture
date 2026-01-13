import type { LegacyEmployee, LegacyCatalog } from '../types/legacy';

const LEGACY_API_URL = import.meta.env.VITE_LEGACY_API_URL;
const LEGACY_API_KEY = import.meta.env.VITE_LEGACY_API_KEY;

export const legacyApi = {
    async getEmployees(teamName: string): Promise<LegacyEmployee[]> {
        if (!LEGACY_API_URL || !LEGACY_API_KEY) {
            console.error('Legacy API configuration missing');
            return [];
        }

        try {
            const response = await fetch(`${LEGACY_API_URL}/${LEGACY_API_KEY}/list?team=${encodeURIComponent(teamName)}`);
            if (!response.ok) throw new Error('Failed to fetch employees');
            return await response.json();
        } catch (error) {
            console.error('Error fetching employees:', error);
            return [];
        }
    },

    async getCatalogs(teamName: string): Promise<LegacyCatalog[]> {
        if (!LEGACY_API_URL || !LEGACY_API_KEY) {
            console.error('Legacy API configuration missing');
            return [];
        }

        try {
            const response = await fetch(`${LEGACY_API_URL}/${LEGACY_API_KEY}/kriterienkatalog?projekt=${encodeURIComponent(teamName)}`);
            if (!response.ok) throw new Error('Failed to fetch catalogs');
            return await response.json();
        } catch (error) {
            console.error('Error fetching catalogs:', error);
            return [];
        }
    }
};
