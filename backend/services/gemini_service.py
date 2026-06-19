import json
import re

from config import Config

PROMPT_TEMPLATE = """You are TowerMind AI, a building resource optimization expert.

Building Data Context:
- Total monthly energy cost: RM {total_cost}
- Average occupancy: {occupancy}%
- Current energy usage: {current_usage} kWh
- Current carbon footprint: {carbon_footprint} tons CO2
- Number of floors: {floors}
- Peak hours: {peak_hours}

User Query: "{user_query}"

Generate 3 optimization scenarios. For each scenario, provide:
1. Scenario name (short, descriptive)
2. Action description (specific, actionable steps)
3. Estimated savings in RM
4. Carbon reduction percentage
5. Effort level (Low/Medium/High)
6. Comfort score (0-100)
7. Implementation timeline (days)
8. Primary risk factor

Format your response as JSON only, with this exact shape:
{{
    "scenario_a": {{
        "name": "Climate Shift",
        "description": "Increase AC temperature setpoint by 2C across all floors",
        "savings": 3200,
        "carbon_reduction": 8,
        "effort": "Low",
        "comfort_score": 65,
        "timeline": "2 days",
        "risk": "Occupant comfort complaints"
    }},
    "scenario_b": {{...}},
    "scenario_c": {{...}},
    "recommended": "scenario_c",
    "analysis": "Brief explanation of why this scenario is recommended"
}}
"""


class GeminiUnavailableError(Exception):
    pass


def is_configured():
    return bool(Config.GEMINI_API_KEY)


def _extract_json(text):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise GeminiUnavailableError("No JSON object found in Gemini response")
    return json.loads(match.group(0))


def generate_scenarios(user_query, building_context):
    if not is_configured():
        raise GeminiUnavailableError("GEMINI_API_KEY is not configured")

    try:
        import google.generativeai as genai
    except ImportError as e:
        raise GeminiUnavailableError("google-generativeai package not installed") from e

    genai.configure(api_key=Config.GEMINI_API_KEY)
    model = genai.GenerativeModel(Config.GEMINI_MODEL)

    prompt = PROMPT_TEMPLATE.format(user_query=user_query, **building_context)

    try:
        response = model.generate_content(prompt)
        return _extract_json(response.text)
    except Exception as e:
        raise GeminiUnavailableError(str(e)) from e
