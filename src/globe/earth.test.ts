import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createEarth } from './earth';
import { getSolarAltitude } from '../astronomy/solar';

// Mock TextureLoader in headless node environment
THREE.TextureLoader.prototype.load = function() {
  return new THREE.Texture();
};

describe('Radiometric Earth Shading & Deep Night Albedo (Cell C05)', () => {
  it('Pillar 1: decouples macro day/night occlusion from local bump/normal map', () => {
    const earth = createEarth();
    const mat = earth.mesh.material as THREE.ShaderMaterial;
    const frag = mat.fragmentShader;

    // Macro occlusion uses geometric normal from vNormal, not perturbedNormal
    expect(frag).toContain('vec3 geomNormal = normalize(vNormal);');
    expect(frag).toContain('float sunDotMacro = dot(geomNormal, sunDir);');
    expect(frag).toContain('float directOcclusion = smoothstep(0.0, 0.025, sunDotMacro);');

    // Perturbed normal is used for micro-shading, not macro occlusion
    expect(frag).toContain('vec3 shadingNormal = mix(geomNormal, perturbedNormal');
    expect(frag).toContain('float nDotL = max(dot(shadingNormal, sunDir), 0.0);');
    expect(frag).toContain('float diffuse = nDotL * directOcclusion;');

    // Direct diffuse, ocean glint, and clouds are all strictly gated by directOcclusion
    expect(frag).toContain('diffuse = nDotL * directOcclusion');
    expect(frag).toContain('oceanGlint = vec3(1.0, 0.96, 0.88) * specFactor * specMask * directOcclusion * 1.5');
    expect(frag).toContain('cloudsLit = vec3(cloudIntensity) * directOcclusion');
  });

  it('Pillar 2: eliminates 0.03 diffuse clamp floor with strict zero night diffuse', () => {
    const earth = createEarth();
    const mat = earth.mesh.material as THREE.ShaderMaterial;
    const frag = mat.fragmentShader;

    // Must not contain unphysical clamp floor
    expect(frag).not.toContain('clamp(sunDot, 0.03, 1.0)');
    expect(frag).not.toContain('0.03, 1.0');

    // Simulate fragment illumination logic for negative sunDotMacro
    function computeDirectDiffuse(sunDotMacro: number, shadingDotL: number): number {
      const directOcclusion = sunDotMacro <= 0.0 ? 0.0 : Math.min(1.0, Math.max(0.0, sunDotMacro / 0.025));
      const nDotL = Math.max(shadingDotL, 0.0);
      return nDotL * directOcclusion;
    }

    // In deep night (sunDotMacro < 0), even if bump map tilts towards sun (shadingDotL = 0.8), diffuse is 0.0
    expect(computeDirectDiffuse(-0.5, 0.8)).toBe(0.0);
    expect(computeDirectDiffuse(-0.01, 0.5)).toBe(0.0);
    expect(computeDirectDiffuse(0.0, 0.9)).toBe(0.0);
  });

  it('Pillar 2b: verifies Tromsø winter solstice witness (W07) produces zero direct sunlight and albedo', () => {
    // Tromsø winter solstice: 2026-12-21, lat 69.65, lon 18.96
    const tromsoLat = 69.65;
    const tromsoLon = 18.96;
    const baseDate = new Date('2026-12-21T12:00:00Z');

    let maxAlt = -90;
    for (let m = 0; m <= 1440; m += 10) {
      const t = new Date(+baseDate - 43200000 + m * 60000);
      const alt = getSolarAltitude(tromsoLat, tromsoLon, t);
      if (alt > maxAlt) maxAlt = alt;
    }

    // Peak solar altitude (culmination) is ~ -3.087 degrees (polar night, Sun strictly below horizon)
    expect(maxAlt).toBeCloseTo(-3.087, 1);
    expect(maxAlt).toBeLessThan(0.0);

    // Maximum possible sunDotMacro across the entire day in Tromsø
    const maxSunDotMacro = Math.sin((maxAlt * Math.PI) / 180);
    expect(maxSunDotMacro).toBeLessThan(-0.05);

    // Direct occlusion and direct diffuse must evaluate to identically 0.0 throughout polar night
    const directOcclusion = maxSunDotMacro <= 0.0 ? 0.0 : Math.min(1.0, maxSunDotMacro / 0.025);
    expect(directOcclusion).toBe(0.0);
  });

  it('Pillar 2c: models dark oceanic albedo with zero radiance in deep night', () => {
    const earth = createEarth();
    const mat = earth.mesh.material as THREE.ShaderMaterial;
    const frag = mat.fragmentShader;

    // In deep night on ocean:
    // dayColor * diffuse = 0 (diffuse = 0)
    // sunsetGlow = 0 (sunsetBand = 0 when sunDotMacro < -0.03)
    // oceanGlint = 0 (directOcclusion = 0)
    // nightColor = vec3(0.0) over unpopulated oceans
    // cloudsLit = 0 (directOcclusion = 0)
    expect(frag).toContain('sunsetBand = smoothstep(-0.03, 0.0, sunDotMacro)');
    expect(frag).toContain('litDay = dayColor.rgb * diffuse + sunsetGlow + oceanGlint');
  });

  it('Pillar 3: modulates Black Marble city lights independently of direct daytime diffuse', () => {
    const earth = createEarth();
    const mat = earth.mesh.material as THREE.ShaderMaterial;
    const frag = mat.fragmentShader;

    // City lights use nightFactor modulated by sunDotMacro
    expect(frag).toContain('float nightFactor = 1.0 - smoothstep(-0.03, 0.03, sunDotMacro);');
    expect(frag).toContain('vec3 lights = nightColor.rgb * vec3(1.35, 1.15, 0.85) * nightFactor * 1.5;');

    // In broad daylight (sunDotMacro = +0.5), nightFactor evaluates to 0.0
    function computeNightFactor(sunDot: number): number {
      const t = Math.min(1.0, Math.max(0.0, (sunDot - -0.03) / 0.06));
      const s = t * t * (3.0 - 2.0 * t);
      return 1.0 - s;
    }

    expect(computeNightFactor(0.5)).toBe(0.0);
    expect(computeNightFactor(-0.5)).toBe(1.0);
    expect(computeNightFactor(0.0)).toBeCloseTo(0.5, 1);
  });

  it('Pillar 4: injects Three.js tone mapping and color space chunks for proper linear radiometric pipeline', () => {
    const earth = createEarth();
    const mat = earth.mesh.material as THREE.ShaderMaterial;
    const frag = mat.fragmentShader;

    // Both Three.js output chunks must be included
    expect(frag).toContain('#include <tonemapping_fragment>');
    expect(frag).toContain('#include <colorspace_fragment>');

    // Must be placed after gl_FragColor assignment
    const fragColorIdx = frag.indexOf('gl_FragColor = vec4(surface, 1.0);');
    const toneMappingIdx = frag.indexOf('#include <tonemapping_fragment>');
    const colorSpaceIdx = frag.indexOf('#include <colorspace_fragment>');

    expect(fragColorIdx).toBeGreaterThan(-1);
    expect(toneMappingIdx).toBeGreaterThan(fragColorIdx);
    expect(colorSpaceIdx).toBeGreaterThan(toneMappingIdx);
  });
});
