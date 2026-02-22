# Aerial Imagery Platform — Design & Planning Document

**Author:** Brian Pillmore
**Date:** February 21, 2026
**Status:** Draft / Research Phase

---

## 1. Executive Summary

This document captures research and planning for building a custom aerial imagery and geospatial analytics platform. The system will leverage DJI drone-captured imagery, open-source photogrammetry processing, and a self-hosted API layer to deliver high-resolution orthomosaics, 3D models, and AI-derived property analytics — at a fraction of the cost of enterprise solutions like EagleView, Nearmap, or Vexcel.

Primary use cases include municipal infrastructure monitoring for the City of Yukon, real estate portfolio analysis for Amore Limited Partnership, and potential commercial applications.

---

## 2. Industry Landscape & Competitor Analysis

### 2.1 EagleView (Market Leader)

EagleView obtains its 1-inch Ground Sample Distance (GSD) imagery using proprietary camera systems mounted on fixed-wing aircraft. Manned planes capture ultra-high-resolution orthogonal (top-down) and oblique (angled) imagery by flying at specific altitudes. The company utilizes patented technology and sophisticated processing algorithms, such as automated aerial triangulation, to stitch images into highly accurate 3D models and large-scale datasets.

**Key Details:**

- **Proprietary Technology:** Own next-generation camera sensors and fixed-wing aircraft (not third-party satellites)
- **Capture Method:** Flies at 5,000–10,000 feet, minimizing atmospheric interference to achieve 1-inch GSD
- **Oblique Imagery:** Captures from multiple angles in a single pass, enabling 360-degree views with precise X, Y, Z measurements
- **Scale:** 25-year historical imagery library covering ~94% of the U.S. population
- **Moat:** The combination of 1-inch GSD, oblique multi-angle capture, 25 years of history, and 94% coverage is genuinely hard to replicate

### 2.2 Nearmap (Closest Direct Competitor to EagleView)

Nearmap flies manned aircraft to capture high-resolution aerial imagery at approximately 2–3 inch GSD. They offer oblique and orthogonal views with AI-derived property analytics, covering major U.S., Australian, and Canadian metros with frequent recapture.

**API Suite (developer.nearmap.com):**

- **Tile API** — Access vertical and panorama imagery using Google Maps Tile Coordinates (Slippy Tilenames). Compatible with Leaflet, OpenLayers, Google Maps JS API
- **AI Feature API** — Programmatic access to Nearmap AI content; provide a polygon AOI and receive vector map data (roof conditions, building footprints, etc.)
- **AI Rollup API** — Simplified "facts for an address" output in CSV/JSON/GeoJSON; designed for users without deep geospatial experience
- **DSM and True Ortho API** — Access to 3D content (Digital Surface Models), optimized for individual property lookups with sub-second response times
- **Coverage API** — Survey metadata for a given point or polygon
- **Transactional Content API** — Single platform for vertical, panorama, DSM, DTM, and AI Packs, measured in transactional credits
- **WMS 2.0** — Standard Web Mapping Service for GIS/CAD integration
- **Authentication:** API key-based

**Trial Access:**

- Free trial available (no credit card required)
- Can also request trial through ArcGIS Marketplace
- No free plan — custom pricing after trial
- Trial is sales-gated (request access, they provision it)

### 2.3 Vexcel Data Program

Formerly part of Microsoft's mapping division. Operates one of the world's largest aerial imagery programs using UltraCam sensors on a dedicated fleet of fixed-wing aircraft. Supplies imagery to insurers, governments, and tech companies with oblique capture similar to EagleView.

**API (api.vexcelgroup.com/v2/):**

- HTTPS REST services for viewing and downloading images and metadata
- API 2.0 launched with services covering: coverage queries, discrete/static imagery, tile services, metadata, and Elements AI property analytics
- Property queries return results within 60 seconds (marketed heavily for post-disaster insurance assessments)
- Code samples available on GitHub (github.com/vexcel-data/vdp_samples)
- Documentation on Confluence

