import ssl
import os
import urllib.request
import numpy as np
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO_ROOT, "static", "textures")
os.makedirs(OUT_DIR, exist_ok=True)

BASE_URL = "https://www.solarsystemscope.com/textures/download/"

TEXTURES = {
    "mercury_albedo.jpg":    "2k_mercury.jpg",
    "venus_albedo.jpg":      "2k_venus_atmosphere.jpg",
    "earth_albedo.jpg":      "2k_earth_daymap.jpg",
    "earth_night.jpg":       "2k_earth_nightmap.jpg",
    "earth_clouds.jpg":      "2k_earth_clouds.jpg",
    "earth_specular.jpg":    "2k_earth_specular_map.jpg",
    "moon_albedo.jpg":       "2k_moon.jpg",
    "mars_albedo.jpg":       "2k_mars.jpg",
    "ceres_albedo.jpg":      "2k_ceres_fictional.jpg",
    "jupiter_albedo.jpg":    "2k_jupiter.jpg",
    "saturn_albedo.jpg":     "2k_saturn.jpg",
    "uranus_albedo.jpg":     "2k_uranus.jpg",
    "neptune_albedo.jpg":    "2k_neptune.jpg",
}

# Normal map strength per body (higher = deeper craters & sharper ridges)
NORMAL_SPECS = {
    "mercury": 4.2,
    "moon":    4.5,
    "mars":    3.8,
    "ceres":   5.0,
    "earth":   2.2,
    "jupiter": 0.9,
    "saturn":  0.7,
}

def download_file(filename, remote_name):
    dest = os.path.join(OUT_DIR, filename)
    if os.path.exists(dest) and os.path.getsize(dest) > 10000:
        print(f"  [skip] {filename} already exists")
        return dest
    url = BASE_URL + remote_name
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (NOVA-Observatory)"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ssl._create_unverified_context()) as resp, open(dest, "wb") as out:
            out.write(resp.read())
        size_kb = os.path.getsize(dest) // 1024
        print(f"  [ok]   {filename} ({size_kb} KB)")
        return dest
    except Exception as e:
        print(f"  [err]  {filename} failed: {e}")
        return None

def bake_normal_map(src_path, dst_path, strength=3.5):
    if not src_path or not os.path.exists(src_path):
        return
    img = Image.open(src_path).convert("L")
    h = np.asarray(img, dtype=np.float32) / 255.0

    # Wrap horizontally (longitude), clamp vertically (poles)
    h_pad = np.pad(h, ((1, 1), (0, 0)), mode="edge")
    h_pad = np.pad(h_pad, ((0, 0), (1, 1)), mode="wrap")

    # 3x3 Sobel gradients
    gx = (
        -h_pad[:-2, :-2] + h_pad[:-2, 2:]
        - 2.0 * h_pad[1:-1, :-2] + 2.0 * h_pad[1:-1, 2:]
        - h_pad[2:, :-2] + h_pad[2:, 2:]
    ) * strength
    gy = (
        -h_pad[:-2, :-2] - 2.0 * h_pad[:-2, 1:-1] - h_pad[:-2, 2:]
        + h_pad[2:, :-2] + 2.0 * h_pad[2:, 1:-1] + h_pad[2:, 2:]
    ) * strength

    nx = -gx
    ny = -gy
    nz = np.ones_like(h)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-8

    rgb = np.stack([
        ((nx / norm) * 0.5 + 0.5) * 255.0,
        ((ny / norm) * 0.5 + 0.5) * 255.0,
        ((nz / norm) * 0.5 + 0.5) * 255.0,
    ], axis=-1).clip(0, 255).astype(np.uint8)

    Image.fromarray(rgb, mode="RGB").save(dst_path, quality=88, optimize=True)
    size_kb = os.path.getsize(dst_path) // 1024
    print(f"  [bake] {os.path.basename(dst_path)} ({size_kb} KB)")

def bake_micro_grit_normal(dst_path, size=512):
    rng = np.random.default_rng(42)
    # Multi-octave seamless tileable rocky grit via FFT frequency shaping
    noise = rng.standard_normal((size, size))
    fft = np.fft.fft2(noise)
    freqs = np.fft.fftfreq(size)
    fx, fy = np.meshgrid(freqs, freqs)
    f_mag = np.sqrt(fx * fx + fy * fy) + 1e-4
    shaped = np.real(np.fft.ifft2(fft / (f_mag ** 1.15)))
    shaped = (shaped - shaped.min()) / (shaped.max() - shaped.min() + 1e-8)

    # Save temp height and run Sobel normal bake
    tmp = os.path.join(OUT_DIR, "_tmp_grit.png")
    Image.fromarray((shaped * 255).astype(np.uint8), mode="L").save(tmp)
    bake_normal_map(tmp, dst_path, strength=3.0)
    os.remove(tmp)

if __name__ == "__main__":
    print("1. Downloading 2K planetary maps to static/textures/ ...")
    for local_name, remote_name in TEXTURES.items():
        download_file(local_name, remote_name)

    print("\n2. Baking tangent-space normal maps ...")
    for body, strength in NORMAL_SPECS.items():
        src = os.path.join(OUT_DIR, f"{body}_albedo.jpg")
        dst = os.path.join(OUT_DIR, f"{body}_normal.jpg")
        bake_normal_map(src, dst, strength=strength)

    print("\n3. Baking seamless close-up rocky micro-grit normal map ...")
    bake_micro_grit_normal(os.path.join(OUT_DIR, "rock_micro_normal.jpg"))

    total_mb = sum(
        os.path.getsize(os.path.join(OUT_DIR, f))
        for f in os.listdir(OUT_DIR)
        if f.endswith(".jpg")
    ) / (1024 * 1024)
    print(f"\nDone! Total texture footprint: {total_mb:.2f} MB in {OUT_DIR}/")
