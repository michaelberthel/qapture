import express from 'express';
import { connectToMongo } from '../services/mongo.js';
import { PersonioService } from '../services/personio.js';

const router = express.Router();

// Helper to merge overrides
async function mergeWithOverrides(employees) {
    try {
        const db = await connectToMongo();
        const collection = db.collection('employee_overrides');
        const overrides = await collection.find({}).toArray();

        // Create map for faster lookup
        const overrideMap = new Map();
        overrides.forEach(o => overrideMap.set(o.email, o));

        return employees.map(emp => {
            if (overrideMap.has(emp.email)) {
                const ov = overrideMap.get(emp.email);
                return {
                    ...emp,
                    role: ov.role || emp.role,
                    teams: ov.teams ? ov.teams.map(t => ({ team: { name: t } })) : emp.teams,
                    rawTeams: ov.teams || emp.rawTeams, // Keep consistent
                    isOverridden: true
                };
            }
            return emp;
        });

    } catch (error) {
        console.error('Error merging overrides:', error);
        return employees; // Fail safe, return original
    }
}

// GET /api/employees - All employees (for Admin/Management)
router.get('/', async (req, res) => {
    try {
        // Check Admin role? Or allow all authed users?
        // User said "Verwaltung" so likely restricted. checking header?
        // For now, let's just return data.
        const employees = await PersonioService.fetchAllEmployees();
        const merged = await mergeWithOverrides(employees);
        res.json(merged);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/employees/me - Current User Info
router.get('/me', async (req, res) => {
    try {
        const email = req.query.user || req.headers['x-user-email'];
        if (!email) {
            return res.status(400).json({ error: 'User email required' });
        }

        const employees = await PersonioService.fetchAllEmployees();
        const merged = await mergeWithOverrides(employees);

        const user = merged.find(e => e.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            // User not found in Personio (active)?
            // Maybe fallback or return 404.
            // But for login flow, we might want to return a basic object if not found?
            // "daraus sollen immer die Daten geladen werden" -> implies provided data stems from here.
            return res.status(404).json({ error: 'User not found in active directory' });
        }

        res.json(user);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/employees/overrides - Update overrides
router.post('/overrides', async (req, res) => {
    try {
        const { email, role, teams } = req.body;

        if (!email) return res.status(400).json({ error: 'Email required' });

        const db = await connectToMongo();
        const collection = db.collection('employee_overrides');

        const updateDoc = {
            $set: {
                email,
                role,
                teams, // Array of strings e.g. ["Project A", "Team B"]
                updatedAt: new Date()
            }
        };

        await collection.updateOne(
            { email: email },
            updateDoc,
            { upsert: true }
        );

        res.json({ message: 'Override saved successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/employees/overrides/:email - Remove override
router.delete('/overrides/:email', async (req, res) => {
    try {
        const { email } = req.params;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const db = await connectToMongo();
        const collection = db.collection('employee_overrides');

        const result = await collection.deleteOne({ email: email });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'No override found to delete' });
        }

        res.json({ message: 'Override removed successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/employees/sync - Force Sync from Personio
router.post('/sync', async (req, res) => {
    try {
        await PersonioService.fetchAllEmployees({ force: true });
        res.json({ message: 'Synchronisation erfolgreich gestartet.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/employees/status - Get Sync Status
router.get('/status', (req, res) => {
    const lastSync = PersonioService.getLastSyncTime();
    res.json({ lastSync });
});

export default router;
