const fs = require('fs');
const path = require('path');

const MAGIC_NUMBER_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(MAGIC_NUMBER_DIR, 'data');
const STATS_DATA_PATH = path.join(DATA_DIR, 'stats-comprehensive.json');

function loadServiceData() {
    try {
        return JSON.parse(fs.readFileSync(STATS_DATA_PATH, 'utf8'));
    } catch (error) {
        console.error('❌ stats-comprehensive.json 파일을 읽을 수 없습니다:', error.message);
        process.exit(1);
    }
}

// 포스트시즌 진출 조건 매직/트래직 넘버 계산 함수들
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
    
    return otherTeamsMinRates[3] || 0; // 4번째 값 (5위팀, 0-based index)
}


// ===== 새로운 1위 매직넘버/트래직넘버 계산 함수들 =====
function calcR(team, S) {
    return S - (team.wins + team.losses + (team.draws || 0));
}

function pMax(team, R) { // 남은 전승 가정
    const denom = team.wins + team.losses + R;
    return denom > 0 ? (team.wins + R) / denom : 0;
}

function pMin(team, R) { // 남은 전패 가정
    const denom = team.wins + team.losses + R;
    return denom > 0 ? team.wins / denom : 0;
}


/** 다른 팀들의 최대 가능 승률 중 최댓값 (1위 확정 기준) */
function K1_max_for(teams, targetTeam, S) {
    let best = 0;
    for (const t of teams) {
        if (t.team === targetTeam) continue;
        const R = calcR(t, S);
        const val = pMax(t, R);
        if (val > best) best = val;
    }
    return best;
}

/** 다른 팀들의 최소 가능 승률 중 최댓값 (1위 탈락 보장 기준) */
function K1_min_for(teams, targetTeam, S) {
    let best = 0;
    for (const t of teams) {
        if (t.team === targetTeam) continue;
        const R = calcR(t, S);
        const val = pMin(t, R);
        if (val > best) best = val;
    }
    return best;
}

/**
 * KBO 정규시즌 1위 매직넘버 & 트래직넘버 (RAW 표기: 잔여경기 캡핑 없음)
 */
