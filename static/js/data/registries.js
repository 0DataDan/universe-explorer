// NOVA Static Astronomical & Surface Feature Registries

export const PRIMARY_CELESTIAL_NAMES = {
      "sun": "SUN",
      "mercury": "MERCURY",
      "venus": "VENUS",
      "earth": "EARTH",
      "moon": "MOON",
      "mars": "MARS",
      "ceres": "CERES",
      "jupiter": "JUPITER",
      "saturn": "SATURN",
      "uranus": "URANUS",
      "neptune": "NEPTUNE",
      "oumuamua": "'OUMUAMUA",
      "halley-comet": "HALLEY'S COMET",
      "sedna": "SEDNA",
      "alpha-centauri": "ALPHA CENTAURI",
      "rigil-kentaurus": "RIGIL KENTAURUS",
      "toliman": "TOLIMAN",
      "proxima-centauri": "PROXIMA CENTAURI",
      "barnards-star": "BARNARD'S STAR",
      "sirius": "SIRIUS",
      "sirius-b": "SIRIUS B",
      "trappist-1": "TRAPPIST-1",
      "polaris": "POLARIS",
      "betelgeuse": "BETELGEUSE",
      "crab-nebula": "CRAB NEBULA",
      "orion-nebula": "ORION NEBULA",
      "eagle-nebula": "EAGLE NEBULA",
      "stephenson-2-18": "STEPHENSON 2-18",
      "sagittarius-a-star": "SAGITTARIUS A*",
      "lmc": "LARGE MAGELLANIC CLOUD",
      "smc": "SMALL MAGELLANIC CLOUD",
      "andromeda": "ANDROMEDA GALAXY",
      "triangulum": "TRIANGULUM GALAXY",
      "sombrero-galaxy": "SOMBRERO GALAXY",
      "centaurus-a": "CENTAURUS A",
      "messier-87": "MESSIER 87",
      "great-attractor": "GREAT ATTRACTOR",
      "bootes-void": "BOÖTES VOID",
      "shapley-supercluster": "SHAPLEY SUPERCLUSTER",
      "el-gordo": "EL GORDO",
      "smacs-0723": "SMACS 0723",
      "ton-618": "TON 618",
      "earendel": "EARENDEL",
      "gn-z11": "GN-Z11"
    };

export const COURSE_METRIC_DECODER = [
      {
        match: ["photosphere", "surface temp", "effective temp", "kelvin", "temp"],
        getTitle: function(planetName, val) {
          if (String(planetName).toLowerCase().indexOf("sun") !== -1 || String(val).indexOf("5,772") !== -1) {
            return "PHOTOSPHERE (VISIBLE SURFACE)";
          }
          return "SURFACE THERMAL EXTREMES";
        },
        getCourseTag: function(planetName, val) {
          if (String(planetName).toLowerCase().indexOf("sun") !== -1 || String(val).indexOf("5,772") !== -1) {
            return "ASTRO 101 • WIEN'S LAW";
          }
          return "PLANETARY THERMODYNAMICS";
        },
        scriptPhrases: ["5,772 k", "photosphere", "temperature swings", "430°c", "-180°c", "737 k", "runaway greenhouse", "kelvin", "thermal"],
        explain: function(val, planetName) {
          if (String(val).indexOf("5,772") !== -1 || String(planetName).toLowerCase().indexOf("sun") !== -1) {
            return "At 5,772 K (9,930 °F), thermal radiation peaks in yellow-green visible light—matching human eye sensitivity.";
          }
          if (String(val).indexOf("100 K") !== -1 || String(planetName).toLowerCase().indexOf("mercury") !== -1) {
            return "With no atmosphere to trap heat and a 176-day solar cycle, Mercury bakes at 430°C by day and plunges to -180°C at night.";
          }
          return "Surface temperature reflects the balance between incoming solar flux, surface reflectivity (albedo), and greenhouse gas trapping.";
        }
      },
      {
        match: ["bulk density", "mean density", "density"],
        getTitle: function() { return "BULK DENSITY (MASS PER VOLUME)"; },
        getCourseTag: function() { return "EARTH & PLANETARY SCIENCE"; },
        scriptPhrases: ["5.514", "bulk density", "iron core", "silicate crust", "compressed hydrogen", "less dense than water"],
        explain: function(val) {
          const s = String(val);
          if (s.indexOf("5.") !== -1) return "Surface rock is only ~2.7 g/cm³. A planetary average of " + s + " proves a dense metallic iron-nickel core hides inside.";
          return "Comparing bulk density (" + s + ") to silicate rock (2.7 g/cm³) and iron (7.9 g/cm³) reveals a planet's core-to-mantle ratio.";
        }
      },
      {
        match: ["resonance", "spin-orbit", "rotation", "sidereal", "solar day", "period"],
        getTitle: function() { return "SPIN-ORBIT RESONANCE & PERIOD"; },
        getCourseTag: function() { return "ORBITAL MECHANICS"; },
        scriptPhrases: ["3:2", "spin-orbit resonance", "retrograde rotation", "87.9", "243", "9.9-hour", "orbital period"],
        explain: function(val) {
          return String(val).indexOf("3:2") !== -1
            ? "Solar gravity locked Mercury into spinning 3 times for every 2 orbits—making 1 sunny day on Mercury last 176 Earth days."
            : "Tidal friction and angular momentum govern rotation speed and seasonal cycles.";
        }
      },
      {
        match: ["mass"],
        getTitle: function() { return "GRAVITATIONAL MASS"; },
        getCourseTag: function() { return "PHYSICS 101 • NEWTON'S GRAVITY"; },
        scriptPhrases: ["fusing 600 million tons", "1.989", "317.8", "solar-mass", "4.297", "supermassive"],
        explain: function() {
          return "Mass governs gravitational pull (F = G·m₁m₂/r²), determining whether a body can ignite core fusion or retain an atmosphere.";
        }
      },
      {
        match: ["pressure", "atmosphere", "bar", "mpa"],
        getTitle: function() { return "ATMOSPHERIC SURFACE PRESSURE"; },
        getCourseTag: function() { return "THERMODYNAMICS & CLIMATOLOGY"; },
        scriptPhrases: ["92 bar", "9.2 mpa", "crushing", "carbon dioxide atmosphere", "sulfuric acid"],
        explain: function() {
          return "Earth sea level is 1 bar. Venus's 92-bar CO₂ blanket crushes spacecraft and traps extreme runaway greenhouse heat.";
        }
      }
    ];

