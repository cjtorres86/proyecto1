// @ts-nocheck
/* Motor del Informe Interactivo de avance de sumarios.
 *
 * Es el MISMO motor de la propuesta aprobada (propuesta-informe-sumarios.html),
 * trasladado a Avance de Sumarios con estas diferencias:
 *  - los datos vienen de /cases/informe-avance (mismo cálculo que el Histórico);
 *  - quien ve un solo SLEP ve solo el suyo y su posición en el ranking;
 *  - Word, Excel y PDF se generan con herramientas incluidas en el sistema
 *    (docx, exceljs, jspdf), cargadas solo al generar un informe;
 *  - nombre, perfil y "Salir" son los de la sesión real.
 *
 * Se mantiene en JavaScript con la misma estructura de la propuesta (sin
 * tipado estricto: @ts-nocheck) para que cualquier ajuste al diseño aprobado
 * se haga en un solo lugar y se compare fácil con la propuesta.
 */
export interface ConfigMotor {
  fuente: { sleps: string[]; anios: Record<string, (number[] | null)[][]> };
  posiciones: Record<string, ({ pos: number | null; de: number } | null)[]>;
  alcanceCompleto: boolean;
  logo: string;
  usuario: { nombre: string; perfil: string };
  inicial?: { anio?: string; mes?: number; slep?: string };
  alSalir: () => void;
}

export function iniciarMotor(CFG: ConfigMotor): () => void {
const FUENTE=CFG.fuente,POSICIONES=CFG.posiciones,LOGO=CFG.logo,LOGO_W=220,LOGO_H=200;
const oyentes=[],observadores=[];
function escuchar(obj,ev,fn,op){obj.addEventListener(ev,fn,op);oyentes.push([obj,ev,fn,op])}
/* ===== Datos y cálculo del avance =====
   Regla de Avance de Sumarios (DashboardService.pctAvanceDe):
   % de avance = procesos cerrados (campo 26) ÷ sumarios instruidos (campo 21).
   Cada registro mensual: [involucrados, instruidos, en curso, resueltos,
   impugnados, enviados CGR, cerrados, censura, multa, suspensión, destitución,
   cerrados sin sanción]. */
const MESES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_L=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const cap1=s=>s.charAt(0).toUpperCase()+s.slice(1);
const NF=new Intl.NumberFormat("es-CL");
const fmt=v=>v==null?"—":NF.format(Math.round(v));
const pct=v=>v==null?"—":(v*100).toLocaleString("es-CL",{minimumFractionDigits:1,maximumFractionDigits:1})+" %";
const pp=v=>v==null?"—":Math.abs(v)<.0005?"0,0 pp":(v>0?"+":"−")+Math.abs(v*100).toLocaleString("es-CL",{minimumFractionDigits:1,maximumFractionDigits:1})+" pp";
const fmtS=v=>v==null?"—":Math.round(v)===0?"0":(v>0?"+":"−")+NF.format(Math.abs(Math.round(v)));
const CORTE_BAJO=.25,CORTE_ALTO=.75;
const nivel=a=>a==null?"na":a<CORTE_BAJO?"bajo":a<CORTE_ALTO?"medio":"alto";
const NIVEL_TXT={bajo:"Avance bajo",medio:"Avance medio",alto:"Avance alto",na:"Sin sumarios instruidos"};

const DATA={};
for(const y of Object.keys(FUENTE.anios).sort()){
  const sleps=FUENTE.sleps.map((nombre,i)=>({cod:i,nombre,m:FUENTE.anios[y][i]}));
  const con=[...Array(12).keys()].filter(m=>sleps.some(s=>s.m[m]));
  DATA[y]={sleps,primero:con[0],ultimoMes:con.length?con[con.length-1]+1:0,
    rango:con.length?`${MESES[con[0]]}–${MESES[con[con.length-1]]}`:"sin datos"};
}
const YEARS=Object.keys(DATA).sort();

function metr(r,n){
  if(!r)return null;
  const [inv,ins,curso,res,imp,env,cerr,cen,mul,sus,des,sin]=r;
  const san=cen+mul+sus+des;
  return {inv,ins,curso,res,imp,env,cerr,cen,mul,sus,des,san,sin,av:ins>0?cerr/ins:null,pend:Math.max(ins-cerr,0),n};
}
// Registro de un SLEP, o la suma de todos ("TOTAL"), en un mes.
function rec(y,key,m){
  const d=DATA[y];if(!d||m==null||m<0)return null;
  if(key==="TOTAL"){const rs=d.sleps.map(s=>s.m[m]).filter(Boolean);if(!rs.length)return null;
    return metr(rs.reduce((a,r)=>a.map((v,i)=>v+r[i]),Array(12).fill(0)),rs.length)}
  const s=d.sleps[key];return s?metr(s.m[m],1):null;
}
// Ranking de un mes: posición por % de avance (empates: más cerrados, luego nombre).
function ranking(y,m){
  if(!CFG.alcanceCompleto){const d=DATA[y],s=d.sleps[0],r=s?metr(s.m[m]):null,p=POSICIONES[y]?.[m];
    const L=r&&r.av!=null&&p&&p.pos?[{s,r}]:[];return {L,pos:new Map(L.length?[[s.cod,p.pos]]:[]),n:p?p.de:0}}
  const d=DATA[y];const L=d.sleps.map(s=>({s,r:metr(s.m[m])})).filter(x=>x.r&&x.r.av!=null)
    .sort((a,b)=>b.r.av-a.r.av||b.r.cerr-a.r.cerr||a.s.nombre.localeCompare(b.s.nombre,"es"));
  const pos=new Map(L.map((x,i)=>[x.s.cod,i+1]));return {L,pos,n:L.length};
}

/* ===== Estado ===== */
const S={year:YEARS[YEARS.length-1],slep:"TOTAL",mes:null,cmp:false,orden:"rank",escala:"100",rkDir:"desc"};
try{Object.assign(S,JSON.parse(localStorage.getItem("avanceSumarios")||"{}"));}catch(e){}
if(!DATA[S.year])S.year=YEARS[YEARS.length-1];
S.mes=null;
if(!CFG.alcanceCompleto)S.slep=0;
if(CFG.inicial){const ini=CFG.inicial;if(ini.anio&&DATA[ini.anio])S.year=ini.anio;if(ini.mes!=null)S.mesPedido=ini.mes;if(CFG.alcanceCompleto&&ini.slep!=null){const k=FUENTE.sleps.indexOf(ini.slep);if(k>=0)S.slep=k}}
const save=()=>{try{localStorage.setItem("avanceSumarios",JSON.stringify({slep:S.slep,orden:S.orden,cmp:S.cmp,escala:S.escala,rkDir:S.rkDir}))}catch(e){}};
const Y=()=>DATA[S.year];
const prevYear=()=>String(+S.year-1);
const hasPrev=()=>!!DATA[prevYear()];
const cmpOn=()=>S.cmp&&hasPrev();
const slepName=key=>key==="TOTAL"?`Total ${Y().sleps.length} SLEP`:Y().sleps[key].nombre;
const $=id=>document.getElementById(id);

const ICON_UP='<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9 8.5H1z" fill="currentColor"/></svg>';
const ICON_DN='<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5 9 1.5H1z" fill="currentColor"/></svg>';
function pill(nv,txt){return `<span class="pill ${nv}">${nv==="alto"?ICON_UP:nv==="bajo"?ICON_DN:""}${txt||NIVEL_TXT[nv]}</span>`}

/* ===== Render general ===== */
function buildSelects(){
  const d=Y();
  $("years").innerHTML=YEARS.map(y=>`<button type="button" data-y="${y}" aria-pressed="${y===S.year}">${y}<small>${DATA[y].rango}</small></button>`).join("");
  $("slep").innerHTML=(CFG.alcanceCompleto?`<option value="TOTAL">Total ${d.sleps.length} SLEP (consolidado)</option>`:"")+
    [...d.sleps].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).map(s=>`<option value="${s.cod}">${s.nombre}</option>`).join("");
  $("slep").value=String(S.slep);
  const meses=[...Array(d.ultimoMes).keys()].filter(m=>m>=d.primero);
  $("mes").innerHTML=meses.map(m=>`<option value="${m}">${cap1(MESES_L[m])} ${S.year}</option>`).join("");
  if(S.mes==null&&S.mesPedido!=null&&S.mesPedido>=d.primero&&S.mesPedido<d.ultimoMes){S.mes=S.mesPedido;S.mesPedido=null}
  if(S.mes==null||S.mes<d.primero||S.mes>=d.ultimoMes)S.mes=d.ultimoMes-1;
  $("mes").value=S.mes;
}

