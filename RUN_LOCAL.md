# TEUM DEV2 — VSCode 로컬 실행

## 0. 요구 사항

- Node.js 18 이상 권장 (`node -v`)
- 별도 npm 패키지 설치 없음
- VSCode 터미널은 프로젝트 루트(`TEUM_DEV2_DELTA`)에서 실행

## 1. 키 없이 UI/추천 엔진만 테스트

```powershell
npm run dev
```

브라우저:

```text
http://localhost:4173/index.html
```

REST 키가 없으면 이동시간은 `estimated` provider로 계산됩니다. 이 모드에서도 Planner → Result → Detail → Save 흐름을 확인할 수 있습니다.

## 2. Kakao 실제 API 연결

PowerShell에서 한 번만 실행:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-kakao.ps1
```

입력값:

1. Kakao REST API key
2. Kakao JavaScript key

생성 파일:

- `.env.local` — REST API key. Node dev server에서만 읽음
- `js/config/keys.local.js` — 지도 SDK용 JavaScript key

두 파일 모두 `.gitignore` 대상입니다.

이후:

```powershell
npm run dev
```

## 3. Kakao 연결 터미널 진단

`npm run dev`가 실행된 상태에서 VSCode 터미널을 하나 더 열어:

```powershell
npm run smoke:kakao
```

정상이면 다음 네 줄이 PASS로 나옵니다.

```text
PASS  REST API key
PASS  Address geocode
PASS  Public transit route
PASS  Car route
```

## 4. 전체 자동 테스트

```powershell
npm test
```

또는 문법 검사까지 함께:

```powershell
npm run check
```

## 5. 추천 수동 QA

Home에서:

- 위치: `서울시청 · 데모 위치`
- START: 14:00
- RETURN: 19:00
- 교통: 대중교통
- 숙박: OFF
- 취향: 산책 + 문화

정상 기준:

1. Result에 `여유로운 틈 / 빽빽한 틈 / 랜덤 컨셉 틈` 생성
2. 세 일정의 장소/체류시간/테마가 실제로 다름
3. 귀가 시각이 19:00을 넘지 않음
4. 실제 Kakao 연결 시 카드 하단이 `Kakao 경로 · 확인값`
5. 키 없이 실행 시 `이동시간 · 예상값`
6. Detail 지도 렌더링
7. 저장 후 `saved.html`에서 조회/삭제 가능

자세한 화면 QA는 `VSCODE_QA_CHECKLIST.md` 참고.

## 빠른 광주 QA

1. `npm run dev`
2. `http://localhost:4173/index.html`
3. From → `광주 ACC`
4. 당일 → Start `14:00`, Return `19:00`
5. 대중교통 → 내 틈 찾기
6. Kakao Transit이 403이어도 결과 3장이 생성되고 카드에 예상값 fallback이 표시되는지 확인

## 1박2일 QA

1. From → `광주 ACC`
2. 기간 → `1박2일`
3. Start `14:00`, Day 2 Return `19:00`
4. `숙박 포함`이 자동 고정되는지 확인
5. 결과 → 상세에서 `DAY 1 → 숙박 → DAY 2 → 귀환` 흐름 확인
