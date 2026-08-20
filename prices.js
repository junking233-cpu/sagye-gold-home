/* ================================================
   사계절 금거래소 — 가격 관리 파일

   ★★★ 매일 여기 숫자만 바꾸세요! ★★★
   (손님 기준 — 살때: 손님이 살때 / 팔때: 손님이 팔때)
   ================================================ */

// ── 시세 (매일 업데이트) ──────────────────────────
const 골드바_살때  = 775000;   // 손님이 살때 (우리 판매가) 1돈 기준
const 골드바_팔때  = 748000;   // 손님이 팔때 (우리 매입가) 1돈 기준
const K18          = 554000;   // 18K 손님이 팔때 원/돈
const K14          = 430000;   // 14K 손님이 팔때 원/돈
const K10          = 200000;   // 10K 손님이 팔때 원/돈
const 백금         = 200000;   // 백금 손님이 팔때 원/돈
const 실버바_살때  = 3350000;  // 실버바 손님이 살때 1kg 99.9 기준
const 실버바_팔때  = 2850000;  // 실버바 손님이 팔때 1kg 99.9 기준

// ── 덩이금 매입가 (매일 업데이트) ───────────────────
const 덩이금_최고가 = 745000;  // GRADE 1 기준가 → 등급별 -10,000원 자동 계산

// ── 개별 매입가 (필요시 수동 수정) ──────────────────
const 검인반지메달    = 740000;   // 검인 반지 · 회사메달 원/돈
const 검인목걸이팔찌  = 738000;   // 검인 목걸이 · 팔찌 원/돈
const 열쇠가격        = '710~735'; // 열쇠 원/돈 (범위로 표시)
const 상패동물골프공  = '710~715'; // 상패 · 동물 · 골프공 원/돈

// ── 치금 (인레이/크라운 세분화) ──────────────────
const 치금_인레이     = 370000;   // 치금 인레이 원/돈
const 치금_크라운     = 280000;   // 치금 크라운 원/돈

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
