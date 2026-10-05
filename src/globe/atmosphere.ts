// Atmospheric scattering rim glow shader and outer shell mesh

import * as THREE from 'three';
import { EARTH_RADIUS } from './earth';

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vViewDirection = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uAtmosphereColor;
  uniform vec3 uTwilightColor;
  uniform vec3 uDeepTwilightColor;
  uniform vec3 uSunDirection;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  const float SIN_ASTRO   = -0.30901699; // sin(-18.0 deg)
  const float SIN_SUNSET  = -0.01454332; // sin(-0.8333 deg)
  const float SIN_CIVIL   = -0.10452846; // sin(-6.0 deg)
  const float MU_HORIZON  = 0.20637212; // sqrt(1.0 - (5.0/5.11)^2)
  const float RE          = 5.0;
  const float RA          = 5.11;
  const float H_SCALE     = 0.025;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 sunDir = normalize(uSunDirection);
    vec3 viewDir = normalize(vViewDirection);

    float sunDot = dot(normal, sunDir);

    // 1. Strict dark-side extinction at astronomical twilight (alpha = 0, radiance = 0)
    if (sunDot <= SIN_ASTRO) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // 2. Twilight illumination factor (quadratic Hermite decay)
    float tTwilight = clamp((sunDot - SIN_ASTRO) / (0.0 - SIN_ASTRO), 0.0, 1.0);
    float sTwilight = tTwilight * tTwilight * (3.0 - 2.0 * tTwilight);
    float twilightFactor = (sunDot >= 0.0) ? 1.0 : (sTwilight * sTwilight);

    // 3. Spectral color blending across twilight
    float sunsetSpread = 0.06;
    float sunsetPeak = exp(-pow((sunDot - SIN_SUNSET) / sunsetSpread, 2.0));
    float daylightFactor = smoothstep(SIN_SUNSET, 0.12, sunDot);
    float deepTwilightFactor = 1.0 - smoothstep(SIN_ASTRO, SIN_CIVIL, sunDot);

    vec3 twilightBand = mix(uTwilightColor, uDeepTwilightColor, deepTwilightFactor);
    vec3 baseColor = mix(twilightBand, uAtmosphereColor, daylightFactor);
    vec3 scatteredColor = mix(baseColor, uTwilightColor, sunsetPeak * 0.55);

    // 4. View angle and limb optical depth
    float muV = clamp(dot(normal, viewDir), 0.0, 1.0);
    float tau;
    if (muV > MU_HORIZON) {
      float d = RA * sqrt(max(0.0, 1.0 - muV * muV));
      float path = sqrt(RA * RA - d * d) - sqrt(max(0.0, RE * RE - d * d));
      tau = path * 0.45;
    } else {
      float d = RA * sqrt(max(0.0, 1.0 - muV * muV));
      float h = d - RE;
      float density = exp(-h / H_SCALE);
      float geometricPath = 2.0 * RA * muV;
      tau = geometricPath * density * 2.5;
    }

    // 5. Rayleigh scattering phase function
    float cosPsi = dot(-sunDir, viewDir);
    float phaseRayleigh = 0.75 * (1.0 + cosPsi * cosPsi);

    // 6. Scattered radiance and opacity
    float opticalOpacity = 1.0 - exp(-tau);
    float alpha = opticalOpacity * twilightFactor;
    vec3 radiance = scatteredColor * (twilightFactor * phaseRayleigh * (1.0 + tau));

    gl_FragColor = vec4(radiance, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
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
      uAtmosphereColor: { value: new THREE.Color(0.22, 0.55, 0.98) },
      uTwilightColor: { value: new THREE.Color(1.0, 0.45, 0.12) },
      uDeepTwilightColor: { value: new THREE.Color(0.08, 0.15, 0.40) },
      uSunDirection: { value: new THREE.Vector3(0, 0, 1) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
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