**Trial Access:**

- **90-day evaluation** with access to select aerial imagery and data worldwide
- Demo request form available at vexceldata.com/request-a-demo
- Sample data available through their imaging division
- University Access Program provides free access for qualified academic researchers
- Enterprise sales model — no self-serve API key signup

### 2.4 Google Maps / Solar API

Uses a combination of satellite imagery and aerial photography. The Solar API provides roof-level analysis for solar potential but is optimized for that specific use case. Resolution and measurement precision don't match EagleView or Nearmap for insurance, roofing, or government applications.

### 2.5 Planet Labs & Maxar

Operate high-resolution satellite constellations (down to ~12-inch GSD). Strong for large-area monitoring, defense, and agriculture, but atmospheric interference, revisit limitations, and lack of oblique angles make them less competitive for property-level measurement work.

### 2.6 Hover

Uses smartphone photos and AI to generate 3D property models. Popular with contractors and insurers for individual property assessments but doesn't offer systematic, wide-area coverage.

---

## 3. Custom Drone-Based Solution — Architecture

### 3.1 Why Build vs. Buy

| Factor | Enterprise (Nearmap/Vexcel) | Custom Drone Solution |
|---|---|---|
| **Annual Cost** | $15,000–$50,000+ subscription | $4,000–$8,000 one-time hardware + processing costs |
| **Resolution** | 1–3 inch GSD | 0.5 inch GSD or better (surpasses EagleView) |
| **Freshness** | Quarterly or less frequent flyovers | On-demand capture anytime |
| **Coverage** | Major metros; Yukon may have limited coverage | You choose exactly what to capture |
| **Historical Data** | 10–25 years of archives | Starts from zero |
| **Scale** | Entire U.S. population areas | Labor-intensive for large areas |
| **Data Ownership** | Licensed, restricted use | Full ownership and control |

### 3.2 Hardware

**Recommended Drone: DJI Mavic 3 Enterprise**

- RTK positioning for survey-grade accuracy
- Mechanical shutter (eliminates rolling shutter distortion)
- 4/3 CMOS sensor, 20MP
- 56x zoom capability
- ~45 min flight time
- Estimated cost: $4,000–$8,000 depending on configuration

**Alternative: DJI Mavic 3 Multispectral** (if vegetation health / NDVI analysis is needed)

**Flight Planning Parameters:**

- Altitude: 200–400 feet AGL (achieves sub-1-inch GSD)
- Front overlap: 70–80%
- Side overlap: 60–70%
- Flight pattern: Grid (nadir) + crosshatch for 3D
- Oblique capture: Additional passes at 45-degree angle for multi-view coverage

**Flight Planning Software Options:**

- DJI Pilot 2 (native, free)
- DJI FlightHub 2 (fleet management)
- DroneDeploy (integrated planning + processing)
- Litchi (third-party, flexible waypoint missions)

### 3.3 Coverage Estimate — City of Yukon

- Yukon city area: ~27 square miles
- At 300 ft altitude with 75% overlap: approximately 8–12 flight sessions to cover the full city
- Priority areas for initial capture:
  - TIF project zone near Yukon High School ($65M development)
  - Major infrastructure corridors (water/sewer)
  - Amore LP property portfolio locations
  - Downtown core and growth corridors

### 3.4 Regulatory Requirements

**FAA Part 107 Remote Pilot Certificate:**

- Required for commercial drone operations
- Written exam at FAA testing center
- Must pass aeronautical knowledge test
- Renewable every 24 months via recurrent exam
- Exam is straightforward with 2–3 weeks of study

**Airspace Considerations — Yukon, Oklahoma:**

- Check proximity to Will Rogers World Airport (OKC) controlled airspace
- LAANC (Low Altitude Authorization and Notification Capability) authorization may be required for portions of Yukon
- Use FAA B4UFLY app or Aloft (formerly Kittyhawk) to check airspace restrictions
- Class B/C/D airspace requires prior authorization
- Temporary Flight Restrictions (TFRs) must be checked before each flight

