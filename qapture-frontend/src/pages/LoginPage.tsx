import { Box, Button, Card, CardContent, Container, Typography, Alert } from '@mui/material';
import { Microsoft as MicrosoftIcon } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

import { useMsal } from '@azure/msal-react';

export default function LoginPage() {
    const { login, user, isLoading, error } = useAuth();
    const { accounts, inProgress } = useMsal();

    console.log('LoginPage Debug:', { user, isLoading, error, accounts, inProgress });

    if (isLoading) {
        return <Box display="flex" justifyContent="center" alignItems="center" height="100vh">Loading...</Box>;
    }

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <Container maxWidth="sm">
            <Box
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                minHeight="100vh"
            >
                <Card sx={{ width: '100%', py: 4, px: 2, textAlign: 'center' }}>
                    <CardContent>
                        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                            {/* Use public folder path directly */}
                            <img src="/logo.png" alt="Qapture Logo" style={{ maxWidth: '200px' }} />
                        </Box>
                        <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                            Quality Management Tool
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
                                {error}
                            </Alert>
                        )}
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<MicrosoftIcon />}
                            onClick={login}
                            sx={{ py: 1.5, px: 4, fontSize: '1.1rem' }}
                        >
                            Sign in with Microsoft
                        </Button>

                        <Typography variant="body2" color="text.disabled" sx={{ mt: 4 }}>
                            Protected Area. Authorized Access Only.
                        </Typography>


                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
}
