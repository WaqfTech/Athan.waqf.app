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
    // Construct TBN matrix for normal/bump relief
    mat3 tbn = mat3(normalize(vTangent), normalize(vBitangent), normalize(vNormal));
    vec3 normalMapSample = texture2D(uNormalTexture, vUv).xyz * 2.0 - 1.0;
    vec3 perturbedNormal = normalize(tbn * (normalMapSample * vec3(uBumpScale, uBumpScale, 1.0)));
    vec3 normal = mix(normalize(vNormal), perturbedNormal, clamp(uBumpScale * 2.0, 0.0, 1.0));

    vec3 sunDir = normalize(uSunDirection);

    // Cosine of angle between surface normal and sun direction
    float sunDot = dot(normal, sunDir);

    // Day / Night transition band between -0.08 and +0.08
    float dayFactor = smoothstep(-0.08, 0.08, sunDot);

    // Sample textures
    vec4 dayColor = texture2D(uDayTexture, vUv);
    vec4 nightColor = texture2D(uNightTexture, vUv);
    vec4 cloudsColor = texture2D(uCloudsTexture, vUv);
    float specMask = texture2D(uSpecularTexture, vUv).r;

    // Enhance night city lights brightness and warm gold glow
    vec3 lights = nightColor.rgb * vec3(1.35, 1.15, 0.85) * (1.0 - dayFactor) * 1.5;

    // Sunset / sunrise warm rim in the terminator transition zone
    float terminator = 1.0 - smoothstep(0.0, 0.16, abs(sunDot));
    vec3 sunsetGlow = vec3(1.0, 0.45, 0.16) * terminator * 0.35;

    // Direct sunlight diffuse scaling
    float diffuse = clamp(sunDot, 0.03, 1.0);

    // Ocean specular reflection (sun glint)
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 reflectDir = reflect(-sunDir, normal);
    float specFactor = pow(max(dot(reflectDir, viewDir), 0.0), 28.0);
    vec3 oceanGlint = vec3(1.0, 0.96, 0.88) * specFactor * specMask * clamp(sunDot + 0.05, 0.0, 1.0) * 1.35;

    vec3 litDay = dayColor.rgb * diffuse + sunsetGlow + oceanGlint;

    // Blend clouds
    float cloudIntensity = cloudsColor.r * uCloudsOpacity;
    vec3 cloudsLit = vec3(cloudIntensity) * clamp(sunDot + 0.1, 0.0, 1.0);

    // Combine day surface and night lights
    vec3 surface = mix(lights, litDay, dayFactor);
    surface += cloudsLit * dayFactor * 0.35;

    gl_FragColor = vec4(surface, 1.0);
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
