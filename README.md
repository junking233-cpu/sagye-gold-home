# 사계절 금거래소 홈페이지 (www.sagyegold.co.kr)

## 🔴 시세는 장부에서만 바꿉니다

- 사계절 시세는 **장부 「손님 시세」 사계절 탭** 한 곳에서 바꿉니다 (https://kh-jangbu-v3.vercel.app/ledger/home-rates).
  저장하면 홈페이지 · 서브 시세판(display.html) · 카카오 챗봇에 30초 안 (길어도 5분) 나갑니다.
- 이 저장소에는 `prices.js` · `prices.json` 이 **없습니다.** GitHub 에서 고칠 곳이 없고, 고쳐도 손님 화면에 안 나갑니다.
- **어떤 워크플로도 `prices.js` · `prices.json` 을 커밋하지 마세요.** 루트에 같은 이름 정적 파일이 생기면
  Vercel 이 그것을 함수보다 먼저 줘서 장부 값이 가려집니다 (`.vercelignore` 가 한 번 더 막지만 만들지 마세요).

## 어떻게 도나

| 주소 | 누가 만드나 | 누가 읽나 |
|---|---|---|
| `/prices.js` | `api/prices-js.js` (vercel.json rewrite) | HTML 9장 `<script src="prices.js">` |
| `/prices.json` | `api/prices-json.js` (vercel.json rewrite) | 카카오 챗봇 `api/prices.js` · 텔레그램 카드 `notify_telegram.py` |

- 두 함수는 장부 Supabase `site_rates` id 3 을 공개(publishable) 키로 **읽기만** 합니다 (`api/_sagye.js`).
  - `/prices.js` = 맨 위 15칸(장부 값) + `const 시세날짜 = "YYYY-MM-DD"`(장부 저장 날짜 · 한국) + 식(`scripts/formula.src.js`, 한 글자도 안 바꿈)
  - `/prices.json` = 옛 `convert-prices.js` 가 만들던 것과 같은 글자 (`updated` = 장부 저장 날짜)
  - 홈페이지 「UPDATED」 와 서브 시세판 날짜는 `시세날짜` 를 씁니다 (보는 사람 휴대폰 날짜가 아님).
- 장부를 못 읽으면 (꼴 틀림 · 2초 넘김 · 5xx · 빈 줄 · 끊김): 함수 메모리의 마지막 장부 값 → 그것도 없으면 예비 값(`FALLBACK_BASE` · 날짜 2026-10-31 그대로).
- 응답 머리글 `X-Rates-Source: ledger | memory | fallback` · `X-Rates-Date` · (실패 까닭) `X-Rates-Reason`.
  캐시는 장부 값 `s-maxage=30, stale-while-revalidate=300` · 메모리/예비 값 `s-maxage=10`.
- 텔레그램 카드 그림은 자동으로 안 보냅니다 (장부가 알림 방에 한 줄을 보냅니다). 그림이 필요하면 Actions → 「텔레그램 가격 알림」 → Run workflow.

## 식(판매가 · 매입 등급 계산)을 바꿀 때

1. `scripts/formula.src.js` 를 고칩니다 (이 파일이 원본).
2. `node scripts/make-formula.mjs` → `api/_sagye-formula.js` 를 다시 만듭니다 (함수는 이 파일을 import 합니다).
3. `node scripts/regress.mjs` → 모두 ok 여야 올립니다. (식을 바꾸면 옛 판은 「식이 다른 판」 으로 세고 넘어갑니다.
   판매가 · 매입가 계산이 바뀌었으면 `api/_sagye.js` 의 `buildJson` 과 `convert-prices.js` 도 같이 맞춰야 prices.json 비교가 ok 입니다)
4. 장부 `lib/site-rates-sagye.ts` (사계절 탭 미리보기 사본) 도 같이 고칩니다.

## 되돌리기

- 이 판을 `git revert` 하면 정적 `prices.js` · `prices.json` 이 돌아와 예전처럼 GitHub 에서 고치는 방식이 됩니다.
  그날 값은 GitHub 에서 손으로 넣어야 합니다 (돌아온 파일은 전환하던 날 값).
