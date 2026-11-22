'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, FolderOpen, ShieldCheck } from 'lucide-react';

type LocalFile = { name: string; path: string; size: number; lastModified:number; file:File };

const categories = [
  { id:'maps', label:'Zone maps', match:(file:LocalFile)=>/\/maps\//i.test(file.path)&&/\.txt$/i.test(file.name), use:'Available for floor plans and whole-dungeon wireframes.' },
  { id:'logs', label:'Session logs', match:(file:LocalFile)=>/\/logs\/eqlog_.+\.txt$/i.test(file.path)&&file.size>0, use:'Ready for local damage, loot, faction, chat, and zone parsing.' },
  { id:'factions', label:'Faction reports', match:(file:LocalFile)=>/-factions\.txt$/i.test(file.name)&&file.size>0, use:'Ready for standing and points-to-maximum charts.' },
  { id:'inventory', label:'Inventory reports', match:(file:LocalFile)=>/-inventory\.txt$/i.test(file.name)&&file.size>0, use:'Ready for carried, equipped, bank, and gear analysis.' },
  { id:'spells', label:'Spell reports', match:(file:LocalFile)=>/-(spellbook|missingspells)\.txt$/i.test(file.name)&&file.size>0, use:'Ready for known-versus-missing spell audits.' },
  { id:'achievements', label:'Achievement reports', match:(file:LocalFile)=>/-achievements\.txt$/i.test(file.name)&&file.size>0, use:'Ready for AA and achievement inspection.' },
  { id:'help', label:'Client help pages', match:(file:LocalFile)=>/\/help\/.+\.html?$/i.test(file.path), use:'Local EQL documentation is present for reference.' },
  { id:'references', label:'Client reference tables', match:(file:LocalFile)=>/^(skillcaps|racedata|spells_us|spells_us_str)\.txt$/i.test(file.name), use:'Useful for local audits; bulk client data is not republished.' },
] as const;

function sizeLabel(bytes:number){return bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:bytes>=1024?`${(bytes/1024).toFixed(1)} KB`:`${bytes} B`}

export default function InstallScanner({onOpenReport,onOpenLogs,onOpenMaps}:{onOpenReport:(file:File)=>void;onOpenLogs:()=>void;onOpenMaps:()=>void}){
  const picker=useRef<HTMLInputElement>(null);
  const [files,setFiles]=useState<LocalFile[]>([]);
  const report=useMemo(()=>categories.map((category)=>{
    const matches=files.filter(category.match);
    const newest=[...matches].sort((a,b)=>b.lastModified-a.lastModified)[0];
    return {...category,matches,newest,count:matches.length,bytes:matches.reduce((sum,file)=>sum+file.size,0)};
  }),[files]);
  const detected=report.filter((item)=>item.count>0).length;
  const totalBytes=files.reduce((sum,file)=>sum+file.size,0);
  return <section className="installscanner" aria-labelledby="install-scanner-title">
    <header><div><small>LOCAL INSTALLATION INTELLIGENCE</small><h3 id="install-scanner-title">See what your EQL installation can power</h3><p>Select the EverQuest Legends folder. EQLSaK inventories file names, paths, sizes, and report availability in this browser; it does not upload or copy the files.</p></div><button type="button" onClick={()=>picker.current?.click()}><FolderOpen aria-hidden="true"/>{files.length?'Scan again':'Choose EQL folder'}</button><input ref={picker} type="file" multiple hidden {...({webkitdirectory:'',directory:''} as Record<string,string>)} onChange={(event)=>setFiles(Array.from(event.target.files||[]).map((file)=>({name:file.name,path:(file as File & {webkitRelativePath?:string}).webkitRelativePath||file.name,size:file.size,lastModified:file.lastModified,file})))}/></header>
    {!files.length?<div className="scannerempty"><ShieldCheck aria-hidden="true"/><div><b>The browser requires you to choose the folder.</b><span>A website cannot silently read your SSD. Select <code>C:\Users\Public\Daybreak Game Company\Installed Games\EverQuest Legends</code> when prompted.</span></div></div>:<><div className="scannertotals"><article><b>{files.length.toLocaleString()}</b><span>files inventoried</span></article><article><b>{detected}/{categories.length}</b><span>useful groups found</span></article><article><b>{sizeLabel(totalBytes)}</b><span>installation represented</span></article></div><div className="scannercards">{report.map((item)=>{const reportType=['factions','inventory','spells','achievements'].includes(item.id);return <article key={item.id} className={item.count?'ready':'missing'}><div>{item.count?<CheckCircle2 aria-hidden="true"/>:<AlertTriangle aria-hidden="true"/>}<span><b>{item.label}</b><small>{item.count?`${item.count.toLocaleString()} file${item.count===1?'':'s'} · ${sizeLabel(item.bytes)}`:'Not found in this selection'}</small></span></div><i><em style={{width:`${item.count?Math.max(8,Math.min(100,item.count/Math.max(1,...report.map((entry)=>entry.count))*100)):0}%`}}/></i><p>{item.count?item.use:item.id==='inventory'?'Create one in EQL with /outputfile inventory, then scan again.':'Generate or locate this report only if your EQL client supports it.'}</p>{item.newest&&<small className="scannernewest">Newest: {item.newest.name}</small>}{item.count>0&&reportType&&item.newest&&<button type="button" onClick={()=>onOpenReport(item.newest.file)}>Analyze newest report <ChevronRight aria-hidden="true"/></button>}{item.count>0&&item.id==='logs'&&<button type="button" onClick={onOpenLogs}>Open Log Reader <ChevronRight aria-hidden="true"/></button>}{item.count>0&&item.id==='maps'&&<button type="button" onClick={onOpenMaps}>Open Dungeon Maps <ChevronRight aria-hidden="true"/></button>}</article>})}</div><footer><b>Privacy boundary:</b> this scanner uses metadata only. A report is read only after you explicitly choose “Analyze newest report.”</footer></>}
  </section>;
}
