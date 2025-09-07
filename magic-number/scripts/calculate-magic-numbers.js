const fs = require('fs');
const path = require('path');

const MAGIC_NUMBER_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(MAGIC_NUMBER_DIR, 'data');
const SERVICE_DATA_PATH = path.join(DATA_DIR, 'service-data.json');

function loadServiceData() {
    try {
        return JSON.parse(fs.readFileSync(SERVICE_DATA_PATH, 'utf8'));
    } catch (error) {
        console.error('❌ service-data.json 파일을 읽을 수 없습니다:', error.message);
        process.exit(1);
    }
}

// 플레이오프 진출 조건 매직/트래직 넘버 계산 함수들
function calcRemainingGames(team, totalGames) {
    return totalGames - (team.wins + team.losses + (team.draws || 0));
}

function maxPossibleWinRate(team, remainingGames) {
    const finalDenominator = team.wins + team.losses + remainingGames;
    return finalDenominator > 0 ? (team.wins + remainingGames) / finalDenominator : 0;
}

function minPossibleWinRate(team, remainingGames) {
    const finalDenominator = team.wins + team.losses + remainingGames;
    return finalDenominator > 0 ? team.wins / finalDenominator : 0;
}

function calculateK5Max(teams, targetTeam, totalGames) {
    const otherTeamsMaxRates = teams
        .filter(t => t.team !== targetTeam)
        .map(t => {
            const remaining = calcRemainingGames(t, totalGames);
            return maxPossibleWinRate(t, remaining);
        })
        .sort((a, b) => b - a);
    
    return otherTeamsMaxRates[4] || 0; // 5번째 값 (0-based index)
}

function calculateK5Min(teams, targetTeam, totalGames) {
    const otherTeamsMinRates = teams
        .filter(t => t.team !== targetTeam)
        .map(t => {
            const remaining = calcRemainingGames(t, totalGames);
            return minPossibleWinRate(t, remaining);
        })
        .sort((a, b) => b - a);
    
    return otherTeamsMinRates[4] || 0; // 5번째 값 (0-based index)
}

function calculatePlayoffMagicTragic(teams, totalGames = 144) {
    return teams.map(team => {
        const remainingGames = calcRemainingGames(team, totalGames);
        const finalDenominator = team.wins + team.losses + remainingGames;
        
        // 매직넘버 계산 (다른 팀들이 최대한 올라올 때)
        const K5_max = calculateK5Max(teams, team.team, totalGames);
        const magicRhs = K5_max * finalDenominator - team.wins;
        const magicStrict = Math.max(0, Math.floor(magicRhs) + 1);
        const magicTieOK = Math.max(0, Math.ceil(magicRhs));
        
        // 트래직넘버 계산 (다른 팀들이 최소로만 올라올 때도 내가 5위를 못 넘는 패수)
        const K5_min = calculateK5Min(teams, team.team, totalGames);
        const tragicBase = team.wins + remainingGames - K5_min * finalDenominator;
        
        // 트래직넘버: 몇 패 더 하면 5위 진출이 불가능해지는가
        let tragicStrict, tragicTieOK;
        if (tragicBase <= 0) {
            // 이미 탈락 확정 상태
            tragicStrict = 0;
            tragicTieOK = 0;
        } else {
            tragicStrict = Math.max(0, Math.min(remainingGames, Math.ceil(tragicBase)));
            tragicTieOK = Math.max(0, Math.min(remainingGames, Math.floor(tragicBase) + 1));
        }
        
        // 현재 최대 가능 승률 계산
        const maxPossibleWinRate = finalDenominator > 0 ? (team.wins + remainingGames) / finalDenominator : 0;
        
        // 상태 결정 삭제 - 숫자만 표시
        let playoffStatus = '';
        
        return {
            team: team.team,
            wins: team.wins,
            losses: team.losses,
            draws: team.draws || 0,
            remainingGames,
            K5_max: Number(K5_max.toFixed(3)),
            K5_min: Number(K5_min.toFixed(3)),
            playoffMagicStrict: magicStrict,
            playoffMagicTieOK: magicTieOK,
            playoffTragicStrict: tragicStrict,
            playoffTragicTieOK: tragicTieOK,
            playoffStatus
        };
    });
}

function calculateMagicNumbers(serviceData) {
    const standings = serviceData.standings;
    const totalGames = 144;
    
    console.log('📊 KBO 매직넘버 계산 시작 (승률 기준)...');
    
    const results = [];
    
    standings.forEach((team, index) => {
        const rank = index + 1;
        const wins = team.wins;
        const losses = team.losses;
        const gamesPlayed = wins + losses;
        const gamesRemaining = totalGames - gamesPlayed;
        const currentWinRate = wins / gamesPlayed;
        
        // 플레이오프 진출 매직넘버 비활성화
        let magicNumber = '-';
        let status = '';
        
        const teamResult = {
            rank,
            team: team.team,
            wins,
            losses,
            winRate: currentWinRate,
            gamesRemaining,
            magicNumber,
            status
        };
        
        results.push(teamResult);
        
        const magicDisplay = magicNumber === 0 ? '확정' : (magicNumber || 'N/A');
        const statusDisplay = status ? ` ${status}` : '';
        console.log(`${rank}위 ${team.team}: ${wins}승 ${losses}패 (승률 ${currentWinRate.toFixed(3)}, ${gamesRemaining}경기 남음) - 매직넘버: ${magicDisplay}${statusDisplay}`);
    });
    
    // 플레이오프 진출 매직/트래직 넘버 계산
    console.log('\n🏆 플레이오프 진출 매직/트래직 넘버 계산 중...');
    const playoffResults = calculatePlayoffMagicTragic(standings, totalGames);
    
    playoffResults.forEach(team => {
        console.log(`${team.team}: PO 매직넘버 ${team.playoffMagicStrict} / PO 트래직넘버 ${team.playoffTragicStrict} - ${team.playoffStatus}`);
    });
    
    // 매직넘버 매트릭스 데이터 파일 생성
    const matrixData = {
        lastUpdated: new Date().toISOString(),
        updateDate: new Date().toLocaleDateString('ko-KR'),
        note: "승률 기준 정확한 매직넘버 계산 + 플레이오프 진출 조건 포함",
        results: results,
        playoffResults: playoffResults
    };
    
    const outputPath = path.join(DATA_DIR, 'magic-matrix-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(matrixData, null, 2), 'utf8');
    console.log(`✅ 매직넘버 매트릭스 데이터 저장: ${outputPath}`);
    
    console.log('✅ 매직넘버 계산 완료!');
    return matrixData;
}

function main() {
    console.log('📈 순위 변동 매트릭스 생성 중...');
    
    const serviceData = loadServiceData();
    calculateMagicNumbers(serviceData);
}

if (require.main === module) {
    main();
}

module.exports = { calculateMagicNumbers };