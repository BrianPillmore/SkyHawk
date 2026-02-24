/**
 * HTML Report Template for SkyHawk Interactive Reports.
 * Generates a self-contained HTML file with embedded CSS, JavaScript,
 * and Google Maps integration for interactive roof measurement viewing.
 */

import type { HtmlReportData } from './htmlReportExporter';

/** Pitch color scale matching diagramRenderer.ts */
const PITCH_COLORS: [number, number, string][] = [
  [0, 3, '#22c55e'],
  [3, 6, '#84cc16'],
  [6, 9, '#eab308'],
  [9, 12, '#f97316'],
  [12, 100, '#ef4444'],
];

function getPitchColorForTemplate(pitch: number): string {
  for (const [min, max, color] of PITCH_COLORS) {
    if (pitch >= min && pitch < max) return color;
  }
  return '#ef4444';
}

/** Edge type colors matching colors.ts */
const EDGE_COLOR_MAP: Record<string, string> = {
  ridge: '#ef4444',
  hip: '#8b5cf6',
  valley: '#3b82f6',
  rake: '#10b981',
  eave: '#06b6d4',
  flashing: '#f97316',
  'step-flashing': '#ec4899',
};

const EDGE_LABEL_MAP: Record<string, string> = {
  ridge: 'Ridge',
  hip: 'Hip',
  valley: 'Valley',
  rake: 'Rake',
  eave: 'Eave',
  flashing: 'Flashing',
  'step-flashing': 'Step Flashing',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatArea(sqFt: number): string {
  return `${Math.round(sqFt).toLocaleString()} sq ft`;
}

function formatPitch(pitch: number): string {
  return `${pitch}/12`;
}

function pitchToDegrees(pitch: number): number {
  return Math.atan(pitch / 12) * (180 / Math.PI);
}

function buildMeasurementSummaryRows(data: HtmlReportData): string {
  const m = data.measurement;
  const totalSquares = (m.totalTrueArea / 100).toFixed(1);

  // Calculate predominant pitch
  const pitchCounts = new Map<number, number>();
  for (const f of m.facets) {
    const rounded = Math.round(f.pitch);
    pitchCounts.set(rounded, (pitchCounts.get(rounded) || 0) + f.trueAreaSqFt);
  }
  let predominantPitch = 0;
  let maxArea = 0;
  for (const [pitch, area] of pitchCounts) {
    if (area > maxArea) { maxArea = area; predominantPitch = pitch; }
  }

  const rows = [
    ['Total Roof Area (True)', formatArea(m.totalTrueArea)],
    ['Total Projected Area', formatArea(m.totalArea)],
    ['Total Squares', totalSquares],
    ['Predominant Pitch', formatPitch(predominantPitch)],
    ['Number of Facets', String(m.facets.length)],
    ['Suggested Waste Factor', `${m.suggestedWaste}%`],
  ];

  if (data.confidence) {
    rows.push(['Confidence', data.confidence]);
  }
  if (data.dataSource) {
    rows.push(['Data Source', data.dataSource]);
  }

  return rows.map(([label, value], i) =>
    `<tr class="${i % 2 === 0 ? 'bg-slate-50' : ''}">
      <td class="py-2 px-4 text-slate-600">${escapeHtml(label)}</td>
      <td class="py-2 px-4 text-right font-semibold text-slate-900">${escapeHtml(value)}</td>
    </tr>`
  ).join('\n');
}

function buildFacetDetailsRows(data: HtmlReportData): string {
  if (data.measurement.facets.length === 0) {
    return '<tr><td colspan="6" class="py-4 px-4 text-center text-slate-400">No facets measured</td></tr>';
  }

  const rows = data.measurement.facets.map((f, i) => {
    const displayName = f.name.startsWith('#') ? f.name : `#${i + 1} ${f.name}`;
    const squares = (f.trueAreaSqFt / 100).toFixed(1);
    const pitchColor = getPitchColorForTemplate(f.pitch);
    return `<tr class="facet-row ${i % 2 === 0 ? 'bg-slate-50' : ''}" data-facet-id="${escapeHtml(f.id)}" onclick="selectFacet('${escapeHtml(f.id)}')">
      <td class="py-2 px-4 font-medium text-slate-900">${escapeHtml(displayName)}</td>
      <td class="py-2 px-4"><span class="inline-block w-3 h-3 rounded-full mr-1" style="background:${pitchColor}"></span>${formatPitch(f.pitch)}</td>
      <td class="py-2 px-4 text-slate-500">${pitchToDegrees(f.pitch).toFixed(1)}&deg;</td>
      <td class="py-2 px-4 text-slate-500">${formatArea(f.areaSqFt)}</td>
      <td class="py-2 px-4 font-semibold">${formatArea(f.trueAreaSqFt)}</td>
      <td class="py-2 px-4">${squares}</td>
    </tr>`;
  });

  // Totals row
  const totalFlat = data.measurement.facets.reduce((s, f) => s + f.areaSqFt, 0);
  const totalTrue = data.measurement.facets.reduce((s, f) => s + f.trueAreaSqFt, 0);
  const totalSq = (totalTrue / 100).toFixed(1);
  rows.push(`<tr class="bg-blue-50 font-bold border-t-2 border-blue-200">
    <td class="py-2 px-4 text-blue-700">TOTAL</td>
    <td class="py-2 px-4"></td>
    <td class="py-2 px-4"></td>
    <td class="py-2 px-4 text-blue-700">${formatArea(totalFlat)}</td>
    <td class="py-2 px-4 text-blue-700">${formatArea(totalTrue)}</td>
    <td class="py-2 px-4 text-blue-700">${totalSq}</td>
  </tr>`);

  return rows.join('\n');
}

function buildEdgeSummaryRows(data: HtmlReportData): string {
  const edges = data.measurement.edges;
  if (edges.length === 0) {
    return '<tr><td colspan="3" class="py-4 px-4 text-center text-slate-400">No edges measured</td></tr>';
  }

  // Group by type
  const groups = new Map<string, { count: number; totalLength: number }>();
  for (const e of edges) {
    const existing = groups.get(e.type) || { count: 0, totalLength: 0 };
    existing.count++;
    existing.totalLength += e.lengthFt;
    groups.set(e.type, existing);
  }

  const typeOrder = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing', 'step-flashing'];
  const sortedTypes = [...groups.entries()].sort((a, b) => {
    const ai = typeOrder.indexOf(a[0]);
    const bi = typeOrder.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return sortedTypes.map(([type, info], i) => {
    const color = EDGE_COLOR_MAP[type] || '#6b7280';
    const label = EDGE_LABEL_MAP[type] || type;
    return `<tr class="${i % 2 === 0 ? 'bg-slate-50' : ''}">
      <td class="py-2 px-4"><span class="inline-block w-4 h-1 mr-2 rounded" style="background:${color}"></span>${escapeHtml(label)}</td>
      <td class="py-2 px-4 text-center text-slate-500">${info.count}</td>
      <td class="py-2 px-4 text-right font-semibold">${info.totalLength.toFixed(1)} ft</td>
    </tr>`;
  }).join('\n');
}

function generateCss(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      line-height: 1.5;
    }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 16px; }

    /* Header */
    #report-header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      color: white;
      padding: 24px 0;
      margin-bottom: 24px;
    }
    #report-header h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.025em; }
    #report-header .subtitle { font-size: 0.875rem; color: #93c5fd; margin-top: 2px; }
    #report-header .meta { display: flex; gap: 24px; margin-top: 8px; font-size: 0.8rem; color: #bfdbfe; }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-blue { background: #dbeafe; color: #1e40af; }

    /* Map */
    #map-container { width: 100%; height: 450px; border-radius: 12px; overflow: hidden; border: 2px solid #e2e8f0; margin-bottom: 16px; position: relative; }
    #map-canvas { width: 100%; height: 100%; }
    #map-key-prompt {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; background: #f1f5f9;
      font-size: 0.9rem; color: #64748b; gap: 12px;
    }
    #map-key-prompt input {
      padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; width: 320px;
      font-size: 0.875rem; outline: none;
    }
    #map-key-prompt input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    #map-key-prompt button {
      padding: 8px 24px; background: #2563eb; color: white; border: none;
      border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.875rem;
    }
    #map-key-prompt button:hover { background: #1d4ed8; }

    /* Controls */
    #controls {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; padding: 12px;
      background: white; border-radius: 10px; border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .control-btn {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 8px;
      background: white; font-size: 0.8rem; font-weight: 500; cursor: pointer;
      color: #475569; transition: all 0.15s ease;
    }
    .control-btn:hover { background: #f1f5f9; }
    .control-btn.active { background: #2563eb; color: white; border-color: #2563eb; }
    .control-sep { width: 1px; background: #e2e8f0; margin: 0 4px; }

    /* Inspector */
    #facet-inspector {
      background: white; border-radius: 10px; border: 1px solid #e2e8f0;
      padding: 16px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      transition: all 0.2s ease; overflow: hidden;
    }
    #facet-inspector.collapsed { max-height: 48px; }
    #facet-inspector h3 { font-size: 0.875rem; font-weight: 600; color: #2563eb; margin-bottom: 8px; }
    .inspector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    .inspector-item label { display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
    .inspector-item .value { font-size: 1rem; font-weight: 600; color: #1e293b; }

    /* Tables */
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; color: #2563eb; margin-bottom: 12px;
      padding-bottom: 8px; border-bottom: 2px solid #dbeafe;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th {
      text-align: left; padding: 8px 16px; background: #1e3a5f; color: white;
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;
    }
    th:last-child { text-align: right; }
    td { padding: 6px 16px; border-bottom: 1px solid #f1f5f9; }
    .facet-row { cursor: pointer; transition: background 0.15s ease; }
    .facet-row:hover { background: #eff6ff !important; }
    .facet-row.selected { background: #dbeafe !important; outline: 2px solid #2563eb; outline-offset: -2px; }

    /* Footer */
    #report-footer {
      text-align: center; padding: 20px 0; font-size: 0.75rem;
      color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      #report-header h1 { font-size: 1.25rem; }
      #map-container { height: 300px; }
      .inspector-grid { grid-template-columns: repeat(2, 1fr); }
      #controls { gap: 4px; }
      .control-btn { padding: 5px 10px; font-size: 0.7rem; }
      th, td { padding: 4px 8px; font-size: 0.75rem; }
    }

    /* Print */
    @media print {
      body { background: white; }
      #report-header { background: #1e3a5f !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      #controls { display: none; }
      #map-container { height: 350px; page-break-inside: avoid; }
      .section { page-break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      th { background: #1e3a5f !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .facet-row:hover { background: inherit !important; }
    }
  `;
}

function generateScript(data: HtmlReportData): string {
  // Serialize report data as JSON for the embedded script
  const serialized = JSON.stringify(data);

  // Build facet color map for inline use
  const facetColorEntries = data.measurement.facets.map((f) => {
    const color = getPitchColorForTemplate(f.pitch);
    return `"${f.id}": "${color}"`;
  }).join(', ');

  return `
    // ─── Embedded Report Data ───
    const REPORT_DATA = ${serialized};

    // ─── Edge colors ───
    const EDGE_COLORS = ${JSON.stringify(EDGE_COLOR_MAP)};

    // ─── Facet pitch colors ───
    const FACET_COLORS = {${facetColorEntries}};

    // ─── State ───
    let map = null;
    let facetPolygons = {};
    let edgePolylines = [];
    let facetLabelMarkers = [];
    let edgeLabelMarkers = [];
    let showWireframe = true;
    let showFacetLabels = true;
    let showEdgeLabels = false;
    let showMeasurements = true;
    let selectedFacetId = null;

    // ─── Google Maps Init ───
    function initMap() {
      const prompt = document.getElementById('map-key-prompt');
      if (prompt) prompt.style.display = 'none';

      const center = { lat: REPORT_DATA.property.lat, lng: REPORT_DATA.property.lng };
      map = new google.maps.Map(document.getElementById('map-canvas'), {
        center: center,
        zoom: 20,
        mapTypeId: 'satellite',
        tilt: 0,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        scaleControl: true,
        fullscreenControl: true,
      });

      drawFacets();
      drawEdges();
    }

    // ─── Build vertex lookup ───
    function getVertexMap() {
      const vmap = {};
      for (const v of REPORT_DATA.measurement.vertices) {
        vmap[v.id] = { lat: v.lat, lng: v.lng };
      }
      return vmap;
    }

    // ─── Draw facet polygons ───
    function drawFacets() {
      const vmap = getVertexMap();
      for (const facet of REPORT_DATA.measurement.facets) {
        const path = facet.vertexIds
          .map(function(vid) { return vmap[vid]; })
          .filter(function(v) { return v !== undefined; });
        if (path.length < 3) continue;

        const color = FACET_COLORS[facet.id] || '#3b82f6';
        const polygon = new google.maps.Polygon({
          paths: path,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.25,
          map: map,
          clickable: true,
        });

        polygon.addListener('click', function() { selectFacet(facet.id); });
        facetPolygons[facet.id] = polygon;

        // Facet label at centroid
        if (path.length > 0) {
          var cLat = 0, cLng = 0;
          for (var i = 0; i < path.length; i++) { cLat += path[i].lat; cLng += path[i].lng; }
          cLat /= path.length; cLng /= path.length;

          var labelContent = document.createElement('div');
          labelContent.className = 'map-facet-label';
          labelContent.style.cssText = 'background:rgba(0,0,0,0.7);color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;pointer-events:none;';
          labelContent.textContent = facet.name + ' (' + facet.pitch + '/12)';

          var overlay = new google.maps.marker.AdvancedMarkerElement
            ? null : null; // fallback below

          // Use InfoWindow as label overlay for compatibility
          var infoLabel = new google.maps.InfoWindow({
            content: '<div style="background:rgba(0,0,0,0.75);color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;">' +
              escapeHtmlJS(facet.name) + ' (' + facet.pitch + '/12)</div>',
            position: { lat: cLat, lng: cLng },
            disableAutoPan: true,
          });
          // We use custom overlays instead; keep simple markers
          var marker = new google.maps.Marker({
            position: { lat: cLat, lng: cLng },
            map: showFacetLabels ? map : null,
            icon: {
              url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'),
              scaledSize: new google.maps.Size(1, 1),
            },
            label: {
              text: facet.name + ' ' + facet.pitch + '/12',
              color: 'white',
              fontSize: '11px',
              fontWeight: '600',
              className: 'facet-map-label',
            },
            clickable: false,
          });
          facetLabelMarkers.push(marker);
        }
      }
    }

    // ─── Draw edge polylines ───
    function drawEdges() {
      const vmap = getVertexMap();
      for (const edge of REPORT_DATA.measurement.edges) {
        const start = vmap[edge.startVertexId];
        const end = vmap[edge.endVertexId];
        if (!start || !end) continue;

        const color = EDGE_COLORS[edge.type] || '#ffffff';
        const line = new google.maps.Polyline({
          path: [start, end],
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 3,
          map: showWireframe ? map : null,
        });
        edgePolylines.push(line);

        // Edge length label at midpoint
        if (edge.lengthFt > 0) {
          var midLat = (start.lat + end.lat) / 2;
          var midLng = (start.lng + end.lng) / 2;
          var marker = new google.maps.Marker({
            position: { lat: midLat, lng: midLng },
            map: showEdgeLabels ? map : null,
            icon: {
              url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'),
              scaledSize: new google.maps.Size(1, 1),
            },
            label: {
              text: edge.lengthFt.toFixed(1) + "'",
              color: 'white',
              fontSize: '10px',
              fontWeight: '600',
              className: 'edge-map-label',
            },
            clickable: false,
          });
          edgeLabelMarkers.push(marker);
        }
      }
    }

    function escapeHtmlJS(s) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(s));
      return div.innerHTML;
    }

    // ─── Facet selection ───
    function selectFacet(facetId) {
      // Deselect previous
      if (selectedFacetId && facetPolygons[selectedFacetId]) {
        var prevColor = FACET_COLORS[selectedFacetId] || '#3b82f6';
        facetPolygons[selectedFacetId].setOptions({ fillOpacity: 0.25, strokeWeight: 2 });
      }
      // Remove previous table highlight
      var prevRow = document.querySelector('.facet-row.selected');
      if (prevRow) prevRow.classList.remove('selected');

      selectedFacetId = facetId;

      // Highlight on map
      if (facetPolygons[facetId]) {
        facetPolygons[facetId].setOptions({ fillOpacity: 0.5, strokeWeight: 4 });
      }

      // Highlight table row
      var row = document.querySelector('.facet-row[data-facet-id="' + facetId + '"]');
      if (row) {
        row.classList.add('selected');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Update inspector
      var facet = REPORT_DATA.measurement.facets.find(function(f) { return f.id === facetId; });
      if (facet) {
        var inspector = document.getElementById('facet-inspector');
        inspector.classList.remove('collapsed');
        document.getElementById('inspector-name').textContent = facet.name;
        document.getElementById('inspector-pitch').textContent = facet.pitch + '/12 (' + (Math.atan(facet.pitch / 12) * 180 / Math.PI).toFixed(1) + '\\u00B0)';
        document.getElementById('inspector-flat-area').textContent = Math.round(facet.areaSqFt).toLocaleString() + ' sq ft';
        document.getElementById('inspector-true-area').textContent = Math.round(facet.trueAreaSqFt).toLocaleString() + ' sq ft';
        document.getElementById('inspector-squares').textContent = (facet.trueAreaSqFt / 100).toFixed(2);
        document.getElementById('inspector-vertices').textContent = facet.vertexIds.length + ' vertices';
      }
    }

    // ─── Toggle controls ───
    function toggleWireframe() {
      showWireframe = !showWireframe;
      var mapRef = showWireframe ? map : null;
      edgePolylines.forEach(function(pl) { pl.setMap(mapRef); });
      updateButtonState('btn-wireframe', showWireframe);
    }

    function toggleFacetLabels() {
      showFacetLabels = !showFacetLabels;
      var mapRef = showFacetLabels ? map : null;
      facetLabelMarkers.forEach(function(m) { m.setMap(mapRef); });
      updateButtonState('btn-labels', showFacetLabels);
    }

    function toggleEdgeLabels() {
      showEdgeLabels = !showEdgeLabels;
      var mapRef = showEdgeLabels ? map : null;
      edgeLabelMarkers.forEach(function(m) { m.setMap(mapRef); });
      updateButtonState('btn-edges', showEdgeLabels);
    }

    function toggleMeasurements() {
      showMeasurements = !showMeasurements;
      var sections = document.querySelectorAll('.measurement-section');
      sections.forEach(function(s) {
        s.style.display = showMeasurements ? '' : 'none';
      });
      updateButtonState('btn-measurements', showMeasurements);
    }

    function setMapType(type) {
      if (!map) return;
      map.setMapTypeId(type);
      document.querySelectorAll('.map-type-btn').forEach(function(b) { b.classList.remove('active'); });
      var activeBtn = document.getElementById('btn-map-' + type);
      if (activeBtn) activeBtn.classList.add('active');
    }

    function updateButtonState(id, active) {
      var btn = document.getElementById(id);
      if (btn) {
        if (active) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    }

    // ─── API Key handling ───
    function loadMapWithKey() {
      var input = document.getElementById('api-key-input');
      var key = input ? input.value.trim() : '';
      if (!key) return;
      loadGoogleMaps(key);
    }

    function loadGoogleMaps(key) {
      var script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&callback=initMap';
      script.async = true;
      script.defer = true;
      script.onerror = function() {
        alert('Failed to load Google Maps. Please check your API key.');
      };
      document.head.appendChild(script);
    }

    // On load: check URL params for key
    document.addEventListener('DOMContentLoaded', function() {
      var params = new URLSearchParams(window.location.search);
      var key = params.get('key');
      if (key) {
        loadGoogleMaps(key);
      } else {
        // Show prompt
        var prompt = document.getElementById('map-key-prompt');
        if (prompt) prompt.style.display = 'flex';
      }
    });
  `;
}

export function generateHtmlTemplate(data: HtmlReportData): string {
  const address = escapeHtml(data.property.address);
  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const generatedTime = new Date(data.generatedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const confidenceBadge = data.confidence
    ? `<span class="badge badge-blue">${escapeHtml(data.confidence)} Confidence</span>`
    : '';

  const dataSourceLabel = data.dataSource
    ? `<span style="margin-left:8px;font-size:0.75rem;color:#93c5fd;">Source: ${escapeHtml(data.dataSource)}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SkyHawk Report - ${address}</title>
  <style>${generateCss()}
    /* Map label styles */
    .facet-map-label, .edge-map-label {
      background: rgba(0,0,0,0.7) !important;
      padding: 1px 5px !important;
      border-radius: 3px !important;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div id="report-header">
    <div class="container">
      <h1>SkyHawk</h1>
      <div class="subtitle">Aerial Property Intelligence Report</div>
      <div class="meta">
        <span>${address}</span>
        <span>${generatedDate} at ${generatedTime}</span>
        ${confidenceBadge}
        ${dataSourceLabel}
      </div>
    </div>
  </div>

  <div class="container">

    <!-- MAP -->
    <div id="map-container">
      <div id="map-canvas"></div>
      <div id="map-key-prompt" style="display:none;">
        <div style="font-weight:600;color:#1e293b;font-size:1rem;">Google Maps API Key Required</div>
        <div>Enter your key or add <code>?key=YOUR_KEY</code> to the URL</div>
        <input type="text" id="api-key-input" placeholder="Enter Google Maps API key..." onkeydown="if(event.key==='Enter')loadMapWithKey()">
        <button onclick="loadMapWithKey()">Load Map</button>
      </div>
    </div>

    <!-- CONTROLS -->
    <div id="controls">
      <button id="btn-wireframe" class="control-btn active" onclick="toggleWireframe()">Wireframe</button>
      <button id="btn-labels" class="control-btn active" onclick="toggleFacetLabels()">Facet Labels</button>
      <button id="btn-edges" class="control-btn" onclick="toggleEdgeLabels()">Edge Labels</button>
      <button id="btn-measurements" class="control-btn active" onclick="toggleMeasurements()">Measurements</button>
      <div class="control-sep"></div>
      <button id="btn-map-satellite" class="control-btn map-type-btn active" onclick="setMapType('satellite')">Satellite</button>
      <button id="btn-map-hybrid" class="control-btn map-type-btn" onclick="setMapType('hybrid')">Hybrid</button>
      <button id="btn-map-terrain" class="control-btn map-type-btn" onclick="setMapType('terrain')">Terrain</button>
    </div>

    <!-- FACET INSPECTOR -->
    <div id="facet-inspector" class="collapsed">
      <h3>Facet Inspector <span style="font-weight:400;font-size:0.75rem;color:#94a3b8;">&mdash; click a facet on the map or table</span></h3>
      <div class="inspector-grid">
        <div class="inspector-item"><label>Name</label><div class="value" id="inspector-name">--</div></div>
        <div class="inspector-item"><label>Pitch</label><div class="value" id="inspector-pitch">--</div></div>
        <div class="inspector-item"><label>Flat Area</label><div class="value" id="inspector-flat-area">--</div></div>
        <div class="inspector-item"><label>True Area</label><div class="value" id="inspector-true-area">--</div></div>
        <div class="inspector-item"><label>Squares</label><div class="value" id="inspector-squares">--</div></div>
        <div class="inspector-item"><label>Vertices</label><div class="value" id="inspector-vertices">--</div></div>
      </div>
    </div>

    <!-- MEASUREMENT SUMMARY -->
    <div id="measurement-summary" class="section measurement-section">
      <div class="section-title">Roof Measurement Summary</div>
      <table>
        <tbody>
          ${buildMeasurementSummaryRows(data)}
        </tbody>
      </table>
    </div>

    <!-- FACET DETAILS TABLE -->
    <div id="facet-details-table" class="section measurement-section">
      <div class="section-title">Facet Details</div>
      <table>
        <thead>
          <tr>
            <th>Facet</th>
            <th>Pitch</th>
            <th>Angle</th>
            <th>Flat Area</th>
            <th>True Area</th>
            <th style="text-align:right">Squares</th>
          </tr>
        </thead>
        <tbody>
          ${buildFacetDetailsRows(data)}
        </tbody>
      </table>
    </div>

    <!-- EDGE SUMMARY -->
    <div id="edge-summary" class="section measurement-section">
      <div class="section-title">Edge Measurements by Type</div>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th style="text-align:center">Count</th>
            <th style="text-align:right">Total Length</th>
          </tr>
        </thead>
        <tbody>
          ${buildEdgeSummaryRows(data)}
        </tbody>
      </table>
    </div>

  </div>

  <!-- FOOTER -->
  <div id="report-footer">
    <div class="container">
      Generated by SkyHawk Aerial Property Intelligence &bull; ${generatedDate}<br>
      Measurements may vary. For professional use only.
    </div>
  </div>

  <script>
${generateScript(data)}
  </script>

</body>
</html>`;
}
