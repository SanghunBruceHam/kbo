/**
 * 주차별 성적 및 게임별 기록 표시 모듈
 */

class WeeklyAnalysisDisplay {
    constructor() {
        this.weeklyData = null;
        this.gameRecordsData = null;
        this.currentTeam = 'LG';
        this.currentView = 'weekly'; // 'weekly' or 'gameByGame'
    }

    /**
     * 데이터 로드
     */
    async loadData() {
        try {
            const [weeklyResponse, recordsResponse] = await Promise.all([
                fetch('data/weekly-analysis.json'),
                fetch('data/game-by-game-records.json')
            ]);
            
            if (!weeklyResponse.ok) {
                throw new Error(`주차별 분석 데이터 로드 실패: ${weeklyResponse.status}`);
            }
            if (!recordsResponse.ok) {
                throw new Error(`게임 기록 데이터 로드 실패: ${recordsResponse.status}`);
            }
            
            this.weeklyData = await weeklyResponse.json();
            this.gameRecordsData = await recordsResponse.json();
            
            // 데이터 검증
            if (!this.weeklyData || !this.weeklyData.weeklyAnalysis) {
                throw new Error('주차별 분석 데이터 구조가 올바르지 않습니다');
            }
            
            console.log('✅ 주차별 분석 데이터 로드 완료');
            console.log('데이터 구조:', {
                currentWeek: this.weeklyData.currentWeek,
                hasWeeklyAnalysis: !!this.weeklyData.weeklyAnalysis,
                teams: this.weeklyData.weeklyAnalysis ? Object.keys(this.weeklyData.weeklyAnalysis) : []
            });
            return true;
        } catch (error) {
            console.error('❌ 주차별 데이터 로드 실패:', error);
            this.weeklyData = null;
            this.gameRecordsData = null;
            return false;
        }
    }

