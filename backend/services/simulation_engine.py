import json
import random
import statistics
from datetime import datetime, timedelta

from models import Resource, SimulationLog, db
from services import gemini_service

FLOORS = 8
PEAK_HOURS = "9 AM - 6 PM"


def building_context():
    since = datetime.utcnow() - timedelta(days=30)
    rows = Resource.query.filter(Resource.timestamp >= since).all()

    total_cost = sum(float(r.cost or 0) for r in rows)
    elec_rows = [r for r in rows if r.resource_type == "electricity"]
    current_usage = sum(float(r.value) for r in elec_rows[-(24 * 7):]) if elec_rows else 0
    occupancy = round(random.uniform(60, 85))
    carbon_footprint = round(total_cost * 0.0007, 2)

    return {
        "total_cost": round(total_cost, 2),
        "occupancy": occupancy,
        "current_usage": round(current_usage, 2),
        "carbon_footprint": carbon_footprint,
        "floors": FLOORS,
        "peak_hours": PEAK_HOURS,
    }


def fallback_scenarios(user_query, context):
    base_savings = max(1500, round(context["total_cost"] * 0.08))

    scenario_a = {
        "name": "Climate Shift",
        "description": "Increase AC temperature setpoint by 2°C across all floors during business hours.",
        "savings": round(base_savings * 0.45),
        "carbon_reduction": 8,
        "effort": "Low",
        "comfort_score": 65,
        "timeline": "2 days",
        "risk": "Occupant comfort complaints",
    }
    scenario_b = {
        "name": "Space Rationalization",
        "description": "Close or consolidate low-utilization zones after 6 PM and on quiet weekdays.",
        "savings": round(base_savings * 0.65),
        "carbon_reduction": 12,
        "effort": "Medium",
        "comfort_score": 80,
        "timeline": "7 days",
        "risk": "Requires staff communication and coordination",
    }
    scenario_c = {
        "name": "Hybrid Optimization",
        "description": "Combine moderate setpoint increase with targeted zone consolidation and off-peak scheduling.",
        "savings": round(base_savings * 1.0),
        "carbon_reduction": 18,
        "effort": "Medium",
        "comfort_score": 72,
        "timeline": "3-5 days",
        "risk": "Best ROI/effort ratio, moderate communication required",
    }

    return {
        "scenario_a": scenario_a,
        "scenario_b": scenario_b,
        "scenario_c": scenario_c,
        "recommended": "scenario_c",
        "analysis": (
            f"Based on current usage patterns, Scenario C balances savings of roughly RM {scenario_c['savings']} "
            "with manageable operational disruption, offering the best ratio of impact to implementation effort."
        ),
        "source": "fallback",
    }


def run_simulation(user_query):
    context = building_context()

    result = None
    used_gemini = False
    if gemini_service.is_configured():
        try:
            result = gemini_service.generate_scenarios(user_query, context)
            result["source"] = "gemini"
            used_gemini = True
        except gemini_service.GeminiUnavailableError:
            result = None

    if result is None:
        result = fallback_scenarios(user_query, context)

    log = SimulationLog(
        user_query=user_query,
        scenario_a=json.dumps(result.get("scenario_a")),
        scenario_b=json.dumps(result.get("scenario_b")),
        scenario_c=json.dumps(result.get("scenario_c")),
        recommended_scenario=result.get("recommended"),
    )
    db.session.add(log)
    db.session.commit()

    result["used_gemini"] = used_gemini
    return result
