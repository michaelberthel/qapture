import { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography, Tab, Tabs, Card, CardContent, CircularProgress } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

interface DashboardMetric {
    count: number;
    avgScore: number;
    lastDate: string | null;
    trendData: any[];
}

export default function DashboardPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState(0); // 0 = Received (Meine Leistung), 1 = Given (Meine Bewertungen)

    // Metrics
    const [receivedMetrics, setReceivedMetrics] = useState<DashboardMetric>({ count: 0, avgScore: 0, lastDate: null, trendData: [] });
    const [givenMetrics, setGivenMetrics] = useState<DashboardMetric>({ count: 0, avgScore: 0, lastDate: null, trendData: [] });
    const [globalMetrics, setGlobalMetrics] = useState<DashboardMetric>({ count: 0, avgScore: 0, lastDate: null, trendData: [] });

    useEffect(() => {
        const fetchEvaluations = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const response = await fetch(`${apiUrl}/api/evaluations`, {
                    headers: {
                        'x-user-role': user.role,
                        'x-user-email': user.email,
                        'x-user-teams': JSON.stringify(user.teams?.map(t => t.team.name) || [])
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setEvaluations(data);
                    calculateMetrics(data, user.email || '');
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvaluations();
    }, [user]);

    const calculateMetrics = (data: any[], userEmail: string) => {
        // Filter: Received (Name or EmployeeEmail matches user)
        const received = data.filter(e =>
            e.name === userEmail || e.fullData?.surveyresults?.EmployeeEmail === userEmail
        );

        // Filter: Given (Bewertername or EvaluatorEmail matches user)
        const given = data.filter(e =>
            e.bewerter === userEmail || e.fullData?.surveyresults?.EvaluatorEmail === userEmail
        );

        setReceivedMetrics(processStats(received));
        setGivenMetrics(processStats(given));

        // Global: All data (visible to Admin because API returns all for Admin)
        if (user?.role === 'Admin') {
            setGlobalMetrics(processStats(data));
        }
    };

    const processStats = (subset: any[]): DashboardMetric => {
        if (subset.length === 0) return { count: 0, avgScore: 0, lastDate: null, trendData: [] };

        // Sort by date ascending for charts
        const sorted = [...subset].sort((a, b) => {
            const dateA = parseDate(a.datum);
            const dateB = parseDate(b.datum);
            return dateA.getTime() - dateB.getTime();
        });

        const totalScore = sorted.reduce((acc, curr) => acc + (typeof curr.prozent === 'number' ? curr.prozent : 0), 0);
        const avg = totalScore / sorted.length;

        // Trend Data (Last 10 or all)
        const trend = sorted.map(e => ({
            date: e.datum.split(',')[0], // Just DD.MM.YYYY
            score: e.prozent,
            name: e.name
        }));

        return {
            count: subset.length,
            avgScore: parseFloat(avg.toFixed(1)),
            lastDate: sorted[sorted.length - 1].datum,
            trendData: trend
        };
    };

    const parseDate = (dateStr: string) => {
        // Expected format: DD.MM.YYYY, HH:mm:ss
        const [dPart, tPart] = dateStr.split(', ');
        if (!dPart) return new Date();
        const [day, month, year] = dPart.split('.');
        return new Date(`${year}-${month}-${day}T${tPart || '00:00:00'}`);
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    if (loading) {
        return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
    }

    const showGivenTab = user?.role !== 'Mitarbeiter';
    const showGlobalTab = user?.role === 'Admin';

    // Determine metrics based on tab
    let currentMetrics = receivedMetrics;
    if (activeTab === 1) currentMetrics = givenMetrics;
    if (activeTab === 2) currentMetrics = globalMetrics;

    const getChartTitle = () => {
        if (activeTab === 2) return 'Unternehmensweite Leistungsentwicklung';
        if (activeTab === 1) return 'Entwicklung der vergebenen Bewertungen';
        return 'Leistungsentwicklung';
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Dashboard
            </Typography>

            {/* Profile Section */}
            <Paper elevation={1} sx={{ p: 2, mb: 4, display: 'flex', gap: 2, alignItems: 'center', backgroundColor: '#f9f9f9' }}>
                <Box>
                    <Typography variant="h6">{user?.name}</Typography>
                    <Typography variant="body2" color="textSecondary">{user?.email}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>Rolle:</strong> {user?.role}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Teams:</strong> {user?.teams?.map(t => t.team.name).join(', ') || 'Keine'}
                    </Typography>
                </Box>
            </Paper>

            <Box borderBottom={1} borderColor="divider" mb={3}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                    <Tab label="Meine Leistung" />
                    {showGivenTab && <Tab label="Durchgeführte Bewertungen" />}
                    {showGlobalTab && <Tab label="Unternehmensweit" />}
                </Tabs>
            </Box>

            {/* KPI Cards */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} md={4}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Anzahl Bewertungen
                            </Typography>
                            <Typography variant="h3" color="primary">
                                {currentMetrics.count}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Durchschnitt (Gesamt)
                            </Typography>
                            <Typography variant="h3" sx={{ color: currentMetrics.avgScore >= 90 ? 'success.main' : currentMetrics.avgScore >= 70 ? 'warning.main' : 'error.main' }}>
                                {currentMetrics.avgScore}%
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Letzte Aktivität
                            </Typography>
                            <Typography variant="h5">
                                {currentMetrics.lastDate || '-'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Charts */}
            {currentMetrics.count > 0 ? (
                <Grid container spacing={3}>
                    <Grid item xs={12} lg={8}>
                        <Paper elevation={2} sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                {getChartTitle()}
                            </Typography>
                            <Box height={300}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={currentMetrics.trendData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis domain={[0, 100]} />
                                        <Tooltip />
                                        <Line
                                            type="monotone"
                                            dataKey="score"
                                            stroke="#8d0808"
                                            strokeWidth={2}
                                            activeDot={{ r: 8 }}
                                            name="Prozentpunkte"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Additional smaller chart or list could go here */}
                    <Grid item xs={12} lg={4}>
                        <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom>
                                Hinweise
                            </Typography>
                            <Typography variant="body2" paragraph>
                                {activeTab === 0 && "Hier sehen Sie Ihre persönliche Leistungsentwicklung basierend auf den erhaltenen Bewertungen."}
                                {activeTab === 1 && "Hier sehen Sie die Statistiken aller Bewertungen, die Sie als Bewerter durchgeführt haben."}
                                {activeTab === 2 && "Übersicht über alle Bewertungen im Unternehmen."}
                            </Typography>
                            {/* Potential Distribution Chart Placeholder */}
                        </Paper>
                    </Grid>
                </Grid>
            ) : (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="textSecondary">Keine Daten vorhanden.</Typography>
                </Paper>
            )}
        </Box>
    );
}
