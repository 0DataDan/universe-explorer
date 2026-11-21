// NOVA Authoritative Astrophysical Data Archive & Tier Introductions

// === AUTHORITATIVE ASTROPHYSICAL DATA ARCHIVE (NASA / ESA / JPL / JWST) ===
export const ASTROPHYSICAL_ARCHIVE = {
      "sun": {
        metrics: [["Mass", "1.989 × 10^30 kg (1 M☉)"], ["Photosphere Temp", "5,772 K (Core: 1.57×10^7 K)"], ["Equatorial Radius", "696,340 km (109 R⊕)"], ["Luminosity", "3.828 × 10^26 W"]],
        facts: [
          "Contains 99.86% of the entire Solar System's mass, fusing ~600 million metric tons of hydrogen into helium every second via the proton–proton chain.",
          "Differential rotation spins its equator every 25.05 days while its polar regions take 34.4 days, twisting magnetic flux tubes to drive an 11-year solar cycle.",
          "Generates the heliosphere—a magnetized plasma bubble shielding the planets from high-energy galactic cosmic rays out beyond 120 AU."
        ]
      },
      "mercury": {
        metrics: [["Mean Radius", "2,439.7 km (0.383 R⊕)"], ["Orbital Period", "87.969 Earth days"], ["Spin-Orbit Resonance", "3:2 (58.65d sidereal)"], ["Surface Temp", "100 K to 700 K"]],
        facts: [
          "Possesses a metallic iron-nickel core occupying ~85% of the planet's radius—making it the second-densest major planet after Earth (5.427 g/cm³).",
          "Locked in a 3:2 spin-orbit resonance: Mercury completes exactly three axial rotations for every two revolutions around the Sun.",
          "NASA's MESSENGER spacecraft confirmed water ice and organic volatiles trapped inside permanently shadowed polar impact craters."
        ]
      },
      "venus": {
        metrics: [["Mean Radius", "6,051.8 km (0.949 R⊕)"], ["Surface Pressure", "92 bar (9.2 MPa)"], ["Mean Surface Temp", "737 K (464 °C)"], ["Axial Obliquity", "177.36° (Retrograde)"]],
        facts: [
          "Crushed beneath a supercritical CO₂ atmosphere (96.5%) veiled by reflective sulfuric acid clouds, creating the strongest runaway greenhouse effect in the Solar System.",
          "Rotates retrograde once every 243.025 Earth days—longer than its 224.7-day orbital year—causing the Sun to rise in the west and set in the east.",
          "Magellan radar altimetry revealed pancake domes, coronae, and vast basaltic plains, with recent reanalysis confirming active volcanic vents at Maat Mons."
        ]
      },
      "earth": {
        metrics: [["Equatorial Radius", "6,378.1 km (1.0 R⊕)"], ["Bulk Density", "5.514 g/cm³ (Highest)"], ["Atmosphere", "78% N₂, 21% O₂, 1% Ar"], ["Escape Velocity", "11.186 km/s"]],
        facts: [
          "The only known world with active plate tectonics driven by mantle convection and persistent liquid water oceans covering 70.8% of its crust.",
          "Its convecting liquid iron-nickel outer core generates a dipolar magnetosphere (~25–65 μT) that deflects solar wind stripping and traps the Van Allen radiation belts.",
          "Stabilized at a 23.44° axial tilt by the gravitational torque of its unusually massive Moon, regulating long-term climatic cycles."
        ]
      },
      "moon": {
        metrics: [["Mean Radius", "1,737.4 km (0.273 R⊕)"], ["Perigee / Apogee", "363,300 / 405,500 km"], ["Synodic Period", "29.5306 days"], ["Recession Rate", "+3.82 cm/year"]],
        facts: [
          "Formed ~4.51 billion years ago from debris ejected by a giant oblique collision between proto-Earth and the Mars-sized impactor Theia.",
          "Tidal friction transfers angular momentum from Earth's rotation to the lunar orbit, lengthening Earth's day by ~2.3 ms per century.",
          "The near side is dominated by dark basaltic lava plains (maria) where the crust is thinner, whereas the far side features a heavily cratered anorthositic highland crust."
        ]
      },
      "mars": {
        metrics: [["Mean Radius", "3,389.5 km (0.532 R⊕)"], ["Surface Gravity", "3.721 m/s² (0.38 g)"], ["Sidereal Day", "24h 37m 22s"], ["Orbital Period", "686.98 Earth days"]],
        facts: [
          "Home to Olympus Mons—the largest volcano in the Solar System at 21.9 km high—and Valles Marineris, a tectonic canyon system stretching over 4,000 km.",
          "Retains ancient valley networks, deltaic clay deposits (Jezero Crater), and polar layered ice caps testifying to a warmer, wetter Noachian epoch.",
          "Accompanied by two small, irregularly shaped captured or impact-generated moons, Phobos and Deimos, with Phobos spiraling inward toward eventual tidal disruption."
        ]
      },
      "ceres": {
        metrics: [["Mean Radius", "469.7 km"], ["Mass", "9.38 × 10^20 kg"], ["Orbital Period", "4.60 years (2.77 AU)"], ["Bulk Density", "2.162 g/cm³"]],
        facts: [
          "The largest body in the Main Asteroid Belt and the only inner-system dwarf planet, comprising roughly one-third of the belt's total mass.",
          "NASA's Dawn mission discovered bright sodium carbonate evaporite deposits (Cerealia and Vinalia Faculae) inside Occator Crater fed by a deep muddy brine reservoir.",
          "Its low bulk density indicates a partially differentiated interior rich in hydrated phyllosilicates, water ice, and volatile salts."
        ]
      },
      "jupiter": {
        metrics: [["Equatorial Radius", "71,492 km (11.21 R⊕)"], ["Mass", "1.898 × 10^27 kg (317.8 M⊕)"], ["Sidereal Rotation", "9h 55m 30s (Fastest)"], ["Known Moons", "95 (4 Galilean)"]],
        facts: [
          "Contains 2.5 times the combined mass of all other Solar System planets; deep interior pressures compress hydrogen into an electrically conducting liquid metallic fluid.",
          "Its rapid 9.9-hour spin flattens the globe by 6.5% and drives alternating zonal jet streams and the Great Red Spot, an anticyclone larger than Earth.",
          "Rules a miniature planetary system including volcanically hyperactive Io, subsurface-ocean world Europa, magnetized Ganymede, and ancient Callisto."
        ]
      },
      "saturn": {
        metrics: [["Equatorial Radius", "60,268 km (9.45 R⊕)"], ["Bulk Density", "0.687 g/cm³ (< Water)"], ["Ring Span", "282,000 km (Main Rings)"], ["Known Moons", "146 confirmed"]],
        facts: [
          "Boasts the lowest mean density of any planet (0.687 g/cm³) and a spectacular ring system composed of 99.9% pure water-ice particles ranging from microns to meters.",
          "Features a persistent 29,000-km-wide hexagonal jet-stream wave encircling its north pole and a warm polar cyclone at both poles.",
          "Hosts Titan—the only moon with a dense nitrogen-methane atmosphere and liquid hydrocarbon seas—and Enceladus, which vents hydrothermal water plumes from its south pole."
        ]
      },
      "uranus": {
        metrics: [["Mean Radius", "25,362 km (4.01 R⊕)"], ["Axial Obliquity", "97.77° (Sideways)"], ["Tropopause Temp", "49 K (−224 °C)"], ["Orbital Period", "84.02 years (19.2 AU)"]],
        facts: [
          "Tilted 97.77° onto its side—likely from a colossal primordial protoplanet impact—causing extreme 42-year-long polar summers and winters.",
          "Radiates virtually no excess internal heat compared to other giant planets, giving it the coldest planetary atmosphere in the Solar System at 49 K.",
          "Surrounded by 13 narrow, dark rings and 28 moons named after characters from William Shakespeare and Alexander Pope."
        ]
      },
      "neptune": {
        metrics: [["Mean Radius", "24,622 km (3.88 R⊕)"], ["Orbital Period", "164.8 years (30.1 AU)"], ["Peak Wind Speed", "2,100 km/h (Supersonic)"], ["Internal Heat Ratio", "2.61× absorbed solar"]],
        facts: [
          "The first planet predicted by mathematical perturbation analysis (Le Verrier & Adams) before its telescopic discovery by Johann Galle in 1846.",
          "Radiates 2.61 times more thermal energy than it receives from the distant Sun, powering supersonic equatorial methane-cloud winds reaching 2,100 km/h.",
          "Its largest moon, Triton, orbits retrograde and erupts nitrogen-ice geysers—strong evidence that it is a captured Kuiper Belt dwarf planet."
        ]
      },
      "halley-comet": {
        metrics: [["Nucleus Dimensions", "15 × 8 × 8 km"], ["Orbital Period", "75–79 years (Retrograde)"], ["Perihelion / Aphelion", "0.586 AU / 35.1 AU"], ["Surface Albedo", "0.04 (Coal-black)"]],
        facts: [
          "The archetype of short-period Halley-type comets, recorded by astronomers in every apparition since at least 240 BCE.",
          "ESA's Giotto probe imaged its peanut-shaped nucleus in 1986, revealing a pitch-black refractory organic crust venting localized jets of H₂O, CO, and dust.",
          "Will reach aphelion in late 2023–2024 and return to the inner Solar System for its next perihelion passage in July 2061."
        ]
      },
      "oumuamua": {
        metrics: [["Estimated Length", "~100–230 m (Aspect ~6:1)"], ["Hyperbolic Eccentricity", "e = 1.201 (Unbound)"], ["Hyperbolic Excess Vel", "26.33 km/s (v∞)"], ["Rotation Period", "7.3 to 8.7 hours"]],
        facts: [
          "The first macroscopic interstellar object ever detected passing through the Solar System, discovered by Pan-STARRS1 in October 2017.",
          "Exhibited extreme brightness variations (~10:1) indicative of a tumbling cigar- or pancake-like geometry with a reddened, cosmic-ray-weathered surface.",
          "Experienced measurable non-gravitational acceleration on its outbound leg without any visible dust coma, attributed to outgassing of subsurface volatiles or H₂."
        ]
      },
      "sedna": {
        metrics: [["Estimated Diameter", "~995 km"], ["Perihelion / Aphelion", "76.2 AU / ~937 AU"], ["Orbital Period", "~11,400 years"], ["Spectral Color", "Ultra-red (Tholins)"]],
        facts: [
          "A detached extreme trans-Neptunian dwarf planet candidate whose perihelion (76.2 AU) is far beyond the gravitational scattering reach of Neptune.",
          "Its highly elongated 11,400-year orbit bridges the scattered disk and the inner Hills Oort Cloud, possibly sculpted by a passing star in the Sun's birth cluster.",
          "Coated in one of the reddest surfaces in the Solar System due to ultraviolet polymerization of methane and nitrogen ices into complex tholin hydrocarbons."
        ]
      },
      "proxima-centauri": {
        metrics: [["Mass / Radius", "0.122 M☉ / 0.154 R☉"], ["Spectral Type", "M5.5Ve Red Dwarf"], ["Bolometric Luminosity", "0.00155 L☉ (0.15%)"], ["Confirmed Exoplanets", "Proxima b & d"]],
        facts: [
          "Fully convective interior keeps helium ash mixed throughout the core, allowing Proxima Centauri to fuse hydrogen steadily for ~4 trillion years.",
          "Hosts Proxima Centauri b, a 1.07-Earth-mass terrestrial world orbiting inside the habitable zone at 0.0485 AU with an 11.186-day period.",
          "Subject to powerful magnetic superflares that can briefly surge its ultraviolet and X-ray brightness by orders of magnitude."
        ]
      },
      "rigil-kentaurus": {
        metrics: [["Mass / Radius", "1.079 M☉ / 1.217 R☉"], ["Spectral Type", "G2V (Solar Twin)"], ["Bolometric Luminosity", "1.505 L☉"], ["Binary Period (with B)", "79.76 years"]],
        facts: [
          "Shares the exact G2V spectral classification of our Sun, though slightly older (~5.3 Gyr) and enriched in heavy elements (~170% solar metallicity).",
          "Orbits a common barycenter with Toliman (Alpha Centauri B) in an eccentric ellipse ranging from 11.2 AU (Saturn's distance) to 35.6 AU (Pluto's distance).",
          "Fourth-brightest star in Earth's night sky (apparent magnitude −0.01) and prime target for JWST coronagraphic direct-imaging searches."
        ]
      },
      "toliman": {
        metrics: [["Mass / Radius", "0.909 M☉ / 0.859 R☉"], ["Spectral Type", "K1V Orange Dwarf"], ["Effective Temp", "5,260 K"], ["Luminosity", "0.498 L☉"]],
        facts: [
          "K-type main-sequence stars like Toliman are prized astrobiological 'Goldilocks' hosts due to their 15–30 Gyr lifespans and calmer X-ray emission than M-dwarfs.",
          "Completes a 79.76-year mutual orbit with Rigil Kentaurus while gravitationally binding distant Proxima Centauri at ~13,000 AU.",
          "Exhibits solar-like acoustic p-mode oscillations measured via high-precision radial velocity spectroscopy."
        ]
      },
      "barnards-star": {
        metrics: [["Proper Motion", "10.39 arcsec/year (Highest)"], ["Mass / Radius", "0.162 M☉ / 0.187 R☉"], ["Stellar Age", "~10 billion years (Pop II)"], ["Confirmed Planet", "Barnard b (2024 ESPRESSO)"]],
        facts: [
          "Holds the record for the fastest apparent proper motion of any star in the sky, racing across the background stars by the width of the full Moon every 175 years.",
          "Approaching the Solar System at a radial velocity of −110.1 km/s; it will make its closest pass at ~3.75 light-years around the year 11,800 CE.",
          "In 2024, ESO's VLT ESPRESSO spectrograph confirmed Barnard b, a sub-Earth-mass exoplanet (0.37 M⊕) orbiting every 3.15 days."
        ]
      },
      "sirius": {
        metrics: [["Mass / Radius", "2.063 M☉ / 1.711 R☉"], ["Spectral Type", "A0mA1 Va Main-Sequence"], ["Luminosity", "25.4 L☉"], ["Apparent Magnitude", "−1.46 (Brightest Star)"]],
        facts: [
          "The brightest star in Earth's night sky, radiating 25.4 times the Sun's luminosity from a distance of just 2.64 parsecs (8.60 light-years).",
          "Classified as a metallic-line Am star enriched in iron and heavy elements levitated into its upper atmosphere by radiative pressure.",
          "Gradually brightening as it approaches the Solar System at −5.5 km/s, peaking in apparent brilliance in roughly 60,000 years."
        ]
      },
      "sirius-b": {
        metrics: [["Mass / Radius", "1.018 M☉ / 0.0084 R☉ (~1 R⊕)"], ["Surface Gravity", "log g = 8.57 (~350,000 g)"], ["Effective Temp", "25,200 K"], ["Mean Density", "~2.4 × 10^6 g/cm³"]],
        facts: [
          "The nearest and first-discovered white dwarf star (1862), packing the mass of our entire Sun into a degenerate carbon-oxygen sphere the size of Earth.",
          "Evolved from a ~5-solar-mass B-type progenitor star that shed its outer envelope as a planetary nebula ~120 million years ago.",
          "Its intense surface gravity causes a measurable general-relativistic gravitational redshift of ~80.5 km/s in its spectral lines."
        ]
      },
      "trappist-1": {
        metrics: [["Mass / Radius", "0.0898 M☉ / 0.1192 R☉"], ["Spectral Type", "M8V Ultra-Cool Dwarf"], ["Confirmed Planets", "7 terrestrial (b–h)"], ["System Compactness", "All 7 inside 0.062 AU"]],
        facts: [
          "Barely above the 0.08 M☉ hydrogen-fusion threshold—roughly the physical radius of Jupiter—yet hosting seven rocky, Earth-sized planets.",
          "All seven planets orbit closer to their star than Mercury orbits the Sun and are locked in a near-exact Laplace orbital resonance chain.",
          "Planets e, f, and g reside inside the circumstellar habitable zone and are flagship targets for JWST transmission spectroscopy."
        ]
      },
      "polaris": {
        metrics: [["Primary Mass / Radius", "5.4 M☉ / 37.5 R☉"], ["Spectral Type", "F7Ib Yellow Supergiant"], ["Pulsation Period", "3.9696 days (Cepheid)"], ["Luminosity", "~1,260 L☉"]],
        facts: [
          "Located within 0.65° of the north celestial pole, serving as Earth's current northern pole star due to axial precession.",
          "The nearest Classical Cepheid variable star, whose period-luminosity relation forms the foundational rung of the extragalactic distance ladder.",
          "Anchor of a hierarchical triple system accompanied by main-sequence companions Polaris Ab (18.5 AU) and Polaris B (2,400 AU)."
        ]
      },
      "betelgeuse": {
        metrics: [["Radius", "~764 R☉ (~3.5 AU)"], ["Mass", "16.5–19 M☉"], ["Bolometric Luminosity", "~126,000 L☉"], ["Effective Temp", "3,600 K (M1–M2 Ia-ab)"]],
        facts: [
          "If placed at the center of our Solar System, Betelgeuse's photosphere would engulf Mercury, Venus, Earth, Mars, and the inner Asteroid Belt.",
          "Underwent the 'Great Dimming' in 2019–2020 when a gigantic convective surface plume ejected a cooling titanium-oxide dust cloud across its southern hemisphere.",
          "Expected to exhaust its core nuclear fuel and detonate as a core-collapse Type II supernova within the next ~100,000 years."
        ]
      },
      "orion-nebula": {
        metrics: [["Physical Diameter", "24 light-years (7.4 pc)"], ["Ionizing Cluster", "Trapezium (θ¹ Orionis C)"], ["Distance", "1,344 ± 20 light-years"], ["Catalog ID", "M42 / NGC 1976"]],
        facts: [
          "The closest region of massive star formation to Earth, visible to the naked eye as the middle 'star' in the sword of Orion.",
          "Ultraviolet radiation from the 40-solar-mass O-star θ¹ Orionis C carves a blister H II cavity into the parent Orion Molecular Cloud.",
          "Hubble and JWST observations have cataloged over 150 'proplyds' (protoplanetary disks) being photoevaporated by stellar winds."
        ]
      },
      "crab-nebula": {
        metrics: [["Progenitor Supernova", "SN 1054 CE (July 4, 1054)"], ["Expansion Velocity", "~1,500 km/s"], ["Central Pulsar Spin", "30.2 Hz (33.1 ms)"], ["Total Luminosity", "7.5 × 10^4 L☉"]],
        facts: [
          "The expanding remnant of a core-collapse supernova recorded by Chinese, Japanese, and Islamic astronomers in 1054 CE that remained visible in daylight for 23 days.",
          "Powered at its heart by the Crab Pulsar (PSR B0531+21)—a 20-km-wide magnetized neutron star spinning 30.2 times per second.",
          "Relativistic electrons spiraling through the nebula's magnetic field emit polarized synchrotron radiation from radio to TeV gamma rays."
        ]
      },
      "eagle-nebula": {
        metrics: [["Physical Span", "~70 × 55 light-years"], ["Core Cluster", "NGC 6611 (~2 Myr old)"], ["Tallest Pillar Height", "~4–5 light-years"], ["Catalog ID", "M16 / IC 4703"]],
        facts: [
          "Immortalized by Hubble and JWST images of the 'Pillars of Creation'—towering elephant-trunk columns of cold molecular hydrogen and cosmic dust.",
          "Fierce ultraviolet radiation from hot O- and B-type stars in open cluster NGC 6611 sculpts and photo-ionizes the pillar tips, exposing nascent protostars.",
          "Spitzer and JWST mid-infrared observations revealed warm dust shells suggesting a nearby supernova shockwave may be eroding the pillars."
        ]
      },
      "stephenson-2-18": {
        metrics: [["Estimated Radius", "~2,150 R☉ (~10.0 AU)"], ["Volume vs Sun", "~10 billion × V☉"], ["Effective Temp", "3,200 K (M6 Red Hypergiant)"], ["Bolometric Luminosity", "~437,000 L☉"]],
        facts: [
          "One of the largest known stars in the observable universe; centered at the Sun, its photosphere would extend out to the orbit of Saturn.",
          "It takes light over 8.7 hours to travel once around its equator, compared to just 14.5 seconds for the Sun.",
          "Sheds mass rapidly via a dense dusty stellar wind near the empirical Humphreys–Davidson luminosity limit for cool hypergiants."
        ]
      },
      "sagittarius-a-star": {
        metrics: [["Mass", "4.154 × 10^6 M☉"], ["Schwarzschild Radius", "1.23 × 10^7 km (~0.08 AU)"], ["Shadow Angular Size", "51.8 microarcseconds"], ["Distance to Sol", "26,670 ± 42 light-years"]],
        facts: [
          "The supermassive black hole anchoring the Milky Way's center, confirmed by 30-year tracking of the star S2 (which reaches 7,650 km/s at pericenter).",
          "Directly imaged by the Event Horizon Telescope (EHT) collaboration in May 2022, revealing a glowing ring of magnetically arrested plasma around the shadow.",
          "Produces frequent X-ray and near-infrared synchrotron flares as magnetic reconnection events accelerate hot spots near the innermost stable circular orbit (ISCO)."
        ]
      },
      "lmc": {
        metrics: [["Diameter", "~32,200 light-years"], ["Stellar Mass", "~2.7 × 10^9 M☉"], ["Total Halo Mass", "~1.4 × 10^11 M☉"], ["Distance", "163,000 light-years"]],
        facts: [
          "The fourth-largest galaxy in the Local Group, displaying an off-center stellar bar and a single prominent spiral arm tidally distorted by the Milky Way.",
          "Contains the Tarantula Nebula (30 Doradus)—the most violent and luminous starburst region in the entire Local Group (~1,000 light-years across).",
          "Site of SN 1987A, the closest observed supernova since Kepler's 1604 supernova and the first astrophysical source detected via neutrinos."
        ]
      },
      "smc": {
        metrics: [["Diameter", "~18,900 light-years"], ["Stellar Mass", "~3.1 × 10^8 M☉"], ["Metallicity", "~20% Solar (Metal-poor)"], ["Distance", "~203,700 light-years"]],
        facts: [
          "Linked to the Large Magellanic Cloud and the Milky Way by the Magellanic Bridge and the 600,000-light-year-long Magellanic Stream of neutral hydrogen.",
          "Here Henrietta Swan Leavitt discovered the Cepheid Period–Luminosity relation in 1912, revolutionizing humanity's measurement of cosmic distances.",
          "Line-of-sight velocity and proper-motion studies indicate the SMC is being tidally stretched into two distinct star-forming substructures."
        ]
      },
      "andromeda": {
        metrics: [["D25 Isophotal Diameter", "~152,000 light-years"], ["Estimated Stars", "~1 trillion (10^12)"], ["Heliocentric Radial Vel", "−301 km/s (Blueshifted)"], ["Galactocentric Approach", "~110 km/s"]],
        facts: [
          "The largest spiral galaxy in the Local Group (M31), containing roughly twice as many stars as the Milky Way and a double-peaked stellar nucleus surrounding a ~1.4×10^8 M☉ black hole.",
          "Edwin Hubble's 1923 identification of Cepheid variables in M31 proved that spiral nebulae are external 'island universes' far outside the Milky Way.",
          "On a gravitational collision course with the Milky Way; the two spirals will begin their first tidal pericenter passage in ~4.5 billion years to form a giant elliptical ('Milkomeda')."
        ]
      },
      "triangulum": {
        metrics: [["Diameter", "~61,100 light-years"], ["Estimated Stars", "~40 billion"], ["Morphological Type", "SA(s)cd Flocculent Spiral"], ["Catalog ID", "M33 / NGC 598"]],
        facts: [
          "The third-largest member of the Local Group and an unbarred, pure-disk spiral galaxy with no detectable central bulge or supermassive black hole (>1,500 M☉ limit).",
          "Hosts NGC 604, a cavernous H II star-forming complex spanning 1,500 light-years—nearly 40 times larger than the visible Orion Nebula.",
          "Likely bound on a wide orbital infall trajectory around the more massive Andromeda Galaxy."
        ]
      },
      "centaurus-a": {
        metrics: [["Morphology", "S0 pec / E2 Merger"], ["Central Black Hole", "5.5 × 10^7 M☉"], ["Relativistic Jet Span", "> 1,000,000 light-years"], ["Catalog ID", "NGC 5128"]],
        facts: [
          "The closest active radio galaxy (AGN) to Earth, forged ~100–500 million years ago when a giant elliptical galaxy devoured a dusty gas-rich spiral.",
          "Twin relativistic plasma jets launched at ~0.5c from its central supermassive black hole inflate radio lobes spanning 8° across the southern sky.",
          "Imaged at sub-millimeter wavelengths by the Event Horizon Telescope, revealing edge-brightened collimation of the jet base."
        ]
      },
      "sombrero-galaxy": {
        metrics: [["Diameter", "~94,900 light-years"], ["Central Black Hole", "~1.0 × 10^9 M☉"], ["Globular Clusters", "~2,000 (10× Milky Way)"], ["Catalog ID", "M104 / NGC 4594"]],
        facts: [
          "Seen nearly edge-on (6° north of its equatorial plane), showcasing a brilliant elliptical-like bulge encircled by a razor-sharp symmetric dust ring.",
          "JWST's MIRI mid-infrared camera resolved clumpy polycyclic aromatic hydrocarbon (PAH) knots and a smooth inner disk surrounding its billion-solar-mass black hole.",
          "Retains an extraordinary halo population of ~2,000 globular star clusters—ten times more than orbit the Milky Way."
        ]
      },
      "messier-87": {
        metrics: [["Stellar Mass", "~2.4 × 10^12 M☉"], ["Central Black Hole (M87*)", "6.5 × 10^9 M☉"], ["Globular Clusters", "~12,000–15,000"], ["Relativistic Jet Length", "~4,900 light-years"]],
        facts: [
          "The dominant cD supergiant elliptical galaxy at the dynamical heart of the Virgo Cluster, grown through dozens of galactic mergers.",
          "In April 2019, its central black hole M87* became the first black hole in history to have its event-horizon shadow directly imaged by the Event Horizon Telescope.",
          "Launches a collimated synchrotron plasma jet extending 1.5 kiloparsecs, where superluminal plasma knots travel at apparent speeds >4c."
        ]
      },
      "great-attractor": {
        metrics: [["Total Mass Concentration", "~10^16 M☉"], ["Peculiar Flow Velocity", "~600 km/s (Local Group)"], ["Redshift Space", "z ≈ 0.015–0.02 (Norma)"], ["Parent Structure", "Laniakea Supercluster"]],
        facts: [
          "The focal gravitational valley of the Laniakea Supercluster, drawing the Milky Way and 100,000 neighboring galaxies inward along converging cosmic filaments.",
          "Partially obscured behind the 'Zone of Avoidance' (the dusty plane of the Milky Way), where X-ray and radio surveys revealed the Norma Cluster (ACO 3627) at its core.",
          "Laniakea itself is being pulled toward the even more massive Shapley Supercluster further along the same large-scale filament."
        ]
      },
      "shapley-supercluster": {
        metrics: [["Total Mass", "~10^16.3 M☉ (~2 × 10^16 M☉)"], ["Rich Abell Clusters", "> 25 gravitationally bound"], ["Span", "~260 Mpc (~650 Mly)"], ["Central Redshift", "z ≈ 0.048"]],
        facts: [
          "First noticed by Harlow Shapley in 1930 as a striking overdensity of 76,000 galaxies on photographic plates in the constellation Centaurus.",
          "The densest gravitationally bound concentration of matter in the local universe, anchored by the colliding cluster core Abell 3558.",
          "Exerts the dominant long-range gravitational pull responsible for ~55% of the Local Group's 630 km/s dipole motion relative to the CMB."
        ]
      },
      "bootes-void": {
        metrics: [["Approximate Diameter", "~330 million light-years"], ["Volume", "~236,000 Mpc³"], ["Known Galaxies Inside", "60 (vs ~2,000 expected)"], ["Center Redshift", "z ≈ 0.052"]],
        facts: [
          "Discovered by Robert Kirshner and colleagues in 1981, this cavernous 'Supervoid' represents ~0.27% of the diameter of the observable universe.",
          "If the Milky Way were situated at the center of the Boötes Void, humanity would not have known other galaxies existed until the 1960s.",
          "Formed through the hierarchical merger of smaller primordial underdensities as surrounding cosmic web filaments evacuated matter outward."
        ]
      },
      "smacs-0723": {
        metrics: [["Cluster Redshift", "z = 0.390"], ["Lookback Time", "4.24 billion years"], ["Lensed Background Arcs", "z = 1.3 to z > 8.5"], ["Total Cluster Mass", "~8.4 × 10^14 M☉"]],
        facts: [
          "Subject of the historic 'Webb's First Deep Field' released on July 11, 2022—the deepest sharp infrared image of the cosmos at the time.",
          "Its immense dark-matter halo warps spacetime into a cosmic magnifying glass, stretching distant background galaxies into glowing Einstein arcs.",
          "Enabled JWST NIRSpec to measure direct oxygen, neon, and hydrogen emission spectra from galaxies formed less than 1 billion years after the Big Bang."
        ]
      },
      "el-gordo": {
        metrics: [["Total Mass", "2.1–3.0 × 10^15 M☉"], ["Redshift", "z = 0.870 (7.2 Gly lookback)"], ["Collision Velocity", "~2,500 km/s"], ["ICM X-ray Temp", "~1.45 × 10^8 K (12.5 keV)"]],
        facts: [
          "Officially ACT-CL J0102-4915 ('The Fat One'), the most massive galaxy cluster discovered at redshift z > 0.8, containing the mass of 3 quadrillion Suns.",
          "Caught in the act of a violent titanic collision between two sub-clusters smashing together at ~2,500 km/s, creating a cometary X-ray wake in Chandra data.",
          "JWST lensing observations revealed ultra-stretched background galaxies ('La Flaca' and 'El Anzuelo') and dark-matter mass offsets."
        ]
      },
      "ton-618": {
        metrics: [["Black Hole Mass", "4.0–6.6 × 10^10 M☉"], ["Bolometric Luminosity", "1.4 × 10^14 L☉ (M_V = −30.7)"], ["Schwarzschild Diameter", "~2,600 AU (~3.9×10^11 km)"], ["Redshift", "z = 2.219 (10.8 Gly lookback)"]],
        facts: [
          "A hyperluminous broad-absorption-line quasar powered by one of the most massive black holes ever measured—over 40 billion solar masses.",
          "Its accretion disk shines as brightly as 140 trillion Suns, outshining its entire surrounding host galaxy by orders of magnitude.",
          "Its event horizon spans ~2,600 AU—more than 30 times the diameter of Pluto's orbit—and illuminates a 300,000-light-year Lyman-alpha nebula."
        ]
      },
      "earendel": {
        metrics: [["Redshift", "z = 6.2 ± 0.1"], ["Lookback / Comoving", "12.9 Gly / ~28.0 Gly"], ["Lensing Magnification", "μ ≈ 4,000× to 40,000×"], ["Estimated Mass", "> 50 M☉ (B-type Star)"]],
        facts: [
          "Officially WHL0137-LS ('Morning Star' in Old English), the most distant individual star ever detected, shining just 900 million years after the Big Bang.",
          "Positioned precisely on the gravitational lensing 'critical curve' of foreground cluster WHL0137-08, magnifying its flux by over 4,000-fold along the Sunrise Arc.",
          "JWST NIRCam photometry indicates a hot B-type star (20,000–30,000 K) with a possible cooler redder binary companion."
        ]
      },
      "gn-z11": {
        metrics: [["Spectroscopic Redshift", "z = 10.6034"], ["Lookback / Comoving", "13.4 Gly / ~32.2 Gly"], ["Stellar Mass", "~10^9 M☉ (in ~1.2 kpc)"], ["Central AGN Black Hole", "~1.6 × 10^6 M☉ (JWST)"]],
        facts: [
          "A compact, intensely star-forming Lyman-break galaxy observed as it existed just 430 million years after the Big Bang (~3% of the universe's current age).",
          "Forms stars ~20 times faster than the present-day Milky Way despite having a half-light radius of only ~2,000 light-years.",
          "In 2024, JWST NIRSpec detected high-ionization neon/nitrogen lines and fast outflows driven by an actively accreting 1.6-million-solar-mass central black hole."
        ]
      }
    };

