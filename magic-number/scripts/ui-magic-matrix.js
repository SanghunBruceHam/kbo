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

    // 동순위 처리: 승률이 같으면 같은 순위 부여
    let currentRank = 1;
    let previousWinPct = null;

    sorted.forEach((r, idx) => {
        // 이전 팀과 승률이 다르면 실제 순위로 업데이트
        if (previousWinPct !== null && r.winPct !== previousWinPct) {
            currentRank = idx + 1;
        }
        m.set(r.team, currentRank);
        previousWinPct = r.winPct;
    });

    return m;
}

function bannerTd({teamColor, colspan, stage, sub, cls='banner-top', crosses=false}){
    const styleVars = crosses ? `--colspan:${colspan};--divider-offset-cols:4;` : '';
    return `<td class="${cls} ${crosses ? 'crosses-playoff' : ''}" colspan="${colspan}" style="background:${teamColor};${styleVars}">${stage}`
         + (sub ? `<span class="banner-note">(${sub})</span>` : '')
         + `</td>`;
}

function cellLabelAndClass({rank, currentRank, x, y, xraw, R}){
    if (rank < currentRank) {
        // 5위 이하 불가능인 경우 포스트시즌 진출 실패 문구 추가
    const postSeasonText = (rank >= 5 && y === 0) ? '<br><small style="font-size: 12px; font-weight: 700;">포스트시즌 진출 실패</small>' : '';
        return {label: (y===0? `${rank}위 불가${postSeasonText}`: String(y)), cls: (y===0?'magic-impossible':'magic-danger')};
    }
    if (rank===currentRank && xraw>R) return {label:String(R), cls:'magic-selflimit'};
    // 5위 이하 불가능인 경우 포스트시즌 진출 실패 문구 추가
    const postSeasonText = (rank >= 5) ? '<br><small style="font-size: 12px; font-weight: 700;">포스트시즌 진출 실패</small>' : '';
    if (y===0)                          return {label:`${rank}위 불가${postSeasonText}`, cls:'magic-impossible'};
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

        // results 배열에서 정확한 순위와 승률 정보 가져오기
        if (Array.isArray(data.results)) {
            matrixTeams = data.results.map(r => ({
                id: r.team,
                team: r.team,
                W: r.wins,
                L: r.losses,
                T: 0, // draws 정보가 results에 없으므로 0으로 설정
                winPct: r.winRate,
                rank: r.rank
            }));
        } else {
            matrixTeams = [];
        }

        // playoffResults에서 남은 경기수 정보 가져오기
        if (Array.isArray(data.playoffResults)) {
            matrixRemainingMap = new Map(data.playoffResults.map(r => [r.team, r.remainingGames]));
        } else {
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

    // 이미 로드된 정확한 순위 정보 사용 (동순위 처리 포함)
    const currentRankMap = matrixCurrentRanksMap;

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

        // === 10위 확정(포스트시즌 탈락) : 1~9위 전부 불가 → 전체 병합 배너 ===
        // y9_tieOK === 0 이면 이미 ">=9위" 달성이 불가능 → 정규시즌 10위 확정
        if (row[`y9_tieOK`] === 0) {
            html += `<td class="banner-low" colspan="9" style="background: ${teamColor};">`
                 + `포스트시즌 진출 실패`
                 + `<span class="banner-note">(정규시즌 10위 확정)</span>`
                 + `</td>`;
            html += '</tr>';
            continue; // 다음 팀으로 이동 (이 행의 나머지 칸은 렌더하지 않음)
        }


        // --- 배너 범위 계산 함수 ---
        function getClinchRangeForTeam(row) {
            const x1 = row[`x1_strict`];
            const x2 = row[`x2_strict`];
            const x3 = row[`x3_strict`];
            const x4 = row[`x4_strict`];
            const x5 = row[`x5_strict`];
            const x6 = row[`x6_strict`];
            const x7 = row[`x7_strict`];
            const x8 = row[`x8_strict`];
            const x9 = row[`x9_strict`];

            // 확보한 최고 순위(숫자 작을수록 상위)
            let minClinchRank = null;
            if (x1 === 0) minClinchRank = 1;
            else if (x2 === 0) minClinchRank = 2;
            else if (x3 === 0) minClinchRank = 3;
            else if (x4 === 0) minClinchRank = 4;
            else if (x5 === 0) minClinchRank = 5;
            else if (x6 === 0) minClinchRank = 6;
            else if (x7 === 0) minClinchRank = 7;
            else if (x8 === 0) minClinchRank = 8;
            else if (x9 === 0) minClinchRank = 9;

            if (!minClinchRank) return null; // 확보 없음

            // 🔒 병합 규칙: 9위(맨 왼쪽)부터 clinch된 최소 순위까지 병합
            const startRank = 9;              // 가장 왼쪽 열
            const endRank = minClinchRank;    // 확보된 최소 순위 (예: 3위 확보 → 3)

            return { startRank, endRank };
        }
        
        // --- 랭크 → 열 인덱스 매핑 (9→0, 8→1, ..., 1→8) ---
        function rankToColIndex(rank) {
            return 9 - rank;
        }

        function renderRankCell(row, rank, teamColor) {
            // Magic(strict) for rank >= currentRank, Tragic(tieOK) for rank < currentRank
            const currentRank = matrixCurrentRanksMap.get(row.team) ?? getCurrentRank(row, matrixResults);
            const xVal = row[`x${rank}_strict`];
            const yVal = row[`y${rank}_tieOK`];
            // anyBetterPossible: for rank >= currentRank, check if any y{j}_tieOK > 0 for j=1..rank-1
            const anyBetterPossible = rank > 1
                ? [...Array(rank - 1).keys()].some(i => row[`y${i + 1}_tieOK`] > 0)
                : false;
            
            // 5위 구분선 클래스 추가
            const dividerClass = (rank === 5) ? ' playoff-divider-left' : '';

            if (rank < currentRank) {
                // Tragic side
                if (yVal === 0) {
                    // 5위 이하 불가능인 경우 포스트시즌 진출 실패 문구 추가
                    const postSeasonText = (rank >= 5) ? '<br><small style="font-size: 12px; font-weight: 700;">포스트시즌 진출 실패</small>' : '';
                    return `<td class="magic-cell magic-impossible${dividerClass}">${rank}위 불가${postSeasonText}</td>`;
                }
                // Remove "T" prefix
                return `<td class="magic-cell magic-danger tragic${dividerClass}" style="border-color:${teamColor};">${yVal}</td>`;
            } else {
                // Magic side
                if (xVal === 0) {
                    if (anyBetterPossible) {
                        return `<td class="magic-cell confirmed${dividerClass}" style="border-color:${teamColor};">확보</td>`;
                    } else {
                        return `<td class="magic-cell confirmed${dividerClass}" style="border-color:${teamColor};">확정</td>`;
                    }
                }
                // Remove "M" prefix
                return `<td class="magic-cell magic-safe${dividerClass}" style="border-color:${teamColor};">${xVal}</td>`;
            }
        }

        // --- 새로운 배너/셀 렌더링 시스템 (범위 기반) ---
        const clinchRange = getClinchRangeForTeam(row);

        // precomputed 데이터에서 배너 정보 가져오기
        function getBannerFromPrecomputed(teamName) {
            if (!window.precomputedMatrixData?.precomputedMatrixResults?.matrixData) {
                return null;
            }
            const teamData = window.precomputedMatrixData.precomputedMatrixResults.matrixData
                .find(t => t.team === teamName);
            return teamData?.banner || null;
        }

        const precomputedBanner = getBannerFromPrecomputed(row.team);
        const bannerText = `${precomputedBanner?.stage || ''} ${precomputedBanner?.sub || ''}`.trim();
        const isPostseasonFailBanner = /포스트시즌\s*진출\s*실패/.test(bannerText);

        if (clinchRange || precomputedBanner) {
            // rank -> col index (9->0 ... 1->8)
            let startRank = clinchRange?.startRank ?? 9;
            let endRank   = clinchRange?.endRank ?? startRank;

            if (isPostseasonFailBanner && startRank === 9 && endRank === startRank && currentRank >= 9) {
                endRank = 1;
            }

            const startIdx = rankToColIndex(startRank); // 9 -> 0
            const endIdx   = rankToColIndex(endRank);   // e.g., 3 -> 6
            const colspan  = (endIdx - startIdx + 1);

            // 1) 좌측 병합 배너 (precomputed 데이터 사용)
            if (precomputedBanner) {
                const crosses = (endRank <= 5);
                html += bannerTd({
                    teamColor,
                    colspan,
                    stage: precomputedBanner.stage,
                    sub: precomputedBanner.sub,
                    cls: precomputedBanner.type || 'banner-top',
                    crosses
                });
            } else {
                // 백업: 단순 확보 텍스트
                const crosses = (endRank <= 5);
                html += bannerTd({
                    teamColor,
                    colspan,
                    stage: `${endRank}위 확보`,
                    sub: null,
                    cls: 'banner-mid',
                    crosses
                });
            }

            // 2) 우측 개별 셀들 (clinchRank-1 ~ 1) - 연속 "불가"(y_tieOK===0, higher ranks) 구간 병합
            let ci = endIdx + 1;
            while (ci < ranks.length) {
                const rank = ranks[ci];
                const divider = (rank === 5) ? 'playoff-divider-left' : '';

                // 현재 랭크 기준으로 '상위'(더 좋은) 랭크에 대해 연속 불가 병합 처리
                const currentRank = currentRankMap.get(row.team) ?? getCurrentRank(row, matrixResults);
                const yVal = row[`y${rank}_tieOK`];

                if (rank < currentRank && yVal === 0) {
                    // 연속 불가 구간 시작: ci..cj-1
                    let cj = ci + 1;
                    while (cj < ranks.length) {
                        const r2 = ranks[cj];
                        const y2 = row[`y${r2}_tieOK`];
                        if (!(r2 < currentRank && y2 === 0)) break;
                        cj++;
                    }
                    // 병합 셀 생성: 가장 낮은(숫자 큰) 순위만 표기 (예: 2,1 병합 → 2위 불가)
                    const spanRanks = ranks.slice(ci, cj);
                    const colspan = cj - ci;
                    const dividerClass = (ranks[ci] === 5) ? 'playoff-divider-left' : '';
                    const lowestRank = Math.max(...spanRanks);
                    // 5위 이하 불가능인 경우 포스트시즌 진출 실패 문구 추가
                    const postSeasonText = (lowestRank >= 5) ? '<br><small style="font-size: 12px; font-weight: 700;">포스트시즌 진출 실패</small>' : '';
                    html += `<td class="magic-cell magic-impossible ${dividerClass}" colspan="${colspan}" style="border-color:${teamColor};">${lowestRank}위 불가${postSeasonText}</td>`;
                    ci = cj;
                    continue;
                }

                // 기본 단일 셀 렌더링
                const cellHtml = renderRankCell(row, rank, teamColor);
                if (divider) {
                    html += cellHtml.replace('<td class="matrix-cell', `<td class="matrix-cell ${divider}`);
                } else {
                    html += cellHtml;
                }
                ci++;
            }
        } else {
            // 배너가 없는 경우: 모든 셀 개별 렌더링 + 연속 불가 구간 병합
            let ci = 0;
            while (ci < ranks.length) {
                const rank = ranks[ci];
                const divider = (rank === 5) ? 'playoff-divider-left' : '';

                const currentRank = currentRankMap.get(row.team) ?? getCurrentRank(row, matrixResults);
                const yVal = row[`y${rank}_tieOK`];
                if (rank < currentRank && yVal === 0) {
                    let cj = ci + 1;
                    while (cj < ranks.length) {
                        const r2 = ranks[cj];
                        const y2 = row[`y${r2}_tieOK`];
                        if (!(r2 < currentRank && y2 === 0)) break;
                        cj++;
                    }
                    // 병합 셀 생성: 가장 낮은(숫자 큰) 순위만 표기 (예: 2,1 병합 → 2위 불가)
                    const spanRanks = ranks.slice(ci, cj);
                    const colspan = cj - ci;
                    const dividerClass = (ranks[ci] === 5) ? 'playoff-divider-left' : '';
                    const lowestRank = Math.max(...spanRanks);
                    // 5위 이하 불가능인 경우 포스트시즌 진출 실패 문구 추가
                    const postSeasonText = (lowestRank >= 5) ? '<br><small style="font-size: 12px; font-weight: 700;">포스트시즌 진출 실패</small>' : '';
                    html += `<td class="magic-cell magic-impossible ${dividerClass}" colspan="${colspan}" style="border-color:${teamColor};">${lowestRank}위 불가${postSeasonText}</td>`;
                    ci = cj;
                    continue;
                }

                const cellHtml = renderRankCell(row, rank, teamColor);
                if (divider) {
                    html += cellHtml.replace('<td class="matrix-cell', `<td class="matrix-cell ${divider}`);
                } else {
                    html += cellHtml;
                }
                ci++;
            }
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
