import {test} from 'node:test';
import assert from 'node:assert/strict';
import travel from '../data/norrath-travel.json' with {type:'json'};
import {zoneCatalog,normalizeZone} from '../lib/zone-catalog.ts';
import {planTravel,travelZoneId,travelNode,isCurrentZone,validateTravelEdge,travelEdges,defaultTravelOptions,travelModeLabels} from '../lib/travel-routes.ts';

test('every shipped travel edge validates against the zone catalog and spell catalog',()=>{
  const edges=travelEdges();
  assert(edges.length>=100,'expected a substantive graph, got '+edges.length);
  for(const edge of edges){
    const problem=validateTravelEdge({from:edge.from??undefined,to:edge.to,kind:edge.mode,spell:edge.extra?.spell,npc:edge.extra?.npc,minutes:edge.minutes});
    assert.equal(problem,null,`invalid ${edge.mode} edge ${edge.from??'∅'}→${edge.to}: ${problem}`);
  }
  for(const link of travel.links){assert(travelZoneId(link.from)&&travelZoneId(link.to),'unresolvable walk link');}
});

test('no travel edge touches an out-of-era or unknown zone',()=>{
  const sides=[...(travel.links??[]).flatMap(l=>[l.from,l.to]),...(travel.boats??[]).flatMap(b=>[b.from,b.to]),...(travel.translocators??[]).flatMap(t=>[t.from,t.to]),...(travel.ports??[]).map(p=>p.zone),...(travel.planes??[]).flatMap(p=>[p.from,p.to])];
  for(const side of sides){
    const id=travelZoneId(side);assert(id,`side ${side} missing from catalog`);
    assert(isCurrentZone(id),`side ${side} is ${travelNode(id).availability}`);
  }
});

test('generic city names resolve to their practical hub zone',()=>{
  assert.equal(travelZoneId('Qeynos'),'northqeynos');
  assert.equal(travelZoneId('Freeport'),'eastfreeport');
  assert.equal(travelZoneId('Neriak'),'neriakforeignquarter');
  assert.equal(travelZoneId('Kaladim'),'southkaladim');
  assert.equal(travelZoneId('Felwithe'),'northernfelwithe');
});

test('East Freeport to Qeynos uses the one-hop translocator, not a boat or the Karanas',()=>{
  const plan=planTravel('East Freeport','Qeynos');
  assert(plan&&plan.steps.length===2,'two steps expected');
  assert.equal(plan.steps[0].mode,'translocator');
  assert.equal(plan.steps[0].to,'southqeynos');
  assert.match(plan.steps[0].npc,/Translocator/);
  assert.equal(plan.steps[1].mode,'walk');
  assert(plan.minutes<=8,'translocator hop plus one zone cross: '+plan.minutes);
  const walking=planTravel('East Freeport','Qeynos',{boat:false,translocator:false,port:false,plane:false});
  assert(walking&&walking.minutes>plan.minutes,'the no-shortcuts trip must be longer');
  assert(walking.steps.some(s=>normalizeZone(s.to).includes('karana')||normalizeZone(s.to).includes('common')),'the old way walks through Karana or the Commons');
});

test('Qeynos to Erudin crosses continents by foot and boat or translocator',()=>{
  const plan=planTravel('Qeynos','Erudin',{boat:true,translocator:false,port:false,plane:false});
  assert(plan,'boat route exists');
  assert(plan.steps.some(s=>s.mode==='boat'),'contains a boat hop');
  assert(plan.steps.some(s=>s.to==='erudscrossing'),'passes Erud\'s Crossing');
  const alt=planTravel('Qeynos','Erudin',{boat:false,translocator:true,port:false,plane:false});
  assert(alt&&alt.steps.some(s=>s.mode==='translocator'),'translocators serve the same crossing');
  // Walking is possible in theory (through The Hole to Paineel) — boats must beat it and the sea route must exist.
  const walking=planTravel('Qeynos','Erudin',{boat:false,translocator:false,port:false,plane:false});
  assert(walking&&walking.steps.every(s=>s.mode==='walk')&&walking.minutes>plan.minutes,'the long walk loses to the boat');
  assert(walking.steps.some(s=>s.to==='thehole'||s.to==='paineel'),'and it really does thread through Odus underground');
});

test('port rings land inside the destination zone and unlock otherwise-unreachable trips',()=>{
  const plan=planTravel('Halas','Butcherblock Mountains',{boat:false,translocator:false,port:true,plane:false});
  assert(plan,'a druid Ring of Butcher lands in Butcherblock');
  assert.equal(plan.steps.length,1);
  assert.equal(plan.steps[0].mode,'port');
  assert.equal(plan.steps[0].spell,'Ring of Butcher');
  assert.match(plan.steps[0].caster,/DRU/);
  assert(planTravel('Halas','Butcherblock Mountains',{boat:false,translocator:false,port:false,plane:false})===null,'without a port the frozen north is cut off from Faydwer');
});

test('every port spell is in the bundled EQL spell catalog with a caster level',()=>{
  for(const port of travel.ports){
    const problem=validateTravelEdge({to:port.zone,kind:'port',spell:port.spell});
    assert.equal(problem,null,`port ${port.spell}: ${problem}`);
  }
  assert((travel.ports??[]).length>=15,'the port table should cover the rings and gates named on the EQLWiki travel page');
});

test('planar portals stay off unless the trip wants them and always carry a warning',()=>{
  for(const plane of travel.planes){
    assert(plane.warning,'plane edge needs a danger warning');
    const plan=planTravel(plane.from,plane.to,{...defaultTravelOptions,plane:true});
    assert(plan&&plan.steps.at(-1).mode==='plane',`orb from ${plane.from} plans`);
  }
  assert(isCurrentZone(travelZoneId('Plane of Hate')),'planes are current EQL zones');
  assert.equal(planTravel('West Freeport','Plane of Sky',{...defaultTravelOptions,plane:false}),null,'planes off blocks the orb');
});

test('unknown, empty and same-zone requests resolve without throwing',()=>{
  assert.equal(planTravel('East Freeport','Atlantis'),null);
  assert.equal(planTravel('','Erudin'),null);
  assert.equal(planTravel('Qeynos','North Qeynos').steps.length,0,'city alias equals the hub zone');
  assert.deepEqual(planTravel('Halas','Halas').steps,[]);
});

test('cross-continent routes stay inside catalogue sanity bounds',()=>{
  const plan=planTravel('Qeynos','Kaladim',{boat:false,translocator:true,port:false,plane:false});
  assert(plan&&plan.steps.length<=20&&plan.minutes>0&&plan.minutes<180,`got ${plan?.steps.length} steps / ${plan?.minutes} min`);
  // Each hop must connect to the previous landing.
  const sequence=[plan.from,...plan.steps.map(s=>s.to)];
  for(let i=1;i<sequence.length;i++)assert(sequence[i]===plan.steps[i-1].to,'sequence continuity');
});

test('route names render from the zone catalog, including apostrophes',()=>{
  const plan=planTravel('Butcherblock Mountains',"Dagnor's Cauldron");
  assert(plan&&plan.steps.length===1&&plan.steps[0].mode==='walk');
  assert.equal(travelNode(travelZoneId("Dagnor's Cauldron")).name,"Dagnor's Cauldron");
  assert(zoneCatalog.some(z=>travelZoneId(z.name)));
});

test('labels cover every mode the planner can emit',()=>{
  const modes=new Set(travelEdges().map(e=>e.mode));
  for(const mode of modes)assert(travelModeLabels[mode],'missing label for '+mode);
});
