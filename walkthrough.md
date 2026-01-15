# Qapture - Projektsetup Walkthrough

## Übersicht

Die initiale Projektstruktur für Qapture wurde erfolgreich erstellt. Das Projekt besteht aus zwei separaten Anwendungen:

1. **qapture-frontend** - React/Vite Frontend mit Material-UI
2. **qapture-backend** - Node.js/Express Backend mit Prisma

---

## Erstellte Struktur

```
Qapture_new/
├── qapture-frontend/
│   ├── src/
│   │   ├── config/
│   │   │   └── msalConfig.ts          # Azure AD Konfiguration
│   │   ├── services/
│   │   │   └── api.ts                 # Axios API Client
│   │   ├── theme/
│   │   │   └── theme.ts               # Material-UI Theme
│   │   ├── App.tsx                    # Haupt-App-Komponente
│   │   └── main.tsx                   # Entry Point
│   ├── .env.example                   # Environment-Template
│   ├── package.json                   # Dependencies
│   ├── vite.config.ts                 # Vite-Konfiguration
│   └── tsconfig.json                  # TypeScript-Config
│
├── qapture-backend/
│   ├── src/
│   │   ├── app.js                     # Express App
│   │   └── server.js                  # Server Entry Point
│   ├── prisma/
│   │   └── schema.prisma              # Datenbankschema (8 Modelle)
│   ├── .env.example                   # Environment-Template
│   ├── .gitignore
│   └── package.json                   # Dependencies
│
└── README.md                          # Projekt-Dokumentation
```

---

## Frontend-Konfiguration

### Dependencies

✅ **Core:**
- React 18.2.0
- React DOM 18.2.0
- TypeScript 5.9.3
- Vite 7.2.4

✅ **UI & Styling:**
- @mui/material 5.15.0
- @mui/icons-material 5.15.0
- @emotion/react 11.11.0
- @emotion/styled 11.11.0

✅ **Authentifizierung:**
- @azure/msal-react 2.0.0
- @azure/msal-browser 3.7.0

✅ **State Management & API:**
- @tanstack/react-query 5.14.0
- axios 1.6.0
- react-router-dom 6.20.0

✅ **Survey & Charts:**
- survey-react-ui 1.9.0
- survey-core 1.9.0
- recharts 2.10.0

✅ **Export:**
- xlsx 0.18.5
- jspdf 2.5.1
- html2canvas 1.4.1

✅ **Utilities:**
- date-fns 3.0.0

### Konfigurationsdateien

#### [vite.config.ts](file:///c:/dev3/Qapture_new/qapture-frontend/vite.config.ts)
- Path-Aliases konfiguriert (`@`, `@components`, `@pages`, etc.)
- Proxy für Backend-API (`/api` → `http://localhost:5000`)
- Port 3000 für Dev-Server

