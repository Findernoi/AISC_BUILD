import test from 'node:test';
import assert from 'node:assert/strict';
import { makeUITDemoCandidates } from '../src/data/uitDemo';
import { normalizeCandidate, offerMetrics, OFFER_ACCEPTANCE_RATE, funnelCounts } from '../src/lib/recruitmentStats';
import type { Candidate } from '../src/types';
const candidate=(patch:Partial<Candidate>={})=>({...makeUITDemoCandidates()[0],...patch});

test('offer assumption is fixed at 75 percent and never uses pre-offer applicants',()=>{
  assert.equal(OFFER_ACCEPTANCE_RATE,.75);
  assert.deepEqual(offerMetrics([candidate({stage:'applied'}),candidate({stage:'interview'})]),{accepted:0,pending:0,expectedPending:0,expectedTotal:0});
});
test('four pending offers produce three expected acceptances; confirmed hires are not counted twice',()=>{
  const pool=[...Array.from({length:4},()=>candidate({stage:'offer'})),candidate({stage:'accepted'}),candidate({stage:'offer',status:'rejected'})];
  assert.deepEqual(offerMetrics(pool),{accepted:1,pending:4,expectedPending:3,expectedTotal:4});
  assert.deepEqual(offerMetrics([]),{accepted:0,pending:0,expectedPending:0,expectedTotal:0});
});
test('GPA and legacy AI scores cannot change the fixed offer scenario',()=>{
  assert.deepEqual(offerMetrics([candidate({stage:'offer',gpa:0,assessmentScore:0})]),offerMetrics([candidate({stage:'offer',gpa:4,assessmentScore:100})]));
});
test('legacy final hiring decision remains an offer, not a confirmed acceptance',()=>{
  const c=normalizeCandidate(candidate({stage:'final_decision' as Candidate['stage'],finalDecision:'hire'}));
  assert.equal(c.stage,'offer');assert.equal(funnelCounts([c])[4],0);
});
test('five-step funnel preserves observed history and excludes the removed assessment stage',()=>{
  const c=normalizeCandidate(candidate({stage:'assessment',stageHistory:['applied','cv_passed','assessment']}));
  assert.equal(c.stage,'cv_passed');assert.deepEqual(funnelCounts([c]),[1,1,0,0,0]);
});
test('fixture upgrade never rewrites the contact address of a real candidate',()=>{
  assert.equal(normalizeCandidate(candidate({sampleRecord:true,email:'uit-demo-1@example.com'})).email,'uit-demo-1@gm.uit.edu.vn');
  assert.equal(normalizeCandidate(candidate({sampleRecord:false,email:'uit-demo-1@example.com'})).email,'uit-demo-1@example.com');
});
