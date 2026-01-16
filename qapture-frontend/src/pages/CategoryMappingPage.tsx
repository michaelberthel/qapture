import { useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Grid, Card, Button, TextField,
    List, ListItem, ListItemText, IconButton, Divider,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    FormControl, Select, MenuItem, CircularProgress, Alert, Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { adminApi } from '../services/adminApi';

interface Dimension {
    _id: string;
    name: string;
    color: string;
}

interface Mapping {
    _id: string;
    categoryName: string;
    dimensionId: string | null;
}

export default function CategoryMappingPage() {
    const [loading, setLoading] = useState(true);
    const [dimensions, setDimensions] = useState<Dimension[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({}); // categoryName -> dimensionId
    const [categories, setCategories] = useState<string[]>([]);
    const [missingCatalogs, setMissingCatalogs] = useState<{ name: string; count: number }[]>([]);
    const [error, setError] = useState('');

    // Dimension Form
    const [dimName, setDimName] = useState('');
    const [dimColor, setDimColor] = useState('#8884d8');
    const [editingDim, setEditingDim] = useState<Dimension | null>(null);

    const getString = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (val.de) return val.de;
        if (val.default) return val.default;
        return JSON.stringify(val);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [dims, maps, catalogs, missing] = await Promise.all([
                adminApi.getDimensions(),
                adminApi.getMappings(),
                adminApi.getCatalogs(),
                adminApi.getMissingCatalogs()
            ]);

            setDimensions(dims);
            setMissingCatalogs(missing);

            const mapObj: Record<string, string> = {};
            maps.forEach((m: Mapping) => {
                if (m.dimensionId) mapObj[m.categoryName] = m.dimensionId;
            });
            setMappings(mapObj);

            // Extract unique categories from catalogs
            const uniqueCats = new Set<string>();
            catalogs.forEach((cat: any) => {
                let json: any = {};
                try {
                    json = typeof cat.jsonData === 'string' ? JSON.parse(cat.jsonData) : cat.jsonData;
                } catch (e) { return; }

                if (json && Array.isArray(json.pages)) {
                    json.pages.forEach((page: any) => {
                        const name = getString(page.name) || getString(page.title);
                        if (name && name !== 'Bewertungsübersicht') {
                            uniqueCats.add(name);
                        }
                    });
                }
            });
            setCategories(Array.from(uniqueCats).sort());

        } catch (err: any) {
            console.error(err);
            setError('Fehler beim Laden der Daten.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSaveDimension = async () => {
        if (!dimName) return;
        try {
            const payload = {
                id: editingDim?._id,
                name: dimName,
                color: dimColor
            };
            await adminApi.saveDimension(payload);
            setDimName('');
            setDimColor('#8884d8');
            setEditingDim(null);
            loadData(); // reload to refresh list
        } catch (err) {
            alert('Fehler beim Speichern');
        }
    };

    const handleEditDimension = (dim: Dimension) => {
        setEditingDim(dim);
        setDimName(dim.name);
        setDimColor(dim.color);
    };

    const handleDeleteDimension = async (id: string) => {
        if (!window.confirm('Dimension wirklich löschen?')) return;
        try {
            await adminApi.deleteDimension(id);
            loadData();
        } catch (err) {
            alert('Löschen fehlgeschlagen');
        }
    };

    const handleMappingChange = async (category: string, dimId: string) => {
        // Optimistic update
        setMappings(prev => ({ ...prev, [category]: dimId }));

        try {
            await adminApi.saveMapping(category, dimId === 'none' ? null : dimId);
        } catch (err) {
            console.error(err);
            alert('Zuordnung konnte nicht gespeichert werden.');
        }
    };

    if (loading) return <Box p={4} textAlign="center"><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Kategorie-Mapping</Typography>
            <Typography paragraph color="textSecondary">
                Hier können Sie technische Kategorien aus den Katalogen zu übergeordneten Dimensionen zusammenfassen,
                um das Radar-Chart übersichtlicher zu gestalten.
            </Typography>

            <Grid container spacing={4}>
                {/* Left: Dimensions Manager */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>Dimensionen ({dimensions.length})</Typography>

                        <Box mb={2} component={Card} variant="outlined" sx={{ p: 2 }}>
                            <TextField
                                label="Name der Dimension"
                                fullWidth
                                size="small"
                                value={dimName}
                                onChange={(e) => setDimName(e.target.value)}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                label="Farbe (Hex)"
                                fullWidth
                                size="small"
                                value={dimColor}
                                onChange={(e) => setDimColor(e.target.value)}
                                type="color"
                                sx={{ mb: 2 }}
                            />
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleSaveDimension}
                                disabled={!dimName}
                            >
                                {editingDim ? 'Änderung Speichern' : 'Hinzufügen'}
                            </Button>
                            {editingDim && (
                                <Button
                                    size="small"
                                    fullWidth
                                    sx={{ mt: 1 }}
                                    onClick={() => { setEditingDim(null); setDimName(''); setDimColor('#8884d8'); }}
                                >
                                    Abbrechen
                                </Button>
                            )}
                        </Box>

                        <List dense>
                            {dimensions.map(dim => (
                                <div key={dim._id}>
                                    <ListItem
                                        secondaryAction={
                                            <Box>
                                                <IconButton size="small" onClick={() => handleEditDimension(dim)}><EditIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" edge="end" onClick={() => handleDeleteDimension(dim._id)}><DeleteIcon fontSize="small" /></IconButton>
                                            </Box>
                                        }
                                    >
                                        <Box width={16} height={16} bgcolor={dim.color} borderRadius="50%" mr={2} border={1} borderColor="divider" />
                                        <ListItemText primary={dim.name} />
                                    </ListItem>
                                    <Divider />
                                </div>
                            ))}
                        </List>
                    </Paper>
                </Grid>

                {/* Right: Mappings Table */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Kategorie-Zuordnungen</Typography>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Original-Kategorie</TableCell>
                                        <TableCell>Zuordnung</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {categories.map(cat => (
                                        <TableRow key={cat} hover>
                                            <TableCell>{cat}</TableCell>
                                            <TableCell>
                                                <FormControl size="small" fullWidth>
                                                    <Select
                                                        value={mappings[cat] || 'none'}
                                                        onChange={(e) => handleMappingChange(cat, e.target.value)}
                                                        displayEmpty
                                                    >
                                                        <MenuItem value="none"><span style={{ color: '#999', fontStyle: 'italic' }}>Nicht zugeordnet</span></MenuItem>
                                                        {dimensions.map(dim => (
                                                            <MenuItem key={dim._id} value={dim._id}>
                                                                <Box component="span" display="flex" alignItems="center">
                                                                    <Box width={10} height={10} bgcolor={dim.color} borderRadius="50%" mr={1} />
                                                                    {dim.name}
                                                                </Box>
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>

            <Box mt={4}>
                <Typography variant="h6" gutterBottom>Analyse: Fehlende Katalog-Definitionen</Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                    Die folgenden Kataloge werden in Bewertungen referenziert, sind aber nicht im System angelegt.
                    Daher können ihre Kategorien nicht ermittelt und zugeordnet werden.
                </Typography>
                {missingCatalogs.length > 0 ? (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Grid container spacing={2}>
                            {missingCatalogs.map((m: any) => (
                                <Grid item xs={12} sm={6} md={4} key={m.name}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="subtitle2">{m.name}</Typography>
                                        <Chip label={`${m.count} Bewertungen`} size="small" color="warning" variant="outlined" />
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </Paper>
                ) : (
                    <Alert severity="success">Alle in Bewertungen verwendeten Kataloge sind im System vorhanden.</Alert>
                )}
            </Box>
        </Box >
    );
}
