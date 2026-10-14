// @ts-nocheck
/* Documentos de los informes interactivos (nacional y ranking): Word, Excel y
 * PDF en hoja vertical, con el banner institucional (franja, logo y título).
 *
 * Cada informe arma un MODELO común y este módulo lo convierte en archivo:
 *   { title, scope, file, fecha, fuente,
 *     secs: [{ h, sheet, p:[texto], list, charts:[{cap, img}], table:{cols, rows, small} }] }
 * Columnas: { h, t, w } con t = txt · n (número) · p (porcentaje) · pp (puntos
 * porcentuales) · s (número con signo). Filas: { c:[valores], over:Set(columnas
 * destacadas en rojo), bold, txtRow (valores ya escritos) }.
 *
 * Las herramientas (docx, exceljs, jspdf) vienen incluidas en Avance de
 * Sumarios (las redes corporativas bloquean descargas de internet) y se cargan
 * solo al generar un informe, para que la página abra rápido. Un informe
 * guardado como .html no genera documentos: necesita el sistema.
 *
 * Mismo estilo JavaScript que el motor del informe (sin tipado estricto).
 */
const LOGO_W = 220, LOGO_H = 200;
const NF = new Intl.NumberFormat('es-CL');
const fmt = (v) => (v == null ? '—' : NF.format(Math.round(v)));
const pct = (v) => (v == null ? '—' : (v * 100).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %');
const pp = (v) => (v == null ? '—' : Math.abs(v) < 0.0005 ? '0,0 pp' : (v > 0 ? '+' : '−') + Math.abs(v * 100).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' pp');
const fmtS = (v) => (v == null ? '—' : Math.round(v) === 0 ? '0' : (v > 0 ? '+' : '−') + NF.format(Math.abs(Math.round(v))));

export type FormatoDocumento = 'docx' | 'xlsx' | 'pdf';

function cellFmt(v, t) {
  if (v == null || v === '') return t === 'txt' ? '' : '—';
  if (t === 'n') return fmt(v);
  if (t === 'p') return pct(v);
  if (t === 'pp') return pp(v);
  if (t === 's') return fmtS(v);
  return String(v);
}

async function cargarLibs(fx) {
  if (fx === 'docx') return { docx: await import('docx') };
  if (fx === 'xlsx') return { ExcelJS: (await import('exceljs')).default };
  const [{ jsPDF }, at] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable: at.autoTable || at.default };
}

