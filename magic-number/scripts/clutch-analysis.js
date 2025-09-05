/**
 * KBO 2025 클러치 상황 완전 분석
 * 1점차 경기, 역전승, 연장전, 끝내기, 대량득점/대량실점 등 종합 분석
 */

const fs = require('fs');
const path = require('path');

class ClutchAnalyzer {
    constructor() {
        this.teams = ['LG', '한화', 'KIA', '삼성', 'KT', 'SSG', '롯데', '두산', 'NC', '키움'];
        this.gameRecords = null;
        this.clutchData = {};
    }

    /**
     * 게임 기록 데이터 로드
     */
    loadGameRecords() {
        try {
            const dataPath = path.join(__dirname, '../data/game-by-game-records.json');
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
     * 팀별 클러치 상황 분석
     */
    analyzeClutchSituations() {
        this.teams.forEach(team => {
            if (!this.gameRecords[team]) return;

            const games = this.gameRecords[team].games;
            const analysis = {
                // 기본 통계
                totalGames: games.length,
                
                // 1점차 경기
                oneRunGames: 0,
                oneRunWins: 0,
                oneRunLosses: 0,
                oneRunWinRate: '0.0',
                
                // 접전 승부 (2점차 이하)
                closeGames: 0,
                closeWins: 0,
                closeLosses: 0,
                closeWinRate: '0.0',
                
                // 3점차 경기 
                threeRunGames: 0,
                threeRunWins: 0,
                threeRunLosses: 0,
                threeRunWinRate: '0.0',
                
                // 대량득점 경기 (7점 이상)
                blowoutWins: 0,
                blowoutScored: [], // 대량득점 경기들
                
                // 대량실점 경기 (7점차 이상 패배)
                blowoutLosses: 0,
                blowoutAllowed: [], // 대량실점 경기들
                
                // 완봉승/완봉패
                shutoutWins: 0,
                shutoutLosses: 0,
                
                // 고득점 경기 (10점 이상)
                highScoringGames: 0,
                highScoringWins: 0,
                
                // 무득점 경기
                scorelessGames: 0,
                
                // 역전 관련 (추후 구현 가능)
                comebackPotential: {
                    trailingWins: 0, // 뒤처진 상태에서 역전승 (점수차로 추정)
                    leadBlownLosses: 0 // 앞서다가 역전패
                }
            };

            // 각 경기 분석
            games.forEach(game => {
                const score = this.parseScore(game.score);
                const scoreDiff = Math.abs(score.scored - score.allowed);
                
                // 1점차 경기
                if (scoreDiff === 1) {
                    analysis.oneRunGames++;
                    if (game.result === 'W') analysis.oneRunWins++;
                    else if (game.result === 'L') analysis.oneRunLosses++;
                }
                
                // 접전 (2점차 이하)
                if (scoreDiff <= 2 && game.result !== 'D') {
                    analysis.closeGames++;
                    if (game.result === 'W') analysis.closeWins++;
                    else if (game.result === 'L') analysis.closeLosses++;
                }
                
                // 3점차 이내 경기 (2점차 또는 3점차)
                if ((scoreDiff === 2 || scoreDiff === 3) && game.result !== 'D') {
                    analysis.threeRunGames++;
                    if (game.result === 'W') analysis.threeRunWins++;
                    else if (game.result === 'L') analysis.threeRunLosses++;
                }
                
                // 대량득점 (7점 이상 득점하고 이긴 경우)
                if (score.scored >= 7 && game.result === 'W') {
                    analysis.blowoutWins++;
                    analysis.blowoutScored.push({
                        date: game.date,
                        opponent: game.opponent,
                        score: game.score,
                        runs: score.scored
                    });
                }
                
                // 대량실점 (7점차 이상 패배)
                if (game.result === 'L' && scoreDiff >= 7) {
                    analysis.blowoutLosses++;
                    analysis.blowoutAllowed.push({
                        date: game.date,
                        opponent: game.opponent,
                        score: game.score,
                        diff: scoreDiff
                    });
                }
                
                // 완봉승/완봉패
                if (score.allowed === 0 && game.result === 'W') {
                    analysis.shutoutWins++;
                }
                if (score.scored === 0 && game.result === 'L') {
                    analysis.shutoutLosses++;
                    analysis.scorelessGames++;
                }
                
                // 고득점 경기 (10점 이상)
                if (score.scored >= 10) {
                    analysis.highScoringGames++;
                    if (game.result === 'W') analysis.highScoringWins++;
                }
            });

            // 승률 계산
            if (analysis.oneRunGames > 0) {
                analysis.oneRunWinRate = ((analysis.oneRunWins / (analysis.oneRunWins + analysis.oneRunLosses)) * 100).toFixed(1);
            }
            
            if (analysis.closeGames > 0) {
                analysis.closeWinRate = ((analysis.closeWins / (analysis.closeWins + analysis.closeLosses)) * 100).toFixed(1);
            }
            
            if (analysis.threeRunGames > 0) {
                analysis.threeRunWinRate = ((analysis.threeRunWins / (analysis.threeRunWins + analysis.threeRunLosses)) * 100).toFixed(1);
            }

            // 클러치 지수 계산 (1점차 승률 + 접전 승률 + 3점차 승률의 가중평균)
            const oneRunWeight = 0.5;
            const closeWeight = 0.3;
            const threeRunWeight = 0.2;
            analysis.clutchIndex = (
                (parseFloat(analysis.oneRunWinRate) * oneRunWeight + 
                 parseFloat(analysis.closeWinRate) * closeWeight +
                 parseFloat(analysis.threeRunWinRate) * threeRunWeight)
            ).toFixed(1);

            this.clutchData[team] = analysis;
        });
    }

    /**
     * 분석 결과 저장
     */
    saveAnalysis() {
        const result = {
            lastUpdated: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR'),
            clutchAnalysis: this.clutchData
        };

        const outputPath = path.join(__dirname, '../data/clutch-analysis.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
        console.log('✅ 클러치 분석 결과 저장 완료:', outputPath);
    }

    /**
     * 요약 출력
     */
    printSummary() {
        console.log('\n🎯 클러치 상황 분석 요약');
        console.log('='.repeat(50));

        // 1점차 승률 순위
        const oneRunRankings = this.teams.map(team => ({
            team: team,
            analysis: this.clutchData[team]
        })).filter(t => t.analysis && t.analysis.oneRunGames > 0)
          .sort((a, b) => parseFloat(b.analysis.oneRunWinRate) - parseFloat(a.analysis.oneRunWinRate));

        console.log('\n🔥 1점차 승률 순위:');
        oneRunRankings.forEach((t, i) => {
            const a = t.analysis;
            console.log(`${i+1}. ${t.team}: ${a.oneRunWinRate}% (${a.oneRunWins}승 ${a.oneRunLosses}패, 총 ${a.oneRunGames}경기)`);
        });

        // 클러치 지수 순위
        const clutchRankings = this.teams.map(team => ({
            team: team,
            analysis: this.clutchData[team]
        })).filter(t => t.analysis)
          .sort((a, b) => parseFloat(b.analysis.clutchIndex) - parseFloat(a.analysis.clutchIndex));

        console.log('\n⚡ 클러치 지수 순위:');
        clutchRankings.forEach((t, i) => {
            const a = t.analysis;
            console.log(`${i+1}. ${t.team}: ${a.clutchIndex} (1점차: ${a.oneRunWinRate}%, 접전: ${a.closeWinRate}%, 3점차내: ${a.threeRunWinRate}%)`);
        });

        // 3점차 승률 순위
        const threeRunRankings = this.teams.map(team => ({
            team: team,
            analysis: this.clutchData[team]
        })).filter(t => t.analysis && t.analysis.threeRunGames > 0)
          .sort((a, b) => parseFloat(b.analysis.threeRunWinRate) - parseFloat(a.analysis.threeRunWinRate));

        console.log('\n🎯 3점차 이내 승률 순위:');
        threeRunRankings.forEach((t, i) => {
            const a = t.analysis;
            console.log(`${i+1}. ${t.team}: ${a.threeRunWinRate}% (${a.threeRunWins}승 ${a.threeRunLosses}패, 총 ${a.threeRunGames}경기)`);
        });

        // 대량득점 순위
        const blowoutRankings = this.teams.map(team => ({
            team: team,
            analysis: this.clutchData[team]
        })).filter(t => t.analysis)
          .sort((a, b) => b.analysis.blowoutWins - a.analysis.blowoutWins);

        console.log('\n💥 대량득점 순위:');
        blowoutRankings.forEach((t, i) => {
            const a = t.analysis;
            console.log(`${i+1}. ${t.team}: ${a.blowoutWins}회 (7득점 이상 승리)`);
        });
    }

    /**
     * 전체 분석 실행
     */
    analyze() {
        console.log('🎯 KBO 2025 클러치 상황 완전 분석 시작...');
        
        this.loadGameRecords();
        if (!this.gameRecords) {
            console.error('❌ 게임 기록을 로드할 수 없어 분석을 중단합니다.');
            return;
        }

        this.analyzeClutchSituations();
        this.saveAnalysis();
        this.printSummary();

        console.log('\n✅ 클러치 상황 완전 분석 완료!');
        return this.clutchData;
    }
}

// 모듈 실행
if (require.main === module) {
    const analyzer = new ClutchAnalyzer();
    analyzer.analyze();
}

module.exports = ClutchAnalyzer;