---
name: Growth OS
description: A bright appointment-business workspace with warm white canvas, mint support, navy hierarchy, and deep-green actions.
colors:
  mineral: '#f8fbf9'
  paper: '#ffffff'
  ink: '#122238'
  ink-2: '#125a51'
  ochre: '#a35b13'
  clay: '#a22525'
  line: '#dce3e5'
  text: '#172a42'
  canvas: '#fffdfb'
  mint-backdrop: '#e9f7f1'
  mint-active: '#eaf7f2'
  mint-well: '#e1f8ef'
  muted: '#536b88'
  focus: '#0b8a69'
  auth-navy: '#142033'
  auth-slate: '#536174'
  auth-canvas: '#fffefd'
  auth-action: '#145a50'
  auth-field-fill: '#f0f7ff'
typography:
  display:
    fontFamily: 'Manrope, sans-serif'
    fontSize: 'clamp(42px, 4.1vw, 62px)'
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: '-0.04em'
  title:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '22px'
    fontWeight: 800
    lineHeight: 1.24
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '13px'
    fontWeight: 800
    lineHeight: 1.3
  numeric:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '26px'
    fontWeight: 800
    lineHeight: 1.2
  auth-display:
    fontFamily: 'Manrope, sans-serif'
    fontSize: 'clamp(3.4rem, 4.78vw, 5rem)'
    fontWeight: 800
    lineHeight: 1.045
    letterSpacing: '-0.04em'
  auth-body:
    fontFamily: 'Manrope, sans-serif'
    fontSize: 'clamp(1.13rem, 1.47vw, 1.54rem)'
    fontWeight: 500
    lineHeight: 1.42
rounded:
  field: '6px'
  tab: '7px'
  status: '8px'
  nav-item: '11px'
  empty: '12px'
  metric: '13px'
  panel: '15px'
  auth-card: '17px'
  pill: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '14px'
  xl: '18px'
  2xl: '24px'
  3xl: '32px'
components:
  button-primary:
    backgroundColor: 'linear-gradient(110deg, #0e4e49, #135b54)'
    textColor: '#ffffff'
    typography: '{typography.label}'
    rounded: '{rounded.field}'
    padding: '10px 19px'
  button-secondary:
    backgroundColor: '{colors.paper}'
    textColor: '#0e504c'
    typography: '{typography.label}'
    rounded: '{rounded.field}'
    padding: '10px 19px'
  button-danger:
    backgroundColor: '#fff0ef'
    textColor: '{colors.clay}'
    typography: '{typography.label}'
    rounded: '{rounded.field}'
    padding: '10px 19px'
  text-field:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.field}'
    padding: '11px 14px'
  panel:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.text}'
    rounded: '{rounded.panel}'
    padding: '24px 27px'
  nav-active:
    backgroundColor: '{colors.mint-active}'
    textColor: '#0e524b'
    typography: '{typography.label}'
    rounded: '{rounded.nav-item}'
    padding: '9px 17px'
  icon-well:
    backgroundColor: '{colors.mint-well}'
    textColor: '#0b6860'
    rounded: '{rounded.panel}'
    size: '60px'
  state-pill:
    backgroundColor: '#e5f9f1'
    textColor: '#155e52'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '8px 12px'
  auth-submit:
    backgroundColor: '{colors.auth-action}'
    textColor: '#ffffff'
    rounded: '{rounded.tab}'
    height: '62px'
  auth-field:
    backgroundColor: '{colors.auth-field-fill}'
    textColor: '{colors.auth-navy}'
    rounded: '{rounded.field}'
    height: '54px'
  auth-card:
    backgroundColor: 'rgb(255 255 255 / 95%)'
    textColor: '{colors.auth-navy}'
    rounded: '{rounded.auth-card}'
    padding: '42px 41px 37px'
---

# Design System: Growth OS

## Overview

**Creative North Star: "The Calm Front Desk"**

The authenticated Growth OS workspace follows the supplied product references. It uses a warm white canvas, quiet mint organic shapes, navy hierarchy, deep-green actions, white rounded panels, and small icon-led cues. The result is an Operate interface for scanning customer records, preparing reviewed follow-ups, handling reviews, reading stored results, and managing business settings.