function render(){
  save();
  const d=Y(),m=S.mes,key=S.slep,R=rec(S.year,key,m),Rp=rec(S.year,key,m-1),rk=ranking(S.year,m);
  $("cmp").checked=S.cmp;$("cmp").disabled=!hasPrev();$("cmp-wrap").classList.toggle("off",!hasPrev());
  $("cmp-txt").textContent=hasPrev()?`Comparar con ${prevYear()}`:`Comparar con ${prevYear()} (sin datos)`;
  const nm=slepName(key);
  $("ficha-eyebrow").textContent=key==="TOTAL"?"Consolidado nacional":`Servicio Local de Educación Pública${rk.pos.get(key)?` · ${rk.pos.get(key)}° de ${rk.n} en el ranking`:""}`;
  $("h-ficha").textContent=key==="TOTAL"?`Total de los ${d.sleps.length} SLEP`:d.sleps[key].nombre;
  const nv=R?nivel(R.av):"na";
  $("ficha-pill").innerHTML=!R?pill("na","Sin información"):pill(nv,R.av==null?null:`${NIVEL_TXT[nv]} · ${pct(R.av)}`);
  $("lede").innerHTML=!R?`En ${MESES_L[m]} de ${S.year}, <b>${nm}</b> no registra información.`:
    R.av==null?`En ${MESES_L[m]} de ${S.year}, <b>${nm}</b> no registra sumarios instruidos, por lo que no hay avance que medir.`:
    `En ${MESES_L[m]} de ${S.year}, <b>${nm}</b> tiene <b>${fmt(R.cerr)} de ${fmt(R.ins)}</b> sumarios instruidos con proceso cerrado: un avance de <b>${pct(R.av)}</b>`+
    (Rp&&Rp.av!=null?` (${pp(R.av-Rp.av)} respecto de ${MESES_L[m-1]})`:"")+`. Quedan <b>${fmt(R.pend)}</b> procesos por cerrar para llegar a la meta.`+
    (key==="TOTAL"?` Informan ${R.n} de ${d.sleps.length} SLEP.`:"");
  drawTiles(R,Rp);
  $("h-chart").textContent=`% de avance · ${nm}, ${S.year}`;
  const vals=[...Array(12).keys()].map(i=>rec(S.year,key,i)).filter(x=>x&&x.av!=null);
  $("sub-chart").textContent=!vals.length?"Sin avance que medir en el año.":
    `${vals.filter(x=>nivel(x.av)==="bajo").length} de ${vals.length} meses informados con avance bajo. Pase el mouse sobre un mes para ver el detalle; haga clic para elegirlo.`;
  $("lg-prev").hidden=!cmpOn();$("lg-prev-t").textContent=`% de avance ${prevYear()}`;
  [...$("escala").children].forEach(b=>b.setAttribute("aria-pressed",b.dataset.e===S.escala));
  [...$("years").children].forEach(b=>b.setAttribute("aria-pressed",b.dataset.y===S.year));
  drawLine();drawDiff();drawTable();drawHeat();drawRanking();drawObs();syncReportForm();
  $("foot").textContent=`Fuente: Avance de Sumarios, datos informados por los Servicios Locales (${S.year}, ${d.rango}). % de avance = procesos cerrados ÷ sumarios instruidos. Los meses sin información aparecen vacíos.`;
}

/* ===== Tarjetas: el proceso como una cadena ===== */
const IND=[
  {k:"inv",n:"Funcionarios involucrados",u:"En casos reportados por CGR",base:null,txt:()=>"Base del proceso"},
  {k:"ins",n:"Sumarios instruidos",u:"N° de funcionarios",base:"inv",txt:(r)=>`${pct(r.inv?r.ins/r.inv:null)} de los involucrados`},
  {k:"curso",n:"Procesos en curso",u:"N° de funcionarios",base:"ins",txt:(r)=>`${pct(r.ins?r.curso/r.ins:null)} de los instruidos`},
  {k:"cerr",n:"Procesos cerrados",u:"N° de funcionarios",base:"ins",key:true,txt:(r)=>`${pct(r.av)} de los instruidos · es el avance`},
  {k:"san",n:"Sanciones aplicadas",u:"Censura, multa, suspensión, destitución",base:"cerr",txt:(r)=>`${pct(r.cerr?r.san/r.cerr:null)} de los cerrados`},
];
function drawTiles(R,Rp){
  const Rpy=cmpOn()?rec(prevYear(),S.slep,S.mes):null;
  $("tiles").innerHTML=IND.map((e,i)=>{
    let body;
    if(!R)body=`<span class="val" style="color:var(--fg-3)">—</span><span class="gl">Sin información para el mes</span>`;
    else{
      const v=R[e.k],pv=Rp?Rp[e.k]:null,ratio=e.base?(R[e.base]?v/R[e.base]:null):1;
      const col=e.key?`var(--${nivel(R.av)==="na"?"fg-3":nivel(R.av)})`:"var(--accent)";
      body=`<span class="val">${fmt(v)}</span><span class="gl">${e.txt(R)}${pv!=null?` · Var. mensual ${fmtS(v-pv)}`:""}${Rpy?`<br>${cap1(MESES_L[S.mes])} ${prevYear()}: ${fmt(Rpy[e.k])} (${fmtS(v-Rpy[e.k])})`:""}</span>
      <span class="meter" aria-hidden="true"><i style="width:${Math.min(ratio??0,1)*100}%;background:${col}"></i></span>
      ${e.key?pill(nivel(R.av),R.av==null?null:`${NIVEL_TXT[nivel(R.av)]} · ${pct(R.av)}`):""}`;
    }
    return `<div class="tile${e.key?" key":""}" role="listitem"><span class="step">${i+1}</span><span class="nm">${e.n}</span><span class="un">${e.u}</span>${body}</div>`;
  }).join("");
}

/* ===== Gráficos (SVG propio, sin librerías) ===== */
const NS="http://www.w3.org/2000/svg";
function el(tag,attrs,parent,txt){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(txt!=null)e.textContent=txt;parent&&parent.appendChild(e);return e}
function segments(idx){const segs=[];let cur=[];idx.forEach((i,j)=>{if(j&&i!==idx[j-1]+1){segs.push(cur);cur=[]}cur.push(i)});if(cur.length)segs.push(cur);return segs}
function niceTicks(lo,hi,n){const span=hi-lo||1,step0=span/n,mag=Math.pow(10,Math.floor(Math.log10(step0))),err=step0/mag;const step=(err>=5?10:err>=2?5:err>=1.5?2:1)*mag;const a=Math.ceil(lo/step-1e-9)*step,t=[];for(let v=a;v<=hi+1e-9;v+=step)t.push(+v.toFixed(10));return t}
const SCREEN={series:"var(--accent)",bajo:"var(--bajo)",medio:"var(--medio)",alto:"var(--alto)",na:"var(--fg-3)",fg:"var(--fg)",fg2:"var(--fg-2)",fg3:"var(--fg-3)",grid:"var(--grid)",surface:"var(--surface)",band:"var(--accent-soft)",prev:"var(--prev)",pend:"var(--pend)"};
const PRINT={series:"#0f69b4",bajo:"#d03b3b",medio:"#b7791f",alto:"#0f69b4",na:"#7a8392",fg:"#111827",fg2:"#4a5260",fg3:"#7a8392",grid:"#e3e7ee",surface:"#ffffff",band:"#e2eef9",prev:"#9aa3b1",pend:"#d03b3b"};

