/**
 * ============================================
 * GeoMonitor — Main Application Engine
 * ============================================
 * Initializes MapLibre GL JS with:
 *   - Hybrid base maps (CARTO Dark / ESRI Satellite / OSM Streets)
 *   - 3D Terrain (Mapzen Terrarium DEM)
 *   - Day/Night terminator (SunCalc)
 *   - Aircraft markers (OpenSky real-time)
 *   - NDVI vegetation layer (NASA GIBS)
 *   - Precipitation overlay (NASA GIBS)
 *   - Cloud cover overlay (NASA GIBS)
 *   - Air quality stations (OpenAQ)
 *   - Interactive weather info on click
 *   - Location search with fly-to
 *   - PNG/CSV export
 */

import * as API from './api_handler.js';
import * as Utils from './utils.js';

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
    defaultCenter: [35, 39],       // Turkey
    defaultZoom: 3,
    aircraftRefreshMs: 30000,      // 30 seconds
    terminatorRefreshMs: 60000,    // 1 minute
    maxAircraftZoom: 7,            // Min zoom to load aircraft
};

// =============================================
// MAP STYLE FACTORIES
// =============================================

function createStyle(type = 'dark') {
    const sources = {};
    const layers = [];

    switch (type) {
        case 'satellite':
            sources['esri-satellite'] = {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                attribution: '© Esri',
                maxzoom: 19,
            };
            layers.push({
                id: 'base-satellite',
                type: 'raster',
                source: 'esri-satellite',
            });
            break;

        case 'streets':
            sources['osm-raster'] = {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
                maxzoom: 19,
            };
            layers.push({
                id: 'base-streets',
                type: 'raster',
                source: 'osm-raster',
            });
            break;

        default: // dark
            sources['carto-dark'] = {
                type: 'raster',
                tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
                tileSize: 256,
                attribution: '© CARTO © OpenStreetMap',
                maxzoom: 20,
            };
            layers.push({
                id: 'base-dark',
                type: 'raster',
                source: 'carto-dark',
            });
    }

    return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources,
        layers,
    };
}

// =============================================
// APPLICATION STATE
// =============================================

const state = {
    layers: {
        daynight: true,
        weather: false,
        clouds: false,
        aircraft: false,
        ndvi: false,
        airquality: false,
    },
    currentBasemap: 'dark',
    terrainEnabled: false,
    terrainExaggeration: 1.5,
    selectedLocation: null,
    aircraftInterval: null,
    terminatorInterval: null,
    infoData: {},
};

// =============================================
// MAP INITIALIZATION
// =============================================

const map = new maplibregl.Map({
    container: 'map',
    style: createStyle('dark'),
    center: CONFIG.defaultCenter,
    zoom: CONFIG.defaultZoom,
    pitch: 0,
    bearing: 0,
    maxZoom: 18,
    minZoom: 2,
    preserveDrawingBuffer: true, // Required for PNG export
    attributionControl: false,
});

// Navigation controls (zoom/rotate)
map.addControl(new maplibregl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true,
}), 'top-right');

// Scale bar
map.addControl(new maplibregl.ScaleControl({
    maxWidth: 120,
    unit: 'metric',
}), 'bottom-right');

// =============================================
// MAP LOAD EVENT — Setup all layers & handlers
// =============================================

map.on('load', () => {
    hideLoader();
    initLucideIcons();
    setupDayNightLayer();
    setupWeatherLayer();
    setupCloudLayer();
    setupNDVILayer();
    setupAircraftLayer();
    setupAirQualityLayer();
    setupTerrainSource();
    bindUIEvents();
    startAutoRefresh();
    updateCoordsDisplay();

    Utils.showToast('Harita yüklendi — keşfetmeye başlayın!', 'success');
});

// =============================================
// LOADER
// =============================================

function hideLoader() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.remove(), 700);
    }
}

function initLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// =============================================
// DAY/NIGHT TERMINATOR LAYER
// =============================================

