/* ================================================
   사계절 금거래소 — 가격 관리 파일
   
   ★ 매일 여기서만 숫자 하나만 바꾸세요! ★
   골드바 1돈 기준가격을 바꾸면 모든 가격이 자동 계산됩니다.
   ================================================ */

const BASE = 860000; // ← 이 숫자만 바꾸세요 (골드바 1돈 기준)

/* ================================================
   아래는 건드리지 마세요 — 자동 계산됩니다
   ================================================ */

function fmt(n) {
  return n.toLocaleString('ko-KR') + ' 원';
}

const prices = {
  // 골드바
  goldbar1: BASE,
  goldbar3: BASE * 3,
  goldbar5: BASE * 5,
  goldbar10: BASE * 10 - 50000,

  // 덩이금 (골드바 -5,000원/돈)
  deong1: BASE - 5000,
  deong3: (BASE - 5000) * 3,
  deong5: (BASE - 5000) * 5,
  deong10: (BASE - 5000) * 10 - 50000,

  // 돌반지 (골드바 기준)
  ring_jokak: BASE,
  ring_caric: BASE + 10000,
  ring_animal: BASE + 20000,
  ring_crown: BASE + 30000,

  // 기타 선물용 순금
  rice: 260000,   // 쌀알금 1g (고정)
  shape: 280000,  // 모양금 1g (고정)

  // 금수저 / 황금열쇠 (돈당)
  spoon1: BASE + 40000,
  spoon3: (BASE + 40000) * 3,
  key1: BASE + 50000,
  key3: (BASE + 50000) * 3,
};

// 페이지에 가격 반영
document.addEventListener('DOMContentLoaded', function() {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof val === 'number' ? fmt(val) : val;
  };

  // 골드바
  set('price-goldbar1', prices.goldbar1);
  set('price-goldbar3', prices.goldbar3);
  set('price-goldbar5', prices.goldbar5);
  set('price-goldbar10', prices.goldbar10);

  // 덩이금
  set('price-deong1', prices.deong1);
  set('price-deong3', prices.deong3);
  set('price-deong5', prices.deong5);
  set('price-deong10', prices.deong10);

  // 돌반지
  set('price-ring-jokak', prices.ring_jokak);
  set('price-ring-caric', prices.ring_caric);
  set('price-ring-animal', prices.ring_animal);
  set('price-ring-crown', prices.ring_crown);

  // 기타
  set('price-rice', prices.rice);
  set('price-shape', prices.shape);
  set('price-spoon1', prices.spoon1);
  set('price-spoon3', prices.spoon3);
  set('price-key1', prices.key1);
  set('price-key3', prices.key3);
});
