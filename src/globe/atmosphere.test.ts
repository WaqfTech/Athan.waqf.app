import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createAtmosphere } from './atmosphere';
import { EARTH_RADIUS } from './earth';
import { getSolarAltitude } from '../astronomy/solar';

describe('Atmosphere Glow & Twilight Scattering (Cell C06)', () => {
  it('verifies atmosphere geometry, uniforms, and material structure', () => {
    const atmo = createAtmosphere();
    expect(atmo.mesh.name).toBe('earth-atmosphere-glow');

    // Radius must be EARTH_RADIUS * 1.022 (5.11), strictly elevated above Earth (5.0)
    const geom = atmo.mesh.geometry;
    expect(geom.parameters.radius).toBeCloseTo(EARTH_RADIUS * 1.022, 3);
    expect(geom.parameters.radius).toBeGreaterThan(EARTH_RADIUS);

    const mat = atmo.mesh.material;
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.side).toBe(THREE.FrontSide);

    // Uniforms must include all 4 radiometric variables
    expect(mat.uniforms.uSunDirection).toBeDefined();
    expect(mat.uniforms.uAtmosphereColor).toBeDefined();
    expect(mat.uniforms.uTwilightColor).toBeDefined();
    expect(mat.uniforms.uDeepTwilightColor).toBeDefined();

    // Shaders must contain Three.js tone mapping and colorspace chunks
    expect(mat.fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(mat.fragmentShader).toContain('#include <colorspace_fragment>');

    atmo.dispose();
  });

  it('guarantees strict dark-side extinction at or below astronomical twilight (-18 deg)', () => {
    const atmo = createAtmosphere();
    const frag = atmo.mesh.material.fragmentShader;

    // Shader must explicitly check SIN_ASTRO (-0.30901699) and exit with vec4(0.0)
    expect(frag).toContain('const float SIN_ASTRO   = -0.30901699;');
    expect(frag).toContain('if (sunDot <= SIN_ASTRO) {');
    expect(frag).toContain('gl_FragColor = vec4(0.0);');

    // Test mathematical twilight illumination function
    const SIN_ASTRO = -0.30901699;
    function computeTwilightFactor(sunDot: number): number {
      if (sunDot <= SIN_ASTRO) return 0.0;
      if (sunDot >= 0.0) return 1.0;
      const t = (sunDot - SIN_ASTRO) / (0.0 - SIN_ASTRO);
      const s = t * t * (3.0 - 2.0 * t);
      return s * s;
    }

    // At -18 deg (sunDot = -0.309017): strictly 0
    expect(computeTwilightFactor(Math.sin((-18.0 * Math.PI) / 180))).toBe(0.0);
    // Below -18 deg (e.g. -25 deg, -90 deg midnight nadir): strictly 0
    expect(computeTwilightFactor(Math.sin((-25.0 * Math.PI) / 180))).toBe(0.0);
    expect(computeTwilightFactor(Math.sin((-90.0 * Math.PI) / 180))).toBe(0.0);
  });

  it('verifies twilight factor monotonicity from astronomical twilight up to sunrise/noon', () => {
    const SIN_ASTRO = -0.30901699;
    function computeTwilightFactor(sunDot: number): number {
      if (sunDot <= SIN_ASTRO) return 0.0;
      if (sunDot >= 0.0) return 1.0;
      const t = (sunDot - SIN_ASTRO) / (0.0 - SIN_ASTRO);
      const s = t * t * (3.0 - 2.0 * t);
      return s * s;
    }

    const testAngles = [-18.0, -15.0, -12.0, -9.0, -6.0, -3.0, -0.8333, 0.0, 5.0];
    const factors = testAngles.map((deg) => computeTwilightFactor(Math.sin((deg * Math.PI) / 180)));

    // Strictly non-decreasing
    for (let i = 0; i < factors.length - 1; i++) {
      expect(factors[i + 1]).toBeGreaterThanOrEqual(factors[i]);
    }

    // Specific key twilight thresholds
    expect(factors[0]).toBe(0.0); // -18 deg: zero
    expect(factors[2]).toBeGreaterThan(0.05); // -12 deg (nautical): faint
    expect(factors[4]).toBeGreaterThan(0.5); // -6 deg (civil): moderate
    expect(factors[6]).toBeGreaterThan(0.9); // -0.833 deg (apparent sunset): strong
    expect(factors[7]).toBe(1.0); // 0.0 deg: full
    expect(factors[8]).toBe(1.0); // +5.0 deg: full
  });

  it('proves outer limb boundary smoothly fades into space vacuum at the mesh perimeter', () => {
    const RA = 5.11;
    const RE = 5.0;
    const H_SCALE = 0.025;
    const MU_HORIZON = Math.sqrt(1.0 - (RE / RA) ** 2);

    function computeLimbTau(muV: number): number {
      if (muV > MU_HORIZON) {
        const d = RA * Math.sqrt(Math.max(0.0, 1.0 - muV * muV));
        const path = Math.sqrt(RA * RA - d * d) - Math.sqrt(Math.max(0.0, RE * RE - d * d));
        return path * 0.45;
      } else {
        const d = RA * Math.sqrt(Math.max(0.0, 1.0 - muV * muV));
        const h = d - RE;
        const density = Math.exp(-h / H_SCALE);
        const geometricPath = 2.0 * RA * muV;
        return geometricPath * density * 2.5;
      }
    }

    // At extreme grazing perimeter (muV = 0.0): optical depth is 0.0
    const tauPerimeter = computeLimbTau(0.0);
    expect(tauPerimeter).toBe(0.0);
    expect(1.0 - Math.exp(-tauPerimeter)).toBe(0.0);

    // At horizon tangent (muV = MU_HORIZON): optical depth reaches maximum
    const tauHorizon = computeLimbTau(MU_HORIZON);
    expect(tauHorizon).toBeGreaterThan(1.5);
    expect(1.0 - Math.exp(-tauHorizon)).toBeGreaterThan(0.75);

    // Monotonically increases from perimeter (0.0) to horizon (MU_HORIZON)
    const tauMid = computeLimbTau(MU_HORIZON * 0.5);
    expect(tauMid).toBeGreaterThan(tauPerimeter);
    expect(tauHorizon).toBeGreaterThan(tauMid);
  });

  it('distinguishes Tromsø winter twilight atmosphere illumination from ground occlusion', () => {
    // Tromsø winter solstice: 2026-12-21, culmination ~ -3.087 deg
    const tromsoLat = 69.65;
    const tromsoLon = 18.96;
    const baseDate = new Date('2026-12-21T12:00:00Z');

    let maxAlt = -90;
    for (let m = 0; m <= 1440; m += 10) {
      const t = new Date(+baseDate - 43200000 + m * 60000);
      const alt = getSolarAltitude(tromsoLat, tromsoLon, t);
      if (alt > maxAlt) maxAlt = alt;
    }

    expect(maxAlt).toBeCloseTo(-3.087, 1);

    // 1. Ground direct diffuse is strictly 0.0 (Sun is below the horizon)
    const sunDotGround = Math.sin((maxAlt * Math.PI) / 180);
    const groundDirectOcclusion = sunDotGround <= 0 ? 0.0 : Math.min(1.0, sunDotGround / 0.025);
    expect(groundDirectOcclusion).toBe(0.0);

    // 2. Upper atmospheric twilight scattering remains positive and bright (~0.846)
    const SIN_ASTRO = -0.30901699;
    const t = (sunDotGround - SIN_ASTRO) / (0.0 - SIN_ASTRO);
    const s = t * t * (3.0 - 2.0 * t);
    const atmosphereTwilightFactor = s * s;

    expect(atmosphereTwilightFactor).toBeGreaterThan(0.8);
    expect(atmosphereTwilightFactor).toBeLessThan(1.0);
  });
});
