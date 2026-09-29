// 사주팔자(四柱八字) 정밀 계산.
// 실제 간지(干支)는 js/vendor/lunar.js(검증된 만세력 라이브러리, 절기·율리우스일 기반)로 계산하고,
// 결과를 한글로 표기하는 부분만 이 파일에서 직접 담당한다.
// Claude에게는 "계산해달라"고 하지 않고, 여기서 계산이 끝난 정확한 간지를 그대로 넘겨서
// 해석(글쓰기)만 맡긴다 — LLM이 날짜 연산을 틀리는 문제를 원천 차단하기 위함.

const GAN_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const GAN_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
// 갑을=목, 병정=화, 무기=토, 경신=금, 임계=수 (index // 2 로 산출)
const WUXING_KO_BY_ELEMENT = ["목", "화", "토", "금", "수"];

const ZHI_KO = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const ZHI_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ZHI_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]; // 각 지지의 오행 index (WUXING_KO_BY_ELEMENT 기준)
const ZODIAC_KO = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];

function ganWuxing(ganIndex) {
  return WUXING_KO_BY_ELEMENT[Math.floor(ganIndex / 2)];
}

function zhiWuxing(zhiIndex) {
  return WUXING_KO_BY_ELEMENT[ZHI_ELEMENT[zhiIndex]];
}

// 갑자(甲子)부터 시작하는 60갑자 순번(0~59)을 역산: n%10=간, n%12=지를 만족하는 n.
function jiaZiIndex(ganIndex, zhiIndex) {
  for (let n = 0; n < 60; n++) {
    if (n % 10 === ganIndex && n % 12 === zhiIndex) return n;
  }
  return -1;
}

function pillarInfo(ganIndex, zhiIndex) {
  return {
    ganIndex,
    zhiIndex,
    gan: GAN_KO[ganIndex],
    zhi: ZHI_KO[zhiIndex],
    ganHanja: GAN_HANJA[ganIndex],
    zhiHanja: ZHI_HANJA[zhiIndex],
    ganZhiKo: GAN_KO[ganIndex] + ZHI_KO[zhiIndex],
    ganZhiHanja: GAN_HANJA[ganIndex] + ZHI_HANJA[zhiIndex],
    ganWuxing: ganWuxing(ganIndex),
    zhiWuxing: zhiWuxing(zhiIndex),
  };
}

// 십신(十神): 일간(日干)을 기준으로 다른 천간이 어떤 관계인지 계산.
// 오행 상생: 목→화→토→금→수→목 / 상극: 목→토→화→금→목(즉 +2)
function tenGod(dayGanIndex, targetGanIndex) {
  const dayElement = Math.floor(dayGanIndex / 2);
  const targetElement = Math.floor(targetGanIndex / 2);
  const samePolarity = dayGanIndex % 2 === targetGanIndex % 2;

  if (targetElement === dayElement) return samePolarity ? "비견" : "겁재";
  if ((dayElement + 1) % 5 === targetElement) return samePolarity ? "식신" : "상관";
  if ((dayElement + 2) % 5 === targetElement) return samePolarity ? "편재" : "정재";
  if ((targetElement + 2) % 5 === dayElement) return samePolarity ? "편관" : "정관";
  if ((targetElement + 1) % 5 === dayElement) return samePolarity ? "편인" : "정인";
  return "-";
}

