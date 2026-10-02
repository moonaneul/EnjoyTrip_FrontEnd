import { haversineMeters, hasValidCoordinates } from '../features/recommendation/distance.js';

const IMG = {
  seongsu: 'assets/images/seongsu.svg',
  jongno: 'assets/images/jongno.svg',
  seochon: 'assets/images/seochon.svg',
  hero: 'assets/images/hero.svg',
};

const open = (text = '운영시간 확인됨') => ({ status: 'confirmed_open', text, restDate: null });
const unknown = () => ({ status: 'unknown', text: null, restDate: null });
const closed = (restDate = '오늘 휴무') => ({ status: 'confirmed_closed', text: null, restDate });

const seed = [
  ['p01','12','attraction','서울숲','서울 성동구 뚝섬로 2730',37.5444,127.0374,IMG.seongsu,open('05:30~21:30'),'성수 · 산책'],
  ['p02','14','culture','성수연방','서울 성동구 성수이로14길 14',37.5416,127.0560,IMG.seongsu,open('10:00~22:00'),'성수 · 문화'],
  ['p03','39','food','성수 온기식당','서울 성동구 연무장길',37.5432,127.0527,IMG.seongsu,open('11:30~21:00'),'성수 · 음식'],
  ['p04','39','food','서울숲 티룸','서울 성동구 서울숲2길',37.5464,127.0431,IMG.seongsu,unknown(),'성수 · 카페'],
  ['p05','38','shopping','연무장 편집상점','서울 성동구 연무장길',37.5418,127.0547,IMG.seongsu,open('12:00~20:00'),'성수 · 쇼핑'],
  ['p06','32','lodging','성수 스테이','서울 성동구 왕십리로',37.5481,127.0456,IMG.seongsu,open('체크인 15:00'),'성수 · 숙박'],
  ['p07','12','attraction','경복궁','서울 종로구 사직로 161',37.5796,126.9770,IMG.jongno,open('09:00~18:00'),'종로 · 고궁'],
  ['p08','14','culture','국립현대미술관 서울','서울 종로구 삼청로 30',37.5787,126.9800,IMG.jongno,open('10:00~18:00'),'종로 · 미술관'],
  ['p09','39','food','서촌 한상','서울 종로구 자하문로',37.5790,126.9704,IMG.seochon,open('11:00~21:00'),'서촌 · 음식'],
  ['p10','39','food','통인 찻집','서울 종로구 자하문로15길',37.5808,126.9687,IMG.seochon,unknown(),'서촌 · 카페'],
  ['p11','38','shopping','통인시장','서울 종로구 자하문로15길 18',37.5807,126.9699,IMG.seochon,open('07:00~21:00'),'서촌 · 시장'],
  ['p12','15','event','세종마을 골목행사','서울 종로구 필운대로',37.5780,126.9692,IMG.seochon,closed('행사 종료'),'서촌 · 행사'],
  ['p13','25','course','서촌 골목 산책 코스','서울 종로구 옥인길',37.5820,126.9671,IMG.seochon,open('상시'),'서촌 · 코스'],
  ['p14','32','lodging','한옥 스테이 서촌','서울 종로구 자하문로',37.5818,126.9712,IMG.seochon,open('체크인 16:00'),'서촌 · 숙박'],
  ['p15','14','culture','서울공예박물관','서울 종로구 율곡로3길 4',37.5766,126.9831,IMG.jongno,open('10:00~18:00'),'안국 · 문화'],
  ['p16','12','attraction','청계천 산책로','서울 종로구 청계천로',37.5690,126.9784,IMG.jongno,open('상시'),'종로 · 산책'],
  ['p17','39','food','광장시장 먹거리','서울 종로구 창경궁로 88',37.5701,126.9990,IMG.jongno,open('09:00~22:00'),'종로 · 음식'],
  ['p18','38','shopping','인사동 쌈지길','서울 종로구 인사동길 44',37.5744,126.9849,IMG.jongno,open('10:30~20:30'),'인사동 · 쇼핑'],
  ['p19','14','culture','돈의문박물관마을','서울 종로구 송월길 14-3',37.5683,126.9683,IMG.jongno,unknown(),'서대문 · 문화'],
  ['p20','12','attraction','덕수궁 돌담길','서울 중구 세종대로19길',37.5658,126.9751,IMG.jongno,open('상시'),'시청 · 산책'],
  ['p21','39','food','정동 작은식탁','서울 중구 정동길',37.5667,126.9728,IMG.jongno,open('11:30~20:30'),'정동 · 음식'],
  ['p22','14','culture','서울시립미술관','서울 중구 덕수궁길 61',37.5641,126.9738,IMG.jongno,open('10:00~20:00'),'정동 · 미술관'],
  ['p23','12','attraction','남산골한옥마을','서울 중구 퇴계로34길 28',37.5592,126.9945,IMG.hero,open('09:00~21:00'),'중구 · 한옥'],
  ['p24','39','food','을지로 노포식당','서울 중구 을지로',37.5660,126.9910,IMG.hero,open('11:00~22:00'),'을지로 · 음식'],
  ['p25','38','shopping','을지로 소품상점','서울 중구 을지로',37.5654,126.9900,null,unknown(),'을지로 · 쇼핑'],
  ['p26','15','event','DDP 디자인 전시','서울 중구 을지로 281',37.5665,127.0092,IMG.hero,open('10:00~20:00'),'동대문 · 행사'],
  ['p27','14','culture','DDP 뮤지엄','서울 중구 을지로 281',37.5670,127.0095,IMG.hero,open('10:00~20:00'),'동대문 · 문화'],
  ['p28','12','attraction','한강 여의도공원','서울 영등포구 여의공원로',37.5268,126.9225,IMG.hero,open('상시'),'여의도 · 산책'],
  ['p29','39','food','여의도 브런치','서울 영등포구 국제금융로',37.5248,126.9255,IMG.hero,open('10:00~21:00'),'여의도 · 음식'],
  ['p30','32','lodging','도심 리버 스테이','서울 영등포구 여의대로',37.5259,126.9240,IMG.hero,unknown(),'여의도 · 숙박'],
  ['p31','12','attraction','북촌한옥마을','서울 종로구 계동길',37.5826,126.9830,IMG.seochon,open('10:00~17:00'),'북촌 · 산책'],
  ['p32','39','food','안국 디저트룸','서울 종로구 북촌로',37.5799,126.9862,IMG.seochon,open('11:00~20:00'),'안국 · 카페'],
  ['p33','32','lodging','정동 포스트 스테이','서울 중구 정동길',37.5662,126.9721,IMG.jongno,open('체크인 15:00'),'정동 · 숙박'],
  ['p34','32','lodging','안국 마루 스테이','서울 종로구 율곡로',37.5768,126.9840,IMG.seochon,open('체크인 15:00'),'안국 · 숙박'],
];

