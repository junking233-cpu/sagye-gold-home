// ================================================
// 사계절 금거래소 — 손님 시세 (장부 「손님 시세」 사계절 탭 → /prices.js · /prices.json)
// ================================================
// 밑줄(_)로 시작해서 Vercel 이 주소로 열지 않습니다. api/prices-js.js · api/prices-json.js 가 import 합니다.
//
// 흐름: 장부 Supabase site_rates id 3 (공개 publishable 키로 읽기만)
//         → 15칸 꼴 검사 → prices.js 글자 (15칸 + 시세날짜 + 식 FORMULA) · prices.json 글자 (옛 convert-prices.js 와 같은 객체)
//       못 읽으면 (꼴 틀림 · 2초 넘김 · 5xx · 빈 줄 · 끊김): 이 함수 메모리의 마지막 장부 값
//         → 그것도 없으면 예비 값(FALLBACK) — 단 그 날짜부터 FALLBACK_MAX_DAYS 일 안에서만
//         → 그보다 낡았으면 숫자를 안 내고 503 (화면은 가격 칸 「-」 · 카카오는 「전화 주세요」) — 낡은 매입가가 손님에게 안 나가게
//
// 🔴 시세는 장부에서만 바꿉니다. GitHub 에 prices.js · prices.json 을 다시 만들면 Vercel 이 그 정적 파일을
//    rewrite 보다 먼저 줘서 장부 값이 가려집니다 (.vercelignore 가 한 번 더 막지만 만들지 마세요).
// 🔴 sb_secret_ 키는 절대 여기 넣지 않습니다. 아래 키는 손님 읽기 전용 공개(publishable) 키입니다.
// 🔴 장부 쪽 꼴 (site_rates_build · sagye):
//    data = {updated:'YYYY.MM.DD', at:'YYYY-MM-DDTHH:MI:SS+09:00', hero, live, buy, extra:{base:{15칸}}}
// ================================================
import { FORMULA } from './_sagye-formula.js';

export const LEDGER_URL = 'https://odbwpyiavenrwfsjsppk.supabase.co';
export const LEDGER_KEY = 'sb_publishable_vfQOB-gVznQAHNHswDy_jg_-CK6ATiZ';
export const RATES_ID = 3;            // site_rates 의 사계절 줄 번호 (영구히 안 바꿈 · 장부 설정 표 site_rates_stores 와 같은 값)
export const TIMEOUT_MS = 2000;       // 장부 읽기 시간 제한 (카카오 5초 안에 들게)

// prices.js 맨 위 15칸 — 이름 · 순서 · 종류 · 범위 (장부 161 site_rates_parse 와 같은 규칙)
//   num  : 원 단위 정수 · 1돈 1만 ~ 500만 · 1kg 10만 ~ 5천만
//   text : 「615」 또는 「615~625」 (1~4자리 · 앞 ≤ 뒤) — 스크립트 글자에 끼우므로 이 꼴만
export const FIELDS = [
  { name: '골드바_살때',     kind: 'num',  unit: '1돈', note: '손님이 살때 (우리 판매가) 1돈 기준' },
  { name: '골드바_팔때',     kind: 'num',  unit: '1돈', note: '손님이 팔때 (우리 매입가) 1돈 기준' },
  { name: 'K18',            kind: 'num',  unit: '1돈', note: '18K 손님이 팔때 원/돈' },
  { name: 'K14',            kind: 'num',  unit: '1돈', note: '14K 손님이 팔때 원/돈' },
  { name: 'K10',            kind: 'num',  unit: '1돈', note: '10K 손님이 팔때 원/돈' },
  { name: '백금',            kind: 'num',  unit: '1돈', note: '백금 손님이 팔때 원/돈' },
  { name: '실버바_살때',     kind: 'num',  unit: '1kg', note: '실버바 손님이 살때 1kg 99.9 기준' },
  { name: '실버바_팔때',     kind: 'num',  unit: '1kg', note: '실버바 손님이 팔때 1kg 99.9 기준' },
  { name: '덩이금_최고가',   kind: 'num',  unit: '1돈', note: 'GRADE 1 기준가 → 등급별 -10,000원 자동 계산' },
  { name: '검인반지메달',    kind: 'num',  unit: '1돈', note: '검인 반지 · 회사메달 원/돈' },
  { name: '검인목걸이팔찌',  kind: 'num',  unit: '1돈', note: '검인 목걸이 · 팔찌 원/돈' },
  { name: '열쇠가격',        kind: 'text', unit: '1돈', note: '열쇠 원/돈 (범위로 표시)' },
  { name: '상패동물골프공',  kind: 'text', unit: '1돈', note: '상패 · 동물 · 골프공 원/돈' },
  { name: '치금_인레이',     kind: 'num',  unit: '1돈', note: '치금 인레이 원/돈' },
  { name: '치금_크라운',     kind: 'num',  unit: '1돈', note: '치금 크라운 원/돈' },
];
export const RANGE = { '1돈': [10000, 5000000], '1kg': [100000, 50000000] };
export const TEXT_RE = /^[0-9]{1,4}(~[0-9]{1,4})?$/;

