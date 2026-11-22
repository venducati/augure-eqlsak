# Build Advisor visual update — 1.2.1

The Build Advisor now shares the EQLSaK site's enhanced 3840 × 2160 fantasy mural. Deep blue panels, warm gold borders, serif headings, and consistent class-icon medallions carry the site's visual style into the standalone advisor and Windows app. Text remains on shaded panels; icons accompany text labels.

The standalone HTML embeds the artwork. The Windows installer includes a local copy. Neither version downloads artwork or needs an internet connection to display it. The recommendation rules, scoring, saved builds, source-update controls, and Combat Meter behavior are unchanged by this visual update.

## Use the updated version

- Windows x64: install EQLSaK-Build-Advisor-1.2.1-Setup.exe. This release remains unsigned.
- Standalone: open EQLSaK-Offline-Advisor.html in a browser. Move it to another computer as a single file.
- Full companion: the updated project contains the shared advisor interface and retains maps, loot, factions, logs, and the command center. Updating these files does not publish the website.

## Adjust the appearance

- public/eqlsak-races-mural-enhanced.webp is the exact mural already used by the companion site.
- app/advisor-fantasy.css defines the advisor's colors, panels, typography, responsive layout, and icon medallions. It extends app/build-advisor.css.
- components/AdvisorIcon.tsx maps class and feature names to the existing Lucide SVG icon library. Icons are decorative; visible text provides the meaning.
- scripts/advisor-theme.mjs defines the shared standalone and desktop shell. Its --ba-art variable supplies the bundled background image.

To change the mural, replace the source image or update muralFile in scripts/advisor-theme.mjs and the fallback image path in app/advisor-fantasy.css together. Rebuild the standalone HTML, prepare the desktop assets, and rebuild the Windows installer using DESKTOP_ADVISOR.md. For the full site, run its normal production build.

To extend recommendation knowledge rather than appearance, use BUILD_ADVISOR.md and the editable rule and evidence files in data/.

## Verification

The standalone bundle, complete companion production build, TypeScript check, configured lint check, packaged Windows startup check, and installer archive integrity check passed. The embedded HTML mural and desktop mural match the site's source image. The installer is unsigned; a clean-machine installation and visual browser testing were not performed.

The full site's Tailwind scan is restricted to application source folders in app/globals.css. This prevents generated installers, exports, and desktop bundles from entering the stylesheet scan. If interface source moves to another folder, register that folder there using Tailwind's [source detection configuration](https://tailwindcss.com/docs/detecting-classes-in-source-files).
