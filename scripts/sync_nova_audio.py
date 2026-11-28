import asyncio
import json
import os
import edge_tts

VOICE = "en-GB-SoniaNeural"
RATE = "-5%"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(REPO_ROOT, "static", "audio", "tour")
TOUR_SCRIPTS_PATH = os.path.join(REPO_ROOT, "tour_scripts.json")

def strip_distance(text):
    parts = [s.strip() for s in text.split(". ") if s.strip()]
    kept = [
        s for s in parts
        if "average distance from earth" not in s.lower()
        and "average distance from the sun" not in s.lower()
    ]
    res = ". ".join(kept)
    if res and not res.endswith("."):
        res += "."
    return res

async def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    with open(TOUR_SCRIPTS_PATH, "r", encoding="utf-8") as f:
        stops = json.load(f)

    for stop in stops:
        stop["text"] = strip_distance(stop["text"])

    with open(TOUR_SCRIPTS_PATH, "w", encoding="utf-8") as f:
        json.dump(stops, f, indent=2, ensure_ascii=False)
    print("Cleaned all Average distance lines from tour_scripts.json\n")

    for i, stop in enumerate(stops, 1):
        fname = stop["filename"]
        filepath = os.path.join(AUDIO_DIR, fname)
        print(f"[{i}/{len(stops)}] Generating [{VOICE}] -> {fname}")
        communicate = edge_tts.Communicate(stop["text"], VOICE, rate=RATE)
        await communicate.save(filepath)

    print(f"\nCompleted: {len(stops)} clean audio files in {AUDIO_DIR}/")

if __name__ == "__main__":
    asyncio.run(main())
