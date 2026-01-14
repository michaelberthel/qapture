import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import AppLayout from '../components/layout/AppLayout';
import EvaluationsPage from '../pages/EvaluationsPage';
import NewEvaluationPage from '../pages/NewEvaluationPage';
import EvaluationHistoryPage from '../pages/EvaluationHistoryPage';
import { Box, CircularProgress } from '@mui/material';
import AdminPage from '../pages/AdminPage';

function ProtectedRoute() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/evaluations" element={<EvaluationsPage />} />
                    <Route path="/evaluation/new" element={<NewEvaluationPage />} />

                    <Route path="/my-evaluations" element={<EvaluationHistoryPage />} />
                    <Route path="/history" element={<EvaluationHistoryPage />} />



                    <Route path="/teams" element={<div>Teams Page (Coming Soon)</div>} />
                    <Route path="/admin" element={<AdminPage />} />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}
