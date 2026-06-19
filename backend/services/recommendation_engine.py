from datetime import datetime, timedelta

from models import Anomaly, Recommendation, Resource, db

CARBON_PER_RM_SAVED = 0.16  # kg CO2 per RM of energy cost saved (rough heuristic)


def _carbon_equivalent(kg):
    if kg >= 2000:
        return "Solar panels on 1 roof"
    if kg >= 1000:
        return "1 car off the road for a year"
    if kg >= 500:
        return f"{round(kg / 20)} mature trees"
    if kg >= 100:
        return "1 smartphone charged for 10 years"
    return "Minimal carbon impact"


def generate_recommendations():
    since = datetime.utcnow() - timedelta(days=7)
    recs = []

    Recommendation.query.filter(Recommendation.implemented.is_(False)).delete()

    open_anomalies = Anomaly.query.filter(Anomaly.status != "resolved").all()
    energy_anomalies = [a for a in open_anomalies if a.anomaly_type in ("energy_spike", "overnight_usage", "equipment_failure")]
    water_anomalies = [a for a in open_anomalies if a.anomaly_type == "water_leak"]

    if energy_anomalies:
        savings = round(len(energy_anomalies) * 650 + 800, 2)
        carbon = round(savings * CARBON_PER_RM_SAVED, 2)
        recs.append(
            Recommendation(
                title="Reduce HVAC runtime by 1 hour",
                description="Set HVAC to shut down 1 hour earlier after office hours based on recent overnight usage anomalies.",
                category="electricity",
                estimated_savings=savings,
                confidence_score=92,
                carbon_impact=carbon,
                carbon_equivalent=_carbon_equivalent(carbon),
            )
        )

    avg_water_cost = (
        db.session.query(db.func.avg(Resource.cost))
        .filter(Resource.resource_type == "water", Resource.timestamp >= since)
        .scalar()
    )
    if water_anomalies or (avg_water_cost and float(avg_water_cost) > 5):
        savings = round(len(water_anomalies) * 600 + 600, 2)
        carbon = round(savings * 0.05, 2)
        recs.append(
            Recommendation(
                title="Repair flagged water leaks",
                description="Dispatch plumbing team to inspect and repair leaks flagged by anomaly detection.",
                category="water",
                estimated_savings=savings,
                confidence_score=90,
                carbon_impact=carbon,
                carbon_equivalent=_carbon_equivalent(carbon),
            )
        )

    recs.append(
        Recommendation(
            title="Consolidate low-occupancy floors on Fridays",
            description="Merge Friday-afternoon bookings into fewer floors to cut electricity, cooling, and janitorial costs.",
            category="space",
            estimated_savings=2100,
            confidence_score=78,
            carbon_impact=320,
            carbon_equivalent=_carbon_equivalent(320),
        )
    )

    recs.append(
        Recommendation(
            title="Right-size janitorial shift coverage",
            description="Reduce janitorial hours on floors with consistently low occupancy during the week.",
            category="manpower",
            estimated_savings=480,
            confidence_score=82,
            carbon_impact=0,
            carbon_equivalent="N/A",
        )
    )

    for r in recs:
        db.session.add(r)
    db.session.commit()

    return recs
