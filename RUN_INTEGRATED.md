# RUN_INTEGRATED

## PowerShell

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-integrated-keys.ps1
npm run check
npm run dev
```

브라우저:

```text
http://localhost:4173/index.html
```

새 PowerShell 터미널:

```powershell
npm run smoke:kakao
npm run smoke:tour
```

## 최초 통합 QA 권장 순서

1. `signup.html` 회원가입
2. 자동 로그인 후 `onboarding.html` 진입 확인
3. 취향 설문 완료
4. `index.html`에서 광주/서울 출발지 선택
5. 당일 5시간 대중교통 추천
6. Result 3안의 추천 이유 확인
7. 1박2일 생성
8. 숙소 후보를 각각 선택해 일정 변경 확인
9. 상세에서 저장
10. `saved.html`에서 현재 계정 저장만 표시 확인
11. `mypage.html`에서 여행 취향 수정
12. 같은 조건을 다시 추천해 결과가 달라지는지 확인

## 키 파일 주의

절대 공유하지 않음:

```text
.env.local
js/config/keys.local.js
```
