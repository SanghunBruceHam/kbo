const fs = require('fs');
const path = require('path');

class EnhancedDashboardGenerator {
    constructor() {
        this.games = [];
        this.teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
        this.stadiums = {
            'KIA': '광주 챔피언스필드',
            'LG': '서울 잠실야구장',
            '두산': '서울 잠실야구장',
            '삼성': '대구 삼성라이온즈파크',
            'SSG': '인천 SSG랜더스필드',
            'KT': '수원 KT위즈파크',
            'NC': '창원 NC파크',
            '롯데': '부산 사직야구장',
            '한화': '대전 한화생명이글스파크',
            '키움': '서울 고척스카이돔'
        };
    }

    async loadGames() {
        try {
            // 2025-season-games.json 파일 로드
            const gamesPath = path.join(__dirname, '../data/2025-season-games.json');
            if (!fs.existsSync(gamesPath)) {
                // 파일이 없으면 season-data-parser로 생성
                const { parseSeasonData } = require('./03_season-data-parser');
                parseSeasonData();
            }
            const gamesData = fs.readFileSync(gamesPath, 'utf-8');
            const allGames = JSON.parse(gamesData);

            // 페넌트레이스이면서 완료된 경기만 필터링
            this.games = allGames.filter(game =>
                game.category && game.category.includes('페넌트레이스') &&
                game.state && game.state === '종료'
            );

            console.log(`✅ 전체 ${allGames.length}개 중 페넌트레이스 ${this.games.length}개 경기 데이터 로드 완료`);
        } catch (error) {
            console.error('❌ 경기 데이터 로드 실패:', error);
            throw error;
        }
    }

