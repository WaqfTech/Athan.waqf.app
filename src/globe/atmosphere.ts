// Atmospheric scattering rim glow shader and outer shell mesh

import * as THREE from 'three';
import { EARTH_RADIUS } from './earth';

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vEyeVector;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vEyeVector = -normalize(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uAtmosphereColor;
  varying vec3 vNormal;
  varying vec3 vEyeVector;

  void main() {
    float dotNV = dot(vNormal, vEyeVector);
    // Fresnel rim glow highest at the planetary limb
    float intensity = pow(1.0 - clamp(dotNV, 0.0, 1.0), 3.0);
    gl_FragColor = vec4(uAtmosphereColor, intensity * 0.8);
  }
`;

export interface AtmosphereMesh {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  dispose: () => void;
}

export function createAtmosphere(): AtmosphereMesh {
  const radius = EARTH_RADIUS * 1.018;
  const geometry = new THREE.SphereGeometry(radius, 64, 64);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAtmosphereColor: { value: new THREE.Color(0x38bdf8) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'earth-atmosphere-glow';

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    dispose,
  };
}