export const SURFACE_FEATURE_REGISTRY = {
      "Sun": [
        {
          id: "sun-core",
          name: "Proton-Proton Fusion Core",
          keywords: ["fusing 600 million tons", "hydrogen into helium", "core"],
          lat: 0, lon: 0, zoomRatio: 0.52,
          courseNote: "Nuclear Astrophysics: At 1.57×10⁷ K, protons fuse into helium, converting 4 million tons of mass into radiant energy every second."
        },
        {
          id: "sun-photosphere",
          name: "Convective Photosphere",
          keywords: ["photosphere", "convective", "corona", "5,772"],
          lat: 12, lon: 18, zoomRatio: 0.55,
          courseNote: "MHD & Plasma Physics: Boiling convection cells (1,000 km wide) carry 5,772 K plasma to the visible surface."
        }
      ],
      "Mercury": [
        {
          id: "mercury-caloris",
          name: "Caloris Impact Basin",
          keywords: ["caloris impact basin", "caloris", "silicate crust"],
          lat: 14.0, lon: -18.0, zoomRatio: 0.42,
          courseNote: "Planetary Geology: A 1,550 km wide impact basin excavated by a 100 km asteroid ~3.9 billion years ago."
        },
        {
          id: "mercury-scarps",
          name: "Iron Core & Lobate Scarps",
          keywords: ["iron core", "3:2", "resonance"],
          lat: -10.0, lon: 15.0, zoomRatio: 0.45,
          courseNote: "Geophysics: Mercury's giant iron core occupies ~85% of its radius. As it cooled, the crust crumpled into mile-high cliff faults."
        }
      ],
      "Venus": [
        {
          id: "venus-clouds",
          name: "Sulfuric Acid Cloud Deck",
          keywords: ["sulfuric acid", "sulfuric", "greenhouse", "carbon dioxide"],
          lat: 10.0, lon: -15.0, zoomRatio: 0.45,
          courseNote: "Atmospheric Dynamics: Reflective H₂SO₄ clouds super-rotate around Venus in 4 days while trapping 737 K runaway greenhouse heat."
        },
        {
          id: "venus-maat",
          name: "Maat Mons & Pancake Domes",
          keywords: ["maat mons", "pancake domes", "volcanic"],
          lat: 4.0, lon: 18.0, zoomRatio: 0.42,
          courseNote: "Volcanology: Under crushing 92-bar pressure, viscous lava erupts into flat 'pancake domes' and shield volcanoes."
        }
      ],
      "Earth": [
        {
          id: "earth-oceans",
          name: "Liquid Water Hydrosphere",
          keywords: ["liquid water", "ocean", "tectonic", "biosphere"],
          lat: 8.0, lon: -20.0, zoomRatio: 0.44,
          courseNote: "Earth Systems Science: Liquid surface water lubricates tectonic plates, stabilizing Earth's long-term climate."
        },
        {
          id: "earth-core",
          name: "Geodynamo & Protective Atmosphere",
          keywords: ["magnetic", "nitrogen", "oxygen", "5.514"],
          lat: 16.0, lon: -15.0, zoomRatio: 0.46,
          courseNote: "Geophysics: Earth's 5.514 g/cm³ density proves a liquid-iron outer core generates our protective magnetic shield."
        }
      ],
      "Mars": [
        {
          id: "mars-olympus",
          name: "Olympus Mons Shield Volcano",
          keywords: ["olympus mons", "olympus", "volcano", "tharsis"],
          lat: 16.0, lon: -22.0, zoomRatio: 0.42,
          courseNote: "Tectonics: Without moving tectonic plates, Mars's crust sat stationary over a mantle hotspot, building a 21.9 km tall volcano."
        },
        {
          id: "mars-valles",
          name: "Valles Marineris Canyon",
          keywords: ["valles marineris", "canyon", "iron oxide", "polar"],
          lat: -12.0, lon: -18.0, zoomRatio: 0.44,
          courseNote: "Structural Geology: A 4,000 km tectonic rift valley (7 km deep) carved across Mars's rust-rich basaltic crust."
        }
      ],
      "Jupiter": [
        {
          id: "jupiter-grs",
          name: "Great Red Spot Anticyclone",
          keywords: ["great red spot", "anticyclonic", "ammonia", "bands"],
          lat: -18.0, lon: 22.0, zoomRatio: 0.48,
          courseNote: "Fluid Dynamics: Driven by Jupiter's rapid 9.9-hour spin and zero solid landmass friction, this high-pressure vortex is wider than Earth."
        },
        {
          id: "jupiter-metallic",
          name: "Metallic Hydrogen Envelope",
          keywords: ["metallic hydrogen", "galilean"],
          lat: 10.0, lon: 15.0, zoomRatio: 0.50,
          courseNote: "Condensed Matter Physics: At 2 million bars of pressure, hydrogen electrons squeeze free into an electrically conductive liquid metal."
        }
      ],
      "Saturn": [
        {
          id: "saturn-rings",
          name: "Cassini Ring System",
          keywords: ["ring", "cassini", "water-ice", "roche"],
          lat: 4.0, lon: 28.0, zoomRatio: 0.52,
          courseNote: "Celestial Mechanics: Inside Saturn's Roche Limit, tidal forces keep 99.9% pure water-ice boulders spread into a razor-thin ring plane."
        },
        {
          id: "saturn-hexagon",
          name: "North Polar Hexagon",
          keywords: ["hexagon", "jet stream"],
          lat: 28.0, lon: 0.0, zoomRatio: 0.46,
          courseNote: "Wave Mechanics: Steep wind shear at 78°N creates a stable, 6-sided Rossby standing wave wider than two Earths."
        }
      ]
    };

