# TEUM DEV2 — VSCode Browser QA Checklist

## A. 시작 전

- [ ] `node -v`가 18 이상
- [ ] `npm run check` PASS
- [ ] `npm run dev` 실행
- [ ] `http://localhost:4173/index.html` 접속
- [ ] 실제 Kakao 테스트 시 `npm run smoke:kakao` 4개 PASS

## B. Home / Planner

### B1. Demo origin
- [ ] `서울시청 · 데모 위치` 적용
- [ ] 위치 상태 문구 표시
- [ ] 14:00 → 19:00 입력 가능
- [ ] 대중교통/자차 세그먼트 전환
- [ ] 숙박 toggle 전환
- [ ] mood chip 복수 선택

### B2. Geolocation
- [ ] 위치 허용 시 현재 좌표 설정
- [ ] 위치 거부 시 수동 입력 UI 표시
- [ ] 수동 위도/경도 적용
- [ ] 실제 Kakao REST 연결 시 주소만 입력해 좌표 변환

### B3. Validation
- [ ] START >= RETURN이면 Result로 이동하지 않음
- [ ] origin이 없으면 위치 획득 또는 수동 fallback

## C. Result

14:00–19:00 / 서울시청 / 대중교통 / 숙박 OFF 기준:

- [ ] 최소 1개 이상 일정 생성
- [ ] 정상 기본 케이스는 slow/full/random 3안
- [ ] slow 장소 수 <= full 장소 수
- [ ] random theme 표시
- [ ] 세 안이 단순 색상 차이가 아니라 장소/체류/테마가 다름
- [ ] 카드 Start/Return 표시
- [ ] Return이 19:00 초과하지 않음
- [ ] closed fixture가 추천에 들어가지 않음
- [ ] unknown 운영시간 장소는 경고 표시
- [ ] 실제 Kakao route면 `Kakao 경로 · 확인값`
- [ ] 키가 없으면 `이동시간 · 예상값`

### 짧은 틈

15:00–17:30으로 변경:

- [ ] micro trip 최소 1안 생성
- [ ] 17:30 Return 초과 없음

## D. Car

- [ ] 교통을 자차로 변경
- [ ] 실제 Kakao smoke의 `Car route` PASS
- [ ] Result에서 이동 거리가 km로 표시
- [ ] 자동차 요금을 임의 계산하지 않음

## E. Accommodation

- [ ] 숙박 ON
- [ ] 생성된 일정에 lodging 존재
- [ ] Detail에서 귀가 대신 체크인 기준 안내
- [ ] 숙소 이동까지 시간 검증

## F. Detail

- [ ] 선택한 plan과 상세 페이지가 일치
- [ ] Timeline 순서가 이동/장소/귀가 또는 체크인 흐름과 일치
- [ ] 여행 소요시간/장소수/이동시간 표시
- [ ] 실제 JavaScript key 설정 시 Kakao Map 렌더링
- [ ] key 미설정 시 map fallback 문구
- [ ] 경고 목록 렌더링

## G. Save F104

- [ ] Detail 저장 클릭
- [ ] `saved.html`에서 카드 확인
- [ ] Detail 재진입 가능
- [ ] 삭제 가능
- [ ] DevTools에서 `localStorage.getItem('teum.trips.v1')` 확인

## H. Responsive

각 viewport에서 확인:

- [ ] 1440px
- [ ] 1024px
- [ ] 768px
- [ ] 390px
- [ ] 375px

특히 모바일:

- [ ] Postcard horizontal snap
- [ ] 진행 dot 정상
- [ ] 가로 스크롤 때문에 페이지 전체가 깨지지 않음
- [ ] CTA 터치 영역 충분
- [ ] Timeline/Map 겹침 없음

## I. DevTools 오류

Console:

- [ ] uncaught error 없음
- [ ] module 404 없음
- [ ] Kakao SDK domain error 없음
- [ ] API 401/403 없음
- [ ] 대중교통 code -10 발생 시 Kakao 앱 쿼터/활성화 상태 확인

Network:

- [ ] `/api/runtime-config` 200
- [ ] `/api/kakao/geocode` 200 (실키 사용 시)
- [ ] `/api/kakao/transit` 200 (실키 사용 시)
- [ ] `/api/kakao/car` 200 (실키 사용 시)

## 2026-10-02 Location Picker + 1박2일 추가 QA

### 출발지
- [ ] `From` 클릭만으로 GPS 권한 팝업이 뜨지 않는다.
- [ ] `현재 위치 사용`을 눌렀을 때만 Geolocation이 실행된다.
- [ ] 빠른 선택 `광주 ACC`, `광주 시청`, `광주송정역`, `서울시청`이 각각 적용된다.
- [ ] `광주 충장로`, `국립아시아문화전당` 검색은 Kakao Local이 실패해도 offline quick-origin으로 광주 중심을 선택한다.
- [ ] 임의 주소의 Kakao geocode가 실패하면 좌표 직접 입력으로 계속 진행할 수 있다.

### 광주 당일 5시간
- [ ] 광주 ACC / 14:00 / 19:00 / 대중교통에서 3안이 생성된다.
- [ ] 대중교통 API가 403이어도 카드에 `예상값 fallback`이 표시되고 일정은 생성된다.
- [ ] 추천 장소가 서울이 아니라 광주 fixture로 구성된다.
- [ ] 최종 귀가가 19:00을 넘지 않는다.

### 1박2일
- [ ] `1박2일` 선택 시 `숙박 포함`이 강제되고 Day 2 Return으로 레이블이 변경된다.
- [ ] Result 카드에 Day 1 / 숙박 / Day 2 코스가 보인다.
- [ ] Detail Timeline에 DAY 1, 숙박, DAY 2 구분이 보인다.
- [ ] Day 1 숙소 도착은 22:30 이전이다.
- [ ] Day 2 최종 귀가가 사용자가 선택한 Return을 넘지 않는다.
- [ ] Saved Trip에 `1박2일`이 보이고 다시 열었을 때 Day 2 날짜가 복구된다.

## 2026-10-02 Full QA P1 추가 확인

- [ ] 홈 예시 엽서 클릭 시 빈 상세 페이지가 아니라 Planner로 이동/안내된다.
- [ ] `전남대학교`처럼 주소가 아닌 장소명을 검색해도 출발지로 적용된다.
- [ ] `npm run smoke:kakao`에 `Keyword place search`가 PASS한다.
- [ ] 도보 fallback 구간이 Timeline에서 `도보`로 표시된다.
- [ ] 1박2일에서 음식점이 같은 Day에 연속 2개 붙지 않는다.
- [ ] 1박2일에서 숙소 후보 5곳이 모두 일정 variant로 전환 가능하다.
- [ ] 390/375px에서 마지막 숙소 카드가 하단 고정 Save CTA에 가려지지 않는다.
- [ ] Kakao 지도 실패 시 실제 원인과 무관하게 `키가 없다`고 단정하지 않는다.
