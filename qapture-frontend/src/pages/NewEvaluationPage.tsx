import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/survey-core.min.css';
import { Box, Paper, Typography, Button } from '@mui/material';
import type { LegacyEmployee, LegacyCatalog } from '../types/legacy';
import { legacyApi } from '../services/legacyApi';
import { useAuth } from '../hooks/useAuth';
import type { Employee } from '../services/personioApi';
import type { Catalog } from '../services/adminApi';
import { adminApi } from '../services/adminApi';

interface PageState {
    employee?: LegacyEmployee; // Legacy
    catalog?: LegacyCatalog;   // Legacy
    newEmployee?: Employee;    // New
    newCatalog?: Catalog;      // New
    teamName?: string;
    mode?: 'new' | 'edit';
    evaluation?: any; // Full evaluation object from history
}

export default function NewEvaluationPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [surveyModel, setSurveyModel] = useState<Model | null>(null);

    useEffect(() => {
        const state = location.state as PageState;

        // Handle direct access or missing state
        if (!state || (!state.catalog && !state.evaluation && !state.newCatalog)) {
            navigate('/evaluations');
            return;
        }

        const loadEditMode = async () => {
            if (state.mode === 'edit' && state.evaluation) {
                const evalData = state.evaluation;
                const surveyResults = evalData.fullData.surveyresults;
                const teamName = surveyResults.Projekt;
                const catalogName = surveyResults.Kriterienkatalog;

                // Try to load via Admin API first (New System)
                // TODO: Check if we have efficient fetch. For now fetch all.
                // Or fallback to Legacy if not found.
                // Assuming "Edit" primarily uses stored data, but we need the Survey JSON structure.
                try {
                    // Try legacy first for compatibility with existing records
                    // If we migrate fully, this changes.
                    // Let's keep Legacy fetch for now as per previous logic.
                    // If not found in legacy, maybe try new Admin API?
                    const catalogs = await legacyApi.getCatalogs(teamName);
                    const matchedCatalog = catalogs.find(c => c.Name === catalogName);

                    if (matchedCatalog) {
                        // ... Legacy loading logic ...
                        const surveyJson = JSON.parse(matchedCatalog.Jsondata);
                        const survey = new Model(surveyJson);

                        // Restore logic (reused from existing code logic, but abbreviated here as I need to restore full function body if replacing)
                        const restoredData: any = {};
                        Object.keys(surveyResults).forEach(key => {
                            restoredData[key] = surveyResults[key];
                            const spaceKey = key.replace(/_/g, ' ');
                            if (spaceKey !== key) restoredData[spaceKey] = surveyResults[key];
                        });

                        if (surveyResults.Datum && typeof surveyResults.Datum === 'string') {
                            const [dPart, tPart] = surveyResults.Datum.split(', ');
                            if (dPart && tPart) {
                                const [dd, mm, yyyy] = dPart.split('.');
                                restoredData["Datum"] = `${yyyy}-${mm}-${dd}T${tPart.substring(0, 5)}`;
                            }
                        }

                        survey.data = restoredData;

                        ["Projekt", "Kriterienkatalog", "Name"].forEach(f => {
                            const q = survey.getQuestionByName(f);
                            if (q) q.readOnly = true;
                        });

                        configureSurvey(survey, {
                            existingId: evalData.id
                        });
                        return; // Done
                    }

                    // Fallback: Try Admin API (MongoDB Catalogs)
                    try {
                        // We import adminApi inside or assume it is available (need to import it at top)
                        // Dynamic import or assume it handles it? Let's add import at top or use fetch directly? 
                        // Better to use adminApi service.
                        const allCatalogs = await adminApi.getCatalogs();
                        const mongoCatalog = allCatalogs.find((c: any) => c.name === catalogName);

                        if (mongoCatalog) {
                            const surveyJson = typeof mongoCatalog.jsonData === 'string' ? JSON.parse(mongoCatalog.jsonData) : mongoCatalog.jsonData;
                            const survey = new Model(surveyJson);

                            // Restore Logic (Duplicated from above - should be refactored but inline for safety now)
                            const restoredData: any = {};
                            Object.keys(surveyResults).forEach(key => {
                                restoredData[key] = surveyResults[key];
                                const spaceKey = key.replace(/_/g, ' ');
                                if (spaceKey !== key) restoredData[spaceKey] = surveyResults[key];
                            });

                            if (surveyResults.Datum && typeof surveyResults.Datum === 'string') {
                                const [dPart, tPart] = surveyResults.Datum.split(', ');
                                if (dPart && tPart) {
                                    const [dd, mm, yyyy] = dPart.split('.');
                                    restoredData["Datum"] = `${yyyy}-${mm}-${dd}T${tPart.substring(0, 5)}`;
                                }
                            }
                            survey.data = restoredData;

                            ["Projekt", "Kriterienkatalog", "Name"].forEach(f => {
                                const q = survey.getQuestionByName(f);
                                if (q) q.readOnly = true;
                            });

                            configureSurvey(survey, {
                                existingId: evalData.id
                            });
                            return;
                        }

                    } catch (err) {
                        console.error("Fallback catalog fetch failed", err);
                    }


                    // What if not found in legacy? Potentially new catalog type?
                    // We assume for now edits work via legacy as previous.
                } catch (e) {
                    console.error(e);
                }
                // Fallback error
                alert("Originalkatalog nicht mehr gefunden. Bearbeitung nicht möglich.");
                navigate('/evaluations');

            } else if ((state.catalog && state.employee) || (state.newCatalog && state.newEmployee)) {
                // New Mode
                try {
                    let surveyJson: any;
                    let catalogName = '';
                    let empName = '';
                    let empId = '';
                    let empEmail = '';

                    if (state.newCatalog && state.newEmployee) {
                        // NEW API
                        surveyJson = typeof state.newCatalog.jsonData === 'string' ? JSON.parse(state.newCatalog.jsonData) : state.newCatalog.jsonData;
                        catalogName = state.newCatalog.name;
                        empName = state.newEmployee.fullName;
                        empId = state.newEmployee.id.toString();
                        empEmail = state.newEmployee.email;
                    } else if (state.catalog && state.employee) {
                        // LEGACY API
                        surveyJson = JSON.parse(state.catalog.Jsondata);
                        catalogName = state.catalog.Name;
                        empName = state.employee.name;
                        empId = String(state.employee.personioid);
                        empEmail = state.employee.email;
                    }

                    const survey = new Model(surveyJson);

                    // Helper to get local datetime string
                    const now = new Date();
                    const offset = now.getTimezoneOffset();
                    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
                    const formattedDate = localDate.toISOString().slice(0, 16);

                    survey.mergeData({
                        "Datum": formattedDate,
                        "Projekt": state.teamName,
                        "Kriterienkatalog": catalogName,
                        "Name": empName,
                        "EmployeeID": empId,
                        "EmployeeName": empName,
                        "EmployeeEmail": empEmail,
                        "Team": state.teamName,
                        "EvaluatorEmail": user?.email,
                        "EvaluationDate": new Date().toISOString()
                    });

                    // Locks
                    ["Projekt", "Kriterienkatalog", "Name"].forEach(f => {
                        const q = survey.getQuestionByName(f);
                        if (q) q.readOnly = true;
                    });

                    configureSurvey(survey, state);

                } catch (e) {
                    console.error("Error init new survey", e);
                }
            }
        };

        loadEditMode();

    }, [location, navigate, user]);

    // Common configuration helper
    const configureSurvey = (survey: Model, context: any) => {
        survey.onComplete.add((sender) => {
            // ... calculation logic ...
            // We need to duplicate the calc logic here or extract it?
            // For now, let's keep it but handle the Save action based on context.existingId
            handleComplete(sender, context.existingId);
        });
        setSurveyModel(survey);
    };

    const handleComplete = (sender: Model, existingId?: string) => {
        const data = sender.data;
        // ... (copy existing calc logic here or reused) ...
        // To be safe, I will include the calc logic again inside this function to ensure it has scope.

        const questions = sender.getAllQuestions();
        let points = 0;
        let maxPoints = 0;

        questions.forEach((q) => {
            if (!q.isVisible) return;
            if (q.getType() === 'rating') {
                const val = q.value;
                if (val !== undefined && val !== null) points += Number(val);
                const qMax = (q as any).rateMax;
                if (qMax !== undefined) maxPoints += Number(qMax);
            }
        });

        const percent = maxPoints > 0 ? ((points / maxPoints) * 100).toFixed(2) : "0.00";

        const sanitizedResults: Record<string, any> = {};
        // Meta
        sanitizedResults["Bewertername"] = data["EvaluatorEmail"] || user?.email;
        sanitizedResults["Projekt"] = data["Projekt"];
        sanitizedResults["Kriterienkatalog"] = data["Kriterienkatalog"];

        // Date formatting logic
        let formattedDatum = data["Datum"];
        if (formattedDatum && formattedDatum.includes('T')) {
            try {
                const d = new Date(formattedDatum);
                if (!isNaN(d.getTime())) {
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    const seconds = "00";
                    formattedDatum = `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
                }
            } catch (e) { console.warn("Date formatting failed", e); }
        }
        sanitizedResults["Datum"] = formattedDatum;
        // FIX: User requires Email in the 'Name' field for correct association
        sanitizedResults["Name"] = data["EmployeeEmail"] || data["Name"];

        sanitizedResults["Punkte"] = points;
        sanitizedResults["Erreichbare_Punkte"] = maxPoints;
        sanitizedResults["Prozent"] = percent;

        // Copy other data
        Object.keys(data).forEach(key => {
            if (["EvaluatorEmail", "EvaluationDate", "EmployeeID", "EmployeeName", "EmployeeEmail", "Team", "Punkte", "Erreichbare_Punkte", "Prozent", "Projekt", "Kriterienkatalog", "Datum", "Name"].includes(key)) return;
            const newKey = key.replace(/ /g, "_");
            sanitizedResults[newKey] = data[key];
        });

        const finalOutput = {
            "surveyresults": sanitizedResults,
            "__v": 0
        };

        saveEvaluation(finalOutput, existingId);
    };

    const saveEvaluation = async (data: any, existingId?: string) => {
        try {
            const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

            // Should we update (PUT) or create (POST)?
            const url = existingId ? `${apiUrl}/api/evaluations/${existingId}` : `${apiUrl}/api/evaluations`;
            const method = existingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': user?.role || '',
                    'x-user-email': user?.email || ''
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                // Determine destination based on role
                const isEmployee = user?.role === 'Mitarbeiter';
                const targetPath = isEmployee ? '/my-evaluations' : '/history';

                navigate(targetPath);
            } else {
                alert("Fehler beim Speichern der Bewertung.");
                console.error("Save failed", await response.text());
            }
        } catch (error) {
            console.error("Network error sending evaluation:", error);
            alert("Netzwerkfehler beim Speichern.");
        }
    };

    if (!surveyModel) {
        return <Box p={3}>Lade Kriterienkatalog...</Box>;
    }

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5">
                    Bewertung: {(location.state as PageState)?.employee?.name || (location.state as PageState)?.evaluation?.fullData?.surveyresults?.Name || 'Entwurf'}
                </Typography>
                <Button variant="outlined" onClick={() => navigate('/evaluations')}>Abbrechen</Button>
            </Box>

            <Paper elevation={3} sx={{ p: 0, '& .sd-root-modern': { borderRadius: '4px' } }}>
                <Survey model={surveyModel} />
            </Paper>
        </Box>
    );
}
