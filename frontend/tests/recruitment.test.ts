import test from 'node:test';
import assert from 'node:assert/strict';
import { makeUITDemoCandidates } from '../src/data/uitDemo';
import { INITIAL_JOBS } from '../src/data/mockData';
import { eligibility, hasUITEmail, verified, evidenceFingerprint, finalScore, manualCodingScore, interviewScore, inviteShortlisted, roundOneScore, roundTwoComplete, topTen, INTERVIEW_CRITERIA } from '../src/lib/recruitment';
import type { Candidate, InterviewKey } from '../src/types';
const samples=makeUITDemoCandidates();
const base=()=>structuredClone(samples[0]);
const complete=():Candidate=>{
  const c=base();
  c.invitation={invitedBy:'HR test',invitedAt:'2026-10-17',roundOneScore:roundOneScore(c,INITIAL_JOBS[0],true).total,scopeJobId:'all',majorFilter:'all'};
  c.stage='interview';
  c.manualCodingEvaluation={score:85,reviewedBy:'HR test',notes:'Kết quả bài coding bên ngoài app',reviewedAt:'2026-10-17'};
  c.interviewEvaluation={reviewer:'HR test',scores:Object.fromEntries(INTERVIEW_CRITERIA.map(f=>[f.key,8])) as Record<InterviewKey,number>,evidence:Object.fromEntries(INTERVIEW_CRITERIA.map(f=>[f.key,'Ứng viên giải thích được ví dụ và trường hợp biên.'])) as Record<InterviewKey,string>,overallScore:80,evaluatedAt:'2026-10-17'};
  return c;
};
test('sample achievement approvals cannot stand in for real evidence',()=>{
  assert.equal(verified(base(),'achievement',true),true);
  assert.equal(verified(base(),'achievement',false),false);
});
test('UIT membership gate uses exact email domain and declared major, not school or GPA approval',()=>{
  const c=base();c.university='Không đối chiếu trường';c.verification={};c.studentId='';
  assert.equal(eligibility(c).eligible,true);
  c.major='Hệ thống Thông tin';assert.equal(eligibility(c).eligible,false);
  c.major=samples[0].major;c.email='123@example.com';assert.equal(eligibility(c).eligible,false);
});
test('email gate rejects suffix spoofing and accepts a case-insensitive UIT domain',()=>{
  assert.equal(hasUITEmail(' 24520001@GM.UIT.EDU.VN '),true);
  for(const email of ['a@gmail.com','@gm.uit.edu.vn','a@gm.uit.edu.vn.example.com','a@fakegm.uit.edu.vn','a@@gm.uit.edu.vn','a b@gm.uit.edu.vn'])assert.equal(hasUITEmail(email),false);
});
test('GPA stays self-declared but must be a valid value on its selected scale',()=>{
  const c=base();c.verification={};c.gpa=3.99;assert.equal(eligibility(c).eligible,true);
  c.gpa=4.1;assert.equal(eligibility(c).eligible,false);
  c.gpaScale='10';c.gpa=9.5;assert.equal(eligibility(c).eligible,true);
  c.gpa=NaN;assert.equal(eligibility(c).eligible,false);
});
test('top ten is capped, deterministic and contains only email-eligible in-scope candidates',()=>{
  const list=topTen(samples,INITIAL_JOBS,{allowDemo:true});
  assert.equal(list.length,10);
  assert.ok(list.every(r=>eligibility(r.candidate,true).eligible&&r.score.total>=75));
  assert.deepEqual(list.map(r=>r.candidate.id),topTen([...samples].reverse(),INITIAL_JOBS,{allowDemo:true}).map(r=>r.candidate.id));
  assert.equal(topTen(samples.slice(0,3),INITIAL_JOBS,{allowDemo:true}).length,3);
});
test('job and major filters do not pull applicants from other scopes',()=>{
  assert.ok(topTen(samples,INITIAL_JOBS,{jobId:INITIAL_JOBS[0].id,major:'AI',allowDemo:true}).every(r=>r.candidate.jobId===INITIAL_JOBS[0].id&&r.candidate.major==='Trí tuệ Nhân tạo'));
});
test('HR must explicitly choose named candidates from the current top ten',()=>{
  const first=topTen(samples,INITIAL_JOBS,{allowDemo:true})[0].candidate.id;
  const outside=samples.find(c=>!topTen(samples,INITIAL_JOBS,{allowDemo:true}).some(r=>r.candidate.id===c.id))!.id;
  assert.equal(inviteShortlisted(samples,INITIAL_JOBS,[first],'',{allowDemo:true}),samples);
  const result=inviteShortlisted(samples,INITIAL_JOBS,[first,outside],'HR test',{allowDemo:true});
  assert.equal(result.filter(c=>c.invitation).length,1);
  assert.equal(result.find(c=>c.id===first)!.invitation!.invitedBy,'HR test');
  assert.equal(result.find(c=>c.id===outside)!.invitation,undefined);
});
test('a GPA below the job minimum cannot be invited with a previously selected ID',()=>{
  const data=structuredClone(samples);const target=topTen(data,INITIAL_JOBS,{allowDemo:true})[0].candidate;target.gpa=0;
  assert.equal(inviteShortlisted(data,INITIAL_JOBS,[target.id],'HR test',{allowDemo:true}).find(c=>c.id===target.id)!.invitation,undefined);
});
test('inviting the same profile again preserves the original invitation',()=>{
  const id=topTen(samples,INITIAL_JOBS,{allowDemo:true})[0].candidate.id;
  const first=inviteShortlisted(samples,INITIAL_JOBS,[id],'HR one',{allowDemo:true});
  const second=inviteShortlisted(first,INITIAL_JOBS,[id],'HR two',{allowDemo:true});
  assert.equal(second.find(c=>c.id===id)!.invitation!.invitedBy,'HR one');
});
test('round-one ranking is independent of interview and manually entered coding scores',()=>{
  const c=base();const before=roundOneScore(c,INITIAL_JOBS[0],true).total;
  Object.assign(c,complete(),{assessmentScore:100,hrScorecard:{overallScore:100},interviewEvaluation:{...complete().interviewEvaluation!,overallScore:100}});
  assert.equal(roundOneScore(c,INITIAL_JOBS[0],true).total,before);
});
test('achievement bonus requires approval; GPA bonus uses the declared value and total is bounded',()=>{
  const c=base();c.gpa=4;c.achievementLevel='international';c.achievements='Giải thưởng mẫu';c.verification!.achievement!.fingerprint=evidenceFingerprint(c,'achievement');
  let s=roundOneScore(c,INITIAL_JOBS[0],true);assert.equal(s.contributions.find(f=>f.key==='gpaBonus')!.value,3);assert.equal(s.contributions.find(f=>f.key==='achievement')!.value,10);assert.ok(s.total<=100);
  delete c.verification!.achievement;s=roundOneScore(c,INITIAL_JOBS[0],true);assert.equal(s.contributions.find(f=>f.key==='achievement')!.value,0);
});
test('GPA conversion gives the same score for equivalent values',()=>{
  const a=base();a.gpa=3.6;const b=structuredClone(a);b.gpa=9;b.gpaScale='10';
  assert.equal(roundOneScore(a,INITIAL_JOBS[0],true).total,roundOneScore(b,INITIAL_JOBS[0],true).total);
});
test('interview requires all five criteria in the 1 to 10 range',()=>{
  assert.equal(interviewScore({}),null);
  const scores=complete().interviewEvaluation!.scores;assert.equal(interviewScore(scores),80);
  assert.equal(interviewScore({...scores,technical:0}),null);assert.equal(interviewScore({...scores,technical:11}),null);
});
test('round two requires manual coding and interview, without an in-app coding submission',()=>{
  assert.equal(roundTwoComplete(base()),false);
  const c=complete();assert.equal(c.codingAttempt,undefined);assert.equal(roundTwoComplete(c),true);
  c.interviewEvaluation!.evidence.technical='';assert.equal(roundTwoComplete(c),false);
  const d=complete();d.invitation=undefined;assert.equal(roundTwoComplete(d),false);
  const e=complete();e.manualCodingEvaluation=undefined;assert.equal(roundTwoComplete(e),false);
});
test('final ranking uses round one, manual coding and interview with a valid 100 percent matrix',()=>{
  const c=complete();const w={aiWeight:30,assessmentWeight:30,hrWeight:40};
  const expected=Math.round((roundOneScore(c,INITIAL_JOBS[0],true).total*.3+85*.3+80*.4)*10)/10;
  assert.equal(finalScore(c,INITIAL_JOBS[0],w,true),expected);
  assert.equal(finalScore({...c,interviewEvaluation:undefined},INITIAL_JOBS[0],w,true),null);
  assert.equal(finalScore(c,INITIAL_JOBS[0],{...w,hrWeight:45},true),null);
  assert.equal(finalScore(c,INITIAL_JOBS[0],{aiWeight:-1,assessmentWeight:31,hrWeight:70},true),null);
  assert.equal(finalScore(c,INITIAL_JOBS[0],{aiWeight:40,hrWeight:60} as typeof w,true),null);
  c.gpa=2;assert.equal(finalScore(c,INITIAL_JOBS[0],w,true),null);
});

