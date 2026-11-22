'use client';

import { Check, Laptop, LockKeyhole, Smartphone } from 'lucide-react';

const reports = ['Logs', 'Inventory', 'Spellbook', 'Factions', 'Achievements', 'AA'];

export default function CharacterSyncReadiness() {
  return (
    <section className="sync-readiness" aria-labelledby="sync-readiness-title">
      <header>
        <div>
          <small>CHARACTER SYNC · DESIGNED, NOT YET CONNECTED</small>
          <h3 id="sync-readiness-title">Move reports from the game PC to this device</h3>
          <p>File import works now. A later desktop helper can offer selected EQL reports to your phone on your own network, with a review step before anything is saved.</p>
        </div>
        <span><LockKeyhole aria-hidden="true" /> Local first</span>
      </header>
      <div className="sync-flow" aria-label="Planned Character Sync flow">
        <article><Laptop aria-hidden="true" /><b>1. Choose on PC</b><span>Select only the reports you want to share.</span></article>
        <i aria-hidden="true">→</i>
        <article><Smartphone aria-hidden="true" /><b>2. Review on phone</b><span>See the character, date, file type, and provenance.</span></article>
        <i aria-hidden="true">→</i>
        <article><Check aria-hidden="true" /><b>3. Save locally</b><span>Merge approved data into that device’s profile.</span></article>
      </div>
      <div className="sync-kinds">{reports.map((report) => <span key={report}>{report}</span>)}</div>
      <footer>No account, cloud upload, or outside AI service is required by this design. Direct PC-to-phone pairing remains optional future work.</footer>
    </section>
  );
}
