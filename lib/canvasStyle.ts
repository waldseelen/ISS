import type { StyleSpecification } from 'maplibre-gl';
import type { BaseStyle } from '@/types';

/* ─────────────────────────────────────────────────────────────
   Birleşik Motor (EarthCanvas) — Altlık Harita Stilleri

   Tek MapLibre GL motoru hem küre (globe) hem düz (mercator)
   projeksiyonunu kullanır. Altlıklar 2D ve 3D'de TUTARLI olması
   için raster tile kaynaklarıyla tanımlanır (eski üç-özdeş-URL
   ölü kodu kaldırıldı):
     • satellite → Esri World Imagery
     • street    → OpenStreetMap
     • topo      → OpenTopoMap
   NASA GIBS / gece ışıkları / meteoroloji katmanları overlay
   olarak deck.gl üzerinden her iki projeksiyonda da eklenir.
   ───────────────────────────────────────────────────────────── */

interface BaseDef {
    tiles: string[];
    attribution: string;
    maxzoom: number;
}

const BASE_DEFS: Record<BaseStyle, BaseDef> = {
    satellite: {
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Tiles © Esri — World Imagery',
        maxzoom: 19,
    },
    street: {
        tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        attribution: '© OpenStreetMap katkıda bulunanlar',
        maxzoom: 19,
    },
    topo: {
        tiles: [
            'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
        ],
        attribution: '© OpenTopoMap (CC-BY-SA)',
        maxzoom: 17,
    },
};

/* Küre kenarındaki uzay boşluğu / atmosfer rengi. */
const SPACE_COLOR = '#04060a';

export function buildBaseStyle(baseStyle: BaseStyle): StyleSpecification {
    const def = BASE_DEFS[baseStyle] ?? BASE_DEFS.satellite;
    return {
        version: 8,
        // Küre projeksiyonunda arka plan (uzay) ve hafif atmosfer
        sky: {
            'sky-color': SPACE_COLOR,
            'sky-horizon-blend': 0.5,
            'horizon-color': '#0a1420',
            'horizon-fog-blend': 0.5,
            'fog-color': '#0a1a2a',
            'fog-ground-blend': 0.4,
        },
        sources: {
            'base-raster': {
                type: 'raster',
                tiles: def.tiles,
                tileSize: 256,
                maxzoom: def.maxzoom,
                attribution: def.attribution,
            },
        },
        layers: [
            { id: 'space-bg', type: 'background', paint: { 'background-color': SPACE_COLOR } },
            {
                id: 'base-raster-layer',
                type: 'raster',
                source: 'base-raster',
                paint: { 'raster-fade-duration': 200 },
            },
        ],
    };
}
