// @ts-nocheck
/* Motor del Informe interactivo de ranking (avance de sumarios por SLEP).
 *
 * Mismo lenguaje de diseño y mismo cálculo que el Informe interactivo nacional
 * (motor-informe.ts): banner institucional, barra fija, paneles, niveles de
 * avance y modo oscuro neón. Los datos vienen de /cases/informe-avance (todos
 * los meses); el formulario completo de cada SLEP (sus campos), de
 * /cases/ranking-detalle, mes a mes, a medida que se mira.
 *
 * Se mantiene en JavaScript sin tipado estricto (@ts-nocheck), igual que el
 * motor nacional: "Guardar" vuelve a arrancar ESTA función en el .html con los
 * datos incrustados, así que todo lo que usa vive dentro de ella (salvo
 * generar documentos y pedir datos, que llegan en CFG y necesitan el sistema).
 */
export interface ConfigRanking {
  fuente: { sleps: string[]; anios: Record<string, (number[] | null)[][]> };
  posiciones: Record<string, ({ pos: number | null; de: number } | null)[]>;
  alcanceCompleto: boolean;
  logo: string;
  usuario: { nombre: string; perfil: string };
  inicial?: { anio?: string; mes?: number; slep?: string };
  // Campos del formulario de cada SLEP por mes ("2026-7" → { SLEP: [[n°, campo, valor]] }).
  detalle: Record<string, Record<string, [number, string, string][]> | false>;
  imprimir?: boolean;
  alSalir: () => void;
  pedirDetalle?: (anio: string, mes: number) => Promise<Record<string, [number, string, string][]>>;
  documento?: (modelo: unknown, formato: 'xlsx' | 'pdf') => Promise<string>;
}

export interface MotorRanking {
  destruir: () => void;
  anio: () => string;
  mesesDelAnio: () => number[];
}

export function iniciarMotorRanking(CFG: ConfigRanking): MotorRanking {
const FUENTE=CFG.fuente,POSICIONES=CFG.posiciones,DET=CFG.detalle||{};
const oyentes=[],observadores=[];
function escuchar(obj,ev,fn,op){obj.addEventListener(ev,fn,op);oyentes.push([obj,ev,fn,op])}
/* ===== Datos y cálculo (idénticos al informe nacional) =====
   % de avance = procesos cerrados ÷ sumarios instruidos. Ranking del mes: por
   % de avance; empates, más procesos cerrados y luego nombre. Cada registro:
   [involucrados, instruidos, en curso, resueltos, impugnados, enviados CGR,
   cerrados, censura, multa, suspensión, destitución, cerrados sin sanción]. */
const MESES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_L=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const cap1=s=>s.charAt(0).toUpperCase()+s.slice(1);
const NF=new Intl.NumberFormat("es-CL");
const fmt=v=>v==null?"—":NF.format(Math.round(v));
const pct=v=>v==null?"—":(v*100).toLocaleString("es-CL",{minimumFractionDigits:1,maximumFractionDigits:1})+" %";
const pp=v=>v==null?"—":Math.abs(v)<.0005?"0,0 pp":(v>0?"+":"−")+Math.abs(v*100).toLocaleString("es-CL",{minimumFractionDigits:1,maximumFractionDigits:1})+" pp";
const CORTE_BAJO=.25,CORTE_ALTO=.75;
const nivel=a=>a==null?"na":a<CORTE_BAJO?"bajo":a<CORTE_ALTO?"medio":"alto";
const NIVEL_TXT={bajo:"Avance bajo",medio:"Avance medio",alto:"Avance alto",na:"Sin sumarios instruidos"};
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

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
function rec(y,key,m){
  const d=DATA[y];if(!d||m==null||m<0)return null;
  if(key==="TOTAL"){const rs=d.sleps.map(s=>s.m[m]).filter(Boolean);if(!rs.length)return null;
    return metr(rs.reduce((a,r)=>a.map((v,i)=>v+r[i]),Array(12).fill(0)),rs.length)}
  const s=d.sleps[key];return s?metr(s.m[m],1):null;
}
// Quien ve un solo SLEP recibe su posición ya calculada por el servidor.
function ranking(y,m){
  const d=DATA[y];if(!d||m<0)return {L:[],pos:new Map(),n:0};
  if(!CFG.alcanceCompleto){const s=d.sleps[0],r=s?metr(s.m[m]):null,p=POSICIONES[y]?.[m];
    const L=r&&r.av!=null&&p&&p.pos?[{s,r}]:[];return {L,pos:new Map(L.length?[[s.cod,p.pos]]:[]),n:p?p.de:0}}
  const L=d.sleps.map(s=>({s,r:metr(s.m[m])})).filter(x=>x.r&&x.r.av!=null)
    .sort((a,b)=>b.r.av-a.r.av||b.r.cerr-a.r.cerr||a.s.nombre.localeCompare(b.s.nombre,"es"));
  return {L,pos:new Map(L.map((x,i)=>[x.s.cod,i+1])),n:L.length};
}

/* ===== Estado ===== */
const S={year:YEARS[YEARS.length-1],mes:null,orden:"desc",nivel:"todos",slep:null,abierto:null};
try{const g=JSON.parse(localStorage.getItem("rankingSumarios")||"{}");if(g.orden)S.orden=g.orden;if(g.nivel)S.nivel=g.nivel}catch(e){}
if(CFG.inicial){const ini=CFG.inicial;if(ini.anio&&DATA[ini.anio])S.year=ini.anio;if(ini.mes!=null)S.mesPedido=ini.mes;
  if(ini.slep){const k=FUENTE.sleps.indexOf(ini.slep);if(k>=0){S.slep=k;S.abierto=k}}}
const save=()=>{try{localStorage.setItem("rankingSumarios",JSON.stringify({orden:S.orden,nivel:S.nivel}))}catch(e){}};
const Y=()=>DATA[S.year];
const $=id=>document.getElementById(id);

const ICON_UP='<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9 8.5H1z" fill="currentColor"/></svg>';
const ICON_DN='<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5 9 1.5H1z" fill="currentColor"/></svg>';
function pill(nv,txt){return `<span class="pill ${nv}">${nv==="alto"?ICON_UP:nv==="bajo"?ICON_DN:""}${txt||NIVEL_TXT[nv]}</span>`}
const fila=(a,b)=>`<span class="r"><span>${a}</span><span>${b}</span></span>`;
const barra=(v,col)=>`<span class="mbar"><i style="width:${Math.min(Math.max(v??0,0),1)*100}%;background:${col}"></i></span>`;

// Cambio de posición respecto del mes anterior (en enero, diciembre del año
// anterior): + sube, − baja. Sin ranking el mes anterior no hay con qué comparar.
function movimiento(y,m,cod){
  const p=ranking(y,m).pos.get(cod);if(!p)return null;
  const rkA=m>0?ranking(y,m-1):ranking(String(+y-1),11);
  if(!rkA.n)return {d:null,txt:"—",largo:"Sin ranking el mes anterior"};
  const pa=rkA.pos.get(cod);if(!pa)return {d:null,txt:"Nuevo",largo:"Sin posición el mes anterior"};
  const d=pa-p;return {d,txt:d>0?`▲ ${d}`:d<0?`▼ ${-d}`:"=",largo:d>0?`Sube ${d} ${d===1?"lugar":"lugares"} (era ${pa}°)`:d<0?`Baja ${-d} ${d===-1?"lugar":"lugares"} (era ${pa}°)`:"Mantiene su lugar"};
}

/* ===== Selectores de la barra ===== */
function buildSelects(){
  const d=Y();
  $("years").innerHTML=YEARS.map(y=>`<button type="button" data-y="${y}" aria-pressed="${y===S.year}">${y}</button>`).join("");
  const meses=[...Array(d.ultimoMes).keys()].filter(m=>m>=d.primero);
  $("mes").innerHTML=meses.map(m=>`<option value="${m}">${cap1(MESES_L[m])} ${S.year}</option>`).join("");
  if(S.mes==null&&S.mesPedido!=null&&S.mesPedido>=d.primero&&S.mesPedido<d.ultimoMes){S.mes=S.mesPedido;S.mesPedido=null}
  if(S.mes==null||S.mes<d.primero||S.mes>=d.ultimoMes)S.mes=d.ultimoMes-1;
  $("mes").value=S.mes;
  $("slep").innerHTML=`<option value="">Ninguno</option>`+[...d.sleps].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).map(s=>`<option value="${s.cod}">${esc(s.nombre)}</option>`).join("");
  $("slep").value=S.slep==null?"":String(S.slep);
}

