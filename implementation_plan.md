# Dashboard Implementation Plan

## Goal
Create a comprehensive dashboard ("Startseite") that provides immediate insights into the user's performance (if employee) and activity (if evaluator).

## Features
1. **KPI Cards**:
   - Total Evaluations (Received / Given)
   - Average Score (Received / Given)
   - Recent Activity Date

2. **Visualizations (Charts)**:
   - **Score Trend**: Line chart showing score development over time.
   - **Distribution**: Bar chart showing number of evaluations per score range or month.

3. **Separate Sections**:
   - **"Meine Bewertungen" (Received)**: Visible to everyone (filtered by their email/name).
   - **"Durchgeführte Bewertungen" (Given)**: Visible to Evaluators/Admins (filtered by `Bewertername` = user email).

## Technical Approach
- **Data Source**: Fetch all evaluations (already implemented in `api/evaluations` with role-based filtering, but we might need to fetch *all* relevant to the user and filter client-side for the "Given" vs "Received" split, or enhance the API).
    - *Current API limitation*: The current `/api/evaluations` returns what the user *is allowed to see*.
        - For `Mitarbeiter`: Returns only their own.
        - For `Admin`: Returns all.
        - For `ProjektQM`: Returns team's.
    - *Strategy*: Reuse the existing `/api/evaluations` hook. Filter the result set in the frontend into `received` (where Name/Email == user) and `given` (where Bewerter == user).

- **Libraries**:
   - UI: Material UI (Grid, Card, Typography)
   - Charts: `recharts` (Need to install this).

## Proposed Components
- `StatCard`: Reusable component for KPIs.
- `ScoreTrendChart`: Line chart.
- `DashboardPage`: Main container.

## Steps
1. Install `recharts`.
2. Create `DashboardPage.tsx`.
3. Implement data fetching (reusing existing API).
4. Implement filtering logic (Given vs Received).
5. Build Layout with Tabs or Sections.

## Team & Catalog Management (New)
- **Goal**: Enable Admins to manage Teams (custom) and Catalogs via the UI.
- **Backend**:
    - **Collections**: `custom_teams`, `catalogs`.
    - **API**: `routes/admin.js` (or split)
        - `GET/POST/DELETE /api/custom-teams`
        - `GET/POST/PUT/DELETE /api/catalogs`
        - `POST /api/catalogs/import` (Fetch from legacy and save to Mongo)
- **Frontend**:
    - **AdminPage**: Add Tabs (Employees, Teams, Catalogs).
    - **Teams Tab**:
        - List Personio Teams (ReadOnly).
        - List Custom Teams (CRUD).
    - **Catalogs Tab**:
        - List all Catalogs.
        - Create/Edit (JSON Editor).
        - Assign to Projects (Multi-select).
    - **Integration**:
        - Update `NewEvaluationPage` and `DashboardPage` to use new APIs.
    - **Team Assignment**:
        - Allow Custom Teams to be assigned to users in Employee Edit Dialog.

# Survey Creator Integration
This plan covers the integration of SurveyJS Creator to allow drag-and-drop editing of catalogs.

## Proposed Changes
### Frontend
#### [MODIFY] [package.json](file:///c:/dev3/Qapture_new/qapture-frontend/package.json)
- Upgrade `survey-core` and `survey-react-ui` to latest version.
- Install `survey-creator-react` and `survey-creator-core`

#### [NEW] [SurveyCreatorWidget.tsx](file:///c:/dev3/Qapture_new/qapture-frontend/src/components/SurveyCreatorWidget.tsx)
- Create a wrapper component for `SurveyCreatorComponent`.
- Logic to load initial JSON and onSave callback.
- Configure German localization.

#### [MODIFY] [AdminPage.tsx](file:///c:/dev3/Qapture_new/qapture-frontend/src/pages/AdminPage.tsx)
- Replace the raw JSON TextField with the new `SurveyCreatorWidget`.
- Update dialog size to `fullWidth` and `maxWidth="xl"`.
- Handle save events from the widget.

## Verification Plan
### Manual Verification
- Open Admin Page -> Catalogs.
- Create New Catalog -> Check if Creator loads.
- Drag and drop elements.
- Save and verify JSON is updated in backend.
