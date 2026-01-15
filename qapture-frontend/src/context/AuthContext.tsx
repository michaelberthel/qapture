import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

import { loginRequest } from '../config/msalConfig';
import type { User } from '../types/user';


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

import { personioApi } from '../services/personioApi';


// Helper to fetch Personio data (Role & Teams)
const fetchPersonioUserData = async (email: string, baseUser: User): Promise<User> => {
    const updatedUser = { ...baseUser };
    try {
        // Fetch from new backend API (which integrates Personio & Overrides)
        const employee = await personioApi.getUser(email);

        if (employee) {
            // Map Role
            // Type assertion to ensure string matches union type if needed, 
            // but backend returns compatible strings ('Admin', 'ProjektQM', etc)
            if (['Admin', 'ProjektQM', 'ProjektKoordinator', 'Mitarbeiter'].includes(employee.role)) {
                updatedUser.role = employee.role as User['role'];
            }

            // Map Teams
            if (employee.teams && employee.teams.length > 0) {
                updatedUser.teams = employee.teams.map((t, index) => ({
                    teamId: index + 1, // Generate ID
                    team: {
                        id: index + 1,
                        name: t.team.name,
                        description: 'Personio Team'
                    },
                    isManager: true // Assume manager for assigned teams (previously only for QM/Coord)
                }));
            }
            console.log('Fetched Personio data for', email, updatedUser);
        }
    } catch (err) {
        console.error('Failed to fetch Personio data for', email, err);
        // Fallback or just keep basic user? Use basic.
    }
    return updatedUser;
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const { instance, accounts } = useMsal();
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

                // 2. Fetch role from Personio API
                const fullUser = await fetchPersonioUserData(activeAccount.username, basicUser);

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

            // Fetch real Personio data for this user
            const fullSimulatedUser = await fetchPersonioUserData(email, simulatedBaseUser);

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
