# EQLSaK mobile and offline architecture

EQLSaK uses one responsive web codebase for desktop, Android, iPhone, and iPad. The first mobile release is a Progressive Web App (PWA), not a separate native rewrite.

## What works without a connection

- The application shell and previously loaded tool chunks are cached by the service worker.
- EQL databases used by the field manual, maps, commands, spells, Build Advisor, and measured loot index ship with the application.
- Character profiles, Build Advisor inputs, and imported reports remain local to the browser/device.
- The Build Advisor remains deterministic and API-free.
- Provenance labels remain part of each record: User-Verified EQL, EQL-specific source, or Legacy EQ unverified.

The application may refresh measured sources when online. A failed refresh never removes the bundled offline snapshot.

## Character Sync boundary

Manual file import is the supported transport today. `lib/character-sync.ts` defines a versioned envelope for a later optional desktop helper. It can carry manifests for logs, inventory, spellbook, factions, achievements, and AA reports while preserving provenance.

A future helper should:

1. Ask the player which files to share.
2. Pair directly with a phone on the local network or create a portable encrypted bundle.
3. Show character, server, report type, date, and provenance before import.
4. Merge only after the player confirms.
5. Work without a hosted account or mandatory cloud storage.

## Optional native packaging

The PWA remains the source of truth. If store distribution is useful later, the same built web application can be wrapped with a thin native shell such as Capacitor (Android/iOS) or a Trusted Web Activity (Android). Native packages must not duplicate recommendation or provenance logic.

## Release checks

- Test installability in Chromium and Add to Home Screen on iOS/iPadOS.
- Load every lazy tool once, then verify it opens in airplane mode.
- Verify local profiles survive restart and remain isolated per browser/device.
- Verify the bundled databases and Build Advisor never require a network request.
- Verify safe-area navigation on notched devices and at 320, 375, 768, and 1024 CSS pixels.
