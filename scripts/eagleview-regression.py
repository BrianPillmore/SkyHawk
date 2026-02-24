"""
EagleView Regression Test
=========================
Calls Google Solar API buildingInsights for all 18 EagleView calibration
properties and compares raw Solar API data vs EagleView ground truth.

Run: python scripts/eagleview-regression.py

Metrics compared:
  - Total roof area (sqft)
  - Number of roof segments/facets
  - Predominant pitch
  - Pitch distribution
"""

import json
import math
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ---- Config ----
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
FIXTURE_PATH = PROJECT_ROOT / "tests" / "fixtures" / "eagleview-calibration.json"
ENV_PATH = PROJECT_ROOT / ".env"

SQM_TO_SQFT = 10.7639


def load_api_key():
    """Read API key from .env file."""
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line.startswith("VITE_GOOGLE_MAPS_API_KEY="):
                return line.split("=", 1)[1]
    raise RuntimeError("VITE_GOOGLE_MAPS_API_KEY not found in .env")


def degrees_to_pitch(deg):
    """Convert degrees to pitch (X/12). Same as codebase degreesToPitch()."""
    return math.tan(math.radians(deg)) * 12


def pitch_str_to_number(s):
    """Convert '8/12' to 8."""
    return int(s.split("/")[0])


def fetch_building_insights(lat, lng, api_key):
    """Call Google Solar API buildingInsights:findClosest."""
    for quality in ["HIGH", "MEDIUM"]:
        url = (
            f"https://solar.googleapis.com/v1/buildingInsights:findClosest?"
            f"location.latitude={lat}&location.longitude={lng}"
            f"&requiredQuality={quality}&key={api_key}"
        )
        try:
            req = urllib.request.Request(url)
            req.add_header("Referer", "https://gotruf.com/")
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            if e.code == 403:
                body = e.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"403 Forbidden: {body[:200]}")
            raise
    return None


def analyze_segments(segments):
    """Analyze Solar API roof segments."""
    if not segments:
        return {
            "total_area_sqft": 0,
            "segment_count": 0,
            "pitches": [],
            "predominant_pitch": 0,
            "pitch_breakdown": {},
        }

    total_area_m2 = 0
    pitch_areas = {}  # pitch_value -> area_sqft

    for seg in segments:
        area_m2 = seg.get("stats", {}).get("areaMeters2", 0)
        pitch_deg = seg.get("pitchDegrees", 0)
        area_sqft = area_m2 * SQM_TO_SQFT
        total_area_m2 += area_m2

        # Round pitch to nearest integer (X/12)
        pitch_val = round(degrees_to_pitch(pitch_deg))
        pitch_val = min(pitch_val, 24)  # clamp

        if pitch_val not in pitch_areas:
            pitch_areas[pitch_val] = 0
        pitch_areas[pitch_val] += area_sqft

    total_area_sqft = total_area_m2 * SQM_TO_SQFT

    # Find predominant pitch (most area)
    predominant = max(pitch_areas, key=pitch_areas.get) if pitch_areas else 0

    return {
        "total_area_sqft": total_area_sqft,
        "segment_count": len(segments),
        "predominant_pitch": predominant,
        "pitch_breakdown": pitch_areas,
    }


