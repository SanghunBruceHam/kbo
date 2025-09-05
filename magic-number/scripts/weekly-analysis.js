/**
 * KBO 2025 주차별 성적 분석
 * 1주차는 3월 22일부터 시작, 주차별 팀 성적 추이 분석
 */

const fs = require('fs');
const path = require('path');

class WeeklyAnalyzer {
    constructor() {
        this.teams = ['LG', '한화', 'KIA', '삼성', 'KT', 'SSG', '롯데', '두산', 'NC', '키움'];
        this.gameRecords = null;
        this.weeklyData = {};
        this.allGameDates = [];
        this.weekRanges = {};
        
        // 2025시즌 시작일: 3월 22일 (토요일) - 기본값
        this.seasonStart = new Date('2025-03-22');
        this.currentWeek = 1;
    }

    /**
     * 게임 기록 데이터 로드 및 주차 계산
     */
    loadGameRecords() {
        try {
            const dataPath = path.join(__dirname, '../data/game-by-game-records.json');
            this.gameRecords = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            
            // 모든 경기 날짜 수집
            this.collectAllGameDates();
            
            // 주차별 기간 계산
            this.calculateWeekRanges();
            
            console.log('✅ 게임 기록 데이터 로드 완료');
            console.log(`📅 시즌 기간: ${this.seasonStart.toLocaleDateString('ko-KR')} ~ 현재 ${this.currentWeek}주차`);
        } catch (error) {
            console.error('❌ 게임 기록 로드 실패:', error.message);
        }
    }
    
    /**
     * 모든 경기 날짜 수집
     */
    collectAllGameDates() {
        const dateSet = new Set();
        
        this.teams.forEach(team => {
            if (this.gameRecords[team] && this.gameRecords[team].games) {
                this.gameRecords[team].games.forEach(game => {
                    dateSet.add(game.date);
                });
            }
        });
        
        this.allGameDates = Array.from(dateSet).sort();
        
        if (this.allGameDates.length > 0) {
            this.seasonStart = new Date(this.allGameDates[0]);
        }
    }
    
    /**
     * KBO 주차 기준으로 주차별 기간 계산 (화요일~월요일)
     */
    calculateWeekRanges() {
        if (this.allGameDates.length === 0) return;
        
        this.weekRanges = {};
        
        // 1주차: 2025-03-22(토), 2025-03-23(일) - 시즌 오프닝
        this.weekRanges[1] = {
            start: new Date('2025-03-22'),
            end: new Date('2025-03-23'),
            startStr: '3월 22일',
            endStr: '3월 23일'
        };
        
        // 2주차부터는 화요일 시작 (3월 25일부터)
        let weekStart = new Date('2025-03-25'); // 2주차 시작 (화요일)
        let currentWeek = 2;
        
        const lastGameDate = new Date(this.allGameDates[this.allGameDates.length - 1]);
        
        while (weekStart <= lastGameDate) {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6); // 월요일까지 (화~월 = 7일)
            
            this.weekRanges[currentWeek] = {
                start: new Date(weekStart),
                end: new Date(weekEnd),
                startStr: weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                endStr: weekEnd.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
            };
            
            // 다음 주차 (다음 화요일)
            weekStart.setDate(weekStart.getDate() + 7);
            currentWeek++;
        }
        
