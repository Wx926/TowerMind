import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from models import Anomaly, Booking, KpiHistory, Recommendation, Resource, SimulationLog, db
from data.mock_data_generator import (
    generate_anomalies,
    generate_bookings,
    generate_kpi_history,
    generate_recommendations,
    generate_resources,
)


def init_db():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        print("Generating resource data (30 days, 8 floors)...")
        db.session.bulk_save_objects(generate_resources())

        print("Generating booking data (7 days, 20 rooms)...")
        db.session.bulk_save_objects(generate_bookings())

        print("Generating anomalies...")
        db.session.bulk_save_objects(generate_anomalies())

        print("Generating recommendations...")
        db.session.bulk_save_objects(generate_recommendations())

        print("Generating KPI history (6 months)...")
        db.session.bulk_save_objects(generate_kpi_history())

        db.session.commit()

        print("Database initialized:")
        print(f"  resources: {Resource.query.count()}")
        print(f"  bookings: {Booking.query.count()}")
        print(f"  anomalies: {Anomaly.query.count()}")
        print(f"  recommendations: {Recommendation.query.count()}")
        print(f"  kpi_history: {KpiHistory.query.count()}")
        print(f"  simulation_logs: {SimulationLog.query.count()}")


if __name__ == "__main__":
    init_db()
