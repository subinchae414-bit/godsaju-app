# 사주풀이 앱

개인, 가족, 연인, 친구의 사주를 등록해두고 각자의 사주 풀이와 두 사람 간의 궁합을 볼 수 있는 웹 앱입니다.
빌드 도구 없이 순수 HTML/CSS/JavaScript로 만들어졌고, **PIN으로 연결된 여러 기기·브라우저에서 같은 데이터를 공유**합니다.

## 어떻게 동작하나요

- **사람 목록 / 사주·궁합·운세 풀이 결과 / 남은 횟수(credits)**는 [Supabase](https://supabase.com)(무료 클라우드 DB)에 저장됩니다. 앱 첫 화면에서 입력하는 **PIN(비밀번호)** 이 곧 "공간 식별자"가 되어서, 같은 PIN을 입력한 모든 기기가 같은 데이터를 보게 됩니다.
- **Anthropic API 키는 브라우저가 아예 들고 있지 않습니다.** 사용자가 API 키를 입력할 필요가 없어요 — 대신 `supabase/functions/generate-reading`이라는 **Supabase Edge Function(서버 코드)**이 API 키를 비밀값으로 들고 있다가, 앱이 풀이를 요청하면 그 space(PIN)의 남은 횟수를 확인한 뒤 대신 호출해줍니다. 새로운 PIN(space)은 처음 쓸 때 무료 체험 횟수(기본 3회)가 자동으로 주어집니다.
- 앱 파일(HTML/CSS/JS) 자체는 **GitHub Pages**로 무료 배포해서, 인터넷이 되는 어떤 기기에서든 접속할 수 있게 합니다.
- **결제(충전)는 아직 준비 중**입니다. 설정 화면에 "충전하기" 버튼 자리는 만들어뒀지만, 실제 결제 연동은 결제대행사(PG) 계정이 있어야 붙일 수 있어요. 아래 "결제(충전) 붙이기" 섹션을 참고하세요.

> ⚠️ **보안 수준 안내**: PIN은 "가족·지인끼리만 아는 비밀번호" 수준의 가벼운 보호 장치이지, 은행 수준의 보안이 아닙니다. Supabase의 anon key(공개 키)는 원래 브라우저에 노출되도록 설계된 키이고, 이 앱은 별도의 로그인 시스템 없이 PIN으로 파생된 문자열을 데이터 구분자로만 사용합니다. 민감한 개인정보를 다룬다는 점을 감안해 PIN은 추측하기 어렵게 정하고, 앱 URL과 PIN을 신뢰할 수 있는 사람하고만 공유하세요.

---

## 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 에서 무료 회원가입 후 **New Project** 생성 (리전은 가까운 곳 아무 곳이나 선택).
2. 프로젝트가 만들어지면 왼쪽 메뉴 **SQL Editor**로 들어가서 아래 SQL을 실행합니다 (테이블 2개 생성).

```sql
create extension if not exists pgcrypto;

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  space_id text not null,
  name text not null,
  relation text not null,
  gender text not null,
  calendar_type text not null,
  birth_date date not null,
  birth_time time,
  time_unknown boolean not null default false,
  memo text default '',
  created_at timestamptz not null default now()
);

create index if not exists people_space_id_idx on people (space_id);

create table if not exists readings (
  id uuid primary key default gen_random_uuid(),
  space_id text not null,
  cache_key text not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (space_id, cache_key)
);

create index if not exists readings_space_id_idx on readings (space_id);

create table if not exists credits (
  space_id text primary key,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table people enable row level security;
alter table readings enable row level security;
alter table credits enable row level security;

create policy "public access to people" on people
  for all using (true) with check (true);

create policy "public access to readings" on readings
  for all using (true) with check (true);

create policy "public access to credits" on credits
  for all using (true) with check (true);

-- people/readings와 달리 credits는 이후에 추가된 테이블이라 anon 롤에 대한
-- 테이블 단위 권한이 없다. RLS 정책과 별개로 이 GRANT가 없으면 브라우저(anon 키)에서
-- "permission denied for table credits" 에러가 난다.
grant select on table credits to anon, authenticated;
```

> `credits` 테이블은 클라이언트(브라우저)에서는 **읽기만** 합니다 (설정 화면의 "남은 횟수" 표시용). 실제 차감·초기화는 아래에서 만드는 Edge Function이 `service_role` 키로만 처리해요.

3. 왼쪽 메뉴 **Settings → API**로 이동해서 다음 두 값을 복사해둡니다.
   - **Project URL**
   - **anon / public** 키 (service_role 키가 아닙니다 — 그건 절대 클라이언트 코드에 넣지 마세요)

## 2. 앱에 Supabase 정보 입력하기

`js/supabaseConfig.js` 파일을 열어 방금 복사한 값을 넣어주세요.

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

## 3. Edge Function 배포하기 (Anthropic API 키를 서버에만 두기)

브라우저는 Anthropic API 키를 전혀 모릅니다 — `supabase/functions/generate-reading`이 서버 쪽에서 키를 들고 대신 호출해줍니다. 이 함수를 배포해야 사주/궁합/운세 풀이가 실제로 동작해요.

1. [Supabase CLI](https://supabase.com/docs/guides/cli)를 설치합니다 (`npm install -g supabase` 또는 공식 가이드 참고).
2. 이 폴더에서 로그인 및 프로젝트 연결:

```sh
supabase login
supabase link --project-ref xxxxxxxx   # 1번 단계 Project URL의 https://xxxxxxxx.supabase.co 에서 xxxxxxxx 부분
```

3. [console.anthropic.com](https://console.anthropic.com/settings/keys)에서 Anthropic API 키를 발급받아 비밀값으로 등록합니다.

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

4. 함수를 배포합니다.

```sh
supabase functions deploy generate-reading
```

> `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function 안에 별도로 넣지 않아도, Supabase가 실행 시 자동으로 넣어줍니다.
>
> 코드를 수정했다면(`supabase/functions/generate-reading/index.ts`) 같은 `deploy` 명령으로 다시 배포하면 돼요.

## 4. GitHub Pages로 배포하기

이미 이 폴더는 git 저장소로 초기화되어 있습니다. GitHub에 새 저장소를 만들고 푸시하면 됩니다.

1. [github.com/new](https://github.com/new) 에서 새 저장소를 만듭니다 (Public 권장 — GitHub Pages 무료 사용 조건). README 등 추가 파일 없이 빈 저장소로 생성하세요.
2. 아래 명령을 이 폴더에서 실행합니다 (`YOUR_USERNAME`, `YOUR_REPO`를 본인 것으로 바꿔주세요).

```sh
cd /Users/jianchae/Desktop/claude
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

3. GitHub 저장소 페이지에서 **Settings → Pages**로 이동 → **Source**를 "Deploy from a branch"로, **Branch**를 `main` / `/(root)`로 설정 후 저장합니다.
4. 1~2분 후 `https://YOUR_USERNAME.github.io/YOUR_REPO/` 주소로 접속하면 앱이 열립니다. 이 주소를 다른 기기(휴대폰 등)에서도 그대로 열면 됩니다.

> 코드를 수정했다면 `git add -A && git commit -m "update" && git push` 로 다시 배포할 수 있어요.

## 5. 사용 시작하기

1. 접속하면 나오는 잠금 화면에서 **가족·지인과 함께 쓸 PIN**을 정해서 입력합니다. (4자 이상, 예: `우리가족0501`)
2. 다른 기기에서도 **같은 URL + 같은 PIN**으로 들어오면 같은 데이터를 공유하게 됩니다. 처음 쓰는 PIN이면 무료 체험 횟수(기본 3회)가 자동으로 생겨요.
3. 홈 화면의 **+** 버튼으로 나(본인), 가족, 연인, 친구를 등록합니다.
4. 이름을 눌러 사주 풀이를 확인하고, **궁합** 탭에서 두 사람을 골라 궁합을 봅니다. 남은 횟수는 **설정** 화면에서 확인할 수 있어요.

## 결제(충전) 붙이기

지금은 설정 화면에 "충전하기" 버튼 자리만 있고, 실제 결제는 아직 연결돼 있지 않습니다. 붙이려면:

1. **결제대행사(PG) 계정을 먼저 만드세요.** 한국 사용자 대상 소액 건별 결제라면 **[토스페이먼츠](https://www.tosspayments.com)**나 **[포트원(아임포트)](https://portone.io)**이 개인/소규모 사업자로 가입하기 쉬운 편이에요. 해외 카드 결제 위주라면 [Stripe](https://stripe.com)도 선택지입니다. 어느 쪽이든 사업자 정보(개인사업자 또는 그 이하 간이 결제 상품) 확인 절차가 있으니, 가입은 직접 진행해주세요.
2. 발급받은 **시크릿 키(secret key)**를 알려주시면, 결제 요청 생성 + 결제 완료 웹훅을 처리하는 Edge Function(예: `create-payment`, `payment-webhook`)을 만들어서 결제 성공 시 `credits.balance`를 올려주는 로직까지 이어서 구현해드릴게요.
3. 설정 화면의 "충전하기" 버튼을 그 결제 페이지로 연결하면 끝이에요.

## 로컬에서 미리 확인하기

배포 전 로컬에서 먼저 확인하고 싶다면:

```sh
cd /Users/jianchae/Desktop/claude
python3 -m http.server 8000
```

이후 브라우저에서 `http://localhost:8000` 접속. (Supabase 설정을 먼저 채워야 정상 동작합니다.)

## 폴더 구조

```
index.html               진입점 (Supabase JS 라이브러리, 만세력 라이브러리 CDN/로컬 로드)
css/style.css              전체 스타일
js/app.js                   해시 기반 라우터 + PIN 잠금 게이트 + 남은 횟수 표시
js/space.js                 PIN → 공간 식별자(space_id) 파생/저장
js/supabaseConfig.js        Supabase 프로젝트 URL/anon key (직접 입력 필요)
js/supabaseClient.js        Supabase 클라이언트 생성
js/storage.js               사람/캐시/남은 횟수 데이터 CRUD (Supabase)
js/claude.js                 generate-reading Edge Function 스트리밍 호출 (API 키는 서버에만 있음)
js/sajuCalc.js                만세력(vendor/lunar.js) 기반 사주 간지 정밀 계산
js/prompts.js                사주/궁합/운세 프롬프트 생성 (계산된 간지를 그대로 전달)
js/markdown.js                마크다운 → HTML 변환
js/vendor/lunar.js            사주/음력 계산 라이브러리 (lunar-javascript, MIT, 자체 호스팅)
js/views/lock.js              PIN 입력(잠금) 화면
js/views/home.js              홈(사람 목록)
js/views/personForm.js        사람 추가/수정
js/views/saju.js              개인 사주 풀이
js/views/compat.js            궁합 풀이 (하트 점수 포함)
js/views/fortune.js           내일/3일/일주일 운세
js/views/share.js             PIN 없이 보는 읽기 전용 공유 링크
js/views/settings.js          남은 횟수 확인 / 충전 / 공간 전환
supabase/functions/generate-reading/index.ts   Claude API 프록시 (API 키·횟수 차감을 서버에서 처리)
```

## 데이터에 대해

- 사람 프로필, 사주/궁합/운세 풀이 결과, 남은 횟수: Supabase에 저장되며, 같은 PIN을 아는 모든 기기에서 공유됩니다.
- Anthropic API 키: 브라우저에는 전혀 저장되지 않습니다. `supabase/functions/generate-reading`이 서버 쪽 비밀값으로만 갖고 있어요.
- 연주/월주/일주/시주(간지)는 `js/vendor/lunar.js`(만세력 라이브러리, 절기·율리우스일 기반)로 정밀 계산되며, Claude는 이 계산된 간지를 바탕으로 해석 글만 작성합니다. 다만 성격·강점 등 해석 자체는 AI가 작성한 참고용 콘텐츠입니다.
- 음력(윤달) 생일은 현재 평달만 지원해요. 윤달에 태어난 분은 정확한 간지가 아닐 수 있습니다.
