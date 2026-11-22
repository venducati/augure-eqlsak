import type { CSSProperties, ReactNode } from 'react';
import PwaBridge from '@/components/PwaBridge';
import './globals.css';
import './search.css';
import './splash-theme.css';
import './tool-recovery.css';
import './spacing.css';
import './command-builder.css';
import './mobile-pwa.css';
import './crafting-guide.css';

// Standalone shell: the hosted edition used Next.js `Metadata`/`Viewport` and
// `next/font` here. Those tags now live in index.html and the Geist variables
// fall back to locally available fonts below, so the site builds and runs with
// no Next.js, no Cloudflare and no external font requests.
const shellFontVars = {
  '--font-geist-sans': 'Arial, Helvetica, sans-serif',
  '--font-geist-mono': '"Lucida Console", Monaco, monospace',
} as const satisfies Record<string, string> as CSSProperties;

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="site-skin antialiased" style={shellFontVars}>
        {children}
        <PwaBridge />
      </div>
  );
}
