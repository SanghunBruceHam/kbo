// =============================================================================
// 전역 유틸리티 함수들 (먼저 정의)
// =============================================================================

/**
 * 📅 마지막 완료 경기 날짜 찾기
 * @param {Array} seasonData - 전체 시즌 데이터
 * @returns {string} 마지막 완료 경기 날짜 (YYYY-MM-DD)
 */
function findLastCompletedGameDate(seasonData) {
    let lastCompletedDate = null;

    // 역순으로 검색하여 가장 최근 완료 경기 찾기
    for (let i = seasonData.length - 1; i >= 0; i--) {
        const dayData = seasonData[i];
        if (dayData && dayData.standings && dayData.standings.length > 0) {
            // 이전 날짜와 비교하여 승수나 패수가 증가한 팀이 있는지 확인
            if (i > 0) {
                const prevDayData = seasonData[i - 1];
                if (prevDayData && prevDayData.standings) {
                    const hasGameResults = dayData.standings.some(team => {
                        const prevTeam = prevDayData.standings.find(p => p.team === team.team);
                        return prevTeam && (team.wins > prevTeam.wins || team.losses > prevTeam.losses);
                    });

                    if (hasGameResults) {
                        lastCompletedDate = dayData.date;
                        break;
                    }
                }
            } else {
                // 첫 번째 날짜인 경우, 경기 결과가 있으면 완료된 것으로 간주
                const hasGameResults = dayData.standings.some(team => team.wins > 0 || team.losses > 0);
                if (hasGameResults) {
                    lastCompletedDate = dayData.date;
                    break;
                }
            }
        }
    }

    return lastCompletedDate;
}

// 팀 로고 파일명 매핑
window.getTeamLogo = function getTeamLogo(team) {
    const logos = {
        "한화": "hanwha.png",
        "LG": "lg.png",
        "두산": "doosan.png",
        "삼성": "samsung.png",
        "KIA": "kia.png",
        "SSG": "ssg.png",
        "롯데": "lotte.png",
        "NC": "nc.png",
        "키움": "kiwoom.png",
        "KT": "kt.png"
    };
    return logos[team] || "default.png";
};

/**
 * =============================================================================
 * 📈 KBO 메인 순위 변동 차트 관리 시스템 (ui-charts.js)
 * =============================================================================
 * 
 * 🎯 담당 차트: 메인 페이지의 순위 변동 차트 (index.html의 rankChart 캔버스)
 * 📍 HTML 위치: index.html 4770번째 줄 <canvas id="rankChart"></canvas>
 * 📍 레전드 위치: index.html 4775번째 줄 <div id="mainRankChartLegend">
 * 📍 호출 위치: index.html 14624번째 줄 initSimpleChart() 함수에서 호출
 * 
 * 🔧 주요 기능:
 * - 실제 KBO 데이터를 월별로 분할하여 순위 변동 그래프 생성
 * - 전체 시즌/월별 보기 모드 지원
 * - 팀별 표시/숨김 토글 기능 (선택된 팀 수 표시: "전체 선택 (7/10)")
 * - 팀 로고가 그래프 끝점에 표시
 * - 동적 레전드 생성 (HTML을 덮어씀)
 * 
 * ⚠️ 주의사항:
 * - 이 파일은 index.html의 mainRankChartLegend 요소 내용을 완전히 덮어씀
 * - HTML에 직접 레전드를 작성하면 이 스크립트가 덮어쓰므로 주의
 * - 다른 차트들(일별 통계, 승률 추이)과는 별개의 독립적인 시스템
 * 
 * =============================================================================
 */

// 매우 단순한 차트 관리 시스템
let chartState = {
    isFullView: false,
    currentPeriod: 0,
    periods: [],
    chart: null,
    teamLogoImages: {}
};

// 팀 로고 로딩 함수
async function loadTeamLogos() {
    if (!window.teamLogoImages) {
        window.teamLogoImages = {};
    }
    
    const teams = ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];
    const loadPromises = [];
    
    // 현재 페이지가 magic-number 폴더 내에 있는지 확인
    const isInMagicNumberFolder = window.location.pathname.includes('/magic-number/');
    const basePath = isInMagicNumberFolder ? 'images/teams/' : 'magic-number/images/teams/';
    
    teams.forEach(teamName => {
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            const logoPath = basePath + window.getTeamLogo(teamName);
            
            img.onload = () => {
                window.teamLogoImages[teamName] = img;
                resolve();
            };
            
            img.onerror = () => {
                // 대체 경로 시도
                const altPath = isInMagicNumberFolder ? 'magic-number/images/teams/' + window.getTeamLogo(teamName) : 'images/teams/' + window.getTeamLogo(teamName);
                const altImg = new Image();
                
                altImg.onload = () => {
                    window.teamLogoImages[teamName] = altImg;
                    resolve();
                };
                
                altImg.onerror = () => {
                    resolve(); // 실패해도 계속 진행
                };
                
                altImg.src = altPath;
            };
            
            img.src = logoPath;
        });
        
        loadPromises.push(promise);
    });
    
    try {
        await Promise.all(loadPromises);
    } catch (error) {
        // 로고 로딩 오류 무시
    }
}

// 실제 KBO 데이터 로드 및 처리
async function loadRealKBOData() {
    try {
        // 현재 페이지가 magic-number 폴더 내에 있는지 확인
        const isInMagicNumberFolder = window.location.pathname.includes('/magic-number/');
        const dataPath = isInMagicNumberFolder ? 'data/raw-game-records.json' : 'magic-number/data/raw-game-records.json';
        
        const response = await fetch(dataPath);
        
        if (!response.ok) {
            throw new Error(`데이터 로드 실패: ${response.status}`);
        }
        
        const gameData = await response.json();
        
        // SeasonRankGenerator 사용
        const generator = {
            gameData: gameData,
            teams: window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"],
            
            // 모든 경기 날짜 수집
            getAllGameDates() {
                const dates = new Set();
                
                for (const team of this.teams) {
                    if (this.gameData[team] && this.gameData[team].games) {
                        for (const game of this.gameData[team].games) {
                            dates.add(game.date);
                        }
                    }
                }
                
                return Array.from(dates).sort();
            },
            
            
            // 최신 경기 날짜 반환
            getLatestDate() {
                const allDates = this.getAllGameDates();
                return allDates.length > 0 ? allDates[allDates.length - 1] : null;
            },
            
            // 전체 시즌 순위 생성
            generateSeasonRankings() {
                const allDates = this.getAllGameDates();
                
                const seasonData = [];
                
                for (const date of allDates) {
                    // 최신 날짜인 경우 종합 순위 데이터 직접 사용 (일자별 통계와 동일한 로직)
                    if (window.dashboardData && window.dashboardData.standings && date === this.getLatestDate()) {
                        // 일자별 통계의 calculateStandings 함수와 동일한 로직 사용
                        const standings = window.dashboardData.standings.map((team, index) => ({
                            team: team.team_name,
                            rank: team.displayRank || team.rank || (index + 1),
                            wins: team.wins,
                            losses: team.losses,
                            draws: team.draws,
                            games: team.games_played || team.games,
                            winPct: team.wins / (team.wins + team.losses),
                            gamesBehind: team.gamesBehind || 0
                        }));
                        
                        seasonData.push({
                            date: date,
                            standings: standings
                        });
                        continue;
                    }
                    
                    // 과거 날짜는 일자별 통계와 동일한 로직 사용
                    const teams = window.getRankingSystem ? window.getRankingSystem().teams : this.teams;
                    const tempStats = {};
                    
                    teams.forEach(team => {
                        tempStats[team] = {
                            team_name: team,
                            team: team,
                            games: 0, 
                            wins: 0, 
                            losses: 0, 
                            draws: 0, 
                            winRate: 0, 
                            gamesBehind: 0
                        };
                    });
                    
                    // 해당 날짜까지의 누적 데이터 계산
                    teams.forEach(team => {
                        if (this.gameData[team] && this.gameData[team].games) {
                            for (const game of this.gameData[team].games) {
                                if (game.date <= date) {
                                    tempStats[team].games++;
                                    if (game.result === 'W') tempStats[team].wins++;
                                    else if (game.result === 'L') tempStats[team].losses++;
                                    else if (game.result === 'D') tempStats[team].draws++;
                                }
                            }
                        }
                    });
                    
                    // 승률 계산
                    teams.forEach(team => {
                        const stats = tempStats[team];
                        if (stats.games > 0) {
                            stats.winRate = stats.wins / (stats.wins + stats.losses);
                        }
                    });
                    
                    // 순위표 생성 (일자별 통계와 동일한 방식)
                    const standings = teams.map(team => {
                        const stats = tempStats[team];
                        return {
                            team: team,
                            wins: stats.wins,
                            losses: stats.losses,
                            draws: stats.draws,
                            games: stats.games,
                            winPct: stats.winRate,
                            gamesBehind: 0 // 게임차는 나중에 계산
                        };
                    });
                    
                    // 승률순 정렬 및 순위 부여 (일자별 통계와 동일)
                    standings.sort((a, b) => {
                        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
                        if (b.wins !== a.wins) return b.wins - a.wins;
                        return a.losses - b.losses;
                    });
                    
                    standings.forEach((team, index) => {
                        team.rank = index + 1;
                    });
                    
                    seasonData.push({
                        date: date,
                        standings: standings
                    });
                }
                
                return seasonData;
            }
        };
        
        const seasonRankings = generator.generateSeasonRankings();
        return processRealData(seasonRankings);
        
    } catch (error) {
        // 실제 데이터 로드 실패 시 조용히 가짜 데이터 사용
        return generateMockData();
    }
}

