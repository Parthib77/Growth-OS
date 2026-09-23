---
name: Growth OS
description: A dense, consent-aware operating workspace built from warm mineral surfaces, blue-green structure, and explicit state.
colors:
  mineral: '#e9e6df'
  paper: '#f3f1eb'
  ink: '#153b3b'
  ink-2: '#235050'
  ochre: '#b87932'
  clay: '#a24c3a'
  line: '#c9c5bb'
  text: '#1e2b2b'
typography:
  display:
    fontFamily: 'IBM Plex Sans, sans-serif'
    fontSize: 'clamp(2.5rem, 6vw, 5rem)'
    fontWeight: 700
    lineHeight: 1.03
    letterSpacing: '-0.04em'
  headline:
    fontFamily: 'IBM Plex Sans, sans-serif'
    fontSize: 'clamp(2rem, 4vw, 4rem)'
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: '-0.04em'
  title:
    fontFamily: 'IBM Plex Sans, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: 'IBM Plex Sans, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'IBM Plex Sans, sans-serif'
    fontSize: '0.78rem'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '0.03em'
  numeric:
    fontFamily: 'IBM Plex Sans, sans-serif'
    fontSize: '1.6rem'
    fontWeight: 700
    lineHeight: 1
rounded:
  square: '0'
  control: '2px'
  contained: '0.4rem'
spacing:
  xxs: '0.25rem'
  xs: '0.5rem'
  sm: '0.75rem'
  md: '1rem'
  lg: '1.5rem'
  xl: '2rem'
  2xl: '3rem'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '0.7rem 1rem'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '0.7rem 1rem'
  button-danger:
    backgroundColor: '{colors.clay}'
    textColor: '#fff8f3'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '0.7rem 1rem'
  text-field:
    backgroundColor: '#faf9f5'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: '0.75rem'
  panel:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.text}'
    rounded: '{rounded.square}'
    padding: 'clamp(1.25rem, 4vw, 2.5rem)'
  nav-active:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.square}'
    padding: '0.7rem 0.9rem'
---

# Design System: Growth OS

## Overview

**Creative North Star: "The Working Register"**

Growth OS uses the visual language of a well-kept appointment register: warm mineral-gray work surfaces, blue-green structure, clear rules, and compact records. The system is built for Operate mode. It favors scan speed, task order, and visible state over decorative display.

The interface stays flat and editorial. Strong headings establish hierarchy, horizontal rules organize evidence, and a small set of semantic colors marks focus, warning, success, and destructive action. It does not use shadows, gradients, glass effects, neon accents, floating card grids, or decorative icon sets.

**Key Characteristics:**

- Warm mineral-gray page and paper layers.
- Deep blue-green navigation, headings, links, and primary actions.
- Dense registers and ledgers separated by visible rules.
- Nearly square controls with explicit focus and state treatments.
- A complete two-row phone navigation that keeps every destination visible.

## Colors

The palette pairs warm neutral work surfaces with a dark blue-green structural color. Ochre and clay appear only when they carry meaning.

### Primary

- **Deep Register Ink** (`ink`): Navigation, large headings, primary actions, strong rules, and high-value figures.
- **Working Teal** (`ink-2`): Links, secondary text emphasis, scrollbars, and hover states inside dark navigation.

### Secondary

- **Focus Ochre** (`ochre`): Keyboard focus, text selection, and attention states.
- **Action Clay** (`clay`): Validation emphasis, priority reasons, and destructive actions.

### Neutral

- **Mineral Desk** (`mineral`): The full-page background and the resting canvas behind records.
- **Paper Sheet** (`paper`): Panels, active navigation cells, and inverse text on dark controls.
- **Ledger Rule** (`line`): Panel borders, dividers, field groups, and quiet button outlines.
- **Reading Ink** (`text`): Default body copy and record text.

**The Accent Restraint Rule.** Ochre and clay must explain focus, warning, validation, priority, or danger. They do not decorate neutral content.

**The Meaning Before Decoration Rule.** Keep large areas mineral, paper, or blue-green. State colors remain local to the message or action they qualify.

## Typography

**Display Font:** IBM Plex Sans with a sans-serif fallback

**Body Font:** IBM Plex Sans with a sans-serif fallback

**Character:** One bundled family carries the entire interface. Bold, tightly tracked headings make the hierarchy editorial; regular body text keeps operational copy direct. The app bundles weights 400, 600, and 700 locally through Fontsource.

### Hierarchy

- **Display** (700, `clamp(2.5rem, 6vw, 5rem)`, 1.03): Auth and legal-page statements only.
- **Headline** (700, `clamp(2rem, 4vw, 4rem)`, about 1.05): The single screen title at the top of each workspace.
- **Title** (700, `1.5rem`, 1.2): Panel and section headings.
- **Body** (400, `1rem`, typically 1.5): Forms, explanations, records, and response copy. Introductory copy stops near 66 characters per line.
- **Label** (700, `0.78rem`, `0.03em`): Field labels and definition terms. Uppercase is reserved for the small Growth OS identity line.
- **Numeric** (700, `1.6rem` or responsive display size): Counts and monetary results use tabular figures.

**The One Family Rule.** Use IBM Plex Sans for every interface role. Hierarchy comes from size, weight, tracking, and placement.

**The Editorial Scale Rule.** Each screen gets one large heading. Dense task content then steps down to section titles, labels, body copy, and muted metadata.

## Layout

The authenticated shell centers content at a maximum width of 1360px. Its page padding is `2rem clamp(1rem, 5vw, 6rem) 5rem`. Major sections use one- or two-column grids, a 1rem local gap, and large vertical separation between the navigation, heading, filters, and working content.

