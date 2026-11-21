# NOVA Observatory (Universe Explorer)

An interactive 3D solar system and star map that runs in the browser, built with Three.js and Python.

**Live demo:** https://universe-explorer-static.vercel.app/

## About this project

I built this as a hands-on way to learn 3D web development with Three.js and see how a Python backend connects to a browser frontend. The app lets you orbit around planets and stars, click on objects to inspect them, and take a narrated guided tour.

Because I'm still learning, a lot of this project came together through trial and error—especially figuring out how to smoothly move the 3D camera between orbiting planets and getting the tour narration to wait until the camera actually arrives at each stop.

## What's inside

- **3D Scene (`static/index.html`)** – Renders the solar system, starfield, lighting, and camera transitions using Three.js.
- **Guided Tour & Audio (`sync_nova_audio.py`, `tour_scripts.json`, `static/audio/tour/`)** – A Python script that generates the tour narration MP3s using `edge-tts` so the voice stays consistent across every stop.
- **Data (`static/catalog.json`, `backend/`)** – Originally served through a FastAPI backend, with a static JSON catalog added so the frontend can be hosted directly on Vercel.

## Running it locally

Since the frontend loads local JSON and audio files, you'll need a simple local server rather than opening the HTML file directly.

1. Clone the repo:
   ```bash
   git clone https://github.com/0DataDan/universe-explorer.git
   cd universe-explorer
   ```

2. Start a local server from the `static` folder:
   ```bash
   cd static
   python3 -m http.server 8000
   ```

3. Open `http://localhost:8000` in your browser.

## Things I learned along the way

- **World vs. local coordinates:** Early on, the camera would miss planets during the tour because they were nested inside orbiting groups. Switching to `getWorldPosition()` fixed the alignment.
- **Audio timing:** Playing narration immediately when a tour step triggered cut off the intro while the camera was still flying. Adding an arrival delay and a hold timer when the user clicks an info panel made the tour much easier to follow.
- **Static deployment:** Decoupling the planet data into `catalog.json` made it a lot simpler to host the live version on Vercel without keeping a backend server running.
