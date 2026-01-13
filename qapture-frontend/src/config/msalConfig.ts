import { PublicClientApplication } from '@azure/msal-browser';

export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
        redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:3000',
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
    }
};

export const loginRequest = {
    scopes: ['User.Read', 'email', 'profile']
};

export const msalInstance = new PublicClientApplication(msalConfig);