The workspace should feel composed rather than sparse. Each page starts with one large title and a short description, then moves directly into the primary task. Tables, split work areas, metric cards, and settings groups follow the fixed reference compositions. Soft shadows separate work areas without making every row float.

**Key Characteristics:**

- Warm white canvas with restrained mint curves, dots, and leaf detail at the edges.
- Navy headings and copy with deep-green primary actions.
- White panels with 15px corners and low-contrast neutral shadows.
- Pale icon wells, status pills, and line icons that support scanning.
- A white navigation capsule that keeps all six destinations visible.

### Public auth continuity

The public registration, sign-in, and password-reset views retain the user-supplied September 2026 reference. Their warm white canvas, Manrope type, navy and green headline, mint underline, circular icon wells, curved background, foliage image, and soft-shadowed form card remain accurate. The `1.2k+` and `94%` figures are illustrative and carry visible Demo badges. Replace them with supported results before public marketing use.

**The Auth Boundary Rule.** The auth page keeps its larger marketing headline, 542px form card, and page-specific decorative composition. Do not copy that exact layout into signed-in work screens.

## Colors

The workspace palette uses warm white and pale mint for atmosphere, navy for hierarchy, and deep green for action. Amber and red remain semantic.

### Primary

- **Front Desk Navy** (`ink`): Screen titles, panel headings, strong record names, and primary reading hierarchy.
- **Action Green** (`ink-2`): Active navigation, links, recorded-value emphasis, and primary action direction.

### Secondary

- **Focus Green** (`focus`): Keyboard focus rings and selected control emphasis.
- **Warm Attention** (`ochre`): Pending status and consent-aware attention states.
- **Guardrail Red** (`clay`): Errors, destructive actions, and danger sections.

### Neutral

- **Warm Canvas** (`canvas`): The signed-in page background beneath all work areas.
- **Clean Paper** (`paper`): Navigation, panels, forms, cards, and table rows.
- **Cool Rule** (`line`): Dividers, panel borders, and low-priority control borders.
- **Reading Navy** (`text`): Default workspace copy.
- **Muted Slate** (`muted`): Descriptions, metadata, timestamps, and secondary labels.

### Mint support

- **Organic Mint** (`mint-backdrop`): Large low-contrast backdrop shapes near page edges.
- **Active Mint** (`mint-active`): Selected navigation and quiet interactive feedback.
- **Icon Mint** (`mint-well`): Default icon wells and friendly status cues.

**The Green Action Rule.** Use deep green for the next useful action, active location, or positive stored value. Do not spread it across neutral reading content.

**The Semantic Status Rule.** Keep amber, red, blue, violet, and green status colors attached to text labels. Color never replaces the state name.

### Public auth palette

The auth page keeps warm white (`auth-canvas`), navy (`auth-navy`), and slate (`auth-slate`). Its headline uses a scoped green text gradient, the primary action uses `auth-action`, and email and password fields use `auth-field-fill`.

## Typography

**Display Font:** Manrope with a sans-serif fallback

**Body Font:** Manrope with a sans-serif fallback

**Character:** Manrope carries both the signed-in workspace and public auth flow. Heavy headings give each task a clear entry point. Regular body copy, compact labels, and tabular numbers keep dense operational content legible. The app bundles Manrope weights 400, 500, 600, 700, and 800 locally through Fontsource.

### Hierarchy

- **Display** (800, `clamp(42px, 4.1vw, 62px)`, 1.12): One signed-in screen title per page.
- **Title** (800, `22px`, 1.24): Panel headings and primary work-area labels.
- **Body** (400, `15px`, 1.45): Forms, records, descriptions, and response copy.
- **Label** (800, `13px`, about 1.3): Field labels and compact control text.
- **Numeric** (800, `26px` or responsive display size): Metric cards and recorded values.
- **Metadata** (600 or 700, `11px` to `13px`): Dates, sources, counts, and compact table labels.

**The Single Page Title Rule.** Each work screen gets one large title. Use panel titles, labels, and metadata for every level beneath it.

**The Dense Copy Rule.** Keep descriptions short and factual. The visual system creates room for work, not promotional copy inside the app.

