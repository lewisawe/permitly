# Permitly — Build Spec

> Convex All Gas Hackathon (OpenAI · Firecrawl · AgentMail). Deadline 2026-09-22 12:00 PM PT.
> Frontend host: convex.site (Convex Static Hosting). Status: pre-build spec.

## 1. One-liner

Forward one email. Your business permits renew themselves, book their own
inspections, and never lapse — with you approving every real submission.

## 2. Problem

Small businesses (restaurants, salons, contractors, childcare) carry 5-15
recurring permits and licenses across different agencies, each with its own
deadline, portal, and form. Missing one means fines or forced closure. Today the
owner tracks this in their head or a spreadsheet and re-fills the same forms by
hand every renewal cycle.

## 3. What it does (user story)

1. Owner emails the Permitly inbox: "Renew my food-handler permit and business
   license, both due this month." (Or adds permits in the web UI.)
2. Permitly opens a **case** per permit and shows them on a live compliance board
   (permit, agency, deadline, status).
3. For each case, the agent: finds the official renewal page (Firecrawl search/
   scrape), reads the form, and fills it (Firecrawl /interact). If the renewal
   requires an inspection/appointment, it opens the booking page and selects a
   slot.
4. Whenever it lacks a required field, it emails the owner asking only for that
   field; the reply updates the case.
5. Before ANY real submission (form submit or booking confirm), it emails the
   owner a summary and waits for an explicit "approve" reply — OR an Approve click
   on the board. Nothing submits without human approval.
6. On approval it submits, captures the confirmation number, stores the receipt,
   and marks the permit renewed with the next deadline.

## 4. Architecture (four sponsors, each doing real work)

- **Convex** — the whole backend: schema, indexes, queries/mutations/actions,
  scheduler (drive Firecrawl bursts + renewal reminders), crons (deadline watch),
  HTTP action (AgentMail webhook), file storage (receipts/confirmations),
  reactive board, static hosting on convex.site.
- **AgentMail** (`@agentmail/convex`) — the case inbox. Owner emails in; agent
  replies out on the thread; missing-info requests and approval gates are real
  email. Svix-verified webhook, persisted threads, durable send.
- **Firecrawl** (`@convex-dev/firecrawl-scrape` + /interact) — find the official
  page, read the form, fill and submit it, book the inspection slot. Live view
  (`interactiveLiveViewUrl`) embedded in the board so the human watches/takes over.
- **OpenAI** — extract form fields from the scraped page, map the owner's stored
  profile to those fields, decide the next step, draft the emails, summarize the
  pending action for approval.

  LLM PROVIDER DECISION (2026-09-14): use **AWS Bedrock Nova** (`amazon.nova-lite-v1:0`
  / `amazon.nova-pro-v1:0`, ON_DEMAND) via the `simi-ops` AWS profile. No OpenAI
  credits and no Convex paid plan needed. Verified: Converse API returns a live
  response (Nova Lite, ~285ms). Convex runs in the cloud, so it can't read local
  ~/.aws creds — set the simi-ops access key/secret as Convex env vars and call
  the Bedrock REST API (SigV4-signed) from a Convex action. Provider kept
  swappable (Bedrock now; OpenAI-via-Convex-AI-Gateway later if upgraded).

Flow per turn:
`email in (AgentMail webhook) -> Convex records turn -> OpenAI decides next step
-> if web action needed: Convex schedules a Firecrawl /interact burst -> agent
fills form / picks slot -> if missing field or needs approval: AgentMail emails
owner -> owner replies/clicks approve -> Convex resumes -> submit -> store receipt`

## 5. Data model (Convex schema)

Tables (all app tables; AgentMail/Firecrawl components own their own):

- `businesses` — { name, ownerEmail, profile (address, EIN-like id, contact,
  arbitrary key/values used to fill forms) }. Index: by_owner.
- `permits` — { businessId, type, agency, portalUrl, deadline, status
  ("tracked" | "in_progress" | "awaiting_info" | "awaiting_approval" |
  "submitted" | "renewed" | "failed"), nextDeadline, lastConfirmation }.
  Indexes: by_business, by_deadline, by_status.
- `cases` — one active renewal run for a permit. { permitId, businessId, threadId
  (AgentMail), state (state-machine below), currentStepId, liveViewUrl?,
  scrapeId?, lastError? }. Indexes: by_permit, by_state, by_thread.
- `steps` — the plan for a case. { caseId, order, kind ("find_page" |
  "read_form" | "fill_form" | "book_slot" | "request_info" | "await_approval" |
  "submit" | "record_receipt"), status ("pending"|"running"|"done"|"blocked"),
  detail, result }. Index: by_case_order.
- `turns` — every email/agent event on a case, for the timeline + audit.
  { caseId, threadId, direction ("inbound"|"outbound"|"system"), summary,
  createdAt }. Index: by_case.
