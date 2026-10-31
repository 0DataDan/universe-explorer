import os
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types

app = FastAPI(title="Cosmic Universe Navigator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = Path(__file__).parent / "universe_data.json"
with open(DATA_PATH, "r") as f:
    UNIVERSE_CATALOG = json.load(f)

def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)

class TelemetryRequest(BaseModel):
    object_id: str
    custom_query: str = ""

@app.get("/api/catalog")
def get_catalog():
    """Returns all celestial anchor nodes across cosmic tiers."""
    return UNIVERSE_CATALOG

@app.post("/api/inquire")
def inquire_gemini(req: TelemetryRequest):
    """Generates on-demand observational insights using Google AI Studio."""
    target = next((item for item in UNIVERSE_CATALOG if item["id"] == req.object_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Celestial target not found.")

    client = get_gemini_client()
    if not client:
        return {
            "source": "Local Static Fallback",
            "telemetry": f"Telemetry for {target['name']}: {target['summary']} (API key unset).",
            "spectral_signature": "Standard multi-band observation."
        }

    prompt = f"""
You are an observatory scientific officer and astrophysicist at an advanced cosmic survey station.
Target Object: {target['name']} ({target['type']})
Distance: {target['distance']}
Scale Tier: {target['scale_order']}
Baseline Knowledge: {target['summary']}

User Query: {req.custom_query if req.custom_query else "Provide deep astrophysical telemetry, spectroscopic implications, and evolutionary fate."}

Respond in concise, evocative, and scientifically authentic terms (under 120 words). Emphasize observational physics.
"""

    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3
            )
        )
        return {
            "source": "Google AI Studio (gemini-3.5-flash-lite)",
            "telemetry": response.text.strip(),
            "target": target["name"]
        }
    except Exception as e:
        return {
            "source": "Observatory Diagnostic",
            "telemetry": f"Observation link active: {target['summary']}",
            "error_note": str(e)[:90]
        }

# Mount static frontend
STATIC_DIR = Path(__file__).parent.parent / "static"
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