    getDayOfWeek(date) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const d = new Date(date);
        return days[d.getDay()];
    }

    getStadium(homeTeam) {
        return this.stadiums[homeTeam] || '미상';
    }

    async generateComprehensiveDashboard() {
        // 게임 데이터 로드
        await this.loadGames();
        
        const dashboard = {
            updateTime: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Seoul'
            }),
            
            // 1. 종합 순위
            standings: this.getStandings(),
            
            // 2. 피타고리안 기대승률 & 운 지수
            pythagoreanAnalysis: this.getPythagoreanAnalysis(),
            
            // 3. 1점차 경기 승률
            oneRunGames: this.getOneRunGames(),
            
            // 4. 홈/원정 성적
            homeAwayStats: this.getHomeAwayStats(),
            
            // 5. 월별 승률 (NEW)
            monthlyPerformance: this.getMonthlyPerformance(),
            
            // 6. 요일별 승률 (NEW)
            weekdayPerformance: this.getWeekdayPerformance(),
            
            // 7. 경기장별 성적 (NEW)
            stadiumRecords: this.getStadiumRecords(),
            
            // 8. 시리즈 기록 (NEW)
            seriesRecords: this.getSeriesRecords(),
            
            // 9. 상대전적 매트릭스
            headToHeadMatrix: this.getHeadToHeadMatrix(),
            
            // 10. 연승/연패 현황
            streakAnalysis: this.getStreakAnalysis(),
            
            // 11. 득실점 분석
            runAnalysis: this.getRunAnalysis(),
            
            // 12. 상위권/하위권 상대 승률
            vsLevelAnalysis: this.getVsLevelAnalysis(),
            
            // 13. 특수 상황 통계
            specialSituations: this.getSpecialSituations(),
            
            // 14. 팀별 주요 지표 요약
            teamSummaries: this.getTeamSummaries()
        };
        
        // JSON 파일로 저장
        const outputPath = path.join(__dirname, '../data/stats-comprehensive.json');
        fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
        console.log(`📊 Enhanced 대시보드 데이터 생성: ${outputPath}`);
        
        return dashboard;
    }

    calculateCurrentStreak(teamName) {
        // 최근 경기들 가져오기 (날짜 역순)
        const recentGames = this.games
            .filter(g => g.home_team === teamName || g.away_team === teamName)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let streak = 0;
        let streakType = null;
        
        for (const game of recentGames) {
            if (game.winner === 'draw') continue; // 무승부는 건너뛰기
            
            const isWin = game.winner === teamName;
            
            if (streakType === null) {
                streakType = isWin ? 'W' : 'L';
                streak = 1;
            } else if ((streakType === 'W' && isWin) || (streakType === 'L' && !isWin)) {
                streak++;
            } else {
                break; // 연승/연패 종료
            }
        }
        
        return streak > 0 ? `${streak}${streakType}` : '0';
    }

    getStandings() {
        const teamStats = {};
        
        // 팀 초기화
        this.teams.forEach(team => {
            teamStats[team] = {
                team_name: team,
                games_played: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                runs_scored: 0,
                runs_allowed: 0
            };
        });
        
        // 게임 데이터로 통계 계산
        this.games.forEach(game => {
            const { home_team, away_team, home_score, away_score, winner } = game;
            
            // 홈팀 처리
            if (teamStats[home_team]) {
                teamStats[home_team].games_played++;
                teamStats[home_team].runs_scored += home_score;
                teamStats[home_team].runs_allowed += away_score;
                
                if (winner === home_team) teamStats[home_team].wins++;
                else if (winner === away_team) teamStats[home_team].losses++;
                else teamStats[home_team].draws++;
            }
            
            // 원정팀 처리
            if (teamStats[away_team]) {
                teamStats[away_team].games_played++;
                teamStats[away_team].runs_scored += away_score;
                teamStats[away_team].runs_allowed += home_score;
                
                if (winner === away_team) teamStats[away_team].wins++;
                else if (winner === home_team) teamStats[away_team].losses++;
                else teamStats[away_team].draws++;
            }
        });
        
        // 승률 및 런 디퍼런셜 계산
        const standings = Object.values(teamStats).map(team => {
            const winRate = team.wins + team.losses > 0 ? team.wins / (team.wins + team.losses) : 0;
            const currentStreak = this.calculateCurrentStreak(team.team_name);
            
            return {
                ...team,
                win_rate: winRate.toFixed(3),
                run_differential: team.runs_scored - team.runs_allowed,
                current_streak: currentStreak
            };
        });
        
        // 승률 순 정렬
        standings.sort((a, b) => {
            const aRate = parseFloat(a.win_rate);
            const bRate = parseFloat(b.win_rate);
            if (aRate !== bRate) return bRate - aRate;
            return b.wins - a.wins;
        });
        
        // 게임차 계산
        const leader = standings[0];
        return standings.map((team, index) => ({
            rank: index + 1,
            ...team,
            games_behind: index === 0 ? '-' : 
                ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2
        }));
    }

    calculatePythagorean(runsScored, runsAllowed) {
        if (runsAllowed === 0) return 1;
        return Math.pow(runsScored, 2) / (Math.pow(runsScored, 2) + Math.pow(runsAllowed, 2));
    }
    
    getPythagoreanAnalysis() {
        const standings = this.getStandings();
        
        return standings.map(team => {
            const expectedWinRate = this.calculatePythagorean(team.runs_scored, team.runs_allowed);
            const actualWinRate = parseFloat(team.win_rate);
            const luckFactor = actualWinRate - expectedWinRate;
            
            let luckStatus;
            if (luckFactor > 0.05) luckStatus = '운이 좋음';
            else if (luckFactor < -0.05) luckStatus = '운이 나쁨';
            else luckStatus = '평균적';
            
            return {
                team_name: team.team_name,
                actual_win_rate: team.win_rate,
                expected_win_rate: expectedWinRate.toFixed(3),
                luck_factor: (luckFactor >= 0 ? '+' : '') + luckFactor.toFixed(3),
                luck_status: luckStatus
            };
        });
    }

    getOneRunGames() {
        const oneRunStats = {};
        
        // 팀 초기화
        this.teams.forEach(team => {
            oneRunStats[team] = { wins: 0, losses: 0 };
        });
        
        // 1점차 경기 찾기
        this.games.forEach(game => {
            const scoreDiff = Math.abs(game.home_score - game.away_score);
            if (scoreDiff === 1 && game.winner !== 'draw') {
                if (game.winner === game.home_team) {
                    oneRunStats[game.home_team].wins++;
                    oneRunStats[game.away_team].losses++;
                } else {
                    oneRunStats[game.away_team].wins++;
                    oneRunStats[game.home_team].losses++;
                }
            }
        });
        
        // 결과 정리
        const results = [];
        for (const [team, stats] of Object.entries(oneRunStats)) {
            const totalGames = stats.wins + stats.losses;
            if (totalGames > 0) {
                results.push({
                    team_name: team,
                    wins: stats.wins,
                    losses: stats.losses,
                    total_games: totalGames,
                    win_rate: (stats.wins / totalGames).toFixed(3)
                });
            }
        }
        
        return results.sort((a, b) => parseFloat(b.win_rate) - parseFloat(a.win_rate));
    }

    getHomeAwayStats() {
        const homeAwayStats = {};

        // 실제 게임 데이터에서 팀 이름 수집
        const actualTeams = new Set();
        this.games.forEach(game => {
            actualTeams.add(game.home_team);
            actualTeams.add(game.away_team);
        });

        // 팀 초기화 (실제 팀 이름 사용)
        Array.from(actualTeams).forEach(team => {
            homeAwayStats[team] = {
                home_wins: 0, home_losses: 0,
                away_wins: 0, away_losses: 0
            };
        });

        // 홈/원정 통계 계산
        this.games.forEach(game => {
            if (game.winner === 'draw') return;

            // 팀이 존재하는지 확인 후 처리
            if (homeAwayStats[game.home_team] && homeAwayStats[game.away_team]) {
                if (game.winner === game.home_team) {
                    homeAwayStats[game.home_team].home_wins++;
                    homeAwayStats[game.away_team].away_losses++;
                } else {
                    homeAwayStats[game.away_team].away_wins++;
                    homeAwayStats[game.home_team].home_losses++;
                }
            }
        });
        
        // 결과 정리
        const standings = this.getStandings();
        return standings.map(team => {
            const stats = homeAwayStats[team.team_name];
            const homeWinRate = stats.home_wins + stats.home_losses > 0 ? 
                stats.home_wins / (stats.home_wins + stats.home_losses) : 0;
            const awayWinRate = stats.away_wins + stats.away_losses > 0 ? 
                stats.away_wins / (stats.away_wins + stats.away_losses) : 0;
            const homeAdvantage = homeWinRate - awayWinRate;
            
            return {
                team_name: team.team_name,
                home_wins: stats.home_wins,
                home_losses: stats.home_losses,
                home_win_rate: homeWinRate.toFixed(3),
                away_wins: stats.away_wins,
                away_losses: stats.away_losses,
                away_win_rate: awayWinRate.toFixed(3),
                home_advantage: (homeAdvantage >= 0 ? '+' : '') + homeAdvantage.toFixed(3)
            };
        });
    }

    getMonthlyPerformance() {
        const monthlyStats = {};

        // 실제 게임 데이터에서 팀 이름 수집
        const actualTeams = new Set();
        this.games.forEach(game => {
            actualTeams.add(game.home_team);
            actualTeams.add(game.away_team);
        });

        // 팀/월 단위로 초기화
        Array.from(actualTeams).forEach(team => {
            monthlyStats[team] = {};
        });
        
        // 각 경기 월별 처리
        this.games.forEach(game => {
            const date = new Date(game.date);
            const month = date.getMonth() + 1; // 1-12월
            
            // 홈팀 처리
            if (monthlyStats[game.home_team]) {
                if (!monthlyStats[game.home_team][month]) {
                    monthlyStats[game.home_team][month] = {
                        wins: 0, losses: 0, draws: 0,
                        runs_scored: 0, runs_allowed: 0
                    };
                }
                const homeStats = monthlyStats[game.home_team][month];
                homeStats.runs_scored += game.home_score;
                homeStats.runs_allowed += game.away_score;

                if (game.winner === game.home_team) homeStats.wins++;
                else if (game.winner === game.away_team) homeStats.losses++;
                else homeStats.draws++;
            }

            // 원정팀 처리
            if (monthlyStats[game.away_team]) {
                if (!monthlyStats[game.away_team][month]) {
                    monthlyStats[game.away_team][month] = {
                        wins: 0, losses: 0, draws: 0,
                        runs_scored: 0, runs_allowed: 0
                    };
                }
                const awayStats = monthlyStats[game.away_team][month];
                awayStats.runs_scored += game.away_score;
                awayStats.runs_allowed += game.home_score;

                if (game.winner === game.away_team) awayStats.wins++;
                else if (game.winner === game.home_team) awayStats.losses++;
                else awayStats.draws++;
            }
        });
        
        // 결과 정리 - JSON 구조에 맞춘
        const result = {};
        this.teams.forEach(team => {
            result[team] = [];
            
            for (let month = 1; month <= 12; month++) {
                if (monthlyStats[team][month]) {
                    const stats = monthlyStats[team][month];
                    const games = stats.wins + stats.losses + stats.draws;
                    const winRate = stats.wins + stats.losses > 0 ? 
                        (stats.wins / (stats.wins + stats.losses)).toFixed(3) : '0.000';
                    
                    result[team].push({
                        month,
                        wins: stats.wins,
                        losses: stats.losses,
                        draws: stats.draws,
                        games,
                        win_rate: winRate,
                        runs_scored: stats.runs_scored,
                        runs_allowed: stats.runs_allowed
                    });
                }
            }
        });
        
        return result;
    }

    getWeekdayPerformance() {
        const weekdayStats = {};

        // 실제 게임 데이터에서 팀 이름 수집
        const actualTeams = new Set();
        this.games.forEach(game => {
            actualTeams.add(game.home_team);
            actualTeams.add(game.away_team);
        });

        // 팀/요일 단위로 초기화
        Array.from(actualTeams).forEach(team => {
            weekdayStats[team] = {};
            ['월', '화', '수', '목', '금', '토', '일'].forEach(day => {
                weekdayStats[team][day] = { wins: 0, losses: 0, draws: 0 };
            });
        });
        
        // 각 경기 요일별 처리
        this.games.forEach(game => {
            const dayOfWeek = this.getDayOfWeek(game.date);
            
            // 홈팀 처리
            if (weekdayStats[game.home_team] && weekdayStats[game.home_team][dayOfWeek]) {
                if (game.winner === game.home_team) {
                    weekdayStats[game.home_team][dayOfWeek].wins++;
                } else if (game.winner === game.away_team) {
                    weekdayStats[game.home_team][dayOfWeek].losses++;
                } else {
                    weekdayStats[game.home_team][dayOfWeek].draws++;
                }
            }

            // 원정팀 처리
            if (weekdayStats[game.away_team] && weekdayStats[game.away_team][dayOfWeek]) {
                if (game.winner === game.away_team) {
                    weekdayStats[game.away_team][dayOfWeek].wins++;
                } else if (game.winner === game.home_team) {
                    weekdayStats[game.away_team][dayOfWeek].losses++;
                } else {
                    weekdayStats[game.away_team][dayOfWeek].draws++;
                }
            }
        });
        
        // 승률 계산 - JSON 구조에 맞춘
        const result = {};
        this.teams.forEach(team => {
            result[team] = {};
            ['월', '화', '수', '목', '금', '토', '일'].forEach(day => {
                const stats = weekdayStats[team][day];
                if (stats.wins + stats.losses + stats.draws > 0) {
                    const winRate = stats.wins + stats.losses > 0 ?
                        (stats.wins / (stats.wins + stats.losses)).toFixed(3) : '0.000';
                    
                    result[team][day] = {
                        wins: stats.wins,
                        losses: stats.losses,
                        draws: stats.draws,
                        win_rate: winRate
                    };
                }
            });
        });
        
        return result;
    }
    
    getStadiumRecords() {
        const stadiumStats = {};

        // 실제 게임 데이터에서 팀 이름 수집
        const actualTeams = new Set();
        this.games.forEach(game => {
            actualTeams.add(game.home_team);
            actualTeams.add(game.away_team);
        });

        // 팀/경기장 단위로 초기화
        actualTeams.forEach(team => {
            stadiumStats[team] = {};
        });

        // 각 경기 경기장별 처리
        this.games.forEach(game => {
            const stadium = this.getStadium(game.home_team);

            // 홈팀 처리
            if (stadiumStats[game.home_team] && !stadiumStats[game.home_team][stadium]) {
                stadiumStats[game.home_team][stadium] = { wins: 0, losses: 0, draws: 0 };
            }
            
            if (stadiumStats[game.home_team] && stadiumStats[game.home_team][stadium]) {
                if (game.winner === game.home_team) {
                    stadiumStats[game.home_team][stadium].wins++;
                } else if (game.winner === game.away_team) {
                    stadiumStats[game.home_team][stadium].losses++;
                } else {
                    stadiumStats[game.home_team][stadium].draws++;
                }
            }

            // 원정팀 처리
            if (stadiumStats[game.away_team] && !stadiumStats[game.away_team][stadium]) {
                stadiumStats[game.away_team][stadium] = { wins: 0, losses: 0, draws: 0 };
            }

            if (stadiumStats[game.away_team] && stadiumStats[game.away_team][stadium]) {
                if (game.winner === game.away_team) {
                    stadiumStats[game.away_team][stadium].wins++;
                } else if (game.winner === game.home_team) {
                    stadiumStats[game.away_team][stadium].losses++;
                } else {
                    stadiumStats[game.away_team][stadium].draws++;
                }
            }
        });
        
        // 결과 정리 - JSON 구조에 맞춤
        const result = {};
        actualTeams.forEach(team => {
            result[team] = [];

            if (stadiumStats[team]) {
                Object.entries(stadiumStats[team]).forEach(([stadium, stats]) => {
                    if (stats.wins + stats.losses + stats.draws > 0) {
                        const winRate = stats.wins + stats.losses > 0 ?
                            (stats.wins / (stats.wins + stats.losses)).toFixed(3) : '0.000';

                        result[team].push({
                            stadium,
                            wins: stats.wins,
                            losses: stats.losses,
                            draws: stats.draws,
                            win_rate: winRate
                        });
                    }
                });
            }
        });
        
        return result;
    }

    getHeadToHeadMatrix() {
        const teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
        const matrix = {};
        
        teams.forEach(team => {
            matrix[team] = {};
            teams.forEach(opponent => {
                if (team === opponent) {
                    matrix[team][opponent] = '-';
                    return;
                }
                
                let wins = 0, losses = 0;
                this.games.forEach(game => {
                    if ((game.home_team === team && game.away_team === opponent) ||
                        (game.away_team === team && game.home_team === opponent)) {
                        if (game.winner === team) wins++;
                        else if (game.winner === opponent) losses++;
                    }
                });
                
                matrix[team][opponent] = {
                    record: `${wins}-${losses}`,
                    win_rate: wins + losses > 0 ? (wins / (wins + losses)).toFixed(3) : '0.000'
                };
            });
        });
        
        return matrix;
    }

    getStreakAnalysis() {
        try {
            // raw-game-records.json에서 직접 연승/연패 계산
            const rawPath = path.join(__dirname, '../data/raw-game-records.json');
            if (fs.existsSync(rawPath)) {
                const rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
                
                return this.teams.map(teamName => {
                    const teamGames = rawData[teamName]?.games || [];
                    
                    // 날짜순으로 정렬
                    const sortedGames = teamGames
                        .filter(g => g.date && (g.result === 'W' || g.result === 'L'))
                        .sort((a, b) => new Date(a.date) - new Date(b.date));
                    
                    let maxWinStreak = 0;
                    let maxLoseStreak = 0;
                    let currentStreak = 0;
                    let currentType = null;
                    let lastResult = null;
                    
                    // 최대 연승/연패 계산
                    sortedGames.forEach(game => {
                        if (game.result === lastResult) {
                            currentStreak++;
                        } else {
                            // 연속 기록 종료, 최대값 업데이트
                            if (lastResult === 'W') {
                                maxWinStreak = Math.max(maxWinStreak, currentStreak);
                            } else if (lastResult === 'L') {
                                maxLoseStreak = Math.max(maxLoseStreak, currentStreak);
                            }
                            
                            // 새로운 연속 시작
                            currentStreak = 1;
                            lastResult = game.result;
                        }
                    });
                    
                    // 마지막 연속 기록 처리
                    if (lastResult === 'W') {
                        maxWinStreak = Math.max(maxWinStreak, currentStreak);
                    } else if (lastResult === 'L') {
                        maxLoseStreak = Math.max(maxLoseStreak, currentStreak);
                    }
                    
                    // 현재 연속 상태 계산
                    let currentStreakDisplay = '-';
                    if (sortedGames.length > 0) {
                        const recentGames = sortedGames.slice(-10); // 최근 10경기
                        let recentStreak = 0;
                        let recentType = null;
                        
                        // 뒤에서부터 같은 결과 카운트
                        for (let i = recentGames.length - 1; i >= 0; i--) {
                            if (recentType === null) {
                                recentType = recentGames[i].result;
                                recentStreak = 1;
                            } else if (recentGames[i].result === recentType) {
                                recentStreak++;
                            } else {
                                break;
                            }
                        }
                        
                        if (recentType) {
                            currentStreakDisplay = `${recentStreak}${recentType}`;
                        }
                    }
                    
                    console.log(`✅ ${teamName} 연속기록 계산: 최대연승 ${maxWinStreak}, 최대연패 ${maxLoseStreak}, 현재 ${currentStreakDisplay}`);
                    
                    return {
                        team_name: teamName,
                        current_streak: currentStreakDisplay,
                        max_win_streak: maxWinStreak,
                        max_lose_streak: maxLoseStreak,
                        streak_status: currentStreakDisplay.includes('W') ? '연승 중' : 
                                     currentStreakDisplay.includes('L') ? '연패 중' : '-'
                    };
                });
            }
        } catch (e) {
            console.error('연승/연패 데이터 계산 오류:', e.message);
        }
        
        // fallback: 빈 데이터 반환
        return this.teams.map(teamName => ({
            team_name: teamName,
            current_streak: '-',
            max_win_streak: 0,
            max_lose_streak: 0,
            streak_status: '-'
        }));
    }

    getRunAnalysis() {
        try {
            const statsPath = path.join(__dirname, '../data/2025-team-stats.json');
            if (fs.existsSync(statsPath)) {
                const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
                return Object.values(stats)
                    .map(team => ({
                        team_name: team.team_name,
                        runs_scored: team.runs_scored || 0,
                        runs_allowed: team.runs_allowed || 0,
                        run_differential: team.run_differential || 0,
                        avg_runs_scored: team.games_played ? (team.runs_scored / team.games_played).toFixed(2) : '0.00',
                        avg_runs_allowed: team.games_played ? (team.runs_allowed / team.games_played).toFixed(2) : '0.00',
                        avg_run_diff: team.games_played ? (team.run_differential / team.games_played).toFixed(2) : '0.00'
                    }))
                    .sort((a, b) => b.run_differential - a.run_differential);
            }
        } catch (e) {
            console.log('득실점 분석 데이터 없음');
        }
        return [];
    }

    getVsLevelAnalysis() {
        // 2025-team-stats.json에서 가져오기
        try {
            const statsPath = path.join(__dirname, '../data/2025-team-stats.json');
            if (fs.existsSync(statsPath)) {
                const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
                return Object.values(stats).map(team => ({
                    team_name: team.team_name,
                    vs_above_wins: team.vs_above_500_wins || 0,
                    vs_above_losses: team.vs_above_500_losses || 0,
                    vs_above_win_rate: team.vs_above_500_win_rate || '0.000',
                    vs_below_wins: team.vs_below_500_wins || 0,
                    vs_below_losses: team.vs_below_500_losses || 0,
                    vs_below_win_rate: team.vs_below_500_win_rate || '0.000'
                }));
            }
        } catch (e) {
            console.log('팀 통계 데이터 없음');
        }
        return [];
    }

    getSpecialSituations() {
        try {
            const statsPath = path.join(__dirname, '../data/2025-team-stats.json');
            if (fs.existsSync(statsPath)) {
                const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
                return Object.values(stats).map(team => ({
                    team_name: team.team_name,
                    blowout_wins: team.blowout_wins || 0,
                    blowout_losses: team.blowout_losses || 0,
                    shutout_wins: team.shutout_wins || 0,
                    shutout_losses: team.shutout_losses || 0,
                    close_games: (team.one_run_games_won || 0) + (team.one_run_games_lost || 0),
                    blowout_games: (team.blowout_wins || 0) + (team.blowout_losses || 0),
                    shutout_games: (team.shutout_wins || 0) + (team.shutout_losses || 0)
                }));
            }
        } catch (e) {
            console.log('특수 상황 데이터 없음');
        }
        return [];
    }

    getSeriesRecords() {
        // series_records는 analysis-series.json에서 가져오기
        try {
            const seriesPath = path.join(__dirname, '../data/analysis-series.json');
            if (fs.existsSync(seriesPath)) {
                const seriesData = JSON.parse(fs.readFileSync(seriesPath, 'utf8'));
                return seriesData.teamStats || {};
            }
        } catch (e) {
            console.log('시리즈 데이터 없음, 빈 객체 반환');
        }
        return {};
    }

    getTeamSummaries() {
        try {
            const statsPath = path.join(__dirname, '../data/2025-team-stats.json');
            if (fs.existsSync(statsPath)) {
                const teams = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
                const sortedTeams = Object.values(teams).sort((a, b) => parseFloat(b.win_rate) - parseFloat(a.win_rate));
                
                return sortedTeams.map(team => ({
            team_name: team.team_name,
            overall: {
                record: `${team.wins}승 ${team.draws}무 ${team.losses}패`,
                win_rate: team.win_rate.toFixed(3),
                games_behind: 0 // 계산 필요
            },
            pythagorean: {
                expected: team.pythagorean_expectation.toFixed(3),
                actual: team.win_rate.toFixed(3),
                luck_factor: team.luck_factor.toFixed(3)
            },
            situational: {
                one_run: `${team.one_run_games_won}-${team.one_run_games_lost}`,
                one_run_rate: team.one_run_win_rate.toFixed(3),
                blowout: `${team.blowout_wins}-${team.blowout_losses}`,
                shutout: `${team.shutout_wins}-${team.shutout_losses}`
            },
            home_away: {
                home: `${team.home_wins}-${team.home_losses} (${team.home_win_rate.toFixed(3)})`,
                away: `${team.away_wins}-${team.away_losses} (${team.away_win_rate.toFixed(3)})`,
                advantage: team.home_advantage_index.toFixed(3)
            },
            vs_level: {
                above_500: `${team.vs_above_500_wins}-${team.vs_above_500_losses}`,
                below_500: `${team.vs_below_500_wins}-${team.vs_below_500_losses}`
            },
            streaks: {
                current: team.current_streak,
                max_win: team.max_win_streak,
                max_lose: team.max_lose_streak
            },
            runs: {
                scored: team.runs_scored,
                allowed: team.runs_allowed,
                differential: team.run_differential,
                avg_scored: (team.runs_scored / team.games_played).toFixed(2),
                avg_allowed: (team.runs_allowed / team.games_played).toFixed(2)
            }
        }));
            }
        } catch (e) {
            console.log('팀 통계 데이터 없음');
        }
        return [];
    }
}

// 메인 실행
async function main() {
    const generator = new EnhancedDashboardGenerator();
    
    try {
        const dashboard = await generator.generateComprehensiveDashboard();
        
        console.log('\n✅ Enhanced 대시보드 생성 완료!');
        console.log('\n📊 주요 지표 요약:');
        console.log('1. 피타고리안 분석 - 운이 좋은 팀:');
        dashboard.pythagoreanAnalysis
            .filter(t => t.luck_factor > 0.03)
            .forEach(t => console.log(`   ${t.team_name}: ${t.luck_factor}`));
        
        console.log('\n2. 1점차 경기 강팀:');
        dashboard.oneRunGames
            .slice(0, 3)
            .forEach(t => console.log(`   ${t.team_name}: ${t.win_rate} (${t.wins}승 ${t.losses}패)`));
        
        console.log('\n3. 홈 어드밴티지 TOP 3:');
        dashboard.homeAwayStats
            .sort((a, b) => parseFloat(b.home_advantage) - parseFloat(a.home_advantage))
            .slice(0, 3)
            .forEach(t => console.log(`   ${t.team_name}: ${t.home_advantage}`));
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = { EnhancedDashboardGenerator };