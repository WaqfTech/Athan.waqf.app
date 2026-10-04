// Main Three.js Scene manager for Adhan Earth 3D Observatory

import * as THREE from 'three';
import { createEarth, EarthComponents, MapStyle } from './earth';
import { createCameraRig, CameraRig } from './camera';
import { createPrayerFrontsLayer, PrayerFrontsLayer } from './fronts';
import { createAtmosphere, AtmosphereMesh } from './atmosphere';
import { createSettlementPointCloud, SettlementPointCloud, ActiveAdhanEvent } from './cities';
import { createMinaretRingsLayer, MinaretRingsLayer } from './rings';
import { createQiblaArcsLayer, QiblaArcsLayer } from './qibla';
import { SubsolarCoordinates } from '../astronomy/solar';
import { vector3ToLatLon } from '../astronomy/coordinates';
import { CalculationParameters, Madhab, CALCULATION_CONVENTIONS } from '../prayer/conventions';
import { Settlement } from '../population/loader';
import { SettlementSpatialIndex } from '../population/spatialIndex';

export interface GlobeSceneOptions {
  initialStyle?: MapStyle;
  onSelectSettlement?: (settlement: Settlement) => void;
  onSelectCoordinates?: (lat: number, lon: number) => void;
}

export interface GlobeScene {
  scene: THREE.Scene;
  cameraRig: CameraRig;
  earth: EarthComponents;
  atmosphere: AtmosphereMesh;
  prayerFronts: PrayerFrontsLayer;
  settlementsCloud: SettlementPointCloud | null;
  minaretRings: MinaretRingsLayer;
  qiblaArcs: QiblaArcsLayer;
  renderer: THREE.WebGLRenderer;
  setTime: (date: Date) => SubsolarCoordinates;
  setConvention: (convention: CalculationParameters) => void;
  setMadhab: (madhab: Madhab) => void;
  setMapStyle: (style: MapStyle) => void;
  getMapStyle: () => MapStyle;
  setSettlements: (settlements: Settlement[]) => void;
  updateActiveEvents: (events: ActiveAdhanEvent[]) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

export function createGlobeScene(
  canvas: HTMLCanvasElement,
  options: GlobeSceneOptions = {},
): GlobeScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030712);

  // Deep space starfield
  const starsCount = 1500;
  const starsGeometry = new THREE.BufferGeometry();
  const starsPositions = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount * 3; i += 3) {
    const r = 200 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starsPositions[i] = r * Math.sin(phi) * Math.cos(theta);
    starsPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    starsPositions[i + 2] = r * Math.cos(phi);
  }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({
    color: 0x94a3b8,
    size: 1.2,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);

  // Panoramic starry deep space celestial sphere
  const textureLoader = new THREE.TextureLoader();
  const skyTexture = textureLoader.load('./textures/night-sky.png');
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyGeometry = new THREE.SphereGeometry(300, 32, 32);
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(skyMesh);

  // Directional sun light and ambient space light
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x0f172a, 0.4);
  scene.add(ambientLight);

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Camera rig
  const cameraRig = createCameraRig(canvas);

  // Earth system (defaults to high-contrast 4K satellite photographic map)
  const earth = createEarth(undefined, options.initialStyle || 'satellite');
  scene.add(earth.group);

  // Atmospheric glow shell
  const atmosphere = createAtmosphere();
  scene.add(atmosphere.mesh);

  // Prayer fronts visualization layer
  const prayerFronts = createPrayerFrontsLayer();
  scene.add(prayerFronts.group);

  // Minaret acoustic ripple rings layer
  const minaretRings = createMinaretRingsLayer();
  scene.add(minaretRings.group);

  // 3D Qibla arcs layer to Mecca
  const qiblaArcs = createQiblaArcsLayer();
  scene.add(qiblaArcs.group);

  let settlementsCloud: SettlementPointCloud | null = null;
  let spatialIndex: SettlementSpatialIndex | null = null;
  let settlementsCache: Settlement[] = [];

  let currentDate = new Date();
  let currentConvention = CALCULATION_CONVENTIONS.UmmAlQura;
  let currentMadhab: Madhab = 'Shafi';
  let animationFrameId: number | null = null;
  let isRunning = false;
  let clockStartTime = performance.now();

  const setSettlements = (settlements: Settlement[]): void => {
    settlementsCache = settlements;
    if (settlementsCloud) {
      scene.remove(settlementsCloud.group);
      settlementsCloud.dispose();
    }
    spatialIndex = new SettlementSpatialIndex(settlements);
    settlementsCloud = createSettlementPointCloud(settlements);
    scene.add(settlementsCloud.group);
  };

  const updateActiveEvents = (events: ActiveAdhanEvent[]): void => {
    if (settlementsCloud) {
      settlementsCloud.updateActiveEvents(events);
    }
    if (settlementsCache.length > 0) {
      minaretRings.updateActiveEvents(events, settlementsCache);
      qiblaArcs.updateActiveEvents(events, settlementsCache);
    }
  };

  const setTime = (date: Date): SubsolarCoordinates => {
    currentDate = date;
    const subsolar = earth.updateSun(date);
    const sunDir = earth.mesh.material.uniforms.uSunDirection.value;
    sunLight.position.copy(sunDir).multiplyScalar(50);
    atmosphere.updateSun(sunDir);
    prayerFronts.update(subsolar, currentConvention, currentMadhab);
    return subsolar;
  };

  const setConvention = (convention: CalculationParameters): void => {
    currentConvention = convention;
    setTime(currentDate);
  };

  const setMadhab = (madhab: Madhab): void => {
    currentMadhab = madhab;
    setTime(currentDate);
  };

  // Initial sun and prayer front position
  setTime(currentDate);

  // Raycasting for settlement and coordinate selection on click
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };

  const onPointerDown = (e: PointerEvent): void => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: PointerEvent): void => {
    // Only register as click if pointer hasn't moved significantly (not a drag/orbit)
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.hypot(dx, dy) > 5) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, cameraRig.camera);
    const intersects = raycaster.intersectObject(earth.mesh);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      const { latitude, longitude } = vector3ToLatLon(point.x, point.y, point.z);

      if (spatialIndex && options.onSelectSettlement) {
        const nearest = spatialIndex.findNearest(latitude, longitude, 3.5);
        if (nearest) {
          options.onSelectSettlement(nearest.settlement);
          qiblaArcs.setInspectedCity(nearest.settlement.latitude, nearest.settlement.longitude);
          return;
        }
      }

      if (options.onSelectCoordinates) {
        options.onSelectCoordinates(latitude, longitude);
        qiblaArcs.setInspectedCity(latitude, longitude);
      }
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);

  // Decoupled ResizeObserver
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        renderer.setSize(width, height, false);
        cameraRig.resize(width, height);
      }
    }
  });
  resizeObserver.observe(canvas);

  const renderLoop = (): void => {
    if (!isRunning) return;

    cameraRig.update();

    const elapsed = (performance.now() - clockStartTime) / 1000;
    if (settlementsCloud) {
      settlementsCloud.updateTime(elapsed);
    }
    minaretRings.updateTime(elapsed);
    qiblaArcs.updateTime(elapsed);

    // Subtle cloud rotation
    earth.cloudsMesh.rotation.y += 0.0001;

    renderer.render(scene, cameraRig.camera);
    animationFrameId = requestAnimationFrame(renderLoop);
  };

  const handleVisibilityChange = (): void => {
    if (document.hidden) {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else if (isRunning && animationFrameId === null) {
      animationFrameId = requestAnimationFrame(renderLoop);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const start = (): void => {
    if (!isRunning) {
      isRunning = true;
      clockStartTime = performance.now();
      animationFrameId = requestAnimationFrame(renderLoop);
    }
  };

  const stop = (): void => {
    isRunning = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  const dispose = (): void => {
    stop();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    starsGeometry.dispose();
    starsMaterial.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    skyTexture.dispose();
    prayerFronts.dispose();
    minaretRings.dispose();
    qiblaArcs.dispose();
    atmosphere.dispose();
    if (settlementsCloud) settlementsCloud.dispose();
    earth.dispose();
    cameraRig.dispose();
    renderer.dispose();
  };

  return {
    scene,
    cameraRig,
    earth,
    atmosphere,
    prayerFronts,
    settlementsCloud,
    minaretRings,
    qiblaArcs,
    renderer,
    setTime,
    setConvention,
    setMadhab,
    setMapStyle: earth.setMapStyle,
    getMapStyle: earth.getMapStyle,
    setSettlements,
    updateActiveEvents,
    start,
    stop,
    dispose,
  };
}
