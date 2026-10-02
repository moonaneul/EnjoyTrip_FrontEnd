# DEV1 TEST CHECKLIST — FINAL

## Foundation
- [x] `css/style.css` Frozen 유지
- [x] HTTP ES module / timeout / AbortController / error handling
- [x] Place normalizer fixture
- [x] PlaceProvider contract
- [x] 실제 키는 로컬 파일로 분리
- [x] debug/error URL serviceKey redaction

## F101
- [x] 시도 조회
- [x] 시군구 cascade
- [x] 지역 관광지 조회
- [x] Loading / Result / Empty / Error / Retry
- [x] 실제 시도 16개 / 서울 코드 11 확인
- [x] 서울 구군 25개 확인

## F102/F103 — 7 types
- [x] 관광 12
- [x] 문화 14
- [x] 행사 15
- [x] 코스 25
- [x] 숙박 32
- [x] 쇼핑 38
- [x] 음식 39
- [x] 실제 `areaBasedList2` 7타입 live PASS

## Place detail
- [x] `detailCommon2 + detailIntro2`
- [x] 7타입 live detail PASS 7 / WARN 0 / FAIL 0
- [x] no-image fallback
- [x] broken-image fallback
- [x] optional 전화/주소/설명 처리
- [x] 운영시간 없을 때 확인 필요 fallback
- [x] 영업상태 추측 금지

## Explore UI
- [x] 실제 카드 렌더링
- [x] 더보기
- [x] stale-response guard
- [x] 상세 → 목록 filter 복원
- [x] loading/result 동시 노출 버그 수정 및 재검증

## F107
- [x] 회원가입 validation
- [x] 정상 가입
- [x] 중복 이메일
- [x] 회원 조회
- [x] 회원정보 수정
- [x] 비밀번호 변경 Demo
- [x] 회원 탈퇴
- [x] corrupted LocalStorage recovery

## F108
- [x] 정상 로그인
- [x] 잘못된 비밀번호 실패
- [x] 존재하지 않는 이메일 실패
- [x] session 생성
- [x] logout
- [x] password reset Demo
- [x] Front-end Demo 고지
- [x] logout 후 직접 MyPage 접근 차단
- [x] logout 후 뒤로가기 BFCache 개인정보 재노출 방지

## Bootstrap evidence
- [x] Password reset Modal
- [x] Delete account Modal
- [x] Toast

## Responsive
- [x] 1440
- [x] 1024
- [x] 768
- [x] 390
- [x] 375

## Integration regression — merge 후 다시 확인
- [ ] Dev1/Dev2 Delta 동일 상대경로 0개
- [ ] `index.html` navigation bridge
- [ ] Dev2 mock → real `placeProvider` swap
- [ ] Planner/Recommendation에서 Place contract only 사용
- [ ] Kakao marker에 `Place.lat/lng` 연결
- [ ] 로그인 user ID ↔ `trip.ownerUserId` 정책 적용
- [ ] 새 TourAPI key로 live smoke
- [ ] 통합본 Explore → Place
- [ ] 통합본 Planner → Recommendation → Result
- [ ] 통합본 Save/My/Auth
- [ ] 통합본 1440/1024/768/390/375 regression