**Other Compliance:**

- No flying over people without appropriate waiver or category compliance
- No night flights without anti-collision lighting
- Visual line of sight (VLOS) required unless waiver obtained
- State and local ordinances may apply

---

## 4. Data Processing Pipeline

### 4.1 Photogrammetry Software Options

| Software | Type | Cost | Strengths |
|---|---|---|---|
| **OpenDroneMap (ODM)** | Open source | Free | Budget-friendly, runs locally or via WebODM interface, produces orthomosaics, DSMs, DTMs, point clouds |
| **DroneDeploy** | Cloud SaaS | Subscription | Handles processing + hosting, has its own API, very polished UX |
| **Pix4D** | Desktop/Cloud | Per-license | Industry standard, professional-grade outputs |
| **Agisoft Metashape** | Desktop | ~$3,500 (Pro) | Powerful, one-time license, widely used in surveying and GIS |

**Recommended for MVP:** OpenDroneMap (free, capable) or DroneDeploy (fastest path to API)

### 4.2 Processing Outputs

From raw drone images, photogrammetry produces:

- **Orthomosaic** — Geometrically corrected aerial image stitched into a single seamless map (GeoTIFF)
- **Digital Surface Model (DSM)** — Elevation model including buildings, trees, structures
- **Digital Terrain Model (DTM)** — Bare-earth elevation model
- **3D Point Cloud** — Dense cloud of XYZ coordinates with color (LAS/LAZ format)
- **3D Textured Mesh** — Photorealistic 3D model of the terrain and structures
- **Contour Lines** — Derived from DSM/DTM for engineering use

### 4.3 Processing Requirements

- Large orthomosaics require significant compute: 32GB+ RAM, dedicated GPU recommended
- Options: process locally on a workstation, or use cloud compute (AWS EC2, etc.)
- WebODM can be deployed as a Docker container on any Linux server
- Typical processing time: 2–8 hours per flight dataset depending on image count and output resolution

---

## 5. API & Serving Architecture

### 5.1 Recommended Technology Stack

```
DJI Mavic 3E
    ↓ (raw images + GPS metadata)
OpenDroneMap / Agisoft Metashape
    ↓ (orthomosaics, DSMs, point clouds)
Cloud Optimized GeoTIFFs (COGs) on S3 / MinIO
    ↓
TiTiler API (tile server)
    ↓
Leaflet / MapLibre GL JS (frontend)
```

### 5.2 Tile Serving Options

| Tool | Type | Description |
|---|---|---|
| **TiTiler** | Open source | Serves Cloud Optimized GeoTIFF raster data as map tiles via REST API |
| **Terracotta** | Open source | Lightweight tile server for COGs |
| **GeoServer** | Open source | Full-featured, serves WMS/WFS/WMTS, integrates with PostGIS |
| **pg_tileserv** | Open source | Serves vector tiles directly from PostGIS |
| **Martin** | Open source (Rust) | High-performance vector tile server from PostGIS |

### 5.3 Data Storage Strategy

- **Cloud Optimized GeoTIFFs (COGs):** Store processed orthomosaics as COGs on S3-compatible storage. This format allows clients to request just the tiles they need without downloading entire files.
- **PostGIS:** Store vector data (property boundaries, AI-detected features, measurement data) in PostgreSQL with PostGIS extension.
- **LAS/LAZ on object storage:** Point clouds stored as compressed LAZ files for on-demand retrieval.

### 5.4 API Design Concepts

```
GET /api/v1/tiles/{z}/{x}/{y}.png          — Map tile at zoom/x/y
GET /api/v1/orthomosaic/{capture_id}/info   — Metadata for a capture
GET /api/v1/coverage?lat={lat}&lng={lng}    — Available captures for a location
GET /api/v1/dsm/{capture_id}/elevation      — Elevation query at a point
GET /api/v1/ai/features?bbox={bbox}         — AI-detected features in bounding box
GET /api/v1/compare?id1={id}&id2={id}       — Change detection between captures
POST /api/v1/measure                        — Area/distance measurement on imagery
```

