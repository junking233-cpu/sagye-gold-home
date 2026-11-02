// ================================================
// 사계절 홈페이지 가격 식 — 원본 (이 파일만 고치세요)
//
// 손님 화면의 /prices.js 는 Vercel 함수(api/prices-js.js)가 만듭니다:
//   맨 위 15칸 = 장부 「손님 시세」 사계절 탭 값 (자동) + 아래 식 = 이 파일의 /* ==== 블록(손대지 말라는 머리)부터 끝까지.
// 식을 바꿨으면 꼭:
//   1) node scripts/make-formula.mjs      → api/_sagye-formula.js 다시 만듦 (함수는 그 파일을 읽습니다)
//   2) node scripts/regress.mjs           → 회귀 시험 (모두 ok 여야 올림)
//   3) 장부 lib/site-rates-sagye.ts (미리보기 사본) 도 같이 고침
// 이 머리말(// 줄)은 식에 안 들어갑니다. 이 파일은 손님에게 안 나갑니다 (.vercelignore 의 scripts/).
// ================================================

/* ================================================
   아래는 건드리지 마세요 — 자동 계산됩니다
   ================================================ */

// 판매가 (손님이 살때)
const prices = {
  goldbar1:  골드바_살때,
  goldbar3:  골드바_살때 * 3,
  goldbar5:  골드바_살때 * 5,
  goldbar10: 골드바_살때 * 10 - 50000,

  deong1:  골드바_살때 - 5000,
  deong3:  (골드바_살때 - 5000) * 3,
  deong5:  (골드바_살때 - 5000) * 5,
  deong10: (골드바_살때 - 5000) * 10 - 50000,

  ring_jokak:  골드바_살때,
  ring_caric:  골드바_살때 + 10000,
  ring_animal: 골드바_살때 + 20000,
  ring_crown:  골드바_살때 + 30000,

  rice:  260000,
  shape: 280000,

  spoon1: 골드바_살때 + 40000,
  spoon3: (골드바_살때 + 40000) * 3,
  key1:   골드바_살때 + 50000,
  key3:   (골드바_살때 + 50000) * 3,
};

// 매입가 (손님이 팔때) — 덩이금 등급 자동 계산
const BUYING = {
  골드바:        골드바_팔때,
  검증3대마크:   덩이금_최고가,
  검증덩이:      덩이금_최고가 - 10000,
  기타덩이:      덩이금_최고가 - 20000,
  무검덩이:      덩이금_최고가 - 30000,
  칠보마고자등:  덩이금_최고가 - 40000,
  검인반지메달:  검인반지메달,
  검인목걸이:    검인목걸이팔찌,
  열쇠:          열쇠가격,
  상패동물골프공: 상패동물골프공,
  k18:    K18,
  k14:    K14,
  k10:    K10,
  치금_인레이: 치금_인레이,
  치금_크라운: 치금_크라운,
  백금99: 백금,
  pt:     백금,
  silver: 실버바_팔때,
};

function fmt(n) {
  return n.toLocaleString('ko-KR') + ' 원';
}

document.addEventListener('DOMContentLoaded', function() {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof val === 'number' ? fmt(val) : val;
  };

  // ===== 골드바·선물 페이지 판매가 =====
  set('price-goldbar1',    prices.goldbar1);
  set('price-goldbar3',    prices.goldbar3);
  set('price-goldbar5',    prices.goldbar5);
  set('price-goldbar10',   prices.goldbar10);
  set('price-deong1',      prices.deong1);
  set('price-deong3',      prices.deong3);
  set('price-deong5',      prices.deong5);
  set('price-deong10',     prices.deong10);
  set('price-ring-jokak',  prices.ring_jokak);
  set('price-ring-caric',  prices.ring_caric);
  set('price-ring-animal', prices.ring_animal);
  set('price-ring-crown',  prices.ring_crown);
  set('price-rice',        prices.rice);
  set('price-shape',       prices.shape);
  set('price-spoon1',      prices.spoon1);
  set('price-spoon3',      prices.spoon3);
  set('price-key1',        prices.key1);
  set('price-key3',        prices.key3);

  // ===== 메인 홈페이지 시세판 =====
  set('buy-gold',    골드바_살때);
  set('sell-gold',   골드바_팔때);
  set('sell-18k',    K18);
  set('sell-14k',    K14);
  set('sell-pt',     백금);
  set('buy-silver',  실버바_살때);
  set('sell-silver', 실버바_팔때);

  // ===== 실버바 판매 페이지 =====
  set('price-silver999',     실버바_살때);
  set('price-silver-granule', 실버바_살때 + 100000);
  const sub = document.getElementById('price-silver9999-sub');
  if (sub) sub.textContent = `999.9 — ${(실버바_살때 + 100000).toLocaleString('ko-KR')} 원`;
  const subEl = document.getElementById('price-silver9999-sub');
  if (subEl) subEl.textContent = '999.9 — ' + fmt(실버바_살때 + 100000);
  set('price-silver-granule', 실버바_살때 + 100000);

  // ===== 서브 시세판 매입 등급표 (display.html) =====
  set('autumn-g1', BUYING.검증3대마크);
  set('autumn-g2', BUYING.검증덩이);
  set('autumn-g3', BUYING.기타덩이);
  set('autumn-g4', BUYING.무검덩이);
  set('autumn-g5', BUYING.칠보마고자등);
});
