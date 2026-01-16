import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('authToken');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export const evaluationApi = {
    getAll: async (user: any) => {
        // Fallback to empty object if user is null (though should be handled by caller)
        const safeUser = user || {};

        console.log("API: Fetching evaluations for user:", safeUser.email, safeUser.role);

        const response = await apiClient.get<any>('/evaluations', {
            headers: {
                'x-user-role': safeUser.role || '',
                'x-user-email': safeUser.email || '',
                'x-user-teams': JSON.stringify(safeUser.teams?.map((t: any) => t.team.name) || [])
            }
        });
        if (response.data && response.data._debug) {
            console.log("BACKEND DEBUG INFO:", response.data._debug);
            return response.data.data;
        }
        return response.data;
    },
};

export default apiClient;
