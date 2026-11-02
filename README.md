# 사계절 금거래소 홈페이지 (www.sagyegold.co.kr)

## 🔴 시세는 장부에서만 바꿉니다

- 사계절 시세는 **장부 「손님 시세」 사계절 탭** 한 곳에서 바꿉니다.
  저장하면 홈페이지 · 서브 시세판(display.html) · 카카오 챗봇에 30초 안 (길어도 5분) 나갑니다.
- 이 저장소에는 `prices.js` · `prices.json` 이 **없습니다.** GitHub 에서 고칠 곳이 없고, 고쳐도 손님 화면에 안 나갑니다.
- **GitHub 에 `prices.js` · `prices.json` 을 다시 만들지 마세요. 어떤 워크플로도 커밋하지 마세요.**
  루트에 같은 이름 정적 파일이 생기면 Vercel 이 그것을 함수보다 먼저 줘서 장부 값이 가려집니다 (`.vercelignore` 가 한 번 더 막습니다).
  누가 만들면 워크플로 「시세 파일 막기」 가 빨간 X 로 실패하고(GitHub 메일) 텔레그램 알림 방에 한 줄을 보냅니다.

## 어떻게 도나

| 주소 | 누가 만드나 | 누가 읽나 |
|---|---|---|
| `/prices.js` | `api/prices-js.js` (vercel.json rewrite) | HTML 9장 `<script src="prices.js">` |
| `/prices.json` | `api/prices-json.js` (vercel.json rewrite) | 카카오 챗봇 `api/prices.js` · 텔레그램 카드 `notify_telegram.py` |

- 두 함수는 장부의 사계절 줄을 공개(publishable) 키로 **읽기만** 합니다 (`api/_sagye.js`).
  - `/prices.js` = 맨 위 16칸(장부 값) + `const 시세날짜 = "YYYY-MM-DD"`(장부 저장 날짜 · 한국) + 식(`scripts/formula.src.js`, 한 글자도 안 바꿈)
  - 16칸 = 옛 15칸 + `덩이금_단계`(장부 「덩이 한 단계 차이」 · 1,000원 단위 1,000 ~ 50,000) — 덩이 등급 = `덩이금_최고가` − 단계 × 0·1·2·3·4 (검증3대마크 → 칠보·마고자). 장부에 그 칸이 없으면(옛 저장) 10000 = 옛 식에 박혀 있던 수 · `prices.json` 은 키가 그대로이고 `buying` 등급 값에만 들어갑니다.
  - `/prices.json` = 옛 `convert-prices.js` 가 만들던 것과 같은 글자 (`updated` = 장부 저장 날짜)
  - 홈페이지 「UPDATED」 와 서브 시세판 날짜는 `시세날짜` 를 씁니다 (보는 사람 휴대폰 날짜는 안 씀).
- 장부를 못 읽으면 (꼴 틀림 · 2초 넘김 · 5xx · 빈 줄 · 끊김):
  1. 함수 메모리의 마지막 장부 값 (그 저장 날짜 그대로)
  2. 그것도 없으면 예비 값(`FALLBACK_BASE` · 날짜 `FALLBACK_YMD` 그대로) — **단 그 날짜부터 `FALLBACK_MAX_DAYS`(3)일 안에서만**
  3. 예비 값도 낡았으면 숫자를 안 내고 **503** — 홈페이지 가격 칸은 「-」 · 날짜 자리에 「시세를 불러오지 못했습니다」 ·
     카카오는 「시세 정보를 불러오는데 문제가 있어요 · 전화」. 낡은 매입가가 손님에게 나가지 않게 하려는 것입니다.
- 응답 머리글 `X-Rates-Source: ledger | memory | fallback | none(503)` · `X-Rates-Date` · (실패 까닭) `X-Rates-Reason`.
  캐시는 장부 값 `s-maxage=30, stale-while-revalidate=270` (합 300초 = 길어도 5분) · 메모리/예비 값 `s-maxage=10` · 503 은 `no-store`.
- 텔레그램 카드 그림은 자동으로 안 보냅니다 (장부가 알림 방에 한 줄을 보냅니다). 그림이 필요하면 Actions → 「텔레그램 가격 알림」 → Run workflow.

## 올리기 (main 에 합치기)

1. 장부 「손님 시세」 사계절 탭에서 오늘 값으로 **첫 저장**을 먼저 합니다. (`node scripts/regress.mjs --live` 에 `까닭=empty` 가 안 나오면 저장된 것)
2. `git fetch origin` → GitHub main 에 이 브랜치에 없는 `prices.js` 커밋이 있으면 아래 「GitHub main 을 합칠 때」 대로 합칩니다.
3. `node scripts/regress.mjs --live` → 모두 ok. (예비 값 = origin/main 의 마지막 `prices.js` · 실전 정적 `/prices.js` 인지까지 봅니다.
   다르면 FAIL 줄이 넣을 값을 알려 줍니다 → `api/_sagye.js` 의 `FALLBACK_BASE` · `FALLBACK_YMD` 를 고칩니다)
