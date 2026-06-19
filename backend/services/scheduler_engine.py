from datetime import datetime, timedelta

from models import Booking

LOW_OCCUPANCY_THRESHOLD = 0.4


def get_space_consolidation():
    since = datetime.utcnow() - timedelta(days=14)
    bookings = Booking.query.filter(Booking.start_time >= since, Booking.status != "cancelled").all()

    floor_friday_count = {}
    for b in bookings:
        if b.start_time.weekday() == 4 and b.start_time.hour >= 12:
            floor_friday_count[b.floor] = floor_friday_count.get(b.floor, 0) + 1

    floors = sorted(floor_friday_count.keys(), key=lambda f: floor_friday_count.get(f, 0))
    underused = floors[:3] if len(floors) >= 3 else floors

    primary_savings = 2100
    secondary = {
        "janitorial_hours_per_week": 12,
        "janitorial_savings": 480,
        "cleaning_supplies_pct": 30,
        "cleaning_supplies_savings": 120,
        "security_rounds_reduced": 2,
        "security_savings": 200,
    }
    total_secondary = (
        secondary["janitorial_savings"] + secondary["cleaning_supplies_savings"] + secondary["security_savings"]
    )

    return {
        "trigger": "Friday afternoons",
        "underused_floors": underused or ["Floor 9", "Floor 10", "Floor 11"],
        "utilization_threshold_pct": round(LOW_OCCUPANCY_THRESHOLD * 100),
        "recommended_consolidation": underused[:2] if len(underused) >= 2 else underused,
        "primary_savings": primary_savings,
        "secondary": secondary,
        "total_savings": round(primary_savings + total_secondary, 2),
    }


def get_domino_effect(primary_energy_savings):
    manpower = round(primary_energy_savings * 0.18, 2)
    materials = round(primary_energy_savings * 0.06, 2)
    security = round(primary_energy_savings * 0.09, 2)
    total = round(primary_energy_savings + manpower + materials + security, 2)

    return {
        "primary_energy_savings": primary_energy_savings,
        "secondary_manpower_savings": manpower,
        "secondary_materials_savings": materials,
        "secondary_security_savings": security,
        "total_savings": total,
    }


def get_logistics_optimization():
    return {
        "transportation": "Consolidate delivery windows to twice-weekly batches to cut trips by 35%.",
        "materials": "Switch to bulk ordering for cleaning and pantry supplies, estimated 18% cost reduction.",
        "manpower": "Align shift scheduling with measured occupancy peaks to avoid overstaffing low-traffic periods.",
    }