function render(){
  save();
  [...$("years").children].forEach(b=>b.setAttribute("aria-pressed",b.dataset.y===S.year));
  [...$("orden").children].forEach(b=>b.setAttribute("aria-pressed",b.dataset.o===S.orden));
  [...$("nivel").children].forEach(b=>b.setAttribute("aria-pressed",b.dataset.n===S.nivel));
  drawResumen();drawLista();drawMovimientos();syncReportForm();
  const d=Y();
  $("foot").textContent=`Fuente: Avance de Sumarios, datos informados por los Servicios Locales (${S.year}, ${d.rango}). % de avance = procesos cerrados ÷ sumarios instruidos. Ranking del mes: mayor % de avance primero; en empate, más procesos cerrados y luego nombre.`;
  asegurarDetalle(S.year,S.mes);
}

/* ===== Resumen del mes ===== */
function drawResumen(){
  const d=Y(),m=S.mes,rk=ranking(S.year,m),R=rec(S.year,"TOTAL",m),Rp=rec(S.year,"TOTAL",m-1),mesTxt=`${MESES_L[m]} de ${S.year}`;
  $("res-eyebrow").textContent=`Ranking de avance · ${cap1(MESES_L[m])} ${S.year}`;
  if(!CFG.alcanceCompleto){
    const s=d.sleps[0],r=metr(s.m[m]),p=rk.pos.get(s.cod),mv=movimiento(S.year,m,s.cod);
    $("h-res").textContent=s.nombre;
    $("res-pill").innerHTML=r&&r.av!=null?pill(nivel(r.av),`${NIVEL_TXT[nivel(r.av)]} · ${pct(r.av)}`):pill("na","Sin posición");
    $("res-lede").innerHTML=!r?`En ${mesTxt}, <b>${esc(s.nombre)}</b> no registra información.`:r.av==null?`En ${mesTxt}, <b>${esc(s.nombre)}</b> no registra sumarios instruidos, por lo que no entra en el ranking.`:
      `En ${mesTxt}, <b>${esc(s.nombre)}</b> ocupa el lugar <b>${p}° de ${rk.n}</b> en el ranking de avance, con <b>${fmt(r.cerr)} de ${fmt(r.ins)}</b> sumarios instruidos con proceso cerrado (${pct(r.av)}).${mv&&mv.d!=null?` ${mv.largo}.`:""}`;
    $("tiles").innerHTML=tile("Posición en el ranking",p?`${p}°`:"—",p?`de ${rk.n} SLEP con sumarios instruidos`:"Sin posición en el mes",null,true)+
      tile("% de avance",r?pct(r.av):"—",r?`${fmt(r.cerr)} de ${fmt(r.ins)} cerrados`:"Sin información",r?r.av:null,false,r?nivel(r.av):"na")+
      tile("Por cerrar",r?fmt(r.pend):"—","Procesos que faltan para la meta (100 %)",null);
    return;
  }
  const cuenta=nv=>rk.L.filter(x=>nivel(x.r.av)===nv).length;
  const sinIns=d.sleps.filter(s=>{const r=metr(s.m[m]);return r&&r.av==null}).length,sinInfo=d.sleps.filter(s=>!s.m[m]).length;
  $("h-res").textContent=`Posición de los ${d.sleps.length} Servicios Locales`;
  $("res-pill").innerHTML=R&&R.av!=null?pill(nivel(R.av),`Consolidado · ${pct(R.av)}`):pill("na","Sin información");
  const pri=rk.L[0],ult=rk.L[rk.L.length-1];
  $("res-lede").innerHTML=!R?`En ${mesTxt} no hay información de los SLEP.`:
    `En ${mesTxt}, <b>${rk.n} SLEP</b> tienen sumarios instruidos y entran en el ranking: <b>${cuenta("alto")}</b> con avance alto, <b>${cuenta("medio")}</b> medio y <b>${cuenta("bajo")}</b> bajo. El avance consolidado es <b>${pct(R.av)}</b>${Rp&&Rp.av!=null?` (${pp(R.av-Rp.av)} respecto de ${MESES_L[m-1]})`:""}.`+
    (pri?` Primer lugar: <b>${esc(pri.s.nombre)}</b> (${pct(pri.r.av)}); último: <b>${esc(ult.s.nombre)}</b> (${pct(ult.r.av)}).`:"");
  const n=rk.n||1;
  $("tiles").innerHTML=tile("Avance consolidado",R?pct(R.av):"—",R?`${fmt(R.cerr)} de ${fmt(R.ins)} cerrados · informan ${R.n} de ${d.sleps.length}`:"Sin información",R?R.av:null,true,R?nivel(R.av):"na")+
    tile("Avance alto",fmt(cuenta("alto")),"75 % o más",cuenta("alto")/n,false,"alto")+
    tile("Avance medio",fmt(cuenta("medio")),"De 25 % a menos de 75 %",cuenta("medio")/n,false,"medio")+
    tile("Avance bajo",fmt(cuenta("bajo")),"Menos de 25 %",cuenta("bajo")/n,false,"bajo")+
    tile("Fuera del ranking",fmt(sinIns+sinInfo),`${sinIns} sin sumarios instruidos · ${sinInfo} sin información`,null);
}
function tile(nm,val,gl,ratio,key,nv){
  const col=nv?`var(--${nv==="na"?"fg-3":nv})`:"var(--accent)";
  return `<div class="tile${key?" key":""}" role="listitem"><span class="nm">${nm}</span><span class="val"${nv&&!key?` style="color:${col}"`:""}>${val}</span><span class="gl">${gl}</span>`+
    (ratio!=null?`<span class="meter" aria-hidden="true"><i style="width:${Math.min(Math.max(ratio,0),1)*100}%;background:${col}"></i></span>`:"")+`</div>`;
}