function drawLine(){const box=$("cb-line");buildLine($("line"),Math.max(300,box.clientWidth),{key:S.slep,C:SCREEN,interactive:true,mes:S.mes,cmp:cmpOn(),escala:S.escala,y:S.year})}
function buildLine(svg,W,o){
  const C=o.C,H=o.H||(W<560?240:300),pl=W<560?46:58,pr=W<560?16:86,pt=18,pb=26;
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.setAttribute("height",H);svg.innerHTML="";
  if(!o.interactive){svg.setAttribute("width",W);svg.setAttribute("font-family","Arial, Helvetica, sans-serif");el("rect",{x:0,y:0,width:W,height:H,fill:C.surface},svg)}
  const yr=o.y,R=[...Array(12).keys()].map(i=>rec(yr,o.key,i)),A=R.map(r=>r?r.av:null);
  const P=o.cmp?[...Array(12).keys()].map(i=>{const r=rec(String(+yr-1),o.key,i);return r?r.av:null}):null;
  const vals=A.filter(v=>v!=null),pv=P?P.filter(v=>v!=null):[];
  if(!vals.length){el("text",{x:W/2,y:H/2,"text-anchor":"middle",fill:C.fg3,"font-size":13},svg,"Sin avance que medir en el año");return false}
  let hi=1;if(o.escala==="aj"){const mx=Math.max(...vals,...pv,.01);hi=Math.min(1,niceTicks(0,mx*1.3,4).slice(-1)[0]||mx*1.3);if(hi<mx)hi=mx*1.15}
  const ticks=niceTicks(0,hi,4);hi=Math.max(hi,ticks[ticks.length-1]);
  const bw=(W-pl-pr)/12,x=i=>pl+bw*(i+.5),y=v=>pt+(H-pt-pb)*(1-v/hi);
  svg.setAttribute("aria-label",`% de avance ${slepName(o.key)} ${yr}: `+A.map((v,i)=>v==null?null:`${MESES[i]} ${pct(v)}`).filter(Boolean).join(", ")+". Meta 100 %.");
  ticks.forEach(t=>{el("line",{x1:pl,x2:W-pr,y1:y(t),y2:y(t),stroke:C.grid,"stroke-width":1},svg);el("text",{x:pl-8,y:y(t)+4,"text-anchor":"end",fill:C.fg3,"font-size":11},svg,Math.round(t*100)+" %")});
  MESES.forEach((mn,i)=>el("text",{x:x(i),y:H-6,"text-anchor":"middle",fill:A[i]==null?C.fg3:C.fg2,"font-size":11,"font-weight":i===o.mes?700:400},svg,mn));
  if(o.mes!=null)el("rect",{x:pl+bw*o.mes,y:pt,width:bw,height:H-pt-pb,fill:C.band,opacity:.7},svg);
  if(o.range)el("rect",{x:pl+bw*o.range[0],y:pt,width:bw*(o.range[1]-o.range[0]+1),height:H-pt-pb,fill:C.band,opacity:.7},svg);
  const idx=A.map((v,i)=>v==null?null:i).filter(i=>i!=null);
  // Zona "pendiente por cerrar": entre la línea del avance y la meta (o el techo del gráfico).
  const top=y(Math.min(1,hi));
  segments(idx).forEach(sg=>{const pts=sg.map(i=>`${x(i)},${y(A[i])}`).join(" L");
    el("path",{d:`M${x(sg[0])},${top} L${pts} L${x(sg[sg.length-1])},${top} Z`,fill:C.pend,opacity:.08},svg)});
  if(P&&pv.length){const pidx=P.map((v,i)=>v==null?null:i).filter(i=>i!=null);
    segments(pidx).forEach(sg=>el("path",{d:"M"+sg.map(i=>`${x(i)},${y(P[i])}`).join(" L"),fill:"none",stroke:C.prev,"stroke-width":2,"stroke-dasharray":"1 0"},svg));
    pidx.forEach(i=>el("circle",{cx:x(i),cy:y(P[i]),r:3,fill:C.prev,stroke:C.surface,"stroke-width":1.5},svg))}
  if(hi>=1){const gy=y(1);el("line",{x1:pl,x2:W-pr,y1:gy,y2:gy,stroke:C.fg2,"stroke-width":1.5,"stroke-dasharray":"6 4"},svg);
    if(pr>40){el("text",{x:W-pr+6,y:gy-4,fill:C.fg2,"font-size":11,"font-weight":600},svg,"Meta");el("text",{x:W-pr+6,y:gy+10,fill:C.fg2,"font-size":11},svg,"100 %")}}
  else if(pr>40){el("text",{x:W-pr+6,y:pt+8,fill:C.fg2,"font-size":11,"font-weight":600},svg,"Meta 100 %");el("text",{x:W-pr+6,y:pt+22,fill:C.fg3,"font-size":10.5},svg,"↑ fuera de escala")}
  segments(idx).forEach(sg=>el("path",{d:"M"+sg.map(i=>`${x(i)},${y(A[i])}`).join(" L"),fill:"none",stroke:C.series,"stroke-width":2.2,"stroke-linejoin":"round"},svg));
  idx.forEach(i=>el("circle",{cx:x(i),cy:y(A[i]),r:i===o.mes?6:4.5,fill:C[nivel(A[i])],stroke:C.surface,"stroke-width":2},svg));
  const lab=o.mes!=null&&A[o.mes]!=null?o.mes:idx[idx.length-1];
  el("text",{x:x(lab),y:y(A[lab])-12,"text-anchor":"middle",fill:C.fg,"font-size":11.5,"font-weight":700},svg,pct(A[lab]));
  if(!o.interactive)return true;
  const tip=$("tip"),cross=el("line",{y1:pt,y2:H-pb,stroke:C.fg3,"stroke-width":1,visibility:"hidden"},svg);
  MESES.forEach((_,i)=>{const r=el("rect",{x:pl+bw*i,y:pt,width:bw,height:H-pt-pb,fill:"transparent",style:"cursor:pointer"},svg);
    r.addEventListener("mouseenter",()=>{cross.setAttribute("x1",x(i));cross.setAttribute("x2",x(i));cross.setAttribute("visibility","visible");showTip(tip,tipMes(o.key,i),x(i),W)});
    r.addEventListener("mouseleave",()=>{tip.hidden=true;cross.setAttribute("visibility","hidden")});
    r.addEventListener("click",()=>{if(A[i]!=null||rec(yr,o.key,i)){S.mes=i;$("mes").value=i;render()}});
  });
  return true;
}
function showTip(tip,html,cx,W){tip.innerHTML=html;tip.hidden=false;const tw=tip.offsetWidth;let lx=cx+14;if(lx+tw>W)lx=cx-tw-14;tip.style.left=Math.max(0,lx)+"px";tip.style.top="8px"}
const fila=(a,b)=>`<span class="r"><span>${a}</span><span>${b}</span></span>`;
const barra=(v,col)=>`<span class="mbar"><i style="width:${Math.min(Math.max(v??0,0),1)*100}%;background:${col}"></i></span>`;

// Tooltip completo de un mes: avance, meta, los 5 indicadores, estados del
// proceso, desglose de sanciones, ranking y comparación con el año anterior.
function tipMes(key,i,yr=S.year){
  const R=rec(yr,key,i),Rp=rec(yr,key,i-1),nm=slepName(key);
  let h=`<span class="h">${cap1(MESES_L[i])} ${yr}<small>${nm}${key==="TOTAL"&&R?` · informan ${R.n} de ${DATA[yr].sleps.length} SLEP`:""}</small></span>`;
  if(!R)return h+`<span class="muted">Sin información para el mes.</span>`;
  const nv=nivel(R.av);
  if(R.av!=null){h+=`<span class="r"><span class="big">${pct(R.av)}</span>${pill(nv)}</span>`+barra(R.av,`var(--${nv})`)+
    fila("Var. respecto del mes anterior",Rp&&Rp.av!=null?`<b>${pp(R.av-Rp.av)}</b>`:"—")+
    fila("Falta para la meta (100 %)",`${pp(1-R.av).replace("+","")} · ${fmt(R.pend)} por cerrar`);
    if(key!=="TOTAL"){const rk=ranking(yr,i);const p=rk.pos.get(key);if(p)h+=fila("Posición en el ranking",`<b>${p}°</b> de ${rk.n}`)}}
  else h+=`<span class="muted">Sin sumarios instruidos: no hay avance que medir.</span>`;
  h+=`<span class="sep"></span><span class="sec">Indicadores del proceso</span>`+
    fila("1. Funcionarios involucrados",fmt(R.inv))+
    fila("2. Sumarios instruidos",`${fmt(R.ins)}${R.inv?` <span class="muted">(${pct(R.ins/R.inv)})</span>`:""}`)+
    fila("3. Procesos en curso",`${fmt(R.curso)}${R.ins?` <span class="muted">(${pct(R.curso/R.ins)})</span>`:""}`)+
    fila("4. Procesos cerrados",`<b>${fmt(R.cerr)}</b>${Rp?` <span class="muted">(${fmtS(R.cerr-Rp.cerr)} en el mes)</span>`:""}`)+
    fila("5. Sanciones aplicadas",`${fmt(R.san)}${R.cerr?` <span class="muted">(${pct(R.san/R.cerr)})</span>`:""}`)+
    fila("Cerrados sin sanción",fmt(R.sin));
  if(R.res||R.imp||R.env)h+=`<span class="sep"></span><span class="sec">Otros estados</span>`+fila("Resueltos",fmt(R.res))+fila("Impugnados",fmt(R.imp))+fila("Enviados a CGR",fmt(R.env));
  if(R.san)h+=`<span class="sep"></span><span class="sec">Sanciones aplicadas</span>`+[["Censura",R.cen],["Multa",R.mul],["Suspensión",R.sus],["Destitución",R.des]].filter(x=>x[1]).map(x=>fila(x[0],fmt(x[1]))).join("");
  if(cmpOn()&&yr===S.year){const Ry=rec(prevYear(),key,i);h+=`<span class="sep"></span><span class="sec">Comparación con ${prevYear()}</span>`+
    (Ry?fila(`Avance ${MESES_L[i]} ${prevYear()}`,pct(Ry.av))+fila("Var. interanual",R.av!=null&&Ry.av!=null?`<b>${pp(R.av-Ry.av)}</b>`:"—")+fila("Cerrados",`${fmt(Ry.cerr)} → ${fmt(R.cerr)}`):`<span class="muted">Sin información en ${prevYear()}.</span>`)}
  return h;
}

