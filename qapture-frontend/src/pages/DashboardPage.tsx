import { useEffect, useState, useMemo } from 'react';
import {
    Box, Grid, Paper, Typography, Tab, Tabs, Card, CardContent, CircularProgress,
    TextField, MenuItem, FormControl, InputLabel, Select, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, type SelectChangeEvent
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
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

    // Filter States for Admin View
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [selectedCatalog, setSelectedCatalog] = useState('All');
    const [selectedEvaluator, setSelectedEvaluator] = useState('All');
    const [selectedEmployee, setSelectedEmployee] = useState('All');

    // Filter States for Statistics View
    const [statsTeam, setStatsTeam] = useState('All');
    const [statsCatalog, setStatsCatalog] = useState('All');
    const [statsEvaluator, setStatsEvaluator] = useState('All');
    const [statsEmployee, setStatsEmployee] = useState('All');

    // Grouping Mode
    const [groupingMode, setGroupingMode] = useState<'project' | 'evaluator' | 'employee'>('project');

    // Metrics State (Personal/Given/Global)
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
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvaluations();
    }, [user]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'count', direction: 'desc' });

    const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const [dPart, tPart] = dateStr.split(', ');
        if (!dPart) return new Date();

        const parts = dPart.split('.');
        if (parts.length !== 3) return new Date();

        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];

        return new Date(`${year}-${month}-${day}T${tPart || '00:00:00'}`);
    };

    const isAnonymized = (email: string) => {
        if (!email) return false;
        // Check if @verbaneum.de exists
        if (!email.includes('@verbaneum.de')) return false;
        // Get part before @
        const localPart = email.split('@')[0];
        // If it DOES NOT contain a dot, it is anonymized (e.g. 123456)
        // Regular names are first.last
        return !localPart.includes('.');
    };

    // Recalculate Basic Metrics (Tabs 0-2)
    useEffect(() => {
        if (!user || evaluations.length === 0) return;

        // 1. Calculate Personal & Given (Unfiltered by dashboard filters, always user specific)
        const received = evaluations.filter(e =>
            e.name === user.email || e.fullData?.surveyresults?.EmployeeEmail === user.email
        );
        const given = evaluations.filter(e =>
            e.bewerter === user.email || e.fullData?.surveyresults?.EvaluatorEmail === user.email
        );

        setReceivedMetrics(processStats(received));
        setGivenMetrics(processStats(given));

        // 2. Calculate Global (Admin only) - Filtered
        if (user.role === 'Admin') {
            let filtered = [...evaluations];

            // Filter Date Range
            if (dateFrom) {
                const dFrom = new Date(dateFrom);
                filtered = filtered.filter(e => parseDate(e.datum) >= dFrom);
            }
            if (dateTo) {
                const dTo = new Date(dateTo);
                // Set to End of Day
                const dToTime = new Date(dateTo);
                dToTime.setHours(23, 59, 59, 999);
                filtered = filtered.filter(e => parseDate(e.datum) <= dToTime);
            }

            // Filter Team (Multi)
            if (selectedTeams.length > 0) {
                filtered = filtered.filter(e => selectedTeams.includes(e.projekt));
            }

            // Filter Catalog
            if (selectedCatalog !== 'All') {
                filtered = filtered.filter(e => e.kriterienkatalog === selectedCatalog);
            }

            // Filter Evaluator
            if (selectedEvaluator !== 'All') {
                filtered = filtered.filter(e => e.bewerter === selectedEvaluator);
            }

            // Filter Employee
            if (selectedEmployee !== 'All') {
                filtered = filtered.filter(e => e.name === selectedEmployee);
            }

            setGlobalMetrics(processStats(filtered));
        }
    }, [evaluations, user, dateFrom, dateTo, selectedTeams, selectedCatalog, selectedEvaluator, selectedEmployee]);

    // Derived Filtered Data for Stats Tab
    const filteredStatsData = useMemo(() => {
        let statsData = [...evaluations];
        // Apply Permission Filtering for Non-Admins implicitly handled by evaluations state (API filtered) per user
        // But we still apply the frontend filters
        if (statsTeam !== 'All') statsData = statsData.filter(e => e.projekt === statsTeam);
        if (statsCatalog !== 'All') statsData = statsData.filter(e => e.kriterienkatalog === statsCatalog);
        if (statsEvaluator !== 'All') statsData = statsData.filter(e => e.bewerter === statsEvaluator);
        if (statsEmployee !== 'All') statsData = statsData.filter(e => e.name === statsEmployee);
        return statsData;
    }, [evaluations, statsTeam, statsCatalog, statsEvaluator, statsEmployee]);

    const calculateDetailedStats = (data: any[]) => {
        if (data.length === 0) return { count: 0, avg: 0, oldest: '-', newest: '-', daysSince: '-' };

        const sorted = [...data].sort((a, b) => parseDate(a.datum).getTime() - parseDate(b.datum).getTime());
        const totalScore = sorted.reduce((acc, curr) => acc + (typeof curr.prozent === 'number' ? curr.prozent : 0), 0);
        const avg = totalScore / sorted.length;

        const oldest = sorted[0].datum.split(',')[0];
        const newest = sorted[sorted.length - 1].datum.split(',')[0];

        const newestDate = parseDate(sorted[sorted.length - 1].datum);
        const diffTime = Math.abs(new Date().getTime() - newestDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return {
            count: data.length,
            avg: avg.toFixed(1),
            oldest,
            newest,
            daysSince: diffDays
        };
    };

    const statsMetrics = useMemo(() => calculateDetailedStats(filteredStatsData), [filteredStatsData]);

    const groupedStatsData = useMemo(() => {
        const groups: Record<string, any[]> = {};

        filteredStatsData.forEach(item => {
            let key = '';
            if (groupingMode === 'project') key = item.projekt;
            else if (groupingMode === 'evaluator') key = item.bewerter;
            else if (groupingMode === 'employee') key = item.name;
            else key = 'Unknown'; // Fallback, though data should always have these fields

            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        let rows = Object.keys(groups).map(key => {
            // Anonymization Filter
            if (groupingMode === 'evaluator' || groupingMode === 'employee') {
                if (isAnonymized(key)) return null;
            }

            const stats = calculateDetailedStats(groups[key]);
            return { key, ...stats };
        }).filter(Boolean) as any[]; // Cast as any to remove nulls

        // Sorting
        if (sortConfig.key) {
            rows.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Convert numbers for sorting
                if (sortConfig.key === 'avg') {
                    aValue = parseFloat(aValue);
                    bValue = parseFloat(bValue);
                }
                if (sortConfig.key === 'newest') { // Date sort
                    // newest is string DD.MM.YYYY
                    // We need a helper or just re-parse. 
                    // To be efficient, we might want raw date in row, but calculateDetailedStats returns string.
                    // Let's parse it quickly.
                    const parseSortDate = (str: string) => {
                        if (str === '-') return 0;
                        const [d, m, y] = str.split('.');
                        return new Date(`${y}-${m}-${d}`).getTime();
                    };
                    aValue = parseSortDate(aValue);
                    bValue = parseSortDate(bValue);
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return rows;
    }, [filteredStatsData, groupingMode, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
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

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    // Derived Options for Dropdowns
    const uniqueTeams = useMemo(() => Array.from(new Set(evaluations.map(e => e.projekt))).filter(Boolean), [evaluations]);
    const uniqueCatalogs = useMemo(() => Array.from(new Set(evaluations.map(e => e.kriterienkatalog))).filter(Boolean), [evaluations]);
    const uniqueEvaluators = useMemo(() => Array.from(new Set(evaluations.map(e => e.bewerter))).filter(Boolean), [evaluations]);
    const uniqueEmployees = useMemo(() => Array.from(new Set(evaluations.map(e => e.name))).filter(Boolean), [evaluations]);

    const getChartTitle = () => {
        if (activeTab === 2) return 'Unternehmensweite Leistungsentwicklung';
        if (activeTab === 1) return 'Entwicklung der vergebenen Bewertungen';
        return 'Leistungsentwicklung';
    };

    const resetFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSelectedTeams([]);
        setSelectedCatalog('All');
        setSelectedEvaluator('All');
        setSelectedEmployee('All');
    };

    const resetStatsFilters = () => {
        setStatsTeam('All');
        setStatsCatalog('All');
        setStatsEvaluator('All');
        setStatsEmployee('All');
    };

    if (loading) {
        return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
    }

    const showGivenTab = user?.role !== 'Mitarbeiter';
    const showGlobalTab = user?.role === 'Admin';
    const showStatsTab = true; // User said "Admins, als auch für alle anderen" -> everyone

    // Calculate correct index for Stats tab
    const statsTabIndex = 1 + (showGivenTab ? 1 : 0) + (showGlobalTab ? 1 : 0);
    const isStatsTabActive = activeTab === statsTabIndex;

    // Determine metrics for the generic view (Tabs 0, 1, 2)
    let currentMetrics = receivedMetrics;
    if (activeTab === 1 && showGivenTab) currentMetrics = givenMetrics;
    else if (activeTab === 2 && showGlobalTab) currentMetrics = globalMetrics;

    // Inserted: update TableHead to be clickable
    const TableHeaderCell = ({ id, label, numeric }: { id: string, label: string, numeric?: boolean }) => (
        <TableCell
            align={numeric ? "right" : "left"}
            onClick={() => requestSort(id)}
            sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { backgroundColor: '#e0e0e0' } }}
        >
            <strong>{label}</strong>
            {sortConfig.key === id && (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')}
        </TableCell>
    );

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
                    {showStatsTab && <Tab label="Statistiken" />}
                </Tabs>
            </Box>

            {/* Admin Filters - Only visible on Global Tab (Tab 2) */}
            {showGlobalTab && activeTab === 2 && (
                <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>Filter (Unternehmensweit)</Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Zeitraum von"
                                type="date"
                                fullWidth
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Zeitraum bis"
                                type="date"
                                fullWidth
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Teams / Projekte</InputLabel>
                                <Select
                                    multiple
                                    value={selectedTeams}
                                    label="Teams / Projekte"
                                    onChange={(e: SelectChangeEvent<typeof selectedTeams>) => {
                                        const { value } = e.target;
                                        setSelectedTeams(typeof value === 'string' ? value.split(',') : value);
                                    }}
                                    renderValue={(selected) => selected.join(', ')}
                                >
                                    {uniqueTeams.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Kriterienkatalog</InputLabel>
                                <Select
                                    value={selectedCatalog}
                                    label="Kriterienkatalog"
                                    onChange={(e: SelectChangeEvent) => setSelectedCatalog(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueCatalogs.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Bewerter</InputLabel>
                                <Select
                                    value={selectedEvaluator}
                                    label="Bewerter"
                                    onChange={(e: SelectChangeEvent) => setSelectedEvaluator(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueEvaluators.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Mitarbeiter</InputLabel>
                                <Select
                                    value={selectedEmployee}
                                    label="Mitarbeiter"
                                    onChange={(e: SelectChangeEvent) => setSelectedEmployee(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueEmployees.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} display="flex" justifyContent="flex-end">
                            <Button variant="text" onClick={resetFilters}>Filter zurücksetzen</Button>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* Statistics Tab Content */}
            {isStatsTabActive && (
                <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>Statistik-Filter</Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Projekt</InputLabel>
                                <Select
                                    value={statsTeam}
                                    label="Projekt"
                                    onChange={(e: SelectChangeEvent) => setStatsTeam(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueTeams.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Kriterienkatalog</InputLabel>
                                <Select
                                    value={statsCatalog}
                                    label="Kriterienkatalog"
                                    onChange={(e: SelectChangeEvent) => setStatsCatalog(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueCatalogs.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Bewerter</InputLabel>
                                <Select
                                    value={statsEvaluator}
                                    label="Bewerter"
                                    onChange={(e: SelectChangeEvent) => setStatsEvaluator(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueEvaluators.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Mitarbeiter</InputLabel>
                                <Select
                                    value={statsEmployee}
                                    label="Mitarbeiter"
                                    onChange={(e: SelectChangeEvent) => setStatsEmployee(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueEmployees.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={12} display="flex" justifyContent="flex-end">
                            <Button variant="text" onClick={resetStatsFilters}>Filter zurücksetzen</Button>
                        </Grid>
                    </Grid>

                    {/* Stats Result Card */}
                    <Box mt={4}>
                        <Typography variant="h6" gutterBottom>Gesamtübersicht</Typography>
                        <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 4 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={6} md={2}>
                                    <Typography variant="body2" color="textSecondary">Anzahl Bewertungen</Typography>
                                    <Typography variant="h5">{statsMetrics.count}</Typography>
                                </Grid>
                                <Grid item xs={6} md={2}>
                                    <Typography variant="body2" color="textSecondary">Durchschnitt</Typography>
                                    <Typography variant="h5" color={parseFloat(statsMetrics.avg) >= 90 ? 'success.main' : parseFloat(statsMetrics.avg) >= 70 ? 'warning.main' : 'error.main'}>
                                        {statsMetrics.avg}%
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="textSecondary">Älteste Bewertung</Typography>
                                    <Typography variant="body1">{statsMetrics.oldest}</Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="textSecondary">Jüngste Bewertung</Typography>
                                    <Typography variant="body1">{statsMetrics.newest}</Typography>
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <Typography variant="body2" color="textSecondary">Tage seit letzter Bew.</Typography>
                                    <Typography variant="h5">{statsMetrics.daysSince}</Typography>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Grouped Data View */}
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6">Detaillierte Auswertung</Typography>
                            <ToggleButtonGroup
                                color="primary"
                                value={groupingMode}
                                exclusive
                                onChange={(e, newMode) => { if (newMode) setGroupingMode(newMode); }}
                                size="small"
                            >
                                <ToggleButton value="project">Projekt/Team</ToggleButton>
                                <ToggleButton value="evaluator">Bewerter</ToggleButton>
                                <ToggleButton value="employee">Mitarbeiter</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                        <TableHeaderCell id="key" label={groupingMode === 'project' ? 'Projekt/Team' : groupingMode === 'evaluator' ? 'Bewerter' : 'Mitarbeiter'} />
                                        <TableHeaderCell id="count" label="Anzahl" numeric />
                                        <TableHeaderCell id="avg" label="Ø Score" numeric />
                                        <TableHeaderCell id="newest" label="Letzte Bew." numeric />
                                        <TableHeaderCell id="daysSince" label="Tage her" numeric />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {groupedStatsData.length > 0 ? groupedStatsData.map((row) => (
                                        <TableRow key={row.key}>
                                            <TableCell>{row.key}</TableCell>
                                            <TableCell align="right">{row.count}</TableCell>
                                            <TableCell align="right">
                                                <Typography color={parseFloat(row.avg) >= 90 ? 'success.main' : parseFloat(row.avg) >= 70 ? 'warning.main' : 'error.main'} variant="body2" fontWeight="bold">
                                                    {row.avg}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">{row.newest}</TableCell>
                                            <TableCell align="right">{row.daysSince}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center">Keine Daten verfügbar</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                </Paper>
            )}

            {/* KPI Cards (Only for Tabs 0, 1, 2 NOT Stats) */}
            {!isStatsTabActive && (
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
            )}

            {/* Charts (Only for Tabs 0, 1, 2 NOT Stats) */}
            {!isStatsTabActive && currentMetrics.count > 0 ? (
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
                        </Paper>
                    </Grid>
                </Grid>
            ) : !isStatsTabActive ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="textSecondary">Keine Daten vorhanden.</Typography>
                </Paper>
            ) : null}
        </Box>
    );
}
