#!/usr/bin/env node

/**
 * KBO 시즌 데이터 완전 자동화 처리 스크립트
 * 2025-season-data-clean.txt를 기반으로 모든 서비스 지표 계산
 */

const fs = require('fs');
const path = require('path');
const pathManager = require('../../config/paths');

class KBODataProcessor {
    constructor() {
        this.teams = ['한화', 'LG', '롯데', 'SSG', 'KT', 'KIA', '삼성', 'NC', '두산', '키움'];
        this.allStarTeams = ['나눔', '드림']; // 올스타 팀들
        this.totalGamesPerSeason = 144;
        this.gamesPerOpponent = 16; // 각 팀당 16경기씩
        this.playoffSpots = 5;
        
        // KBO 실제 시즌 기준값들
        this.typicalPlayoffWins = 80; // 일반적인 플레이오프 진출 승수
        this.typicalChampionshipWins = 87; // 144경기 체제 1위팀 평균 승수 (2015-2024년: 86.9승)
        
        // 데이터 저장소
        this.games = [];
        this.teamStats = {};
        this.headToHead = {};
        this.standings = [];
        this.magicNumbers = {};
        this.remainingGames = {};
    }

    // 1. 경기 데이터 파싱
    parseGameData() {
        console.log('📖 경기 데이터 파싱 시작...');
        
        try {
            // PathManager를 사용하여 시즌 데이터 파일 찾기
            const dataFile = pathManager.findSeasonDataFile();
            
            if (!dataFile) {
                throw new Error('시즌 데이터 파일을 찾을 수 없습니다.');
            }
            
            console.log(`📁 데이터 파일: ${dataFile}`);
            const data = fs.readFileSync(dataFile, 'utf8');
            const lines = data.trim().split('\n');
            
            let currentDate = '';
            let gameCount = 0;
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                // 날짜 라인 체크 (YYYY-MM-DD 형식)
                if (trimmedLine.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    currentDate = trimmedLine;
                    continue;
                }
                
                // 경기 결과 파싱 (팀1 점수:점수 팀2(H) 또는 팀1 점수:점수 팀2)
                const gameMatch = trimmedLine.match(/^(.+?)\s+(\d+):(\d+)\s+(.+?)(\(H\))?$/);
                if (gameMatch) {
                    const [, team1, score1, score2, team2Raw, homeMarker] = gameMatch;
                    
                    // 올스타 경기 제외
                    if (this.allStarTeams.includes(team1.trim()) || this.allStarTeams.includes(team2Raw.trim())) {
                        console.log(`  ⭐ 올스타 경기 제외: ${team1} vs ${team2Raw}`);
                        continue;
                    }
                    
                    // 홈팀 식별: (H) 표시가 있으면 해당 팀이 홈팀, 없으면 기존 규칙 적용
                    let homeTeam, awayTeam, team2;
                    if (homeMarker === '(H)') {
                        // (H) 표시가 있는 경우 - 명시적 홈팀 표시
                        team2 = team2Raw;
                        homeTeam = team2;
                        awayTeam = team1;
                    } else {
                        // (H) 표시가 없는 경우 - 기존 규칙 (뒤에 나온 팀이 홈팀)
                        team2 = team2Raw;
                        homeTeam = team2;
                        awayTeam = team1;
                    }
                    
                    // 결과 판정
                    let result;
                    if (parseInt(score1) > parseInt(score2)) {
                        result = { winner: team1, loser: team2, isDraw: false };
                    } else if (parseInt(score1) < parseInt(score2)) {
                        result = { winner: team2, loser: team1, isDraw: false };
                    } else {
                        result = { winner: null, loser: null, isDraw: true };
                    }
                    
                    this.games.push({
                        date: currentDate,
                        team1: team1,
                        team2: team2,
                        score1: parseInt(score1),
                        score2: parseInt(score2),
                        homeTeam: homeTeam,
                        awayTeam: awayTeam,
                        homeMarkerPresent: !!homeMarker, // 레퍼런스용
                        ...result
                    });
                    
                    gameCount++;
                }
            }
            
            console.log(`✅ 파싱 완료: ${gameCount}경기, 최신 날짜: ${currentDate}`);
            return { gameCount, lastDate: currentDate };
            
        } catch (error) {
            console.error('❌ 파싱 실패:', error.message);
            throw error;
        }
    }

    // 2. 팀별 기본 통계 계산
    calculateTeamStats() {
        console.log('📊 팀별 통계 계산 중...');
        console.log(`  🎮 처리할 경기 수: ${this.games.length}`);
        
        // 초기화
        this.teams.forEach(team => {
            this.teamStats[team] = {
                games: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                homeWins: 0,
                homeLosses: 0,
                homeDraws: 0,
                awayWins: 0,
                awayLosses: 0,
                awayDraws: 0,
                recent10: [],
                currentStreak: { type: '', count: 0 }
            };
        });
        
        // 경기별 통계 누적
        for (const game of this.games) {
            const { team1, team2, homeTeam, awayTeam, winner, loser, isDraw } = game;
            
            // 팀 이름 확인 (디버깅)
            if (!this.teamStats[team1]) {
                console.error(`  ❌ 알 수 없는 팀: '${team1}'`);
                console.error(`     경기 정보:`, JSON.stringify(game));
                continue;
            }
            if (!this.teamStats[team2]) {
                console.error(`  ❌ 알 수 없는 팀: '${team2}'`);
                console.error(`     경기 정보:`, JSON.stringify(game));
                continue;
            }
            
            // 두 팀 모두 경기수 증가
            this.teamStats[team1].games++;
            this.teamStats[team2].games++;
            
            if (isDraw) {
                // 무승부
                this.teamStats[team1].draws++;
                this.teamStats[team2].draws++;
                
                // 홈/원정 무승부
                this.teamStats[homeTeam].homeDraws++;
                this.teamStats[awayTeam].awayDraws++;
                
                // 최근 10경기 기록
                this.teamStats[team1].recent10.push('무');
                this.teamStats[team2].recent10.push('무');
                
            } else {
                // 승부 결정
                this.teamStats[winner].wins++;
                this.teamStats[loser].losses++;
                
                // 홈/원정 승패
                if (winner === homeTeam) {
                    this.teamStats[winner].homeWins++;
                    this.teamStats[loser].awayLosses++;
                } else {
                    this.teamStats[winner].awayWins++;
                    this.teamStats[loser].homeLosses++;
                }
                
                // 최근 10경기 기록
                this.teamStats[winner].recent10.push('승');
                this.teamStats[loser].recent10.push('패');
            }
        }
        
        // 후처리: 승률, 최근 10경기, 연속 기록 계산
        this.teams.forEach(team => {
            const stats = this.teamStats[team];
            
            // 승률 계산
            stats.winRate = stats.wins / (stats.wins + stats.losses) || 0;
            
            // 최근 20경기 정리 (연속 기록 계산을 위해 더 많은 경기 추적)
            stats.recent10 = stats.recent10.slice(-20);
            const recent10Summary = this.formatRecent10(stats.recent10.slice(-10));
            stats.recent10Display = recent10Summary;
            
            // 현재 연속 기록 계산
            stats.currentStreak = this.calculateStreak(stats.recent10);
            
            // 홈/원정 기록 문자열
            stats.homeRecord = `${stats.homeWins}-${stats.homeLosses}-${stats.homeDraws}`;
            stats.awayRecord = `${stats.awayWins}-${stats.awayLosses}-${stats.awayDraws}`;
            
            console.log(`  📈 ${team}: ${stats.games}경기 ${stats.wins}승${stats.losses}패${stats.draws}무 (.${(stats.winRate * 1000).toFixed(0)})`);
        });
    }

    // 3. 상대전적 계산
    calculateHeadToHead() {
        console.log('⚔️ 상대전적 계산 중...');
        
        // 초기화
        this.teams.forEach(team1 => {
            this.headToHead[team1] = {};
            this.teams.forEach(team2 => {
                if (team1 !== team2) {
                    this.headToHead[team1][team2] = { 
                        wins: 0, losses: 0, draws: 0,
                        homeWins: 0, homeLosses: 0, homeDraws: 0,
                        awayWins: 0, awayLosses: 0, awayDraws: 0
                    };
                }
            });
        });
        
        // 경기별 상대전적 계산
        for (const game of this.games) {
            const { team1, team2, homeTeam, awayTeam, winner, loser, isDraw } = game;
            
            if (isDraw) {
                // 전체 무승부
                this.headToHead[team1][team2].draws++;
                this.headToHead[team2][team1].draws++;
                
                // 홈/원정 무승부
                this.headToHead[homeTeam][awayTeam].homeDraws++;
                this.headToHead[awayTeam][homeTeam].awayDraws++;
            } else {
                // 전체 승패
                this.headToHead[winner][loser].wins++;
                this.headToHead[loser][winner].losses++;
                
                // 홈/원정 승패
                if (winner === homeTeam) {
                    // 홈팀 승리
                    this.headToHead[homeTeam][awayTeam].homeWins++;
                    this.headToHead[awayTeam][homeTeam].awayLosses++;
                } else {
                    // 원정팀 승리
                    this.headToHead[awayTeam][homeTeam].awayWins++;
                    this.headToHead[homeTeam][awayTeam].homeLosses++;
                }
            }
        }
        
        // 상대전적 요약 출력
        console.log('  ⚔️ 상대전적 매트릭스 완성');
        this.teams.forEach(team => {
            const totalGames = Object.values(this.headToHead[team])
                .reduce((sum, record) => sum + record.wins + record.losses + record.draws, 0);
            console.log(`    ${team}: 총 ${totalGames}경기`);
        });
    }

    // 4. 잔여경기 계산
    calculateRemainingGames() {
        console.log('📅 잔여경기 계산 중...');
        
        this.teams.forEach(team1 => {
            this.remainingGames[team1] = {};
            let totalRemaining = 0;
            
            this.teams.forEach(team2 => {
                if (team1 !== team2) {
                    const played = this.headToHead[team1][team2].wins + 
                                  this.headToHead[team1][team2].losses + 
                                  this.headToHead[team1][team2].draws;
                    
                    const remaining = this.gamesPerOpponent - played;
                    this.remainingGames[team1][team2] = Math.max(0, remaining);
                    totalRemaining += this.remainingGames[team1][team2];
                }
            });
            
            this.remainingGames[team1].total = totalRemaining;
            console.log(`  📅 ${team1}: ${totalRemaining}경기 남음`);
        });
    }

    // 5. 순위 계산
    calculateStandings() {
        console.log('🏆 순위 계산 중...');
        
        this.standings = this.teams.map(team => {
            const stats = this.teamStats[team];
            return {
                team: team,
                games: stats.games,
                wins: stats.wins,
                losses: stats.losses,
                draws: stats.draws,
                winRate: stats.winRate,
                homeRecord: stats.homeRecord,
                awayRecord: stats.awayRecord,
                homeWins: stats.homeWins,
                homeLosses: stats.homeLosses,
                homeDraws: stats.homeDraws,
                awayWins: stats.awayWins,
                awayLosses: stats.awayLosses,
                awayDraws: stats.awayDraws,
                recent10: stats.recent10Display,
                streak: this.formatStreak(stats.currentStreak),
                remainingGames: this.remainingGames[team].total
            };
        });
        
        // 순위 정렬 (승률 기준)
        this.standings.sort((a, b) => {
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.losses - b.losses;
        });
        
        // 공동 순위 계산 - 종합 순위와 동일한 로직 적용
        let currentRank = 1;
        let previousWinRate = null;
        
        this.standings.forEach((team, index) => {
            const displayedWinRate = parseFloat(team.winRate.toFixed(3));
            if (previousWinRate !== null && displayedWinRate !== previousWinRate) {
                currentRank = index + 1;
            }
            team.rank = currentRank;
            previousWinRate = displayedWinRate;
            
            // 게임차 계산
            if (index === 0) {
                team.gamesBehind = 0;
            } else {
                const firstPlace = this.standings[0];
                team.gamesBehind = (firstPlace.wins - team.wins + team.losses - firstPlace.losses) / 2;
            }
        });
        
        console.log('  🏆 순위표 완성:');
        this.standings.forEach(team => {
            console.log(`    ${team.rank}위 ${team.team} (${team.wins}-${team.losses}-${team.draws}, .${(team.winRate * 1000).toFixed(0)})`);
        });
    }

    // 6. 매직넘버 계산
    calculateMagicNumbers() {
        console.log('🔮 매직넘버 계산 중...');
        
        this.magicNumbers = {};
        
        this.standings.forEach((team, index) => {
            const remainingGames = team.remainingGames;
            const maxPossibleWins = team.wins + remainingGames;
            
            // 플레이오프 진출 매직넘버 (비활성화)
            let playoffMagic = '-';
            
            // 우승 매직넘버  
            let championshipMagic = this.calculateChampionshipMagic(team, index);
            
            // 탈락 매직넘버
            let eliminationMagic = this.calculateEliminationMagic(team, index);
            
            // 홈 어드밴티지 매직넘버 (2위 확정)
            let homeAdvantage = this.calculateHomeAdvantageMagic(team, index);
            
            this.magicNumbers[team.team] = {
                playoff: playoffMagic,
                championship: championshipMagic,
                elimination: eliminationMagic,
                homeAdvantage: homeAdvantage,
                remainingGames: remainingGames,
                maxPossibleWins: maxPossibleWins,
                currentRank: team.rank
            };
            
            console.log(`  🎯 ${team.team} (${team.rank}위): PO ${playoffMagic}, 우승 ${championshipMagic}`);
        });
    }

    // 매직넘버 계산 헬퍼 함수들

    calculateChampionshipMagic(team, index) {
        if (index === 0) {
            // 현재 1위 - 승률 기반 우승 확정 매직넘버
            const secondPlace = this.standings[1];
            if (!secondPlace) return 0; // 2위가 없으면 이미 확정
            
            // 2위 팀의 최대 가능 승률 계산
            const secondMaxWins = secondPlace.wins + secondPlace.remainingGames;
            const secondMaxLosses = secondPlace.losses; // 모든 경기 승리 가정
            const secondMaxWinRate = secondMaxWins / (secondMaxWins + secondMaxLosses);
            
            // 1위 팀이 2위 최대 승률을 넘기 위한 매직넘버 계산
            for (let additionalWins = 0; additionalWins <= team.remainingGames; additionalWins++) {
                const finalWins = team.wins + additionalWins;
                const finalLosses = team.losses + (team.remainingGames - additionalWins);
                const finalWinRate = finalWins / (finalWins + finalLosses);
                
                if (finalWinRate > secondMaxWinRate) {
                    return additionalWins;
                }
            }
            
            // 모든 경기를 이겨도 2위를 넘을 수 없는 경우 - 잔여경기수 표시
            return team.remainingGames;
            
        } else {
            // 1위가 아님 - 승률 기반 1위 추월 매직넘버
            const firstPlace = this.standings[0];
            
            // 1위 팀의 최대 가능 승률 계산
            const firstMaxWins = firstPlace.wins + firstPlace.remainingGames;
            const firstMaxLosses = firstPlace.losses; // 모든 경기 승리 가정
            const firstMaxWinRate = firstMaxWins / (firstMaxWins + firstMaxLosses);
            
            // 현재 팀이 1위 최대 승률을 넘기 위한 매직넘버 계산
            for (let additionalWins = 0; additionalWins <= team.remainingGames; additionalWins++) {
                const finalWins = team.wins + additionalWins;
                const finalLosses = team.losses + (team.remainingGames - additionalWins);
                const finalWinRate = finalWins / (finalWins + finalLosses);
                
                if (finalWinRate > firstMaxWinRate) {
                    return additionalWins;
                }
            }
            
            // 모든 경기를 이겨도 1위를 넘을 수 없는 경우 - 잔여경기수 표시
            return team.remainingGames;
        }
    }

    calculateEliminationMagic(team, index) {
        /**
         * 트래직넘버 계산 기준:
         * 1. 산술적 트래직넘버: 현재 5위팀을 넘어설 수 없게 되는 패배 수 (실시간 계산)
         * 2. 역대 기준 트래직넘버: 71승 달성 불가능해지는 패배 수
         * 
         * 현재 적용: 역대 기준 트래직넘버 (71승 기준 - 2015-2024 5위팀 평균)
         * - 플레이오프 매직넘버와 일관성 유지
         * - 안정적인 탈락 기준 제시
         */
        const HISTORIC_PLAYOFF_THRESHOLD = 71; // 역대 5위 평균 승수 기준 (2015-2024 평균 70.7승)
        const currentWins = team.wins;
        const currentLosses = team.losses;
        const remainingGames = team.remainingGames;
        const maxPossibleWins = currentWins + remainingGames;
        
        // 이미 71승 달성이 수학적으로 불가능하면 탈락
        if (maxPossibleWins < HISTORIC_PLAYOFF_THRESHOLD) {
            return 0; // 0이면 "탈락"으로 표시
        }
        
        // 71승 달성을 위해 필요한 최소 승수
        const neededWins = HISTORIC_PLAYOFF_THRESHOLD - currentWins;
        
        // 남은 경기에서 모두 져도 71승 달성 가능한 경우
        if (neededWins <= 0) {
            return 999; // 이미 71승 달성했거나 확정적으로 달성 가능
        }
        
        // 71승 달성 불가능해지는 패배 수 계산
        // 즉, 남은 경기 수가 필요한 승수보다 적어지는 시점
        const maxAllowableLosses = remainingGames - neededWins;
        
        if (maxAllowableLosses <= 0) {
            return 0; // 이미 탈락
        }
        
        // 현재부터 몇 패 더 하면 탈락인지 계산
        return maxAllowableLosses;
    }

    calculateHomeAdvantageMagic(team, index) {
        // 홈 어드밴티지 매직넘버: 2위 이내 확정을 위한 매직넘버
        if (index <= 1) {
            // 현재 1-2위 - 홈 어드밴티지 확정을 위한 매직넘버
            const thirdPlace = this.standings[2];
            if (!thirdPlace) return 0; // 3위가 없으면 이미 확정
            
            // 3위 팀의 최대 가능 승수보다 1승 더 필요
            const thirdMaxWins = thirdPlace.wins + thirdPlace.remainingGames;
            const neededWins = Math.max(0, thirdMaxWins - team.wins + 1);
            
            // 남은 경기로 달성 가능한지 확인
            return neededWins > team.remainingGames ? 999 : neededWins;
        } else {
            // 3위 이하 - 2위 진입을 위한 매직넘버
            const secondPlace = this.standings[1];
            const maxPossibleWins = team.wins + team.remainingGames;
            
            // 수학적으로 불가능한 경우
            if (maxPossibleWins < secondPlace.wins) {
                return 999; // 이미 수학적 불가능
            }
            
            // 2위 팀을 넘어서기 위해 필요한 승수
            const neededWins = Math.max(0, secondPlace.wins - team.wins + 1);
            return neededWins > team.remainingGames ? 999 : neededWins;
        }
    }

    // 7. 통합 서비스 데이터 생성
    generateServiceData() {
        console.log('📦 통합 서비스 데이터 생성 중...');
        
        const serviceData = {
            lastUpdated: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR'),
            note: '2025-season-data-clean.txt 기반 완전 자동화 처리',
            source: 'CLEAN_TXT_AUTOMATION',
            dataDate: this.games.length > 0 ? this.games[this.games.length - 1].date : null,
            totalGames: this.games.length,
            
            // 순위표
            standings: this.standings,
            
            // 매직넘버
            magicNumbers: this.magicNumbers,
            
            // 상대전적
            headToHead: this.headToHead,
            
            // 잔여경기
            remainingGames: this.remainingGames,
            
            // 1위 탈환 가능성 데이터
            chaseData: this.generateChaseData()
        };
        
        return serviceData;
    }

    // 1위 탈환 가능성 데이터 생성
    generateChaseData() {
        const firstPlace = this.standings[0];
        
        return this.standings.slice(1).map(team => {
            const maxPossibleWins = team.wins + team.remainingGames;
            const canChase = maxPossibleWins > firstPlace.wins;
            const firstTeamNeedToLose = Math.max(0, maxPossibleWins - firstPlace.wins);
            const requiredWinRate = team.remainingGames > 0 ? 
                Math.min(1, (this.typicalChampionshipWins - team.wins) / team.remainingGames) : 0;
            
            return {
                team: team.team,
                rank: team.rank,
                wins: team.wins,
                gamesBehind: team.gamesBehind,
                remainingGames: team.remainingGames,
                maxPossibleWins: maxPossibleWins,
                firstTeamNeedToLose: firstTeamNeedToLose,
                canChase: canChase,
                requiredWinRate: requiredWinRate,
                canReachChampionshipWins: maxPossibleWins >= this.typicalChampionshipWins
            };
        });
    }


    // 8. 파일 저장
    async saveAllData(serviceData) {
        console.log('💾 데이터 파일 저장 중...');
        
        try {
            // 1. PathManager를 사용한 안전한 경로로 통합 데이터 저장
            pathManager.ensureDir(pathManager.dataDir);
            const serviceDataPath = pathManager.getDataFile('service-data.json');
            fs.writeFileSync(serviceDataPath, JSON.stringify(serviceData, null, 2));
            console.log(`  ✅ ${serviceDataPath} 저장 완료`);
            
            // 2. magic-number 폴더에 웹서비스용 파일들 생성
            const rankingsData = {
                lastUpdated: serviceData.lastUpdated,
                updateDate: serviceData.updateDate,
                note: serviceData.note,
                rankings: serviceData.standings.map(team => ({
                    rank: team.rank,
                    team: team.team,
                    games: team.games,
                    wins: team.wins,
                    losses: team.losses,
                    draws: team.draws,
                    winRate: parseFloat(team.winRate.toFixed(3)),
                    gamesBehind: team.gamesBehind,
                    recent10: team.recent10,
                    streak: team.streak,
                    homeRecord: team.homeRecord,
                    awayRecord: team.awayRecord
                })),
                magicNumbers: serviceData.magicNumbers,
                lastMagicUpdate: serviceData.lastUpdated,
                totalTeams: 10,
                source: serviceData.source,
                dataDate: serviceData.dataDate
            };
            
            // 3. PathManager를 사용한 안전한 경로로 웹서비스 파일들 생성
            const rankingsPath = pathManager.getDataFile('kbo-rankings.json');
            fs.writeFileSync(rankingsPath, JSON.stringify(rankingsData, null, 2));
            
            // 상대전적 데이터도 업데이트
            const recordsData = {
                lastUpdated: serviceData.lastUpdated,
                updateDate: serviceData.updateDate,
                note: serviceData.note,
                totalData: serviceData.headToHead,
                source: serviceData.source,
                dataDate: serviceData.dataDate
            };
            
            const recordsPath = pathManager.getDataFile('kbo-records.json');
            fs.writeFileSync(recordsPath, JSON.stringify(recordsData, null, 2));
            
            // service-data.json은 이미 위에서 저장됨
            
            console.log(`  ✅ ${rankingsPath} 저장 완료`);
            console.log(`  ✅ ${recordsPath} 저장 완료`);
            
        } catch (error) {
            console.error('❌ 파일 저장 실패:', error.message);
            throw error;
        }
    }

    // 유틸리티 함수들
    formatRecent10(games) {
        const wins = games.filter(g => g === '승').length;
        const losses = games.filter(g => g === '패').length;
        const draws = games.filter(g => g === '무').length;
        
        return `${wins}승${draws}무${losses}패`;
    }

    calculateStreak(recent) {
        if (recent.length === 0) return { type: '', count: 0 };
        
        // 가장 최근부터 거꾸로 순회하며 승 또는 패 연속 찾기
        let streakType = '';
        let count = 0;
        
        for (let i = recent.length - 1; i >= 0; i--) {
            const result = recent[i];
            
            // 무승부는 연속에 영향을 주지 않음 (건드리지 않고 패스)
            if (result === '무') {
                continue;
            }
            
            // 첫 번째 승/패 결과를 찾은 경우
            if (streakType === '') {
                streakType = result;
                count = 1;
            }
            // 같은 결과가 연속되는 경우
            else if (result === streakType) {
                count++;
            }
            // 다른 결과가 나오면 연속 중단
            else {
                break;
            }
        }
        
        return { type: streakType, count: count };
    }

    formatStreak(streak) {
        if (streak.count === 0) return '-';
        return `${streak.count}${streak.type}`;
    }

    // 메인 실행 함수
    async run() {
        try {
            console.log('🚀 KBO 데이터 완전 자동화 처리 시작...\n');
            
            // 1단계: 데이터 파싱
            const parseResult = this.parseGameData();
            
            // 2단계: 통계 계산
            this.calculateTeamStats();
            
            // 3단계: 상대전적 계산
            this.calculateHeadToHead();
            
            // 4단계: 잔여경기 계산
            this.calculateRemainingGames();
            
            // 5단계: 순위 계산
            this.calculateStandings();
            
            // 6단계: 매직넘버 계산
            this.calculateMagicNumbers();
            
            // 7단계: 서비스 데이터 생성
            const serviceData = this.generateServiceData();
            
            // 8단계: 파일 저장
            await this.saveAllData(serviceData);
            
            console.log('\n🎉 KBO 데이터 완전 자동화 처리 완료!');
            console.log(`📊 총 ${parseResult.gameCount}경기 처리`);
            console.log(`📅 최신 데이터: ${parseResult.lastDate}`);
            console.log('📁 생성된 파일:');
            console.log(`   - ${pathManager.getDataFile('service-data.json')} (통합 웹서비스 데이터)`);
            console.log(`   - ${pathManager.getDataFile('kbo-rankings.json')} (웹서비스용 순위)`);
            console.log(`   - ${pathManager.getDataFile('kbo-records.json')} (웹서비스용 상대전적)`);
            
        } catch (error) {
            console.error('\n❌ 처리 중 오류 발생:', error.message);
            process.exit(1);
        }
    }
}

// 실행
if (require.main === module) {
    const processor = new KBODataProcessor();
    processor.run();
}

module.exports = KBODataProcessor;