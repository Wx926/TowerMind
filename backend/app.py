from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from models import db


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    CORS(app, origins=Config.CORS_ORIGINS)

    from routes.resources import resources_bp
    from routes.bookings import bookings_bp
    from routes.anomalies import anomalies_bp
    from routes.recommendations import recommendations_bp
    from routes.kpi import kpi_bp
    from routes.forecast import forecast_bp
    from routes.simulation import simulation_bp
    from routes.scheduler import scheduler_bp

    app.register_blueprint(resources_bp, url_prefix="/api/resources")
    app.register_blueprint(bookings_bp, url_prefix="/api/bookings")
    app.register_blueprint(anomalies_bp, url_prefix="/api/anomalies")
    app.register_blueprint(recommendations_bp, url_prefix="/api/recommendations")
    app.register_blueprint(kpi_bp, url_prefix="/api/kpi")
    app.register_blueprint(forecast_bp, url_prefix="/api/forecast")
    app.register_blueprint(simulation_bp, url_prefix="/api/simulation")
    app.register_blueprint(scheduler_bp, url_prefix="/api/scheduler")

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "TowerMind API"})

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.FLASK_PORT, debug=True)
