import { cp, mkdir } from 'node:fs/promises';

// Versioned npm assets needed for CJK fonts and embedded PDF image codecs.
const source=new URL('../node_modules/pdfjs-dist/',import.meta.url);
const target=new URL('../frontend/public/pdfjs/',import.meta.url);
await mkdir(target,{recursive:true});
await Promise.all(['cmaps','standard_fonts','wasm'].map(folder=>cp(new URL(folder,source),new URL(folder,target),{recursive:true})));
