import type {RecruitmentAnalyticsScope} from '../../shared/recruitment';
import {ApiError} from './recruitment-validation';
import {isUuid} from './recruitment-files';
export function validateAnalyticsScope(value:Record<string,unknown>):RecruitmentAnalyticsScope {
  if(Object.keys(value).some(k=>!['jobId','month','asOf'].includes(k)))throw new ApiError(400,'Bộ lọc thống kê có trường không hợp lệ.');
  const jobId=value.jobId??'all',month=value.month,asOf=value.asOf;
  if(typeof jobId!=='string'||(jobId!=='all'&&!isUuid(jobId))||typeof month!=='string'||!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)||typeof asOf!=='string'||!/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(asOf))throw new ApiError(400,'Chọn vị trí, tháng và ngày tính kế hoạch hợp lệ (2000–2100).');
  const date=Date.parse(asOf+'T00:00:00Z');if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==asOf)throw new ApiError(400,'Ngày tính kế hoạch không tồn tại.');
  return {jobId:jobId==='all'?null:jobId,month,asOf};
}