function parseDate(birthDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((birthDate || "").trim());
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function parseTime(birthTime) {
  const m = /^(\d{2}):(\d{2})$/.exec((birthTime || "").trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

// person: { calendarType, birthDate, birthTime, timeUnknown }
// 만세력 변환(양력↔음력, EightChar 생성)은 computeBazi와 computeDaewoon이 공통으로 쓰므로 분리.
function resolvePersonLunar(person) {
  if (typeof window === "undefined" || !window.Solar || !window.Lunar) {
    return { ok: false, error: "사주 계산 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요." };
  }

  const date = parseDate(person.birthDate);
  if (!date) {
    return { ok: false, error: "생년월일 형식을 확인할 수 없어요." };
  }

  const timeKnown = !person.timeUnknown && !!person.birthTime;
  let hour = 12,
    minute = 0;
  if (timeKnown) {
    const t = parseTime(person.birthTime);
    if (!t) return { ok: false, error: "출생 시각 형식을 확인할 수 없어요." };
    hour = t.hour;
    minute = t.minute;
  }

  let lunar, solar;
  try {
    if (person.calendarType === "lunar") {
      lunar = window.Lunar.fromYmdHms(date.year, date.month, date.day, hour, minute, 0);
      solar = lunar.getSolar();
    } else {
      solar = window.Solar.fromYmdHms(date.year, date.month, date.day, hour, minute, 0);
      lunar = solar.getLunar();
    }
  } catch (err) {
    return { ok: false, error: "생년월일을 사주로 변환하지 못했어요. 날짜를 다시 확인해주세요." };
  }

  return { ok: true, timeKnown, hour, minute, lunar, solar, eightChar: lunar.getEightChar() };
}

export function computeBazi(person) {
  const resolved = resolvePersonLunar(person);
  if (!resolved.ok) return resolved;
  const { timeKnown, lunar, solar, eightChar } = resolved;

  const year = pillarInfo(lunar.getYearGanIndexExact(), lunar.getYearZhiIndexExact());
  const month = pillarInfo(lunar.getMonthGanIndexExact(), lunar.getMonthZhiIndexExact());
  const day = pillarInfo(eightChar.getDayGanIndex(), eightChar.getDayZhiIndex());
  const time = timeKnown ? pillarInfo(lunar.getTimeGanIndex(), lunar.getTimeZhiIndex()) : null;

  const pillars = { year, month, day, time };

  const tenGods = {
    year: tenGod(day.ganIndex, year.ganIndex),
    month: tenGod(day.ganIndex, month.ganIndex),
    time: time ? tenGod(day.ganIndex, time.ganIndex) : null,
  };

  const wuxingCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const tally = (p) => {
    wuxingCount[p.ganWuxing]++;
    wuxingCount[p.zhiWuxing]++;
  };
  tally(year);
  tally(month);
  tally(day);
  if (time) tally(time);

  const zodiac = ZODIAC_KO[year.zhiIndex];

  const lunarMonthAbs = Math.abs(lunar.getMonth());
  const isLeapMonth = lunar.getMonth() < 0;
  const lunarText = `음력 ${lunar.getYear()}년 ${lunarMonthAbs}월 ${lunar.getDay()}일${isLeapMonth ? " (윤달)" : ""}`;
  const solarText = `양력 ${solar.getYear()}년 ${solar.getMonth()}월 ${solar.getDay()}일`;

  return {
    ok: true,
    timeKnown,
    pillars,
    dayMaster: { gan: day.gan, ganHanja: day.ganHanja, wuxing: day.ganWuxing },
    tenGods,
    wuxingCount,
    zodiac,
    lunarText,
    solarText,
  };
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateLabel(dateObj) {
  return `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일(${WEEKDAY_KO[dateObj.getDay()]})`;
}

function toDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 특정 사람의 일간(日干)을 기준으로, 오늘(또는 다른 기준일)부터 dayCount일간의 일진(日辰)과
// 그날이 본인에게 어떤 십신(十神)에 해당하는지 계산한다. (오늘 운세/내일 운세용)
// bazi: computeBazi(person)의 결과. startFrom: 기준일(보통 오늘, 로컬 자정 기준).
// startOffset: startFrom으로부터 며칠 뒤부터 셀지 (0=오늘부터, 1=내일부터).
export function computeFortuneDays(bazi, dayCount, startFrom = new Date(), startOffset = 1) {
  if (typeof window === "undefined" || !window.Solar) {
    return { ok: false, error: "사주 계산 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요." };
  }
  if (!bazi.ok) {
    return { ok: false, error: bazi.error };
  }

  const dayMasterGanIndex = bazi.pillars.day.ganIndex;
  const days = [];
  for (let i = startOffset; i < startOffset + dayCount; i++) {
    const d = new Date(startFrom.getFullYear(), startFrom.getMonth(), startFrom.getDate() + i);
    let pillar;
    try {
      const solar = window.Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), 12, 0, 0);
      const lunar = solar.getLunar();
      pillar = pillarInfo(lunar.getDayGanIndexExact(), lunar.getDayZhiIndexExact());
    } catch (err) {
      return { ok: false, error: "날짜를 계산하지 못했어요." };
    }
    days.push({
      date: d,
      dateKey: toDateKey(d),
      label: formatDateLabel(d),
      pillar,
      tenGod: tenGod(dayMasterGanIndex, pillar.ganIndex),
    });
  }
  return { ok: true, days };
}

// Claude 프롬프트에 그대로 삽입할 일진 텍스트 블록.
export function formatFortuneForPrompt(bazi, fortune) {
  if (!fortune.ok) return "";
  const lines = [
    "[검증된 일진(日辰) 계산 결과 — 아래 날짜별 간지·십신은 이미 정확히 계산된 것이므로 그대로 인용하고, 절대 직접 다시 계산하거나 다른 날짜/간지를 만들어내지 마세요]",
    `- 이 사람의 일간(본인 기준): ${bazi.dayMaster.gan}(${bazi.dayMaster.ganHanja}), 오행 ${bazi.dayMaster.wuxing}`,
    ...fortune.days.map(
      (d) =>
        `- ${d.label}: 일진 ${d.pillar.ganZhiKo}(${d.pillar.ganZhiHanja}) · 오행 ${d.pillar.ganWuxing}+${d.pillar.zhiWuxing} · 본인 일간 기준 십신=${d.tenGod}`
    ),
  ];
  return lines.join("\n");
}

function pillarLine(label, p) {
  if (!p) return `- ${label}: 정보 없음`;
  return `- ${label}: ${p.ganZhiKo}(${p.ganZhiHanja}) · 오행 ${p.ganWuxing}+${p.zhiWuxing}`;
}

// Claude 프롬프트에 그대로 삽입할 한글 텍스트 블록.
export function formatBaziForPrompt(bazi) {
  if (!bazi.ok) return "";
  const { pillars, dayMaster, tenGods, wuxingCount, zodiac, lunarText, solarText } = bazi;
  const wx = Object.entries(wuxingCount)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");

  const lines = [
    "[검증된 만세력 계산 결과 — 아래 값은 이미 정확히 계산된 것이므로 그대로 인용하고, 절대 직접 다시 계산하거나 값을 바꾸지 마세요]",
    pillarLine("연주(年柱)", pillars.year),
    pillarLine("월주(月柱)", pillars.month),
    pillarLine("일주(日柱)", pillars.day) + ` [일간(日干)=${dayMaster.gan}(${dayMaster.ganHanja}), 오행 ${dayMaster.wuxing} — 본인을 상징하는 핵심 글자]`,
    pillars.time ? pillarLine("시주(時柱)", pillars.time) : "- 시주(時柱): 출생 시각을 몰라 계산에서 제외함",
    `- 십신(十神, 일간 기준): 연간(年干)=${tenGods.year}, 월간(月干)=${tenGods.month}${tenGods.time ? `, 시간(時干)=${tenGods.time}` : ""}`,
    `- 오행 분포(8자 중): ${wx}`,
    `- 띠: ${zodiac}띠`,
    `- 참고: ${solarText} / ${lunarText}`,
  ];
  return lines.join("\n");
}

// 대운(大運): 10년 단위로 바뀌는 큰 흐름. 월주(月柱)를 기준으로 순행/역행하며 60갑자를 따라간다.
// 순행/역행과 대운수(첫 대운이 시작하는 나이)는 lunar-javascript의 절기 기반 계산(eightChar.getYun)을
// 그대로 신뢰해 쓰고, 각 대운의 간지만 월주 기준으로 직접 계산해 한글 표기까지 붙인다.
// person: { calendarType, birthDate, birthTime, timeUnknown, gender }
export function computeDaewoon(person, cycleCount = 8) {
  const resolved = resolvePersonLunar(person);
  if (!resolved.ok) return resolved;
  const { lunar, eightChar } = resolved;

  const genderNum = person.gender === "male" ? 1 : 0;
  let yun;
  try {
    yun = eightChar.getYun(genderNum, 1);
  } catch (err) {
    return { ok: false, error: "대운을 계산하지 못했어요." };
  }

  const forward = yun.isForward();
  const dayGanIndex = eightChar.getDayGanIndex();
  const monthGanIndex = lunar.getMonthGanIndexExact();
  const monthZhiIndex = lunar.getMonthZhiIndexExact();

  const monthJiaZi = jiaZiIndex(monthGanIndex, monthZhiIndex);
  if (monthJiaZi < 0) {
    return { ok: false, error: "대운 계산 중 월주 간지를 특정하지 못했어요." };
  }

  const raw = yun.getDaYun(cycleCount + 1);
  const cycles = raw
    .filter((d) => d.getIndex() >= 1) // index 0은 출생~첫 대운 시작 전 구간이라 실제 대운 간지가 없음
    .map((d) => {
      const idx = d.getIndex();
      let offset = monthJiaZi + (forward ? idx : -idx);
      offset = ((offset % 60) + 60) % 60;
      const pillar = pillarInfo(offset % 10, offset % 12);
      return {
        index: idx,
        startAge: d.getStartAge(),
        endAge: d.getEndAge(),
        startYear: d.getStartYear(),
        endYear: d.getEndYear(),
        pillar,
        tenGod: tenGod(dayGanIndex, pillar.ganIndex),
      };
    });

  return { ok: true, forward, startAge: cycles[0]?.startAge ?? null, cycles };
}

// 연운(세운/歲運): 특정 연도 한 해 전체의 흐름을 나타내는 연간(年干) 간지가 일간과 어떤 관계인지.
// year는 양력 연도(예: 2026). 연초(1~2월)는 입춘 전후로 연주가 전년도로 계산될 수 있어, 그 해
// 7월 1일을 기준 삼아 절기 경계 문제를 피한다 — 이는 사주 원국의 연주를 구하는 방식과 동일한 원리다.
export function computeSaeun(bazi, year) {
  if (typeof window === "undefined" || !window.Solar) {
    return { ok: false, error: "사주 계산 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요." };
  }
  if (!bazi.ok) {
    return { ok: false, error: bazi.error };
  }

  let pillar;
  try {
    const solar = window.Solar.fromYmdHms(year, 7, 1, 12, 0, 0);
    const lunar = solar.getLunar();
    pillar = pillarInfo(lunar.getYearGanIndexExact(), lunar.getYearZhiIndexExact());
  } catch (err) {
    return { ok: false, error: "연운을 계산하지 못했어요." };
  }

  return {
    ok: true,
    year,
    pillar,
    tenGod: tenGod(bazi.pillars.day.ganIndex, pillar.ganIndex),
  };
}

// Claude 프롬프트에 그대로 삽입할 연운 텍스트 블록.
export function formatSaeunForPrompt(bazi, saeun) {
  if (!saeun.ok) return "";
  const lines = [
    "[검증된 연운(年運) 계산 결과 — 아래 연간 간지·십신은 이미 정확히 계산된 것이므로 그대로 인용하고, 절대 직접 다시 계산하거나 다른 간지를 만들어내지 마세요]",
    `- 이 사람의 일간(본인 기준): ${bazi.dayMaster.gan}(${bazi.dayMaster.ganHanja}), 오행 ${bazi.dayMaster.wuxing}`,
    `- ${saeun.year}년 연운: ${saeun.pillar.ganZhiKo}(${saeun.pillar.ganZhiHanja}) · 오행 ${saeun.pillar.ganWuxing}+${saeun.pillar.zhiWuxing} · 본인 일간 기준 십신=${saeun.tenGod}`,
  ];
  return lines.join("\n");
}

// Claude 프롬프트에 그대로 삽입할 대운 텍스트 블록. cycles만 해당 시기(초년/중년/말년)로 걸러서 넘긴다.
export function formatDaewoonForPrompt(bazi, daewoon, cycles) {
  if (!daewoon.ok) return "";
  const lines = [
    "[검증된 대운(大運) 계산 결과 — 아래 시기별 간지·십신은 이미 정확히 계산된 것이므로 그대로 인용하고, 절대 직접 다시 계산하거나 다른 간지를 만들어내지 마세요]",
    `- 이 사람의 일간(본인 기준): ${bazi.dayMaster.gan}(${bazi.dayMaster.ganHanja}), 오행 ${bazi.dayMaster.wuxing}`,
    `- 대운 진행 방향: ${daewoon.forward ? "순행(順行)" : "역행(逆行)"}`,
    ...cycles.map(
      (c) =>
        `- 만 ${c.startAge}세~${c.endAge}세(${c.startYear}~${c.endYear}년): 대운 ${c.pillar.ganZhiKo}(${c.pillar.ganZhiHanja}) · 오행 ${c.pillar.ganWuxing}+${c.pillar.zhiWuxing} · 본인 일간 기준 십신=${c.tenGod}`
    ),
  ];
  return lines.join("\n");
}

// ---------- 신살(神殺) ----------
// 고전 명리서에 흔히 쓰이는 표를 그대로 구현. 신살은 유파에 따라 기준(년지/일지)이나 포함 여부가
// 갈리는 경우가 많은데, 여기서는 도화/역마/화개는 현대 사주 앱에서 널리 쓰이는 일지(日支) 기준으로,
// 천을귀인·양인살은 일간(日干) 기준으로, 괴강·백호·공망은 일주(日柱) 기준으로, 원진살은 네 기둥의
// 지지 조합으로 계산한다.

const PILLAR_LABEL_KO = { year: "연주", month: "월주", day: "일주", time: "시주" };

// 삼합 그룹: 0=신자진(申子辰) 1=사유축(巳酉丑) 2=인오술(寅午戌) 3=해묘미(亥卯未). zhiIndex % 4로 판별된다.
const TAOHUA_BY_GROUP = [9, 6, 3, 0]; // 桃花: 유, 오, 묘, 자
const YIMA_BY_GROUP = [2, 11, 8, 5]; // 驛馬: 인, 해, 신, 사
const HUAGAI_BY_GROUP = [4, 1, 10, 7]; // 華蓋: 진, 축, 술, 미

// 천을귀인: 일간(ganIndex 0~9 = 갑을병정무기경신임계) 기준으로 해당하는 두 지지.
const TIANYI_BY_GAN = [
  [1, 7], // 갑
  [0, 8], // 을
  [11, 9], // 병
  [11, 9], // 정
  [1, 7], // 무
  [0, 8], // 기
  [1, 7], // 경
  [2, 6], // 신
  [5, 3], // 임
  [5, 3], // 계
];

// 양인살: 양간(갑병무경임)에만 적용되는 것이 일반적.
const YANGREN_BY_GAN = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 };

// 괴강살: 일주 간지가 이 4개 중 하나. [ganIndex, zhiIndex]
const GUIGANG_PILLARS = [
  [6, 4], // 경진
  [6, 10], // 경술
  [8, 4], // 임진
  [4, 10], // 무술
];

// 백호살(백호대살): 네 기둥 중 하나라도 이 7개 간지에 해당하면.
const BAIHU_PILLARS = [
  [0, 4], // 갑진
  [1, 7], // 을미
  [2, 10], // 병술
  [3, 1], // 정축
  [4, 4], // 무진
  [8, 10], // 임술
  [9, 1], // 계축
];

// 원진살: 서로 원진 관계인 지지 쌍.
const WONJIN_ZHI_PAIRS = [
  [0, 7], // 자-미
  [1, 6], // 축-오
  [2, 9], // 인-유
  [3, 8], // 묘-신
  [4, 11], // 진-해
  [5, 10], // 사-술
];

// 공망(空亡): 기준 간지가 속한 60갑자 순(旬)에서 빠지는 두 지지.
function xunKongZhiIndexes(ganIndex, zhiIndex) {
  const n = jiaZiIndex(ganIndex, zhiIndex);
  if (n < 0) return [];
  const xun = Math.floor(n / 10);
  return [(xun * 10 + 10) % 12, (xun * 10 + 11) % 12];
}

// bazi: computeBazi(person)의 결과.
export function computeShinsal(bazi) {
  if (!bazi.ok) return { ok: false, error: bazi.error };

  const { pillars } = bazi;
  const pillarList = [
    ["year", pillars.year],
    ["month", pillars.month],
    ["day", pillars.day],
    ...(pillars.time ? [["time", pillars.time]] : []),
  ];

  const items = [];
  const addItem = (key, label, hanja, hitKeys) => {
    if (hitKeys.length === 0) return;
    items.push({ key, label, hanja, pillars: hitKeys });
  };
  const zhiMatches = (targetZhi) => pillarList.filter(([, p]) => p.zhiIndex === targetZhi).map(([k]) => k);

  const dayGanIndex = pillars.day.ganIndex;
  const dayZhiIndex = pillars.day.zhiIndex;
  const group = dayZhiIndex % 4;

  addItem("taohua", "도화살", "桃花殺", zhiMatches(TAOHUA_BY_GROUP[group]));
  addItem("yima", "역마살", "驛馬殺", zhiMatches(YIMA_BY_GROUP[group]));
  addItem("huagai", "화개살", "華蓋殺", zhiMatches(HUAGAI_BY_GROUP[group]));

  const tianyiZhis = TIANYI_BY_GAN[dayGanIndex];
  addItem(
    "tianyi",
    "천을귀인",
    "天乙貴人",
    pillarList.filter(([, p]) => tianyiZhis.includes(p.zhiIndex)).map(([k]) => k)
  );

  if (dayGanIndex in YANGREN_BY_GAN) {
    addItem("yangren", "양인살", "羊刃殺", zhiMatches(YANGREN_BY_GAN[dayGanIndex]));
  }

  if (GUIGANG_PILLARS.some(([g, z]) => g === dayGanIndex && z === dayZhiIndex)) {
    items.push({ key: "guigang", label: "괴강살", hanja: "魁罡殺", pillars: ["day"] });
  }

  addItem(
    "baihu",
    "백호살",
    "白虎殺",
    pillarList.filter(([, p]) => BAIHU_PILLARS.some(([g, z]) => g === p.ganIndex && z === p.zhiIndex)).map(([k]) => k)
  );

  const wonjinPillars = new Set();
  for (let i = 0; i < pillarList.length; i++) {
    for (let j = i + 1; j < pillarList.length; j++) {
      const [keyA, pillarA] = pillarList[i];
      const [keyB, pillarB] = pillarList[j];
      const isWonjin = WONJIN_ZHI_PAIRS.some(
        ([a, b]) =>
          (pillarA.zhiIndex === a && pillarB.zhiIndex === b) || (pillarA.zhiIndex === b && pillarB.zhiIndex === a)
      );
      if (isWonjin) {
        wonjinPillars.add(keyA);
        wonjinPillars.add(keyB);
      }
    }
  }
  addItem("wonjin", "원진살", "怨嗔殺", Array.from(wonjinPillars));

  const kongZhis = xunKongZhiIndexes(dayGanIndex, dayZhiIndex);
  addItem(
    "gongmang",
    "공망",
    "空亡",
    pillarList.filter(([key, p]) => key !== "day" && kongZhis.includes(p.zhiIndex)).map(([k]) => k)
  );

  return { ok: true, items };
}

// Claude 프롬프트에 그대로 삽입할 신살 텍스트 블록.
export function formatShinsalForPrompt(shinsal) {
  if (!shinsal.ok) return "";
  if (shinsal.items.length === 0) {
    return "[검증된 신살(神殺) 계산 결과 — 이 사주에는 아래에 해당하는 대표적인 신살이 없습니다. 없는 신살을 지어내서 언급하지 마세요.]";
  }
  const lines = [
    "[검증된 신살(神殺) 계산 결과 — 아래 목록은 이미 정확히 계산된 것이므로 그대로 인용하고, 절대 목록에 없는 다른 신살을 지어내거나 언급하지 마세요]",
    ...shinsal.items.map(
      (it) => `- ${it.label}(${it.hanja}): ${it.pillars.map((k) => PILLAR_LABEL_KO[k]).join("·")}`
    ),
  ];
  return lines.join("\n");
}

// ---------- 지장간(支藏干) ----------
// 지지 속에 숨어있는 천간과 그 기운이 한 달(30일) 중 며칠을 차지하는지(여기/중기/정기)를 나타내는
// 고전 표(연해자평 계열). 마지막 항목이 그 지지의 "정기(正氣)" — 가장 비중이 큰 기운이다.
const HIDDEN_STEMS_BY_ZHI = [
  [[8, 10], [9, 20]], // 자: 임10 계20
  [[9, 9], [7, 3], [5, 18]], // 축: 계9 신3 기18
  [[4, 7], [2, 7], [0, 16]], // 인: 무7 병7 갑16
  [[0, 10], [1, 20]], // 묘: 갑10 을20
  [[1, 9], [9, 3], [4, 18]], // 진: 을9 계3 무18
  [[4, 7], [6, 7], [2, 16]], // 사: 무7 경7 병16
  [[2, 10], [5, 9], [3, 11]], // 오: 병10 기9 정11
  [[3, 9], [1, 3], [5, 18]], // 미: 정9 을3 기18
  [[4, 7], [8, 7], [6, 16]], // 신: 무7 임7 경16
  [[6, 10], [7, 20]], // 유: 경10 신20
  [[7, 9], [3, 3], [4, 18]], // 술: 신9 정3 무18
  [[4, 7], [0, 7], [8, 16]], // 해: 무7 갑7 임16
];

// bazi: computeBazi(person)의 결과. 각 기둥마다 지지 속 지장간 목록(정기가 마지막)을 반환.
export function computeHiddenStems(bazi) {
  if (!bazi.ok) return { ok: false, error: bazi.error };
  const { pillars, dayMaster } = bazi;
  const dayGanIndex = pillars.day.ganIndex;

  const pillarList = [
    ["year", pillars.year],
    ["month", pillars.month],
    ["day", pillars.day],
    ...(pillars.time ? [["time", pillars.time]] : []),
  ];

  const rows = pillarList.map(([key, p]) => ({
    key,
    stems: HIDDEN_STEMS_BY_ZHI[p.zhiIndex].map(([ganIndex, days]) => ({
      ganIndex,
      gan: GAN_KO[ganIndex],
      ganHanja: GAN_HANJA[ganIndex],
      days,
      wuxing: ganWuxing(ganIndex),
      tenGod: tenGod(dayGanIndex, ganIndex),
    })),
  }));

  return { ok: true, dayMasterGan: dayMaster.gan, rows };
}

// ---------- 십이운성(十二運星) ----------
// 일간(日干)이 각 기둥의 지지 위에서 어떤 생애 단계에 해당하는지를 나타내는 고전 표.
// 양간은 장생 지지에서 순행(12지지를 시계방향으로), 음간은 역행(반시계방향)한다.
// 무기(戊己)는 병정(丙丁)과 같은 자리를 쓰는 화토동법(火土同法)을 따른다.
const TWELVE_STAGE_NAMES = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];
const CHANGSHENG_BY_GAN = [
  { startZhi: 11, forward: true }, // 갑
  { startZhi: 6, forward: false }, // 을
  { startZhi: 2, forward: true }, // 병
  { startZhi: 9, forward: false }, // 정
  { startZhi: 2, forward: true }, // 무 (화토동법)
  { startZhi: 9, forward: false }, // 기 (화토동법)
  { startZhi: 5, forward: true }, // 경
  { startZhi: 0, forward: false }, // 신
  { startZhi: 8, forward: true }, // 임
  { startZhi: 3, forward: false }, // 계
];