function setupDayNightLayer() {
    const geojson = Utils.computeTerminatorGeoJSON();

    map.addSource('daynight-source', {
        type: 'geojson',
        data: geojson,
    });

    map.addLayer({
        id: 'daynight-fill',
        type: 'fill',
        source: 'daynight-source',
        paint: {
            'fill-color': '#000022',
            'fill-opacity': 0.35,
        },
    });

    map.addLayer({
        id: 'daynight-line',
        type: 'line',
        source: 'daynight-source',
        paint: {
            'line-color': '#f59e0b',
            'line-width': 1.5,
            'line-opacity': 0.5,
            'line-dasharray': [4, 4],
        },
    });
}

function updateDayNightLayer() {
    const source = map.getSource('daynight-source');
    if (source) {
        source.setData(Utils.computeTerminatorGeoJSON());
    }
}

// =============================================
// WEATHER PRECIPITATION LAYER (NASA GIBS)
// =============================================

function setupWeatherLayer() {
    const gibsDate = Utils.getGIBSDate();

    map.addSource('precipitation-source', {
        type: 'raster',
        tiles: [
            `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${gibsDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        ],
        tileSize: 256,
        maxzoom: 6,
    });

    map.addLayer({
        id: 'precipitation-layer',
        type: 'raster',
        source: 'precipitation-source',
        paint: {
            'raster-opacity': 0.65,
        },
        layout: {
            visibility: 'none',
        },
    });
}

// =============================================
// CLOUD COVER LAYER (NASA GIBS)
// =============================================

function setupCloudLayer() {
    const gibsDate = Utils.getGIBSDate();

    map.addSource('clouds-source', {
        type: 'raster',
        tiles: [
            `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        ],
        tileSize: 256,
        maxzoom: 9,
    });

    map.addLayer({
        id: 'clouds-layer',
        type: 'raster',
        source: 'clouds-source',
        paint: {
            'raster-opacity': 0.5,
        },
        layout: {
            visibility: 'none',
        },
    });
}

// =============================================
// NDVI VEGETATION LAYER (NASA GIBS)
// =============================================

