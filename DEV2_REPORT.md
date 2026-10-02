# DEV2_REPORT

## Summary
Developer 2 범위인 Planner + Geolocation + Kakao Route/Map adapter + Recommendation Engine + Timeline + F104 저장을 구현했다.

핵심 원칙은 다음과 같다.

- Recommendation은 TourAPI raw field를 직접 읽지 않는다.
- `PlaceProvider` / `RouteProvider` injection 구조를 유지한다.
- Dev1 없이 `MockPlaceProvider`로 독립 실행 가능하다.
- Route API 실패를 confirmed 데이터처럼 위조하지 않는다.
- API key가 전혀 없는 개발 환경만 명시적 `EstimatedRouteProvider`를 사용하며 UI warning을 남긴다.
- 최종 `returnAt <= PlannerInput.endAt` Hard Gate를 통과한 Plan만 반환한다.
- `css/style.css`는 원본 SHA-256을 유지했다.

## Implemented

### Planner
- Current geolocation allow / deny / unavailable handling
- Manual origin fallback
  - address + Kakao geocoding (REST key 있을 때)
  - lat/lng direct input
  - explicit Seoul City Hall demo preset
- Start / Return time input
- Transit / Car segmented control
- Accommodation toggle
- Mood chips
- Planner validation + session handoff

### Recommendation
- `generatePlans({ input, placeProvider, routeProvider, config })`
- Candidate coordinate guard
- Haversine prefilter
- Top-N origin route validation
- Route cache
- Concurrency limit
- confirmed_closed exclusion
- unknown-hours warning
- Meal candidate insertion
- Accommodation candidate
- Slow / Full / Random generators
- Seeded random
- Short-window micro-trip dwell scaling
- Return hard validation
- Diversity adjustment

### Result / Detail
- POSTCARD v2 dynamic plan rendering
- Transit fare / car distance display rules
- estimated vs confirmed provider label
- Timeline including travel legs
- Kakao Map dynamic SDK adapter
- Map fallback when JS key missing
- Place cards
- Desktop/mobile save control

### F104
- `teum.trips.v1`
- save / list / get / delete
- `ownerUserId: null` supported
- corrupted JSON recovery
- saved.html implementation

## Not Implemented

- Dev1 TourAPI real client
- Dev1 auth/session binding
- Header navigation merge (`저장한 틈` → `saved.html`) — integration ownership
- Real-time lodging price / booking
- Train / express bus timetable
- Weather / crowd / personalization
- Backend proxy

## Planner

Planner input follows the shared contract:

```js
{
  origin: { source, label, lat, lng },
  startAt: Date,
  endAt: Date,
  transport: "transit" | "car",
  returnMode: "origin",
  accommodation: Boolean,
  moods: String[]
}
```

Validation:
- valid coordinates required
- start < end
- minimum 120 minutes
- transport required

## Recommendation Algorithm

Pipeline:

1. Planner validation
2. `PlaceProvider.getNearbyPlaces`
3. coordinate guard
4. closed exclusion
5. Haversine sorting
6. top 8 route verification
7. open/unknown preference
8. mood scoring
9. meal slot
10. lodging candidate if ON
11. Slow / Full / Random generation
12. per-leg RouteProvider calls through shared cache
13. safety buffer
14. final return deadline gate
15. random overlap adjustment

Default config:

```text
candidateRadiusM      22,000
initialCandidateLimit 36
routeShortlistLimit   8
routeConcurrency      4
maxOutboundMin        75
slowSafetyBufferMin   18
fullSafetyBufferMin   10
randomSafetyBufferMin 14
```

### Slow
- normally 2~3 places
- longer dwell
- shopping deprioritized
- larger safety buffer

### Full
- up to 5 places
- shorter dwell
- meal preserved when meal window overlaps
- tail trimmed until valid

### Random
- selected only from validated pool
- seeded random
- explicit theme
- attempts to avoid near-identical set with Slow/Full

### Short trip
For <180 minute windows, dwell duration is reduced but never below 30 minutes. This is required to produce an honest nearby micro-trip instead of returning zero solely because the normal 5h dwell profile was reused.

## Route APIs actually verified

Verified against Kakao official documentation on 2026-10-02.

### Public transit
Official endpoint:

```text
GET https://dapi.kakao.com/v2/routing/publictraffic
Authorization: KakaoAK ${REST_API_KEY}
```

Official response provides:
- `totalDistance`
- `totalTime` (seconds)
- `transfers`
- `fare.value` (KRW)
- route steps

Current free daily quota documented by Kakao:
- Get public transit routes: 1,000 calls/day

Kakao Map free quota policy changed on 2026-07-21. The first Kakao Map-enabled app per developer account receives the free quota; later apps require paid API configuration for usage beyond policy conditions.

