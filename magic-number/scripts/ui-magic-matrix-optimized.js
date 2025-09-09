/**
 * 매직넘버 매트릭스 최적화된 UI 렌더링
 * 사전 계산된 JSON 데이터를 기반으로 빠른 렌더링
 */

// 전역 변수 - 사전계산 데이터 저장
let precomputedMatrixData = null;

// 사전계산 데이터 로드
async function loadPrecomputedMatrixData() {
    try {
        const response = await fetch('data/ui-magic-matrix-precomputed.json');
        precomputedMatrixData = await response.json();
        
        console.log(`✅ 사전계산 매트릭스 데이터 로드 완료 (${precomputedMatrixData.metadata.lastUpdated})`);
        return true;
    } catch (error) {
        console.error('❌ 사전계산 매트릭스 데이터 로드 실패:', error);
        return false;
    }
}

// 빠른 매트릭스 테이블 렌더링 (사전계산 데이터 기반)
function renderOptimizedMatrixTable() {
    if (!precomputedMatrixData || !precomputedMatrixData.precomputedMatrixResults) {
        console.error('사전계산 데이터가 없습니다');
        return;
    }

    const { matrixData, currentRankMap } = precomputedMatrixData.precomputedMatrixResults;
    const { teamConfigurations } = precomputedMatrixData;
    const { ranks } = precomputedMatrixData.matrixTableStructure;

    let html = '<div class="matrix-table-container"><table class="magic-matrix-table">';

    // Header 렌더링 (정적 데이터)
    html += '<thead><tr>';
    html += '<th rowspan="2" class="matrix-team-col">구단</th>';
    html += '<th colspan="9" class="matrix-header-main">순위</th>';
    html += '</tr><tr>';
    
    for (const rank of ranks) {
        const headerClass = (rank === 5) ? 'playoff-rank-header rank-cell' : 'rank-header rank-cell';
        html += `<th class="${headerClass}">${rank}</th>`;
    }
    html += '</tr></thead><tbody>';

    // 연속된 "확보"/"불가" 구간을 하나의 셀로 병합하는 헬퍼
    function mergeMergeableSegments(cells) {
        const out = [];
        let i = 0;
        const isMergeable = (c) => {
            const t = (c.label || '').trim();
            return t.includes('확보') || t.includes('불가');
        };
        while (i < cells.length) {
            const c = cells[i];
            if (!isMergeable(c)) {
                out.push({ ...c, colspan: 1 });
                i += 1;
                continue;
            }
            const cls = c.className;
            let j = i + 1;
            while (j < cells.length && isMergeable(cells[j]) && cells[j].className === cls) {
                j += 1;
            }
            // i..j-1 구간 병합
            const seg = cells.slice(i, j);
            const startRank = seg[0].rank;            // 예: 9 → 1 순서
            const endRank = seg[seg.length - 1].rank; // 예: 8, 7, ...
            // --- Begin: explicit label logic replacement ---
            const lo = Math.min(startRank, endRank);
            const hi = Math.max(startRank, endRank);
            const statusLabel = (c.label.includes('확보') ? '확보' : '불가');

            const MIN_RANK = Math.min(...ranks);
            const MAX_RANK = Math.max(...ranks);
            const span = seg.length;

            let label;
            if (statusLabel === '확보') {
                // ✅ 요구사항: 병합된 경우만 "높은 순위 확보" 표기, 단일 칸은 "{순위}위 확보"
                if (span === 1) {
                    // 일부 데이터가 "확보"만 담겨 오는 경우 방어적으로 순위를 붙여준다
                    const raw = (c.label || '').trim();
                    const hasRankWord = /위/.test(raw);
                    label = hasRankWord ? raw : `${c.rank}위 확보`;
                } else {
                    // 2셀 이상 연속 확보 구간 → 더 좋은(작은) 순위를 기준으로 "{lo}위 확보"
                    label = `${lo}위 확보`;
                }
            } else { // 불가
                if (span === 1) {
                    const raw = (c.label || '').trim();
                    const hasRankWord = /위/.test(raw);
                    label = hasRankWord ? raw : `${c.rank}위 불가`;
                } else {
                    // 상단 연속 구간: 최상단 경계만 표기 → "{hi}위 불가"
                    if (lo === MIN_RANK) {
                        label = `${hi}위 불가`;
                    // 하단 연속 구간: "{lo}위 이하 불가"
                    } else if (hi === MAX_RANK) {
                        label = `${lo}위 이하 불가`;
                    } else {
                        // 중간 구간은 상한(더 나쁜 순위) 기준으로 요약
                        label = `${hi}위 불가`;
                    }
                }
            }
            // --- End: explicit label logic replacement ---
            const hasDivider = seg.some(s => s.isPlayoffDivider);
            out.push({
                rank: startRank,
                label,
                className: cls,
                isPlayoffDivider: hasDivider,
                colspan: seg.length
            });
            i = j;
        }
        return out;
    }

    // 각 팀별 행 렌더링 (사전계산 데이터 사용)
    for (const teamData of matrixData) {
        const teamConfig = teamConfigurations[teamData.team];
        if (!teamConfig) continue;

        html += '<tr>';
        
        // 팀 정보 셀
        html += `<td class="matrix-team-info">
            <div class="matrix-team-name" data-team-color="${teamConfig.color}">
                <img src="images/teams/${teamConfig.logoName}.png" class="team-logo-small" alt="${teamData.team}" onerror="this.style.display='none'">
                <span class="matrix-team-name-text">${teamData.team}</span>
            </div>
            <div class="matrix-team-status">현재 ${teamData.currentRank}위 · 잔여 ${teamData.remainingGames}경기</div>
        </td>`;

        // 배너 또는 개별 셀 렌더링
        if (teamData.banner) {
            // 5위 부분 배너 처리 - 테이블 순서대로 렌더링
            if (teamData.banner.skipRanks) {
                // 테이블 순서: [9][8][7][6][5][4][3][2][1]
                const ranks = [9, 8, 7, 6, 5, 4, 3, 2, 1];
                
                for (const rank of ranks) {
                    if (teamData.banner.skipRanks.includes(rank)) {
                        // 배너 영역: 9위 위치에만 배너 렌더링 (colspan=5로 9~5 덮음)
                        if (rank === 9) {
                            html += `<td class="${teamData.banner.type}" colspan="${teamData.banner.colspan}" style="background: ${teamConfig.color};">
                                ${teamData.banner.stage}
                                <span class="banner-note">(${teamData.banner.sub})</span>
                            </td>`;
                        }
                        // 8,7,6,5위는 배너에 포함되어 건너뜀
                    } else {
                        // 1-4위: 개별 셀 렌더링 + 연속 구간 병합 (확보/불가)
                        const cell = teamData.cells.find(c => c.rank === rank);
                        if (cell) {
                            const dividerClass = cell.isPlayoffDivider ? 'playoff-divider-left' : '';
                            html += `<td class="magic-cell ${cell.className} ${dividerClass}">${cell.label}</td>`;
                        }
                    }
                }
            } else {
                // 전체 배너 렌더링
                html += `<td class="${teamData.banner.type}" colspan="${teamData.banner.colspan}" style="background: ${teamConfig.color};">
                    ${teamData.banner.stage}
                    <span class="banner-note">(${teamData.banner.sub})</span>
                </td>`;
            }
        } else {
            // 개별 셀 렌더링 + 연속 구간 병합 (확보/불가)
            const merged = mergeMergeableSegments(teamData.cells);
            for (const cell of merged) {
                const dividerClass = cell.isPlayoffDivider ? 'playoff-divider-left' : '';
                const colspanAttr = cell.colspan && cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '';
                html += `<td class="magic-cell ${cell.className} ${dividerClass}"${colspanAttr}>${cell.label}</td>`;
            }
        }

        html += '</tr>';
    }

    html += '</tbody></table></div>';
    
    // DOM 업데이트
    const container = document.getElementById('magicMatrixContent');
    if (container) {
        container.innerHTML = html;
    }

    console.log(`🎯 매트릭스 테이블 렌더링 완료 (${matrixData.length}팀)`);
}