function drawDiff(){
  const svg=$("diff"),box=$("cb-diff"),W=Math.max(300,box.clientWidth),H=W<560?160:180,pl=W<560?46:58,pr=W<560?16:86,pt=18,pb=22;
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.setAttribute("height",H);svg.innerHTML="";
  const A=[...Array(12).keys()].map(i=>{const r=rec(S.year,S.slep,i);return r?r.av:null});
  const D=A.map((v,i)=>v==null||i===0||A[i-1]==null?null:v-A[i-1]),dv=D.filter(v=>v!=null);
  if(!dv.length){el("text",{x:W/2,y:H/2,"text-anchor":"middle",fill:"var(--fg-3)","font-size":13},svg,"Se necesitan dos meses seguidos con avance para calcular la variación");return}
  let m=Math.max(...dv.map(Math.abs),.005)*1.25;const ticks=niceTicks(-m,m,4);m=Math.max(m,Math.abs(ticks[0]),Math.abs(ticks[ticks.length-1]));
  const bw=(W-pl-pr)/12,x=i=>pl+bw*i,y=v=>pt+(H-pt-pb)*(1-(v+m)/(2*m));
  svg.setAttribute("aria-label","Variación mensual del avance: "+D.map((v,i)=>v==null?null:`${MESES[i]} ${pp(v)}`).filter(Boolean).join(", "));
  ticks.forEach(t=>{el("line",{x1:pl,x2:W-pr,y1:y(t),y2:y(t),stroke:"var(--grid)"},svg);el("text",{x:pl-8,y:y(t)+4,"text-anchor":"end",fill:"var(--fg-3)","font-size":11},svg,(t>0?"+":"")+(Math.round(t*1000)/10).toLocaleString("es-CL"))});
  el("rect",{x:pl+bw*S.mes,y:pt,width:bw,height:H-pt-pb,fill:"var(--accent-soft)",opacity:.7},svg);
  el("line",{x1:pl,x2:W-pr,y1:y(0),y2:y(0),stroke:"var(--fg-2)","stroke-width":1},svg);
  if(pr>40)el("text",{x:W-pr+6,y:pt+8,fill:"var(--fg-3)","font-size":10.5},svg,"pp");
  const b=Math.min(bw*.56,34),tip=$("tip2");
  D.forEach((v,i)=>{
    el("text",{x:x(i)+bw/2,y:H-5,"text-anchor":"middle",fill:v==null?"var(--fg-3)":"var(--fg-2)","font-size":11,"font-weight":i===S.mes?700:400},svg,MESES[i]);
    if(v!=null){const y0=y(0),y1=y(v),h=Math.max(Math.abs(y1-y0),1.5),top=Math.min(y0,y1),r=Math.min(4,h/2),X=x(i)+(bw-b)/2;
      const path=v>=0?`M${X},${y0} V${top+r} Q${X},${top} ${X+r},${top} H${X+b-r} Q${X+b},${top} ${X+b},${top+r} V${y0} Z`:`M${X},${y0} V${top+h-r} Q${X},${top+h} ${X+r},${top+h} H${X+b-r} Q${X+b},${top+h} ${X+b},${top+h-r} V${y0} Z`;
      el("path",{d:path,fill:v>=0?"var(--alto)":"var(--bajo)"},svg);
      if(i===S.mes||bw>44)el("text",{x:x(i)+bw/2,y:v>=0?top-4:top+h+11,"text-anchor":"middle",fill:"var(--fg)","font-size":10.5,"font-weight":i===S.mes?700:500},svg,pp(v).replace(" pp",""))}
    const hit=el("rect",{x:x(i),y:pt,width:bw,height:H-pt-pb,fill:"transparent",style:"cursor:pointer"},svg);
    hit.addEventListener("mouseenter",()=>{const R=rec(S.year,S.slep,i),Rp=rec(S.year,S.slep,i-1);
      showTip(tip,`<span class="h">${cap1(MESES_L[i])} ${S.year}<small>${slepName(S.slep)}</small></span>`+(v==null?`<span class="muted">${R?"Sin mes anterior con avance para comparar.":"Sin información."}</span>`:
        `<span class="r"><span class="big">${pp(v)}</span><span class="muted">vs. ${MESES_L[i-1]}</span></span>`+fila(`Avance ${MESES_L[i-1]}`,pct(A[i-1]))+fila(`Avance ${MESES_L[i]}`,`<b>${pct(A[i])}</b>`)+
        `<span class="sep"></span><span class="sec">Qué explica el cambio</span>`+fila("Procesos cerrados en el mes",fmtS(R.cerr-Rp.cerr))+fila("Nuevos sumarios instruidos",fmtS(R.ins-Rp.ins))+fila("Procesos en curso",fmtS(R.curso-Rp.curso))),x(i)+bw/2,W)});
    hit.addEventListener("mouseleave",()=>{tip.hidden=true});
    hit.addEventListener("click",()=>{if(A[i]!=null){S.mes=i;$("mes").value=i;render()}});
  });
}

function drawTable(){
  const rows=[...Array(12).keys()].map(i=>{const R=rec(S.year,S.slep,i),Rp=rec(S.year,S.slep,i-1);
    if(!R)return `<tr><td>${cap1(MESES_L[i])}</td>${"<td>—</td>".repeat(7)}<td><span class="pill na">Sin información</span></td></tr>`;
    return `<tr${i===S.mes?' style="font-weight:600"':""}><td>${cap1(MESES_L[i])}</td><td>${fmt(R.inv)}</td><td>${fmt(R.ins)}</td><td>${fmt(R.curso)}</td><td>${fmt(R.cerr)}</td><td>${fmt(R.san)}</td><td><b>${pct(R.av)}</b></td><td>${Rp&&Rp.av!=null&&R.av!=null?pp(R.av-Rp.av):"—"}</td><td>${pill(nivel(R.av))}</td></tr>`}).join("");
  $("tbl").innerHTML=`<thead><tr><th>Mes</th><th>Involucrados</th><th>Instruidos</th><th>En curso</th><th>Cerrados</th><th>Sanciones</th><th>% de avance</th><th>Var. mensual</th><th>Nivel</th></tr></thead><tbody>${rows}</tbody>`;
  $("tbl").dataset.title=`Avance mensual · ${slepName(S.slep)} · ${S.year}`;
}

