# TEUM DEV2 — Kakao Local Setup

작성 기준: 2026-10-02

## 구조

```text
Browser
  ├─ Kakao Maps JS SDK ← JavaScript key
  └─ /api/kakao/*      ← same-origin request
          ↓
     dev-server.mjs
          ↓ REST key (.env.local)
     Kakao REST / Kakao Mobility
```

REST API 키를 `keys.local.js`에 넣지 않는 것을 기본 경로로 합니다.

## Kakao Developers 설정

1. Kakao Developers에서 앱을 생성/선택합니다.
2. `[카카오맵] > [사용 설정]`에서 카카오맵 API 상태를 ON으로 설정합니다.
3. `[앱] > [플랫폼 키] > [REST API 키]`에서 REST API 키를 확인합니다.
4. `[앱] > [플랫폼 키] > [JavaScript 키]`에서 JavaScript 키를 확인합니다.
5. 해당 JavaScript 키의 `JavaScript SDK 도메인`에 아래를 등록합니다.

```text
http://localhost:4173
```

실서비스 배포 시에는 실제 서비스 도메인도 별도로 등록합니다.

## 2026 Kakao Map 정책 주의

2026-07-21부터 Kakao Map API 사용 절차와 무료 쿼터 정책이 변경되었습니다. 개발자 계정에서 카카오맵 API를 처음 활성화한 앱에 무료 쿼터가 적용되며, 두 번째 활성화 앱부터는 비즈월렛/유료 API 설정이 필요할 수 있습니다. 앱 관리 화면에서 `Kakao Map free quota` 적용 여부를 확인하세요.

대중교통 경로 조회 API는 별도 기능 쿼터를 가지므로 앱/테스트앱 상태와 일간 한도도 확인해야 합니다.

## 로컬 파일

### `.env.local`

```dotenv
KAKAO_REST_API_KEY=YOUR_REST_API_KEY
```

### `js/config/keys.local.js`

```js
export const TEUM_KEYS = {
  kakaoRestApiKey: '',
  kakaoJavaScriptKey: 'YOUR_JAVASCRIPT_KEY',
  kakaoApiProxyBaseUrl: '',
  hasKakaoRestApiKey: false,
};
```

직접 작성할 필요 없이 Windows에서는 다음 명령을 권장합니다.

```powershell
.\scripts\setup-kakao.ps1
```

## 왜 로컬 프록시를 쓰는가

- REST API 키를 브라우저 번들/소스에 직접 노출하지 않음
- Kakao Mobility 자동차 길찾기의 브라우저 CORS 환경 차이를 로컬 QA에서 제거
- 실제 배포 시 backend/serverless proxy로 교체하기 쉬움

`dev-server.mjs`는 개발 전용입니다. 배포 시 REST 키를 정적 파일에 넣지 말고 서버/서버리스 환경변수로 옮겨야 합니다.
