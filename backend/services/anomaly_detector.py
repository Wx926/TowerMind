import json
import statistics
from datetime import datetime, timedelta

from models import Anomaly, Resource, db

NIGHT_HOURS = set(range(23, 24)) | set(range(0, 6))


def _diagnostics_for(anomaly_type):
    options = {
        "energy_spike": [
            "HVAC chiller left un-isolated post-occupancy",
            "Zonal lighting left active",
            "Possible equipment malfunction",
        ],
        "water_leak": [
            "Suspected pipe leak in restroom block",
            "Flow valve may be stuck open",
            "Recommend immediate plumbing inspection",
        ],
        "overnight_usage": [
            "Lighting schedule may not be syncing with occupancy sensors",
            "Equipment left powered on after hours",
        ],
        "equipment_failure": [
            "Irregular power draw pattern detected",
            "Recommend maintenance inspection",
        ],
    }
    return options.get(anomaly_type, ["Investigate further"])


def detect_anomalies():
    since = datetime.utcnow() - timedelta(days=7)
    rows = Resource.query.filter(Resource.timestamp >= since).all()

    by_key = {}
    for r in rows:
        key = (r.floor, r.resource_type)
        by_key.setdefault(key, []).append(r)

    created = []
    for (floor, resource_type), readings in by_key.items():
        values = [float(r.value) for r in readings]
        if len(values) < 5:
            continue
        mean = statistics.mean(values)
        stdev = statistics.pstdev(values) or 1.0
        threshold = mean + 3 * stdev

        for r in readings:
            value = float(r.value)
            existing = Anomaly.query.filter_by(
                floor=floor, anomaly_type="energy_spike" if resource_type == "electricity" else "water_leak",
                created_at=r.timestamp,
            ).first()
            if existing:
                continue

            if value > threshold:
                anomaly_type = "energy_spike" if resource_type == "electricity" else "water_leak"
                severity = "critical" if value > mean + 4 * stdev else "high"
                pct = round(((value - mean) / mean) * 100) if mean else 0
                anomaly = Anomaly(
                    floor=floor,
                    room=r.room,
                    anomaly_type=anomaly_type,
                    message=f"Drew {pct}% more {resource_type} than baseline at {r.timestamp.strftime('%I:%M %p')}",
                    severity=severity,
                    status="pending",
                    diagnostics=json.dumps(_diagnostics_for(anomaly_type)),
                    normal_value=round(mean, 2),
                    actual_value=round(value, 2),
                    created_at=r.timestamp,
                )
                db.session.add(anomaly)
                created.append(anomaly)
            elif r.timestamp.hour in NIGHT_HOURS and value > mean * 0.8:
                anomaly = Anomaly(
                    floor=floor,
                    room=r.room,
                    anomaly_type="overnight_usage",
                    message=f"Overnight {resource_type} usage at {round((value/mean)*100) if mean else 0}% of daytime load",
                    severity="medium",
                    status="pending",
                    diagnostics=json.dumps(_diagnostics_for("overnight_usage")),
                    normal_value=round(mean, 2),
                    actual_value=round(value, 2),
                    created_at=r.timestamp,
                )
                db.session.add(anomaly)
                created.append(anomaly)

    if created:
        db.session.commit()

    return created
