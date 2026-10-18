import test from 'node:test';
import assert from 'node:assert/strict';
import type { Candidate } from '../src/types';
import { INITIAL_JOBS } from '../src/data/mockData';
import { makeUITDemoCandidates } from '../src/data/uitDemo';
import { finalScore, interviewScore, inviteShortlisted, roundTwoComplete, topTen } from '../src/lib/recruitment';
import { offerMetrics } from '../src/lib/recruitmentStats';
import { candidatePrediction } from '../src/lib/forecast';

test('sample application proceeds through HR invitation, code zero, interview, decision and offer without ML changing the rubric', () => {
  const pool = makeUITDemoCandidates();
  const selected = topTen(pool, INITIAL_JOBS, { allowDemo: true })[0];
  const before = candidatePrediction(selected.candidate, selected.job)!.probability;
  const invited = inviteShortlisted(pool, INITIAL_JOBS, [selected.candidate.id], 'QA demo', { allowDemo: true }).find(c => c.id === selected.candidate.id)!;
  assert.equal(invited.stage, 'interview');
  assert.equal(roundTwoComplete(invited), false);
  const scores = { technical: 8, reasoning: 8, learning: 8, projects: 8, communication: 8 };
  const evaluated: Candidate = { ...invited,
    manualCodingEvaluation: { score: 0, reviewedBy: 'QA demo', notes: 'Synthetic test result', reviewedAt: '2026-10-18' },
    interviewEvaluation: { reviewer: 'QA demo', scores, evidence: {technical:'demo',reasoning:'demo',learning:'demo',projects:'demo',communication:'demo'}, overallScore: interviewScore(scores)!, evaluatedAt: '2026-10-18' },
  };
  assert.equal(roundTwoComplete(evaluated), true);
  const weights = { aiWeight: 30, assessmentWeight: 30, hrWeight: 40 };
  const total = finalScore(evaluated, selected.job, weights, true)!;
  assert.equal(total, Math.round((selected.score.total * .3 + 80 * .4) * 10) / 10);
  assert.equal(finalScore(evaluated, selected.job, {...weights,hrWeight:50}, true), null);
  const offered: Candidate = {...evaluated,stage:'offer',hiringDecision:{result:'hire',reason:'Synthetic QA only',decidedBy:'QA demo',decidedAt:'2026-10-18',finalScore:total,weights},emailDraft:{subject:'Demo',body:'Simulation only',createdAt:'2026-10-18',state:'demo_sent'}};
  assert.equal(candidatePrediction(offered, selected.job)!.probability, before);
  assert.equal(offerMetrics([offered]).expectedPending, .75);
  assert.equal(offerMetrics([{...offered,stage:'accepted'}]).expectedTotal, 1);
});