// bazi: computeBazi(person)의 결과. 각 기둥의 지지가 일간 기준 어떤 운성 단계인지 반환.
export function computeTwelveStages(bazi) {
  if (!bazi.ok) return { ok: false, error: bazi.error };
  const { pillars } = bazi;
  const { startZhi, forward } = CHANGSHENG_BY_GAN[pillars.day.ganIndex];

  const pillarList = [
    ["year", pillars.year],
    ["month", pillars.month],
    ["day", pillars.day],
    ...(pillars.time ? [["time", pillars.time]] : []),
  ];

  const rows = pillarList.map(([key, p]) => {
    const diff = forward ? p.zhiIndex - startZhi : startZhi - p.zhiIndex;
    const stepIndex = ((diff % 12) + 12) % 12;
    return { key, stage: TWELVE_STAGE_NAMES[stepIndex] };
  });

  return { ok: true, rows };
}

// ---------- 납음(納音) 오행 ----------
// 60갑자를 둘씩 묶어 붙이는 고전 오행 이름(연해자평 계열). n=jiaZiIndex를 2로 나눈 값이 배열 인덱스.
const NAYIN_TABLE = [
  { ko: "해중금", hanja: "海中金" },
  { ko: "노중화", hanja: "爐中火" },
  { ko: "대림목", hanja: "大林木" },
  { ko: "노방토", hanja: "路旁土" },
  { ko: "검봉금", hanja: "劍鋒金" },
  { ko: "산두화", hanja: "山頭火" },
  { ko: "간하수", hanja: "澗下水" },
  { ko: "성두토", hanja: "城頭土" },
  { ko: "백랍금", hanja: "白蠟金" },
  { ko: "양류목", hanja: "楊柳木" },
  { ko: "천중수", hanja: "泉中水" },
  { ko: "옥상토", hanja: "屋上土" },
  { ko: "벽력화", hanja: "霹靂火" },
  { ko: "송백목", hanja: "松柏木" },
  { ko: "장류수", hanja: "長流水" },
  { ko: "사중금", hanja: "沙中金" },
  { ko: "산하화", hanja: "山下火" },
  { ko: "평지목", hanja: "平地木" },
  { ko: "벽상토", hanja: "壁上土" },
  { ko: "금박금", hanja: "金箔金" },
  { ko: "복등화", hanja: "覆燈火" },
  { ko: "천하수", hanja: "天河水" },
  { ko: "대역토", hanja: "大驛土" },
  { ko: "차천금", hanja: "釵釧金" },
  { ko: "상자목", hanja: "桑柘木" },
  { ko: "대계수", hanja: "大溪水" },
  { ko: "사중토", hanja: "沙中土" },
  { ko: "천상화", hanja: "天上火" },
  { ko: "석류목", hanja: "石榴木" },
  { ko: "대해수", hanja: "大海水" },
];

