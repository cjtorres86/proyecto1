// @ts-nocheck
/* Detalle al pasar el mouse en el Informe de dashboard: el mismo del Dashboard
 * de la aplicación (el dato, su parte del total y los 5 SLEP que más aportan).
 *
 * En JavaScript simple y autocontenido (sin async/await ni "...objeto", que
 * Angular reescribe con funciones auxiliares): "Guardar" lo incrusta tal cual
 * en el .html, con los desgloses ya pedidos.
 *
 * Cada elemento con detalle lleva data-tip = {"id","l" (nombre),"v" (valor),
 * "bt" (de qué es parte),"b" (total)}. ctx: { ambito, consolidado, des:
 * { campo: [{slep, valor}] }, pedir?: (campo) => Promise<[{slep, valor}]> }.
 */
export interface ContextoTips {
  ambito: string;
  consolidado: boolean;
  des: Record<string, { slep: string; valor: number }[]>;
  pedir?: (campo: string) => Promise<{ slep: string; valor: number }[]>;
}

export function activarTipsDashboard(raiz: HTMLElement, ctx: ContextoTips): () => void {
  const tip=raiz.querySelector("#tip-d");if(!tip)return function(){};
  const NF=new Intl.NumberFormat("es-CL");
  const fmt=v=>v==null?"—":NF.format(Math.round(v));
  const pct=v=>v==null?"—":(v*100).toLocaleString("es-CL",{minimumFractionDigits:1,maximumFractionDigits:1})+" %";
  const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  let actual=null,ultimo=null;
  function pintar(t){
    let h=`<span class="h">${esc(t.l)}<small>${esc(ctx.ambito)}</small></span>`;
    h+=`<span class="r"><span class="big">${fmt(t.v)}</span>${t.b?`<span class="muted">${pct((t.v||0)/t.b)} de ${esc(String(t.bt||"").toLowerCase())}</span>`:""}</span>`;
    if(t.id&&ctx.consolidado){
      const des=ctx.des[t.id];
      h+=`<span class="sep"></span><span class="sec">SLEP que más aportan</span>`;
      if(!des)h+=`<span class="muted">${ctx.pedir?"Cargando…":"Sin detalle por SLEP."}</span>`;
      else{const top=des.filter(x=>x.valor).sort((a,b)=>b.valor-a.valor).slice(0,5),tot=des.reduce((a,x)=>a+(x.valor||0),0);
        h+=top.length?top.map(x=>`<span class="r"><span>${esc(x.slep)}</span><span>${fmt(x.valor)}${tot?` <span class="muted">(${pct(x.valor/tot)})</span>`:""}</span></span>`).join(""):`<span class="muted">Ningún SLEP informa este dato.</span>`}
    }
    tip.innerHTML=h;tip.hidden=false;
  }
  function mover(e){const tw=tip.offsetWidth,th=tip.offsetHeight;let lx=e.clientX+16,ly=e.clientY+16;
    if(lx+tw>innerWidth-8)lx=e.clientX-tw-16;if(ly+th>innerHeight-8)ly=Math.max(8,e.clientY-th-16);
    tip.style.left=lx+"px";tip.style.top=ly+"px"}
  function alMover(e){
    const el=e.target.closest?e.target.closest("[data-tip]"):null;
    if(!el||!raiz.contains(el)){if(actual){actual=null;tip.hidden=true}return}
    if(el!==actual){actual=el;let t;try{t=JSON.parse(el.getAttribute("data-tip"))}catch(x){return}ultimo=t;pintar(t);
      if(t.id&&ctx.consolidado&&!ctx.des[t.id]&&ctx.pedir){const id=t.id;
        ctx.pedir(id).then(d=>{ctx.des[id]=d},()=>{ctx.des[id]=[]}).then(()=>{if(ultimo&&ultimo.id===id&&!tip.hidden)pintar(ultimo)})}}
    mover(e);
  }
  function ocultar(){actual=null;tip.hidden=true}
  raiz.addEventListener("mousemove",alMover);raiz.addEventListener("mouseleave",ocultar);window.addEventListener("scroll",ocultar,{passive:true});
  return function(){raiz.removeEventListener("mousemove",alMover);raiz.removeEventListener("mouseleave",ocultar);window.removeEventListener("scroll",ocultar)};
}
