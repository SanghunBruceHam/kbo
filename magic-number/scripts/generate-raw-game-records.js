#!/usr/bin/env node
/**
 * raw-game-records.json 생성기
 * 2025-season-games.json에서 루트 index.html이 필요로 하는 형태로 변환
 */

const fs = require('fs');
const path = require('path');

class RawGameRecordsGenerator {
    constructor() {
        // 동적으로 팀 목록을 수집할 예정
    }

    parseCleanDataToGames(data) {
        const games = [];
        const lines = data.split('\n');
        let currentDate = null;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // 날짜 라인 감지 (YYYY-MM-DD 형식)
            const dateMatch = trimmedLine.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                currentDate = dateMatch[1];
                continue;
            }

            // 경기 데이터 라인 파싱 (시간 상태 구장 홈팀 어웨이팀 점수 방송사 구분)
            if (trimmedLine && currentDate) {
                const parts = trimmedLine.split(/\s+/);
                if (parts.length >= 8) {
                    const [time, state, stadium, homeTeam, awayTeam, scoreOrStatus, broadcast, ...categoryParts] = parts;
                    const category = categoryParts.join(' ');

                    // 페넌트레이스 경기만 처리 (완료 또는 취소)
                    if (category.includes('페넌트레이스') && (state === '종료' || state === '경기취소')) {
                        const game = {
                            date: currentDate,
                            time: time,
                            state: state,
                            stadium: stadium,
                            home_team: homeTeam,
                            away_team: awayTeam,
                            category: category,
                            broadcast: broadcast
                        };

                        if (state === '종료') {
                            // 정상 완료 경기 - 스코어 파싱
                            const scoreMatch = scoreOrStatus.match(/^(\d+):(\d+)$/);
                            if (scoreMatch) {
                                game.home_score = parseInt(scoreMatch[2]);
                                game.away_score = parseInt(scoreMatch[1]);
                            }
                        } else if (state === '경기취소') {
                            // 취소된 경기 - 스코어는 null
                            game.home_score = null;
                            game.away_score = null;
                            game.isCancelled = true;
                        }

                        games.push(game);
                    }
                }
            }
        }

        return games;
    }

    generateRawGameRecords() {
        try {
            // 2025-season-data-clean.txt 파일에서 직접 파싱
            const cleanDataPath = path.join(__dirname, '../data/2025-season-data-clean.txt');
            if (!fs.existsSync(cleanDataPath)) {
                console.error('❌ 2025-season-data-clean.txt 파일을 찾을 수 없습니다.');
                return;
            }

            const rawData = fs.readFileSync(cleanDataPath, 'utf8');
            const games = this.parseCleanDataToGames(rawData);
            console.log(`✅ ${games.length}개 경기 데이터 로드 완료`);

            // 실제 게임 데이터에서 팀 이름 수집
            const actualTeams = new Set();
            games.forEach(game => {
                actualTeams.add(game.home_team);
                actualTeams.add(game.away_team);
            });

            const teams = Array.from(actualTeams);

            // 팀별 게임 기록 구조 초기화
            const teamGameRecords = {};
            teams.forEach(team => {
                teamGameRecords[team] = { games: [] };
            });

            // 게임을 팀별로 정리 (페넌트레이스 완료/취소 경기)
            games.forEach(game => {
                // 페넌트레이스이면서 완료되었거나 취소된 경기만 처리
                if (!game.category || !game.category.includes('페넌트레이스') ||
                    !game.state || (game.state !== '종료' && game.state !== '경기취소')) {
                    return; // 페넌트레이스가 아니거나 완료/취소되지 않은 경기는 제외
                }

                const homeTeam = game.home_team;
                const awayTeam = game.away_team;
                const isCancelled = game.isCancelled || game.state === '경기취소';

                let homeScore, awayScore, homeResult, awayResult, scoreDisplay;

                if (isCancelled) {
                    // 취소된 경기 처리
                    homeScore = 0;
                    awayScore = 0;
                    homeResult = null;
                    awayResult = null;
                    scoreDisplay = '취소';
                } else {
                    // 정상 완료된 경기 처리
                    homeScore = parseInt(game.home_score) || 0;
                    awayScore = parseInt(game.away_score) || 0;
                    homeResult = homeScore > awayScore ? 'W' : (homeScore < awayScore ? 'L' : 'D');
                    awayResult = awayScore > homeScore ? 'W' : (awayScore < homeScore ? 'L' : 'D');
                    scoreDisplay = `${homeScore}:${awayScore}`;
                }

                // 홈팀 기록 추가
                const homeGameRecord = {
                    date: game.date,
                    opponent: awayTeam,
                    isHome: true,
                    score: isCancelled ? scoreDisplay : `${homeScore}:${awayScore}`,
                    result: homeResult,
                    runs_scored: homeScore,
                    runs_allowed: awayScore
                };

                if (isCancelled) {
                    homeGameRecord.isCancelled = true;
                } else {
                    // 완료된 경기만 경기 번호 부여 (취소된 경기 제외)
                    const completedGames = teamGameRecords[homeTeam].games.filter(g => !g.isCancelled);
                    homeGameRecord.gameNumber = completedGames.length + 1;
                }

                teamGameRecords[homeTeam].games.push(homeGameRecord);

                // 원정팀 기록 추가
                const awayGameRecord = {
                    date: game.date,
                    opponent: homeTeam,
                    isHome: false,
                    score: isCancelled ? scoreDisplay : `${awayScore}:${homeScore}`,
                    result: awayResult,
                    runs_scored: awayScore,
                    runs_allowed: homeScore
                };

                if (isCancelled) {
                    awayGameRecord.isCancelled = true;
                } else {
                    // 완료된 경기만 경기 번호 부여 (취소된 경기 제외)
                    const completedGames = teamGameRecords[awayTeam].games.filter(g => !g.isCancelled);
                    awayGameRecord.gameNumber = completedGames.length + 1;
                }

                teamGameRecords[awayTeam].games.push(awayGameRecord);
            });

            // 각 팀의 게임을 날짜순으로 정렬하고 완료된 경기만 gameNumber 재부여
            teams.forEach(team => {
                teamGameRecords[team].games.sort((a, b) => new Date(a.date) - new Date(b.date));

                // 완료된 경기만 경기 번호 재부여
                let gameNumber = 1;
                teamGameRecords[team].games.forEach(game => {
                    if (!game.isCancelled) {
                        game.gameNumber = gameNumber++;
                    }
                    // 취소된 경기는 gameNumber 필드 자체를 제거
                    else {
                        delete game.gameNumber;
                    }
                });
            });

            // JSON 파일로 저장
            const outputPath = path.join(__dirname, '../data/raw-game-records.json');
            fs.writeFileSync(outputPath, JSON.stringify(teamGameRecords, null, 2));
            
            console.log(`✅ raw-game-records.json 생성 완료: ${outputPath}`);
            
            // 생성된 데이터 요약
            teams.forEach(team => {
                const gameCount = teamGameRecords[team].games.length;
                const wins = teamGameRecords[team].games.filter(g => g.result === 'W').length;
                const losses = teamGameRecords[team].games.filter(g => g.result === 'L').length;
                const draws = teamGameRecords[team].games.filter(g => g.result === 'D').length;
                const cancelled = teamGameRecords[team].games.filter(g => g.isCancelled).length;

                console.log(`   ${team}: ${gameCount}경기 (${wins}승 ${losses}패 ${draws}무 ${cancelled}취소)`);
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