Official docs:
- https://developers.kakao.com/docs/en/kakaomap/rest-api
- https://developers.kakao.com/docs/en/getting-started/quota
- https://developers.kakao.com/docs/en/kakaomap/common

### Car
Official endpoint:

```text
GET https://apis-navi.kakaomobility.com/v1/directions
Authorization: KakaoAK ${REST_API_KEY}
```

Official response provides route summary `distance` and `duration`.
Contract rule is preserved: car `fare = null` even though the Kakao response can contain taxi/toll information.

Current free daily quota documented by Kakao:
- Navigate for driving route: 10,000 calls/day

Official docs:
- https://developers.kakaomobility.com/guide/navi-api/directions
- https://developers.kakao.com/docs/en/getting-started/quota

### Live smoke status
No real Kakao API key was supplied in the handoff. Therefore live authenticated smoke requests were not executed.
The execution environment also failed external DNS resolution for direct network smoke tests, so browser CORS behavior is **not confirmed** here.

**Integration Gate:** with real keys, verify browser direct-call CORS before final submission. If blocked, do not silently fabricate routes.

## API Call Budget Measurement

5h sample:
- origin: Seoul City Hall
- 14:00~19:00
- transit
- moods: walk + culture
- 32 Mock candidates discovered
- 8 candidates route-shortlisted
- 3 plans generated
- cached provider fresh route requests: 17
- cache hits: 5

The first-stage candidate verification respects the configured top-8 limit. Additional calls are actual selected itinerary legs and return legs needed for timeline truthfulness.

With Kakao public transit's documented 1,000/day free quota, this call pattern should still be treated as expensive. Production optimization should preserve correctness while considering route batching/alternative architecture if traffic grows.

## Changed Files

Dev2 application files:

```text
index.html
result.html
detail.html
saved.html

css/pages/planner.css
css/pages/result.css
css/pages/detail.css
css/pages/saved.css

js/api/kakaoMap.js
js/api/kakaoRoute.js

js/core/geolocation.js
js/core/tripStorage.js

js/mocks/tourApi.mock.js

js/features/planner/plannerState.js
js/features/planner/runtimeConfig.js
js/features/planner/validation.js

js/features/recommendation/config.js
js/features/recommendation/distance.js
js/features/recommendation/generatePlans.js
js/features/recommendation/routeCache.js
js/features/recommendation/time.js

js/features/timeline/buildTimeline.js

js/pages/homePage.js
js/pages/resultPage.js
js/pages/detailPage.js
js/pages/savedPage.js
```

Tooling / evidence:

```text
package.json
tests/dev2.test.js
.style-css.sha256
```

`css/style.css`, shared assets and `js/ui.js` are present in the standalone workspace only and were not modified.

## Tests

Automated Node domain tests pass:
- 32 Mock places >= required 25
- closed fixture exists
- unknown-hours fixture exists
- 14:00~19:00 = 300 min
- start >= end fails
- 5h sample creates Slow/Full/Random
- every returned Plan meets return deadline
- closed places excluded
- Slow count <= Full count
- Random theme present
- Random same-seed reproducibility
- 2.5h micro trip generation
- accommodation ON adds lodging
- no candidate returns []
- Kakao transit response normalization
- Kakao car response normalization
- real-provider HTTP failure -> unavailable, no fabricated duration
- F104 save/delete
- corrupted LocalStorage recovery

Static checks pass:
- all JS files syntax check
- HTML required hooks present
- local HTML/CSS/image/script references exist
- frozen `css/style.css` SHA-256 unchanged

### Browser visual QA limitation
A Chromium browser was started, but the managed environment policy blocks both localhost/private-IP HTTP URLs and `file://` URLs with "Your organization doesn't allow you to view this site". Therefore true browser screenshot/interaction QA could not be completed in this environment.

This is an environment blocker, not an application exception. Final integration should still execute the responsive visual matrix in a normal browser.

## Required Keys

`js/config/keys.local.js` (never commit/zip):

```js
export const TEUM_KEYS = {
  kakaoRestApiKey: 'YOUR_REST_API_KEY',
  kakaoJavaScriptKey: 'YOUR_JAVASCRIPT_KEY',
};
```

Without a REST key:
- recommendation remains testable via explicit `EstimatedRouteProvider`
- result/detail warn that mobility values are estimates

With a REST key:
- real Kakao route calls are used
- a failed real call becomes `unavailable`; it does not silently fall back to fake confirmed data

Without a JavaScript key:
- detail map remains as POSTCARD map placeholder with a clear notice

## Known Bugs

No known domain-test failure at handoff time.

## Known Limitations

