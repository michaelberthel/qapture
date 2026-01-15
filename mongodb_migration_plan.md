# MongoDB zu Azure SQL Migrationsplan

## Übersicht

Dieser Plan beschreibt die Migration bestehender Beurteilungsdaten von MongoDB Atlas zu Azure SQL Database, während das System im Hybrid-Betrieb läuft.

---

## Migrations-Strategie

### Phasen-Ansatz

```mermaid
graph LR
    A[Phase 1:<br/>Analyse] --> B[Phase 2:<br/>Schema-Mapping]
    B --> C[Phase 3:<br/>Migration Script]
    C --> D[Phase 4:<br/>Validierung]
    D --> E[Phase 5:<br/>Cutover]
    
    style A fill:#ffd700
    style E fill:#90ee90
```

---

## Phase 1: Datenanalyse

### 1.1 MongoDB-Schema analysieren

Zunächst müssen wir die aktuelle MongoDB-Struktur verstehen:

```javascript
// Script: analyze-mongodb-schema.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_ATLAS_URI;
const client = new MongoClient(uri);

async function analyzeSchema() {
  await client.connect();
  const db = client.db('qapture'); // Anpassen an Ihren DB-Namen
  
  // Alle Collections auflisten
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));
  
  // Beispiel-Dokumente aus jeder Collection
  for (const collection of collections) {
    const collName = collection.name;
    const sampleDocs = await db.collection(collName).find().limit(5).toArray();
    
    console.log(`\n=== ${collName} ===`);
    console.log('Sample document:', JSON.stringify(sampleDocs[0], null, 2));
    console.log('Total documents:', await db.collection(collName).countDocuments());
  }
  
  await client.close();
}

analyzeSchema().catch(console.error);
```

### 1.2 Erwartete MongoDB-Collections

Basierend auf typischen QM-Systemen erwarten wir:

- **evaluations** - Beurteilungsdaten
- **users** (optional) - Benutzerdaten
- **teams** (optional) - Team-Informationen
- **catalogs** (optional) - Kriterienkataloge

---

## Phase 2: Schema-Mapping

### 2.1 MongoDB → Azure SQL Mapping

#### Evaluations Collection

**MongoDB-Struktur (angenommen):**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "evaluatedUserId": "user123",
  "evaluatorUserId": "qm456",
  "teamId": "team789",
  "catalogId": "catalog001",
  "evaluationDate": ISODate("2025-12-15T10:30:00Z"),
  "prueftechnik": "SbS Voice",
  "surveyResults": {
    "Begrüßung": 2,
    "Begründung-Begrüßung": "Sehr freundlich",
    "Lösungspräsentation": 4,
    "Datenschutz": 6,
    // ... weitere Felder
  },
  "conversationContent": "Kunde rief wegen Vertragsänderung an...",
  "requiresAction": false,
  "actionReason": null,
  "totalScore": 45,
  "maxScore": 50,
  "percentage": 90.0,
  "createdAt": ISODate("2025-12-15T11:00:00Z"),
  "updatedAt": ISODate("2025-12-15T11:00:00Z")
}
```

**Azure SQL-Mapping:**
```sql
-- Direkte Feldmappings
_id → id (INT IDENTITY, neu generiert)
evaluatedUserId → evaluated_user_id (INT, nach User-Lookup)
evaluatorUserId → evaluator_user_id (INT, nach User-Lookup)
teamId → team_id (INT, nach Team-Lookup)
catalogId → catalog_id (INT, nach Catalog-Lookup)
evaluationDate → evaluation_date (DATETIME2)
prueftechnik → prueftechnik (NVARCHAR(100))
surveyResults → survey_results (NVARCHAR(MAX) als JSON)
conversationContent → conversation_content (NVARCHAR(MAX))
requiresAction → requires_action (BIT)
actionReason → action_reason (NVARCHAR(MAX))
totalScore → total_score (DECIMAL(5,2))
maxScore → max_score (DECIMAL(5,2))
percentage → percentage (DECIMAL(5,2))
createdAt → created_at (DATETIME2)
updatedAt → updated_at (DATETIME2)
```

### 2.2 ID-Mapping-Tabelle

Da MongoDB String-IDs verwendet und Azure SQL Integer-IDs, benötigen wir Mapping-Tabellen:

```sql
-- Temporäre Mapping-Tabelle für Migration
CREATE TABLE migration_id_mappings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    entity_type NVARCHAR(50) NOT NULL, -- 'user', 'team', 'catalog', 'evaluation'
    mongodb_id NVARCHAR(255) NOT NULL,
    sql_id INT NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    UNIQUE (entity_type, mongodb_id)
);

