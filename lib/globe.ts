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
            uTime: { value: 0.0 },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vUv = uv;
                vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 uSunDir;
            uniform sampler2D uCityLights;
            uniform float uHasCityLights;
            uniform float uTime;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec3 vWorldPos;

            void main() {
                // Longitude-based sun angle (per-pixel)
                vec3 worldNorm = normalize(vWorldPos);
                float d = dot(worldNorm, normalize(uSunDir));

                // Night: smooth from terminator at d=0 to full night
                // Twilight zone: -0.15 to 0.1 (civil/nautical twilight)
                float night = smoothstep(0.1, -0.15, d);

                // Twilight color: warm orange-pink horizon
                float twilight = smoothstep(-0.15, 0.0, d) * smoothstep(0.12, 0.0, d);
                vec3 twilightColor = mix(
                    vec3(0.05, 0.1, 0.3),    // deep blue
                    vec3(0.9, 0.4, 0.15),     // warm orange
                    twilight
                ) * twilight * 0.4;

                // City lights with subtle twinkle
                vec3 lights = vec3(0.0);
                if (uHasCityLights > 0.5) {
                    vec3 lightTex = texture2D(uCityLights, vUv).rgb;
                    float brightness = (lightTex.r + lightTex.g + lightTex.b) / 3.0;
                    float twinkle = 1.0 + 0.06 * sin(uTime * 2.0 + vUv.x * 100.0) * sin(uTime * 1.5 + vUv.y * 80.0);
                    float glow = pow(brightness, 0.75) * 1.4 * twinkle;
                    lights = vec3(1.0, 0.85, 0.5) * glow * night;
                }

                vec3 color = lights + twilightColor;
                float lightAlpha = clamp(length(lights) * 0.22, 0.0, 0.35);
                float alpha = clamp(night * 0.5 + lightAlpha, 0.0, 0.58);
                gl_FragColor = vec4(color, alpha);
            }
        `,
    });
}

/* ─── Atmosphere Glow Shader (enhanced blue-cyan gradient) ─── */
export function buildAtmosphereMesh(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(EARTH_RADIUS * 1.018, 64, 64);
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
                float rim = 1.0 - dot(vNormal, viewDir);
                float intensity = pow(max(rim, 0.0), 5.0);
                vec3 innerColor = vec3(0.03, 0.22, 0.62);
                vec3 outerColor = vec3(0.09, 0.45, 0.9);
                vec3 col = mix(innerColor, outerColor, pow(rim, 2.0));
                gl_FragColor = vec4(col, intensity * 0.22);
            }
        `,
    });
    return new THREE.Mesh(geo, mat);
}

/* ─── Cloud Layer with NASA cloud texture ─── */
export function buildCloudMesh(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(EARTH_RADIUS * 1.006, 64, 64);
    const mat = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        color: 0xffffff,
    });

    const loader = new THREE.TextureLoader();
    loader.load(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Clouds_Nasa.jpg/1280px-Clouds_Nasa.jpg',
        (tex: THREE.Texture) => {
            mat.alphaMap = tex;
            mat.map = tex;
            mat.opacity = 0.4;
            mat.needsUpdate = true;
        },
        undefined,
        () => {
            mat.opacity = 0.15;
            mat.needsUpdate = true;
        }
    );

    return new THREE.Mesh(geo, mat);
}

/* ─── Star Field with varying sizes/colors ─── */
export function buildStarField(count: number = 4500): THREE.Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const r = 300 + Math.random() * 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        const temp = Math.random();
        if (temp < 0.3) {
            colors[i * 3] = 0.7 + Math.random() * 0.3;
            colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
            colors[i * 3 + 2] = 1.0;
        } else if (temp < 0.6) {
            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 0.95;
            colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
        } else {
            colors[i * 3] = 0.95 + Math.random() * 0.05;
            colors[i * 3 + 1] = 0.95 + Math.random() * 0.05;
            colors[i * 3 + 2] = 0.95 + Math.random() * 0.05;
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
}

/* ─── ISS 3D Model (enhanced with emissive glow) ─── */
export function buildISSModel(): THREE.Group {
    const group = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, emissive: 0x333333, shininess: 60 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.z = Math.PI / 2;
    group.add(body);

    const panelGeo = new THREE.BoxGeometry(0.02, 0.5, 0.18);
    const panelMat = new THREE.MeshPhongMaterial({ color: 0x1a4a7c, emissive: 0x0a2a4c, shininess: 90, specular: new THREE.Color(0x4488aa) });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.set(-0.1, 0, 0);
    group.add(leftPanel);
    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.set(0.1, 0, 0);
    group.add(rightPanel);

    const moduleGeo = new THREE.BoxGeometry(0.06, 0.06, 0.08);
    const moduleMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, emissive: 0x222222 });
    const centerModule = new THREE.Mesh(moduleGeo, moduleMat);
    group.add(centerModule);

    const beaconGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 0.04, 0);
    beacon.name = 'issBeacon';
    group.add(beacon);

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
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 });
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
        opacity: 0.14,
        dashSize: 0.08,
        gapSize: 0.12,
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

