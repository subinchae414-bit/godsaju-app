# 사주풀이 앱

개인, 가족, 연인, 친구의 사주를 등록해두고 각자의 사주 풀이와 두 사람 간의 궁합을 볼 수 있는 웹 앱입니다.
빌드 도구 없이 순수 HTML/CSS/JavaScript로 만들어졌고, **PIN으로 연결된 여러 기기·브라우저에서 같은 데이터를 공유**합니다.

## 어떻게 동작하나요

- **사람 목록 / 사주·궁합 풀이 결과**는 [Supabase](https://supabase.com)(무료 클라우드 DB)에 저장됩니다. 앱 첫 화면에서 입력하는 **PIN(비밀번호)** 이 곧 "공간 식별자"가 되어서, 같은 PIN을 입력한 모든 기기가 같은 데이터를 보게 됩니다.
- **Anthropic API 키**는 결제와 직결되는 정보라 동기화하지 않고, 각 기기의 브라우저에만 따로 저장됩니다. 새 기기에서는 설정에서 다시 입력해야 해요.
- 앱 파일(HTML/CSS/JS) 자체는 **GitHub Pages**로 무료 배포해서, 인터넷이 되는 어떤 기기에서든 접속할 수 있게 합니다.

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

alter table people enable row level security;
alter table readings enable row level security;

create policy "public access to people" on people
  for all using (true) with check (true);

create policy "public access to readings" on readings
  for all using (true) with check (true);
```

3. 왼쪽 메뉴 **Settings → API**로 이동해서 다음 두 값을 복사해둡니다.
   - **Project URL**
   - **anon / public** 키 (service_role 키가 아닙니다 — 그건 절대 클라이언트 코드에 넣지 마세요)

## 2. 앱에 Supabase 정보 입력하기

`js/supabaseConfig.js` 파일을 열어 방금 복사한 값을 넣어주세요.

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

## 3. GitHub Pages로 배포하기

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

## 4. 사용 시작하기

1. 접속하면 나오는 잠금 화면에서 **가족·지인과 함께 쓸 PIN**을 정해서 입력합니다. (4자 이상, 예: `우리가족0501`)
2. 다른 기기에서도 **같은 URL + 같은 PIN**으로 들어오면 같은 데이터를 공유하게 됩니다.
3. 각 기기의 **설정**에서 [Anthropic API 키](https://console.anthropic.com/settings/keys)를 입력합니다 (기기마다 따로 입력).
4. 홈 화면의 **+** 버튼으로 나(본인), 가족, 연인, 친구를 등록합니다.
5. 이름을 눌러 사주 풀이를 확인하고, **궁합** 탭에서 두 사람을 골라 궁합을 봅니다.

## 로컬에서 미리 확인하기

배포 전 로컬에서 먼저 확인하고 싶다면:

```sh
cd /Users/jianchae/Desktop/claude
python3 -m http.server 8000
```

이후 브라우저에서 `http://localhost:8000` 접속. (Supabase 설정을 먼저 채워야 정상 동작합니다.)

## 폴더 구조

```
index.html               진입점 (Supabase JS 라이브러리 CDN 로드)
css/style.css              전체 스타일
js/app.js                   해시 기반 라우터 + PIN 잠금 게이트
js/space.js                 PIN → 공간 식별자(space_id) 파생/저장
js/supabaseConfig.js        Supabase 프로젝트 URL/anon key (직접 입력 필요)
js/supabaseClient.js        Supabase 클라이언트 생성
js/storage.js               사람/캐시 데이터 CRUD (Supabase), API 키(로컬)
js/claude.js                 Claude API 스트리밍 호출
js/prompts.js                사주/궁합 프롬프트 생성
js/markdown.js                마크다운 → HTML 변환
js/views/lock.js              PIN 입력(잠금) 화면
js/views/home.js              홈(사람 목록)
js/views/personForm.js        사람 추가/수정
js/views/saju.js              개인 사주 풀이
js/views/compat.js            궁합 풀이
js/views/settings.js          API 키 설정 / 공간 전환
```

## 데이터에 대해

- 사람 프로필, 사주/궁합 풀이 결과: Supabase에 저장되며, 같은 PIN을 아는 모든 기기에서 공유됩니다.
- Anthropic API 키: 각 브라우저의 `localStorage`에만 저장되고 동기화되지 않습니다.
- 사주/궁합 해석은 정확한 만세력 계산이 아닌 Claude(`claude-opus-5`)의 AI 해석이므로 참고용으로만 활용하세요.
