import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';

const require=createRequire(import.meta.url);
const bytes=Buffer.from(workerData.bytes);
let ocr;
function imageDimensions() {
  if(workerData.mime==='image/png'&&bytes.length>=24)return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
  for(let offset=2;offset+9<bytes.length;) {
    if(bytes[offset++]!==255)continue;
    let marker=bytes[offset++];while(marker===255&&offset<bytes.length)marker=bytes[offset++];
    if(marker===218||marker===217)break;
    if(marker===216||marker===0||marker===1||(marker>=208&&marker<=215))continue;
    const length=bytes.readUInt16BE(offset);if(length<2||offset+length>bytes.length)break;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3)];
    offset+=length;
  }
  throw new Error('IMAGE_DIMENSIONS');
}
async function recognize(image) {
  if(!ocr) {
    const langPath=fileURLToPath(new URL('../../.local/ocr-traineddata/',import.meta.url));
    await mkdir(langPath,{recursive:true});
    for(const lang of ['eng','vie'])await cp(join(dirname(require.resolve(`@tesseract.js-data/${lang}`)),'4.0.0_best_int',`${lang}.traineddata.gz`),join(langPath,`${lang}.traineddata.gz`));
    ocr=await createWorker(['eng','vie'],1,{langPath,cacheMethod:'none',gzip:true,logger:()=>{},errorHandler:()=>{}});
  }
  const result=await ocr.recognize(image);
  return {text:result.data.text.slice(0,12000),confidence:result.data.confidence};
}
async function processDocument() {
  if(workerData.mime!=='application/pdf') {
    const [width,height]=imageDimensions();if(!width||!height||width*height>12000000)throw new Error('IMAGE_LIMIT');
    const image=await loadImage(bytes);
    if(image.width*image.height>12000000)throw new Error('IMAGE_LIMIT');
    const scale=Math.min(2200/image.width,3000/image.height,1);
    const canvas=createCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const read=await recognize(canvas.toBuffer('image/png'));
    return {pages:[{page:1,...read,method:'ocr'}],partial:false};
  }
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const assets=fileURLToPath(new URL('../../node_modules/pdfjs-dist/',import.meta.url));
  const task=getDocument({data:new Uint8Array(bytes),enableXfa:false,useSystemFonts:true,maxImageSize:12000000,canvasMaxAreaInBytes:48000000,
    standardFontDataUrl:join(assets,'standard_fonts')+'/',cMapUrl:join(assets,'cmaps')+'/',cMapPacked:true,wasmUrl:join(assets,'wasm')+'/'});
  const pdf=await task.promise;
  try {
    const pages=[];
    for(let number=1;number<=Math.min(pdf.numPages,5);number++) {
      const page=await pdf.getPage(number);const content=await page.getTextContent();
      const text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').slice(0,12000);
      if(text.replace(/\s/g,'').length>=30)pages.push({page:number,text,method:'pdf-text',confidence:null});
      else {
        const original=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:Math.min(2000/original.width,2800/original.height,3)});
        const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
        await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
        const read=await recognize(canvas.toBuffer('image/png'));
        pages.push({page:number,...read,method:'ocr'});
      }
      page.cleanup();
    }
    return {pages,partial:pdf.numPages>5};
  }finally{await task.destroy();}
}
try{parentPort.postMessage(await processDocument());}
catch{parentPort.postMessage({pages:[],partial:false,failed:true});}
finally{if(ocr)await ocr.terminate();}
