import * as THREE from 'three';

export const EARTH_RADIUS = 5;
const DEG = Math.PI / 180;

/* ─── Coordinate Conversions ─── */
export function latLonToVector3(lat: number, lon: number, radius: number = EARTH_RADIUS): THREE.Vector3 {
    const phi = (90 - lat) * DEG;
    const theta = (lon + 180) * DEG;
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
    );
}

export function vector3ToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
    const r = v.length();
    const lat = 90 - Math.acos(v.y / r) / DEG;
    const lon = -(Math.atan2(v.z, -v.x) / DEG) - 180;
    return { lat, lon: ((lon + 540) % 360) - 180 };
}

/* ─── Interpolation ─── */
export function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ─── Night Overlay Shader Material with City Lights ─── */
export function buildTerminatorMaterial(sunDir: THREE.Vector3, cityLightsTex: THREE.Texture | null): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            uSunDir: { value: sunDir.clone().normalize() },
            uCityLights: { value: cityLightsTex },
            uHasCityLights: { value: cityLightsTex ? 1.0 : 0.0 },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec2 vUv;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 uSunDir;
            uniform sampler2D uCityLights;
            uniform float uHasCityLights;
            varying vec3 vNormal;
            varying vec2 vUv;
            void main() {
                float d = dot(vNormal, uSunDir);
                float night = smoothstep(-0.1, 0.15, -d);

                // City lights on night side
                vec3 lights = vec3(0.0);
                if (uHasCityLights > 0.5) {
                    vec3 lightTex = texture2D(uCityLights, vUv).rgb;
                    float brightness = (lightTex.r + lightTex.g + lightTex.b) / 3.0;
                    // Amplify light clusters to look like real city lights from space
                    float glow = pow(brightness, 0.6) * 2.5;
                    // Warm orange-yellow city light color
                    lights = vec3(1.0, 0.85, 0.5) * glow * night;
                }

                // Dark overlay + city lights
                vec3 color = lights;
                float alpha = night * 0.6 - length(lights) * 0.3;
                alpha = clamp(alpha, 0.0, 0.6);

                gl_FragColor = vec4(color, alpha + length(lights) * 0.8);
            }
        `,
    });
}

/* ─── Atmosphere Glow Shader (subtle, no thick ring) ─── */
export function buildAtmosphereMesh(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(EARTH_RADIUS * 1.025, 64, 64);
    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vec3 viewDir = normalize(-vPosition);
                float intensity = pow(0.65 - dot(vNormal, viewDir), 4.0);
                gl_FragColor = vec4(0.3, 0.6, 1.0, intensity * 0.35);
            }
        `,
    });
    return new THREE.Mesh(geo, mat);
}

/* ─── Cloud Layer ─── */
export function buildCloudMesh(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 64, 64);
    const mat = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        color: 0xffffff,
    });
    return new THREE.Mesh(geo, mat);
}

/* ─── Star Field ─── */
export function buildStarField(count: number = 6000): THREE.Points {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r = 400 + Math.random() * 200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.8,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
    });
    return new THREE.Points(geo, mat);
}

/* ─── ISS 3D Model (simple geometry) ─── */
export function buildISSModel(): THREE.Group {
    const group = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, emissive: 0x222222 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.z = Math.PI / 2;
    group.add(body);
    const panelGeo = new THREE.BoxGeometry(0.02, 0.4, 0.15);
    const panelMat = new THREE.MeshPhongMaterial({ color: 0x1a3a5c, emissive: 0x0a1a2c });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.set(-0.08, 0, 0);
    group.add(leftPanel);
    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.set(0.08, 0, 0);
    group.add(rightPanel);
    return group;
}

/* ─── Trail Line (for ISS orbit) ─── */
export function buildTrailLine(color: number = 0x00e5ff, maxPoints: number = 200): {
    line: THREE.Line;
    update: (points: THREE.Vector3[]) => void;
} {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
    const line = new THREE.Line(geo, mat);
    const update = (points: THREE.Vector3[]) => {
        const attr = geo.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const len = Math.min(points.length, maxPoints);
        for (let i = 0; i < len; i++) {
            arr[i * 3] = points[i].x;
            arr[i * 3 + 1] = points[i].y;
            arr[i * 3 + 2] = points[i].z;
        }
        attr.needsUpdate = true;
        geo.setDrawRange(0, len);
    };
    return { line, update };
}

/* ─── Predicted Orbit (dashed) ─── */
export function buildPredictionLine(color: number = 0x00e5ff): {
    line: THREE.Line;
    update: (points: THREE.Vector3[]) => void;
} {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(360 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        dashSize: 0.15,
        gapSize: 0.1,
    });
    const line = new THREE.Line(geo, mat);
    const update = (points: THREE.Vector3[]) => {
        const attr = geo.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const len = Math.min(points.length, 360);
        for (let i = 0; i < len; i++) {
            arr[i * 3] = points[i].x;
            arr[i * 3 + 1] = points[i].y;
            arr[i * 3 + 2] = points[i].z;
        }
        attr.needsUpdate = true;
        geo.setDrawRange(0, len);
        line.computeLineDistances();
    };
    return { line, update };
}

/* ─── Wind Particle System ─── */
export function buildWindParticles(count: number = 2000): {
    points: THREE.Points;
    update: (windData: { lat: number; lon: number; speed: number; direction: number }[]) => void;
} {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities: { lat: number; lon: number; speed: number; dir: number }[] = [];

    for (let i = 0; i < count; i++) {
        const lat = (Math.random() - 0.5) * 180;
        const lon = (Math.random() - 0.5) * 360;
        const v = latLonToVector3(lat, lon, EARTH_RADIUS * 1.01);
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
        colors[i * 3] = 0.2;
        colors[i * 3 + 1] = 0.5;
        colors[i * 3 + 2] = 1.0;
        velocities.push({ lat, lon, speed: 5, dir: Math.random() * 360 });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.03,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);

    const update = (windData: { lat: number; lon: number; speed: number; direction: number }[]) => {
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
        const posArr = posAttr.array as Float32Array;
        const colArr = colAttr.array as Float32Array;

        for (let i = 0; i < count; i++) {
            const v = velocities[i];
            let nearest = windData[0];
            let minDist = Infinity;
            for (const w of windData) {
                const d = Math.pow(v.lat - w.lat, 2) + Math.pow(v.lon - w.lon, 2);
                if (d < minDist) { minDist = d; nearest = w; }
            }
            if (nearest) {
                v.speed = nearest.speed;
                v.dir = nearest.direction;
            }
            const step = v.speed * 0.0005;
            v.lat += Math.cos(v.dir * DEG) * step;
            v.lon += Math.sin(v.dir * DEG) * step;
            if (v.lat > 85) v.lat = -85;
            if (v.lat < -85) v.lat = 85;
            v.lon = ((v.lon + 180) % 360) - 180;
            const pos = latLonToVector3(v.lat, v.lon, EARTH_RADIUS * 1.01);
            posArr[i * 3] = pos.x;
            posArr[i * 3 + 1] = pos.y;
            posArr[i * 3 + 2] = pos.z;
            const t = Math.min(v.speed / 40, 1);
            colArr[i * 3] = t;
            colArr[i * 3 + 1] = 0.3 * (1 - t);
            colArr[i * 3 + 2] = 1 - t;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
    };

    return { points, update };
}

/* ─── Weather Marker (pin) ─── */
export function buildWeatherMarker(lat: number, lon: number): THREE.Mesh {
    const pos = latLonToVector3(lat, lon, EARTH_RADIUS * 1.02);
    const geo = new THREE.SphereGeometry(0.03, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    return mesh;
}
