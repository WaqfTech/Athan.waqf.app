import { describe, it, expect } from 'vitest';
import { initializeApp } from './main';

describe('App smoke test', () => {
  it('initializes without throwing', () => {
    const result = initializeApp();
    expect(result).toBeDefined();
    expect(typeof result.initialized).toBe('boolean');
  });
});
