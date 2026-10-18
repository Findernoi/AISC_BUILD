import { randomBytes } from 'node:crypto';
import { Router, raw, type Request, type Response, type ErrorRequestHandler } from 'express';
import type { PGlite } from '@electric-sql/pglite';
import { PREVIEW_IDENTITIES, type PreviewIdentity } from '../../shared/database';
import { ApiError, validateApplication, validateJob } from './recruitment-validation';
import { supabaseStore, type RecruitmentStore } from './recruitment-store';
import { cloudFileStorage, diskFileStorage, isUuid, MAX_FILE_BYTES, readEvidence, uploadEvidence, type FileStorage } from './recruitment-files';
import { validateDeclaration, checkEvidence, claimsHash, type extractEvidence } from './evidence-analysis';
import type { RoundOneScope } from '../../shared/recruitment';
import { validateRoundTwo } from './round-two-validation';
import {validateHiringDecision,validateHiringWeights} from './hiring-validation';

const LOOPBACK=['127.0.0.1','::1','::ffff:127.0.0.1'];
const COOKIE='recruitment_local_session';
export function createRecruitmentRouter(options: {local:boolean; database?:()=>Promise<PGlite>; storage?:FileStorage; extract?:typeof extractEvidence}) {
  const router=Router();
  const sessions=new Map<string,{identity:PreviewIdentity;expires:number}>();
  const local=options.local && process.env.NODE_ENV !== 'production';
  const fileStorage=()=>options.storage ?? (local?diskFileStorage():cloudFileStorage());
  const cookie=(req:Request)=>req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  router.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    if(local) {
      const host=req.headers.host?.split(':')[0];
      if(!LOOPBACK.includes(req.socket.remoteAddress ?? '') || !['127.0.0.1','localhost'].includes(host ?? '')) {res.status(403).json({error:'Chế độ thử chỉ dùng trên localhost.'});return;}
    }
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const origin=req.headers.origin;
      if((local || origin) && origin !== `${req.protocol}://${req.headers.host}`) {res.status(403).json({error:'Nguồn gửi yêu cầu không hợp lệ.'});return;}
    }
    next();
  });
  const handle=(fn:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{
    try {await fn(req,res);} catch(error) {
      if(error instanceof ApiError) {res.status(error.status).json({error:error.message});return;}
      const code=(error as {code?:string})?.code;
      if(code==='23505') {res.status(409).json({error:'Bạn đã nộp hồ sơ cho vị trí này.'});return;}
      if(['40001','40P01'].includes(code??'')){res.status(409).json({error:'Dữ liệu đã thay đổi. Hãy tải lại vòng tuyển dụng rồi thử lại; yêu cầu này chưa được lưu.'});return;}
      if(code==='42501') {res.status(403).json({error:'Bạn không có quyền thực hiện thao tác này hoặc vị trí đã đóng.'});return;}
      if(['23514','23502','22P02','23503','22023','22007','22008','22003'].includes(code ?? '')) {res.status(400).json({error:'Dữ liệu không hợp lệ hoặc vị trí không còn tồn tại.'});return;}
      if(['42P01','42883','PGRST202','PGRST205'].includes(code ?? '')) {res.status(503).json({error:'Database chưa sẵn sàng. Cần áp dụng các migration tuyển dụng tương ứng trước.'});return;}
      console.error('Recruitment API failed:',code ?? (error instanceof Error ? error.name : 'unknown'));
      res.status(503).json({error:'Chưa kết nối được database tuyển dụng. Vui lòng thử lại.'});
    }
  };
  const store=async(req:Request):Promise<RecruitmentStore>=>{
    if(local) {
      const session=sessions.get(cookie(req) ?? '');
      const identity=session && session.expires>Date.now() ? session.identity : 'anonymous';
      const {localStore,localRecruitmentDatabase}=await import('./recruitment-local');
      return localStore(identity,await (options.database ?? localRecruitmentDatabase)());
    }
    const header=req.headers.authorization;
    if(header && !/^Bearer\s+\S+$/i.test(header)) throw new ApiError(401,'Token không hợp lệ.');
    return supabaseStore(header?.replace(/^Bearer\s+/i,''));
  };
  router.get('/session',handle(async(req,res)=>{
    const configured=local || Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    res.json({mode:local?'local':'supabase',configured,user:configured ? (await store(req)).user : null});
  }));
  const roundScope=(value:Record<string,unknown>):RoundOneScope=>{
    const jobId=value.jobId??'all',major=value.major??'all';
    if(typeof jobId!=='string'||(jobId!=='all'&&!isUuid(jobId))||typeof major!=='string'||!['all','AI','KHMT','KTPM'].includes(major))throw new ApiError(400,'Bộ lọc vòng 1 không hợp lệ.');
    return {jobId:jobId==='all'?null:jobId,major:major as RoundOneScope['major']};
  };
  router.get('/round-one',handle(async(req,res)=>{
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    if(db.user.role!=='hr')throw new ApiError(403,'Chỉ HR được xem xếp hạng.');
    res.json({report:await db.roundOne(roundScope(req.query))});
  }));
  router.post('/round-one/invitations',handle(async(req,res)=>{
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    if(db.user.role!=='hr')throw new ApiError(403,'Chỉ HR được mời vào vòng 2.');
    const body=req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['applicationIds','jobId','major'].includes(k))||!Array.isArray(body.applicationIds)||body.applicationIds.length<1||body.applicationIds.length>10||body.applicationIds.some((id:unknown)=>!isUuid(id))||new Set(body.applicationIds).size!==body.applicationIds.length)throw new ApiError(400,'Chọn từ 1 đến 10 hồ sơ khác nhau; không gửi điểm hoặc người mời.');
    res.json({invitations:await db.invite(body.applicationIds,roundScope(body))});
  }));
  router.get('/invitations',handle(async(req,res)=>{
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    res.json({invitations:await db.invitations()});
  }));
  router.get('/applications/:id/hiring',handle(async(req,res)=>{
    if(!isUuid(req.params.id))throw new ApiError(400,'Mã hồ sơ không hợp lệ.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    if(db.user.role!=='hr')throw new ApiError(403,'Chỉ HR được xem bảng tổng hợp và quyết định.');
    if(Object.keys(req.query).some(k=>!['roundOne','coding','interview'].includes(k)))throw new ApiError(400,'Bộ lọc tỷ trọng không hợp lệ.');
    const values=['roundOne','coding','interview'].map(k=>req.query[k]);
    if(values.some(v=>v!==undefined&&(typeof v!=='string'||!/^\d{1,3}$/.test(v))))throw new ApiError(400,'Tỷ trọng không hợp lệ.');
    const weights=validateHiringWeights({roundOne:Number(req.query.roundOne??30),coding:Number(req.query.coding??30),interview:Number(req.query.interview??40)});
    const report=await db.hiringReport(req.params.id,weights);if(!report)throw new ApiError(404,'Không tìm thấy hồ sơ.');
    res.json({report});
  }));
  router.post('/applications/:id/hiring',handle(async(req,res)=>{
    if(!isUuid(req.params.id))throw new ApiError(400,'Mã hồ sơ không hợp lệ.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    if(db.user.role!=='hr')throw new ApiError(403,'Chỉ HR được lưu quyết định.');
    if(!await db.application(req.params.id))throw new ApiError(404,'Không tìm thấy hồ sơ.');
    res.status(201).json({decision:await db.decide(req.params.id,validateHiringDecision(req.body))});
  }));
  router.get('/applications/:id/round-two',handle(async(req,res)=>{
    if(!isUuid(req.params.id))throw new ApiError(400,'Mã hồ sơ không hợp lệ.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    const report=await db.roundTwo(req.params.id);if(!report)throw new ApiError(404,'Không tìm thấy hồ sơ.');
    res.json({report});
  }));
  router.post('/applications/:id/round-two',handle(async(req,res)=>{
    if(!isUuid(req.params.id))throw new ApiError(400,'Mã hồ sơ không hợp lệ.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    if(db.user.role!=='hr')throw new ApiError(403,'Chỉ HR được lưu lịch và điểm vòng 2.');
    if(!await db.application(req.params.id))throw new ApiError(404,'Không tìm thấy hồ sơ.');
    await db.saveRoundTwo(req.params.id,validateRoundTwo(req.body));
    res.json({ok:true});
  }));
  router.post('/round-one/local-demo',handle(async(req,res)=>{
    if(!local)throw new ApiError(404,'Không có đường dẫn này.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    if(db.user.role!=='hr')throw new ApiError(403,'Chỉ HR mẫu được tạo bộ thử.');
    const {localRecruitmentDatabase}=await import('./recruitment-local');
    const {seedRoundOneDemo}=await import('./round-one-demo');
    res.json({jobId:await seedRoundOneDemo(await (options.database??localRecruitmentDatabase)())});
  }));
  router.post('/local-session',handle(async(req,res)=>{
    if(!local)throw new ApiError(404,'Không có đường dẫn này.');
    const identity=req.body?.identity;
    if(typeof identity!=='string' || !Object.hasOwn(PREVIEW_IDENTITIES,identity) || identity==='anonymous') throw new ApiError(400,'Chọn tài khoản mẫu hợp lệ.');
    for(const [id,session] of sessions)if(session.expires<=Date.now())sessions.delete(id);
    const previous=cookie(req); if(previous)sessions.delete(previous);
    if(sessions.size>=100)throw new ApiError(429,'Quá nhiều phiên thử trên máy.');
    const token=randomBytes(32).toString('hex');
    sessions.set(token,{identity:identity as PreviewIdentity,expires:Date.now()+8*3600000});
    res.cookie(COOKIE,token,{httpOnly:true,sameSite:'strict',path:'/api/recruitment',maxAge:8*3600000});
    res.json({ok:true});
  }));
  router.post('/logout',handle(async(req,res)=>{
    if(local) { const id=cookie(req);if(id)sessions.delete(id);res.clearCookie(COOKIE,{path:'/api/recruitment',httpOnly:true,sameSite:'strict'}); }
    res.json({ok:true});
  }));
  router.get('/jobs',handle(async(req,res)=>{res.json({jobs:await (await store(req)).jobs()});}));
  router.post('/jobs',handle(async(req,res)=>{
    const db=await store(req);
    if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    if(db.user.role!=='hr')throw new ApiError(403,'Chỉ HR được tạo vị trí.');
    res.status(201).json({job:await db.createJob(validateJob(req.body))});
  }));
  router.get('/applications',handle(async(req,res)=>{
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập để xem hồ sơ.');
    res.json({applications:await db.applications()});
  }));
  router.post('/applications',handle(async(req,res)=>{
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước khi nộp hồ sơ.');
    if(db.user.role!=='candidate')throw new ApiError(403,'Hãy dùng tài khoản ứng viên để nộp hồ sơ.');
    if(!/^[^@\s]+@gm\.uit\.edu\.vn$/i.test(db.user.email))throw new ApiError(403,'Cần tài khoản có email UIT đã xác nhận.');
    res.status(201).json({application:await db.apply(validateApplication(req.body))});
  }));
  router.get('/applications/:id/files',handle(async(req,res)=>{
    if(!isUuid(req.params.id))throw new ApiError(400,'Mã hồ sơ không hợp lệ.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    if(!await db.application(req.params.id))throw new ApiError(404,'Không tìm thấy hồ sơ.');
    res.json({files:await db.files(req.params.id)});
  }));
  router.post('/applications/:id/files',(req,res,next)=>{
    void handle(async()=>{
      if(!isUuid(req.params.id))throw new ApiError(400,'Mã hồ sơ không hợp lệ.');
      const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
      const app=await db.application(req.params.id);
      if(!app)throw new ApiError(404,'Không tìm thấy hồ sơ.');
      if(db.user.role!=='candidate'||app.applicant_id!==db.user.id)throw new ApiError(403,'Chỉ chủ hồ sơ được thêm tệp.');
      res.locals.fileStore=db;next();
    })(req,res);
  },raw({type:'application/octet-stream',limit:MAX_FILE_BYTES}),handle(async(req,res)=>{
    let name:string;
    try{name=decodeURIComponent(req.get('X-File-Name')??'');}catch{throw new ApiError(400,'Tên tệp không hợp lệ.');}
    const header=req.get('X-Evidence-Declaration')??encodeURIComponent('{}');
    if(header.length>6000)throw new ApiError(400,'Thông tin khai báo quá dài.');
    let declaration;
    try{declaration=JSON.parse(decodeURIComponent(header));}catch{throw new ApiError(400,'Thông tin minh chứng không hợp lệ.');}
    const file=await uploadEvidence(res.locals.fileStore,fileStorage(),String(req.params.id),req.body,name,req.query.kind,validateDeclaration(declaration));
    res.status(201).json({file});
  }));
  router.get('/files/:id/content',handle(async(req,res)=>{
    if(!isUuid(req.params.id))throw new ApiError(400,'Mã tệp không hợp lệ.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    const {file,bytes}=await readEvidence(db,fileStorage(),req.params.id);
    res.setHeader('Content-Type',file.mime_type);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");
    res.setHeader('Content-Disposition',`attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(file.original_name).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`)}`);
    res.send(bytes);
  }));
  router.get('/files/:id/check',handle(async(req,res)=>{
    if(!isUuid(req.params.id))throw new ApiError(400,'Mã tệp không hợp lệ.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    const file=await db.file(req.params.id);if(!file)throw new ApiError(404,'Không tìm thấy tệp.');
    const app=await db.application(file.application_id);if(!app)throw new ApiError(404,'Không tìm thấy hồ sơ.');
    const check=await db.check(file.id);
    res.json({check:check?{...check,stale:check.claims_hash!==claimsHash(app,file)||check.file_sha256!==file.sha256}:null});
  }));
  router.post('/files/:id/check',handle(async(req,res)=>{
    if(!isUuid(req.params.id))throw new ApiError(400,'Mã tệp không hợp lệ.');
    if(req.body&&(Object.keys(req.body).some(k=>k!=='force')||(req.body.force!==undefined&&typeof req.body.force!=='boolean')))throw new ApiError(400,'Chỉ được yêu cầu đọc lại; không được gửi kết quả đối chiếu.');
    const db=await store(req);if(!db.user)throw new ApiError(401,'Hãy đăng nhập trước.');
    res.json({check:await checkEvidence(db,fileStorage(),req.params.id,options.extract,req.body?.force===true)});
  }));
  const bodyError:ErrorRequestHandler=(error,_req,res,next)=>{
    if(error.type==='entity.too.large'){res.status(413).json({error:'Mỗi tệp tối đa 10 MiB.'});return;}
    next(error);
  };
  router.use(bodyError);
  return router;
}
