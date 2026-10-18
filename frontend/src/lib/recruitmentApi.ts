import { supabase } from './supabase';

export async function recruitmentFetch(path:string,init:RequestInit={}) {
  const token=(await supabase?.auth.getSession())?.data.session?.access_token;
  const headers=new Headers(init.headers);
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api/recruitment/${path}`,{...init,headers,credentials:'same-origin',cache:'no-store'});
  if(!response.ok) {
    const payload=await response.json().catch(()=>null);
    throw new Error(payload?.error||'Không thực hiện được yêu cầu.');
  }
  return response;
}
