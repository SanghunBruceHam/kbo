#!/usr/bin/env node
/**
 * raw-game-records.json 생성기
 * 2025-season-games.json에서 루트 index.html이 필요로 하는 형태로 변환
 */

const fs = require('fs');
const path = require('path');

class RawGameRecordsGenerator {
    constructor() {
        this.teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
    }

    generateRawGameRecords() {
        try {
            // 2025-season-games.json 로드
            const gamesPath = path.join(__dirname, '../data/2025-season-games.json');
            if (!fs.existsSync(gamesPath)) {
                console.error('❌ 2025-season-games.json 파일을 찾을 수 없습니다.');
                return;
            }

            const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
            console.log(`✅ ${games.length}개 경기 데이터 로드 완료`);

            // 팀별 게임 기록 구조 초기화
            const teamGameRecords = {};
            this.teams.forEach(team => {
                teamGameRecords[team] = { games: [] };
            });

            // 게임을 팀별로 정리
            games.forEach(game => {
                const homeTeam = game.home_team;
                const awayTeam = game.away_team;
                const homeScore = parseInt(game.home_score) || 0;
                const awayScore = parseInt(game.away_score) || 0;

                // 홈팀 기록 추가
                const homeGameNumber = teamGameRecords[homeTeam].games.length + 1;
                teamGameRecords[homeTeam].games.push({
                    gameNumber: homeGameNumber,
                    date: game.game_date,
                    opponent: awayTeam,
                    isHome: true,
                    score: `${homeScore}:${awayScore}`,
                    result: homeScore > awayScore ? 'W' : (homeScore < awayScore ? 'L' : 'D'),
                    runs_scored: homeScore,
                    runs_allowed: awayScore
                });

                // 원정팀 기록 추가
                const awayGameNumber = teamGameRecords[awayTeam].games.length + 1;
                teamGameRecords[awayTeam].games.push({
                    gameNumber: awayGameNumber,
                    date: game.game_date,
                    opponent: homeTeam,
                    isHome: false,
                    score: `${awayScore}:${homeScore}`,
                    result: awayScore > homeScore ? 'W' : (awayScore < homeScore ? 'L' : 'D'),
                    runs_scored: awayScore,
                    runs_allowed: homeScore
                });
            });

            // 각 팀의 게임을 날짜순으로 정렬하고 gameNumber 재부여
            this.teams.forEach(team => {
                teamGameRecords[team].games.sort((a, b) => new Date(a.date) - new Date(b.date));
                teamGameRecords[team].games.forEach((game, index) => {
                    game.gameNumber = index + 1;
                });
            });

            // JSON 파일로 저장
            const outputPath = path.join(__dirname, '../data/raw-game-records.json');
            fs.writeFileSync(outputPath, JSON.stringify(teamGameRecords, null, 2));
            
            console.log(`✅ raw-game-records.json 생성 완료: ${outputPath}`);
            
            // 생성된 데이터 요약
            this.teams.forEach(team => {
                const gameCount = teamGameRecords[team].games.length;
                const wins = teamGameRecords[team].games.filter(g => g.result === 'W').length;
                const losses = teamGameRecords[team].games.filter(g => g.result === 'L').length;
                const draws = teamGameRecords[team].games.filter(g => g.result === 'D').length;
                
                console.log(`   ${team}: ${gameCount}경기 (${wins}승 ${losses}패 ${draws}무)`);
            });

        } catch (error) {
            console.error('❌ raw-game-records.json 생성 중 오류:', error);
        }
    }
}

// 메인 실행
if (require.main === module) {
    const generator = new RawGameRecordsGenerator();
    generator.generateRawGameRecords();
}

module.exports = { RawGameRecordsGenerator };