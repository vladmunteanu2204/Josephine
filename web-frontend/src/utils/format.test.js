import { describe, it, expect } from 'vitest';
import { fmtDuration } from './format';

describe('fmtDuration', () => {
  it('converts decimal hours to h:mm', () => {
    expect(fmtDuration(4.42)).toBe('4:25');   // 4.42*60 = 265.2 -> 265 min
    expect(fmtDuration(2)).toBe('2:00');
    expect(fmtDuration(0.5)).toBe('0:30');
    expect(fmtDuration(2.67)).toBe('2:40');
  });

  it('zero-pads the minutes', () => {
    expect(fmtDuration(1.05)).toBe('1:03');   // 63 min
  });

  it('returns null for missing / zero / negative / non-numeric', () => {
    expect(fmtDuration(0)).toBeNull();
    expect(fmtDuration(null)).toBeNull();
    expect(fmtDuration(undefined)).toBeNull();
    expect(fmtDuration(-1)).toBeNull();
    expect(fmtDuration('abc')).toBeNull();
  });
});
