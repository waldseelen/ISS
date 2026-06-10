import type { BaseStyle } from '@/types';

const STYLE_URLS: Record<BaseStyle, string> = {
    satellite: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    street: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    topo: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

const ESRI_SATELLITE: Record<string, string> = {
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    street: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    topo: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
};

export const AUTO_SWITCH_GLOBE_MIN_ZOOM = 5.5;
export const AUTO_SWITCH_MAP_MAX_ZOOM = 3.5;

export function get2DStyleUrl(style: BaseStyle): string {
    return STYLE_URLS[style];
}

export function get3DSourceUrl(style: BaseStyle): string {
    return ESRI_SATELLITE[style];
}
