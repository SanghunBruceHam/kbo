#!/usr/bin/env node

/**
 * 매직넘버 매트릭스 계산 로직을 JSON으로 사전 계산하는 스크립트
 * ui-magic-matrix.js의 복잡한 계산 로직을 미리 처리
 */

const fs = require('fs');
const path = require('path');

// 기존 매직넘버 데이터 로드
function loadMagicNumberData() {
    try {
        const calcMagicNumbers = JSON.parse(fs.readFileSync('magic-number/data/calc-magic-numbers.json', 'utf8'));
        return calcMagicNumbers;
    } catch (error) {
        console.error('매직넘버 데이터 로드 실패:', error.message);
        return null;
    }
}

// 유틸리티 함수들 (ui-magic-matrix.js에서 포팅)
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

// 현재 순위 맵 구축
function buildCurrentRankMap(results) {
    const sorted = [...results].sort((a, b) => b.winPct - a.winPct);
    const m = new Map();
    sorted.forEach((r, idx) => m.set(r.team, idx + 1));
    return m;
}

// 팀 벤치마크 사전 계산
function precomputeTeamBenchmarks(teams, matrixRemainingMap, season = 144) {
    const map = new Map();
    for (const i of teams) {
        const maxList = [], minList = [];
        for (const t of teams) {
            if (t.id === i.id) continue;
            const R = matrixRemainingMap.has(t.id) ? matrixRemainingMap.get(t.id) : calcR(t, season);
            maxList.push(pMax(t, R));
            minList.push(pMin(t, R));
        }
        maxList.sort((a, b) => b - a);
        minList.sort((a, b) => b - a);
        map.set(i.id, { maxSorted: maxList, minSorted: minList });
    }
    return map;
}

function kthFromPre(preMap, id, k) {
    const e = preMap.get(id);
    return {
        Kk_max: (e?.maxSorted?.[k - 1]) ?? 0,
        Kk_min: (e?.minSorted?.[k - 1]) ?? 0
    };
}

