// 16명 중 상위 3명을 뽑는 방법들을 같은 조건에서 비교한다.
// 진짜 실력은 rank 0..15 (0이 최강). 판정은 Bradley-Terry 확률로 흔들린다.
// theta=0 이면 완벽한 판정, 클수록 사람이 헷갈린다.

const N = 16;
const TRIALS = 20000;

function shuffle(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// strength: 랭크가 낮을수록 강하다. 인접 랭크 간격은 1.
const strength = r => -r;

function makeJudge(theta, rnd) {
  let count = 0;
  const judge = (a, b) => {                       // a가 이기면 true
    count++;
    if (theta <= 0) return a < b;
    const d = strength(a) - strength(b);
    return rnd() < 1 / (1 + Math.exp(-d / theta));
  };
  judge.count = () => count;
  return judge;
}

// ── 단판 토너먼트. 대진과 각 선수가 누구한테 졌는지를 같이 돌려준다 ──
function singleElim(players, judge) {
  let round = players.slice();
  const beatenBy = new Map();   // 진 사람 -> 이긴 사람
  const victims = new Map();    // 이긴 사람 -> [이겨본 사람들]
  const rounds = [];
  while (round.length > 1) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i], b = round[i + 1];
      const aWins = judge(a, b);
      const w = aWins ? a : b, l = aWins ? b : a;
      beatenBy.set(l, w);
      if (!victims.has(w)) victims.set(w, []);
      victims.get(w).push(l);
      next.push(w);
    }
    rounds.push(round);
    round = next;
  }
  return { champion: round[0], beatenBy, victims, rounds };
}

// 4명짜리 미니 브래킷 (부족하면 부전승)
function miniBracket(cands, judge) {
  let r = cands.slice();
  const order = [];
  while (r.length > 1) {
    const next = [];
    for (let i = 0; i < r.length; i += 2) {
      if (i + 1 >= r.length) { next.push(r[i]); continue; }
      const aWins = judge(r[i], r[i + 1]);
      next.push(aWins ? r[i] : r[i + 1]);
      order.push(aWins ? r[i + 1] : r[i]);
    }
    r = next;
  }
  return { winner: r[0], others: order.reverse() };
}

// ── 방법 A : 단판 토너먼트 그대로. 결승 패자 = 2등, 준결승 패자 하나 = 3등 ──
function methodBracket(players, judge) {
  const t = singleElim(players, judge);
  const first = t.champion;
  const second = t.beatenBy.get(first) !== undefined ? null : null;
  // 결승 패자 = 챔피언이 마지막으로 이긴 사람
  const v = t.victims.get(first);
  const runnerUp = v[v.length - 1];
  // 준결승 패자 둘 중 하나 (동률 처리: 그냥 앞의 것)
  const semiLosers = t.rounds[t.rounds.length - 2].filter(p => p !== first && p !== runnerUp);
  return { top3: [first, runnerUp, semiLosers[0]], matches: N - 1 };
}

// ── 방법 B : 3-4위전 추가 (스포츠에서 흔한 방식) ──
function methodBracketPlayoff(players, judge) {
  const t = singleElim(players, judge);
  const first = t.champion;
  const v = t.victims.get(first);
  const runnerUp = v[v.length - 1];
  const semiLosers = t.rounds[t.rounds.length - 2].filter(p => p !== first && p !== runnerUp);
  const third = judge(semiLosers[0], semiLosers[1]) ? semiLosers[0] : semiLosers[1];
  return { top3: [first, runnerUp, third], matches: N };
}

// ── 방법 C : 챔피언 희생자 재경기 ──
// 진짜 2등은 반드시 1등한테 졌다. 1등이 이긴 4명만 다시 붙이면 2등이 확정된다.
// 진짜 3등은 1등 아니면 2등한테만 졌다.
// 따라서 3등 후보 = (1등 희생자 - 2등) ∪ (2등이 이겨본 사람 전부). 자르지 않는다.
function methodChallenger(players, judge) {
  const t = singleElim(players, judge);
  const first = t.champion;
  const pool = (t.victims.get(first) || []).slice();
  const m2 = miniBracket(pool, judge);
  const second = m2.winner;
  const thirdPool = [...pool.filter(p => p !== second), ...(t.victims.get(second) || [])]
    .filter((p, i, a) => a.indexOf(p) === i);
  const m3 = miniBracket(thirdPool, judge);
  return { top3: [first, second, m3.winner], matches: judge.count() };
}

