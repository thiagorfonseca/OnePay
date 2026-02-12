import { describe, it, expect } from 'vitest';
import { computeExpiresAt, suggestFefoBatch } from '../utils';

describe('inventory utils', () => {
  it('computes expires at with hours', () => {
    const base = new Date('2026-02-10T10:00:00Z');
    const expires = computeExpiresAt(base, 24);
    expect(expires).toBe('2026-02-11T10:00:00.000Z');
  });

  it('suggests FEFO batch', () => {
    const batch = suggestFefoBatch([
      { expiry_date: '2026-05-01' },
      { expiry_date: '2026-03-01' },
    ]);
    expect(batch?.expiry_date).toBe('2026-03-01');
  });
});
