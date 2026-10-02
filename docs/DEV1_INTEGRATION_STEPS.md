# INTEGRATION STEPS

## 0. Inputs
필요한 입력:
```text
clean final_design_postcard_v2 (또는 팀이 정한 clean integration base)
DEV1_FINAL_DELTA/
DEV2_DELTA/
DEV1_REPORT_FINAL.md
DEV2_REPORT
```

`TEUM_DEV1_FINAL_SAFE_WORKSPACE.zip`은 참고/재현용 snapshot이지 **overlay용 Delta가 아니다**.

---

## 1. Ownership collision scan — 먼저 실행
두 Delta의 상대경로를 비교한다.

이 패키지의 `merge_collision_check.py` 사용:
```bash
python merge_collision_check.py DEV1_FINAL_DELTA <DEV2_DELTA_FOLDER>
```

정상:
```text
PASS: no relative-path collisions
```

동일 상대경로가 하나라도 있으면:
- 자동 overwrite 금지
- 즉시 merge 중지
- ownership matrix 기준으로 owner 확인

---

## 2. Clean base 준비
기존 개발 폴더 위에서 무작정 복사하지 말고, 통합용 clean branch/folder를 만든다.

권장:
```text
integration/
  index.html
  css/
  js/
  ...
```

---

## 3. Dev1 Delta overlay
`DEV1_FINAL_DELTA/` 안의 **내용물**을 integration root에 상대경로 그대로 복사한다.

예:
```text
DEV1_FINAL_DELTA/explore.html
→ integration/explore.html

DEV1_FINAL_DELTA/js/api/tourApi.js
→ integration/js/api/tourApi.js
```

`DEV1_FINAL_DELTA`라는 폴더 자체를 integration 안에 중첩시키지 않는다.

---

## 4. Dev2 Delta overlay
동일 방식으로 Dev2 Delta를 overlay한다.

STEP 1 collision scan이 PASS한 경우에만 진행.

---

## 5. Shared local config
Integration base에 없으면 공유용 예제 파일을 준비:
```js
// js/config/keys.example.js
export const DATA_GO_KR_API_KEY = 'YOUR_DATA_GO_KR_DECODING_KEY';
```

각 개발 PC에서만:
```js
// js/config/keys.local.js
export const DATA_GO_KR_API_KEY = '재발급한_실제키';
```

`.gitignore`:
```text
js/config/keys.local.js
```

**실제 키 파일은 commit/ZIP/메신저 공유 금지.**

---

## 6. Navigation bridge — Integration owner only
`DEV1_INTEGRATION_REQUEST.md` 반영.

최소:
```diff
- <a class="my-pill" href="#" ...>MY</a>
+ <a class="my-pill" href="mypage.html" ...>MY</a>
```

그리고 index의 `여행지 둘러보기`가 실제 F101~F103 화면인 `explore.html`로 이동하도록 연결.

---

## 7. Provider swap
Dev2 추천 기능의 mock Tour provider만 실제 provider로 교체.

```js
import { placeProvider } from './js/api/tourApi.js';
```

유지해야 할 규칙:
- Recommendation 알고리즘 큰 rewrite 금지
- `Place.raw` 또는 TourAPI raw field 직접 의존 금지
- 좌표는 `place.lat / place.lng`
- 없는 optional 값은 null 가능성을 처리

---

## 8. Auth ↔ saved bridge
현재 사용자:
```js
import { getCurrentUser } from './js/core/authStorage.js';
const user = getCurrentUser();
```

저장 시:
```js
ownerUserId: user?.id ?? null
```

팀 결정 필요:
- guest 저장 허용
- 또는 비로그인 시 로그인 유도

결정 전 임의 구현 금지.

---

## 9. CSS / Bootstrap load order
Frozen `css/style.css` 수정 금지.

Auth 페이지처럼 Bootstrap을 쓰는 페이지는:
1. Bootstrap CSS
2. `css/style.css`
3. page CSS

Dev1 page CSS:
```text
css/pages/explore.css
css/pages/auth.css
```

---

## 10. Post-merge smoke
### Tour
1. 시도 조회
2. 서울 → 구군
3. 관광/문화/행사/코스/숙박/쇼핑/음식
4. 카드 클릭 → Place detail
5. 뒤로가기/목록복귀 filter 유지

지원 테스트:
```text
DEV1_SUPPORT_TESTS/tourapi-live-smoke.html
```
필요 시 integration root의 `tests/`로 복사하여 사용한다.

### Auth
1. signup
2. duplicate email
3. login fail/success
4. mypage edit
5. password reset/change Demo
6. logout
7. logout 후 browser back 개인정보 미노출
8. delete account

---

## 11. Full contract regression
Dev2 추천 한 번 실행해서 다음을 확인:
- `Place.id/contentId/contentTypeId`
- `Place.type`
- `lat/lng Number|null`
- no-image 장소
- 운영정보 null/unknown
- food/lodging 후보

Kakao:
- marker가 `lat/lng`를 사용
- provider 실패 시 fake data 생성하지 않음

---

## 12. Responsive regression
통합본에서 최소:
```text
1440
1024
768
390
375
```

확인:
- header nav
- planner
- explore card grid
- place detail
- auth form/modal
- result/detail/saved

---

## 13. Final acceptance
다음을 모두 만족하면 통합 완료:
- Delta path collision 0
- Frozen style 변경 없음
- 실제 API key repository 0
- F101/F102/F103 PASS
- F107/F108 PASS
- Dev2 필수 기능 PASS
- mock → real provider swap PASS
- MY/explore navigation PASS
- Auth/Saved owner bridge 정책 반영
- 5개 viewport regression PASS
