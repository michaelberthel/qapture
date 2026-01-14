import axios from 'axios';

let token = null;
let tokenExpiry = null;
let employeeCache = null;
let cacheExpiry = null;
let lastFetchTime = null;

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const PersonioService = {
    async getAuthToken() {
        if (token && tokenExpiry && new Date() < tokenExpiry) {
            return token;
        }

        try {
            const response = await axios.post(`${process.env.PERSONIO_API_URL}/auth`, {
                client_id: process.env.PERSONIO_CLIENT_ID,
                client_secret: process.env.PERSONIO_CLIENT_SECRET
            });

            token = response.data.data.token;
            // Token usually implies expiry, but let's assume valid for a while or check headers
            // Personio tokens are often valid for ~1 hour. Let's refresh aggressively to be safe.
            const expiresIn = 3000; // Assume 50 mins default if not provided
            tokenExpiry = new Date(new Date().getTime() + expiresIn * 1000);
            return token;
        } catch (error) {
            console.error('Personio Auth Error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Personio');
        }
    },

    async fetchAllEmployees(options = {}) {
        if (!options.force && employeeCache && cacheExpiry && new Date() < cacheExpiry) {
            return employeeCache;
        }

        const authToken = await this.getAuthToken();
        let allEmployees = [];
        let offset = 0;
        let limit = 200;
        let moreAvailable = true;

        try {
            while (moreAvailable) {
                const response = await axios.get(`${process.env.PERSONIO_API_URL}/company/employees`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                    params: { limit, offset }
                });

                const data = response.data.data;
                if (Array.isArray(data)) {
                    allEmployees = [...allEmployees, ...data];
                    if (data.length < limit) {
                        moreAvailable = false;
                    } else {
                        offset += limit;
                    }
                } else {
                    moreAvailable = false;
                }
            }

            // Transform Data
            const processed = allEmployees
                .filter(e => e.attributes.status.value === 'active') // Only active
                .map(e => this.mapEmployee(e));

            // Cache
            employeeCache = processed;
            cacheExpiry = new Date(new Date().getTime() + CACHE_DURATION);
            lastFetchTime = new Date(); // Update sync time

            return processed;
        } catch (error) {
            console.error('Personio Fetch Error:', error.response?.data || error.message);
            throw new Error('Failed to fetch employees from Personio');
        }
    },

    getLastSyncTime() {
        return lastFetchTime;
    },

    mapEmployee(raw) {
        const attr = raw.attributes;
        const position = attr.position.value || '';

        // Determine Role
        let role = 'Mitarbeiter';
        if (position.includes('Geschäftsführer')) role = 'Admin';
        else if (position.includes('Projektqualitätsmanager')) role = 'ProjektQM';
        else if (position.includes('Projektkoordinator')) role = 'ProjektKoordinator';

        // Determine Teams
        // team (Object) + dynamic_10575991 (String) + dynamic_10575993 (String)
        const teams = [];

        // Main Team
        if (attr.team && attr.team.value && attr.team.value.attributes) {
            teams.push(attr.team.value.attributes.name); // Correctly access nested name
        }

        // Dynamic Teams (Team 2, Team 3)
        // Note: Field names might change per tenant, but user provided these IDs.
        // We should handle empty strings gracefully.
        if (attr.dynamic_10575991 && attr.dynamic_10575991.value) teams.push(attr.dynamic_10575991.value);
        if (attr.dynamic_10575993 && attr.dynamic_10575993.value) teams.push(attr.dynamic_10575993.value);

        // Deduplicate
        const uniqueTeams = [...new Set(teams)].filter(Boolean);

        return {
            id: attr.id.value,
            email: attr.email.value,
            firstName: attr.first_name.value,
            lastName: attr.last_name.value,
            fullName: `${attr.first_name.value} ${attr.last_name.value}`,
            position: position,
            role: role, // Default calculated role
            teams: uniqueTeams.map(name => ({
                team: { name: name }
            })), // Match structure expected by frontend usually
            rawTeams: uniqueTeams // simpler list
        };
    }
};
