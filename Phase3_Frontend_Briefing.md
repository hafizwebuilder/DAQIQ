DAQIQ THESIS — PHASE 3 BRIEFING
WebGIS Frontend Development
Thesis: Explainable GeoAI for Urban Retail Site Selection — A WebGIS-Based
        Spatial Intelligence Model for Milan · Politecnico di Milano · 2025-2026
===========================================================================


WHAT THIS DOCUMENT IS
---------------------
This document tells you everything you need to know to build Phase 3 of this
thesis independently while Phase 2 runs in parallel. It explains what the
analytical pipeline (Phases 1 and 2) has already produced, exactly what files
you will receive, what their structure is, what the frontend must do with them,
what technology choices have already been made or recommended, and what the
integration contract between your work and Phase 2 is.

Read this entire document before writing a single line of code.


WHAT THE PROJECT IS (BRIEF CONTEXT)
------------------------------------
The thesis builds a data-driven WebGIS application that scores every H3
hexagonal grid cell (~0.1 km² each) across Milan with two independent
suitability scores:

  1. AHP score: an expert-driven Multi-Criteria Decision Making score based on
     13 spatial indicators (transit access, population density, retail density,
     competition, etc.) weighted by the Analytic Hierarchy Process.

  2. RF probability: a data-driven score produced by a Random Forest classifier
     trained on the spatial profiles of existing successful café locations.

A SHAP (SHapley Additive exPlanations) analysis then decomposes each cell's RF
prediction into the contribution of each individual spatial feature. This is the
"explainability" layer — it tells the user WHY the model scored a location the
way it did.

