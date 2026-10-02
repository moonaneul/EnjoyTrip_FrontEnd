# TEUM DEV2 Full QA Report

Date: 2026-10-02
Baseline: `TEUM_DEV2_ALL_STAYS_SCHEDULE_VALIDATED.zip`
Scope: Developer 2 standalone (Planner / Recommendation / Route / Result / Detail / Map / Lodging / Save)

## 1. Automated baseline

- `npm run check`: PASS
- Domain tests: PASS
- Static local references: PASS (no missing local HTML/CSS/JS/image references)
- Duplicate HTML ids: none in `index.html`, `result.html`, `detail.html`, `saved.html`
- `/api/runtime-config`: HTTP 200
- Common `css/style.css`: unchanged from packaged baseline

## 2. Matrix QA

40 generated scenarios were exercised across:
- Origins: Gwangju ACC / Gwangju City Hall / Gwangju Songjeong / Seoul City Hall
- Transport: transit / car
- Day windows: 5h morning, 5h afternoon, 5h evening, 2.5h micro-trip
- Overnight: Day 1 14:00 -> Day 2 19:00

Results:
- 40/40 returned at least one valid plan.
- Every generated plan passed the final return hard gate.
- All overnight baseline cases had Day 1 + lodging + Day 2.
- All overnight baseline cases with sufficient fixture inventory exposed 5 schedule-validated lodging variants.

Note: some 2.5h non-central-origin cases intentionally produce fewer than three plan styles because the time/routing constraints are tight. This is not a hard-gate failure.

## 3. Findings

### P1-01 — Overnight meal placement can be unnatural
Observed in Gwangju overnight test matrices. Some plans put two food stops consecutively on Day 2, or multiple food/cafe stops too close together.

Root cause:
- `ensureMealCount()` guarantees a count of food candidates but does not cap excess food candidates or distribute them across days/time windows.

Impact:
- Technically valid schedule, low recommendation quality.

### P1-02 — Overnight schedules under-use the available window
For Day 1 14:00 -> Day 2 19:00, some valid plans returned around noon/early afternoon on Day 2, leaving several unused hours. Slow plans can also check in very early on Day 1.

Root cause:
- fixed overnight place targets and fixed split counts rather than capacity-aware day allocation.

Impact:
- 1-night/2-day result feels more like a short trip spread over two days.

### P1-03 — Walking fallback is mislabeled in Timeline
`buildTimeline.routeText()` renders every non-car route as `대중교통`, even when `route.mode === 'walk'`.

Impact:
- Route diagnostics say `도보 전환`, while Timeline says `대중교통`; contradictory UI.

### P1-04 — Home sample postcards lead to an empty detail state before planning
The three static home postcards link directly to `detail.html`. With no generated plan/session state, Detail has no plan to load.

Impact:
- Clickable-looking sample content can lead to a dead-end page.

### P1-05 — “지역 · 장소 검색” only performs address geocoding
The UI promises place search, but arbitrary POI names are sent only to the address endpoint. Kakao officially provides keyword place search at `/v2/local/search/keyword.json`.

Impact:
- valid place names that are not addresses can fail unexpectedly.

### P1-06 — Mobile sticky save can overlap the final lodging area
On mobile, bottom clearance is attached to `.place-section`, but `.lodging-section` follows it for overnight trips. The fixed save CTA can therefore cover the bottom of lodging/footer content.

Impact:
- mobile overnight UX/readability.

### P1-07 — Saved navigation is not wired in the standalone pages
All headers currently route `저장한 틈` to `result.html`, not `saved.html`. On mobile, header links are hidden entirely, so saved trips have no normal navigation entry.

Ownership note:
- Earlier integration contract reserves global navigation for integration. Treat as an integration blocker rather than silently editing shared navigation without approval.

### P1-08 — Operating-hours validation is status-level, not arrival-time-level
`confirmed_closed` is excluded, but the engine does not parse actual opening intervals against each generated arrival/departure time.

Impact:
- a place may be generally open but closed at the planned arrival hour once real TourAPI data is connected.

### P2-01 — Map fallback message overstates “missing JavaScript key”
Any Kakao map render failure shows a message saying the JS key is missing, even if the actual cause is domain registration, SDK load failure, network failure, etc.

### P2-02 — Repeated Save creates duplicate identical trips
Save always inserts a new trip id. There is no duplicate/idempotency guard.

### P2-03 — Random title Korean particle can be grammatically wrong
Example: `먹고 쉬는 하루으로 떠나는 1박2일 틈`.

### P2-04 — Map does not show the Planner origin/return point
It renders itinerary places and all validated lodgings, but not the start/return origin marker.

### P3-01 — Max overnight duration uses 47h, not <48h
A theoretical 47h+ valid 1-night/2-day window can be rejected. Low practical impact for the current UI.

## 4. Items verified good

- Origin is not GPS-forced; user must choose an origin.
- Current-location reverse-geocode path is present.
- Quick origins include Gwangju and Seoul.
- Gwangju 5h generates local plans.
- Transit primary failure falls back to estimated routing instead of collapsing all recommendations.
- Return hard gate is enforced.
- Closed fixtures are excluded.
- 1-night/2-day has Day 1 -> lodging -> Day 2 -> origin structure.
- Up to 5 lodging options are full schedule variants, not display-only suggestions.
- Selecting a lodging changes the active variant and persists into active-plan session state.
- LocalStorage corruption recovery works.
- Saved trip detail restores its own planner input from saved data.
- Car mode does not fabricate a fare.

## 5. Browser verification limitation in this QA environment

The container Chromium process could not complete local headless rendering because the sandbox environment's Chromium/DBus process hangs. Static validation, server HTTP checks, domain tests and scenario-generation tests were completed. Final visual checks at 1440/1024/768/390/375 still need to be executed in the user's VSCode/browser environment after the P1 patch.

## 6. Recommended fix order

1. P1-03 timeline walk label
2. P1-04 home sample dead-end
3. P1-05 real keyword place search
4. P1-06 mobile sticky-save clearance
5. P1-01/P1-02 overnight itinerary quality
6. P2 map error copy + random title grammar
7. Integration-owned P1-07 navigation
8. Real TourAPI hours-at-arrival validation
