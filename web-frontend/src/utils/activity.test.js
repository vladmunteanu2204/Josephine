import { describe, it, expect } from 'vitest';
import { activityMeta, gradeLabel, gradeTitle, ACTIVITY_ORDER } from './activity';

describe('activityMeta', () => {
  it('maps each known activity to metadata', () => {
    for (const key of ACTIVITY_ORDER) {
      const m = activityMeta(key);
      expect(m).toBeTruthy();
      expect(m.key).toBe(key);
      expect(typeof m.label).toBe('string');
      expect(m.Icon).toBeTruthy();
      expect(m.color).toMatch(/^#/);
    }
  });

  it('is case-insensitive', () => {
    expect(activityMeta('HIKE').key).toBe('hike');
  });

  it('returns null for unknown / empty', () => {
    expect(activityMeta('teleport')).toBeNull();
    expect(activityMeta('')).toBeNull();
    expect(activityMeta(null)).toBeNull();
    expect(activityMeta(undefined)).toBeNull();
  });
});

describe('gradeLabel', () => {
  it('renders the CAI grade for hikes', () => {
    expect(gradeLabel({ grade_cai: 'EE' })).toBe('EE');
    expect(gradeLabel({ grade_cai: 'ee' })).toBe('EE');   // uppercased
  });

  it('renders the ferrata grade for via_ferrata', () => {
    expect(gradeLabel({ activity_type: 'via_ferrata', ferrata_grade: 'c' })).toBe('Ferrata C');
  });

  it('returns null when there is no grade', () => {
    expect(gradeLabel({})).toBeNull();
    expect(gradeLabel(null)).toBeNull();
  });
});

describe('gradeTitle', () => {
  it('gives a descriptive CAI tooltip', () => {
    expect(gradeTitle({ grade_cai: 'EE' })).toContain('CAI EE');
  });

  it('gives a descriptive ferrata tooltip', () => {
    const t = gradeTitle({ activity_type: 'via_ferrata', ferrata_grade: 'C' });
    expect(t).toContain('C');
    expect(t.toLowerCase()).toContain('ferrata');
  });

  it('returns null when there is no grade', () => {
    expect(gradeTitle({})).toBeNull();
  });
});
