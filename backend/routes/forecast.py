from flask import Blueprint, jsonify, request

from services.forecasting import get_forecast_trend, get_next_month_forecast

forecast_bp = Blueprint("forecast", __name__)


@forecast_bp.route("/next-month", methods=["GET"])
def next_month():
    return jsonify(get_next_month_forecast())


@forecast_bp.route("/trend", methods=["GET"])
def trend():
    days = int(request.args.get("days", 30))
    return jsonify(get_forecast_trend(days))
