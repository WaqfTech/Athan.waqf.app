// Earth 3D Mesh and Day/Night Terminator Shader with 4K Textures, Bump Relief, and Ocean Specular Glint

import * as THREE from 'three';
import { latLonToVector3 } from '../astronomy/coordinates';
import { getSubsolarPoint, SubsolarCoordinates } from '../astronomy/solar';

export const EARTH_RADIUS = 5;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vTangent;
  varying vec3 vBitangent;

  void main() {
    vUv = uv;
    vec3 worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vNormal = worldNormal;

    // Tangent along lines of latitude
    vec3 worldTangent = normalize(vec3(-worldNormal.z, 0.0, worldNormal.x));
    if (length(worldTangent) < 0.001) worldTangent = vec3(1.0, 0.0, 0.0);
    vTangent = worldTangent;
    vBitangent = cross(worldNormal, worldTangent);

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uDayTexture;
  uniform sampler2D uNightTexture;
  uniform sampler2D uNormalTexture;
  uniform sampler2D uSpecularTexture;
  uniform sampler2D uCloudsTexture;
  uniform vec3 uSunDirection;
  uniform float uCloudsOpacity;
  uniform float uBumpScale;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vTangent;
  varying vec3 vBitangent;

  void main() {
    vec3 geomNormal = normalize(vNormal);
    vec3 sunDir = normalize(uSunDirection);

    // Unperturbed geometric solar dot product for planetary macro occlusion
    float sunDotMacro = dot(geomNormal, sunDir);

    // Planetary geometric direct sunlight horizon cutoff (strictly 0 when sunDotMacro <= 0)
    float directOcclusion = smoothstep(0.0, 0.025, sunDotMacro);

    // Micro-shading normal for local terrain bump relief
    mat3 tbn = mat3(normalize(vTangent), normalize(vBitangent), geomNormal);
    vec3 normalMapSample = texture2D(uNormalTexture, vUv).xyz * 2.0 - 1.0;
    vec3 perturbedNormal = normalize(tbn * (normalMapSample * vec3(uBumpScale, uBumpScale, 1.0)));
    vec3 shadingNormal = mix(geomNormal, perturbedNormal, clamp(uBumpScale * 2.0, 0.0, 1.0));

    // Local Lambertian diffuse scaling gated strictly by geometric occlusion (0.03 floor eliminated)
    float nDotL = max(dot(shadingNormal, sunDir), 0.0);
    float diffuse = nDotL * directOcclusion;

    // Sample input textures (decoded to linear space by Three.js)
    vec4 dayColor = texture2D(uDayTexture, vUv);
    vec4 nightColor = texture2D(uNightTexture, vUv);
    vec4 cloudsColor = texture2D(uCloudsTexture, vUv);
    float specMask = texture2D(uSpecularTexture, vUv).r;

    // Night emission modulation: city lights active only in night hemisphere
    float nightFactor = 1.0 - smoothstep(-0.03, 0.03, sunDotMacro);
    vec3 lights = nightColor.rgb * vec3(1.35, 1.15, 0.85) * nightFactor * 1.5;

    // Grazing sunset rim glow along the terminator transition zone, strictly zero in night
    float sunsetBand = smoothstep(-0.03, 0.0, sunDotMacro) * (1.0 - smoothstep(0.0, 0.05, sunDotMacro));
    vec3 sunsetGlow = vec3(1.0, 0.45, 0.16) * sunsetBand * 0.35;

    // Ocean specular reflection (sun glint) gated strictly by geometric horizon
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 reflectDir = reflect(-sunDir, shadingNormal);
    float specFactor = pow(max(dot(reflectDir, viewDir), 0.0), 32.0);
    vec3 oceanGlint = vec3(1.0, 0.96, 0.88) * specFactor * specMask * directOcclusion * 1.5;

    // Day surface radiance
    vec3 litDay = dayColor.rgb * diffuse + sunsetGlow + oceanGlint;

    // Cloud direct illumination gated strictly by geometric horizon
    float cloudIntensity = cloudsColor.r * uCloudsOpacity;
    vec3 cloudsLit = vec3(cloudIntensity) * directOcclusion;

    // Combined linear radiance: day reflectance plus night emission plus clouds
    vec3 surface = litDay + lights + cloudsLit * 0.35;

    gl_FragColor = vec4(surface, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export type MapStyle = 'roadmap' | 'satellite';

export interface EarthComponents {
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  cloudsMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  updateSun: (date: Date) => SubsolarCoordinates;
  setMapStyle: (style: MapStyle) => void;
  getMapStyle: () => MapStyle;
  dispose: () => void;
}

export function createEarth(
  textureLoader = new THREE.TextureLoader(),
  initialStyle: MapStyle = 'satellite',
): EarthComponents {
  const group = new THREE.Group();
  group.name = 'earth-system';

  // Load 4K Satellite textures (NASA Blue Marble and Black Marble photographic)
  const satelliteDayTexture = textureLoader.load('/textures/earth-day-4k.jpg');
  satelliteDayTexture.colorSpace = THREE.SRGBColorSpace;

  const satelliteNightTexture = textureLoader.load('/textures/earth-night-4k.jpg');
  satelliteNightTexture.colorSpace = THREE.SRGBColorSpace;

  // Load Normal and Specular topography maps
  const normalTexture = textureLoader.load('/textures/earth-normal.jpg');
  const specularTexture = textureLoader.load('/textures/earth-specular.jpg');

  // Load Roadmap textures (Google Maps vector aesthetic)
  const roadmapDayTexture = textureLoader.load('/textures/earth-roadmap-day.png');
  roadmapDayTexture.colorSpace = THREE.SRGBColorSpace;

  const roadmapNightTexture = textureLoader.load('/textures/earth-roadmap-night.png');
  roadmapNightTexture.colorSpace = THREE.SRGBColorSpace;

  const cloudsTexture = textureLoader.load('/textures/earth-clouds.png');

  // Sphere geometry aligned with coordinate system
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);

  // In Three.js default SphereGeometry UV mapping, U=0 is at -X, U=0.5 is at +X.
  // Rotate the geometry so U=0.5 aligns with +Z (Prime Meridian) to match latLonToVector3
  geometry.rotateY(-Math.PI / 2);

  let currentStyle: MapStyle = initialStyle;
  const isRoadmap = initialStyle === 'roadmap';

  const uniforms = {
    uDayTexture: { value: isRoadmap ? roadmapDayTexture : satelliteDayTexture },
    uNightTexture: { value: isRoadmap ? roadmapNightTexture : satelliteNightTexture },
    uNormalTexture: { value: normalTexture },
    uSpecularTexture: { value: specularTexture },
    uCloudsTexture: { value: cloudsTexture },
    uSunDirection: { value: new THREE.Vector3(0, 0, 1) },
    uCloudsOpacity: { value: isRoadmap ? 0.0 : 0.6 },
    uBumpScale: { value: isRoadmap ? 0.0 : 0.4 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'earth-surface';
  group.add(mesh);

  // Subtle separate cloud sphere with slight offset
  const cloudsGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.006, 64, 64);
  cloudsGeometry.rotateY(-Math.PI / 2);
  const cloudsMaterial = new THREE.MeshStandardMaterial({
    map: cloudsTexture,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
  cloudsMesh.name = 'earth-clouds';
  cloudsMesh.visible = !isRoadmap;
  group.add(cloudsMesh);

  const setMapStyle = (style: MapStyle): void => {
    currentStyle = style;
    if (style === 'roadmap') {
      material.uniforms.uDayTexture.value = roadmapDayTexture;
      material.uniforms.uNightTexture.value = roadmapNightTexture;
      material.uniforms.uCloudsOpacity.value = 0.0;
      material.uniforms.uBumpScale.value = 0.0;
      cloudsMesh.visible = false;
    } else {
      material.uniforms.uDayTexture.value = satelliteDayTexture;
      material.uniforms.uNightTexture.value = satelliteNightTexture;
      material.uniforms.uCloudsOpacity.value = 0.6;
      material.uniforms.uBumpScale.value = 0.4;
      cloudsMesh.visible = true;
    }
  };

  const getMapStyle = (): MapStyle => currentStyle;

  const updateSun = (date: Date): SubsolarCoordinates => {
    const subsolar = getSubsolarPoint(date);
    const [sx, sy, sz] = latLonToVector3(subsolar.latitude, subsolar.longitude, 1);
    material.uniforms.uSunDirection.value.set(sx, sy, sz).normalize();
    return subsolar;
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
    satelliteDayTexture.dispose();
    satelliteNightTexture.dispose();
    normalTexture.dispose();
    specularTexture.dispose();
    roadmapDayTexture.dispose();
    roadmapNightTexture.dispose();
    cloudsTexture.dispose();
    cloudsGeometry.dispose();
    cloudsMaterial.dispose();
  };

  return {
    group,
    mesh,
    cloudsMesh,
    updateSun,
    setMapStyle,
    getMapStyle,
    dispose,
  };
}
