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
        
        return true;
    } catch (error) {
        return false;
    }
}

// 빠른 매트릭스 테이블 렌더링 (사전계산 데이터 기반)
function renderOptimizedMatrixTable() {
    if (!precomputedMatrixData || !precomputedMatrixData.precomputedMatrixResults) {
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
                    // 병합된 불가 구간: 가장 낮은(숫자 큰) 순위만 표기 (예: 2,1 병합 → 2위 불가)
                    const lowestRank = Math.max(...seg.map(s => s.rank));
                    label = `${lowestRank}위 불가`;
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

        // --- 10위 확정(포스트시즌 실패) 강제 병합 처리 ---
        // 조건: 모든 순위 셀 라벨이 '불가'이거나 클래스가 magic-impossible 이고,
        //       현재 순위가 10위이며(또는 배너/플래그로 10위 확정 표시) → 전체 병합 배너로 표기
        const allImpossible =
            Array.isArray(teamData.cells) &&
            teamData.cells.length > 0 &&
            teamData.cells.every(c =>
                ((c.label || '').includes('불가')) ||
                ((c.className || '').includes('magic-impossible'))
            );

        const bannerText = `${teamData.banner?.stage || ''} ${teamData.banner?.sub || ''}`;
        const isFixed10 =
            (teamData.currentRank === 10) &&
            (
                teamData.fixedRank === 10 ||
                /10위/.test(bannerText) ||
                teamData.isEliminated === true
            );

        const isPostseasonFailMentioned = /포스트시즌\s*진출\s*실패/.test(bannerText);

        if (allImpossible && (isFixed10 || isPostseasonFailMentioned)) {
            // 9~1 전 구간을 하나의 배너로 병합
            html += `<td class="banner-low" colspan="9" style="background: ${teamConfig.color};">`
                 + `포스트시즌 진출 실패`
                 + `<span class="banner-note">(정규시즌 10위 확정)</span>`
                 + `</td>`;
            html += '</tr>';
            continue; // 다음 팀으로
        }

        // 배너 또는 개별 셀 렌더링
        if (teamData.banner) {
            const allRanks = [9, 8, 7, 6, 5, 4, 3, 2, 1];

            // Heuristic: infer endRank (best secured rank) from banner text when explicit fields are missing
            function inferEndRankFromBanner(b) {
                const txt = `${b.stage || ''} ${b.sub || ''}`;
                // "정규시즌 n위 확정" or "n위 확정" or "n위 이상 확보"
                let m = txt.match(/([1-9])위\s*확정/);
                if (m) return Number(m[1]);
                m = txt.match(/정규시즌\s*([1-9])위\s*이상\s*확보/);
                if (m) return Number(m[1]);
                // by stage keywords
                if (/한국시리즈/.test(txt) || /정규시즌\s*1위/.test(txt)) return 1;
                if (/포스트시즌/.test(txt) && /진출/.test(txt)) return 2;     // 2위 확정
                if (/준\s*포스트시즌/.test(txt) && /진출/.test(txt)) return 3; // 3위 확정
                if (/와일드카드/.test(txt)) {
                    // sub에 4위/5위가 명시되면 그대로, 없으면 5위로 가정
                    m = txt.match(/([4-5])위/);
                    return m ? Number(m[1]) : 5;
                }
                return null;
            }

            // 1) 우선순위: 명시값(startRank/endRank/colspan) → 추론 → 안전 폴백
            const explicitStart = (teamData.banner.startRank != null) ? Number(teamData.banner.startRank) : null;
            const explicitEnd   = (teamData.banner.endRank != null) ? Number(teamData.banner.endRank) : null;
            let startRank = explicitStart ?? 9; // 왼쪽부터 시작
            let endRank   = explicitEnd ?? inferEndRankFromBanner(teamData.banner);

            // 일부 사전계산 JSON은 전체 colspan(=9)을 주는 케이스가 있어 보정
            if (endRank == null) {
                // skipRanks가 있으면 그 최소값을 end로 사용
                if (Array.isArray(teamData.banner.skipRanks) && teamData.banner.skipRanks.length) {
                    endRank = Math.min(...teamData.banner.skipRanks);
                }
            }
            // 여전히 없거나 잘못된 값이면 9로 막지 않도록 9~9만 병합
            if (endRank == null || endRank < 1 || endRank > 9) endRank = startRank;

            // colspan 계산 (rank는 9→1 내림): 9~endRank 포함
            const colspan = (teamData.banner.colspan && !explicitEnd && !explicitStart)
                ? Math.max(1, 9 - (endRank) + 1) // 주어진 colspan이 9라도 텍스트 기반으로 보정
                : (teamData.banner.colspan ?? (startRank - endRank + 1));

            const crosses = (endRank <= 5);
            const extraClass = crosses ? ' crosses-playoff' : '';
            const styleVars = crosses ? ` --colspan:${colspan}; --divider-offset-cols:4;` : '';

            for (const rank of allRanks) {
                // 병합 범위(예: 9~3) 안이면 9위 칸에서만 배너 한 번 렌더링
                if (rank <= startRank && rank >= endRank) {
                    if (rank === startRank) {
                        html += `<td class="${teamData.banner.type}${extraClass}" colspan="${colspan}" style="background: ${teamConfig.color};${styleVars}">`
                             + `${teamData.banner.stage}`
                             + (teamData.banner.sub ? `<span class="banner-note">(${teamData.banner.sub})</span>` : '')
                             + `</td>`;
                    }
                    continue; // 범위 내 나머지 칸은 건너뜀
                }

                // 범위 밖(예: 2,1위)은 개별 셀
                const cell = teamData.cells.find(c => c.rank === rank);
                if (cell) {
                    const dividerClass = cell.isPlayoffDivider ? 'playoff-divider-left' : '';
                    html += `<td class="magic-cell ${cell.className} ${dividerClass}">${cell.label}</td>`;
                }
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

}

// 빠른 초기화 함수 (사전계산 데이터 기반)
async function initOptimizedMagicMatrix() {
    
    const loaded = await loadPrecomputedMatrixData();
    if (loaded) {
        // 1) 일단 사전계산본을 그린 뒤…
        renderOptimizedMatrixTable();
        // 2) …정확한 Magic(strict)/Tragic(tieOK) 계산을 위해 클래식 계산기로 재계산/재렌더 (정확성 우선)
        if (typeof initMagicMatrix === 'function') {
            initMagicMatrix();
        }

        // 성능 정보 출력
        const { metadata, precomputedMatrixResults } = precomputedMatrixData;
    } else {
        
        // 폴백: 기존 방식 시도
        if (typeof initMagicMatrix === 'function') {
            initMagicMatrix();
        }
    }
}

// 데이터 새로고침 함수 (개발용)
async function refreshMatrixData() {
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