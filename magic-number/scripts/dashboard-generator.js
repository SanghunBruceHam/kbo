const { EnhancedKBODatabase } = require('./enhanced-kbo-database');
const fs = require('fs');
const path = require('path');

class EnhancedDashboardGenerator {
    constructor() {
        this.db = new EnhancedKBODatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async close() {
        await this.db.close();
    }

    async generateComprehensiveDashboard() {
        const dashboard = {
            updateTime: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Seoul'
            }),
            
            // 1. 종합 순위
            standings: await this.getStandings(),
            
            // 2. 피타고리안 기대승률 & 운 지수
            pythagoreanAnalysis: await this.getPythagoreanAnalysis(),
            
            // 3. 1점차 경기 승률
            oneRunGames: await this.getOneRunGames(),
            
            // 4. 홈/원정 성적
            homeAwayStats: await this.getHomeAwayStats(),
            
            // 5. 월별 승률
            monthlyPerformance: await this.getMonthlyPerformance(),
            
            // 6. 요일별 승률
            weekdayPerformance: await this.getWeekdayPerformance(),
            
            // 7. 상대전적 매트릭스
            headToHeadMatrix: await this.getHeadToHeadMatrix(),
            
            // 8. 연승/연패 현황
            streakAnalysis: await this.getStreakAnalysis(),
            
            // 9. 득실점 분석
            runAnalysis: await this.getRunAnalysis(),
            
            // 10. 상위권/하위권 상대 승률
            vsLevelAnalysis: await this.getVsLevelAnalysis(),
            
            // 11. 특수 상황 통계
            specialSituations: await this.getSpecialSituations(),
            
            // 12. 경기장별 성적
            stadiumRecords: await this.getStadiumRecords(),
            
            // 13. 팀별 주요 지표 요약
            teamSummaries: await this.getTeamSummaries()
        };
        
        // JSON 파일로 저장
        const outputPath = path.join(__dirname, '../data/stats-comprehensive.json');
        fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
        console.log(`📊 Enhanced 대시보드 데이터 생성: ${outputPath}`);
        
