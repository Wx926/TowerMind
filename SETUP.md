# TowerMind - Setup Guide

## Prerequisites
- Python 3.10+ (3.12 recommended)
- A modern browser (Chrome, Edge, Firefox)

## 1. Clone the repository
```bash
git clone https://github.com/Wx926/TowerMind.git
cd TowerMind
```

## 2. Backend setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## 3. Configure environment
```bash
cp .env.example .env
```
Leave `GEMINI_API_KEY` blank to use the built-in rule-based fallback engine for the AI Simulator, or paste in your own Gemini API key to enable live AI-generated scenarios.

## 4. Initialize the database
```bash
python data/init_db.py
```
This creates `backend/data/tower_mind.db` and seeds it with 30 days of mock resource data, bookings, anomalies, recommendations, and 6 months of KPI history.

## 5. Start the backend
```bash
python app.py
```
API runs at `http://127.0.0.1:5000`. Keep this terminal open.

## 6. Start the frontend (in a second terminal)
```bash
cd frontend
python -m http.server 5173
```
Open `http://127.0.0.1:5173/index.html` in your browser. Keep this terminal open too — both servers must be running at the same time.

## Troubleshooting
- **"Backend offline" shown in the top bar** → the Flask server (step 5) isn't running, or is on a different port than 5000.
- **Port already in use** → another process is using 5000 or 5173; stop it or pick a different port (update `FLASK_PORT` in `.env` and the `API_BASE_URL` in `frontend/js/api.js` if you change the backend port).
- **`python` not found** → install Python from [python.org](https://www.python.org/downloads/) or via your OS package manager, then re-open your terminal.
