DAQIQ THESIS — PHASE 3 BRIEFING
WebGIS Frontend Development
Thesis: Explainable GeoAI for Urban Retail Site Selection — A WebGIS-Based
        Spatial Intelligence Model for Milan · Politecnico di Milano · 2025–2026
===========================================================================


WHAT THIS DOCUMENT IS
---------------------
This document tells you everything you need to build Phase 3 of this thesis
independently while Phase 2 runs in parallel. It explains what the analytical
pipeline has already produced, exactly what files you will receive, what their
structure is, what the frontend must do with them, what technology choices have
been made, and what the integration contract between your work and Phase 2 is.

Read this entire document before writing a single line of code.


WHAT THE PROJECT IS
--------------------
The thesis builds a data-driven WebGIS application that scores every H3
hexagonal grid cell (~0.1 km² each) across the Comune di Milano with two
independent suitability scores:

  1. AHP score — an expert-driven Multi-Criteria Decision Making score based
     on 13 spatial indicators (transit access, population density, retail
     density, competition, etc.) weighted by the Analytic Hierarchy Process.

  2. RF probability — a data-driven score produced by a Random Forest
     classifier trained on the spatial profiles of existing successful café
     locations.

A SHAP (SHapley Additive exPlanations) analysis decomposes each cell's RF
prediction into the contribution of each individual spatial feature. This is
the "explainability" layer — it tells the user WHY the model scored a location
the way it did.