const gwangjuSeed = [
  ['g01','14','culture','국립아시아문화전당','광주 동구 문화전당로 38',35.1466,126.9199,IMG.hero,open('10:00~18:00'),'광주 동구 · 문화'],
  ['g02','12','attraction','5·18민주광장','광주 동구 금남로 245',35.1469,126.9185,IMG.hero,open('상시'),'광주 동구 · 산책'],
  ['g03','38','shopping','충장로 거리','광주 동구 충장로',35.1480,126.9137,IMG.hero,open('상시'),'충장로 · 쇼핑'],
  ['g04','39','food','동명동 로컬키친','광주 동구 동명동',35.1507,126.9253,IMG.seongsu,open('11:30~21:00'),'동명동 · 음식'],
  ['g05','39','food','동명동 느린카페','광주 동구 동명동',35.1502,126.9242,IMG.seongsu,unknown(),'동명동 · 카페'],
  ['g06','25','course','동명동 골목 산책','광주 동구 동명동',35.1513,126.9230,IMG.seongsu,open('상시'),'동명동 · 코스'],
  ['g07','12','attraction','양림동 역사문화마을','광주 남구 양림동',35.1402,126.9140,IMG.seochon,open('상시'),'양림동 · 산책'],
  ['g08','14','culture','이이남스튜디오 일대','광주 남구 제중로',35.1394,126.9128,IMG.seochon,unknown(),'양림동 · 문화'],
  ['g09','39','food','양림동 한상','광주 남구 양림동',35.1407,126.9115,IMG.seochon,open('11:00~20:30'),'양림동 · 음식'],
  ['g10','12','attraction','사직공원 전망대','광주 남구 사직길',35.1435,126.9104,IMG.jongno,open('상시'),'사직공원 · 전망'],
  ['g11','14','culture','광주비엔날레전시관','광주 북구 비엔날레로 111',35.1828,126.8894,IMG.jongno,open('10:00~18:00'),'북구 · 문화'],
  ['g12','14','culture','광주시립미술관','광주 북구 하서로 52',35.1830,126.8848,IMG.jongno,open('10:00~18:00'),'북구 · 미술관'],
  ['g13','12','attraction','중외공원','광주 북구 하서로',35.1815,126.8865,IMG.hero,open('상시'),'북구 · 산책'],
  ['g14','12','attraction','5·18기념공원','광주 서구 내방로 152',35.1568,126.8588,IMG.hero,open('상시'),'상무지구 · 산책'],
  ['g15','39','food','상무지구 저녁식탁','광주 서구 상무중앙로',35.1535,126.8510,IMG.hero,open('11:30~22:00'),'상무지구 · 음식'],
  ['g16','38','shopping','상무 로컬마켓','광주 서구 상무중앙로',35.1542,126.8532,null,unknown(),'상무지구 · 쇼핑'],
  ['g17','12','attraction','광주천 산책길','광주 동구 광주천변',35.1460,126.9092,IMG.seochon,open('상시'),'광주천 · 산책'],
  ['g18','39','food','금남로 작은식당','광주 동구 금남로',35.1500,126.9157,IMG.hero,open('11:00~21:00'),'금남로 · 음식'],
  ['g19','15','event','광주 예술의거리 프로그램','광주 동구 예술길',35.1518,126.9194,IMG.hero,closed('오늘 프로그램 없음'),'예술의거리 · 행사'],
  ['g20','32','lodging','광주 동구 시티 스테이','광주 동구 금남로',35.1496,126.9165,IMG.hero,open('체크인 15:00'),'광주 동구 · 숙박'],
  ['g21','32','lodging','상무 어반 스테이','광주 서구 상무중앙로',35.1538,126.8521,IMG.hero,open('체크인 15:00'),'상무지구 · 숙박'],
  ['g22','25','course','무등산 증심사 입구 산책','광주 동구 증심사길',35.1338,126.9546,IMG.hero,open('일몰 전 권장'),'무등산 · 코스'],
  ['g23','39','food','증심사길 산채식당','광주 동구 증심사길',35.1332,126.9520,IMG.hero,open('10:30~20:00'),'무등산 · 음식'],
  ['g24','12','attraction','광주송정역 시장거리','광주 광산구 송정동',35.1388,126.7932,IMG.hero,open('09:00~21:00'),'송정 · 산책'],
  ['g25','39','food','송정 떡갈비 골목','광주 광산구 송정동',35.1398,126.7953,IMG.hero,open('10:30~21:00'),'송정 · 음식'],
  ['g26','32','lodging','양림 한옥 스테이','광주 남구 양림로',35.1404,126.9122,IMG.seochon,open('체크인 16:00'),'양림동 · 숙박'],
  ['g27','32','lodging','동명 로컬 스테이','광주 동구 동명로',35.1508,126.9238,IMG.seongsu,open('체크인 15:00'),'동명동 · 숙박'],
  ['g28','32','lodging','광주천 리버 스테이','광주 동구 광주천변로',35.1464,126.9098,IMG.hero,unknown(),'광주천 · 숙박'],
];

