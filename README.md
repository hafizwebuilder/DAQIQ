# DAQIQ Phase 3 WebGIS Frontend

Static Phase 3 frontend for the thesis **Explainable GeoAI for Urban Retail Site Selection**.

This implementation follows the Phase 3 briefing for the current Phase 1 handoff:

- H3 hexagon WebGIS map
- Combined-score and tier choropleth toggle
- Dynamic legend driven by `gold_webgis_summary.json`
- Click-to-inspect details panel with separate AHP and RF indicators
- Signed SHAP bar chart for all delivered `shap_*` columns
- Mandatory divergence warning for `rank_diff > 100`
- Real-time tier and combined-score filters
- Top-N ranking sidebar
- Entrepreneur / Thesis-Examiner view toggle
- About / Methodology panel with required thesis context and Phase 2 placeholders

## Project structure

```text
.
|-- index.html
|-- styles.css
|-- app.js
|-- data
|   |-- phase1
|   |   |-- gold_webgis_layer.geojson
|   |   `-- gold_webgis_summary.json
|   `-- phase2
|       `-- README.md
`-- Phase3_Frontend_Briefing.md
```

## Run locally

Serve the folder through a local static web server. Do not open `index.html` directly with `file://`, because the browser will block `fetch()` for the data files.

Example:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Current data source

The app currently reads:

- `./data/phase1/gold_webgis_summary.json`
- `./data/phase1/gold_webgis_layer.geojson`

These files are included for reproducibility and Phase 1 development.

## Phase 2 integration path

The frontend is intentionally structured so the Phase 2 swap happens at the data layer:

1. Load the full-city data into PostGIS as `cafe_cells`
2. Expose it via `pg_featureserv` with bbox filtering
3. Update the frontend data source path or endpoint
4. Replace the summary JSON with the Phase 2 version
5. Fill the Methodology panel placeholders using the delivered Phase 2 artifacts

Do **not** load the full raw Phase 2 GeoJSON into the browser as a single client-side layer.

## Known Phase 1 limitations from the handoff

- Validation-set flags are not present in the current Phase 1 GeoJSON, so the Thesis/Examiner panel shows a fallback note.
- The tier-stability sensitivity table and AHP-vs-SHAP comparison table are reserved for the Phase 2 artifacts mentioned in the briefing.
- The current implementation is optimized for Phase 1 development scale. Phase 2 requires the backend strategy described in the briefing.
