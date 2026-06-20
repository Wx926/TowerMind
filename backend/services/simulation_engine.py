import json
import statistics
from datetime import datetime, timedelta

from models import Resource, SimulationLog, db
from services import gemini_service

FLOORS = 8
PEAK_HOURS = "9 AM - 6 PM"


def building_context():
    since = datetime.utcnow() - timedelta(days=30)

    rows = Resource.query.filter(
        Resource.timestamp >= since
    ).all()

    total_cost = sum(
        float(r.cost or 0)
        for r in rows
    )

    elec_rows = [
        r for r in rows
        if r.resource_type == "electricity"
    ]

    current_usage = (
        sum(
            float(r.value)
            for r in elec_rows[-(24 * 7):]
        )
        if elec_rows
        else 0
    )

    recent_rows = (
        Resource.query.filter(
            Resource.resource_type == "electricity"
        )
        .order_by(Resource.timestamp.desc())
        .limit(24 * 7)
        .all()
    )

    if recent_rows:

        occupancy = round(
            statistics.mean(
                [
                    float(r.occupancy_rate or 0)
                    for r in recent_rows
                ]
            ),
            1,
        )

        occupancy_count = round(
            statistics.mean(
                [
                    float(r.occupancy_count or 0)
                    for r in recent_rows
                ]
            )
        )

    else:

        occupancy = 50.0
        occupancy_count = 25

    recent_carbon = elec_rows[-(24 * 7):]

    carbon_footprint = round(
        sum(
            float(r.carbon_emission or 0)
            for r in recent_carbon
        ),
        2,
    )

    avg_daily_cost = (
        total_cost / 30
        if total_cost > 0
        else 0
    )

    avg_daily_usage = (
        sum(float(r.value) for r in elec_rows) / 30
        if elec_rows
        else 0
    )

    return {
        "total_cost": round(total_cost, 2),
        "avg_daily_cost": round(avg_daily_cost, 2),
        "current_usage": round(current_usage, 2),
        "avg_daily_usage": round(avg_daily_usage, 2),
        "occupancy": occupancy,
        "occupancy_count": occupancy_count,
        "carbon_footprint": carbon_footprint,
        "floors": FLOORS,
        "peak_hours": PEAK_HOURS,
    }


def fallback_scenarios(user_query, context):
    occupancy = float(
        context.get("occupancy", 50)
    )

    avg_daily_cost = float(
        context.get("avg_daily_cost", 0)
    )

    carbon = float(
        context.get("carbon_footprint", 0)
    )

    optimization_potential = min(
        0.30,
        max(
            0.05,
            (
                ((100 - occupancy) / 100) * 0.6
                +
                min(carbon / 10000, 1) * 0.4
            )
        )
    )

    monthly_cost = avg_daily_cost * 30

    climate_savings = round(
        monthly_cost *
        optimization_potential *
        0.45
    )

    space_savings = round(
        monthly_cost *
        optimization_potential *
        0.65
    )

    hybrid_savings = round(
        monthly_cost *
        optimization_potential
    )

    scenario_a = {
        "name": "Climate Shift",
        "description":
            "Increase HVAC setpoint by 2°C during business hours and optimise cooling schedules.",
        "savings": climate_savings,
        "carbon_reduction": round(
            climate_savings / monthly_cost * 100,
            1
        ),
        "effort": "Low",
        "comfort_score": 75,
        "timeline": "2 days",
        "risk": "Minor occupant comfort concerns",
    }

    scenario_b = {
        "name": "Space Rationalization",
        "description":
            "Consolidate underutilised floors and reduce after-hours operation.",
        "savings": space_savings,
        "carbon_reduction": round(
            space_savings / monthly_cost * 100,
            1
        ),
        "effort": "Medium",
        "comfort_score": 82,
        "timeline": "1 week",
        "risk": "Requires operational coordination",
    }

    scenario_c = {
        "name": "Hybrid Optimization",
        "description":
            "Combine HVAC optimisation, occupancy consolidation, smart scheduling and energy management.",
        "savings": hybrid_savings,
        "carbon_reduction": round(
            hybrid_savings / monthly_cost * 100,
            1
        ),
        "effort": "Medium",
        "comfort_score": 78,
        "timeline": "3–5 days",
        "risk": "Moderate implementation effort",
    }

    scenario_a["score"] = (
        scenario_a["savings"] * 0.5
        + scenario_a["comfort_score"] * 50
        - 200
    )

    scenario_b["score"] = (
        scenario_b["savings"] * 0.5
        + scenario_b["comfort_score"] * 50
        - 500
    )

    scenario_c["score"] = (
        scenario_c["savings"] * 0.5
        + scenario_c["comfort_score"] * 50
        - 350
    )

    recommendation = max(
        [
            ("scenario_a", scenario_a["score"]),
            ("scenario_b", scenario_b["score"]),
            ("scenario_c", scenario_c["score"]),
        ],
        key=lambda x: x[1]
    )[0]

    return {
        "scenario_a": scenario_a,
        "scenario_b": scenario_b,
        "scenario_c": scenario_c,
        "recommended": recommendation,
        "analysis": (
            f"TowerMind analysed current occupancy "
            f"({occupancy}%), operational cost "
            f"(RM {monthly_cost:,.0f}/month), and carbon footprint "
            f"({carbon:,.0f} kg CO₂e). "
            f"The building shows an optimisation potential of "
            f"{round(optimization_potential * 100,1)}%. "
            f"The recommended strategy is "
            f"{recommendation.replace('_', ' ').title()} "
            f"based on projected financial savings and sustainability impact."
        ),
        "optimization_potential": round(
            optimization_potential * 100,
            1
        ),
        "source": "digital_twin_engine",
    }


def run_simulation(user_query):

    context = building_context()

    result = None
    used_gemini = False

    if gemini_service.is_configured():

        try:

            result = gemini_service.generate_scenarios(
                user_query,
                context
            )

            result["source"] = "gemini"
            used_gemini = True

        except gemini_service.GeminiUnavailableError as e:

            print("=" * 60)
            print("SIMULATION GEMINI ERROR")
            print(str(e))
            print("=" * 60)

            result = None

    if result is None:

        result = fallback_scenarios(
            user_query,
            context
        )

    log = SimulationLog(
        user_query=user_query,
        scenario_a=json.dumps(
            result.get("scenario_a")
        ),
        scenario_b=json.dumps(
            result.get("scenario_b")
        ),
        scenario_c=json.dumps(
            result.get("scenario_c")
        ),
        recommended_scenario=result.get(
            "recommended"
        ),
    )

    db.session.add(log)
    db.session.commit()

    result["used_gemini"] = used_gemini

    return result
