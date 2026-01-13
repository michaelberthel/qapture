
import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { parse, isValid } from 'date-fns';

dotenv.config();

// Configuration
const BATCH_SIZE = 100;
const MONGO_URI = process.env.MONGODB_ATLAS_URI;
const DRY_RUN = process.env.DRY_RUN === 'true';

// Initialize clients
const prisma = new PrismaClient();
const mongoClient = new MongoClient(MONGO_URI);

// Cache maps to reduce DB lookups
const userCache = new Map();
const teamCache = new Map();
const catalogCache = new Map();

async function main() {
    console.log('🚀 Starting migration...');
    console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);

    try {
        await mongoClient.connect();
        console.log('✅ Connected to MongoDB');

        const db = mongoClient.db(); // Uses db from URI
        const collection = db.collection('mongosurveys');

        const totalCount = await collection.countDocuments();
        console.log(`📊 Found ${totalCount} documents to migrate`);

        let processed = 0;
        let created = 0;
        let skipped = 0;
        let errors = 0;

        const cursor = collection.find({}).batchSize(BATCH_SIZE);

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            processed++;

            try {
                if (DRY_RUN && processed > 5) break; // Only check 5 docs in dry run

                await migrateDocument(doc);
                created++;
            } catch (err) {
                console.error(`❌ Error migrating doc ${doc._id}:`, err.message);
                errors++;
            }

            if (processed % 100 === 0) {
                console.log(`⏳ Processed ${processed}/${totalCount} (${Math.round(processed / totalCount * 100)}%)`);
            }
        }

        console.log('\n🏁 Migration finished!');
        console.log(`📈 Stats: Processed=${processed}, Created=${created}, Skipped=${skipped}, Errors=${errors}`);

    } catch (err) {
        console.error('🔥 Fatal error:', err);
    } finally {
        await mongoClient.close();
        await prisma.$disconnect();
    }
}

async function migrateDocument(doc) {
    const data = doc.surveyresults;
    if (!data) throw new Error('No surveyresults found');

    // 1. Extract & Normalize Data
    const teamName = data.Projekt?.trim() || 'Unknown Team';
    const catalogName = data.Kriterienkatalog?.trim() || 'Unknown Catalog';
    const evaluatorName = data.Bewertername?.trim(); // Often empty
    const evaluatedEmail = data.Name?.trim() || 'unknown@verbaneum.de';

    // Date Parsing: "09.08.2023, 14:42:43" -> ISO Date
    let evaluationDate = new Date();
    if (data.Datum) {
        try {
            // Manual parsing for format "DD.MM.YYYY, HH:mm:ss"
            const [datePart, timePart] = data.Datum.split(', ');
            const [day, month, year] = datePart.split('.');
            const [hour, minute, second] = timePart.split(':');
            evaluationDate = new Date(year, month - 1, day, hour, minute, second);
        } catch (e) {
            console.warn(`⚠️ Invalid date format: ${data.Datum}, using now()`);
        }
    }

    // 2. Find or Create Entities (with Caching)

    // TEAM
    let teamId = teamCache.get(teamName);
    if (!teamId && !DRY_RUN) {
        let team = await prisma.team.findFirst({ where: { name: teamName } });
        if (!team) {
            team = await prisma.team.create({
                data: { name: teamName, description: 'Migrated from MongoDB' }
            });
            console.log(`   ➕ Created Team: ${teamName}`);
        }
        teamId = team.id;
        teamCache.set(teamName, teamId);
    }

    // CATALOG
    let catalogId = catalogCache.get(catalogName);
    if (!catalogId && !DRY_RUN) {
        let catalog = await prisma.criteriaCatalog.findFirst({ where: { name: catalogName } });
        if (!catalog) {
            catalog = await prisma.criteriaCatalog.create({
                data: {
                    name: catalogName,
                    surveyJson: '{}', // Placeholder JSON
                    version: 1,
                    isActive: true
                }
            });
            console.log(`   ➕ Created Catalog: ${catalogName}`);
        }
        catalogId = catalog.id;
        catalogCache.set(catalogName, catalogId);
    }

    // EVALUATED USER
    let evaluatedUserId = userCache.get(evaluatedEmail);
    if (!evaluatedUserId && !DRY_RUN) {
        let user = await prisma.user.findFirst({ where: { email: evaluatedEmail } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: evaluatedEmail,
                    displayName: evaluatedEmail.split('@')[0], // Fallback name
                    azureAdObjectId: `migrated_${Date.now()}_${Math.random()}`, // Dummy ID
                    role: 'Mitarbeiter'
                }
            });
            console.log(`   ➕ Created User: ${evaluatedEmail}`);
        }
        evaluatedUserId = user.id;
        userCache.set(evaluatedEmail, evaluatedUserId);
    }

    // EVALUATOR USER
    const evaluatorKey = evaluatorName || 'system_migrator';
    let evaluatorUserId = userCache.get(evaluatorKey);
    if (!evaluatorUserId && !DRY_RUN) {
        // If we have a name, try to find by displayName, otherwise create dummy
        let user = null;
        if (evaluatorName) {
            user = await prisma.user.findFirst({ where: { displayName: evaluatorName } });
        }

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: evaluatorName ? `${evaluatorName.replace(/\s+/g, '.')}@migrated.invalid` : 'system@migrated.invalid',
                    displayName: evaluatorName || 'Unknown Evaluator',
                    azureAdObjectId: `migrated_eval_${Date.now()}_${Math.random()}`,
                    role: 'ProjektQM'
                }
            });
            console.log(`   ➕ Created Evaluator: ${evaluatorName || 'Unknown'}`);
        }
        evaluatorUserId = user.id;
        userCache.set(evaluatorKey, evaluatorUserId);
    }

    // 3. Create Evaluation
    if (!DRY_RUN) {
        // Check for duplicates (optional, based on date and user)
        const exists = await prisma.evaluation.findFirst({
            where: {
                evaluatedUserId,
                evaluationDate,
                catalogId
            }
        });

        if (!exists) {
            await prisma.evaluation.create({
                data: {
                    evaluatedUserId,
                    evaluatorUserId,
                    teamId,
                    catalogId,
                    evaluationDate,
                    surveyResults: JSON.stringify(data), // Store full JSON
                    totalScore: data.Punkte || 0,
                    maxScore: data.Erreichbare_Punkte || 0,
                    percentage: data.Prozent ? parseFloat(data.Prozent) : 0,
                    prueftechnik: null // Not in source
                }
            });
        } else {
            // console.log('   ⏭️ Skipped duplicate');
        }
    }
}

main();