function setupNDVILayer() {
    const ndviDate = Utils.getNDVIDate();

    map.addSource('ndvi-source', {
        type: 'raster',
        tiles: [
            `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${ndviDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
        ],
        tileSize: 256,
        maxzoom: 9,
    });

    map.addLayer({
        id: 'ndvi-layer',
        type: 'raster',
        source: 'ndvi-source',
        paint: {
            'raster-opacity': 0.7,
        },
        layout: {
            visibility: 'none',
        },
    });
}

// =============================================
// AIRCRAFT LAYER (OpenSky)
// =============================================

function setupAircraftLayer() {
    // Add aircraft icon
    const iconData = Utils.createAircraftIcon('#06b6d4');
    map.addImage('aircraft-icon', iconData, { sdf: false });

    // Empty GeoJSON source
    map.addSource('aircraft-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
    });

    // Symbol layer with rotation
    map.addLayer({
        id: 'aircraft-layer',
        type: 'symbol',
        source: 'aircraft-source',
        layout: {
            'icon-image': 'aircraft-icon',
            'icon-size': 0.55,
            'icon-rotate': ['get', 'heading'],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            visibility: 'none',
        },
    });

    // Popup on click
    map.on('click', 'aircraft-layer', (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates;

        new maplibregl.Popup({ offset: 12, closeButton: true })
            .setLngLat(coords)
            .setHTML(`
                <div class="popup-title">✈️ ${p.callsign || 'N/A'}</div>
                <div class="popup-row"><span class="label">ICAO</span><span class="value">${p.icao24}</span></div>
                <div class="popup-row"><span class="label">Menşe</span><span class="value">${p.origin}</span></div>
                <div class="popup-row"><span class="label">Yükseklik</span><span class="value">${p.altitude != null ? p.altitude + ' m' : 'N/A'}</span></div>
                <div class="popup-row"><span class="label">Hız</span><span class="value">${p.velocity != null ? Utils.msToKmh(p.velocity) + ' km/h' : 'N/A'}</span></div>
                <div class="popup-row"><span class="label">Yön</span><span class="value">${Math.round(p.heading)}°</span></div>
            `)
            .addTo(map);
    });

    // Cursor change on hover
    map.on('mouseenter', 'aircraft-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'aircraft-layer', () => {
        map.getCanvas().style.cursor = 'crosshair';
    });
}

async function refreshAircraftData() {
    if (!state.layers.aircraft) return;
    if (map.getZoom() < CONFIG.maxAircraftZoom) return;

    try {
        const bounds = map.getBounds();
        const data = await API.fetchAircraft({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
        });

        if (data?.states) {
            const geojson = Utils.aircraftToGeoJSON(data.states);
            const source = map.getSource('aircraft-source');
            if (source) source.setData(geojson);

            Utils.showToast(`${geojson.features.length} uçak güncellendi`, 'info', 2000);
        }
    } catch (err) {
        console.warn('Aircraft fetch failed:', err.message);
    }
}

// =============================================
// AIR QUALITY LAYER (OpenAQ)
// =============================================

function setupAirQualityLayer() {
    map.addSource('airquality-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
        id: 'airquality-circles',
        type: 'circle',
        source: 'airquality-source',
        paint: {
            'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                4, 6,
                10, 14,
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.7,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.15)',
        },
        layout: {
            visibility: 'none',
        },
    });

    // AQ Labels
    map.addLayer({
        id: 'airquality-labels',
        type: 'symbol',
        source: 'airquality-source',
        layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-offset': [0, -1.5],
            'text-font': ['Open Sans Regular'],
            visibility: 'none',
        },
        paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.7)',
            'text-halo-width': 1,
        },
    });
}

async function refreshAirQualityData() {
    if (!state.layers.airquality) return;

    const center = map.getCenter();

    try {
        const data = await API.fetchAirQuality(center.lat, center.lng);
        if (!data?.results?.length) return;

        const features = data.results
            .filter((r) => r.coordinates?.latitude && r.coordinates?.longitude)
            .map((r) => {
                // Find PM2.5 value
                const pm25 = r.measurements?.find((m) =>
                    m.parameter === 'pm25' || m.parameter === 'pm10'
                );
                const value = pm25?.value ?? 0;
                const cat = Utils.getAQICategory(value);

                const colorMap = {
                    'aqi-good': '#22c55e',
                    'aqi-moderate': '#eab308',
                    'aqi-unhealthy': '#f97316',
                    'aqi-bad': '#ef4444',
                    'aqi-hazardous': '#8b5cf6',
                };

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [r.coordinates.longitude, r.coordinates.latitude],
                    },
                    properties: {
                        label: `${value.toFixed(0)} µg/m³`,
                        color: colorMap[cat.cls] ?? '#888',
                        category: cat.label,
                        location: r.location ?? '',
                    },
                };
            });

        const source = map.getSource('airquality-source');
        if (source) {
            source.setData({ type: 'FeatureCollection', features });
        }
    } catch (err) {
        console.warn('AQ fetch failed:', err.message);
    }
}

// =============================================
// 3D TERRAIN (Mapzen Terrarium DEM)
// =============================================

function setupTerrainSource() {
    map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
    });

    // Hillshade layer (subtle, always available)
    map.addLayer({
        id: 'hillshade-layer',
        type: 'hillshade',
        source: 'terrain-dem',
        paint: {
            'hillshade-illumination-direction': 315,
            'hillshade-exaggeration': 0.3,
            'hillshade-shadow-color': '#000000',
            'hillshade-highlight-color': '#ffffff',
        },
        layout: {
            visibility: 'none',
        },
    }, map.getStyle().layers[0]?.id); // Insert below base layer
}

function enableTerrain() {
    try {
        map.setTerrain({
            source: 'terrain-dem',
            exaggeration: state.terrainExaggeration,
        });
        map.setLayoutProperty('hillshade-layer', 'visibility', 'visible');
        if (map.getPitch() < 30) {
            map.easeTo({ pitch: 45, duration: 800 });
        }
    } catch (e) {
        console.warn('Terrain setup failed:', e);
        Utils.showToast('3D arazi yüklenemedi', 'warning');
    }
}

function disableTerrain() {
    try {
        map.setTerrain(null);
        map.setLayoutProperty('hillshade-layer', 'visibility', 'none');
        map.easeTo({ pitch: 0, duration: 600 });
    } catch (e) {
        console.warn('Terrain disable failed:', e);
    }
}

// =============================================
// LAYER TOGGLE SYSTEM
// =============================================

function toggleLayer(layerId, visible) {
    const layerMap = {
        daynight: ['daynight-fill', 'daynight-line'],
        weather: ['precipitation-layer'],
        clouds: ['clouds-layer'],
        aircraft: ['aircraft-layer'],
        ndvi: ['ndvi-layer'],
        airquality: ['airquality-circles', 'airquality-labels'],
    };

    const mapLayers = layerMap[layerId] ?? [];
    const visibility = visible ? 'visible' : 'none';

    for (const lid of mapLayers) {
        if (map.getLayer(lid)) {
            map.setLayoutProperty(lid, 'visibility', visibility);
        }
    }

    state.layers[layerId] = visible;

    // Trigger data refresh for data-driven layers
    if (visible) {
        if (layerId === 'aircraft') refreshAircraftData();
        if (layerId === 'airquality') refreshAirQualityData();
    }
}

// =============================================
// BASEMAP SWITCHER
// =============================================

function switchBasemap(type) {
    if (type === state.currentBasemap) return;

    // Store current state
    const center = map.getCenter();
    const zoom = map.getZoom();
    const pitch = map.getPitch();
    const bearing = map.getBearing();

    state.currentBasemap = type;
    map.setStyle(createStyle(type));

    // Re-add all layers after style change
    map.once('style.load', () => {
        setupDayNightLayer();
        setupWeatherLayer();
        setupCloudLayer();
        setupNDVILayer();
        setupAircraftLayer();
        setupAirQualityLayer();
        setupTerrainSource();

        // Restore layer visibility
        for (const [layerId, enabled] of Object.entries(state.layers)) {
            if (enabled) toggleLayer(layerId, true);
        }

        // Restore terrain
        if (state.terrainEnabled) {
            setTimeout(() => enableTerrain(), 500);
        }

        // Restore view
        map.jumpTo({ center, zoom, pitch, bearing });
    });
}

// =============================================
// MAP CLICK → FETCH LOCATION DATA
// =============================================

map.on('click', async (e) => {
    // Skip if click was on a feature layer (e.g., aircraft)
    const features = map.queryRenderedFeatures(e.point, {
        layers: ['aircraft-layer', 'airquality-circles'],
    });
    if (features.length > 0) return;

    const { lat, lng } = e.lngLat;
    state.selectedLocation = { lat, lon: lng };

    // Open info panel
    const infoPanel = document.getElementById('info-panel');
    infoPanel.classList.add('open');

    // Show loading state
    renderInfoLoading();

    try {
        // Fetch all data in parallel
        const [weatherData, elevationData, sunData, marineData, reverseData] =
            await Promise.allSettled([
                API.fetchWeather(lat, lng),
                API.fetchElevation(lat, lng),
                API.fetchSunTimes(lat, lng),
                API.fetchMarine(lat, lng),
                API.reverseGeocode(lat, lng),
            ]);

        const weather = weatherData.status === 'fulfilled' ? weatherData.value : null;
        const elevation = elevationData.status === 'fulfilled' ? elevationData.value : null;
        const sun = sunData.status === 'fulfilled' ? sunData.value : null;
        const marine = marineData.status === 'fulfilled' ? marineData.value : null;
        const reverse = reverseData.status === 'fulfilled' ? reverseData.value : null;

        // Store for CSV export
        state.infoData = { lat, lon: lng, weather, elevation, sun, marine, reverse };

        // Update location name
        const locationName = reverse?.display_name?.split(',').slice(0, 2).join(',') ??
            Utils.formatCoords(lat, lng);
        document.getElementById('info-location').textContent = locationName;

        // Render info panel
        renderInfoPanel(weather, elevation, sun, marine, lat, lng);

    } catch (err) {
        console.error('Data fetch error:', err);
        Utils.showToast('Veri alınamadı', 'error');
    }
});

// =============================================
// INFO PANEL RENDERERS
// =============================================

function renderInfoLoading() {
    const content = document.getElementById('info-content');
    content.innerHTML = `
        <div class="info-section">
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div class="skeleton" style="height:60px;"></div>
                <div class="skeleton" style="height:30px;width:70%;"></div>
                <div class="skeleton" style="height:30px;width:50%;"></div>
                <div class="skeleton" style="height:100px;"></div>
            </div>
        </div>
    `;
}

function renderInfoPanel(weather, elevation, sun, marine, lat, lon) {
    const content = document.getElementById('info-content');
    const current = weather?.current;
    const daily = weather?.daily;

    let html = '';

    // ─── Coordinates ───
    html += `
        <div class="info-section">
            <div class="info-section-title">📍 Koordinatlar</div>
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)">
                ${Utils.formatCoords(lat, lon)}
            </div>
        </div>
    `;

    // ─── Current Weather ───
    if (current) {
        const icon = Utils.getWeatherIcon(current.weather_code);
        const desc = Utils.getWeatherDescription(current.weather_code);

        html += `
            <div class="info-section">
                <div class="info-section-title">🌡️ Güncel Hava Durumu</div>
                <div class="info-grid">
                    <div class="info-card highlight">
                        <span class="weather-icon">${icon}</span>
                        <div class="weather-detail">
                            <div class="weather-temp">${Math.round(current.temperature_2m)}°</div>
                            <div class="weather-desc">${desc}</div>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Hissedilen</div>
                        <div class="info-card-value">${Math.round(current.apparent_temperature)}°<span class="info-card-unit">C</span></div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Nem</div>
                        <div class="info-card-value">${current.relative_humidity_2m}<span class="info-card-unit">%</span></div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Rüzgar</div>
                        <div class="info-card-value">${Utils.msToKmh(current.wind_speed_10m)}<span class="info-card-unit">km/h</span></div>
                        <div style="font-size:9px;color:var(--text-muted);margin-top:2px">${Utils.degToCompass(current.wind_direction_10m)} (${Math.round(current.wind_direction_10m)}°)</div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Basınç</div>
                        <div class="info-card-value">${Math.round(current.surface_pressure)}<span class="info-card-unit">hPa</span></div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Görüş</div>
                        <div class="info-card-value" style="font-size:14px">${Utils.formatVisibility(current.visibility)}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Yağış</div>
                        <div class="info-card-value">${current.precipitation}<span class="info-card-unit">mm</span></div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Bulutluluk</div>
                        <div class="info-card-value">${current.cloud_cover}<span class="info-card-unit">%</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    // ─── 7-Day Forecast ───
    if (daily?.time?.length) {
        const maxT = Math.max(...daily.temperature_2m_max);
        const minT = Math.min(...daily.temperature_2m_min);
        const range = maxT - minT || 1;

        html += `<div class="info-section">
            <div class="info-section-title">📅 7 Günlük Tahmin</div>`;

        for (let i = 0; i < daily.time.length; i++) {
            const dayName = i === 0 ? 'Bugün' : Utils.formatShortDay(daily.time[i]);
            const hi = Math.round(daily.temperature_2m_max[i]);
            const lo = Math.round(daily.temperature_2m_min[i]);
            const precip = daily.precipitation_sum[i];
            const fIcon = Utils.getWeatherIcon(daily.weather_code[i]);

            // Bar position (percentage)
            const barLeft = ((lo - minT) / range) * 100;
            const barWidth = ((hi - lo) / range) * 100;

            html += `
                <div class="forecast-row">
                    <span class="forecast-day">${dayName}</span>
                    <span class="forecast-icon">${fIcon}</span>
                    <div class="forecast-temp">
                        <span class="lo">${lo}°</span>
                        <div class="bar"><div class="bar-fill" style="left:${barLeft}%;width:${Math.max(barWidth, 4)}%"></div></div>
                        <span class="hi">${hi}°</span>
                    </div>
                    <span class="forecast-precip">${precip > 0 ? precip.toFixed(1) + 'mm' : ''}</span>
                </div>
            `;
        }
        html += `</div>`;
    }

    // ─── Elevation ───
    const elevValue = elevation?.results?.[0]?.elevation;
    if (elevValue != null) {
        html += `
            <div class="info-section">
                <div class="info-section-title">⛰️ Yükseklik</div>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-card-label">Deniz Seviyesi</div>
                        <div class="info-card-value">${Math.round(elevValue)}<span class="info-card-unit">m</span></div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Feet</div>
                        <div class="info-card-value">${Utils.metersToFeet(elevValue)}<span class="info-card-unit">ft</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    // ─── Solar Times ───
    if (sun?.results) {
        const sr = sun.results;
        html += `
            <div class="info-section">
                <div class="info-section-title">☀️ Güneş Bilgisi</div>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-card-label">Gündoğumu</div>
                        <div class="info-card-value" style="font-size:14px;color:#f59e0b">🌅 ${Utils.formatTime(sr.sunrise)}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Günbatımı</div>
                        <div class="info-card-value" style="font-size:14px;color:#f97316">🌇 ${Utils.formatTime(sr.sunset)}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Güneş Tepesi</div>
                        <div class="info-card-value" style="font-size:14px">☀️ ${Utils.formatTime(sr.solar_noon)}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Gün Uzunluğu</div>
                        <div class="info-card-value" style="font-size:14px">${formatDayLength(sr.sunrise, sr.sunset)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ─── Marine Data ───
    if (marine?.current) {
        const mc = marine.current;
        html += `
            <div class="info-section">
                <div class="info-section-title">🌊 Deniz Durumu</div>
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-card-label">Dalga Yük.</div>
                        <div class="info-card-value">${mc.wave_height}<span class="info-card-unit">m</span></div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-label">Dalga Periyodu</div>
                        <div class="info-card-value">${mc.wave_period}<span class="info-card-unit">s</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    content.innerHTML = html;
}

function formatDayLength(sunrise, sunset) {
    if (!sunrise || !sunset) return '—';
    const diff = new Date(sunset) - new Date(sunrise);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}sa ${minutes}dk`;
}

// =============================================
// SEARCH FUNCTIONALITY
// =============================================

function setupSearch() {
    const input = document.getElementById('search-input');
    const dropdown = document.getElementById('search-results');

    const debouncedSearch = Utils.debounce(async (query) => {
        if (query.length < 2) {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            return;
        }

        try {
            const results = await API.geocodeSearch(query);
            if (!results?.length) {
                dropdown.classList.remove('open');
                return;
            }

            dropdown.innerHTML = results.map((r, i) => `
                <div class="search-item" data-index="${i}"
                     data-lat="${r.lat}" data-lon="${r.lon}">
                    <span>📍 ${r.display_name.split(',').slice(0, 3).join(', ')}</span>
                    <span class="search-type">${r.type ?? ''}</span>
                </div>
            `).join('');

            dropdown.classList.add('open');

            // Bind click handlers
            dropdown.querySelectorAll('.search-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const lat = parseFloat(item.dataset.lat);
                    const lon = parseFloat(item.dataset.lon);
                    flyToLocation(lat, lon);
                    dropdown.classList.remove('open');
                    input.value = item.querySelector('span').textContent.replace('📍 ', '');
                });
            });
        } catch (err) {
            console.warn('Search error:', err);
        }
    }, 350);

    input.addEventListener('input', (e) => debouncedSearch(e.target.value.trim()));

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const firstItem = dropdown.querySelector('.search-item');
            if (firstItem) firstItem.click();
        }
        if (e.key === 'Escape') {
            dropdown.classList.remove('open');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            dropdown.classList.remove('open');
        }
    });
}