/* ===== Panorama: mapa de calor ordenado por ranking ===== */
function cellStyle(a){
  // 0 % rojo intenso → 50 % neutro → 100 % azul intenso
  const t=Math.min(Math.abs(a-.5)/.5,1)*78,col=a<.5?"var(--bajo)":"var(--alto)";
  // --on-cell: blanco en claro; casi negro en oscuro neón (sobre el cian fluor el blanco no se lee).
  return `background:color-mix(in oklab, ${col} ${t.toFixed(0)}%, var(--mid));color:${t>55?"var(--on-cell)":"var(--fg)"}`;
}
function ordenPanorama(m){
  const d=Y(),rk=ranking(S.year,m);
  let list=d.sleps.map(s=>{const r=metr(s.m[m]),rp=metr(s.m[m-1]);return {s,r,pos:rk.pos.get(s.cod),dv:r&&rp&&r.av!=null&&rp.av!=null?r.av-rp.av:null}});
  const sinPos=(a,b)=>a.s.nombre.localeCompare(b.s.nombre,"es");
  if(S.orden==="nom")list.sort(sinPos);
  else if(S.orden==="var")list.sort((a,b)=>(b.dv??-9)-(a.dv??-9)||sinPos(a,b));
  else{const dir=S.orden==="rank-asc"?-1:1;list.sort((a,b)=>a.pos&&b.pos?dir*(a.pos-b.pos):a.pos?-1:b.pos?1:sinPos(a,b))}
  return {list,rk};
}
function drawHeat(){
  const d=Y(),m=S.mes,{list,rk}=ordenPanorama(m);
  const bajos=MESES.map((_,mm)=>d.sleps.filter(s=>{const r=metr(s.m[mm]);return r&&r.av!=null&&r.av<CORTE_BAJO}).length);
  const cuenta=nv=>rk.L.filter(x=>nivel(x.r.av)===nv).length;
  const top=rk.L.slice(0,3).map(x=>`${x.s.nombre} (${pct(x.r.av)})`);
  $("pan-lede").innerHTML=`En ${MESES_L[m]} de ${S.year}, de ${rk.n} SLEP con sumarios instruidos: <b>${cuenta("alto")}</b> con avance alto, <b>${cuenta("medio")}</b> medio y <b>${cuenta("bajo")}</b> bajo.${top.length?` Mayores avances: ${top.join(", ")}.`:""}`;
  const meses=[...Array(12).keys()];
  const head=`<thead><tr><th title="Posición en el ranking del mes de referencia">N°</th><th class="rh">Servicio</th>${meses.map(i=>`<th>${MESES[i]}${i>=d.primero&&i<d.ultimoMes?`<span class="cnt" title="SLEP con avance bajo">▼ ${bajos[i]}</span>`:""}</th>`).join("")}</tr></thead>`;
  const body=list.map(({s,pos})=>`<tr data-c="${s.cod}" class="${S.slep===s.cod?"sel":""}"><td class="pos${pos&&pos<=3?" top":""}">${pos?pos+"°":"—"}</td><td class="name" tabindex="0">${s.nombre}</td>${meses.map(mm=>{
    const r=metr(s.m[mm]);
    if(!r||r.av==null)return `<td class="nd${mm===m?" ref":""}" data-m="${mm}" aria-label="${s.nombre}, ${MESES_L[mm]}: ${r?"sin sumarios instruidos":"sin información"}"></td>`;
    return `<td class="${mm===m?"ref":""}" data-m="${mm}" style="${cellStyle(r.av)}">${pct(r.av).replace(" %","%")}</td>`}).join("")}</tr>`).join("");
  const T=$("hm");T.innerHTML=head+"<tbody>"+body+"</tbody>";
  T.dataset.title=`% de avance por SLEP y mes · ${S.year} · ordenado por ranking de ${MESES_L[m]}`;
  const go=tr=>{S.slep=+tr.dataset.c;$("slep").value=S.slep;render();$("ficha").scrollIntoView({behavior:"smooth",block:"start"})};
  T.onclick=e=>{const tr=e.target.closest("tr[data-c]");if(!tr)return;const td=e.target.closest("td[data-m]");if(td){const mm=+td.dataset.m;if(mm>=d.primero&&mm<d.ultimoMes){S.mes=mm;$("mes").value=mm}}go(tr)};
  T.onkeydown=e=>{if(e.key==="Enter"&&e.target.matches("td.name"))go(e.target.closest("tr"))};
  // Tooltip de cada celda: SLEP, mes, posición en el ranking de ESE mes y su detalle.
  const tip=$("tip3");
  T.onmousemove=e=>{const td=e.target.closest("td[data-m]");if(!td){tip.hidden=true;return}
    const tr=td.closest("tr"),cod=+tr.dataset.c,mm=+td.dataset.m;
    tip.innerHTML=tipMes(cod,mm);tip.hidden=false;
    const tw=tip.offsetWidth,th=tip.offsetHeight;let lx=e.clientX+16,ly=e.clientY+16;
    if(lx+tw>innerWidth-8)lx=e.clientX-tw-16;if(ly+th>innerHeight-8)ly=Math.max(8,e.clientY-th-16);
    tip.style.left=lx+"px";tip.style.top=ly+"px"};
  T.onmouseleave=()=>{tip.hidden=true};
}

/* ===== Ranking (panel lateral derecho) ===== */
function drawRanking(){
  const m=S.mes,rk=ranking(S.year,m),d=Y(),asc=S.rkDir==="asc";
  $("rk-sub").textContent=`${cap1(MESES_L[m])} ${S.year} · % de procesos cerrados sobre sumarios instruidos`;
  [...$("rk-dir").children].forEach(b=>b.setAttribute("aria-pressed",b.dataset.d===S.rkDir));
  const grupos=[["alto","Avance alto (75 % o más)"],["medio","Avance medio (25 % a 74,9 %)"],["bajo","Avance bajo (menos de 25 %)"]];
  if(asc)grupos.reverse();
  const sinIns=d.sleps.filter(s=>{const r=metr(s.m[m]);return r&&r.av==null}),sinInfo=d.sleps.filter(s=>!s.m[m]);
  $("rk-body").innerHTML=grupos.map(([nv,tit])=>{
    let L=rk.L.filter(x=>nivel(x.r.av)===nv);if(asc)L=[...L].reverse();
    return `<details class="rk" open><summary><svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="nmg">${tit}</span><span class="pill ${nv}">${L.length} SLEP</span></summary>`+
      (L.length?`<ol>${L.map(x=>`<li><button type="button" data-c="${x.s.cod}" title="${x.s.nombre}: ${fmt(x.r.cerr)} de ${fmt(x.r.ins)} cerrados"><span class="p">${rk.pos.get(x.s.cod)}°</span><span class="sn">${x.s.nombre}</span><span class="ex" style="color:var(--${nv})">${pct(x.r.av)}</span><span class="bar" aria-hidden="true"><i style="width:${Math.max(2,x.r.av*100)}%;background:var(--${nv})"></i></span></button></li>`).join("")}</ol>`:`<p class="empty">Ningún servicio en este nivel.</p>`)+`</details>`}).join("")+
    (sinIns.length?`<details class="rk"><summary><svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="nmg">Sin sumarios instruidos</span><span class="pill na">${sinIns.length} SLEP</span></summary><p class="empty">${sinIns.map(s=>s.nombre).join(", ")}.</p></details>`:"")+
    (sinInfo.length?`<details class="rk"><summary><svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="nmg">Sin información en el mes</span><span class="pill na">${sinInfo.length} SLEP</span></summary><p class="empty">${sinInfo.map(s=>s.nombre).join(", ")}.</p></details>`:"");
  $("rk-badge").textContent=rk.L.filter(x=>nivel(x.r.av)==="bajo").length||"";
}
// Bloques "Generar informe" y "¿Cómo se calcula?": a todo el ancho, bajo la
// barra, uno a la vez. Si la persona está más abajo, la página sube hasta él.
let popAbierto=null;
function alternarPop(id,btn){if(popAbierto===id){cerrarPops(true);return}cerrarPops(false);
  const p=$(id),b=$(btn);p.hidden=false;b.setAttribute("aria-expanded","true");popAbierto=id;
  if(id==="rpanel")syncReportForm();
  const tope=$("toolbar").getBoundingClientRect().bottom,r=p.getBoundingClientRect();
  if(r.top<tope||r.top>innerHeight*.6)p.scrollIntoView({behavior:"smooth",block:"start"});
  (p.querySelector("input:checked")||p.querySelector("button")).focus({preventScroll:true});
}
function cerrarPops(devolverFoco){if(!popAbierto)return;const id=popAbierto,btn=id==="rpanel"?"r-open":"h-open";$(id).hidden=true;$(btn).setAttribute("aria-expanded","false");popAbierto=null;if(devolverFoco)$(btn).focus({preventScroll:true})}

function openRk(o){if(o)cerrarPops(false);$("drawer").hidden=!o;$("scrim").hidden=!o;$("rk-open").setAttribute("aria-expanded",o);document.documentElement.style.overflow=o?"hidden":"";if(o)$("rk-close").focus();else $("rk-open").focus()}

