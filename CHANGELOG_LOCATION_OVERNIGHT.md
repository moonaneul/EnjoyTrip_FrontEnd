# DEV2 Update — Location Picker / Gwangju / 1박2일

## 변경 이유
- From 클릭 시 GPS가 즉시 실행되어 사용자가 출발지를 고를 수 없던 문제
- Mock fixture가 서울에만 있어 광주 현재 위치에서 후보가 0개였던 문제
- Kakao Transit/Local 403이 발생하면 추천 전체가 0개가 되던 문제
- 당일 일정만 지원하던 제한

## 변경 사항
1. Location Picker
   - From 클릭은 선택 패널만 연다.
   - GPS는 `현재 위치 사용`을 눌렀을 때만 실행한다.
   - 지역/장소 검색, 빠른 선택, 좌표 직접 입력을 지원한다.
   - Kakao geocode 실패 시에도 광주/서울 offline quick-origin과 좌표 입력으로 진행 가능하다.

2. 광주 MockPlaceProvider
   - ACC, 충장로, 동명동, 양림동, 사직공원, 비엔날레/시립미술관, 상무지구, 무등산, 송정권과 음식/숙박 fixture 추가.

3. Route fallback
   - KakaoRouteProvider 자체는 실패 시 unavailable을 유지한다.
   - 사용자 추천 흐름에서는 FallbackRouteProvider가 unavailable을 EstimatedRouteProvider로 대체한다.
   - UI에 확인값 / 예상값 / Kakao 실패 fallback을 구분해 표시한다.

4. 실패 진단
   - NO_CANDIDATES / ROUTE_UNAVAILABLE / NO_LODGING / WINDOW_TOO_SHORT를 분리한다.
   - Result 하단에 발견 후보, shortlist, 경로 통과, confirmed/estimated/unavailable 통계를 표시한다.

5. 1박2일
   - 당일 / 1박2일 선택 추가.
   - 1박2일 선택 시 숙박 필수.
   - Day 1 관광 → 숙소(22:30 이전) → Day 2 09:30 전후 출발 → 관광 → 원래 출발지 귀환.
   - Day 2 Return을 최종 Hard Gate로 사용.
   - Result / Detail Timeline / Saved Trip 모두 2일 구조를 표시한다.

## 자동 테스트 결과
- 서울 당일 5h: 3안
- 서울 2.5h micro trip: 1안 이상
- 광주 당일 5h: 3안
- Kakao Transit 강제 HTTP 403: estimated fallback 후 광주 3안 유지
- 광주 1박2일: slow/full/random 3안, 각 Day 1 + 숙박 + Day 2 + 귀환
- 2박 이상 입력: validation reject
- F104 저장/삭제/손상 복구: pass