// 실제 데이터를 기간별로 분할 (월별 처리)
function processRealData(seasonRankings) {
    if (!seasonRankings || seasonRankings.length === 0) {
        // 시즌 랭킹 데이터가 없으면 가짜 데이터 사용
        return generateMockData();
    }
    
    const periods = [];
    const monthlyData = {};
    
    // 월별로 데이터 그룹화
    seasonRankings.forEach(dayData => {
        const date = new Date(dayData.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = [];
        }
        monthlyData[monthKey].push(dayData);
    });
    
    // 월별 기간 생성 (연도-월 순으로 정렬)
    Object.keys(monthlyData).sort((a, b) => {
        const [yearA, monthA] = a.split('-').map(Number);
        const [yearB, monthB] = b.split('-').map(Number);
        return yearA !== yearB ? yearA - yearB : monthA - monthB;
    }).forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const monthData = monthlyData[monthKey];
        
        if (monthData.length > 0) {
            const period = {
                title: `${year}년 ${month}월`,
                rawData: monthData,
                data: formatPeriodDataForChart(monthData)
            };
            
            periods.push(period);
        }
    });
    
    return periods;
}

// 기간 데이터를 Chart.js 형식으로 변환 (마지막 완료 경기까지만)
function formatPeriodDataForChart(periodData) {
    const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];

    // 마지막 완료 경기 날짜 찾기
    const lastCompletedDate = findLastCompletedGameDate(periodData);

    // 마지막 완료 경기 날짜까지만 필터링
    const filteredData = lastCompletedDate ?
        periodData.filter(day => day.date <= lastCompletedDate) :
        periodData;


    const chartData = {
        labels: [],
        datasets: []
    };

    // 날짜 라벨 생성
    chartData.labels = filteredData.map(day => {
        const date = new Date(day.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    // 각 팀별 순위 데이터 생성 (동순위 정확히 표시)
    teams.forEach(teamName => {
        const rankHistory = [];

        filteredData.forEach(day => {
            const teamData = day.standings.find(s => s.team === teamName);
            rankHistory.push(teamData ? teamData.rank : null);
        });

        chartData.datasets.push({
            label: teamName,
            data: rankHistory,
            borderColor: getTeamColor(teamName),
            backgroundColor: getTeamColor(teamName) + '20',
            borderWidth: 2,
            pointRadius: 1.5,
            pointHoverRadius: 4,
            tension: 0.1,
            fill: false
        });
    });

    return chartData;
}

// 백업용 가짜 데이터 생성 함수 (기존 함수명 변경)
function generateMockData() {
    const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];
    const periods = [];
    
    // 5개 기간 생성
    for (let p = 0; p < 5; p++) {
        const period = {
            title: `${p*30+1}일 - ${(p+1)*30}일`,
            data: {
                labels: [],
                datasets: []
            }
        };
        
        // 30일 데이터 생성
        for (let d = 1; d <= 30; d++) {
            period.data.labels.push(`${d}일`);
        }
        
        // 각 팀별 순위 데이터 생성
        teams.forEach((team, index) => {
            const rankData = [];
            for (let d = 1; d <= 30; d++) {
                // 랜덤하게 순위 변동
                const baseRank = index + 1;
                const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
                const rank = Math.max(1, Math.min(10, baseRank + variation));
                rankData.push(rank);
            }
            
            period.data.datasets.push({
                label: team,
                data: rankData,
                borderColor: getTeamColor(team),
                backgroundColor: getTeamColor(team) + '20',
                borderWidth: 2,
                fill: false
            });
        });
        
        periods.push(period);
    }
    
    return periods;
}

function getTeamColor(team) {
    const colors = {
        "한화": "#FF6600",
        "LG": "#C50E2E", 
        "두산": "#131230",
        "삼성": "#1F4E8C",
        "KIA": "#EA0029",
        "SSG": "#CE0E2D",
        "롯데": "#041E42",
        "NC": "#315288",
        "키움": "#570514",
        "KT": "#333333"
    };
    return colors[team] || "#666666";
}

// (getTeamLogo 함수는 파일 상단에서 이미 정의됨)

/**
 * 🎨 커스텀 레전드 생성 함수
 * =============================================================================
 * 📍 대상: index.html의 <div id="mainRankChartLegend"> 요소
 * 🔄 HTML 덮어쓰기: 기존 HTML 내용을 완전히 제거하고 새로 생성
 * 
 * 🎯 생성되는 레전드 구성:
 * 1. 전체 선택/해제 버튼 ("전체 선택 (7/10)" 형태)
 * 2. 팀별 개별 레전드 (로고 + 색상 + 팀명)
 * 
 * 💡 팀 수 실시간 업데이트:
 * - 개별 팀 클릭 시 → 전체 버튼 텍스트 업데이트
 * - 전체 선택/해제 클릭 시 → 즉시 숫자 반영
 * =============================================================================
 */
function createCustomLegend() {
    
    // 기존 커스텀 범례 제거
    const existingMainLegend = document.getElementById('main-legend-container');
    if (existingMainLegend) {
        existingMainLegend.remove();
    }
    
    // 혹시 모를 기존 범례도 제거
    const existingLegend = document.getElementById('custom-chart-legend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    if (!chartState.chart) {
        // 차트가 생성되지 않음
        return;
    }
    
    // 레전드 컨테이너 찾기 (고정 위치)
    const chartContainer = document.getElementById('mainRankChartLegend');
    
    // 범례 컨테이너 생성 (버튼과 팀들을 함께 배치)
    const mainLegendContainer = document.createElement('div');
    mainLegendContainer.id = 'main-legend-container';
    mainLegendContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 8px;
        margin-top: 5px;
        margin-bottom: 0;
        padding: 0 10px;
        background: none;
        border-radius: 0;
        box-shadow: none;
        border: none;
        width: 100%;
        box-sizing: border-box;
    `;

    // 메인 페이지 현재 순위 순서대로 팀 정렬 (범례 순서만 통일, 실제 순위는 각 날짜별로 계산)
    const sortedTeams = getMainPageTeamOrder();
    
    // 버튼 클릭 상태 초기화
    let allVisible = true;
    
    // 전체선택/해제 버튼 생성 (팀 아이템과 동일한 스타일)
    const toggleAllButton = document.createElement('button');
    toggleAllButton.id = 'toggle-all-teams';
    
    // 선택된 팀 수 계산
    const totalTeams = sortedTeams.length;
    const visibleTeams = chartState.chart.data.datasets.filter((dataset, index) => {
        const meta = chartState.chart.getDatasetMeta(index);
        return !meta.hidden;
    }).length;
    
    toggleAllButton.textContent = allVisible ? `전체 해제 (${visibleTeams}/${totalTeams})` : `전체 선택 (${visibleTeams}/${totalTeams})`;
    toggleAllButton.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 5px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        flex-shrink: 0;
        min-height: 34px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        border: none;
    `;

    // 버튼 호버 효과
    toggleAllButton.addEventListener('mouseenter', () => {
        const hoverGradient = allVisible ? 
            'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' :
            'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
        toggleAllButton.style.background = hoverGradient;
        toggleAllButton.style.transform = 'translateY(-1px)';
        toggleAllButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
    });
    
    toggleAllButton.addEventListener('mouseleave', () => {
        const normalGradient = allVisible ? 
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        toggleAllButton.style.background = normalGradient;
        toggleAllButton.style.transform = 'translateY(0)';
        toggleAllButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
    });

    // 버튼 클릭 이벤트
    toggleAllButton.addEventListener('click', () => {
        allVisible = !allVisible;
        
        chartState.chart.data.datasets.forEach((dataset, index) => {
            const meta = chartState.chart.getDatasetMeta(index);
            meta.hidden = !allVisible;
        });
        
        chartState.chart.update();
        
        // 버튼 텍스트 및 색상 업데이트 (선택된 팀 수 포함)
        const updatedVisibleTeams = allVisible ? totalTeams : 0;
        toggleAllButton.textContent = allVisible ? `전체 해제 (${updatedVisibleTeams}/${totalTeams})` : `전체 선택 (${updatedVisibleTeams}/${totalTeams})`;
        const buttonGradient = allVisible ? 
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        toggleAllButton.style.background = buttonGradient;
        
        // 모든 범례 아이템의 시각적 상태 업데이트
        const legendItems = mainLegendContainer.querySelectorAll('div[data-team]');
        legendItems.forEach(item => {
            const img = item.querySelector('img');
            const colorBox = item.querySelector('div[style*="border-radius: 50%"]');
            const text = item.querySelector('span');
            
            const opacity = allVisible ? '1' : '0.4';
            const filter = allVisible ? 'none' : 'grayscale(100%)';
            
            item.style.opacity = opacity;
            if (img) img.style.filter = filter;
            if (colorBox) colorBox.style.opacity = opacity;
            if (text) text.style.opacity = opacity;
            
            if (!allVisible) {
                item.style.borderColor = 'rgba(0,0,0,0.2)';
                item.style.background = 'rgba(128,128,128,0.1)';
            } else {
                item.style.borderColor = 'rgba(0,0,0,0.1)';
                item.style.background = 'rgba(255,255,255,0.9)';
            }
        });
    });
    
    sortedTeams.forEach(({teamName, datasetIndex}, index) => {
        const dataset = chartState.chart.data.datasets[datasetIndex];
        if (!dataset) return;
        
        const legendItem = document.createElement('div');
        legendItem.setAttribute('data-team', teamName);
        legendItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 5px 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: rgba(255,255,255,0.9);
            border: 1px solid rgba(0,0,0,0.1);
            font-weight: 600;
            font-size: 13px;
            white-space: nowrap;
            flex-shrink: 0;
            min-height: 34px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        `;
        
        // 색상 인디케이터
        const colorBox = document.createElement('div');
        colorBox.style.cssText = `
            width: 12px;
            height: 12px;
            background-color: ${dataset.borderColor};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.2);
            flex-shrink: 0;
        `;
        
        // 팀 로고 이미지
        const logoImg = document.createElement('img');
        
        // 현재 페이지가 magic-number 폴더 내에 있는지 확인
        const isInMagicNumberFolder = window.location.pathname.includes('/magic-number/');
        const logoPath = isInMagicNumberFolder ? `images/teams/${window.getTeamLogo(teamName)}` : `magic-number/images/teams/${window.getTeamLogo(teamName)}`;
        
        logoImg.src = logoPath;
        logoImg.alt = teamName;
        logoImg.style.cssText = `
            width: 20px;
            height: 20px;
            object-fit: contain;
            border-radius: 3px;
            flex-shrink: 0;
        `;
        
        // 팀명 텍스트
        const teamText = document.createElement('span');
        teamText.textContent = teamName;
        teamText.style.cssText = `
            color: #333;
            font-weight: 700;
            font-size: 13px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        `;
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(logoImg);
        legendItem.appendChild(teamText);
        
        // 🎯 개별 팀 클릭 이벤트 (차트 표시/숨김 + 전체 버튼 업데이트)
        legendItem.addEventListener('click', () => {
            const meta = chartState.chart.getDatasetMeta(datasetIndex);
            meta.hidden = !meta.hidden;
            chartState.chart.update();
            
            // 💡 중요: 전체 선택/해제 버튼 텍스트를 실시간으로 업데이트
            // 현재 보이는 팀 수를 다시 계산하여 "전체 선택 (7/10)" 형태로 표시
            const currentVisibleTeams = chartState.chart.data.datasets.filter((dataset, index) => {
                const meta = chartState.chart.getDatasetMeta(index);
                return !meta.hidden;
            }).length;
            const currentAllVisible = currentVisibleTeams === totalTeams;
            toggleAllButton.textContent = currentAllVisible ? `전체 해제 (${currentVisibleTeams}/${totalTeams})` : `전체 선택 (${currentVisibleTeams}/${totalTeams})`;
            const currentButtonGradient = currentAllVisible ? 
                'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
            toggleAllButton.style.background = currentButtonGradient;
            allVisible = currentAllVisible;
            
            // 시각적 피드백
            const opacity = meta.hidden ? '0.4' : '1';
            const filter = meta.hidden ? 'grayscale(100%)' : 'none';
            
            legendItem.style.opacity = opacity;
            logoImg.style.filter = filter;
            colorBox.style.opacity = opacity;
            teamText.style.opacity = opacity;
            
            if (meta.hidden) {
                legendItem.style.borderColor = 'rgba(0,0,0,0.2)';
                legendItem.style.background = 'rgba(128,128,128,0.1)';
            } else {
                legendItem.style.borderColor = 'transparent';
                legendItem.style.background = 'rgba(255,255,255,0.8)';
            }
        });
        
        // 호버 효과
        legendItem.addEventListener('mouseenter', () => {
            if (!chartState.chart.getDatasetMeta(datasetIndex).hidden) {
                legendItem.style.backgroundColor = 'rgba(255,255,255,1)';
                legendItem.style.borderColor = dataset.borderColor;
                legendItem.style.transform = 'translateY(-1px)';
                legendItem.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
            }
        });
        
        legendItem.addEventListener('mouseleave', () => {
            if (!chartState.chart.getDatasetMeta(datasetIndex).hidden) {
                legendItem.style.backgroundColor = 'rgba(255,255,255,0.9)';
                legendItem.style.borderColor = 'rgba(0,0,0,0.1)';
                legendItem.style.transform = 'translateY(0)';
                legendItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
            }
        });
        
        // 1위 팀(첫 번째) 앞에 버튼 추가
        if (index === 0) {
            mainLegendContainer.appendChild(toggleAllButton);
            mainLegendContainer.appendChild(legendItem);
        } else {
            mainLegendContainer.appendChild(legendItem);
        }
    });
    
    // 기존 내용 제거 후 메인 범례 컨테이너 추가
    chartContainer.innerHTML = '';
    chartContainer.appendChild(mainLegendContainer);
}

// 범례 순서는 getMainPageTeamOrder()로 처리

// 메인 페이지의 현재 순위 순서만 가져오는 함수 (범례용)
function getMainPageTeamOrder() {
    if (window.getRankingSystem) {
        const rankingSystem = window.getRankingSystem();
        if (rankingSystem.teams.length > 0) {
            return rankingSystem.teams.map((teamName, index) => {
                const datasetIndex = chartState.chart && chartState.chart.data.datasets.findIndex(
                    dataset => dataset.label === teamName
                );
                return {
                    teamName: teamName,
                    rank: rankingSystem.teamRanks[teamName],
                    datasetIndex: datasetIndex >= 0 ? datasetIndex : index
                };
            });
        }
    }
    
    // 기본값
    const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];
    return teams.map((teamName, index) => ({
        teamName,
        datasetIndex: index
    }));
}


// 차트 생성
function createSimpleChart(data) {
    
    const ctx = document.getElementById('rankChart');
    
    if (!ctx) {
        // rankChart 캔버스 요소를 찾을 수 없음
        return null;
    }
    
    if (chartState.chart) {
        chartState.chart.destroy();
    }
    
    try {
        chartState.chart = new Chart(ctx, {
            type: 'line',
            data: data,
            plugins: [{
                id: 'teamLogos',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    if (!window.teamLogoImages || Object.keys(window.teamLogoImages).length === 0) {
                        return;
                    }
                    
                    chart.data.datasets.forEach((dataset, index) => {
                        const meta = chart.getDatasetMeta(index);
                        if (meta.data && meta.data.length > 0 && !meta.hidden) {
                            const lastPoint = meta.data[meta.data.length - 1];
                            const teamName = dataset.label;
                            const logoImg = window.teamLogoImages[teamName];
                            
                            if (logoImg && lastPoint && typeof lastPoint.x === 'number' && typeof lastPoint.y === 'number') {
                                ctx.save();
                                
                                // 로고 그리기 (동그라미 없이)
                                ctx.globalCompositeOperation = 'source-over';
                                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                                ctx.shadowBlur = 2;
                                ctx.shadowOffsetX = 1;
                                ctx.shadowOffsetY = 1;
                                const size = 28;
                                ctx.drawImage(logoImg, lastPoint.x - size/2, lastPoint.y - size/2, size, size);
                                
                                ctx.restore();
                            }
                        }
                    });
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 10,
                        right: 30,
                        top: 10,
                        bottom: 10
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 11
                            },
                            maxTicksLimit: 120,
                            includeBounds: true
                        },
                        grid: {
                            display: true,
                            color: '#e5e7eb'
                        }
                    },
                    y: {
                        reverse: true,
                        min: 0.5,
                        max: 10.5,
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                if (Number.isInteger(value) && value >= 1 && value <= 10) {
                                    return value + '위';
                                }
                                return '';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // 커스텀 범례 사용
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(tooltipItems) {
                                const dataIndex = tooltipItems[0].dataIndex;
                                
                                // 전체 시즌 모드인지 확인
                                if (chartState.isFullView) {
                                    // 전체 시즌 데이터에서 실제 날짜 찾기
                                    let allData = [];
                                    chartState.periods.forEach(period => {
                                        if (period.rawData) {
                                            allData = allData.concat(period.rawData);
                                        }
                                    });
                                    
                                    if (allData[dataIndex] && allData[dataIndex].date) {
                                        const date = new Date(allData[dataIndex].date);
                                        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
                                    }
                                }
                                
                                return tooltipItems[0].label;
                            },
                            beforeBody: function(tooltipItems) {
                                // 현재 시점의 모든 팀 순위 정보 수집
                                const dataIndex = tooltipItems[0].dataIndex;
                                const allTeamsAtThisPoint = [];
                                
                                tooltipItems.forEach(item => {
                                    const rank = item.parsed.y;
                                    const teamName = item.dataset.label;
                                    if (rank && teamName) {
                                        allTeamsAtThisPoint.push({ rank, teamName });
                                    }
                                });
                                
                                // 순위별로 정렬
                                allTeamsAtThisPoint.sort((a, b) => a.rank - b.rank);
                                
                                // 동순위 그룹핑 후 툴팁에 표시할 텍스트 생성
                                const rankGroups = {};
                                allTeamsAtThisPoint.forEach(team => {
                                    if (!rankGroups[team.rank]) {
                                        rankGroups[team.rank] = [];
                                    }
                                    rankGroups[team.rank].push(team.teamName);
                                });
                                
                                return Object.keys(rankGroups).map(rank => {
                                    const teams = rankGroups[rank];
                                    if (teams.length > 1) {
                                        return `${rank}위 공동: ${teams.join(', ')}`;
                                    } else {
                                        return `${rank}위: ${teams[0]}`;
                                    }
                                });
                            },
                            label: function(context) {
                                // beforeBody에서 이미 정보를 표시했으므로 빈 문자열 반환
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        reverse: true,
                        min: 0.5,
                        max: 10.5,
                        beginAtZero: false,
                        bounds: 'data',
                        title: {
                            display: true,
                            text: '순위',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        afterBuildTicks: function(axis) {
                            axis.ticks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => ({value}));
                        },
                        ticks: { 
                            stepSize: 1,
                            autoSkip: false,
                            callback: function(value) {
                                // 1~10 정수값만 표시
                                if (Number.isInteger(value) && value >= 1 && value <= 10) {
                                    return value + '위';
                                }
                                return null;
                            },
                            font: {
                                size: 12
                            },
                            padding: 5
                        },
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    x: {
                        grid: {
                            display: true,   // x축 격자 표시 활성화
                            color: '#e5e7eb'  // y축과 동일한 격자 색상
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 11
                            },
                            maxTicksLimit: 120
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
        
        
        // 커스텀 범례 생성 (로고 로딩 완료 후)
        setTimeout(() => {
            createCustomLegend();
        }, 200);
        
        // 팀 로고가 로드된 후 차트를 다시 그리기
        setTimeout(() => {
            if (chartState.chart && window.teamLogoImages && Object.keys(window.teamLogoImages).length > 0) {
                chartState.chart.update();
            }
        }, 1000);
        
        return chartState.chart;
    } catch (error) {
        // 차트 생성 오류
        return null;
    }
}

// 차트 업데이트
function updateSimpleChart() {
    
    if (chartState.periods.length === 0) {
        // 기간 데이터가 없음
        return;
    }
    
    let chartData;
    
    if (chartState.isFullView) {
        // 전체 시즌 데이터 생성
        chartData = generateFullSeasonChart();
    } else {
        // 특정 기간 데이터 사용
        const period = chartState.periods[chartState.currentPeriod];
        if (!period) {
            // 현재 기간 데이터를 찾을 수 없음
            return;
        }
        chartData = period.data;
    }
    
    // 항상 기존 차트를 완전히 파괴하고 새로 생성 (강제 업데이트)
    if (chartState.chart) {
        chartState.chart.destroy();
        chartState.chart = null;
    }
    
    // 차트 생성 (중복 생성 방지)
    if (!chartState.chart) {
        createSimpleChart(chartData);
    } else {
        // 기존 차트 데이터 업데이트
        chartState.chart.data = chartData;
        chartState.chart.update('none');
    }
    
    // UI 업데이트
    updateSimpleUI();
    updateProgressIndicator();
}

// 전체 시즌 차트 데이터 생성 (마지막 완료 경기까지만)
function generateFullSeasonChart() {
    const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];

    // 모든 기간의 rawData를 하나로 합치기
    let allData = [];
    chartState.periods.forEach(period => {
        if (period.rawData) {
            allData = allData.concat(period.rawData);
        }
    });

    // 날짜순으로 정렬
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 마지막 완료 경기 날짜 찾기
    const lastCompletedDate = findLastCompletedGameDate(allData);

    // 마지막 완료 경기 날짜까지만 필터링
    const filteredData = lastCompletedDate ?
        allData.filter(day => day.date <= lastCompletedDate) :
        allData;


    const chartData = {
        labels: [],
        datasets: []
    };

    // 날짜 라벨 생성 (완료된 경기까지만)
    chartData.labels = filteredData.map(day => {
        const date = new Date(day.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    // 각 팀별 순위 데이터 생성 (동순위 정확히 표시)
    teams.forEach(teamName => {
        const rankHistory = [];

        filteredData.forEach(day => {
            const teamData = day.standings.find(s => s.team === teamName);
            rankHistory.push(teamData ? teamData.rank : null);
        });

        chartData.datasets.push({
            label: teamName,
            data: rankHistory,
            borderColor: getTeamColor(teamName),
            backgroundColor: getTeamColor(teamName) + '20',
            borderWidth: 2,
            pointRadius: 1.5,
            pointHoverRadius: 4,
            tension: 0.1,
            fill: false
        });
    });
    
    return chartData;
}

// UI 업데이트
function updateSimpleUI() {
    const period = chartState.periods[chartState.currentPeriod];
    
    // 현재 기간 텍스트 업데이트
    const periodText = document.getElementById('currentPeriodText');
    if (periodText) {
        if (chartState.isFullView) {
            // 전체 시즌 모드일 때 전체 기간 표시
            if (chartState.periods.length > 0) {
                // 첫 번째 기간의 시작일과 마지막 기간의 종료일 계산
                const firstPeriod = chartState.periods[0];
                const lastPeriod = chartState.periods[chartState.periods.length - 1];
                
                if (firstPeriod.rawData && lastPeriod.rawData) {
                    const startDate = new Date(firstPeriod.rawData[0].date);
                    const endDate = new Date(lastPeriod.rawData[lastPeriod.rawData.length - 1].date);
                    
                    periodText.textContent = `전체 시즌: ${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getFullYear()}년 ${endDate.getMonth() + 1}월 ${endDate.getDate()}일`;
                } else {
                    periodText.textContent = `전체 시즌: 2025년 3월 22일 개막 ~ 현재`;
                }
            } else {
                periodText.textContent = `전체 시즌: 2025년 3월 22일 개막 ~ 현재`;
            }
            periodText.style.visibility = 'visible';
        } else if (period) {
            periodText.textContent = `현재 보는 기간: ${period.title}`;
            periodText.style.visibility = 'visible';
        }
    }
    
    // 버튼 상태 업데이트
    const prevBtn = document.getElementById('prevPeriod');
    const nextBtn = document.getElementById('nextPeriod');
    const toggleBtn = document.getElementById('periodToggle');
    const chartNav = document.getElementById('rank-chart-nav');
    
    if (prevBtn) {
        prevBtn.disabled = chartState.isFullView || chartState.currentPeriod === 0;
        prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
        
        // 전체시즌 모드이거나 첫 번째 월인 경우 버튼 숨김
        if (chartState.isFullView || chartState.currentPeriod === 0) {
            prevBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'inline-block';
            // 이전 기간 버튼 텍스트 업데이트
            const prevPeriod = chartState.periods[chartState.currentPeriod - 1];
            prevBtn.textContent = `← ${prevPeriod.title}`;
        }
    }
    
    if (nextBtn) {
        nextBtn.disabled = chartState.isFullView || chartState.currentPeriod === chartState.periods.length - 1;
        nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
        
        // 전체시즌 모드이거나 마지막 월인 경우 버튼 숨김
        if (chartState.isFullView || chartState.currentPeriod === chartState.periods.length - 1) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'inline-block';
            // 다음 기간 버튼 텍스트 업데이트
            const nextPeriod = chartState.periods[chartState.currentPeriod + 1];
            nextBtn.textContent = `${nextPeriod.title} →`;
        }
    }
    
    // 네비게이션 컨테이너는 항상 space-between 유지 (플레이스홀더 div가 정렬 처리)
    
    if (toggleBtn) {
        toggleBtn.textContent = chartState.isFullView ? '📅 월별 보기' : '📊 전체 시즌 보기';
    }
    
}

/**
 * 🚀 메인 순위 차트 초기화 함수
 * =============================================================================
 * 📍 호출 위치: index.html 14624번째 줄에서 호출됨
 * 🔄 실행 순서:
 * 1. 팀 로고 이미지 로딩 (loadTeamLogos)
 * 2. 실제 KBO 데이터 로딩 (loadRealKBOData)
 * 3. 차트 생성 및 업데이트 (updateSimpleChart)
 * 4. 커스텀 레전드 생성 (createCustomLegend)
 * 
 * 🎯 이 함수가 실행되면:
 * - index.html의 rankChart 캔버스에 차트가 그려짐
 * - mainRankChartLegend div의 내용이 동적으로 생성됨
 * =============================================================================
 */
async function initSimpleChart() {
    try {
        // 1. 팀 로고 로드
        await loadTeamLogos();
        
        // 2. 실제 KBO 데이터 로드
        chartState.periods = await loadRealKBOData();
        
        if (!chartState.periods || chartState.periods.length === 0) {
            chartState.periods = generateMockData();
        }
        
        chartState.currentPeriod = chartState.periods.length - 1; // 최근 기간
        chartState.isFullView = true; // 기본적으로 전체 시즌 보기
        
        // 3. 차트 업데이트
        updateSimpleChart();
        
    } catch (error) {
        // 실패 시 최소한의 기본 차트 생성 시도
        try {
            chartState.periods = generateMockData();
            chartState.currentPeriod = chartState.periods.length - 1;
            chartState.isFullView = false;
            updateSimpleChart();
        } catch (fallbackError) {
            // 기본 차트 생성도 실패
        }
    }
}

// 전역 함수들
function handlePrevPeriod() {
    if (!chartState.isFullView && chartState.currentPeriod > 0) {
        chartState.currentPeriod--;
        updateSimpleChart();
    }
}

function handleNextPeriod() {
    if (!chartState.isFullView && chartState.currentPeriod < chartState.periods.length - 1) {
        chartState.currentPeriod++;
        updateSimpleChart();
    }
}

function handlePeriodToggle() {
    chartState.isFullView = !chartState.isFullView;
    updateSimpleChart();
}

// 진행 인디케이터 업데이트 함수
function updateProgressIndicator() {
    const container = document.getElementById('progressDots');
    if (!container) return;

    if (chartState.isFullView) {
        // 전체 시즌 모드에서는 진행 인디케이터 숨김
        container.innerHTML = '';
        return;
    }

    // 월별 모드에서 진행 인디케이터 표시
    let html = '';
    for (let i = 0; i < chartState.periods.length; i++) {
        const isActive = i === chartState.currentPeriod;
        html += `<div style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${isActive ? '#28a745' : '#dee2e6'};
            transition: all 0.3s ease;
        "></div>`;
    }
    container.innerHTML = html;
}

// Chart.js 지연 로딩 및 대기 함수
async function waitForChart(maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        const checkChart = () => {
            attempts++;
            
            if (typeof Chart !== 'undefined' && Chart.version) {
                resolve();
                return;
            }
            
            if (attempts >= maxAttempts) {
                reject(new Error('Chart.js 라이브러리가 로드되지 않았습니다.'));
                return;
            }
            
            setTimeout(checkChart, interval);
        };
        
        checkChart();
    });
}

