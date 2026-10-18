import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc=workerUrl;
export default function PdfPreview({data}:{data:Uint8Array}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [document,setDocument]=useState<PDFDocumentProxy|null>(null);
  const [page,setPage]=useState(1);
  const [error,setError]=useState('');
  const [rendering,setRendering]=useState(true);
  useEffect(()=>{
    setDocument(null);setPage(1);setError('');setRendering(true);
    // Copy because the worker transfers the buffer. Never execute PDF JavaScript/XFA.
    const assetRoot=`${import.meta.env.BASE_URL}pdfjs/`;
    const task=getDocument({data:data.slice(),enableXfa:false,useSystemFonts:true,
      cMapUrl:`${assetRoot}cmaps/`,cMapPacked:true,standardFontDataUrl:`${assetRoot}standard_fonts/`,wasmUrl:`${assetRoot}wasm/`});
    let active=true;
    void task.promise.then(pdf=>{if(active)setDocument(pdf);}).catch(()=>{if(active){setError('Không đọc được PDF này. Bạn có thể tải tệp về để kiểm tra.');setRendering(false);}});
    return()=>{active=false;void task.destroy();};
  },[data]);
  useEffect(()=>{
    if(!document||!canvas.current)return;
    let active=true,renderTask:RenderTask|undefined;
    setRendering(true);setError('');
    void document.getPage(page).then(async pdfPage=>{
      if(!active||!canvas.current)return;
      const original=pdfPage.getViewport({scale:1});
      const scale=Math.min(640/original.width,1600/original.height,2)*Math.min(window.devicePixelRatio||1,2);
      const viewport=pdfPage.getViewport({scale});
      const target=canvas.current;
      target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);
      renderTask=pdfPage.render({canvas:target,viewport});
      await renderTask.promise;
    }).then(()=>{if(active)setRendering(false);}).catch(()=>{if(active){setError('Không hiển thị được trang PDF. Bạn có thể tải bản gốc.');setRendering(false);}});
    return()=>{active=false;renderTask?.cancel();};
  },[document,page]);
  return <div className="space-y-3">
    {document&&<div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300"><button className="btn-secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Trang trước</button><span>Trang {page} / {document.numPages}</span><button className="btn-secondary" disabled={page>=document.numPages} onClick={()=>setPage(p=>p+1)}>Trang sau</button></div>}
    {rendering&&<p role="status" className="text-xs text-slate-400">Đang hiển thị PDF…</p>}
    {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    <canvas ref={canvas} aria-label={`Trang PDF ${page}`} className={`mx-auto h-auto max-w-full rounded-lg bg-white ${error||!document?'hidden':''}`} />
  </div>;
}
