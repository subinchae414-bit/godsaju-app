// Claude에게 보낼 사주/궁합 프롬프트 생성

function describePerson(p) {
  const cal = p.calendarType === "lunar" ? "음력" : "양력";
  const gender = p.gender === "male" ? "남자" : "여자";
  const time = p.timeUnknown || !p.birthTime ? "출생 시각 모름" : `${p.birthTime} 출생`;
  const relationLabel = p.relation ? `(관계: ${p.relation})` : "";
  return `이름: ${p.name} ${relationLabel}\n성별: ${gender}\n생년월일: ${p.birthDate} (${cal})\n출생 시각: ${time}`;
}

const BASE_SYSTEM = `당신은 사주명리학(四柱命理學)에 정통한 전문 상담가입니다. 생년월일시 정보를 바탕으로 사주팔자를 해석하되, 다음 원칙을 지킵니다.
- 실제 명리학 이론(천간지지, 오행, 십신 등)에 기반해 그럴듯하고 통찰력 있게 해석하세요. 계산 과정을 나열하지 말고 해석 결과만 자연스러운 한국어로 전달하세요.
- 출생 시각을 모르는 경우, 시주(時柱)를 제외한 나머지 정보로 해석하고 그 사실을 자연스럽게 언급하세요.
- 단정적인 운명론보다는 성향, 강점, 유의할 점을 균형 있게 제시하고, 따뜻하고 격려하는 톤을 유지하세요.
- 미신적으로 겁을 주거나 건강/재물/수명에 대해 과도하게 단정적인 표현은 피하세요.
- 마크다운 형식(## 소제목, - 목록, **강조**)을 사용해 읽기 쉽게 구성하세요.
- 응답은 한국어로만 작성하세요.`;

export function buildPersonalPrompt(person) {
  const system = `${BASE_SYSTEM}

지금은 한 사람의 개인 사주를 해석하는 요청입니다. 아래 구성을 따르세요.
## 사주 개요
## 오행 분석
## 타고난 성격과 기질
## 강점
## 유의할 점
## 종합 조언 (2~3문장)`;

  const user = `다음 사람의 사주를 해석해주세요.\n\n${describePerson(person)}`;
  return { system, user };
}

export function buildCompatibilityPrompt(personA, personB) {
  const system = `${BASE_SYSTEM}

지금은 두 사람의 궁합을 해석하는 요청입니다. 두 사람의 관계(가족/연인/친구 등)에 맞는 톤으로 서술하고, 아래 구성을 따르세요.
## 두 사람의 사주 요약
## 궁합 총평
## 서로 잘 맞는 점
## 주의하거나 보완이 필요한 점
## 관계를 더 좋게 만드는 팁`;

  const user = `다음 두 사람의 궁합을 봐주세요. 두 사람의 관계는 "${personA.relation} - ${personB.relation}" 성격의 관계입니다 (${personA.name}님이 보는 상대는 ${personB.name}님).\n\n[사람 1]\n${describePerson(personA)}\n\n[사람 2]\n${describePerson(personB)}`;
  return { system, user };
}
