import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/defaultV2.min.css';
import { Box, Paper, Typography, Button } from '@mui/material';
import type { LegacyEmployee, LegacyCatalog } from '../types/legacy';
import { legacyApi } from '../services/legacyApi';
import { useAuth } from '../hooks/useAuth';

interface PageState {
    employee?: LegacyEmployee;
    catalog?: LegacyCatalog;
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
        if (!state || (!state.catalog && !state.evaluation)) {
            navigate('/evaluations');
            return;
        }

        const loadEditMode = async () => {
            if (state.mode === 'edit' && state.evaluation) {
                const evalData = state.evaluation;
                const surveyResults = evalData.fullData.surveyresults;
                const teamName = surveyResults.Projekt;
                const catalogName = surveyResults.Kriterienkatalog;

                // We need to fetch the catalog JSON first because we only have the name in the evaluation
                try {
                    const catalogs = await legacyApi.getCatalogs(teamName);
                    const matchedCatalog = catalogs.find(c => c.Name === catalogName);

                    if (matchedCatalog) {
                        // Parse survey
                        const surveyJson = JSON.parse(matchedCatalog.Jsondata);
                        const survey = new Model(surveyJson);

                        // Map data back
                        // We need to be careful with keys. MongoDB has underscores, Survey expects spaces?
                        // Actually, if we use the original JSON, the questions have original names.
                        // But we stored sanitized keys. 
                        // We must map sanitized keys back to original keys if they differ.
                        // Simple strategy: Iterate survey questions, find matching key in surveyResults (ignoring underscores/spaces difference?)
                        // Or try to revert sanitization (replace _ with space).

                        const restoredData: any = {};
                        Object.keys(surveyResults).forEach(key => {
                            // Try direct match first
                            restoredData[key] = surveyResults[key];

                            // Try space restoration if not found?
                            const spaceKey = key.replace(/_/g, ' ');
                            if (spaceKey !== key) {
                                restoredData[spaceKey] = surveyResults[key];
                            }
                        });

                        // Important: Restore Date to ISO for config?
                        // Datum in DB is "DD.MM.YYYY, HH:mm:ss"
                        // Survey field "Datum" usually expects ISO for datetime-local input?
                        // Let's try to parse back.
                        if (surveyResults.Datum && typeof surveyResults.Datum === 'string') {
                            const [dPart, tPart] = surveyResults.Datum.split(', ');
                            if (dPart && tPart) {
                                const [dd, mm, yyyy] = dPart.split('.');
                                // YYYY-MM-DDTHH:mm
                                restoredData["Datum"] = `${yyyy}-${mm}-${dd}T${tPart.substring(0, 5)}`;
                            }
                        }

                        survey.data = restoredData;

                        // Lock specific fields
                        const readOnlyFields = ["Projekt", "Kriterienkatalog", "Name"]; // Date is editable per request
                        readOnlyFields.forEach(f => {
                            const q = survey.getQuestionByName(f);
                            if (q) q.readOnly = true;
                        });

                        configureSurvey(survey, {
                            teamName: teamName,
                            catalog: matchedCatalog,
                            employee: { name: surveyResults.Name, personioid: surveyResults.PID || '', email: surveyResults.EmployeeEmail || '', id: 0 },
                            // Pass ID for update
                            existingId: evalData.id
                        });
                    } else {
                        alert("Originalkatalog nicht mehr gefunden. Bearbeitung nicht möglich.");
                        navigate('/evaluations');
                    }
                } catch (e) {
                    console.error("Error loading edit data", e);
                    alert("Fehler beim Laden der Bearbeitungsdaten.");
                    navigate('/evaluations');
                }
            } else if (state.catalog && state.employee) {
                // New Mode
                try {
                    const surveyJson = JSON.parse(state.catalog.Jsondata);
                    const survey = new Model(surveyJson);

                    // Helper to get local datetime string
                    const now = new Date();
                    const offset = now.getTimezoneOffset();
                    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
                    const formattedDate = localDate.toISOString().slice(0, 16);

                    survey.mergeData({
                        "Datum": formattedDate,
                        "Projekt": state.teamName,
                        "Kriterienkatalog": state.catalog.Name,
                        "Name": state.employee.name,
                        // Context
                        "EmployeeID": state.employee.personioid,
                        "EmployeeName": state.employee.name,
                        "EmployeeEmail": state.employee.email,
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
        sanitizedResults["Name"] = data["EmployeeName"] || data["Name"];

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
