import placement from '../data/models/placement.json' with { type: 'json' };
import workforce from '../data/models/workforce.json' with { type: 'json' };

export type WorkforceSnapshot = Record<string, string | number>;
export const placementMetadata = placement;
export const workforceMetadata = workforce;

export function nextMonth(month: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, m] = month.split('-').map(Number);
  if (year < 1 || (year === 9999 && m === 12)) return null;
  return `${year + (m === 12 ? 1 : 0)}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
}

export function predictPlacement(gpaOn10: number | undefined, projectCount?: number) {
  if (gpaOn10 !== undefined && (!Number.isFinite(gpaOn10) || gpaOn10 < 0 || gpaOn10 > 10)) return null;
  if (projectCount !== undefined && (!Number.isInteger(projectCount) || projectCount < 0)) return null;
  const input = [gpaOn10, projectCount];
  const warnings: string[] = [];
  const factors = input.map((value, i) => {
    const imputed = value === undefined;
    const actual = imputed ? placement.imputer.statistics[i] : value;
    const name = placement.features[i] as keyof typeof placement.training_ranges;
    const range = placement.training_ranges[name];
    if (imputed) warnings.push(`Chưa khai ${i === 0 ? 'GPA' : 'số dự án'}: dùng median train ${actual}, không coi là 0.`);
    if (actual < range[0] || actual > range[1]) warnings.push(`${name} = ${actual} ngoài phạm vi học ${range[0]}–${range[1]}; kết quả là ngoại suy.`);
    return {
      key: i === 0 ? 'gpa' : 'projects', label: i === 0 ? 'GPA quy về thang 10' : 'Số dự án tự khai',
      observed: imputed ? `Chưa khai · điền median ${actual}` : String(actual),
      value: (actual - placement.scaler.mean[i]) / placement.scaler.scale[i] * placement.coefficients[i],
    };
  });
  const z = placement.intercept + factors.reduce((sum, f) => sum + f.value, 0);
  const probability = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  return { probability, factors, warnings, intercept: placement.intercept, mode: 'ml' as const };
}

const numeric = (value: unknown): number | null => {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

export function predictWorkforce(input: WorkforceSnapshot) {
  const fail = (error: string) => ({ ok: false as const, error });
  if (numeric(input.horizon_months) !== 1 || nextMonth(String(input.origin_month)) !== input.target_month) return fail('Chỉ hỗ trợ tháng kế tiếp với mốc lịch sử hợp lệ.');
  if (numeric(input.is_synthetic) !== 1 || input.data_source !== 'synthetic') return fail('Mô hình này chỉ được kiểm tra trên dữ liệu giả lập; chưa hỗ trợ doanh nghiệp thật.');
  const origin = String(input.origin_month);
  const [year, month] = origin.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (input.snapshot_date !== `${origin}-${lastDay}`) return fail('Ngày chốt phải là cuối tháng lịch sử.');
  if (numeric(input.month_index) !== (year - 2019) * 12 + month - 1) return fail('Thứ tự tháng không khớp mốc lịch sử.');
  const targetMonth = Number(String(input.target_month).slice(-2));
  const workingDays = numeric(input.working_days_next_month);
  if (workingDays === null || workingDays < 1 || workingDays > 31) return fail('Ngày làm việc cần nằm trong khoảng 1–31.');
  if (Math.abs((numeric(input.target_month_sin) ?? Infinity) - Math.sin(2 * Math.PI * targetMonth / 12)) > 1e-7 ||
      Math.abs((numeric(input.target_month_cos) ?? Infinity) - Math.cos(2 * Math.PI * targetMonth / 12)) > 1e-7) return fail('Đặc trưng mùa vụ không khớp tháng đích.');
  const encoded: number[] = [1];
  const decimalFields = new Set(['target_month_sin', 'target_month_cos', 'required_interns_mean_3m', 'required_interns_mean_6m', 'overtime_hours_current', 'planned_workload_hours_next_month']);
  for (const [i, feature] of workforce.encoder.numeric_features.entries()) {
    const value = numeric(input[feature]);
    if (value === null) return fail(`Thiếu hoặc sai đầu vào: ${feature}.`);
    if (!feature.startsWith('target_month_') && value < 0) return fail(`Đầu vào âm: ${feature}.`);
    if (!decimalFields.has(feature) && !Number.isInteger(value)) return fail(`Cần số nguyên: ${feature}.`);
    encoded.push((value - workforce.encoder.mean[i]) / workforce.encoder.scale[i]);
  }
  for (const feature of workforce.encoder.categorical_features) {
    const categories = workforce.encoder.categories[feature as keyof typeof workforce.encoder.categories];
    if (!categories.includes(String(input[feature]))) return fail(`Chưa kiểm định ${feature}: ${input[feature] ?? 'chưa nhập'}.`);
    encoded.push(...categories.slice(1).map(c => Number(c === input[feature])));
  }
  if (encoded.length !== workforce.coefficients.length) return fail('Model và thứ tự đặc trưng không khớp.');
  const total = Math.max(0, encoded.reduce((sum, value, i) => sum + value * workforce.coefficients[i], 0));
  if (!Number.isFinite(total)) return fail('Đầu vào vượt khả năng tính của mô hình.');
  const rounded = Math.floor(total + 0.5);
  const current = Number(input.interns_current);
  const available = Math.max(0, current - Number(input.planned_intern_exits_next_month) + Number(input.confirmed_intern_starts_next_month));
  return { ok: true as const, total, rounded, current, available, additional: Math.max(0, rounded - available) };
}
