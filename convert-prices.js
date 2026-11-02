// ================================================
// prices.js → prices.json 변환 스크립트 — 🔴 이제 회귀 시험 전용 (손님 화면에 안 쓰임)
// ================================================
// 사계절 시세는 장부 「손님 시세」 사계절 탭에서 바꾸고, /prices.js · /prices.json 은
// Vercel 함수(api/prices-js.js · api/prices-json.js)가 만듭니다. 이 파일은 그 함수가
// 옛 방식과 «같은 글자» 를 내는지 견주는 기준으로만 남겨 둡니다 (scripts/regress.mjs).
//
//   node convert-prices.js <읽을 prices.js 경로> <쓸 prices.json 경로>
//
// 🔴 루트에 prices.json 을 만들어 커밋하지 마세요 — 정적 파일이 함수를 가려 장부 값이 안 나갑니다.
// 아래 정규식 · 객체 부분은 옛 판 그대로입니다 (바꾸면 회귀 시험의 기준이 흔들립니다).
// ================================================
const fs = require('fs');
const path = require('path');

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('쓰는 법: node convert-prices.js <읽을 prices.js 경로> <쓸 prices.json 경로>');
  console.error('(사계절 시세는 장부 「손님 시세」 에서 바꿉니다 — 이 스크립트는 회귀 시험 전용)');
  process.exit(1);
}

const pricesJsContent = fs.readFileSync(
  path.resolve(inPath),
  'utf8'
);

function extractNumber(code, varName) {
  const regex = new RegExp(`const\\s+${varName}\\s*=\\s*(\\d+)`);
  const match = code.match(regex);
  if (!match) throw new Error(`변수를 찾을 수 없습니다: ${varName}`);
  return parseInt(match[1], 10);
}

function extractString(code, varName) {
  const regex = new RegExp(`const\\s+${varName}\\s*=\\s*['"]([^'"]+)['"]`);
  const match = code.match(regex);
  if (!match) throw new Error(`변수를 찾을 수 없습니다: ${varName}`);
  return match[1];
}

const 골드바_살때 = extractNumber(pricesJsContent, '골드바_살때');
const 골드바_팔때 = extractNumber(pricesJsContent, '골드바_팔때');
const K18 = extractNumber(pricesJsContent, 'K18');
const K14 = extractNumber(pricesJsContent, 'K14');
const K10 = extractNumber(pricesJsContent, 'K10');
const 백금 = extractNumber(pricesJsContent, '백금');
const 실버바_살때 = extractNumber(pricesJsContent, '실버바_살때');
const 실버바_팔때 = extractNumber(pricesJsContent, '실버바_팔때');
const 덩이금_최고가 = extractNumber(pricesJsContent, '덩이금_최고가');
const 검인반지메달 = extractNumber(pricesJsContent, '검인반지메달');
const 검인목걸이팔찌 = extractNumber(pricesJsContent, '검인목걸이팔찌');
const 열쇠가격 = extractString(pricesJsContent, '열쇠가격');
const 상패동물골프공 = extractString(pricesJsContent, '상패동물골프공');
const 치금_인레이 = extractNumber(pricesJsContent, '치금_인레이');
const 치금_크라운 = extractNumber(pricesJsContent, '치금_크라운');

const now = new Date();
const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const updated = kstDate.toISOString().split('T')[0];

const pricesJson = {
  updated: updated,
  base: {
    골드바_살때: 골드바_살때,
    골드바_팔때: 골드바_팔때,
    K18: K18,
    K14: K14,
    K10: K10,
    백금: 백금,
    실버바_살때: 실버바_살때,
    실버바_팔때: 실버바_팔때
  },
  special_buying: {
    검인반지메달: 검인반지메달,
    검인목걸이팔찌: 검인목걸이팔찌,
    열쇠: 열쇠가격,
    상패동물골프공: 상패동물골프공
  },
  chigum: {
    인레이: 치금_인레이,
    크라운: 치금_크라운
  },
  buying: {
    골드바: 골드바_팔때,
    검증3대마크: 덩이금_최고가,
    검증덩이:    덩이금_최고가 - 10000,
    기타덩이:    덩이금_최고가 - 20000,
    무검덩이:    덩이금_최고가 - 30000,
    칠보마고자등: 덩이금_최고가 - 40000,
    검인반지메달: 검인반지메달,
    검인목걸이팔찌: 검인목걸이팔찌,
    K18: K18,
    K14: K14,
    K10: K10,
    백금: 백금,
    실버바_1kg: 실버바_팔때,
    치금_인레이: 치금_인레이,
    치금_크라운: 치금_크라운,
    열쇠_돈: 열쇠가격 + ' (천원 단위)',
    상패동물골프공_돈: 상패동물골프공 + ' (천원 단위)'
  },
  selling: {
    골드바_1돈: 골드바_살때,
    골드바_3돈: 골드바_살때 * 3,
    골드바_5돈: 골드바_살때 * 5,
    골드바_10돈: 골드바_살때 * 10 - 50000,
    덩이금_1돈: 골드바_살때 - 5000,
    덩이금_3돈: (골드바_살때 - 5000) * 3,
    덩이금_5돈: (골드바_살때 - 5000) * 5,
    덩이금_10돈: (골드바_살때 - 5000) * 10 - 50000,
    돌반지_조각: 골드바_살때,
    돌반지_캐릭터: 골드바_살때 + 10000,
    돌반지_동물: 골드바_살때 + 20000,
    돌반지_크라운: 골드바_살때 + 30000,
    쌀알금_1g: 260000,
    모양쌀알금_1g: 280000,
    금수저_1돈: 골드바_살때 + 40000,
    금수저_3돈: (골드바_살때 + 40000) * 3,
    열쇠_1돈: 골드바_살때 + 50000,
    열쇠_3돈: (골드바_살때 + 50000) * 3,
    실버바_999: 실버바_살때,
    실버바_9999: 실버바_살때 + 100000
  }
};

fs.writeFileSync(
  path.resolve(outPath),
  JSON.stringify(pricesJson, null, 2),
  'utf8'
);

console.log('✅ prices.json 생성 완료!');
console.log(`📅 업데이트 날짜: ${updated}`);
console.log(`💰 골드바 살때: ${골드바_살때.toLocaleString()}원`);
console.log(`💰 골드바 팔때: ${골드바_팔때.toLocaleString()}원`);
console.log(`🔶 덩이금 최고가: ${덩이금_최고가.toLocaleString()}원`);
console.log(`🦷 치금 인레이: ${치금_인레이.toLocaleString()}원`);
console.log(`🦷 치금 크라운: ${치금_크라운.toLocaleString()}원`);
