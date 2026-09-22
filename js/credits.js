// 풀이(=젤리 차감)를 실제로 요청하기 직전에 사용자에게 yes/no로 확인받는 공통 헬퍼.
// 여러 화면(사주/궁합/운세/대운)에서 똑같은 문구·취소 상태를 쓰기 위해 모아둠.

export function confirmSpend() {
  return confirm("이 풀이를 보려면 1젤리가 사용돼요. 진행할까요?");
}

export function cancelledSpendHtml() {
  return `<div class="empty-state">풀이를 시작하지 않았어요.<br/>아래 "다시 풀이하기" 버튼을 누르면 다시 볼 수 있어요.</div>`;
}
