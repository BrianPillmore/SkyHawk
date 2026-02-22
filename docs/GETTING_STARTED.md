# Getting Started with SkyHawk

## Prerequisites
- Node.js 18+ and npm
- A Google Maps API key (required for satellite imagery and geocoding)
- A Google Solar API key (optional, for solar panel analysis)
- An Anthropic Claude API key (optional, for AI-powered damage detection)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd SkyHawk

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your Google Maps API key
```

## API Keys Setup

### Google Maps API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - **Maps JavaScript API** - For satellite map display
   - **Places API** - For address autocomplete
   - **Geocoding API** - For address-to-coordinate conversion
4. Create an API key under Credentials
5. (Recommended) Restrict the key to your domain and the above APIs
6. Add to `.env`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_key_here
   ```

### Google Solar API (Optional)

1. In the same Google Cloud project, enable:
   - **Solar API** - For solar panel potential analysis
2. Use the same API key or create a separate one
3. Add to `.env`:
   ```
   VITE_GOOGLE_SOLAR_API_KEY=your_key_here
   ```

### Anthropic Claude API (Optional)

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add to `.env`:
   ```
   VITE_ANTHROPIC_API_KEY=your_key_here
   ```
   This enables AI-powered roof damage detection via Claude Vision API.

## Running the Application

```bash
# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage Guide

### 1. Search for a Property
- Type an address in the search bar
- Select from autocomplete suggestions
- Or use manual coordinate entry (pin icon)

### 2. Draw Roof Outline
- Select the **Roof Outline** tool (or press `O`)
- Click on the map to place vertices along the roof edge
- Click the first point to close the polygon (or press `Enter`)
- A facet is created automatically with default 6/12 pitch

### 3. Adjust Pitch
- Switch to the **Data** tab in the sidebar
- Find the facet and use the pitch slider
- True area updates automatically

### 4. Draw Edge Lines
- Select **Ridge** (R), **Hip** (H), **Valley** (Y), etc.
- Click a vertex to start the line
- Click another vertex to complete it
- Edge length is calculated automatically

### 5. View Measurements
- The **Data** tab shows all measurements
- Summary cards show totals
- Waste factor table shows material estimates
- Edge details list all drawn lines

### 6. Generate Report
- Switch to the **Report** tab
- Enter company name and optional notes
- Click **Generate PDF Report**
- PDF downloads automatically

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Pan/Navigate mode |
| V | Select mode |
| O | Outline tool |
| R | Ridge tool |
| H | Hip tool |
| Y | Valley tool |
| K | Rake tool |
| E | Eave tool |
| F | Flashing tool |
| Enter | Finish outline |
| Escape | Cancel/Deselect |
| Delete | Delete selected item |

## Available Features

### Core Measurement Features (Implemented)
- **Address Search**: Google Places autocomplete for property lookup
- **Roof Outline Tool**: Draw polygon outlines directly on satellite imagery
- **Multi-Facet Support**: Create and measure multiple roof facets with independent pitch values
- **Multi-Structure Support**: Manage multiple properties and multiple measurements per property
- **Edge Measurements**: Draw and measure ridge, hip, valley, rake, eave, flashing, and step-flashing lines
- **Pitch Adjustment**: Set pitch (0-24/12) per facet with automatic true area calculation
- **Waste Factor**: Automatic waste calculation (5-25%) based on roof complexity
- **Material Estimation**: Calculate roofing squares with waste factored in
- **Drip Edge Calculation**: Automatic calculation of rake + eave totals
- **3D Visualization**: Three.js/React Three Fiber rendering of roof structures
- **PDF Reports**: Comprehensive measurement reports with:
  - Property information and coordinates
  - Measurement summary (area, squares, pitch, facets)
  - Edge measurements by type
  - Facet details with pitch and area
  - Waste factor table (5-25%)
  - Map screenshots via html2canvas
  - Claims/damage information (if available)
  - Custom notes and branding
- **Data Export**: JSON format for measurement data
- **Keyboard Shortcuts**: Fast tool switching (Space, V, O, R, H, Y, K, E, F)

### Advanced Features (Implemented)
- **Solar Analysis**: Google Solar API integration for solar panel potential (data fetch implemented, PDF integration pending)
- **AI Damage Detection**: Anthropic Claude Vision API for automated roof damage assessment
- **Claims Workflow**: Damage annotation, photo upload, claims tracking

### Enterprise Features (Planned)
- **User Authentication**: JWT-based login/registration
- **Role-Based Access Control (RBAC)**: Team collaboration with permissions
- **Backend Persistence**: Property and measurement storage in database
- **Multi-user Collaboration**: Shared properties and measurements

## Without API Keys
The application requires the Google Maps API key for core functionality. Without it:
- A placeholder map is shown instead of satellite imagery
- Address autocomplete and geocoding will not work
- You can still explore the UI and understand the workflow

Solar and AI features are optional enhancements that work independently.
