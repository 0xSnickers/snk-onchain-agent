# SNK Onchain · Reference Design System

Generated with ui-ux-pro-max and refined against the user-supplied reference. User reference overrides generic recommendations.

## Direction

A compact, premium cryptocurrency workspace. Blue-gray desktop surround, a contained rounded near-black app, persistent slim navigation, restrained glass highlights and electric-blue focus. Pages use a vertical bento grid, never horizontal landing-page scrolling.

## Tokens

- Background #090A10; card #11121B; upper surface #171923; border #292B38.
- Foreground #F1F2F7; muted #A0A4B6; primary #45A6FF; primary foreground #06111C.
- Success #71D5B1; negative #F08C8B. Status is conveyed with text as well as color.
- System sans/Inter-style type, 11–13px detail, 18–20px card headings, 26px page headings, 38px portfolio total. Tabular numerals, full contract addresses.
- Card radii 14–20px, outer app radius 24px. Grid gaps 12–24px. 1px quiet borders and minimal shadows.

## Interaction

150–200ms color/border transitions, no hover scale or layout shift. Lucide icons only. Visible keyboard focus, associated input labels, accessible icon-button names. Preserve language/theme controls. Respect reduced motion. Dark surfaces stay consistent across three accent themes; v2 appearance defaults to blue.

## Data integrity

All assets, balances and activity counts come from live API responses. No fake assets, returns, charts, profiles or KOLs. Missing history gets an explicit empty state; the snapshot indicator is not a price trend. Wallet scope is checked before combining dashboard activity with an asset snapshot.

## Responsive validation

375 / 768 / 1024 / 1440px. Mobile uses scrollable navigation chips and stacked bento cards. Only data tables/navigation may scroll horizontally; the document must not overflow. Temporary browser viewport overrides are reset after QA.

Page guidance: pages/dashboard.md.
