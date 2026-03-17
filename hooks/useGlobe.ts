'use client';

import {
    buildAtmosphereMesh,
    buildCloudMesh,
    buildISSModel,
    buildLightningSystem,
    buildPredictionLine,
    buildStarField,
    buildStormSystem,
    buildTerminatorMaterial,
    buildTrailLine,
    buildWeatherMarker,
    buildWindParticles,
    EARTH_RADIUS,
    latLonToVector3,
    type LightningState,
    type StormState,
} from '@/lib/globe';
import { buildBrightStars, buildConstellationLines } from '@/lib/stars';
import { TILES } from '@/lib/tiles';
import type { ISSData, ModuleState, SunPosition, WindPoint } from '@/types';
import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

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

function syncCameraClipping(camera: THREE.PerspectiveCamera) {
    const distance = camera.position.length();
    const surfaceGap = Math.max(distance - EARTH_RADIUS * 1.02, 0.12);
    const nextNear = THREE.MathUtils.clamp(surfaceGap * 0.45, 0.12, 2.0);
    const nextFar = Math.max(950, distance + 820);

    if (Math.abs(camera.near - nextNear) > 0.01 || Math.abs(camera.far - nextFar) > 1) {
        camera.near = nextNear;
        camera.far = nextFar;
        camera.updateProjectionMatrix();
    }
}

function syncFxaaResolution(pass: ShaderPass, renderer: THREE.WebGLRenderer, width: number, height: number) {
    const pixelRatio = renderer.getPixelRatio();
    const resolution = pass.material.uniforms.resolution?.value;

    if (resolution instanceof THREE.Vector2) {
        resolution.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    }
}