The public auth headline uses `auth-display`; supporting copy uses `auth-body`. Its form heading is 28px at weight 800, while field labels are 17px at weight 700. IBM Plex Sans remains bundled for existing legal and non-workspace pages that have not adopted the reference-led shell.

## Layout

The authenticated shell centers major content at a maximum width of 1436px. Page padding is `14px clamp(24px, 4.75vw, 76px) 72px`. The 86px navigation capsule leads the page, followed by a title row, optional date badge, controls, and the main work area.

Customers uses a full-width table panel on desktop and a stacked two-column record layout on phone. Campaigns uses a composer and campaign list split. Reviews pairs intake with the review ledger. Results places a six-card metric row above a chart and recorded-value split. Settings uses a wide primary form with a narrower stack of account and legal panels.

At 1250px, result metrics change from six columns to three and campaign rows remove one secondary column. At 1000px, navigation becomes a second row, and the campaign, review, results, and settings splits become one column. At 700px, navigation becomes three columns by two rows, metrics become two columns, controls stack, customer rows reflow without a desktop minimum width, and campaign rows reduce to the facts needed for action.

On phone, Reviews places the ledger before add and import tools. Results keeps the chart horizontally scrollable inside its panel. Every page retains the same tasks and labeled actions without page-level horizontal overflow.

**The Reference Composition Rule.** Keep each page's implemented grid and content order. The supplied screenshots are the composition authority for Customers, Campaigns, Reviews, Results, and Settings.

**The Phone Task Order Rule.** When a split collapses, put the current record or result before secondary creation and import tools.

On public auth screens, the desktop layout pairs the message and benefits with a 542px form card. The columns stack at 1350px. At 760px, the reading order is headline, form, then benefits and illustrative metrics; the foliage image drops away.

## Elevation & Depth

The workspace uses soft neutral shadows to separate bounded work areas from the warm canvas. Navigation uses a broad low-opacity shadow. Standard panels use a slightly deeper neutral shadow. Metric and summary cards use a smaller version, while buttons add lift only on hover. Dialogs use a stronger left-facing shadow because they sit above a darkened backdrop.

Mint curves, dot fields, a fixed leaf plate, and pale icon wells add depth behind or inside content. They stay away from form copy and table values. The primary button has a controlled green gradient; result chart bars use a pale mint gradient. These are the only routine signed-in gradients.

**The Soft Separation Rule.** Use low-opacity shadows on navigation, bounded panels, metrics, and dialogs. Table rows and text groups rely on borders and spacing.

**The Quiet Backdrop Rule.** Organic shapes and the leaf plate remain peripheral. Do not place detailed imagery under controls or records.

The public auth card keeps its scoped `0 24px 58px rgb(39 43 45 / 11%)` shadow. Its radial fields and curved background forms remain page-specific. Reduced-motion mode cuts the auth entrance animation to 0.01ms and removes workspace lift transitions.

## Shapes

The signed-in system uses a controlled rounded scale. Fields, buttons, and Sign out use 6px corners. Tabs and small callouts use 7px to 8px. Empty states and compact cards use 12px to 13px. Navigation, panels, review cards, and icon wells use 15px. Status and lifecycle labels use full pills.

Circles are reserved for customer avatars, review avatars, compact date icons, and small overflow controls. The large backdrop shapes are irregular organic curves rather than interface containers.

**The Rounded Hierarchy Rule.** Match radius to component scale. Do not apply one large radius to every object.

**The Pill Meaning Rule.** Use full pills for lifecycle, eligibility, campaign state, review state, and small identity badges. Do not turn ordinary buttons or panels into capsules.

The public auth form card keeps its 17px radius, 6px fields, 7px action, circular benefit icons, and rounded kicker.

## Components

### Buttons

- **Shape:** 6px corners, a 47px minimum height, and `10px 19px` padding.
- **Primary:** A short deep-green gradient, white text, a dark green border, and a small resting shadow.
- **Secondary / Quiet:** White fill with a muted mint border and deep-green text.
- **Danger:** Pale red fill, red border, and red text.
- **Hover / Active:** Hover lifts by 2px and strengthens the shadow. Active returns to the baseline and scales to 0.99. Reduced-motion mode removes the lift.
- **Focus / Disabled:** Keyboard focus uses a 3px green outline with a 3px offset. Disabled controls reduce opacity, remove the shadow, and use a not-allowed cursor.

