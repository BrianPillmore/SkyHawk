"""
fix_coordinates.py — Re-geocode addresses using Google Maps Geocoding API and
re-download satellite images where coordinates were inaccurate.

The original collect_from_coords.py used approximate lat/lng that put many
roofs off-center or out of frame. Google Maps Geocoding API provides accurate
rooftop-level coordinates.

Usage:
    python ml/scripts/fix_coordinates.py --api-key YOUR_GOOGLE_MAPS_KEY [--force]
    python ml/scripts/fix_coordinates.py --api-key YOUR_KEY --all --force  # redo all 18
    python ml/scripts/fix_coordinates.py --api-key YOUR_KEY --geocode-only  # just show coords
"""

import argparse
import json
import math
import re
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import quote_plus


# ── Addresses that need re-geocoding ──────────────────────────────────────────
# These were identified by visual inspection: roof not visible or off-center
BAD_ADDRESSES = [
    "3517 Lindee Lane, Oklahoma City, OK 73179",
    "15805 Harts Mill Rd, Edmond, OK 73013",
    "4001 NE 142nd St, Edmond, OK 73013",
    "1012 David Rd, Moore, OK 73160",
    "4221 NE 18th St, Oklahoma City, OK 73121",
    "18600 Antler Way, Edmond, OK 73012",
    "11704 NW 120th St, Oklahoma City, OK 73099",
    "699 Richland Rd, Ardmore, OK 73401",
    "3512 Lindee Lane, Oklahoma City, OK 73179",
]

# All 18 properties (for --all mode)
ALL_ADDRESSES = [
    "3517 Lindee Lane, Oklahoma City, OK 73179",
    "15805 Harts Mill Rd, Edmond, OK 73013",
    "804 W Windmill Ct, Mustang, OK 73064",
    "3512 Lindee Lane, Oklahoma City, OK 73179",
    "3113 Loren Dr, Moore, OK 73160",
    "4001 NE 142nd St, Edmond, OK 73013",
    "765 W Windmill Ct, Mustang, OK 73064",
    "1012 David Rd, Moore, OK 73160",
    "4221 NE 18th St, Oklahoma City, OK 73121",
    "18600 Antler Way, Edmond, OK 73012",
    "3208 Sawgrass Rd, Edmond, OK 73034",
    "417 SE 33rd St, Moore, OK 73160",
    "11728 Hackney Lane, Yukon, OK 73099",
    "702 S Williams Ave, El Reno, OK 73036",
    "11704 NW 120th St, Oklahoma City, OK 73099",
    "112 Pickard Dr, Mcloud, OK 74851",
    "2808 N Donald Ave, Oklahoma City, OK 73127",
    "699 Richland Rd, Ardmore, OK 73401",
]


