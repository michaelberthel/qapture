import express from 'express';
import { connectToMongo } from '../services/mongo.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const db = await connectToMongo();
        const collection = db.collection('mongosurveys');

        // Extract filters from Query or Headers (simulating auth context)
        // In a real app, this should come from a verified JWT token
        const userRole = req.headers['x-user-role'];
        const userEmail = req.headers['x-user-email'];
        const userTeams = req.headers['x-user-teams'] ? JSON.parse(req.headers['x-user-teams']) : [];

        console.log(`Fetching evaluations for: ${userEmail} (${userRole})`);

        let query = {};

        // Role-Based Access Control logic
        if (userRole === 'Admin') {
            // Admin sees all
            query = {};
        } else if (userRole === 'ProjektQM' || userRole === 'ProjektKoordinator') {
            // Managers see their teams
            // The team name in MongoDB is usually in "surveyresults.Projekt"
            // userTeams comes as array of strings (names) from frontend mapping
            if (userTeams.length > 0) {
                query = { "surveyresults.Projekt": { $in: userTeams } };
            } else {
                // No teams assigned? Maybe see nothing or own?
                // Let's safe default to nothing if no teams
                query = { _id: null };
            }
        } else {
            // Mitarbeiter sees only their own
            // Matching "surveyresults.Name" or "surveyresults.EmployeeEmail"
            // The sample data had "Name": "email@domain.com" sometimes? 
            // Or "Email": "..."? 
            // Sample showed: "Name": "yunus.stubner@verbaneum.de" in surveyresults.
            // But also "email": "..." in api response.
            // Let's try to match Name or Email.
            query = {
                $or: [
                    { "surveyresults.Name": userEmail },
                    { "surveyresults.EmployeeEmail": userEmail },
                    { "surveyresults.Email": userEmail }
                ]
            };
        }

        // Add strict sorting by date (newest first)
        // Note: Datum is string "DD.MM.YYYY, HH:mm:ss" which sorts bad alphabetically.
        // "Datum_der_Bearbeitung" is "YYYY-MM-DD".
        // Let's sort natural or by _id desc for now (latest created).
        const evaluations = await collection.find(query)
            .sort({ _id: -1 })
            .sort({ _id: -1 })
            .toArray();

        // Map to flat structure for frontend grid
        const mappedEvaluations = evaluations.map(ev => {
            const res = ev.surveyresults || {};

            // Extract percentage number for sorting
            let percent = 0;
            if (typeof res.Prozent === 'string') {
                percent = parseFloat(res.Prozent.replace(',', '.'));
            } else if (typeof res.Prozent === 'number') {
                percent = res.Prozent;
            }

            return {
                id: ev._id.toString(),
                projekt: res.Projekt,
                kriterienkatalog: res.Kriterienkatalog,
                bewerter: res.Bewertername,
                name: res.Name, // This seems to be the employee name/email
                datum: res.Datum,
                punkte: res.Punkte,
                prozent: percent, // Use number for sorting
                fullData: ev // Include full data for PDF generation
            };
        });

        res.json(mappedEvaluations);

    } catch (error) {
        console.error('Error fetching evaluations:', error);
        res.status(500).json({ error: 'Failed to fetch evaluations' });
    }
});

// POST: Save new evaluation
router.post('/', async (req, res) => {
    try {
        const db = await connectToMongo();
        const collection = db.collection('mongosurveys');

        const payload = req.body;

        // Ensure structure matches legacy format
        // Payload expected to be the "surveyresults" object or the full wrapper?
        // Let's assume frontend sends the formatted wrapper or we wrap it here.
        // Frontend currently generates: { _id, surveyresults, __v }
        // We should drop the _id from frontend (let Mongo generate it to avoid collisions)
        // and ensure the rest is there.

        const newDocument = {
            surveyresults: payload.surveyresults,
            __v: 0,
            createdAt: new Date() // Add timestamp for our own sanity, even if legacy doesn't use it explicitly
        };

        const result = await collection.insertOne(newDocument);

        console.log(`Saved new evaluation with ID: ${result.insertedId}`);

        res.status(201).json({
            message: 'Evaluation saved successfully',
            id: result.insertedId
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to save evaluation' });
    }
});

// PUT: Update existing evaluation
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await connectToMongo();
        const collection = db.collection('mongosurveys');
        const payload = req.body;

        // Use ObjectId for query
        let objectId;
        try {
            const { ObjectId } = await import('mongodb');
            objectId = new ObjectId(id);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const updateDoc = {
            $set: {
                surveyresults: payload.surveyresults,
                // Do not change createdAt, maybe updatedAt?
                updatedAt: new Date()
            }
        };

        const result = await collection.updateOne({ _id: objectId }, updateDoc);

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Evaluation not found' });
        }

        res.json({ message: 'Evaluation updated successfully' });

    } catch (error) {
        console.error('Error updating evaluation:', error);
        res.status(500).json({ error: 'Failed to update evaluation' });
    }
});

// DELETE: Remove evaluation
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await connectToMongo();
        const collection = db.collection('mongosurveys');

        let objectId;
        try {
            const { ObjectId } = await import('mongodb');
            objectId = new ObjectId(id);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const result = await collection.deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Evaluation not found' });
        }

        res.json({ message: 'Evaluation deleted successfully' });

    } catch (error) {
        console.error('Error deleting evaluation:', error);
        res.status(500).json({ error: 'Failed to delete evaluation' });
    }
});

export default router;