        this.currentWeek = currentWeek - 1;
    }

    /**
     * 날짜에서 주차 계산
     */
    getWeekFromDate(dateStr) {
        const gameDate = new Date(dateStr);
        
        // 계산된 주차 범위에서 해당 날짜가 속한 주차 찾기
        for (const [week, range] of Object.entries(this.weekRanges)) {
            if (gameDate >= range.start && gameDate <= range.end) {
                return parseInt(week);
            }
        }
        
        return 0; // 범위에 없는 경우
    }

    /**
     * 주차별 기간 정보 반환
     */
    getWeekRange(week) {
        return this.weekRanges[week] || null;
    }

    /**
     * 스코어에서 득점/실점 추출
     */
    parseScore(scoreStr) {
        const parts = scoreStr.split(':');
        if (parts.length === 2) {
            return {
                scored: parseInt(parts[0]) || 0,
                allowed: parseInt(parts[1]) || 0
            };
        }
        return { scored: 0, allowed: 0 };
    }

    /**
     * 팀별 주차별 성적 분석
     */
    analyzeWeeklyPerformance() {
        this.teams.forEach(team => {
            if (!this.gameRecords[team]) return;

            const games = this.gameRecords[team].games;
            const weeklyStats = {};
            
            // 주차별 초기화
            for (let week = 1; week <= this.currentWeek; week++) {
                const range = this.getWeekRange(week);
                weeklyStats[week] = {
                    week: week,
                    range: range,
                    games: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: '0.0',
                    runsScored: 0,
                    runsAllowed: 0,
                    runDifferential: 0,
                    avgRunsScored: '0.0',
                    avgRunsAllowed: '0.0',
                    gameDetails: []
                };
            }

            // 각 경기를 주차별로 분류
            games.forEach(game => {
                const week = this.getWeekFromDate(game.date);
                if (week === 0 || week > this.currentWeek) return;

                const weekStat = weeklyStats[week];
                const score = this.parseScore(game.score);

                weekStat.games++;
                if (game.result === 'W') weekStat.wins++;
                else if (game.result === 'L') weekStat.losses++;
                else if (game.result === 'D') weekStat.draws++;

                weekStat.runsScored += score.scored;
                weekStat.runsAllowed += score.allowed;

                weekStat.gameDetails.push({
                    date: game.date,
                    opponent: game.opponent,
                    score: game.score,
                    result: game.result,
                    isHome: game.isHome
                });
            });

            // 주차별 통계 계산
            Object.keys(weeklyStats).forEach(week => {
                const stat = weeklyStats[week];
                const decisiveGames = stat.wins + stat.losses;

                if (decisiveGames > 0) {
                    stat.winRate = ((stat.wins / decisiveGames) * 100).toFixed(1);
                }

                if (stat.games > 0) {
                    stat.avgRunsScored = (stat.runsScored / stat.games).toFixed(2);
                    stat.avgRunsAllowed = (stat.runsAllowed / stat.games).toFixed(2);
                }

                stat.runDifferential = stat.runsScored - stat.runsAllowed;
            });

            // 추가 분석: 주차별 트렌드
            const weeklyAnalysis = {
                totalWeeks: this.currentWeek,
                weeklyStats: weeklyStats,
                
                // 주차별 순위 변동 (간단 버전)
                trends: {
                    bestWeek: this.getBestWeek(weeklyStats),
                    worstWeek: this.getWorstWeek(weeklyStats),
                    mostGamesWeek: this.getMostGamesWeek(weeklyStats),
                    highestScoringWeek: this.getHighestScoringWeek(weeklyStats)
                },
                
                // 월별 요약
                monthlySummary: this.calculateMonthlySummary(weeklyStats)
            };

            this.weeklyData[team] = weeklyAnalysis;
        });
    }

    /**
     * 가장 좋았던 주차 찾기
     */
    getBestWeek(weeklyStats) {
        let bestWeek = null;
        let bestWinRate = -1;

        Object.values(weeklyStats).forEach(week => {
            const winRate = parseFloat(week.winRate);
            if (week.games > 0 && winRate > bestWinRate) {
                bestWinRate = winRate;
                bestWeek = week;
            }
        });

        return bestWeek;
    }

    /**
     * 가장 안좋았던 주차 찾기
     */
    getWorstWeek(weeklyStats) {
        let worstWeek = null;
        let worstWinRate = 101;

        Object.values(weeklyStats).forEach(week => {
            const winRate = parseFloat(week.winRate);
            if (week.games > 0 && winRate < worstWinRate) {
                worstWinRate = winRate;
                worstWeek = week;
            }
        });

        return worstWeek;
    }

    /**
     * 가장 많은 경기를 한 주차
     */
    getMostGamesWeek(weeklyStats) {
        let mostGamesWeek = null;
        let maxGames = 0;

        Object.values(weeklyStats).forEach(week => {
            if (week.games > maxGames) {
                maxGames = week.games;
                mostGamesWeek = week;
            }
        });

        return mostGamesWeek;
    }

    /**
     * 가장 많이 득점한 주차
     */
    getHighestScoringWeek(weeklyStats) {
        let highestScoringWeek = null;
        let maxRuns = 0;

        Object.values(weeklyStats).forEach(week => {
            if (week.runsScored > maxRuns) {
                maxRuns = week.runsScored;
                highestScoringWeek = week;
            }
        });

        return highestScoringWeek;
    }

    /**
     * 월별 요약 계산
     */
    calculateMonthlySummary(weeklyStats) {
        const monthlySummary = {};

        Object.values(weeklyStats).forEach(week => {
            if (week.games === 0) return;

            const month = week.range.start.getMonth() + 1; // 1-12
            const monthKey = `${month}월`;

            if (!monthlySummary[monthKey]) {
                monthlySummary[monthKey] = {
                    games: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    runsScored: 0,
                    runsAllowed: 0,
                    weeks: []
                };
            }

            const monthly = monthlySummary[monthKey];
            monthly.games += week.games;
            monthly.wins += week.wins;
            monthly.losses += week.losses;
            monthly.draws += week.draws;
            monthly.runsScored += week.runsScored;
            monthly.runsAllowed += week.runsAllowed;
            monthly.weeks.push(week.week);
        });

        // 월별 승률 계산
        Object.keys(monthlySummary).forEach(month => {
            const monthly = monthlySummary[month];
            const decisiveGames = monthly.wins + monthly.losses;
            monthly.winRate = decisiveGames > 0 ? ((monthly.wins / decisiveGames) * 100).toFixed(1) : '0.0';
            monthly.avgRunsScored = monthly.games > 0 ? (monthly.runsScored / monthly.games).toFixed(2) : '0.0';
            monthly.avgRunsAllowed = monthly.games > 0 ? (monthly.runsAllowed / monthly.games).toFixed(2) : '0.0';
            monthly.runDifferential = monthly.runsScored - monthly.runsAllowed;
        });

        return monthlySummary;
    }

    /**
     * 분석 결과 저장
     */
    saveAnalysis() {
        const result = {
            lastUpdated: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR'),
            seasonStart: this.seasonStart.toISOString(),
            currentWeek: this.currentWeek,
            weeklyAnalysis: this.weeklyData
        };

        const outputPath = path.join(__dirname, '../data/weekly-analysis.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
        console.log('✅ 주차별 분석 결과 저장 완료:', outputPath);
    }

    /**
     * 요약 출력
     */
    printSummary() {
        console.log(`\n📅 주차별 성적 분석 요약 (${this.currentWeek}주차까지)`);
        console.log('='.repeat(60));

        console.log(`🏁 시즌 시작일: ${this.seasonStart.toLocaleDateString('ko-KR')}`);
        console.log(`📊 현재 주차: ${this.currentWeek}주차`);

        // 각 팀의 최고/최악 주차 요약
        this.teams.forEach(team => {
            if (!this.weeklyData[team]) return;

            const analysis = this.weeklyData[team];
            const bestWeek = analysis.trends.bestWeek;
            const worstWeek = analysis.trends.worstWeek;

            console.log(`\n🏅 ${team}:`);
            if (bestWeek) {
                console.log(`  최고: ${bestWeek.week}주차 (${bestWeek.range.startStr}~${bestWeek.range.endStr}) - ${bestWeek.winRate}% (${bestWeek.wins}승${bestWeek.losses}패)`);
            }
            if (worstWeek) {
                console.log(`  최악: ${worstWeek.week}주차 (${worstWeek.range.startStr}~${worstWeek.range.endStr}) - ${worstWeek.winRate}% (${worstWeek.wins}승${worstWeek.losses}패)`);
            }
        });
    }

    /**
     * 전체 분석 실행
     */
    analyze() {
        console.log('📅 KBO 2025 주차별 성적 분석 시작...');
        
        this.loadGameRecords();
        if (!this.gameRecords) {
            console.error('❌ 게임 기록을 로드할 수 없어 분석을 중단합니다.');
            return;
        }

        this.analyzeWeeklyPerformance();
        this.saveAnalysis();
        this.printSummary();

        console.log('\n✅ 주차별 성적 분석 완료!');
        return this.weeklyData;
    }
}

// 모듈 실행
if (require.main === module) {
    const analyzer = new WeeklyAnalyzer();
    analyzer.analyze();
}

module.exports = WeeklyAnalyzer;