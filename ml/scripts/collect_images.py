"""
collect_images.py — Download satellite images for ML training.

Reads addresses from a JSON file and downloads 640x640 satellite images
via Google Maps Static API. Calculates image bounds using the same math
as visionApi.ts.

Usage:
    python collect_images.py --api-key YOUR_KEY [--input addresses.json] [--output ../data/raw]
    python collect_images.py --api-key YOUR_KEY --address "123 Main St, City, ST 12345"
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


def geocode_address(address: str, api_key: str) -> dict:
    """Geocode an address using Google Maps Geocoding API."""
    from urllib.parse import quote_plus
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={quote_plus(address)}&key={api_key}"
    req = Request(url)
    with urlopen(req) as resp:
        data = json.loads(resp.read())
    if data["status"] != "OK" or not data["results"]:
        raise ValueError(f"Geocoding failed for '{address}': {data['status']}")
    loc = data["results"][0]["geometry"]["location"]
    return {"lat": loc["lat"], "lng": loc["lng"]}


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


def collect_single(address: str, lat: float, lng: float, api_key: str, output_dir: Path, zoom: int = 20, size: int = 640):
    """Download and save a single image + metadata."""
    slug = slugify(address)
    img_path = output_dir / f"{slug}.png"
    meta_path = output_dir / f"{slug}.json"

    if img_path.exists():
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
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  SAVED: {img_path.name} ({len(img_data)} bytes)")


def main():
    parser = argparse.ArgumentParser(description="Collect satellite images for ML training")
    parser.add_argument("--api-key", required=True, help="Google Maps API key")
    parser.add_argument("--input", default=None, help="JSON file with addresses (or use --address)")
    parser.add_argument("--address", default=None, help="Single address to download")
    parser.add_argument("--output", default=None, help="Output directory (default: ml/data/raw)")
    parser.add_argument("--zoom", type=int, default=20, help="Map zoom level (default: 20)")
    parser.add_argument("--size", type=int, default=640, help="Image size in pixels (default: 640)")
    parser.add_argument("--comparison-file", default=None,
                        help="Path to solar-api-comparison.json for initial dataset")
    args = parser.parse_args()

    # Resolve output directory
    script_dir = Path(__file__).resolve().parent
    ml_dir = script_dir.parent
    output_dir = Path(args.output) if args.output else ml_dir / "data" / "raw"
    output_dir.mkdir(parents=True, exist_ok=True)

    addresses = []

    if args.address:
        # Single address mode
        print(f"Geocoding: {args.address}")
        coords = geocode_address(args.address, args.api_key)
        addresses.append({"address": args.address, "lat": coords["lat"], "lng": coords["lng"]})

    elif args.input:
        # Load from JSON file: expects array of {address, lat?, lng?} objects
        with open(args.input) as f:
            data = json.load(f)
        for item in data:
            addr = item.get("address", "")
            lat = item.get("lat")
            lng = item.get("lng")
            if not addr:
                continue
            if lat is None or lng is None:
                print(f"Geocoding: {addr}")
                try:
                    coords = geocode_address(addr, args.api_key)
                    lat, lng = coords["lat"], coords["lng"]
                except Exception as e:
                    print(f"  ERROR geocoding: {e}")
                    continue
                time.sleep(0.2)  # rate limit
            addresses.append({"address": addr, "lat": lat, "lng": lng})

    elif args.comparison_file:
        # Load from solar-api-comparison.json (initial 18 properties)
        with open(args.comparison_file) as f:
            data = json.load(f)
        for item in data:
            addr = item.get("address", "")
            if not addr:
                continue
            print(f"Geocoding: {addr}")
            try:
                coords = geocode_address(addr, args.api_key)
                addresses.append({"address": addr, "lat": coords["lat"], "lng": coords["lng"]})
            except Exception as e:
                print(f"  ERROR geocoding: {e}")
                continue
            time.sleep(0.2)

    else:
        parser.error("Provide --address, --input, or --comparison-file")

    print(f"\nCollecting {len(addresses)} images to {output_dir}\n")

    for i, item in enumerate(addresses, 1):
        print(f"[{i}/{len(addresses)}] {item['address']}")
        try:
            collect_single(
                item["address"], item["lat"], item["lng"],
                args.api_key, output_dir, args.zoom, args.size,
            )
        except HTTPError as e:
            print(f"  ERROR downloading: {e}")
        except Exception as e:
            print(f"  ERROR: {e}")
        time.sleep(0.3)  # rate limit

    print(f"\nDone. Images saved to {output_dir}")


if __name__ == "__main__":
    main()
