# EQLSaK release readiness

EQLSaK remains a private pre-release until every release-critical check below is green.

## Automated gates

- Production compilation succeeds.
- Type checking and linting succeed without release-blocking errors.
- Required maps, meshes, textures, and artwork are present.
- Search, route selectors, log import, dialogs, and 3D projection safeguards remain wired.
- Branding, privacy, and accuracy disclosures remain visible.
- The coordinate scale regression cannot return unnoticed.

Run `npm run release:check` before every saved version.

## Public-release blockers

- Replace or exclude proxy NPC markers from exact-location guidance.
- Verify release-critical legacy records in EQL or keep them outside authoritative recommendations.
- Validate every supported route end to end in EQL.
- Complete desktop, mobile, keyboard, and reduced-motion browser checks.
- Check external reference availability immediately before launch.
- Complete a final artwork, trademark, data-license, and attribution review.

Passing private-pre-release checks does not certify third-party facts. Provenance remains part of the product, not a temporary disclaimer.
