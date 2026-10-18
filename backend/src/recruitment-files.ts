import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { EvidenceKind, RecruitmentFile } from '../../shared/recruitment';
import { ApiError } from './recruitment-validation';
import type { RecruitmentStore } from './recruitment-store';

export const MAX_FILE_BYTES=10*1024*1024;
export const DOCUMENT_BUCKET='application-documents';
export const isUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export interface FileStorage {
  put(path:string,bytes:Buffer,mime:string):Promise<void>;
  get(path:string):Promise<Buffer>;
  remove(path:string):Promise<void>;
}
export function validateUpload(bytes:unknown,name:unknown,kind:unknown) {
  if(!Buffer.isBuffer(bytes)||bytes.length===0)throw new ApiError(400,'Tệp đang trống hoặc nội dung gửi không hợp lệ.');
  if(bytes.length>MAX_FILE_BYTES)throw new ApiError(413,'Mỗi tệp tối đa 10 MiB.');
  if(!['cv','english','achievement'].includes(String(kind)))throw new ApiError(400,'Loại minh chứng không hợp lệ.');
  if(typeof name!=='string'||name.length<1||name.length>255||/[\x00-\x1f\x7f/\\]/.test(name)||!name.trim())throw new ApiError(400,'Tên tệp không hợp lệ.');
  let mime:RecruitmentFile['mime_type'],extension:string;
  if(/^%PDF-1\.[0-9]|^%PDF-2\.0/.test(bytes.subarray(0,8).toString('ascii'))&&/%%EOF\s*$/.test(bytes.subarray(-1024).toString('latin1'))) {mime='application/pdf';extension='pdf';}
  else if(bytes.length>=45&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.subarray(12,16).toString('ascii')==='IHDR'&&bytes.subarray(-12).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130]))) {mime='image/png';extension='png';}
  else if(bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217) {mime='image/jpeg';extension='jpg';}
  else throw new ApiError(400,'Chỉ nhận PDF, PNG hoặc JPEG có dấu nhận diện hợp lệ.');
  const suffix=name.split('.').pop()?.toLowerCase();
  if(!(mime==='image/jpeg'?['jpg','jpeg']: [extension]).includes(suffix??''))throw new ApiError(400,'Đuôi tệp không khớp nội dung.');
  if(kind==='cv'&&mime!=='application/pdf')throw new ApiError(400,'CV phải là tệp PDF.');
  return {mime,extension,name:name.trim(),kind:kind as EvidenceKind};
}
function validatePath(path:string) {
  const parts=path.split('/');
  if(parts.length!==3||!isUuid(parts[0])||!isUuid(parts[1])||!/^([0-9a-f-]{36})\.(pdf|png|jpg)$/.test(parts[2])||!isUuid(parts[2].split('.')[0]))throw new ApiError(400,'Đường dẫn tệp không hợp lệ.');
}
export function diskFileStorage(root=fileURLToPath(new URL('../../.local/uploads/',import.meta.url))):FileStorage {
  const target=(key:string)=>{
    validatePath(key);const path=resolve(root,...key.split('/'));const rel=relative(resolve(root),path);
    if(rel.startsWith('..')||isAbsolute(rel))throw new ApiError(400,'Đường dẫn tệp không hợp lệ.');
    return path;
  };
  return {
    async put(key,bytes) {const path=target(key);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx',mode:0o600});},
    async get(key) {try{return await readFile(target(key));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new ApiError(404,'Không tìm thấy nội dung tệp.');throw e;}},
    async remove(key) {await unlink(target(key));},
  };
}
export function cloudFileStorage():FileStorage {
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new ApiError(503,'Chưa cấu hình kho tệp riêng tư trên server.');
  // Controlled storage operations only, after user-scoped SQL authorizes each request.
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const bucket=client.storage.from(DOCUMENT_BUCKET);
  const checkPrivate=async()=>{const r=await client.storage.getBucket(DOCUMENT_BUCKET);if(r.error||!r.data||r.data.public)throw new ApiError(503,'Kho tệp chưa sẵn sàng hoặc chưa đặt riêng tư. Cần migration storage.');};
  return {
    async put(path,bytes,mime) {validatePath(path);await checkPrivate();const r=await bucket.upload(path,bytes,{contentType:mime,upsert:false});if(r.error)throw new ApiError(503,'Không lưu được tệp vào kho riêng tư.');},
    async get(path) {validatePath(path);await checkPrivate();const r=await bucket.download(path);if(r.error)throw new ApiError(404,'Không tìm thấy nội dung tệp.');return Buffer.from(await r.data.arrayBuffer());},
    async remove(path) {validatePath(path);const r=await bucket.remove([path]);if(r.error)throw new Error('Storage cleanup failed');},
  };
}
export async function uploadEvidence(store:RecruitmentStore,storage:FileStorage,applicationId:string,bytes:Buffer,name:unknown,kind:unknown) {
  if(!store.user)throw new ApiError(401,'Hãy đăng nhập trước.');
  const app=await store.application(applicationId);
  if(!app)throw new ApiError(404,'Không tìm thấy hồ sơ.');
  if(store.user.role!=='candidate'||app.applicant_id!==store.user.id)throw new ApiError(403,'Chỉ chủ hồ sơ được thêm tệp.');
  if(['accepted','withdrawn'].includes(app.stage))throw new ApiError(409,'Hồ sơ đã kết thúc, không thể thêm tệp.');
  const checked=validateUpload(bytes,name,kind);
  const object_path=`${store.user.id}/${app.id}/${randomUUID()}.${checked.extension}`;
  await storage.put(object_path,bytes,checked.mime);
  try {
    return await store.registerFile({application_id:app.id,uploaded_by:store.user.id,kind:checked.kind,object_path,original_name:checked.name,mime_type:checked.mime,byte_size:bytes.length,sha256:digest(bytes)});
  }catch(error){
    try{await storage.remove(object_path);}catch{console.error('Unregistered file requires storage cleanup:',object_path);}
    throw error;
  }
}
export async function readEvidence(store:RecruitmentStore,storage:FileStorage,id:string) {
  if(!store.user)throw new ApiError(401,'Hãy đăng nhập trước.');
  const file=await store.file(id); // RLS first; never resolve arbitrary storage paths from the request.
  if(!file)throw new ApiError(404,'Không tìm thấy tệp hoặc bạn không có quyền đọc.');
  const app=await store.application(file.application_id);
  if(!app)throw new ApiError(404,'Không tìm thấy hồ sơ.');
  if(file.bucket!==DOCUMENT_BUCKET||!file.object_path.startsWith(`${app.applicant_id}/${app.id}/`))throw new ApiError(409,'Metadata tệp không hợp lệ.');
  const bytes=await storage.get(file.object_path);
  if(bytes.length!==Number(file.byte_size)||bytes.length>MAX_FILE_BYTES||digest(bytes)!==file.sha256)throw new ApiError(409,'Nội dung tệp không khớp bản đã nộp.');
  const checked=validateUpload(bytes,file.original_name,file.kind);
  if(checked.mime!==file.mime_type)throw new ApiError(409,'Định dạng tệp không khớp metadata.');
  return {file,bytes};
}