async function toXlsx(M, L) {
  const wb=new L.ExcelJS.Workbook();wb.creator="Dirección de Educación Pública";
  const sheetName=n=>(n||"Tabla").replace(/[\\\/\?\*\[\]:]/g,"").slice(0,31);
  const wsI=wb.addWorksheet("Informe");wsI.getColumn(1).width=140;
  const add=(t,o={})=>{const r=wsI.addRow([t]);if(o.bold)r.font={bold:true,size:o.size||11,color:o.color?{argb:o.color}:undefined}};
  add(M.title,{bold:true,size:14,color:"FF1B4673"});add(`Seguimiento de sumarios administrativos · ${M.scope}`);add(M.fuente);add("");
  M.secs.forEach(s=>{add(s.h+(s.table&&s.sheet?` (ver hoja «${sheetName(s.sheet)}»)`:""),{bold:true,color:"FF0F69B4"});(s.p||[]).forEach(t=>add((s.list?"• ":"")+t));add("")});
  const used=new Set(["Informe"]);
  M.secs.filter(s=>s.table&&s.sheet).forEach(s=>{
    let nm=sheetName(s.sheet),i=2;while(used.has(nm))nm=sheetName(s.sheet).slice(0,28)+" "+(i++);used.add(nm);
    const T=s.table,ws=wb.addWorksheet(nm);
    ws.addRow([s.h]).font={bold:true,size:12,color:{argb:"FF0F69B4"}};ws.addRow([M.title]);ws.addRow([]);
    const hr=ws.addRow(T.cols.map(c=>c.h));hr.font={bold:true,color:{argb:"FFFFFFFF"}};hr.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0F69B4"}};c.alignment={horizontal:"center",vertical:"middle",wrapText:true}});
    T.rows.forEach(r=>{const row=ws.addRow(r.c.map(v=>v==null?null:v));
      r.c.forEach((v,j)=>{const t=T.cols[j].t,cell=row.getCell(j+1);if(v==null||t==="txt"||r.txtRow)return;
        cell.numFmt=t==="p"?"0.0%":t==="pp"?'+0.0%" pp";-0.0%" pp";0.0%" pp"':t==="s"?"+#,##0;-#,##0;0":"#,##0";
        if(r.over.has(j)){cell.font={bold:true,color:{argb:"FFD03B3B"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFBE7E6"}}}});
      if(r.bold)row.font={bold:true}});
    T.cols.forEach((c,j)=>ws.getColumn(j+1).width=c.t==="txt"?Math.max(8,Math.round((c.w||1)*14)):14);
    ws.autoFilter={from:{row:4,column:1},to:{row:4+T.rows.length,column:T.cols.length}};
    ws.views=[{state:"frozen",ySplit:4}];
    // Gráficos del apartado (si los trae): bajo la tabla, como imagen.
    let fila=ws.rowCount+2;
    (s.charts||[]).forEach(c=>{if(!c.img)return;const w=640,h=Math.round(w*c.img.H/c.img.W);
      ws.getCell(fila,1).value=c.cap;ws.getCell(fila,1).font={bold:true,color:{argb:"FF1B4673"}};
      ws.addImage(wb.addImage({base64:c.img.jpg,extension:"jpeg"}),{tl:{col:0,row:fila},ext:{width:w,height:h}});
      fila+=Math.ceil(h/20)+3});
  });
  return new Blob([await wb.xlsx.writeBuffer()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}

const pdfTxt=s=>String(s).replace(/[−–]/g,"-").replace(/[▲▼•]/g,"").replace(/[“”]/g,'"').replace(/±/g,"+/-");
function toPdf(M, LB, LOGO) {
  const {jsPDF,autoTable}=LB;const doc=new jsPDF({orientation:"portrait",unit:"pt",format:"letter"});
  const PW=doc.internal.pageSize.getWidth(),PH=doc.internal.pageSize.getHeight(),L=44,R=44,TW=PW-L-R;let y=40;
  const need=h=>{if(y+h>PH-48){doc.addPage();y=44}};
  doc.setFillColor(15,105,180);doc.rect(0,0,PW/3,5,"F");doc.setFillColor(226,44,44);doc.rect(PW/3,0,PW*2/3,5,"F");
  const lh=58,lw=lh*LOGO_W/LOGO_H;doc.addImage(LOGO,"PNG",L,22,lw,lh);const TX=L+lw+14;
  doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(15,105,180);doc.text("SEGUIMIENTO DE SUMARIOS ADMINISTRATIVOS",TX,y);y+=18;
  doc.setFontSize(15);doc.setTextColor(27,70,115);doc.splitTextToSize(pdfTxt(M.title),TW-lw-14).forEach(l=>{doc.text(l,TX,y);y+=18});
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(74,82,96);doc.text(pdfTxt(`${M.scope} · Emitido el ${M.fecha}`),TX,y);y=Math.max(y+24,22+lh+20);
  M.secs.forEach(s=>{
    need(40);doc.setFont("helvetica","bold");doc.setFontSize(11.5);doc.setTextColor(15,105,180);doc.text(pdfTxt(s.h),L,y);y+=15;
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(18,22,29);
    (s.p||[]).forEach(t=>{const ls=doc.splitTextToSize(pdfTxt((s.list?"- ":"")+t),TW);need(ls.length*11.5+4);ls.forEach(l=>{doc.text(l,L,y);y+=11.5});y+=5});
    (s.charts||[]).forEach(c=>{if(!c.img)return;const w=TW,h=w*c.img.H/c.img.W;need(h+24);doc.setFont("helvetica","bold");doc.setFontSize(9);doc.text(pdfTxt(c.cap),L,y+2);y+=8;doc.addImage(c.img.jpg,"JPEG",L,y,w,h);y+=h+12;doc.setFont("helvetica","normal")});
    if(s.table){const T=s.table;need(60);
      const tw=T.cols.map(c=>c.w||1),sum=tw.reduce((a,b)=>a+b,0);
      autoTable(doc,{startY:y,margin:{left:L,right:R,top:44,bottom:48},head:[T.cols.map(c=>pdfTxt(c.h))],
        body:T.rows.map(r=>r.c.map((v,j)=>pdfTxt(r.txtRow?(v??""):cellFmt(v,T.cols[j].t)))),theme:"grid",
        styles:{font:"helvetica",fontSize:T.small?7:8.5,cellPadding:T.small?2.4:3.8,lineColor:[217,222,230],lineWidth:.5,textColor:[18,22,29],overflow:"linebreak"},
        headStyles:{fillColor:[15,105,180],textColor:255,fontStyle:"bold",halign:"center",valign:"middle"},
        columnStyles:Object.fromEntries(T.cols.map((c,j)=>[j,{halign:c.t==="txt"?"left":"right",cellWidth:TW*tw[j]/sum}])),
        didParseCell:h=>{if(h.section!=="body")return;const r=T.rows[h.row.index];if(r.bold)h.cell.styles.fontStyle="bold";if(r.over.has(h.column.index)){h.cell.styles.textColor=[208,59,59];h.cell.styles.fontStyle="bold";h.cell.styles.fillColor=[251,231,230]}}});
      y=doc.lastAutoTable.finalY+18;}
  });
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(122,131,146);doc.text(pdfTxt(M.fuente),L,PH-24);doc.text(`Página ${i} de ${n}`,PW-R,PH-24,{align:"right"})}
  return doc.output("blob");
}

async function toDocx(M, LB, LOGO) {
  const D=LB.docx;const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,AlignmentType,ShadingType,ImageRun,BorderStyle,Footer,PageNumber,HeadingLevel}=D;
  const FONT="Arial",TXT=12240-2*1080;
  const P=(t,o={})=>new Paragraph({spacing:{after:o.after??120},alignment:o.align,keepNext:o.keepNext,bullet:o.bullet?{level:0}:undefined,children:[new TextRun({text:t,font:FONT,size:o.size||20,bold:o.bold,color:o.color})]});
  const ch=[];const lb=atob(LOGO.split(",")[1]),lbytes=new Uint8Array(lb.length);for(let i=0;i<lb.length;i++)lbytes[i]=lb.charCodeAt(i);
  ch.push(new Paragraph({spacing:{after:120},children:[new ImageRun({type:"png",data:lbytes,transformation:{width:Math.round(64*LOGO_W/LOGO_H),height:64}})]}));
  ch.push(P("SEGUIMIENTO DE SUMARIOS ADMINISTRATIVOS",{size:16,bold:true,color:"0F69B4",after:80}));
  ch.push(new Paragraph({heading:HeadingLevel.TITLE,spacing:{after:80},children:[new TextRun({text:M.title,font:FONT,size:32,bold:true,color:"1B4673"})]}));
  ch.push(P(`${M.scope} · Emitido el ${M.fecha}`,{size:19,color:"4A5260",after:240}));
  const bd={style:BorderStyle.SINGLE,size:4,color:"D9DEE6"},borders={top:bd,bottom:bd,left:bd,right:bd};
  for(const s of M.secs){
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_2,keepNext:true,spacing:{before:240,after:100},children:[new TextRun({text:s.h,font:FONT,size:24,bold:true,color:"0F69B4"})]}));
    (s.p||[]).forEach(t=>ch.push(P(t,{bullet:s.list})));
    for(const c of (s.charts||[])){if(!c.img)continue;
      ch.push(P(c.cap,{bold:true,size:18,after:60,keepNext:true}));
      ch.push(new Paragraph({spacing:{after:160},children:[new ImageRun({type:"png",data:c.img.bytes,transformation:{width:620,height:Math.round(620*c.img.H/c.img.W)}})]}))}
    if(s.table){const T=s.table,tw=T.cols.map(c=>c.w||1),sum=tw.reduce((a,b)=>a+b,0),cw=tw.map(w=>Math.floor(TXT*w/sum)),fs=T.small?14:17;
      const hdr=new TableRow({tableHeader:true,children:T.cols.map((c,j)=>new TableCell({width:{size:cw[j],type:WidthType.DXA},borders,shading:{type:ShadingType.CLEAR,color:"auto",fill:"0F69B4"},margins:{top:50,bottom:50,left:60,right:60},
        children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:c.h,font:FONT,size:fs,bold:true,color:"FFFFFF"})]})]}))});
      const rows=T.rows.map(r=>new TableRow({cantSplit:true,children:r.c.map((v,j)=>{const o=r.over.has(j);return new TableCell({width:{size:cw[j],type:WidthType.DXA},borders,shading:o?{type:ShadingType.CLEAR,color:"auto",fill:"FBE7E6"}:undefined,margins:{top:30,bottom:30,left:60,right:60},
        children:[new Paragraph({alignment:T.cols[j].t==="txt"?AlignmentType.LEFT:AlignmentType.RIGHT,children:[new TextRun({text:r.txtRow?String(v??""):cellFmt(v,T.cols[j].t),font:FONT,size:fs,bold:o||r.bold,color:o?"D03B3B":"12161D"})]})]})})}));
      ch.push(new Table({width:{size:TXT,type:WidthType.DXA},columnWidths:cw,rows:[hdr,...rows]}));ch.push(P("",{after:120}))}
  }
  const doc=new Document({creator:"Dirección de Educación Pública",title:M.title,styles:{default:{document:{run:{font:FONT,size:20}}}},
    sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1080,bottom:1080,left:1080,right:1080}}},
      footers:{default:new Footer({children:[new Paragraph({children:[new TextRun({text:M.fuente+"  ·  Página ",font:FONT,size:15,color:"7A8392"}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:15,color:"7A8392"})]})]})},
      children:ch}]});
  return await Packer.toBlob(doc);
}

// Un gráfico SVG (texto) → imagen para Word, Excel y PDF: PNG (bytes) y JPEG
// (data URL), a doble resolución para que se vea nítido al imprimir.
export async function svgAImagen(svg: string, W: number, H: number): Promise<{ bytes: Uint8Array; jpg: string; W: number; H: number }> {
  const img = new Image();
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('No fue posible generar el gráfico.')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
  const ctx = cv.getContext('2d'); ctx.scale(2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
  const png = cv.toDataURL('image/png'), b = atob(png.split(',')[1]), bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  return { bytes, jpg: cv.toDataURL('image/jpeg', 0.92), W, H };
}

// Genera el archivo del modelo y lo descarga con el nombre M.file.
export async function generarDocumento(M, fx: FormatoDocumento, logo: string): Promise<string> {
  const LB = await cargarLibs(fx);
  const blob = fx === 'xlsx' ? await toXlsx(M, LB) : fx === 'pdf' ? toPdf(M, LB, logo) : await toDocx(M, LB, logo);
  const nombre = `${M.file}.${fx}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return nombre;
}
