# Earth System Trend Detective

AI-powered real-time Earth monitoring, geospatial satellite intelligence, and climate analytics platform.

## Run in VS Code (Quick Start)

### Prerequisites
- **Node.js 20+** (`node -v`) and **npm**
- **VS Code**

### 1. Install Dependencies
Open this folder in VS Code, open the Integrated Terminal (`Ctrl+\`` / `Cmd+\``), and run:

```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in the keys in `.env`:
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps Platform key (for Maps JS, Places, Geocoding, Elevation, Weather, Air Quality, Pollen, Solar, Time Zone).
- `GEMINI_API_KEY`: Gemini API key (for **Earth AI Detective** and AI Environmental Impact Reports).
- **Optional keys** (live key-free NASA, NOAA, Open-Meteo, USGS, Copernicus Sentinel, and Global Forest Watch feeds already run out of the box):
  - `NASA_FIRMS_MAP_KEY` (optional VIIRS 375m upgrade; key-free MODIS C6.1 NRT runs automatically)
  - `OPENWEATHER_API_KEY` (optional secondary meteorology cross-check)
  - `OPENAQ_API_KEY` (optional municipal air quality monitors)
  - `DATABASE_URL` (optional PostgreSQL connection string for persistent watchlists, alert acknowledgements, and logged observations; if omitted locally, all maps, analytics, and live feeds run in stateless mode)

### 3. Start the App (One Command or F5)
Either press **`F5`** in VS Code (select **Run Earth System Trend Detective (Full-Stack)** — automatically starts the Express + Vite server and opens your browser), or run:

```bash
npm run dev
```

Then open **http://localhost:3000** (or check `/api/health` for setup diagnostics).

## Useful Scripts
- `npm run dev` — Starts the unified Express backend + Vite React frontend on port `3000`
- `npm run lint` / `npm run typecheck` — Runs TypeScript validation (`tsc --noEmit`)
- `npm run build` — Builds the production frontend bundle into `dist/`
- `npx drizzle-kit push --config=src/db/drizzle.config.ts` — Pushes PostgreSQL schema (only needed if `DATABASE_URL` or `SQL_*` is configured)
