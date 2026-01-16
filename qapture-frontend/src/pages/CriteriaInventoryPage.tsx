import { useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, CircularProgress, Alert, Chip, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { adminApi } from '../services/adminApi';

interface CriteriaRow {
    id: string;
    catalogName: string;
    teams: string[];
    category: string;
    questionName: string;
    questionTitle: string;
    type: string;
    maxScore: number | string;
}

export default function CriteriaInventoryPage() {
    const [loading, setLoading] = useState(true);
    const [allRows, setAllRows] = useState<CriteriaRow[]>([]);
    const [filteredRows, setFilteredRows] = useState<CriteriaRow[]>([]);
    const [error, setError] = useState('');

    // Filter State
    const [selectedTeam, setSelectedTeam] = useState<string>('Alle');
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);

    const getString = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (val.de) return val.de;
        if (val.default) return val.default;
        return JSON.stringify(val);
    };

    useEffect(() => {
        const load = async () => {
            try {
                const catalogs = await adminApi.getCatalogs();
                const newRows: CriteriaRow[] = [];
                const teamSet = new Set<string>();

                catalogs.forEach(cat => {
                    // Collect teams
                    cat.projects?.forEach(t => teamSet.add(t));

                    let json: any = {};
                    if (typeof cat.jsonData === 'string') {
                        try { json = JSON.parse(cat.jsonData); } catch (e) { return; }
                    } else {
                        json = cat.jsonData;
                    }

                    if (!json || !Array.isArray(json.pages)) return;

                    json.pages.forEach((page: any) => {
                        const categoryName = getString(page.name) || getString(page.title) || 'Seite ohne Namen';
                        if (Array.isArray(page.elements)) {
                            page.elements.forEach((el: any) => {
                                let maxScore: number | string = '-';
                                if (el.rateMax !== undefined) maxScore = el.rateMax;
                                else if (el.choices) maxScore = `${el.choices.length} (Auswahl)`;

                                newRows.push({
                                    id: `${cat._id}_${el.name}`,
                                    catalogName: cat.name,
                                    teams: cat.projects || [],
                                    category: categoryName,
                                    questionName: el.name,
                                    questionTitle: getString(el.title) || el.name,
                                    type: el.type,
                                    maxScore: maxScore
                                });
                            });
                        }
                    });
                });

                setAllRows(newRows);
                setFilteredRows(newRows);
                setAvailableTeams(Array.from(teamSet).sort());
            } catch (err) {
                console.error(err);
                setError('Fehler beim Laden der Kriterien.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Filter Effect
    useEffect(() => {
        if (selectedTeam === 'Alle') {
            setFilteredRows(allRows);
        } else {
            setFilteredRows(allRows.filter(r => r.teams.includes(selectedTeam)));
        }
    }, [selectedTeam, allRows]);

    if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Kriterien-Inventar</Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
                Eine Übersicht aller Kriterien aus den aktuell aktiven Kriterienkatalogen.
            </Typography>

            <Box mb={3}>
                <Paper sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <Typography fontWeight="bold">Filter:</Typography>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Team / Projekt</InputLabel>
                            <Select
                                value={selectedTeam}
                                label="Team / Projekt"
                                onChange={(e) => setSelectedTeam(e.target.value)}
                            >
                                <MenuItem value="Alle"><em>Alle anzeigen</em></MenuItem>
                                {availableTeams.map(t => (
                                    <MenuItem key={t} value={t}>{t}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Chip label={`${filteredRows.length} Kriterien gefunden`} />
                    </Box>
                </Paper>
            </Box>

            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell><strong>Katalog</strong></TableCell>
                            <TableCell><strong>Teams</strong></TableCell>
                            <TableCell><strong>Kategorie (Page)</strong></TableCell>
                            <TableCell><strong>Kriterium (ID)</strong></TableCell>
                            <TableCell><strong>Titel / Frage</strong></TableCell>
                            <TableCell><strong>Typ</strong></TableCell>
                            <TableCell><strong>Max</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredRows.map((row) => (
                            <TableRow key={row.id} hover>
                                <TableCell>{row.catalogName}</TableCell>
                                <TableCell>
                                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                                        {row.teams.map(t => <Chip key={t} label={t} size="small" sx={{ fontSize: '0.7rem' }} />)}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip label={row.category} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{row.questionName}</TableCell>
                                <TableCell>{row.questionTitle}</TableCell>
                                <TableCell sx={{ fontSize: '0.85rem' }}>{row.type}</TableCell>
                                <TableCell>{row.maxScore}</TableCell>
                            </TableRow>
                        ))}
                        {filteredRows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">Keine Kriterien für diesen Filter gefunden.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
