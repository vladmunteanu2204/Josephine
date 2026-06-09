// Single source of truth for activity classification (walk / hike / trekking / via_ferrata)
// + CAI (T/E/EE/EEA) and via-ferrata (A–E) grade rendering. Used by catalog + detail.
import { Footprints, Mountain, MountainSnow, Link2 } from 'lucide-react';

export const ACTIVITY = {
  walk:        { key: 'walk',        label: 'Walk',        Icon: Footprints,   color: '#5fb87a' },
  hike:        { key: 'hike',        label: 'Hike',        Icon: Mountain,     color: '#c9a84c' },
  trekking:    { key: 'trekking',    label: 'Trekking',    Icon: MountainSnow, color: '#e0794f' },
  via_ferrata: { key: 'via_ferrata', label: 'Via ferrata', Icon: Link2,        color: '#e05a4f' },
};

export const ACTIVITY_ORDER = ['walk', 'hike', 'trekking', 'via_ferrata'];

export function activityMeta(type) {
  return ACTIVITY[(type || '').toLowerCase()] || null;
}

// CAI hiking scale (T/E/EE/EEA) full names, for tooltips / detail sublabels
export const CAI_GRADE = {
  T:   'Tourist — easy, well-marked paths',
  E:   'Hiker — mountain paths, sure-footedness needed',
  EE:  'Expert hiker — exposed or trackless terrain',
  EEA: 'Expert hiker with equipment — via-ferrata gear required',
};

// Returns the short grade chip text for a trail, or null.
// Via ferrata → "Ferrata C"; otherwise the CAI grade ("EE").
export function gradeLabel(trail) {
  if (!trail) return null;
  const at = (trail.activity_type || '').toLowerCase();
  if (at === 'via_ferrata' && trail.ferrata_grade) {
    return `Ferrata ${String(trail.ferrata_grade).toUpperCase()}`;
  }
  if (trail.grade_cai) return String(trail.grade_cai).toUpperCase();
  return null;
}

// Full descriptive title for the grade (for title= / aria), or null.
export function gradeTitle(trail) {
  if (!trail) return null;
  const at = (trail.activity_type || '').toLowerCase();
  if (at === 'via_ferrata' && trail.ferrata_grade) {
    return `Via-ferrata difficulty ${String(trail.ferrata_grade).toUpperCase()} (A easiest – E hardest)`;
  }
  const g = trail.grade_cai && String(trail.grade_cai).toUpperCase();
  return g ? (CAI_GRADE[g] ? `CAI ${g} — ${CAI_GRADE[g]}` : `CAI ${g}`) : null;
}