function flyToLocation(lat, lon, zoom = 10) {
    map.flyTo({
        center: [lon, lat],
        zoom,
        pitch: state.terrainEnabled ? 45 : 0,
        duration: 2000,
        essential: true,
    });

    // Add a temporary marker
    const marker = new maplibregl.Marker({ color: '#06b6d4' })
        .setLngLat([lon, lat])
        .addTo(map);

    // Remove after 8 seconds
    setTimeout(() => marker.remove(), 8000);
}

// =============================================
// EXPORT FUNCTIONS
// =============================================

function exportPNG() {
    try {
        const canvas = map.getCanvas();
        Utils.downloadPNG(canvas, `geomonitor-${Date.now()}.png`);
        Utils.showToast('Harita PNG olarak indirildi', 'success');
    } catch (err) {
        Utils.showToast('PNG dışa aktarma hatası', 'error');
        console.error(err);
    }
}

function exportCSV() {
    const loc = state.selectedLocation;
    if (!loc) {
        Utils.showToast('Önce haritaya tıklayarak bir konum seçin', 'warning');
        return;
    }

    const data = {};
    data['Enlem'] = loc.lat.toFixed(6);
    data['Boylam'] = loc.lon.toFixed(6);

    const w = state.infoData.weather?.current;
    if (w) {
        data['Sıcaklık (°C)'] = w.temperature_2m;
        data['Hissedilen (°C)'] = w.apparent_temperature;
        data['Nem (%)'] = w.relative_humidity_2m;
        data['Rüzgar (m/s)'] = w.wind_speed_10m;
        data['Rüzgar Yönü (°)'] = w.wind_direction_10m;
        data['Basınç (hPa)'] = w.surface_pressure;
        data['Görüş Mesafesi (m)'] = w.visibility;
        data['Yağış (mm)'] = w.precipitation;
        data['Bulutluluk (%)'] = w.cloud_cover;
        data['Hava Kodu (WMO)'] = w.weather_code;
    }

    const elev = state.infoData.elevation?.results?.[0]?.elevation;
    if (elev != null) data['Yükseklik (m)'] = elev;

    const sr = state.infoData.sun?.results;
    if (sr) {
        data['Gündoğumu'] = sr.sunrise;
        data['Günbatımı'] = sr.sunset;
        data['Güneş Tepesi'] = sr.solar_noon;
    }

    const mc = state.infoData.marine?.current;
    if (mc) {
        data['Dalga Yük. (m)'] = mc.wave_height;
        data['Dalga Periyodu (s)'] = mc.wave_period;
    }

    Utils.downloadCSV(data, `geomonitor-${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}.csv`);
    Utils.showToast('CSV verisi indirildi', 'success');
}

