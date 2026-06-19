import json
import random
from datetime import datetime, timedelta

from models import Anomaly, Booking, KpiHistory, Recommendation, Resource

FLOORS = [f"Floor {i}" for i in range(1, 9)]

ROOMS_BY_FLOOR = {
    floor: [f"{floor.replace('Floor ', 'F')}-Room {letter}" for letter in ["A", "B", "C"][: 2 if i % 2 == 0 else 3]]
    for i, floor in enumerate(FLOORS, start=1)
}

ELECTRICITY_RATE = 0.51  # RM per kWh
WATER_RATE = 0.0085  # RM per liter

random.seed(42)


def _business_hour_factor(hour, weekday):
    if weekday >= 5:  # weekend
        base = 0.15
    else:
        base = 0.15
    if 9 <= hour <= 18:
        base = 1.0 if weekday < 5 else 0.3
    elif 7 <= hour < 9 or 18 < hour <= 20:
        base = 0.5 if weekday < 5 else 0.2
    return base


def generate_resources(days=30):
    rows = []
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days)

    floor_base = {floor: random.uniform(0.85, 1.25) for floor in FLOORS}

    current = start
    while current < end:
        hour = current.hour
        weekday = current.weekday()
        factor = _business_hour_factor(hour, weekday)

        for floor in FLOORS:
            fbase = floor_base[floor]

            elec_value = round(max(0.5, min(50, 50 * factor * fbase * random.uniform(0.85, 1.15))), 2)
            water_value = round(max(0.1, min(10, 10 * factor * fbase * random.uniform(0.8, 1.2))) * 100, 2)

            rows.append(
                Resource(
                    floor=floor,
                    room=None,
                    resource_type="electricity",
                    value=elec_value,
                    cost=round(elec_value * ELECTRICITY_RATE, 2),
                    timestamp=current,
                )
            )
            rows.append(
                Resource(
                    floor=floor,
                    room=None,
                    resource_type="water",
                    value=water_value,
                    cost=round(water_value * WATER_RATE, 2),
                    timestamp=current,
                )
            )

        current += timedelta(hours=1)

    return rows


def generate_bookings(days=7):
    rows = []
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days)

    booked_by_pool = [
        "Alice Tan", "Marcus Lee", "Priya Raj", "John Lim", "Siti Aishah",
        "David Wong", "Nurul Huda", "Kevin Chong", "Farah Aziz", "Brandon Goh",
    ]
    status_pool = ["booked"] * 6 + ["completed"] * 3 + ["cancelled"] * 1

    current = start
    while current < end:
        bookings_today = random.randint(5, 10)
        for _ in range(bookings_today):
            floor = random.choice(FLOORS)
            room = random.choice(ROOMS_BY_FLOOR[floor])
            start_hour = random.randint(8, 17)
            duration = random.choice([1, 1, 2])
            start_time = current.replace(hour=start_hour)
            end_time = start_time + timedelta(hours=duration)

            rows.append(
                Booking(
                    floor=floor,
                    room_name=room,
                    booked_by=random.choice(booked_by_pool),
                    start_time=start_time,
                    end_time=end_time,
                    status=random.choice(status_pool),
                    created_at=start_time - timedelta(days=random.randint(1, 3)),
                )
            )
        current += timedelta(days=1)

    return rows


def generate_anomalies():
    now = datetime.utcnow()
    specs = [
        dict(
            floor="Floor 8", room="B-302", anomaly_type="energy_spike", severity="critical",
            message="Drew 300% more energy at 2:17 AM", normal_value=3.2, actual_value=12.8,
            diagnostics=["HVAC chiller left un-isolated post-occupancy", "Zonal lighting left active", "Possible equipment malfunction"],
            hours_ago=3,
        ),
        dict(
            floor="Floor 5", room="A-101", anomaly_type="water_leak", severity="critical",
            message="Continuous high water flow detected, 450% above baseline", normal_value=2.0, actual_value=11.0,
            diagnostics=["Suspected pipe leak in restroom block", "Flow valve may be stuck open", "Recommend immediate plumbing inspection"],
            hours_ago=6,
        ),
        dict(
            floor="Floor 3", room="C-204", anomaly_type="overnight_usage", severity="medium",
            message="Overnight usage at 80% of daytime load between 11 PM - 6 AM", normal_value=4.0, actual_value=7.2,
            diagnostics=["Lighting schedule may not be syncing with occupancy sensors", "Server room cooling possibly oversized"],
            hours_ago=12,
        ),
        dict(
            floor="Floor 2", room="A-105", anomaly_type="equipment_failure", severity="medium",
            message="Irregular fluctuating power draw detected on pantry circuit", normal_value=5.5, actual_value=9.1,
            diagnostics=["Possible failing compressor on refrigeration unit", "Recommend maintenance check"],
            hours_ago=20,
        ),
        dict(
            floor="Floor 6", room="B-210", anomaly_type="overnight_usage", severity="medium",
            message="Unexpected usage spike outside business hours", normal_value=2.5, actual_value=4.6,
            diagnostics=["Meeting room AV equipment left powered on", "Cleaning crew schedule overlap"],
            hours_ago=30,
        ),
        dict(
            floor="Floor 1", room="Lobby", anomaly_type="energy_spike", severity="low",
            message="Minor energy spike during peak lunch hour", normal_value=15.0, actual_value=18.2,
            diagnostics=["Higher than usual foot traffic", "Within acceptable seasonal variance"],
            hours_ago=40,
        ),
        dict(
            floor="Floor 4", room="C-118", anomaly_type="water_leak", severity="low",
            message="Brief outlier in water usage, self-resolved", normal_value=3.0, actual_value=4.1,
            diagnostics=["Likely a single flush-heavy period", "No further action recommended"],
            hours_ago=55,
        ),
        dict(
            floor="Floor 7", room="A-302", anomaly_type="equipment_failure", severity="low",
            message="Minor fluctuation in HVAC power draw", normal_value=6.0, actual_value=7.3,
            diagnostics=["Within normal thermostat cycling range", "Monitor for recurrence"],
            hours_ago=65,
        ),
    ]

    rows = []
    for spec in specs:
        status = "resolved" if spec["severity"] == "low" else random.choice(["pending", "acknowledged"])
        created_at = now - timedelta(hours=spec["hours_ago"])
        rows.append(
            Anomaly(
                floor=spec["floor"],
                room=spec["room"],
                anomaly_type=spec["anomaly_type"],
                message=spec["message"],
                severity=spec["severity"],
                status=status,
                diagnostics=json.dumps(spec["diagnostics"]),
                normal_value=spec["normal_value"],
                actual_value=spec["actual_value"],
                created_at=created_at,
                resolved_at=created_at + timedelta(hours=1) if status == "resolved" else None,
            )
        )
    return rows