### 5.5 Frontend Options

- **Leaflet** — Lightweight, widely used, excellent plugin ecosystem
- **MapLibre GL JS** — Open-source fork of Mapbox GL JS, supports vector tiles and 3D terrain
- **OpenLayers** — Full-featured, good for GIS-heavy applications
- **Cesium** — For 3D globe visualization and point cloud rendering
- **Deck.gl** — High-performance WebGL layers for large datasets

---

## 6. AI / Analytics Layer (Future Phase)

### 6.1 Potential Analytics

- **Roof condition assessment** — Detect damage, aging, material type
- **Vegetation encroachment** — Trees near power lines, overgrowth on properties
- **Impervious surface detection** — Stormwater management and zoning compliance
- **Construction progress monitoring** — Track TIF development over time
- **Change detection** — Compare captures over time to identify new construction, demolition, land use changes
- **Property measurement** — Automated roof area, building footprint, lot coverage calculations
- **Infrastructure assessment** — Road condition, parking lot deterioration, sidewalk damage

### 6.2 AI/ML Tools

- **Roboflow** — End-to-end platform for training and deploying object detection models on aerial imagery
- **Ultralytics YOLOv8** — State-of-the-art real-time object detection, easily trained on custom datasets
- **Meta SAM (Segment Anything Model)** — Zero-shot segmentation for extracting features from orthomosaics
- **Custom models** — Train on labeled Yukon-specific imagery for highest accuracy

### 6.3 Training Data Strategy

- Manually label initial captures (building footprints, roof types, vegetation, impervious surfaces)
- Use pre-trained models as starting point, fine-tune on local data
- Leverage open datasets (e.g., Microsoft Building Footprints, OpenStreetMap) for bootstrapping

---

## 7. Implementation Roadmap

### Phase 1 — Proof of Concept (Month 1–2)

- [ ] Obtain FAA Part 107 certification (if not already held)
- [ ] Purchase DJI Mavic 3 Enterprise
- [ ] Check Yukon airspace restrictions and obtain LAANC authorization as needed
- [ ] Fly test area — TIF project site near Yukon High School
- [ ] Process imagery using OpenDroneMap (WebODM Docker deployment)
- [ ] Evaluate output quality: orthomosaic resolution, positional accuracy, DSM quality
- [ ] Compare results against Google Earth / available satellite imagery

### Phase 2 — API & Platform MVP (Month 2–4)

- [ ] Set up S3-compatible storage for COGs
- [ ] Deploy TiTiler tile server
- [ ] Build basic REST API for tile serving and metadata
- [ ] Create simple Leaflet/MapLibre frontend for viewing captures
- [ ] Implement capture management (upload, process, catalog)
- [ ] Add basic measurement tools (area, distance, elevation)

### Phase 3 — Expanded Coverage & Analytics (Month 4–8)

- [ ] Systematic capture of priority areas (TIF zone, infrastructure corridors, downtown)
- [ ] Implement change detection between captures
- [ ] Begin AI model training for property analytics
- [ ] Add oblique imagery capture workflow
- [ ] Integrate with existing municipal GIS systems
- [ ] Build reporting dashboards for municipal use cases

### Phase 4 — Scale & Commercialization (Month 8–12)

- [ ] Evaluate commercial viability for other Oklahoma municipalities
- [ ] Consider integration with DoorNoc geocoded voter records for political/demographic overlay
- [ ] Explore Visbanking integration opportunities
- [ ] Build multi-tenant architecture if serving multiple clients
- [ ] Establish regular capture cadence (quarterly for high-priority areas)
- [ ] Document and publish API for third-party integrations

---

## 8. Cost Estimates

### Hardware (One-Time)

| Item | Estimated Cost |
|---|---|
| DJI Mavic 3 Enterprise (RTK) | $5,000–$8,000 |
| Extra batteries (3x) | $500–$750 |
| iPad / controller accessories | $300–$500 |
| MicroSD cards (high-speed, 2x) | $100 |
| Case / transport | $150–$300 |
| **Total Hardware** | **~$6,000–$10,000** |