def run_regression():
    api_key = load_api_key()

    with open(FIXTURE_PATH) as f:
        properties = json.load(f)

    print("=" * 100)
    print("EAGLEVIEW vs GOOGLE SOLAR API - REGRESSION TEST")
    print(f"Testing {len(properties)} properties")
    print("=" * 100)
    print()

    results = []
    area_diffs = []
    facet_diffs = []
    pitch_matches = 0

    for i, prop in enumerate(properties):
        addr = prop["address"]
        lat = prop["latitude"]
        lng = prop["longitude"]
        ev_area = prop["totalRoofAreaSqFt"]
        ev_facets = prop["totalRoofFacets"]
        ev_pitch_str = prop["predominantPitch"]
        ev_pitch = pitch_str_to_number(ev_pitch_str)
        ev_complexity = prop.get("structureComplexity", "Unknown")

        print(f"[{i+1}/{len(properties)}] {addr}")
        print(f"  EagleView: {ev_area} sqft | {ev_facets} facets | {ev_pitch_str} pitch | {ev_complexity}")

        try:
            data = fetch_building_insights(lat, lng, api_key)
            if not data:
                print(f"  SOLAR API: No data available!")
                print()
                results.append({"address": addr, "status": "NO_DATA"})
                continue

            segments = data.get("solarPotential", {}).get("roofSegmentStats", [])
            quality = data.get("imageryQuality", "UNKNOWN")
            analysis = analyze_segments(segments)

            solar_area = analysis["total_area_sqft"]
            solar_facets = analysis["segment_count"]
            solar_pitch = analysis["predominant_pitch"]

            area_diff_pct = ((solar_area - ev_area) / ev_area) * 100 if ev_area else 0
            facet_diff = solar_facets - ev_facets

            area_diffs.append(abs(area_diff_pct))
            facet_diffs.append(facet_diff)
            if solar_pitch == ev_pitch:
                pitch_matches += 1

            # Status indicator
            area_status = "PASS" if abs(area_diff_pct) <= 5 else ("WARN" if abs(area_diff_pct) <= 15 else "FAIL")

            print(f"  Solar API: {solar_area:,.0f} sqft | {solar_facets} segments | {solar_pitch}/12 pitch | Quality: {quality}")
            print(f"  Area diff: {area_diff_pct:+.1f}% [{area_status}] | Facet diff: {facet_diff:+d} | Pitch match: {'YES' if solar_pitch == ev_pitch else 'NO'}")

            # Pitch breakdown comparison
            ev_breakdown = prop.get("pitchBreakdown", [])
            solar_breakdown = analysis["pitch_breakdown"]
            if ev_breakdown and solar_breakdown:
                print(f"  Pitch breakdown:")
                all_pitches = sorted(set(
                    [pitch_str_to_number(p["pitch"]) for p in ev_breakdown] +
                    list(solar_breakdown.keys())
                ))
                for p in all_pitches:
                    ev_pct = 0
                    for bp in ev_breakdown:
                        if pitch_str_to_number(bp["pitch"]) == p:
                            ev_pct = bp["percentOfRoof"]
                    solar_pct = (solar_breakdown.get(p, 0) / solar_area * 100) if solar_area else 0
                    indicator = " <--" if abs(ev_pct - solar_pct) > 10 else ""
                    print(f"    {p:2d}/12: EV={ev_pct:5.1f}%  Solar={solar_pct:5.1f}%{indicator}")

            results.append({
                "address": addr,
                "status": area_status,
                "ev_area": ev_area,
                "solar_area": round(solar_area),
                "area_diff_pct": round(area_diff_pct, 1),
                "ev_facets": ev_facets,
                "solar_facets": solar_facets,
                "ev_pitch": ev_pitch,
                "solar_pitch": solar_pitch,
                "quality": quality,
                "complexity": ev_complexity,
            })

        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({"address": addr, "status": "ERROR", "error": str(e)})

        print()
        time.sleep(0.3)  # Rate limiting

    # ---- Summary ----
    print()
    print("=" * 100)
    print("SUMMARY")
    print("=" * 100)

    valid = [r for r in results if r["status"] in ("PASS", "WARN", "FAIL")]
    passes = [r for r in valid if r["status"] == "PASS"]
    warns = [r for r in valid if r["status"] == "WARN"]
    fails = [r for r in valid if r["status"] == "FAIL"]

    print(f"\nResults: {len(passes)} PASS | {len(warns)} WARN | {len(fails)} FAIL | {len(results) - len(valid)} ERROR/NO_DATA")

    if area_diffs:
        print(f"\nArea Accuracy (vs EagleView):")
        print(f"  Mean absolute diff: {sum(area_diffs)/len(area_diffs):.1f}%")
        print(f"  Median absolute diff: {sorted(area_diffs)[len(area_diffs)//2]:.1f}%")
        print(f"  Min diff: {min(area_diffs):.1f}%")
        print(f"  Max diff: {max(area_diffs):.1f}%")
        print(f"  Within 5%: {sum(1 for d in area_diffs if d <= 5)}/{len(area_diffs)}")
        print(f"  Within 10%: {sum(1 for d in area_diffs if d <= 10)}/{len(area_diffs)}")
        print(f"  Within 15%: {sum(1 for d in area_diffs if d <= 15)}/{len(area_diffs)}")

    if facet_diffs:
        print(f"\nFacet Count (Solar segments vs EagleView facets):")
        print(f"  Solar typically has FEWER segments than EagleView facets")
        print(f"  Mean diff: {sum(facet_diffs)/len(facet_diffs):+.1f}")

    print(f"\nPitch Match: {pitch_matches}/{len(valid)} ({pitch_matches/len(valid)*100:.0f}%)" if valid else "")

    # Detail table
    print(f"\n{'Address':<45} {'EV Area':>8} {'Solar':>8} {'Diff%':>7} {'EV F':>5} {'Sol F':>5} {'EV P':>5} {'Sol P':>5} {'Status':>6}")
    print("-" * 100)
    for r in results:
        if r["status"] in ("PASS", "WARN", "FAIL"):
            print(
                f"{r['address'][:44]:<45} "
                f"{r['ev_area']:>8,} "
                f"{r['solar_area']:>8,} "
                f"{r['area_diff_pct']:>+6.1f}% "
                f"{r['ev_facets']:>5} "
                f"{r['solar_facets']:>5} "
                f"{r['ev_pitch']:>4}/12 "
                f"{r['solar_pitch']:>4}/12 "
                f"{r['status']:>6}"
            )
        else:
            print(f"{r['address'][:44]:<45} {'--- ' + r['status'] + ' ---':>60}")

    # Save results JSON
    output_path = PROJECT_ROOT / "tests" / "fixtures" / "solar-api-comparison.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed results saved to: {output_path}")


if __name__ == "__main__":
    run_regression()
