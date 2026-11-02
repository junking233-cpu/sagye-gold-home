// ================================================
// 사계절 손님 시세 — 회귀 시험 (node 만 · 네트워크 없음 · --live 일 때만 장부 공개 GET 한 번)
//
//   node scripts/regress.mjs          모두
//   node scripts/regress.mjs --live   + 진짜 장부 id 3 을 공개 키로 한 번 읽어 결과만 보여 줌 (쓰기 없음)
//
// (가) git 역사의 prices.js 판 모두:
//      그 판 15칸 → 지금 식으로 renderJs → 옛 convert-prices.js 로 돌린 prices.json
//        == 옛 판을 옛 convert 로 돌린 것 == buildJson(15칸)  (updated 만 빼고 글자 하나까지)
//      식이 지금과 같은 판은 vm 으로 옛 파일 · 새 파일을 돌려 맨 위 이름(15칸 · prices · BUYING · fmt) 값과
//        set() 호출(칸 id · 글자 · 순서 · 횟수)이 같아야 · 새 파일에 더 있는 이름은 시세날짜 하나뿐
//      15칸이 없는 옛 판(식이 다르던 때)은 옛 convert 도 똑같이 실패해야
//      맨 마지막 판 = FALLBACK_BASE · 그때 prices.json = jsonText(FALLBACK_BASE, FALLBACK_YMD) 글자 그대로
// (나) 장부 id 3 꼴 가짜 서버로 readLedger → renderJs/buildJson · 꼴 틀림/2초 넘김/5xx/빈 줄/끊김 → memory → fallback · 머리글
// (다) 식 원본(scripts/formula.src.js) = api/_sagye-formula.js
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

