# TowerMind

AI-powered smart resource management system for office buildings — monitors, predicts, and optimizes electricity, water, space, and manpower usage.

*"Every kilowatt, every drop of water, used where it matters most"*

## Stack
- Backend: Python Flask + SQLite
- Frontend: Vanilla HTML/CSS/JS + ECharts
- AI: Google Gemini API (with rule-based fallback when no API key is set)

## Features
1. Unified Resource Monitoring Dashboard
2. Sustainability KPI & Executive Dashboard
3. AI Predictive Forecasting
4. Smart Root-Cause Anomaly Detection
5. Strategic Recommendation Engine
6. Cross-Resource AI Scheduler
7. AI Sustainability Advisor & Digital Twin Simulator

## Getting started
See [SETUP.md](SETUP.md) for full setup instructions.

Quick start (after setup):
```bash
# Terminal 1
cd backend && venv\Scripts\activate && python app.py

# Terminal 2
cd frontend && python -m http.server 5173
```
Then open `http://127.0.0.1:5173/index.html`.
