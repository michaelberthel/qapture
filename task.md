# Qapture - Quality Management Tool

## Projektübersicht
Entwicklung eines umfassenden Qualitätsmanagement-Tools für Call-Center-Mitarbeiter mit React/Vite, MSAL-Authentifizierung, rollenbasierter Zugriffskontrolle und SurveyJS-Integration.

## Aufgabenliste

### Phase 1: Projektsetup & Architektur
- [x] Projektstruktur für React/Vite Frontend erstellen
- [x] Backend-Architektur (Node.js/Express) aufsetzen
- [x] Datenbankschema für Azure SQL entwerfen
- [ ] MongoDB-Schema analysieren und dokumentieren
- [ ] Migrations-Scripts für MongoDB → Azure SQL entwickeln
- [/] Entwicklungsumgebung konfigurieren
- [x] Einrichtung Git Versionierung

### Phase 2: Authentifizierung & Autorisierung
- [x] MSAL-Integration im Frontend implementieren
- [x] Login-Seite erstellen
- [x] Protected Routes konfigurieren
- [x] Logout-Funktionalität
- [x] Token-Refresh-Handling (via MSAL Popup)
- [x] Legacy-Rollen-API integrieren (PHP Backend)
- [x] Rollen-Mapping (Legacy -> Qapture) implementieren
- [x] Team-Abfrage entwickeln
- [ ] Rollenbasierte Zugriffskontrolle (RBAC) verfeinern

### Phase 3: Beurteilungs-Workflow (Frontend)
- [ ] API-Service für Mitarbeiter-Abfrage erstellen (/list?team=...)
- [ ] API-Service für Katalog-Abfrage erstellen (/kriterienkatalog?projekt=...)
- [ ] Seite "Neue Beurteilung" erstellen (Auswahl Team/Mitarbeiter/Katalog)
- [ ] SurveyJS Bibliothek integrieren
- [ ] Survey-Renderer Komponente erstellen
- [x] Parsing der Legacy-Katalog-JSON implementieren

### Phase 4: Historie & Einsicht (Neu)
- [ ] Backend: MongoDB-Verbindung konfigurieren (Native Driver)
- [ ] Backend: Endpoint GET /api/evaluations erstellen (mit Filtern)
- [ ] Frontend: Seite "Beurteilungshistorie" erstellen
- [x] Frontend: Tabelle mit Sortierung und Filterung (MUI DataGrid)
- [x] Frontend: PDF-Export/Vorschau implementieren
- [x] Frontend: Kommentare & Zusatzinfos (PID, Anlass) im PDF anzeigen

### Phase 5: Speicherung (MongoDB)
- [x] Backend: POST /api/evaluations implementieren (Insert in mongosurveys)
- [x] Frontend: Anbindung der Speicherung in NewEvaluationPage
- [x] Backend: DELETE /api/evaluations/:id implementieren
- [x] Backend: PUT /api/evaluations/:id implementieren
- [x] Frontend: Löschen-Button mit Sicherheitsabfrage (History)
- [x] Frontend: Bearbeiten-Button und Logik zum Laden bestehender Daten (NewEvaluationPage)

### Phase 6: Berechtigungslogik
- [ ] Admin-Ansicht: Alle Beurteilungen

### ON HOLD: SQL Migration
- [ ] Prisma Schema definieren
- [ ] Migrationsskript (Mongo -> SQL)
- [ ] Backend auf SQL umstellen
- [ ] Projektqualitätsmanager/Koordinator: Team-spezifische Beurteilungen
- [x] PQM/PK: Zugriff auf eigene Beurteilungen teamübergreifend [NEW]
- [ ] Mitarbeiter-Ansicht: Nur eigene Beurteilungen
- [ ] Filter- und Suchfunktionalität

### Phase 7: Dashboard & Reporting
- [x] Dashboard-Komponente mit Statistiken (KPIs, Charts)
- [x] Visualisierungen (Charts) für Trends und Auswertungen
- [x] Separate Ansichten (Eigene, Durchgeführte, Global)
    - [x] Bugfix: Datenzugriff für Nicht-Admin (Case-Insensitive Email Match)
    - [x] Bugfix: Datenzugriff für PQM (Fuzzy Team Match) [NEW]
    - [ ] Detailansicht für einzelne Beurteilungen
