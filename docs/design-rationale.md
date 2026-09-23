# Growth OS interface direction

## Design read

Growth OS is a dense operating workspace for time-poor appointment-business owners. It needs a trust-first, editorial register language rather than a marketing-page aesthetic. The selected foundation is custom Tailwind CSS with accessible headless behavior, IBM Plex Sans, restrained motion, and no decorative design system.

The design-taste skill says its landing-page rules do not govern dense product UI. The applicable constraints still matter. The product uses one palette, one radius system, real loading and error states, explicit mobile fallbacks, high contrast, reduced motion, and no generic card grid.

The planning dials are:

- `DESIGN_VARIANCE: 4`. Screens need a stable working rhythm with limited asymmetry.
- `MOTION_INTENSITY: 2`. Motion communicates press, save, dialog, and state changes only.
- `VISUAL_DENSITY: 8`. Owners need compact facts and actions without card clutter.

## Direction 1: operations register with detail inspector

This direction treats the product as a working register. A narrow ink navigation rail frames a broad mineral-gray list. Today presents one ranked queue with aligned fields for reason, service, source, elapsed time, consent, quoted value, and next action. Selecting a row opens a fixed detail inspector with customer context and the available command.

Campaign composition uses a two-pane work area. The left pane holds audience rules and message editing. The right pane shows the selected recipient's exact message, eligibility facts, and exclusion reasons. Results uses a measure table, a plain time series, and an attribution table. Recent activity is a chronological ledger.

Strengths:

- The queue answers who, why, next action, and outcome in one scan.
- The inspector preserves context while the owner moves through records.
- Lists and tables match the product's dense operational data.
- The layout scales to more facts without inventing more cards.

Risks:

- A fixed inspector can compress the main register on small laptops.
- Dense columns need careful priority and truncation rules.
- Mobile must become a real record workflow, not a squeezed desktop table.

## Direction 2: guided workbench with focused tasks

This direction treats Today as a sequence of focused work blocks. One large priority item leads the screen. The owner completes or skips it, then advances to the next item. Secondary queues group follow-ups, bookings, and reviews into separate sections. Campaign composition becomes a four-part flow for audience, message, recipient review, and activation.

Strengths:

- The first action is obvious on a phone.
- Each view carries less information and can feel calmer.
- Guided stages can reduce errors for first-time users.

Risks:

- The owner loses the ability to compare several enquiries before choosing.
- A staged campaign flow hides downstream exclusion consequences until later.
- Backtracking creates more navigation and more partial-state rules.
- The stage structure risks becoming a wizard that does not match real owners who move between audience and copy.

## Selected direction

Direction 1 is selected. The product brief asks owners to understand why every customer appears and to review recipients before contact. The register keeps the comparison set and the reasons visible. The detail inspector concentrates action without replacing overview.

Direction 2 contributes two ideas. On phones, the selected record becomes a full-height dialog with focus restoration. Empty states also provide one clear next action rather than showing an empty table shell.

The selected direction avoids a hidden wizard. Campaign sections remain directly reachable and show invalidation when an upstream edit makes the recipient review stale.

## Visual system

### Color

The page uses one theme with a warm mineral-gray base and ink navigation. Deep blue-green is the interactive accent. Ochre marks attention and pending work. Clay is reserved for destructive or blocked states. The implementation must choose final token values through contrast testing.

Pure white, pure black, gradients, neon, purple, radial effects, and drop shadows are excluded. Color never carries state alone.

### Typography

IBM Plex Sans is the primary family. Tabular numerals align money, ages, and counts. Headings rely on weight, spacing, and placement rather than oversized type. Labels use sentence case. The interface uses the same product term everywhere.

### Shape and elevation

Controls use 2px to 4px radii. Dialogs may use 6px when the larger boundary needs separation. Dividers and spacing express hierarchy. Shadows do not. Pills are limited to semantic filters or compact statuses that have text.

### Icons

Text labels are the default. A small approved icon family may support universal actions such as search, close, and disclosure. The implementation must not use Lucide, emojis, sparkle icons, animated arrows, or an icon on every control.

## Screen composition