// bazi: computeBazi(person)의 결과. 각 기둥 간지의 납음오행을 반환.
export function computeNayin(bazi) {
  if (!bazi.ok) return { ok: false, error: bazi.error };
  const { pillars } = bazi;

  const pillarList = [
    ["year", pillars.year],
    ["month", pillars.month],
    ["day", pillars.day],
    ...(pillars.time ? [["time", pillars.time]] : []),
  ];

  const rows = pillarList.map(([key, p]) => {
    const n = jiaZiIndex(p.ganIndex, p.zhiIndex);
    const entry = NAYIN_TABLE[Math.floor(n / 2)];
    return { key, ...entry };
  });

  return { ok: true, rows };
}

// ---------- 십이신살(十二神殺) ----------
// 도화/역마/화개(일지 기준, computeShinsal)와는 별개로, 년지(年支)가 속한 삼합 그룹을 기준으로
// 12지지 각각에 겁살~화개살까지 하나씩 이름을 매기는 전통 체계. 네 기둥 모두 항상 결과가 있다.
const TWELVE_SHINSAL_TERMS = [
  "겁살", "재살", "천살", "지살", "년살", "월살", "망신살", "장성살", "반안살", "역마살", "육해살", "화개살",
];

// bazi: computeBazi(person)의 결과. 년지 기준으로 각 기둥의 12신살을 반환.
export function computeTwelveShinsal(bazi) {
  if (!bazi.ok) return { ok: false, error: bazi.error };
  const { pillars } = bazi;
  const group = pillars.year.zhiIndex % 4;
  const start = (HUAGAI_BY_GROUP[group] + 1) % 12;

  const pillarList = [
    ["year", pillars.year],
    ["month", pillars.month],
    ["day", pillars.day],
    ...(pillars.time ? [["time", pillars.time]] : []),
  ];

  const rows = pillarList.map(([key, p]) => {
    const offset = ((p.zhiIndex - start) % 12 + 12) % 12;
    return { key, term: TWELVE_SHINSAL_TERMS[offset] };
  });

  return { ok: true, rows };
}