// 페이지 완전 로드 후 초기화 (Chart.js 로딩 보장)
window.addEventListener('load', async function() {
    // 캔버스 요소 확인
    const canvas = document.getElementById('rankChart');
    if (!canvas) {
        return;
    }
    
    // Chart.js 로딩 재시도 함수
    async function waitForChartJs(retries = 10, delay = 500) {
        for (let i = 0; i < retries; i++) {
            if (typeof Chart !== 'undefined') {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        return false;
    }
    
    // Chart.js 로딩 대기 (최대 5초)
    const chartJsLoaded = await waitForChartJs();
    
    if (!chartJsLoaded) {
        // Chart.js를 동적으로 로드 시도
        try {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            script.async = true;
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
            // 로드 후 다시 대기
            const retryLoaded = await waitForChartJs(5, 200);
            if (!retryLoaded) {
                throw new Error('Chart.js failed to load');
            }
        } catch (error) {
            // 최종 실패 시 오류 메시지 표시
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; margin: 10px; border-radius: 5px; text-align: center;">
                    <strong>📈 차트 기능을 사용할 수 없습니다</strong><br>
                    페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.
                </div>
            `;
            canvas.parentElement.appendChild(errorDiv);
            canvas.style.display = 'none';
            return;
        }
    }
    
    try {
        // 차트 초기화 실행
        await initSimpleChart();
        
    } catch (error) {
        // 사용자에게 친화적인 오류 메시지 표시
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; margin: 10px; border-radius: 5px; text-align: center;">
                <strong>📈 순위 변동 그래프 로딩 실패</strong><br>
                네트워크 연결을 확인하고 페이지를 새로고침해 주세요.
                <br><small>오류: ${error.message}</small>
            </div>
        `;
        
        // 차트 컨테이너에 오류 메시지 표시
        const chartContainer = canvas.parentElement;
        if (chartContainer) {
            chartContainer.appendChild(errorDiv);
        }
    }
});

// =============================================================================
// 🏆 승수 변동 추이 차트 관리 시스템 
// =============================================================================

// 승수 변동 차트 상태 관리
let winCountChartState = {
    isFullView: true,
    currentPeriod: 0,
    periods: [],
    chart: null,
    teamLogoImages: {}
};

/**
 * 실제 KBO 데이터에서 승수 변동 추이 데이터 생성
 */
async function loadWinCountData() {
    try {
        // 현재 페이지가 magic-number 폴더 내에 있는지 확인
        const isInMagicNumberFolder = window.location.pathname.includes('/magic-number/');
        const dataPath = isInMagicNumberFolder ? 'data/raw-game-records.json' : 'magic-number/data/raw-game-records.json';
        
        const response = await fetch(dataPath);
        
        if (!response.ok) {
            throw new Error(`데이터 로드 실패: ${response.status}`);
        }
        
        const gameData = await response.json();
        
        // 승수 변동 데이터 생성기
        const generator = {
            gameData: gameData,
            teams: window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"],
            
            // 모든 경기 날짜 수집
            getAllGameDates() {
                const dates = new Set();
                
                for (const team of this.teams) {
                    if (this.gameData[team] && this.gameData[team].games) {
                        for (const game of this.gameData[team].games) {
                            dates.add(game.date);
                        }
                    }
                }
                
                return Array.from(dates).sort();
            },
            
            // 승수 변동 데이터 생성
            generateWinCountData() {
                const allDates = this.getAllGameDates();
                const seasonData = [];
                
                for (const date of allDates) {
                    const teams = window.getRankingSystem ? window.getRankingSystem().teams : this.teams;
                    const tempStats = {};
                    
                    teams.forEach(team => {
                        tempStats[team] = {
                            team_name: team,
                            team: team,
                            wins: 0
                        };
                    });
                    
                    // 해당 날짜까지의 누적 승수 계산
                    teams.forEach(team => {
                        if (this.gameData[team] && this.gameData[team].games) {
                            for (const game of this.gameData[team].games) {
                                if (game.date <= date) {
                                    if (game.result === 'W') tempStats[team].wins++;
                                }
                            }
                        }
                    });
                    
                    // 승수 데이터 구성
                    const winCountData = teams.map(team => {
                        const stats = tempStats[team];
                        return {
                            team: team,
                            wins: stats.wins
                        };
                    });
                    
                    seasonData.push({
                        date: date,
                        winCounts: winCountData
                    });
                }
                
                return seasonData;
            }
        };
        
        const winCountRankings = generator.generateWinCountData();
        return processWinCountData(winCountRankings);
        
    } catch (error) {
        console.error('승수 변동 추이 데이터 로드 실패:', error);
        console.log('가짜 데이터를 사용합니다.');
        // 실제 데이터 로드 실패 시 가짜 데이터 사용
        return generateMockWinCountData();
    }
}

// 승수 데이터를 기간별로 분할 (월별 처리)
function processWinCountData(winCountData) {
    // 데이터 유효성 검사
    if (!winCountData || !Array.isArray(winCountData) || winCountData.length === 0) {
        console.error('승수 데이터가 배열이 아니거나 비어있습니다:', winCountData);
        return generateMockWinCountData();
    }
    
    const periods = [];
    const monthlyData = {};
    
    // 월별로 데이터 그룹화
    winCountData.forEach(dayData => {
        const date = new Date(dayData.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = [];
        }
        monthlyData[monthKey].push(dayData);
    });
    
    // 월별 기간 생성
    Object.keys(monthlyData).sort((a, b) => {
        const [yearA, monthA] = a.split('-').map(Number);
        const [yearB, monthB] = b.split('-').map(Number);
        return yearA !== yearB ? yearA - yearB : monthA - monthB;
    }).forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const monthData = monthlyData[monthKey];
        
        if (monthData.length > 0) {
            const period = {
                title: `${year}년 ${month}월`,
                rawData: monthData,
                data: formatWinCountDataForChart(monthData)
            };
            
            periods.push(period);
        }
    });
    
    return periods;
}

// 승수 데이터를 Chart.js 형식으로 변환 (마지막 완료 경기까지만)
function formatWinCountDataForChart(periodData) {
    const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];

    // 마지막 완료 경기 날짜 찾기
    const lastCompletedDate = findLastCompletedGameDate(periodData);

    // 마지막 완료 경기 날짜까지만 필터링
    const filteredData = lastCompletedDate ?
        periodData.filter(day => day.date <= lastCompletedDate) :
        periodData;


    const chartData = {
        labels: [],
        datasets: []
    };

    // 날짜 라벨 생성 (완료된 경기까지만)
    chartData.labels = filteredData.map(day => {
        const date = new Date(day.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    // 각 팀별 승수 데이터 생성
    teams.forEach(teamName => {
        const winHistory = [];

        filteredData.forEach(day => {
            const teamData = day.winCounts.find(w => w.team === teamName);
            winHistory.push(teamData ? teamData.wins : 0);
        });

        chartData.datasets.push({
            label: teamName,
            data: winHistory,
            borderColor: getTeamColor(teamName),
            backgroundColor: getTeamColor(teamName) + '20',
            borderWidth: 2,
            pointRadius: 1.5,
            pointHoverRadius: 4,
            tension: 0.1,
            fill: false
        });
    });
    
    return chartData;
}

// 백업용 가짜 승수 데이터 생성
function generateMockWinCountData() {
    const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];
    const periods = [];
    
    for (let p = 0; p < 5; p++) {
        const period = {
            title: `${p*30+1}일 - ${(p+1)*30}일`,
            data: {
                labels: [],
                datasets: []
            }
        };
        
        for (let d = 1; d <= 30; d++) {
            period.data.labels.push(`${d}일`);
        }
        
        teams.forEach((team, index) => {
            const winData = [];
            for (let d = 1; d <= 30; d++) {
                // 승수는 누적되므로 점진적 증가
                const baseWins = Math.floor(d * 0.5) + (index * 2);
                const variation = Math.floor(Math.random() * 3);
                winData.push(baseWins + variation);
            }
            
            period.data.datasets.push({
                label: team,
                data: winData,
                borderColor: getTeamColor(team),
                backgroundColor: getTeamColor(team) + '20',
                borderWidth: 2,
                fill: false
            });
        });
        
        periods.push(period);
    }
    
    return periods;
}

// 승수 변동 차트 생성
function createWinCountChart(data) {
    const ctx = document.getElementById('winCountChart');
    
    if (!ctx) {
        console.error('winCountChart 캔버스 요소를 찾을 수 없습니다.');
        return null;
    }
    
    if (winCountChartState.chart) {
        winCountChartState.chart.destroy();
    }
    
    try {
        winCountChartState.chart = new Chart(ctx, {
            type: 'line',
            data: data,
            plugins: [{
                id: 'winCountTeamLogos',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    if (!window.teamLogoImages || Object.keys(window.teamLogoImages).length === 0) {
                        return;
                    }
                    
                    chart.data.datasets.forEach((dataset, index) => {
                        const meta = chart.getDatasetMeta(index);
                        if (meta.data && meta.data.length > 0 && !meta.hidden) {
                            const lastPoint = meta.data[meta.data.length - 1];
                            const teamName = dataset.label;
                            const logoImg = window.teamLogoImages[teamName];
                            
                            if (logoImg && lastPoint && typeof lastPoint.x === 'number' && typeof lastPoint.y === 'number') {
                                ctx.save();
                                
                                ctx.globalCompositeOperation = 'source-over';
                                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                                ctx.shadowBlur = 2;
                                ctx.shadowOffsetX = 1;
                                ctx.shadowOffsetY = 1;
                                const size = 28;
                                ctx.drawImage(logoImg, lastPoint.x - size/2, lastPoint.y - size/2, size, size);
                                
                                ctx.restore();
                            }
                        }
                    });
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 10,
                        right: 30,
                        top: 10,
                        bottom: 10
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '승수',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            stepSize: 5,
                            callback: function(value) {
                                return value + '승';
                            },
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    x: {
                        grid: {
                            display: true,
                            color: '#e5e7eb'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(tooltipItems) {
                                const dataIndex = tooltipItems[0].dataIndex;
                                
                                if (winCountChartState.isFullView) {
                                    let allData = [];
                                    winCountChartState.periods.forEach(period => {
                                        if (period.rawData) {
                                            allData = allData.concat(period.rawData);
                                        }
                                    });
                                    
                                    if (allData[dataIndex] && allData[dataIndex].date) {
                                        const date = new Date(allData[dataIndex].date);
                                        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
                                    }
                                }
                                
                                return tooltipItems[0].label;
                            },
                            beforeBody: function(tooltipItems) {
                                const dataIndex = tooltipItems[0].dataIndex;
                                const allTeamsAtThisPoint = [];
                                
                                tooltipItems.forEach(item => {
                                    const wins = item.parsed.y;
                                    const teamName = item.dataset.label;
                                    if (wins !== null && teamName) {
                                        allTeamsAtThisPoint.push({ wins, teamName });
                                    }
                                });
                                
                                // 승수별로 정렬 (내림차순)
                                allTeamsAtThisPoint.sort((a, b) => b.wins - a.wins);
                                
                                return allTeamsAtThisPoint.map(team => {
                                    return `${team.teamName}: ${team.wins}승`;
                                });
                            },
                            label: function(context) {
                                return '';
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
        
        // 커스텀 범례 생성
        setTimeout(() => {
            createWinCountCustomLegend();
        }, 200);
        
        // 팀 로고 업데이트
        setTimeout(() => {
            if (winCountChartState.chart && window.teamLogoImages && Object.keys(window.teamLogoImages).length > 0) {
                winCountChartState.chart.update();
            }
        }, 1000);
        
        return winCountChartState.chart;
    } catch (error) {
        return null;
    }
}

// 승수 변동 차트 업데이트
function updateWinCountChart() {
    if (winCountChartState.periods.length === 0) {
        console.warn('승수 변동 추이 데이터 기간이 없습니다.');
        return;
    }
    
    let chartData;
    
    if (winCountChartState.isFullView) {
        chartData = generateFullSeasonWinCountChart();
    } else {
        const period = winCountChartState.periods[winCountChartState.currentPeriod];
        if (!period) {
            console.warn('현재 기간 데이터가 없습니다:', winCountChartState.currentPeriod);
            return;
        }
        chartData = period.data;
    }
    
    if (!chartData) {
        console.error('차트 데이터가 생성되지 않았습니다.');
        return;
    }
    
    // 기존 차트 파괴하고 새로 생성
    if (winCountChartState.chart) {
        winCountChartState.chart.destroy();
        winCountChartState.chart = null;
    }
    
    try {
        if (!winCountChartState.chart) {
            createWinCountChart(chartData);
        } else {
            winCountChartState.chart.data = chartData;
            winCountChartState.chart.update('none');
        }
        
        updateWinCountUI();
    } catch (error) {
        console.error('승수 변동 추이 차트 생성 실패:', error);
    }
    updateWinCountProgressIndicator();
}

// 전체 시즌 승수 차트 데이터 생성
function generateFullSeasonWinCountChart() {
    const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];
    
    // 모든 기간의 rawData를 하나로 합치기
    let allData = [];
    winCountChartState.periods.forEach(period => {
        if (period.rawData && Array.isArray(period.rawData)) {
            allData = allData.concat(period.rawData);
        }
    });
    
    // 데이터가 없으면 빈 차트 반환
    if (allData.length === 0) {
        console.warn('전체 시즌 승수 데이터가 없습니다.');
        return {
            labels: ['데이터 없음'],
            datasets: teams.map(team => ({
                label: team,
                data: [0],
                borderColor: getTeamColor(team),
                backgroundColor: getTeamColor(team) + '20',
                borderWidth: 2,
                fill: false
            }))
        };
    }
    
    // 날짜순으로 정렬
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 마지막 완료 경기 날짜 찾기
    const lastCompletedDate = findLastCompletedGameDate(allData);

    // 마지막 완료 경기 날짜까지만 필터링
    const filteredData = lastCompletedDate ?
        allData.filter(day => day.date <= lastCompletedDate) :
        allData;


    const chartData = {
        labels: [],
        datasets: []
    };

    // 날짜 라벨 생성 (완료된 경기까지만)
    chartData.labels = filteredData.map(day => {
        const date = new Date(day.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    // 각 팀별 승수 데이터 생성
    teams.forEach(teamName => {
        const winHistory = [];

        filteredData.forEach(day => {
            const teamData = day.winCounts.find(w => w.team === teamName);
            winHistory.push(teamData ? teamData.wins : 0);
        });

        chartData.datasets.push({
            label: teamName,
            data: winHistory,
            borderColor: getTeamColor(teamName),
            backgroundColor: getTeamColor(teamName) + '20',
            borderWidth: 2,
            pointRadius: 1.5,
            pointHoverRadius: 4,
            tension: 0.1,
            fill: false
        });
    });

    return chartData;
}

// 승수 변동 차트 UI 업데이트
function updateWinCountUI() {
    const period = winCountChartState.periods[winCountChartState.currentPeriod];
    
    // 현재 기간 텍스트 업데이트
    const periodText = document.getElementById('currentPeriodTextWinCount');
    if (periodText) {
        if (winCountChartState.isFullView) {
            if (winCountChartState.periods.length > 0) {
                const firstPeriod = winCountChartState.periods[0];
                const lastPeriod = winCountChartState.periods[winCountChartState.periods.length - 1];
                
                if (firstPeriod.rawData && lastPeriod.rawData) {
                    const startDate = new Date(firstPeriod.rawData[0].date);
                    const endDate = new Date(lastPeriod.rawData[lastPeriod.rawData.length - 1].date);
                    
                    periodText.textContent = `전체 시즌: ${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getFullYear()}년 ${endDate.getMonth() + 1}월 ${endDate.getDate()}일`;
                } else {
                    periodText.textContent = `전체 시즌: 2025년 3월 22일 개막 ~ 현재`;
                }
            } else {
                periodText.textContent = `전체 시즌: 2025년 3월 22일 개막 ~ 현재`;
            }
            periodText.style.visibility = 'visible';
        } else if (period) {
            periodText.textContent = `현재 보는 기간: ${period.title}`;
            periodText.style.visibility = 'visible';
        }
    }
    
    // 버튼 상태 업데이트
    const prevBtn = document.getElementById('prevPeriodWinCount');
    const nextBtn = document.getElementById('nextPeriodWinCount');
    const toggleBtn = document.getElementById('periodToggleWinCount');
    
    if (prevBtn) {
        prevBtn.disabled = winCountChartState.isFullView || winCountChartState.currentPeriod === 0;
        prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
        
        if (winCountChartState.isFullView || winCountChartState.currentPeriod === 0) {
            prevBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'inline-block';
            const prevPeriod = winCountChartState.periods[winCountChartState.currentPeriod - 1];
            prevBtn.textContent = `← ${prevPeriod.title}`;
        }
    }
    
    if (nextBtn) {
        nextBtn.disabled = winCountChartState.isFullView || winCountChartState.currentPeriod === winCountChartState.periods.length - 1;
        nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
        
        if (winCountChartState.isFullView || winCountChartState.currentPeriod === winCountChartState.periods.length - 1) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'inline-block';
            const nextPeriod = winCountChartState.periods[winCountChartState.currentPeriod + 1];
            nextBtn.textContent = `${nextPeriod.title} →`;
        }
    }
    
    if (toggleBtn) {
        toggleBtn.textContent = winCountChartState.isFullView ? '📅 월별 보기' : '📊 전체 시즌 보기';
    }
}

// 승수 변동 차트 진행 인디케이터 업데이트
function updateWinCountProgressIndicator() {
    const container = document.getElementById('progressDotsWinCount');
    if (!container) return;

    if (winCountChartState.isFullView) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 0; i < winCountChartState.periods.length; i++) {
        const isActive = i === winCountChartState.currentPeriod;
        html += `<div style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${isActive ? '#28a745' : '#dee2e6'};
            transition: all 0.3s ease;
        "></div>`;
    }
    container.innerHTML = html;
}

// 승수 변동 차트 초기화 (전역 노출)
window.initWinCountChart = async function initWinCountChart() {
    try {
        // 팀 로고 로드 (공통 사용)
        await loadTeamLogos();
        
        // 승수 변동 데이터 로드
        winCountChartState.periods = await loadWinCountData();
        
        if (!winCountChartState.periods || winCountChartState.periods.length === 0) {
            winCountChartState.periods = generateMockWinCountData();
        }
        
        winCountChartState.currentPeriod = winCountChartState.periods.length - 1;
        winCountChartState.isFullView = true;
        
        // 차트 업데이트
        updateWinCountChart();
        
    } catch (error) {
        try {
            winCountChartState.periods = generateMockWinCountData();
            winCountChartState.currentPeriod = winCountChartState.periods.length - 1;
            winCountChartState.isFullView = false;
            updateWinCountChart();
        } catch (fallbackError) {
            // 실패 시 무시
        }
    }
};

// 승수 변동 차트 전역 함수들 (window 객체에 노출)
window.handlePrevPeriodWinCount = function handlePrevPeriodWinCount() {
    console.log('handlePrevPeriodWinCount 호출됨');
    if (!winCountChartState.isFullView && winCountChartState.currentPeriod > 0) {
        winCountChartState.currentPeriod--;
        updateWinCountChart();
    }
};

window.handleNextPeriodWinCount = function handleNextPeriodWinCount() {
    console.log('handleNextPeriodWinCount 호출됨');
    if (!winCountChartState.isFullView && winCountChartState.currentPeriod < winCountChartState.periods.length - 1) {
        winCountChartState.currentPeriod++;
        updateWinCountChart();
    }
};

window.handlePeriodToggleWinCount = function handlePeriodToggleWinCount() {
    console.log('handlePeriodToggleWinCount 호출됨');
    winCountChartState.isFullView = !winCountChartState.isFullView;
    updateWinCountChart();
};

// 승수 변동 차트용 커스텀 레전드 생성 함수
function createWinCountCustomLegend() {
    const legendContainer = document.getElementById('winCountChartLegend');
    if (!legendContainer || !winCountChartState.chart) {
        return;
    }
    
    // 기존 레전드 제거
    legendContainer.innerHTML = '';
    
    // 레전드 컨테이너 스타일 설정
    legendContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 8px;
        margin-top: 5px;
        margin-bottom: 0;
        padding: 0 10px;
        background: none;
        border-radius: 0;
        box-shadow: none;
        border: none;
        width: 100%;
        box-sizing: border-box;
    `;

    // 메인 페이지 현재 순위 순서대로 팀 정렬
    let sortedTeams;
    if (window.getRankingSystem) {
        const rankingSystem = window.getRankingSystem();
        if (rankingSystem.teams.length > 0) {
            sortedTeams = rankingSystem.teams.map(teamName => {
                const datasetIndex = winCountChartState.chart.data.datasets.findIndex(d => d.label === teamName);
                return {
                    teamName: teamName,
                    rank: rankingSystem.teamRanks[teamName],
                    datasetIndex: datasetIndex >= 0 ? datasetIndex : -1
                };
            }).filter(item => item.datasetIndex !== -1);
        } else {
            const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];
            sortedTeams = teams.map(team => ({
                teamName: team,
                datasetIndex: winCountChartState.chart.data.datasets.findIndex(d => d.label === team)
            })).filter(item => item.datasetIndex !== -1);
        }
    } else {
        const teams = window.getRankingSystem ? window.getRankingSystem().teams : ["한화", "LG", "두산", "삼성", "KIA", "SSG", "롯데", "NC", "키움", "KT"];
        sortedTeams = teams.map(team => ({
            teamName: team,
            datasetIndex: winCountChartState.chart.data.datasets.findIndex(d => d.label === team)
        })).filter(item => item.datasetIndex !== -1);
    }
    
    // 선택된 팀 수 계산
    const totalTeams = sortedTeams.length;
    const visibleTeams = sortedTeams.filter(item => 
        winCountChartState.chart.isDatasetVisible(item.datasetIndex)
    ).length;
    
    let allVisible = visibleTeams === totalTeams;
    
    // 전체선택/해제 버튼 생성
    const toggleAllButton = document.createElement('button');
    toggleAllButton.id = 'toggle-all-wincount-teams';
    toggleAllButton.textContent = allVisible ? `전체 해제 (${visibleTeams}/${totalTeams})` : `전체 선택 (${visibleTeams}/${totalTeams})`;
    toggleAllButton.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 5px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        flex-shrink: 0;
        min-height: 34px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        border: none;
    `;

    // 버튼 호버 효과
    toggleAllButton.addEventListener('mouseenter', () => {
        const hoverGradient = allVisible ? 
            'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' :
            'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
        toggleAllButton.style.background = hoverGradient;
        toggleAllButton.style.transform = 'translateY(-1px)';
        toggleAllButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
    });
    
    toggleAllButton.addEventListener('mouseleave', () => {
        const normalGradient = allVisible ? 
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        toggleAllButton.style.background = normalGradient;
        toggleAllButton.style.transform = 'translateY(0)';
        toggleAllButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
    });

    // 버튼 클릭 이벤트
    toggleAllButton.addEventListener('click', () => {
        allVisible = !allVisible;
        
        sortedTeams.forEach(item => {
            winCountChartState.chart.setDatasetVisibility(item.datasetIndex, allVisible);
        });
        
        winCountChartState.chart.update();
        
        // 버튼 텍스트 및 색상 업데이트
        const updatedVisibleTeams = allVisible ? totalTeams : 0;
        toggleAllButton.textContent = allVisible ? `전체 해제 (${updatedVisibleTeams}/${totalTeams})` : `전체 선택 (${updatedVisibleTeams}/${totalTeams})`;
        const buttonGradient = allVisible ? 
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        toggleAllButton.style.background = buttonGradient;
        
        // 모든 범례 아이템의 시각적 상태 업데이트
        const legendItems = legendContainer.querySelectorAll('div[data-team]');
        legendItems.forEach(item => {
            const img = item.querySelector('img');
            const colorBox = item.querySelector('div[style*="border-radius: 50%"]');
            const text = item.querySelector('span');
            
            const opacity = allVisible ? '1' : '0.4';
            const filter = allVisible ? 'none' : 'grayscale(100%)';
            
            item.style.opacity = opacity;
            if (img) img.style.filter = filter;
            if (colorBox) colorBox.style.opacity = opacity;
            if (text) text.style.opacity = opacity;
            
            if (!allVisible) {
                item.style.borderColor = 'rgba(0,0,0,0.2)';
                item.style.background = 'rgba(128,128,128,0.1)';
            } else {
                item.style.borderColor = 'rgba(0,0,0,0.1)';
                item.style.background = 'rgba(255,255,255,0.9)';
            }
        });
    });
    
    legendContainer.appendChild(toggleAllButton);
    
    // 팀별 레전드 아이템 생성
    sortedTeams.forEach(({teamName, datasetIndex}, index) => {
        const dataset = winCountChartState.chart.data.datasets[datasetIndex];
        if (!dataset) return;
        
        const legendItem = document.createElement('div');
        legendItem.setAttribute('data-team', teamName);
        legendItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 5px 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: rgba(255,255,255,0.9);
            border: 1px solid rgba(0,0,0,0.1);
            font-weight: 600;
            font-size: 13px;
            white-space: nowrap;
            flex-shrink: 0;
            min-height: 34px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        `;
        
        // 색상 인디케이터
        const colorBox = document.createElement('div');
        colorBox.style.cssText = `
            width: 12px;
            height: 12px;
            background-color: ${dataset.borderColor};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.2);
            flex-shrink: 0;
        `;
        
        // 팀 로고 이미지
        const logoImg = document.createElement('img');
        
        // 현재 페이지가 magic-number 폴더 내에 있는지 확인
        const isInMagicNumberFolder = window.location.pathname.includes('/magic-number/');
        const logoPath = isInMagicNumberFolder ? `images/teams/${window.getTeamLogo(teamName)}` : `magic-number/images/teams/${window.getTeamLogo(teamName)}`;
        
        logoImg.src = logoPath;
        logoImg.alt = teamName;
        logoImg.style.cssText = `
            width: 20px;
            height: 20px;
            object-fit: contain;
            border-radius: 3px;
            flex-shrink: 0;
        `;
        
        // 팀명 텍스트
        const teamText = document.createElement('span');
        teamText.textContent = teamName;
        teamText.style.cssText = `
            color: #333;
            font-weight: 600;
            font-size: 13px;
        `;
        
        // 클릭 이벤트
        legendItem.addEventListener('click', () => {
            const isVisible = winCountChartState.chart.isDatasetVisible(datasetIndex);
            winCountChartState.chart.setDatasetVisibility(datasetIndex, !isVisible);
            winCountChartState.chart.update();
            
            // 시각적 상태 업데이트
            const opacity = !isVisible ? '1' : '0.4';
            const filter = !isVisible ? 'none' : 'grayscale(100%)';
            
            legendItem.style.opacity = opacity;
            logoImg.style.filter = filter;
            colorBox.style.opacity = opacity;
            teamText.style.opacity = opacity;
            
            if (isVisible) {
                legendItem.style.borderColor = 'rgba(0,0,0,0.2)';
                legendItem.style.background = 'rgba(128,128,128,0.1)';
            } else {
                legendItem.style.borderColor = 'rgba(0,0,0,0.1)';
                legendItem.style.background = 'rgba(255,255,255,0.9)';
            }
            
            // 전체 버튼 상태 업데이트
            const currentVisibleTeams = sortedTeams.filter(item => 
                winCountChartState.chart.isDatasetVisible(item.datasetIndex)
            ).length;
            
            allVisible = currentVisibleTeams === totalTeams;
            toggleAllButton.textContent = allVisible ? `전체 해제 (${currentVisibleTeams}/${totalTeams})` : `전체 선택 (${currentVisibleTeams}/${totalTeams})`;
            const buttonGradient = allVisible ? 
                'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
            toggleAllButton.style.background = buttonGradient;
        });
        
        // 호버 효과
        legendItem.addEventListener('mouseenter', () => {
            legendItem.style.transform = 'translateY(-1px)';
            legendItem.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
        });
        
        legendItem.addEventListener('mouseleave', () => {
            legendItem.style.transform = 'translateY(0)';
            legendItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
        });
        
        // 요소 조합
        legendItem.appendChild(colorBox);
        legendItem.appendChild(logoImg);
        legendItem.appendChild(teamText);
        
        legendContainer.appendChild(legendItem);
    });
}

// =============================================================================
// 승차 변화 추이 차트용 커스텀 레전드 생성 함수 (전역 노출)
// =============================================================================
window.createWinGapCustomLegend = function createWinGapCustomLegend(teams, chartInstance) {
    console.log('createWinGapCustomLegend 함수 호출됨', teams, chartInstance);
    const legendContainer = document.getElementById('winGapChartLegend');
    console.log('레전드 컨테이너:', legendContainer);
    if (!legendContainer || !chartInstance) {
        console.log('레전드 컨테이너 또는 차트 인스턴스가 없음');
        return;
    }
    
    // 기존 레전드 제거
    legendContainer.innerHTML = '';
    
    // 레전드 컨테이너 스타일 설정
    legendContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 8px;
        margin-top: 5px;
        margin-bottom: 0;
        padding: 0 10px;
        background: none;
        border-radius: 0;
        box-shadow: none;
        border: none;
        width: 100%;
        box-sizing: border-box;
    `;

    // 메인 페이지 현재 순위 순서대로 팀 정렬 (순위 변동 차트와 동일한 방식)
    let sortedTeams;
    if (window.getRankingSystem) {
        const rankingSystem = window.getRankingSystem();
        if (rankingSystem.teams.length > 0) {
            sortedTeams = rankingSystem.teams.map(teamName => {
                const datasetIndex = chartInstance.data.datasets.findIndex(d => d.label === teamName);
                return {
                    teamName: teamName,
                    rank: rankingSystem.teamRanks[teamName],
                    datasetIndex: datasetIndex >= 0 ? datasetIndex : -1
                };
            }).filter(item => item.datasetIndex !== -1);
        } else {
            // 기본값으로 fallback
            sortedTeams = teams.map(team => ({
                teamName: team,
                datasetIndex: chartInstance.data.datasets.findIndex(d => d.label === team)
            })).filter(item => item.datasetIndex !== -1);
        }
    } else {
        // getRankingSystem이 없을 때 기본값
        sortedTeams = teams.map(team => ({
            teamName: team,
            datasetIndex: chartInstance.data.datasets.findIndex(d => d.label === team)
        })).filter(item => item.datasetIndex !== -1);
    }
    
    // 선택된 팀 수 계산
    const totalTeams = sortedTeams.length;
    const visibleTeams = sortedTeams.filter(item => 
        chartInstance.isDatasetVisible(item.datasetIndex)
    ).length;
    
    let allVisible = visibleTeams === totalTeams;
    
    // 전체선택/해제 버튼 생성
    const toggleAllButton = document.createElement('button');
    toggleAllButton.id = 'toggle-all-wingap-teams';
    toggleAllButton.textContent = allVisible ? `전체 해제 (${visibleTeams}/${totalTeams})` : `전체 선택 (${visibleTeams}/${totalTeams})`;
    toggleAllButton.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 5px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        flex-shrink: 0;
        min-height: 34px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        border: none;
    `;

    // 버튼 호버 효과
    toggleAllButton.addEventListener('mouseenter', () => {
        const hoverGradient = allVisible ? 
            'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' :
            'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
        toggleAllButton.style.background = hoverGradient;
        toggleAllButton.style.transform = 'translateY(-1px)';
        toggleAllButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
    });
    
    toggleAllButton.addEventListener('mouseleave', () => {
        const normalGradient = allVisible ? 
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        toggleAllButton.style.background = normalGradient;
        toggleAllButton.style.transform = 'translateY(0)';
        toggleAllButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
    });

    // 버튼 클릭 이벤트
    toggleAllButton.addEventListener('click', () => {
        allVisible = !allVisible;
        
        sortedTeams.forEach(item => {
            chartInstance.setDatasetVisibility(item.datasetIndex, allVisible);
        });
        
        chartInstance.update();
        
        // 버튼 텍스트 및 색상 업데이트
        const updatedVisibleTeams = allVisible ? totalTeams : 0;
        toggleAllButton.textContent = allVisible ? `전체 해제 (${updatedVisibleTeams}/${totalTeams})` : `전체 선택 (${updatedVisibleTeams}/${totalTeams})`;
        const buttonGradient = allVisible ? 
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        toggleAllButton.style.background = buttonGradient;
        
        // 모든 범례 아이템의 시각적 상태 업데이트
        const legendItems = legendContainer.querySelectorAll('div[data-team]');
        legendItems.forEach(item => {
            const img = item.querySelector('img');
            const colorBox = item.querySelector('div[style*="border-radius: 50%"]');
            const text = item.querySelector('span');
            
            const opacity = allVisible ? '1' : '0.4';
            const filter = allVisible ? 'none' : 'grayscale(100%)';
            
            item.style.opacity = opacity;
            if (img) img.style.filter = filter;
            if (colorBox) colorBox.style.opacity = opacity;
            if (text) text.style.opacity = opacity;
            
            if (!allVisible) {
                item.style.borderColor = 'rgba(0,0,0,0.2)';
                item.style.background = 'rgba(128,128,128,0.1)';
            } else {
                item.style.borderColor = 'rgba(0,0,0,0.1)';
                item.style.background = 'rgba(255,255,255,0.9)';
            }
        });
    });
    
    legendContainer.appendChild(toggleAllButton);
    
    // 팀별 레전드 아이템 생성
    sortedTeams.forEach(({teamName, datasetIndex}, index) => {
        const dataset = chartInstance.data.datasets[datasetIndex];
        if (!dataset) return;
        
        const legendItem = document.createElement('div');
        legendItem.setAttribute('data-team', teamName);
        legendItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 5px 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: rgba(255,255,255,0.9);
            border: 1px solid rgba(0,0,0,0.1);
            font-weight: 600;
            font-size: 13px;
            white-space: nowrap;
            flex-shrink: 0;
            min-height: 34px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        `;
        
        // 색상 인디케이터
        const colorBox = document.createElement('div');
        colorBox.style.cssText = `
            width: 12px;
            height: 12px;
            background-color: ${dataset.borderColor};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.2);
            flex-shrink: 0;
        `;
        
        // 팀 로고 이미지
        const logoImg = document.createElement('img');
        
        // 현재 페이지가 magic-number 폴더 내에 있는지 확인
        const isInMagicNumberFolder = window.location.pathname.includes('/magic-number/');
        const logoPath = isInMagicNumberFolder ? `images/teams/${window.getTeamLogo(teamName)}` : `magic-number/images/teams/${window.getTeamLogo(teamName)}`;
        
        logoImg.src = logoPath;
        logoImg.alt = teamName;
        logoImg.style.cssText = `
            width: 20px;
            height: 20px;
            object-fit: contain;
            border-radius: 3px;
            flex-shrink: 0;
        `;
        
        // 팀명 텍스트
        const teamText = document.createElement('span');
        teamText.textContent = teamName;
        teamText.style.cssText = `
            color: #333;
            font-weight: 600;
            font-size: 13px;
        `;
        
        // 클릭 이벤트
        legendItem.addEventListener('click', () => {
            const isVisible = chartInstance.isDatasetVisible(datasetIndex);
            chartInstance.setDatasetVisibility(datasetIndex, !isVisible);
            chartInstance.update();
            
            // 시각적 상태 업데이트
            const opacity = !isVisible ? '1' : '0.4';
            const filter = !isVisible ? 'none' : 'grayscale(100%)';
            
            legendItem.style.opacity = opacity;
            logoImg.style.filter = filter;
            colorBox.style.opacity = opacity;
            teamText.style.opacity = opacity;
            
            if (isVisible) {
                legendItem.style.borderColor = 'rgba(0,0,0,0.2)';
                legendItem.style.background = 'rgba(128,128,128,0.1)';
            } else {
                legendItem.style.borderColor = 'rgba(0,0,0,0.1)';
                legendItem.style.background = 'rgba(255,255,255,0.9)';
            }
            
            // 전체 버튼 상태 업데이트
            const currentVisibleTeams = sortedTeams.filter(item => 
                chartInstance.isDatasetVisible(item.datasetIndex)
            ).length;
            
            allVisible = currentVisibleTeams === totalTeams;
            toggleAllButton.textContent = allVisible ? `전체 해제 (${currentVisibleTeams}/${totalTeams})` : `전체 선택 (${currentVisibleTeams}/${totalTeams})`;
            const buttonGradient = allVisible ? 
                'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
            toggleAllButton.style.background = buttonGradient;
        });
        
        // 호버 효과
        legendItem.addEventListener('mouseenter', () => {
            legendItem.style.transform = 'translateY(-1px)';
            legendItem.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
        });
        
        legendItem.addEventListener('mouseleave', () => {
            legendItem.style.transform = 'translateY(0)';
            legendItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
        });
        
        // 요소 조합
        legendItem.appendChild(colorBox);
        legendItem.appendChild(logoImg);
        legendItem.appendChild(teamText);
        
        legendContainer.appendChild(legendItem);
    });
};