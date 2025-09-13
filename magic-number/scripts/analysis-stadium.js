const fs = require('fs');
const path = require('path');

function generateStadiumRecords() {
    console.log('🏟️ 경기장별 기록 분석 시작...');
    
    try {
        // 게임 데이터 로드
        const gamesPath = path.join(__dirname, '../data/2025-season-games.json');
        if (!fs.existsSync(gamesPath)) {
            console.error('❌ 2025-season-games.json 파일을 찾을 수 없습니다.');
            return;
        }
        
        const gamesData = fs.readFileSync(gamesPath, 'utf-8');
        const games = JSON.parse(gamesData);

        // 실제 게임 데이터에서 팀 이름 수집
        const actualTeams = new Set();
        games.forEach(game => {
            actualTeams.add(game.home_team);
            actualTeams.add(game.away_team);
        });

        const teams = Array.from(actualTeams);
        const stadiumStats = {};

        // 경기장 정보 매핑
        const stadiums = {
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

        function getStadium(homeTeam) {
            return stadiums[homeTeam] || '미상';
        }

        // 팀/경기장 단위로 초기화
        teams.forEach(team => {
            stadiumStats[team] = {};
        });
        
        // 각 경기 경기장별 처리
        games.forEach(game => {
            const stadium = getStadium(game.home_team);

            // 홈팀 처리
            if (stadiumStats[game.home_team]) {
                if (!stadiumStats[game.home_team][stadium]) {
                    stadiumStats[game.home_team][stadium] = { wins: 0, losses: 0, draws: 0 };
                }

                if (game.winner === game.home_team) {
                    stadiumStats[game.home_team][stadium].wins++;
                } else if (game.winner === game.away_team) {
                    stadiumStats[game.home_team][stadium].losses++;
                } else {
                    stadiumStats[game.home_team][stadium].draws++;
                }
            }

            // 원정팀 처리
            if (stadiumStats[game.away_team]) {
                if (!stadiumStats[game.away_team][stadium]) {
                    stadiumStats[game.away_team][stadium] = { wins: 0, losses: 0, draws: 0 };
                }

                if (game.winner === game.away_team) {
                    stadiumStats[game.away_team][stadium].wins++;
                } else if (game.winner === game.home_team) {
                    stadiumStats[game.away_team][stadium].losses++;
                } else {
                    stadiumStats[game.away_team][stadium].draws++;
                }
            }
        });
        
        // 결과 정리 - DB와 동일한 구조
        const result = {
            updateTime: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Seoul'
            }),
            stadiumRecords: {}
        };
        
        teams.forEach(team => {
            result.stadiumRecords[team] = [];
            
            Object.entries(stadiumStats[team]).forEach(([stadium, stats]) => {
                if (stats.wins + stats.losses + stats.draws > 0) {
                    const winRate = stats.wins + stats.losses > 0 ?
                        (stats.wins / (stats.wins + stats.losses)).toFixed(3) : '0.000';
                    
                    result.stadiumRecords[team].push({
                        stadium,
                        wins: stats.wins,
                        losses: stats.losses,
                        draws: stats.draws,
                        win_rate: winRate
                    });
                }
            });
            
            // 승률순 정렬
            result.stadiumRecords[team].sort((a, b) => parseFloat(b.win_rate) - parseFloat(a.win_rate));
        });
        
        // JSON 파일로 저장
        const outputPath = path.join(__dirname, '../data/analysis-stadium.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        
        console.log(`✅ 경기장별 기록 분석 완료: ${outputPath}`);
        console.log(`📊 처리된 경기 수: ${games.length}개`);
        
        // 간단한 통계 출력
        console.log('\n🏟️ 경기장별 총 경기 수:');
        const stadiumTotals = {};
        
        teams.forEach(team => {
            result.stadiumRecords[team].forEach(record => {
                if (!stadiumTotals[record.stadium]) {
                    stadiumTotals[record.stadium] = 0;
                }
                stadiumTotals[record.stadium] += record.wins + record.losses + record.draws;
            });
        });
        
        Object.entries(stadiumTotals)
            .sort((a, b) => b[1] - a[1])
            .forEach(([stadium, total]) => {
                console.log(`   ${stadium}: ${Math.floor(total/2)}경기`); // 2로 나누는 이유: 홈/원정 중복 계산
            });
        
        return result;
        
    } catch (error) {
        console.error('❌ 경기장별 기록 분석 중 오류 발생:', error);
        throw error;
    }
}

// 실행
if (require.main === module) {
    generateStadiumRecords();
}

module.exports = { generateStadiumRecords };