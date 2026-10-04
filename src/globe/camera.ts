// Camera and OrbitControls management for planetary exploration

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  update: () => void;
  resize: (width: number, height: number) => void;
  focusCoordinates: (lat: number, lon: number, distance?: number) => void;
  dispose: () => void;
}

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const fov = 45;
  const aspect = canvas.clientWidth / (canvas.clientHeight || 1);
  const near = 0.1;
  const far = 1000;

  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  // Initial camera position viewing Prime Meridian & Equator from space
  camera.position.set(0, 4, 15);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 1.0;
  controls.minDistance = 6.2; // Closest zoom near Earth surface (R = 5)
  controls.maxDistance = 40.0; // Deep space zoom
  controls.enablePan = false; // Keep planetary center locked

  const update = (): void => {
    controls.update();
  };

  const resize = (width: number, height: number): void => {
    camera.aspect = width / (height || 1);
    camera.updateProjectionMatrix();
  };

  const focusCoordinates = (lat: number, lon: number, distance = 12): void => {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lon * Math.PI) / 180;

    const cosPhi = Math.cos(phi);
    const x = distance * cosPhi * Math.sin(lambda);
    const y = distance * Math.sin(phi);
    const z = distance * cosPhi * Math.cos(lambda);

    camera.position.set(x, y, z);
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
    dispose,
  };
}
