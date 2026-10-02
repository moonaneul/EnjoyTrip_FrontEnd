# TEUM INTEGRATION REPORT

## Status
Dev1 final delta와 Dev2 QA P2 기준본을 ownership collision 없이 병합했다.

## Dev1 → Dev2 bridges
1. `index/result/detail/saved` Navigation bridge
   - 여행지 둘러보기 → `explore.html`
   - 저장한 틈 → `saved.html`
   - MY → `mypage.html`
2. Recommendation provider
   - Mock → `js/integration/placeProvider.js`
   - 내부는 Dev1 `js/api/tourApi.js` 사용
3. Auth ↔ save
   - `getCurrentUser()?.id` → `ownerUserId`
4. Header auth state
   - 로그인 여부에 따라 MY/로그인 표시 보정
5. Shared local key config
   - Kakao JS + TourAPI key가 하나의 `keys.local.js`에서 공존
   - Kakao REST key는 `.env.local` server proxy 유지

## Personalization added
- 최초 가입 후 자동 로그인 → onboarding
- 6-step explicit preference survey
- `teum.user_preferences.v1`
- preference resolver
- temporary trip mood override
- weighted candidate ranking
- pace-based plan density adjustment
- personalized reason copy
- MyPage preference edit

## Real provider adapter
Dev1의 `getFoodCandidates/getLodgingCandidates`는 행정구역 검색 contract도 지원하지만,
Dev2 recommendation은 lat/lng/radius를 전달한다.
따라서 integration adapter에서 food/lodging은 `getNearbyPlaces(... type)`로 연결했다.
Dev1 source file 자체는 수정하지 않았다.

## Automated result
- Dev1/Dev2 collision: PASS
- Frozen style hash: PASS
- JS/MJS syntax: PASS
- Dev2 tests: PASS
- Dev1 normalizer tests: PASS
- Integration preference/provider: PASS
- Auth/preference/trip ownership: PASS

## Pending environment-dependent checks
실제 API keys는 패키지에 포함하지 않았으므로 아래는 사용자 PC에서 실행해야 한다.
- `npm run smoke:kakao`
- `npm run smoke:tour`
- full browser E2E / responsive matrix

## Known limitations
1. Dev1 TourAPI list response는 운영 상태를 추측하지 않고 `unknown`으로 유지한다.
2. 따라서 실제 영업중/영업종료 여부를 임의 판정하지 않는다. 운영 텍스트가 필요한 경우 detail 조회 단계에서 확인한다.
3. 세밀한 nature/local/photo 취향은 현재 normalized Place의 broad type + title/category/overview heuristic으로 점수화한다.
4. LocalStorage Auth는 Front-end demo이며 server authentication을 대체하지 않는다.
5. Walking API 404 환경에서는 기존 estimated fallback을 유지한다.
6. Browser visual QA는 실행 환경의 localhost 차단으로 자동화하지 못했으므로 사용자 PC에서 최종 확인이 필요하다.

## Personalized 3-plan strategy update

고정된 `여유로운 / 빽빽한 / 랜덤` 결과 구분을 사용자 설문 기반의 동적 전략으로 교체했다.

- Signature: 현재 사용자 취향을 가장 안정적으로 반영
- Focus: 상위 선호 카테고리를 더 강하게 반영
- Discovery: 취향 범위 안에서 새로운 장소를 일부 확장

`pace`와 `restImportance`는 세 안 모두에 공통 적용되므로, 느긋한 사용자가 선택했다고 해서 두 번째 카드만 빽빽한 일정으로 생성되지 않는다.

기존 저장/딥링크 호환을 위해 내부 `plan.type`은 유지하고, 사용자 UI는 신규 strategy metadata를 사용한다.