### Chips

- **Lifecycle / Eligibility:** Full pills with explicit labels. Eligibility adds a colored dot but retains the text state.
- **Campaign / Review State:** Full pills use muted semantic fills for draft, ready, completed, unanswered, and posted states.
- **Identity:** The Demo workspace badge is a compact rounded rectangle inside the navigation identity.

### Cards / Containers

- **Navigation:** White translucent capsule, 15px corners, subtle border, and a low neutral shadow.
- **Panel:** White fill, 15px corners, one-pixel cool border, and a low neutral shadow.
- **Metric:** White fill, 13px corners, icon well, label, and bold tabular value.
- **Table:** A rounded outer panel with a pale header band. Data rows stay flat and use dividers or a very light hover fill.
- **Organic Backdrop:** One mint shape, one outlined curve, a small dot field, and the leaf plate at the page edge.

### Inputs / Fields

- **Style:** White fill, 6px corners, one-pixel cool border, 47px minimum height, and `11px 14px` padding.
- **Focus:** Border changes to green and a translucent 3px green ring appears outside it.
- **Text areas:** Keep the same field treatment, a 104px minimum height, and vertical resizing.
- **Placeholder:** Muted slate remains legible but secondary to entered text.

### Navigation

- **Desktop:** Identity, six icon-and-text destinations, and Sign out share one 86px capsule.
- **Active:** Pale mint fill with deep-green text and weight 800.
- **Hover:** Inactive destinations receive a quieter mint fill and a 1px lift.
- **Compact:** At 1000px, the six destinations move to a full second row. At 700px, they form a three-column by two-row grid.

### Icon wells

Default wells are 60px squares with 15px corners and pale mint fill. Blue and red variants belong to clearly different subject groups. Date badges use a 38px circular well, while avatars remain 48px to 50px circles. Lucide icons use a 2px stroke and remain supportive, never unlabeled primary actions.

### Tables and work lists

Desktop customer and campaign lists use explicit column headers. Customer records become compact stacked rows on phone. Campaign cards keep name, state, date, key count, and overflow action. Review records keep original content and manual response work in one card. Results distinguish summary metrics, the activity chart, and recorded booking value.

**The Visible State Rule.** Selected, active, pending, success, warning, and destructive states need text plus a visible fill, border, or control change.

**The Reviewed Action Rule.** Primary actions identify the next user-reviewed step. Secondary and quiet actions hold exports, alternate paths, reopen actions, and manual status marks.

## Dark mode

The alternate theme keeps the same mint, navy, and green identity at lower luminance. Its canvas is `#0c151b`, raised panels are `#17252e`, primary text is `#e0ebed`, muted text is `#b1c5ce`, and the primary action remains green. Warning, danger, lifecycle, and campaign states retain distinct labeled treatments. Public auth, all six workspace screens, dialogs, and legal drafts use the same theme choice.

A fixed control on the right switches themes. The choice is saved locally and applied before the page renders; without a saved choice, the operating system preference is used. Where supported, a circular view transition reveals the new theme from the control. Reduced-motion users get an immediate state change. The control stays keyboard accessible and shows its current pressed state.

## Do's and Don'ts

### Do:

- **Do** keep the light palette and its darker mint, navy, and green counterpart consistent across every signed-in page.
- **Do** preserve the reference-led page compositions and the complete six-destination navigation.
- **Do** use white rounded panels and soft shadows for bounded work areas, not every record row.
- **Do** pair status color with a written state and keep product claims tied to stored data.
- **Do** preserve the 47px workspace control height, visible focus treatment, and reduced-motion behavior.
- **Do** keep the public auth composition and its Demo labels scoped to the auth flow.

### Don't:

- **Don't** restore the old dark square register treatment inside the authenticated workspace.
- **Don't** place organic imagery, dots, or mint curves under dense text, fields, charts, or table values.
- **Don't** hide phone destinations behind a menu when the two-row grid fits.
- **Don't** turn every row into a floating card or every control into a pill.
- **Don't** use red, amber, blue, or violet without a named state or subject role.
- **Don't** present the auth page's illustrative metrics as verified outcomes.
