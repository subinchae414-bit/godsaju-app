// Claude에게 보낼 사주/궁합 프롬프트 생성.
// 간지(干支) 계산은 js/sajuCalc.js(검증된 만세력 라이브러리 기반)가 미리 정확히 끝내두고,
// 여기서는 그 결과를 프롬프트에 그대로 박아 넣어 Claude가 "해석"만 하도록 한다.

import {
  computeBazi,
  formatBaziForPrompt,
  computeFortuneDays,
  formatFortuneForPrompt,
  computeSaeun,
  formatSaeunForPrompt,
  computeDaewoon,
  formatDaewoonForPrompt,
  computeShinsal,
  formatShinsalForPrompt,
  computeHiddenStems,
  computeTwelveStages,
  computeNayin,
  computeTwelveShinsal,
  formatDetailTableForPrompt,
} from "./sajuCalc.js";

export const FORTUNE_RANGES = {
  today: { days: 1, startOffset: 0, label: "오늘 운세" },
  tomorrow: { days: 1, startOffset: 1, label: "내일 운세" },
};

// 연운(세운/歲運): 한 해 전체의 흐름. yearOffset은 올해 기준 몇 년 뒤인지.
export const SAEUN_RANGES = {
  current: { yearOffset: 0, label: "올해 연운" },
  next: { yearOffset: 1, label: "내년 연운" },
};

// 대운을 세 시기로 나눠서 보여준다. 각 대운은 10년 단위라 나이 구간이 시기 경계에 걸칠 수 있는데,
// 그런 경우 그 대운이 "시작하는" 나이를 기준으로 시기를 정한다.
export const DAEWOON_PHASES = {
  early: { label: "초년 대운", match: (startAge) => startAge < 30 },
  middle: { label: "중년 대운", match: (startAge) => startAge >= 30 && startAge < 60 },
  late: { label: "말년 대운", match: (startAge) => startAge >= 60 },
};

function describePerson(p) {
  const cal = p.calendarType === "lunar" ? "음력" : "양력";
  const gender = p.gender === "male" ? "남자" : "여자";
  const time = p.timeUnknown || !p.birthTime ? "출생 시각 모름" : `${p.birthTime} 출생`;
  const relationLabel = p.relation ? `(관계: ${p.relation})` : "";
  return `이름: ${p.name} ${relationLabel}\n성별: ${gender}\n생년월일: ${p.birthDate} (${cal})\n출생 시각: ${time}`;
}

function requireBazi(person) {
  const bazi = computeBazi(person);
  if (!bazi.ok) {
    throw new Error(`${person.name}님의 사주를 계산하지 못했어요: ${bazi.error}`);
  }
  return bazi;
}

const BASE_SYSTEM = `당신은 사주명리학(四柱命理學)에 정통한 전문 상담가입니다. 사용자 메시지에는 이미 정확한 만세력 계산으로 구한 연주/월주/일주/시주 간지와 오행·십신 정보가 포함되어 있습니다. 다음 원칙을 지키세요.
- 제공된 간지·오행·십신 값을 그대로 인용하세요. 직접 새로 계산하거나, 계산 과정을 나열하거나, 제공된 값과 다른 간지를 언급하지 마세요.
- 실제 명리학 이론(천간지지, 오행, 십신 등)에 기반해 그럴듯하고 통찰력 있게 해석하세요. 결과는 자연스러운 한국어 문장으로 전달하세요.
- 시주(時柱)가 "정보 없음"으로 제공된 경우, 그 사실을 자연스럽게 언급하고 나머지 정보로만 해석하세요.
- 단정적인 운명론보다는 성향, 강점, 유의할 점을 균형 있게 제시하고, 따뜻하고 격려하는 톤을 유지하세요.
- 미신적으로 겁을 주거나 건강/재물/수명에 대해 과도하게 단정적인 표현은 피하세요.
- 마크다운 형식(## 소제목, - 목록, **강조**)을 사용해 읽기 쉽게 구성하세요.
- 응답은 한국어로만 작성하세요.`;