function calculateFirstPlaceMagicTragicRaw(teams, totalGames = 144) {
    return teams.map(i => {
        const Ri = calcR(i, totalGames);
        const Di = i.wins + i.losses + Ri; // 최종 분모(무승부 제외)

        // 1) 1위 확정 기준: 타 팀들의 '최대 가능 승률' 최댓값
        const K1_max = K1_max_for(teams, i.team, totalGames);
        // (Wi + x) / Di > K1_max  → x > K1_max*Di - Wi
        const needWins_rhs = K1_max * Di - i.wins;
        const x_strict = Math.max(0, Math.floor(needWins_rhs) + 1); // RAW (>)
        const x_tieOK  = Math.max(0, Math.ceil(needWins_rhs));      // RAW (≥)

        // 2) 1위 탈락 보장 기준: 타 팀들의 '최소 가능 승률' 최댓값
        const K1_min = K1_min_for(teams, i.team, totalGames);
        // (Wi + Ri - y) / Di ≤ K1_min  → y ≥ Wi + Ri - K1_min*Di
        const lose_rhs = i.wins + Ri - K1_min * Di;
        const y_strict = Math.max(0, Math.ceil(lose_rhs));          // RAW (≤)
        const y_tieOK  = Math.max(0, Math.floor(lose_rhs) + 1);     // RAW (<)

        return {
            team: i.team,
            championshipMagic: x_strict,        // RAW 매직넘버 (잔여경기 캡핑 없음)
            championshipTragic: y_strict,       // RAW 트래직넘버 (잔여경기 캡핑 없음)
            championshipMagicTieOK: x_tieOK,    // 참고용
            championshipTragicTieOK: y_tieOK,   // 참고용
            K1_max: Number(K1_max.toFixed(3)),
            K1_min: Number(K1_min.toFixed(3)),
            remainingGames: Ri                   // 참고용
        };
    });
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
        
        // 트래직넘버: 몇 패 더 하면 5위 진출이 불가능해지는가 (캡핑 제거)
        let tragicStrict, tragicTieOK;
        if (tragicBase <= 0) {
            // 이미 탈락 확정 상태
            tragicStrict = 0;
            tragicTieOK = 0;
        } else {
            // raw 트래직넘버 값 그대로 표시 (잔여경기 수 제한 없음)
            tragicStrict = Math.max(0, Math.ceil(tragicBase));
            tragicTieOK = Math.max(0, Math.floor(tragicBase) + 1);
        }
        
        let playoffStatus = '';
        
        // playoffCondition 필드 제거 - UI에서 사용하지 않음
        
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

// 순위 관련 매직넘버 계산 함수들
function calculateRankMagic(team, standings, targetRank, totalGames = 144) {
    const remainingGames = totalGames - team.games;
    
    if (targetRank >= 0 && targetRank < standings.length) {
        const targetTeam = standings[targetRank];
        const targetMaxWins = targetTeam.wins + (totalGames - targetTeam.games);
        const magicNumber = Math.max(0, targetMaxWins - team.wins + 1);
        
        // 이미 목표 달성했거나 불가능한 경우 처리
        if (team.wins > targetMaxWins) return 0;
        if (team.wins + remainingGames < targetTeam.wins) return 999;
        
        return Math.min(magicNumber, remainingGames);
    }
    return 0;
}

function calculateDropRankMagic(team, standings, dropToRank, totalGames = 144) {
    if (dropToRank < standings.length) {
        const dropTeam = standings[dropToRank];
        const dropMaxWins = dropTeam.wins + (totalGames - dropTeam.games);
        return Math.max(0, dropMaxWins - team.wins + 1);
    }
    return 0;
}

function calculateChampionshipMagic(team, standings, totalGames = 144) {
    if (standings.length < 2) return 0;
    
    const secondPlace = standings[1];
    const secondMaxWins = secondPlace.wins + (totalGames - secondPlace.games);
    const magicNumber = Math.max(0, secondMaxWins - team.wins + 1);
    
    const remainingGames = totalGames - team.games;
    if (team.wins + remainingGames < secondPlace.wins) return 999;
    
    return Math.min(magicNumber, remainingGames);
}

function calculateRankingMagicNumbers(standings, totalGames = 144) {
    return standings.map((team, index) => {
        return {
            team: team.team,
            currentRank: team.rank || team.displayRank || (index + 1),
            championshipMagic: index === 0 ? calculateChampionshipMagic(team, standings, totalGames) : 999,
            rank2Magic: calculateRankMagic(team, standings, 1, totalGames),
            rank3Magic: calculateRankMagic(team, standings, 2, totalGames),
            rank4Magic: calculateRankMagic(team, standings, 3, totalGames),
            rank5Magic: calculateRankMagic(team, standings, 4, totalGames),
            dropRank6Tragic: calculateDropRankMagic(team, standings, 5, totalGames),
            dropRank7Tragic: calculateDropRankMagic(team, standings, 6, totalGames),
            dropRank8Tragic: calculateDropRankMagic(team, standings, 7, totalGames),
            dropRank9Tragic: calculateDropRankMagic(team, standings, 8, totalGames)
        };
    });
}

function calculateMagicNumbers(serviceData) {
    const standings = serviceData.standings;
    const totalGames = 144;
    
    console.log('📊 KBO 매직넘버 계산 시작 (승률 기준)...');
    
    const results = [];
    
    standings.forEach((team, index) => {
        const rank = team.rank || team.displayRank || (index + 1);
        const wins = team.wins;
        const losses = team.losses;
        const gamesPlayed = wins + losses;
        const gamesRemaining = totalGames - gamesPlayed;
        const currentWinRate = wins / gamesPlayed;
        
        // 포스트시즌 진출 매직넘버 비활성화
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
    
    // 포스트시즌 진출 매직/트래직 넘버 계산
    console.log('\n🏆 포스트시즌 진출 매직/트래직 넘버 계산 중...');
    const playoffResults = calculatePlayoffMagicTragic(standings, totalGames);
    
    playoffResults.forEach(team => {
        console.log(`${team.team}: PS 매직넘버 ${team.playoffMagicStrict} / PS 트래직넘버 ${team.playoffTragicStrict} - ${team.playoffStatus}`);
    });

    // 1위 매직/트래직 넘버 계산 (RAW 버전)
    console.log('\n👑 1위 매직/트래직 넘버 계산 중 (RAW 버전)...');
    const championshipResults = calculateFirstPlaceMagicTragicRaw(standings, totalGames);
    
    championshipResults.forEach(team => {
        console.log(`${team.team}: 우승 매직넘버 ${team.championshipMagic} / 우승 트래직넘버 ${team.championshipTragic}`);
    });
    
    // playoffResults에 championshipMagic/Tragic 데이터 병합
    playoffResults.forEach(playoffTeam => {
        const championshipTeam = championshipResults.find(c => c.team === playoffTeam.team);
        if (championshipTeam) {
            playoffTeam.championshipMagic = championshipTeam.championshipMagic;
            playoffTeam.championshipTragic = championshipTeam.championshipTragic;
        }
    });

    // 1위 탈환 가능성 상태 계산 추가
    const firstPlaceTeam = playoffResults.reduce((prev, curr) => {
        const prevRate = prev.wins / (prev.wins + prev.losses);
        const currRate = curr.wins / (curr.wins + curr.losses);
        return currRate > prevRate ? curr : prev;
    });

    playoffResults.forEach(team => {
        const maxPossibleWins = team.wins + team.remainingGames;
        
        if (team.team === firstPlaceTeam.team) {
            // 현재 1위팀: 이미 1위이므로 탈환이 아니라 유지의 개념
            team.firstPlaceStatus = '현재 1위';
        } else {
            // 다른 팀들: championshipTragic > 0이면 아직 우승 가능, 0이면 불가능
            if (team.championshipTragic > 0) {
                team.firstPlaceStatus = '가능';    // 아직 우승(1위) 기회 있음
            } else {
                team.firstPlaceStatus = '불가능';  // 이미 우승(1위) 기회 상실
            }
        }
    });

    // 추가 매직넘버 계산 (순위 관련)
    const rankingMagicData = calculateRankingMagicNumbers(standings, totalGames);
    
    // playoffCondition 필드 제거 - UI에서 직접 계산하므로 여기서는 생성하지 않음
    
    // 매직넘버 매트릭스 데이터 파일 생성
    const matrixData = {
        lastUpdated: new Date().toISOString(),
        updateDate: new Date().toLocaleDateString('ko-KR'),
        note: "승률 기준 정확한 매직넘버 계산 + 포스트시즌 진출 조건 + 1위 매직/트래직넘버 포함",
        results: results,
        playoffResults: playoffResults,
        rankingMagicData: rankingMagicData
    };
    
    const outputPath = path.join(DATA_DIR, 'calc-magic-numbers.json');
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