The final product the user sees is a map of Milan where every hexagonal cell is
colour-coded by suitability, and clicking any cell shows: both scores, a
suitability tier (HIGH / MEDIUM / LOW), and the top 3 spatial factors driving
the score in plain language (e.g., "↑ Retail Density | ↑ Market Opportunity |
↓ Metro Access").

ACADEMIC FRAMING NOTE: This is not a consumer product interface. It is a
spatial analysis communication tool for a thesis committee and academic
audience. Visual clarity, methodological transparency, and reproducibility
of displayed results take priority over marketing aesthetics. The key academic
contribution is the auditable comparison between expert (AHP) and empirical ML
(RF/SHAP) rankings — the frontend must make this comparison visible, not hide it.


WHAT PHASE 1 HAS ALREADY PRODUCED (YOUR STARTING POINT)
---------------------------------------------------------
Phase 1 ran the full pipeline on a sample area: Municipio 7, 8, and 9 in Milan.
It produced 392 scored H3 cells at resolution 9. This is the proof-of-concept.

The key output file for you is:

  gold_webgis_layer.geojson

This is a GeoJSON FeatureCollection with 392 features (one per H3 hexagonal
cell). Each feature has the following properties:

  h3_id               — the H3 cell identifier string (e.g. "891f99cdc1bffff")
  centroid_lng        — longitude of cell centre (WGS84, 6 decimal places)
  centroid_lat        — latitude of cell centre (WGS84, 6 decimal places)
  label               — ground truth: 1 = has 2+ cafés (positive), 0 = does not
  cafe_count          — actual number of cafés in the cell
  ahp_score           — expert AHP suitability score [0.058 to 0.710]
  ahp_rank            — AHP rank across all viable cells (1 = best)
  rf_probability      — Random Forest probability score [0.0 to 1.0]
  rf_rank             — RF rank across all viable cells (1 = best)
  rank_diff           — absolute difference between ahp_rank and rf_rank
  combined_score      — percentile-rank average of AHP and RF [0.022 to 0.994]
  suitability_tier    — "HIGH", "MEDIUM", or "LOW"
  top3_factors        — plain-language string, e.g. "↑ Retail Density |
                         ↑ Market Opportunity | ↓ Metro Access"
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
  RF probability up (positive value) or down (negative value) from the base
  value for that specific cell. The mathematical property that must hold is:
    rf_probability ≈ shap_base_value + sum(all shap_* columns)

  The geometry of each feature is the H3 hexagonal polygon in WGS84 (EPSG:4326)
  as a GeoJSON Polygon coordinate array.

There is also a companion metadata file:

  gold_webgis_summary.json

This JSON file contains legend configuration, score range statistics,
tier distribution counts, colour ramp stops, tier colours, AHP cluster
structure, and model performance metrics. Your frontend should read this file
to configure itself rather than hardcoding these values in JavaScript.
The structure is self-explanatory — open it and read it before building
the legend and colour ramp components.


PHASE 2 FILE DELIVERY FORMAT
-----------------------------
Phase 2 will deliver updated versions of both files covering the full city (~150,000 cells). File names, delivery format, and any additional fields will be confirmed in a Phase 2 handoff note when completed. I will make every effort to keep the column schema identical to Phase 1, but strict 1:1 parity is not 100% guaranteed due to platform and scope limitations. When those files arrive, you replace the data source path — ideally, no other frontend code changes should be required, though adjustments may be necessary depending on the final schema.


WHAT PHASE 3 MUST BUILD
-----------------------
A web-based GIS application accessible via a browser (desktop-first, mobile-
friendly is a plus) with the following capabilities:

  1. A map of Milan showing the H3 hexagonal grid cells colour-coded by
     combined_score (continuous choropleth) or suitability_tier (categorical).
     The user can toggle between the two colour modes.

  2. Click/tap on any cell to open a popup/panel showing:
       - Suitability tier with colour badge (HIGH=green, MEDIUM=amber, LOW=red)
       - AHP score and RF probability as two separate gauge/bar indicators
       - Combined score
       - The top3_factors string rendered with icons (↑ = positive, ↓ = negative)
       - A mini SHAP bar chart showing all 13 feature contributions
         (positive SHAP bars in blue to the right, negative in red to the left)
         The x-axis label is "Impact on suitability score"

  3. A legend panel (driven by gold_webgis_summary.json) explaining:
       - What AHP score means (expert judgment)
       - What RF probability means (data-driven)
       - What the three tiers mean
       - What SHAP is, in one plain-language sentence
       - The AHP vs RF agreement finding: "Expert and model agree on WHERE
         (cell-level rho=0.70) but disagree on WHY (feature-level rho=-0.07)"

  4. A divergence indicator: cells where rank_diff > 100 must display a
     visible ⚠ icon. Tooltip text on hover: "Expert and model disagree on
     this location." This is academically mandatory — these high-divergence
     cells are the primary case study material in the thesis.

  5. A search / filter panel allowing the user to:
       - Filter cells by suitability tier (checkboxes: HIGH, MEDIUM, LOW)
       - Set a minimum combined_score threshold (slider 0 to 1)
       - The map updates in real time as filters change

  6. A ranking sidebar or panel showing the top N cells (default top 10)
     by combined_score, clickable to zoom to that cell.

  7. A two-view toggle: Entrepreneur View and Thesis/Examiner View.
       Entrepreneur View: shows scores, tier, top3_factors, SHAP chart.
         Does not display label or rank_diff prominently.
       Thesis/Examiner View: additionally shows label (ground truth),
         rank_diff, ahp_rank, rf_rank, and a note when the cell is in
         the validation set. This view is for the thesis committee.

  8. An "About / Methodology" panel containing:
       - AHP cluster weights (Accessibility 55.8%, Demand 26.3%,
         Urban Context 12.2%, Competition 5.7%)
       - AHP Consistency Ratio: 0.0439 (valid < 0.10)
       - RF model: 200 estimators, GroupShuffleSplit spatial validation,
         Validation AUC: 0.918
       - The tier-stability sensitivity table (from Phase 2 MLflow artifact)
         showing cell tier changes at 70/30 and 30/70 AHP/RF blend ratios
       - The AHP vs SHAP feature comparison table
         (from gold_ahp_vs_shap_comparison_phase2.csv)
       - Data source credits: OSM, Urban Atlas 2021, ISTAT, VIIRS 2024


BACKEND ARCHITECTURE
--------------------
For Phase 1 (392 cells, 0.46 MB): load gold_webgis_layer.geojson directly
via fetch() in the browser. No backend needed. This is sufficient for
development and testing.

For Phase 2 (up to 150,000 cells): a PostGIS + pg_featureserv stack is
required. Loading 150,000 hexagonal polygons as raw GeoJSON into a browser
will cause a crash or multi-second freeze on any device.

Recommended Phase 2 backend stack:
  Database:    PostgreSQL 15+ with PostGIS extension
  Feature API: pg_featureserv (open source, reads PostGIS tables as OGC API)
  Tile server: tippecanoe (to generate PMTiles from the GeoJSON for visual
               rendering) or use pg_featureserv bbox filtering directly

Loading the three Phase 2 tier files into PostGIS:
  ogr2ogr -f PostgreSQL PG:"dbname=daqiq" webgis_high.geojson   -nln cafe_cells -append
  ogr2ogr -f PostgreSQL PG:"dbname=daqiq" webgis_medium.geojson -nln cafe_cells -append
  ogr2ogr -f PostgreSQL PG:"dbname=daqiq" webgis_low.geojson    -nln cafe_cells -append

The table name must be cafe_cells. The h3_id column is the primary key.
The pg_featureserv endpoint URL pattern for bbox-filtered tile loading is:
  /collections/daqiq.cafe_cells/items?bbox={west},{south},{east},{north}
The frontend uses this bbox parameter to load only the cells visible in the
current map viewport. This is the correct approach for 150k polygons.

Alternative if PostGIS infrastructure is unavailable:
  Use the h3-js library to reconstruct hex geometries client-side from the
  h3_id field only. Store all feature/score data in a flat JSON or CSV keyed
  by h3_id. Load that flat file on startup. The client draws hex polygons from
  the index string using h3-js, never transferring polygon coordinate arrays.
  This eliminates geometry transfer overhead entirely and is viable for 150k cells
  on modern hardware. Discuss with your Phase 2 lead which approach fits your
  deployment environment.

DO NOT load the raw three-file Phase 2 GeoJSON into Leaflet or MapboxGL
as a single client-side layer without tiling or H3 client-side rendering.


TECHNOLOGY STACK (RECOMMENDED)
--------------------------------
  Map library:     Leaflet.js (version 1.9+) with the leaflet-geojson-vt plugin
                   for client-side vector tile rendering at Phase 2 scale.
                   Alternative: MapLibre GL JS (open source, more powerful for
                   large datasets). Do NOT use Google Maps — licensing conflict
                   with the open data requirement of this thesis.

  Charts (SHAP):   Chart.js or D3.js for the per-cell SHAP bar chart in
                   the popup. The chart must support both positive (blue) and
                   negative (red) horizontal bars on a centred axis.

  Framework:       Plain HTML/CSS/JS is acceptable for Phase 3 scope. React or
                   Vue are acceptable if you prefer them. Do not introduce a
                   framework purely for this project if you are not already
                   comfortable with it — the mapping logic is the hard part.

  Deployment:      GitHub Pages for Phase 1 demo (static, no backend).
                   Railway or Render (free tier) for Phase 2 full version with
                   PostGIS backend.

  CRS:             WGS84 (EPSG:4326) throughout. The GeoJSON is already in
                   WGS84. Do not reproject. Leaflet natively uses WGS84.

  Base map tiles:  OpenStreetMap tiles via the OSM tile server or CARTO free
                   tier (CartoDB.Positron or CartoDB.DarkMatter). CARTO light
                   grey tiles are recommended as they do not visually compete
                   with the choropleth colour ramp on the hexagonal layer.


KEY DESIGN CONSTRAINTS — DO NOT VIOLATE THESE
-----------------------------------------------
  1. Open data, open source only. No Google Maps. No paid APIs.

  2. AHP and RF scores must always be displayed as two SEPARATE, DISTINCT
     indicators. They must NEVER be merged into a single score without
     explanation. The thesis academic contribution is precisely that these two
     methods produce different results. If you hide one or merge them silently,
     you destroy the thesis argument.

  3. SHAP values must be shown per-cell with signed colour encoding.
     Positive SHAP = blue bars (feature increases suitability).
     Negative SHAP = red bars (feature decreases suitability).
     Do NOT display absolute values in the cell popup — the sign matters.
     Absolute values are only appropriate for ranked global importance lists.
     A WebGIS without the per-cell SHAP popup does not fulfil the thesis title.

  4. The label column (ground truth) must be kept in the database but should
     NOT be displayed in the Entrepreneur View. It belongs in the
     Thesis/Examiner View only (see the two-view toggle requirement above).

  5. The map must display H3 hexagonal polygons, not point markers. The hex
     grid IS the analytical unit. Fill colour = combined_score (continuous)
     or tier (categorical). Border colour: light grey (#cccccc) at opacity 0.3.

  6. CRS must remain WGS84 (EPSG:4326) throughout. Do not reproject.

  7. The rank_diff > 100 divergence indicator (⚠ icon) is mandatory.
     It is not an optional decoration. These cells are case study material
     in the thesis and the examiner will look for them.

  8. Do not hardcode any score ranges, tier thresholds, or colour ramp stops
     in JavaScript. Read all of these from gold_webgis_summary.json on startup.
     They change between Phase 1 and Phase 2.


WHAT GOOD vs BAD INTEGRATION LOOKS LIKE
-----------------------------------------
Good integration:
  - Frontend reads gold_webgis_summary.json on startup to configure itself.
    When Phase 2 delivers an updated summary JSON, the legend, colour ramp,
    and tier counts update automatically with zero frontend code changes.

  - Frontend column references use the exact column names from the GeoJSON
    (e.g., feature.properties.ahp_score, feature.properties.top3_factors).
    These names will not change between Phase 1 and Phase 2.

  - PostGIS table is named cafe_cells with the h3_id column as the primary key.
    The pg_featureserv endpoint uses bbox filtering to load only visible cells.

  - The SHAP mini bar chart dynamically reads all 13 shap_* columns from the
    clicked feature and renders them. It does not hardcode feature names — it
    reads them from the gold_webgis_summary.json "features.shap_columns" list.

Bad integration (avoid these):
  - Hardcoding score ranges, tier thresholds, or colour stops in JavaScript.
  - Loading the full Phase 2 GeoJSON without tiling or H3 client-side rendering.
  - Displaying only the combined_score without showing AHP and RF separately.
  - Ignoring the rank_diff column or the ⚠ divergence indicator.
  - Using absolute SHAP values in the per-cell popup bar chart.
  - Building only one view without the Entrepreneur / Examiner toggle.


INTEGRATION SEQUENCE
---------------------
Complete these steps in order. Steps 1 through 5 can be executed before
Phase 2 is finished, using Phase 1 data as mock input.

Step 1 — Confirm environment and data contract
  Receive gold_webgis_layer.geojson (392 cells) and gold_webgis_summary.json
  from your Phase 2 lead. Verify you can load the GeoJSON into your chosen
  mapping library without errors. Confirm geometry renders as hexagons in
  WGS84. Read gold_webgis_summary.json and understand its structure before
  writing any frontend configuration code.

Step 2 — Build the base choropleth layer (Phase 1 data)
  Implement the combined_score choropleth as the default map view using a
  perceptually uniform sequential colour ramp (e.g., ColorBrewer YlOrRd).
  Implement the layer toggle between combined score (continuous) and
  suitability tier (categorical, 3-colour). Implement the dynamic legend
  driven by gold_webgis_summary.json.

Step 3 — Build the cell popup and SHAP chart
  On hex click, render the full popup: tier badge, AHP score, RF probability,
  combined score, top3_factors with icons, and the 13-feature signed SHAP bar
  chart. Implement the ⚠ divergence indicator for cells where rank_diff > 100.

Step 4 — Build the filter panel, ranking sidebar, and two-view toggle
  Implement tier filter checkboxes, combined_score slider, and top-N ranking
  sidebar. Implement the Entrepreneur / Thesis view toggle. Confirm that the
  label column and rank_diff are only visible in Thesis/Examiner mode.

Step 5 — Build the Methodology panel
  Populate with confirmed values: AHP weights, AUC, Spearman rho findings,
  SHAP base value, data source credits. Leave placeholder slots for the
  Phase 2 tier-stability sensitivity table and AHP vs SHAP comparison table —
  these arrive with Phase 2 delivery.

Step 6 — Phase 2 data integration
  When Phase 2 Databricks pipeline delivers the three-tier GeoJSON files and
  the updated summary JSON:
    a. Load all three tier files into PostGIS cafe_cells table (see BACKEND
       ARCHITECTURE section for ogr2ogr commands).
    b. Verify row counts and that all 13+ shap_* column names are present.
    c. Update your frontend data source URL/path to point to the Phase 2
       pg_featureserv endpoint or the merged dataset.
    d. Load gold_webgis_summary_phase2.json — verify legend and colour ramp
       update automatically with zero code changes.
    e. Populate the tier-stability sensitivity table and AHP vs SHAP
       comparison table in the Methodology panel.
    f. Test map render performance at full city scale. Confirm no browser
       freeze with the chosen tiling or H3 client-side strategy.

Step 7 — Thesis export outputs
  Generate static export figures for the thesis document:
    a. Full Milan map at zoom level 11–12, combined_score choropleth, Phase 2
       data. PNG at minimum 300 DPI.
    b. Zoomed view of the highest-density HIGH-tier cluster.
    c. The maximum divergence case study cell from Phase 1 (h3_id:
       891f99cd5afffff, AHP rank 154 vs RF rank 386, |Δ|=232). Display this
       cell highlighted with its SHAP waterfall and both scores visible.
    d. Screenshot of the Methodology panel showing the AHP vs SHAP comparison
       table and tier-stability table.

Step 8 — Joint integration review
  Both leads review the full deployed application together. Confirm all thesis
  screenshots are taken from the Phase 2 deployed version, not Phase 1.
  Confirm the Methodology panel values reflect Phase 2 cross-validation results.


PHASE 3 DELIVERABLES FOR THE THESIS
-------------------------------------
At the end of Phase 3 you must deliver:

  1. Working WebGIS application accessible at a public URL (GitHub Pages for
     Phase 1 demo, Railway or Render for Phase 2 full version).

  2. Source code repository (GitHub) with:
       - Clear README explaining how to run locally and how to deploy
       - gold_webgis_layer.geojson and gold_webgis_summary.json from Phase 1
         included in the repo for reproducibility
       - A /data/ folder structure that mirrors where Phase 2 files will go

  3. Technical documentation section for the thesis (written together with
     the Phase 2 lead) covering:
       - System architecture diagram (data flow from Phase 2 GeoJSON to browser)
       - Technology stack justification
       - Screenshots of all major UI states
       - Performance metrics at Phase 2 scale (load time, tile response time)

  4. A short user guide (1 page) for the non-technical reader explaining what
     the map shows and how to interpret the scores and tiers.


WHAT YOU DO NOT NEED TO BUILD
------------------------------
  - Any backend data pipeline, ML inference code, or OSM data fetching
  - Any AHP weight calculation UI (weights are fixed from expert elicitation)
  - Any authentication or user account system
  - Any real-time data updates (all data is static, produced by Phase 2)
  - The gold_rf_model.pkl custom location scoring feature is out of scope
    unless explicitly agreed with the Phase 2 lead


FILES YOU RECEIVE NOW (TO START DEVELOPMENT)
---------------------------------------------
  gold_webgis_layer.geojson      — 0.46 MB, 392 cells, full schema above
  gold_webgis_summary.json       — metadata, legend config, model performance

These are sufficient to build and test the complete Phase 3 frontend through
Step 5 of the Integration Sequence. Phase 2 files replace these at Step 6.
No other files are needed to start.