// =============================================
// COORDINATES & ZOOM DISPLAY
// =============================================

function updateCoordsDisplay() {
    map.on('mousemove', (e) => {
        const el = document.getElementById('cursor-coords');
        if (el) el.textContent = Utils.formatCoords(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('zoom', () => {
        const el = document.getElementById('zoom-level');
        if (el) el.textContent = `Yakınlık: ${map.getZoom().toFixed(1)}`;
    });

    map.on('rotate', () => {
        const el = document.getElementById('bearing-display');
        if (el) el.textContent = `Yön: ${Math.round(map.getBearing())}°`;
    });
}

// =============================================
// AUTO-REFRESH SYSTEM
// =============================================

function startAutoRefresh() {
    // Day/Night terminator update every minute
    state.terminatorInterval = setInterval(() => {
        if (state.layers.daynight) updateDayNightLayer();
    }, CONFIG.terminatorRefreshMs);

    // Aircraft update every 30 seconds
    state.aircraftInterval = setInterval(() => {
        if (state.layers.aircraft) refreshAircraftData();
    }, CONFIG.aircraftRefreshMs);

    // Update timestamp
    setInterval(() => {
        const el = document.getElementById('last-update');
        if (el) el.textContent = Utils.nowTimeString();
    }, 1000);
}

// =============================================
// UI EVENT BINDINGS
// =============================================

function bindUIEvents() {
    // ─── Sidebar toggle (mobile) ───
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        document.getElementById('control-panel')?.classList.toggle('open');
    });

    document.getElementById('sidebar-close')?.addEventListener('click', () => {
        document.getElementById('control-panel')?.classList.remove('open');
    });

    // ─── Info panel close ───
    document.getElementById('info-close')?.addEventListener('click', () => {
        document.getElementById('info-panel')?.classList.remove('open');
    });

    // ─── Layer toggles ───
    const layerIds = ['daynight', 'weather', 'clouds', 'aircraft', 'ndvi', 'airquality'];
    for (const id of layerIds) {
        const checkbox = document.getElementById(`layer-${id}`);
        checkbox?.addEventListener('change', (e) => {
            toggleLayer(id, e.target.checked);

            // Show zoom hint for aircraft
            if (id === 'aircraft' && e.target.checked && map.getZoom() < CONFIG.maxAircraftZoom) {
                Utils.showToast('Uçak verisi için yakınlaşın (zoom ≥ 7)', 'info');
            }
        });
    }

    // ─── Basemap buttons ───
    document.querySelectorAll('.basemap-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.basemap;
            document.querySelectorAll('.basemap-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            switchBasemap(type);
        });
    });

    // ─── 3D Terrain toggle ───
    const terrainToggle = document.getElementById('terrain-toggle');
    const terrainRange = document.getElementById('terrain-range-wrapper');
    const terrainSlider = document.getElementById('terrain-exaggeration');
    const terrainValue = document.getElementById('terrain-value');

    terrainToggle?.addEventListener('change', (e) => {
        state.terrainEnabled = e.target.checked;
        terrainRange?.classList.toggle('visible', e.target.checked);
        if (e.target.checked) {
            enableTerrain();
            Utils.showToast('3D arazi etkinleştirildi', 'info');
        } else {
            disableTerrain();
        }
    });

    terrainSlider?.addEventListener('input', (e) => {
        state.terrainExaggeration = parseFloat(e.target.value);
        if (terrainValue) terrainValue.textContent = `${state.terrainExaggeration}x`;
        if (state.terrainEnabled) {
            map.setTerrain({
                source: 'terrain-dem',
                exaggeration: state.terrainExaggeration,
            });
        }
    });

    // ─── Export buttons ───
    document.getElementById('export-png')?.addEventListener('click', exportPNG);
    document.getElementById('export-csv')?.addEventListener('click', exportCSV);

    // ─── Search ───
    setupSearch();

    // ─── Aircraft refresh on move (debounced) ───
    const debouncedAircraftRefresh = Utils.debounce(() => {
        if (state.layers.aircraft) refreshAircraftData();
    }, 2000);

    map.on('moveend', debouncedAircraftRefresh);

    // ─── AQ refresh on move ───
    const debouncedAQRefresh = Utils.debounce(() => {
        if (state.layers.airquality) refreshAirQualityData();
    }, 3000);

    map.on('moveend', debouncedAQRefresh);
}