Registers, ledgers, and definition lists are the default structure for repeated information. Rows use horizontal dividers and align related facts in columns. Panels are reserved for forms, filters, and bounded work areas. This keeps the main record stream open on the mineral background.

At 800px and below, customer and campaign split layouts become one column. Booking rows change from four columns to two at 700px. At 760px and below, all major workspaces become one column, summary rows stack, toolbars put the action below the heading, and form grids become single-column.

The phone navigation uses two explicit rows. The first row holds workspace identity and Sign out. The second area contains all six destinations in a three-column by two-row grid. On the Reviews screen, existing reviews stay first in task order; the add and import tools move after them inside a disclosure.

**The Register Before Cards Rule.** Use open rows and dividers for repeated operational records. Use a bordered paper panel only when the content needs a bounded editing or filtering context.

**The Phone Task Order Rule.** When a desktop split collapses, place the current work and its result before secondary creation or import tools.

## Elevation & Depth

Growth OS has no box-shadow vocabulary. It creates depth with tonal contrast, one-pixel borders, two-pixel section rules, and the dark navigation block. Dialogs are right-aligned paper sheets over a translucent blue-green backdrop, with a brief horizontal entrance motion rather than a lifted shadow.

**The Divider Depth Rule.** Use color fields and rules to separate layers. Do not add shadows, blur, glass, or gradients.

## Shapes

The system is rectilinear. Panels, navigation cells, ledgers, state labels, disclosures, and empty states have square corners. Buttons and fields use a 2px radius. A softer `0.4rem` radius appears only on contained campaign choices and the campaign message area.

Borders do the structural work. Standard panels and controls use a one-pixel border; primary register starts use a two-pixel blue-green rule. Dashed borders are limited to empty states.

**The Near-Square Rule.** Default to square corners or the 2px control radius. Do not introduce pills, oversized rounding, or floating capsules.

## Components

### Buttons

- **Shape:** Nearly square with a 2px radius, a one-pixel border, a 44px minimum height, and `0.7rem 1rem` padding.
- **Primary:** Deep Register Ink fill with Paper Sheet text.
- **Secondary:** Transparent fill with a Deep Register Ink border and text.
- **Quiet:** Transparent fill with a Ledger Rule border for lower-priority actions.
- **Danger:** Action Clay fill, a darker clay border, and warm white text. The hover state darkens the fill.
- **Active / Focus:** Pressing moves the control down by 1px. Keyboard focus uses a 3px Focus Ochre outline with a 2px offset. Disabled work states keep the layout stable and reduce opacity.

### Chips

- **Style:** State labels are square, compact bordered tags with bold `0.76rem` text.
- **State:** Unanswered uses the warm warning pair; posted manually uses the quiet green success pair. The copy names the state instead of relying on color alone.

### Cards / Containers

- **Corner Style:** Square for panels and workspaces. Selectable campaign items use the contained radius.
- **Background:** Paper Sheet for bounded work, Mineral Desk for the page and selected campaign state.
- **Shadow Strategy:** None.
- **Border:** One-pixel Ledger Rule. Strong register starts use a two-pixel Deep Register Ink top rule.
- **Internal Padding:** Responsive panel padding ranges from 1.25rem to 2.5rem. Record rows stay denser, usually between 0.7rem and 1.5rem vertically.

### Inputs / Fields

- **Style:** Warm off-white fill, a medium warm-gray one-pixel border, a 2px radius, and 0.75rem padding.
- **Focus:** The shared 3px ochre outline remains visible outside the control.
- **Error / Disabled:** Errors appear in nearby clay text or in a pale clay message field. Read-only and disabled behavior must remain visible in text or copy, not color alone.

### Navigation

- **Desktop:** A single dark blue-green bar contains the identity, six destinations, and Sign out. Thin translucent dividers separate cells.
- **Active:** The active destination reverses to Paper Sheet with Deep Register Ink text.
- **Hover / Focus:** Inactive cells use Working Teal on hover. Keyboard focus moves the ochre outline inside the bar.
- **Phone:** Identity and Sign out occupy the first row. All six destinations occupy a three-column by two-row grid beneath them.

### Registers and ledgers

Record lists use full-width rows, aligned columns, and horizontal rules. Hover may add a quiet mineral-darkened fill. Values align right on wide screens and use tabular figures; narrow layouts return them to the left and preserve the reading order.

**The Explicit State Rule.** Every selected, active, pending, success, warning, and destructive state needs a visible label, copy change, border, or fill change.

**The Manual Action Rule.** Primary buttons identify the next user-reviewed action. Secondary and quiet buttons hold alternate, export, reopen, or status-marking actions.

## Do's and Don'ts

### Do:

- **Do** keep screen titles large and singular, then use dense section-level hierarchy below them.
- **Do** use strong horizontal dividers to organize records, metrics, history, and response work.
- **Do** preserve all six destinations in the phone navigation's two-row grid.
- **Do** keep the 44px minimum action height, visible ochre focus outline, and reduced-motion override.
- **Do** use stored-state language and semantic color together so meaning survives without color.

### Don't:

- **Don't** add shadows, gradients, glass effects, neon accents, or blurred layers.
- **Don't** turn repeated records into a floating rounded card grid.
- **Don't** add decorative icon libraries where text labels or native disclosure markers already explain the action.
- **Don't** use ochre or clay as broad brand fills without a focus, warning, validation, priority, or danger meaning.
- **Don't** hide phone destinations behind a menu when the complete two-row navigation fits.