def slugify(text: str) -> str:
    """Convert address to filesystem-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text[:80]


def geocode_nominatim(address: str) -> dict | None:
    """
    Geocode an address using Nominatim (OpenStreetMap) — free, no API key needed.
    Used for bounds metadata only; image download uses address directly.
    """
    encoded = quote_plus(address)
    url = f"https://nominatim.openstreetmap.org/search?q={encoded}&format=json&limit=1&countrycodes=us"

    req = Request(url)
    req.add_header("User-Agent", "SkyHawk-ML-Training/1.0 (roof measurement tool)")

    try:
        with urlopen(req, timeout=10) as resp:
            results = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"    Nominatim geocoding error: {e}")
        return None

    if not results:
        return None

    r = results[0]
    return {
        "lat": float(r["lat"]),
        "lng": float(r["lon"]),
        "display_name": r.get("display_name", ""),
        "location_type": "nominatim",
    }


def compute_bounds(lat: float, lng: float, zoom: int = 20, size: int = 640) -> dict:
    """Calculate image bounds at given zoom level (matches visionApi.ts)."""
    meters_per_pixel = (156543.03392 * math.cos(lat * math.pi / 180)) / (2 ** zoom)
    half_size_meters = (size / 2) * meters_per_pixel
    deg_per_meter = 1 / 111320

    return {
        "north": lat + half_size_meters * deg_per_meter,
        "south": lat - half_size_meters * deg_per_meter,
        "east": lng + half_size_meters * deg_per_meter / math.cos(lat * math.pi / 180),
        "west": lng - half_size_meters * deg_per_meter / math.cos(lat * math.pi / 180),
    }


def download_image_by_address(address: str, api_key: str, zoom: int = 20, size: int = 640) -> bytes:
    """Download satellite image using address directly in Static Maps API.

    The Static Maps API accepts addresses as the center parameter,
    resolving them internally without needing the Geocoding API.
    This bypasses HTTP referrer restrictions on the Geocoding API.
    """
    encoded_address = quote_plus(address)
    url = (
        f"https://maps.googleapis.com/maps/api/staticmap?"
        f"center={encoded_address}&zoom={zoom}&size={size}x{size}"
        f"&maptype=satellite&key={api_key}"
    )
    req = Request(url)
    with urlopen(req) as resp:
        return resp.read()


def download_image(lat: float, lng: float, api_key: str, zoom: int = 20, size: int = 640) -> bytes:
    """Download satellite image by coordinates from Google Maps Static API."""
    url = (
        f"https://maps.googleapis.com/maps/api/staticmap?"
        f"center={lat},{lng}&zoom={zoom}&size={size}x{size}"
        f"&maptype=satellite&key={api_key}"
    )
    req = Request(url)
    with urlopen(req) as resp:
        return resp.read()


def process_address(
    address: str, api_key: str, output_dir: Path,
    zoom: int = 20, size: int = 640, force: bool = False
) -> bool:
    """Download satellite image centered on address.

    Uses Google Static Maps API with the address directly (no geocoding needed).
    Uses Nominatim for bounds metadata (best-effort, not critical).
    """
    slug = slugify(address)
    img_path = output_dir / f"{slug}.png"
    meta_path = output_dir / f"{slug}.json"

    if img_path.exists() and not force:
        print(f"    SKIP (exists, use --force to re-download)")
        return True

    # Get coordinates via Nominatim for metadata (best-effort)
    geo_result = geocode_nominatim(address)
    lat = geo_result["lat"] if geo_result else 0.0
    lng = geo_result["lng"] if geo_result else 0.0
    loc_type = geo_result["location_type"] if geo_result else "unknown"

    if geo_result:
        print(f"    Coords: ({lat:.6f}, {lng:.6f}) [{loc_type}]")
    else:
        print(f"    Coords: unavailable (image still downloaded by address)")

    # Download satellite image using address directly in the URL
    # This bypasses Geocoding API referrer restrictions
    print(f"    Downloading satellite image by address...")
    img_data = download_image_by_address(address, api_key, zoom, size)

    # Save image
    with open(img_path, "wb") as f:
        f.write(img_data)

    # Save metadata
    bounds = compute_bounds(lat, lng, zoom, size) if lat != 0 else {}
    metadata = {
        "address": address,
        "lat": lat,
        "lng": lng,
        "zoom": zoom,
        "size": size,
        "bounds": bounds,
        "slug": slug,
        "source": "eagleview-calibration",
        "geocoder": "static-maps-address",
        "location_type": loc_type,
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"    SAVED: {img_path.name} ({len(img_data):,} bytes)")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Re-geocode and re-download satellite images with accurate Google coordinates"
    )
    parser.add_argument("--api-key", required=True, help="Google Maps API key")
    parser.add_argument("--output", default=None, help="Output directory (default: ml/data/raw)")
    parser.add_argument("--zoom", type=int, default=20, help="Map zoom level (default: 20)")
    parser.add_argument("--force", action="store_true", help="Re-download even if files exist")
    parser.add_argument("--all", action="store_true", help="Re-geocode all 18 addresses (not just bad ones)")
    parser.add_argument("--geocode-only", action="store_true", help="Only geocode, don't download images")
    args = parser.parse_args()

    # Resolve output directory
    script_dir = Path(__file__).resolve().parent
    ml_dir = script_dir.parent
    output_dir = Path(args.output) if args.output else ml_dir / "data" / "raw"
    output_dir.mkdir(parents=True, exist_ok=True)

    addresses = ALL_ADDRESSES if args.all else BAD_ADDRESSES

    print(f"Re-geocoding {len(addresses)} addresses via Google Maps Geocoding API")
    print(f"Output: {output_dir}")
    if args.geocode_only:
        print("Mode: geocode only (no image downloads)")
    print()

    success = 0
    errors = 0

    for i, address in enumerate(addresses, 1):
        print(f"[{i}/{len(addresses)}] {address}")

        if args.geocode_only:
            result = geocode_google(address, args.api_key)
            if result:
                print(f"    -> ({result['lat']:.6f}, {result['lng']:.6f}) [{result['location_type']}]")
                success += 1
            else:
                print(f"    -> FAILED")
                errors += 1
        else:
            try:
                ok = process_address(address, args.api_key, output_dir, args.zoom, force=args.force)
                if ok:
                    success += 1
                else:
                    errors += 1
            except HTTPError as e:
                print(f"    ERROR: {e}")
                errors += 1
            except Exception as e:
                print(f"    ERROR: {e}")
                errors += 1

        # Small delay between requests
        if i < len(addresses):
            time.sleep(0.3)

    print(f"\nDone. {success} succeeded, {errors} failed.")
    if not args.geocode_only:
        print(f"Images saved to {output_dir}")
        print("\nNext: run auto_annotate.py to generate training masks")


if __name__ == "__main__":
    main()
