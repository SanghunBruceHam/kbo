/**
 * KBO 2025 시리즈 분석 모듈
 * 위닝/루징 시리즈, 스윕 분석, 연속 시리즈 기록 등을 처리
 */

const fs = require('fs');
const path = require('path');

class SeriesAnalyzer {
    constructor() {
        this.teams = ['LG', '한화', 'KIA', '삼성', 'KT', 'SSG', '롯데', '두산', 'NC', '키움'];
        this.gameRecords = null;
        this.seriesData = {};
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
     * 날짜 차이 계산 (일 단위)
     */
    daysDifference(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return Math.abs(d2 - d1) / (1000 * 60 * 60 * 24);
    }

    /**
     * 날짜 문자열을 Date 객체로 변환
     */
    parseDate(dateStr) {
        return new Date(dateStr);
    }

    /**
     * 두 날짜가 연속된 시리즈인지 판단 (비로 인한 취소/연기 고려)
     */
    isConsecutiveSeries(date1, date2) {
        const d1 = this.parseDate(date1);
        const d2 = this.parseDate(date2);
        const diffDays = Math.abs(d2 - d1) / (1000 * 60 * 60 * 24);
        
        // KBO 시리즈 패턴 고려:
        // - 연속된 날들
        // - 하루 간격 (휴식일)
        // - 최대 3일 간격까지 (비로 인한 연기 고려)
        // 단, 4일 이상 간격이면 확실히 새로운 시리즈
        return diffDays <= 3;
    }

    /**
     * 시리즈 완료 여부 판정
     * - 마지막 시리즈인 경우: 오늘 날짜와 비교하여 진행중인지 확인
     * - 중간 시리즈인 경우: 다음 시리즈 시작 날짜와 비교
     */
    isSeriesComplete(series, seriesIndex, allSeries) {
        const today = new Date();
        const lastGameDate = new Date(series.lastDate);
        
        // 마지막 시리즈인 경우
        if (seriesIndex === allSeries.length - 1) {
            // 마지막 경기가 오늘이거나 최근이면 진행중일 가능성
            const daysDiff = Math.abs(today - lastGameDate) / (1000 * 60 * 60 * 24);
            
            // 1) 마지막 경기가 오늘인 경우: 시리즈가 진행중일 수 있음
            if (daysDiff <= 1) {
                // 단, 이미 2승 이상 또는 2패 이상이면 완료로 간주
                if (series.wins >= 2 || series.losses >= 2) {
                    return true; // 완료
                }
                return false; // 진행중
            }
            
            // 2) 마지막 경기가 2일 이상 전이면 시리즈 완료
            return true;
        }
        
        // 중간 시리즈는 다음 시리즈가 시작되었으므로 완료된 것으로 간주
        return true;
    }

    /**
     * 게임들을 시리즈별로 그룹화 (KBO 정확한 시리즈 구조)
     */
    groupGamesBySeries(games) {
        const series = [];
        let currentSeries = null;

        // 날짜순으로 정렬
        games.sort((a, b) => new Date(a.date) - new Date(b.date));

        games.forEach((game, index) => {
            // KBO 시리즈 규칙: 상대팀 변경 OR 홈/원정 변경시 새로운 시리즈
            const shouldStartNewSeries = !currentSeries || 
                currentSeries.opponent !== game.opponent ||
                (currentSeries.opponent === game.opponent && currentSeries.isHome !== game.isHome);

            if (shouldStartNewSeries) {
                // 새 시리즈 시작
                currentSeries = {
                    opponent: game.opponent,
                    isHome: game.isHome, // 홈/원정 정보 추가
                    games: [game],
                    startDate: game.date,
                    lastDate: game.date,
                    wins: game.result === 'W' ? 1 : 0,
                    losses: game.result === 'L' ? 1 : 0,
                    draws: game.result === 'D' ? 1 : 0,
                    homeGames: game.isHome ? 1 : 0,
                    awayGames: game.isHome ? 0 : 1
                };
                series.push(currentSeries);
            } else {
                // 같은 상대팀과의 연속 경기 - 기존 시리즈에 추가
                currentSeries.games.push(game);
                currentSeries.lastDate = game.date;
                if (game.result === 'W') currentSeries.wins++;
                else if (game.result === 'L') currentSeries.losses++;
                else if (game.result === 'D') currentSeries.draws++;
                
                if (game.isHome) currentSeries.homeGames++;
                else currentSeries.awayGames++;
            }
        });

        // 시리즈 유효성 검증 (비로 인한 취소 고려)
        // 1경기만 있어도 실제 시리즈일 수 있음 (나머지 경기가 비로 취소)
        const validSeries = series.filter(s => {
            // 최소 1경기 이상이면 유효한 시리즈로 간주
            // 단, 너무 긴 기간(7일 이상)에 걸친 1경기는 제외
            if (s.games.length === 1) {
                return true; // 1경기도 유효한 시리즈로 인정 (비로 인한 취소 가능성)
            }
            return s.games.length >= 1;
        });
        
        // 시리즈 결과 결정 및 추가 정보 계산
        validSeries.forEach((s, index) => {
            // 시리즈 결과 판정 (KBO 실제 규칙)
            const totalGames = s.games.length;
            
            // 위닝/루징 시리즈 판정 기준 개선:
            // 1) 시리즈가 진행중인지 완료되었는지 먼저 확인
            // 2) 완료된 시리즈만 WIN/LOSS/SPLIT 판정
            // 3) 진행중인 시리즈는 ONGOING으로 표시하여 연속 기록에서 제외
            
            // 시리즈 완료 여부 판정
            const isSeriesComplete = this.isSeriesComplete(s, index, validSeries);
            
            if (!isSeriesComplete) {
                // 진행중인 시리즈 - 연속 기록 계산에서 제외
                s.result = 'ONGOING';
            } else if (s.wins >= 2 && s.losses <= 1) {
                // 2승 이상 확정 (2승, 2승1패, 3승)
                s.result = 'WIN';
            } else if (s.losses >= 2 && s.wins <= 1) {
                // 2패 이상 확정 (2패, 1승2패, 3패)
                s.result = 'LOSS';
            } else if (s.wins === 1 && s.losses === 1) {
                // 1승 1패는 SPLIT (무승부 시리즈)
                s.result = 'SPLIT';
            } else if (s.wins > s.losses) {
                // 나머지 경우 승수가 많으면 WIN
                s.result = 'WIN';
            } else if (s.losses > s.wins) {
                // 나머지 경우 패수가 많으면 LOSS
                s.result = 'LOSS';
            } else {
                // 동일하면 SPLIT
                s.result = 'SPLIT';
            }
            
            // 스윕 여부 확인 (3연전에서 3승 또는 3패)
            s.isSweep = totalGames >= 3 && (s.wins === 3 || s.losses === 3);
            s.isWinningSweep = totalGames >= 3 && s.wins === 3 && s.losses === 0;
            s.isLosingSweep = totalGames >= 3 && s.losses === 3 && s.wins === 0;
            
            // 시리즈 길이와 타입
            s.totalGames = s.games.length;
            s.seriesType = s.homeGames > s.awayGames ? 'HOME' : 'AWAY';
            
            // 시리즈 번호
            s.seriesNumber = index + 1;
        });

        return validSeries;
    }

    /**
     * 팀별 시리즈 통계 계산
     */
    calculateSeriesStats() {
        this.teams.forEach(team => {
            if (!this.gameRecords[team]) return;

            const games = this.gameRecords[team].games;
            // 모든 경기 포함 (첫 경기 제외하지 않음)
            const series = this.groupGamesBySeries(games);

            // 1경기 시리즈 제외한 실제 시리즈만 통계 계산
            const validSeries = series.filter(s => s.totalGames > 1);
            
            // 기본 통계
            const stats = {
                totalSeries: validSeries.length,
                winningSeries: validSeries.filter(s => s.result === 'WIN').length,
                losingSeries: validSeries.filter(s => s.result === 'LOSS').length,
                splitSeries: validSeries.filter(s => s.result === 'SPLIT').length,
                sweepWins: validSeries.filter(s => s.isWinningSweep).length,
                sweepLosses: validSeries.filter(s => s.isLosingSweep).length,
                seriesWinRate: 0,
                series: validSeries  // 1경기 시리즈 제외한 데이터만 포함
            };

            // 승률 계산
            if (stats.totalSeries > 0) {
                stats.seriesWinRate = (stats.winningSeries / stats.totalSeries * 100).toFixed(1);
            }

            // 연속 시리즈 기록 계산 (1경기 시리즈 제외한 데이터로)
            stats.currentStreak = this.calculateCurrentStreak(validSeries);
            stats.longestWinningStreak = this.calculateLongestStreak(validSeries, 'WIN');
            stats.longestLosingStreak = this.calculateLongestStreak(validSeries, 'LOSS');

            // 상대팀별 시리즈 전적 (1경기 시리즈 제외한 데이터로)
            stats.vsTeams = this.calculateVsTeamsStats(validSeries);

            this.seriesData[team] = stats;
        });
    }

    /**
     * 현재 연속 시리즈 기록 계산 (개선)
     * SPLIT 시리즈는 무시하고 실제 승/패 시리즈만 카운트
     */
    calculateCurrentStreak(series) {
        if (series.length === 0) return { type: 'NONE', count: 0 };

        // 최신 시리즈부터 역순으로 확인
        const sortedSeries = [...series].sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
        
        // SPLIT과 ONGOING을 제외한 완료된 시리즈만 필터링 (1경기 시리즈는 이미 상위에서 필터링됨)
        const completedSeries = sortedSeries.filter(s => 
            s.result !== 'SPLIT' && 
            s.result !== 'ONGOING'
        );
        
        if (completedSeries.length === 0) return { type: 'NONE', count: 0 };
        
        // 가장 최근의 실제 결과(WIN/LOSS)를 기준으로 연속 카운트
        const lastResult = completedSeries[0].result;
        let count = 0;
        let startDate = null;
        let endDate = null;

        for (let i = 0; i < completedSeries.length; i++) {
            if (completedSeries[i].result === lastResult) {
                count++;
                if (count === 1) endDate = completedSeries[i].lastDate;
                startDate = completedSeries[i].startDate;
            } else {
                // 다른 결과가 나오면 연속 종료
                break;
            }
        }

        return { 
            type: lastResult, 
            count: count,
            startDate: startDate,
            endDate: endDate
        };
    }

    /**
     * 최장 연속 시리즈 기록 계산 (개선)
     * SPLIT 시리즈는 무시하고 실제 승/패 시리즈만 카운트
     */
    calculateLongestStreak(series, type) {
        if (series.length === 0) return { count: 0, startDate: null, endDate: null };

        // 날짜순으로 정렬 후 SPLIT과 ONGOING 제외 (1경기 시리즈는 이미 상위에서 필터링됨)
        const sortedSeries = [...series]
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .filter(s => 
                s.result !== 'SPLIT' && 
                s.result !== 'ONGOING'
            );
        
        let maxStreak = 0;
        let currentStreak = 0;
        let maxStreakInfo = { count: 0, startDate: null, endDate: null };
        let currentStreakStart = null;

        sortedSeries.forEach((s, index) => {
            if (s.result === type) {
                if (currentStreak === 0) {
                    currentStreakStart = s.startDate;
                }
                currentStreak++;
                
                if (currentStreak > maxStreak) {
                    maxStreak = currentStreak;
                    maxStreakInfo = {
                        count: currentStreak,
                        startDate: currentStreakStart,
                        endDate: s.lastDate
                    };
                }
            } else {
                // 다른 결과면 연속 종료
                currentStreak = 0;
                currentStreakStart = null;
            }
        });

        return maxStreakInfo;
    }

    /**
     * 상대팀별 시리즈 전적 계산
     */
    calculateVsTeamsStats(series) {
        const vsStats = {};

        series.forEach(s => {
            if (!vsStats[s.opponent]) {
                vsStats[s.opponent] = {
                    totalSeries: 0,
                    wins: 0,
                    losses: 0,
                    splits: 0,
                    sweepWins: 0,
                    sweepLosses: 0
                };
            }

            const vs = vsStats[s.opponent];
            vs.totalSeries++;

            if (s.result === 'WIN') vs.wins++;
            else if (s.result === 'LOSS') vs.losses++;
            else vs.splits++;

            if (s.isWinningSweep) vs.sweepWins++;
            if (s.isLosingSweep) vs.sweepLosses++;
        });

        return vsStats;
    }

    /**
     * 시리즈 히트맵 데이터 생성
     */
    generateSeriesHeatmap() {
        const heatmapData = {};

        this.teams.forEach(team1 => {
            heatmapData[team1] = {};
            this.teams.forEach(team2 => {
                if (team1 === team2) {
                    heatmapData[team1][team2] = null;
                } else {
                    const stats = this.seriesData[team1]?.vsTeams[team2];
                    if (stats) {
                        const winRate = stats.totalSeries > 0 ? 
                            (stats.wins / stats.totalSeries * 100).toFixed(1) : '0.0';
                        heatmapData[team1][team2] = {
                            record: `${stats.wins}-${stats.losses}-${stats.splits}`,
                            winRate: winRate,
                            sweeps: `${stats.sweepWins}-${stats.sweepLosses}`,
                            totalSeries: stats.totalSeries
                        };
                    } else {
                        heatmapData[team1][team2] = {
                            record: '0-0-0',
                            winRate: '0.0',
                            sweeps: '0-0',
                            totalSeries: 0
                        };
                    }
                }
            });
        });

        return heatmapData;
    }

    /**
     * 스윕 하이라이트 데이터 생성
     */
    generateSweepHighlights() {
        const sweepHighlights = {
            recentSweeps: [],
            mostSweeps: [],
            antiSweeps: [] // 역스윕
        };

        // 최근 스윕 (최근 10개)
        const allSweeps = [];
        this.teams.forEach(team => {
            if (this.seriesData[team]) {
                this.seriesData[team].series.forEach(series => {
                    if (series.isSweep) {
                        allSweeps.push({
                            team: team,
                            opponent: series.opponent,
                            type: series.isWinningSweep ? 'WIN' : 'LOSS',
                            gameCount: series.games.length,
                            startDate: series.startDate,
                            endDate: series.lastDate,
                            scores: series.games.map(g => g.score)
                        });
                    }
                });
            }
        });

        // 날짜순 정렬
        allSweeps.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
        sweepHighlights.recentSweeps = allSweeps.slice(0, 10);

        // 팀별 스윕 순위
        const sweepRankings = this.teams.map(team => {
            const stats = this.seriesData[team];
            return {
                team: team,
                sweepWins: stats?.sweepWins || 0,
                sweepLosses: stats?.sweepLosses || 0,
                sweepDifference: (stats?.sweepWins || 0) - (stats?.sweepLosses || 0)
            };
        }).sort((a, b) => b.sweepDifference - a.sweepDifference);

        sweepHighlights.mostSweeps = sweepRankings;

        return sweepHighlights;
    }

    /**
     * 전체 분석 실행 및 저장
     */
    analyze() {
        console.log('🔍 KBO 2025 시리즈 분석 시작...');

        this.loadGameRecords();
        if (!this.gameRecords) {
            console.error('❌ 게임 기록을 로드할 수 없어 분석을 중단합니다.');
            return;
        }

        this.calculateSeriesStats();

        const analysisResult = {
            lastUpdated: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR'),
            teamStats: this.seriesData,
            heatmap: this.generateSeriesHeatmap(),
            sweepHighlights: this.generateSweepHighlights()
        };

        // 결과 저장
        const outputPath = path.join(__dirname, '../data/series-analysis.json');
        fs.writeFileSync(outputPath, JSON.stringify(analysisResult, null, 2), 'utf8');

        console.log('✅ 시리즈 분석 완료!');
        console.log(`📊 분석 결과: ${outputPath}`);
        
        // 간단한 요약 출력
        this.printSummary();

        return analysisResult;
    }

    /**
     * 분석 결과 요약 출력 (상세 디버깅 포함)
     */
    printSummary() {
        console.log('\n📈 시리즈 분석 요약');
        console.log('='.repeat(50));

        // 시리즈 승률 순위
        const rankings = this.teams.map(team => ({
            team: team,
            stats: this.seriesData[team]
        })).filter(t => t.stats).sort((a, b) => 
            parseFloat(b.stats.seriesWinRate) - parseFloat(a.stats.seriesWinRate)
        );

        console.log('\n🏆 시리즈 승률 순위:');
        rankings.forEach((t, i) => {
            const s = t.stats;
            console.log(`${i+1}. ${t.team}: ${s.seriesWinRate}% (${s.winningSeries}승 ${s.losingSeries}패 ${s.splitSeries}분) - 총 ${s.totalSeries}시리즈`);
        });

        // 스윕 통계
        console.log('\n🔥 스윕 통계:');
        const sweepRankings = rankings.map(t => ({
            team: t.team,
            sweepWins: t.stats.sweepWins,
            sweepLosses: t.stats.sweepLosses,
            sweepDiff: t.stats.sweepWins - t.stats.sweepLosses
        })).sort((a, b) => b.sweepDiff - a.sweepDiff);

        sweepRankings.forEach((t, i) => {
            console.log(`${i+1}. ${t.team}: +${t.sweepWins} -${t.sweepLosses} (차이: ${t.sweepDiff > 0 ? '+' : ''}${t.sweepDiff})`);
        });

        // 연속 기록 상세
        console.log('\n⚡ 현재 연속 기록:');
        rankings.forEach(t => {
            const streak = t.stats.currentStreak;
            if (streak.count > 0) {
                const typeText = streak.type === 'WIN' ? '연승' : streak.type === 'LOSS' ? '연패' : '연분';
                console.log(`${t.team}: ${streak.count}${typeText} (${streak.startDate} ~ ${streak.endDate})`);
            }
        });

        // 샘플 시리즈 분석 (첫 번째 팀)
        if (rankings.length > 0) {
            const sampleTeam = rankings[0].team;
            const sampleSeries = this.seriesData[sampleTeam].series.slice(0, 5);
            console.log(`\n🔍 ${sampleTeam} 시리즈 샘플 (최근 5개):`);
            sampleSeries.forEach((s, i) => {
                console.log(`${i+1}. vs ${s.opponent}: ${s.result} (${s.wins}승${s.losses}패${s.draws}무) ${s.startDate}~${s.lastDate}`);
            });
        }
    }
}

// 모듈 실행
if (require.main === module) {
    const analyzer = new SeriesAnalyzer();
    analyzer.analyze();
}

module.exports = SeriesAnalyzer;