// Claude 프롬프트에 그대로 삽입할 지장간/십이운성/납음/십이신살 종합 텍스트 블록.
export function formatDetailTableForPrompt(bazi, { hiddenStems, stages, nayin, twelveShinsal }) {
  if (!bazi.ok) return "";
  const pillarLine = (key) => {
    const parts = [];
    if (stages?.ok) {
      const s = stages.rows.find((r) => r.key === key);
      if (s) parts.push(`십이운성=${s.stage}`);
    }
    if (twelveShinsal?.ok) {
      const t = twelveShinsal.rows.find((r) => r.key === key);
      if (t) parts.push(`십이신살=${t.term}`);
    }
    if (nayin?.ok) {
      const n = nayin.rows.find((r) => r.key === key);
      if (n) parts.push(`납음=${n.ko}(${n.hanja})`);
    }
    if (hiddenStems?.ok) {
      const h = hiddenStems.rows.find((r) => r.key === key);
      if (h) {
        const stemText = h.stems
          .map((s) => `${s.gan}(${s.ganHanja}, ${s.days}일, 십신=${s.tenGod})`)
          .join(" · ");
        parts.push(`지장간=${stemText}`);
      }
    }
    return parts.join(" / ");
  };

  const lines = [
    "[검증된 지장간·십이운성·납음·십이신살 계산 결과 — 이미 정확히 계산된 것이므로 그대로 인용하고, 절대 직접 다시 계산하거나 다른 값을 지어내지 마세요. 전부 억지로 언급할 필요는 없고, 사주를 더 풍부하게 설명하는 데 자연스럽게 참고만 하세요]",
    `- 연주: ${pillarLine("year")}`,
    `- 월주: ${pillarLine("month")}`,
    `- 일주: ${pillarLine("day")}`,
    ...(bazi.pillars.time ? [`- 시주: ${pillarLine("time")}`] : []),
  ];
  return lines.join("\n");
}
