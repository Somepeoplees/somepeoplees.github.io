import{useState,useEffect,useRef,useCallback}from'react';

type Row=string[];type Data=Row[];type Change={row:number;col:number;old:string;val:string;skill:string;attr:string;lvl:string};
type Sel={r1:number;c1:number;r2:number;c2:number};
const SAMPLE=`ID,Name,Attribute,Level1,Level2,Level3,Level4,Level5,Level6,Level7,Level8,Level9,Level10,TunerMin,TunerMax
49,Barrier,Cooldown Timer,1,1,1,1,1,7,5,3,2,1,0,30
49,Barrier,Damage Reduction Pct,1,1,1,1,1,1,1,1,1,1,0,1
48,Blinding,Damage Reduction Pct,0.5,0.65,0.8,0.8,0.8,0.5,0.65,0.8,0.8,0.8,0,1
48,Blinding,Effect Duration,60,60,60,60,60,10,15,20,20,20,0,30
3,Bodkin Points,Damage Bonus Pct,0.75,1.5,2.25,3,3.75,1,2,3,4,5,0,1
21,Burst Fire,Damage Reduction Pct,0.3,0.45,0.5,0.45,0.4,0.5,0.55,0.55,0.5,0.45,0,1
21,Burst Fire,Number of Projectiles,4,5,6,7,10,3,4,5,5,5,0,20
43,Dash,Cooldown Timer,2,2,1,1,1,10,7,4,4,4,0,30
63,Coup de Grace,Threshold,0.75,0.80,0.87,0.90,0.95,0.35,0.45,0.55,0.65,0.75,0,1
1,Keen Eye,Damage Bonus Pct,0.6,1,2,2.5,4,0.5,1,1.5,2,2.5,0,1
42,Lightfoot,Jumps,2,4,6,8,15,2,3,4,4,4,0,5
4,Rapid Fire,Reload Time,-0.5,-0.5,-0.6,-0.7,-0.9,-0.2,-0.35,-0.5,-0.6,-0.65,0,1
7,Power Shot,Damage Bonus Pct,1,1.5,2,3,4,1.25,2,3,4,5,0,1
7,Power Shot,Cooldown Timer,2,1.75,1.5,1.25,1,1.75,1.5,1.25,1,0.75,0,30
122,Arcane Thrift,Spell Cost Reduction,5,10,15,18,20,7,15,20,22,25,0,100
126,Mana Reserve,Mana Reserve Amount,100,200,300,500,750,150,300,450,700,1000,0,100`;

const views:{[k:string]:{n:string;c:string[]|null}}={full:{n:'Full View',c:null},normal:{n:'Normal (L1-5)',c:['ID','Name','Attribute','Level1','Level2','Level3','Level4','Level5','TunerMin','TunerMax']},enhanced:{n:'Enhanced (L6-10)',c:['ID','Name','Attribute','Level6','Level7','Level8','Level9','Level10','TunerMin','TunerMax']},tuner:{n:'Tuner Values',c:['ID','Name','Attribute','TunerMin','TunerMax']}};

const getRule=(a:string)=>{const l=a.toLowerCase();if(l.includes('cooldown')||l.includes('reload')||l.includes('cost')||l.includes('delay'))return{t:'cd',min:0.05};if(l.includes('threshold'))return{t:'th',max:0.98};if(l.includes('resistance')||l.includes('reduction'))return{t:'dim',max:0.99};if(l.includes('duration'))return{t:'dur',max:60};if(l.includes('number')||l.includes('projectile')||l.includes('jump'))return{t:'cnt',max:50};return{t:'lin'}};
const rnd=(v:number)=>{if(Number.isInteger(v))return v;if(Math.abs(v)>=100)return Math.round(v);if(Math.abs(v)>=10)return Math.round(v*10)/10;if(Math.abs(v)>=1)return Math.round(v*100)/100;return Math.round(v*1000)/1000};
const scale=(v:number,m:number,r:any)=>{let res=v;switch(r.t){case'cd':res=v>0?Math.max(v/m,r.min||0.05):Math.max(v*Math.pow(m,0.6),-0.95);break;case'th':res=v+((1-v)*0.05*(m-1));break;case'dim':res=v>=0&&v<=1?1-Math.pow(1-v,m):v*m;break;case'cnt':res=Math.round(v*Math.sqrt(m));break;default:res=Math.abs(v)>10?v*(1+(m-1)*0.7):v*m}return r.max?Math.min(res,r.max):res};

