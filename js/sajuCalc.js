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

  // 월주의 60갑자 순번(0~59)을 역산: n%10=월간, n%12=월지를 만족하는 n.
  let monthJiaZi = -1;
  for (let n = 0; n < 60; n++) {
    if (n % 10 === monthGanIndex && n % 12 === monthZhiIndex) {
      monthJiaZi = n;
      break;
    }
  }
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
