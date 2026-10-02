# DESIGN NOTES — v2

## 유지한 것
- POSTCARD STACK
- Warm Cream / Coral / Sage / Lavender
- 큰 이미지 + 종이 카드 느낌
- Desktop 3-card comparison
- Mobile horizontal postcard browsing

## 다듬은 핵심
1. 카드에서 **출발·귀가 → 소요시간 → 비용 → 코스** 순으로 바로 읽히도록 계층 강화.
2. Card height를 일정하게 유지하고 CTA를 항상 하단으로 정렬.
3. Planner를 일반 폼이 아니라 여행 조건을 빠르게 선택하는 compact control로 수정.
4. Home의 감성은 유지하면서 Result/Detail에서는 실제 여행 가능성을 더 강하게 표현.
5. Mobile에서 3장을 세로로 쌓지 않고 snap carousel 유지.
6. 상세 화면의 Timeline에 이동 자체도 정보로 포함.
7. 지도는 일정의 보조 정보로 유지.

## 다음 개발 연결 시
- SVG 이미지를 TourAPI 이미지 URL로 교체.
- Dummy 장소/시간을 실제 추천 결과로 렌더링.
- `.map-placeholder`를 Kakao Map container로 교체.
- 대중교통/예상요금은 Kakao 응답으로 대체.
- 숙박 toggle이 켜지면 Result card의 `RETURN` 대신 체크인 정보 variant를 사용.
