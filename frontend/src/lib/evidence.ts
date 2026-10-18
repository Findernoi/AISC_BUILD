import type { EvidenceFile } from '../types';
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open('talentforecast-evidence', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Không thể mở kho minh chứng trên trình duyệt.'));
  });
}
export async function saveEvidence(file: File): Promise<EvidenceFile> {
  if (file.size > 5 * 1024 * 1024 || !/\.(pdf|png|jpe?g)$/i.test(file.name)) throw new Error('Minh chứng phải là PDF, PNG hoặc JPG tối đa 5MB.');
  const db = await openStore(); const id = crypto.randomUUID();
  try { await new Promise<void>((resolve,reject) => { const tx = db.transaction('files','readwrite'); tx.objectStore('files').put(file,id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error('Không lưu được minh chứng.')); tx.onabort = () => reject(new Error('Kho minh chứng không đủ dung lượng.')); }); }
  finally { db.close(); }
  return { id, name: file.name, size: file.size, type: file.type };
}
export async function getEvidence(id: string): Promise<Blob | undefined> {
  const db = await openStore();
  try { return await new Promise((resolve,reject) => { const req = db.transaction('files','readonly').objectStore('files').get(id); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(new Error('Không đọc được minh chứng.')); }); }
  finally { db.close(); }
}
export async function previewEvidence(file: EvidenceFile) {
  const blob = await getEvidence(file.id); if (!blob) throw new Error('Tệp không còn trong trình duyệt này. Cần tải lại trước khi duyệt.');
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click(); setTimeout(() => URL.revokeObjectURL(url),60_000);
}