- `actions` — every real-world action + its approval. { caseId, kind
  ("submit_form"|"confirm_booking"), payloadSummary, status
  ("proposed"|"approved"|"rejected"|"executed"), approvedBy, confirmation,
  receiptFileId? }. Index: by_case, by_status.

Never `.collect()` an unbounded table; use `.withIndex(...)` + `.take`/`.paginate`.

## 6. Case state machine

`intake -> planning -> finding_page -> reading_form -> filling_form
-> (needs field?) -> awaiting_info -> filling_form
-> (needs appt?) -> booking_slot
-> awaiting_approval -> submitting -> recording -> done`
Failure from any state -> `blocked` with lastError; owner is emailed.

Driven by: AgentMail `onMessageReceived` (advance on reply) + Convex scheduler
(advance agent-side steps in short Firecrawl bursts, since /interact sessions are
~10 min). Persistent Firecrawl profile keeps the portal login between bursts.

## 7. The mock portal (demo target — honest, controlled)

Do NOT demo against a live .gov site (CAPTCHA/MFA/flake). Build a realistic mock
"Springfield City Permits" portal + booking page, hosted on the same convex.site
(or a separate static route). It has: a login, a food-handler renewal form
(name, business, address, prior permit #, agree checkbox, submit), and an
inspection booking page (date-slot picker). Clearly labeled "DEMO PORTAL" in-app.
Firecrawl /interact drives this exactly as it would a real one — the capability
is genuine; only the target is controlled. This mirrors how FetchBack/Overlap
demoed.

## 8. Human-in-the-loop + safety (matches the craft bar judges reward)

- No submission or booking confirm without explicit approval (email "approve" or
  board button). Enforced server-side in a Convex mutation, not the client.
- The model proposes; the server validates the action payload before it executes.
- Live view lets a human watch the browser act and take over.
- Secrets (AgentMail/Firecrawl/OpenAI keys) only in Convex env vars, never args.
- No real PII in the repo or build log; demo data is fictional.

## 9. MVP scope (time-boxed) vs. bonus

MVP (must work, end-to-end, on the mock portal):
1. AgentMail round-trip: email in -> case created -> agent replies. (Prove FIRST.)
2. One food-handler renewal: find page -> fill form (Firecrawl /interact) ->
   email owner for one missing field -> await approval -> submit -> confirmation
   stored -> board shows "renewed".
3. Live compliance board with reactive status + the Firecrawl live view embed.

Bonus (show if time): the inspection-booking step (date-slot pick) as the "and it
even books the slot" beat; a second permit type; deadline cron that auto-opens a
case.

Cut if needed: multi-business, auth beyond anonymous owner identity, real .gov
targets.

## 10. Build order (de-risk first)

1. Scaffold Vite+React+Convex; board UI shell on convex.site.
2. Install + wire `@agentmail/convex`; prove email round-trip (webhook +
   onMessageReceived + reply). THIS IS THE RISKIEST PIECE — do it first.
3. Schema + case/step state machine + reactive board.
4. Install + wire Firecrawl component; prove ONE /interact form-fill on the mock
   portal (build the mock portal alongside).
5. OpenAI: field extraction + email drafting + approval summary.
6. Approval gate (email + button), submit, receipt capture.
7. Bonus: booking slot; deadline cron.
8. Polish: light/dark, no-account demo path, seed a demo case.
9. Record demo video (<3 min), keep hackathon.md current via /hackathon.

## 11. 3-minute demo script

- 0:00 The board: three permits, one due in 3 days (red). "Small businesses miss
  these and get fined."
- 0:20 Forward the email: "renew my food-handler permit." A case appears live.
- 0:35 Watch the agent (Firecrawl live view embed) open the portal and fill the
  form. It pauses: emails "what's your prior permit number?"
- 1:10 Reply to the email with the number; the case advances live.
- 1:25 It needs an inspection: picks a slot on the booking page (bonus).
- 1:40 Approval gate: "Ready to submit renewal + book Tue 10am. Approve?" Click
  Approve on the board.
- 1:55 It submits, captures confirmation #, stores the receipt, board flips to
  "renewed", next deadline set.
- 2:20 Recap the four sponsors doing real work; human approved every action.

## 12. Submission checklist (from hackathonSetup.md)

- [ ] Public repo, hackathon.md at root (Event: Convex All Gas Hackathon).
- [ ] Live convex.site URL judges open without an invite.
- [ ] Video <= 3 min.
- [ ] Real sponsor integrations, verified in hackathon.md (not mocked — the
      PORTAL is mocked, the Firecrawl/AgentMail/OpenAI calls are real).
- [ ] Submit at vibeapps.dev with the AllGasHackathon tag.
