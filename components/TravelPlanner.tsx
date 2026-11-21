import {useMemo,useState} from 'react';
import {ArrowLeftRight,Footprints,Ship,Zap,GitBranch,Navigation,CircleAlert} from 'lucide-react';
import {Autocomplete} from '@base-ui/react/autocomplete';
import {allZones,matchesZone,type ZoneOption} from '../lib/zone-catalog';
import {defaultTravelOptions,isCurrentZone,planTravel,travelFare,travelBoatWait,travelModeLabels,travelNode,travelZoneId,type TravelMode,type TravelOptions,type TravelPlan} from '../lib/travel-routes';
import '../app/travel-planner.css';

const modeIcons:Record<TravelMode,typeof Footprints>={walk:Footprints,boat:Ship,translocator:Navigation,port:Zap,plane:GitBranch};
function ZonePicker({id,label,value,onChange,zones}:{id:string;label:string;value:string;onChange:(name:string)=>void;zones:ZoneOption[]}){
 return <div className="ba-zone-input-group travel-picker">
  <Autocomplete.Root items={zones} value={value} autoHighlight openOnInputClick itemToStringValue={z=>z.name} filter={(z,q)=>matchesZone(z,q)} onValueChange={onChange}>
   <Autocomplete.Input id={id} aria-label={label} placeholder="Type a zone, such as Qeynos" autoComplete="off"/>
   <Autocomplete.Trigger type="button" aria-label={'Browse zones for '+label}><Navigation size={18} aria-hidden="true"/></Autocomplete.Trigger>
   <Autocomplete.Portal>
    <Autocomplete.Positioner sideOffset={6} className="ba-zone-positioner">
     <Autocomplete.Popup className="ba-zone-popup">
      <Autocomplete.Empty className="ba-zone-empty">No match yet — check the spelling or browse the list.</Autocomplete.Empty>
      <Autocomplete.List className="ba-zone-list">{(zone:ZoneOption)=><Autocomplete.Item key={zone.id} value={zone.name}><span>{zone.name}</span><small>{zone.continent}{zone.availability!=='current'?' · out of era':''}</small></Autocomplete.Item>}</Autocomplete.List>
     </Autocomplete.Popup>
    </Autocomplete.Positioner>
   </Autocomplete.Portal>
  </Autocomplete.Root>
 </div>;
}
export default function TravelPlanner({onOpenZone}:{currentZone?:string;onOpenZone:(zone:string)=>void}){
 const zones=useMemo(()=>allZones(),[]);
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [options,setOptions]=useState<TravelOptions>(defaultTravelOptions);
 const fromId=travelZoneId(from),toId=travelZoneId(to);
 const known=(!from.trim()||fromId)&&(!to.trim()||toId);
 const current=(!fromId||isCurrentZone(fromId))&&(!toId||isCurrentZone(toId));
 const plan:TravelPlan|null=useMemo(()=>from&&to&&known&&current?planTravel(from,to,options):null,[from,to,options,known,current]);
 const noRoute=Boolean(from&&to&&known&&current&&plan===null);
 function flip(){setFrom(to);setTo(from);}
 return <section className="travel-planner" aria-label="Travel across Norrath">
  <header className="travel-head"><Footprints aria-hidden="true"/><div><h3>Travel across Norrath</h3><p>Pick where you are and where you want to be. BA plans the crossing zone by zone.</p></div></header>
  <div className="travel-pickers">
   <div className="travel-field"><label htmlFor="travel-from">From (you are here)</label><ZonePicker id="travel-from" label="From zone" value={from} onChange={setFrom} zones={zones}/></div>
   <button type="button" className="travel-flip" onClick={flip} disabled={!from&&!to} aria-label="Swap from and to" title="Swap"><ArrowLeftRight aria-hidden="true"/></button>
   <div className="travel-field"><label htmlFor="travel-to">To (destination)</label><ZonePicker id="travel-to" label="To zone" value={to} onChange={setTo} zones={zones}/></div>
  </div>
  <fieldset className="travel-options"><legend>What your group can use</legend>
   <label><input type="checkbox" checked={options.translocator} onChange={e=>setOptions(o=>({...o,translocator:e.target.checked}))}/> Dock translocators</label>
   <label><input type="checkbox" checked={options.boat} onChange={e=>setOptions(o=>({...o,boat:e.target.checked}))}/> Boats</label>
   <label><input type="checkbox" checked={options.port} onChange={e=>setOptions(o=>({...o,port:e.target.checked}))}/> Druid or wizard port</label>
   <label><input type="checkbox" checked={options.plane} onChange={e=>setOptions(o=>({...o,plane:e.target.checked}))}/> Planar portals <small>(end-game)</small></label>
  </fieldset>
  {!known&&(from.trim()||to.trim())&&<p className="travel-note" role="status">Type a Norrath zone that BA knows, or browse the list. Custom camp names work in Build Advisor, not on the world route map.</p>}
  {known&&!current&&(from.trim()&&to.trim())&&<p className="travel-note" role="status">Kunark and Velious are out of era for EQL. No route can be planned to those zones yet.</p>}
  {noRoute&&<p className="travel-note" role="status" data-testid="travel-noroute">No route with these options. Unticked boats, translocators or ports? Try enabling more, or pick a zone on a connected continent.</p>}
  {plan&&plan.steps.length>0&&<ol className="travel-steps" aria-label="Route steps">
   {plan.steps.map((step,i)=>{const Icon=modeIcons[step.mode];return <li key={i} className={'travel-step travel-mode-'+step.mode}>
    <span className="travel-step-icon" aria-hidden="true"><Icon/></span>
    <div className="travel-step-body">
     <strong>{travelNode(step.from).name} → {travelNode(step.to).name} <small>{travelModeLabels[step.mode]}</small></strong>
     {step.detail&&<p>{step.detail}</p>}
     {step.npc&&<p className="travel-fare"><small>Hail {step.npc}. {travelFare}</small></p>}
     {step.spell&&<p><small>{step.spell}{step.caster?` · ${step.caster} from level ${step.spellLevel}`:''}. You arrive inside {travelNode(step.to).name}.</small></p>}
     {step.warning&&<p className="travel-warning"><CircleAlert aria-hidden="true"/> {step.warning}</p>}
     <button type="button" className="ba-zone-guide" onClick={()=>onOpenZone(travelNode(step.to).name)}>Open map of {travelNode(step.to).name}</button>
    </div>
    <output>{step.minutes} min</output>
   </li>;})}
   <p className="travel-summary" role="status">{plan.minutes} minutes · {plan.steps.length} step{plan.steps.length===1?'':'s'} {travelNode(plan.from).continent===travelNode(plan.to).continent?`inside ${travelNode(plan.to).continent}`:`from ${travelNode(plan.from).continent} to ${travelNode(plan.to).continent}`}. {travelBoatWait}</p>
  </ol>}
  {plan&&plan.steps.length===0&&<p className="travel-summary" role="status">You are already in {travelNode(plan.to).name}.</p>}
 </section>;
}
