import test from 'node:test';
import assert from 'node:assert/strict';
import {backendWorkforcePlan,syntheticDemand} from '../src/lib/backendWorkforcePlan';
import {workforceDemo} from '../src/lib/forecast';
test('workforce plan uses actual baseline and accepted offers once; pending is a fractional scenario',()=>{
  const p=backendWorkforcePlan(10,5,1,{upcomingAccepted:2,upcomingPending:3});assert.equal(p.ok,true);if(!p.ok)return;
  assert.equal(p.retained,4);assert.equal(p.confirmedAvailable,6);assert.equal(p.expectedPending,2.25);assert.equal(p.scenarioAvailable,8.25);assert.equal(p.additionalConfirmed,4);assert.equal(p.additionalScenario,1.75);
  const zero=backendWorkforcePlan(0,0,0,{upcomingAccepted:1,upcomingPending:0});assert.equal(zero.ok&&zero.additionalScenario,0);
});
test('missing planning assumptions remain unknown and invalid counts are rejected',()=>{
  const starts={upcomingAccepted:1,upcomingPending:1};
  for(const args of [[null,0,0],[5,null,0],[5,0,null],[5,0,1],[5,-1,0],[5,1.5,0],[Infinity,0,0]] as Array<[number|null,number|null,number|null]>)assert.equal(backendWorkforcePlan(...args,starts).ok,false);
  assert.equal(backendWorkforcePlan(5,0,0,{...starts,upcomingPending:-1}).ok,false);
});
test('synthetic demand requires an explicit scenario and its trained one-month horizon',()=>{
  const s=workforceDemo[0],before=JSON.stringify(s);
  assert.equal(syntheticDemand('',s.snapshot.target_month).ok,false);assert.equal(syntheticDemand(s.jobId,'2027-01').ok,false);
  const result=syntheticDemand(s.jobId,s.snapshot.target_month);assert.equal(result.ok,true);if(result.ok){assert.ok(result.demand>=0);assert.equal(result.company,s.snapshot.company_id);assert.equal('current' in result,false);}
  assert.equal(JSON.stringify(s),before);
});
