// ================================================
// 사계절 금거래소 — /prices.js (vercel.json rewrite → 이 함수)
// ================================================
// HTML 9장이 <script src="prices.js"> 로 읽는 파일을 장부 「손님 시세」 사계절 탭 값으로 만들어 줍니다.
//   맨 위 15칸 + const 시세날짜 + 식(scripts/formula.src.js → api/_sagye-formula.js, 한 글자도 안 바꿈)
// 머리글 X-Rates-Source: ledger (장부) | memory (장부를 잠깐 못 읽어 마지막 장부 값) | fallback (예비 값)
// 🔴 루트에 prices.js 정적 파일이 있으면 Vercel 이 그것을 먼저 줘서 이 함수가 안 불립니다 — 만들지 마세요.
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
    r = fallback('error');   // 여기까지 올 일은 없지만, 손님 화면에 빈 가격이 나가지 않게
  }
  setRatesHeaders(res, r, 'application/javascript; charset=utf-8');
  res.statusCode = 200;
  res.end(r.js);
}
