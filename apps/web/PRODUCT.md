# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the owner or manager of a salon or another appointment-based business with a small team. They may work mainly from a phone and need a daily workflow that explains who needs attention, why, what action is available, and what happened afterward without requiring CRM expertise.

## Product Purpose

Growth OS turns scattered enquiries into an organized, consent-aware workflow. It preserves customer context, prioritizes follow-up work with visible rules, helps the owner prepare and review personal messages, records bookings and reviews, and reports outcomes from stored events and bookings.

Success means the owner can move an enquiry through follow-up, booking, review response, and reporting in the real application while the API and database preserve tenant isolation, consent history, auditability, and honest value labels.

## Positioning

Growth OS is an operational workspace, not an automated bulk sender or a predictive revenue dashboard. The owner reviews every campaign recipient and initiates each WhatsApp conversation. Results distinguish quoted value, recorded booking value, and collected revenue.

## Operating Context

Enquiries arrive through WhatsApp, Instagram, phone calls, referrals, and spreadsheets. The owner uses Today as the main queue, customer records for context, campaigns for reviewed follow-ups, bookings for agreed appointments, Results for stored operational counts, Reviews for manual response management, and Settings for business data and account controls.

The first version supports one business workspace per account. Every business-owned record carries a workspace identifier. The full daily workflow must work on phone, tablet, laptop, and wide desktop.

## Capabilities and Constraints

- Secure account registration, sign-in, sign-out, session expiration, password reset, and onboarding.
- Manual and CSV customer intake with duplicate review, interaction history, consent history, lifecycle state, and suppression after withdrawal.
- Transparent follow-up priorities and consent-aware campaign recipient checks.
- Reviewed WhatsApp click-to-chat handoff with manual sent, skipped, replied, and booked outcomes. The first version does not auto-send messages.
- Booking records with appointment date, agreed value, status, notes, and campaign attribution when a valid relationship exists.
- Results derived from stored events and bookings, with local-date filtering and CSV export.
- Manual and CSV review intake. Original review content stays immutable while response drafts can be copied, marked as posted manually, and reopened.
- Business settings, versioned JSON data export, and explicit account deletion.
- A guarded, database-backed demo workspace labeled on every authenticated screen.
- Privacy and terms pages remain drafts for legal review until operator identity, contact details, jurisdiction, retention, and approved legal text are supplied.
- No team roles, enterprise permissions, workflow builder, fabricated business outcomes, or unverified delivery claims in the first version.

## Brand Commitments

The product name is Growth OS. The interface uses direct operational language and avoids artificial-intelligence labels, predicted revenue, invented conversion claims, or generated research presented as fact.

## Evidence on Hand

The repository contains the supplied product brief, architecture and domain documents, a threat model, test and research plans, a decision and verification trail, real API integration tests, browser tests, and production Docker configuration. Current screenshots and measured performance evidence still need to be refreshed after the complete product is finished. No completed salon-owner interviews, testimonials, approved legal identity, or external provider delivery evidence exists and none may be fabricated.

## Product Principles

- Explain every prioritized action with stored facts.
- Require explicit consent and human review before contact.
- Record what happened without overstating delivery, revenue, or conversion.
- Keep the daily workflow usable on a phone.
- Verify behavior through the browser, API, and database before calling it complete.

## Accessibility & Inclusion

All important actions require keyboard access, visible focus, accessible names, recoverable errors, and preserved form input. The interface must support reduced motion and complete workflows at phone, tablet, laptop, and wide-desktop sizes.