        return dashboard;
    }

    async getStandings() {
        const standings = await this.db.all(`
            SELECT 
                team_name,
                games_played,
                wins,
                losses,
                draws,
                printf('%.3f', win_rate) as win_rate,
                runs_scored,
                runs_allowed,
                run_differential,
                current_streak
            FROM team_stats
            ORDER BY win_rate DESC, wins DESC
        `);
        
        // 게임차 계산
        const leader = standings[0];
        return standings.map((team, index) => ({
            rank: index + 1,
            ...team,
            games_behind: index === 0 ? '-' : 
                ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2
        }));
    }

    async getPythagoreanAnalysis() {
        return await this.db.all(`
            SELECT 
                team_name,
                printf('%.3f', win_rate) as actual_win_rate,
                printf('%.3f', pythagorean_expectation) as expected_win_rate,
                printf('%+.3f', luck_factor) as luck_factor,
                CASE 
                    WHEN luck_factor > 0.05 THEN '운이 좋음'
                    WHEN luck_factor < -0.05 THEN '운이 나쁨'
                    ELSE '평균적'
                END as luck_status
            FROM team_stats
            ORDER BY win_rate DESC
        `);
    }

    async getOneRunGames() {
        return await this.db.all(`
            SELECT 
                team_name,
                one_run_games_won as wins,
                one_run_games_lost as losses,
                one_run_games_won + one_run_games_lost as total_games,
                printf('%.3f', one_run_win_rate) as win_rate
            FROM team_stats
            WHERE one_run_games_won + one_run_games_lost > 0
            ORDER BY one_run_win_rate DESC
        `);
    }

    async getHomeAwayStats() {
        return await this.db.all(`
            SELECT 
                team_name,
                home_wins,
                home_losses,
                printf('%.3f', home_win_rate) as home_win_rate,
                away_wins,
                away_losses,
                printf('%.3f', away_win_rate) as away_win_rate,
                printf('%+.3f', home_advantage_index) as home_advantage
            FROM team_stats
            ORDER BY win_rate DESC
        `);
    }

    async getMonthlyPerformance() {
        const monthlyData = await this.db.all(`
            SELECT 
                team_name,
                month,
                wins,
                losses,
                draws,
                (wins + losses + draws) as games,
                printf('%.3f', win_rate) as win_rate,
                runs_scored,
                runs_allowed
            FROM monthly_records
            WHERE year = 2025
            ORDER BY team_name, month
        `);
        
        // 팀별로 그룹화
        const grouped = {};
        monthlyData.forEach(record => {
            if (!grouped[record.team_name]) {
                grouped[record.team_name] = [];
            }
            grouped[record.team_name].push({
                month: record.month,
                wins: record.wins,
                losses: record.losses,
                draws: record.draws,
                games: record.games,
                win_rate: record.win_rate,
                runs_scored: record.runs_scored,
                runs_allowed: record.runs_allowed
            });
        });
        
        return grouped;
    }

    async getWeekdayPerformance() {
        const weekdayData = await this.db.all(`
            SELECT 
                team_name,
                day_of_week,
                wins,
                losses,
                draws,
                printf('%.3f', win_rate) as win_rate
            FROM weekday_records
            ORDER BY team_name, 
                CASE day_of_week
                    WHEN '월' THEN 1
                    WHEN '화' THEN 2
                    WHEN '수' THEN 3
                    WHEN '목' THEN 4
                    WHEN '금' THEN 5
                    WHEN '토' THEN 6
                    WHEN '일' THEN 7
                END
        `);
        
        // 팀별로 그룹화
        const grouped = {};
        weekdayData.forEach(record => {
            if (!grouped[record.team_name]) {
                grouped[record.team_name] = {};
            }
            grouped[record.team_name][record.day_of_week] = {
                wins: record.wins,
                losses: record.losses,
                draws: record.draws,
                win_rate: record.win_rate
            };
        });
        
        return grouped;
    }

    async getHeadToHeadMatrix() {
        const teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
        const matrix = {};
        
        for (const team of teams) {
            matrix[team] = {};
            for (const opponent of teams) {
                if (team === opponent) {
                    matrix[team][opponent] = '-';
                    continue;
                }
                
                const games = await this.db.all(`
                    SELECT winner, COUNT(*) as count
                    FROM games
                    WHERE (home_team = ? AND away_team = ?) 
                       OR (home_team = ? AND away_team = ?)
                    GROUP BY winner
                `, [team, opponent, opponent, team]);
                
                let wins = 0, losses = 0;
                games.forEach(g => {
                    if (g.winner === team) wins = g.count;
                    else if (g.winner === opponent) losses = g.count;
                });
                
                matrix[team][opponent] = {
                    record: `${wins}-${losses}`,
                    win_rate: wins + losses > 0 ? (wins / (wins + losses)).toFixed(3) : '0.000'
                };
            }
        }
        
        return matrix;
    }

    async getStreakAnalysis() {
        return await this.db.all(`
            SELECT 
                team_name,
                current_streak,
                max_win_streak,
                max_lose_streak,
                CASE 
                    WHEN current_streak LIKE '%W' THEN '연승 중'
                    WHEN current_streak LIKE '%L' THEN '연패 중'
                    ELSE '무승부'
                END as streak_status
            FROM team_stats
            ORDER BY win_rate DESC
        `);
    }

    async getRunAnalysis() {
        return await this.db.all(`
            SELECT 
                team_name,
                runs_scored,
                runs_allowed,
                run_differential,
                printf('%.2f', CAST(runs_scored AS FLOAT) / games_played) as avg_runs_scored,
                printf('%.2f', CAST(runs_allowed AS FLOAT) / games_played) as avg_runs_allowed,
                printf('%.2f', CAST(run_differential AS FLOAT) / games_played) as avg_run_diff
            FROM team_stats
            ORDER BY run_differential DESC
        `);
    }

    async getVsLevelAnalysis() {
        return await this.db.all(`
            SELECT 
                team_name,
                vs_above_500_wins as vs_above_wins,
                vs_above_500_losses as vs_above_losses,
                CASE 
                    WHEN vs_above_500_wins + vs_above_500_losses > 0 
                    THEN printf('%.3f', CAST(vs_above_500_wins AS FLOAT) / 
                                (vs_above_500_wins + vs_above_500_losses))
                    ELSE '0.000'
                END as vs_above_win_rate,
                vs_below_500_wins as vs_below_wins,
                vs_below_500_losses as vs_below_losses,
                CASE 
                    WHEN vs_below_500_wins + vs_below_500_losses > 0 
                    THEN printf('%.3f', CAST(vs_below_500_wins AS FLOAT) / 
                                (vs_below_500_wins + vs_below_500_losses))
                    ELSE '0.000'
                END as vs_below_win_rate
            FROM team_stats
            ORDER BY win_rate DESC
        `);
    }

    async getSpecialSituations() {
        return await this.db.all(`
            SELECT 
                team_name,
                blowout_wins,
                blowout_losses,
                shutout_wins,
                shutout_losses,
                one_run_games_won + one_run_games_lost as close_games,
                blowout_wins + blowout_losses as blowout_games,
                shutout_wins + shutout_losses as shutout_games
            FROM team_stats
            ORDER BY win_rate DESC
        `);
    }

    async getStadiumRecords() {
        const stadiumData = await this.db.all(`
            SELECT 
                team_name,
                stadium,
                wins,
                losses,
                draws,
                printf('%.3f', win_rate) as win_rate
            FROM stadium_records
            ORDER BY team_name, stadium
        `);
        
        // 팀별로 그룹화
        const grouped = {};
        stadiumData.forEach(record => {
            if (!grouped[record.team_name]) {
                grouped[record.team_name] = [];
            }
            grouped[record.team_name].push({
                stadium: record.stadium,
                wins: record.wins,
                losses: record.losses,
                draws: record.draws,
                win_rate: record.win_rate
            });
        });
        
        return grouped;
    }

    async getTeamSummaries() {
        const teams = await this.db.all(`
            SELECT * FROM team_stats ORDER BY win_rate DESC
        `);
        
        return teams.map(team => ({
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
}

// 메인 실행
async function main() {
    const generator = new EnhancedDashboardGenerator();
    
    try {
        await generator.connect();
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
        
        await generator.close();
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        await generator.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { EnhancedDashboardGenerator };