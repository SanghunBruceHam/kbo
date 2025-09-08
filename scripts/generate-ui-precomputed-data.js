#!/usr/bin/env node

/**
 * 루트 index.html의 계산 로직을 JSON으로 사전 계산하는 스크립트
 * 연승/연패 분석, 반기 통계, 팀 설정 등을 미리 계산
 */

const fs = require('fs');
const path = require('path');

// 기존 데이터 파일들 읽기
function loadExistingData() {
    try {
        const gameRecords = JSON.parse(fs.readFileSync('magic-number/data/raw-game-records.json', 'utf8'));
        const standings = JSON.parse(fs.readFileSync('magic-number/data/calc-standings.json', 'utf8'));
        const seasonGames = JSON.parse(fs.readFileSync('magic-number/data/2025-season-games.json', 'utf8'));
        
        return { gameRecords, standings, seasonGames };
    } catch (error) {
        console.error('기존 데이터 파일 로드 실패:', error.message);
        return null;
    }
}

// 연승/연패 패턴 계산 (기존 로직 포팅)
function calculateStreakPatternsFromGames(games) {
    if (!games || games.length === 0) {
        return {
            winStreaks: {},
            loseStreaks: {},
            maxWinStreak: 0,
            maxLoseStreak: 0,
            totalGames: 0
        };
    }

    const winStreaks = {};
    const loseStreaks = {};
    let currentStreak = 0;
    let currentType = null;
    let maxWinStreak = 0;
    let maxLoseStreak = 0;

    // 무승부가 아닌 경기만 필터링
    const filteredGames = games.filter(g => g.result === 'W' || g.result === 'L');

    for (let i = 0; i < filteredGames.length; i++) {
        const game = filteredGames[i];
        const gameResult = game.result;

        if (gameResult === currentType) {
            currentStreak++;
        } else {
            // 이전 연속 기록 저장
            if (currentType === 'W' && currentStreak > 0) {
                winStreaks[currentStreak] = (winStreaks[currentStreak] || 0) + 1;
                maxWinStreak = Math.max(maxWinStreak, currentStreak);
            } else if (currentType === 'L' && currentStreak > 0) {
                loseStreaks[currentStreak] = (loseStreaks[currentStreak] || 0) + 1;
                maxLoseStreak = Math.max(maxLoseStreak, currentStreak);
            }

            // 새로운 연속 시작
            currentType = gameResult;
            currentStreak = 1;
        }
    }

    // 마지막 연속 기록 처리
    if (currentType === 'W' && currentStreak > 0) {
        winStreaks[currentStreak] = (winStreaks[currentStreak] || 0) + 1;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
    } else if (currentType === 'L' && currentStreak > 0) {
        loseStreaks[currentStreak] = (loseStreaks[currentStreak] || 0) + 1;
        maxLoseStreak = Math.max(maxLoseStreak, currentStreak);
    }

    return {
        winStreaks,
        loseStreaks,
        maxWinStreak,
        maxLoseStreak,
        totalGames: filteredGames.length
    };
}

// 전체 팀의 연승/연패 분석
function analyzeAllTeamsStreaks(gameRecords, standings) {
    const allTeamsData = {};
    
    // 순위 기반 팀 순서 생성
    const teamRanks = {};
    const teams = standings.rankings.map((team, index) => {
        teamRanks[team.team] = team.rank || (index + 1);
        return team.team;
    });

    // 각 팀별 연승/연패 패턴 분석
    Object.keys(gameRecords).forEach(teamName => {
        const teamGames = gameRecords[teamName];
        if (teamGames && Array.isArray(teamGames)) {
            allTeamsData[teamName] = calculateStreakPatternsFromGames(teamGames);
        }
    });

    return { allTeamsData, teams, teamRanks };
}

// 올스타전 기준 전후반기 성적 계산 (간소화 버전)
function calculateHalfSeasonStats(seasonGamesArray) {
    const halfSeasonStats = {};
    const allStarDate = new Date('2025-07-12'); // KBO 올스타전 기준
    
    // 배열을 팀별로 그룹화
    const gamesByTeam = {};
    
    seasonGamesArray.forEach(game => {
        const homeTeam = game.home_team;
        const awayTeam = game.away_team;
        const gameDate = new Date(game.date);
        
        if (!gamesByTeam[homeTeam]) gamesByTeam[homeTeam] = [];
        if (!gamesByTeam[awayTeam]) gamesByTeam[awayTeam] = [];
        
        // 홈팀 기록
        gamesByTeam[homeTeam].push({
            date: game.date,
            result: game.winner === homeTeam ? 'W' : (game.winner === 'T' ? 'T' : 'L')
        });
        
        // 원정팀 기록
        gamesByTeam[awayTeam].push({
            date: game.date,
            result: game.winner === awayTeam ? 'W' : (game.winner === 'T' ? 'T' : 'L')
        });
    });

    // 각 팀별 전후반기 통계 계산
    Object.keys(gamesByTeam).forEach(teamName => {
        const games = gamesByTeam[teamName] || [];
        
        let firstHalf = { wins: 0, losses: 0, draws: 0, games: 0 };
        let secondHalf = { wins: 0, losses: 0, draws: 0, games: 0 };

        games.forEach(game => {
            const gameDate = new Date(game.date);
            const half = gameDate <= allStarDate ? firstHalf : secondHalf;
            
            half.games++;
            if (game.result === 'W') half.wins++;
            else if (game.result === 'L') half.losses++;
            else if (game.result === 'T') half.draws++;
        });

        // 승률 계산
        firstHalf.winRate = firstHalf.wins + firstHalf.losses > 0 ? 
            (firstHalf.wins / (firstHalf.wins + firstHalf.losses)) : 0;
        secondHalf.winRate = secondHalf.wins + secondHalf.losses > 0 ? 
            (secondHalf.wins / (secondHalf.wins + secondHalf.losses)) : 0;

        halfSeasonStats[teamName] = { firstHalf, secondHalf };
    });

    return halfSeasonStats;
}