export function buildPersonalPrompt(person) {
  const bazi = requireBazi(person);
  const shinsal = computeShinsal(bazi);
  const hiddenStems = computeHiddenStems(bazi);
  const stages = computeTwelveStages(bazi);
  const nayin = computeNayin(bazi);
  const twelveShinsal = computeTwelveShinsal(bazi);

  const system = `${BASE_SYSTEM}

지금은 한 사람의 개인 사주를 해석하는 요청입니다. 아래 구성을 따르세요.
## 사주 개요 (연주/월주/일주/시주를 간지와 함께 소개)
## 오행 분석
## 신살(神殺) 특징 (제공된 신살·십이신살 목록을 바탕으로 각각이 이 사람에게 어떤 의미인지 짧게 풀어서 설명. 지장간·십이운성·납음 정보도 자연스럽게 참고해서 사주를 더 입체적으로 설명하되, 전부 억지로 나열하지는 말고 이 사람에게 의미 있는 부분 위주로. 신살이 아예 없다면 "특별히 두드러지는 신살은 없어요" 정도로 자연스럽게 한 문장만 언급하고 넘어가기)
## 타고난 성격과 기질
## 강점
## 유의할 점
## 종합 조언 (2~3문장)`;

  const user = `다음 사람의 사주를 해석해주세요.\n\n${describePerson(person)}\n\n${formatBaziForPrompt(bazi)}\n\n${formatShinsalForPrompt(shinsal)}\n\n${formatDetailTableForPrompt(bazi, { hiddenStems, stages, nayin, twelveShinsal })}`;
  return { system, user };
}

export function buildCompatibilityPrompt(personA, personB) {
  const baziA = requireBazi(personA);
  const baziB = requireBazi(personB);

  const system = `${BASE_SYSTEM}

지금은 두 사람의 궁합을 해석하는 요청입니다. 두 사람의 관계(가족/연인/친구 등)에 맞는 톤으로 서술하세요.
- 응답의 맨 첫 줄에는 다른 말 없이 정확히 "궁합 점수: NN점" 형식으로 100점 만점 기준 종합 궁합 점수를 정수로 먼저 제시하세요 (예: 궁합 점수: 87점). 극단적인 0점/100점보다는 실제 궁합처럼 자연스러운 편차가 있는 점수를 매기세요. 이 줄 외에는 점수를 본문에서 다시 언급하지 마세요.
- 그다음 줄부터 아래 구성을 따라 마크다운으로 작성하세요.
## 두 사람의 사주 요약
## 궁합 총평
## 서로 잘 맞는 점
## 주의하거나 보완이 필요한 점
## 관계를 더 좋게 만드는 팁`;

  const user = `다음 두 사람의 궁합을 봐주세요. 두 사람의 관계는 "${personA.relation} - ${personB.relation}" 성격의 관계입니다 (${personA.name}님이 보는 상대는 ${personB.name}님).\n\n[사람 1]\n${describePerson(personA)}\n\n${formatBaziForPrompt(baziA)}\n\n[사람 2]\n${describePerson(personB)}\n\n${formatBaziForPrompt(baziB)}`;
  return { system, user };
}

// rangeKey: "today" | "tomorrow" (FORTUNE_RANGES 참고)
export function buildFortunePrompt(person, rangeKey) {
  const range = FORTUNE_RANGES[rangeKey];
  if (!range) {
    throw new Error("알 수 없는 운세 기간이에요.");
  }

  const bazi = requireBazi(person);
  const fortune = computeFortuneDays(bazi, range.days, new Date(), range.startOffset);
  if (!fortune.ok) {
    throw new Error(`${person.name}님의 운세를 계산하지 못했어요: ${fortune.error}`);
  }

  const dayDesc = range.startOffset === 0 ? "오늘 하루" : "내일 하루";

  const system = `${BASE_SYSTEM}

지금은 "${range.label}"(${dayDesc})를 해석하는 요청입니다. 사용자 메시지에는 이 사람의 사주 원국(연/월/일/시주, 일간)과, 해당 날짜의 일진(日辰) 간지·오행·십신이 이미 정확히 계산되어 포함되어 있습니다. 그 날의 일진이 본인 일간과 어떤 십신 관계인지를 바탕으로 하루의 기운을 해석하세요. 아래 구성을 따르세요.
## ${range.label} 총운
## 이날 주의할 점
## 힘이 되는 조언 (2~3문장)`;

  const user = `다음 사람의 ${range.label}를 봐주세요.\n\n${describePerson(person)}\n\n${formatBaziForPrompt(bazi)}\n\n${formatFortuneForPrompt(bazi, fortune)}`;
  return { system, user };
}