// 빠른 초기화 함수 (사전계산 데이터 기반)
async function initOptimizedMagicMatrix() {
    console.time('매트릭스 초기화 시간');
    
    const loaded = await loadPrecomputedMatrixData();
    if (loaded) {
        renderOptimizedMatrixTable();
        console.timeEnd('매트릭스 초기화 시간');
        
        // 성능 정보 출력
        const { metadata, precomputedMatrixResults } = precomputedMatrixData;
        console.log(`📊 성능 정보:
        - 데이터 버전: ${metadata.version}
        - 마지막 계산: ${metadata.lastUpdated}
        - 처리된 팀 수: ${precomputedMatrixResults.matrixData.length}
        - 배너 상태 팀: ${precomputedMatrixResults.matrixData.filter(t => t.banner).length}`);
    } else {
        console.error('❌ 매트릭스 초기화 실패');
        
        // 폴백: 기존 방식 시도
        if (typeof initMagicMatrix === 'function') {
            console.log('🔄 기존 방식으로 폴백...');
            initMagicMatrix();
        }
    }
}

// 데이터 새로고침 함수 (개발용)
async function refreshMatrixData() {
    console.log('🔄 매트릭스 데이터 새로고침...');
    precomputedMatrixData = null;
    await initOptimizedMagicMatrix();
}

// 성능 비교 유틸리티
function performanceComparison() {
    if (!precomputedMatrixData) return;
    
    const stats = {
        precomputedDataSize: JSON.stringify(precomputedMatrixData).length,
        totalTeams: precomputedMatrixData.precomputedMatrixResults.matrixData.length,
        bannerTeams: precomputedMatrixData.precomputedMatrixResults.matrixData.filter(t => t.banner).length,
        cellularTeams: precomputedMatrixData.precomputedMatrixResults.matrixData.filter(t => !t.banner).length,
        lastCalculated: precomputedMatrixData.metadata.lastUpdated
    };
    
    console.table(stats);
    return stats;
}

// 페이지 로드 시 자동 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptimizedMagicMatrix);
} else {
    initOptimizedMagicMatrix();
}

// 전역 함수로 노출 (개발/디버깅용)
window.refreshMatrixData = refreshMatrixData;
window.performanceComparison = performanceComparison;