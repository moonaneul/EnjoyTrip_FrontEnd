export const PLACE_FIXTURES = Object.freeze({
  attraction: {
    raw: {
      contentid: '126128',
      contenttypeid: '12',
      title: '동촌유원지',
      addr1: '대구광역시 동구 효목동',
      addr2: '산 234-29',
      mapx: '128.6506352387',
      mapy: '35.8826195757',
      firstimage: 'https://example.com/place.jpg',
      tel: '',
      overview: '강변에 있는 <b>유원지</b>입니다.<br>산책할 수 있습니다.',
    },
    intro: {
      usetime: '상시 개방',
      restdate: '연중무휴',
    },
  },
  foodWithoutImage: {
    raw: {
      contentid: '3094599',
      contenttypeid: '39',
      title: '동원집',
      addr1: '서울특별시 중구 퇴계로27길 48',
      mapx: '126.9913616044',
      mapy: '37.5633937314',
      firstimage: '',
      tel: '',
    },
    intro: {
      opentimefood: '10:00~21:00',
      restdatefood: '매주 일요일',
    },
  },
  malformedCoordinates: {
    raw: {
      contentid: 'bad-coord',
      contenttypeid: '38',
      title: '좌표 없는 쇼핑 장소',
      mapx: 'not-a-number',
      mapy: '',
    },
    intro: {},
  },
});
