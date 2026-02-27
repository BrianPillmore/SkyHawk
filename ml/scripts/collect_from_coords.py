"""
collect_from_coords.py -- Download satellite images for the 18 EagleView calibration addresses.

Uses hardcoded lat/lng coordinates (approximate geocoded values) to bypass
the HTTP-referrer-restricted Geocoding API. Downloads 640x640 satellite images
via Google Maps Static API and saves each image + metadata JSON to ml/data/raw/.

Image bounds are computed using the same math as visionApi.ts (lines 52-62).

Usage:
    python ml/scripts/collect_from_coords.py --api-key YOUR_KEY [--zoom 20] [--size 640]
"""

import argparse
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError


# 18 EagleView calibration addresses with approximate lat/lng
CALIBRATION_PROPERTIES = [
    {"address": "3517 Lindee Lane, Oklahoma City, OK 73179", "lat": 35.3889, "lng": -97.6497},
    {"address": "15805 Harts Mill Rd, Edmond, OK 73013", "lat": 35.7153, "lng": -97.4389},
    {"address": "804 W Windmill Ct, Mustang, OK 73064", "lat": 35.3942, "lng": -97.7336},
    {"address": "3512 Lindee Lane, Oklahoma City, OK 73179", "lat": 35.3886, "lng": -97.6497},
    {"address": "3113 Loren Dr, Moore, OK 73160", "lat": 35.3291, "lng": -97.4771},
    {"address": "4001 NE 142nd St, Edmond, OK 73013", "lat": 35.7195, "lng": -97.4252},
    {"address": "765 W Windmill Ct, Mustang, OK 73064", "lat": 35.3935, "lng": -97.7343},
    {"address": "1012 David Rd, Moore, OK 73160", "lat": 35.3401, "lng": -97.4723},
    {"address": "4221 NE 18th St, Oklahoma City, OK 73121", "lat": 35.4922, "lng": -97.4548},
    {"address": "18600 Antler Way, Edmond, OK 73012", "lat": 35.7406, "lng": -97.5223},
    {"address": "3208 Sawgrass Rd, Edmond, OK 73034", "lat": 35.6762, "lng": -97.4156},
    {"address": "417 SE 33rd St, Moore, OK 73160", "lat": 35.3111, "lng": -97.4706},
    {"address": "11728 Hackney Lane, Yukon, OK 73099", "lat": 35.5131, "lng": -97.7431},
    {"address": "702 S Williams Ave, El Reno, OK 73036", "lat": 35.5276, "lng": -97.9559},
    {"address": "11704 NW 120th St, Oklahoma City, OK 73099", "lat": 35.5914, "lng": -97.6558},
    {"address": "112 Pickard Dr, Mcloud, OK 74851", "lat": 35.4387, "lng": -97.0934},
    {"address": "2808 N Donald Ave, Oklahoma City, OK 73127", "lat": 35.4965, "lng": -97.6098},
    {"address": "699 Richland Rd, Ardmore, OK 73401", "lat": 34.1813, "lng": -97.0968},
]


def compute_bounds(lat: float, lng: float, zoom: int = 20, size: int = 640) -> dict:
    """
    Calculate image bounds at given zoom level.
    Matches the exact math in visionApi.ts lines 52-62.
    """
    meters_per_pixel = (156543.03392 * math.cos(lat * math.pi / 180)) / (2 ** zoom)
    half_size_meters = (size / 2) * meters_per_pixel
    deg_per_meter = 1 / 111320

    return {
        "north": lat + half_size_meters * deg_per_meter,
        "south": lat - half_size_meters * deg_per_meter,
        "east": lng + half_size_meters * deg_per_meter / math.cos(lat * math.pi / 180),
        "west": lng - half_size_meters * deg_per_meter / math.cos(lat * math.pi / 180),
    }


def slugify(text: str) -> str:
    """Convert address to filesystem-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text[:80]


def download_image(lat: float, lng: float, api_key: str, zoom: int = 20, size: int = 640) -> bytes:
    """Download satellite image from Google Maps Static API."""
    url = (
        f"https://maps.googleapis.com/maps/api/staticmap?"
        f"center={lat},{lng}&zoom={zoom}&size={size}x{size}"
        f"&maptype=satellite&key={api_key}"
    )
    req = Request(url)
    with urlopen(req) as resp:
        return resp.read()


def collect_single(
    address: str, lat: float, lng: float,
    api_key: str, output_dir: Path,
    zoom: int = 20, size: int = 640,
    force: bool = False,
):
    """Download and save a single image + metadata."""
    slug = slugify(address)
    img_path = output_dir / f"{slug}.png"
    meta_path = output_dir / f"{slug}.json"

    if img_path.exists() and not force:
        print(f"  SKIP (exists): {img_path.name}")
        return

    bounds = compute_bounds(lat, lng, zoom, size)
    img_data = download_image(lat, lng, api_key, zoom, size)

    # Save image
    with open(img_path, "wb") as f:
        f.write(img_data)

    # Save metadata
    metadata = {
        "address": address,
        "lat": lat,
        "lng": lng,
        "zoom": zoom,
        "size": size,
        "bounds": bounds,
        "slug": slug,
        "source": "eagleview-calibration",
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  SAVED: {img_path.name} ({len(img_data):,} bytes)")
    print(f"         bounds: N={bounds['north']:.6f} S={bounds['south']:.6f} "
          f"E={bounds['east']:.6f} W={bounds['west']:.6f}")


def main():
    parser = argparse.ArgumentParser(
        description="Download satellite images for the 18 EagleView calibration addresses"
    )
    parser.add_argument("--api-key", required=True, help="Google Maps API key")
    parser.add_argument("--output", default=None, help="Output directory (default: ml/data/raw)")
    parser.add_argument("--zoom", type=int, default=20, help="Map zoom level (default: 20)")
    parser.add_argument("--size", type=int, default=640, help="Image size in pixels (default: 640)")
    parser.add_argument("--force", action="store_true", help="Re-download even if files exist")
    args = parser.parse_args()

    # Resolve output directory
    script_dir = Path(__file__).resolve().parent
    ml_dir = script_dir.parent
    output_dir = Path(args.output) if args.output else ml_dir / "data" / "raw"
    output_dir.mkdir(parents=True, exist_ok=True)

    properties = CALIBRATION_PROPERTIES
    print(f"Collecting {len(properties)} satellite images to {output_dir}")
    print(f"Zoom: {args.zoom}, Size: {args.size}x{args.size}\n")

    success_count = 0
    error_count = 0

    for i, prop in enumerate(properties, 1):
        addr = prop["address"]
        lat = prop["lat"]
        lng = prop["lng"]
        print(f"[{i}/{len(properties)}] {addr}")
        print(f"         coords: ({lat}, {lng})")

        try:
            collect_single(
                addr, lat, lng,
                args.api_key, output_dir,
                args.zoom, args.size,
                args.force,
            )
            success_count += 1
        except HTTPError as e:
            print(f"  ERROR downloading: {e}")
            error_count += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            error_count += 1

        # Rate limit between requests
        if i < len(properties):
            time.sleep(0.3)

    print(f"\nDone. {success_count} succeeded, {error_count} failed.")
    print(f"Images saved to {output_dir}")


if __name__ == "__main__":
    main()
