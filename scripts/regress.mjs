// ================================================
// 사계절 손님 시세 — 회귀 시험 (node 만 · 네트워크 없음 · --live 일 때만 장부 공개 GET 한 번)
//
//   node scripts/regress.mjs          모두
//   node scripts/regress.mjs --live   + 진짜 장부 id 3 을 공개 키로 한 번 읽어 결과만 보여 줌 (쓰기 없음)
//                                     + 실전 홈페이지 /prices.js · /prices.json 공개 GET — 아직 정적 파일이면(올리기 전) 예비 값과 같아야
//   🔴 올리기 직전엔 git fetch origin 을 먼저 — origin/main 의 prices.js (받아 둔 때 기준) 와 예비 값을 견줍니다
//
// (가) git 역사의 prices.js 판 모두 (git log --full-history — main 을 합친 뒤에도 main 쪽 판을 빠뜨리지 않게):
//      그 판 15칸 (+ 덩이금_단계 — 옛 판엔 줄이 없어 10000) → 지금 식으로 renderJs → 옛 convert-prices.js 로 돌린 prices.json
//        == 옛 판을 옛 convert 로 돌린 것 == buildJson(16칸)  (updated 만 빼고 글자 하나까지)
//      식이 지금과 같은 판 · 덩이금_단계 를 넣기 전 식(PRE_STEP_FORMULA)과 같은 판은 vm 으로 옛 파일 · 새 파일을 돌려
//        맨 위 이름(15칸 · prices · BUYING · fmt) 값과 set() 호출(칸 id · 글자 · 순서 · 횟수)이 같아야
//        · 새 파일에 더 있는 이름은 덩이금_단계 · 시세날짜 둘뿐
//      15칸이 없는 옛 판(식이 다르던 때)은 옛 convert 도 똑같이 실패해야
//      맨 마지막 판 = FALLBACK_BASE · 그때 prices.json = jsonText(FALLBACK_BASE, FALLBACK_YMD) 글자 그대로
//      origin/main 이 아직 prices.js 를 가지면(올리기 전) 그 판 = FALLBACK_BASE · origin/main 이 이 브랜치에 합쳐져 있어야
// (나) 장부 id 3 꼴 가짜 서버로 readLedger → renderJs/buildJson · 꼴 틀림/2초 넘김/5xx/빈 줄/끊김 → memory → fallback · 머리글
//      예비 값이 FALLBACK_MAX_DAYS 일을 넘으면 → 503 · no-store · 숫자 없음 (시각은 setNow 로 고정)
// (다) 식 원본(scripts/formula.src.js) = api/_sagye-formula.js
// (라) 덩이 한 단계 차이 (덩이금_단계 · 장부 163): 단계 10000 · 15000 · 1000 · 50000 … → vm 으로 «옛 prices.js 식의 네 숫자를 손으로 고친 것» 과
//      맨 위 이름 값 · set() 이 같아야 · 등급 = 최고가 − 단계 × 1·2·3·4 · prices.json 은 등급 넷만 다르고 키는 그대로 (덩이금_단계 키 없음)
//      장부 가짜 서버: 칸 없음(163 전 저장) → 10000 · 경계 1000 · 50000 → ledger · 틀린 값(1,000원 단위 아님 · 범위 밖 · 글자 · null · 소수) → 못 씀(memory)
//
// 하나라도 FAIL 이면 종료 코드 1 — 올리기 전에 모두 ok 여야 합니다.
// ================================================
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = await import(pathToFileURL(join(ROOT, 'api', '_sagye.js')).href);
const { FORMULA } = await import(pathToFileURL(join(ROOT, 'api', '_sagye-formula.js')).href);
const { formulaFrom, moduleText } = await import(pathToFileURL(join(ROOT, 'scripts', 'make-formula.mjs')).href);

let fails = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) fails++;
  return cond;
};
const lf = (s) => String(s).replace(/\r\n/g, '\n');