/* ===== Control de calidad de los datos ===== */
function observaciones(y,m){
  const d=DATA[y],o=[];const lista=(arr)=>arr.slice(0,8).join(", ")+(arr.length>8?` y ${arr.length-8} más`:"");
  const sinInfo=d.sleps.filter(s=>!s.m[m]).map(s=>s.nombre);
  if(sinInfo.length)o.push(`<b>${sinInfo.length} SLEP sin información</b> en ${MESES_L[m]} de ${y}: ${lista(sinInfo)}. No se consideran en el consolidado ni en el ranking del mes.`);
  const masIns=d.sleps.filter(s=>{const r=metr(s.m[m]);return r&&r.ins>r.inv}).map(s=>{const r=metr(s.m[m]);return `${s.nombre} (${fmt(r.ins)} instruidos y ${fmt(r.inv)} involucrados)`});
  if(masIns.length)o.push(`<b>Sumarios instruidos mayores que los funcionarios involucrados</b> en ${masIns.length} SLEP: ${lista(masIns)}. Conviene revisar ambos campos.`);
  const desc=d.sleps.filter(s=>{const r=metr(s.m[m]);return r&&r.cerr!==r.san+r.sin}).map(s=>{const r=metr(s.m[m]);return `${s.nombre} (${fmt(r.cerr)} cerrados; ${fmt(r.san)} con sanción y ${fmt(r.sin)} sin sanción)`});
  if(desc.length)o.push(`<b>Procesos cerrados que no cuadran</b> con la suma de sanciones y cerrados sin sanción en ${desc.length} SLEP: ${lista(desc)}.`);
  const exceso=d.sleps.filter(s=>{const r=metr(s.m[m]);return r&&r.curso+r.cerr>r.ins}).map(s=>s.nombre);
  if(exceso.length)o.push(`<b>Procesos en curso más cerrados superan los instruidos</b> en ${exceso.length} SLEP: ${lista(exceso)}.`);
  const retro=d.sleps.filter(s=>{const r=metr(s.m[m]),p=metr(s.m[m-1]);return r&&p&&r.cerr<p.cerr}).map(s=>{const r=metr(s.m[m]),p=metr(s.m[m-1]);return `${s.nombre} (de ${fmt(p.cerr)} a ${fmt(r.cerr)})`});
  if(retro.length)o.push(`<b>Procesos cerrados que disminuyen</b> respecto de ${MESES_L[m-1]} en ${retro.length} SLEP: ${lista(retro)}. Un proceso cerrado no debería reabrirse sin explicación.`);
  if(!o.length)o.push(`No se detectan inconsistencias en ${MESES_L[m]} de ${y}.`);
  return o;
}
function drawObs(){$("obs").innerHTML=observaciones(S.year,S.mes).map(x=>`<li>${x}</li>`).join("");$("h-obs").textContent=`Observaciones detectadas · ${cap1(MESES_L[S.mes])} ${S.year}`}

function copyTable(id){
  const T=$(id),msg=document.querySelector(`[data-copymsg="${id}"]`),lines=[T.dataset.title||""];
  T.querySelectorAll("tr").forEach(tr=>{const cells=[...tr.children].map(c=>c.innerText.replace(/\s+/g," ").replace(/[−]/g,"-").trim());if(cells.some(Boolean))lines.push(cells.join("\t"))});
  const done=ok=>{msg.className="status "+(ok?"ok":"err");msg.textContent=ok?"Tabla copiada. Puede pegarse en Excel o Word.":"No fue posible copiar; seleccione la tabla y cópiela manualmente.";setTimeout(()=>msg.textContent="",4000)};
  try{navigator.clipboard.writeText(lines.join("\n")).then(()=>done(true),()=>done(false))}catch(e){done(false)}
}

/* ===== Informes: un modelo común → Word, Excel y PDF (hojas verticales) ===== */
// Herramientas de Word, Excel y PDF: incluidas en Avance de Sumarios (nada se
// descarga de internet: las redes corporativas lo bloquean). Se cargan solo
// al generar un informe, para que la página abra rápido.
async function cargarLibs(fx){
  if(fx==="docx")return {docx:await import("docx")};
  if(fx==="xlsx")return {ExcelJS:(await import("exceljs")).default};
  const [{jsPDF},at]=await Promise.all([import("jspdf"),import("jspdf-autotable")]);
  return {jsPDF,autoTable:at.autoTable||at.default};
}
const stripHtml=h=>{const d=document.createElement("div");d.innerHTML=h;return d.textContent};
const hoy=()=>new Date().toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"});
const slug=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"");
// Tipos de columna: txt · n (número) · p (porcentaje) · pp (puntos porcentuales) · s (número con signo)
function cellFmt(v,t){if(v==null||v==="")return t==="txt"?"":"—";if(t==="n")return fmt(v);if(t==="p")return pct(v);if(t==="pp")return pp(v);if(t==="s")return fmtS(v);return String(v)}

