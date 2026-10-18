import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { PGlite } from '@electric-sql/pglite';
import { PREVIEW_IDENTITIES, type PreviewIdentity } from '../../shared/database';
import { ApiError, validateApplication, validateJob } from './recruitment-validation';
import { supabaseStore, type RecruitmentStore } from './recruitment-store';

const LOOPBACK=['127.0.0.1','::1','::ffff:127.0.0.1'];
const COOKIE='recruitment_local_session';
export function createRecruitmentRouter(options: {local:boolean; database?:()=>Promise<PGlite>}) {
  const router=Router();
  const sessions=new Map<string,{identity:PreviewIdentity;expires:number}>();
  const local=options.local && process.env.NODE_ENV !== 'production';
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
      if(code==='42501') {res.status(403).json({error:'Bạn không có quyền thực hiện thao tác này hoặc vị trí đã đóng.'});return;}
      if(['23514','23502','22P02','23503'].includes(code ?? '')) {res.status(400).json({error:'Dữ liệu không hợp lệ hoặc vị trí không còn tồn tại.'});return;}
      if(['42P01','42883','PGRST202','PGRST205'].includes(code ?? '')) {res.status(503).json({error:'Database chưa sẵn sàng. Cần áp dụng hai migration tuyển dụng trước.'});return;}
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
  return router;
}