// ================================================
// (가) 역사
// ================================================
console.log('\n── (가) git 역사 prices.js 판 모두 ──');
const revs = git('log', '--format=%H %cs', '--', 'prices.js').trim().split('\n').map((l) => l.split(' '));
const texts = blobs(revs.map(([h]) => `${h}:prices.js`));
// 옛 convert-prices.js = 경로 인자를 받기 전 마지막 판
const convRevs = git('log', '--format=%H', '--', 'convert-prices.js').trim().split('\n');
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
  let body = null;
  try { body = formulaFrom(t); } catch {}
  if (body === FORMULA) {
    if (!js.endsWith(FORMULA) || formulaFrom(js) !== body) { bad.push(`${tag}: 새 prices.js 식 부분이 옛 판과 다름`); continue; }
    try {
      const o = runPricesJs(t); const n = runPricesJs(js);
      const extra = n.names.filter((x) => !o.names.includes(x));
      const nNames = n.names.filter((x) => x !== '시세날짜');
      const sameNames = JSON.stringify(nNames) === JSON.stringify(o.names) && JSON.stringify(extra) === '["시세날짜"]';
      const g = { ...n.globals }; delete g['시세날짜'];
      const sameVals = JSON.stringify(g) === JSON.stringify(o.globals);
      const sameSets = JSON.stringify(n.sets) === JSON.stringify(o.sets) && o.sets.length > 30;
      const dateOk = n.globals['시세날짜'] === ymd;
      if (sameNames && sameVals && sameSets && dateOk) nVm++;
      else bad.push(`${tag}: vm 전역/set 다름 (이름=${sameNames} 값=${sameVals} set=${sameSets} 날짜=${dateOk})`);
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
  const newestSame = !!newest && formulaFrom(newest.t) === FORMULA;
  ok(nVm + nOld === nJson && (!newestSame || nVm > 0),
    `식이 지금과 같은 판 ${nVm}판 모두 vm 전역 · set() 같음`, `15칸 있는데 식이 다른 판 ${nOld}판${newestSame ? '' : ' · ⚠ 식이 마지막 prices.js 와 다름 (식을 바꿨다면 정상)'}`);
}

console.log('\n── (가) 맨 마지막 판 = 예비 값 ──');
ok(!!newest && JSON.stringify(newest.base) === JSON.stringify({ ...S.FALLBACK_BASE }),
  `FALLBACK_BASE == 마지막 prices.js (${newest && newest.h.slice(0, 7)} ${newest && newest.day})`,
  newest && JSON.stringify(newest.base) !== JSON.stringify({ ...S.FALLBACK_BASE }) ? '다르면 api/_sagye.js FALLBACK_BASE 를 이 값으로: ' + JSON.stringify(newest.base) : '');
const jrevs = git('log', '--format=%H', '--', 'prices.json').trim().split('\n');
const jtexts = blobs(jrevs.map((h) => `${h}:prices.json`));
const lastJson = jtexts.find((t) => t !== null);
ok(lastJson !== undefined && lf(lastJson) === S.jsonText(S.FALLBACK_BASE, S.FALLBACK_YMD),
  `jsonText(FALLBACK_BASE, '${S.FALLBACK_YMD}') == 마지막 정적 prices.json (updated 까지 글자 그대로)`);
{
  const fb = S.fallback('x');
  ok(fb.src === 'fallback' && fb.ymd === S.FALLBACK_YMD && S.selfCheck(S.FALLBACK_BASE, fb.js) && fb.js.includes(`const 시세날짜 = "${S.FALLBACK_YMD}";`),
    '예비 값 prices.js — 스스로 확인 ok · 시세날짜 = 예비 값 날짜 (오늘 아님)');
  ok(S.FIELDS.every((f) => S.fieldProblem(f, S.FALLBACK_BASE[f.name]) === null), '예비 값 15칸이 장부 꼴 검사도 통과');
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
  실버바_살때: 2460000, 실버바_팔때: 2110000, 덩이금_최고가: 637000,
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
  ok(JSON.stringify(got.base) === JSON.stringify(GOOD_BASE) && got.ymd === '2026-10-28', 'readLedger → 15칸 · 날짜 2026-10-28 (data.updated)');
  const r = await call(handlerJs);
  ok(r.status === 200 && r.headers['x-rates-source'] === 'ledger' && r.headers['cache-control'] === S.CACHE.ledger
     && r.headers['content-type'] === 'application/javascript; charset=utf-8' && r.headers['x-rates-date'] === '2026-10-28'
     && r.headers['access-control-allow-origin'] === '*' && !('x-rates-reason' in r.headers),
    '/prices.js 장부 값 — X-Rates-Source ledger · s-maxage=30, stale-while-revalidate=300', r.headers['cache-control']);
  ok(JSON.stringify(S.extractBase(r.body)) === JSON.stringify(GOOD_BASE) && r.body.includes('const 시세날짜 = "2026-10-28";') && r.body.endsWith(FORMULA),
    '/prices.js 글자 — 15칸 = 장부 · 시세날짜 = 장부 저장 날짜 · 식 그대로');
  const j = await call(handlerJson);
  ok(j.headers['x-rates-source'] === 'ledger' && j.headers['content-type'] === 'application/json; charset=utf-8' && j.headers['cache-control'] === S.CACHE.ledger
     && j.body === S.jsonText(GOOD_BASE, '2026-10-28') && JSON.parse(j.body).updated === '2026-10-28',
    '/prices.json 장부 값 — buildJson 글자 · updated 2026-10-28');
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

// 4) 메모리 없음 → 예비 값
S.resetMemory();
for (const [m, reason] of [['empty', 'empty'], ['503', 'http-503'], ['slow', 'timeout']]) {
  mode = m;
  const r = await call(handlerJs);
  const j = await call(handlerJson);
  ok(r.headers['x-rates-source'] === 'fallback' && r.headers['x-rates-reason'] === reason && r.headers['cache-control'] === S.CACHE.fallback
     && r.headers['x-rates-date'] === S.FALLBACK_YMD && r.body.includes(`const 시세날짜 = "${S.FALLBACK_YMD}";`)
     && JSON.stringify(S.extractBase(r.body)) === JSON.stringify({ ...S.FALLBACK_BASE })
     && j.headers['x-rates-source'] === 'fallback' && j.body === S.jsonText(S.FALLBACK_BASE, S.FALLBACK_YMD),
    `메모리 없음 + ${m} → fallback · s-maxage=10 · 날짜 ${S.FALLBACK_YMD} (오늘처럼 안 보임)`, `${r.headers['x-rates-source']}/${r.headers['x-rates-reason']}`);
}
route = DEAD;
{
  const r = await call(handlerJs);
  ok(r.headers['x-rates-source'] === 'fallback' && r.headers['x-rates-reason'] === 'network', '메모리 없음 + 끊김 → fallback');
}
route = FAKE;
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

globalThis.fetch = realFetch;
await new Promise((r) => server.close(r));

// ── --live: 진짜 장부 한 번 (공개 키 GET · 쓰기 없음 · 결과만 보여 줌) ──
if (process.argv.includes('--live')) {
  console.log('\n── --live 진짜 장부 id 3 (공개 키 GET 한 번) ──');
  S.resetMemory();
  const t0 = Date.now();
  const r = await S.pick();
  console.log(`     X-Rates-Source=${r.src}${r.reason ? ' · 까닭=' + r.reason : ''} · 날짜=${r.ymd} · ${Date.now() - t0}ms`);
  if (r.src === 'fallback' && r.reason === 'empty') console.log('     ⚠ 장부 사계절 탭 첫 저장 전입니다 — 올리기 전에 첫 저장을 꼭 하세요');
}

console.log(fails ? `\n❌ FAIL ${fails}개` : '\n✅ 모두 ok');
process.exit(fails ? 1 : 0);