function reportModel(tipo,alcance){
  const y=S.year,d=Y(),m=S.mes,mesTxt=`${cap1(MESES_L[m])} ${y}`,secs=[];
  const Q=tipo==="trimestral"?+$("r-trim").value:null;
  const rangeM=(Q!=null?[Q*3,Q*3+1,Q*3+2]:[...Array(12).keys()]).filter(i=>i>=d.primero&&i<d.ultimoMes);
  const last=rangeM[rangeM.length-1];
  const perTxt=Q!=null?`T${Q+1} ${y} (${MESES_L[rangeM[0]]}${rangeM.length>1?" a "+MESES_L[last]:""})`:`${y} (${MESES_L[rangeM[0]]} a ${MESES_L[last]})`;
  const nota={h:"Nota metodológica",p:[`El % de avance corresponde a los procesos cerrados divididos por los sumarios instruidos, la misma regla que usa Avance de Sumarios. La meta es el 100 %. Nivel de avance: bajo, menos de 25 %; medio, de 25 % a menos de 75 %; alto, 75 % o más. La variación se expresa en puntos porcentuales (pp). Sanciones aplicadas = censura, multa, suspensión y destitución. Los servicios sin sumarios instruidos no tienen avance que medir y no entran en el ranking; los servicios sin información en un mes no se consideran en el consolidado de ese mes.`]};
  const colsInd=[{h:"Funcionarios involucrados",t:"n"},{h:"Sumarios instruidos",t:"n"},{h:"Procesos en curso",t:"n"},{h:"Procesos cerrados",t:"n"},{h:"Sanciones aplicadas",t:"n"}];
  const indRow=R=>R?[R.inv,R.ins,R.curso,R.cerr,R.san]:[null,null,null,null,null];
  const destaca=(R,cols)=>new Set(R&&R.av!=null&&nivel(R.av)==="bajo"?cols:[]);
  let title,scope,file;
  if(alcance==="todos"){
    scope=`${d.sleps.length} Servicios Locales de Educación Pública`;
    const tabRanking=(mm)=>{const rk=ranking(y,mm),rows=rk.L.map(x=>{const rp=metr(x.s.m[mm-1]);return {c:[`${rk.pos.get(x.s.cod)}°`,x.s.nombre,...indRow(x.r),x.r.av,rp&&rp.av!=null?x.r.av-rp.av:null,NIVEL_TXT[nivel(x.r.av)].replace("Avance ","")],over:destaca(x.r,[7,9])}});
      d.sleps.filter(s=>!rk.pos.get(s.cod)).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).forEach(s=>{const r=metr(s.m[mm]);rows.push({c:["—",s.nombre,...indRow(r),null,null,r?"Sin instruidos":"Sin información"],over:new Set()})});
      return {small:true,cols:[{h:"N°",t:"txt",w:.45},{h:"Servicio Local",t:"txt",w:1.9},{h:"Involucrados",t:"n"},{h:"Instruidos",t:"n"},{h:"En curso",t:"n"},{h:"Cerrados",t:"n"},{h:"Sanciones",t:"n"},{h:"% de avance",t:"p"},{h:"Var. (pp)",t:"pp"},{h:"Nivel",t:"txt",w:.95}],rows}};
    if(tipo==="mensual"){
      title=`Informe mensual de avance de sumarios · ${mesTxt}`;file=`Informe_mensual_avance_sumarios_${y}_${String(m+1).padStart(2,"0")}`;
      const R=rec(y,"TOTAL",m),Rp=rec(y,"TOTAL",m-1),rk=ranking(y,m),cuenta=nv=>rk.L.filter(x=>nivel(x.r.av)===nv).length;
      secs.push({h:"1. Síntesis",sheet:"Resumen",p:[
        `En ${MESES_L[m]} de ${y}, los ${R.n} SLEP que informan suman ${fmt(R.cerr)} procesos cerrados de ${fmt(R.ins)} sumarios instruidos: un avance consolidado de ${pct(R.av)}${Rp&&Rp.av!=null?` (${pp(R.av-Rp.av)} respecto de ${MESES_L[m-1]})`:""}. Quedan ${fmt(R.pend)} procesos por cerrar para alcanzar la meta.`,
        `De ${rk.n} servicios con sumarios instruidos, ${cuenta("alto")} tienen avance alto, ${cuenta("medio")} medio y ${cuenta("bajo")} bajo.${rk.L.length?` Mayor avance: ${rk.L[0].s.nombre} (${pct(rk.L[0].r.av)}).`:""}`],
        table:{cols:[{h:"Indicador",t:"txt",w:2.4},{h:mesTxt,t:"n"},{h:`${cap1(MESES_L[m-1]||"")}`,t:"n"},{h:"Variación",t:"s"}],rows:[
          ...IND.map(e=>({c:[e.n,R[e.k],Rp?Rp[e.k]:null,Rp?R[e.k]-Rp[e.k]:null],over:new Set()})),
          {c:["% de avance",null,null,null],avance:[R.av,Rp?Rp.av:null],bold:true,over:new Set()}]}});
      const ultFila=secs[0].table.rows[secs[0].table.rows.length-1];ultFila.c=["% de avance",pct(R.av),Rp?pct(Rp.av):"—",Rp&&Rp.av!=null?pp(R.av-Rp.av):"—"];ultFila.txtRow=true;
      secs.push({h:"2. Evolución del avance consolidado",sheet:null,p:["Línea azul: % de avance de todos los SLEP que informan; línea segmentada: meta del 100 %. Puntos rojos, ámbar y azules: avance bajo, medio y alto."],charts:[{key:"TOTAL",cap:`% de avance consolidado, ${y}`,mes:m}]});
      secs.push({h:"3. Ranking de avance por SLEP",sheet:"Ranking",p:[`Servicios ordenados por % de avance en ${MESES_L[m]} de ${y} (1° = mayor avance). Se destacan en rojo los servicios con avance bajo.`],table:tabRanking(m)});
    }else{
      title=`Informe ${Q!=null?"trimestral":"anual"} de avance de sumarios · ${perTxt}`;file=Q!=null?`Informe_trimestral_avance_sumarios_${y}_T${Q+1}`:`Informe_anual_avance_sumarios_${y}`;
      const RL=rec(y,"TOTAL",last),RF=rec(y,"TOTAL",rangeM[0]);
      secs.push({h:"1. Evolución consolidada",sheet:"Consolidado",p:[`Entre ${MESES_L[rangeM[0]]} y ${MESES_L[last]} de ${y}, el avance consolidado pasa de ${pct(RF.av)} a ${pct(RL.av)} (${pp(RL.av-RF.av)}). En ${MESES_L[last]}, ${fmt(RL.cerr)} de ${fmt(RL.ins)} sumarios instruidos tienen su proceso cerrado.`],
        charts:[{key:"TOTAL",cap:`% de avance consolidado, ${y}`,mes:null,range:[rangeM[0],last]}],
        table:{cols:[{h:"Mes",t:"txt",w:1.3},...colsInd,{h:"% de avance",t:"p"},{h:"Var. (pp)",t:"pp"}],rows:rangeM.map(i=>{const R=rec(y,"TOTAL",i),Rp=rec(y,"TOTAL",i-1);return {c:[cap1(MESES_L[i]),...indRow(R),R?R.av:null,R&&Rp&&R.av!=null&&Rp.av!=null?R.av-Rp.av:null],over:destaca(R,[6])}})}});
      const rk=ranking(y,last);const ord=[...rk.L.map(x=>x.s),...d.sleps.filter(s=>!rk.pos.get(s.cod)).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"))];
      secs.push({h:"2. % de avance por SLEP y mes",sheet:"Avance por SLEP",p:[`Servicios ordenados por su posición en el ranking de ${MESES_L[last]} (1° = mayor avance). Se destacan en rojo los meses con avance bajo.`],
        table:{small:true,cols:[{h:"N°",t:"txt",w:.45},{h:"Servicio Local",t:"txt",w:1.8},...rangeM.map(i=>({h:MESES[i],t:"p"}))],rows:ord.map(s=>{const ov=new Set();const vs=rangeM.map((i,j)=>{const r=metr(s.m[i]);if(r&&r.av!=null&&nivel(r.av)==="bajo")ov.add(j+2);return r?r.av:null});return {c:[rk.pos.get(s.cod)?`${rk.pos.get(s.cod)}°`:"—",s.nombre,...vs],over:ov}})}});
      secs.push({h:`3. Ranking de avance · ${cap1(MESES_L[last])} ${y}`,sheet:"Ranking",p:[`Detalle de los indicadores de cada servicio en ${MESES_L[last]} de ${y}.`],table:tabRanking(last)});
    }
  }else{
    const s=d.sleps[S.slep];scope=`${s.nombre}`;
    const filasMes=(meses)=>meses.map(i=>{const R=metr(s.m[i]),Rp=metr(s.m[i-1]);return {c:[cap1(MESES_L[i]),...indRow(R),R?R.av:null,R&&Rp&&R.av!=null&&Rp.av!=null?R.av-Rp.av:null,R?NIVEL_TXT[nivel(R.av)].replace("Avance ",""):"Sin información"],over:destaca(R,[6,8])}});
    const colsMes=[{h:"Mes",t:"txt",w:1.2},...colsInd,{h:"% de avance",t:"p"},{h:"Var. (pp)",t:"pp"},{h:"Nivel",t:"txt",w:1}];
    if(tipo==="mensual"){
      title=`Informe mensual de avance de sumarios · ${s.nombre} · ${mesTxt}`;file=`Informe_mensual_${slug(s.nombre)}_${y}_${String(m+1).padStart(2,"0")}`;
      const R=metr(s.m[m]),Rp=metr(s.m[m-1]),rk=ranking(y,m),p=rk.pos.get(s.cod),RT=rec(y,"TOTAL",m);
      secs.push({h:"1. Situación del mes",sheet:"Resumen",p:[!R?`${s.nombre} no registra información en ${MESES_L[m]} de ${y}.`:R.av==null?`${s.nombre} no registra sumarios instruidos en ${MESES_L[m]} de ${y}.`:
        `En ${MESES_L[m]} de ${y}, ${s.nombre} tiene ${fmt(R.cerr)} de ${fmt(R.ins)} sumarios instruidos con proceso cerrado: un avance de ${pct(R.av)} (${NIVEL_TXT[nivel(R.av)].toLowerCase()})${Rp&&Rp.av!=null?`, ${pp(R.av-Rp.av)} respecto de ${MESES_L[m-1]}`:""}. Ocupa el lugar ${p}° de ${rk.n} en el ranking del mes; el avance consolidado de los SLEP es ${pct(RT.av)}. Quedan ${fmt(R.pend)} procesos por cerrar.`],
        table:R?{cols:[{h:"Indicador",t:"txt",w:2.4},{h:mesTxt,t:"n"},{h:cap1(MESES_L[m-1]||""),t:"n"},{h:"Variación",t:"s"}],rows:IND.map(e=>({c:[e.n,R[e.k],Rp?Rp[e.k]:null,Rp?R[e.k]-Rp[e.k]:null],over:new Set()}))}:null});
      secs.push({h:"2. Evolución del avance en el año",sheet:null,p:["Línea azul: % de avance del servicio; línea segmentada: meta del 100 %. Puntos rojos, ámbar y azules: avance bajo, medio y alto."],charts:[{key:s.cod,cap:`% de avance · ${s.nombre}, ${y}`,mes:m}]});
      secs.push({h:"3. Detalle mensual",sheet:"Detalle mensual",p:[],table:{small:true,cols:colsMes,rows:filasMes([...Array(m+1).keys()].filter(i=>i>=d.primero))}});
    }else{
      title=`Informe ${Q!=null?"trimestral":"anual"} de avance de sumarios · ${s.nombre} · ${perTxt}`;file=Q!=null?`Informe_trimestral_${slug(s.nombre)}_${y}_T${Q+1}`:`Informe_anual_${slug(s.nombre)}_${y}`;
      const RL=metr(s.m[last]),RF=metr(s.m[rangeM[0]]),rk=ranking(y,last);
      secs.push({h:"1. Síntesis del período",sheet:"Resumen",p:[RL&&RL.av!=null?`Entre ${MESES_L[rangeM[0]]} y ${MESES_L[last]} de ${y}, el avance de ${s.nombre} pasa de ${RF&&RF.av!=null?pct(RF.av):"sin dato"} a ${pct(RL.av)}${RF&&RF.av!=null?` (${pp(RL.av-RF.av)})`:""}. En ${MESES_L[last]} ocupa el lugar ${rk.pos.get(s.cod)}° de ${rk.n} en el ranking.`:`${s.nombre} no registra avance medible en el período.`],
        charts:[{key:s.cod,cap:`% de avance · ${s.nombre}, ${y}`,mes:null,range:[rangeM[0],last]}],
        table:{small:true,cols:colsMes,rows:filasMes(rangeM)}});
    }
  }
  secs.push(nota);
  const obs=observaciones(y,tipo==="mensual"?m:last).map(stripHtml);
  secs.push({h:"Observaciones a los datos",sheet:"Observaciones",p:obs,list:true});
  return {title,scope,file,fecha:hoy(),fuente:`Fuente: Avance de Sumarios (${y}). Emitido el ${hoy()}.`,secs};
}