#### [src/theme/theme.ts](file:///c:/dev3/Qapture_new/qapture-frontend/src/theme/theme.ts)
- Material-UI Theme mit deutschem Locale (deDE)
- Custom Farben (Primary: #1976d2, Secondary: #9c27b0)
- Komponenten-Overrides für Buttons, Cards, Tables
- Roboto Font-Family

#### [src/config/msalConfig.ts](file:///c:/dev3/Qapture_new/qapture-frontend/src/config/msalConfig.ts)
- MSAL PublicClientApplication
- Azure AD Tenant-spezifische Konfiguration
- Login-Scopes: User.Read, email, profile

#### [src/services/api.ts](file:///c:/dev3/Qapture_new/qapture-frontend/src/services/api.ts)
- Axios-Client mit Base-URL
- Request-Interceptor für Auth-Token
- Response-Interceptor für 401-Handling

#### [src/App.tsx](file:///c:/dev3/Qapture_new/qapture-frontend/src/App.tsx)
- Provider-Hierarchie:
  - MsalProvider (Authentifizierung)
  - QueryClientProvider (React Query)
  - ThemeProvider (Material-UI)
  - BrowserRouter (Routing)

---

## Backend-Konfiguration

### Dependencies

✅ **Core:**
- express 4.18.2
- dotenv 16.3.1
- cors 2.8.5

✅ **Datenbank:**
- @prisma/client 5.8.0
- prisma 5.8.0 (dev)
- mongodb 6.3.0 (für Migration)

✅ **Authentifizierung:**
- @azure/msal-node 2.6.0
- @azure/identity 4.0.0
- jsonwebtoken 9.0.2

✅ **Microsoft Graph:**
- @microsoft/microsoft-graph-client 3.0.7

✅ **Validierung:**
- joi 17.11.0
- zod 3.22.4
- express-validator 7.0.1

✅ **Utilities:**
- axios 1.6.5
- winston 3.11.0 (Logging)

✅ **Development:**
- nodemon 3.0.2
- jest 29.7.0
- supertest 6.3.3

### Konfigurationsdateien

#### [prisma/schema.prisma](file:///c:/dev3/Qapture_new/qapture-backend/prisma/schema.prisma)

**8 Datenbankmodelle:**

1. **User** - Benutzer mit Azure AD Integration
   - Felder: id, azureAdObjectId, email, displayName, role
   - Enum: Role (Admin, ProjektQM, ProjektKoordinator, Mitarbeiter)

2. **Team** - Teams/Abteilungen
   - Felder: id, name, description

3. **UserTeam** - Many-to-Many Beziehung
   - Felder: userId, teamId, isManager

4. **CriteriaCatalog** - Beurteilungskataloge
   - Felder: id, name, surveyJson (NVARCHAR(MAX)), version, isActive

5. **TeamCatalog** - Team-Katalog-Zuordnung
   - Felder: teamId, catalogId

6. **Evaluation** - Beurteilungen
   - Felder: evaluatedUserId, evaluatorUserId, teamId, catalogId
   - Felder: evaluationDate, prueftechnik, surveyResults (JSON)
   - Felder: totalScore, maxScore, percentage
   - Felder: conversationContent, requiresAction, actionReason

7. **EmailTemplate** - E-Mail-Vorlagen
   - Felder: name, subject, bodyHtml, variables

8. **EmailLog** - E-Mail-Versand-Protokoll
   - Felder: evaluationId, recipientEmail, status, errorMessage

**Indizes:**
- User: azureAdObjectId, role
- UserTeam: userId, teamId
- Evaluation: evaluatedUserId, evaluatorUserId, teamId, evaluationDate
- CriteriaCatalog: isActive

#### [src/app.js](file:///c:/dev3/Qapture_new/qapture-backend/src/app.js)
- Express-App mit CORS
- JSON Body-Parser (10MB Limit)
- Health-Check-Endpoint: `/health`
- API-Übersicht: `/api`
- Error-Handling-Middleware
- Graceful Shutdown (SIGTERM, SIGINT)

#### [src/server.js](file:///c:/dev3/Qapture_new/qapture-backend/src/server.js)
- Server läuft auf Port 5000 (konfigurierbar)
- Lädt Environment-Variables

---

## Environment-Variablen

### Frontend (.env)

```env
VITE_API_URL=http://localhost:5000
VITE_AZURE_CLIENT_ID=<your-client-id>
VITE_AZURE_TENANT_ID=<your-tenant-id>
VITE_REDIRECT_URI=http://localhost:3000
```

### Backend (.env)

```env
# Datenbank
DATABASE_URL="sqlserver://..."

# MongoDB (Migration)
MONGODB_ATLAS_URI="mongodb+srv://..."

# Azure AD
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<client-id>
AZURE_CLIENT_SECRET=<secret>

# JWT
JWT_SECRET=<secret>
JWT_EXPIRES_IN=24h

# Microsoft Graph
SENDER_EMAIL=noreply@yourdomain.com

# Server
NODE_ENV=development
PORT=5000

# Legacy API
LEGACY_API_URL=https://...
USE_LEGACY_MONGODB=false

# CORS
FRONTEND_URL=http://localhost:3000
```

---

## Installation & Start

### 1. Dependencies installieren

```bash
# Frontend
cd qapture-frontend
npm install

# Backend
cd qapture-backend
npm install
```

> **Status:** npm install läuft aktuell für beide Projekte

### 2. Environment-Variablen konfigurieren

```bash
# Frontend
cd qapture-frontend
cp .env.example .env
# .env bearbeiten

# Backend
cd qapture-backend
cp .env.example .env
# .env bearbeiten
```

### 3. Datenbank initialisieren

```bash
cd qapture-backend
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Anwendungen starten

```bash
# Terminal 1 - Backend
cd qapture-backend
npm run dev

# Terminal 2 - Frontend
cd qapture-frontend
npm run dev
```

**URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- API-Übersicht: http://localhost:5000/api
- Health-Check: http://localhost:5000/health

---

## Nächste Schritte

### Phase 2: Authentifizierung & Autorisierung

1. **MSAL-Integration im Frontend**
   - AuthContext erstellen
   - Login/Logout-Komponenten
   - Protected Routes

2. **Backend-API für Rollen**
   - Auth-Middleware
   - JWT-Token-Validierung
   - Permissions-Middleware

3. **User-Management**
   - User-Sync mit Azure AD
   - Rollen-Zuweisung
   - Team-Zuordnung

### Phase 3: Kriterienkatalog-Verwaltung

1. **API-Endpunkte**
   - GET /api/catalogs
   - GET /api/catalogs/:id
   - POST /api/catalogs (Admin)

2. **Frontend-Komponenten**
   - Katalog-Auswahl
   - Katalog-Vorschau

### Phase 4: Beurteilungs-Workflow

1. **SurveyJS-Integration**
   - Survey-Renderer-Komponente
   - Dynamisches Laden von Katalogen
   - Score-Berechnung

2. **API-Endpunkte**
   - POST /api/evaluations
   - GET /api/evaluations
   - GET /api/evaluations/:id
   - PUT /api/evaluations/:id

---

## Zusammenfassung

✅ **Erstellt:**
- Frontend-Projekt mit React/Vite/TypeScript/Material-UI
- Backend-Projekt mit Node.js/Express/Prisma
- Vollständiges Datenbankschema (8 Modelle)
- Konfigurationsdateien (MSAL, Theme, API-Client)
- Environment-Templates
- README.md mit Anweisungen

⏳ **In Arbeit:**
- npm install für Frontend (läuft)
- npm install für Backend (läuft)

📋 **Nächste Aufgaben:**
- Environment-Variablen konfigurieren
- Datenbank-Migrations ausführen
- Authentifizierung implementieren
- API-Routen erstellen
