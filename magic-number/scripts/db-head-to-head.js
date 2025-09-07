const { EnhancedKBODatabase } = require('./enhanced-kbo-database');
const fs = require('fs');

class EnhancedHeadToHeadAnalyzer {
    constructor() {
        this.db = new EnhancedKBODatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async close() {
        await this.db.close();
    }

    async generateDetailedHeadToHead() {
        const teams = ['한화', 'KIA', 'KT', 'LG', '롯데', 'NC', '두산', 'SSG', '삼성', '키움'];
        const detailedMatrix = {};

        for (const team1 of teams) {
            detailedMatrix[team1] = {};
            
            for (const team2 of teams) {
                if (team1 === team2) {
                    detailedMatrix[team1][team2] = '-';
                    continue;
                }

                // Team1이 홈팀일 때
                const homeRecord = await this.db.get(`
                    SELECT 
                        home_team,
                        away_team,
                        SUM(CASE WHEN winner = home_team THEN 1 ELSE 0 END) as home_wins,
                        SUM(CASE WHEN winner = away_team THEN 1 ELSE 0 END) as home_losses,
                        SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as home_draws,
                        COUNT(*) as home_games
                    FROM games 
                    WHERE home_team = ? AND away_team = ?
                    GROUP BY home_team, away_team
                `, [team1, team2]);

                // Team1이 원정팀일 때
                const awayRecord = await this.db.get(`
                    SELECT 
                        home_team,
                        away_team,
                        SUM(CASE WHEN winner = away_team THEN 1 ELSE 0 END) as away_wins,
                        SUM(CASE WHEN winner = home_team THEN 1 ELSE 0 END) as away_losses,
                        SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as away_draws,
                        COUNT(*) as away_games
                    FROM games 
                    WHERE home_team = ? AND away_team = ?
                    GROUP BY home_team, away_team
                `, [team2, team1]);

                const homeWins = homeRecord?.home_wins || 0;
                const homeLosses = homeRecord?.home_losses || 0;
                const homeDraws = homeRecord?.home_draws || 0;
                const homeGames = homeRecord?.home_games || 0;

                const awayWins = awayRecord?.away_wins || 0;
                const awayLosses = awayRecord?.away_losses || 0;
                const awayDraws = awayRecord?.away_draws || 0;
                const awayGames = awayRecord?.away_games || 0;

                const totalWins = homeWins + awayWins;
                const totalLosses = homeLosses + awayLosses;
                const totalDraws = homeDraws + awayDraws;
                const totalGames = homeGames + awayGames;

                const winRate = totalWins + totalLosses > 0 ? 
                    (totalWins / (totalWins + totalLosses)).toFixed(3) : '0.000';

                detailedMatrix[team1][team2] = {
                    record: `${totalWins}-${totalLosses}${totalDraws > 0 ? '-' + totalDraws : ''}`,
                    win_rate: winRate,
                    total_games: totalGames,
                    home_record: `${homeWins}-${homeLosses}${homeDraws > 0 ? '-' + homeDraws : ''}`,
                    away_record: `${awayWins}-${awayLosses}${awayDraws > 0 ? '-' + awayDraws : ''}`,
                    home_games: homeGames,
                    away_games: awayGames,
                    draws: totalDraws
                };
            }
        }

        // 기존 대시보드 데이터 로드
        const dashboardPath = '../data/stats-comprehensive.json';
        const dashboardData = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));
        
        // 상대전적 매트릭스 업데이트
        dashboardData.headToHeadMatrix = detailedMatrix;
        dashboardData.updateTime = new Date().toISOString();
        
        // 업데이트된 데이터 저장
        fs.writeFileSync(dashboardPath, JSON.stringify(dashboardData, null, 2));
        
        console.log('✅ 상대전적 매트릭스 업데이트 완료 (무승부 및 홈/원정 분리 포함)');
        console.log(`📊 총 ${teams.length}개 팀의 ${teams.length * teams.length - teams.length}개 매치업 분석`);

        // 무승부가 있는 경기 확인
        let totalDraws = 0;
        for (const team1 of teams) {
            for (const team2 of teams) {
                if (team1 !== team2 && detailedMatrix[team1][team2].draws > 0) {
                    totalDraws += detailedMatrix[team1][team2].draws;
                    console.log(`${team1} vs ${team2}: ${detailedMatrix[team1][team2].draws}무`);
                }
            }
        }
        console.log(`🔄 총 무승부 경기: ${totalDraws/2}경기 (양방향 중복 제거)`);
        
        return detailedMatrix;
    }
}

async function main() {
    const analyzer = new EnhancedHeadToHeadAnalyzer();
    try {
        await analyzer.connect();
        await analyzer.generateDetailedHeadToHead();
    } finally {
        await analyzer.close();
    }
}

if (require.main === module) {
    main();
}