export function useGlobe(): GlobeAPI {
    const sceneRef = useRef<THREE.Scene | undefined>(undefined);
    const cameraRef = useRef<THREE.PerspectiveCamera | undefined>(undefined);
    const rendererRef = useRef<THREE.WebGLRenderer | undefined>(undefined);
    const controlsRef = useRef<OrbitControls | undefined>(undefined);
    const frameRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement | undefined>(undefined);

    const earthRef = useRef<THREE.Mesh | undefined>(undefined);
    const nightRef = useRef<THREE.Mesh | undefined>(undefined);
    const atmosphereRef = useRef<THREE.Mesh | undefined>(undefined);
    const cloudRef = useRef<THREE.Mesh | undefined>(undefined);
    const starsRef = useRef<THREE.Points | undefined>(undefined);
    const issGroupRef = useRef<THREE.Group | undefined>(undefined);
    const trailRef = useRef<ReturnType<typeof buildTrailLine> | undefined>(undefined);
    const predRef = useRef<ReturnType<typeof buildPredictionLine> | undefined>(undefined);
    const windRef = useRef<ReturnType<typeof buildWindParticles> | undefined>(undefined);
    const markerRef = useRef<THREE.Group | undefined>(undefined);
    const sunDirRef = useRef(new THREE.Vector3(1, 0, 0));
    const cityLightsTexRef = useRef<THREE.Texture | null>(null);
    const cameraCallbackRef = useRef<((d: number) => void) | null>(null);
    const resizeHandlerRef = useRef<(() => void) | null>(null);
    const clockRef = useRef(new THREE.Timer());
    const timeRef = useRef(0);
    const modulesRef = useRef<ModuleState | null>(null);
    const windTickAccumulatorRef = useRef(0);

    // Postprocessing
    const composerRef = useRef<EffectComposer | undefined>(undefined);
    const fxaaPassRef = useRef<ShaderPass | undefined>(undefined);

    // Stars / Constellations / Telescope
    const brightStarsRef = useRef<THREE.Group | undefined>(undefined);
    const constellationRef = useRef<THREE.Group | undefined>(undefined);

    // Lightning / Storm
    const lightningRef = useRef<LightningState | undefined>(undefined);
    const stormRef = useRef<StormState | undefined>(undefined);

    // Marker pulse time
    const markerPulseTimeRef = useRef(0);

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
        scene.background = new THREE.Color(0x000008);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
        camera.position.set(0, 0, 18);
        camera.up.set(0, 1, 0);
        syncCameraClipping(camera);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            precision: 'highp',
        });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.minDistance = EARTH_RADIUS * 1.08;
        controls.maxDistance = 45;
        controls.enablePan = false;
        controls.target.set(0, 0, 0);
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
        loader.load(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png',
            (tex) => {
                earthMat.map = tex;
                earthMat.color.set(0xffffff);
                earthMat.needsUpdate = true;
            }
        );
        const earth = new THREE.Mesh(earthGeo, earthMat);
        earth.renderOrder = 0;
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
        nightMesh.renderOrder = 1;
        scene.add(nightMesh);
        nightRef.current = nightMesh;

        // Atmosphere
        const atmosphere = buildAtmosphereMesh();
        atmosphere.renderOrder = 3;
        scene.add(atmosphere);
        atmosphereRef.current = atmosphere;

        // Clouds
        const cloud = buildCloudMesh();
        cloud.renderOrder = 2;
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

        // ── Bright Stars (named sprites) ──
        const brightStars = buildBrightStars();
        scene.add(brightStars);
        brightStarsRef.current = brightStars;

        // ── Constellation Lines ──
        const constellations = buildConstellationLines();
        scene.add(constellations);
        constellationRef.current = constellations;

        // ── Lightning System ──
        const lightning = buildLightningSystem(scene);
        lightningRef.current = lightning;

        // ── Storm System ──
        const storm = buildStormSystem(scene);
        stormRef.current = storm;

        // ── EffectComposer + UnrealBloomPass ──
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(w, h),
            0.18,  // strength
            0.12,  // radius
            0.94,  // threshold
        );
        composer.addPass(bloomPass);
        const fxaaPass = new ShaderPass(FXAAShader);
        syncFxaaResolution(fxaaPass, renderer, w, h);
        composer.addPass(fxaaPass);
        fxaaPassRef.current = fxaaPass;
        composerRef.current = composer;

        // Animation loop
        const animate = () => {
            frameRef.current = requestAnimationFrame(animate);

            // OrbitControls sadece uçuş animasyonu yokken güncellenir;
            // yoksa kamera konumu çakışır ve "snap-back" titremesi oluşur.
            if (!flyState.current?.active) {
                controls.update();
            }

            clockRef.current.update();
            const dt = Math.min(clockRef.current.getDelta(), 1 / 24);
            timeRef.current += dt;

            // Cloud rotation
            if (cloudRef.current) cloudRef.current.rotation.y += 0.0003;

            // Wind particle tick (per-frame animation!)
            if (windRef.current && windRef.current.points.visible) {
                windTickAccumulatorRef.current += dt;
                if (windTickAccumulatorRef.current >= 1 / 30) {
                    windRef.current.tick();
                    windTickAccumulatorRef.current = 0;
                }
            }

            // ISS beacon pulse
            if (issGroupRef.current?.visible) {
                const beacon = issGroupRef.current.getObjectByName('issBeacon');
                if (beacon && beacon instanceof THREE.Mesh) {
                    const mat = beacon.material as THREE.MeshBasicMaterial;
                    mat.opacity = 0.5 + 0.5 * Math.sin(timeRef.current * 4);
                }
            }

            // Night shader time uniform for twinkle
            if (nightRef.current) {
                const mat = nightRef.current.material as THREE.ShaderMaterial;
                if (mat.uniforms?.uTime) mat.uniforms.uTime.value = timeRef.current;
            }

            // ── Weather Marker Pulse Animation ──
            if (markerRef.current) {
                markerPulseTimeRef.current += dt;
                const pTime = markerPulseTimeRef.current;
                const ring = markerRef.current.getObjectByName('markerRing') as THREE.Mesh | undefined;
                const pulse = markerRef.current.getObjectByName('markerPulse') as THREE.Mesh | undefined;
                if (ring) {
                    (ring.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.3 * Math.sin(pTime * 3);
                }
                if (pulse) {
                    const s = 1 + (pTime % 2) * 1.5;
                    pulse.scale.setScalar(s);
                    (pulse.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - (pTime % 2) * 0.3);
                }
            }

            // ── Lightning Flashes ──
            const weatherFxEnabled = Boolean(modulesRef.current?.weather && modulesRef.current?.clouds);
            if (lightningRef.current && weatherFxEnabled) {
                lightningRef.current.tick(timeRef.current);
            }

            // ── Storm Pulse ──
            if (stormRef.current && weatherFxEnabled) {
                stormRef.current.tick(timeRef.current);
            } else if (stormRef.current) {
                stormRef.current.light.intensity = 0;
            }

            // ── Telescope Module: distance-based star/constellation fade ──
            if (cameraRef.current) {
                const camDist = camera.position.length();
                // Stars fade out when very close (< 10), full when far (> 20)
                const starFactor = THREE.MathUtils.clamp((camDist - 8) / 15, 0, 1);
                if (starsRef.current) {
                    (starsRef.current.material as THREE.PointsMaterial).opacity = starFactor * 0.9;
                }
                if (brightStarsRef.current) {
                    brightStarsRef.current.children.forEach(c => {
                        if (c instanceof THREE.Sprite) {
                            (c.material as THREE.SpriteMaterial).opacity = starFactor;
                        }
                    });
                }
                if (constellationRef.current) {
                    constellationRef.current.children.forEach(c => {
                        if (c instanceof THREE.Line) {
                            (c.material as THREE.LineBasicMaterial).opacity = starFactor * 0.25;
                        }
                    });
                }
            }

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
                controls.target.set(0, 0, 0);
                camera.lookAt(0, 0, 0);
                if (t >= 1) {
                    flyState.current.active = false;
                    // Yeni kamera konumunu OrbitControls'a sync'le (geri-dönme önlenir)
                    controls.target.set(0, 0, 0);
                    controls.update();
                }
            }

            syncCameraClipping(camera);

            if (composerRef.current) {
                composerRef.current.render();
            } else {
                renderer.render(scene, camera);
            }
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
            if (composerRef.current) composerRef.current.setSize(nw, nh);
            if (fxaaPassRef.current) syncFxaaResolution(fxaaPassRef.current, renderer, nw, nh);
        };
        window.addEventListener('resize', onResize);
        resizeHandlerRef.current = onResize;
    }, []);

    const unmount = useCallback(() => {
        cancelAnimationFrame(frameRef.current);
        // Clean up resize listener
        if (resizeHandlerRef.current) {
            window.removeEventListener('resize', resizeHandlerRef.current);
            resizeHandlerRef.current = null;
        }
        // Dispose effects
        if (lightningRef.current) lightningRef.current.dispose();
        if (stormRef.current) stormRef.current.dispose();
        composerRef.current?.dispose();
        composerRef.current = undefined;
        fxaaPassRef.current = undefined;
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
            windRef.current.setWindData(data.map(w => ({
                lat: w.lat,
                lon: w.lon,
                speed: w.speed,
                direction: w.direction,
            })));
        }
    }, []);

    const updateModules = useCallback((m: ModuleState) => {
        modulesRef.current = m;
        if (windRef.current) windRef.current.points.visible = m.wind;
        if (issGroupRef.current) issGroupRef.current.visible = m.iss;
        if (trailRef.current) trailRef.current.line.visible = m.iss;
        if (predRef.current) predRef.current.line.visible = m.iss;
        if (nightRef.current) nightRef.current.visible = m.dayNight || m.nightLights;
        if (cloudRef.current) cloudRef.current.visible = m.clouds;
        if (atmosphereRef.current) atmosphereRef.current.visible = true;
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