/* ===== Lista del ranking ===== */
function filas(){
  const m=S.mes,rk=ranking(S.year,m);
  // Sin "...objeto": el compilador lo cambia por una función auxiliar que no
  // viaja en el .html guardado.
  let L=rk.L.map(x=>{const rp=metr(x.s.m[m-1]);return {s:x.s,r:x.r,pos:rk.pos.get(x.s.cod),dv:rp&&rp.av!=null?x.r.av-rp.av:null,mv:movimiento(S.year,m,x.s.cod)}});
  if(S.nivel!=="todos")L=L.filter(x=>nivel(x.r.av)===S.nivel);
  if(S.orden==="asc")L=[...L].reverse();
  return {L,rk};
}
function drawLista(){
  const d=Y(),m=S.mes,{L,rk}=filas();
  $("lista-sub").textContent=`${cap1(MESES_L[m])} ${S.year} · ${S.orden==="asc"?"menor":"mayor"} avance primero${S.nivel!=="todos"?` · solo ${NIVEL_TXT[S.nivel].toLowerCase()}`:""}. Pase el mouse sobre un servicio para ver su detalle; haga clic para dejarlo abierto.`;
  $("rkl").innerHTML=L.length?L.map(x=>{const nv=nivel(x.r.av),cod=x.s.cod,ab=S.abierto===cod;
    return `<li class="rkf${S.slep===cod?" sel":""}${x.pos<=3&&CFG.alcanceCompleto?" top":""}" data-c="${cod}">
      <button type="button" class="rkr" aria-expanded="${ab}" aria-controls="rkd-${cod}">
        <span class="p">${x.pos}°</span>
        <span class="sn">${esc(x.s.nombre)}</span>
        <span class="bar" aria-hidden="true"><i style="width:${Math.max(1.5,x.r.av*100)}%;background:var(--${nv})"></i></span>
        <span class="ex" style="color:var(--${nv})">${pct(x.r.av)}</span>
        <span class="vr${x.dv==null?"":x.dv>0.0005?" up":x.dv<-0.0005?" dn":""}">${x.dv==null?"—":pp(x.dv)}</span>
        <span class="mv${x.mv&&x.mv.d>0?" up":x.mv&&x.mv.d<0?" dn":""}" title="${x.mv?esc(x.mv.largo):""}">${x.mv?x.mv.txt:"—"}</span>
        <span class="ci">${fmt(x.r.cerr)} de ${fmt(x.r.ins)}</span>
      </button>
      <div class="rkd" id="rkd-${cod}"${ab?"":" hidden"}>${ab?detalleHtml(cod,m,false):""}</div>
    </li>`}).join(""):`<li class="vacio">Ningún servicio con ${NIVEL_TXT[S.nivel]?.toLowerCase()||"avance"} en ${MESES_L[m]} de ${S.year}.</li>`;
  // Fuera del ranking: sin sumarios instruidos o sin información en el mes.
  const sinIns=d.sleps.filter(s=>{const r=metr(s.m[m]);return r&&r.av==null}).map(s=>s.nombre),sinInfo=d.sleps.filter(s=>!s.m[m]).map(s=>s.nombre);
  $("fuera").innerHTML=(CFG.alcanceCompleto?[[sinIns,"Sin sumarios instruidos (sin avance que medir)"],[sinInfo,"Sin información en el mes"]]:[]).filter(x=>x[0].length)
    .map(([l,t])=>`<p><b>${t} · ${l.length} SLEP:</b> ${l.map(esc).join(", ")}.</p>`).join("");
  $("lista-cuenta").innerHTML=pill(S.nivel==="todos"?"na":S.nivel,`${L.length} de ${rk.n} SLEP`);
}