// 메인 실행 함수
function generatePrecomputedData() {
    console.log('🔄 UI 사전 계산 데이터 생성 시작...');
    
    const data = loadExistingData();
    if (!data) {
        console.error('❌ 필요한 데이터 파일을 로드할 수 없습니다.');
        process.exit(1);
    }

    const { gameRecords, standings, seasonGames } = data;

    // 연승/연패 분석
    console.log('📊 연승/연패 패턴 분석 중...');
    const streakAnalysis = analyzeAllTeamsStreaks(gameRecords, standings);

    // 전후반기 성적 분석
    console.log('📊 전후반기 성적 분석 중...');
    const halfSeasonStats = calculateHalfSeasonStats(seasonGames);

    // 팀 설정 데이터
    const teamConfigurations = {
        "한화": { fullName: "한화 이글스", color: "#FF6600", logo: "images/teams/hanwha.png", logoAlt: "한화" },
        "LG": { fullName: "LG 트윈스", color: "#C50E2E", logo: "images/teams/lg.png", logoAlt: "LG" },
        "두산": { fullName: "두산 베어스", color: "#131230", logo: "images/teams/doosan.png", logoAlt: "두산" },
        "삼성": { fullName: "삼성 라이온즈", color: "#1F4E8C", logo: "images/teams/samsung.png", logoAlt: "삼성" },
        "KIA": { fullName: "KIA 타이거즈", color: "#EA0029", logo: "images/teams/kia.png", logoAlt: "KIA" },
        "SSG": { fullName: "SSG 랜더스", color: "#CE0E2D", logo: "images/teams/ssg.png", logoAlt: "SSG" },
        "롯데": { fullName: "롯데 자이언츠", color: "#041E42", logo: "images/teams/lotte.png", logoAlt: "롯데" },
        "NC": { fullName: "NC 다이노스", color: "#315288", logo: "images/teams/nc.png", logoAlt: "NC" },
        "키움": { fullName: "키움 히어로즈", color: "#570514", logo: "images/teams/kiwoom.png", logoAlt: "키움" },
        "KT": { fullName: "KT 위즈", color: "#333333", logo: "images/teams/kt.png", logoAlt: "KT" }
    };

    // 잔여 경기 일정 (현재 날짜 이후만)
    const currentDate = new Date();
    const scheduleData = {
        remainingGames: [
            { date: "09.09", teams: ["한화", "SSG", "KIA", "LG", "KT", "키움", "삼성", "두산", "NC", "롯데"] },
            { date: "09.10", teams: ["한화", "SSG", "KIA", "LG", "KT", "키움", "삼성", "두산", "NC", "롯데"] },
            { date: "09.11", teams: ["한화", "SSG", "KIA", "LG", "KT", "키움", "삼성", "두산", "NC", "롯데"] },
            { date: "09.12", teams: ["한화", "SSG", "KIA", "LG", "KT", "키움", "삼성", "두산", "NC", "롯데"] },
            { date: "09.13", teams: ["한화", "SSG", "KIA", "LG", "KT", "키움", "삼성", "두산", "NC", "롯데"] }
        ].filter(schedule => {
            const scheduleDate = new Date(`2025-${schedule.date.replace('.', '-')}`);
            return scheduleDate >= currentDate;
        }),
        currentDate: currentDate.toISOString().split('T')[0],
        filteredFromCurrentDate: true
    };

    // 최종 결과 조합
    const result = {
        metadata: {
            lastUpdated: new Date().toISOString(),
            version: "1.0.0",
            description: "루트 index.html의 사전 계산된 UI 데이터"
        },
        teamConfigurations,
        precomputedStreakAnalysis: {
            allTeamsStreakData: streakAnalysis.allTeamsData,
            teamRankings: streakAnalysis.teamRanks,
            teamOrder: streakAnalysis.teams,
            lastCalculated: new Date().toISOString()
        },
        precomputedHalfSeasonStats: {
            allTeamsHalfStats: halfSeasonStats,
            lastCalculated: new Date().toISOString()
        },
        scheduleData
    };

    // 파일 저장
    const outputPath = 'data/ui-precomputed-data.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log('✅ UI 사전 계산 데이터 생성 완료');
    console.log(`📁 저장 위치: ${outputPath}`);
    console.log(`📊 분석된 팀 수: ${Object.keys(streakAnalysis.allTeamsData).length}`);
    console.log(`📅 잔여 경기 일정: ${scheduleData.remainingGames.length}일`);
}

// 실행
if (require.main === module) {
    generatePrecomputedData();
}

module.exports = { generatePrecomputedData };