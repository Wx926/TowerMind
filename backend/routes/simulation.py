from flask import Blueprint, jsonify, request

from services.simulation_engine import building_context, fallback_scenarios, run_simulation

simulation_bp = Blueprint("simulation", __name__)


@simulation_bp.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(force=True) or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400

    result = run_simulation(query)
    return jsonify(result)


@simulation_bp.route("/fallback", methods=["POST"])
def fallback():
    data = request.get_json(force=True) or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400

    context = building_context()
    result = fallback_scenarios(query, context)
    return jsonify(result)
