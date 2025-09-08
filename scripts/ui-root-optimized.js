/**
 * 루트 index.html 최적화된 UI 렌더링
 * 사전 계산된 JSON 데이터를 기반으로 빠른 렌더링
 */

// 전역 변수 - 사전계산 데이터 저장
let precomputedUIData = null;

// 사전계산 데이터 로드
async function loadPrecomputedUIData() {
    try {
        const response = await fetch('data/ui-precomputed-data.json');
        precomputedUIData = await response.json();
        
        console.log(`✅ 사전계산 UI 데이터 로드 완료 (${precomputedUIData.metadata.lastUpdated})`);
        return true;
    } catch (error) {
        console.error('❌ 사전계산 UI 데이터 로드 실패:', error);
        return false;
    }
}

// 팀 로고와 함께 팀명 렌더링 (사전계산 데이터 기반)
function getOptimizedTeamWithLogo(teamName) {
    if (!precomputedUIData || !precomputedUIData.teamConfigurations[teamName]) {
        return teamName; // 폴백
    }
    
    const teamConfig = precomputedUIData.teamConfigurations[teamName];
    return `<div class="team-info">
        <img src="${teamConfig.logo}" class="team-logo" alt="${teamConfig.logoAlt}" onerror="this.style.display='none'">
        <span class="team-name" style="color: ${teamConfig.color};">${teamName}</span>
    </div>`;
}

// 빠른 연승/연패 기록 렌더링 (사전계산 데이터 기반)
function renderOptimizedAllTeamsStreakRecords() {
    if (!precomputedUIData || !precomputedUIData.precomputedStreakAnalysis) {
        console.error('연승/연패 사전계산 데이터가 없습니다');
        return;
    }

    const { allTeamsStreakData, teamOrder, teamRankings } = precomputedUIData.precomputedStreakAnalysis;
    
    // 전체 팀의 최대 연승/연패 찾기 (사전계산됨)
    let globalMaxWinStreak = 0;
    let globalMaxLoseStreak = 0;
    
    Object.values(allTeamsStreakData).forEach(teamData => {
        if (teamData) {
            globalMaxWinStreak = Math.max(globalMaxWinStreak, teamData.maxWinStreak || 0);
            globalMaxLoseStreak = Math.max(globalMaxLoseStreak, teamData.maxLoseStreak || 0);
        }
    });
    
    const maxWinCols = Math.max(10, globalMaxWinStreak);
    const maxLoseCols = Math.max(10, globalMaxLoseStreak);
    
    const winColumns = Array.from({length: maxWinCols}, (_, i) => i + 1);
    const loseColumns = Array.from({length: maxLoseCols}, (_, i) => i + 1);
    
    let html = `
        <div class="table-scroll-wrapper">
            <table id="streakRecordsTable" class="streak-records-table sortable-table">
                <thead>
                    <tr class="main-header">
                        <th rowspan="2" class="sortable rank-header" data-column="rank">순위</th>
                        <th rowspan="2" class="team-header">팀명</th>
                        <th colspan="${maxWinCols}" class="section-header wins-section">🔥 연승 기록 (횟수)</th>
                        <th rowspan="2" class="sortable max-header wins-max" data-column="maxWins">최장<br>연승</th>
                        <th colspan="${maxLoseCols}" class="section-header losses-section">💧 연패 기록 (횟수)</th>
                        <th rowspan="2" class="sortable max-header losses-max" data-column="maxLosses">최장<br>연패</th>
                    </tr>
                    <tr class="sub-header">
                        ${winColumns.map(n => 
                            `<th class="sortable streak-count-header wins-count" data-column="wins${n}">${n}${n === 1 ? '승' : '연승'}</th>`
                        ).join('')}
                        ${loseColumns.map(n => 
                            `<th class="sortable streak-count-header losses-count" data-column="losses${n}">${n}${n === 1 ? '패' : '연패'}</th>`
                        ).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    // 사전 정렬된 팀 순서 사용
    teamOrder.forEach((team, index) => {
        const teamData = allTeamsStreakData[team];
        const rank = teamRankings[team] || 999;
        
        if (!teamData) {
            const totalCols = maxWinCols + 1 + maxLoseCols + 1;
            html += `
                <tr data-rank="${rank}" data-team="${team}" class="no-data-row">
                    <td class="rank-cell rank-${rank <= 3 ? rank : 'other'}">${rank}</td>
                    <td class="team-cell">${getOptimizedTeamWithLogo(team)}</td>
                    <td colspan="${totalCols}" class="no-data-cell">데이터 없음</td>
                </tr>
            `;
            return;
        }
        
        const { winStreaks, loseStreaks, maxWinStreak, maxLoseStreak } = teamData;
        
        html += `
            <tr class="${index % 2 === 0 ? 'even-row' : 'odd-row'}" 
                data-rank="${rank}" 
                data-team="${team}" 
                data-maxwins="${maxWinStreak}" 
                data-maxlosses="${maxLoseStreak}">
                <td class="rank-cell rank-${rank <= 3 ? rank : 'other'}">${rank}</td>
                <td class="team-cell">${getOptimizedTeamWithLogo(team)}</td>
        `;
        
        // 연승 데이터
        for (let i = 1; i <= maxWinCols; i++) {
            const count = winStreaks[i] || 0;
            html += `<td data-wins${i}="${count}" class="streak-count-cell wins-data ${count > 0 ? 'has-data' : 'no-data'}">${count > 0 ? count : '-'}</td>`;
        }
        
        // 최장 연승
        html += `<td class="max-streak-cell max-wins-cell" data-maxwins="${maxWinStreak}">${maxWinStreak}</td>`;
        
        // 연패 데이터
        for (let i = 1; i <= maxLoseCols; i++) {
            const count = loseStreaks[i] || 0;
            html += `<td data-losses${i}="${count}" class="streak-count-cell losses-data ${count > 0 ? 'has-data' : 'no-data'}">${count > 0 ? count : '-'}</td>`;
        }
        
        // 최장 연패
        html += `<td class="max-streak-cell max-losses-cell" data-maxlosses="${maxLoseStreak}">${maxLoseStreak}</td>
        </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // DOM 업데이트
    const container = document.getElementById('streakRecordsContent');
    if (container) {
        container.innerHTML = html;
    }

    console.log(`🎯 연승/연패 테이블 렌더링 완료 (${teamOrder.length}팀)`);
}