### Software & Processing

| Item | Estimated Cost |
|---|---|
| OpenDroneMap / WebODM | Free (open source) |
| Agisoft Metashape Pro (if needed) | ~$3,500 one-time |
| Processing workstation (if local) | $2,000–$4,000 |
| OR cloud compute (AWS/similar) | $50–$200/month |

### Hosting & Infrastructure (Monthly)

| Item | Estimated Cost |
|---|---|
| S3 storage (imagery) | $25–$100/month (scales with data) |
| Tile server (VPS/EC2) | $20–$80/month |
| PostGIS database | $15–$50/month |
| Domain / SSL | $15/month |
| **Total Monthly** | **~$75–$250/month** |

### Regulatory

| Item | Estimated Cost |
|---|---|
| FAA Part 107 exam | ~$175 |
| Study materials | $50–$100 |

### Annual Operating Cost Estimate

**Year 1:** ~$10,000–$18,000 (including hardware purchase)
**Year 2+:** ~$2,000–$5,000/year (hosting + occasional hardware replacement)

**vs. Enterprise Alternatives:** $15,000–$50,000+/year for Nearmap or Vexcel subscriptions

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Airspace restrictions over portions of Yukon | May limit where/when you can fly | Pre-check with LAANC; build relationships with OKC TRACON |
| Weather dependency | Delays capture schedule | Build buffer into timelines; fly in optimal conditions |
| No historical imagery library | Can't do retrospective analysis | Start capturing now; leverage Google Earth historical imagery for baseline |
| Processing compute demands | Slow turnaround on large datasets | Use cloud compute for burst processing; optimize ODM settings |
| FAA regulation changes | May restrict operations | Stay current with Part 107 updates; join industry associations |
| Hardware failure / crash | Loss of drone and data | Insurance; backup SD cards; spare drone if budget allows |
| Scale limitations | Can't match EagleView's national coverage | Focus on Yukon and immediate portfolio; don't try to compete nationally |

---

## 10. Key Decisions to Make

1. **Part 107:** Who will be the certified remote pilot? (Brian, staff member, or contractor?)
2. **Processing:** OpenDroneMap (free, more setup) vs. DroneDeploy (paid, turnkey with API)?
3. **Hosting:** Self-hosted vs. cloud? (Cloud recommended for MVP)
4. **Scope:** Start with TIF project monitoring only, or broader municipal coverage from day one?
5. **Integration:** Should this tie into existing Yukon GIS infrastructure?
6. **Commercial:** Is this a Yukon-only tool, or a product to offer other municipalities?

---

## 11. Reference Links

- **Nearmap Developer Portal:** https://developer.nearmap.com
- **Vexcel API 2.0:** https://api.vexcelgroup.com/v2/
- **Vexcel GitHub Samples:** https://github.com/vexcel-data/vdp_samples
- **OpenDroneMap:** https://www.opendronemap.org
- **WebODM:** https://www.opendronemap.org/webodm/
- **TiTiler:** https://developmentseed.org/titiler/
- **DroneDeploy:** https://www.dronedeploy.com
- **Pix4D:** https://www.pix4d.com
- **Agisoft Metashape:** https://www.agisoft.com
- **FAA Part 107:** https://www.faa.gov/uas/commercial_operators
- **LAANC:** https://www.faa.gov/uas/programs_partnerships/data_exchange
- **FAA B4UFLY App:** https://www.faa.gov/uas/getting_started/b4ufly
- **Cloud Optimized GeoTIFF Spec:** https://www.cogeo.org
- **Leaflet:** https://leafletjs.com
- **MapLibre GL JS:** https://maplibre.org
- **Roboflow:** https://roboflow.com
- **Ultralytics YOLOv8:** https://docs.ultralytics.com
- **Meta SAM:** https://segment-anything.com
- **Microsoft Building Footprints:** https://github.com/microsoft/USBuildingFootprints
