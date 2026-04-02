const APP_CONFIG = {
  phase: "phase1-static",
  data: {
    summary: "./data/phase1/gold_webgis_summary.json",
    layer: "./data/phase1/gold_webgis_layer.geojson",
  },
  mandatoryDivergenceThreshold: 100,
};

const state = {
  summary: null,
  geojson: null,
  features: [],
  filteredFeatures: [],
  shapColumns: [],
  selectedFeatureId: null,
  colourMode: "combined",
  audienceView: "entrepreneur",
  minimumCombinedScore: 0,
  visibleTiers: new Set(["HIGH", "MEDIUM", "LOW"]),
  rankingLimit: 10,
  map: null,
  pathRenderer: null,
  featureLayer: null,
  divergenceLayer: null,
};

const dom = {
  datasetSummary: document.getElementById("dataset-summary"),
  visibleCount: document.getElementById("visible-count"),
  divergenceCount: document.getElementById("divergence-count"),
  rankingList: document.getElementById("ranking-list"),
  detailsPanel: document.getElementById("details-panel"),
  legendPanel: document.getElementById("legend-panel"),
  methodologyContent: document.getElementById("methodology-content"),
  methodologyModal: document.getElementById("methodology-modal"),
  scoreThreshold: document.getElementById("score-threshold"),
  scoreThresholdValue: document.getElementById("score-threshold-value"),
  rankingLimit: document.getElementById("ranking-limit"),
  tierHigh: document.getElementById("tier-high"),
  tierMedium: document.getElementById("tier-medium"),
  tierLow: document.getElementById("tier-low"),
  modeCombined: document.getElementById("mode-combined"),
  modeTier: document.getElementById("mode-tier"),
  viewEntrepreneur: document.getElementById("view-entrepreneur"),
  viewExaminer: document.getElementById("view-examiner"),
  openMethodology: document.getElementById("open-methodology"),
  closeMethodology: document.getElementById("close-methodology"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindControls();

  if (!window.L) {
    renderFatalError("Leaflet failed to load. This usually means the browser could not reach the external CDN. Check your connection or use a local copy of Leaflet.");
    return;
  }

  initializeMap();

  try {
    const [summary, geojson] = await Promise.all([
      fetchJson(APP_CONFIG.data.summary),
      fetchJson(APP_CONFIG.data.layer),
    ]);

    state.summary = summary;
    state.geojson = geojson;
    state.features = geojson.features || [];
    state.shapColumns = resolveShapColumns();

    populateDatasetSummary();
    renderMethodology();
    applyFilters();
  } catch (error) {
    console.error(error);
    renderFatalError("The app could not fetch the Phase 1 GeoJSON or summary JSON. Serve this folder through a local web server rather than opening it with file://.");
  }
}

function bindControls() {
  dom.scoreThreshold.addEventListener("input", (event) => {
    state.minimumCombinedScore = Number(event.target.value);
    dom.scoreThresholdValue.textContent = state.minimumCombinedScore.toFixed(2);
    applyFilters();
  });

  dom.rankingLimit.addEventListener("change", (event) => {
    state.rankingLimit = Number(event.target.value);
    renderRanking();
  });

  dom.tierHigh.addEventListener("change", () => toggleTier("HIGH", dom.tierHigh.checked));
  dom.tierMedium.addEventListener("change", () => toggleTier("MEDIUM", dom.tierMedium.checked));
  dom.tierLow.addEventListener("change", () => toggleTier("LOW", dom.tierLow.checked));

  dom.modeCombined.addEventListener("click", () => setColourMode("combined"));
  dom.modeTier.addEventListener("click", () => setColourMode("tier"));
  dom.viewEntrepreneur.addEventListener("click", () => setAudienceView("entrepreneur"));
  dom.viewExaminer.addEventListener("click", () => setAudienceView("examiner"));

  dom.openMethodology.addEventListener("click", () => toggleMethodology(true));
  dom.closeMethodology.addEventListener("click", () => toggleMethodology(false));
  dom.methodologyModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal === "true") {
      toggleMethodology(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggleMethodology(false);
    }
  });
}

