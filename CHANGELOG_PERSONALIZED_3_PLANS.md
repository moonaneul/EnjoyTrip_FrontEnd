# Personalized 3-Plan Recommendation — Change Log

## Goal
기존 결과 화면의 고정 3안인 `여유로운 틈 / 빽빽한 틈 / 랜덤 컨셉 틈`을 사용자 설문 기반의 동적 3안으로 변경했다.

## New recommendation semantics
세 안 모두 사용자의 장기 취향과 pace/rest 성향을 공유한다. 차이는 일정 밀도를 강제로 바꾸는 것이 아니라 취향을 해석하는 방식이다.

1. **Signature / 취향 정석형**
   - 사용자의 상위 취향을 가장 안정적으로 반영
   - 설문 pace 및 휴식 중요도에 맞춘 장소 수와 체류시간 적용
2. **Focus / 선호 집중형**
   - 상위 1~2개 선호 카테고리의 가중치를 추가 강화
   - 동일 pace를 유지하면서 취향 축을 더 선명하게 구성
3. **Discovery / 취향 확장형**
   - 핵심 취향은 유지
   - 2차 선호 카테고리와 새로운 장소를 제한적으로 섞음
   - 완전 랜덤 추천은 사용하지 않음

## Example
느긋한 pace + 높은 휴식 중요도 + 카페/문화/로컬 선호 사용자:

- 🌿 느긋한 취향 코스
- ☕ 카페 · 문화 중심 코스
- ✨ 여유로운 발견 코스

세 일정 모두 `relaxed` pace profile을 사용한다.

## Compatibility
- 내부 `plan.type`의 `slow/full/random` 값은 기존 sessionStorage, deep-link, 저장 여행 호환을 위해 유지했다.
- 신규 UI는 `strategyLabel`, `strategyIcon`, `strategyTag`, `strategyTagline`을 우선 사용한다.
- 과거 저장 데이터에 strategy metadata가 없으면 기존 label로 fallback한다.

## Hard constraints
다음은 개인화와 무관하게 기존과 동일하게 유지된다.

- 운영 종료 장소 제외
- Route feasibility
- 귀가시간 Hard Gate
- 1박2일 Day 1 → 숙소 → Day 2 구조
- 일정 반영 숙소 검증

## Tests
- 기존 Dev1/Dev2/integration/auth tests PASS
- relaxed preference → 3개 strategy 모두 `relaxed` 확인
- 사용자용 label에서 `빽빽`, `랜덤` 고정 label 미사용 확인
- 3개 strategy label 고유성 확인
