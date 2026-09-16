import { getCredits } from "../storage.js";
import { setSpaceId } from "../space.js";
import { isSupabaseConfigured } from "../supabaseClient.js";

export function renderSettings(container) {
  const configured = isSupabaseConfigured();

  container.innerHTML = `
    <div class="page">
      <h2 style="margin:6px 0 4px;">설정</h2>

      <div class="section-title" style="margin-top:12px;">사주 풀이 남은 횟수</div>
      <div class="card" style="margin-bottom:4px;">
        <div id="s-credits" style="font-size:22px;font-weight:800;color:var(--gold);">불러오는 중...</div>
        <div class="hint" style="margin:6px 0 14px;">
          사주·궁합·운세 풀이 1건마다 1회씩 사용돼요. 같은 PIN을 쓰는 가족·지인과 함께 나눠 써요.
        </div>
        <button class="btn btn-primary" id="s-charge" disabled>충전하기 (준비 중)</button>
        <div class="hint" style="margin-top:8px;">결제 기능은 곧 열릴 예정이에요. 그 전까지 문의해주세요.</div>
      </div>

      <div class="section-title">공유 공간 (PIN)</div>
      <div class="card" style="margin-bottom:4px;">
        <div style="font-size:13px;color:var(--text-dim);line-height:1.7;margin-bottom:12px;">
          이 기기는 지금 PIN으로 연결된 공유 공간에 접속해 있어요.
          같은 PIN을 입력한 다른 기기와 사람 목록·사주/궁합 풀이·남은 횟수가 함께 보여요.
          ${
            configured
              ? ""
              : `<br/><span style="color:var(--rose);">⚠ Supabase 설정이 비어있어요. js/supabaseConfig.js를 채워주세요.</span>`
          }
        </div>
        <button class="btn btn-ghost" id="s-leave">다른 PIN으로 전환 / 잠그기</button>
      </div>

      <div class="section-title">데이터에 대해</div>
      <div class="card" style="font-size:13px;color:var(--text-dim);line-height:1.7;">
        등록한 프로필과 사주/궁합/운세 풀이 결과, 남은 횟수는 PIN으로 연결된 Supabase 공간에 저장되어,
        같은 PIN을 입력하는 모든 기기·브라우저에서 함께 보여요.
        PIN은 비밀번호 찾기가 없으니 잊어버리지 않게 잘 보관해주세요.
      </div>
    </div>
  `;

  const creditsEl = container.querySelector("#s-credits");
  getCredits()
    .then((balance) => {
      creditsEl.textContent = balance === null ? "아직 풀이를 받아본 적이 없어요" : `${balance}회`;
    })
    .catch((err) => {
      creditsEl.textContent = err?.message || "불러오지 못했어요.";
      creditsEl.style.color = "var(--danger)";
      creditsEl.style.fontSize = "13px";
    });

  container.querySelector("#s-leave").addEventListener("click", () => {
    if (confirm("현재 공간에서 나갈까요? 다시 들어오려면 PIN을 입력해야 해요. (데이터는 그대로 남아있어요)")) {
      setSpaceId("");
      location.hash = "#/";
      location.reload();
    }
  });
}
