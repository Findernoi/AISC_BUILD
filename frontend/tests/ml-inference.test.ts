import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import placementCases from '../src/data/models/placement_cases.json' with { type: 'json' };
import workforceCases from '../src/data/models/workforce_cases.json' with { type: 'json' };
import { predictPlacement, predictWorkforce, placementMetadata, workforceMetadata } from '../src/lib/mlInference';

test('all 15 placement fixtures match Python below 1e-6, including missing values', () => {
  assert.deepEqual(placementMetadata.features, ['CGPA', 'Projects']);
  assert.equal(placementCases.cases.length, 15);
  for (const c of placementCases.cases) {
    const prediction = predictPlacement(c.inputs[0] ?? undefined, c.inputs[1] ?? undefined)!;
    assert.ok(prediction);
    assert.ok(Math.abs(prediction.probability - c.expected_probability) < 1e-6);
  }
});

test('all 30 workforce fixtures match the Python encoder and Ridge coefficients', () => {
  assert.equal(workforceCases.cases.length, 30);
  for (const c of workforceCases.cases) {
    const result = predictWorkforce(c.inputs);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(Math.abs(result.total - c.expected_total) < 1e-6);
      assert.equal(result.additional, Math.max(0, Math.floor(c.expected_total + 0.5) - result.available));
    }
  }
});

test('missing and malformed workforce inputs never become zero or a known category', () => {
  const row = workforceCases.cases[0].inputs;
  for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '1.5']) {
    assert.equal(predictWorkforce({ ...row, planned_mentor_capacity_next_month: value }).ok, false);
  }
  for (const patch of [{ company_id: 'REAL_COMPANY' }, { department: 'Unknown' }, { horizon_months: '2' },
    { target_month: '2026-11' }, { snapshot_date: '2026-09-01' }, { month_index: '93' },
    { target_month_sin: '0' }, { data_source: 'real' }, { is_synthetic: '0' }, { working_days_next_month: '0' }]) {
    assert.equal(predictWorkforce({ ...row, ...patch }).ok, false);
  }
  const absent = { ...row } as Record<string, string>;
  delete absent.planned_workload_hours_next_month;
  assert.equal(predictWorkforce(absent).ok, false);
  assert.equal(predictWorkforce({ ...row, interns_current: '0', planned_intern_exits_next_month: '0', confirmed_intern_starts_next_month: '0' }).ok, true);
});

test('placement preserves zero, rejects invalid counts and warns without clamping extrapolations', () => {
  const missing = predictPlacement(7.5, undefined)!;
  const zero = predictPlacement(7.5, 0)!;
  assert.notEqual(missing.probability, zero.probability);
  assert.ok(missing.warnings.some(w => w.includes('median')));
  assert.equal(predictPlacement(7, -1), null);
  assert.equal(predictPlacement(7, 1.5), null);
  assert.equal(predictPlacement(NaN, 1), null);
  assert.equal(predictPlacement(10.1, 1), null);
  const extrapolated = predictPlacement(4, 10)!;
  assert.ok(extrapolated.warnings.length >= 2);
  assert.equal(extrapolated.factors[0].observed, '4');
});

test('frontend bundles contain the currently exported learned model parameters', () => {
  const placementSource = JSON.parse(readFileSync(new URL('../../ml/placement/artifacts/model.json', import.meta.url), 'utf8'));
  const workforceSource = JSON.parse(readFileSync(new URL('../../ml/workforce/artifacts/demo_model.json', import.meta.url), 'utf8'));
  assert.deepEqual(placementMetadata, placementSource);
  assert.deepEqual(workforceMetadata.encoder, workforceSource.encoder);
  assert.deepEqual(workforceMetadata.coefficients, workforceSource.coefficients);
});
