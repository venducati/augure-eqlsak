import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Layout from './app/layout';
import Home from './app/page';

// The original site used Next.js App Router metadata/fonts on the layout;
// index.html carries those tags now, and Layout renders <Home /> in place of
// the router's children, keeping the same shell markup.
//
// Companion links from the advisor use `<origin>/zone/<slug>` (the static
// guides). Hosts without rewrite rules still serve index.html for that path;
// translate it back to the `?zone=` parameter the app understands so both
// editions open the same guide. Slugs are display names with hyphens; the
// app matches zones fuzzily, and build:site writes guide names verbatim.
const zonePath = window.location.pathname.match(/^\/zone\/([^/]+)\/?$/);
if (zonePath && !new URL(window.location.href).searchParams.get('zone')) {
  const name = decodeURIComponent(zonePath[1]).replace(/-/g, ' ');
  const url = new URL(window.location.href);
  url.searchParams.set('zone', name);
  url.hash = 'zone-guide';
  window.history.replaceState(null, '', url.href);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Layout>
      <Home />
    </Layout>
  </StrictMode>,
);