export const TIER_INTROS = {
      1: {
        badge: "10^9 TO 10^13 M",
        title: "The Solar System",
        type: "Gravity-Dominated Planetary Regime • 0.05 AU to 120 AU",
        distance: "0.00 to 160 AU (Heliospheric Boundary)",
        scale_order: "10^9 m to 10^13 m",
        summary: "Our cosmic voyage begins inside the Sun's gravitational and magnetic domain. Within the Heliosphere orbit the four rocky terrestrial planets, the dwarf planet Ceres, our moon, the four giant planets, periodic comets, and detached outer trans-Neptunian worlds.", 
        metrics: [["Central Anchor", "The Sun (99.86% Mass)"], ["Ecliptic Span", "~60 AU (Neptune/Kuiper)"], ["Heliopause Boundary", "~120 AU (Interstellar Medium)"], ["Gravitational Edge", "~50,000 AU (Oort Cloud)"]],
        facts: [
          "Planetary orbits lie within ~7° of the ecliptic plane, sculpted from a collapsing protoplanetary disk 4.568 billion years ago.",
          "Divided by the 'Frost Line' (~2.7 AU) into refractory silicate-iron terrestrial worlds inside and volatile-rich gas/ice giants outside.",
          "During this chapter, the tour visits all 14 cataloged Solar System bodies outward from the Sun to Sedna."
        ],
        camPos: { x: -45, y: 58, z: 62 },
        targetPos: { x: 0, y: 0, z: 0 },
        dwellMs: 25000
      },
      2: {
        badge: "10^16 TO 10^21 M",
        title: "The Stellar Neighborhood",
        type: "Interstellar & Galactic Core Regime • 4.2 ly to 26,670 ly",
        distance: "4.24 ly to 26,670 ly (Milky Way Disk & Core)",
        scale_order: "10^16 m to 10^21 m",
        summary: "Crossing the heliopause into interstellar space, distances leap by five orders of magnitude. Here in the Orion–Cygnus spiral arm and inward toward the Galactic Center dwell red and yellow dwarfs, binary white dwarfs, multi-planet systems, H II stellar nurseries, red hypergiants, pulsar wind nebulae, and our galaxy's central supermassive black hole.",
        metrics: [["Nearest Star", "Proxima Centauri (4.246 ly)"], ["Local Bubble Span", "~300 light-years"], ["Milky Way Disk", "~100,000 light-years"], ["Galactic Core Anchor", "Sagittarius A* (4.15×10^6 M☉)"]],
        facts: [
          "Approximately 75% of stars in the solar neighborhood are low-mass M-type red dwarfs invisible to the unaided eye.",
          "Massive OB stars ionize surrounding molecular clouds (Orion & Eagle Nebulae) before ending as core-collapse supernovae and pulsars (Crab Nebula).",
          "During this chapter, the tour visits all 14 interstellar landmarks from the Alpha Centauri triple system to Sagittarius A*."
        ],
        camPos: { x: 0, y: 95, z: 260 },
        targetPos: { x: 0, y: 0, z: -60 },
        dwellMs: 25000
      },
      3: {
        badge: "10^22 TO 10^24 M",
        title: "Galaxies & The Local Group",
        type: "Extragalactic & Supercluster Regime • 160 kly to 250 Mly",
        distance: "0.16 Mly to 220 Mly (Laniakea Supercluster)",
        scale_order: "10^22 m to 10^24 m",
        summary: "Pulling beyond the Milky Way's luminous disk, entire island universes populate the Local Group and the surrounding Virgo and Laniakea superclusters. Here gravitational interactions drive satellite dwarf streams, spiral galaxy collisions, AGN radio jets, and bulk supercluster flows.",
        metrics: [["Local Group Members", "> 80 Dwarf & Spiral Galaxies"], ["Primary Spirals", "Andromeda, Milky Way, M33"], ["Virgo Central Anchor", "Messier 87 (6.5×10^9 M☉ BH)"], ["Supercluster Basin", "Laniakea (~500 Mly span)"]],
        facts: [
          "The Milky Way and Andromeda (M31) dominate the Local Group's mass and are falling toward a major merger in ~4.5 billion years.",
          "Beyond ~10 Mly, Hubble expansion overtakes local gravity, though thousands of galaxies stream at ~600 km/s toward the Great Attractor.",
          "During this chapter, the tour visits all 8 extragalactic landmarks from the Magellanic Clouds to the Great Attractor."
        ],
        camPos: { x: 180, y: 180, z: 520 },
        targetPos: { x: 120, y: 20, z: -180 },
        dwellMs: 25000
      },
      4: {
        badge: "",
        title: "Deep Space & Observable Horizon",
        type: "Large-Scale Structure & Early Universe • 650 Mly to 46.5 Gly",
        distance: "650 Mly to 46.5 Gly (Comoving Horizon)",
        scale_order: "10^25 m to 8.8 × 10^26 m",
        summary: "At the grandest scale of physical reality, matter is woven into a vast fractal Cosmic Web of dark-matter filaments, dense supercluster nodes, and cavernous cosmic voids. Looking outward is looking backward in cosmic time—past colliding clusters and hyperluminous quasars to the first stars, primordial galaxies, and the surface of last scattering.",
        metrics: [["Observable Diameter", "93.0 Gly (8.8 × 10^26 m)"], ["Cosmic Web Composition", "68% Dark Energy, 27% DM, 5% Baryons"], ["Earliest Light (CMB)", "z ≈ 1089 (380,000 yr post-BB)"], ["Hubble Constant (H₀)", "~67.4–73.0 km/s/Mpc"]],
        facts: [
          "Acoustic density oscillations frozen into the primordial plasma at 380,000 years (CMB) seeded the supercluster nodes and voids we observe today.",
          "Gravitational lensing by foreground galaxy clusters (SMACS 0723, El Gordo) magnifies reionization-era stars and galaxies (Earendel, GN-z11).",
          "During this final chapter, the tour visits all 7 deep-field landmarks across the translucent fractal Cosmic Web."
        ],
        camPos: { x: 0, y: 360, z: 1350 },
        targetPos: { x: 0, y: 0, z: 0 },
        dwellMs: 25000
      }
    };