// rangeKey: "current" | "next" (SAEUN_RANGES 참고)
export function buildSaeunPrompt(person, rangeKey) {
  const range = SAEUN_RANGES[rangeKey];
  if (!range) {
    throw new Error("알 수 없는 연운 연도예요.");
  }

  const bazi = requireBazi(person);
  const year = new Date().getFullYear() + range.yearOffset;
  const saeun = computeSaeun(bazi, year);
  if (!saeun.ok) {
    throw new Error(`${person.name}님의 연운을 계산하지 못했어요: ${saeun.error}`);
  }

  const system = `${BASE_SYSTEM}

지금은 "${year}년 연운(年運)"을 해석하는 요청입니다. 연운은 대운(10년 단위)과 달리 한 해 전체의 흐름을 나타냅니다. 사용자 메시지에는 이 사람의 사주 원국(연/월/일/시주, 일간)과, ${year}년의 연간(年干) 연운 간지·오행·십신이 이미 정확히 계산되어 포함되어 있습니다. 이 연운이 본인 일간과 어떤 십신 관계인지를 바탕으로 ${year}년 한 해의 전반적인 흐름을 해석하세요. "세운"이라는 표현은 쓰지 말고 "연운"으로만 표현하세요. 아래 구성을 따르세요.
## ${year}년 연운 총운
## 이 해에 주의할 점
## 힘이 되는 조언 (2~3문장)`;

  const user = `다음 사람의 ${year}년 연운을 봐주세요.\n\n${describePerson(person)}\n\n${formatBaziForPrompt(bazi)}\n\n${formatSaeunForPrompt(bazi, saeun)}`;
  return { system, user };
}

// "붉은 실 만들기": 이 사람과 명리학적으로 잘 맞을 만한 이상적인 인연 유형 TOP 10을 추천.
// 실존 인물이나 구체적인 생년월일을 지어내지 않고, 오행/십신 성향 중심의 "인연 유형"을 설명한다.
export function buildRedThreadPrompt(person) {
  const bazi = requireBazi(person);

  const system = `${BASE_SYSTEM}

지금은 "붉은 실 만들기" 요청입니다. 이 사람의 사주(오행 분포, 일간, 십신 성향)를 바탕으로, 명리학적으로 보완·상생 관계에 있어 잘 맞을 가능성이 높은 "이상적인 인연 유형"을 순위별로 추천해주세요.
- 실제 존재하는 특정 인물이나 구체적인 생년월일을 지어내지 마세요. 대신 "이런 오행/기질/십신 성향을 가진 사람"이라는 식으로 유형을 설명하세요.
- 순위가 높을수록(1위에 가까울수록) 이 사람과 더 잘 맞는 조합이어야 하고, 10개 유형은 서로 겹치지 않게 다양해야 합니다.
- 아래 구성을 마크다운으로 작성하세요.
## 이 사람의 인연운 요약 (오행 균형과 보완이 필요한 기운 중심으로 2~3문장)
## 나와 잘 맞는 인연 TOP 10
(1위부터 10위까지 - 목록으로 작성. 각 항목은 "**N위. [한 줄 캐릭터 설명]**" 형식의 제목으로 시작하고, 이어서 어떤 오행·십신 기운을 가진 사람인지와 왜 잘 맞는지를 1~2문장으로 설명)
## 인연을 알아볼 때 참고할 팁 (2~3문장)`;

  const user = `다음 사람과 사주명리학적으로 잘 맞는 이상적인 인연 유형 TOP 10을 뽑아주세요.\n\n${describePerson(person)}\n\n${formatBaziForPrompt(bazi)}`;
  return { system, user };
}

// phaseKey: "early" | "middle" | "late" (DAEWOON_PHASES 참고)
export function buildDaewoonPrompt(person, phaseKey) {
  const phase = DAEWOON_PHASES[phaseKey];
  if (!phase) {
    throw new Error("알 수 없는 대운 시기예요.");
  }

  const bazi = requireBazi(person);
  const daewoon = computeDaewoon(person);
  if (!daewoon.ok) {
    throw new Error(`${person.name}님의 대운을 계산하지 못했어요: ${daewoon.error}`);
  }

  const cycles = daewoon.cycles.filter((c) => phase.match(c.startAge));
  if (cycles.length === 0) {
    throw new Error(`${person.name}님의 ${phase.label} 구간을 찾지 못했어요.`);
  }

  const system = `${BASE_SYSTEM}

지금은 "${phase.label}"(만 ${cycles[0].startAge}세~${cycles[cycles.length - 1].endAge}세)을 해석하는 요청입니다. 사용자 메시지에는 이 사람의 사주 원국(연/월/일/시주, 일간)과, 이 시기에 해당하는 대운(大運, 10년 단위로 바뀌는 큰 흐름) 각각의 간지·오행·십신이 이미 정확히 계산되어 포함되어 있습니다. 각 대운이 본인 일간과 어떤 십신 관계인지를 바탕으로 이 시기 전반의 흐름을 해석하세요. 아래 구성을 따르세요.
## ${phase.label} 흐름 총평
## 대운별 기운 (제공된 대운마다 하나씩, - 목록으로 나이 구간과 함께 짧게)
## 이 시기 주의할 점
## 힘이 되는 조언 (2~3문장)`;

  const user = `다음 사람의 ${phase.label}을 봐주세요.\n\n${describePerson(person)}\n\n${formatBaziForPrompt(bazi)}\n\n${formatDaewoonForPrompt(bazi, daewoon, cycles)}`;
  return { system, user };
}
