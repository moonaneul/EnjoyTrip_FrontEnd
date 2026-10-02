# DEV1 INTEGRATION REQUEST

> 아래 항목은 Dev1 소유 파일을 더 개발하는 요청이 아니라 **통합 담당/Dev2 소유 영역의 bridge 작업**이다.

## P0 — 반드시 통합 시 반영

### 1. `index.html` MY 링크
현재 Dev2 소유 `index.html`:
```html
<a class="my-pill" href="#" aria-label="마이 페이지">MY</a>
```

통합본:
```html
<a class="my-pill" href="mypage.html" aria-label="마이 페이지">MY</a>
```

실제 QA에서 `href="#"` 때문에 MY 클릭 시 MyPage로 이동하지 않는 것을 확인했다.

### 2. `index.html` 여행지 둘러보기 bridge
현재:
```html
<a class="header-link" href="index.html#explore">여행지 둘러보기</a>
```

F101~F103 실제 탐색 화면으로 연결하려면 통합 담당이 다음 링크를 검토/적용:
```html
<a class="header-link" href="explore.html">여행지 둘러보기</a>
```

### 3. Recommendation provider swap
Dev2가 mock Tour provider를 사용 중이면 통합 단계에서만 real provider로 교체:
```js
import { placeProvider } from './js/api/tourApi.js';
```

`generatePlans()` 내부 추천 알고리즘 자체는 rewrite하지 않는다.
TourAPI raw response 직접 참조 금지. `Place` contract만 사용.

### 4. Auth ↔ Saved trip bridge
Dev1:
```js
import { getCurrentUser } from './js/core/authStorage.js';
const ownerUserId = getCurrentUser()?.id ?? null;
```

Dev2 `teum.trips.v1` 저장 시 `ownerUserId`에 연결.

**미결정:** 비로그인 저장을 허용할지, 로그인으로 유도할지는 팀 결정 후 적용. 임의 결정 금지.

## P1 — 통합 일관성

### 5. Header auth state
통합 담당이 Dev2 페이지의 header 상태를 정리:
- 비로그인: 로그인/회원가입 또는 팀이 정한 guest nav
- 로그인: MY 접근 가능
- 로그아웃 후 session이 없는 상태에서 개인정보 화면 재노출 금지

Dev1 `mypage.html`은 자체 logout 및 BFCache guard 구현 완료.

### 6. Kakao 연결
지도 marker/route가 장소 데이터를 사용할 때:
```js
place.lat
place.lng
```
를 사용한다. TourAPI `mapx/mapy` raw field를 Dev2에서 직접 읽지 않는다.

### 7. Shared key setup
통합 workspace에 다음 shared local config 체계를 유지:
```text
js/config/keys.example.js   // 공유 가능
js/config/keys.local.js     // 로컬 전용, Git/ZIP 금지
```

`.gitignore`에 반드시:
```text
js/config/keys.local.js
```

개발 과정에서 기존 TourAPI key가 화면에 노출된 이력이 있으므로 **키 재발급 권장**.

## Ownership note
Dev1은 위 요청을 해결하기 위해 Dev2 소유 `index.html` 등을 직접 수정하지 않았다.
통합 담당만 navigation/contract bridge를 수정한다.
