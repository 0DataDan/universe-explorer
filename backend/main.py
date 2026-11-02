from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()

catalog_data = [
    # Tier 1: Solar System & Interplanetary Boundary (Proportionally Spaced for Zero Orbital Collisions)
    {"id": "sun", "name": "The Sun (Sol)", "tier": 1, "size": 2.2, "position": [0, 0, 0], "color": 0xfbbf24, "type": "G-type Main-Sequence Star (G2V)", "distance": "0 ly (System Origin)", "scale_order": "10^9 m (1.39M km)", "summary": "The gravitational center of our planetary system, fusing 600 million tons of hydrogen into helium every second in its core."},
    {"id": "mercury", "name": "Mercury", "tier": 1, "size": 0.28, "position": [5.2, 0, 0], "color": 0x94a3b8, "type": "Terrestrial Planet", "distance": "0.39 AU", "scale_order": "10^10 m", "summary": "The smallest planet and closest to the Sun, with a heavily cratered silicate crust and Caloris impact basin experiencing swings between 430°C and -180°C."},
    {"id": "venus", "name": "Venus", "tier": 1, "size": 0.50, "position": [8.0, 0, 0], "color": 0xfde047, "type": "Terrestrial Planet", "distance": "0.72 AU", "scale_order": "10^10 m", "summary": "A runaway greenhouse furnace veiled by super-rotating sulfuric acid cloud chevrons and a crushing carbon dioxide atmosphere."},
    {"id": "earth", "name": "Earth", "tier": 1, "size": 0.55, "position": [11.8, 0, 0], "color": 0x38bdf8, "type": "Terrestrial Planet (Habitable)", "distance": "1.00 AU (Origin Baseline)", "scale_order": "10^11 m (149.6M km)", "summary": "The cradle of human civilization, featuring liquid water oceans, dynamic atmospheric cloud bands, and carbon-based life."},
    {"id": "moon", "name": "The Moon (Luna)", "tier": 1, "size": 0.19, "position": [13.25, 0, 0], "color": 0xcbd5e1, "type": "Natural Satellite (Earth-Moon System)", "distance": "0.00257 AU (384,400 km from Earth)", "scale_order": "10^8 m (3,474 km)", "summary": "Earth's tidally locked natural satellite, scarred by dark basaltic lunar maria (Mare Imbrium, Oceanus Procellarum) and ancient anorthositic highland ray craters."},
    {"id": "mars", "name": "Mars", "tier": 1, "size": 0.42, "position": [15.6, 0, 0], "color": 0xf97316, "type": "Terrestrial Planet", "distance": "1.52 AU", "scale_order": "10^11 m", "summary": "The iron oxide-rich Red Planet, home to Olympus Mons, the Valles Marineris canyon system, dark Syrtis Major basaltic plains, and polar ice caps."},
    {"id": "ceres", "name": "1 Ceres", "tier": 1, "size": 0.30, "position": [19.6, 0, 0], "color": 0xd1d5db, "type": "Dwarf Planet (Asteroid Belt)", "distance": "2.77 AU", "scale_order": "10^11 m (940 km)", "summary": "The largest body in the main asteroid belt, containing a third of its total mass and harboring bright sodium carbonate evaporite deposits in Occator Crater."},
    {"id": "jupiter", "name": "Jupiter", "tier": 1, "size": 1.25, "position": [25.5, 0, 0], "color": 0xd97706, "type": "Gas Giant", "distance": "5.20 AU", "scale_order": "10^11 m", "summary": "A monumental gas giant banded by turbulent ammonia cloud belts, the Great Red Spot anticyclone, and 95 moons."},
    {"id": "saturn", "name": "Saturn", "tier": 1, "size": 1.05, "position": [33.0, 0, 0], "color": 0xfef08a, "type": "Gas Giant (Ring System)", "distance": "9.58 AU", "scale_order": "10^12 m", "summary": "Famous for its golden ammonia haze bands, north polar hexagon jet stream, and expansive icy ring system."},
    {"id": "uranus", "name": "Uranus", "tier": 1, "size": 0.80, "position": [40.5, 0, 0], "color": 0x67e8f9, "type": "Ice Giant", "distance": "19.2 AU", "scale_order": "10^12 m", "summary": "An ice giant knocked onto its side with an axial tilt of 97.8 degrees, veiled in a cyan methane-rich atmosphere and faint vertical rings."},
    {"id": "neptune", "name": "Neptune", "tier": 1, "size": 0.78, "position": [47.0, 0, 0], "color": 0x3b82f6, "type": "Ice Giant", "distance": "30.1 AU", "scale_order": "10^12 m", "summary": "The most distant major planet, featuring deep azure methane bands, bright high-altitude cirrus streaks, and supersonic 2,100 km/h winds."},
    {"id": "oumuamua", "name": "1I/'Oumuamua", "tier": 1, "size": 0.28, "position": [22.0, 12.0, -18.0], "color": 0xf87171, "type": "Interstellar Object (Hyperbolic)", "distance": "33.5 AU (Outbound)", "scale_order": "10^11 m (~400 m core)", "summary": "The first confirmed interstellar object detected visiting from beyond Sol, following an unbound hyperbolic trajectory with a cosmic-ray-reddened tholin crust."},
    {"id": "halley-comet", "name": "1P/Halley (Halley's Comet)", "tier": 1, "size": 0.32, "position": [16.5, 0, 7.0], "color": 0x7dd3fc, "type": "Periodic Comet", "distance": "17.8 AU (Mean)", "scale_order": "10^12 m", "summary": "The premier short-period comet, returning every 75–76 years along a highly inclined, retrograde Keplerian ellipse."},
    {"id": "sedna", "name": "90377 Sedna", "tier": 1, "size": 0.36, "position": [56.0, 6.0, -26.0], "color": 0xb91c1c, "type": "Detached Trans-Neptunian Object", "distance": "85 AU (Perihelion)", "scale_order": "10^13 m", "summary": "An extremely distant minor planet coated in crimson methane/nitrogen tholin ices whose eccentric 11,400-year orbit hints at an unobserved outer perturber."},
    {"id": "voyager-1", "name": "Voyager 1", "tier": 1, "size": 0.24, "position": [68.0, 18.0, -42.0], "color": 0x10b981, "type": "Interstellar Spacecraft", "distance": "165 AU (~22.8 Light Hours)", "scale_order": "10^13 m", "summary": "Humanity's most distant emissary, continuously traversing pristine interstellar space beyond the heliopause since 2012."},

    # Tier 2: Stellar Neighborhood & Milky Way (Proportionally Scaled Beyond the Oort Cloud)
    {"id": "alpha-centauri", "name": "Alpha Centauri", "tier": 2, "size": 1.45, "position": [78, -22, 58], "color": 0xfef08a, "type": "Triple-Star Hierarchy", "distance": "4.37 ly", "scale_order": "10^16 m (~4.37 ly)", "summary": "Our closest stellar neighbors, composed of solar-type binary pair Rigil Kentaurus (G2V) and Toliman (K1V), orbited by red dwarf flare star Proxima Centauri."},
    {"id": "barnards-star", "name": "Barnard's Star", "tier": 2, "size": 0.68, "position": [-52, 38, 86], "color": 0xf87171, "type": "Red Dwarf (M4.0V)", "distance": "5.96 ly", "scale_order": "10^16 m (~6.0 ly)", "summary": "A high-velocity low-mass red dwarf displaying the largest known proper motion of any star relative to Sol."},
    {"id": "sirius", "name": "Sirius (The Dog Star)", "tier": 2, "size": 1.85, "position": [-98, -28, -68], "color": 0xbae6fd, "type": "Binary Star (A1V + DA2)", "distance": "8.60 ly", "scale_order": "10^17 m (~8.6 ly)", "summary": "The brightest apparent star in Earth's sky, dancing with degenerate carbon-oxygen white dwarf companion Sirius B (The Pup)."},
    {"id": "trappist-1", "name": "TRAPPIST-1", "tier": 2, "size": 0.62, "position": [112, 48, -78], "color": 0xef4444, "type": "Ultra-Cool Red Dwarf (M8V)", "distance": "40.6 ly", "scale_order": "10^17 m (~40 ly)", "summary": "A compact ultra-cool red dwarf hosting seven temperate terrestrial exoplanets, three orbiting inside the liquid-water habitable zone."},
    {"id": "polaris", "name": "Polaris (North Star)", "tier": 2, "size": 2.2, "position": [32, 118, 78], "color": 0xfef08a, "type": "Multiple Cepheid Variable (F7Ib)", "distance": "433 ly", "scale_order": "10^18 m (~433 ly)", "summary": "Earth's north celestial pole star, a luminous yellow supergiant pulsating radially as a classic Cepheid standard candle."},
    {"id": "betelgeuse", "name": "Betelgeuse (Alpha Orionis)", "tier": 2, "size": 3.8, "position": [-124, -56, 98], "color": 0xef4444, "type": "Red Supergiant (M1-2 Ia-ab)", "distance": "642 ly", "scale_order": "10^19 m (~650 ly)", "summary": "A semiregular pulsating red supergiant boiling with giant convection cells near core collapse, destined to end in a Type II supernova."},
    {"id": "crab-nebula", "name": "Crab Nebula & Pulsar (M1)", "tier": 2, "size": 2.0, "position": [148, -42, 128], "color": 0x38bdf8, "type": "Supernova Remnant / Pulsar", "distance": "6,500 ly", "scale_order": "10^20 m (~6.5 kly)", "summary": "The expanding filamentary wreckage of supernova SN 1054, powered by a central synchrotron neutron star spinning 30 times a second."},
    {"id": "orion-nebula", "name": "Orion Nebula (M42)", "tier": 2, "size": 3.0, "position": [-154, -72, 160], "color": 0xf472b6, "type": "Diffuse Star-Forming Nebula", "distance": "1,344 ly", "scale_order": "10^19 m (~1.3 kly)", "summary": "A massive H II stellar nursery visible to the naked eye, actively birthing protoplanetary disks inside the glowing Trapezium cluster."},
    {"id": "eagle-nebula", "name": "Eagle Nebula (M16 / Pillars of Creation)", "tier": 2, "size": 3.2, "position": [104, 32, -205], "color": 0x10b981, "type": "Active Emission Nebula / H II Region", "distance": "5,700 ly", "scale_order": "10^20 m (~5.7 kly)", "summary": "A prolific stellar nursery housing the towering 'Pillars of Creation', where ultraviolet radiation from young O-type stars sculpts cold molecular gas."},
    {"id": "stephenson-2-18", "name": "Stephenson 2-18", "tier": 2, "size": 4.8, "position": [-76, 22, -250], "color": 0xdc2626, "type": "Extreme Red Hypergiant (M6)", "distance": "18,900 ly", "scale_order": "10^20 m (~2,150 R_sun)", "summary": "One of the largest known stars in the universe, an extreme red hypergiant with an estimated radius of 2,150 solar radii—large enough to engulf Saturn's orbit."},
    {"id": "sagittarius-a-star", "name": "Sagittarius A*", "tier": 2, "size": 3.1, "position": [0, -3, -290], "color": 0xf97316, "type": "Supermassive Black Hole", "distance": "26,673 ly (Galactic Core)", "scale_order": "10^21 m (~27 kly)", "summary": "The 4.15-million solar-mass gravitational anchor at the nucleus of the Milky Way, surrounded by relativistic Doppler-boosted accretion flares."},

    # Tier 3: Galaxies & Local Group (Proportionally Scaled)
    {"id": "lmc", "name": "Large Magellanic Cloud", "tier": 3, "size": 3.6, "position": [175, -140, -150], "color": 0x38bdf8, "type": "Satellite Dwarf Spiral Galaxy", "distance": "163,000 ly", "scale_order": "10^21 m (~163 kly)", "summary": "The most massive satellite galaxy of the Milky Way, featuring an off-center stellar bar and the glowing Tarantula Nebula starburst complex."},
    {"id": "smc", "name": "Small Magellanic Cloud", "tier": 3, "size": 2.8, "position": [150, -185, -120], "color": 0x818cf8, "type": "Dwarf Irregular Galaxy", "distance": "204,000 ly", "scale_order": "10^21 m (~204 kly)", "summary": "A gas-rich dwarf irregular galaxy bound to the Milky Way, tidally stretched by past gravitational encounters with the LMC."},
    {"id": "andromeda", "name": "Andromeda Galaxy (M31)", "tier": 3, "size": 7.2, "position": [380, 105, -255], "color": 0xc084fc, "type": "Barred Spiral Galaxy (SA(s)b)", "distance": "2.537 Mly", "scale_order": "10^22 m (~2.5 Mly)", "summary": "The largest galaxy in the Local Group, heading toward the Milky Way on a blueshifted collision trajectory at 110 km/s."},
    {"id": "triangulum", "name": "Triangulum Galaxy (M33)", "tier": 3, "size": 4.5, "position": [450, 48, -330], "color": 0x22d3ee, "type": "Spiral Galaxy (SA(s)cd)", "distance": "2.73 Mly", "scale_order": "10^22 m (~2.7 Mly)", "summary": "The third-largest member of the Local Group, displaying loosely wound spiral arms and prominent H II star-forming regions."},
    {"id": "sombrero-galaxy", "name": "Sombrero Galaxy (M104)", "tier": 3, "size": 4.8, "position": [-335, 135, -380], "color": 0xfef08a, "type": "Unbarred Lenticular Galaxy (SAa)", "distance": "31.1 Mly", "scale_order": "10^23 m (~31 Mly)", "summary": "A magnificent lenticular galaxy distinguished by an extraordinarily luminous central bulge and a sharp, dark equatorial dust absorption lane."},
    {"id": "centaurus-a", "name": "Centaurus A (NGC 5128)", "tier": 3, "size": 5.0, "position": [-510, 220, 175], "color": 0xf97316, "type": "Active Radio Galaxy (AGN)", "distance": "12.0 Mly", "scale_order": "10^23 m (~12 Mly)", "summary": "A giant peculiar elliptical galaxy bisected by a warped dark dust lane, launching relativistic synchrotron plasma jets from its central black hole."},
    {"id": "messier-87", "name": "Messier 87 (Virgo A / M87*)", "tier": 3, "size": 5.8, "position": [-285, 410, -510], "color": 0xfbbf24, "type": "Supergiant Elliptical Galaxy (cD)", "distance": "53.5 Mly", "scale_order": "10^23 m (~53.5 Mly)", "summary": "The dominant supergiant elliptical galaxy of the Virgo Cluster, hosting a 6.5-billion-solar-mass black hole launching a 5,000-light-year relativistic jet."},
    {"id": "great-attractor", "name": "The Great Attractor", "tier": 3, "size": 8.0, "position": [-660, -175, -445], "color": 0xf43f5e, "type": "Gravitational Anomaly / Laniakea Focal Core", "distance": "220 Mly", "scale_order": "10^24 m (~220 Mly)", "summary": "A massive gravitational focal point in the Zone of Avoidance drawing the Milky Way and hundreds of thousands of galaxies along the Laniakea Supercluster."},

    # Tier 4: Deep Web & Cosmic Horizon (Proportionally Scaled)
    {"id": "bootes-void", "name": "Boötes Void (The Great Nothing)", "tier": 4, "size": 9.5, "position": [-780, 255, -495], "color": 0x6366f1, "type": "Cosmic Supervoid", "distance": "700 Mly", "scale_order": "10^24 m (~700 Mly)", "summary": "A gargantuan spherical cosmic desert spanning 330 million light-years across, containing only ~60 galaxies where 2,000 would normally form."},
    {"id": "shapley-supercluster", "name": "Shapley Supercluster", "tier": 4, "size": 10.0, "position": [-605, -540, 650], "color": 0x38bdf8, "type": "Supercluster Concentration", "distance": "650 Mly", "scale_order": "10^25 m (~650 Mly)", "summary": "The largest concentration of gravitationally bound galaxies in the nearby universe, pulling the Laniakea Supercluster and Great Attractor toward its core."},
    {"id": "el-gordo", "name": "El Gordo (ACT-CL J0102-4915)", "tier": 4, "size": 7.4, "position": [825, -350, -605], "color": 0xeab308, "type": "Colliding Galaxy Supercluster", "distance": "7.0 Gly (z = 0.87)", "scale_order": "10^25 m (~7 Gly)", "summary": "The most massive colliding galaxy cluster observed in the distant universe, glowing with shock-heated X-ray intracluster plasma across 3 quadrillion solar masses."},
    {"id": "smacs-0723", "name": "SMACS J0723.3-7327", "tier": 4, "size": 7.6, "position": [460, 730, 985], "color": 0xfbbf24, "type": "Gravitational Lensing Cluster", "distance": "4.6 Gly (z = 0.39)", "scale_order": "10^25 m (~4.6 Gly)", "summary": "A massive galaxy cluster bending spacetime into an Einstein gravitational lens, famous as the target of JWST's First Deep Field."},
    {"id": "ton-618", "name": "TON 618", "tier": 4, "size": 8.4, "position": [-985, -445, 890], "color": 0x38bdf8, "type": "Hyperluminous Quasar / Ultramassive Black Hole", "distance": "10.8 Gly (z = 2.219)", "scale_order": "10^26 m (~66 Billion M_sun)", "summary": "One of the most massive black holes known (66 billion solar masses), whose hyperluminous quasar accretion disk shines with the power of 140 trillion Suns."},
    {"id": "earendel", "name": "Earendel (WHL0137-LS)", "tier": 4, "size": 2.8, "position": [670, -540, 1240], "color": 0x93c5fd, "type": "Lensed Massive Blue Supergiant (B-type)", "distance": "12.9 Gly (z = 6.2)", "scale_order": "10^26 m (~28 Billion ly Comoving)", "summary": "The most distant individual star ever detected, observed 900 million years after the Big Bang via gravitational lensing magnification."},
    {"id": "gn-z11", "name": "GN-z11", "tier": 4, "size": 2.6, "position": [0, 0, 1500], "color": 0xef4444, "type": "High-Redshift Lyman-Break Galaxy", "distance": "13.4 Gly (z = 10.6)", "scale_order": "10^26 m (~13.4 Gly)", "summary": "An intensely star-forming primordial galaxy observed just 400 million years after the Big Bang, strongly redshifted into the infrared."}
]

class InquireRequest(BaseModel):
    object_id: str
    custom_query: str = ""

@app.get("/api/catalog")
def get_catalog():
    return catalog_data

@app.post("/api/inquire")
def inquire_object(req: InquireRequest):
    obj = next((item for item in catalog_data if item["id"] == req.object_id), None)
    if not obj:
        return {"source": "SYSTEM", "telemetry": "Target lost or unidentified in catalog."}

    user_query = req.custom_query.strip()
    if user_query:
        telemetry = f"Astrophysical inquiry analysis for [{obj['name']}]: Regarding '{user_query}' — this entity exhibits characteristic properties matching {obj['type']} with nominal scale boundary {obj['scale_order']}. Observational data indicates stable cosmological coordinates at distance {obj['distance']}."
    else:
        telemetry = f"Direct spectral readout for [{obj['name']}]: Classification: {obj['type']}. Distance baseline: {obj['distance']}. Structural order: {obj['scale_order']}. {obj['summary']}"

    return {
        "source": "GEMINI_OBSERVATORY_STREAM // v2.5",
        "telemetry": telemetry
    }

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