def generate_recommendations():
    now = datetime.utcnow()
    specs = [
        dict(title="Reduce HVAC runtime by 1 hour", category="electricity",
             description="Set HVAC to shut down 1 hour earlier after office hours across all floors.",
             savings=2800, confidence=92, carbon=450, equivalent="22 mature trees"),
        dict(title="Optimize chiller setpoint", category="electricity",
             description="Raise chiller setpoint by 1.5°C during off-peak hours without affecting comfort.",
             savings=1600, confidence=85, carbon=260, equivalent="13 mature trees"),
        dict(title="Switch common areas to motion-sensor lighting", category="electricity",
             description="Install motion sensors in corridors and stairwells on Floors 1-8.",
             savings=950, confidence=88, carbon=150, equivalent="7.5 mature trees"),
        dict(title="Repair Floor 5 restroom leak", category="water",
             description="Dispatch plumbing team to fix the suspected pipe leak flagged by anomaly detection.",
             savings=1200, confidence=95, carbon=80, equivalent="0.8 smartphones charged for 10 years"),
        dict(title="Install low-flow fixtures", category="water",
             description="Replace existing taps and showerheads with low-flow fixtures in shared restrooms.",
             savings=600, confidence=80, carbon=40, equivalent="0.4 smartphones charged for 10 years"),
        dict(title="Consolidate Floors 9-11 Friday afternoons", category="space",
             description="Merge low-occupancy Friday afternoon bookings into Floors 9 & 10, idle Floor 11.",
             savings=2100, confidence=78, carbon=320, equivalent="16 mature trees"),
        dict(title="Repurpose underused Floor 6 meeting rooms", category="space",
             description="Convert two rarely-booked meeting rooms into flexible hot-desking space.",
             savings=700, confidence=70, carbon=90, equivalent="4.5 mature trees"),
        dict(title="Adjust janitorial shift coverage", category="manpower",
             description="Reduce janitorial hours on low-occupancy floors during consolidation periods.",
             savings=480, confidence=82, carbon=0, equivalent="N/A"),
    ]

    rows = []
    for i, spec in enumerate(specs):
        implemented = i == 7
        rows.append(
            Recommendation(
                title=spec["title"],
                description=spec["description"],
                category=spec["category"],
                estimated_savings=spec["savings"],
                confidence_score=spec["confidence"],
                carbon_impact=spec["carbon"],
                carbon_equivalent=spec["equivalent"],
                implemented=implemented,
                created_at=now - timedelta(days=random.randint(1, 14)),
                implemented_at=now - timedelta(days=1) if implemented else None,
            )
        )
    return rows


def _months_ago(date, n):
    month_index = date.month - 1 - n
    year = date.year + month_index // 12
    month = month_index % 12 + 1
    return date.replace(year=year, month=month, day=1)


def generate_kpi_history(months=6):
    rows = []
    today = datetime.utcnow().date().replace(day=1)
    energy = 70
    carbon = 65
    resource = 68

    for i in range(months - 1, -1, -1):
        month_date = _months_ago(today, i)

        energy = max(40, min(98, energy + random.randint(-3, 5)))
        carbon = max(40, min(98, carbon + random.randint(-3, 5)))
        resource = max(40, min(98, resource + random.randint(-3, 5)))
        efficiency = round((energy + carbon + resource) / 3)

        rows.append(
            KpiHistory(
                month=month_date,
                efficiency_score=efficiency,
                energy_score=energy,
                carbon_score=carbon,
                resource_score=resource,
                carbon_footprint=round(random.uniform(20, 35), 2),
                total_savings=round(random.uniform(15000, 28000), 2),
                cost_reduction=round(random.uniform(2, 14), 2),
            )
        )

    rows.sort(key=lambda r: r.month)
    return rows
