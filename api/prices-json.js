// ================================================
// 사계절 금거래소 — /prices.json (vercel.json rewrite → 이 함수)
// ================================================
// 카카오 챗봇(api/prices.js)과 텔레그램 카드(notify_telegram.py)가 읽는 파일입니다.
//   옛 convert-prices.js 가 만들던 것과 같은 글자 (키 순서 · 2칸 들여쓰기 · 끝 줄바꿈 없음)
//   updated = 장부 저장 날짜 'YYYY-MM-DD' (한국) · 예비 값이면 그 값의 날짜
// 머리글 X-Rates-Source: ledger | memory | fallback
// 🔴 루트에 prices.json 정적 파일이 있으면 Vercel 이 그것을 먼저 줘서 이 함수가 안 불립니다 — 만들지 마세요.
// ================================================
import { pick, fallback, setRatesHeaders } from './_sagye.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.statusCode = 204;
    return res.end();
  }
  let r;
  try {
    r = await pick();
  } catch (e) {
    r = fallback('error');
  }
  setRatesHeaders(res, r, 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(r.json);
}
