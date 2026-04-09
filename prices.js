/* ================================================
   사계절 금거래소 — 가격 관리 파일

   ★★★ 매일 여기 숫자만 바꾸세요! ★★★
   (손님 기준 — 살때: 손님이 살때 / 팔때: 손님이 팔때)
   ================================================ */

const 골드바_살때  = 860000;   // 손님이 살때 (우리 판매가) 1돈 기준
const 골드바_팔때  = 835000;   // 손님이 팔때 (우리 매입가) 1돈 기준
const K18          = 616000;   // 18K 손님이 팔때 원/돈
const K14          = 479000;   // 14K 손님이 팔때 원/돈
const 백금         = 300000;   // 백금 손님이 팔때 원/돈
const 실버바_살때  = 4300000;  // 실버바 손님이 살때 1kg 99.9 기준
const 실버바_팔때  = 3600000;  // 실버바 손님이 팔때 1kg 99.9 기준

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
  골드바:       골드바_팔때,
  검증3대마크:  골드바_팔때 - 5000,
  검증덩이:     골드바_팔때 - 15000,
  기타덩이:     골드바_팔때 - 25000,
  무검덩이:     골드바_팔때 - 35000,
  칠보마고자등: 골드바_팔때 - 45000,
  k18:    K18,
  k14:    K14,
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

  // ===== 서브 시세판 매입 등급표 (display.html) =====
  set('autumn-g1', BUYING.검증3대마크);
  set('autumn-g2', BUYING.검증덩이);
  set('autumn-g3', BUYING.기타덩이);
  set('autumn-g4', BUYING.무검덩이);
  set('autumn-g5', BUYING.칠보마고자등);
});