// ── 방법 E : 더블 엘리미네이션 ──
// 한 번 져도 패자조로 떨어진다. 두 번 져야 탈락.
// 패자조 결승 패자가 곧 3등이 되는 구조라 순위가 구조적으로 나온다.
function doubleElim(players, judge) {
  const play = (a, b) => { const aw = judge(a, b); return [aw ? a : b, aw ? b : a]; };
  const roundOf = arr => {
    const win = [], lose = [];
    for (let i = 0; i < arr.length; i += 2) {
      if (i + 1 >= arr.length) { win.push(arr[i]); continue; }
      const [w, l] = play(arr[i], arr[i + 1]);
      win.push(w); lose.push(l);
    }
    return [win, lose];
  };
  // 승자조
  let w = players.slice();
  const dropped = [];
  while (w.length > 1) { const [nw, nl] = roundOf(w); dropped.push(nl); w = nw; }
  const wbChampion = w[0];
  // 패자조 : 한 라운드 치를 때마다 승자조 탈락자가 한 무리씩 합류한다.
  // 승자조 결승 패자만은 끝까지 남겨뒀다가 패자조 결승에서 붙인다 (정식 시드)
  let l = dropped[0];
  for (let r = 1; r < dropped.length - 1; r++) {
    [l] = roundOf(l);                       // 패자조 내부 라운드
    l = l.concat(dropped[r]);               // 승자조 탈락자 합류
  }
  while (l.length > 1) { [l] = roundOf(l); }
  // 패자조 결승. 이 판의 패자가 3등이 된다
  const [lbChampion, third] = play(l[0], dropped[dropped.length - 1][0]);
  // 결승. 패자조 챔피언이 이기면 한 판 더 (승자조 챔피언의 첫 패배이므로)
  let [gf1, gf1l] = play(wbChampion, lbChampion);
  let first, second;
  if (gf1 === wbChampion) { first = wbChampion; second = lbChampion; }
  else { const [f, s] = play(lbChampion, wbChampion); first = f; second = s; }
  return { top3: [first, second, third], matches: judge.count() };
}

// ── 방법 D : 적응형 Elo. 매 판 지금 등급이 가장 가까운 두 명을 붙인다 ──
// 상위 3명만 알면 되므로 비교를 상위권에 몰아준다. 전 구간을 고르게 재는 건 낭비다.
function methodElo(players, judge, budget) {
  const R = new Map(players.map(p => [p, 0]));
  const games = new Map(players.map(p => [p, 0]));
  const seen = new Set();
  const K = 0.9;
  const FOCUS = 6;
  for (let m = 0; m < budget; m++) {
    const ranked = players.slice().sort((x, y) => R.get(y) - R.get(x));
    // 한 바퀴는 전원에게 최소 1판씩, 그 뒤로는 상위 FOCUS명 안에서만
    const zone = players.some(p => games.get(p) === 0) ? players : ranked.slice(0, FOCUS);
    let best = null, bestScore = Infinity;
    for (let i = 0; i < zone.length; i++) for (let j = i + 1; j < zone.length; j++) {
      const a = zone[i], b = zone[j];
      const key = a < b ? a + "," + b : b + "," + a;
      const score = Math.abs(R.get(a) - R.get(b))
        + (seen.has(key) ? 6 : 0)
        + (games.get(a) + games.get(b)) * 0.12;
      if (score < bestScore) { bestScore = score; best = [a, b, key]; }
    }
    if (!best) break;
    const [a, b, key] = best;
    seen.add(key);
    games.set(a, games.get(a) + 1); games.set(b, games.get(b) + 1);
    const aWins = judge(a, b);
    const exp = 1 / (1 + Math.exp(-(R.get(a) - R.get(b))));
    R.set(a, R.get(a) + K * ((aWins ? 1 : 0) - exp));
    R.set(b, R.get(b) - K * ((aWins ? 1 : 0) - exp));
  }
  const ranked = players.slice().sort((x, y) => R.get(y) - R.get(x));
  return { top3: ranked.slice(0, 3), matches: budget };
}

function run(theta, method, budget) {
  let exact1 = 0, exact2 = 0, exact3 = 0, setHits = 0, exactOrder = 0, matches = 0;
  for (let t = 0; t < TRIALS; t++) {
    const rnd = mulberry(t * 7919 + 13);
    const players = shuffle([...Array(N).keys()], rnd);
    const judge = makeJudge(theta, rnd);
    const r = method(players, judge, budget);
    matches += r.matches;
    if (r.top3[0] === 0) exact1++;
    if (r.top3[1] === 1) exact2++;
    if (r.top3[2] === 2) exact3++;
    const s = new Set(r.top3);
    setHits += [0, 1, 2].filter(x => s.has(x)).length;
    if (r.top3[0] === 0 && r.top3[1] === 1 && r.top3[2] === 2) exactOrder++;
  }
  return {
    p1: exact1 / TRIALS, p2: exact2 / TRIALS, p3: exact3 / TRIALS,
    setAvg: setHits / TRIALS, order: exactOrder / TRIALS, matches: matches / TRIALS,
  };
}

const pct = v => (v * 100).toFixed(1).padStart(5) + "%";
const methods = [
  ["A 단판 (지금 v14) ", methodBracket, null],
  ["B 3-4위전 추가    ", methodBracketPlayoff, null],
  ["C 챔피언 희생자전  ", methodChallenger, null],
  ["E 더블 엘리미네이션", doubleElim, null],
  ["D 적응형 Elo 21판  ", methodElo, 21],
  ["D 적응형 Elo 30판  ", methodElo, 30],
];

for (const theta of [0, 0.4, 0.8]) {
  console.log(`\n판정 흔들림 theta=${theta}  ${theta === 0 ? "(완벽한 눈)" : "(인접 랭크 정답률 " + (100 / (1 + Math.exp(-1 / theta))).toFixed(0) + "%)"}`);
  console.log("방법                 판수   1등정확  2등정확  3등정확  top3집합  순서까지");
  for (const [name, fn, budget] of methods) {
    const r = run(theta, fn, budget);
    console.log(`${name}  ${r.matches.toFixed(1).padStart(5)}  ${pct(r.p1)}  ${pct(r.p2)}  ${pct(r.p3)}   ${r.setAvg.toFixed(2)}/3    ${pct(r.order)}`);
  }
}
