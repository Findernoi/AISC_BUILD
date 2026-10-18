import type {OfferInput,OfferResponseInput} from '../../shared/recruitment';
import {ApiError} from './recruitment-validation';
import {isUuid} from './recruitment-files';
function object(value:unknown,keys:string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw new ApiError(400,'Dữ liệu offer có trường không hợp lệ.');return value as Record<string,unknown>;
}
function text(value:unknown,max:number,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new ApiError(400,'Nhập đủ nội dung và tuân thủ giới hạn độ dài.');return value.trim();}
export function validateOffer(value:unknown):OfferInput {
  const d=object(value,['expectedOfferId','expectedDecisionId','expectedBasis','positionTitle','startDate','content']);
  if((d.expectedOfferId!==null&&!isUuid(d.expectedOfferId))||!isUuid(d.expectedDecisionId)||typeof d.expectedBasis!=='string'||!/^[a-f0-9]{32}$/.test(d.expectedBasis))throw new ApiError(400,'Thiếu căn cứ quyết định hiện tại. Hãy tải lại offer.');
  const startDate=text(d.startDate,10,true),parsed=Date.parse(startDate+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||Number(startDate.slice(0,4))<1||!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==startDate)throw new ApiError(400,'Ngày bắt đầu không tồn tại.');
  return {expectedOfferId:d.expectedOfferId as string|null,expectedDecisionId:d.expectedDecisionId,expectedBasis:d.expectedBasis,positionTitle:text(d.positionTitle,200,true),startDate,content:text(d.content,10000,true)};
}
export function validateOfferResponse(value:unknown):OfferResponseInput {
  const d=object(value,['expectedRevision','outcome','note']);
  if(typeof d.expectedRevision!=='number'||!Number.isSafeInteger(d.expectedRevision)||d.expectedRevision<1||!['accepted','declined'].includes(String(d.outcome)))throw new ApiError(400,'Chọn phản hồi và dùng phiên bản offer hiện tại.');
  return {expectedRevision:d.expectedRevision,outcome:d.outcome as OfferResponseInput['outcome'],note:text(d.note??'',2000)};
}
