import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, candidatePrediction, workforceDemo, workforceForecast } from '../src/lib/forecast';
import { INITIAL_JOBS } from '../src/data/mockData';
import { makeUITDemoCandidates } from '../src/data/uitDemo';
import { topTen } from '../src/lib/recruitment';

test('Ridge uses the explicit synthetic snapshot, not legacy history or headcount', () => {
  const example = workforceDemo.find(r => r.jobId === INITIAL_JOBS[0].id)!;
  const job = {...INITIAL_JOBS[0], workforceSnapshot: example.snapshot};
  const result = workforceForecast(job);
  assert.equal(result.month, '2026-10');
  assert.equal(result.endMonth, '2026-09');
  assert.equal(result.history.length, 13);
  assert.ok(result.demand !== null);
  assert.equal(result.additional, Math.max(0, result.demand! - result.available!));
  assert.deepEqual(workforceForecast({...job, currentWorkforce:999, demandHistory:[999,999]}).projected, result.projected);
  assert.equal(workforceForecast(job, 2).demand, null);
});
test('missing snapshots and inconsistent historical/company/department mappings do not forecast', () => {
  assert.equal(workforceForecast(INITIAL_JOBS[0]).demand, null);
  const example = workforceDemo.find(r => r.jobId === INITIAL_JOBS[0].id)!;
  for (const patch of [{company_id:'SYNTH_CO_02'}, {department:'Backend'}, {required_interns_current:'999'}, {origin_month:'2026-10'}, {planned_intern_exits_next_month:''}]) {
    assert.equal(workforceForecast({...INITIAL_JOBS[0], workforceSnapshot:{...example.snapshot,...patch}}).demand, null);
  }
  assert.equal(addMonths('2026-12',1),'2027-01');
});
test('demo probability stays finite, excludes invalid scope and handles missing optional inputs',()=>{
  const c=makeUITDemoCandidates()[0];const job=INITIAL_JOBS[0];
  const p=candidatePrediction({...c,projectCount:undefined,experienceMonths:undefined},job)!;
  assert.equal(p.mode,'ml');assert.ok(p.probability>0&&p.probability<1);
  assert.ok(p.factors.find(f=>f.key==='projects')!.observed.includes('median'));
  assert.equal(candidatePrediction({...c,email:'other@example.com'},job),null);
  assert.equal(candidatePrediction({...c,gpa:NaN},job),null);assert.equal(candidatePrediction(c,undefined),null);
});
test('equivalent GPA scales give equivalent demo probabilities',()=>{
  const c=makeUITDemoCandidates()[0];
  assert.equal(candidatePrediction({...c,gpa:3.6,gpaScale:'4.0'},INITIAL_JOBS[0])!.probability,candidatePrediction({...c,gpa:9,gpaScale:'10'},INITIAL_JOBS[0])!.probability);
});
test('round-two scores and HR outcomes do not leak into application-stage probability',()=>{
  const c=makeUITDemoCandidates()[0];const before=candidatePrediction(c,INITIAL_JOBS[0]);
  const after=candidatePrediction({...c,assessmentScore:100,manualCodingEvaluation:{score:100,reviewedBy:'HR',notes:'test',reviewedAt:'2026-10-18'},hrScorecard:{overallScore:100} as any,interviewEvaluation:{overallScore:100} as any,finalDecision:'hire',stage:'accepted'},INITIAL_JOBS[0]);
  assert.deepEqual(after,before);
});
test('viewing probabilities does not mutate profiles or the top-ten selection',()=>{
  const candidates=makeUITDemoCandidates();const snapshot=JSON.stringify(candidates);
  const before=topTen(candidates,INITIAL_JOBS,{allowDemo:true}).map(r=>r.candidate.id);
  for(const c of candidates)candidatePrediction(c,INITIAL_JOBS.find(j=>j.id===c.jobId));
  assert.equal(JSON.stringify(candidates),snapshot);
  assert.deepEqual(topTen(candidates,INITIAL_JOBS,{allowDemo:true}).map(r=>r.candidate.id),before);
});

test('skills, English and experience cannot change a GPA/projects-only placement prediction', () => {
  const c=makeUITDemoCandidates()[0];
  const first=candidatePrediction(c,INITIAL_JOBS[0]);
  const second=candidatePrediction({...c,experienceMonths:100,techBadges:[],englishCert:{type:'None',score:''}}, {...INITIAL_JOBS[0],requirements:['Different JD']});
  assert.deepEqual(first,second);
});
