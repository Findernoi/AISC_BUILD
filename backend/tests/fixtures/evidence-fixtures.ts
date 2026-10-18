export function makeEvidencePdf(lines:string[]) {
  const stream=lines.map((line,i)=>`BT /F1 18 Tf 50 ${780-i*35} Td (${line.replace(/[()\\]/g,'')}) Tj ET`).join('\n');
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let source='%PDF-1.4\n';const offsets:number[]=[];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(source));source+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=Buffer.byteLength(source);
  source+=`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(source);
}
export function makeScannedPdf(jpeg:Buffer,width:number,height:number) {
  const drawing=Buffer.from(`q ${width} 0 0 ${height} 0 0 cm /Image1 Do Q`);
  const objects=[
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Image1 5 0 R >> >> /Contents 4 0 R >>`),
    Buffer.concat([Buffer.from(`<< /Length ${drawing.length} >>\nstream\n`),drawing,Buffer.from('\nendstream')]),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,Buffer.from('\nendstream')]),
  ];
  const pieces=[Buffer.from('%PDF-1.4\n')],offsets:number[]=[];
  objects.forEach((object,i)=>{offsets.push(pieces.reduce((sum,p)=>sum+p.length,0));pieces.push(Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n'));});
  const xref=pieces.reduce((sum,p)=>sum+p.length,0);
  pieces.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(pieces);
}