4. 미리보기 배포에서 `/prices.js` · `/prices.json` 머리글 `x-rates-source: ledger` · 화면 숫자 · `/scripts/regress.mjs` → 404 · `/README.md` → 404 를 봅니다.
   시간은 캐시를 비켜 잽니다: `curl -s -o /dev/null -w '%{time_total}\n' "<미리보기>/prices.json?t=$RANDOM"` (요청 머리글 `Cache-Control: no-cache` 는 Vercel CDN 이 무시해서 HIT 를 잽니다).
5. 조용한 시간에 **합치기 커밋 하나로** 합칩니다: `git merge --no-ff ledger-rates` (GitHub 에서는 「Create a merge commit」). 되돌리기가 한 줄이 됩니다.

## GitHub main 을 합칠 때 (충돌 푸는 법)

이 브랜치는 `prices.js` 를 지우고 식 부분을 `scripts/formula.src.js` 로 옮겼습니다. 그래서 main 의 「Update prices.js」 를 합치면 이렇게 나옵니다.

- `CONFLICT (content): Merge conflict in scripts/formula.src.js` — git 이 이름 바뀜으로 보고 main 의 숫자 15줄을 식 원본에 넣으려 합니다.
  → **이 브랜치 쪽(HEAD)** 을 고릅니다: `git checkout --ours scripts/formula.src.js && git add scripts/formula.src.js`.
  main 쪽을 고르면 식 원본 머리에 「★★★ 매일 여기 숫자만 바꾸세요! ★★★」 와 숫자가 되살아나 (손님 숫자는 안 바뀌지만) 거기를 고치면 나간다고 오해하게 됩니다.
- `CONFLICT (modify/delete): prices.json` → **지움**: `git rm prices.json`.
- 그날 숫자는 충돌 덩어리의 main 쪽 15줄(또는 `git show origin/main:prices.js`)을 보고 **장부 사계절 탭**과 **`FALLBACK_BASE`** 에 옮깁니다.
- `node scripts/make-formula.mjs --check` · `node scripts/regress.mjs` 가 모두 ok 여야 합니다.

## 식(판매가 · 매입 등급 계산)을 바꿀 때

1. `scripts/formula.src.js` 를 고칩니다 (이 파일이 원본).
2. `node scripts/make-formula.mjs` → `api/_sagye-formula.js` 를 다시 만듭니다 (함수는 이 파일을 import 합니다).
3. `node scripts/regress.mjs` → 모두 ok 여야 올립니다. (식을 바꾸면 옛 판은 「식이 다른 판」 으로 세고 넘어갑니다.
   판매가 · 매입가 계산이 바뀌었으면 `api/_sagye.js` 의 `buildJson` 과 `convert-prices.js` 도 같이 맞춰야 prices.json 비교가 ok 입니다)
4. 장부의 사계절 탭 미리보기 사본도 같이 고칩니다.

## 되돌리기 (GitHub 에서 prices.js 를 고치던 방식으로)

🔴 그냥 `git revert` 해서 push 하면 안 됩니다. 돌아온 정적 `prices.js` · `prices.json` 은 **전환하던 날 숫자**이고,
돌아온 워크플로 두 개(`update-prices.yml` · `telegram-notify.yml` 의 push 방아쇠)가 그 push 에 바로 돌아
봇이 `prices.json` 을 오늘 날짜로 다시 커밋하고 **옛 숫자 카드가 「오늘」 날짜로 2장** 나갑니다. 카카오도 옛 숫자를 「오늘 기준」 으로 냅니다.

1. 장부 사계절 탭에 지금 나가는 15칸을 적어 둡니다. (「덩이 한 단계 차이」 가 10000 이 아니면 그것도 — 옛 `prices.js` 는 식에 10000 · 20000 · 30000 · 40000 이 박혀 있어 3에서 그 네 숫자도 손으로 고쳐야 합니다)
2. 올린 합치기 커밋을 되돌리되 커밋은 아직 안 합니다: `git revert --no-commit -m 1 <합치기 커밋>`
   (합치기 커밋 없이 빨리 감기로 올렸다면 범위 되돌리기가 이 브랜치 안의 합치기 커밋에서 멈춥니다 — 그래서 올릴 때 `--no-ff`)
3. 같은 커밋 안에서 `prices.js` 맨 위 15칸을 1의 오늘 값으로 고치고 `node convert-prices.js` 로 `prices.json` 도 다시 만듭니다.
   (그러면 봇은 바꿀 것이 없어 카드를 안 보냅니다. `telegram-notify.yml` 의 push 방아쇠로 카드 1장은 오늘 값으로 나갑니다 —
   그것도 싫으면 push 전에 Actions 에서 「텔레그램 가격 알림」 을 잠깐 Disable)
4. `git commit` → push. 그 뒤로는 예전처럼 GitHub 에서 `prices.js` 를 고칩니다.
