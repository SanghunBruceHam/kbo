/**
 * KBO 매직/트래직 넘버 매트릭스 계산기
 * 1~9위 확정/탈락 매직·트래직 넘버 (잔여경기 R로 캡핑 표기)
 */

// 전역 변수
let matrixTeams = [];
let matrixResults = [];
let matrixCurrentRanksMap = new Map();
let matrixRemainingMap = new Map();
let matrixDrawsMap = new Map();

const RANKS = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const TEAM_NAME_MAP = {
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
const TEAM_COLORS = {
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

function getTeamColor(teamId) {
    return TEAM_COLORS[teamId] || '#1f2937';
}

function rankToColIndex(rank) {
    return 9 - rank;
}

function postSeasonFailNote(rank) {
    return rank >= 5
        ? '<br><small style="font-size: 12px; font-weight: 700;">포스트시즌 진출 실패</small>'
        : '';
}

// 유틸리티 함수
function calcR(team, season = 144) {
    return team.actualR || (season - (team.W + team.L + team.T));
}

function pNow(team) {
    const winsWeighted = team.W + 0.5 * (team.T ?? 0);
    const denom = team.W + team.L + (team.T ?? 0);
    return denom > 0 ? winsWeighted / denom : 0;
}

function pMax(team, R) {
    const draws = team.T ?? 0;
    const denom = team.W + team.L + draws + R;
    return denom > 0 ? (team.W + R + 0.5 * draws) / denom : 0;
}

function pMin(team, R) {
    const draws = team.T ?? 0;
    const denom = team.W + team.L + draws + R;
    return denom > 0 ? (team.W + 0.5 * draws) / denom : 0;
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function round3(x) {
    return Number(x.toFixed(3));
}

function bannerTd({teamColor, colspan, stage, sub, cls='banner-top', crosses=false}){
    const styleVars = crosses ? `--colspan:${colspan};--divider-offset-cols:4;` : '';
    return `<td class="${cls} ${crosses ? 'crosses-playoff' : ''}" colspan="${colspan}" style="background:${teamColor};${styleVars}">${stage}`
         + (sub ? `<span class="banner-note">(${sub})</span>` : '')
         + `</td>`;
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
    const draws = team.T ?? 0;
    const D = team.W + team.L + draws + R;

    // Magic
    const rhsMagic = Kk_max * D - (team.W + 0.5 * draws);
    const x_strict_raw = Math.max(0, Math.floor(rhsMagic) + 1);
    const x_tieOK_raw = Math.max(0, Math.ceil(rhsMagic));
    const x_strict = clamp(x_strict_raw, 0, R);
    const x_tieOK = clamp(x_tieOK_raw, 0, R);

    // Tragic
    const rhsTr = team.W + R + 0.5 * draws - Kk_min * D;
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

function evaluateRankOutcomes(row, currentRank) {
    let minClinchRank = null;
    let bestPossibleRank = currentRank;
    let worstPossibleRank = 9;
    let bestFound = false;
    let worstFound = false;

    for (let rank = 1; rank <= 9; rank++) {
        const xStrict = row[`x${rank}_strict`];
        const yTieOK = row[`y${rank}_tieOK`];

        if (minClinchRank === null && xStrict === 0) {
            minClinchRank = rank;
        }

        if (!bestFound && rank < currentRank && yTieOK > 0) {
            bestPossibleRank = rank;
            bestFound = true;
        }

        if (!worstFound && rank >= currentRank && xStrict === 0) {
            worstPossibleRank = rank;
            worstFound = true;
        }
    }

    return {
        minClinchRank,
        clinchRange: minClinchRank ? { startRank: 9, endRank: minClinchRank } : null,
        bestPossibleRank,
        worstPossibleRank
    };
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

        // playoffResults에서 남은 경기 및 무승부 정보 가져오기
        if (Array.isArray(data.playoffResults)) {
            matrixRemainingMap = new Map(data.playoffResults.map(r => [r.team, r.remainingGames]));
            matrixDrawsMap = new Map(data.playoffResults.map(r => [r.team, r.draws ?? 0]));
        } else {
            matrixRemainingMap = new Map();
            matrixDrawsMap = new Map();
        }

        // results 배열에서 정확한 순위와 승률 정보 가져오기
        if (Array.isArray(data.results)) {
            matrixTeams = data.results.map(r => {
                const drawsOverride = matrixDrawsMap.get(r.team);
                const draws = drawsOverride ?? r.draws ?? 0;
                return {
                    id: r.team,
                    team: r.team,
                    W: r.wins,
                    L: r.losses,
                    T: draws,
                    winPct: pNow({ W: r.wins, L: r.losses, T: draws }),
                    rank: r.rank
                };
            });
        } else {
            matrixTeams = [];
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

    let html = '<div class="matrix-table-container"><table class="magic-matrix-table">';

    // Header
    html += '<thead><tr>';
    html += '<th rowspan="2" class="matrix-team-col">구단</th>';
    html += '<th colspan="9" class="matrix-header-main">순위</th>';
    html += '</tr><tr>';
    for (const rank of RANKS) {
        const headerClass = (rank === 5) ? 'playoff-rank-header rank-cell' : 'rank-header rank-cell';
        html += `<th class="${headerClass}">${rank}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of matrixResults) {
        const currentRank = currentRankMap.get(row.team) ?? getCurrentRank(row, matrixResults);
        html += '<tr>';
        
        // 팀명 매핑
        const logoName = TEAM_NAME_MAP[row.team] || row.team.toLowerCase();
        const teamColor = getTeamColor(row.team);

        html += `<td class="matrix-team-info">
            <div class="matrix-team-name" style="color: ${teamColor};">
                <img src="images/teams/${logoName}.png" class="team-logo-small" alt="${row.team}" onerror="this.style.display='none'">
                <span style="font-weight: 800;">${row.team}</span>
            </div>
            <div class="matrix-team-status">현재 ${currentRank}위 · 잔여 ${row.R}경기</div>
        </td>`;

        function renderRankCell(row, rank, teamColor, currentRank, bestPossibleRank) {
            // Magic(strict) for rank >= currentRank, Tragic(tieOK) for rank < currentRank
            const xVal = row[`x${rank}_strict`];
            const yVal = row[`y${rank}_tieOK`];
            const anyBetterPossible = rank > 1 && bestPossibleRank < rank;
            // 5위 구분선 클래스 추가
            const dividerClass = (rank === 5) ? ' playoff-divider-left' : '';

            if (rank < currentRank) {
                // Tragic side
                if (yVal === 0) {
                    return `<td class="magic-cell magic-impossible${dividerClass}">${rank}위 불가${postSeasonFailNote(rank)}</td>`;
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

        const rankAnalysis = evaluateRankOutcomes(row, currentRank);
        const { minClinchRank, clinchRange, bestPossibleRank, worstPossibleRank } = rankAnalysis;
        let finalRankLocked = (bestPossibleRank === currentRank) && (worstPossibleRank === currentRank);
        let lockedRankTarget = currentRank;

        const isTenthPlaceLocked = currentRank === 10 && row[`y9_tieOK`] === 0;

        if (isTenthPlaceLocked) {
            html += `<td class="banner-low" colspan="9" style="background: ${teamColor};">`
                 + `포스트시즌 진출 실패`
                 + `<span class="banner-note">(정규시즌 10위 확정)</span>`
                 + `</td>`;
            html += '</tr>';
            continue;
        }

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
        const finalRankMatch = bannerText.match(/(\d+)위\s*확정/);
        if (finalRankMatch) {
            const parsedRank = Number(finalRankMatch[1]);
            if (!Number.isNaN(parsedRank) && parsedRank === currentRank) {
                finalRankLocked = true;
                lockedRankTarget = parsedRank;
            }
        }

        let effectiveRange = clinchRange;
        if (finalRankLocked) {
            effectiveRange = { startRank: 9, endRank: 1 };
        }

        if (effectiveRange || precomputedBanner) {
            // rank -> col index (9->0 ... 1->8)
            let startRank = effectiveRange?.startRank ?? 9;
            let endRank   = effectiveRange?.endRank ?? startRank;

            if (!finalRankLocked && isPostseasonFailBanner && startRank === 9 && endRank === startRank && currentRank >= 9) {
                endRank = 1;
            }

            const startIdx = rankToColIndex(startRank); // 9 -> 0
            const endIdx   = rankToColIndex(endRank);   // e.g., 3 -> 6
            const computedColspan  = (endIdx - startIdx + 1);
            const precomputedColspan = Number.isFinite(Number(precomputedBanner?.colspan))
                ? Number(precomputedBanner.colspan)
                : null;
            let colspan;
            const maxColspan = RANKS.length - startIdx;
            if (finalRankLocked) {
                colspan = Math.min(9, maxColspan);
            } else {
                const limited = Math.min(computedColspan, maxColspan);
                if (precomputedColspan) {
                    colspan = Math.min(precomputedColspan, limited);
                } else {
                    colspan = limited;
                }
            }
            const coverageEndIdx = startIdx + colspan - 1;

            let bannerStage = precomputedBanner?.stage;
            let bannerSub = precomputedBanner?.sub ?? null;
            let bannerType = precomputedBanner?.type || 'banner-mid';

            if (finalRankLocked) {
                const isPlayoffTeam = lockedRankTarget <= 5;
                if (precomputedBanner) {
                    bannerType = precomputedBanner.type || (isPlayoffTeam ? 'banner-top' : 'banner-low');
                    if (!bannerStage) {
                        bannerStage = isPlayoffTeam ? `${lockedRankTarget}위 확정` : '포스트시즌 진출 실패';
                    }
                    if (!bannerSub || /10위 확정/.test(bannerSub)) {
                        bannerSub = `정규시즌 ${lockedRankTarget}위 확정`;
                    }
                } else {
                    bannerType = isPlayoffTeam ? 'banner-top' : 'banner-low';
                    bannerStage = isPlayoffTeam
                        ? `${lockedRankTarget}위 확정`
                        : '포스트시즌 진출 실패';
                    bannerSub = `정규시즌 ${lockedRankTarget}위 확정`;
                }
            } else if (bannerSub && /10위 확정/.test(bannerSub) && currentRank !== 10) {
                // 사전 데이터 불일치 보정
                bannerSub = `정규시즌 ${currentRank}위 확정`;
            }

            // 1) 좌측 병합 배너 (precomputed 데이터 사용)
            if (precomputedBanner) {
                const crosses = (endRank <= 5);
                html += bannerTd({
                    teamColor,
                    colspan,
                    stage: bannerStage ?? `${endRank}위 확보`,
                    sub: bannerSub,
                    cls: bannerType,
                    crosses
                });
            } else {
                const crosses = (endRank <= 5);
                if (finalRankLocked) {
                    const isPlayoffTeam = lockedRankTarget <= 5;
                    html += bannerTd({
                        teamColor,
                        colspan,
                        stage: isPlayoffTeam ? `${lockedRankTarget}위 확정` : '포스트시즌 진출 실패',
                        sub: `정규시즌 ${lockedRankTarget}위 확정`,
                        cls: isPlayoffTeam ? 'banner-top' : 'banner-low',
                        crosses
                    });
                } else {
                    // 백업: 단순 확보 텍스트
                    html += bannerTd({
                        teamColor,
                        colspan,
                        stage: `${endRank}위 확보`,
                        sub: null,
                        cls: 'banner-mid',
                        crosses
                    });
                }
            }

            // 2) 우측 개별 셀들 (clinchRank-1 ~ 1) - 연속 "불가"(y_tieOK===0, higher ranks) 구간 병합
            let ci = coverageEndIdx + 1;
            while (ci < RANKS.length) {
                const rank = RANKS[ci];
                const divider = (rank === 5) ? 'playoff-divider-left' : '';

                // 현재 랭크 기준으로 '상위'(더 좋은) 랭크에 대해 연속 불가 병합 처리
                const yVal = row[`y${rank}_tieOK`];

                if (rank < currentRank && yVal === 0) {
                    // 연속 불가 구간 시작: ci..cj-1
                    let cj = ci + 1;
                    while (cj < RANKS.length) {
                        const r2 = RANKS[cj];
                        const y2 = row[`y${r2}_tieOK`];
                        if (!(r2 < currentRank && y2 === 0)) break;
                        cj++;
                    }
                    // 병합 셀 생성: 가장 낮은(숫자 큰) 순위만 표기 (예: 2,1 병합 → 2위 불가)
                    const spanRanks = RANKS.slice(ci, cj);
                    const colspan = cj - ci;
                    const dividerClass = (RANKS[ci] === 5) ? 'playoff-divider-left' : '';
                    const lowestRank = Math.max(...spanRanks);
                    html += `<td class="magic-cell magic-impossible ${dividerClass}" colspan="${colspan}" style="border-color:${teamColor};">${lowestRank}위 불가${postSeasonFailNote(lowestRank)}</td>`;
                    ci = cj;
                    continue;
                }

                // 기본 단일 셀 렌더링
                const cellHtml = renderRankCell(row, rank, teamColor, currentRank, bestPossibleRank);
                if (divider) {
                    html += cellHtml.replace('<td class="magic-cell', `<td class="magic-cell ${divider}`);
                } else {
                    html += cellHtml;
                }
                ci++;
            }
        } else {
            // 배너가 없는 경우: 모든 셀 개별 렌더링 + 연속 불가 구간 병합
            let ci = 0;
            while (ci < RANKS.length) {
                const rank = RANKS[ci];
                const divider = (rank === 5) ? 'playoff-divider-left' : '';

                const yVal = row[`y${rank}_tieOK`];
                if (rank < currentRank && yVal === 0) {
                    let cj = ci + 1;
                    while (cj < RANKS.length) {
                        const r2 = RANKS[cj];
                        const y2 = row[`y${r2}_tieOK`];
                        if (!(r2 < currentRank && y2 === 0)) break;
                        cj++;
                    }
                    // 병합 셀 생성: 가장 낮은(숫자 큰) 순위만 표기 (예: 2,1 병합 → 2위 불가)
                    const spanRanks = RANKS.slice(ci, cj);
                    const colspan = cj - ci;
                    const dividerClass = (RANKS[ci] === 5) ? 'playoff-divider-left' : '';
                    const lowestRank = Math.max(...spanRanks);
                    html += `<td class="magic-cell magic-impossible ${dividerClass}" colspan="${colspan}" style="border-color:${teamColor};">${lowestRank}위 불가${postSeasonFailNote(lowestRank)}</td>`;
                    ci = cj;
                    continue;
                }

                const cellHtml = renderRankCell(row, rank, teamColor, currentRank, bestPossibleRank);
                if (divider) {
                    html += cellHtml.replace('<td class="magic-cell', `<td class="magic-cell ${divider}`);
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
