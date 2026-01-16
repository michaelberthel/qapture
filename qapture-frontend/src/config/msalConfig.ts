import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
console.log('MSAL Config Debug:', {
    hasClientId: !!clientId,
    clientIdLength: clientId?.length,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI
});

export const msalConfig = {
    auth: {
        clientId: clientId || 'MISSING_CLIENT_ID', // Explicit fallback to see in error
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
        redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
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