The final product the user sees is a map of Milan where every hexagonal cell
is colour-coded by suitability, and clicking any cell shows: both scores, a
suitability tier (HIGH / MEDIUM / LOW), and the top 3 spatial factors driving
the score in plain language (e.g., "↑ Retail Density | ↑ Market Opportunity |
↓ Metro Access").

ACADEMIC NOTE: This is not a consumer product interface. It is a spatial
analysis communication tool for a thesis committee. Visual clarity,
methodological transparency, and reproducibility take priority over marketing
aesthetics. The key academic contribution is the auditable comparison between
expert (AHP) and empirical ML (RF/SHAP) rankings — the frontend must make
this comparison visible.


SCALE AND PLATFORM
-------------------
Phase 2 will produce scores for the full Comune di Milano (all 9 Municipios)
using the same Google Colab pipeline that produced Phase 1.

Expected cell count: approximately 2,200 viable H3 cells at resolution 9.

This scale does not require a distributed backend. Both phases run in Colab.
The GeoJSON you receive will be a single file loadable directly in the browser
via fetch(). No PostGIS, no tile server, and no database infrastructure are
required for this project.


WHAT PHASE 1 HAS ALREADY PRODUCED (YOUR STARTING POINT)
---------------------------------------------------------
Phase 1 ran the full pipeline on Municipios 7, 8, and 9. It produced 392
scored H3 cells. This is the proof-of-concept you use to build and test the
entire frontend before Phase 2 is ready.

The key output file for you is:

  gold_webgis_layer.geojson

This is a GeoJSON FeatureCollection. Each feature represents one H3 hexagonal
cell and has the following properties:

  h3_id               — H3 cell identifier (e.g. "891f99cdc1bffff")
  centroid_lng        — longitude of cell centre (WGS84, 6 decimal places)
  centroid_lat        — latitude of cell centre (WGS84, 6 decimal places)
  label               — ground truth: 1 = has 2+ cafés, 0 = does not
  cafe_count          — actual number of cafés in the cell
  ahp_score           — AHP suitability score [0.058 – 0.710]
  ahp_rank            — AHP rank across all viable cells (1 = best)
  rf_probability      — Random Forest probability [0.0 – 1.0]
  rf_rank             — RF rank across all viable cells (1 = best)
  rank_diff           — absolute difference between ahp_rank and rf_rank
  combined_score      — percentile-rank average of AHP and RF [0.022 – 0.994]
  suitability_tier    — "HIGH", "MEDIUM", or "LOW"
  top3_factors        — plain-language string, e.g.:
                        "↑ Retail Density | ↑ Market Opportunity | ↓ Metro Access"
  shap_base_value     — SHAP base value (mean RF prediction = 0.3284)

  Plus 13 SHAP feature columns (one per spatial indicator):
    shap_Metro_Access
    shap_Bus_Tram_Density
    shap_Network_Centrality
    shap_Population_Density
    shap_Office_Density
    shap_University_Proximity
    shap_Night_Light
    shap_Retail_Density
    shap_Tourist_POIs
    shap_POI_Diversity
    shap_Café_Density
    shap_Market_Opportunity
    shap_Pedestrian_Street

  Each shap_* column is a float representing how much that feature pushed the
  RF probability up (positive) or down (negative) from the base value for
  that specific cell. The following must hold mathematically:
    rf_probability ≈ shap_base_value + sum(all shap_* columns)

  The geometry is the H3 hexagonal polygon in WGS84 (EPSG:4326).

There is also a companion metadata file:

  gold_webgis_summary.json

This file contains legend configuration, score range statistics, tier
distribution counts, colour ramp stops, tier colours, AHP cluster structure,
and model performance metrics. Your frontend must read this file on startup
to configure itself — do not hardcode these values in JavaScript. The structure
is self-explanatory; open it and read it before building the legend and colour
ramp components.


PHASE 2 FILE DELIVERY
----------------------
Phase 2 delivers updated versions of both files covering the full Comune di
Milano (~2,200 viable cells). File names and column schema will remain
identical to Phase 1. When those files arrive, you replace the data source
path in the frontend — no other code changes should be required.

Phase 2 will confirm delivery with a short handoff note listing any additions
to the schema.


WHAT YOU MUST BUILD
--------------------
A browser-based GIS application (desktop-first) with the following:

  1. MAP LAYER
     H3 hexagonal cells colour-coded by combined_score (continuous choropleth)
     or by suitability_tier (categorical: HIGH/MEDIUM/LOW). User can toggle
     between the two colour modes.

  2. CELL POPUP (on click/tap)
     - Suitability tier with colour badge (HIGH=green, MEDIUM=amber, LOW=red)
     - AHP score and RF probability as two separate bar/gauge indicators
     - Combined score
     - top3_factors string rendered with ↑/↓ icons
     - Mini SHAP bar chart: 13 features, horizontal bars, positive=blue
       (right), negative=red (left), centred on zero.
       X-axis label: "Impact on suitability score"

  3. LEGEND PANEL (driven by gold_webgis_summary.json)
     - What AHP score means (expert judgment)
     - What RF probability means (data-driven)
     - What the three tiers mean
     - One plain-language sentence explaining SHAP
     - The AHP vs RF agreement finding:
       "Expert and model agree on WHERE (cell-level rho=0.70) but disagree
        on WHY (feature-level rho=-0.07)"

  4. DIVERGENCE INDICATOR (ACADEMICALLY MANDATORY)
     Cells where rank_diff > 100 must show a visible ⚠ icon on the map.
     Hover tooltip: "Expert and model disagree on this location."
     These high-divergence cells are primary case study material for the
     thesis examiner. Do not omit this.

  5. FILTER PANEL
     - Tier checkboxes: HIGH / MEDIUM / LOW
     - Minimum combined_score slider (0 to 1)
     - Map updates in real time as filters change

  6. RANKING SIDEBAR
     Top N cells by combined_score (default top 10), clickable to zoom
     to that cell on the map.

  7. TWO-VIEW TOGGLE
     Entrepreneur View:
       Shows scores, tier, top3_factors, SHAP chart.
       Does not display label or rank_diff prominently.
     Thesis/Examiner View:
       Additionally shows: label (ground truth), rank_diff, ahp_rank,
       rf_rank, and a note when the cell is in the validation set.
       This view is for the thesis committee.

  8. METHODOLOGY PANEL
     - AHP cluster weights:
         Accessibility 55.8%, Demand Potential 26.3%,
         Urban Context 12.2%, Competition 5.7%
     - AHP Consistency Ratio: 0.0439 (valid < 0.10)
     - RF model: 200 estimators, GroupShuffleSplit spatial validation,
       Validation AUC: 0.918
     - Placeholder slot: tier-stability sensitivity table (from Phase 2)
     - Placeholder slot: AHP vs SHAP feature comparison table (from Phase 2)
     - Data source credits: OSM, Urban Atlas 2021, ISTAT, VIIRS 2024


BACKEND ARCHITECTURE
---------------------
For Phase 1 (392 cells, 0.46 MB): load gold_webgis_layer.geojson directly
via fetch() in the browser. No backend needed.

For Phase 2 (~2,200 cells): same approach. The file size at this scale is
well within what any modern browser handles as a single client-side GeoJSON.
No PostGIS, no tile server, and no database are needed.

If for any reason performance is a concern at Phase 2 scale, use the h3-js
library to reconstruct hex geometries client-side from h3_id only:
  - Store all score/feature data in a flat JSON keyed by h3_id
  - Draw hexagon polygons using h3-js, not pre-computed coordinate arrays
  - This eliminates geometry transfer overhead entirely
Discuss with the Phase 2 lead before implementing this — it adds complexity
that is almost certainly unnecessary at 2,200 cells.


TECHNOLOGY STACK
-----------------
Map library:    Leaflet.js (version 1.9+).
                Alternative: MapLibre GL JS (open source).
                Do NOT use Google Maps — licensing conflict with the open
                data requirement of this thesis.

Charts (SHAP):  Chart.js or D3.js for the per-cell SHAP bar chart.
                Must support positive (blue) and negative (red) horizontal
                bars on a centred zero axis.

Framework:      Plain HTML/CSS/JS is acceptable and recommended for this
                scope. React or Vue are acceptable if you already know them.
                Do not introduce a new framework just for this project.

Deployment:     GitHub Pages (static, no backend needed for either phase).

CRS:            WGS84 (EPSG:4326) throughout. Do not reproject. Leaflet
                natively uses WGS84.

Base map tiles: OpenStreetMap or CARTO free tier (CartoDB.Positron or
                CartoDB.DarkMatter). CARTO light grey is recommended — it
                does not visually compete with the choropleth colour ramp.


KEY DESIGN CONSTRAINTS — DO NOT VIOLATE THESE
-----------------------------------------------
  1. Open data and open source only. No Google Maps. No paid APIs.

  2. AHP score and RF probability must always appear as two SEPARATE,
     DISTINCT indicators. Never merge them into a single number without
     explanation. The entire thesis argument depends on showing that the
     two methods produce different results in different ways. Hiding one
     or silently merging them destroys the academic contribution.

  3. SHAP values in the per-cell popup must use signed colour encoding:
     Positive SHAP = blue bar (feature increases suitability)
     Negative SHAP = red bar (feature decreases suitability)
     Do NOT display absolute SHAP values in the popup. The sign matters.
     Absolute values are only appropriate for global importance rankings.
     A WebGIS without the per-cell SHAP popup does not fulfil the thesis title.

  4. The label column (ground truth) must NOT appear in the Entrepreneur View.
     It belongs in the Thesis/Examiner View only.

  5. The map must display H3 hexagonal polygons, not point markers.
     Fill colour = combined_score (continuous) or tier (categorical).
     Border colour: light grey (#cccccc) at opacity 0.3.

  6. CRS must remain WGS84 throughout. Do not reproject.

  7. The rank_diff > 100 divergence indicator (⚠) is mandatory.
     These cells are the primary case study material and the examiner
     will look for them.

  8. Do not hardcode score ranges, tier thresholds, or colour ramp stops
     in JavaScript. Read all of these from gold_webgis_summary.json on
     startup. They will be updated when Phase 2 delivers its summary JSON.


WHAT GOOD vs BAD INTEGRATION LOOKS LIKE
-----------------------------------------
Good:
  - Frontend reads gold_webgis_summary.json on startup. When Phase 2
    delivers an updated summary JSON, legend, colour ramp, and tier counts
    update automatically with zero frontend code changes.
  - Column references use exact names from the GeoJSON
    (e.g. feature.properties.ahp_score, feature.properties.top3_factors).
  - SHAP mini bar chart dynamically reads all 13 shap_* columns from the
    clicked feature. Feature names read from gold_webgis_summary.json —
    not hardcoded.

Bad (avoid these):
  - Hardcoding score ranges, thresholds, or colour stops in JavaScript.
  - Displaying only combined_score without showing AHP and RF separately.
  - Ignoring rank_diff or omitting the ⚠ divergence indicator.
  - Using absolute SHAP values in the per-cell popup.
  - Building only one view without the Entrepreneur / Examiner toggle.


INTEGRATION SEQUENCE
---------------------
Steps 1–5 can be completed before Phase 2 is ready, using Phase 1 data.

Step 1 — Confirm data contract
  Receive gold_webgis_layer.geojson (392 cells) and gold_webgis_summary.json.
  Verify the GeoJSON loads and renders as hexagons in WGS84. Read the summary
  JSON and understand its structure before writing any configuration code.

Step 2 — Base choropleth layer (Phase 1 data)
  Implement the combined_score choropleth as the default view using a
  perceptually uniform sequential colour ramp (e.g. ColorBrewer YlOrRd).
  Implement the toggle between continuous combined_score and categorical
  suitability_tier views. Implement the dynamic legend from summary JSON.

Step 3 — Cell popup and SHAP chart
  On hex click: render tier badge, AHP score, RF probability, combined score,
  top3_factors with icons, and the 13-feature signed SHAP bar chart.
  Implement ⚠ divergence indicator for cells where rank_diff > 100.

Step 4 — Filter panel, ranking sidebar, two-view toggle
  Implement tier checkboxes, combined_score slider, and top-N ranking sidebar.
  Implement the Entrepreneur / Thesis view toggle. Confirm label and rank_diff
  are only visible in Thesis/Examiner mode.

Step 5 — Methodology panel
  Populate with confirmed Phase 1 values: AHP weights, AUC, Spearman rho,
  SHAP base value, data source credits. Leave placeholder slots for the
  Phase 2 tier-stability sensitivity table and AHP vs SHAP comparison table.

Step 6 — Phase 2 data integration
  When Phase 2 delivers updated GeoJSON and summary JSON for full Milan:
    a. Replace the data source path in the frontend.
    b. Load gold_webgis_summary_phase2.json — verify legend and colour ramp
       update automatically with zero code changes.
    c. Populate the tier-stability and AHP vs SHAP tables in the Methodology
       panel with Phase 2 values.
    d. Confirm browser performance is acceptable at ~2,200 cells.

Step 7 — Thesis export outputs
  Generate static figures for the thesis document:
    a. Full Milan map at zoom 11–12, combined_score choropleth, Phase 2 data.
       PNG at minimum 300 DPI.
    b. Zoomed view of the highest-density HIGH-tier cluster.
    c. The maximum divergence case study cell from Phase 1
       (h3_id: 891f99cd5afffff, AHP rank 154 vs RF rank 386, |Δ|=232).
       Display highlighted with SHAP waterfall and both scores visible.
    d. Screenshot of the Methodology panel showing the AHP vs SHAP comparison
       table and tier-stability table.

Step 8 — Joint integration review
  Both leads review the full deployed application together. Confirm all thesis
  screenshots are taken from the Phase 2 deployed version, not Phase 1.
  Confirm Methodology panel values reflect Phase 2 results.


PHASE 3 DELIVERABLES FOR THE THESIS
-------------------------------------
  1. Working WebGIS application at a public URL (GitHub Pages).

  2. Source code repository (GitHub) with:
       - README explaining how to run locally and deploy
       - gold_webgis_layer.geojson and gold_webgis_summary.json from Phase 1
         included for reproducibility
       - /data/ folder structure ready for Phase 2 files

  3. Technical documentation section for the thesis (written together with
     the Phase 2 lead):
       - System architecture diagram (data flow from GeoJSON to browser)
       - Technology stack justification
       - Screenshots of all major UI states
       - Performance notes at Phase 2 scale

  4. One-page user guide for the non-technical reader: what the map shows
     and how to interpret scores and tiers.


WHAT YOU DO NOT NEED TO BUILD
------------------------------
  - Any backend data pipeline, ML inference code, or OSM data fetching
  - Any AHP weight calculation UI (weights are fixed)
  - Any authentication or user account system
  - Any real-time data updates (all data is static, produced by Phase 2)
  - Database infrastructure or tile server


FILES YOU RECEIVE NOW (TO START DEVELOPMENT)
---------------------------------------------
  gold_webgis_layer.geojson     — 0.46 MB, 392 cells, full schema above
  gold_webgis_summary.json      — metadata, legend config, model performance

These are sufficient to build and test the complete frontend through Step 5.
Phase 2 files replace these at Step 6. No other files are needed to start.

===========================================================================
END OF BRIEF
