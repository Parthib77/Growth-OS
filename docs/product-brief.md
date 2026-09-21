# Growth OS product brief

## Product purpose

Growth OS gives a salon owner one daily workspace for turning enquiries into recorded bookings. The product keeps the original enquiry context, contact permission, follow-up work, booking outcome, and audit history connected.

The first release supports one business workspace per account. Every business record still carries `workspaceId` so the API and database can enforce tenant isolation.

## Primary user

The primary user owns or manages a salon or another appointment-based business. The user may work mainly from a phone, has little time for data entry, and needs the next action to be obvious without learning CRM terminology.

The product must answer four questions on every work screen:

- Who needs attention?
- Why is the person here?
- What action can the owner take?
- What happened after the action?

## Core workflow

1. The owner registers and configures the business.
2. The owner adds an enquiry or imports enquiries from CSV.
3. Growth OS preserves the source, requested service, quoted value, interaction time, and consent evidence.
4. Today ranks eligible enquiries with visible reasons.
5. The owner drafts a campaign, reviews every recipient and message, and removes any unsuitable recipient.
6. The owner opens an individual WhatsApp click-to-chat link or exports the reviewed list.
7. The owner records sent, skipped, replied, and booked outcomes.
8. The owner records a booking and its agreed value.
9. Results derives counts and recorded booking value from stored records.
10. The owner prepares and copies review responses, then records that each response was posted manually.

## Release scope

The first release includes account security, onboarding, Today, customers, CSV import, duplicate review, consent history, campaigns, individual WhatsApp handoff, campaign export, bookings, results, reviews, settings, data export, account deletion, privacy, terms, audit history, and a database-backed demo workspace.

The first release excludes team roles, enterprise permissions, workflow builders, automated bulk messaging, Google Business Profile access, WhatsApp Cloud API delivery, collected-payment accounting, microservices, GraphQL, event streaming, and a message broker.

## Product truth rules

- A priority reason names the rule that placed an enquiry in Today.
- A contact is eligible only when the latest channel-specific consent record grants contact and no suppression applies.
- A possible duplicate always reaches a human review. The system never merges records silently.
- A message is `sent` only after the owner records the handoff or a future provider confirms it. The first release never claims provider delivery.
- Quoted value, recorded booking value, and collected revenue are separate terms. The first release does not calculate collected revenue.
- Results uses stored operational events and bookings. It does not infer history from mutable current-state fields.
- Review text remains unchanged after import or manual entry.
- Demo data is labeled as demo data and uses the same API and MongoDB persistence as normal workspaces.

## Product measures

The release may measure operational facts after real use begins. Useful measures include the age of the oldest eligible follow-up, the count of reviewed follow-ups, the count of recorded replies, the count of recorded bookings, and the share of imported rows that require duplicate review. These measures do not prove revenue lift or causal conversion improvement.

Research must test whether owners understand priority reasons, consent status, message handoff, booking attribution, and the distinction between quoted and booked value. [The research plan](research-plan.md) defines the work. No interview or business outcome is complete yet.

## Falsifiable completion predicate

Growth OS is complete only when a clean checkout can follow the README to start the development and production topologies, and an independent operator can complete the full critical workflow in a real browser against Express and MongoDB. The same run must prove tenant isolation, consent exclusions, idempotent booking creation, campaign conflict handling, restart persistence, mobile completeness, accessibility, passing unit, integration, and browser suites, passing production builds, indexed common queries, and an audit trail. `docs/verification.md` must contain the commands, environment, screenshots, measured results, and remaining limits.

Any failed clause makes the predicate false. A build, a test suite, or a polished interface cannot satisfy the predicate alone.
