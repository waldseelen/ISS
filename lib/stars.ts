import * as THREE from 'three';

const DEG = Math.PI / 180;

/* ════════════════════════════════════════
   Constellation line data — simplified
   [RA_hours, Dec_deg] pairs per constellation
   ════════════════════════════════════════ */

interface StarData {
    name: string;
    ra: number;   // right ascension (degrees)
    dec: number;  // declination (degrees)
    mag: number;  // apparent magnitude
}

// 40 brightest stars
const BRIGHT_STARS: StarData[] = [
    { name: 'Sirius', ra: 101.28, dec: -16.72, mag: -1.46 },
    { name: 'Canopus', ra: 95.99, dec: -52.70, mag: -0.74 },
    { name: 'Arcturus', ra: 213.92, dec: 19.18, mag: -0.05 },
    { name: 'Vega', ra: 279.23, dec: 38.78, mag: 0.03 },
    { name: 'Capella', ra: 79.17, dec: 46.00, mag: 0.08 },
    { name: 'Rigel', ra: 78.63, dec: -8.20, mag: 0.13 },
    { name: 'Procyon', ra: 114.83, dec: 5.22, mag: 0.34 },
    { name: 'Betelgeuse', ra: 88.79, dec: 7.41, mag: 0.42 },
    { name: 'Achernar', ra: 24.43, dec: -57.24, mag: 0.46 },
    { name: 'Hadar', ra: 210.96, dec: -60.37, mag: 0.61 },
    { name: 'Altair', ra: 297.70, dec: 8.87, mag: 0.77 },
    { name: 'Acrux', ra: 186.65, dec: -63.10, mag: 0.77 },
    { name: 'Aldebaran', ra: 68.98, dec: 16.51, mag: 0.85 },
    { name: 'Spica', ra: 201.30, dec: -11.16, mag: 0.97 },
    { name: 'Antares', ra: 247.35, dec: -26.43, mag: 1.09 },
    { name: 'Pollux', ra: 116.33, dec: 28.03, mag: 1.14 },
    { name: 'Fomalhaut', ra: 344.41, dec: -29.62, mag: 1.16 },
    { name: 'Deneb', ra: 310.36, dec: 45.28, mag: 1.25 },
    { name: 'Mimosa', ra: 191.93, dec: -59.69, mag: 1.25 },
    { name: 'Regulus', ra: 152.09, dec: 11.97, mag: 1.35 },
    { name: 'Castor', ra: 113.65, dec: 31.89, mag: 1.58 },
    { name: 'Gacrux', ra: 187.79, dec: -57.11, mag: 1.63 },
    { name: 'Bellatrix', ra: 81.28, dec: 6.35, mag: 1.64 },
    { name: 'Alnath', ra: 81.57, dec: 28.61, mag: 1.65 },
    { name: 'Alnilam', ra: 84.05, dec: -1.20, mag: 1.69 },
    { name: 'Alnitak', ra: 85.19, dec: -1.94, mag: 1.77 },
    { name: 'Mintaka', ra: 83.00, dec: -0.30, mag: 2.23 },
    { name: 'Saiph', ra: 86.94, dec: -9.67, mag: 2.09 },
    { name: 'Dubhe', ra: 165.93, dec: 61.75, mag: 1.79 },
    { name: 'Merak', ra: 165.46, dec: 56.38, mag: 2.37 },
    { name: 'Phecda', ra: 178.46, dec: 53.69, mag: 2.44 },
    { name: 'Megrez', ra: 183.86, dec: 57.03, mag: 3.31 },
    { name: 'Alioth', ra: 193.51, dec: 55.96, mag: 1.77 },
    { name: 'Mizar', ra: 200.98, dec: 54.93, mag: 2.27 },
    { name: 'Alkaid', ra: 206.89, dec: 49.31, mag: 1.86 },
    { name: 'Polaris', ra: 37.95, dec: 89.26, mag: 1.98 },
    { name: 'Schedar', ra: 10.13, dec: 56.54, mag: 2.23 },
    { name: 'Caph', ra: 2.29, dec: 59.15, mag: 2.27 },
    { name: 'Navi', ra: 14.18, dec: 60.72, mag: 2.47 },
    { name: 'Ruchbah', ra: 21.45, dec: 60.24, mag: 2.68 },
];

// Constellation lines: pairs of star name indices
interface ConstellationDef {
    name: string;
    stars: string[]; // ordered star names forming connected lines
}

const CONSTELLATIONS: ConstellationDef[] = [
    // Orion
    { name: 'Orion', stars: ['Betelgeuse', 'Bellatrix', 'Mintaka', 'Alnilam', 'Alnitak', 'Saiph', 'Rigel', 'Mintaka'] },
    // Ursa Major (Big Dipper)
    { name: 'Ursa Major', stars: ['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Megrez'] },
    // Cassiopeia
    { name: 'Cassiopeia', stars: ['Schedar', 'Caph', 'Navi', 'Ruchbah', 'Schedar'] },
];

function raDecTo3D(ra: number, dec: number, r: number): THREE.Vector3 {
    const phi = (90 - dec) * DEG;
    const theta = ra * DEG;
    return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
    );
}

const STAR_SPHERE_RADIUS = 350;

/**
 * Build a group of bright star sprites with billboard labels.
 * Returns a THREE.Group with named children.
 */
export function buildBrightStars(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'brightStarsGroup';

    const spriteMat = new THREE.SpriteMaterial({
        color: 0xffffff,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
    });

    for (const s of BRIGHT_STARS) {
        const pos = raDecTo3D(s.ra, s.dec, STAR_SPHERE_RADIUS);

        // Star sprite — size based on magnitude (brighter → bigger)
        const size = Math.max(1.5, (3.0 - s.mag) * 1.6);
        const sprite = new THREE.Sprite(spriteMat.clone());
        sprite.position.copy(pos);
        sprite.scale.setScalar(size);
        sprite.name = s.name;
        (sprite.material as THREE.SpriteMaterial).opacity = Math.min(0.55, (3.0 - s.mag) / 4.5);
        group.add(sprite);
    }

    return group;
}

/**
 * Build constellation lines.
 * Returns a THREE.Group containing THREE.Line objects.
 */
export function buildConstellationLines(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'constellationGroup';

    const starMap = new Map<string, StarData>();
    for (const s of BRIGHT_STARS) starMap.set(s.name, s);

    for (const c of CONSTELLATIONS) {
        const points: THREE.Vector3[] = [];
        for (const name of c.stars) {
            const s = starMap.get(name);
            if (s) points.push(raDecTo3D(s.ra, s.dec, STAR_SPHERE_RADIUS));
        }
        if (points.length < 2) continue;

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0x2f5a78,
            transparent: true,
            opacity: 0.1,
            depthWrite: false,
        });
        const line = new THREE.Line(geo, mat);
        line.name = c.name;
        group.add(line);
    }

    return group;
}
