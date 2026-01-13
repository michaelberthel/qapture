import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    CircularProgress,
    Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { legacyApi } from '../services/legacyApi';
import type { LegacyEmployee, LegacyCatalog } from '../types/legacy';

export default function EvaluationsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // State
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [employees, setEmployees] = useState<LegacyEmployee[]>([]);
    const [catalogs, setCatalogs] = useState<LegacyCatalog[]>([]);

    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
    const [selectedCatalogId, setSelectedCatalogId] = useState<number | ''>('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial Team Selection
    useEffect(() => {
        if (user?.teams && user.teams.length > 0) {
            // Auto-select if only one team, otherwise empty
            if (user.teams.length === 1) {
                setSelectedTeam(user.teams[0].team.name);
            }
        }
    }, [user]);

    // Fetch Data when Team Changes
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedTeam) return;

            setLoading(true);
            setError(null);
            try {
                const [empData, catData] = await Promise.all([
                    legacyApi.getEmployees(selectedTeam),
                    legacyApi.getCatalogs(selectedTeam)
                ]);
                setEmployees(empData);
                setCatalogs(catData);
            } catch (err) {
                console.error(err);
                setError('Fehler beim Laden der Daten.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedTeam]);

    const handleStartEvaluation = () => {
        const employee = employees.find(e => e.id === selectedEmployeeId);
        const catalog = catalogs.find(c => c.id === selectedCatalogId);

        if (employee && catalog) {
            navigate('/evaluation/new', {
                state: {
                    employee,
                    catalog,
                    teamName: selectedTeam
                }
            });
        }
    };

    if (!user) return null;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Neue Beurteilung starten</Typography>

            <Paper sx={{ p: 4, mt: 3, maxWidth: 800 }}>
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <Grid container spacing={4}>
                    {/* Team Selection */}
                    <Grid item xs={12}>
                        <FormControl fullWidth disabled={user.teams?.length === 1}>
                            <InputLabel>Team wählen</InputLabel>
                            <Select
                                value={selectedTeam}
                                label="Team wählen"
                                onChange={(e) => {
                                    setSelectedTeam(e.target.value);
                                    setSelectedEmployeeId('');
                                    setSelectedCatalogId('');
                                }}
                            >
                                {user.teams?.map((ut) => (
                                    <MenuItem key={ut.team.id} value={ut.team.name}>
                                        {ut.team.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Employee & Catalog Selection (Only if team selected) */}
                    {selectedTeam && (
                        <>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth disabled={loading}>
                                    <InputLabel>Mitarbeiter</InputLabel>
                                    <Select
                                        value={selectedEmployeeId}
                                        label="Mitarbeiter"
                                        onChange={(e) => setSelectedEmployeeId(e.target.value as number)}
                                    >
                                        {employees.map((emp) => (
                                            <MenuItem key={emp.id} value={emp.id}>
                                                {emp.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth disabled={loading}>
                                    <InputLabel>Kriterienkatalog</InputLabel>
                                    <Select
                                        value={selectedCatalogId}
                                        label="Kriterienkatalog"
                                        onChange={(e) => setSelectedCatalogId(e.target.value as number)}
                                    >
                                        {catalogs.map((cat) => (
                                            <MenuItem key={cat.id} value={cat.id}>
                                                {cat.Name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </>
                    )}

                    {loading && (
                        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
                            <CircularProgress />
                        </Grid>
                    )}

                    <Grid item xs={12}>
                        <Button
                            variant="contained"
                            size="large"
                            fullWidth
                            disabled={!selectedTeam || !selectedEmployeeId || !selectedCatalogId || loading}
                            onClick={handleStartEvaluation}
                        >
                            Bewertung starten
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
}