- [ ] Export-Funktionalität (Excel)
- [ ] Export-Funktionalität (PDF)

### Phase 7: Personio Integration (Verwaltung)
    - [x] Backend: Personio Service (Auth & Fetch)
    - [x] Backend: Route `/api/personio/employees` (Implemented as `/api/employees`)
    - [x] Backend: Route `/api/employees/sync` (Force Refresh) [NEW]
    - [x] Backend: Fix Team Mapping (nested attributes) [NEW]
    - [x] Backend: Route DELETE `/api/employees/overrides/:email` [NEW]
    - [x] Backend: Cache Duration erhöht auf 24h [NEW]
    - [x] Frontend: Service für Personio API
    - [x] Frontend: Integration in "Verwaltung" (oder Austausch der Legacy-Aufrufe)
    - [x] Frontend: Verwaltung - Reset Button & Filter für Änderungen [NEW]
    - [x] Frontend: Verwaltung - Manueller Sync-Button [NEW]

### Phase 7: E-Mail-Integration
- [ ] Microsoft Graph API Integration
- [ ] E-Mail-Template-System entwickeln
- [ ] Template-Editor für Admins
- [ ] Versand von Beurteilungsergebnissen per E-Mail

### Phase 8: UI/UX & Design
- [/] Responsive Design-System aufbauen
- [/] Hauptnavigation und Layout
- [x] Verbaneum Rebranding (Rot #8d0808)
- [x] Logo & Favicon Integration
- [ ] Formular-Komponenten
- [ ] Tabellen und Listen
- [/] Moderne, professionelle Ästhetik

### Phase 9: Datenmigration (MongoDB → Azure SQL) [PAUSIERT]
- [ ] MongoDB-Schema-Analyse durchführen
- [ ] Dry-Run der Migration auf Testdaten
- [ ] Live-Migration der historischen Daten
- [ ] Datenvalidierung und Integritätsprüfung
- [ ] Hybrid-Betrieb konfigurieren

### Phase 10: Testing & Qualitätssicherung
- [ ] Unit-Tests für Backend-API
- [ ] Integration-Tests für Authentifizierung
- [ ] Frontend-Komponenten-Tests
- [ ] End-to-End-Tests für kritische Workflows
- [ ] Performance-Optimierung

### Phase 11: Deployment & DevOps
- [ ] Frontend App Service konfigurieren
- [ ] Backend App Service konfigurieren
- [ ] CI/CD Pipeline für Frontend (GitHub Actions)
- [ ] CI/CD Pipeline für Backend (GitHub Actions)
- [ ] Azure Key Vault für Secrets einrichten
- [ ] Umgebungsvariablen konfigurieren
- [ ] Produktions-Deployment (Frontend)
- [ ] Produktions-Deployment (Backend)
- [ ] Application Insights Monitoring aktivieren
- [ ] Logging und Alerting konfigurieren

### Phase 12: Team & Catalog Management (Admin)
- [x] Backend: MongoDB Schema für `custom_teams` und `catalogs`
- [x] Backend: API für Custom Teams (CRUD)
- [x] Backend: API für Catalogs (CRUD + Import)
- [x] Frontend: AdminPage Tabs (Mitarbeiter, Teams, Kataloge)
- [x] Frontend: Team Management UI (Create/Delete Custom Teams)
- [x] Frontend: Catalog Management UI (List/Edit/Assign)
- [x] Frontend: "Import from Legacy" Funktion für Kataloge
- [x] Integration: NewEvaluationPage auf neue APIs umstellen

### Phase 13: Survey Creator Integrieren [NEW]
- [x] Dependencies installieren (`survey-creator-react`)
- [x] SurveyCreator Komponente erstellen
- [x] AdminPage: JSON-Editor durch Creator ersetzen

### Phase 14: Workspace Restoration (New)
- [x] Restored artifacts from old project structure
- [x] Verified build status
