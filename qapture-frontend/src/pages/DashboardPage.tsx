import { Typography, Paper, Box, Chip, Grid } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
    const { user } = useAuth();

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Willkommen, {user?.displayName}!
            </Typography>

            <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Mein Profil</Typography>
                        <Typography><strong>Email:</strong> {user?.email}</Typography>
                        <Typography component="div" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <strong>Rolle:</strong> <Chip label={user?.role} color="primary" size="small" />
                        </Typography>
                    </Paper>
                </Grid>

                {(user?.role === 'ProjektQM' || user?.role === 'ProjektKoordinator') && (
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>Meine Teams (Legacy)</Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {user?.teams?.map((ut) => (
                                    <Chip key={ut.team.name} label={ut.team.name} variant="outlined" />
                                )) || <Typography color="text.secondary">Keine Teams zugewiesen</Typography>}
                            </Box>
                        </Paper>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}