export function App(){
  const[dark,setDark]=useState(()=>localStorage.getItem('dark')==='1');
  const[data,setData]=useState<Data>([]);
  const[hist,setHist]=useState<string[]>([]);
  const[hIdx,setHIdx]=useState(-1);
  const[sel,setSel]=useState<Sel|null>(null);
  const[drag,setDrag]=useState(false);
  const[view,setView]=useState('full');
  const[filter,setFilter]=useState('');
  const[tab,setTab]=useState('editor');
  const[toast,setToast]=useState<{m:string;t:string}|null>(null);
  const[ctx,setCtx]=useState<{x:number;y:number;r:number;c:number;type:string}|null>(null);
  const[find,setFind]=useState('');
  const[repl,setRepl]=useState('');
  const[matches,setMatches]=useState<{r:number;c:number}[]>([]);
  const[mult,setMult]=useState(1.5);
  const[lvlScale,setLvlScale]=useState(5);
  const[pending,setPending]=useState<Change[]>([]);
  const[apiKey,setApiKey]=useState(()=>localStorage.getItem('gkey')||'');
  const[aiPmt,setAiPmt]=useState('');
  const[aiResp,setAiResp]=useState('');
  const[aiLoading,setAiLoading]=useState(false);
  const[caps,setCaps]=useState(true);
  const[enforce,setEnforce]=useState(true);
  const[useExp,setUseExp]=useState(true);
  const[balFilter,setBalFilter]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);localStorage.setItem('dark',dark?'1':'0')},[dark]);
  useEffect(()=>{parse(SAMPLE)},[]);
  useEffect(()=>{if(toast)setTimeout(()=>setToast(null),3000)},[toast]);
  
  const download=()=>{if(!data.length)return msg('No data','warning');const c=data.map(r=>r.map(c=>c.includes(',')||c.includes('"')?`"${c.replace(/"/g,'""')}"`:c).join(',')).join('\n');const b=new Blob([c],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='game_data.csv';a.click();msg('Downloaded')};

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.ctrlKey&&e.key==='z'){e.preventDefault();undo()}
      if(e.ctrlKey&&e.key==='y'){e.preventDefault();redo()}
      if(e.ctrlKey&&e.key==='s'){e.preventDefault();download()}
      if(e.ctrlKey&&e.key==='d'){e.preventDefault();dupSel()}
      if(e.key==='Delete'||e.key==='Backspace'){if(document.activeElement?.tagName!=='INPUT')delSel()}
    };
    window.addEventListener('keydown',h);return ()=>window.removeEventListener('keydown',h);
  },[sel,data,hIdx]);

  const msg=(m:string,t='success')=>setToast({m,t});
  const save=(d:Data)=>{const s=JSON.stringify(d);const h=[...hist.slice(0,hIdx+1),s].slice(-50);setHist(h);setHIdx(h.length-1)};
  const parse=(t:string)=>{const r=t.trim().split('\n').map(l=>{const row:string[]=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){row.push(c.trim());c=''}else c+=ch}row.push(c.trim());return row});setData(r);save(r)};

  const undo=()=>{if(hIdx>0){setHIdx(hIdx-1);setData(JSON.parse(hist[hIdx-1]));msg('Undo','info')}};
  const redo=()=>{if(hIdx<hist.length-1){setHIdx(hIdx+1);setData(JSON.parse(hist[hIdx+1]));msg('Redo','info')}};

  const upd=(r:number,c:number,v:string)=>{const d=[...data];d[r]=[...d[r]];d[r][c]=v;setData(d);save(d)};
  
  // Advanced Selection & Tools
  const selArea=(r1:number,c1:number,r2:number,c2:number)=>{setSel({r1:Math.min(r1,r2),c1:Math.min(c1,c2),r2:Math.max(r1,r2),c2:Math.max(c1,c2)})};
  const startSel=(r:number,c:number)=>{setDrag(true);setSel({r1:r,c1:c,r2:r,c2:c})};
  const moveSel=(r:number,c:number)=>{if(drag&&sel)selArea(sel.r1,sel.c1,r,c)};
  const endSel=()=>setDrag(false);
  
  const ctxMenu=(e:React.MouseEvent,r:number,c:number,type='cell')=>{e.preventDefault();setCtx({x:e.clientX,y:e.clientY,r,c,type})};
  const closeCtx=()=>{setCtx(null)};

  const op=(fn:(v:string,r:number,c:number)=>string)=>{
    if(!sel)return;
    const d=[...data];let cnt=0;
    for(let r=sel.r1;r<=sel.r2;r++){
      if(r>=d.length)continue;d[r]=[...d[r]];
      for(let c=sel.c1;c<=sel.c2;c++){
        if(c>=d[r].length)continue;
        const nv=fn(d[r][c],r,c);if(nv!==d[r][c]){d[r][c]=nv;cnt++}
      }
    }
    if(cnt){setData(d);save(d);msg(`Updated ${cnt} cells`)}
    closeCtx();
  };

  const dupSel=()=>{
    if(!sel)return msg('Select cells','warning');
    const d=[...data];
    // If full row selected (checking if selection spans all cols)
    if(sel.c1===0 && sel.c2===data[0].length-1 && sel.r1===sel.r2) {
      d.splice(sel.r1+1,0,[...data[sel.r1]]);setData(d);save(d);msg('Row duplicated');return;
    }
    // Else smart fill down
    if(sel.r1===sel.r2){ // Single row selected -> duplicate row below
        const rowToDup = d[sel.r1];
        d.splice(sel.r1+1,0,[...rowToDup]);
        setData(d);save(d);msg('Row duplicated');
    } else { // Range -> fill down from top row
       for(let r=sel.r1+1;r<=sel.r2;r++){
         d[r]=[...d[r]];
         for(let c=sel.c1;c<=sel.c2;c++) d[r][c]=d[sel.r1][c];
       }
       setData(d);save(d);msg('Filled down');
    }
  };

  const delSel=()=>{
    if(!sel)return;
    // If full rows selected
    if(sel.c1===0 && sel.c2===data[0].length-1) {
       const d=data.filter((_,i)=>i<sel.r1||i>sel.r2);
       setData(d);save(d);setSel(null);msg('Rows deleted');
    } else {
       op(()=>''); msg('Cleared cells');
    }
  };

  const tools={
    jitter:(pct:number)=>op(v=>{const n=parseFloat(v);return isNaN(n)?v:rnd(n*(1+(Math.random()-0.5)*pct/50)).toString()}),
    round:()=>op(v=>{const n=parseFloat(v);return isNaN(n)?v:Math.round(n).toString()}),
    add:(amt:number)=>op(v=>{const n=parseFloat(v);return isNaN(n)?v:rnd(n+amt).toString()}),
    mult:(amt:number)=>op(v=>{const n=parseFloat(v);return isNaN(n)?v:rnd(n*amt).toString()}),
    random:(min:number,max:number)=>op(()=>rnd(min+Math.random()*(max-min)).toString()),
    case:()=>op(v=>v===v.toUpperCase()?v.toLowerCase():v.toUpperCase())
  };

  const addRow=(idx=data.length)=>{const d=[...data];d.splice(idx,0,new Array(data[0].length).fill(''));setData(d);save(d);msg('Row added')};
  const addCol=(idx=data[0].length)=>{const d=data.map((r,i)=>[...r.slice(0,idx),i===0?`Col${r.length+1}`:'',...r.slice(idx)]);setData(d);save(d);msg('Col added')};
  
  // Render Helpers
  const visCols=useCallback(()=>{if(!data.length)return[];const cfg=views[view];return cfg.c?cfg.c.map(n=>data[0].indexOf(n)).filter(i=>i>=0):data[0].map((_,i)=>i)},[data,view]);
  const filtRows=useCallback(()=>{if(!filter)return data.map((_,i)=>i);const ni=data[0]?.indexOf('Name')??1;return data.map((_,i)=>i).filter(i=>i===0||data[i][ni]?.toLowerCase().includes(filter.toLowerCase()))},[data,filter]);
  const vCols=visCols();
  const fRows=filtRows();

  return(<div className="min-h-screen pb-20" onMouseUp={endSel} onClick={closeCtx}>
    {toast&&<div className="fixed top-4 right-4 z-50"><div className={`toast px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.t==='success'?'bg-green-500':toast.t==='error'?'bg-red-500':'bg-blue-500'}`}><i className={`fas fa-${toast.t==='success'?'check':toast.t==='error'?'times':'info'}-circle mr-1`}/>{toast.m}</div></div>}
    
    {ctx && <div className="ctx-menu" style={{top:ctx.y,left:ctx.x}}>
      <div className="ctx-item font-bold border-b border-[var(--brd)] mb-1 pb-1">{ctx.type==='row'?`Row ${ctx.r}`:ctx.type==='col'?`Col ${data[0][ctx.c]}`:'Cell Actions'}</div>
      <div className="ctx-item" onClick={dupSel}><i className="fas fa-copy w-5"/>Duplicate / Fill</div>
      <div className="ctx-item" onClick={delSel}><i className="fas fa-trash w-5"/>Delete / Clear</div>
      <div className="ctx-sep"/>
      <div className="ctx-item" onClick={()=>addRow(ctx.r)}><i className="fas fa-plus w-5"/>Insert Row Above</div>
      <div className="ctx-item" onClick={()=>addRow(ctx.r+1)}><i className="fas fa-arrow-down w-5"/>Insert Row Below</div>
      {ctx.type==='col' && <div className="ctx-item" onClick={()=>addCol(ctx.c)}><i className="fas fa-columns w-5"/>Insert Column</div>}
      <div className="ctx-sep"/>
      <div className="text-xs px-2 py-1 text-[var(--txt-m)]">Tools</div>
      <div className="ctx-item" onClick={()=>tools.jitter(10)}><i className="fas fa-wave-square w-5"/>Jitter 10%</div>
      <div className="ctx-item" onClick={()=>tools.round()}><i className="fas fa-hashtag w-5"/>Round Values</div>
      <div className="ctx-item" onClick={()=>tools.mult(1.1)}><i className="fas fa-arrow-up w-5"/>Increase 10%</div>
      <div className="ctx-item" onClick={()=>tools.mult(0.9)}><i className="fas fa-arrow-down w-5"/>Decrease 10%</div>
      <div className="ctx-item" onClick={()=>tools.case()}><i className="fas fa-font w-5"/>Toggle Case</div>
    </div>}

    <div className="container mx-auto px-2 py-3 max-w-full">
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl p-3 mb-3 shadow-lg flex justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2"><i className="fas fa-gamepad"/>CSV Editor Pro <span className="text-xs bg-white/20 px-2 rounded-full">Pro</span></h1>
        <div className="flex gap-1">
          <button onClick={undo} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-sm"><i className="fas fa-undo"/></button>
          <button onClick={redo} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-sm"><i className="fas fa-redo"/></button>
          <button onClick={()=>setDark(!dark)} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-sm"><i className={`fas fa-${dark?'sun':'moon'}`}/></button>
          <button onClick={()=>fileRef.current?.click()} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-sm"><i className="fas fa-upload"/></button>
          <button onClick={()=>{const c=data.map(r=>r.join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c]));a.download='data.csv';a.click()}} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-sm"><i className="fas fa-download"/></button>
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={e=>{if(e.target.files?.[0]){const r=new FileReader();r.onload=ev=>parse(ev.target?.result as string);r.readAsText(e.target.files[0])}}}/>
      </header>

      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {[['editor','Editor','table'],['balance','Smart Balance','scale-balanced'],['ai','AI Assistant','robot'],['find','Find/Replace','search']].map(([k,n,i])=>
          <button key={k} onClick={()=>setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-medium border ${tab===k?'bg-indigo-500 text-white border-transparent':'border-[var(--brd)] hover:bg-[var(--hvr)]'}`}><i className={`fas fa-${i} mr-1`}/>{n}</button>
        )}
      </div>

      {tab==='editor' && <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-1 space-y-3">
          <div className="card rounded-xl p-3 border border-[var(--brd)]">
             <div className="text-xs font-bold mb-2 text-[var(--txt-m)]">VIEWS</div>
             {Object.entries(views).map(([k,v])=><button key={k} onClick={()=>setView(k)} className={`w-full text-left px-2 py-1.5 rounded text-xs mb-1 ${view===k?'bg-indigo-500/10 text-indigo-500 font-bold':'hover:bg-[var(--hvr)]'}`}>{v.n}</button>)}
             <div className="mt-4 text-xs font-bold mb-2 text-[var(--txt-m)]">QUICK TOOLS</div>
             <div className="grid grid-cols-2 gap-1">
               <button onClick={()=>addRow()} className="bg-emerald-500/10 text-emerald-600 px-2 py-1.5 rounded text-xs hover:bg-emerald-500/20"><i className="fas fa-plus mr-1"/>Row</button>
               <button onClick={()=>addCol()} className="bg-emerald-500/10 text-emerald-600 px-2 py-1.5 rounded text-xs hover:bg-emerald-500/20"><i className="fas fa-plus mr-1"/>Col</button>
               <button onClick={dupSel} className="bg-blue-500/10 text-blue-600 px-2 py-1.5 rounded text-xs hover:bg-blue-500/20"><i className="fas fa-copy mr-1"/>Dup</button>
               <button onClick={delSel} className="bg-red-500/10 text-red-600 px-2 py-1.5 rounded text-xs hover:bg-red-500/20"><i className="fas fa-trash mr-1"/>Del</button>
               <button onClick={()=>tools.jitter(5)} className="col-span-2 bg-orange-500/10 text-orange-600 px-2 py-1.5 rounded text-xs hover:bg-orange-500/20"><i className="fas fa-wave-square mr-1"/>Jitter Values</button>
             </div>
             <div className="mt-4 text-xs font-bold mb-2 text-[var(--txt-m)]">FILTER</div>
             <input className="inp w-full px-2 py-1 text-xs rounded border" placeholder="Search names..." value={filter} onChange={e=>setFilter(e.target.value)}/>
          </div>
        </div>

        <div className="lg:col-span-4 card rounded-xl shadow-md border border-[var(--brd)] flex flex-col h-[75vh]">
          <div className="p-2 border-b border-[var(--brd)] bg-[var(--bg-3)] flex justify-between text-xs">
            <span className="font-bold">{data.length} Rows • {data[0]?.length} Cols</span>
            <span className="text-[var(--txt-m)]">Right-click for options • Drag to select</span>
          </div>
          <div className="flex-1 overflow-auto p-1 relative" onMouseLeave={endSel}>
            {!data.length ? <div className="text-center p-10 text-[var(--txt-m)]">No data</div> :
            <table className="w-full border-collapse text-xs select-none">
              <thead className="sticky top-0 z-10 bg-[var(--bg-3)]">
                <tr>
                  <th className="w-8 border border-[var(--brd)] bg-[var(--bg-3)] sticky left-0 z-20">#</th>
                  {vCols.map(ci=><th key={ci} className={`px-2 py-1 border border-[var(--brd)] cursor-pointer hover:bg-[var(--hvr)] ${sel?.c1===ci&&sel.c2===ci?'bg-indigo-100 dark:bg-indigo-900':''}`}
                    onMouseDown={()=>selArea(0,ci,data.length-1,ci)}
                    onContextMenu={(e)=>ctxMenu(e,0,ci,'col')}
                  >{data[0][ci]}</th>)}
                </tr>
              </thead>
              <tbody>
                {fRows.slice(1).map(ri=>{
                   if(ri>=data.length)return null;
                   return <tr key={ri}>
                     <td className={`sticky left-0 z-10 bg-[var(--bg-2)] border border-[var(--brd)] text-center cursor-pointer hover:bg-[var(--hvr)] ${sel?.r1===ri&&sel.r2===ri?'bg-indigo-100 dark:bg-indigo-900':''}`}
                       onMouseDown={()=>selArea(ri,0,ri,data[0].length-1)}
                       onContextMenu={(e)=>ctxMenu(e,ri,0,'row')}
                     >{ri}</td>
                     {vCols.map(ci=>{
                       const isSel = sel && ri>=sel.r1 && ri<=sel.r2 && ci>=sel.c1 && ci<=sel.c2;
                       const isMatch = matches.some(m=>m.r===ri && m.c===ci);
                       return <td key={`${ri}-${ci}`} 
                         className={`border border-[var(--brd)] p-0 relative ${isSel?'bg-blue-500/10':''}`}
                         onMouseDown={(e)=>{if(e.button===2){if(!isSel)startSel(ri,ci);return} startSel(ri,ci)}}
                         onMouseEnter={()=>moveSel(ri,ci)}
                         onContextMenu={(e)=>ctxMenu(e,ri,ci,'cell')}
                       >
                         <input className={`w-full h-full px-1 py-0.5 bg-transparent outline-none ${isMatch?'bg-yellow-200/50':''}`}
                           value={data[ri][ci]} onChange={e=>upd(ri,ci,e.target.value)}
                         />
                       </td>
                     })}
                   </tr>
                })}
              </tbody>
            </table>}
          </div>
        </div>
      </div>}

      {/* Balance, AI, Find tabs implemented similarly but simplified for brevity in this step, retaining logic */}
      {tab==='balance' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <div className="card p-4 rounded-xl border border-[var(--brd)]">
           <h3 className="font-bold mb-3">Scaling Config</h3>
           <div className="space-y-3">
             <div className="flex gap-2"><div className="flex-1">Multiplier: {mult}x</div><input type="range" min="0.5" max="3" step="0.1" value={mult} onChange={e=>setMult(parseFloat(e.target.value))} className="w-full"/></div>
             <div className="flex gap-2"><div className="flex-1">Level Scaling: {lvlScale}%</div><input type="range" min="0" max="20" step="1" value={lvlScale} onChange={e=>setLvlScale(parseFloat(e.target.value))} className="w-full"/></div>
             <input className="inp w-full px-2 py-1 text-xs rounded border" placeholder="Filter Skills..." value={balFilter} onChange={e=>setBalFilter(e.target.value)}/>
             <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={caps} onChange={e=>setCaps(e.target.checked)}/> Smart Caps</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={useExp} onChange={e=>setUseExp(e.target.checked)}/> Exponential</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={enforce} onChange={e=>setEnforce(e.target.checked)}/> L6&gt;L1</label>
             </div>
             <button onClick={()=>{
                const ch:Change[]=[];const lc:{[k:string]:number}={};for(let i=1;i<=10;i++)lc[`Level${i}`]=data[0].indexOf(`Level${i}`);
                for(let r=1;r<data.length;r++){
                  const row=data[r],at=row[data[0].indexOf('Attribute')],nm=row[data[0].indexOf('Name')];
                  if(balFilter && !nm.toLowerCase().includes(balFilter.toLowerCase())) continue;
                  const rule=getRule(at);
                  for(let i=1;i<=10;i++){
                    const k=`Level${i}`,c=lc[k];if(c<0)continue;
                    const base=i>5?mult*1.05:mult;
                    const idx=i>5?i-6:i-1;
                    const m = useExp ? base*Math.pow(1+lvlScale/100,idx) : base;
                    const ov=parseFloat(row[c]);
                    if(!isNaN(ov)){
                      let nv=scale(ov,m,rule);nv=rnd(nv);
                      if(nv!==ov) ch.push({row:r,col:c,old:ov.toString(),val:nv.toString(),skill:nm,attr:at,lvl:k});
                    }
                  }
                }
                setPending(ch);msg(`${ch.length} changes previewed`);
             }} className="w-full bg-indigo-600 text-white py-2 rounded">Preview Balance</button>
             <button onClick={()=>{if(!pending.length)return;const d=[...data];pending.forEach(p=>d[p.row][p.col]=p.val);setData(d);save(d);setPending([]);msg('Applied')}} className="w-full bg-green-600 text-white py-2 rounded">Apply Changes</button>
           </div>
         </div>
         <div className="card p-4 rounded-xl border border-[var(--brd)] overflow-auto h-[500px]">
            <h3 className="font-bold mb-2">Preview ({pending.length})</h3>
            {pending.map((p,i)=><div key={i} className="text-xs border-b border-[var(--brd)] py-1 flex justify-between">
              <span>{p.skill} - {p.attr} ({p.lvl})</span>
              <span className={parseFloat(p.val)>parseFloat(p.old)?'text-green-500':'text-red-500'}>{p.old} ➔ {p.val}</span>
            </div>)}
         </div>
      </div>}
      
      {tab==='ai' && <div className="card p-4 max-w-2xl mx-auto rounded-xl border border-[var(--brd)]">
         <h3 className="font-bold">Gemini AI Assistant</h3>
         <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="API Key" className="inp w-full p-2 border rounded mt-2"/>
         <textarea value={aiPmt} onChange={e=>setAiPmt(e.target.value)} className="inp w-full p-2 border rounded mt-2 h-32" placeholder="Ask AI to balance..."/>
         <button onClick={async()=>{
            if(!apiKey)return msg('Need API Key','error');
            setAiLoading(true);
            try{
               const prompt = `Data:\n${data.slice(0,40).map(r=>r.join(',')).join('\n')}\n\nTask: ${aiPmt}\nReturn changes list strictly as: Skill, Attribute, Level: Old -> New`;
               const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
               const json=await res.json();
               setAiResp(json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response');
            }catch(e){setAiResp('Error: '+e)}
            setAiLoading(false);
         }} className="bg-purple-600 text-white px-4 py-2 rounded mt-2 w-full" disabled={aiLoading}>{aiLoading?'Thinking...':'Send'}</button>
         <pre className="mt-4 text-xs bg-[var(--bg-3)] p-2 rounded whitespace-pre-wrap">{aiResp}</pre>
      </div>}

      {tab==='find' && <div className="card p-4 max-w-md mx-auto rounded-xl border border-[var(--brd)] text-center space-y-3">
         <h3 className="font-bold">Find & Replace</h3>
         <input value={find} onChange={e=>setFind(e.target.value)} className="inp w-full p-2 border rounded" placeholder="Find..."/>
         <input value={repl} onChange={e=>setRepl(e.target.value)} className="inp w-full p-2 border rounded" placeholder="Replace..."/>
         <div className="flex gap-2">
            <button onClick={()=>{
               const m:{r:number;c:number}[]=[]; data.forEach((r,ri)=>r.forEach((c,ci)=>{if(c.includes(find))m.push({r:ri,c:ci})}));
               setMatches(m);msg(`Found ${m.length}`);
            }} className="flex-1 bg-blue-500 text-white py-2 rounded">Find</button>
            <button onClick={()=>{
               let c=0;const d=data.map(r=>r.map(v=>{if(v.includes(find)){c++;return v.replace(find,repl)}return v}));
               setData(d);save(d);msg(`Replaced ${c}`);
            }} className="flex-1 bg-red-500 text-white py-2 rounded">Replace All</button>
         </div>
      </div>}
    </div>
  </div>);
}
