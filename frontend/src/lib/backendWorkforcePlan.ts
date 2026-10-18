import type {RecruitmentStarts} from '../../../shared/recruitment';
import {workforceDemo} from './forecast';
import {predictWorkforce} from './mlInference';
export function syntheticDemand(scenarioId:string,month:string) {
  const scenario=workforceDemo.find(s=>s.jobId===scenarioId);
  if(!scenario)return {ok:false as const,error:'Chọn rõ kịch bản giả lập; không tự ánh xạ vị trí theo tên/phòng ban.'};
  if(scenario.snapshot.target_month!==month)return {ok:false as const,error:`Kịch bản này chỉ có lịch sử đồng bộ cho tháng ${scenario.snapshot.target_month}; không dùng cho tháng khác.`};
  const result=predictWorkforce({...scenario.snapshot});
  if(!result.ok)return result;
  return {ok:true as const,demand:result.rounded,company:scenario.snapshot.company_id,department:scenario.snapshot.department,month:scenario.snapshot.target_month};
}
export function backendWorkforcePlan(demand:number|null,current:number|null,exits:number|null,starts:Pick<RecruitmentStarts,'upcomingAccepted'|'upcomingPending'>) {
  if([demand,current,exits].some(v=>v===null||!Number.isFinite(v)||!Number.isInteger(v)||v<0))return {ok:false as const,error:'Nhập đủ nhu cầu, số người đang thực sự làm và số dự kiến kết thúc bằng số nguyên không âm.'};
  if(exits! > current!)return {ok:false as const,error:'Số dự kiến kết thúc không thể lớn hơn số người đang thực sự làm.'};
  if([starts.upcomingAccepted,starts.upcomingPending].some(v=>!Number.isSafeInteger(v)||v<0))return {ok:false as const,error:'Chưa có thống kê nguồn vào hợp lệ từ database.'};
  const retained=current!-exits!,confirmedAvailable=retained+starts.upcomingAccepted,expectedPending=starts.upcomingPending*0.75;
  return {ok:true as const,retained,confirmedAvailable,expectedPending,scenarioAvailable:confirmedAvailable+expectedPending,
    additionalConfirmed:Math.max(0,demand!-confirmedAvailable),additionalScenario:Math.max(0,demand!-confirmedAvailable-expectedPending)};
}
