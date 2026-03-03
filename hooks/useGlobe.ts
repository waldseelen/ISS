'use client';

import {
    buildAtmosphereMesh,
    buildCloudMesh,
    buildISSModel,
    buildPredictionLine,
    buildStarField,
    buildTerminatorMaterial,
    buildTrailLine,
    buildWeatherMarker,
    buildWindParticles,
    EARTH_RADIUS,
    latLonToVector3,
} from '@/lib/globe';
import { TILES } from '@/lib/tiles';
import type { ISSData, ModuleState, SunPosition, WindPoint } from '@/types';
import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface GlobeAPI {
    mount: (container: HTMLDivElement) => void;
    unmount: () => void;
    updateSun: (pos: SunPosition) => void;
    updateISS: (data: ISSData | null, trail: { lat: number; lon: number }[], prediction: { lat: number; lon: number }[]) => void;
    updateWind: (data: WindPoint[]) => void;
    updateModules: (m: ModuleState) => void;
    flyTo: (lat: number, lon: number) => void;
    getCamera: () => THREE.PerspectiveCamera | null;
    getCameraDistance: () => number;
    addWeatherMarker: (lat: number, lon: number) => void;
    onCameraChange: (cb: (distance: number) => void) => void;
}

export function useGlobe(): GlobeAPI {
    const sceneRef = useRef<THREE.Scene>();
    const cameraRef = useRef<THREE.PerspectiveCamera>();
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const controlsRef = useRef<OrbitControls>();
    const frameRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>();

    const earthRef = useRef<THREE.Mesh>();
    const nightRef = useRef<THREE.Mesh>();
    const atmosphereRef = useRef<THREE.Mesh>();
    const cloudRef = useRef<THREE.Mesh>();
    const starsRef = useRef<THREE.Points>();
    const issGroupRef = useRef<THREE.Group>();
    const trailRef = useRef<ReturnType<typeof buildTrailLine>>();
    const predRef = useRef<ReturnType<typeof buildPredictionLine>>();
    const windRef = useRef<ReturnType<typeof buildWindParticles>>();
    const markerRef = useRef<THREE.Mesh>();
    const sunDirRef = useRef(new THREE.Vector3(1, 0, 0));
    const cityLightsTexRef = useRef<THREE.Texture | null>(null);
    const cameraCallbackRef = useRef<((d: number) => void) | null>(null);

    // Fly animation state
    const flyState = useRef<{
        active: boolean;
        from: THREE.Vector3;
        to: THREE.Vector3;
        startTime: number;
        duration: number;
    } | null>(null);

    const mount = useCallback((container: HTMLDivElement) => {
        if (rendererRef.current) return;
        containerRef.current = container;
        const w = container.clientWidth;
        const h = container.clientHeight;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
        camera.position.set(0, 0, 18);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = EARTH_RADIUS * 1.2;
        controls.maxDistance = 50;
        controls.enablePan = false;
        controls.rotateSpeed = 0.5;
        controls.zoomSpeed = 1.2;
        controlsRef.current = controls;

        // Fire camera distance callback on control change
        controls.addEventListener('change', () => {
            if (cameraCallbackRef.current && cameraRef.current) {
                cameraCallbackRef.current(cameraRef.current.position.length());
            }
        });

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambient);
        const directional = new THREE.DirectionalLight(0xffffff, 1.5);
        directional.position.copy(sunDirRef.current).multiplyScalar(100);
        scene.add(directional);

        // Load Earth texture
        const loader = new THREE.TextureLoader();
        loader.load(TILES.esriSatellite.replace('{z}', '2').replace('{x}', '1').replace('{y}', '1'), () => { });

        // Earth sphere with blue marble
        const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
        const earthMat = new THREE.MeshPhongMaterial({
            color: 0x2255aa,
            shininess: 15,
        });
        // Load a combined satellite tile as base texture
        const earthTex = loader.load(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png',
            (tex) => {
                earthMat.map = tex;
                earthMat.color.set(0xffffff);
                earthMat.needsUpdate = true;
            }
        );
        const earth = new THREE.Mesh(earthGeo, earthMat);
        scene.add(earth);
        earthRef.current = earth;

        // Load city lights texture (NASA Black Marble)
        loader.load(
            'https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg',
            (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                cityLightsTexRef.current = tex;
                // Update night material with city lights
                if (nightRef.current) {
                    const nightMat = buildTerminatorMaterial(sunDirRef.current, tex);
                    nightRef.current.material = nightMat;
                }
            }
        );

        // Night overlay (terminator + city lights)
        const nightGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.002, 128, 128);
        const nightMat = buildTerminatorMaterial(sunDirRef.current, null);
        const nightMesh = new THREE.Mesh(nightGeo, nightMat);
        scene.add(nightMesh);
        nightRef.current = nightMesh;

        // Atmosphere
        const atmosphere = buildAtmosphereMesh();
        scene.add(atmosphere);
        atmosphereRef.current = atmosphere;

        // Clouds
        const cloud = buildCloudMesh();
        scene.add(cloud);
        cloudRef.current = cloud;

        // Stars
        const stars = buildStarField();
        scene.add(stars);
        starsRef.current = stars;

        // ISS
        const issGroup = buildISSModel();
        issGroup.visible = false;
        issGroup.scale.setScalar(0.5);
        scene.add(issGroup);
        issGroupRef.current = issGroup;

        // ISS Trail
        const trailObj = buildTrailLine(0x00e5ff, 200);
        scene.add(trailObj.line);
        trailRef.current = trailObj;

        // Prediction
        const predObj = buildPredictionLine(0x00e5ff);
        scene.add(predObj.line);
        predRef.current = predObj;

        // Wind particles
        const windObj = buildWindParticles(2000);
        windObj.points.visible = false;
        scene.add(windObj.points);
        windRef.current = windObj;

        // Animation loop
        const animate = () => {
            frameRef.current = requestAnimationFrame(animate);
            controls.update();

            // Cloud rotation
            if (cloudRef.current) cloudRef.current.rotation.y += 0.00005;

            // Fly animation
            if (flyState.current?.active) {
                const elapsed = Date.now() - flyState.current.startTime;
                const t = Math.min(elapsed / flyState.current.duration, 1);
                const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                const currentPos = new THREE.Vector3().lerpVectors(
                    flyState.current.from,
                    flyState.current.to,
                    eased
                );
                camera.position.copy(currentPos);
                camera.lookAt(0, 0, 0);
                if (t >= 1) flyState.current.active = false;
            }

            renderer.render(scene, camera);
        };
        animate();

        // Resize handler
        const onResize = () => {
            if (!containerRef.current) return;
            const nw = containerRef.current.clientWidth;
            const nh = containerRef.current.clientHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
        };
        window.addEventListener('resize', onResize);
    }, []);

    const unmount = useCallback(() => {
        cancelAnimationFrame(frameRef.current);
        if (rendererRef.current && containerRef.current) {
            containerRef.current.removeChild(rendererRef.current.domElement);
            rendererRef.current.dispose();
            rendererRef.current = undefined;
        }
        controlsRef.current?.dispose();
        sceneRef.current = undefined;
        cameraRef.current = undefined;
    }, []);

    const updateSun = useCallback((pos: SunPosition) => {
        const dir = latLonToVector3(pos.lat, pos.lon, 1).normalize();
        sunDirRef.current.copy(dir);
        if (nightRef.current) {
            const mat = nightRef.current.material as THREE.ShaderMaterial;
            if (mat.uniforms?.uSunDir) mat.uniforms.uSunDir.value.copy(dir);
        }
        // Update directional light
        if (sceneRef.current) {
            sceneRef.current.children.forEach(c => {
                if (c instanceof THREE.DirectionalLight) {
                    c.position.copy(dir).multiplyScalar(100);
                }
            });
        }
    }, []);

    const updateISS = useCallback((data: ISSData | null, trail: { lat: number; lon: number }[], prediction: { lat: number; lon: number }[]) => {
        if (!data || !issGroupRef.current) return;
        const altitude = EARTH_RADIUS + (data.altitude / 6371) * EARTH_RADIUS * 2;
        const pos = latLonToVector3(data.latitude, data.longitude, altitude);
        issGroupRef.current.position.copy(pos);
        issGroupRef.current.lookAt(0, 0, 0);
        issGroupRef.current.visible = true;

        // Trail
        if (trailRef.current) {
            const trailPts = trail.map(p => latLonToVector3(p.lat, p.lon, altitude));
            trailRef.current.update(trailPts);
        }

        // Prediction orbit
        if (predRef.current) {
            const predPts = prediction.map(p => latLonToVector3(p.lat, p.lon, altitude));
            predRef.current.update(predPts);
        }
    }, []);

    const updateWind = useCallback((data: WindPoint[]) => {
        if (windRef.current && data.length) {
            windRef.current.update(data.map(w => ({
                lat: w.lat,
                lon: w.lon,
                speed: w.speed,
                direction: w.direction,
            })));
        }
    }, []);

    const updateModules = useCallback((m: ModuleState) => {
        if (windRef.current) windRef.current.points.visible = m.wind;
        if (issGroupRef.current) issGroupRef.current.visible = m.iss;
        if (trailRef.current) trailRef.current.line.visible = m.iss;
        if (predRef.current) predRef.current.line.visible = m.iss;
        if (nightRef.current) nightRef.current.visible = m.nightLights;
    }, []);

    const flyTo = useCallback((lat: number, lon: number) => {
        if (!cameraRef.current) return;
        const dist = cameraRef.current.position.length();
        const targetDist = Math.max(dist, EARTH_RADIUS * 2.5);
        const target = latLonToVector3(lat, lon, targetDist);
        flyState.current = {
            active: true,
            from: cameraRef.current.position.clone(),
            to: target,
            startTime: Date.now(),
            duration: 1500,
        };
    }, []);

    const getCamera = useCallback(() => cameraRef.current ?? null, []);
    const getCameraDistance = useCallback(() => cameraRef.current?.position.length() ?? 18, []);
    const addWeatherMarker = useCallback((lat: number, lon: number) => {
        if (!sceneRef.current) return;
        if (markerRef.current) sceneRef.current.remove(markerRef.current);
        const marker = buildWeatherMarker(lat, lon);
        sceneRef.current.add(marker);
        markerRef.current = marker;
    }, []);

    const onCameraChange = useCallback((cb: (distance: number) => void) => {
        cameraCallbackRef.current = cb;
    }, []);

    return {
        mount,
        unmount,
        updateSun,
        updateISS,
        updateWind,
        updateModules,
        flyTo,
        getCamera,
        getCameraDistance,
        addWeatherMarker,
        onCameraChange,
    };
}
