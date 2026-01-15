import { useEffect, useState, useMemo } from 'react';
import {
    Box, Paper, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, MenuItem, Chip, OutlinedInput, Select, FormControl, InputLabel,
    Checkbox, ListItemText, CircularProgress, Alert, FormControlLabel, Tabs, Tab,
    List, ListItem, ListItemSecondaryAction, Grid, ListItemText as MuiListItemText
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import { deDE } from '@mui/x-data-grid/locales';
import { Edit as EditIcon, Refresh as RefreshIcon, CloudSync as CloudSyncIcon, Delete as DeleteIcon, Add as AddIcon, ImportExport as ImportIcon } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { personioApi } from '../services/personioApi';
import type { Employee } from '../services/personioApi';
import { adminApi, type Catalog, type CustomTeam } from '../services/adminApi';
import { legacyApi } from '../services/legacyApi';
import SurveyCreatorWidget from '../components/SurveyCreatorWidget';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

export default function AdminPage() {
    const { user } = useAuth();
    const [tabIndex, setTabIndex] = useState(0);

    // --- Employee State ---
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [empLoading, setEmpLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [showOnlyOverrides, setShowOnlyOverrides] = useState(false);
    const [empError, setEmpError] = useState<string | null>(null);

    // Edit Employee
    const [openEmpDialog, setOpenEmpDialog] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [editRole, setEditRole] = useState('Mitarbeiter');
    const [editTeams, setEditTeams] = useState<string[]>([]);
    const [empSaving, setEmpSaving] = useState(false);


    // --- Team State ---
    const [customTeams, setCustomTeams] = useState<CustomTeam[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    const [newTeamName, setNewTeamName] = useState('');
    const [createTeamLoading, setCreateTeamLoading] = useState(false);

    // --- Catalog State ---
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [catLoading, setCatLoading] = useState(false);
    const [catError, setCatError] = useState<string | null>(null);

    // Create/Edit Catalog
    const [openCatDialog, setOpenCatDialog] = useState(false);
    const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null); // null = new
    const [catName, setCatName] = useState('');
    const [catProjects, setCatProjects] = useState<string[]>([]);
    const [catJson, setCatJson] = useState('');
    const [catSaving, setCatSaving] = useState(false);
    const [importing, setImporting] = useState(false);


    // Initial Data Load
    useEffect(() => {
        if (tabIndex === 0) fetchEmployees();
        if (tabIndex === 1) fetchTeams();
        if (tabIndex === 2) fetchCatalogs();
    }, [tabIndex]);

    // --- Employee Handlers ---
    const fetchEmployees = async () => {
        setEmpLoading(true);
        setEmpError(null);
        try {
            const data = await personioApi.getEmployees();
            setEmployees(data);
            try {
                const { lastSync } = await personioApi.getLastSync();
                setLastSyncTime(lastSync);
            } catch (e) { console.warn(e); }
        } catch (err) {
            setEmpError("Fehler beim Laden der Mitarbeiter.");
        } finally {
            setEmpLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            await personioApi.syncEmployees();
            fetchEmployees();
        } catch (err) {
            alert('Sync fehlgeschlagen');
        } finally {
            setSyncing(false);
        }
    };

    const handleEditEmp = (emp: Employee) => {
        setSelectedEmployee(emp);
        setEditRole(emp.role);
        setEditTeams(emp.rawTeams ? [...emp.rawTeams] : []);
        setOpenEmpDialog(true);
    };

    const handleSaveEmp = async () => {
        if (!selectedEmployee) return;
        setEmpSaving(true);
        try {
            await personioApi.saveOverride(selectedEmployee.email, editRole, editTeams);
            setOpenEmpDialog(false);
            fetchEmployees();
        } catch (err) {
            alert('Speichern fehlgeschlagen');
        } finally {
            setEmpSaving(false);
        }
    };

    const handleResetEmp = async () => {
        if (!selectedEmployee || !confirm('Zurücksetzen?')) return;
        setEmpSaving(true);
        try {
            await personioApi.deleteOverride(selectedEmployee.email);
            setOpenEmpDialog(false);
            fetchEmployees();
        } catch (err) {
            alert('Reset fehlgeschlagen');
        } finally {
            setEmpSaving(false);
        }
    };

    // Filtered employees logic
    const filteredEmployees = useMemo(() => {
        if (!showOnlyOverrides) return employees;
        return employees.filter(e => e.isOverridden);
    }, [employees, showOnlyOverrides]);

    // Combined Team List for Dropdowns
    const allAvailableTeams = useMemo(() => {
        const set = new Set<string>();
        employees.forEach(e => e.rawTeams.forEach(t => set.add(t)));
        customTeams.forEach(t => set.add(t.name));
        return Array.from(set).sort();
    }, [employees, customTeams]);

    const employeeColumns: GridColDef[] = [
        { field: 'firstName', headerName: 'Vorname', width: 130 },
        { field: 'lastName', headerName: 'Nachname', width: 130 },
        { field: 'email', headerName: 'E-Mail', width: 220 },
        { field: 'position', headerName: 'Personio Position', width: 200 },
        {
            field: 'role', headerName: 'Rolle', width: 150, renderCell: (p: GridRenderCellParams) => (
                <Box>{p.value} {p.row.isOverridden && <Chip label="M" size="small" color="primary" sx={{ ml: 1 }} />}</Box>
            )
        },
        {
            field: 'teams', headerName: 'Teams', width: 300, renderCell: (p: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, overflowX: 'auto' }}>
                    {p.row.rawTeams.map((t: string) => <Chip key={t} label={t} size="small" />)}
                </Box>
            )
        },
        {
            field: 'actions', headerName: 'Aktionen', width: 80, renderCell: (p: GridRenderCellParams) => (
                <IconButton onClick={() => handleEditEmp(p.row as Employee)}><EditIcon /></IconButton>
            )
        }
    ];


    // --- Team Handlers ---
    const fetchTeams = async () => {
        setTeamLoading(true);
        try {
            const data = await adminApi.getCustomTeams();
            setCustomTeams(data);
            if (employees.length === 0) fetchEmployees();
        } catch (err) {
            setTeamError("Fehler beim Laden der Teams");
        } finally {
            setTeamLoading(false);
        }
    };

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return;
        setCreateTeamLoading(true);
        try {
            await adminApi.createCustomTeam({ name: newTeamName });
            setNewTeamName('');
            fetchTeams();
        } catch (err) {
            alert('Team konnte nicht erstellt werden (Duplikat?)');
        } finally {
            setCreateTeamLoading(false);
        }
    };

    const handleDeleteTeam = async (id: string, name: string) => {
        if (!confirm(`Team "${name}" wirklich löschen?`)) return;
        try {
            await adminApi.deleteCustomTeam(id);
            fetchTeams();
        } catch (err) {
            alert('Löschen fehlgeschlagen');
        }
    };


    // --- Catalog Handlers ---
    const fetchCatalogs = async () => {
        setCatLoading(true);
        try {
            const data = await adminApi.getCatalogs();
            setCatalogs(data);
            if (customTeams.length === 0) fetchTeams();
        } catch (err) {
            setCatError("Fehler beim Laden der Kataloge");
        } finally {
            setCatLoading(false);
        }
    };

    const handleOpenCatDialog = (cat?: Catalog) => {
        if (cat) {
            setSelectedCatalog(cat);
            setCatName(cat.name);
            setCatProjects(cat.projects || []);
            setCatJson(typeof cat.jsonData === 'string' ? cat.jsonData : JSON.stringify(cat.jsonData, null, 2));
        } else {
            setSelectedCatalog(null);
            setCatName('');
            setCatProjects([]);
            setCatJson('{\n  "pages": [\n    {\n      "name": "page1",\n      "elements": []\n    }\n  ]\n}'); // Default empty survey
        }
        setOpenCatDialog(true);
    };

    const handleSaveCatalog = async () => {
        if (!catName || !catJson) return;
        setCatSaving(true);
        try {
            let parsed;
            try {
                parsed = JSON.parse(catJson);
            } catch (e) {
                alert("Ungültiges JSON!");
                setCatSaving(false);
                return;
            }

            const payload = {
                name: catName,
                projects: catProjects,
                jsonData: catJson
            };

            if (selectedCatalog) {
                await adminApi.updateCatalog(selectedCatalog._id, payload);
            } else {
                await adminApi.createCatalog(payload as any);
            }
            setOpenCatDialog(false);
            fetchCatalogs();
        } catch (err) {
            alert('Speichern fehlgeschlagen');
        } finally {
            setCatSaving(false);
        }
    };

    const handleDeleteCatalog = async (id: string) => {
        if (!confirm('Katalog wirklich löschen?')) return;
        try {
            await adminApi.deleteCatalog(id);
            fetchCatalogs();
        } catch (err) {
            alert('Löschen fehlgeschlagen');
        }
    };

    const handleImportFromLegacy = async () => {
        if (!confirm('Dies wird alle bekannten Teams nach Legacy-Katalogen durchsuchen und fehlende importieren. Dies kann einen Moment dauern. Fortfahren?')) return;
        setImporting(true);
        try {
            // Collect all known teams
            const allTeams = new Set<string>();
            employees.forEach(e => e.rawTeams.forEach(t => allTeams.add(t)));
            customTeams.forEach(t => allTeams.add(t.name));

            let count = 0;
            // Iterate and fetch
            for (const team of allTeams) {
                try {
                    const legacyCats = await legacyApi.getCatalogs(team);
                    for (const lcat of legacyCats) {
                        // Check exact name match to avoid duplicates
                        const exists = catalogs.find(c => c.name === lcat.Name);
                        if (!exists) {
                            await adminApi.createCatalog({
                                name: lcat.Name,
                                projects: [team], // Assign to the team we found it in
                                jsonData: lcat.Jsondata
                            });
                            count++;
                        } else {
                            // If exists, ensure this team is assigned
                            if (exists.projects && !exists.projects.includes(team)) {
                                await adminApi.updateCatalog(exists._id, {
                                    projects: [...(exists.projects || []), team]
                                });
                            }
                        }
                    }
                } catch (e) {
                    // Ignore errors for teams without legacy catalogs
                }
            }
            alert(`${count} neue Kataloge importiert.`);
            fetchCatalogs(); // Refresh
        } catch (err) {
            alert('Import fehlgeschlagen');
            console.error(err);
        } finally {
            setImporting(false);
        }
    };

    if (user?.role !== 'Admin') return <Alert severity="error">Zugriff verweigert</Alert>;

    return (
        <Box width="100%">
            <Paper square elevation={1}>
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} indicatorColor="primary" textColor="primary">
                    <Tab label="Mitarbeiter" />
                    <Tab label="Teams & Projekte" />
                    <Tab label="Kriterienkataloge" />
                </Tabs>
            </Paper>

            {/* TAB 0: MITARBEITER */}
            <TabPanel value={tabIndex} index={0}>
                <Box display="flex" justifyContent="space-between" mb={2}>
                    <Typography variant="h5">Mitarbeiter verwalten</Typography>
                    <Box display="flex" alignItems="center">
                        {lastSyncTime && (
                            <Typography variant="caption" color="textSecondary" sx={{ mr: 2 }}>
                                Letzter Sync: {new Date(lastSyncTime).toLocaleString('de-DE')}
                            </Typography>
                        )}
                        <Button
                            startIcon={syncing ? <CircularProgress size={20} /> : <CloudSyncIcon />}
                            onClick={handleSync} variant="contained" disabled={syncing} sx={{ mr: 2 }} color="secondary">
                            Sync Personio
                        </Button>
                        <Button startIcon={<RefreshIcon />} onClick={fetchEmployees}>Refresh</Button>
                    </Box>
                </Box>

                <FormControlLabel control={<Checkbox checked={showOnlyOverrides} onChange={e => setShowOnlyOverrides(e.target.checked)} />} label="Nur manuelle Änderungen" />

                <Paper sx={{ height: 600, width: '100%', mt: 2 }}>
                    <DataGrid
                        rows={filteredEmployees} columns={employeeColumns}
                        getRowId={(r) => r.email} loading={empLoading}
                        pageSizeOptions={[10, 25, 100]}
                        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                        localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                    />
                </Paper>
            </TabPanel>

            {/* TAB 1: TEAMS */}
            <TabPanel value={tabIndex} index={1}>
                <Typography variant="h5" gutterBottom>Teams & Projekte verwalten</Typography>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Custom Teams erstellen</Typography>
                            <Box display="flex" gap={1} mb={2}>
                                <TextField
                                    label="Team Name" size="small" fullWidth
                                    value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                                />
                                <Button variant="contained" onClick={handleCreateTeam} disabled={createTeamLoading || !newTeamName}>
                                    <AddIcon />
                                </Button>
                            </Box>
                            <List>
                                {customTeams.map(team => (
                                    <ListItem key={team._id} divider>
                                        <MuiListItemText primary={team.name} secondary="Manuell erstellt" />
                                        <ListItemSecondaryAction>
                                            <IconButton edge="end" onClick={() => handleDeleteTeam(team._id, team.name)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                                {customTeams.length === 0 && <Typography color="textSecondary">Keine eigenen Teams angelegt.</Typography>}
                            </List>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Personio Teams (Read-Only)</Typography>
                            <Typography variant="body2" color="textSecondary" mb={2}>
                                Diese Teams werden automatisch aus Personio importiert.
                            </Typography>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                                {Array.from(new Set(employees.flatMap(e => e.rawTeams))).sort().map(t => (
                                    <Chip key={t} label={t} />
                                ))}
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </TabPanel>

            {/* TAB 2: KATALOGE */}
            <TabPanel value={tabIndex} index={2}>
                <Box display="flex" justifyContent="space-between" mb={2}>
                    <Typography variant="h5">Kriterienkataloge</Typography>
                    <Box>
                        <Button
                            startIcon={importing ? <CircularProgress size={20} /> : <ImportIcon />}
                            onClick={handleImportFromLegacy}
                            disabled={importing}
                            sx={{ mr: 2 }}
                            variant="outlined"
                            color="warning"
                        >
                            Import Legacy
                        </Button>
                        <Button startIcon={<AddIcon />} variant="contained" onClick={() => handleOpenCatDialog()}>
                            Neuer Katalog
                        </Button>
                    </Box>
                </Box>

                <Paper sx={{ p: 0 }}>
                    <List>
                        {catalogs.map(cat => (
                            <ListItem key={cat._id} divider>
                                <MuiListItemText
                                    primary={cat.name}
                                    secondary={`Zugewiesen an: ${cat.projects?.join(', ') || 'Keine'}`}
                                />
                                <ListItemSecondaryAction>
                                    <IconButton onClick={() => handleOpenCatDialog(cat)}><EditIcon /></IconButton>
                                    <IconButton onClick={() => handleDeleteCatalog(cat._id)} color="error"><DeleteIcon /></IconButton>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                        {catalogs.length === 0 && <Typography p={2} color="textSecondary">Keine Kataloge vorhanden.</Typography>}
                    </List>
                </Paper>
            </TabPanel>

            {/* EMPLOYEE EDIT DIALOG */}
            <Dialog open={openEmpDialog} onClose={() => setOpenEmpDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
                <DialogContent>
                    {selectedEmployee && (
                        <Box pt={1} display="flex" flexDirection="column" gap={2}>
                            <Typography variant="h6">{selectedEmployee.fullName}</Typography>
                            <FormControl fullWidth size="small">
                                <InputLabel>Rolle</InputLabel>
                                <Select value={editRole} label="Rolle" onChange={(e) => setEditRole(e.target.value)}>
                                    <MenuItem value="Mitarbeiter">Mitarbeiter</MenuItem>
                                    <MenuItem value="Admin">Admin</MenuItem>
                                    <MenuItem value="ProjektQM">Projektqualitätsmanager</MenuItem>
                                    <MenuItem value="ProjektKoordinator">Projektkoordinator</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel>Teams zuweisen</InputLabel>
                                <Select
                                    multiple
                                    value={editTeams}
                                    onChange={(e: SelectChangeEvent<string[]>) => {
                                        const val = e.target.value;
                                        setEditTeams(typeof val === 'string' ? val.split(',') : val as string[]);
                                    }}
                                    input={<OutlinedInput label="Teams zuweisen" />}
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map((value) => <Chip key={value} label={value} size="small" />)}
                                        </Box>
                                    )}
                                >
                                    {allAvailableTeams.map((name) => (
                                        <MenuItem key={name} value={name}>
                                            <Checkbox checked={editTeams.indexOf(name) > -1} />
                                            <ListItemText primary={name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    {selectedEmployee?.isOverridden && <Button color="error" onClick={handleResetEmp}>Reset</Button>}
                    <Button onClick={() => setOpenEmpDialog(false)}>Abbrechen</Button>
                    <Button onClick={handleSaveEmp} variant="contained" disabled={empSaving}>Speichern</Button>
                </DialogActions>
            </Dialog>

            {/* CATALOG EDIT DIALOG */}
            <Dialog open={openCatDialog} onClose={() => setOpenCatDialog(false)} maxWidth="xl" fullWidth>
                <DialogTitle>{selectedCatalog ? 'Katalog bearbeiten' : 'Neuer Katalog'}</DialogTitle>
                <DialogContent>
                    <Box pt={1} display="flex" flexDirection="column" gap={2}>
                        <TextField label="Name" fullWidth value={catName} onChange={e => setCatName(e.target.value)} />

                        <FormControl fullWidth>
                            <InputLabel>Zuweisung an Teams</InputLabel>
                            <Select
                                multiple
                                value={catProjects}
                                onChange={(e: SelectChangeEvent<string[]>) => {
                                    const val = e.target.value;
                                    setCatProjects(typeof val === 'string' ? val.split(',') : val as string[]);
                                }}
                                input={<OutlinedInput label="Zuweisung an Teams" />}
                                renderValue={(selected) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => <Chip key={value} label={value} size="small" />)}</Box>}
                            >
                                {allAvailableTeams.map((name) => (
                                    <MenuItem key={name} value={name}>
                                        <Checkbox checked={catProjects.indexOf(name) > -1} />
                                        <ListItemText primary={name} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <div style={{ border: '1px solid #ddd', marginTop: 16 }}>
                            <SurveyCreatorWidget
                                json={catJson}
                                onSave={(newJson) => setCatJson(newJson)}
                            />
                        </div>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCatDialog(false)}>Abbrechen</Button>
                    <Button onClick={handleSaveCatalog} variant="contained" disabled={catSaving}>Speichern</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}
