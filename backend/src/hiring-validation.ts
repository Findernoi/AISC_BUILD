import type { HiringWeights,HiringDecisionInput } from '../../shared/recruitment';
import {ApiError} from './recruitment-validation';
function object(value:unknown,keys:string[]):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw new ApiError(400,'Dữ liệu quyết định có trường không hợp lệ.');return value as Record<string,unknown>;
}
export function validateHiringWeights(value:unknown):HiringWeights {
  const d=object(value,['roundOne','coding','interview']),values=[d.roundOne,d.coding,d.interview];
  if(values.some(v=>typeof v!=='number'||!Number.isInteger(v)||v<0||v>100)||(values as number[]).reduce((s,v)=>s+v,0)!==100)throw new ApiError(400,'Ba tỷ trọng phải là số nguyên từ 0–100 và tổng bằng 100%.');
  return {roundOne:d.roundOne as number,coding:d.coding as number,interview:d.interview as number};
}
export function validateHiringDecision(value:unknown):HiringDecisionInput {
  const d=object(value,['expectedBasis','weights','result','reason']);
  if(typeof d.expectedBasis!=='string'||!/^([a-f0-9]{32})$/.test(d.expectedBasis))throw new ApiError(400,'Thiếu căn cứ hiện tại. Hãy tải lại bảng tổng hợp.');
  if(typeof d.result!=='string'||!['hire','reserve','reject'].includes(d.result)||typeof d.reason!=='string'||!d.reason.trim()||d.reason.length>5000)throw new ApiError(400,'Chọn quyết định và nhập lý do tối đa 5.000 ký tự.');
  return {expectedBasis:d.expectedBasis,weights:validateHiringWeights(d.weights),result:d.result as HiringDecisionInput['result'],reason:d.reason.trim()};
}
