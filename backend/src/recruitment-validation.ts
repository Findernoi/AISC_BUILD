import type { ApplicationInput } from '../../shared/recruitment';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400,'Dữ liệu không hợp lệ.');
  return value as Record<string, unknown>;
};
const text = (data: Record<string, unknown>, key: string, max: number, required = false) => {
  const value = data[key] ?? '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new ApiError(400,`Trường ${key} không hợp lệ.`);
  return value.trim();
};
const numeric = (value: unknown, name: string, max: number, integer = false, optional = false): number | null => {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) throw new ApiError(400,`Trường ${name} không hợp lệ.`);
  return value;
};
export function validateApplication(value: unknown): ApplicationInput {
  const d = object(value);
  const allowed = ['job_id','full_name','phone','major','gpa','gpa_scale','graduation_year','project_count','experience_months','skills','project_description'];
  if (Object.keys(d).some(k => !allowed.includes(k))) throw new ApiError(400,'Hồ sơ có trường không được phép gửi.');
  const job_id = text(d,'job_id',36,true);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job_id)) throw new ApiError(400,'Vị trí không hợp lệ.');
  if (!['KHMT','KTPM','AI'].includes(String(d.major)) || !['4.0','10'].includes(String(d.gpa_scale))) throw new ApiError(400,'Ngành hoặc thang GPA không hợp lệ.');
  const year = numeric(d.graduation_year,'graduation_year',2100,true)!;
  if (year < 2000) throw new ApiError(400,'Năm tốt nghiệp phải từ 2000 đến 2100.');
  if (!Array.isArray(d.skills) || d.skills.length > 30 || d.skills.some(s => typeof s !== 'string' || !s.trim() || s.length > 80)) throw new ApiError(400,'Kỹ năng không hợp lệ.');
  return { job_id, full_name:text(d,'full_name',160,true),phone:text(d,'phone',40),
    major:d.major as ApplicationInput['major'],gpa_scale:d.gpa_scale as ApplicationInput['gpa_scale'],
    gpa:numeric(d.gpa,'gpa',d.gpa_scale === '10' ? 10 : 4)!,graduation_year:year,
    project_count:numeric(d.project_count,'project_count',10000,true,true),
    experience_months:numeric(d.experience_months,'experience_months',1200,true,true),
    skills:[...new Set((d.skills as string[]).map(s=>s.trim()))],project_description:text(d,'project_description',10000) };
}
export function validateJob(value: unknown) {
  const d = object(value);
  if (Object.keys(d).some(k=>!['title','department','description','location','min_gpa','requirements'].includes(k))) throw new ApiError(400,'Vị trí có trường không được phép gửi.');
  const requirements=d.requirements??[];
  if(!Array.isArray(requirements)||requirements.length>30||requirements.some(s=>typeof s!=='string'||!s.trim()||s.length>80))throw new ApiError(400,'Yêu cầu kỹ năng không hợp lệ.');
  return {title:text(d,'title',200,true),department:text(d,'department',160,true),description:text(d,'description',10000),location:text(d,'location',200),min_gpa:numeric(d.min_gpa,'min_gpa',4)!,requirements:[...new Set((requirements as string[]).map(s=>s.trim()))]};
}
