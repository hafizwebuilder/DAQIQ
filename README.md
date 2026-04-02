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
   |-- phase1
   |   |-- gold_webgis_layer.geojson
   |   `-- gold_webgis_summary.json
   `-- phase2
       `-- README.md

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

The frontend is intentionally structured so the Phase 2 swap happens at the data layer only:

1. Receive the updated full-city `gold_webgis_layer.geojson`
2. Receive the updated `gold_webgis_summary.json`
3. Replace the frontend data source path
4. Keep the same UI code and let the summary metadata reconfigure the legend, colour ramp, and methodology values
5. Fill the Phase 2 table placeholders when the additional validation artifacts are delivered

At the updated project scale of roughly 2,200 H3 cells, loading the full GeoJSON directly in the browser via `fetch()` is the intended architecture. No PostGIS, no tile server, and no database are required.

## Known Phase 1 limitations from the handoff

- Validation-set flags are not present in the current Phase 1 GeoJSON, so the Thesis/Examiner panel shows a fallback note.
- The tier-stability sensitivity table and AHP-vs-SHAP comparison table are reserved for the Phase 2 artifacts mentioned in the briefing.
- The current implementation already uses direct GeoJSON loading and `Leaflet` with canvas rendering enabled, which should remain smooth at the updated Phase 2 scale.

## Phase 2 Metadata Requirements

For the Methodology panel to populate automatically with zero code changes, the Phase 2 `gold_webgis_summary.json` should include these keys:

- `methodology.ahp.consistency_ratio`
- `methodology.rf.validation_auc_reported`
- `methodology.agreement.feature_level_rho`
- `methodology.data_credits`

The frontend also continues to read these existing summary keys:

- `model_performance.rf_auc_validation`
- `model_performance.rf_cv_auc_mean`
- `model_performance.spearman_ahp_rf_cell_level`
- `features.ahp_clusters`
- `colour_ramp.stops`
- `colour_ramp.tier_colours`
- `suitability_tiers.thresholds`

Recommended JSON shape:

```json
{
  "methodology": {
    "ahp": {
      "consistency_ratio": 0.0439
    },
    "rf": {
      "validation_auc_reported": 0.918
    },
    "agreement": {
      "feature_level_rho": -0.07
    },
    "data_credits": [
      "OpenStreetMap",
      "Urban Atlas 2021",
      "ISTAT",
      "VIIRS 2024"
    ]
  }
}
```