// 예비 값 — 이 함수가 장부를 한 번도 못 읽었을 때만 (GitHub main 의 마지막 prices.js 3ab30f2 · prices.json a14408e updated 2026-11-02)
//   🔴 날짜는 그 값의 날짜 그대로 — 홈페이지 UPDATED 가 오늘처럼 보이지 않게
//   🔴 올리기 전에 GitHub main 에 prices.js 가 또 바뀌었으면 그 값으로 맞춥니다 (node scripts/regress.mjs 가 FAIL 로 알려 줌)
export const FALLBACK_YMD = '2026-11-02';
export const FALLBACK_BASE = Object.freeze({
  골드바_살때: 670000, 골드바_팔때: 645000, K18: 478000, K14: 372000, K10: 160000, 백금: 135000,
  실버바_살때: 2400000, 실버바_팔때: 1850000,
  덩이금_최고가: 640000,
  검인반지메달: 635000, 검인목걸이팔찌: 632000, 열쇠가격: '620~625', 상패동물골프공: '625~630',
  치금_인레이: 322000, 치금_크라운: 225000,
});
// 예비 값을 낼 수 있는 날 수 — FALLBACK_YMD(한국 날짜)부터 이 날 수까지만 (2026-11-02 → 11-05 23:59 한국 시각까지)
//   그 뒤엔 메모리도 없고 장부도 못 읽으면 숫자 대신 503 (낡은 숫자 · 낡은 매입가가 손님 화면 · 카톡에 안 나가게)
//   전환하는 날 · 첫 저장 전 며칠만 예비 값이 필요해서 짧게 둡니다. 예전처럼 늘 예비 값을 내려면 큰 수로.
export const FALLBACK_MAX_DAYS = 3;

// ── 캐시 (Vercel CDN) ─────────────────────────────
//   장부 값: 30초 묶음 + 뒤에서 다시 받는 동안 270초까지 옛 값 → 저장 뒤 길어도 300초(5분) (장부 화면 「길어도 5분」 과 같게)
//   못 읽음(none · 503): 캐시에 안 남김
export const CACHE = {
  ledger: 'public, max-age=0, s-maxage=30, stale-while-revalidate=270',
  memory: 'public, max-age=0, s-maxage=10',
  fallback: 'public, max-age=0, s-maxage=10',
  none: 'no-store',
};

// ── 꼴 검사 ───────────────────────────────────────
class ShapeError extends Error {
  constructor(msg, reason) { super(msg); this.reason = reason; }
}
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** 15칸 하나 검사 — 틀리면 글자(까닭), 맞으면 null */
export function fieldProblem(f, v) {
  if (f.kind === 'text') {
    if (typeof v !== 'string' || !TEXT_RE.test(v)) return `${f.name}: 「615~625」 꼴 글자가 아님`;
    const [a, b] = v.split('~');
    if (b !== undefined && Number(a) > Number(b)) return `${f.name}: 범위가 거꾸로`;
    return null;
  }
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) return `${f.name}: 원 단위 정수가 아님`;
  const [lo, hi] = RANGE[f.unit];
  if (v < lo || v > hi) return `${f.name}: 범위(${lo}~${hi}) 밖`;
  return null;
}