/* ─── Wind Particle System (animated per-frame) ─── */
export function buildWindParticles(count: number = 2000): {
    points: THREE.Points;
    setWindData: (windData: { lat: number; lon: number; speed: number; direction: number }[]) => void;
    tick: () => void;
} {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities: { lat: number; lon: number; speed: number; dir: number }[] = [];
    let currentWindData: { lat: number; lon: number; speed: number; direction: number }[] = [];

    for (let i = 0; i < count; i++) {
        const lat = (Math.random() - 0.5) * 170;
        const lon = (Math.random() - 0.5) * 360;
        const v = latLonToVector3(lat, lon, EARTH_RADIUS * 1.012);
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
        colors[i * 3] = 0.3;
        colors[i * 3 + 1] = 0.6;
        colors[i * 3 + 2] = 1.0;
        velocities.push({ lat, lon, speed: 3 + Math.random() * 10, dir: Math.random() * 360 });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.025,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);

    const setWindData = (windData: { lat: number; lon: number; speed: number; direction: number }[]) => {
        currentWindData = windData;
    };

    const tick = () => {
        if (currentWindData.length === 0) return;
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
        const posArr = posAttr.array as Float32Array;
        const colArr = colAttr.array as Float32Array;

        for (let i = 0; i < count; i++) {
            const v = velocities[i];
            let nearest = currentWindData[0];
            let minDist = Infinity;
            for (const w of currentWindData) {
                const d = (v.lat - w.lat) ** 2 + (v.lon - w.lon) ** 2;
                if (d < minDist) { minDist = d; nearest = w; }
            }
            if (nearest) {
                v.speed += (nearest.speed - v.speed) * 0.02;
                v.dir += ((nearest.direction - v.dir + 540) % 360 - 180) * 0.02;
            }
            const step = v.speed * 0.001;
            v.lat += Math.cos(v.dir * DEG) * step;
            v.lon += Math.sin(v.dir * DEG) * step;

            if (v.lat > 85) { v.lat = -85 + Math.random() * 5; v.lon = (Math.random() - 0.5) * 360; }
            if (v.lat < -85) { v.lat = 85 - Math.random() * 5; v.lon = (Math.random() - 0.5) * 360; }
            v.lon = ((v.lon + 180) % 360) - 180;

            const pos = latLonToVector3(v.lat, v.lon, EARTH_RADIUS * 1.012);
            posArr[i * 3] = pos.x;
            posArr[i * 3 + 1] = pos.y;
            posArr[i * 3 + 2] = pos.z;

            const t = Math.min(v.speed / 50, 1);
            if (t < 0.25) {
                colArr[i * 3] = 0.2; colArr[i * 3 + 1] = 0.4 + t * 2; colArr[i * 3 + 2] = 1.0;
            } else if (t < 0.5) {
                colArr[i * 3] = (t - 0.25) * 4; colArr[i * 3 + 1] = 1.0; colArr[i * 3 + 2] = 1.0 - (t - 0.25) * 4;
            } else if (t < 0.75) {
                colArr[i * 3] = 1.0; colArr[i * 3 + 1] = 1.0 - (t - 0.5) * 4; colArr[i * 3 + 2] = 0.0;
            } else {
                colArr[i * 3] = 1.0; colArr[i * 3 + 1] = 0.0; colArr[i * 3 + 2] = 0.0;
            }
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
    };

    return { points, setWindData, tick };
}

/* ─── Weather Marker (pin with glow + pulse ring) ─── */
export function buildWeatherMarker(lat: number, lon: number): THREE.Group {
    const group = new THREE.Group();
    const pos = latLonToVector3(lat, lon, EARTH_RADIUS * 1.02);

    const geo = new THREE.SphereGeometry(0.035, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    group.add(mesh);

    const ringGeo = new THREE.RingGeometry(0.04, 0.052, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.lookAt(0, 0, 0);
    ring.name = 'markerRing';
    group.add(ring);

    // Pulse circle (expanding ring)
    const pulseGeo = new THREE.RingGeometry(0.04, 0.044, 32);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.position.copy(pos);
    pulse.lookAt(0, 0, 0);
    pulse.name = 'markerPulse';
    group.add(pulse);

    return group;
}

/* ─── Lightning Flash Effect Builder ─── */
export interface LightningState {
    meshes: THREE.Mesh[];
    tick: (time: number) => void;
    dispose: () => void;
}

export function buildLightningSystem(scene: THREE.Scene): LightningState {
    const flashGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const meshes: THREE.Mesh[] = [];

    // Pre-create 3 flash spheres scattered around earth
    for (let i = 0; i < 3; i++) {
        const lat = (Math.random() - 0.5) * 120;
        const lon = (Math.random() - 0.5) * 360;
        const pos = latLonToVector3(lat, lon, EARTH_RADIUS * 1.015);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xeeeeff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(flashGeo, mat);
        mesh.position.copy(pos);
        mesh.visible = false;
        scene.add(mesh);
        meshes.push(mesh);
    }

    const tick = (time: number) => {
        for (let i = 0; i < meshes.length; i++) {
            const m = meshes[i];
            const mat = m.material as THREE.MeshBasicMaterial;
            // Each flash fires at different phases
            const phase = time * 1.5 + i * 2.3;
            const flash = Math.pow(Math.max(0, Math.sin(phase * 6.0)), 22);
            if (flash > 0.01) {
                m.visible = true;
                mat.opacity = flash * 0.55;
                m.scale.setScalar(1.0 + flash * 1.2);
            } else {
                m.visible = false;
            }
        }
    };

    const dispose = () => {
        for (const m of meshes) {
            scene.remove(m);
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
        }
    };

    return { meshes, tick, dispose };
}

/* ─── Storm Pulse System ─── */
export interface StormState {
    light: THREE.PointLight;
    tick: (time: number) => void;
    dispose: () => void;
}

export function buildStormSystem(scene: THREE.Scene): StormState {
    const light = new THREE.PointLight(0xff3333, 0, 30);
    light.position.set(0, EARTH_RADIUS * 1.3, 0);
    scene.add(light);

    const tick = (time: number) => {
        const pulse = Math.pow(Math.max(0, Math.sin(time * 3.0)), 8);
        light.intensity = pulse * 1.1;
        light.color.setHSL(0.0, 0.8, 0.3 + pulse * 0.4);
    };

    const dispose = () => {
        scene.remove(light);
    };

    return { light, tick, dispose };
}

