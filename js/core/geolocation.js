export class GeolocationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeolocationError';
    this.code = code;
  }
}

function normalizeError(error) {
  const codeMap = { 1: 'permission_denied', 2: 'position_unavailable', 3: 'timeout' };
  const code = codeMap[error?.code] || 'unknown';
  const messages = {
    permission_denied: '위치 권한이 거부되었습니다. 수동 위치를 입력해 주세요.',
    position_unavailable: '현재 위치를 확인할 수 없습니다. 수동 위치를 입력해 주세요.',
    timeout: '위치 확인 시간이 초과되었습니다. 다시 시도하거나 수동 위치를 입력해 주세요.',
    unknown: '위치 확인 중 오류가 발생했습니다.',
  };
  return new GeolocationError(code, messages[code]);
}

export function getCurrentOrigin({ timeout = 8000, maximumAge = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) {
      reject(new GeolocationError('unsupported', '이 브라우저는 위치 기능을 지원하지 않습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        source: 'geolocation',
        label: '현재 위치',
        lat: Number(position.coords.latitude),
        lng: Number(position.coords.longitude),
      }),
      (error) => reject(normalizeError(error)),
      { enableHighAccuracy: false, timeout, maximumAge },
    );
  });
}
