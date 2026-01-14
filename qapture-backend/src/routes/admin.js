import express from 'express';
import { connectToMongo } from '../services/mongo.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// --- Helper Functions ---
const getCollections = async () => {
    const db = await connectToMongo();
    return {
        catalogs: db.collection('catalogs'),
        customTeams: db.collection('custom_teams'),
        employees: db.collection('employee_overrides') // Reusing overrides for custom assignments logic if needed
    };
};

// --- Catalog Management ---

// GET /api/admin/catalogs - List all catalogs
router.get('/catalogs', async (req, res) => {
    try {
        const { catalogs } = await getCollections();
        const result = await catalogs.find({}).toArray();
        res.json(result);
    } catch (error) {
        console.error('Error fetching catalogs:', error);
        res.status(500).json({ error: 'Failed to fetch catalogs' });
    }
});

// POST /api/admin/catalogs - Create new catalog
router.post('/catalogs', async (req, res) => {
    try {
        const { catalogs } = await getCollections();
        const { name, projects, jsonData } = req.body;

        if (!name || !jsonData) {
            return res.status(400).json({ error: 'Name and JSON Data are required' });
        }

        const newCatalog = {
            name,
            projects: projects || [], // Array of project/team names
            jsonData, // The SurveyJS JSON object (or string? usually object in DB)
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await catalogs.insertOne(newCatalog);
        res.status(201).json({ ...newCatalog, _id: result.insertedId });
    } catch (error) {
        console.error('Error creating catalog:', error);
        res.status(500).json({ error: 'Failed to create catalog' });
    }
});

// PUT /api/admin/catalogs/:id - Update catalog
router.put('/catalogs/:id', async (req, res) => {
    try {
        const { catalogs } = await getCollections();
        const { id } = req.params;
        const { name, projects, jsonData } = req.body;

        const updateDoc = {
            $set: {
                updatedAt: new Date()
            }
        };

        if (name) updateDoc.$set.name = name;
        if (projects) updateDoc.$set.projects = projects;
        if (jsonData) updateDoc.$set.jsonData = jsonData;

        const result = await catalogs.findOneAndUpdate(
            { _id: new ObjectId(id) },
            updateDoc,
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'Catalog not found' });
        }

        res.json(result);
    } catch (error) {
        console.error('Error updating catalog:', error);
        res.status(500).json({ error: 'Failed to update catalog' });
    }
});

// DELETE /api/admin/catalogs/:id - Delete catalog
router.delete('/catalogs/:id', async (req, res) => {
    try {
        const { catalogs } = await getCollections();
        const { id } = req.params;

        const result = await catalogs.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Catalog not found' });
        }

        res.json({ message: 'Catalog deleted' });
    } catch (error) {
        console.error('Error deleting catalog:', error);
        res.status(500).json({ error: 'Failed to delete catalog' });
    }
});

// POST /api/admin/catalogs/import - Import from Legacy API
router.post('/catalogs/import', async (req, res) => {
    try {
        const { catalogs } = await getCollections();
        const { legacyUrl, legacyKey } = req.body; // Or use env vars if safer

        // Helper to fetch from legacy
        // We usually fetch by team. We might need to iterate known teams or just fetch *all* if legacy supports it?
        // Legacy API: /kriterienkatalog?projekt=...
        // Problem: We don't know all projects legacy has.
        // User provided info: "neben den Teams die aus Personio gelesen werden".
        // Strategy: Frontend sends a list of teams to check? 
        // Or we just accept a single "import this team" request.
        // Let's assume the user sends: { teamName: "SDK Inbound" } to import catalogs for that team.
        /*
        const { teamName } = req.body;
        if (!teamName) return res.status(400).json({ error: "Team name required for import"});
        
        // We can reuse the legacy fetch logic or just impl it here temporarily.
        // But the legacy API endpoint needs a team.
        */

        // WAIT: The legacy API structure is simple. Maybe we can loop through the teams we know from Personio?
        // But that might be slow.
        // Let's implement a single-catalog import or bulk import provided by frontend data.
        // Actually simplest for now: The frontend "Import" button will likely ask "For which team?" or just iterate known teams on client and send `import` requests.
        // OR: We accept a list of catalogs in the body to save.

        // Let's stick to: "Save imported catalog" which is basically CREATE but maybe with a flag.
        // Actually, we can use the regular CREATE.

        // Let's leave this endpoint as a placeholder or specific logic if we need to fetch FROM backend.
        // Ideally, frontend fetches from Legacy (since it has the logic/CORS setup might be easier there if using proxy) -> No, backend is better for secrets.
        // But we have legacyApi.ts in frontend.
        // Let's assume Frontend fetches and just POSTs to /catalogs. 
        // We don't strictly need a special import route if we just create them.

        res.status(501).json({ message: "Not implemented. Use POST /catalogs to save imported data." });

    } catch (error) {
        res.status(500).json({ error: 'Import failed' });
    }
});


// --- Custom Teams Management ---

// GET /api/admin/teams - List custom teams
router.get('/teams', async (req, res) => {
    try {
        const { customTeams } = await getCollections();
        const result = await customTeams.find({}).toArray();
        res.json(result);
    } catch (error) {
        console.error('Error fetching custom teams:', error);
        res.status(500).json({ error: 'Failed to fetch custom teams' });
    }
});

// POST /api/admin/teams - Create custom team
router.post('/teams', async (req, res) => {
    try {
        const { customTeams } = await getCollections();
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Team name is required' });
        }

        // Check duplicate
        const existing = await customTeams.findOne({ name });
        if (existing) {
            return res.status(409).json({ error: 'Team already exists' });
        }

        const newTeam = {
            name,
            description: description || '',
            createdAt: new Date()
        };

        const result = await customTeams.insertOne(newTeam);
        res.status(201).json({ ...newTeam, _id: result.insertedId });
    } catch (error) {
        console.error('Error creating custom team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// DELETE /api/admin/teams/:id - Delete custom team
router.delete('/teams/:id', async (req, res) => {
    try {
        const { customTeams } = await getCollections();
        const { id } = req.params;

        const result = await customTeams.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        res.json({ message: 'Team deleted' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ error: 'Failed to delete team' });
    }
});


export default router;
