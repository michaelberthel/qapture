import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { deDE } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams, GridFilterModel } from '@mui/x-data-grid';
import { Download as DownloadIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { legacyApi } from '../services/legacyApi';
import { Model } from 'survey-core';
import { useNavigate } from 'react-router-dom';

interface Evaluation {
    id: string;
    projekt: string;
    kriterienkatalog: string;
    bewerter: string;
    name: string;
    datum: string;
    punkte: number;
    prozent: number;
    fullData: any; // Store full JSON for PDF view
}

export default function EvaluationHistoryPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(false);

    // Delete Dialog State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [evalToDelete, setEvalToDelete] = useState<Evaluation | null>(null);

    // Filter State
    const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });

    const handleMyEvaluationsFilter = () => {
        if (!user?.email) return;
        const isAlreadyFiltered = filterModel.items.some(item => item.field === 'bewerter' && item.value === user.email);

        if (isAlreadyFiltered) {
            // Remove filter
            setFilterModel({
                ...filterModel,
                items: filterModel.items.filter(item => item.field !== 'bewerter')
            });
        } else {
            // Add filter
            setFilterModel({
                ...filterModel,
                items: [
                    ...filterModel.items.filter(item => item.field !== 'bewerter'),
                    { field: 'bewerter', operator: 'contains', value: user.email }
                ]
            });
        }
    };

    useEffect(() => {
        const fetchEvaluations = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Determine API URL (using localhost for dev, env var in prod)
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

                const response = await fetch(`${apiUrl}/api/evaluations`, {
                    headers: {
                        // Pass auth context headers
                        'x-user-role': user.role,
                        'x-user-email': user.email,
                        'x-user-teams': JSON.stringify(user.teams?.map(t => t.team.name) || [])
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setEvaluations(data);
                } else {
                    console.error('Failed to fetch evaluations');
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvaluations();
    }, [user]);



    const handleExportPdf = async (row: Evaluation) => {
        setLoading(true);
        try {
            const doc = new jsPDF();
            const evalData = row.fullData.surveyresults;

            // 1. Fetch Catalog to get Schema (for Max Points)
            let questionMeta: Record<string, { label: string, max: number, page: string }> = {};

            try {
                const catalogs = await legacyApi.getCatalogs(evalData.Projekt);
                const matchedCatalog = catalogs.find((c: any) => c.Name === evalData.Kriterienkatalog);

                if (matchedCatalog) {
                    const surveyJson = JSON.parse(matchedCatalog.Jsondata);
                    const surveyModel = new Model(surveyJson);

                    surveyModel.getAllQuestions().forEach(q => {
                        if (q.getType() === 'rating') {
                            questionMeta[q.name] = {
                                label: q.title || q.name,
                                max: (q as any).rateMax || 0,
                                page: (q.page as any)?.title || 'Allgemein'
                            };
                        }
                    });
                }
            } catch (err) {
                console.warn("Could not load catalog definition for PDF details", err);
            }

            // 2. Add Logo
            const img = new Image();
            img.src = '/favicon.png';
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve; // proceed anyway
            });

            doc.addImage(img, 'PNG', 15, 10, 20, 20);

            // 3. Header Text
            doc.setFontSize(22);
            doc.setTextColor(141, 8, 8); // #8d0808 Verbaneum Red
            doc.text("Beurteilung", 50, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 50, 26);

            // 4. Metadata Table (Top Right)
            doc.setFontSize(10);
            doc.setTextColor(0);

            // Layout Meta Info
            const metaX = 15;
            let metaY = 40;

            const addMetaRow = (label: string, value: string) => {
                doc.setFont("helvetica", "bold");
                doc.text(label + ":", metaX, metaY);
                doc.setFont("helvetica", "normal");
                doc.text(String(value), metaX + 40, metaY);
                metaY += 6;
            };

            addMetaRow("Mitarbeiter", evalData.Name);
            addMetaRow("Projekt", evalData.Projekt);
            addMetaRow("Kriterienkatalog", evalData.Kriterienkatalog);
            addMetaRow("Datum", evalData.Datum);
            addMetaRow("Bewerter", evalData.Bewertername);

            // Score Summary Box
            doc.setDrawColor(141, 8, 8);
            doc.setLineWidth(0.5);
            doc.roundedRect(140, 35, 55, 30, 3, 3);

            doc.setFontSize(12);
            doc.setTextColor(141, 8, 8);
            doc.text("Gesamtergebnis", 167.5, 45, { align: 'center' });

            doc.setFontSize(18);
            doc.setTextColor(0);
            doc.text(`${evalData.Prozent}%`, 167.5, 55, { align: 'center' });

            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`${evalData.Punkte} von ${evalData.Erreichbare_Punkte} Punkten`, 167.5, 62, { align: 'center' });

            // 5. Results Table
            const tableBody: any[] = [];

            // Helper to get comment
            const getComment = (key: string) => {
                // Try standard SurveyJS suffixes
                let val = evalData[key + "-Comment"] || evalData[key + "Comment"];
                if (val) return val;

                // Try German "Begründung-" prefix seen in user data
                val = evalData["Begründung-" + key] || evalData["Begründung_" + key];
                if (val) return val;

                // Try English "Comment-" prefix just in case
                val = evalData["Comment-" + key] || evalData["Comment_" + key];
                return val;
            };

            // Standard excluded keys
            const excludedKeys = ["Name", "Projekt", "Kriterienkatalog", "Datum", "Bewertername", "Punkte", "Erreichbare_Punkte", "Prozent", "EvaluatorEmail", "EvaluationDate", "EmployeeID", "EmployeeName", "EmployeeEmail", "Team"];

            Object.keys(evalData).forEach(key => {
                if (excludedKeys.includes(key) || typeof evalData[key] === 'object') return;

                // Skip standalone comment fields to keep table clean
                const isCommentKey = key.endsWith("-Comment") ||
                    key.endsWith("Comment") ||
                    key.startsWith("Begründung-") ||
                    key.startsWith("Begründung_") ||
                    key.startsWith("Comment-") ||
                    key.startsWith("Comment_");

                if (isCommentKey) return;

                // Resolve Meta
                let meta = questionMeta[key];
                if (!meta) {
                    const spaceKey = key.replace(/_/g, ' ');
                    const foundKey = Object.keys(questionMeta).find(k => k === spaceKey || k === key);
                    if (foundKey) meta = questionMeta[foundKey];
                }

                let questionText = meta ? meta.label : key.replace(/_/g, ' ');
                const answerValue = evalData[key];
                const page = meta ? meta.page : '';

                // Determine Score Column
                let scoreText = "-";
                let isTextAnswer = false;

                if (meta && meta.max > 0) {
                    scoreText = `${answerValue} / ${meta.max}`;
                } else if (typeof answerValue === 'number') {
                    scoreText = String(answerValue);
                } else if (typeof answerValue === 'string' && answerValue.trim() !== "") {
                    // It's a text answer (like PID or Anlass)
                    // Append value to the label with a colon
                    questionText = `${questionText}: ${answerValue}`;
                    // Mark as text answer to apply styling
                    isTextAnswer = true;
                }

                if (isTextAnswer) {
                    tableBody.push([
                        page,
                        { content: questionText, styles: { fontStyle: 'bold' } },
                        scoreText
                    ]);
                } else {
                    tableBody.push([
                        page,
                        questionText,
                        scoreText
                    ]);
                }

                // Add Comment Row if exists
                const comment = getComment(key);
                if (comment) {
                    tableBody.push([
                        {
                            content: `Anmerkung: ${comment}`,
                            colSpan: 3,
                            styles: { fontStyle: 'italic', textColor: 100, fontSize: 8, cellPadding: { top: 1, bottom: 2, left: 5 } }
                        }
                    ]);
                }
            });

            // AutoTable Call
            autoTable(doc, {
                startY: 80,
                head: [['Kategorie', 'Kriterium', 'Punkte']],
                body: tableBody,
                theme: 'grid',
                styles: {
                    fontSize: 9,
                    cellPadding: 3
                },
                headStyles: {
                    fillColor: [141, 8, 8], // #8d0808
                    textColor: 255,
                    fontStyle: 'bold'
                },
                columnStyles: {
                    0: { cellWidth: 40, fontStyle: 'bold', textColor: [100, 100, 100] },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 30, halign: 'center', fontStyle: 'bold' }
                },
                didDrawPage: (data: any) => {
                    // Footer
                    const pageCount = (doc.internal as any).getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    doc.text(`Seite ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
                }
            });

            doc.save(`Beurteilung_${evalData.Name}_${evalData.Datum.replace(/[:.]/g, '-')}.pdf`);

        } catch (error) {
            console.error("PDF Export failed", error);
            alert("Fehler beim Exportieren des PDFs.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (evaluation: Evaluation) => {
        setEvalToDelete(evaluation);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!evalToDelete) return;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${apiUrl}/api/evaluations/${evalToDelete.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // Remove from state
                setEvaluations(prev => prev.filter(e => e.id !== evalToDelete.id));
                setDeleteDialogOpen(false);
                setEvalToDelete(null);
            } else {
                alert('Fehler beim Löschen');
            }
        } catch (error) {
            console.error('Delete error', error);
            alert('Fehler beim Löschen');
        }
    };

    const handleEditClick = (evaluation: Evaluation) => {
        // Navigate to NewEvaluationPage in 'edit' mode
        navigate('/evaluation/new', {
            state: {
                mode: 'edit',
                evaluation: evaluation
            }
        });
    };

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 90 },
        { field: 'projekt', headerName: 'Projekt', width: 130 },
        { field: 'kriterienkatalog', headerName: 'Katalog', width: 150 },
        { field: 'bewerter', headerName: 'Bewerter', width: 150 },
        { field: 'name', headerName: 'Name', width: 150 },
        {
            field: 'datum',
            headerName: 'Datum',
            width: 170,
            valueGetter: (value: any) => {
                if (!value) return null;
                const [datePart, timePart] = value.split(', ');
                if (!datePart || !timePart) return null;
                const [day, month, year] = datePart.split('.');
                return new Date(`${year}-${month}-${day}T${timePart}`);
            },
            valueFormatter: (value: any) => {
                if (!value) return '';
                if (!(value instanceof Date) || isNaN(value.getTime())) return value;
                return new Intl.DateTimeFormat('de-DE', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }).format(value);
            }
        },
        { field: 'punkte', headerName: 'Punkte', width: 100, type: 'number' },
        {
            field: 'prozent',
            headerName: 'Prozent',
            width: 110,
            type: 'number',
            renderCell: (params: GridRenderCellParams) => (
                <Chip
                    label={`${params.value}%`}
                    color={params.value >= 90 ? 'success' : params.value >= 70 ? 'warning' : 'error'}
                    size="small"
                />
            )
        },
        {
            field: 'actions',
            headerName: 'Aktionen',
            width: 150,
            renderCell: (params: GridRenderCellParams) => (
                <Box>
                    <Tooltip title="PDF Anzeigen/Download">
                        <IconButton onClick={() => handleExportPdf(params.row)} size="small">
                            <DownloadIcon />
                        </IconButton>
                    </Tooltip>

                    {/* Hide Edit/Delete for Mitarbeiter */}
                    {user?.role !== 'Mitarbeiter' && (
                        <>
                            <Tooltip title="Bearbeiten">
                                <IconButton onClick={() => handleEditClick(params.row)} size="small" color="primary">
                                    <EditIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Löschen">
                                <IconButton onClick={() => handleDeleteClick(params.row)} size="small" color="error">
                                    <DeleteIcon />
                                </IconButton>
                            </Tooltip>
                        </>
                    )}
                </Box>
            )
        }
    ];

    return (
        <Box sx={{ height: 600, width: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h4">
                    Beurteilungshistorie
                </Typography>
                <Button variant="outlined" onClick={handleMyEvaluationsFilter}>
                    {filterModel.items.some(item => item.field === 'bewerter' && item.value === user?.email) ? 'Alle Bewertungen anzeigen' : 'Meine Bewertungen'}
                </Button>
            </Box>

            <Paper elevation={2} sx={{ height: '100%', p: 1 }}>
                <DataGrid
                    rows={evaluations}
                    columns={columns}
                    loading={loading}
                    initialState={{
                        pagination: {
                            paginationModel: { page: 0, pageSize: 10 },
                        },
                        sorting: {
                            sortModel: [{ field: 'datum', sort: 'desc' }],
                        },
                    }}
                    pageSizeOptions={[5, 10, 25]}
                    disableRowSelectionOnClick
                    slots={{ toolbar: GridToolbar }}
                    slotProps={{
                        toolbar: {
                            showQuickFilter: true,
                        },
                        pagination: {
                            labelRowsPerPage: 'Zeilen pro Seite:',
                            labelDisplayedRows: ({ from, to, count }: any) =>
                                `${from}–${to} von ${count !== -1 ? count : `mehr als ${to}`}`,
                        }
                    }}
                    localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                />
            </Paper>

            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Bewertung löschen?</DialogTitle>
                <DialogContent>
                    {evalToDelete && (
                        <Typography>
                            Sind Sie sicher, dass Sie die Bewertung von <strong>{evalToDelete.name}</strong> vom <strong>{evalToDelete.datum}</strong> mit <strong>{evalToDelete.punkte}</strong> Punkten löschen möchten?
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
                    <Button onClick={confirmDelete} color="error" variant="contained">Löschen</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
