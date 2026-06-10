import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DayPlanTimeline from './DayPlanTimeline';

const basePlan = {
  trail_name: 'Demo Loop',
  drive_min: 24, drive_basis: 'mapbox', sunset: '21:00', finish: '14:30',
  pace: 'average', daylight_ok: true, warnings: [], assumptions: { pace: 'average' },
  steps: [
    { time: '8:00', kind: 'depart', icon: 'car', label: 'Leave', sub: 'Set off' },
    { time: '8:34', kind: 'hike_start', icon: 'footprints', label: 'Demo Loop', sub: 'Trailhead' },
    { time: '11:00', kind: 'lunch', icon: 'utensils', label: 'Rifugio Demo', place: 'Rifugio Demo', sub: 'Lunch' },
    { time: '14:30', kind: 'finish', icon: 'flag', label: 'Back at the trailhead', sub: 'Done' },
  ],
};

describe('DayPlanTimeline', () => {
  it('renders every step with its time and label', () => {
    const { getByText } = render(<DayPlanTimeline plan={basePlan} />);
    expect(getByText('Leave')).toBeTruthy();
    expect(getByText('Rifugio Demo')).toBeTruthy();
    expect(getByText('Back at the trailhead')).toBeTruthy();
    expect(getByText('8:00')).toBeTruthy();
  });

  it('shows the daylight warning only when daylight_ok is false', () => {
    const ok = render(<DayPlanTimeline plan={basePlan} />);
    expect(ok.queryByRole('alert')).toBeNull();

    const risky = render(<DayPlanTimeline plan={{ ...basePlan, daylight_ok: false }} />);
    expect(risky.queryByRole('alert')).not.toBeNull();
  });

  it('flags an estimated drive with an asterisk note', () => {
    const est = render(<DayPlanTimeline plan={{ ...basePlan, drive_basis: 'estimate' }} />);
    expect(est.getByText(/drive time is an estimate/i)).toBeTruthy();
  });

  it('renders nothing when there are no steps', () => {
    const { container } = render(<DayPlanTimeline plan={{ steps: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it('degrades gracefully when optional fields are missing', () => {
    const minimal = { steps: [{ time: '9:00', kind: 'hike_start', label: 'Start' }] };
    const { getByText } = render(<DayPlanTimeline plan={minimal} />);
    expect(getByText('Start')).toBeTruthy();
  });
});