| Screen                   | Primary composition                                         | Mobile composition                                            |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Sign in and registration | Narrow form with plain product context                      | Same form at full width                                       |
| Onboarding               | One-page grouped form with persistent progress text         | Single column with a sticky submit area                       |
| Today                    | Priority register, detail inspector, recent activity ledger | Labeled records; selection opens a full-height dialog         |
| Customers                | Filter bar, customer register, saved view state             | Filters in a modal sheet; labeled records                     |
| Customer record          | Fact header and chronological sections                      | Stacked facts with section jump links                         |
| CSV import               | Mapping table, row preview, duplicate decision list         | Each row is a labeled review record                           |
| Campaign composer        | Audience and template left; live recipient detail right     | Sections stack; a fixed review summary opens recipient detail |
| Recipient review         | Dense inclusion table with visible reason codes             | One recipient per record with keep or remove action           |
| Campaign details         | Outcome register and audit history                          | Labeled outcome records                                       |
| Bookings                 | Date-grouped register and edit dialog                       | Date-grouped records and full-height edit dialog              |
| Results                  | Measure table, time series, attribution table               | Horizontal-safe measure list and stacked attribution records  |
| Reviews                  | Review text and response workspace                          | Stacked review and response form                              |
| Settings                 | Plain sections with explicit save boundaries                | Single column with persistent save state                      |
| Export and deletion      | Separate high-risk section with confirmations               | Same content; no hidden controls                              |
| Legal pages              | Readable document column                                    | Readable document column                                      |

No essential action disappears below 768px. Tables become labeled record lists. The order is reason, identity, next action, then supporting facts.

## Interaction behavior

Buttons keep their label during submission and add adjacent textual progress. Press feedback uses a small scale or one-pixel translation and disappears under reduced motion. Saves show `Saving`, `Saved`, or a recoverable error next to the edited section. Offline state is explicit and never presented as saved.

Dialogs trap focus, close with Escape when safe, restore focus to the trigger, and require an explicit choice before destructive work. Validation errors stay next to the field. Forms retain valid and invalid input after a server error. Conflict handling preserves the local campaign draft and offers compare, copy, or reload actions.

Loading states use the final layout with plain reserved rows and text such as `Loading customers`. Skeleton shimmer is excluded by the brief. Empty states name why the view is empty and provide the next valid action. Errors state what failed, what remains saved, and what the owner can do.

## Accessibility

- Every action has a visible label or an accessible name.
- Focus order follows reading order.
- Focus indicators meet contrast requirements and remain visible on all surfaces.
- Body text and control labels meet WCAG 2.2 AA contrast. Large text meets its applicable threshold.
- Status uses text in addition to color.
- Tables use real headers on desktop. Mobile records preserve field labels.
- Dialogs announce their name and purpose.
- Errors connect to fields and an error summary.
- Reduced-motion preference removes transforms and animated progress.
- Touch targets are at least 44 by 44 CSS pixels when controls do not have surrounding spacing.
- Zoom to 200 percent and text spacing overrides do not remove content or actions.

## Performance behavior

Server Components render static layouts where useful. Client components own only interactive leaves. Lists use cursor pagination and avoid rendering an unbounded workspace. The application reserves dimensions for charts, dialogs, and asynchronous regions to prevent layout shift.

The performance gate measures authenticated Today, Customers, Campaign, and Results views with seeded data. It records the machine, browser, build, data volume, network profile, and command. Targets are Lighthouse performance at least 90, accessibility at least 95, largest contentful paint below 2.5 seconds, interaction to next paint below 200 milliseconds, cumulative layout shift below 0.1, no console errors, and no failed requests during the tested flow.

## Content rules

Interface copy uses recorded facts. It says `Marked as sent`, not `Delivered`, until a provider confirms delivery. It keeps `Quoted value`, `Recorded booking value`, and `Collected revenue` separate. The first release does not display collected revenue.

The interface does not call rules artificial intelligence. It shows stable reasons such as `Follow-up overdue`, `Consent withdrawn`, and `Already booked`. Legal text remains visibly marked for legal review until approved.

## Design verification

Phase 7 inspected the primary authenticated screens at phone, tablet, laptop, and wide desktop sizes. The product uses one locked light theme with ink navigation because the brief does not require dark mode. Axe scans, keyboard dialog checks, responsive overflow assertions, reduced-motion checks, and browser screenshots now guard the implemented behavior. Screen-reader testing with representative owners remains part of pre-launch research.

## Complete-product refinement

The final desktop and phone review preserved the Working Register rather than introducing a new visual language. It replaced Today’s transient zero-state with explicit loading copy, raised compact booking actions to the 44px touch floor, rendered appointments in the workspace timezone, and turned browser network failures into recoverable connection guidance. The motion review kept the existing short button press and dialog entrance because the daily navigation and registers are high-frequency controls that should remain immediate.
