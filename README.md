# Qapture Quality Management Tool

Qualitätsmanagement-System für Call-Center-Mitarbeiter mit React/Vite Frontend und Node.js/Express Backend.

## Projektstruktur

```
Qapture_new/
├── qapture-frontend/     # React/Vite Frontend mit Material-UI
├── qapture-backend/      # Node.js/Express Backend mit Prisma
└── README.md
```

## Frontend (qapture-frontend)

### Tech Stack
- React 18 mit TypeScript
- Vite als Build-Tool
- Material-UI v5 für UI-Komponenten
- MSAL für Azure AD Authentifizierung
- React Query für Server-State-Management
- SurveyJS für Beurteilungsformulare
- Recharts für Visualisierungen

### Setup

```bash
cd qapture-frontend
npm install
cp .env.example .env
# .env anpassen mit Azure AD Credentials
npm run dev
```

Frontend läuft auf: http://localhost:3000

## Backend (qapture-backend)

### Tech Stack
- Node.js mit Express
- Prisma ORM für Azure SQL
- MSAL Node für Token-Validierung
- Microsoft Graph API für E-Mail-Versand
- MongoDB Client für Datenmigration

### Setup

```bash
cd qapture-backend
npm install
cp .env.example .env
# .env anpassen mit Datenbank und Azure Credentials
npx prisma generate
npx prisma migrate dev
npm run dev
```

Backend läuft auf: http://localhost:5000

## Datenbank

### Azure SQL Setup

1. Azure SQL Database erstellen
2. Connection String in `.env` eintragen
3. Prisma Migrations ausführen:

```bash
cd qapture-backend
npx prisma migrate deploy
```

### MongoDB Migration

Für die Migration bestehender Daten von MongoDB Atlas:

```bash
cd qapture-backend
# Dry-Run
DRY_RUN=true node scripts/migrate-mongodb-to-sql.js

# Live-Migration
DRY_RUN=false node scripts/migrate-mongodb-to-sql.js

# Validierung
node scripts/validate-migration.js
```

## Entwicklung

### Frontend starten
```bash
cd qapture-frontend
npm run dev
```

### Backend starten
```bash
cd qapture-backend
npm run dev
```

### Prisma Studio (Datenbank-GUI)
```bash
cd qapture-backend
npx prisma studio
```

## Deployment

Siehe `implementation_plan.md` für detaillierte Deployment-Anweisungen zu Azure App Services.

## Dokumentation

- `task.md` - Aufgabenliste
- `implementation_plan.md` - Technischer Implementierungsplan
- `mongodb_migration_plan.md` - Migrationsplan für MongoDB → Azure SQL
- `frontend_mui_config.md` - Material-UI Konfiguration

## Lizenz

Proprietary - verbaneum GmbH
