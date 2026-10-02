# TEUM DEV2 QA P1 Result

Date: 2026-10-02

## Completed in this patch

- Full baseline QA report written: `DEV2_FULL_QA_REPORT.md`
- 40-scenario route/recommendation matrix: PASS
- Existing `npm run check`: PASS
- Static local references: PASS
- Shared `css/style.css` hash: unchanged
- Kakao runtime config endpoint: HTTP 200
- New Kakao keyword-place proxy added
- Keyword POI lookup unit test added
- Timeline walking label corrected
- Home static postcards no longer open an empty detail state
- Mobile overnight lodging bottom clearance added
- Map SDK error copy made cause-aware
- Kakao SDK missing-global condition now rejects cleanly
- Random-plan Korean title copy corrected
- Overnight meal selection capped/distributed across days
- Overnight day split changed from fixed item counts to available-time-based allocation
- Overnight regression test now rejects adjacent food stops

## Automated results

### Recommendation matrix
40 cases across:
- Gwangju ACC / City Hall / Songjeong
- Seoul City Hall
- transit / car
- 5-hour morning / afternoon / evening
- 2.5-hour micro-trip
- 1-night/2-day

Result: 40/40 had no hard-gate failure.

### Overnight quality regression
Across multiple mood combinations:
- no consecutive food stops in a single day
- Day 1 and Day 2 preserved
- final return hard gate preserved
- 5 schedule-validated lodging variants preserved where fixture inventory allows

## Remaining items

### Integration-owned
- Global `저장한 틈` header link is still `result.html`; final navigation should be wired during integration.
- `MY` remains a placeholder until Dev1 Auth/MyPage integration.

### Real TourAPI integration
- opening-hours validation must become arrival-time-aware once real structured hours are available.
- Mock place/lodging data still needs replacement with Dev1's real provider.

### P2 follow-ups
- prevent duplicate saves for the same plan if desired
- add origin/return marker to Kakao Map
- decide whether Day 2 should intentionally fill closer to the user's latest-return time or remain an early-return-valid plan
- investigate Kakao walking endpoint 404 separately; fallback remains safe

## Manual browser checks still required

The QA container's Chromium could not finish local headless rendering, and the user's Opera Browser Connector was not connected. In the user's VSCode/browser environment, verify:

- 1440 / 1024 / 768 / 390 / 375px
- actual current-location label
- Kakao marker popup
- lodging card switching
- mobile sticky save clearance
- keyword search (`전남대학교` recommended)
- smoke test including `Keyword place search`