/** 'YYYY-MM-DD' 가 진짜 날짜인가 */
function realYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/**
 * 장부 응답(PostgREST 배열) → {base, ymd, at}
 *   빈 배열(아직 첫 저장 전) · 꼴 틀림이면 throw
 *   ymd = data.updated (장부 저장 날짜 · 한국) 'YYYY.MM.DD' → 'YYYY-MM-DD' · 없거나 틀리면 data.at 앞 10글자
 */
export function parseLedgerRows(rows) {
  if (!Array.isArray(rows)) throw new ShapeError('장부 응답이 배열이 아님', 'shape');
  if (rows.length === 0) throw new ShapeError('장부 사계절 줄이 아직 없음 (첫 저장 전)', 'empty');
  if (rows.length !== 1 || !isObj(rows[0]) || !isObj(rows[0].data)) throw new ShapeError('장부 응답 꼴이 다름', 'shape');
  const data = rows[0].data;
  const src = isObj(data.extra) && isObj(data.extra.base) ? data.extra.base : null;
  if (!src) throw new ShapeError('extra.base 가 없음', 'shape');
  const base = {};
  for (const f of FIELDS) {
    const p = fieldProblem(f, src[f.name]);
    if (p) throw new ShapeError(p, 'shape');
    base[f.name] = src[f.name];
  }
  let ymd = null;
  if (typeof data.updated === 'string' && /^\d{4}\.\d{2}\.\d{2}$/.test(data.updated)) ymd = data.updated.replace(/\./g, '-');
  if (!(ymd && realYmd(ymd)) && typeof data.at === 'string') ymd = data.at.slice(0, 10);
  if (!(ymd && realYmd(ymd))) throw new ShapeError('저장 날짜(updated · at)를 못 읽음', 'shape');
  return { base, ymd, at: typeof data.at === 'string' ? data.at : null };
}