// Detalle de un SLEP en el mes: el mismo para el tooltip y para la fila abierta.
function detalleHtml(cod,m,corto){
  const y=S.year,s=Y().sleps[cod],R=metr(s.m[m]),Rp=metr(s.m[m-1]),rk=ranking(y,m),p=rk.pos.get(cod),mv=movimiento(y,m,cod);
  let h=`<div class="dt-col">`;
  if(corto)h+=`<span class="h">${esc(s.nombre)}<small>${cap1(MESES_L[m])} ${y}</small></span>`;
  if(!R)return h+`<span class="muted">Sin información para el mes.</span></div>`;
  const nv=nivel(R.av);
  if(R.av!=null)h+=`<span class="r"><span class="big">${pct(R.av)}</span>${pill(nv)}</span>`+barra(R.av,`var(--${nv})`)+
    fila("Posición en el ranking",p?`<b>${p}°</b> de ${rk.n}`:"—")+fila("Respecto del mes anterior",mv?mv.largo:"—")+
    fila("Var. del avance",Rp&&Rp.av!=null?`<b>${pp(R.av-Rp.av)}</b>`:"—")+fila("Falta para la meta (100 %)",`${fmt(R.pend)} por cerrar`);
  h+=`<span class="sep"></span><span class="sec">Indicadores del proceso</span>`+
    fila("1. Funcionarios involucrados",fmt(R.inv))+fila("2. Sumarios instruidos",fmt(R.ins))+fila("3. Procesos en curso",fmt(R.curso))+
    fila("4. Procesos cerrados",`<b>${fmt(R.cerr)}</b>`)+fila("5. Sanciones aplicadas",fmt(R.san))+fila("Cerrados sin sanción",fmt(R.sin));
  if(R.san)h+=`<span class="sep"></span><span class="sec">Sanciones aplicadas</span>`+[["Censura",R.cen],["Multa",R.mul],["Suspensión",R.sus],["Destitución",R.des]].filter(x=>x[1]).map(x=>fila(x[0],fmt(x[1]))).join("");
  h+=`</div>`;
  // Formulario completo del mes (los campos que informó el SLEP).
  const det=DET[`${y}-${m}`],campos=det?det[s.nombre]:null;
  h+=`<div class="dt-col"><span class="sec">Formulario del mes${campos?` · ${campos.length} campos`:""}</span>`+
    (campos?`<span class="campos">${campos.map(c=>fila(`${c[0]}. ${esc(c[1])}`,c[2]===""?"—":esc(c[2]))).join("")}</span>`:
      `<span class="muted small">${det===false||!CFG.pedirDetalle&&!det?"El formulario de este mes no está disponible.":"Cargando el formulario…"}</span>`)+`</div>`;
  return h;
}
// Con promesas y sin async/await (ni "...objeto"): Angular los reescribe con
// funciones auxiliares que no viajan en el .html guardado.
const pidiendo={};
function asegurarDetalle(y,m){
  const k=`${y}-${m}`;if(DET[k]!==undefined||!CFG.pedirDetalle||pidiendo[k])return;
  pidiendo[k]=true;
  CFG.pedirDetalle(y,m).then(d=>{DET[k]=d},()=>{DET[k]=false}).then(()=>{
    pidiendo[k]=false;
    // Ya llegó: se completan la fila abierta y el tooltip visible.
    if(S.year===y&&S.mes===m){if(S.abierto!=null){const dv=$(`rkd-${S.abierto}`);if(dv&&!dv.hidden)dv.innerHTML=detalleHtml(S.abierto,m,false)}
      if(tipCod!=null&&!$("tip-r").hidden)$("tip-r").innerHTML=detalleHtml(tipCod,m,true)}
  });
}