test('manual coding accepts zero and rejects missing, nonfinite or out-of-range results',()=>{
  const c=complete();
  for(const score of [0,85,100]){c.manualCodingEvaluation!.score=score;assert.equal(manualCodingScore(c),score);assert.equal(roundTwoComplete(c),true);}
  for(const score of [-1,101,NaN,Infinity]){c.manualCodingEvaluation!.score=score;assert.equal(manualCodingScore(c),null);assert.equal(roundTwoComplete(c),false);}
  c.manualCodingEvaluation={...c.manualCodingEvaluation!,score:85,reviewedBy:' '};assert.equal(manualCodingScore(c),null);
});
test('legacy automatic coding and assessment scores cannot replace a manually recorded result',()=>{
  const c=complete();c.manualCodingEvaluation=undefined;c.assessmentScore=100;
  c.codingAttempt={problemId:'two-sum',code:'legacy',passed:6,total:6,testScore:100,durationMs:1,details:[],submittedAt:'2026-10-17',review:{mode:'demo',qualityScore:100,feedback:'legacy',timeComplexity:'unknown',score:100,reviewedAt:'2026-10-17'}};
  assert.equal(manualCodingScore(c),null);assert.equal(roundTwoComplete(c),false);
  assert.equal(finalScore(c,INITIAL_JOBS[0],{aiWeight:30,assessmentWeight:30,hrWeight:40},true),null);
});

test('replacing achievement proof or changing its declaration invalidates the bonus',()=>{
  const c=base();assert.ok(roundOneScore(c,INITIAL_JOBS[0],true).contributions.find(f=>f.key==='achievement')!.value>0);
  c.evidenceFiles={achievement:{id:'replacement',name:'new.pdf',size:1,type:'application/pdf'}};
  assert.equal(roundOneScore(c,INITIAL_JOBS[0],true).contributions.find(f=>f.key==='achievement')!.value,0);
  const d=base();d.achievements+=' updated';assert.equal(verified(d,'achievement',true),false);
});