/** 장부 id 3 읽기 — 2초 제한 · 꼴 검사 · 실패하면 throw (err.reason: timeout · http-5xx · network · empty · shape) */
export async function readLedger({ url = LEDGER_URL, key = LEDGER_KEY, timeoutMs = TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let r;
    try {
      r = await fetchImpl(`${url}/rest/v1/site_rates?select=data&id=eq.${RATES_ID}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: ctl.signal,
      });
    } catch (e) {
      throw new ShapeError(`장부에 못 닿음 (${e && e.name})`, ctl.signal.aborted ? 'timeout' : 'network');
    }
    if (!r.ok) throw new ShapeError(`장부 응답 ${r.status}`, `http-${r.status}`);
    let rows;
    try {
      rows = await r.json();
    } catch (e) {
      throw new ShapeError(`장부 응답을 못 읽음 (${e && e.name})`, ctl.signal.aborted ? 'timeout' : 'shape');
    }
    return parseLedgerRows(rows);
  } finally {
    clearTimeout(timer);
  }
}

// ── prices.js · prices.json 글자 ─────────────────
const isWide = (cp) => (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f) || (cp >= 0xac00 && cp <= 0xd7a3);   // 한글
const width = (s) => [...s].reduce((w, c) => w + (isWide(c.codePointAt(0)) ? 2 : 1), 0);   // 한글은 두 칸 (주석 줄 맞춤만)
const pad = (s, n) => s + ' '.repeat(Math.max(1, n - width(s)));
const valueText = (f, v) => (f.kind === 'text' ? JSON.stringify(v) : String(v));
const HEAD_NOTE = {
  ledger: (ymd) => `값은 장부 「손님 시세」 사계절 탭 ${ymd} 저장분입니다.`,
  memory: (ymd) => `장부를 잠깐 못 읽어 마지막으로 읽은 장부 값(${ymd} 저장분)입니다.`,
  fallback: (ymd) => `장부를 못 읽어 예비 값(${ymd} 값)입니다.`,
};

/**
 * prices.js 글자 — 15칸 + 시세날짜 + FORMULA (식은 한 글자도 안 바꿈)
 *   숫자는 정수 그대로 · 글자 칸은 JSON.stringify ("615~625")
 *   const 시세날짜 = "YYYY-MM-DD" — 장부 저장 날짜 (index.html UPDATED · display.html 날짜가 읽음)
 */
export function renderJs(base, ymd, src = 'ledger') {
  const line = (f) => {
    const decl = pad(`const ${f.name}`, 22) + '= ' + valueText(f, base[f.name]) + ';';
    return pad(decl, 36) + '// ' + f.note;
  };
  const by = (names) => names.map((n) => line(FIELDS.find((f) => f.name === n))).join('\n');
  const note = (HEAD_NOTE[src] || HEAD_NOTE.ledger)(ymd);
  return [
    '/* ================================================',
    '   사계절 금거래소 — 가격 (자동 생성 · 손으로 고치지 마세요)',
    '',
    `   ${note}`,
    '   GitHub 에서 고쳐도 손님 화면에 안 나갑니다. 장부 「손님 시세」 에서 바꾸세요.',
    '   (손님 기준 — 살때: 손님이 살때 / 팔때: 손님이 팔때)',
    '   ================================================ */',
    '',
    '// ── 시세 ──────────────────────────────────────',
    by(['골드바_살때', '골드바_팔때', 'K18', 'K14', 'K10', '백금', '실버바_살때', '실버바_팔때']),
    '',
    '// ── 덩이금 매입가 ─────────────────────────────',
    by(['덩이금_최고가']),
    '',
    '// ── 개별 매입가 ───────────────────────────────',
    by(['검인반지메달', '검인목걸이팔찌', '열쇠가격', '상패동물골프공']),
    '',
    '// ── 치금 (인레이/크라운) ──────────────────────',
    by(['치금_인레이', '치금_크라운']),
    '',
    '// ── 시세 날짜 (장부 저장 날짜 · 한국) — 홈페이지 UPDATED ──',
    `const 시세날짜 = ${JSON.stringify(ymd)};`,
    '',
    '',
  ].join('\n') + FORMULA;
}

/** prices.json 객체 — 옛 convert-prices.js 의 객체 부분 글자 그대로 (updated 만 장부 날짜) */
export function buildJson(base, ymd) {
  const { 골드바_살때, 골드바_팔때, K18, K14, K10, 백금, 실버바_살때, 실버바_팔때, 덩이금_최고가,
          검인반지메달, 검인목걸이팔찌, 열쇠가격, 상패동물골프공, 치금_인레이, 치금_크라운 } = base;
  const updated = ymd;
  return {
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
}

/** prices.json 글자 — 옛 파일과 같은 꼴 (JSON.stringify 2칸 · 끝 줄바꿈 없음) */
export const jsonText = (base, ymd) => JSON.stringify(buildJson(base, ymd), null, 2);

// ── prices.js → 15칸 (옛 convert-prices.js 의 정규식 그대로) ──
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
export function extractBase(js) {
  const out = {};
  for (const f of FIELDS) out[f.name] = f.kind === 'text' ? extractString(js, f.name) : extractNumber(js, f.name);
  return out;
}

/** 스스로 확인 — 만든 prices.js 를 옛 정규식으로 다시 읽어 15칸이 같아야 */
export function selfCheck(base, js) {
  try {
    const back = extractBase(js);
    return FIELDS.every((f) => back[f.name] === base[f.name]);
  } catch {
    return false;
  }
}

// ── 시각 (시험에서 바꿔 끼움) ─────────────────────
let nowFn = () => Date.now();
/** 시험용 — 지금 시각을 바꿔 끼움 (ms) · 인자 없으면 진짜 시각으로 */
export function setNow(fn) { nowFn = typeof fn === 'function' ? fn : () => Date.now(); }
/** 한국 날짜 'YYYY-MM-DD' */
export function kstYmd(ms) { return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10); }
const dayNo = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400000;
/** 예비 값을 아직 낼 수 있나 — 한국 날짜로 FALLBACK_YMD + FALLBACK_MAX_DAYS 일까지 */
export function fallbackFresh(ms = nowFn()) {
  if (!Number.isFinite(ms)) return false;   // 시각을 모르면 낡은 것으로 (숫자를 안 내는 쪽)
  return dayNo(kstYmd(ms)) - dayNo(FALLBACK_YMD) <= FALLBACK_MAX_DAYS;
}

// ── 못 읽음 (503) — 숫자를 안 냄 ────────────────────
//   prices.js: 아무 이름도 안 만드는 주석 한 덩이 (브라우저가 503 몸을 돌려도 · 안 돌려도 같은 화면 — 가격 칸 「-」)
//   prices.json: base 없는 오류 객체 (카카오 api/prices.js 는 !ok 라 「전화 주세요」 · 카드 스크립트는 멈춤)
export const NONE_JS = '/* 사계절 금거래소 — 시세를 불러오지 못했습니다. 매장으로 문의해 주세요.\n'
  + '   (장부를 못 읽었고 예비 값도 낡아서 숫자를 내지 않습니다 — 낡은 가격이 손님에게 안 나가게) */\n';
export const NONE_JSON = JSON.stringify({ error: '시세를 불러오지 못했습니다. 매장으로 문의해 주세요.' });
export function none(reason = 'unknown') {
  return { src: 'none', reason, base: null, ymd: null, js: NONE_JS, json: NONE_JSON };
}

// ── 고르기: 장부 → 메모리 → 예비(FALLBACK_MAX_DAYS 일 안) → 못 읽음(503) ──
let memo = null;   // 이 함수 인스턴스가 마지막으로 읽은 «검사 통과한» 장부 값 {base, ymd, js, json}

function make(base, ymd, src) {
  const js = renderJs(base, ymd, src);
  if (!selfCheck(base, js)) return null;
  return { base, ymd, js, json: jsonText(base, ymd) };
}

let fallbackMade = null;
export function fallback(reason = 'unknown') {
  if (!fallbackMade) fallbackMade = make({ ...FALLBACK_BASE }, FALLBACK_YMD, 'fallback');
  // 예비 값이 스스로 확인을 못 넘는 일은 없다 (회귀 시험이 본다) — 그래도 글자는 늘 낸다
  const m = fallbackMade || { base: { ...FALLBACK_BASE }, ymd: FALLBACK_YMD, js: renderJs(FALLBACK_BASE, FALLBACK_YMD, 'fallback'), json: jsonText(FALLBACK_BASE, FALLBACK_YMD) };
  return { ...m, src: 'fallback', reason };
}

/** 메모리가 없을 때 — 예비 값이 아직 낼 만하면 예비 값, 낡았으면 못 읽음(503) */
export function fallbackOrNone(reason = 'unknown', ms = nowFn()) {
  return fallbackFresh(ms) ? fallback(reason) : none(reason);
}

/**
 * 손님에게 낼 값 하나 — {src: 'ledger'|'memory'|'fallback'|'none', base, ymd, js, json, reason?}
 *   장부 값이 꼴 검사나 스스로 확인을 못 넘으면 그 값은 버리고 메모리(이미 검사 통과) → 예비 값(낼 만할 때만) → 못 읽음
 */
export async function pick(opts = {}) {
  const ms = typeof opts.now === 'number' ? opts.now : nowFn();
  let reason;
  try {
    const got = await readLedger(opts);
    const m = make(got.base, got.ymd, 'ledger');
    if (m) {
      memo = make(got.base, got.ymd, 'memory') || memo;   // 머리 주석만 「마지막으로 읽은 장부 값」 으로
      return { ...m, src: 'ledger' };
    }
    reason = 'selfcheck';
  } catch (e) {
    reason = (e && e.reason) || 'error';
  }
  if (memo) return { ...memo, src: 'memory', reason };
  return fallbackOrNone(reason, ms);
}

/** 시험용 — 메모리 비우기 */
export function resetMemory() { memo = null; }

/** 함수 응답 머리글 + 상태 (prices-js · prices-json 공통) — 못 읽음(none)이면 503 · 캐시 안 남김 */
export function setRatesHeaders(res, r, contentType) {
  res.statusCode = r.src === 'none' ? 503 : 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', CACHE[r.src] || CACHE.none);
  res.setHeader('X-Rates-Source', r.src);
  if (r.ymd) res.setHeader('X-Rates-Date', r.ymd);
  if (r.reason) res.setHeader('X-Rates-Reason', String(r.reason).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40) || 'error');
  res.setHeader('Access-Control-Allow-Origin', '*');
}