    /**
     * 주차별 성적 테이블 생성
     */
    renderWeeklyTable() {
        console.log('렌더링 시작 - 데이터 체크:', {
            hasWeeklyData: !!this.weeklyData,
            hasWeeklyAnalysis: !!(this.weeklyData && this.weeklyData.weeklyAnalysis),
            dataKeys: this.weeklyData ? Object.keys(this.weeklyData) : []
        });
        
        if (!this.weeklyData || !this.weeklyData.weeklyAnalysis) {
            return '<div class="weekly-analysis-container"><p style="text-align: center; color: #666; margin: 20px;">주차별 데이터를 로드할 수 없습니다.</p></div>';
        }

        const teams = ['LG', '한화', 'KIA', '삼성', 'KT', 'SSG', '롯데', '두산', 'NC', '키움'];
        const maxWeeks = this.weeklyData.currentWeek || 20;

        let html = `
        <div class="weekly-analysis-container">
            <h2>📅 주차별 성적 분석 (${this.weeklyData.currentWeek}주차까지)</h2>
            <p class="update-info">🕒 업데이트: ${this.weeklyData.updateDate} | 시즌 시작: 2025년 3월 22일</p>
            <div class="table-wrapper">
                <table class="weekly-table">
                    <thead>
                        <tr>
                            <th rowspan="2">주차</th>
                            <th rowspan="2">기간</th>
                            <th colspan="${teams.length}">팀별 성적 (승-패-무)</th>
                        </tr>
                        <tr>
                            ${teams.map(team => `<th class="team-header">${team}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>`;

        for (let week = 1; week <= maxWeeks; week++) {
            // 실제 분석 데이터에서 기간 정보 가져오기
            let startStr = `${week}주차`;
            let endStr = '';
            
            // 첫 번째 팀의 주차별 데이터에서 기간 정보 추출
            const firstTeam = teams.find(team => this.weeklyData.weeklyAnalysis[team]?.weeklyStats?.[week]);
            if (firstTeam) {
                const weekData = this.weeklyData.weeklyAnalysis[firstTeam].weeklyStats[week];
                if (weekData && weekData.range) {
                    startStr = weekData.range.startStr;
                    endStr = weekData.range.endStr;
                }
            }

            html += `
                <tr>
                    <td class="week-cell">${week}주차</td>
                    <td class="date-cell">${startStr}${endStr ? ` ~ ${endStr}` : ''}</td>
                    ${teams.map(team => {
                        const teamAnalysis = this.weeklyData.weeklyAnalysis && this.weeklyData.weeklyAnalysis[team];
                        const weekStats = teamAnalysis && teamAnalysis.weeklyStats && teamAnalysis.weeklyStats[week] || { 
                            games: 0, wins: 0, losses: 0, draws: 0, winRate: '0.0' 
                        };
                        
                        if (weekStats.games === 0) {
                            return `<td style="background-color: #f3f4f6 !important; color: #6b7280 !important; text-align: center; padding: 8px 4px;">-</td>`;
                        }
                        
                        const winRate = parseFloat(weekStats.winRate);
                        const bgColor = this.getWinRateColor(winRate);
                        const textColor = this.getTextColor(winRate);
                        
                        // 요일별 성적 분석과 동일한 HTML 구조 및 스타일 적용
                        return `
                            <td style="background-color: ${bgColor} !important; padding: 8px 4px !important; text-align: center !important; border: 1px solid #e5e7eb !important;">
                                <div style="color: ${textColor} !important; line-height: 1.2 !important; margin-bottom: 2px !important;">
                                    ${weekStats.wins}-${weekStats.losses}${weekStats.draws > 0 ? `-${weekStats.draws}` : ''}
                                </div>
                                <div style="color: ${textColor} !important;">
                                    ${weekStats.winRate}%
                                </div>
                                <div style="color: ${textColor} !important; margin-top: 2px !important; opacity: 0.9 !important;">
                                    ${weekStats.games}경기
                                </div>
                            </td>
                        `;
                    }).join('')}
                </tr>`;
        }

        html += `
                    </tbody>
                </table>
            </div>
        </div>`;

        return html;
    }

    /**
     * 게임별 승패 기록 테이블 생성
     */
    renderGameByGameTable(team = 'LG') {
        if (!this.gameRecordsData || !this.gameRecordsData[team]) return '';

        const teamRecord = this.gameRecordsData[team];
        const games = teamRecord.games;

        let html = `
        <div class="game-by-game-container">
            <h2>🏆 ${team} 게임별 승패 기록</h2>
            
            <div class="team-tabs">
                ${Object.keys(this.gameRecordsData).map(t => 
                    `<button class="team-tab ${t === team ? 'active' : ''}" onclick="weeklyAnalysisDisplay.changeTeam('${t}')">${t}</button>`
                ).join('')}
            </div>

            <div class="streak-summary">
                <div class="streak-item">
                    <span class="streak-label">현재 연속기록:</span>
                    <span class="streak-value ${teamRecord.currentStreak.type === 'W' ? 'win-streak' : teamRecord.currentStreak.type === 'L' ? 'lose-streak' : 'neutral-streak'}">
                        ${teamRecord.currentStreak.type === 'W' ? `${teamRecord.currentStreak.count}연승` : 
                          teamRecord.currentStreak.type === 'L' ? `${teamRecord.currentStreak.count}연패` : '없음'}
                    </span>
                </div>
                <div class="streak-item">
                    <span class="streak-label">최장 연승:</span>
                    <span class="streak-value win-streak">${teamRecord.longestWinStreak}연승</span>
                </div>
                <div class="streak-item">
                    <span class="streak-label">최장 연패:</span>
                    <span class="streak-value lose-streak">${teamRecord.longestLoseStreak}연패</span>
                </div>
                <div class="streak-item">
                    <span class="streak-label">전체 전적:</span>
                    <span class="streak-value neutral-streak">${games.filter(g => g.result === 'W').length}승 ${games.filter(g => g.result === 'L').length}패 ${games.filter(g => g.result === 'D').length}무</span>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="game-record-table">
                    <thead>
                        <tr>
                            <th>경기#</th>
                            <th>날짜</th>
                            <th>상대팀</th>
                            <th>홈/원정</th>
                            <th>스코어</th>
                            <th>득점</th>
                            <th>실점</th>
                        </tr>
                    </thead>
                    <tbody>`;

        games.forEach(game => {
            const resultText = game.result === 'W' ? 'W' : game.result === 'L' ? 'L' : 'D';
            html += `
                <tr class="${game.result === 'W' ? 'win-row' : game.result === 'L' ? 'loss-row' : 'draw-row'}">
                    <td>
                        <span class="game-number">${game.gameNumber}</span>
                        <span class="result-badge ${game.result.toLowerCase()}">${resultText}</span>
                    </td>
                    <td>${game.date}</td>
                    <td>${game.opponent}</td>
                    <td>${game.isHome ? '홈' : '원정'}</td>
                    <td class="score-cell">${game.score}</td>
                    <td>${game.runs_scored}</td>
                    <td>${game.runs_allowed}</td>
                </tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        </div>`;

        return html;
    }

    /**
     * 승률에 따른 배경색 계산 (요일별 성적 분석과 완전히 동일)
     */
    getWinRateColor(winRate) {
        if (winRate >= 80) return '#065f46';        // 매우 진한 에메랄드 (80%+ 최고)
        if (winRate >= 70) return '#047857';        // 진한 에메랄드 (70%+ 뛰어남)
        if (winRate >= 60) return '#059669';        // 에메랄드 (60%+ 매우 좋음) 
        if (winRate >= 50) return '#10b981';        // 연한 에메랄드 (50%+ 좋음)
        if (winRate >= 40) return '#f59e0b';        // 엠버 (40%+ 보통)
        if (winRate >= 30) return '#ea580c';        // 오렌지 (30%+ 나쁨)
        if (winRate >= 20) return '#dc2626';        // 빨강 (20%+ 매우 나쁨)
        if (winRate > 0) return '#991b1b';          // 진한 빨강 (0%+ 심각)
        return '#6b7280';                           // 회색 (경기 없음)
    }

    /**
     * 승률에 따른 텍스트 색상 계산 (요일별 성적 분석과 완전히 동일)
     */
    getTextColor(winRate) {
        if (winRate >= 50) return '#ffffff';   // 에메랄드계열 배경: 흰색 텍스트
        if (winRate >= 40) return '#000000';   // 엠버 배경: 검은색 텍스트  
        if (winRate >= 30) return '#ffffff';   // 오렌지 배경: 흰색 텍스트
        if (winRate > 0) return '#ffffff';     // 빨강 배경: 흰색 텍스트
        return '#ffffff';                      // 회색 배경: 흰색 텍스트
    }

    /**
     * 팀 변경 핸들러
     */
    changeTeam(team) {
        this.currentTeam = team;
        this.render();
    }

    /**
     * 뷰 변경 핸들러
     */
    changeView(view) {
        this.currentView = view;
        this.render();
    }

    /**
     * 색상 강제 적용 함수 - 모든 DOM 조작
     */
    forceColors() {
        setTimeout(() => {
            // 주차별 테이블의 모든 데이터 셀 찾기
            const tables = document.querySelectorAll('.weekly-table');
            tables.forEach(table => {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach((row, weekIndex) => {
                    const cells = row.querySelectorAll('td');
                    cells.forEach((cell, teamIndex) => {
                        // 주차와 날짜 셀 제외 (인덱스 2부터가 팀 데이터)
                        if (teamIndex >= 2) {
                            const teams = ['LG', '한화', 'KIA', '삼성', 'KT', 'SSG', '롯데', '두산', 'NC', '키움'];
                            const team = teams[teamIndex - 2];
                            const week = weekIndex + 1;
                            
                            if (this.weeklyData?.weeklyAnalysis?.[team]?.weeklyStats?.[week]) {
                                const weekStats = this.weeklyData.weeklyAnalysis[team].weeklyStats[week];
                                if (weekStats.games > 0) {
                                    const winRate = parseFloat(weekStats.winRate);
                                    const bgColor = this.getWinRateColor(winRate);
                                    const textColor = this.getTextColor(winRate);
                                    
                                    // 셀 전체 스타일 완전 덮어쓰기
                                    cell.style.cssText = `
                                        background-color: ${bgColor} !important;
                                        color: ${textColor} !important;
                                        padding: 8px 4px !important;
                                        text-align: center !important;
                                        border: 1px solid #ddd !important;
                                    `;
                                    
                                    // 모든 자식 요소 색상 강제 적용
                                    const allChildren = cell.querySelectorAll('*');
                                    allChildren.forEach(child => {
                                        child.style.cssText = `color: ${textColor} !important;`;
                                    });
                                }
                            }
                        }
                    });
                });
            });
        }, 200);
    }

    /**
     * 메인 렌더링 함수
     */
    render() {
        let html = `
        <div class="analysis-controls">
            <button onclick="weeklyAnalysisDisplay.changeView('weekly')" 
                    class="${this.currentView === 'weekly' ? 'active' : ''}">
                주차별 성적
            </button>
            <button onclick="weeklyAnalysisDisplay.changeView('gameByGame')" 
                    class="${this.currentView === 'gameByGame' ? 'active' : ''}">
                게임별 기록
            </button>
        </div>
        `;

        if (this.currentView === 'weekly') {
            html += this.renderWeeklyTable();
        } else {
            html += this.renderGameByGameTable(this.currentTeam);
        }

        const container = document.getElementById('weeklyAnalysisContainer');
        if (container) {
            container.innerHTML = html;
            
            // 통합 CSS 시스템 사용으로 인해 색상 강제 적용 불필요
            // CSS 클래스가 자동으로 스타일 적용함
        }
    }

    /**
     * 초기화
     */
    async init() {
        const container = document.getElementById('weeklyAnalysisContainer');
        if (!container) {
            console.warn('주차별 분석 컨테이너를 찾을 수 없습니다');
            return;
        }
        
        container.innerHTML = '<p style="text-align: center; color: #666; margin: 20px;">📊 주차별 분석 데이터 로딩 중...</p>';
        
        // 약간의 딜레이를 추가하여 다른 스크립트들이 로드되기를 기다림
        setTimeout(async () => {
            try {
                const loadSuccess = await this.loadData();
                if (loadSuccess) {
                    this.render();
                } else {
                    container.innerHTML = '<div class="weekly-analysis-container"><p style="text-align: center; color: #e74c3c; margin: 20px;">❌ 주차별 분석 데이터를 로드할 수 없습니다. 나중에 다시 시도해주세요.</p></div>';
                }
            } catch (error) {
                console.error('주차별 분석 초기화 오류:', error);
                container.innerHTML = '<div class="weekly-analysis-container"><p style="text-align: center; color: #e74c3c; margin: 20px;">❌ 주차별 분석을 초기화할 수 없습니다.</p></div>';
            }
        }, 1000);
    }
}

// 전역 인스턴스 생성
const weeklyAnalysisDisplay = new WeeklyAnalysisDisplay();

// 통합 CSS 스타일 시스템 로드
const analysisStyles = `
<link rel="stylesheet" href="css/unified-styles.css">
<style>
/* 주차별 분석 전용 확장 스타일 */
/* 모든 스타일이 통합 CSS에 정의되어 있음 - 확장 스타일만 필요시 추가 */

/* 게임별 기록 전용 추가 스타일 (통합 CSS로 대부분 커버됨) */
.team-tabs {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 15px 0;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 8px;
}

.team-tab {
    padding: 8px 16px;
    font-size: 14px;
    border: 2px solid #ddd;
    border-radius: 20px;
    background: white;
    color: #666;
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 50px;
}

.team-tab:hover {
    background: #e3f2fd;
    border-color: #2196F3;
    color: #2196F3;
    transform: translateY(-1px);
}

.team-tab.active {
    background: linear-gradient(135deg, #2196F3, #1976D2);
    color: white;
    border-color: #1976D2;
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
}

.streak-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin: 15px 0;
}

.streak-item {
    text-align: center;
}

.streak-label {
    display: block;
    font-size: 12px;
    color: #666;
    margin-bottom: 5px;
}

.streak-value {
    display: block;
    font-size: 16px;
}

.win-streak { color: #4CAF50; }
.lose-streak { color: #F44336; }
.neutral-streak { color: #666; }

.win-row { background-color: rgba(76, 175, 80, 0.1); }
.loss-row { background-color: rgba(244, 67, 54, 0.1); }
.draw-row { background-color: rgba(255, 235, 59, 0.1); }

.score-cell { }
.game-number { margin-right: 8px; }

.result-badge {
    padding: 2px 6px;
    border-radius: 12px;
    font-size: 10px;
    display: inline-block;
    min-width: 16px;
    text-align: center;
}

.result-badge.w { background: #4CAF50; color: white; }
.result-badge.l { background: #F44336; color: white; }
.result-badge.d { background: #FF9800; color: white; }
</style>
`;

// 스타일 추가
document.head.insertAdjacentHTML('beforeend', analysisStyles);