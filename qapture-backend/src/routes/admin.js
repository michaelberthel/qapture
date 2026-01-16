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
        employees: db.collection('employee_overrides'),
        dimensions: db.collection('dimensions'),
        categoryMappings: db.collection('category_mappings')
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
            isActive: true, // Default active
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
        const { name, projects, jsonData, isActive } = req.body;

        const updateDoc = {
            $set: {
                updatedAt: new Date()
            }
        };

        if (name) updateDoc.$set.name = name;
        if (projects) updateDoc.$set.projects = projects;
        if (jsonData) updateDoc.$set.jsonData = jsonData;
        if (typeof isActive === 'boolean') updateDoc.$set.isActive = isActive;

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

// POST /api/admin/catalogs/:id/duplicate - Duplicate catalog
router.post('/catalogs/:id/duplicate', async (req, res) => {
    try {
        const { catalogs } = await getCollections();
        const { id } = req.params;
        const { newName } = req.body;

        const original = await catalogs.findOne({ _id: new ObjectId(id) });
        if (!original) {
            return res.status(404).json({ error: 'Original catalog not found' });
        }

        const newCatalog = {
            name: newName || `${original.name} (Kopie)`,
            projects: original.projects || [], // Keep assignments? Yes, per plan.
            jsonData: original.jsonData,
            isActive: original.isActive !== undefined ? original.isActive : true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await catalogs.insertOne(newCatalog);
        res.status(201).json({ ...newCatalog, _id: result.insertedId });

    } catch (error) {
        console.error('Error duplicating catalog:', error);
        res.status(500).json({ error: 'Failed to duplicate catalog' });
    }
});

// POST /api/admin/catalogs/:id/version - Create new version
router.post('/catalogs/:id/version', async (req, res) => {
    try {
        const { catalogs } = await getCollections();
        const { id } = req.params;

        // 1. Find original
        const original = await catalogs.findOne({ _id: new ObjectId(id) });
        if (!original) {
            return res.status(404).json({ error: 'Original catalog not found' });
        }

        // 2. Archive original (set isActive: false)
        await catalogs.updateOne(
            { _id: new ObjectId(id) },
            { $set: { isActive: false, updatedAt: new Date() } }
        );

        // 3. Create new version
        const currentVersion = original.version || 1;
        const newVersion = currentVersion + 1;

        // Handle name - remove existing " vX" suffix if present to avoid "Name v1 v2"
        let baseName = original.name;
        // Regex to strip " v[number]" from end
        baseName = baseName.replace(/ v\d+$/, '');

        const newCatalog = {
            ...original,
            _id: undefined, // Let Mongo generate new ID
            name: `${baseName} v${newVersion}`,
            version: newVersion,
            rootId: original.rootId || original._id, // Track lineage
            isActive: true, // New version is active
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await catalogs.insertOne(newCatalog);
        res.status(201).json({ ...newCatalog, _id: result.insertedId });

    } catch (error) {
        console.error('Error creating new version:', error);
        res.status(500).json({ error: 'Failed to create new version' });
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


// --- Category Mapping & Dimensions ---

// GET /api/admin/dimensions - List all dimensions
router.get('/dimensions', async (req, res) => {
    try {
        const { dimensions } = await getCollections();
        const result = await dimensions.find({}).toArray();
        res.json(result);
    } catch (error) {
        console.error('Error fetching dimensions:', error);
        res.status(500).json({ error: 'Failed to fetch dimensions' });
    }
});

// POST /api/admin/dimensions - Create/Update dimension
router.post('/dimensions', async (req, res) => {
    try {
        const { dimensions } = await getCollections();
        const { id, name, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (id) {
            // Update
            const result = await dimensions.findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: { name, color, updatedAt: new Date() } },
                { returnDocument: 'after' }
            );
            return res.json(result);
        } else {
            // Create
            const newDim = {
                name,
                color: color || '#8884d8',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await dimensions.insertOne(newDim);
            return res.status(201).json({ ...newDim, _id: result.insertedId });
        }
    } catch (error) {
        console.error('Error saving dimension:', error);
        res.status(500).json({ error: 'Failed to save dimension' });
    }
});

// DELETE /api/admin/dimensions/:id
router.delete('/dimensions/:id', async (req, res) => {
    try {
        const { dimensions } = await getCollections();
        const { id } = req.params;
        await dimensions.deleteOne({ _id: new ObjectId(id) });
        res.json({ message: 'Dimension deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});


// GET /api/admin/mappings - List all mappings
router.get('/mappings', async (req, res) => {
    try {
        const { categoryMappings } = await getCollections();
        const result = await categoryMappings.find({}).toArray();
        res.json(result);
    } catch (error) {
        console.error('Error fetching mappings:', error);
        res.status(500).json({ error: 'Failed to fetch mappings' });
    }
});

// POST /api/admin/mappings - Update Mapping
router.post('/mappings', async (req, res) => {
    try {
        const { categoryMappings } = await getCollections();
        const { categoryName, dimensionId } = req.body;

        if (!categoryName) return res.status(400).json({ error: 'Category Name Required' });

        const updateDoc = {
            categoryName,
            dimensionId, // can be null to unmap
            updatedAt: new Date()
        };

        // Upsert by categoryName
        const result = await categoryMappings.findOneAndUpdate(
            { categoryName },
            { $set: updateDoc },
            { upsert: true, returnDocument: 'after' }
        );

        res.json(result);
    } catch (error) {
        console.error('Error saving mapping:', error);
        res.status(500).json({ error: 'Failed to save mapping' });
    }
});

// --- Analysis Tools ---

// GET /api/admin/analysis/missing-catalogs
router.get('/analysis/missing-catalogs', async (req, res) => {
    try {
        const { catalogs } = await getCollections();
        const db = await connectToMongo();
        const evaluations = db.collection('mongosurveys');

        // 1. Get all catalog names currently in DB
        const allCatalogs = await catalogs.find({}, { projection: { name: 1 } }).toArray();
        const knownCatalogNames = new Set(allCatalogs.map(c => c.name));

        // 2. Get all catalog names referenced in evaluations
        // We use aggregation to be efficient
        const referencedCatalogs = await evaluations.aggregate([
            {
                $group: {
                    _id: "$surveyresults.Kriterienkatalog",
                    count: { $sum: 1 }
                }
            },
            {
                $match: {
                    _id: { $ne: null }
                }
            }
        ]).toArray();

        // 3. Find missing
        const missing = referencedCatalogs
            .filter(ref => !knownCatalogNames.has(ref._id))
            .map(ref => ({ name: ref._id, count: ref.count }))
            .sort((a, b) => b.count - a.count);

        res.json(missing);

    } catch (error) {
        console.error('Error analyzing missing catalogs:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

export default router;