1. Real TourAPI is not connected yet; Mock provider is intentional.
2. Real Kakao keys were unavailable, so authenticated endpoint smoke tests are pending.
3. Browser CORS is not confirmed.
4. Full visual QA at 1440/1024/768/390/375 is pending because local/file browser access is blocked by the execution environment policy.
5. Kakao map marker click opens an InfoWindow, but deep two-way hover synchronization with Timeline is not implemented.
6. Accommodation changes the itinerary endpoint to lodging/check-in while shared `PlannerInput.returnMode` remains `origin`; this contract nuance should be reviewed during integration.
7. Header navigation is intentionally not changed by Dev2.

## INTEGRATION_REQUEST

1. Replace Mock `PlaceProvider` with Dev1 real TourAPI provider via injection only.
2. Do not rewrite Recommendation algorithms for TourAPI raw fields.
3. Connect auth session to F104 `ownerUserId`.
4. Integration-owned navigation:
   - `저장한 틈` → `saved.html`
   - explore/auth/mypage links per final merged routes
5. Provide `keys.local.js` locally and run real Kakao smoke tests.
6. Confirm browser CORS for public transit and car REST endpoints.
7. Run 1440 / 1024 / 768 / 390 / 375 visual QA.
8. Decide whether accommodation plan semantics should formally extend `returnMode` contract.

## Mock -> Real Swap Instructions

Current result page creates providers roughly as follows:

```js
const plans = await generatePlans({
  input,
  placeProvider: mockPlaceProvider,
  routeProvider,
});
```

Integration must change only provider construction/import:

```js
const plans = await generatePlans({
  input,
  placeProvider: realTourApiProvider,
  routeProvider,
});
```

Real provider must satisfy the shared `PlaceProvider` contract and return normalized `Place` objects. Recommendation code must not start reading TourAPI raw response fields.

## Next Steps

1. Integrator merges Dev1 + Dev2 deltas.
2. Configure real keys locally.
3. TourAPI provider swap.
4. Real Kakao transit/car smoke.
5. CORS + quota confirmation using the actual Kakao app.
6. Responsive browser regression.
7. Auth owner binding.
8. Final navigation merge.

## 2026-10-02 VSCode / Kakao Local QA Update

### Added
- `dev-server.mjs`: dependency-free local static server + same-origin Kakao proxy
- `.env.example`: server-side Kakao REST key template
- `scripts/setup-kakao.ps1`: Windows one-shot local key setup
- `scripts/kakao-smoke.mjs`: geocode / transit / car API smoke test
- `RUN_LOCAL.md`: VSCode execution instructions
- `KAKAO_LOCAL_SETUP.md`: 2026 Kakao setup notes
- `VSCODE_QA_CHECKLIST.md`: browser QA checklist

### Security / CORS decision
- JavaScript key remains browser-side for Kakao Maps SDK.
- REST API key is kept in `.env.local` and is not sent to browser code in the recommended local path.
- Browser calls `/api/kakao/*`; `dev-server.mjs` adds `Authorization: KakaoAK ...` server-side.
- This avoids relying on direct browser CORS behavior for Kakao Mobility car routing and provides a migration path to a deployed server/serverless proxy.

### Verification
- `npm run check`: PASS
- local server `/index.html`: HTTP 200
- `/api/runtime-config`: PASS
- missing REST key returns explicit HTTP 503 from proxy and UI falls back to EstimatedRouteProvider
- Browser-side proxy adapter test confirms no Authorization header is attached
- `css/style.css` SHA-256 remains unchanged
- HTML local references: no missing files

### Remaining external verification
Live `npm run smoke:kakao` must be run on the developer machine after real Kakao REST/JavaScript keys are configured and Kakao Map API / JavaScript SDK domain settings are enabled.

## 2026-10-02 Follow-up — Location Picker / Gwangju / 1박2일

### Implemented
- From 클릭 시 GPS 강제 실행 제거
- 현재 위치 / 지역·장소 검색 / 빠른 선택 / 좌표 직접 입력 Location Picker
- 광주 Mock fixtures 추가
- Kakao route unavailable → EstimatedRouteProvider fallback
- 추천 실패 원인 코드 및 진단 통계 추가
- 당일 / 1박2일 선택
- 1박2일 Day 1 → 숙박 → Day 2 → 출발지 귀환 생성
- Result / Detail Timeline / Saved Trip 1박2일 표시

### Verified scenarios
- 광주 ACC, 14:00–19:00, transit: slow/full/random 3안
- Kakao transit HTTP 403 강제: fallback 후 광주 3안 유지
- 광주 ACC, Day1 14:00 → Day2 19:00: 1박2일 3안
- 모든 1박2일 일정: Day 1/Day 2 장소 존재, 숙박 존재, 최종 귀가 Hard Gate 통과
- 2박 이상 validation reject
- 기존 서울 5h / 2.5h / F104 regression pass
