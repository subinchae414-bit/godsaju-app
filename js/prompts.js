// Claude에게 보낼 사주/궁합 프롬프트 생성.
// 간지(干支) 계산은 js/sajuCalc.js(검증된 만세력 라이브러리 기반)가 미리 정확히 끝내두고,
// 여기서는 그 결과를 프롬프트에 그대로 박아 넣어 Claude가 "해석"만 하도록 한다.

import { computeBazi, formatBaziForPrompt, computeFortuneDays, formatFortuneForPrompt } from "./sajuCalc.js";

export const FORTUNE_RANGES = {
  tomorrow: { days: 1, label: "내일 운세" },
  "3day": { days: 3, label: "3일 운세" },
  week: { days: 7, label: "일주일 운세" },
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

  const system = `${BASE_SYSTEM}

지금은 한 사람의 개인 사주를 해석하는 요청입니다. 아래 구성을 따르세요.
## 사주 개요 (연주/월주/일주/시주를 간지와 함께 소개)
## 오행 분석
## 타고난 성격과 기질
## 강점
## 유의할 점
## 종합 조언 (2~3문장)`;

  const user = `다음 사람의 사주를 해석해주세요.\n\n${describePerson(person)}\n\n${formatBaziForPrompt(bazi)}`;
  return { system, user };
}

export function buildCompatibilityPrompt(personA, personB) {
  const baziA = requireBazi(personA);
  const baziB = requireBazi(personB);

  const system = `${BASE_SYSTEM}

지금은 두 사람의 궁합을 해석하는 요청입니다. 두 사람의 관계(가족/연인/친구 등)에 맞는 톤으로 서술하고, 아래 구성을 따르세요.
## 두 사람의 사주 요약
## 궁합 총평
## 서로 잘 맞는 점
## 주의하거나 보완이 필요한 점
## 관계를 더 좋게 만드는 팁`;

  const user = `다음 두 사람의 궁합을 봐주세요. 두 사람의 관계는 "${personA.relation} - ${personB.relation}" 성격의 관계입니다 (${personA.name}님이 보는 상대는 ${personB.name}님).\n\n[사람 1]\n${describePerson(personA)}\n\n${formatBaziForPrompt(baziA)}\n\n[사람 2]\n${describePerson(personB)}\n\n${formatBaziForPrompt(baziB)}`;
  return { system, user };
}

// rangeKey: "tomorrow" | "3day" | "week" (FORTUNE_RANGES 참고)
export function buildFortunePrompt(person, rangeKey) {
  const range = FORTUNE_RANGES[rangeKey];
  if (!range) {
    throw new Error("알 수 없는 운세 기간이에요.");
  }

  const bazi = requireBazi(person);
  const fortune = computeFortuneDays(bazi, range.days);
  if (!fortune.ok) {
    throw new Error(`${person.name}님의 운세를 계산하지 못했어요: ${fortune.error}`);
  }

  const isSingleDay = range.days === 1;

  const system = `${BASE_SYSTEM}

지금은 "${range.label}"(오늘을 기준으로 앞으로 ${range.days}일)를 해석하는 요청입니다. 사용자 메시지에는 이 사람의 사주 원국(연/월/일/시주, 일간)과, 앞으로 ${range.days}일 각 날짜의 일진(日辰) 간지·오행·십신이 이미 정확히 계산되어 포함되어 있습니다. 그 날의 일진이 본인 일간과 어떤 십신 관계인지를 바탕으로 하루하루의 기운을 해석하세요. 아래 구성을 따르세요.
## ${range.label} 총운
${isSingleDay ? "" : `## 날짜별 기운 (제공된 날짜마다 하나씩, - 목록으로 짧게 한두 문장씩)\n`}## 이 기간 주의할 점
## 힘이 되는 조언 (2~3문장)`;

  const user = `다음 사람의 ${range.label}를 봐주세요.\n\n${describePerson(person)}\n\n${formatBaziForPrompt(bazi)}\n\n${formatFortuneForPrompt(bazi, fortune)}`;
  return { system, user };
}
