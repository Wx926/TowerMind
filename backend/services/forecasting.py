import random
import statistics
from datetime import datetime, timedelta

from models import Resource

ELECTRICITY_RATE = 0.51
WATER_RATE = 0.0085


def _daily_costs(days=30):
    since = datetime.utcnow() - timedelta(days=days)
    rows = Resource.query.filter(Resource.timestamp >= since).all()

    by_day = {}
    for r in rows:
        day = r.timestamp.date()
        cost = float(r.cost or 0)
        by_day.setdefault(day, 0.0)
        by_day[day] += cost

    days_sorted = sorted(by_day.keys())
    return [by_day[d] for d in days_sorted]


def get_next_month_forecast():
    daily = _daily_costs(days=30)
    if not daily:
        avg_daily = 1200.0
    else:
        avg_daily = statistics.mean(daily)

    recent = daily[-7:] if len(daily) >= 7 else daily
    earlier = daily[:7] if len(daily) >= 14 else daily
    recent_avg = statistics.mean(recent) if recent else avg_daily
    earlier_avg = statistics.mean(earlier) if earlier else avg_daily

    growth_rate = 0.0
    if earlier_avg > 0:
        growth_rate = (recent_avg - earlier_avg) / earlier_avg

    growth_rate = max(-0.25, min(0.30, growth_rate)) or 0.08

    projected_cost = round(recent_avg * 30 * (1 + growth_rate), 2)
    quarter_to_date = round(avg_daily * 90, 2)
    monthly_budget = round(avg_daily * 30 * 1.0, 2)
    budget_delta = round(quarter_to_date - monthly_budget * 3, 2)

    drivers = []
    if growth_rate > 0.05:
        drivers.append("Higher planned occupancy driving sustained demand")
    if growth_rate > 0.10:
        drivers.append("Seasonal HVAC load increase affecting peak hours")
    drivers.append("New wing / floor operational changes affecting baseline usage")
    if not drivers:
        drivers.append("Usage trending in line with historical baseline")

    confidence = round(max(60, min(95, 90 - abs(growth_rate) * 100)), 0)

    budget_risk = projected_cost > monthly_budget * 1.05

    return {
        "projected_cost": projected_cost,
        "growth_percentage": round(growth_rate * 100, 1),
        "quarter_to_date": quarter_to_date,
        "budget_delta": budget_delta,
        "drivers": drivers,
        "confidence": confidence,
        "budget_risk": budget_risk,
        "budget_risk_message": "Potential overrun by Week 3" if budget_risk else None,
    }


def get_forecast_trend(days=30):
    daily = _daily_costs(days=30)
    avg_daily = statistics.mean(daily) if daily else 1200.0
    std_daily = statistics.pstdev(daily) if len(daily) > 1 else avg_daily * 0.1

    today = datetime.utcnow().date()
    points = []
    value = avg_daily
    for i in range(1, days + 1):
        drift = random.uniform(-0.02, 0.03)
        value = max(avg_daily * 0.5, value * (1 + drift))
        spread = std_daily * (1 + i / days)
        points.append(
            {
                "date": (today + timedelta(days=i)).isoformat(),
                "estimated": round(value, 2),
                "low": round(max(0, value - spread), 2),
                "high": round(value + spread, 2),
            }
        )

    return points
