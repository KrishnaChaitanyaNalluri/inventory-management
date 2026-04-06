# Dumont Cafe Stock Mate

React + Vite + TypeScript frontend for manual cafe inventory. Pairs with the Python FastAPI + PostgreSQL backend in `../backend`.

## Scripts

- `npm install` — install dependencies (regenerates `package-lock.json` if missing)
- `npm run dev` — local dev server (default port 8080)
- `npm run build` — production build
- `npm run preview` — preview production build

Set `VITE_API_URL` in `.env` (see `.env.example`) to point at your API.

## If the app does not open

- Run commands from **`cafe-stock-mate`** (not the repo root): `npm install` then `npm run dev`.
- Open the URL Vite prints (usually **http://localhost:8080**). Do not open `index.html` directly in the browser.
- Start the **backend** on port **8000** for login and inventory to work (`VITE_API_URL` defaults to `http://localhost:8000` in dev).