/* ===== Movimientos del mes ===== */
function drawMovimientos(){
  const sec=$("movimientos");sec.hidden=!CFG.alcanceCompleto;if(!CFG.alcanceCompleto)return;
  const m=S.mes,rk=ranking(S.year,m);
  $("mov-sub").textContent=m>0?`Cambio del % de avance y de la posición respecto de ${MESES_L[m-1]} de ${S.year}.`:"";
  const L=rk.L.map(x=>{const rp=metr(x.s.m[m-1]);return {x,dv:rp&&rp.av!=null?x.r.av-rp.av:null,mv:movimiento(S.year,m,x.s.cod)}}).filter(z=>z.dv!=null);
  if(!L.length){$("mov-up").innerHTML=$("mov-dn").innerHTML=`<li class="vacio">Se necesita el mes anterior con información para comparar.</li>`;return}
  const item=z=>`<li><button type="button" data-c="${z.x.s.cod}"><span class="sn">${esc(z.x.s.nombre)}<small>${z.mv?esc(z.mv.largo):""}</small></span><span class="vr ${z.dv>0?"up":"dn"}">${pp(z.dv)}</span></button></li>`;
  const up=L.filter(z=>z.dv>0.0005).sort((a,b)=>b.dv-a.dv).slice(0,5),dn=L.filter(z=>z.dv<-0.0005).sort((a,b)=>a.dv-b.dv).slice(0,5);
  $("mov-up").innerHTML=up.length?up.map(item).join(""):`<li class="vacio">Ningún servicio aumentó su avance.</li>`;
  $("mov-dn").innerHTML=dn.length?dn.map(item).join(""):`<li class="vacio">Ningún servicio retrocedió.</li>`;
}

/* ===== Tooltip (al pasar el mouse) y fila abierta (clic) ===== */
let tipCod=null;
function mostrarTip(cod,e){
  const tip=$("tip-r");tipCod=cod;tip.innerHTML=detalleHtml(cod,S.mes,true);tip.hidden=false;
  const tw=tip.offsetWidth,th=tip.offsetHeight;let lx=e.clientX+18,ly=e.clientY+14;
  if(lx+tw>innerWidth-8)lx=Math.max(8,e.clientX-tw-18);if(ly+th>innerHeight-8)ly=Math.max(8,innerHeight-th-8);
  tip.style.left=lx+"px";tip.style.top=ly+"px";
}
function ocultarTip(){$("tip-r").hidden=true;tipCod=null}
function alternarFila(cod){
  S.abierto=S.abierto===cod?null:cod;ocultarTip();drawLista();
  if(S.abierto!=null){const li=document.querySelector(`#rkl li[data-c="${cod}"]`);li&&li.querySelector(".rkr").focus({preventScroll:true})}
}
function irA(cod){
  // Destacar un servicio: se marca, se abre su detalle y se lleva a la vista.
  S.slep=cod;S.abierto=cod;if(S.nivel!=="todos"&&cod!=null){const r=metr(Y().sleps[cod].m[S.mes]);if(r&&nivel(r.av)!==S.nivel)S.nivel="todos"}
  render();
  if(cod!=null){const li=document.querySelector(`#rkl li[data-c="${cod}"]`);li&&li.scrollIntoView({behavior:"smooth",block:"center"})}
}

/* ===== Bloques "Generar informe" y "¿Cómo se calcula?" (uno a la vez) ===== */
let popAbierto=null;
function alternarPop(id,btn){if(popAbierto===id){cerrarPops(true);return}cerrarPops(false);
  const p=$(id),b=$(btn);p.hidden=false;b.setAttribute("aria-expanded","true");popAbierto=id;
  if(id==="rpanel")syncReportForm();
  const tope=$("toolbar").getBoundingClientRect().bottom,r=p.getBoundingClientRect();
  if(r.top<tope||r.top>innerHeight*.6)p.scrollIntoView({behavior:"smooth",block:"start"});
  (p.querySelector("input:checked")||p.querySelector("button")).focus({preventScroll:true});
}
function cerrarPops(devolverFoco){if(!popAbierto)return;const id=popAbierto,btn=id==="rpanel"?"r-open":"h-open";$(id).hidden=true;$(btn).setAttribute("aria-expanded","false");popAbierto=null;if(devolverFoco)$(btn).focus({preventScroll:true})}

/* ===== Copiar el ranking (formato compatible con Excel y Word) ===== */
function copiarRanking(){
  const {L}=filas(),msg=document.querySelector('[data-copymsg="rk"]');
  const lines=[`Ranking de avance · ${cap1(MESES_L[S.mes])} ${S.year}`,["N°","Servicio Local","% de avance","Var. (pp)","Cambio de posición","Cerrados","Instruidos","Nivel"].join("\t"),
    ...L.map(x=>[`${x.pos}°`,x.s.nombre,pct(x.r.av),x.dv==null?"—":pp(x.dv),x.mv?x.mv.largo:"—",fmt(x.r.cerr),fmt(x.r.ins),NIVEL_TXT[nivel(x.r.av)]].join("\t").replace(/[−]/g,"-"))];
  const done=ok=>{msg.className="status "+(ok?"ok":"err");msg.textContent=ok?"Ranking copiado. Puede pegarse en Excel o Word.":"No fue posible copiar.";setTimeout(()=>msg.textContent="",4000)};
  try{navigator.clipboard.writeText(lines.join("\n")).then(()=>done(true),()=>done(false))}catch(e){done(false)}
}