// 매직/트래직 넘버 계산
function magicTragicForK(team, season, Kk_max, Kk_min, matrixRemainingMap) {
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

// 전체 매직/트래직 계산
function kboMagicTragicRanksAll(teams, matrixRemainingMap, matrixCurrentRanksMap, season = 144) {
    const ks = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const preMap = precomputeTeamBenchmarks(teams, matrixRemainingMap, season);
    
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
            const r = magicTragicForK(team, season, Kk_max, Kk_min, matrixRemainingMap);
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

// 셀 레이블과 클래스 결정
function cellLabelAndClass({ rank, currentRank, x, y, xraw, R }) {
    // 불가(Tragic) 우선 처리: 어떤 경우든 해당 순위를 달성할 수 없다면 명확히 표기
    if (y === 0) {
        return { label: `${rank}위 불가`, cls: 'magic-impossible' };
    }

    // 자기 한계(잔여 경기로 충족 불가) 처리
    if (rank === currentRank && xraw > R) {
        return { label: String(R), cls: 'magic-selflimit' };
    }

    // 확보(Magic) 처리: 해당 순위를 이미 확보했다면 순위를 포함해 명확히 표기
    if (x === 0) {
        return { label: `${rank}위 확보`, cls: 'magic-confirmed' };
    }

    // 그 외: 기본적으로 매직넘버(필요 승수)를 숫자로 표기
    // 이전 로직에서 rank < currentRank 인 경우 y(트래직)를 노출했으나,
    // 사용자 의도에 맞춰 매트릭스의 일관성을 위해 기본은 매직 숫자를 유지한다.
    return { label: String(x), cls: 'magic-safe' };
}

// 배너 상태 분석
function analyzeBannerStatus(row, currentRank) {
    const x1Raw = row.x1_strict_raw;
    const x2Raw = row.x2_strict_raw;
    const x3Raw = row.x3_strict_raw;
    const x4Raw = row.x4_strict_raw;
    const x5Raw = row.x5_strict_raw;
    const x6Raw = row.x6_strict_raw;
    const x7Raw = row.x7_strict_raw;
    const x8Raw = row.x8_strict_raw;
    const x9Raw = row.x9_strict_raw;

    const y1Raw = row.y1_tieOK_raw;
    const y2Raw = row.y2_tieOK_raw;
    const y3Raw = row.y3_tieOK_raw;
    const y4Raw = row.y4_tieOK_raw;
    const y5Raw = row.y5_tieOK_raw;
    const y6Raw = row.y6_tieOK_raw;
    const y7Raw = row.y7_tieOK_raw;
    const y8Raw = row.y8_tieOK_raw;
    const y9Raw = row.y9_tieOK_raw;

    // 10위 확정 (정확)
    if (y9Raw <= 0) {
        return { type: 'banner-low', stage: '포스트시즌 진출 실패', sub: '정규시즌 10위 확정', colspan: 9 };
    }
    
    // 1위 확정 (정확)
    if (x1Raw <= 0) {
        return { type: 'banner-top', stage: '한국시리즈 진출 확보', sub: '정규시즌 1위 확정', colspan: 9 };
    }

    // 2위 처리
    if (x2Raw <= 0 && x1Raw > 0) {
        if (y1Raw <= 0) {
            return { type: 'banner-top', stage: '플레이오프 직행 확보', sub: '정규시즌 2위 확정', colspan: 9 };
        } else {
            return { type: 'banner-top', stage: '플레이오프 직행 확보', sub: '정규시즌 2위 이상 확보', colspan: 9 };
        }
    }

    // 3위 처리
    if (x3Raw <= 0 && x2Raw > 0) {
        if (y2Raw <= 0) {
            return { type: 'banner-top', stage: '준 플레이오프 진출 확보', sub: '정규시즌 3위 확정', colspan: 9 };
        } else {
            return { type: 'banner-top', stage: '준 플레이오프 진출 확보', sub: '정규시즌 3위 이상 확보', colspan: 9 };
        }
    }

    // 4위 처리
    if (x4Raw <= 0 && x3Raw > 0) {
        if (y3Raw <= 0) {
            return { type: 'banner-mid', stage: '와일드카드 결정전 진출 확보', sub: '정규시즌 4위 확정', colspan: 9 };
        } else {
            return { type: 'banner-mid', stage: '와일드카드 결정전 진출 확보', sub: '정규시즌 4위 이상 확보', colspan: 9 };
        }
    }

    // 5위 처리 - 기존 로직 그대로: 9~5 컬럼만 배너, 1~4는 개별 셀
    if (x5Raw <= 0) {
        if (y4Raw <= 0) {
            return { type: 'banner-top', stage: '와일드카드 결정전 진출 확보', sub: '정규시즌 5위 확정', colspan: 5, skipRanks: [9,8,7,6,5] };
        } else {
            return { type: 'banner-top', stage: '와일드카드 결정전 진출 확보', sub: '정규시즌 5위 이상 확보', colspan: 5, skipRanks: [9,8,7,6,5] };
        }
    }

    // 하위권 확정
    if (x6Raw <= 0 && y5Raw <= 0) {
        return { type: 'banner-low', stage: '포스트시즌 진출 실패', sub: '정규시즌 6위 확정', colspan: 9 };
    }
    if (x7Raw <= 0 && y6Raw <= 0) {
        return { type: 'banner-low', stage: '포스트시즌 진출 실패', sub: '정규시즌 7위 확정', colspan: 9 };
    }
    if (x8Raw <= 0 && y7Raw <= 0) {
        return { type: 'banner-low', stage: '포스트시즌 진출 실패', sub: '정규시즌 8위 확정', colspan: 9 };
    }
    if (x9Raw <= 0 && y8Raw <= 0) {
        return { type: 'banner-low', stage: '포스트시즌 진출 실패', sub: '정규시즌 9위 확정', colspan: 9 };
    }

    return null; // 일반 셀 렌더링
}

// 메인 실행 함수
function generateMagicMatrixPrecomputed() {
    console.log('🔄 매직넘버 매트릭스 사전 계산 시작...');
    
    const data = loadMagicNumberData();
    if (!data) {
        console.error('❌ 매직넘버 데이터를 로드할 수 없습니다.');
        process.exit(1);
    }

    // 데이터 변환
    const matrixTeams = Array.isArray(data.playoffResults) ? 
        data.playoffResults.map(r => ({
            id: r.team,
            W: r.wins,
            L: r.losses,
            T: r.draws ?? 0
        })) : [];

    const matrixRemainingMap = Array.isArray(data.playoffResults) ? 
        new Map(data.playoffResults.map(r => [r.team, r.remainingGames])) : new Map();

    const matrixCurrentRanksMap = Array.isArray(data.results) ? 
        new Map(data.results.map(r => [r.team, r.rank])) : new Map();

    console.log(`📊 분석 대상 팀 수: ${matrixTeams.length}`);

    // 매직넘버 계산 실행
    const matrixResults = kboMagicTragicRanksAll(matrixTeams, matrixRemainingMap, matrixCurrentRanksMap, 144);
    const currentRankMap = buildCurrentRankMap(matrixResults);

    console.log('📊 매트릭스 결과 계산 완료');

    // 각 팀별 렌더링 데이터 사전 계산
    const precomputedRenderData = matrixResults.map(row => {
        const currentRank = currentRankMap.get(row.team) ?? 999;
        const bannerStatus = analyzeBannerStatus(row, currentRank);

        // 개별 셀 데이터 계산 (항상 생성, 부분 배너 지원)
        const cellData = [];
        const ranks = [9, 8, 7, 6, 5, 4, 3, 2, 1];
        for (const rank of ranks) {
            const x = row[`x${rank}_strict`];
            const y = (rank === 1 || rank === 5) ? row[`y${rank}_tieOK_raw`] : row[`y${rank}_strict_raw`]; // 1위와 5위는 tie okay, 나머지는 strict 사용
            const xraw = row[`x${rank}_strict_raw`];
            const R = row.R;

            const cellInfo = cellLabelAndClass({ rank, currentRank, x, y, xraw, R });
            cellData.push({
                rank,
                label: cellInfo.label,
                className: cellInfo.cls,
                isPlayoffDivider: rank === 5
            });
        }

        return {
            team: row.team,
            currentRank,
            remainingGames: row.R,
            winPct: row.winPct,
            banner: bannerStatus,
            cells: cellData
        };
    });

    // 팀 설정 데이터
    const teamConfigurations = {
        "LG": { "color": "#C30452", "logoName": "lg" },
        "한화": { "color": "#FF6600", "logoName": "hanwha" },
        "SSG": { "color": "#CE0E2D", "logoName": "ssg" },
        "삼성": { "color": "#074CA1", "logoName": "samsung" },
        "KT": { "color": "#000000", "logoName": "kt" },
        "롯데": { "color": "#002955", "logoName": "lotte" },
        "NC": { "color": "#1D467A", "logoName": "nc" },
        "KIA": { "color": "#EA0029", "logoName": "kia" },
        "두산": { "color": "#131230", "logoName": "doosan" },
        "키움": { "color": "#820024", "logoName": "kiwoom" }
    };

    // 최종 결과 구성
    const result = {
        metadata: {
            lastUpdated: new Date().toISOString(),
            version: "1.0.0",
            description: "매직넘버 매트릭스 사전 계산된 UI 데이터",
            source: "ui-magic-matrix.js 로직에서 추출"
        },
        teamConfigurations,
        precomputedMatrixResults: {
            matrixData: precomputedRenderData,
            rawCalculationData: matrixResults,
            currentRankMap: Object.fromEntries(currentRankMap),
            lastCalculated: new Date().toISOString()
        },
        matrixTableStructure: {
            ranks: [9, 8, 7, 6, 5, 4, 3, 2, 1],
            cellTypes: {
                "magic-confirmed": { description: "확보", priority: 1 },
                "magic-safe": { description: "매직넘버", priority: 2 },
                "magic-warning": { description: "주의", priority: 3 },
                "magic-danger": { description: "위험", priority: 4 },
                "magic-impossible": { description: "불가능", priority: 5 },
                "magic-selflimit": { description: "잔여경기 제한", priority: 6 }
            },
            bannerTypes: {
                "banner-top": { priority: 1, context: "상위권 확정" },
                "banner-mid": { priority: 2, context: "중위권 확정" },
                "banner-low": { priority: 3, context: "하위권 확정" }
            }
        },
        calculationConstants: {
            season: 144,
            ranks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
            playoffCutoff: 5,
            allStarBreak: "2025-07-12"
        }
    };

    // 파일 저장
    const outputPath = 'magic-number/data/ui-magic-matrix-precomputed.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log('✅ 매직넘버 매트릭스 사전 계산 완료');
    console.log(`📁 저장 위치: ${outputPath}`);
    console.log(`📊 계산된 팀 수: ${precomputedRenderData.length}`);
    console.log(`🎯 배너 상태 팀 수: ${precomputedRenderData.filter(r => r.banner).length}`);
}

// 실행
if (require.main === module) {
    generateMagicMatrixPrecomputed();
}

module.exports = { generateMagicMatrixPrecomputed };