// ── git ──────────────────────────────────────────
function git(...args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
/** 여러 「rev:path」 를 한 번에 (없으면 null) */
function blobs(specs) {
  const r = spawnSync('git', ['cat-file', '--batch'], { cwd: ROOT, input: specs.join('\n') + '\n', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('git cat-file --batch: ' + r.stderr);
  const buf = r.stdout; const out = []; let i = 0;
  for (let n = 0; n < specs.length; n++) {
    const nl = buf.indexOf(10, i);
    const head = buf.slice(i, nl).toString('utf8');
    i = nl + 1;
    if (/ missing$/.test(head) || / ambiguous$/.test(head)) { out.push(null); continue; }
    const size = Number(head.split(' ')[2]);
    out.push(buf.slice(i, i + size).toString('utf8'));
    i += size + 1;
  }
  return out;
}

// ── 옛 convert-prices.js 를 vm 에서 (fs 를 흉내 · 파일은 안 씀) ──
function runConvert(code, pricesJsText, argv) {
  let written = null;
  const fsMock = {
    readFileSync: () => pricesJsText,
    writeFileSync: (_p, data) => { written = String(data); },
  };
  const req = (m) => {
    if (m === 'fs') return fsMock;
    if (m === 'path') return { join: (...a) => a.join('/'), resolve: (...a) => a.join('/') };
    throw new Error('require ' + m);
  };
  const ctx = vm.createContext({
    require: req, __dirname: '/repo', console: { log() {}, error() {} },
    process: { argv: argv || ['node', 'convert-prices.js'], exit: (c) => { throw new Error('exit ' + c); } },
  });
  vm.runInContext(code, ctx, { filename: 'convert-prices.js' });
  if (written === null) throw new Error('prices.json 을 안 씀');
  return written;
}
const dropUpdated = (s) => s.replace(/^  "updated": "[^"]*",$/m, '  "updated": "-",');

// ── prices.js 를 vm 에서 (document 흉내) → 맨 위 이름 값 · set() 호출 ──
function topNames(code) {
  const out = [];
  for (const line of lf(code).split('\n')) {
    const m = /^(?:const|let|var)\s+([^\s=;]+)/.exec(line) || /^function\s+([^\s(]+)/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}
function runPricesJs(code) {
  const listeners = []; const sets = [];
  const el = (id) => ({ set textContent(v) { sets.push([id, String(v)]); }, get textContent() { return ''; } });
  const document = {
    addEventListener: (t, fn) => { if (t === 'DOMContentLoaded') listeners.push(fn); },
    getElementById: (id) => el(id),
  };
  const ctx = vm.createContext({ document });
  vm.runInContext(code, ctx, { filename: 'prices.js' });
  for (const fn of listeners) fn();
  const names = topNames(code);
  const probe = '({' + names.map((n) =>
    `${JSON.stringify(n)}: (typeof ${n} === 'function') ? ['function', String(${n}), ${n}(1234567), ${n}(0)] : ${n}`).join(',') + '})';
  const globals = vm.runInContext(probe, ctx);
  return { names, globals: JSON.parse(JSON.stringify(globals)), sets };
}

// ================================================
// (다) 식 원본 = 생성물
// ================================================
console.log('\n── (다) 식 원본 = api/_sagye-formula.js ──');
const src = readFileSync(join(ROOT, 'scripts', 'formula.src.js'), 'utf8');
ok(formulaFrom(src) === FORMULA, 'scripts/formula.src.js 식 부분 == FORMULA');
ok(lf(readFileSync(join(ROOT, 'api', '_sagye-formula.js'), 'utf8')) === moduleText(formulaFrom(src)), 'api/_sagye-formula.js 가 생성기 출력과 글자까지 같음 (make-formula --check)');
ok(!FORMULA.includes('\r'), 'FORMULA 에 CR 없음 (LF 만)');

// 덩이금_단계 를 넣기 전 식 — 지금 식에서 덩이 등급 네 줄 + 주석 한 줄만 옛 글자로 되돌린 것 (역사의 prices.js 판들은 모두 이 식)
//   (가) 가 이 식의 판도 vm 으로 «옛 파일 = 새 파일(단계 10000)» 을 보고, (라) 가 네 숫자를 손으로 고친 옛 파일과 견준다
const STEP_UNDO = [
  ['// 매입가 (손님이 팔때) — 덩이금 등급 자동 계산 (등급마다 덩이금_단계 만큼 내려감)', '// 매입가 (손님이 팔때) — 덩이금 등급 자동 계산'],
  ['덩이금_최고가 - 덩이금_단계,', '덩이금_최고가 - 10000,'],
  ['덩이금_최고가 - 덩이금_단계 * 2,', '덩이금_최고가 - 20000,'],
  ['덩이금_최고가 - 덩이금_단계 * 3,', '덩이금_최고가 - 30000,'],
  ['덩이금_최고가 - 덩이금_단계 * 4,', '덩이금_최고가 - 40000,'],
];
ok(STEP_UNDO.every(([a]) => FORMULA.split(a).length === 2), '지금 식에 덩이 등급 네 줄 · 주석 한 줄이 한 번씩 (덩이금_단계 × 1·2·3·4)');
const PRE_STEP_FORMULA = STEP_UNDO.reduce((s, [a, b]) => s.replace(a, b), FORMULA);
ok(!PRE_STEP_FORMULA.includes('덩이금_단계'), '단계 넣기 전 식에는 덩이금_단계 가 한 번도 안 나옴');

// ================================================
// (가) 역사
// ================================================
console.log('\n── (가) git 역사 prices.js 판 모두 ──');
// --full-history: 기본 기록 단순화는 main 을 합친 뒤 main 쪽 prices.js 커밋을 버린다 (합친 커밋이 「지움」 쪽 부모와 같다고 봄)
//   → 마지막 판을 낡은 판으로 잘못 고르고 「예비 값 = 마지막 판」 이 거짓 ok 가 된다. 세 곳 모두 붙인다.
const revs = git('log', '--full-history', '--format=%H %cs', '--', 'prices.js').trim().split('\n').map((l) => l.split(' '));
const texts = blobs(revs.map(([h]) => `${h}:prices.js`));
// 옛 convert-prices.js = 경로 인자를 받기 전 마지막 판
const convRevs = git('log', '--full-history', '--format=%H', '--', 'convert-prices.js').trim().split('\n');
const convTexts = blobs(convRevs.map((h) => `${h}:convert-prices.js`));
const oldConvert = convTexts.find((t) => t && t.includes("path.join(__dirname, 'prices.js')"));
ok(!!oldConvert, '옛 convert-prices.js 를 역사에서 찾음');
const newConvert = readFileSync(join(ROOT, 'convert-prices.js'), 'utf8');
const NEW_ARGV = ['node', 'convert-prices.js', 'in/prices.js', 'out/prices.json'];

let nAll = 0, nJson = 0, nVm = 0, nOld = 0, nSkipBoth = 0, newest = null;
const bad = [];
for (let k = 0; k < revs.length; k++) {
  const [h, day] = revs[k]; const t = texts[k];
  if (t === null) continue;          // 지운 커밋
  nAll++;
  const tag = `${h.slice(0, 7)} ${day}`;
  let base = null;
  try { base = S.extractBase(t); } catch {}
  if (!base) {
    // 15칸이 없는 옛 판 — 옛 convert 도 같이 실패해야 (같은 정규식)
    let threw = false;
    try { runConvert(oldConvert, t); } catch { threw = true; }
    if (threw) nSkipBoth++; else bad.push(`${tag}: extractBase 는 실패인데 옛 convert 는 성공`);
    continue;
  }
  if (!newest) newest = { h, day, t, base };
  const ymd = day;
  const js = S.renderJs(base, ymd);
  try {
    const a = dropUpdated(runConvert(oldConvert, t));                 // 옛 판 → 옛 convert
    const b = dropUpdated(runConvert(oldConvert, js));                // 새 prices.js → 옛 convert
    const c = dropUpdated(S.jsonText(base, ymd));                     // buildJson
    const d = dropUpdated(runConvert(newConvert, js, NEW_ARGV));      // 새 prices.js → 고친 convert
    if (a === b && b === c && c === d) nJson++;
    else bad.push(`${tag}: prices.json 글자가 다름 (옛=${a === b} build=${b === c} 고친convert=${c === d})`);
  } catch (e) {
    bad.push(`${tag}: convert 실행 실패 ${e.message}`);
  }
  if (!S.selfCheck(base, js)) bad.push(`${tag}: 스스로 확인 실패`);
  if (base.덩이금_단계 !== 10000) bad.push(`${tag}: 옛 판인데 덩이금_단계 가 10000 이 아님 (${base.덩이금_단계})`);
  let body = null;
  try { body = formulaFrom(t); } catch {}
  if (body === FORMULA || body === PRE_STEP_FORMULA) {
    if (!js.endsWith(FORMULA) || formulaFrom(js) !== FORMULA) { bad.push(`${tag}: 새 prices.js 식 부분이 지금 식과 다름`); continue; }
    try {
      const o = runPricesJs(t); const n = runPricesJs(js);
      const extra = n.names.filter((x) => !o.names.includes(x));
      const nNames = n.names.filter((x) => x !== '시세날짜' && x !== '덩이금_단계');
      const sameNames = JSON.stringify(nNames) === JSON.stringify(o.names) && JSON.stringify(extra) === '["덩이금_단계","시세날짜"]';
      const g = { ...n.globals }; delete g['시세날짜']; delete g['덩이금_단계'];
      const sameVals = JSON.stringify(g) === JSON.stringify(o.globals);
      const sameSets = JSON.stringify(n.sets) === JSON.stringify(o.sets) && o.sets.length > 30;
      const dateOk = n.globals['시세날짜'] === ymd && n.globals['덩이금_단계'] === 10000;
      if (sameNames && sameVals && sameSets && dateOk) nVm++;
      else bad.push(`${tag}: vm 전역/set 다름 (이름=${sameNames} 값=${sameVals} set=${sameSets} 날짜·단계=${dateOk})`);
    } catch (e) {
      bad.push(`${tag}: vm 실행 실패 ${e.message}`);
    }
  } else {
    nOld++;
  }
}
for (const b of bad.slice(0, 20)) console.log('     ' + b);
ok(bad.length === 0, `역사 ${nAll}판 — 어긋남 0`, `어긋남 ${bad.length}`);
ok(nJson > 0 && nJson + nSkipBoth === nAll, `prices.json 글자 같음 ${nJson}판 + 15칸 없는 옛 판 ${nSkipBoth}판(옛 convert 도 같이 실패) = ${nAll}판`);
{
  // 식을 나중에 바꾸면 옛 판은 「식이 다른 판」 으로 세고 넘어간다 (그때 vm 비교는 식이 같은 판만)
  //   덩이금_단계 를 넣은 것은 «식을 바꾼 것» 이 아니라 숫자를 칸으로 뺀 것이라 그 전 식의 판도 vm 으로 본다 (단계 10000 = 옛 숫자)
  let nb = null; try { nb = formulaFrom(newest.t); } catch {}
  const newestSame = !!newest && (nb === FORMULA || nb === PRE_STEP_FORMULA);
  ok(nVm + nOld === nJson && (!newestSame || nVm > 0),
    `식이 지금과 같은 판 (덩이금_단계 넣기 전 식 포함) ${nVm}판 모두 vm 전역 · set() 같음 (단계 10000)`, `15칸 있는데 식이 다른 판 ${nOld}판${newestSame ? '' : ' · ⚠ 식이 마지막 prices.js 와 다름 (식을 바꿨다면 정상)'}`);
  ok(nb === PRE_STEP_FORMULA, `마지막 prices.js (${newest && newest.h.slice(0, 7)}) 식 = 지금 식에서 덩이 등급 네 줄 · 주석 한 줄만 되돌린 것`);
}

console.log('\n── (가) 맨 마지막 판 = 예비 값 ──');
ok(!!newest && JSON.stringify(newest.base) === JSON.stringify({ ...S.FALLBACK_BASE }),
  `FALLBACK_BASE == 마지막 prices.js (${newest && newest.h.slice(0, 7)} ${newest && newest.day})`,
  newest && JSON.stringify(newest.base) !== JSON.stringify({ ...S.FALLBACK_BASE }) ? '다르면 api/_sagye.js FALLBACK_BASE 를 이 값으로: ' + JSON.stringify(newest.base) : '');
const jrevs = git('log', '--full-history', '--format=%H', '--', 'prices.json').trim().split('\n');
const jtexts = blobs(jrevs.map((h) => `${h}:prices.json`));
const lastJson = jtexts.find((t) => t !== null);
ok(lastJson !== undefined && lf(lastJson) === S.jsonText(S.FALLBACK_BASE, S.FALLBACK_YMD),
  `jsonText(FALLBACK_BASE, '${S.FALLBACK_YMD}') == 마지막 정적 prices.json (updated 까지 글자 그대로)`);
{
  // 받아 둔 GitHub main(origin/main) 이 아직 prices.js 를 가진 때 (= 올리기 전) — 그 판이 예비 값이어야 하고 이 브랜치에 합쳐져 있어야
  //   역사 비교만으로는 main 을 안 합친 브랜치에서 낡은 판과 견주게 된다. origin/main 은 받아 둔 때 기준이라 올리기 직전엔 git fetch 먼저.
  let om = null;
  try { om = git('rev-parse', '--verify', '-q', 'origin/main^{commit}').trim(); } catch {}
  const [omJs, omJson] = om ? blobs([`${om}:prices.js`, `${om}:prices.json`]) : [null, null];
  if (!om) console.log('     (origin/main 없음 — main 비교 건너뜀)');
  else if (omJs === null) console.log(`     (origin/main ${om.slice(0, 7)} 에 prices.js 없음 — 이미 올린 뒤라 main 비교 건너뜀)`);
  else {
    let omBase = null; try { omBase = S.extractBase(omJs); } catch {}
    const same = !!omBase && JSON.stringify(omBase) === JSON.stringify({ ...S.FALLBACK_BASE });
    ok(same, `FALLBACK_BASE == origin/main prices.js (${om.slice(0, 7)} · 받아 둔 때 기준 — 올리기 직전엔 git fetch 먼저)`,
      same ? '' : 'api/_sagye.js FALLBACK_BASE 를 이 값으로: ' + JSON.stringify(omBase));
    if (omJson !== null) {
      const updated = (/"updated": "([^"]*)"/.exec(omJson) || [])[1];
      ok(lf(omJson) === S.jsonText(S.FALLBACK_BASE, S.FALLBACK_YMD), `jsonText(FALLBACK) == origin/main prices.json (updated ${updated})`,
        updated !== S.FALLBACK_YMD ? `FALLBACK_YMD 를 '${updated}' 로` : '');
    }
    const anc = spawnSync('git', ['merge-base', '--is-ancestor', om, 'HEAD'], { cwd: ROOT }).status === 0;
    ok(anc, `origin/main(${om.slice(0, 7)}) 이 이 브랜치에 합쳐져 있음`, anc ? '' : 'git merge origin/main 먼저 (충돌 푸는 법은 README 「GitHub main 을 합칠 때」)');
  }
}
{
  const fb = S.fallback('x');
  ok(fb.src === 'fallback' && fb.ymd === S.FALLBACK_YMD && S.selfCheck(S.FALLBACK_BASE, fb.js) && fb.js.includes(`const 시세날짜 = "${S.FALLBACK_YMD}";`),
    '예비 값 prices.js — 스스로 확인 ok · 시세날짜 = 예비 값 날짜 (오늘 아님)');
  ok(S.FIELDS.every((f) => S.fieldProblem(f, S.FALLBACK_BASE[f.name]) === null), '예비 값 16칸이 장부 꼴 검사도 통과');
}
{
  // 정규식이 못 다시 읽는 값은 스스로 확인에서 걸러져야 (꼴 검사가 먼저 막지만 한 번 더)
  const weird = { ...S.FALLBACK_BASE, 열쇠가격: "615'~625" };
  ok(!S.selfCheck(weird, S.renderJs(weird, '2026-11-02')), '스스로 확인 — 따옴표 든 글자 칸은 거절');
}

// ================================================
// (나) 장부 가짜 서버
// ================================================
console.log('\n── (나) 장부 id 3 가짜 서버 → readLedger · pick · 함수 머리글 ──');
const GOOD_BASE = {
  골드바_살때: 681000, 골드바_팔때: 642000, K18: 476000, K14: 371000, K10: 152000, 백금: 151000,
  실버바_살때: 2460000, 실버바_팔때: 2110000, 덩이금_최고가: 637000, 덩이금_단계: 10000,
  검인반지메달: 632000, 검인목걸이팔찌: 627000, 열쇠가격: '620~630', 상패동물골프공: '605~635',
  치금_인레이: 318000, 치금_크라운: 221000,
};
// 161 site_rates_build('sagye') 가 만드는 꼴 그대로 (live · buy · hero 는 읽지 않지만 같이 둔다)
function ledgerData(base, o = {}) {
  // 키를 undefined 로 주면 그 칸을 뺀다 (구조 분해 기본값은 undefined 를 기본값으로 바꿔 버려서 'in' 으로 가른다)
  const updated = 'updated' in o ? o.updated : '2026.10.28';
  const at = 'at' in o ? o.at : '2026-10-28T10:12:33+09:00';
  const live = [
    { name: '골드바 (9999)', unit: '1돈', sell: base.골드바_살때, buy: base.골드바_팔때 },
    { name: '18K 금시세', unit: '1돈', sell: null, buy: base.K18 },
    { name: '14K 금시세', unit: '1돈', sell: null, buy: base.K14 },
    { name: '백금 시세', unit: '1돈', sell: null, buy: base.백금 },
    { name: '은 시세', unit: '1kg', sell: base.실버바_살때, buy: base.실버바_팔때 },
  ];
  const d = {
    updated, hero: { gold: live[0].buy, k18: live[1].buy, k14: live[2].buy, pt: live[3].buy, ag: live[4].buy },
    live, buy: live.map((r) => ({ name: r.name, unit: r.unit, from: r.name, price: r.buy })), at,
    extra: { base: { ...base } },
  };
  if (updated === undefined) delete d.updated;
  if (at === undefined) delete d.at;
  return d;
}
let mode = 'good'; let lastReq = null; let custom = null;
const server = createServer((req, res) => {
  lastReq = { url: req.url, apikey: req.headers.apikey, auth: req.headers.authorization };
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
  if (mode === 'good') return send(200, [{ data: ledgerData(GOOD_BASE) }]);
  if (mode === 'custom') return send(200, custom);
  if (mode === 'empty') return send(200, []);
  if (mode === '500') return send(500, { message: 'boom' });
  if (mode === '503') return send(503, 'upstream');
  if (mode === 'notjson') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('<html>'); }
  if (mode === 'slow') { setTimeout(() => { try { send(200, [{ data: ledgerData(GOOD_BASE) }]); } catch {} }, 3000); return; }
  if (mode === 'slowbody') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('[{"data":');
    setTimeout(() => { try { res.end(JSON.stringify(ledgerData(GOOD_BASE)) + '}]'); } catch {} }, 3000); return;
  }
  send(500, 'mode?');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const FAKE = `http://127.0.0.1:${server.address().port}`;
// 닫힌 포트 (끊김 흉내)
const dead = createServer(); await new Promise((r) => dead.listen(0, '127.0.0.1', r));
const DEAD = `http://127.0.0.1:${dead.address().port}`; await new Promise((r) => dead.close(r));

// 함수(handler)는 기본 주소(LEDGER_URL)를 읽으므로 fetch 를 가로채 가짜 서버로 — 다른 주소는 막는다
const realFetch = globalThis.fetch;
let route = FAKE;
globalThis.fetch = (url, opts) => {
  const u = String(url);
  if (u.startsWith(S.LEDGER_URL)) return realFetch(route + u.slice(S.LEDGER_URL.length), opts);
  if (u.startsWith('http://127.0.0.1:')) return realFetch(url, opts);
  return Promise.reject(new Error('시험 중 바깥 주소 막음: ' + u));
};

const handlerJs = (await import(pathToFileURL(join(ROOT, 'api', 'prices-js.js')).href)).default;
const handlerJson = (await import(pathToFileURL(join(ROOT, 'api', 'prices-json.js')).href)).default;
async function call(handler) {
  const headers = {}; let body = ''; let status = 0;
  const res = {
    statusCode: 200,
    setHeader: (k, v) => { headers[k.toLowerCase()] = String(v); },
    end: (b) => { body = b === undefined ? '' : String(b); status = res.statusCode; },
  };
  const t0 = Date.now();
  await handler({ method: 'GET', url: '/prices.js', headers: {}, query: {} }, res);
  return { status, headers, body, ms: Date.now() - t0 };
}

// 1) 장부 값
S.resetMemory(); mode = 'good'; route = FAKE;
{
  const got = await S.readLedger({ url: FAKE });
  ok(lastReq.url === '/rest/v1/site_rates?select=data&id=eq.3' && lastReq.apikey === S.LEDGER_KEY && lastReq.auth === 'Bearer ' + S.LEDGER_KEY,
    '읽는 주소 · 머리글 = site_rates?select=data&id=eq.3 · apikey · Bearer 공개 키');
  ok(JSON.stringify(got.base) === JSON.stringify(GOOD_BASE) && got.ymd === '2026-10-28', 'readLedger → 16칸 · 날짜 2026-10-28 (data.updated)');
  const r = await call(handlerJs);
  ok(r.status === 200 && r.headers['x-rates-source'] === 'ledger' && r.headers['cache-control'] === S.CACHE.ledger
     && r.headers['content-type'] === 'application/javascript; charset=utf-8' && r.headers['x-rates-date'] === '2026-10-28'
     && r.headers['access-control-allow-origin'] === '*' && !('x-rates-reason' in r.headers),
    '/prices.js 장부 값 — X-Rates-Source ledger · s-maxage=30, stale-while-revalidate=270', r.headers['cache-control']);
  ok(JSON.stringify(S.extractBase(r.body)) === JSON.stringify(GOOD_BASE) && r.body.includes('const 시세날짜 = "2026-10-28";') && r.body.endsWith(FORMULA),
    '/prices.js 글자 — 16칸 = 장부 · 시세날짜 = 장부 저장 날짜 · 식 그대로');
  const j = await call(handlerJson);
  ok(j.headers['x-rates-source'] === 'ledger' && j.headers['content-type'] === 'application/json; charset=utf-8' && j.headers['cache-control'] === S.CACHE.ledger
     && j.body === S.jsonText(GOOD_BASE, '2026-10-28') && JSON.parse(j.body).updated === '2026-10-28',
    '/prices.json 장부 값 — buildJson 글자 · updated 2026-10-28');
  {
    // 저장 뒤 CDN 이 옛 값을 줄 수 있는 가장 긴 시간 = s-maxage + stale-while-revalidate ≤ 300초 (장부 화면 「길어도 5분」)
    const sm = +(/s-maxage=(\d+)/.exec(S.CACHE.ledger) || [])[1]; const swr = +(/stale-while-revalidate=(\d+)/.exec(S.CACHE.ledger) || [])[1];
    ok(sm > 0 && swr >= 0 && sm + swr <= 300, `장부 값 캐시 s-maxage ${sm} + stale-while-revalidate ${swr} = ${sm + swr}초 ≤ 300초 (길어도 5분)`);
  }
  // 옛 방식으로 돌린 것과 같은지 (새 prices.js → 옛 convert)
  ok(dropUpdated(runConvert(oldConvert, r.body)) === dropUpdated(j.body), '/prices.js → 옛 convert == /prices.json (updated 빼고)');
}

// 2) 실패 → 메모리 (1 에서 읽은 장부 값)
const failModes = [
  ['empty', 'empty', '빈 줄 (첫 저장 전)'], ['500', 'http-500', '500'], ['503', 'http-503', '503'], ['notjson', 'shape', 'JSON 아님'],
  ['slow', 'timeout', '3초 늦음 (2초 제한)'], ['slowbody', 'timeout', '머리만 오고 몸이 3초 늦음'],
];
for (const [m, reason, label] of failModes) {
  mode = m;
  const r = await call(handlerJs);
  ok(r.headers['x-rates-source'] === 'memory' && r.headers['x-rates-reason'] === reason && r.headers['cache-control'] === S.CACHE.memory
     && JSON.stringify(S.extractBase(r.body)) === JSON.stringify(GOOD_BASE) && r.body.includes('const 시세날짜 = "2026-10-28";')
     && r.ms < 2600,
    `${label} → memory · s-maxage=10 · 마지막 장부 값과 그 날짜`, `${r.headers['x-rates-source']}/${r.headers['x-rates-reason']} ${r.ms}ms`);
}
route = DEAD;
{
  const r = await call(handlerJson);
  ok(r.headers['x-rates-source'] === 'memory' && r.headers['x-rates-reason'] === 'network' && JSON.parse(r.body).updated === '2026-10-28',
    '끊김(닫힌 포트) → /prices.json memory', `${r.headers['x-rates-source']}/${r.headers['x-rates-reason']}`);
}
route = FAKE;

// 3) 꼴 틀림 — 하나하나 (메모리 길)
const shapeCases = [
  ['extra 없음', () => { const d = ledgerData(GOOD_BASE); delete d.extra; return [{ data: d }]; }],
  ['15칸 중 하나 빠짐', () => { const b = { ...GOOD_BASE }; delete b.K10; return [{ data: ledgerData(b) }]; }],
  ['숫자 칸이 글자 "681000"', () => [{ data: ledgerData({ ...GOOD_BASE, 골드바_살때: '681000' }) }]],
  ['소수', () => [{ data: ledgerData({ ...GOOD_BASE, K18: 476000.5 }) }]],
  ['범위 밖 (1돈 600만)', () => [{ data: ledgerData({ ...GOOD_BASE, 골드바_팔때: 6000000 }) }]],
  ['범위 밖 (1kg 9만)', () => [{ data: ledgerData({ ...GOOD_BASE, 실버바_팔때: 90000 }) }]],
  ['글자 칸 따옴표', () => [{ data: ledgerData({ ...GOOD_BASE, 열쇠가격: "615'~625" }) }]],
  ['글자 칸 스크립트', () => [{ data: ledgerData({ ...GOOD_BASE, 상패동물골프공: '"</script>' }) }]],
  ['글자 칸 거꾸로 625~615', () => [{ data: ledgerData({ ...GOOD_BASE, 열쇠가격: '625~615' }) }]],
  ['글자 칸이 숫자', () => [{ data: ledgerData({ ...GOOD_BASE, 열쇠가격: 615 }) }]],
  ['null 칸', () => [{ data: ledgerData({ ...GOOD_BASE, 치금_크라운: null }) }]],
  ['날짜 둘 다 없음', () => [{ data: ledgerData(GOOD_BASE, { updated: undefined, at: undefined }) }]],
  ['날짜 꼴 틀림 (2026.13.40 · at 없음)', () => [{ data: ledgerData(GOOD_BASE, { updated: '2026.13.40', at: undefined }) }]],
  ['배열 아님', () => ({ data: ledgerData(GOOD_BASE) })],
  ['두 줄', () => [{ data: ledgerData(GOOD_BASE) }, { data: ledgerData(GOOD_BASE) }]],
  ['data 가 배열', () => [{ data: [] }]],
];
mode = 'custom';
for (const [label, make] of shapeCases) {
  custom = make();
  let threw = null;
  try { await S.readLedger({ url: FAKE }); } catch (e) { threw = e.reason; }
  const r = await call(handlerJs);
  ok(threw === 'shape' && r.headers['x-rates-source'] === 'memory' && JSON.stringify(S.extractBase(r.body)) === JSON.stringify(GOOD_BASE),
    `꼴 틀림: ${label} → readLedger throw(shape) · memory`, `${threw} ${r.headers['x-rates-source']}`);
}
// 날짜: updated 가 틀려도 at 이 맞으면 at 의 날짜 · 모르는 키는 무시
custom = [{ data: { ...ledgerData(GOOD_BASE, { updated: 'x', at: '2026-10-29T09:00:00+09:00' }), unknown: 1, extra: { base: { ...GOOD_BASE, 새칸: 1 }, more: 2 } } }];
{
  const got = await S.readLedger({ url: FAKE });
  ok(got.ymd === '2026-10-29' && JSON.stringify(got.base) === JSON.stringify(GOOD_BASE), 'updated 틀림 → at 날짜 (2026-10-29) · 모르는 키 무시');
}

// 4) 메모리 없음 → 예비 값 (예비 값 날짜부터 FALLBACK_MAX_DAYS 일 안 — 시각을 그 날 낮 12시 한국으로 고정)
const KST = (ymd, hms = '12:00:00') => Date.parse(`${ymd}T${hms}+09:00`);
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const FRESH_MS = KST(S.FALLBACK_YMD);
const LAST_FRESH_YMD = addDays(S.FALLBACK_YMD, S.FALLBACK_MAX_DAYS);
const STALE_MS = KST(addDays(S.FALLBACK_YMD, S.FALLBACK_MAX_DAYS + 1), '00:00:00');
S.setNow(() => FRESH_MS);
S.resetMemory();
for (const [m, reason] of [['empty', 'empty'], ['503', 'http-503'], ['slow', 'timeout']]) {
  mode = m;
  const r = await call(handlerJs);
  const j = await call(handlerJson);
  ok(r.headers['x-rates-source'] === 'fallback' && r.headers['x-rates-reason'] === reason && r.headers['cache-control'] === S.CACHE.fallback
     && r.headers['x-rates-date'] === S.FALLBACK_YMD && r.body.includes(`const 시세날짜 = "${S.FALLBACK_YMD}";`)
     && JSON.stringify(S.extractBase(r.body)) === JSON.stringify({ ...S.FALLBACK_BASE })
     && j.headers['x-rates-source'] === 'fallback' && j.body === S.jsonText(S.FALLBACK_BASE, S.FALLBACK_YMD),
    `메모리 없음 + ${m} → fallback · s-maxage=10 · 날짜 ${S.FALLBACK_YMD} (예비 값 날짜 그대로 · 휴대폰 날짜 아님)`, `${r.headers['x-rates-source']}/${r.headers['x-rates-reason']}`);
}
route = DEAD;
{
  const r = await call(handlerJs);
  ok(r.headers['x-rates-source'] === 'fallback' && r.headers['x-rates-reason'] === 'network', '메모리 없음 + 끊김 → fallback');
}
route = FAKE;

// 4-2) 예비 값이 낡음 (FALLBACK_MAX_DAYS 일 넘음) + 메모리 없음 → 숫자 안 냄 · 503 · 캐시 안 남김
console.log(`     (예비 값 ${S.FALLBACK_YMD} → ${LAST_FRESH_YMD} 23:59 한국 시각까지만 · 그 뒤 503)`);
ok(S.fallbackFresh(KST(S.FALLBACK_YMD, '00:00:00')) && S.fallbackFresh(KST(LAST_FRESH_YMD, '23:59:59')) && !S.fallbackFresh(STALE_MS)
   && !S.fallbackFresh(Date.parse(addDays(S.FALLBACK_YMD, S.FALLBACK_MAX_DAYS) + 'T15:00:00Z')) && S.fallbackFresh(Date.parse(addDays(S.FALLBACK_YMD, S.FALLBACK_MAX_DAYS) + 'T14:59:59Z')) && !S.fallbackFresh(NaN),
  `예비 값 날짜 경계는 한국 날짜 (${LAST_FRESH_YMD} 23:59:59 ok · 다음 날 00:00 = UTC 15:00 부터 낡음 · 시각 모르면 낡음)`);
S.setNow(() => STALE_MS);
const vmNames = (code) => { const ctx = vm.createContext({}); vm.runInContext(code, ctx); return vm.runInContext('Object.keys(globalThis).length + (typeof 골드바_살때) + (typeof BUYING) + (typeof 시세날짜)', ctx); };
for (const [m, reason] of [['empty', 'empty'], ['503', 'http-503'], ['slow', 'timeout'], ['custom', 'shape']]) {
  mode = m; if (m === 'custom') custom = [{ data: [] }];
  S.resetMemory();
  const r = await call(handlerJs);
  const j = await call(handlerJson);
  let jb = null; try { jb = JSON.parse(j.body); } catch {}
  let threw = false; try { S.extractBase(r.body); } catch { threw = true; }
  ok(r.status === 503 && r.headers['x-rates-source'] === 'none' && r.headers['x-rates-reason'] === reason && r.headers['cache-control'] === 'no-store'
     && !('x-rates-date' in r.headers) && r.headers['content-type'] === 'application/javascript; charset=utf-8' && r.body === S.NONE_JS && threw
     && vmNames(r.body) === '0undefinedundefinedundefined'
     && j.status === 503 && j.headers['x-rates-source'] === 'none' && j.headers['cache-control'] === 'no-store' && !!jb && typeof jb.error === 'string' && !('base' in jb) && !('updated' in jb),
    `예비 값 낡음 + 메모리 없음 + ${m} → 503 · no-store · 숫자 없음 (prices.js 는 이름 0개 · prices.json 은 base 없음)`, `${r.status}/${r.headers['x-rates-source']}/${r.headers['x-rates-reason']}`);
}
{
  // 낡아도 메모리가 있으면 그 값 (메모리는 이 인스턴스가 읽은 진짜 장부 값과 그 저장 날짜)
  mode = 'good'; S.resetMemory();
  const r1 = await call(handlerJs);
  mode = '503';
  const r2 = await call(handlerJs);
  ok(r1.status === 200 && r1.headers['x-rates-source'] === 'ledger' && r2.status === 200 && r2.headers['x-rates-source'] === 'memory'
     && JSON.stringify(S.extractBase(r2.body)) === JSON.stringify(GOOD_BASE),
    '예비 값이 낡아도 장부 → ledger · 그 뒤 실패 → memory (200)');
  const p = await S.pick({ url: DEAD, now: FRESH_MS });
  ok(p.src === 'memory', 'pick({now}) 도 받음 (메모리 우선)');
  S.resetMemory();
  const p2 = await S.pick({ url: DEAD, now: FRESH_MS }); const p3 = await S.pick({ url: DEAD, now: STALE_MS });
  ok(p2.src === 'fallback' && p3.src === 'none' && p3.js === S.NONE_JS, 'pick({now}) — 예비 값 날짜 안 fallback · 넘으면 none');
}
S.setNow(() => FRESH_MS);
mode = 'good';
// 5) 다시 살아나면 장부 값 · 메모리도 새 값으로
mode = 'good';
{
  const r = await call(handlerJs);
  ok(r.headers['x-rates-source'] === 'ledger', '장부가 돌아오면 바로 ledger');
  mode = '503';
  const r2 = await call(handlerJs);
  ok(r2.headers['x-rates-source'] === 'memory' && r2.body.includes('마지막으로 읽은 장부 값'), '그 뒤 실패 → memory (머리 주석 「마지막으로 읽은 장부 값」)');
}
// 6) OPTIONS
{
  const headers = {}; let st = 0;
  const res = { statusCode: 200, setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end: () => { st = res.statusCode; } };
  await handlerJs({ method: 'OPTIONS', headers: {} }, res);
  ok(st === 204 && headers['access-control-allow-origin'] === '*', 'OPTIONS → 204 · CORS');
}

// ================================================
// (라) 덩이 한 단계 차이 (덩이금_단계)
// ================================================
console.log('\n── (라) 덩이 한 단계 차이 (덩이금_단계 · 장부 163) ──');
const STEP_F = S.FIELDS.find((f) => f.name === '덩이금_단계');
const GRADES = ['검증3대마크', '검증덩이', '기타덩이', '무검덩이', '칠보마고자등'];
const AUTUMN = ['autumn-g1', 'autumn-g2', 'autumn-g3', 'autumn-g4', 'autumn-g5'];
const won = (n) => n.toLocaleString('ko-KR') + ' 원';
// 옛 방식으로 단계를 바꾸는 법 = 마지막 GitHub prices.js 식의 네 숫자(10000 · 20000 · 30000 · 40000)를 손으로 고친 것
const oldLast = newest.t;
function handEdit(t, step) {
  // 넷을 한 번에 (차례로 바꾸면 15000 → 30000 처럼 이미 바꾼 숫자를 또 바꿈)
  const s = lf(t);
  const hits = s.match(/덩이금_최고가 - (10000|20000|30000|40000),/g) || [];
  if (JSON.stringify(hits.map((h) => h.slice(-6, -1))) !== '["10000","20000","30000","40000"]') throw new Error('옛 prices.js 덩이 등급 네 줄 꼴이 다름: ' + hits.join(' '));
  return s.replace(/덩이금_최고가 - (10000|20000|30000|40000),/g, (_m, n) => `덩이금_최고가 - ${(Number(n) / 10000) * step},`);
}
const stepLine = (v) => {
  const js = S.renderJs({ ...S.FALLBACK_BASE, 덩이금_단계: v }, '2026-11-02');
  return lf(js).split('\n').find((l) => /^const 덩이금_단계\s/.test(l));   // \b 는 한글 뒤에서 안 맞음
};
{
  const L = lf(S.renderJs(S.FALLBACK_BASE, '2026-11-02')).split('\n');
  const i = L.findIndex((l) => /^const 덩이금_최고가\s/.test(l));
  ok(i > 0 && L[i + 1] === stepLine(10000) && stepLine(10000) === 'const 덩이금_단계     = 10000;      // 덩이 한 단계 차이 — 등급마다 이만큼 내려감',
    'prices.js 새 줄 = 덩이금_최고가 줄 바로 밑 「const 덩이금_단계     = 10000;      // 덩이 한 단계 차이 — 등급마다 이만큼 내려감」', JSON.stringify(L[i + 1]));
  ok(STEP_F && STEP_F.dflt === 10000 && S.FIELDS.indexOf(STEP_F) === S.FIELDS.findIndex((f) => f.name === '덩이금_최고가') + 1 && S.FIELDS.length === 16,
    'FIELDS 16칸 — 덩이금_단계 는 덩이금_최고가 바로 다음 · 없으면 10000');
}
// 1) 단계 값마다: 새 /prices.js (vm) == 손으로 고친 옛 prices.js (vm) · 등급 = 최고가 − 단계 × k · prices.json 은 등급 넷만 다름
const json10 = S.buildJson(S.FALLBACK_BASE, 'x');
for (const step of [10000, 15000, 1000, 50000, 5000, 12000]) {
  const base = { ...S.FALLBACK_BASE, 덩이금_단계: step };
  const js = S.renderJs(base, '2026-11-02');
  const n = runPricesJs(js); const o = runPricesJs(handEdit(oldLast, step));
  const g = { ...n.globals }; delete g['시세날짜']; delete g['덩이금_단계'];
  const sameNames = JSON.stringify(n.names.filter((x) => x !== '시세날짜' && x !== '덩이금_단계')) === JSON.stringify(o.names);
  const sameVals = JSON.stringify(g) === JSON.stringify(o.globals);
  const sameSets = JSON.stringify(n.sets) === JSON.stringify(o.sets);
  const want = GRADES.map((_, k) => base.덩이금_최고가 - k * step);
  const gotB = GRADES.map((k) => n.globals.BUYING[k]);
  const gotSet = AUTUMN.map((id) => (n.sets.find(([x]) => x === id) || [])[1]);
  ok(sameNames && sameVals && sameSets && JSON.stringify(gotB) === JSON.stringify(want) && JSON.stringify(gotSet) === JSON.stringify(want.map(won)) && n.globals['덩이금_단계'] === step,
    `단계 ${step} — 새 prices.js == 옛 prices.js 네 숫자 손으로 고친 것 (vm 이름 · 값 · set ${n.sets.length}번) · 등급 ${want.join(' / ')}`,
    `이름=${sameNames} 값=${sameVals} set=${sameSets} 등급=${gotB.join('/')}`);
  const j = S.buildJson(base, 'x');
  const jb = GRADES.map((k) => j.buying[k]);
  const restSame = JSON.stringify({ ...j, buying: { ...j.buying, ...Object.fromEntries(GRADES.map((k) => [k, 0])) } })
    === JSON.stringify({ ...json10, buying: { ...json10.buying, ...Object.fromEntries(GRADES.map((k) => [k, 0])) } });
  const keysSame = JSON.stringify(Object.keys(j)) === JSON.stringify(Object.keys(json10))
    && Object.keys(j).every((k) => typeof j[k] !== 'object' || JSON.stringify(Object.keys(j[k])) === JSON.stringify(Object.keys(json10[k])));
  const viaConvert = dropUpdated(runConvert(newConvert, js, NEW_ARGV)) === dropUpdated(S.jsonText(base, '2026-11-02'));
  ok(JSON.stringify(jb) === JSON.stringify(want) && restSame && keysSame && !JSON.stringify(j).includes('덩이금_단계') && viaConvert
     && S.selfCheck(base, js) && S.extractBase(js).덩이금_단계 === step,
    `단계 ${step} — prices.json 등급 넷만 바뀜 · 키 이름 · 순서 그대로 (덩이금_단계 키 없음) · 고친 convert == buildJson · 스스로 확인 ok`,
    `등급=${jb.join('/')} 나머지=${restSame} 키=${keysSame} convert=${viaConvert}`);
}
{
  // 단계 10000 = 옛 숫자: 새 prices.json 은 옛 convert 로 돌린 것과 글자 하나까지 같음
  const js = S.renderJs(S.FALLBACK_BASE, S.FALLBACK_YMD);
  ok(dropUpdated(runConvert(oldConvert, js)) === dropUpdated(S.jsonText(S.FALLBACK_BASE, S.FALLBACK_YMD))
     && S.jsonText(S.FALLBACK_BASE, S.FALLBACK_YMD) === lf(lastJson),
    '단계 10000 — prices.json == 옛 convert 결과 == 마지막 정적 prices.json (글자 그대로)');
}
// 2) 칸 하나 검사 — 1,000원 단위 · 1,000 ~ 50,000 (경계 포함)
{
  const good = [1000, 2000, 10000, 15000, 49000, 50000];
  const badV = [0, 999, 500, 1500, 10500, 15001, 50001, 51000, 60000, -1000, -10000, 15000.5, 1e21, NaN, Infinity, '15000', '', null, true, [], {}];
  const g = good.filter((v) => S.fieldProblem(STEP_F, v) !== null);
  const b = badV.filter((v) => S.fieldProblem(STEP_F, v) === null);
  ok(g.length === 0 && b.length === 0, `덩이금_단계 칸 검사 — 받음 ${good.join(' · ')} · 거절 ${badV.length}가지 (0 · 999 · 1500 · 10500 · 50001 · 60000 · 음수 · 소수 · 글자 · null …)`,
    `잘못 거절 ${JSON.stringify(g)} · 잘못 받음 ${JSON.stringify(b)}`);
  const reasons = [S.fieldProblem(STEP_F, 1500), S.fieldProblem(STEP_F, 60000), S.fieldProblem(STEP_F, '15000')];
  ok(reasons[0] === '덩이금_단계: 1000원 단위가 아님' && reasons[1] === '덩이금_단계: 범위(1000~50000) 밖' && reasons[2] === '덩이금_단계: 원 단위 정수가 아님',
    '거절 까닭 글자 (1000원 단위가 아님 · 범위(1000~50000) 밖 · 원 단위 정수가 아님)', reasons.join(' | '));
}
// 3) prices.js → 16칸: 그 줄이 없으면(옛 판) 10000 · 있으면 그 값 · 줄은 있는데 숫자가 아니면 멈춤 (스스로 확인 거절)
{
  const noLine = S.extractBase(oldLast).덩이금_단계;
  const js15 = S.renderJs({ ...S.FALLBACK_BASE, 덩이금_단계: 15000 }, '2026-11-02');
  const broken = js15.replace(/const 덩이금_단계 *= 15000;/, 'const 덩이금_단계 = "x";');
  let threw = false; try { S.extractBase(broken); } catch { threw = true; }
  ok(noLine === 10000 && S.extractBase(js15).덩이금_단계 === 15000 && threw && broken !== js15 && !S.selfCheck({ ...S.FALLBACK_BASE, 덩이금_단계: 15000 }, broken)
     && !S.selfCheck({ ...S.FALLBACK_BASE, 덩이금_단계: 15000 }, S.renderJs(S.FALLBACK_BASE, '2026-11-02')),
    'extractBase — 옛 판(줄 없음) 10000 · 「= 15000」 15000 · 줄은 있는데 숫자 아님 → 멈춤 · 단계가 다르면 스스로 확인 거절');
  let t2 = false; try { runConvert(newConvert, broken, NEW_ARGV); } catch { t2 = true; }
  ok(t2 && JSON.parse(runConvert(newConvert, oldLast, NEW_ARGV)).buying.검증덩이 === S.extractBase(oldLast).덩이금_최고가 - 10000,
    '고친 convert-prices.js — 옛 판은 10000 · 줄은 있는데 숫자 아님 → 멈춤');
}
// 4) 장부 가짜 서버 — 칸 없음 · 경계 · 틀린 값
mode = 'custom'; route = FAKE; S.setNow(() => FRESH_MS);
const { 덩이금_단계: _drop, ...BASE_NO_STEP } = GOOD_BASE;
{
  S.resetMemory();
  custom = [{ data: ledgerData(BASE_NO_STEP) }];
  const got = await S.readLedger({ url: FAKE });
  const r = await call(handlerJs); const j = await call(handlerJson);
  ok(got.base.덩이금_단계 === 10000 && JSON.stringify(got.base) === JSON.stringify(GOOD_BASE)
     && r.headers['x-rates-source'] === 'ledger' && r.body.includes('\n' + stepLine(10000) + '\n')
     && j.headers['x-rates-source'] === 'ledger' && j.body === S.jsonText(GOOD_BASE, '2026-10-28')
     && dropUpdated(runConvert(oldConvert, r.body)) === dropUpdated(j.body),
    '장부에 덩이금_단계 칸 없음 (163 전 저장) → 10000 · ledger · prices.json 은 옛 convert 와 글자 그대로', `${r.headers['x-rates-source']} ${got.base.덩이금_단계}`);
}
for (const step of [15000, 1000, 50000]) {
  custom = [{ data: ledgerData({ ...GOOD_BASE, 덩이금_단계: step }) }];
  const got = await S.readLedger({ url: FAKE });
  const r = await call(handlerJs); const j = await call(handlerJson);
  const jb = JSON.parse(j.body).buying;
  const want = GRADES.map((_, k) => GOOD_BASE.덩이금_최고가 - k * step);
  ok(got.base.덩이금_단계 === step && r.headers['x-rates-source'] === 'ledger' && r.body.includes('\n' + stepLine(step) + '\n')
     && JSON.stringify(GRADES.map((k) => jb[k])) === JSON.stringify(want) && j.headers['x-rates-source'] === 'ledger',
    `장부 덩이금_단계 ${step} → ledger · prices.json 등급 ${want.join(' / ')}`, `${r.headers['x-rates-source']}`);
}
{
  // 틀린 값 — 다른 칸처럼 그 줄을 못 쓴 것으로 (메모리 = 바로 앞에서 읽은 단계 50000 값)
  const memoBase = JSON.stringify({ ...GOOD_BASE, 덩이금_단계: 50000 });
  const badSteps = [999, 1500, 0, -10000, 50001, 60000, 15000.5, '15000', null, true];
  const miss = [];
  for (const v of badSteps) {
    custom = [{ data: ledgerData({ ...GOOD_BASE, 덩이금_단계: v }) }];
    let threw = null; try { await S.readLedger({ url: FAKE }); } catch (e) { threw = e.reason + ':' + e.message; }
    const r = await call(handlerJs); const j = await call(handlerJson);
    if (!(threw && threw.startsWith('shape:덩이금_단계') && r.headers['x-rates-source'] === 'memory' && r.headers['x-rates-reason'] === 'shape'
          && j.headers['x-rates-source'] === 'memory' && JSON.stringify(S.extractBase(r.body)) === memoBase && r.body.endsWith(FORMULA))) miss.push(JSON.stringify(v) + '→' + threw + '/' + r.headers['x-rates-source']);
  }
  ok(miss.length === 0, `장부 덩이금_단계 틀린 값 ${badSteps.length}가지 (999 · 1500 · 0 · 음수 · 50001 · 60000 · 소수 · 글자 · null · true) → readLedger throw(shape) · memory (앞 값 그대로)`, miss.join(' | '));
  S.resetMemory();
  custom = [{ data: ledgerData({ ...GOOD_BASE, 덩이금_단계: 1500 }) }];
  const r = await call(handlerJs);
  ok(r.headers['x-rates-source'] === 'fallback' && r.headers['x-rates-reason'] === 'shape' && S.extractBase(r.body).덩이금_단계 === 10000,
    '메모리 없음 + 틀린 단계 → 예비 값 (단계 10000)', `${r.headers['x-rates-source']}/${r.headers['x-rates-reason']}`);
}
mode = 'good';

S.setNow();
globalThis.fetch = realFetch;
await new Promise((r) => server.close(r));

// ── --live: 진짜 장부 한 번 (공개 키 GET · 쓰기 없음 · 결과만 보여 줌) ──
if (process.argv.includes('--live')) {
  console.log('\n── --live 진짜 장부 id 3 (공개 키 GET 한 번) ──');
  S.resetMemory();
  const t0 = Date.now();
  const r = await S.pick();
  console.log(`     X-Rates-Source=${r.src}${r.reason ? ' · 까닭=' + r.reason : ''} · 날짜=${r.ymd} · ${Date.now() - t0}ms`);
  if ((r.src === 'fallback' || r.src === 'none') && r.reason === 'empty') console.log('     ⚠ 장부 사계절 탭 첫 저장 전입니다 — 올리기 전에 첫 저장을 꼭 하세요');
  if (r.src === 'none') console.log(`     ⚠ 예비 값(${S.FALLBACK_YMD})이 ${S.FALLBACK_MAX_DAYS}일을 넘어 지금 올리면 장부를 못 읽을 때 503 (가격 칸 「-」) 입니다`);

  // 실전 홈페이지 (공개 GET 두 번) — 아직 정적 파일(머리글 X-Rates-Source 없음)이면 = 올리기 전: 그 값이 예비 값이어야
  console.log('\n── --live 실전 홈페이지 /prices.js · /prices.json (공개 GET) ──');
  for (const path of ['/prices.js', '/prices.json']) {
    let res = null, body = '';
    try {
      res = await fetch(`https://www.sagyegold.co.kr${path}?t=${Date.now()}`, { signal: AbortSignal.timeout(10000) });
      body = lf(await res.text());
    } catch (e) {
      ok(false, `실전 ${path} 읽기`, String(e && e.message));
      continue;
    }
    const src = res.headers.get('x-rates-source');
    if (src) {
      console.log(`     실전 ${path}: ${res.status} · X-Rates-Source=${src} · 날짜=${res.headers.get('x-rates-date') || '-'} · 캐시=${res.headers.get('x-vercel-cache') || '-'} (이미 올린 뒤 — 예비 값 비교 건너뜀)`);
    } else if (path === '/prices.js') {
      let b = null; try { b = S.extractBase(body); } catch {}
      const same = !!b && JSON.stringify(b) === JSON.stringify({ ...S.FALLBACK_BASE });
      ok(same, '실전 정적 /prices.js 15칸 == FALLBACK_BASE (올리기 전 · 오늘 GitHub 값)', same ? '' : 'api/_sagye.js FALLBACK_BASE 를 이 값으로: ' + JSON.stringify(b));
    } else {
      const updated = (/"updated": "([^"]*)"/.exec(body) || [])[1];
      ok(body === S.jsonText(S.FALLBACK_BASE, S.FALLBACK_YMD), `실전 정적 /prices.json == jsonText(FALLBACK) (updated ${updated})`,
        updated !== S.FALLBACK_YMD ? `FALLBACK_YMD 를 '${updated}' 로` : '');
    }
  }
}

console.log(fails ? `\n❌ FAIL ${fails}개` : '\n✅ 모두 ok');
process.exit(fails ? 1 : 0);
