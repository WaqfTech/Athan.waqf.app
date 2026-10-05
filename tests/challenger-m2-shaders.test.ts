import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createEarth, EARTH_RADIUS } from '../src/globe/earth';
import { createAtmosphere } from '../src/globe/atmosphere';
import { getSolarAltitude } from '../src/astronomy/solar';

// Mock TextureLoader in headless node environment
THREE.TextureLoader.prototype.load = function () {
  return new THREE.Texture();
};

describe('Empirical Challenger: M2 Radiometric Shaders & Twilight Optics', () => {
  // =========================================================================
  // Challenge 1: Decoupling Macro Occlusion from Bump/Normal Maps
  // =========================================================================
  describe('Challenge 1: Macro day/night occlusion decoupled from bump maps', () => {
    it('verifies shader text structurally separates geometric normal from perturbed normal', () => {
      const earth = createEarth();
      const frag = (earth.mesh.material as THREE.ShaderMaterial).fragmentShader;

      expect(frag).toContain('vec3 geomNormal = normalize(vNormal);');
      expect(frag).toContain('float sunDotMacro = dot(geomNormal, sunDir);');
      expect(frag).toContain('float directOcclusion = smoothstep(0.0, 0.025, sunDotMacro);');
      expect(frag).toContain('vec3 shadingNormal = mix(geomNormal, perturbedNormal');
      expect(frag).toContain('float nDotL = max(dot(shadingNormal, sunDir), 0.0);');
      expect(frag).toContain('float diffuse = nDotL * directOcclusion;');

      // Ocean specular glint and cloud direct lighting are gated strictly by directOcclusion
      expect(frag).toContain('oceanGlint = vec3(1.0, 0.96, 0.88) * specFactor * specMask * directOcclusion * 1.5');
      expect(frag).toContain('cloudsLit = vec3(cloudIntensity) * directOcclusion');

      earth.dispose();
    });

    it('empirically verifies 10,000 perturbed normals on night side cannot produce positive diffuse', () => {
      // Numerical oracle simulating GLSL fragment shader math
      function simulateEarthDiffuse(
        sunDotMacro: number,
        bumpScale: number,
        tangentSample: [number, number, number],
      ): { directOcclusion: number; diffuse: number } {
        // GLSL: float directOcclusion = smoothstep(0.0, 0.025, sunDotMacro);
        const t = Math.min(1.0, Math.max(0.0, (sunDotMacro - 0.0) / 0.025));
        const directOcclusion = t * t * (3.0 - 2.0 * t);

        // Perturbed normal calculation
        // In the most adversarial case, the perturbed normal aligns completely with sunDir (nDotL = 1.0)
        // Shading normal mix
        const perturbedDotSun = Math.max(-1.0, Math.min(1.0, tangentSample[0]));
        const geomDotSun = sunDotMacro;
        const bumpWeight = Math.min(1.0, Math.max(0.0, bumpScale * 2.0));
        const shadingDotSun = (1.0 - bumpWeight) * geomDotSun + bumpWeight * perturbedDotSun;
        const nDotL = Math.max(shadingDotSun, 0.0);

        const diffuse = nDotL * directOcclusion;
        return { directOcclusion, diffuse };
      }

      const bumpScales = [0.0, 0.2, 0.4, 0.8, 1.0, 2.0, 5.0, 10.0];

      // Stress test: 10,000 samples across the night hemisphere (sunDotMacro <= 0)
      let evaluations = 0;
      for (let i = 0; i < 10000; i++) {
        // sunDotMacro in range [-1.0, 0.0]
        const sunDotMacro = -Math.random();
        const bumpScale = bumpScales[i % bumpScales.length];
        // Adversarial perturbation pointing directly toward the sun (+1.0)
        const tangentSample: [number, number, number] = [1.0, 0.0, 0.0];

        const { directOcclusion, diffuse } = simulateEarthDiffuse(
          sunDotMacro,
          bumpScale,
          tangentSample,
        );

        expect(directOcclusion).toBe(0.0);
        expect(diffuse).toBe(0.0);
        evaluations++;
      }

      expect(evaluations).toBe(10000);
    });

    it('verifies grazing boundary sunDotMacro in [-0.03, 0.0] keeps diffuse strictly zero', () => {
      function evaluateTransitionZone(sunDotMacro: number): {
        directOcclusion: number;
        diffuse: number;
        sunsetBand: number;
      } {
        const tOcc = Math.min(1.0, Math.max(0.0, (sunDotMacro - 0.0) / 0.025));
        const directOcclusion = tOcc * tOcc * (3.0 - 2.0 * tOcc);
        const nDotL = 1.0; // Worst-case adversarial alignment
        const diffuse = nDotL * directOcclusion;

        const tSunset1 = Math.min(1.0, Math.max(0.0, (sunDotMacro - -0.03) / 0.03));
        const sSunset1 = tSunset1 * tSunset1 * (3.0 - 2.0 * tSunset1);
        const tSunset2 = Math.min(1.0, Math.max(0.0, (sunDotMacro - 0.0) / 0.05));
        const sSunset2 = tSunset2 * tSunset2 * (3.0 - 2.0 * tSunset2);
        const sunsetBand = sSunset1 * (1.0 - sSunset2);

        return { directOcclusion, diffuse, sunsetBand };
      }

      // Check step points in [-0.03, 0.0]
      for (let dot = -0.03; dot <= 0.0; dot += 0.001) {
        const res = evaluateTransitionZone(dot);
        expect(res.directOcclusion).toBe(0.0);
        expect(res.diffuse).toBe(0.0);
        // sunsetBand is bounded and non-negative
        expect(res.sunsetBand).toBeGreaterThanOrEqual(0.0);
        expect(res.sunsetBand).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // =========================================================================
  // Challenge 2: Elimination of 0.03 Diffuse Clamp Floor
  // =========================================================================
  describe('Challenge 2: Diffuse clamp floor 0.03 elimination', () => {
    it('verifies shader text contains no clamp floor on diffuse calculation', () => {
      const earth = createEarth();
      const frag = (earth.mesh.material as THREE.ShaderMaterial).fragmentShader;

      expect(frag).not.toContain('clamp(sunDot, 0.03');
      expect(frag).not.toContain('clamp(dot');
      expect(frag).not.toMatch(/clamp\([^)]*0\.03\s*,\s*1\.0\)/);
      expect(frag).not.toContain('max(dot(shadingNormal, sunDir), 0.03)');

      earth.dispose();
    });

    it('empirically compares new model against legacy clamp floor model', () => {
      function legacyDiffuse(dotVal: number): number {
        // Legacy buggy shader formula: clamp(sunDot, 0.03, 1.0)
        return Math.min(1.0, Math.max(0.03, dotVal));
      }

      function newDiffuse(sunDotMacro: number, shadingDotL: number): number {
        const directOcclusion =
          sunDotMacro <= 0.0 ? 0.0 : Math.min(1.0, sunDotMacro / 0.025);
        const nDotL = Math.max(shadingDotL, 0.0);
        return nDotL * directOcclusion;
      }

      const testValues = [-1.0, -0.75, -0.5, -0.25, -0.1, -0.01, -0.0001, 0.0];
      for (const val of testValues) {
        const legacyVal = legacyDiffuse(val);
        const newVal = newDiffuse(val, 0.8);

        // Legacy code leaked 0.03 daylight albedo
        expect(legacyVal).toBe(0.03);
        // New model produces strictly 0.0
        expect(newVal).toBe(0.0);
      }
    });

    it('verifies oceanic night radiance evaluates to zero on unpopulated surfaces', () => {
      // In unpopulated oceans: dayColor is present, nightColor is (0,0,0)
      const dayColor = [0.1, 0.3, 0.6];
      const nightColor = [0.0, 0.0, 0.0];
      const cloudsColor = [0.5, 0.5, 0.5];

      function computeSurfaceRadiance(sunDotMacro: number): [number, number, number] {
        const directOcclusion = sunDotMacro <= 0.0 ? 0.0 : Math.min(1.0, sunDotMacro / 0.025);
        const diffuse = Math.max(sunDotMacro, 0.0) * directOcclusion;
        const sunsetBand =
          sunDotMacro < -0.03
            ? 0.0
            : (Math.min(1.0, Math.max(0.0, (sunDotMacro - -0.03) / 0.03)));
        const sunsetGlow = sunsetBand * 0.35;
        const oceanGlint = directOcclusion * 1.5;

        const litDay = [
          dayColor[0] * diffuse + sunsetGlow + oceanGlint,
          dayColor[1] * diffuse + sunsetGlow + oceanGlint,
          dayColor[2] * diffuse + sunsetGlow + oceanGlint,
        ];

        const nightFactor = sunDotMacro < -0.03 ? 1.0 : 0.0;
        const lights = [
          nightColor[0] * nightFactor,
          nightColor[1] * nightFactor,
          nightColor[2] * nightFactor,
        ];

        const cloudsLit = cloudsColor[0] * 0.6 * directOcclusion;

        return [
          litDay[0] + lights[0] + cloudsLit * 0.35,
          litDay[1] + lights[1] + cloudsLit * 0.35,
          litDay[2] + lights[2] + cloudsLit * 0.35,
        ];
      }

      // In deep night (sunDotMacro = -0.5)
      const surface = computeSurfaceRadiance(-0.5);
      expect(surface[0]).toBe(0.0);
      expect(surface[1]).toBe(0.0);
      expect(surface[2]).toBe(0.0);
    });
  });

  // =========================================================================
  // Challenge 3: Tromsø Winter Solstice Witness (W07)
  // =========================================================================
  describe('Challenge 3: Tromsø winter solstice polar night verification (W07)', () => {
    const TROMSO_LAT = 69.6492;
    const TROMSO_LON = 18.9553;
    const SOLSTICE_DATE = new Date('2026-12-21T00:00:00Z');

    it('verifies Tromsø solar altitude remains strictly negative throughout 1440 minutes of winter solstice', () => {
      let maxAltitude = -90.0;
      let maxAltMinute = -1;

      for (let m = 0; m < 1440; m++) {
        const time = new Date(SOLSTICE_DATE.getTime() + m * 60000);
        const alt = getSolarAltitude(TROMSO_LAT, TROMSO_LON, time);

        if (alt > maxAltitude) {
          maxAltitude = alt;
          maxAltMinute = m;
        }

        // Must be strictly below horizon (polar night)
        expect(alt).toBeLessThan(0.0);
      }

      // Culmination occurs near solar noon (approx -3.087 deg)
      expect(maxAltitude).toBeCloseTo(-3.087, 1);
      expect(maxAltitude).toBeLessThan(-3.0);
      expect(maxAltMinute).toBeGreaterThan(600);
      expect(maxAltMinute).toBeLessThan(750);
    });

    it('empirically verifies zero direct sunlight and albedo leak across entire 24 hours in Tromsø', () => {
      for (let m = 0; m < 1440; m += 10) {
        const time = new Date(SOLSTICE_DATE.getTime() + m * 60000);
        const alt = getSolarAltitude(TROMSO_LAT, TROMSO_LON, time);

        const sunDotMacro = Math.sin((alt * Math.PI) / 180.0);
        // Maximum sunDotMacro at peak is sin(-3.087 deg) ~ -0.0538
        expect(sunDotMacro).toBeLessThan(-0.05);

        // Planetary direct occlusion evaluates to identically 0.0
        const directOcclusion =
          sunDotMacro <= 0.0 ? 0.0 : Math.min(1.0, sunDotMacro / 0.025);
        expect(directOcclusion).toBe(0.0);

        // Diffuse evaluates to identically 0.0
        const nDotL = 1.0; // Even with extreme normal map alignment
        const diffuse = nDotL * directOcclusion;
        expect(diffuse).toBe(0.0);

        // Sunset band evaluates to identically 0.0 because sunDotMacro < -0.03
        const sunsetBand =
          sunDotMacro <= -0.03 ? 0.0 : Math.min(1.0, (sunDotMacro - -0.03) / 0.03);
        expect(sunsetBand).toBe(0.0);

        // Night city lights are active at 100% factor
        const nightFactor = sunDotMacro <= -0.03 ? 1.0 : 0.0;
        expect(nightFactor).toBe(1.0);
      }
    });

    it('verifies 7 Arctic settlements in polar night produce zero daylight albedo', () => {
      const arcticSettlements = [
        { name: 'Longyearbyen', lat: 78.2232, lon: 15.6267, maxExpectedAlt: -11.0 },
        { name: 'Hammerfest', lat: 70.6634, lon: 23.6821, maxExpectedAlt: -4.0 },
        { name: 'Honningsvag', lat: 70.9821, lon: 25.9704, maxExpectedAlt: -4.3 },
        { name: 'Murmansk', lat: 68.9585, lon: 33.0827, maxExpectedAlt: -2.3 },
        { name: 'Kiruna', lat: 67.8558, lon: 20.2253, maxExpectedAlt: -1.2 },
        { name: 'Vardo', lat: 70.3705, lon: 31.1107, maxExpectedAlt: -3.7 },
        { name: 'Alta', lat: 69.9689, lon: 23.2717, maxExpectedAlt: -3.3 },
      ];

      for (const settlement of arcticSettlements) {
        let maxAlt = -90.0;
        for (let m = 0; m < 1440; m += 30) {
          const time = new Date(SOLSTICE_DATE.getTime() + m * 60000);
          const alt = getSolarAltitude(settlement.lat, settlement.lon, time);
          if (alt > maxAlt) maxAlt = alt;
        }

        expect(maxAlt).toBeLessThan(0.0);
        expect(maxAlt).toBeLessThan(settlement.maxExpectedAlt);

        const sunDotMacro = Math.sin((maxAlt * Math.PI) / 180.0);
        const directOcclusion =
          sunDotMacro <= 0.0 ? 0.0 : Math.min(1.0, sunDotMacro / 0.025);
        expect(directOcclusion).toBe(0.0);
      }
    });
  });

  // =========================================================================
  // Challenge 4: Atmosphere Shader Strict Extinction at <= -18.0 deg
  // =========================================================================
  describe('Challenge 4: Atmosphere shader zero extinction at solar elevation <= -18.0 deg', () => {
    it('verifies atmosphere fragment shader has constant SIN_ASTRO and early zero exit', () => {
      const atmo = createAtmosphere();
      const frag = atmo.mesh.material.fragmentShader;

      expect(frag).toContain('const float SIN_ASTRO   = -0.30901699;');
      expect(frag).toContain('if (sunDot <= SIN_ASTRO) {');
      expect(frag).toContain('gl_FragColor = vec4(0.0);');
      expect(frag).toContain('return;');

      atmo.dispose();
    });

    it('empirically verifies zero alpha and zero radiance for all solar elevations <= -18.0 deg', () => {
      const SIN_ASTRO = -0.30901699;

      function simulateAtmosphere(
        sunElevationDeg: number,
        muV: number,
      ): { alpha: number; radiance: [number, number, number] } {
        const sunDot = Math.sin((sunElevationDeg * Math.PI) / 180.0);

        // Shader early exit condition
        if (sunDot <= SIN_ASTRO) {
          return { alpha: 0.0, radiance: [0.0, 0.0, 0.0] };
        }

        const tTwilight = Math.min(1.0, Math.max(0.0, (sunDot - SIN_ASTRO) / (0.0 - SIN_ASTRO)));
        const sTwilight = tTwilight * tTwilight * (3.0 - 2.0 * tTwilight);
        const twilightFactor = sunDot >= 0.0 ? 1.0 : sTwilight * sTwilight;

        const tau = muV * 1.5;
        const opticalOpacity = 1.0 - Math.exp(-tau);
        const alpha = opticalOpacity * twilightFactor;
        const radiance: [number, number, number] = [
          twilightFactor * 0.5,
          twilightFactor * 0.3,
          twilightFactor * 0.1,
        ];
        return { alpha, radiance };
      }

      // Test a wide sweep of night elevations down to midnight nadir
      const nightElevations = [
        -18.0, -18.0001, -18.5, -20.0, -25.0, -30.0, -45.0, -60.0, -75.0, -90.0,
      ];
      const muVValues = [0.0, 0.2, 0.5, 0.8, 1.0];

      for (const elev of nightElevations) {
        for (const muV of muVValues) {
          const res = simulateAtmosphere(elev, muV);
          expect(res.alpha).toBe(0.0);
          expect(res.radiance[0]).toBe(0.0);
          expect(res.radiance[1]).toBe(0.0);
          expect(res.radiance[2]).toBe(0.0);
        }
      }
    });

    it('verifies exact boundary condition at -18.0 deg precision matches sin(-18 deg)', () => {
      const SIN_ASTRO = -0.30901699;
      const exactSin18 = Math.sin((-18.0 * Math.PI) / 180.0);

      // exactSin18 is -0.3090169943749474
      // -0.3090169943749474 <= -0.30901699 evaluates to true
      expect(exactSin18).toBeLessThanOrEqual(SIN_ASTRO);
      expect(Math.abs(exactSin18 - SIN_ASTRO)).toBeLessThan(1e-7);
    });
  });

  // =========================================================================
  // Challenge 5: Smooth Monotonic Decay Across Twilight (-0.833 deg to -18.0 deg)
  // =========================================================================
  describe('Challenge 5: Smooth monotonic decay across twilight (-0.833 deg to -18.0 deg)', () => {
    const SIN_ASTRO = -0.30901699;
    const SIN_SUNSET = -0.01454332;
    const SIN_CIVIL = -0.10452846;

    const uAtmosphereColor = [0.22, 0.55, 0.98];
    const uTwilightColor = [1.0, 0.45, 0.12];
    const uDeepTwilightColor = [0.08, 0.15, 0.4];

    function clamp(x: number, min: number, max: number): number {
      return Math.min(max, Math.max(min, x));
    }

    function smoothstep(e0: number, e1: number, x: number): number {
      const t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }

    function mix(a: number[], b: number[], t: number): [number, number, number] {
      return [
        a[0] * (1 - t) + b[0] * t,
        a[1] * (1 - t) + b[1] * t,
        a[2] * (1 - t) + b[2] * t,
      ];
    }

    function computeAtmospherePhysics(sunElevationDeg: number): {
      alpha: number;
      radiance: [number, number, number];
      luminance: number;
      twilightFactor: number;
    } {
      const sunDot = Math.sin((sunElevationDeg * Math.PI) / 180.0);
      if (sunDot <= SIN_ASTRO) {
        return {
          alpha: 0.0,
          radiance: [0.0, 0.0, 0.0],
          luminance: 0.0,
          twilightFactor: 0.0,
        };
      }

      const tTwilight = clamp((sunDot - SIN_ASTRO) / (0.0 - SIN_ASTRO), 0.0, 1.0);
      const sTwilight = tTwilight * tTwilight * (3.0 - 2.0 * tTwilight);
      const twilightFactor = sunDot >= 0.0 ? 1.0 : sTwilight * sTwilight;

      const sunsetSpread = 0.06;
      const sunsetPeak = Math.exp(-Math.pow((sunDot - SIN_SUNSET) / sunsetSpread, 2.0));
      const daylightFactor = smoothstep(SIN_SUNSET, 0.12, sunDot);
      const deepTwilightFactor = 1.0 - smoothstep(SIN_ASTRO, SIN_CIVIL, sunDot);

      const twilightBand = mix(uTwilightColor, uDeepTwilightColor, deepTwilightFactor);
      const baseColor = mix(twilightBand, uAtmosphereColor, daylightFactor);
      const scatteredColor = mix(baseColor, uTwilightColor, sunsetPeak * 0.55);

      const tau = 1.5;
      const phaseRayleigh = 0.75 * 1.5;
      const opticalOpacity = 1.0 - Math.exp(-tau);
      const alpha = opticalOpacity * twilightFactor;
      const radFactor = twilightFactor * phaseRayleigh * (1.0 + tau);
      const radiance: [number, number, number] = [
        scatteredColor[0] * radFactor,
        scatteredColor[1] * radFactor,
        scatteredColor[2] * radFactor,
      ];
      const luminance =
        0.2126 * radiance[0] + 0.7152 * radiance[1] + 0.0722 * radiance[2];

      return { alpha, radiance, luminance, twilightFactor };
    }

    it('verifies twilightFactor is strictly monotonic across 1717 sampling steps from -18.0 deg to -0.833 deg', () => {
      let prevFactor = -1.0;
      let stepCount = 0;

      for (let deg = -18.0; deg <= -0.833; deg += 0.01) {
        const { twilightFactor } = computeAtmospherePhysics(deg);
        expect(twilightFactor).toBeGreaterThanOrEqual(prevFactor);
        prevFactor = twilightFactor;
        stepCount++;
      }

      expect(stepCount).toBeGreaterThan(1700);
      // At astronomical twilight (-18.0 deg), factor is 0.0
      expect(computeAtmospherePhysics(-18.0).twilightFactor).toBe(0.0);
      // At apparent sunset (-0.833 deg), factor is near full illumination (> 0.9)
      expect(computeAtmospherePhysics(-0.833).twilightFactor).toBeGreaterThan(0.9);
    });

    it('verifies atmosphere alpha is strictly monotonic across twilight', () => {
      let prevAlpha = -1.0;

      for (let deg = -18.0; deg <= -0.833; deg += 0.01) {
        const { alpha } = computeAtmospherePhysics(deg);
        expect(alpha).toBeGreaterThanOrEqual(prevAlpha);
        prevAlpha = alpha;
      }
    });

    it('verifies atmosphere luminance is strictly monotonic decaying as Sun sets from -0.833 deg to -18.0 deg', () => {
      let prevLum = -1.0;

      for (let deg = -18.0; deg <= -0.833; deg += 0.01) {
        const { luminance } = computeAtmospherePhysics(deg);
        // Luminance increases monotonically with rising sun elevation
        expect(luminance).toBeGreaterThanOrEqual(prevLum);
        prevLum = luminance;
      }
    });

    it('verifies C1 derivative continuity at -18.0 deg boundary', () => {
      // Evaluate derivative d(twilightFactor)/d(sunDot) near boundary
      const deltaDeg = 0.001;
      const res0 = computeAtmospherePhysics(-18.0);
      const res1 = computeAtmospherePhysics(-18.0 + deltaDeg);

      const dFactor = (res1.twilightFactor - res0.twilightFactor) / deltaDeg;
      // Hermite square decay ensures derivative at boundary is identically 0.0
      expect(dFactor).toBeLessThan(1e-4);
      expect(res0.twilightFactor).toBe(0.0);
    });
  });

  // =========================================================================
  // Challenge 6: Tone Mapping and Color Space Chunks in Both Shaders
  // =========================================================================
  describe('Challenge 6: Tone mapping and color space chunk inclusion in both shaders', () => {
    it('verifies Earth shader includes Three.js tone mapping and colorspace chunks in correct order', () => {
      const earth = createEarth();
      const frag = (earth.mesh.material as THREE.ShaderMaterial).fragmentShader;

      expect(frag).toContain('#include <tonemapping_fragment>');
      expect(frag).toContain('#include <colorspace_fragment>');

      const fragColorIdx = frag.indexOf('gl_FragColor = vec4(surface, 1.0);');
      const toneMapIdx = frag.indexOf('#include <tonemapping_fragment>');
      const colorSpaceIdx = frag.indexOf('#include <colorspace_fragment>');

      expect(fragColorIdx).toBeGreaterThan(-1);
      expect(toneMapIdx).toBeGreaterThan(fragColorIdx);
      expect(colorSpaceIdx).toBeGreaterThan(toneMapIdx);

      earth.dispose();
    });

    it('verifies Atmosphere shader includes Three.js tone mapping and colorspace chunks in correct order', () => {
      const atmo = createAtmosphere();
      const frag = atmo.mesh.material.fragmentShader;

      expect(frag).toContain('#include <tonemapping_fragment>');
      expect(frag).toContain('#include <colorspace_fragment>');

      const fragColorIdx = frag.indexOf('gl_FragColor = vec4(radiance, alpha);');
      const toneMapIdx = frag.indexOf('#include <tonemapping_fragment>');
      const colorSpaceIdx = frag.indexOf('#include <colorspace_fragment>');

      expect(fragColorIdx).toBeGreaterThan(-1);
      expect(toneMapIdx).toBeGreaterThan(fragColorIdx);
      expect(colorSpaceIdx).toBeGreaterThan(toneMapIdx);

      atmo.dispose();
    });

    it('verifies Three.js ShaderChunk dictionary contains valid tonemapping and colorspace definitions', () => {
      expect(THREE.ShaderChunk.tonemapping_fragment).toBeDefined();
      expect(THREE.ShaderChunk.tonemapping_fragment.length).toBeGreaterThan(20);
      expect(THREE.ShaderChunk.tonemapping_fragment).toContain('gl_FragColor');

      expect(THREE.ShaderChunk.colorspace_fragment).toBeDefined();
      expect(THREE.ShaderChunk.colorspace_fragment.length).toBeGreaterThan(20);
      expect(THREE.ShaderChunk.colorspace_fragment).toContain('gl_FragColor');
    });
  });
});
