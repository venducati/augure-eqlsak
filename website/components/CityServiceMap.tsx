'use client';

import { ArrowLeft, MapPin } from 'lucide-react';

type ServiceRecord = { id: string; name: string; summary: string; details?: string[]; zone?: string };

export default function CityServiceMap({ service, onBack, onOpenRecord }: { service: ServiceRecord; onBack: () => void; onOpenRecord: () => void }) {
  const location = service.details?.find((detail) => detail.startsWith('Known location:'))?.replace('Known location:', '').trim() || 'Exact district not yet recorded';
  return <section className="cityservice3d" aria-label={`${service.name} city map view`}>
    <button className="citymapback" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> All city services</button>
    <header><small>CITY SERVICE REFERENCE · LOCATION NOT SURVEYED</small><h4>{service.zone}</h4><p><b>{service.name}</b> · {location}</p></header>
    <div className="cityterrain">
      <svg viewBox="0 0 100 78" role="img" aria-label="Illustrative city schematic only; no surveyed terrain, route, or service position is shown">
        <defs><linearGradient id={`city-ground-${service.id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#173d61"/><stop offset=".55" stopColor="#343025"/><stop offset="1" stopColor="#6b2c1d"/></linearGradient></defs>
        <path className="citybase" d="M4 15 29 5 62 8 94 24 89 63 57 73 18 66 6 44Z" fill={`url(#city-ground-${service.id})`}/>
        <path className="contour c1" d="M10 25 Q26 10 49 15T88 29 Q77 46 55 43T14 50Z"/>
        <path className="contour c2" d="M18 31 Q33 20 51 23T79 32 Q68 41 51 38T23 45Z"/>
        <path className="contour c3" d="M29 33 Q40 27 51 29T68 34 Q59 38 49 35T34 40Z"/>
        <path className="cityroad" d="M8 57 C25 50 34 44 48 35 S72 23 91 25"/>
        <path className="cityroad" d="M22 66 C30 53 41 45 48 35 S55 20 63 9"/>
        <path className="citywall" d="M14 22 34 13 65 16 84 29 80 57 57 66 27 60 14 45Z"/>
      </svg>
      <div className="terrainkey"><span>Illustration only · Exact position unknown</span></div>
    </div>
    <div className="citymapfacts"><p><MapPin aria-hidden="true" /><span><small>KNOWN AREA</small><b>{location}</b></span></p><p><span><small>SERVICE</small><b>{service.summary.replace(` · ${service.zone}`, '')}</b></span></p></div>
    <button className="cityrecordbutton" type="button" onClick={onOpenRecord}>Open wares, notes, and provenance</button>
    <footer><b>Exact position unavailable.</b> This schematic does not represent surveyed terrain or travel routes. Use the written district note and its provenance; no service pin is placed without verified coordinates.</footer>
  </section>;
}
