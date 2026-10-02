# Location label / Kakao marker / Walking 404 fix

- GPS 현재 위치 선택 시 Kakao 좌표→주소 역지오코딩으로 `FROM`에 실제 지역명을 표시합니다.
- 역지오코딩 실패 시 위경도를 표시해 `현재 위치`라는 모호한 문구를 남기지 않습니다.
- Kakao InfoWindow의 기본 removable close image가 전역 `img{width:100%;height:100%}`에 의해 거대 X로 확대되던 충돌을 제거했습니다. InfoWindow는 지도 클릭으로 닫습니다.
- `/api/kakao/reverse-geocode` 프록시를 추가했습니다.
- 도보 API가 HTTP 404를 반환하면 해당 실행에서 도보 엔드포인트를 비활성화하고 반복 호출하지 않습니다. 추천은 거리 기반 예상값으로 계속됩니다.
- `smoke:kakao`에서 Walking 404는 전체 Kakao 연동 실패가 아니라 optional WARN으로 표시합니다.
