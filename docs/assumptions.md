# Assumptions and verified inputs

## Product assumptions to test

| ID  | Assumption                                                                                                        | Confidence | How to test                                                                         | Effect if false                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A1  | One owner can manage the first release without team roles.                                                        | Medium     | Ask screened owners who performs follow-up and booking entry.                       | Add a separate access-control design before adding users.                                                                      |
| A2  | Phone number is the most useful duplicate key for WhatsApp-led enquiries.                                         | Medium     | Review anonymized import examples and interview workflows.                          | Raise email or an external customer key to equal prominence.                                                                   |
| A3  | Owners can record a sent or replied outcome after leaving for WhatsApp.                                           | Low        | Run the campaign handoff usability task on a phone.                                 | Reduce steps or add an optional provider integration after the core release.                                                   |
| A4  | Transparent rules based on recency, lifecycle, consent, quoted value, and booking state are sufficient for Today. | Medium     | Ask owners to explain each ranked item and compare the order with their own choice. | Revise the rule table and its explanation. Do not add opaque scoring.                                                          |
| A5  | One workspace currency is enough for the first release.                                                           | High       | Confirm during interviews and onboarding tests.                                     | Enable multi-currency entry and define conversion and reporting policy. Every stored money value already retains its currency. |
| A6  | Manual review response posting is acceptable before a Google adapter exists.                                      | Medium     | Test the copy-and-mark-posted task.                                                 | Prioritize the adapter, subject to credentials and provider review.                                                            |
| A7  | Campaign attribution can use an explicit source recipient selected during booking entry.                          | Medium     | Test whether owners can choose the right source without guessing.                   | Narrow attribution to direct campaign-record links and label unlinked bookings.                                                |
| A8  | Retention defaults can be proposed during onboarding and changed in settings.                                     | Low        | Ask owners and obtain legal review for the launch region.                           | Block launch policy copy until legal and operational owners decide.                                                            |

## Decisions resolved from the brief

- One account owns one workspace in the first release.
- The API and MongoDB enforce `workspaceId` on every business-owned record.
- Server-managed sessions use an opaque cookie and a hashed session token in MongoDB.
- Passwords use Argon2id.
- Money uses integer minor units with an ISO 4217 currency code from the workspace.
- Timestamps use UTC. The interface renders them in the workspace timezone.
- WhatsApp is an owner-initiated click-to-chat handoff. There is no bulk auto-send.
- The production MongoDB port stays on the internal Docker network.
- Legal pages contain marked draft copy until legal review occurs.

## Open product decisions

The following decisions do not block the architecture. They must close before the named implementation phase.

| Decision                                         | Due                                       | Default used for planning                                                                                                         |
| ------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Default follow-up intervals by business category | Before the Today rules ship               | A workspace setting with a conservative editable default.                                                                         |
| Supported CSV encodings beyond UTF-8 with BOM    | Before import acceptance tests            | UTF-8 and UTF-8 with BOM only. Reject other encodings with recovery guidance.                                                     |
| Account deletion cooling-off period              | Before account deletion ships             | Immediate irreversible deletion after password and typed-name confirmation in development. Production policy awaits legal review. |
| Data-retention periods                           | Before legal review and production launch | Configurable policy text with no automatic purge claim.                                                                           |
| Launch jurisdiction and business contact details | Before public legal pages ship            | Clearly marked placeholders that fail a production-content check.                                                                 |

## Observed toolchain state

The root inventory on 2026-09-21 found Git 2.53.0, Node 24.21.0, and npm 11.19.0. The Docker command was missing. Docker installation remains a Phase 1 blocker for container verification, but it does not block planning.

## Stable release baseline

The planner checked official project documentation and npm registry metadata on 2026-09-21. The check used each exact `/latest` registry URL and the vendor release pages linked below. Phase 1 must resolve these exact direct versions into `package-lock.json`, run compatibility checks, and record any justified change before implementation.

| Component           | Observed stable version          | Primary evidence                                                                                                                                  |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js             | 24.21.0 LTS                      | [Node release table](https://nodejs.org/en/about/previous-releases)                                                                               |
| npm                 | 12.0.2 latest, 11.19.0 installed | [npm registry metadata](https://registry.npmjs.org/npm/latest)                                                                                    |
| Next.js             | 16.3.5                           | [Next.js registry metadata](https://registry.npmjs.org/next/latest)                                                                               |
| React and React DOM | 19.3.0                           | [React registry metadata](https://registry.npmjs.org/react/latest), [React DOM registry metadata](https://registry.npmjs.org/react-dom/latest)    |
| TypeScript          | 7.0.2                            | [TypeScript registry metadata](https://registry.npmjs.org/typescript/latest)                                                                      |
| Tailwind CSS        | 4.3.3                            | [Tailwind registry metadata](https://registry.npmjs.org/tailwindcss/latest)                                                                       |
| Express             | 5.2.1                            | [Express registry metadata](https://registry.npmjs.org/express/latest)                                                                            |
| MongoDB             | 8.3.11                           | [MongoDB stable release notes](https://www.mongodb.com/docs/manual/release-notes/), [official MongoDB image tags](https://hub.docker.com/_/mongo) |
| Mongoose            | 9.10.1                           | [Mongoose registry metadata](https://registry.npmjs.org/mongoose/latest)                                                                          |
| Zod                 | 4.6.5                            | [Zod registry metadata](https://registry.npmjs.org/zod/latest)                                                                                    |
| Vitest              | 5.0.1                            | [Vitest registry metadata](https://registry.npmjs.org/vitest/latest)                                                                              |
| Supertest           | 7.2.2                            | [Supertest registry metadata](https://registry.npmjs.org/supertest/latest)                                                                        |
| Playwright Test     | 1.63.0                           | [Playwright Test registry metadata](https://registry.npmjs.org/%40playwright%2Ftest/latest)                                                       |
| axe-core            | 4.13.0                           | [axe-core registry metadata](https://registry.npmjs.org/axe-core/latest)                                                                          |

Use Node 24 LTS for local work and production images. The official image page listed `mongo:8.3.11-noble` on the check date. Pin that tag or its digest after the container scan passes. Do not use floating `latest` tags in production.

## Evidence limits

- Registry versions prove published package state. They do not prove that the complete version set works together.
- The Phase 1 lockfile, type check, unit smoke test, production build, and container start must prove compatibility.
- No user research, production performance, security scan, or business outcome has been completed.