/* ===== Informes: Excel y PDF (mismo modelo y mismo generador que el nacional) ===== */
const hoy=()=>new Date().toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"});
const sinFlecha=t=>t==="="?"Se mantiene":t.replace("▲ ","Sube ").replace("▼ ","Baja ");
function reportModel(tipo){
  const y=S.year,d=Y(),m=S.mes,mesTxt=`${cap1(MESES_L[m])} ${y}`,secs=[];
  const Q=tipo==="trimestral"?+$("r-trim").value:null;
  // Hasta el mes de referencia (nunca meses posteriores al elegido).
  const rangeM=(tipo==="mensual"?[m]:Q!=null?[Q*3,Q*3+1,Q*3+2]:[...Array(12).keys()]).filter(i=>i>=d.primero&&i<d.ultimoMes&&i<=m);
  const last=rangeM[rangeM.length-1],first=rangeM[0];
  const perTxt=Q!=null?`T${Q+1} ${y} (${MESES_L[first]}${rangeM.length>1?" a "+MESES_L[last]:""})`:`${y} (${MESES_L[first]} a ${MESES_L[last]})`;
  const scope=CFG.alcanceCompleto?`${d.sleps.length} Servicios Locales de Educación Pública`:d.sleps[0].nombre;
  const destaca=(R,cols)=>new Set(R&&R.av!=null&&nivel(R.av)==="bajo"?cols:[]);
  const tabRanking=mm=>{const rk=ranking(y,mm);
    const rows=rk.L.map(x=>{const mv=movimiento(y,mm,x.s.cod);
      return {c:[`${rk.pos.get(x.s.cod)}°`,x.s.nombre,x.r.ins,x.r.cerr,x.r.pend,x.r.av,mv?sinFlecha(mv.txt):"",NIVEL_TXT[nivel(x.r.av)].replace("Avance ","")],over:destaca(x.r,[5,7])}});
    if(CFG.alcanceCompleto)d.sleps.filter(s=>!rk.pos.get(s.cod)).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).forEach(s=>{const r=metr(s.m[mm]);
      rows.push({c:["—",s.nombre,r?r.ins:null,r?r.cerr:null,r?r.pend:null,null,"",r?"Sin instruidos":"Sin información"],over:new Set()})});
    return {small:true,cols:[{h:"N°",t:"txt",w:.45},{h:"Servicio Local",t:"txt",w:1.9},{h:"Instruidos",t:"n"},{h:"Cerrados",t:"n"},{h:"Por cerrar",t:"n"},{h:"% de avance",t:"p"},{h:"Cambio de posición",t:"txt",w:1.05},{h:"Nivel",t:"txt",w:.95}],rows}};
  const sintesis=mm=>{const rk=ranking(y,mm),R=rec(y,"TOTAL",mm),Rp=rec(y,"TOTAL",mm-1),c=nv=>rk.L.filter(x=>nivel(x.r.av)===nv).length;
    if(!CFG.alcanceCompleto){const s=d.sleps[0],r=metr(s.m[mm]),p=rk.pos.get(s.cod),mv=movimiento(y,mm,s.cod);
      return !r||r.av==null?`${s.nombre} no tiene posición en el ranking de ${MESES_L[mm]} de ${y}.`:`En ${MESES_L[mm]} de ${y}, ${s.nombre} ocupa el lugar ${p}° de ${rk.n} en el ranking de avance, con ${fmt(r.cerr)} de ${fmt(r.ins)} sumarios instruidos con proceso cerrado (${pct(r.av)}).${mv&&mv.d!=null?` ${mv.largo}.`:""}`}
    return `En ${MESES_L[mm]} de ${y}, ${rk.n} SLEP tienen sumarios instruidos y entran en el ranking: ${c("alto")} con avance alto, ${c("medio")} medio y ${c("bajo")} bajo. El avance consolidado es ${pct(R?R.av:null)}${R&&Rp&&Rp.av!=null?` (${pp(R.av-Rp.av)} respecto de ${MESES_L[mm-1]})`:""}.`+
      (rk.L.length?` Primer lugar: ${rk.L[0].s.nombre} (${pct(rk.L[0].r.av)}); último: ${rk.L[rk.L.length-1].s.nombre} (${pct(rk.L[rk.L.length-1].r.av)}).`:"")};
  const nota={h:"Nota metodológica",p:["El % de avance corresponde a los procesos cerrados divididos por los sumarios instruidos, la misma regla que usa Avance de Sumarios. La meta es el 100 %. Nivel de avance: bajo, menos de 25 %; medio, de 25 % a menos de 75 %; alto, 75 % o más. El ranking ordena a los servicios por su % de avance del mes (1° = mayor avance); en empate, primero el que tiene más procesos cerrados y luego por nombre. Los servicios sin sumarios instruidos no tienen avance que medir y quedan fuera del ranking, igual que los que no informan el mes. El cambio de posición compara con el ranking del mes anterior; la variación del avance se expresa en puntos porcentuales (pp)."]};
  let title,file;
  if(tipo==="mensual"){
    title=`Informe de ranking de avance · ${mesTxt}`;file=`Informe_ranking_avance_sumarios_${y}_${String(m+1).padStart(2,"0")}`;
    const rk=ranking(y,m);
    const s1={h:"1. Síntesis",sheet:"Resumen",p:[sintesis(m)]};
    if(CFG.alcanceCompleto){const sinIns=d.sleps.filter(s=>{const r=metr(s.m[m]);return r&&r.av==null}).length,sinInfo=d.sleps.filter(s=>!s.m[m]).length,n=rk.n||1;
      s1.table={cols:[{h:"Nivel de avance",t:"txt",w:2.4},{h:"N° de SLEP",t:"n"},{h:"% del ranking",t:"p"}],rows:[
        ...["alto","medio","bajo"].map(nv=>{const k=rk.L.filter(x=>nivel(x.r.av)===nv).length;return {c:[NIVEL_TXT[nv],k,k/n],over:new Set(nv==="bajo"&&k?[1]:[])}}),
        {c:["Sin sumarios instruidos (fuera del ranking)",sinIns,null],over:new Set()},{c:["Sin información (fuera del ranking)",sinInfo,null],over:new Set()}]}}
    secs.push(s1);
    secs.push({h:`2. Ranking de avance por SLEP · ${mesTxt}`,sheet:"Ranking",p:["Servicios ordenados por % de avance (1° = mayor avance). Se destacan en rojo los servicios con avance bajo."],table:tabRanking(m)});
    if(CFG.alcanceCompleto&&m>0){const L=rk.L.map(x=>{const rp=metr(x.s.m[m-1]);return {x,dv:rp&&rp.av!=null?x.r.av-rp.av:null,mv:movimiento(y,m,x.s.cod)}}).filter(z=>z.dv!=null);
      const linea=z=>`${z.x.s.nombre}: ${pp(z.dv)}${z.mv?` · ${z.mv.largo.toLowerCase()}`:""}.`;
      const up=L.filter(z=>z.dv>0.0005).sort((a,b)=>b.dv-a.dv).slice(0,5),dn=L.filter(z=>z.dv<-0.0005).sort((a,b)=>a.dv-b.dv).slice(0,5);
      secs.push({h:"3. Movimientos del mes",sheet:null,list:true,p:[
        ...(up.length?["Mayores avances respecto de "+MESES_L[m-1]+":",...up.map(linea)]:["Ningún servicio aumentó su avance respecto de "+MESES_L[m-1]+"."]),
        ...(dn.length?["Retrocesos:",...dn.map(linea)]:["Ningún servicio retrocedió."])]})}
  }else{
    title=`Informe ${Q!=null?"trimestral":"anual"} de ranking de avance · ${perTxt}`;file=Q!=null?`Informe_trimestral_ranking_avance_sumarios_${y}_T${Q+1}`:`Informe_anual_ranking_avance_sumarios_${y}`;
    const rkL=ranking(y,last),orden=[...rkL.L.map(x=>x.s),...(CFG.alcanceCompleto?d.sleps.filter(s=>!rkL.pos.get(s.cod)).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")):[])];
    const RF=rec(y,"TOTAL",first),RL=rec(y,"TOTAL",last);
    secs.push({h:"1. Síntesis del período",sheet:null,p:[
      CFG.alcanceCompleto&&RF&&RL?`Entre ${MESES_L[first]} y ${MESES_L[last]} de ${y}, el avance consolidado pasa de ${pct(RF.av)} a ${pct(RL.av)}${RF.av!=null&&RL.av!=null?` (${pp(RL.av-RF.av)})`:""}.`:"",
      sintesis(last)].filter(Boolean)});
    const posTxt=(s,i)=>{const p=ranking(y,i).pos.get(s.cod);return p?`${p}°`:"—"};
    secs.push({h:"2. Posición en el ranking, mes a mes",sheet:"Posiciones",p:[`Lugar de cada servicio en el ranking de cada mes. Ordenados por su posición en ${MESES_L[last]}.`],
      table:{small:true,cols:[{h:"Servicio Local",t:"txt",w:1.9},...rangeM.map(i=>({h:MESES[i],t:"txt",w:.6})),{h:"Cambio en el período",t:"txt",w:1.1}],
        rows:orden.map(s=>{const a=ranking(y,first).pos.get(s.cod),b=ranking(y,last).pos.get(s.cod),dd=a&&b?a-b:null;
          return {c:[s.nombre,...rangeM.map(i=>posTxt(s,i)),dd==null?"—":dd>0?`Sube ${dd}`:dd<0?`Baja ${-dd}`:"Se mantiene"],over:new Set()}})}});
    secs.push({h:"3. % de avance por SLEP y mes",sheet:"Avance por SLEP",p:["Se destacan en rojo los meses con avance bajo."],
      table:{small:true,cols:[{h:"Servicio Local",t:"txt",w:1.9},...rangeM.map(i=>({h:MESES[i],t:"p"}))],
        rows:orden.map(s=>{const ov=new Set();const vs=rangeM.map((i,j)=>{const r=metr(s.m[i]);if(r&&r.av!=null&&nivel(r.av)==="bajo")ov.add(j+1);return r?r.av:null});return {c:[s.nombre,...vs],over:ov}})}});
    secs.push({h:`4. Ranking de avance · ${cap1(MESES_L[last])} ${y}`,sheet:"Ranking",p:[`Detalle de cada servicio en ${MESES_L[last]} de ${y}.`],table:tabRanking(last)});
  }
  secs.push(nota);
  return {title,scope,file,fecha:hoy(),fuente:`Fuente: Avance de Sumarios (${y}). Emitido el ${hoy()}.`,secs};
}
function generateReport(){
  const tipo=document.querySelector('input[name="r-tipo"]:checked').value,fx=document.querySelector('input[name="r-fmt"]:checked').value;
  const st=$("r-status"),btn=$("r-go");btn.disabled=true;st.className="status";st.textContent="Preparando el informe…";
  Promise.resolve().then(()=>CFG.documento(reportModel(tipo),fx))
    .then(nombre=>{st.className="status ok";st.textContent=`Informe generado: ${nombre}`},
      e=>{st.className="status err";st.textContent="No fue posible generar el informe: "+e.message})
    .then(()=>{btn.disabled=false});
}
function syncReportForm(){
  const d=Y();
  $("r-tipo-m-t").textContent=`Mensual · ${cap1(MESES_L[S.mes])} ${S.year}`;
  // Anual y trimestral, hasta el mes de referencia.
  $("r-tipo-a-t").textContent=`Anual · ${S.year} (${MESES[d.primero]}–${MESES[S.mes]})`;
  const tq=$("r-trim"),prev=tq.value;
  tq.innerHTML=[0,1,2,3].filter(q=>q*3+2>=d.primero&&q*3<=S.mes).map(q=>`<option value="${q}">T${q+1} · ${MESES[q*3]}–${MESES[q*3+2]}${q*3+2>S.mes||q*3<d.primero?" (parcial)":""}</option>`).join("");
  tq.value=[...tq.options].some(o=>o.value===prev)?prev:String(Math.floor(S.mes/3));
}

/* ===== Inicio ===== */
function init(){
  $("logo").src=CFG.logo;
  if(!CFG.alcanceCompleto){$("slep").closest(".field").hidden=true;$("filtros").hidden=true}
  $("years").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.year=b.dataset.y;S.mes=null;S.abierto=null;buildSelects();render()};
  $("mes").onchange=e=>{S.mes=+e.target.value;render()};
  $("slep").onchange=e=>irA(e.target.value===""?null:+e.target.value);
  $("orden").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.orden=b.dataset.o;render()};
  $("nivel").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.nivel=b.dataset.n;render()};
  const lista=$("rkl");
  lista.onclick=e=>{const b=e.target.closest(".rkr");if(b)alternarFila(+b.closest("li").dataset.c)};
  lista.onmousemove=e=>{const b=e.target.closest(".rkr");if(!b){ocultarTip();return}const cod=+b.closest("li").dataset.c;if(S.abierto===cod){ocultarTip();return}mostrarTip(cod,e)};
  lista.onmouseleave=ocultarTip;
  $("movimientos").onclick=e=>{const b=e.target.closest("button[data-c]");if(b){$("slep").value=b.dataset.c;irA(+b.dataset.c)}};
  escuchar(window,"scroll",ocultarTip,{passive:true});
  escuchar(document,"keydown",e=>{if(e.key==="Escape")cerrarPops(true)});
  $("r-open").onclick=()=>alternarPop("rpanel","r-open");
  $("h-open").onclick=()=>alternarPop("hpanel","h-open");
  $("r-close").onclick=()=>cerrarPops(true);
  document.querySelectorAll(".bloque [data-cerrar]").forEach(b=>b.onclick=()=>cerrarPops(true));
  $("r-go").onclick=generateReport;
  $("r-trim").addEventListener("change",()=>{document.querySelector('input[name="r-tipo"][value="trimestral"]').checked=true});
  document.querySelector('[data-copy="rk"]').onclick=copiarRanking;
  $("u-nombre").textContent=CFG.usuario.nombre;$("u-perfil").textContent=CFG.usuario.perfil;
  $("salir").onclick=()=>CFG.alSalir();
  // Barra fija: su alto define dónde se detienen los saltos; sombra al quedar pegada.
  const tb=$("toolbar"),alto=()=>document.documentElement.style.setProperty("--alto-barra",tb.offsetHeight+"px");
  alto();const ro=new ResizeObserver(alto);ro.observe(tb);observadores.push(ro);
  const sombra=()=>tb.classList.toggle("pegada",tb.getBoundingClientRect().top<=1&&scrollY>0);
  escuchar(window,"scroll",sombra,{passive:true});sombra();
  // Acciones en la misma fila que los filtros; si no caben, se compactan y,
  // si ni así, pasan juntas a su propia fila (ver .compacta / .apilada).
  const acomodarBarra=()=>{const acc=tb.querySelector(".tb-acc"),ref=tb.querySelector(".tb-in>.field");if(!acc||!ref)return;
    tb.classList.remove("compacta","apilada");const baja=()=>acc.offsetTop>=ref.offsetTop+ref.offsetHeight-1;
    if(!baja())return;tb.classList.add("compacta");if(baja()){tb.classList.remove("compacta");tb.classList.add("apilada")}};
  escuchar(window,"resize",acomodarBarra);
  buildSelects();render();
  acomodarBarra();if(document.fonts)document.fonts.ready.then(acomodarBarra);
  if(S.slep!=null)setTimeout(()=>{const li=document.querySelector(`#rkl li[data-c="${S.slep}"]`);li&&li.scrollIntoView({block:"center"})});
}

init();
return {
  destruir:()=>{oyentes.forEach(([o,e,f,op])=>o.removeEventListener(e,f,op));observadores.forEach(r=>r.disconnect())},
  anio:()=>S.year,
  mesesDelAnio:()=>{const d=Y();return [...Array(d.ultimoMes).keys()].filter(m=>m>=d.primero)},
};
}