function initializeMap() {
  state.map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
  });
  state.pathRenderer = L.canvas({ padding: 0.5 });

  L.control.zoom({ position: "topright" }).addTo(state.map);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(state.map);

  state.featureLayer = L.geoJSON([], {
    style: styleFeature,
    onEachFeature: bindFeatureInteractions,
  }).addTo(state.map);

  state.divergenceLayer = L.layerGroup().addTo(state.map);
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.json();
}

function populateDatasetSummary() {
  const cells = state.summary?.cells?.total_viable ?? state.features.length;
  const studyArea = normalizeText(state.summary?.study_area || "Milan study area");
  const generated = normalizeText(state.summary?.generated || "");
  const phase = normalizeText(state.summary?.phase || "Phase 1");

  dom.datasetSummary.textContent = `${phase} | ${studyArea} | ${cells} H3 cells | Generated ${generated}`;
}

function resolveShapColumns() {
  const firstFeature = state.features[0];
  if (!firstFeature) {
    return [];
  }

  const propertyLookup = new Map();
  Object.keys(firstFeature.properties || {}).forEach((key) => {
    propertyLookup.set(key, key);
    propertyLookup.set(normalizeText(key), key);
  });

  const summaryColumns = state.summary?.features?.shap_columns || [];
  const resolved = summaryColumns
    .map((column) => propertyLookup.get(column) || propertyLookup.get(normalizeText(column)) || column)
    .filter((column) => column in firstFeature.properties);

  if (resolved.length > 0) {
    return resolved;
  }

  return Object.keys(firstFeature.properties).filter((key) => key.startsWith("shap_"));
}

function toggleTier(tier, enabled) {
  if (enabled) {
    state.visibleTiers.add(tier);
  } else {
    state.visibleTiers.delete(tier);
  }
  applyFilters();
}

function setColourMode(mode) {
  state.colourMode = mode;
  dom.modeCombined.classList.toggle("is-active", mode === "combined");
  dom.modeTier.classList.toggle("is-active", mode === "tier");
  redrawFeatures();
  renderLegend();
}

function setAudienceView(view) {
  state.audienceView = view;
  dom.viewEntrepreneur.classList.toggle("is-active", view === "entrepreneur");
  dom.viewExaminer.classList.toggle("is-active", view === "examiner");
  renderDetails(getSelectedFeature());
}

function applyFilters() {
  state.filteredFeatures = state.features.filter((feature) => {
    const props = feature.properties;
    const tier = props.suitability_tier;
    const combined = Number(props.combined_score || 0);
    return state.visibleTiers.has(tier) && combined >= state.minimumCombinedScore;
  });

  if (!state.filteredFeatures.some((feature) => feature.properties.h3_id === state.selectedFeatureId)) {
    state.selectedFeatureId = null;
  }

  redrawFeatures();
  renderLegend();
  renderRanking();
  renderDetails(getSelectedFeature());
  updateCounts();
}