// Gráfico del informe → imagen (para Word y PDF).
async function chartPng(c,W=900,H=300){
  const svg=document.createElementNS(NS,"svg");svg.setAttribute("xmlns",NS);
  // Misma escala que se eligió en pantalla ("0–100 %" o "Ajustada").
  if(!buildLine(svg,W,{key:c.key,C:PRINT,interactive:false,mes:c.mes,range:c.range,cmp:cmpOn(),escala:S.escala,y:S.year,H}))return null;
  const src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(svg));
  const img=new Image();await new Promise((ok,ko)=>{img.onload=ok;img.onerror=()=>ko(new Error("No fue posible generar el gráfico."));img.src=src});
  const cv=document.createElement("canvas");cv.width=W*2;cv.height=H*2;const ctx=cv.getContext("2d");ctx.scale(2,2);ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);ctx.drawImage(img,0,0,W,H);
  const png=cv.toDataURL("image/png"),b=atob(png.split(",")[1]),bytes=new Uint8Array(b.length);for(let i=0;i<b.length;i++)bytes[i]=b.charCodeAt(i);
  return {bytes,jpg:cv.toDataURL("image/jpeg",.92),W,H};
}
async function withCharts(M){for(const s of M.secs)if(s.charts)for(const c of s.charts)c.img=await chartPng(c);return M}

async function toXlsx(M,L){
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
  });
  return new Blob([await wb.xlsx.writeBuffer()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
const pdfTxt=s=>String(s).replace(/[−–]/g,"-").replace(/[▲▼•]/g,"").replace(/[“”]/g,'"').replace(/±/g,"+/-");
function toPdf(M,LB){
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
async function toDocx(M,LB){
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

// Entrega del archivo: descarga normal del navegador.
async function deliver(name,blob){
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);return "saved";
}
async function generateReport(){
  const tipo=document.querySelector('input[name="r-tipo"]:checked').value,alc=document.querySelector('input[name="r-alc"]:checked').value,fx=document.querySelector('input[name="r-fmt"]:checked').value;
  const st=$("r-status"),btn=$("r-go");btn.disabled=true;st.className="status";st.textContent="Preparando el informe…";
  try{const LB=await cargarLibs(fx);let M=reportModel(tipo,alc);if(fx!=="xlsx")M=await withCharts(M);
    const blob=fx==="xlsx"?await toXlsx(M,LB):fx==="pdf"?toPdf(M,LB):await toDocx(M,LB);
    const r=await deliver(`${M.file}.${fx}`,blob);
    st.className="status "+(r==="saved"?"ok":"");st.textContent=r==="saved"?`Informe generado: ${M.file}.${fx}`:r==="declined"?"Descarga cancelada.":"Hay una descarga pendiente; intente nuevamente en unos segundos.";
  }catch(e){st.className="status err";st.textContent="No fue posible generar el informe: "+e.message}
  finally{btn.disabled=false}
}
function syncReportForm(){
  const single=S.slep!=="TOTAL",d=Y();
  if(!CFG.alcanceCompleto){$("r-alc-todos").disabled=true;$("r-alc-slep").checked=true}
  $("r-alc-slep").disabled=!single;$("r-alc-slep-t").textContent=single?`Solo ${slepName(S.slep)}`:"Solo un SLEP (seleccione uno arriba)";
  if(!single&&CFG.alcanceCompleto)$("r-alc-todos").checked=true;
  $("r-tipo-m-t").textContent=`Mensual · ${cap1(MESES_L[S.mes])} ${S.year}`;
  $("r-tipo-a-t").textContent=`Anual · ${S.year} (${d.rango})`;
  const tq=$("r-trim"),prev=tq.value;
  tq.innerHTML=[0,1,2,3].filter(q=>q*3+2>=d.primero&&q*3<d.ultimoMes).map(q=>`<option value="${q}">T${q+1} · ${MESES[q*3]}–${MESES[q*3+2]}${q*3+2>=d.ultimoMes||q*3<d.primero?" (parcial)":""}</option>`).join("");
  tq.value=[...tq.options].some(o=>o.value===prev)?prev:String(Math.floor(S.mes/3));
}

/* ===== Inicio ===== */
function init(){
  $("logo").src=LOGO;
  // Quien ve un solo SLEP no tiene consolidado ni orden entre varios SLEP.
  if(!CFG.alcanceCompleto){$("orden").closest(".field").hidden=true}
  $("years").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.year=b.dataset.y;S.mes=null;buildSelects();render()};
  $("slep").onchange=e=>{S.slep=e.target.value==="TOTAL"?"TOTAL":+e.target.value;render()};
  $("mes").onchange=e=>{S.mes=+e.target.value;render()};
  $("cmp").onchange=e=>{S.cmp=e.target.checked;render()};
  $("orden").onchange=e=>{S.orden=e.target.value;render()};
  $("escala").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.escala=b.dataset.e;render()};
  $("rk-open").onclick=()=>openRk(true);$("rk-close").onclick=()=>openRk(false);$("scrim").onclick=()=>openRk(false);
  $("rk-dir").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.rkDir=b.dataset.d;save();drawRanking()};
  escuchar(document,"keydown",e=>{if(e.key!=="Escape")return;if(!$("drawer").hidden)openRk(false);else cerrarPops(true)});
  $("rk-body").addEventListener("click",e=>{const b=e.target.closest("button[data-c]");if(!b)return;S.slep=+b.dataset.c;$("slep").value=S.slep;openRk(false);render();$("ficha").scrollIntoView({behavior:"smooth",block:"start"})});
  // Bloques del informe: uno a la vez; se cierran con su botón, con ✕ o con Esc.
  $("r-open").onclick=()=>alternarPop("rpanel","r-open");
  $("h-open").onclick=()=>alternarPop("hpanel","h-open");
  $("r-close").onclick=()=>cerrarPops(true);
  document.querySelectorAll(".bloque [data-cerrar]").forEach(b=>b.onclick=()=>cerrarPops(true));
  $("u-nombre").textContent=CFG.usuario.nombre;$("u-perfil").textContent=CFG.usuario.perfil;
  $("salir").onclick=()=>CFG.alSalir();
  // Barra fija: su alto define dónde se detienen los saltos a la ficha; sombra al quedar pegada.
  const tb=$("toolbar"),alto=()=>document.documentElement.style.setProperty("--alto-barra",tb.offsetHeight+"px");
  alto();const ro1=new ResizeObserver(alto);ro1.observe(tb);observadores.push(ro1);
  const sombra=()=>tb.classList.toggle("pegada",tb.getBoundingClientRect().top<=1&&scrollY>0);
  escuchar(window,"scroll",sombra,{passive:true});sombra();
  $("r-go").onclick=generateReport;
  $("r-trim").addEventListener("change",()=>{document.querySelector('input[name="r-tipo"][value="trimestral"]').checked=true});
  escuchar(document,"click",e=>{const b=e.target.closest("[data-copy]");if(b)copyTable(b.dataset.copy)});
  $("orden").value=S.orden;
  if(S.slep!=="TOTAL"&&!Y().sleps[S.slep])S.slep="TOTAL";
  buildSelects();render();
  const ro2=new ResizeObserver(()=>{drawLine();drawDiff()});ro2.observe($("cb-line"));observadores.push(ro2);
}

init();
// Al salir de la página: quitar oyentes globales y observadores.
return ()=>{oyentes.forEach(([o,e,f,op])=>o.removeEventListener(e,f,op));observadores.forEach(r=>r.disconnect());document.documentElement.style.overflow=""};
}
