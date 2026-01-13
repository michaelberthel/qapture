import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-browser';
import { loginRequest } from '../config/msalConfig';
import type { User } from '../types/user';
import apiClient from '../services/api';

interface AuthContextType {
    user: User | null;
    originalUser: User | null; // Track the original admin user
    isImpersonating: boolean;
    isLoading: boolean;
    error: string | null;
    login: () => void;
    logout: () => void;
    getToken: () => Promise<string | null>;
    impersonateUser: (email: string) => Promise<void>;
    stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to fetch legacy data (Role & Teams)
const fetchLegacyUserData = async (email: string, baseUser: User): Promise<User> => {
    const updatedUser = { ...baseUser };
    try {
        const legacyUrl = import.meta.env.VITE_LEGACY_API_URL;
        const legacyKey = import.meta.env.VITE_LEGACY_API_KEY;

        if (legacyUrl && legacyKey) {
            // A) Fetch Role (Position)
            const roleResponse = await fetch(`${legacyUrl}/${legacyKey}/position?user=${email}`);
            if (roleResponse.ok) {
                const data = await roleResponse.json();
                // Expected format: [{"position":"Admin"}]
                if (Array.isArray(data) && data.length > 0 && data[0].position) {
                    const legacyRole = data[0].position.trim();

                    // Map Legacy Role to App Role
                    if (legacyRole === 'Admin') updatedUser.role = 'Admin';
                    else if (legacyRole === 'Projektqualitätsmanager') updatedUser.role = 'ProjektQM';
                    else if (legacyRole === 'Projektkoordinator') updatedUser.role = 'ProjektKoordinator';
                    // else keep 'Mitarbeiter'
                }
            }

            // B) Fetch Teams (if not Admin and not Mitarbeiter)
            if (updatedUser.role === 'ProjektQM' || updatedUser.role === 'ProjektKoordinator') {
                const teamResponse = await fetch(`${legacyUrl}/${legacyKey}/role?user=${email}`);
                if (teamResponse.ok) {
                    const teamData = await teamResponse.json();
                    // Expected: [{"Projekt":"verbaneum"}, ...]
                    if (Array.isArray(teamData)) {
                        updatedUser.teams = teamData.map((t: any, index: number) => ({
                            teamId: index + 1, // Temporary ID
                            team: {
                                id: index + 1,
                                name: t.Projekt,
                                description: 'Legacy Team'
                            },
                            isManager: true // Assume manager for assigned teams in these roles
                        }));
                        console.log('Fetched teams for', email, updatedUser.teams);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Failed to fetch legacy data for', email, err);
    }
    return updatedUser;
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const { instance, accounts, inProgress } = useMsal();
    const [user, setUser] = useState<User | null>(null);
    const [originalUser, setOriginalUser] = useState<User | null>(null); // For impersonation
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const activeAccount = accounts[0];

    useEffect(() => {
        const initializeUser = async () => {
            if (activeAccount && !originalUser) { // Only initialize if not already impersonating
                // Prevent login loop: Show loading immediately
                setIsLoading(true);

                // 1. Basic info from Azure AD (Set immediately to show "Logged In" state)
                const basicUser: User = {
                    azureAdObjectId: activeAccount.localAccountId,
                    email: activeAccount.username,
                    displayName: activeAccount.name || 'User',
                    role: 'Mitarbeiter', // Fallback default
                };

                // Optimistic update
                setUser(basicUser);

                // 2. Fetch role from Legacy API
                const fullUser = await fetchLegacyUserData(activeAccount.username, basicUser);

                // Final update with Role/Teams
                setUser(fullUser);
                setIsLoading(false);
            } else if (!activeAccount && !originalUser) {
                setUser(null);
                setIsLoading(false);
            }
        };

        initializeUser();
    }, [activeAccount, originalUser]);

    const getToken = async (): Promise<string | null> => {
        if (!activeAccount) return null;

        try {
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: activeAccount,
            });
            return response.accessToken;
        } catch (error) {
            if (error instanceof InteractionRequiredAuthError) {
                await instance.acquireTokenRedirect(loginRequest);
                return null;
            }
            console.error('Token acquisition failed', error);
            return null;
        }
    };

    const login = async () => {
        try {
            setError(null);
            const response = await instance.loginPopup(loginRequest);
            // Popup returns the account directly, but useMsal hook will also update
            if (response.account) {
                instance.setActiveAccount(response.account);
            }
        } catch (e: any) {
            console.error('Login Error:', e);
            setError(e.message || 'Login failed. Please check popup blockers.');
        }
    };

    const logout = () => {
        // Clear impersonation state on logout
        setOriginalUser(null);
        instance.logoutPopup({
            postLogoutRedirectUri: window.location.origin,
            mainWindowRedirectUri: window.location.origin
        });
        setUser(null);
    };

    const impersonateUser = async (email: string) => {
        if (!user || user.role !== 'Admin') {
            console.error("Only admins can impersonate");
            return;
        }

        setIsLoading(true);
        try {
            // Save current user as original if not already impersonating
            if (!originalUser) {
                setOriginalUser(user);
            }

            // Create base simulated user
            const simulatedBaseUser: User = {
                azureAdObjectId: 'simulated-' + email,
                email: email,
                displayName: `Simulated: ${email}`,
                role: 'Mitarbeiter'
            };

            // Fetch real legacy data for this user
            const fullSimulatedUser = await fetchLegacyUserData(email, simulatedBaseUser);

            setUser(fullSimulatedUser);
        } catch (err) {
            console.error("Impersonation failed", err);
            setError("Impersonation failed");
        } finally {
            setIsLoading(false);
        }
    };

    const stopImpersonation = () => {
        if (originalUser) {
            setUser(originalUser);
            setOriginalUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            originalUser,
            isImpersonating: !!originalUser,
            isLoading,
            error,
            login,
            logout,
            getToken,
            impersonateUser,
            stopImpersonation
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
