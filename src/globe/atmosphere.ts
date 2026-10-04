// Atmospheric scattering rim glow shader and outer shell mesh

import * as THREE from 'three';
import { EARTH_RADIUS } from './earth';

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vEyeVector;
  varying vec3 vWorldNormal;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vEyeVector = -normalize(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uAtmosphereColor;
  uniform vec3 uSunDirection;
  varying vec3 vNormal;
  varying vec3 vEyeVector;
  varying vec3 vWorldNormal;

  void main() {
    float dotNV = dot(vNormal, vEyeVector);
    // Fresnel rim glow highest at the planetary limb
    float rim = pow(1.0 - clamp(dotNV, 0.0, 1.0), 3.5);

    // Sun alignment at the outer atmospheric edge
    float sunFactor = dot(normalize(vWorldNormal), normalize(uSunDirection));
    float dayFactor = smoothstep(-0.2, 0.3, sunFactor);

    // Twilight warmth along the terminator
    float terminator = 1.0 - smoothstep(0.0, 0.35, abs(sunFactor));
    vec3 twilightGlow = vec3(1.0, 0.5, 0.2);
    vec3 color = mix(uAtmosphereColor, twilightGlow, terminator * 0.4);

    float alpha = rim * (0.05 + dayFactor * 0.85);
    gl_FragColor = vec4(color, alpha);
  }
`;

export interface AtmosphereMesh {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  updateSun: (sunDir: THREE.Vector3) => void;
  dispose: () => void;
}

export function createAtmosphere(): AtmosphereMesh {
  const radius = EARTH_RADIUS * 1.022;
  const geometry = new THREE.SphereGeometry(radius, 64, 64);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAtmosphereColor: { value: new THREE.Color(0x38bdf8) },
      uSunDirection: { value: new THREE.Vector3(0, 0, 1) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'earth-atmosphere-glow';

  const updateSun = (sunDir: THREE.Vector3): void => {
    material.uniforms.uSunDirection.value.copy(sunDir).normalize();
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    updateSun,
    dispose,
  };
}