function redrawFeatures() {
  state.featureLayer.clearLayers();
  state.divergenceLayer.clearLayers();
  state.featureLayer.addData({
    type: "FeatureCollection",
    features: state.filteredFeatures,
  });

  state.filteredFeatures.forEach((feature) => {
    const props = feature.properties;
    if (Number(props.rank_diff || 0) > APP_CONFIG.mandatoryDivergenceThreshold) {
      const marker = L.marker([Number(props.centroid_lat), Number(props.centroid_lng)], {
        icon: L.divIcon({
          className: "",
          html: '<div class="divergence-icon" aria-hidden="true">&#9888;</div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      });
      marker.bindTooltip("Expert and model disagree on this location.");
      marker.on("click", () => selectFeature(feature, true));
      state.divergenceLayer.addLayer(marker);
    }
  });

  if (state.filteredFeatures.length > 0) {
    const bounds = state.featureLayer.getBounds();
    if (bounds.isValid() && !state._hasFittedBounds) {
      state.map.fitBounds(bounds.pad(0.08));
      state._hasFittedBounds = true;
    }
  }
}

function bindFeatureInteractions(feature, layer) {
  layer.on({
    click: () => selectFeature(feature),
    mouseover: () => layer.setStyle(hoverStyle(feature)),
    mouseout: () => state.featureLayer.resetStyle(layer),
  });
}

function selectFeature(feature, zoomToFeature = false) {
  state.selectedFeatureId = feature.properties.h3_id;
  redrawFeatures();
  renderDetails(feature);
  if (zoomToFeature) {
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) {
      state.map.fitBounds(bounds.pad(1.2));
    }
  }
}

function getSelectedFeature() {
  return state.filteredFeatures.find((feature) => feature.properties.h3_id === state.selectedFeatureId) || null;
}

function styleFeature(feature) {
  const props = feature.properties;
  const isSelected = props.h3_id === state.selectedFeatureId;
  const fillColor = state.colourMode === "tier"
    ? getTierColor(props.suitability_tier)
    : getContinuousColor(Number(props.combined_score || 0));

  return {
    renderer: state.pathRenderer,
    fillColor,
    fillOpacity: isSelected ? 0.86 : 0.72,
    color: isSelected ? "#14202b" : "#cccccc",
    weight: isSelected ? 1.6 : 0.9,
    opacity: isSelected ? 0.9 : 0.3,
  };
}

function hoverStyle(feature) {
  const base = styleFeature(feature);
  return {
    ...base,
    weight: Math.max(base.weight, 1.4),
    opacity: 0.8,
    fillOpacity: Math.min(base.fillOpacity + 0.08, 0.92),
  };
}

function getTierColor(tier) {
  return state.summary?.colour_ramp?.tier_colours?.[tier] || "#cccccc";
}

function getContinuousColor(value) {
  const stops = state.summary?.colour_ramp?.stops;
  if (!Array.isArray(stops) || stops.length === 0) {
    return "#cccccc";
  }

  const clamped = Math.max(0, Math.min(1, Number(value)));

  if (clamped <= stops[0][0]) {
    return stops[0][1];
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const [startValue, startColor] = stops[index];
    const [endValue, endColor] = stops[index + 1];

    if (clamped >= startValue && clamped <= endValue) {
      const ratio = (clamped - startValue) / (endValue - startValue || 1);
      return interpolateColor(startColor, endColor, ratio);
    }
  }

  return stops[stops.length - 1][1];
}

function interpolateColor(startColor, endColor, ratio) {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  const lerp = (from, to) => Math.round(from + (to - from) * ratio);
  return `rgb(${lerp(start.r, end.r)}, ${lerp(start.g, end.g)}, ${lerp(start.b, end.b)})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const bigint = Number.parseInt(value, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function updateCounts() {
  dom.visibleCount.textContent = state.filteredFeatures.length.toLocaleString();
  dom.divergenceCount.textContent = state.filteredFeatures
    .filter((feature) => Number(feature.properties.rank_diff || 0) > APP_CONFIG.mandatoryDivergenceThreshold)
    .length
    .toLocaleString();
}

function renderRanking() {
  const items = [...state.filteredFeatures]
    .sort((left, right) => Number(right.properties.combined_score) - Number(left.properties.combined_score))
    .slice(0, state.rankingLimit);

  dom.rankingList.innerHTML = "";

  if (items.length === 0) {
    dom.rankingList.innerHTML = `<li class="helper-text">No cells match the current filters.</li>`;
    return;
  }

  items.forEach((feature, index) => {
    const props = feature.properties;
    const item = document.createElement("li");
    item.innerHTML = `
      <button class="ranking-item" type="button">
        <div class="ranking-head">
          <strong>#${index + 1} ${props.h3_id}</strong>
          <span class="badge ${props.suitability_tier.toLowerCase()}">${props.suitability_tier}</span>
        </div>
        <div class="helper-text">
          Combined ${formatNumber(props.combined_score)} | AHP ${formatNumber(props.ahp_score)} | RF ${formatNumber(props.rf_probability)}
        </div>
      </button>
    `;

    item.querySelector("button").addEventListener("click", () => {
      selectFeature(feature, true);
    });

    dom.rankingList.appendChild(item);
  });
}

function renderLegend() {
  if (!state.summary) {
    dom.legendPanel.innerHTML = "";
    return;
  }

  const tierRows = getTierEntries()
    .map((tier) => `
      <div class="tier-row">
        <span class="tier-swatch" style="background:${tier.color}"></span>
        <span>${tier.name}</span>
        <strong>${Number(tier.count || 0).toLocaleString()}</strong>
      </div>
    `)
    .join("");

  const stops = state.summary.colour_ramp?.stops || [];
  const thresholdEntries = Object.entries(state.summary.suitability_tiers?.thresholds || {})
    .filter(([key, value]) => key !== "logic" && typeof value === "number");
  const gradient = stops
    .map(([value, color]) => `${color} ${value * 100}%`)
    .join(", ");
  const scaleStart = stops.length > 0 ? formatNumber(stops[0][0], 2) : "N/A";
  const scaleEnd = stops.length > 0 ? formatNumber(stops[stops.length - 1][0], 2) : "N/A";
  const thresholdRows = thresholdEntries.length > 0
    ? thresholdEntries.map(([key, value]) => `
        <div class="tier-row">
          <span class="tier-swatch" style="background:transparent;border:1px solid rgba(20, 32, 43, 0.12)"></span>
          <span>${normalizeText(key.replaceAll("_", " "))}</span>
          <strong>${formatNumber(value, 2)}</strong>
        </div>
      `).join("")
    : `<div class="legend-copy">No tier thresholds were provided in the loaded summary metadata.</div>`;
  const agreementWhere = formatNullableNumber(state.summary.model_performance?.spearman_ahp_rf_cell_level, 2);
  const featureLevelRho = formatNullableNumber(state.summary?.methodology?.agreement?.feature_level_rho, 2);

  dom.legendPanel.innerHTML = `
    <div>
      <strong>${state.colourMode === "combined" ? "Current map mode: Combined score" : "Current map mode: Suitability tier"}</strong>
      ${state.colourMode === "combined" ? `
        <div class="legend-ramp" style="background: linear-gradient(90deg, ${gradient});"></div>
        <div class="legend-scale">
          <span>${scaleStart}</span>
          <span>${scaleEnd}</span>
        </div>
      ` : `
        <div>${tierRows}</div>
      `}
    </div>
    <div>
      <strong>Tier thresholds</strong>
      <div>${thresholdRows}</div>
      <div class="legend-copy">${normalizeText(state.summary.suitability_tiers?.thresholds?.logic || "")}</div>
    </div>
    <div class="legend-copy">
      <strong>AHP score</strong> represents expert judgment based on the multi-criteria spatial model.
    </div>
    <div class="legend-copy">
      <strong>RF probability</strong> represents the data-driven probability learned from existing successful cafe locations.
    </div>
    <div class="legend-copy">
      <strong>Tiers</strong> summarise suitability into HIGH, MEDIUM, and LOW classes using the delivered thresholds.
    </div>
    <div class="legend-copy">
      <strong>SHAP</strong> explains why the Random Forest scored a specific cell the way it did by showing feature-level pushes up or down.
    </div>
    <div class="legend-copy">
      <strong>AHP vs RF agreement</strong>: Expert and model agree on WHERE (cell-level rho=${agreementWhere}) but disagree on WHY (feature-level rho=${featureLevelRho}).
    </div>
  `;
}

function renderDetails(feature) {
  if (!feature) {
    dom.detailsPanel.innerHTML = `
      <div class="empty-state">
        <h3>No cell selected</h3>
        <p>Select a hexagon on the map to inspect its scores, explanatory factors, and SHAP profile.</p>
      </div>
    `;
    return;
  }

  const props = feature.properties;
  const tier = props.suitability_tier;
  const topFactors = parseTopFactors(props.top3_factors);
  const ahpRange = state.summary?.score_ranges?.ahp_score || { min: 0, max: 1 };
  const ahpWidth = normalizeRange(props.ahp_score, ahpRange.min, ahpRange.max);
  const rfWidth = normalizeRange(props.rf_probability, 0, 1);
  const combinedWidth = normalizeRange(props.combined_score, 0, 1);
  const validationNote = getValidationNote(props);

  dom.detailsPanel.innerHTML = `
    <div class="cell-header">
      <div>
        <h3>${props.h3_id}</h3>
        <p class="detail-meta">Centroid ${formatNumber(props.centroid_lat, 5)}, ${formatNumber(props.centroid_lng, 5)}</p>
      </div>
      <div class="badge-row">
        <span class="badge ${tier.toLowerCase()}">${tier}</span>
        ${Number(props.rank_diff || 0) > APP_CONFIG.mandatoryDivergenceThreshold ? '<span class="badge divergence">&#9888; Divergence</span>' : ""}
      </div>
    </div>
    <div class="metric-grid">
      <article class="metric-card">
        <div class="metric-row">
          <span>AHP score</span>
          <strong>${formatNumber(props.ahp_score)}</strong>
        </div>
        <div class="metric-bar ahp"><span style="width:${ahpWidth}%"></span></div>
        <p class="helper-text">Expert-driven multi-criteria suitability.</p>
      </article>
      <article class="metric-card">
        <div class="metric-row">
          <span>RF probability</span>
          <strong>${formatNumber(props.rf_probability)}</strong>
        </div>
        <div class="metric-bar rf"><span style="width:${rfWidth}%"></span></div>
        <p class="helper-text">Data-driven probability of retail success.</p>
      </article>
      <article class="metric-card full-span">
        <div class="metric-row">
          <span>Combined score</span>
          <strong>${formatNumber(props.combined_score)}</strong>
        </div>
        <div class="metric-bar combined"><span style="width:${combinedWidth}%"></span></div>
        <p class="helper-text">Percentile-rank synthesis used for map colouring and ranking.</p>
      </article>
    </div>
    <div>
      <h4 class="section-title">Top 3 drivers</h4>
      <div class="factor-list">
        ${topFactors.map((factor) => `
          <span class="factor-chip ${factor.direction}">
            <span>${factor.symbol}</span>
            <span>${factor.label}</span>
          </span>
        `).join("")}
      </div>
    </div>
    <div class="chart-wrap">
      <div class="metric-row">
        <strong>SHAP contributions</strong>
        <span class="helper-text">Impact on suitability score</span>
      </div>
      <div id="shap-chart" class="shap-list"></div>
      <p class="helper-text">Positive SHAP values increase suitability (blue). Negative SHAP values decrease suitability (red).</p>
    </div>
    ${state.audienceView === "examiner" ? `
      <div>
        <h4 class="section-title">Thesis / Examiner fields</h4>
        <div class="examiner-grid">
          <article class="metric-card"><span class="status-label">Ground truth label</span><strong>${props.label}</strong></article>
          <article class="metric-card"><span class="status-label">Cafe count</span><strong>${props.cafe_count}</strong></article>
          <article class="metric-card"><span class="status-label">AHP rank</span><strong>${props.ahp_rank}</strong></article>
          <article class="metric-card"><span class="status-label">RF rank</span><strong>${props.rf_rank}</strong></article>
          <article class="metric-card"><span class="status-label">Rank difference</span><strong>${props.rank_diff}</strong></article>
          <article class="metric-card"><span class="status-label">Validation note</span><strong>${validationNote}</strong></article>
        </div>
      </div>
    ` : ""}
  `;

  renderShapChart(feature);
}

function renderShapChart(feature) {
  const container = document.getElementById("shap-chart");
  if (!container) {
    return;
  }

  const props = feature.properties;
  const values = state.shapColumns.map((column) => Number(props[column] || 0));
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 0.000001);

  container.innerHTML = state.shapColumns
    .map((column) => {
      const value = Number(props[column] || 0);
      const width = (Math.abs(value) / maxAbs) * 50;
      const direction = value >= 0 ? "positive" : "negative";
      const style = value >= 0
        ? `width:${width}%;`
        : `width:${width}%;`;

      return `
        <div class="shap-row">
          <div class="shap-label">${prettifyFeatureName(column)}</div>
          <div class="shap-track" title="${prettifyFeatureName(column)}: ${formatNumber(value)}">
            <span class="shap-bar ${direction}" style="${style}"></span>
          </div>
          <div class="shap-value">${formatNumber(value)}</div>
        </div>
      `;
    })
    .join("");
}

function renderMethodology() {
  if (!state.summary) {
    dom.methodologyContent.innerHTML = `
      <section class="card">
        <div class="card-header">
          <h2>About / Methodology</h2>
          <p>Loading methodology metadata...</p>
        </div>
      </section>
    `;
    return;
  }

  const methodology = state.summary.methodology || {};
  const ahpMethodology = methodology.ahp || {};
  const rfMethodology = methodology.rf || {};
  const agreementMethodology = methodology.agreement || {};
  const dataCredits = Array.isArray(methodology.data_credits) ? methodology.data_credits : [];
  const clusterEntries = Object.entries(state.summary.features?.ahp_clusters || {});
  const clusterTableRows = clusterEntries
    .map(([cluster, value]) => `
      <tr>
        <td>${normalizeText(cluster)}</td>
        <td>${formatPercent(value.weight)}</td>
        <td>${value.features.map((item) => normalizeText(item)).join(", ")}</td>
      </tr>
    `)
    .join("");

  dom.methodologyContent.innerHTML = `
    <section class="card">
      <div class="card-header">
        <h2>Academic framing</h2>
        <p>This interface is designed as a spatial analysis communication tool for thesis review, with methodological transparency prioritised over product-style abstraction.</p>
      </div>
      <p class="helper-text">
        The frontend keeps expert-driven AHP scores, data-driven RF probabilities, and SHAP explanations visibly separate so the thesis committee can audit agreement and disagreement between the two ranking logics.
      </p>
    </section>

    <section class="method-grid">
      <article class="table-card">
        <div class="card-header">
          <h2>AHP configuration</h2>
          <p>Cluster weights and validity checks.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cluster</th>
              <th>Weight</th>
              <th>Features</th>
            </tr>
          </thead>
          <tbody>${clusterTableRows}</tbody>
        </table>
        <p class="table-note">AHP Consistency Ratio: <strong>${formatNullableNumber(ahpMethodology.consistency_ratio, 4)}</strong></p>
      </article>

      <article class="table-card">
        <div class="card-header">
          <h2>Random Forest validation</h2>
          <p>Reported methodology metadata and delivered model performance.</p>
        </div>
        <table>
          <tbody>
            <tr>
              <th>Validation AUC</th>
              <td>${formatNullableNumber(rfMethodology.validation_auc_reported, 3)}</td>
            </tr>
            <tr>
              <th>Phase 1 summary AUC</th>
              <td>${formatNumber(state.summary.model_performance?.rf_auc_validation)}</td>
            </tr>
            <tr>
              <th>CV mean AUC</th>
              <td>${formatNumber(state.summary.model_performance?.rf_cv_auc_mean)}</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>

    <section class="method-grid">
      <article class="table-card">
        <div class="card-header">
          <h2>AHP vs RF agreement</h2>
          <p>Cell-level agreement and feature-level disagreement.</p>
        </div>
        <table>
          <tbody>
            <tr>
              <th>Cell-level rho</th>
              <td>${formatNullableNumber(state.summary.model_performance?.spearman_ahp_rf_cell_level, 4)}</td>
            </tr>
            <tr>
              <th>Feature-level rho</th>
              <td>${formatNullableNumber(agreementMethodology.feature_level_rho, 2)}</td>
            </tr>
            <tr>
              <th>Interpretation</th>
              <td>Expert and model agree on where promising cells are, but not on why they are promising.</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="table-card">
        <div class="card-header">
          <h2>Data source credits</h2>
          <p>Credits required in the briefing.</p>
        </div>
        ${dataCredits.length > 0 ? `
          <ul class="credit-list">
            ${dataCredits.map((item) => `<li>${normalizeText(item)}</li>`).join("")}
          </ul>
        ` : `
          <p class="table-note">Loading...</p>
        `}
        <p class="table-note">GeoJSON coordinates and rendered hexagons remain in WGS84 as delivered.</p>
      </article>
    </section>

    <section class="method-grid">
      <article class="table-card">
        <div class="card-header">
          <h2>Tier-stability sensitivity table</h2>
          <p>Phase 2 placeholder.</p>
        </div>
        <div class="table-note">Detailed sensitivity analysis will be populated upon Phase 2 full-city delivery.</div>
      </article>

      <article class="table-card">
        <div class="card-header">
          <h2>AHP vs SHAP comparison table</h2>
          <p>Phase 2 placeholder.</p>
        </div>
        <div class="table-note">Feature-level alignment metrics pending Phase 2 validation.</div>
      </article>
    </section>
  `;
}

function toggleMethodology(show) {
  dom.methodologyModal.classList.toggle("hidden", !show);
}

function parseTopFactors(value) {
  return normalizeText(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const symbol = part[0] || "";
      const direction = symbol === "\u2193" ? "negative" : "positive";
      return {
        symbol,
        direction,
        label: part.slice(1).trim(),
      };
    });
}

function prettifyFeatureName(column) {
  return normalizeText(column.replace(/^shap_/, "").replaceAll("_", " "));
}

function normalizeRange(value, min, max) {
  const numeric = Number(value || 0);
  const denominator = Number(max) - Number(min);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return ((numeric - Number(min)) / denominator) * 100;
}

function formatNumber(value, digits = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "N/A";
  }
  return numeric.toFixed(digits);
}

function formatNullableNumber(value, digits = 4, fallback = "Loading...") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return numeric.toFixed(digits);
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function getValidationNote(properties) {
  const potentialKeys = [
    "validation_note",
    "validation_set_note",
    "in_validation_set",
    "is_validation_set",
    "validation_set",
    "validation",
  ];

  for (const key of potentialKeys) {
    if (key in properties) {
      const raw = properties[key];
      if (typeof raw === "boolean") {
        return raw ? "Cell is in validation set" : "Cell not flagged as validation";
      }
      if (raw === 1) {
        return "Cell is in validation set";
      }
      if (raw === 0) {
        return "Cell not flagged as validation";
      }
      return normalizeText(String(raw));
    }
  }

  return "Not supplied in Phase 1 handoff";
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0)));
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const looksBroken = /Ã|Â|â/.test(value);
    const looksBetter = !/Ã|Â|â/.test(repaired) && repaired.length > 0;
    return looksBroken && looksBetter ? repaired : value;
  } catch {
    return value;
  }
}

function renderFatalError(message) {
  dom.datasetSummary.textContent = message;
  dom.detailsPanel.innerHTML = `
    <div class="error-card">
      <h3>Application error</h3>
      <p class="helper-text">${message}</p>
      <p class="helper-text">Open the app through <code>http://localhost:8000</code> and make sure external CDN scripts are reachable.</p>
    </div>
  `;
}

function getTierEntries() {
  const tierCounts = state.summary?.suitability_tiers || {};
  const tierColours = state.summary?.colour_ramp?.tier_colours || {};
  const tierNames = Object.keys(tierColours).length > 0
    ? Object.keys(tierColours)
    : Object.keys(tierCounts).filter((key) => typeof tierCounts[key] === "number");

  return tierNames.map((name) => ({
    name,
    color: tierColours[name] || "#cccccc",
    count: tierCounts[name] || 0,
  }));
}
