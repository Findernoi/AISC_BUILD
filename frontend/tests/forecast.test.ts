import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, candidatePrediction, demandHistoryFor, forecastSeries, workforceForecast } from '../src/lib/forecast';
import { INITIAL_JOBS } from '../src/data/mockData';
import { makeUITDemoCandidates } from '../src/data/uitDemo';
import { topTen } from '../src/lib/recruitment';

test('workforce forecast predicts the selected month rather than cumulative hiring',()=>{
  assert.deepEqual(forecastSeries([2,4,6,8,10,12],3),[14,16,18]);
  const row=workforceForecast({...INITIAL_JOBS[0],demandHistory:[2,4,6,8,10,12],demandHistoryEndMonth:'2026-10',currentWorkforce:8},3);
  assert.equal(row.month,'2027-01');assert.equal(row.demand,18);assert.equal(row.additional,10);
});
test('decreasing demand remains nonnegative and extra workforce is not negative hiring',()=>{
  assert.deepEqual(forecastSeries([6,5,4,3,2,1],3),[0,0,0]);
  assert.equal(workforceForecast({...INITIAL_JOBS[0],demandHistory:[5,5,5,5,5,5],currentWorkforce:8},1).additional,0);
});
test('unknown history or workforce is not silently treated as a known zero',()=>{
  const unknown=workforceForecast({...INITIAL_JOBS[0],id:'new-job',demandHistory:undefined,currentWorkforce:undefined},1);
  assert.equal(unknown.demand,null);assert.equal(unknown.month,null);assert.equal(unknown.additional,null);
  const partial=workforceForecast({...INITIAL_JOBS[0],currentWorkforce:undefined},1);
  assert.ok(partial.demand!==null);assert.equal(partial.additional,null);
  assert.deepEqual(demandHistoryFor({...INITIAL_JOBS[0],demandHistory:[]}),[]);
});
test('malformed history, month and horizon cannot create misleading forecasts',()=>{
  for(const values of [[],[5],[5,NaN],[5,-1]])assert.deepEqual(forecastSeries(values,1),[]);
  for(const horizon of [0,1.5,13,NaN])assert.deepEqual(forecastSeries([1,2,3],horizon),[]);
  assert.equal(workforceForecast({...INITIAL_JOBS[0],demandHistoryEndMonth:'2026-99'},1).demand,null);
  assert.equal(addMonths('2026-12',1),'2027-01');assert.equal(addMonths('2026-01',-1),'2025-12');
});
test('demo probability stays finite, excludes invalid scope and handles missing optional inputs',()=>{
  const c=makeUITDemoCandidates()[0];const job=INITIAL_JOBS[0];
  const p=candidatePrediction({...c,projectCount:undefined,experienceMonths:undefined},job)!;
  assert.equal(p.mode,'demo');assert.ok(p.probability>0&&p.probability<1);
  assert.equal(p.factors.find(f=>f.key==='projects')!.observed,'Chưa khai');
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