export const NOVA_NASA_DIST_AU = {
      sun: 0, mercury: 0.387, venus: 0.723, earth: 1.000, moon: 1.000,
      mars: 1.524, ceres: 2.767, jupiter: 5.204, saturn: 9.582,
      uranus: 19.201, neptune: 30.047, pluto: 39.482, haumea: 43.116,
      makemake: 45.430, eris: 67.864, sedna: 83.5, "90377-sedna": 83.5,
      "halleys-comet": 35.1, halley: 35.1, "voyager-1": 166.0, "voyager-2": 139.0
    };

export const NOVA_NASA_DIST_LY = {
      "oort-cloud": 0.79, "proxima-centauri": 4.2465, "alpha-centauri": 4.344,
      "barnards-star": 5.963, sirius: 8.60, vega: 25.04, arcturus: 36.7,
      "trappist-1": 40.66, betelgeuse: 548, rigel: 863,
      "orion-nebula": 1344, "crab-nebula": 6500, "eagle-nebula": 6500,
      "pillars-of-creation": 6500, "sagittarius-a-star": 26673, "milky-way": 26673,
      lmc: 163000, smc: 200000, andromeda: 2537000, triangulum: 2730000,
      "centaurus-a": 12000000, "sombrero-galaxy": 31100000, "messier-87": 53500000,
      "great-attractor": 250000000, "shapley-supercluster": 650000000,
      "bootes-void": 700000000, "smacs-0723": 4600000000, "el-gordo": 7000000000,
      "ton-618": 10800000000, earendel: 12900000000, "gn-z11": 13400000000
    };