CREATE INDEX idx_migration_mappings ON migration_id_mappings(entity_type, mongodb_id);
```

---

## Phase 3: Migrations-Script

### 3.1 Haupt-Migrations-Script

```javascript
// scripts/migrate-mongodb-to-sql.js
const { MongoClient } = require('mongodb');
const { PrismaClient } = require('@prisma/client');

const mongoUri = process.env.MONGODB_ATLAS_URI;
const prisma = new PrismaClient();

// Konfiguration
const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN === 'true'; // Für Testing

async function migrateData() {
  console.log('🚀 Starting MongoDB to Azure SQL migration...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  
  const mongoClient = new MongoClient(mongoUri);
  
  try {
    await mongoClient.connect();
    const mongodb = mongoClient.db('qapture');
    
    // Schritt 1: Users migrieren (falls in MongoDB)
    await migrateUsers(mongodb);
    
    // Schritt 2: Teams migrieren (falls in MongoDB)
    await migrateTeams(mongodb);
    
    // Schritt 3: Kataloge migrieren (falls in MongoDB)
    await migrateCatalogs(mongodb);
    
    // Schritt 4: Evaluations migrieren
    await migrateEvaluations(mongodb);
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
  }
}

// ============================================
// User Migration
// ============================================
async function migrateUsers(mongodb) {
  console.log('\n📊 Migrating Users...');
  
  const usersCollection = mongodb.collection('users');
  const userCount = await usersCollection.countDocuments();
  
  if (userCount === 0) {
    console.log('⚠️  No users found in MongoDB, skipping...');
    return;
  }
  
  console.log(`Found ${userCount} users to migrate`);
  
  const cursor = usersCollection.find();
  let migratedCount = 0;
  
  while (await cursor.hasNext()) {
    const mongoUser = await cursor.next();
    
    try {
      if (!DRY_RUN) {
        // User in SQL erstellen oder aktualisieren
        const sqlUser = await prisma.user.upsert({
          where: { 
            azureAdObjectId: mongoUser.azureAdObjectId || mongoUser.email 
          },
          update: {
            email: mongoUser.email,
            displayName: mongoUser.displayName || mongoUser.name,
            role: mapRole(mongoUser.role),
          },
          create: {
            azureAdObjectId: mongoUser.azureAdObjectId || mongoUser.email,
            email: mongoUser.email,
            displayName: mongoUser.displayName || mongoUser.name,
            role: mapRole(mongoUser.role),
          }
        });
        
        // ID-Mapping speichern
        await prisma.$executeRaw`
          INSERT INTO migration_id_mappings (entity_type, mongodb_id, sql_id)
          VALUES ('user', ${mongoUser._id.toString()}, ${sqlUser.id})
          ON CONFLICT (entity_type, mongodb_id) DO UPDATE SET sql_id = ${sqlUser.id}
        `;
      }
      
      migratedCount++;
      if (migratedCount % 10 === 0) {
        console.log(`  Migrated ${migratedCount}/${userCount} users...`);
      }
    } catch (error) {
      console.error(`Error migrating user ${mongoUser._id}:`, error.message);
    }
  }
  
  console.log(`✅ Migrated ${migratedCount} users`);
}

// ============================================
// Team Migration
// ============================================
async function migrateTeams(mongodb) {
  console.log('\n📊 Migrating Teams...');
  
  const teamsCollection = mongodb.collection('teams');
  const teamCount = await teamsCollection.countDocuments();
  
  if (teamCount === 0) {
    console.log('⚠️  No teams found in MongoDB, skipping...');
    return;
  }
  
  console.log(`Found ${teamCount} teams to migrate`);
  
  const cursor = teamsCollection.find();
  let migratedCount = 0;
  
  while (await cursor.hasNext()) {
    const mongoTeam = await cursor.next();
    
    try {
      if (!DRY_RUN) {
        const sqlTeam = await prisma.team.create({
          data: {
            name: mongoTeam.name,
            description: mongoTeam.description || null,
          }
        });
        
        await prisma.$executeRaw`
          INSERT INTO migration_id_mappings (entity_type, mongodb_id, sql_id)
          VALUES ('team', ${mongoTeam._id.toString()}, ${sqlTeam.id})
        `;
        
        // User-Team-Zuordnungen migrieren
        if (mongoTeam.members && Array.isArray(mongoTeam.members)) {
          for (const memberId of mongoTeam.members) {
            const userMapping = await getUserMapping(memberId);
            if (userMapping) {
              await prisma.userTeam.create({
                data: {
                  userId: userMapping.sql_id,
                  teamId: sqlTeam.id,
                  isManager: mongoTeam.managers?.includes(memberId) || false
                }
              });
            }
          }
        }
      }
      
      migratedCount++;
    } catch (error) {
      console.error(`Error migrating team ${mongoTeam._id}:`, error.message);
    }
  }
  
  console.log(`✅ Migrated ${migratedCount} teams`);
}

// ============================================
// Catalog Migration
// ============================================
async function migrateCatalogs(mongodb) {
  console.log('\n📊 Migrating Catalogs...');
  
  const catalogsCollection = mongodb.collection('catalogs');
  const catalogCount = await catalogsCollection.countDocuments();
  
  if (catalogCount === 0) {
    console.log('⚠️  No catalogs found in MongoDB, skipping...');
    return;
  }
  
  console.log(`Found ${catalogCount} catalogs to migrate`);
  
  const cursor = catalogsCollection.find();
  let migratedCount = 0;
  
  while (await cursor.hasNext()) {
    const mongoCatalog = await cursor.next();
    
    try {
      if (!DRY_RUN) {
        const sqlCatalog = await prisma.criteriaCatalog.create({
          data: {
            name: mongoCatalog.name,
            description: mongoCatalog.description || null,
            surveyJson: JSON.stringify(mongoCatalog.surveyJson || mongoCatalog.schema),
            version: mongoCatalog.version || 1,
            isActive: mongoCatalog.isActive !== false,
          }
        });
        
        await prisma.$executeRaw`
          INSERT INTO migration_id_mappings (entity_type, mongodb_id, sql_id)
          VALUES ('catalog', ${mongoCatalog._id.toString()}, ${sqlCatalog.id})
        `;
      }
      
      migratedCount++;
    } catch (error) {
      console.error(`Error migrating catalog ${mongoCatalog._id}:`, error.message);
    }
  }
  
  console.log(`✅ Migrated ${migratedCount} catalogs`);
}

// ============================================
// Evaluation Migration (Hauptdaten)
// ============================================
async function migrateEvaluations(mongodb) {
  console.log('\n📊 Migrating Evaluations...');
  
  const evaluationsCollection = mongodb.collection('evaluations');
  const evalCount = await evaluationsCollection.countDocuments();
  
  console.log(`Found ${evalCount} evaluations to migrate`);
  
  let migratedCount = 0;
  let errorCount = 0;
  let offset = 0;
  
  while (offset < evalCount) {
    const batch = await evaluationsCollection
      .find()
      .skip(offset)
      .limit(BATCH_SIZE)
      .toArray();
    
    for (const mongoEval of batch) {
      try {
        // ID-Mappings abrufen
        const evaluatedUserMapping = await getUserMapping(mongoEval.evaluatedUserId);
        const evaluatorUserMapping = await getUserMapping(mongoEval.evaluatorUserId);
        const teamMapping = await getTeamMapping(mongoEval.teamId);
        const catalogMapping = await getCatalogMapping(mongoEval.catalogId);
        
        if (!evaluatedUserMapping || !evaluatorUserMapping || !teamMapping || !catalogMapping) {
          console.warn(`⚠️  Skipping evaluation ${mongoEval._id}: Missing mappings`);
          errorCount++;
          continue;
        }
        
        if (!DRY_RUN) {
          const sqlEval = await prisma.evaluation.create({
            data: {
              evaluatedUserId: evaluatedUserMapping.sql_id,
              evaluatorUserId: evaluatorUserMapping.sql_id,
              teamId: teamMapping.sql_id,
              catalogId: catalogMapping.sql_id,
              evaluationDate: new Date(mongoEval.evaluationDate),
              prueftechnik: mongoEval.prueftechnik || null,
              surveyResults: JSON.stringify(mongoEval.surveyResults || {}),
              totalScore: mongoEval.totalScore || null,
              maxScore: mongoEval.maxScore || null,
              percentage: mongoEval.percentage || null,
              conversationContent: mongoEval.conversationContent || null,
              requiresAction: mongoEval.requiresAction || false,
              actionReason: mongoEval.actionReason || null,
              createdAt: mongoEval.createdAt ? new Date(mongoEval.createdAt) : new Date(),
              updatedAt: mongoEval.updatedAt ? new Date(mongoEval.updatedAt) : new Date(),
            }
          });
          
          await prisma.$executeRaw`
            INSERT INTO migration_id_mappings (entity_type, mongodb_id, sql_id)
            VALUES ('evaluation', ${mongoEval._id.toString()}, ${sqlEval.id})
          `;
        }
        
        migratedCount++;
        
      } catch (error) {
        console.error(`Error migrating evaluation ${mongoEval._id}:`, error.message);
        errorCount++;
      }
    }
    
    offset += BATCH_SIZE;
    console.log(`  Progress: ${Math.min(offset, evalCount)}/${evalCount} evaluations processed...`);
  }
  
  console.log(`✅ Migrated ${migratedCount} evaluations`);
  console.log(`❌ Errors: ${errorCount}`);
}

// ============================================
// Helper Functions
// ============================================
function mapRole(mongoRole) {
  const roleMap = {
    'admin': 'Admin',
    'qm': 'ProjektQM',
    'projektqm': 'ProjektQM',
    'koordinator': 'ProjektKoordinator',
    'projektkoordinator': 'ProjektKoordinator',
    'mitarbeiter': 'Mitarbeiter',
    'employee': 'Mitarbeiter',
  };
  
  return roleMap[mongoRole?.toLowerCase()] || 'Mitarbeiter';
}

async function getUserMapping(mongoId) {
  if (!mongoId) return null;
  
  const mapping = await prisma.$queryRaw`
    SELECT sql_id FROM migration_id_mappings 
    WHERE entity_type = 'user' AND mongodb_id = ${mongoId.toString()}
  `;
  
  return mapping[0] || null;
}

async function getTeamMapping(mongoId) {
  if (!mongoId) return null;
  
  const mapping = await prisma.$queryRaw`
    SELECT sql_id FROM migration_id_mappings 
    WHERE entity_type = 'team' AND mongodb_id = ${mongoId.toString()}
  `;
  
  return mapping[0] || null;
}

async function getCatalogMapping(mongoId) {
  if (!mongoId) return null;
  
  const mapping = await prisma.$queryRaw`
    SELECT sql_id FROM migration_id_mappings 
    WHERE entity_type = 'catalog' AND mongodb_id = ${mongoId.toString()}
  `;
  
  return mapping[0] || null;
}

// ============================================
// Ausführung
// ============================================
if (require.main === module) {
  migrateData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { migrateData };
```

### 3.2 Validierungs-Script

```javascript
// scripts/validate-migration.js
const { MongoClient } = require('mongodb');
const { PrismaClient } = require('@prisma/client');

const mongoUri = process.env.MONGODB_ATLAS_URI;
const prisma = new PrismaClient();

async function validateMigration() {
  console.log('🔍 Validating migration...\n');
  
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const mongodb = mongoClient.db('qapture');
  
  const results = {
    users: await validateCollection(mongodb, 'users', 'user'),
    teams: await validateCollection(mongodb, 'teams', 'team'),
    catalogs: await validateCollection(mongodb, 'catalogs', 'criteriaCatalog'),
    evaluations: await validateCollection(mongodb, 'evaluations', 'evaluation'),
  };
  
  console.log('\n📊 Validation Summary:');
  console.log('='.repeat(50));
  
  for (const [collection, result] of Object.entries(results)) {
    const status = result.mongoCount === result.sqlCount ? '✅' : '❌';
    console.log(`${status} ${collection}:`);
    console.log(`   MongoDB: ${result.mongoCount}`);
    console.log(`   Azure SQL: ${result.sqlCount}`);
    console.log(`   Difference: ${result.mongoCount - result.sqlCount}`);
  }
  
  await mongoClient.close();
  await prisma.$disconnect();
}

async function validateCollection(mongodb, mongoCollection, prismaModel) {
  const mongoCount = await mongodb.collection(mongoCollection).countDocuments();
  const sqlCount = await prisma[prismaModel].count();
  
  return { mongoCount, sqlCount };
}

validateMigration().catch(console.error);
```

---

## Phase 4: Ausführung der Migration

### 4.1 Vorbereitung

```bash
# 1. Umgebungsvariablen setzen
export MONGODB_ATLAS_URI="mongodb+srv://user:password@cluster.mongodb.net/qapture"
export DATABASE_URL="sqlserver://server.database.windows.net:1433;database=qapture;..."

# 2. Dependencies installieren
cd qapture-backend
npm install mongodb @prisma/client

# 3. Prisma Migrations ausführen
npx prisma migrate deploy

# 4. Mapping-Tabelle erstellen
npx prisma db execute --file ./sql/create-migration-mappings.sql
```

### 4.2 Dry-Run durchführen

```bash
# Test-Lauf ohne Daten zu schreiben
DRY_RUN=true node scripts/migrate-mongodb-to-sql.js
```

### 4.3 Live-Migration

```bash
# Echte Migration
DRY_RUN=false node scripts/migrate-mongodb-to-sql.js
```

### 4.4 Validierung

```bash
# Daten validieren
node scripts/validate-migration.js
```

---

## Phase 5: Hybrid-Betrieb & Cutover

### 5.1 Hybrid-Konfiguration

Während der Übergangsphase können beide Datenbanken parallel laufen:

```javascript
// src/config/database.js
const useLegacyMongoDB = process.env.USE_LEGACY_MONGODB === 'true';

module.exports = {
  useLegacyMongoDB,
  
  // Für schrittweise Migration einzelner Features
  features: {
    evaluations: 'sql',      // Neue Beurteilungen in SQL
    users: 'php-api',        // Users weiterhin von PHP-API
    teams: 'php-api',        // Teams weiterhin von PHP-API
    catalogs: 'php-api',     // Kataloge weiterhin von PHP-API
    historicalData: 'sql',   // Historische Daten aus SQL (migriert)
  }
};
```

### 5.2 Dual-Read-Strategie

```javascript
// src/services/evaluationService.js
const { useLegacyMongoDB } = require('../config/database');
const { PrismaClient } = require('@prisma/client');
const { MongoClient } = require('mongodb');

const prisma = new PrismaClient();
let mongoClient;

if (useLegacyMongoDB) {
  mongoClient = new MongoClient(process.env.MONGODB_ATLAS_URI);
  mongoClient.connect();
}

async function getEvaluations(filters) {
  // Immer aus SQL lesen (migrierte + neue Daten)
  const sqlEvaluations = await prisma.evaluation.findMany({
    where: buildWhereClause(filters),
    include: {
      evaluatedUser: true,
      evaluator: true,
      team: true,
      catalog: true,
    }
  });
  
  return sqlEvaluations;
}

async function createEvaluation(data) {
  // Neue Beurteilungen immer in SQL
  return await prisma.evaluation.create({
    data: {
      ...data,
      surveyResults: JSON.stringify(data.surveyResults),
    }
  });
}

module.exports = {
  getEvaluations,
  createEvaluation,
};
```

### 5.3 Cutover-Checkliste

> [!IMPORTANT]
> Vor dem finalen Cutover:

- [ ] Alle Daten erfolgreich migriert und validiert
- [ ] Backup von MongoDB erstellt
- [ ] Backup von Azure SQL erstellt
- [ ] Alle Tests erfolgreich durchgeführt
- [ ] Performance-Tests abgeschlossen
- [ ] Stakeholder informiert
- [ ] Rollback-Plan dokumentiert

**Cutover-Schritte:**

1. **Wartungsfenster ankündigen** (z.B. 2 Stunden)
2. **Letzte Delta-Migration** durchführen (neue Daten seit letzter Migration)
3. **Finale Validierung**
4. **Anwendung auf SQL umstellen** (Environment-Variable ändern)
5. **Monitoring aktivieren**
6. **MongoDB read-only setzen** (als Backup)
7. **Nach 30 Tagen**: MongoDB-Instanz deaktivieren

---

## Rollback-Plan

Falls Probleme auftreten:

```javascript
// scripts/rollback-to-mongodb.js
// Setzt Environment-Variable zurück auf MongoDB
// Nur für Notfälle!

async function rollback() {
  console.log('⚠️  ROLLBACK: Switching back to MongoDB...');
  
  // 1. Environment-Variable ändern
  process.env.USE_LEGACY_MONGODB = 'true';
  
  // 2. Application neu starten
  // 3. Monitoring prüfen
  
  console.log('✅ Rollback completed. MongoDB is now active.');
}
```

---

## Monitoring & Logging

### Migration-Logs

```javascript
// Während der Migration detaillierte Logs schreiben
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'migration-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'migration-combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Im Migrations-Script verwenden
logger.info('Migration started', { timestamp: new Date() });
logger.error('Failed to migrate evaluation', { evaluationId: mongoEval._id, error: error.message });
```

---

## Zeitplan

| Phase | Dauer | Beschreibung |
|-------|-------|--------------|
| **Phase 1: Analyse** | 1-2 Tage | MongoDB-Schema analysieren, Testdaten extrahieren |
| **Phase 2: Mapping** | 1 Tag | Schema-Mapping definieren, Mapping-Tabellen erstellen |
| **Phase 3: Script-Entwicklung** | 2-3 Tage | Migrations-Script entwickeln und testen |
| **Phase 4: Dry-Run** | 1 Tag | Test-Migration auf Staging-Umgebung |
| **Phase 5: Live-Migration** | 1 Tag | Produktions-Migration durchführen |
| **Phase 6: Validierung** | 1-2 Tage | Datenintegrität prüfen, Tests durchführen |
| **Phase 7: Monitoring** | 7 Tage | Hybrid-Betrieb überwachen |
| **Phase 8: Cutover** | 1 Tag | Finale Umstellung auf Azure SQL |

**Gesamt: ~2-3 Wochen**

---

## Zusammenfassung

✅ **Strategie**: Schrittweise Migration mit Hybrid-Betrieb  
✅ **Sicherheit**: Dry-Run, Validierung, Rollback-Plan  
✅ **Flexibilität**: ID-Mapping ermöglicht parallelen Betrieb  
✅ **Monitoring**: Detaillierte Logs und Validierung  
✅ **Risikominimierung**: Kein Datenverlust durch Backup-Strategie
