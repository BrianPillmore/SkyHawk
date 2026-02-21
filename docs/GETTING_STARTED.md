# Getting Started with SkyHawk

## Prerequisites
- Node.js 18+ and npm
- A Google Maps API key (optional but recommended)

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

## Google Maps API Setup

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

## Without Google Maps API Key
The application works without an API key but shows a placeholder
instead of satellite imagery. You can still:
- Create properties with manual coordinates
- Use all measurement tools (once map integration is connected)
- Generate reports
