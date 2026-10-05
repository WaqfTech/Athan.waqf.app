// Camera and OrbitControls management for planetary exploration

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  update: () => void;
  resize: (width: number, height: number) => void;
  focusCoordinates: (lat: number, lon: number, distance?: number, smooth?: boolean) => void;
  /** Shifts the rendered globe on screen by (dx, dy) pixels without moving the camera, to clear HUD panels. */
  setViewShift: (dx: number, dy: number) => void;
  /** Allows or blocks the idle auto-rotate. Resets the idle timer. */
  setAutoRotateAllowed: (allowed: boolean) => void;
  dispose: () => void;
}

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const fov = 45;
  const aspect = canvas.clientWidth / (canvas.clientHeight || 1);
  const near = 0.1;
  const far = 1000;

  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  // Initial camera position viewing Prime Meridian & Equator from space (25% smaller on first load)
  const baseDistance = 20.7; // Decreases projected diameter from 78% to 58% of screen height
  const initialDistance = aspect < 1 ? baseDistance / Math.max(0.55, aspect) : baseDistance;
  const pitchRatio = 4 / 15;
  const initZ = initialDistance / Math.sqrt(1 + pitchRatio * pitchRatio);
  const initY = initZ * pitchRatio;
  camera.position.set(0, initY, initZ);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 1.0;
  controls.minDistance = 6.2; // Closest zoom near Earth surface (R = 5)
  controls.maxDistance = 50.0; // Deep space zoom
  controls.enablePan = false; // Keep planetary center locked

  // With a delta time, speed 1 is one turn per 30s. 0.3 is about one turn per 100s, independent of frame rate.
  controls.autoRotateSpeed = 0.3;
  let lastUpdateMs = performance.now();

  const IDLE_BEFORE_ROTATE_MS = 20000;
  const reducedMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let autoRotateAllowed = true;
  let lastInteractionMs = performance.now();
  controls.addEventListener('start', () => {
    lastInteractionMs = performance.now();
    controls.autoRotate = false;
  });

  let viewWidth = canvas.clientWidth || window.innerWidth;
  let viewHeight = canvas.clientHeight || window.innerHeight;
  let shiftX = 0;
  let shiftY = 0;

  const applyViewShift = (): void => {
    if (shiftX === 0 && shiftY === 0) {
      camera.clearViewOffset();
    } else {
      camera.setViewOffset(viewWidth, viewHeight, -shiftX, -shiftY, viewWidth, viewHeight);
    }
    camera.updateProjectionMatrix();
  };

  const setViewShift = (dx: number, dy: number): void => {
    shiftX = dx;
    shiftY = dy;
    applyViewShift();
  };

  const setAutoRotateAllowed = (allowed: boolean): void => {
    autoRotateAllowed = allowed;
    lastInteractionMs = performance.now();
    if (!allowed) controls.autoRotate = false;
  };

  let targetPosition: THREE.Vector3 | null = null;
  let isInterpolating = false;

  const update = (): void => {
    controls.autoRotate =
      autoRotateAllowed &&
      !reducedMotion &&
      !isInterpolating &&
      performance.now() - lastInteractionMs > IDLE_BEFORE_ROTATE_MS;
    if (isInterpolating && targetPosition) {
      camera.position.lerp(targetPosition, 0.06);
      const targetDist = targetPosition.length();
      camera.position.setLength(targetDist);
      if (camera.position.distanceTo(targetPosition) < 0.05) {
        camera.position.copy(targetPosition);
        targetPosition = null;
        isInterpolating = false;
      }
    }
    const now = performance.now();
    const deltaSeconds = Math.min(0.1, (now - lastUpdateMs) / 1000);
    lastUpdateMs = now;
    controls.update(deltaSeconds);
  };

  const resize = (width: number, height: number): void => {
    viewWidth = width;
    viewHeight = height;
    camera.aspect = width / (height || 1);
    camera.updateProjectionMatrix();
    applyViewShift();
  };

  const focusCoordinates = (lat: number, lon: number, distance = 12, smooth = false): void => {
    lastInteractionMs = performance.now();
    const phi = (lat * Math.PI) / 180;
    const lambda = (lon * Math.PI) / 180;

    const cosPhi = Math.cos(phi);
    const x = distance * cosPhi * Math.sin(lambda);
    const y = distance * Math.sin(phi);
    const z = distance * cosPhi * Math.cos(lambda);

    if (smooth) {
      targetPosition = new THREE.Vector3(x, y, z);
      isInterpolating = true;
    } else {
      targetPosition = null;
      isInterpolating = false;
      camera.position.set(x, y, z);
    }
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const dispose = (): void => {
    controls.dispose();
  };

  return {
    camera,
    controls,
    update,
    resize,
    focusCoordinates,
    setViewShift,
    setAutoRotateAllowed,
    dispose,
  };
}
