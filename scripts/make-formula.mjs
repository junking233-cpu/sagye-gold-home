// ================================================
// 사계절 가격 식 생성기 — scripts/formula.src.js → api/_sagye-formula.js
//
//   node scripts/make-formula.mjs           만들기 (식을 고친 뒤 꼭)
//   node scripts/make-formula.mjs --check   만들지 않고 지금 파일이 원본과 같은지만 (다르면 종료 코드 1)
//
// 왜 JSON 글자로 넣나: 식 안에 백틱과 ${…} 가 있어서(실버 9999 줄) JS 템플릿 글자로 넣으면 깨집니다.
// 왜 파일을 읽지 않고 import 하나: Vercel 함수 묶음에는 import 한 파일만 저절로 들어갑니다.
// 줄 끝은 늘 LF 로 맞춥니다 (Windows 에서 CRLF 로 받아도 같은 글자가 나오게).
// ================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'scripts', 'formula.src.js');
const OUT = join(ROOT, 'api', '_sagye-formula.js');

// 「/* ====」 줄 바로 다음 줄이 「아래는 건드리지 마세요」 인 곳부터 끝까지 (convert · 옛 prices.js 와 같은 자리)
export function formulaFrom(text) {
  const s = String(text).replace(/\r\n/g, '\n');
  const m = /\/\*[ \t]*=+[ \t]*\n[ \t]*아래는 건드리지 마세요/.exec(s);
  if (!m) throw new Error('식 시작(/* ==== 다음 줄 「아래는 건드리지 마세요」)을 못 찾았습니다');
  return s.slice(m.index);
}

export function moduleText(formula) {
  return [
    '// 생성물 — 손으로 고치지 마세요. 원본은 scripts/formula.src.js · 만들기: node scripts/make-formula.mjs',
    '// 사계절 prices.js 의 식 부분 (/* ==== 아래는 건드리지 마세요 … 끝) 을 JSON 글자로 담았습니다.',
    '// 함수(api/prices-js.js)가 장부 15칸 아래에 이 글자를 한 글자도 안 바꾸고 붙입니다.',
    'export const FORMULA = ' + JSON.stringify(formula) + ';',
    '',
  ].join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const want = moduleText(formulaFrom(readFileSync(SRC, 'utf8')));
  if (process.argv.includes('--check')) {
    let now = '';
    try { now = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n'); } catch {}
    if (now !== want) {
      console.error('❌ api/_sagye-formula.js 가 scripts/formula.src.js 와 다릅니다 — node scripts/make-formula.mjs 를 돌리세요');
      process.exit(1);
    }
    console.log('ok api/_sagye-formula.js = scripts/formula.src.js');
  } else {
    writeFileSync(OUT, want, 'utf8');
    console.log('✅ api/_sagye-formula.js 만듦 (' + formulaFrom(readFileSync(SRC, 'utf8')).length + '글자)');
  }
}
