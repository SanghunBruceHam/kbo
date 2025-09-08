/**
 * KBO 매직/트래직 넘버 매트릭스 계산기
 * 1~9위 확정/탈락 매직·트래직 넘버 (잔여경기 R로 캡핑 표기)
 */

// 전역 변수
let matrixTeams = [];
let matrixResults = [];
let matrixCurrentRanksMap = new Map();
let matrixRemainingMap = new Map();

// 유틸리티 함수
function calcR(team, season = 144) {
    return team.actualR || (season - (team.W + team.L + team.T));
}

function pNow(team) {
    const denom = team.W + team.L;
    return denom > 0 ? team.W / denom : 0;
}

function pMax(team, R) {
    const denom = team.W + team.L + R;
    return denom > 0 ? (team.W + R) / denom : 0;
}

function pMin(team, R) {
    const denom = team.W + team.L + R;
    return denom > 0 ? team.W / denom : 0;
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function round3(x) {
    return Number(x.toFixed(3));
}

function kthLargest(arr, k) {
    if (!arr.length || k < 1) return 0;
    const sorted = [...arr].sort((a, b) => b - a);
    return sorted[k - 1] ?? 0;
}

// ===== 리팩토링 유틸 =====
function buildCurrentRankMap(results){
    const sorted = [...results].sort((a,b)=> b.winPct - a.winPct);
    const m = new Map();
    sorted.forEach((r, idx)=> m.set(r.team, idx+1));
    return m;
}

function bannerTd({teamColor, colspan, stage, sub, cls='banner-top'}){
    return `<td class="${cls}" colspan="${colspan}" style="background:${teamColor};">${stage}`
         + (sub ? `<span class="banner-note">(${sub})</span>` : '')
         + `</td>`;
}

function cellLabelAndClass({rank, currentRank, x, y, xraw, R}){
    if (rank < currentRank) {
        return {label: (y===0? `${rank}위 불가`: String(y)), cls: (y===0?'magic-impossible':'magic-danger')};
    }
    if (rank===currentRank && xraw>R) return {label:String(R), cls:'magic-selflimit'};
    if (y===0)                          return {label:`${rank}위 불가`, cls:'magic-impossible'};
    if (xraw>R)                         return {label:String(R), cls:'magic-selflimit'};
    if (x===0)                          return {label:'확보', cls:'magic-confirmed'};
    return {label:String(x), cls:'magic-safe'};
}

// 사전 정렬로 Kk 최적화
function precomputeTeamBenchmarks(teams, season=144){
    const map = new Map();
    for (const i of teams){
        const maxList = [], minList = [];
        for (const t of teams){
            if (t.id === i.id) continue;
            const R = matrixRemainingMap.has(t.id) ? matrixRemainingMap.get(t.id) : calcR(t, season);
            maxList.push(pMax(t, R));
            minList.push(pMin(t, R));
        }
        maxList.sort((a,b)=>b-a);
        minList.sort((a,b)=>b-a);
        map.set(i.id, {maxSorted:maxList, minSorted:minList});
    }
    return map;
}
function kthFromPre(preMap, id, k){
    const e = preMap.get(id);
    return {
        Kk_max: (e?.maxSorted?.[k-1]) ?? 0,
        Kk_min: (e?.minSorted?.[k-1]) ?? 0
    };
}

function kBenchmarksForTeam(team, teams, season, k) {
    const maxList = [];
    const minList = [];
    for (const t of teams) {
        if (t.id === team.id) continue;
        const R = matrixRemainingMap.has(t.id) ? matrixRemainingMap.get(t.id) : calcR(t, season);
        maxList.push(pMax(t, R));
        minList.push(pMin(t, R));
    }
    return {
        Kk_max: kthLargest(maxList, k),
        Kk_min: kthLargest(minList, k),
    };
}

function magicTragicForK(team, season, Kk_max, Kk_min) {
    const R = matrixRemainingMap.has(team.id) ? matrixRemainingMap.get(team.id) : calcR(team, season);
    const D = team.W + team.L + R;

    // Magic
    const rhsMagic = Kk_max * D - team.W;
    const x_strict_raw = Math.max(0, Math.floor(rhsMagic) + 1);
    const x_tieOK_raw = Math.max(0, Math.ceil(rhsMagic));
    const x_strict = clamp(x_strict_raw, 0, R);
    const x_tieOK = clamp(x_tieOK_raw, 0, R);

    // Tragic
    const rhsTr = team.W + R - Kk_min * D;
    const y_strict_raw = Math.max(0, Math.ceil(rhsTr));
    const y_tieOK_raw = Math.max(0, Math.floor(rhsTr) + 1);
    const y_strict = clamp(y_strict_raw, 0, R);
    const y_tieOK = clamp(y_tieOK_raw, 0, R);

    return { R, Kk_max, Kk_min, x_strict, x_tieOK, y_strict, y_tieOK, x_strict_raw, x_tieOK_raw, y_strict_raw, y_tieOK_raw };
}

function kboMagicTragicRanksAll(teams, season = 144) {
    const ks = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const preMap = precomputeTeamBenchmarks(teams, season);
    return teams.map(team => {
        const R = matrixRemainingMap.has(team.id) ? matrixRemainingMap.get(team.id) : calcR(team, season);
        const row = {
            team: team.id,
            W: team.W, L: team.L, T: team.T, R,
            winPct: round3(pNow(team)),
            _jsonRank: matrixCurrentRanksMap.get(team.id) ?? null
        };

        for (const k of ks) {
            const { Kk_max, Kk_min } = kthFromPre(preMap, team.id, k);
            const r = magicTragicForK(team, season, Kk_max, Kk_min);
            row[`K${k}_max`] = round3(r.Kk_max);
            row[`K${k}_min`] = round3(r.Kk_min);
            row[`x${k}_strict`] = r.x_strict;
            row[`x${k}_tieOK`] = r.x_tieOK;
            row[`y${k}_strict`] = r.y_strict;
            row[`y${k}_tieOK`] = r.y_tieOK;
            row[`x${k}_strict_raw`] = r.x_strict_raw;
            row[`x${k}_tieOK_raw`] = r.x_tieOK_raw;
            row[`y${k}_strict_raw`] = r.y_strict_raw;
            row[`y${k}_tieOK_raw`] = r.y_tieOK_raw;
        }
        return row;
    });
}

// 현재 순위 계산
function getCurrentRank(targetTeam, allResults) {
    if (targetTeam._jsonRank != null) return targetTeam._jsonRank;
    const sorted = [...allResults].sort((a, b) => b.winPct - a.winPct);
    return sorted.findIndex(team => team.team === targetTeam.team) + 1;
}

// 데이터 로드
async function loadMatrixData() {
    try {
        const response = await fetch('data/calc-magic-numbers.json');
        const data = await response.json();

        if (Array.isArray(data.playoffResults)) {
            matrixTeams = data.playoffResults.map(r => ({
                id: r.team,
                W: r.wins,
                L: r.losses,
                T: r.draws ?? 0
            }));
            matrixRemainingMap = new Map(data.playoffResults.map(r => [r.team, r.remainingGames]));
        } else {
            matrixTeams = [];
            matrixRemainingMap = new Map();
        }

        if (Array.isArray(data.results)) {
            matrixCurrentRanksMap = new Map(data.results.map(r => [r.team, r.rank]));
        } else {
            matrixCurrentRanksMap = new Map();
        }

        // 매트릭스 데이터 로드 완료
        return true;
    } catch (error) {
        console.error('매트릭스 데이터 로드 실패:', error);
        return false;
    }
}

// 계산 실행
function calculateMatrix() {
    if (matrixTeams.length === 0) return;
    matrixResults = kboMagicTragicRanksAll(matrixTeams, 144);
    renderMatrixTable();
}

// 매트릭스 테이블 렌더링
function renderMatrixTable() {
    if (matrixResults.length === 0) return;

    const currentRankMap = buildCurrentRankMap(matrixResults);

    const ranks = [9, 8, 7, 6, 5, 4, 3, 2, 1];
    let html = '<div class="matrix-table-container"><table class="magic-matrix-table">';

    // Header
    html += '<thead><tr>';
    html += '<th rowspan="2" class="matrix-team-col">구단</th>';
    html += '<th colspan="9" class="matrix-header-main">순위</th>';
    html += '</tr><tr>';
    for (const rank of ranks) {
        const headerClass = (rank === 5) ? 'playoff-rank-header rank-cell' : 'rank-header rank-cell';
        html += `<th class="${headerClass}">${rank}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of matrixResults) {
        const currentRank = currentRankMap.get(row.team) ?? getCurrentRank(row, matrixResults);
        html += '<tr>';
        
        // 팀명 매핑
        const teamNameMap = {
            'LG': 'lg',
            '한화': 'hanwha',
            'SSG': 'ssg',
            '삼성': 'samsung',
            'KT': 'kt',
            '롯데': 'lotte',
            'NC': 'nc',
            'KIA': 'kia',
            '두산': 'doosan',
            '키움': 'kiwoom'
        };
        const logoName = teamNameMap[row.team] || row.team.toLowerCase();
        
        // 팀별 색상 정의
        const teamColors = {
            'LG': '#C30452',
            '한화': '#FF6600',
            'SSG': '#CE0E2D',
            '삼성': '#074CA1',
            'KT': '#000000',
            '롯데': '#002955',
            'NC': '#1D467A',
            'KIA': '#EA0029',
            '두산': '#131230',
            '키움': '#820024'
        };
        const teamColor = teamColors[row.team] || '#1f2937';
        
        html += `<td class="matrix-team-info">
            <div class="matrix-team-name" style="color: ${teamColor};">
                <img src="images/teams/${logoName}.png" class="team-logo-small" alt="${row.team}" onerror="this.style.display='none'">
                <span style="font-weight: 800;">${row.team}</span>
            </div>
            <div class="matrix-team-status">현재 ${currentRank}위 · 잔여 ${row.R}경기</div>
        </td>`;

        // --- 배너/셀 렌더링 (머지 지원) ---
        let ci = 0;
        while (ci < ranks.length) {
            const rank = ranks[ci];
            const x1 = row[`x1_strict`];
            const x2 = row[`x2_strict`];
            const x3 = row[`x3_strict`];
            const x4 = row[`x4_strict`];
            const x5 = row[`x5_strict`];

            const y7 = row[`y7_tieOK`]; // ≤7 불가면 8위 이하 확정
            const y8 = row[`y8_tieOK`]; // ≤8 불가면 9위 확정
            const y9 = row[`y9_tieOK`]; // ≤9 불가면 10위 확정

            // 1) 확정 상태 우선순위(왼쪽→오른쪽 병합)
            // 정확히 n위 확정: xk_strict === 0  &&  y(k-1)_tieOK === 0
            // k위 이상 확정:    xk_strict === 0  &&  y(k-1)_tieOK  > 0 (상위 가능성 남음)
            // Tragic 기준은 UI 전반에서 tieOK로 통일
            const y1 = row[`y1_tieOK`];
            const y2 = row[`y2_tieOK`];
            const y3 = row[`y3_tieOK`];
            const y4 = row[`y4_tieOK`];
            const y5 = row[`y5_tieOK`];
            const y6 = row[`y6_tieOK`];
            const y7 = row[`y7_tieOK`];
            const y8 = row[`y8_tieOK`];
            const y9 = row[`y9_tieOK`];

            // 10위 확정 (정확)
            if (y9 === 0) {
                html += `<td class="banner-low" colspan="9" style="background:${teamColor};">포스트시즌 진출 실패<span class="banner-note">(정규시즌 10위 확정)</span></td>`;
                break;
            }
            
            // 1위 확정 (정확)
            if (x1 === 0) {
                html += `<td class="banner-top" colspan="9" style="background:${teamColor};">한국시리즈 진출 확보<span class="banner-note">(정규시즌 1위 확정)</span></td>`;
                break;
            }

            // 2위 처리: 위로(1위) 가능하면 확보, 막히면 확정
            if (x2 === 0 && x1 > 0) {
                if (y1 === 0) {
                    // 1위 불가 → 정확히 2위 확정
                    html += `<td class="banner-top" colspan="9" style="background:${teamColor};">플레이오프 진출 확보<span class="banner-note">(정규시즌 2위 확정)</span></td>`;
                } else {
                    // 1위 가능 → 2위 이상 확보 (플레이오프 진출 확보)
                    html += `<td class="banner-top" colspan="9" style="background:${teamColor};">플레이오프 진출 확보<span class="banner-note">(정규시즌 2위 이상 확보)</span></td>`;
                }
                break;
            }

            // 3위 처리: 위로(2위) 가능하면 확보, 막히면 확정
            if (x3 === 0 && x2 > 0) {
                if (y2 === 0) {
                    // 2위 불가 → 정확히 3위 확정
                    html += `<td class="banner-top" colspan="9" style="background:${teamColor};">준 플레이오프 진출 확보<span class="banner-note">(정규시즌 3위 확정)</span></td>`;
                } else {
                    // 2위 가능 → 3위 이상 확보 (준 플레이오프 진출 확보)
                    html += `<td class="banner-top" colspan="9" style="background:${teamColor};">준 플레이오프 진출 확보<span class="banner-note">(정규시즌 3위 이상 확보)</span></td>`;
                }
                break;
            }

            // 4위 처리: 위로(3위) 가능하면 확보, 막히면 확정
            if (x4 === 0 && x3 > 0) {
                if (y3 === 0) {
                    // 3위 불가 → 정확히 4위 확정
                    html += `<td class="banner-mid" colspan="9" style="background:${teamColor};">와일드카드 결정전 진출 확보<span class="banner-note">(정규시즌 4위 확정)</span></td>`;
                } else {
                    // 3위 가능 → 4위 이상 확보 (와일드카드 결정전 진출 확보)
                    html += `<td class="banner-mid" colspan="9" style="background:${teamColor};">와일드카드 결정전 진출 확보<span class="banner-note">(정규시즌 4위 이상 확보)</span></td>`;
                }
                break;
            }

            // 2) 하위권 확정(정확) – 오른쪽 전부 병합
            // 6위 확정: x6==0 && y5==0  (≤6 확보 & ≤5 불가) → 포스트시즌 실패
            // 7위 확정: x7==0 && y6==0
            // 8위 확정: x8==0 && y7==0
            // 9위 확정: x9==0 && y8==0
            const x6v = row[`x6_strict`];
            const x7v = row[`x7_strict`];
            const x8v = row[`x8_strict`];
            const x9v = row[`x9_strict`];

            if (x6v === 0 && y5 === 0) {
                html += `<td class="banner-low" colspan="9" style="background:${teamColor};">포스트시즌 진출 실패<span class="banner-note">(정규시즌 6위 확정)</span></td>`;
                break;
            }
            if (x7v === 0 && y6 === 0) {
                html += `<td class="banner-low" colspan="9" style="background:${teamColor};">포스트시즌 진출 실패<span class="banner-note">(정규시즌 7위 확정)</span></td>`;
                break;
            }
            if (x8v === 0 && y7 === 0) {
                html += `<td class="banner-low" colspan="9" style="background:${teamColor};">포스트시즌 진출 실패<span class="banner-note">(정규시즌 8위 확정)</span></td>`;
                break;
            }
            if (x9v === 0 && y8 === 0) {
                html += `<td class="banner-low" colspan="9" style="background:${teamColor};">포스트시즌 진출 실패<span class="banner-note">(정규시즌 9위 확정)</span></td>`;
                break;
            }

            // 5위 처리: 위로(4위) 가능하면 확보, 막히면 확정 (9~5열 병합)
            if (x5 === 0 && rank === 9) {
                if (y4 === 0) {
                    // 4위 불가 → 정확히 5위 확정
                    html += `<td class="banner-top" colspan="5" style="background:${teamColor};">와일드카드 결정전 진출 확보<span class="banner-note">(정규시즌 5위 확정)</span></td>`;
                } else {
                    // 4위 가능 → 5위 이상 확보 (와일드카드 결정전 진출 확보)
                    html += `<td class="banner-top" colspan="5" style="background:${teamColor};">와일드카드 결정전 진출 확보<span class="banner-note">(정규시즌 5위 이상 확보)</span></td>`;
                }
                ci += 5; // 9,8,7,6,5 건너뜀
                continue;
            }

            // 4) 일반 셀 렌더링 (매직=strict, 트래직=tieOK)
            const x     = row[`x${rank}_strict`];
            const y     = row[`y${rank}_tieOK`];
            const xraw  = row[`x${rank}_strict_raw`];
            const R     = row.R;

            const {label, cls} = cellLabelAndClass({
                rank,
                currentRank,
                x,
                y,
                xraw,
                R
            });

            const divider = (rank === 5) ? 'playoff-divider-left' : '';
            html += `<td class="magic-cell ${cls} ${divider}">${label}</td>`;
            ci += 1;
        }

        html += '</tr>';
    }

    html += '</tbody></table></div>';
    
    const container = document.getElementById('magicMatrixContent');
    if (container) {
        container.innerHTML = html;
    }
}

// 초기화 함수
async function initMagicMatrix() {
    const loaded = await loadMatrixData();
    if (loaded && matrixTeams.length > 0) {
        calculateMatrix();
    }
}

// 페이지 로드시 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMagicMatrix);
} else {
    initMagicMatrix();
}