// 빠른 전후반기 성적 렌더링 (사전계산 데이터 기반)
function renderOptimizedHalfSeasonStats() {
    if (!precomputedUIData || !precomputedUIData.precomputedHalfSeasonStats) {
        console.error('전후반기 사전계산 데이터가 없습니다');
        return;
    }

    const { allTeamsHalfStats } = precomputedUIData.precomputedHalfSeasonStats;
    const { teamOrder, teamRankings } = precomputedUIData.precomputedStreakAnalysis;
    
    let html = `
        <div class="half-season-table-container">
            <table class="half-season-table">
                <thead>
                    <tr>
                        <th rowspan="2">순위</th>
                        <th rowspan="2">팀명</th>
                        <th colspan="4">전반기 (~ 7/12)</th>
                        <th colspan="4">후반기 (7/13 ~)</th>
                        <th rowspan="2">전후반기<br>승률차</th>
                    </tr>
                    <tr>
                        <th>승</th><th>패</th><th>경기</th><th>승률</th>
                        <th>승</th><th>패</th><th>경기</th><th>승률</th>
                    </tr>
                </thead>
                <tbody>
    `;

    teamOrder.forEach((team, index) => {
        const halfStats = allTeamsHalfStats[team];
        const rank = teamRankings[team] || 999;
        
        if (!halfStats) {
            html += `
                <tr class="no-data-row">
                    <td>${rank}</td>
                    <td>${getOptimizedTeamWithLogo(team)}</td>
                    <td colspan="9">데이터 없음</td>
                </tr>
            `;
            return;
        }
        
        const { firstHalf, secondHalf } = halfStats;
        const winRateDiff = (secondHalf.winRate - firstHalf.winRate).toFixed(3);
        const diffClass = winRateDiff > 0 ? 'positive' : winRateDiff < 0 ? 'negative' : 'neutral';
        
        html += `
            <tr class="${index % 2 === 0 ? 'even-row' : 'odd-row'}">
                <td class="rank-cell rank-${rank <= 3 ? rank : 'other'}">${rank}</td>
                <td class="team-cell">${getOptimizedTeamWithLogo(team)}</td>
                <td class="wins-cell">${firstHalf.wins}</td>
                <td class="losses-cell">${firstHalf.losses}</td>
                <td class="games-cell">${firstHalf.games}</td>
                <td class="winrate-cell">${firstHalf.winRate.toFixed(3)}</td>
                <td class="wins-cell">${secondHalf.wins}</td>
                <td class="losses-cell">${secondHalf.losses}</td>
                <td class="games-cell">${secondHalf.games}</td>
                <td class="winrate-cell">${secondHalf.winRate.toFixed(3)}</td>
                <td class="winrate-diff ${diffClass}">${winRateDiff > 0 ? '+' : ''}${winRateDiff}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // DOM 업데이트
    const halfSeasonContainer = document.getElementById('halfSeasonContent');
    if (halfSeasonContainer) {
        halfSeasonContainer.innerHTML = html;
    }

    console.log(`🎯 전후반기 테이블 렌더링 완료 (${teamOrder.length}팀)`);
}

// 빠른 초기화 함수 (사전계산 데이터 기반)
async function initOptimizedRootUI() {
    console.time('루트 UI 초기화 시간');
    
    const loaded = await loadPrecomputedUIData();
    if (loaded) {
        // 병렬 렌더링으로 성능 최적화
        await Promise.all([
            renderOptimizedAllTeamsStreakRecords(),
            renderOptimizedHalfSeasonStats()
        ]);
        
        console.timeEnd('루트 UI 초기화 시간');
        
        // 성능 정보 출력
        const { metadata } = precomputedUIData;
        console.log(`📊 루트 UI 성능 정보:
        - 데이터 버전: ${metadata.version}
        - 마지막 업데이트: ${metadata.lastUpdated}
        - 연승/연패 분석 팀: ${Object.keys(precomputedUIData.precomputedStreakAnalysis.allTeamsStreakData).length}
        - 전후반기 분석 팀: ${Object.keys(precomputedUIData.precomputedHalfSeasonStats.allTeamsHalfStats).length}`);
    } else {
        console.error('❌ 루트 UI 초기화 실패');
    }
}

// 데이터 새로고침 함수 (개발용)
async function refreshRootUIData() {
    console.log('🔄 루트 UI 데이터 새로고침...');
    precomputedUIData = null;
    await initOptimizedRootUI();
}

// 성능 비교 유틸리티
function rootUIPerformanceComparison() {
    if (!precomputedUIData) return;
    
    const stats = {
        precomputedDataSize: JSON.stringify(precomputedUIData).length,
        teamsWithStreakData: Object.keys(precomputedUIData.precomputedStreakAnalysis.allTeamsStreakData).length,
        teamsWithHalfSeasonData: Object.keys(precomputedUIData.precomputedHalfSeasonStats.allTeamsHalfStats).length,
        remainingGames: precomputedUIData.scheduleData.remainingGames.length,
        lastCalculated: precomputedUIData.metadata.lastUpdated
    };
    
    console.table(stats);
    return stats;
}

// 페이지 로드 시 자동 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptimizedRootUI);
} else {
    initOptimizedRootUI();
}

// 전역 함수로 노출 (개발/디버깅용)
window.refreshRootUIData = refreshRootUIData;
window.rootUIPerformanceComparison = rootUIPerformanceComparison;