export const MOCK_PLACES = [...seed, ...gwangjuSeed].map(([id, contentTypeId, type, title, address, lat, lng, imageUrl, openInfo, categoryPath]) => ({
  id,
  contentId: id.replace('p', '100'),
  contentTypeId,
  type,
  title,
  address,
  lat,
  lng,
  imageUrl,
  tel: null,
  categoryPath,
  overview: `${title}의 Mock Place 데이터입니다. 통합 단계에서 TourAPI 정규화 결과로 교체합니다.`,
  openInfo,
  raw: { mock: true },
}));

function paginate(items, page = 1, size = 20) {
  const start = Math.max(0, (Number(page) - 1) * Number(size));
  return items.slice(start, start + Number(size));
}

export class MockPlaceProvider {
  async getRegions() {
    return [{ code: '1', name: '서울' }, { code: '5', name: '광주' }];
  }

  async getSubregions() {
    return [];
  }

  async searchPlaces({ type, page = 1, size = 20 } = {}) {
    const filtered = type ? MOCK_PLACES.filter((place) => place.type === type) : MOCK_PLACES;
    return paginate(filtered, page, size);
  }

  async getNearbyPlaces({ lat, lng, radius = 20000, type, page = 1, size = 40 } = {}) {
    const origin = { lat: Number(lat), lng: Number(lng) };
    if (!hasValidCoordinates(origin)) return [];
    const filtered = MOCK_PLACES
      .filter((place) => (!type || place.type === type))
      .map((place) => ({ place, distance: haversineMeters(origin, place) }))
      .filter(({ distance }) => distance <= Number(radius))
      .sort((a, b) => a.distance - b.distance)
      .map(({ place }) => place);
    return paginate(filtered, page, size);
  }

  async getPlaceDetail(contentId, contentTypeId) {
    return MOCK_PLACES.find((place) => place.contentId === String(contentId)
      && (!contentTypeId || place.contentTypeId === String(contentTypeId))) || null;
  }

  async getFoodCandidates(params = {}) {
    return this.getNearbyPlaces({ ...params, type: 'food' });
  }

  async getLodgingCandidates(params = {}) {
    return this.getNearbyPlaces({ ...params, type: 'lodging' });
  }
}

export const mockPlaceProvider = new MockPlaceProvider();
