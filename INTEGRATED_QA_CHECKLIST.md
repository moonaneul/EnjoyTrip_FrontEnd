# INTEGRATED QA CHECKLIST

## A. Merge / static
- [x] Dev1 vs Dev2 relative path collision 0
- [x] `css/style.css` frozen SHA-256 유지
- [x] JS/MJS syntax check
- [x] Dev2 domain regression
- [x] Dev1 placeNormalizer fixtures
- [x] Integration provider/preference tests
- [x] Auth + preference + trip ownership tests
- [x] local HTML/CSS/JS/image references missing 0
- [x] 실제 key 파일 패키지 미포함

## B. Browser — Auth + onboarding
- [ ] 회원가입 성공 후 자동 로그인
- [ ] 최초 가입자는 onboarding 이동
- [ ] 6-step 설문 완료
- [ ] 재로그인 시 설문 반복 안 함
- [ ] MyPage에서 취향 수정
- [ ] 회원 탈퇴 후 preference/trip data 제거

## C. TourAPI
- [ ] `npm run smoke:tour` PASS
- [ ] Explore 7개 카테고리 실데이터
- [ ] Recommendation이 실제 주변 관광지 사용
- [ ] 음식 후보가 현재 위치 기반
- [ ] 숙박 후보가 현재 위치 기반

## D. Kakao
- [ ] `npm run smoke:kakao`
- [ ] Address geocode
- [ ] Reverse geocode
- [ ] Public transit
- [ ] Car
- [ ] Walking은 환경에 따라 WARN 허용

## E. Personalization
- [ ] 문화 선호 프로필에서 문화/전시 비중 증가
- [ ] 음식/카페 선호 프로필에서 음식 후보 비중 증가
- [ ] `산책/카페/문화` mood는 이번 여행에만 반영
- [ ] Slow / Full / Random 성격 유지
- [ ] Random은 완전 무작위가 아닌 취향 경계 내 탐색
- [ ] Preference와 무관하게 귀가 Hard Gate 유지

## F. Saved trip ownership
- [ ] 로그인 사용자 저장에 ownerUserId 기록
- [ ] 다른 로컬 계정의 저장 일정 미노출
- [ ] Guest는 guest 저장만 표시

## G. Responsive
- [ ] 1440
- [ ] 1024
- [ ] 768
- [ ] 390
- [ ] 375
