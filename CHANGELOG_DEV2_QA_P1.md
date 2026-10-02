# DEV2 QA P1 Patch — 2026-10-02

Baseline: `TEUM_DEV2_ALL_STAYS_SCHEDULE_VALIDATED.zip`

## Fixed

1. Walking fallback timeline label
   - `walk` routes are now rendered as `도보`, not `대중교통`.

2. Home sample postcard dead-end
   - Static sample postcards no longer jump to an empty `detail.html` before a real plan exists.
   - Clicking a sample scrolls/focuses the Planner and explains that real recommendations are generated after entering conditions.

3. Real place-name search
   - Added Kakao keyword-place proxy: `/api/kakao/keyword`.
   - Planner search now tries address geocoding first, then keyword place search.
   - POI names such as `전남대학교` can resolve even when they are not literal street addresses.

4. Mobile lodging bottom clearance
   - Overnight lodging section receives extra bottom padding so the fixed mobile Save CTA does not cover the last lodging card/content.

5. Map failure copy
   - `KAKAO_JS_KEY_MISSING` still reports a missing key.
   - Other SDK/domain/network failures now show a generic map-load diagnostic instead of falsely claiming the key is missing.
   - Kakao SDK loader now rejects cleanly when the SDK global is unavailable after script load.

6. Random-plan Korean title copy
   - `...으로 떠나는` -> `... 테마로 떠나는` to avoid incorrect particles such as `하루으로`.

7. Overnight meal distribution
   - Overnight candidate targets increased moderately.
   - Day 1/Day 2 split is now based on each day's available time capacity rather than fixed counts.
   - Overnight meal candidates are capped/distributed so food stops are not placed back-to-back and, when inventory allows, meals are split across Day 1 and Day 2.

## Intentionally not changed in this patch

- Global header navigation (`저장한 틈 -> saved.html`) remains an integration-owned change per handoff contract.
- Arrival-time-aware opening-hours parsing remains for Real TourAPI integration.
- The 1-night/2-day `Return` is treated as a latest-return deadline, not a requirement to fill every minute until that time.
- Repeated-save deduplication and origin marker rendering remain P2 follow-ups.
