/**
 * KBO 2025 홈/원정 상세 분석
 * 홈 어드밴티지, 홈/원정 성적, 구장별 성적 등 종합 분석
 */

const fs = require('fs');
const path = require('path');
const { StadiumHelper } = require('../config/stadium-mapping');

class HomeAwayAnalyzer {
    constructor() {
        this.teams = ['LG', '한화', 'KIA', '삼성', 'KT', 'SSG', '롯데', '두산', 'NC', '키움'];
        this.gameRecords = null;
        this.homeAwayData = {};
        
    }

    /**
     * 게임 기록 데이터 로드
     */
    loadGameRecords() {
        try {
            const dataPath = path.join(__dirname, '../data/raw-game-records.json');
            this.gameRecords = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            console.log('✅ 게임 기록 데이터 로드 완료');
        } catch (error) {
            console.error('❌ 게임 기록 로드 실패:', error.message);
        }
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
     * 구장 이름 추출 및 표준화
     */
    getStadium(opponent, isHome) {
        return StadiumHelper.getGameStadium(opponent, isHome, this.currentTeam);
    }

    /**
     * 팀별 홈/원정 분석
     */
    analyzeHomeAwayPerformance() {
        this.teams.forEach(team => {
            this.currentTeam = team; // 현재 분석 중인 팀 설정
            
            if (!this.gameRecords[team]) return;

            const games = this.gameRecords[team].games;
            const analysis = {
                // 기본 통계 (취소된 경기 제외)
                totalGames: games.filter(game => !game.isCancelled).length,
                
                // 홈 성적
                home: {
                    games: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: '0.0',
                    runsScored: 0,
                    runsAllowed: 0,
                    avgRunsScored: '0.0',
                    avgRunsAllowed: '0.0',
                    runDifferential: 0
                },
                
                // 원정 성적
                away: {
                    games: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: '0.0',
                    runsScored: 0,
                    runsAllowed: 0,
                    avgRunsScored: '0.0',
                    avgRunsAllowed: '0.0',
                    runDifferential: 0
                },
                
                // 홈 어드밴티지
                homeAdvantage: '0.0',
                homeAdvantageStatus: '중립',
                
                // 구장별 성적
                stadiumRecords: {},
                
                // 상대팀별 홈/원정 성적
                vsTeamsHome: {},
                vsTeamsAway: {}
            };

            // 각 경기 분석
            games.forEach(game => {
                // 취소된 경기는 통계에서 제외
                if (game.isCancelled) return;

                const score = this.parseScore(game.score);
                const stadium = this.getStadium(game.opponent, game.isHome);
                const location = game.isHome ? 'home' : 'away';

                // 홈/원정 기본 통계
                analysis[location].games++;
                if (game.result === 'W') analysis[location].wins++;
                else if (game.result === 'L') analysis[location].losses++;
                else if (game.result === 'D') analysis[location].draws++;
                
                analysis[location].runsScored += score.scored;
                analysis[location].runsAllowed += score.allowed;
                
                // 구장별 기록
                if (!analysis.stadiumRecords[stadium]) {
                    analysis.stadiumRecords[stadium] = {
                        games: 0,
                        wins: 0,
                        losses: 0,
                        draws: 0,
                        winRate: '0.0',
                        runsScored: 0,
                        runsAllowed: 0
                    };
                }
                
                const stadiumRecord = analysis.stadiumRecords[stadium];
                stadiumRecord.games++;
                if (game.result === 'W') stadiumRecord.wins++;
                else if (game.result === 'L') stadiumRecord.losses++;
                else if (game.result === 'D') stadiumRecord.draws++;
                stadiumRecord.runsScored += score.scored;
                stadiumRecord.runsAllowed += score.allowed;
                
                // 상대팀별 홈/원정 성적
                const vsTeamsKey = game.isHome ? 'vsTeamsHome' : 'vsTeamsAway';
                if (!analysis[vsTeamsKey][game.opponent]) {
                    analysis[vsTeamsKey][game.opponent] = {
                        games: 0, wins: 0, losses: 0, draws: 0, winRate: '0.0'
                    };
                }
                
                const vsRecord = analysis[vsTeamsKey][game.opponent];
                vsRecord.games++;
                if (game.result === 'W') vsRecord.wins++;
                else if (game.result === 'L') vsRecord.losses++;
                else if (game.result === 'D') vsRecord.draws++;
            });

            // 승률 및 평균 계산
            ['home', 'away'].forEach(location => {
                const loc = analysis[location];
                const decisiveGames = loc.wins + loc.losses;
                
                if (decisiveGames > 0) {
                    loc.winRate = ((loc.wins / decisiveGames) * 100).toFixed(1);
                }
                
                if (loc.games > 0) {
                    loc.avgRunsScored = (loc.runsScored / loc.games).toFixed(2);
                    loc.avgRunsAllowed = (loc.runsAllowed / loc.games).toFixed(2);
                    loc.runDifferential = loc.runsScored - loc.runsAllowed;
                }
            });
            
            // 홈 어드밴티지 계산 (소수점 형태로 변환)
            const homeWinRate = parseFloat(analysis.home.winRate) / 100; // 퍼센트를 소수점으로 변환
            const awayWinRate = parseFloat(analysis.away.winRate) / 100; // 퍼센트를 소수점으로 변환
            analysis.homeAdvantage = (homeWinRate - awayWinRate).toFixed(4); // root index와 동일하게 4자리로 표시
            
            if (parseFloat(analysis.homeAdvantage) > 0.10) {
                analysis.homeAdvantageStatus = '강함';
            } else if (parseFloat(analysis.homeAdvantage) > 0.05) {
                analysis.homeAdvantageStatus = '보통';
            } else if (parseFloat(analysis.homeAdvantage) < -0.10) {
                analysis.homeAdvantageStatus = '약함';
            } else if (parseFloat(analysis.homeAdvantage) < -0.05) {
                analysis.homeAdvantageStatus = '불리';
            } else {
                analysis.homeAdvantageStatus = '중립';
            }
            
            // 구장별 승률 계산
            Object.keys(analysis.stadiumRecords).forEach(stadium => {
                const record = analysis.stadiumRecords[stadium];
                const decisiveGames = record.wins + record.losses;
                if (decisiveGames > 0) {
                    record.winRate = ((record.wins / decisiveGames) * 100).toFixed(1);
                }
            });
            
            // 상대팀별 승률 계산
            ['vsTeamsHome', 'vsTeamsAway'].forEach(key => {
                Object.keys(analysis[key]).forEach(opponent => {
                    const record = analysis[key][opponent];
                    const decisiveGames = record.wins + record.losses;
                    if (decisiveGames > 0) {
                        record.winRate = ((record.wins / decisiveGames) * 100).toFixed(1);
                    }
                });
            });

            this.homeAwayData[team] = analysis;
        });
    }

    /**
     * 분석 결과 저장
     */
    saveAnalysis() {
        const result = {
            lastUpdated: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR'),
            homeAwayAnalysis: this.homeAwayData
        };

        const outputPath = path.join(__dirname, '../data/analysis-home-away.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
        console.log('✅ 홈/원정 분석 결과 저장 완료:', outputPath);
    }

    /**
     * 요약 출력
     */
    printSummary() {
        console.log('\n🏠 홈/원정 분석 요약');
        console.log('='.repeat(50));

        // 홈 어드밴티지 순위
        const homeAdvantageRankings = this.teams.map(team => ({
            team: team,
            analysis: this.homeAwayData[team]
        })).filter(t => t.analysis)
          .sort((a, b) => parseFloat(b.analysis.homeAdvantage) - parseFloat(a.analysis.homeAdvantage));

        console.log('\n🏆 홈 어드밴티지 순위:');
        homeAdvantageRankings.forEach((t, i) => {
            const a = t.analysis;
            console.log(`${i+1}. ${t.team}: ${a.homeAdvantage}% (홈 ${a.home.winRate}% - 원정 ${a.away.winRate}%) [${a.homeAdvantageStatus}]`);
        });

        // 홈 승률 순위
        const homeWinRateRankings = this.teams.map(team => ({
            team: team,
            analysis: this.homeAwayData[team]
        })).filter(t => t.analysis && parseFloat(t.analysis.home.winRate) > 0)
          .sort((a, b) => parseFloat(b.analysis.home.winRate) - parseFloat(a.analysis.home.winRate));

        console.log('\n🏠 홈 승률 순위:');
        homeWinRateRankings.forEach((t, i) => {
            const a = t.analysis.home;
            console.log(`${i+1}. ${t.team}: ${a.winRate}% (${a.wins}승 ${a.losses}패 ${a.draws}무, ${a.games}경기)`);
        });

        // 원정 승률 순위
        const awayWinRateRankings = this.teams.map(team => ({
            team: team,
            analysis: this.homeAwayData[team]
        })).filter(t => t.analysis && parseFloat(t.analysis.away.winRate) > 0)
          .sort((a, b) => parseFloat(b.analysis.away.winRate) - parseFloat(a.analysis.away.winRate));

        console.log('\n✈️ 원정 승률 순위:');
        awayWinRateRankings.forEach((t, i) => {
            const a = t.analysis.away;
            console.log(`${i+1}. ${t.team}: ${a.winRate}% (${a.wins}승 ${a.losses}패 ${a.draws}무, ${a.games}경기)`);
        });
    }

    /**
     * 전체 분석 실행
     */
    analyze() {
        console.log('🏠 KBO 2025 홈/원정 상세 분석 시작...');
        
        this.loadGameRecords();
        if (!this.gameRecords) {
            console.error('❌ 게임 기록을 로드할 수 없어 분석을 중단합니다.');
            return;
        }

        this.analyzeHomeAwayPerformance();
        this.saveAnalysis();
        this.printSummary();

        console.log('\n✅ 홈/원정 상세 분석 완료!');
        return this.homeAwayData;
    }
}

// 모듈 실행
if (require.main === module) {
    const analyzer = new HomeAwayAnalyzer();
    analyzer.analyze();
}

module.exports = HomeAwayAnalyzer;