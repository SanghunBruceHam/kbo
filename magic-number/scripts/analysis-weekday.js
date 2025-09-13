const fs = require('fs');
const path = require('path');

function generateWeekdayRecords() {
    console.log('📅 요일별 기록 분석 시작...');
    
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
        const weekdayStats = {};

        // 요일 한글 변환 함수
        function getDayOfWeek(date) {
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const d = new Date(date);
            return days[d.getDay()];
        }

        // 팀/요일 단위로 초기화
        teams.forEach(team => {
            weekdayStats[team] = {};
            ['월', '화', '수', '목', '금', '토', '일'].forEach(day => {
                weekdayStats[team][day] = { wins: 0, losses: 0, draws: 0 };
            });
        });
        
        // 각 경기 요일별 처리 (페넌트레이스 완료 경기만)
        games.forEach(game => {
            // 페넌트레이스이면서 완료된 경기만 처리
            if (!game.category || !game.category.includes('페넌트레이스') ||
                !game.state || game.state !== '종료') {
                return; // 페넌트레이스가 아니거나 완료되지 않은 경기는 제외
            }

            const dayOfWeek = getDayOfWeek(game.date);

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
        
        // 결과 정리 - DB와 동일한 구조
        const result = {
            updateTime: new Date().toISOString(),
            updateDate: new Date().toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Seoul'
            }),
            weekdayRecords: {}
        };
        
        teams.forEach(team => {
            result.weekdayRecords[team] = {};
            ['월', '화', '수', '목', '금', '토', '일'].forEach(day => {
                const stats = weekdayStats[team][day];
                if (stats.wins + stats.losses + stats.draws > 0) {
                    const winRate = stats.wins + stats.losses > 0 ?
                        (stats.wins / (stats.wins + stats.losses)).toFixed(3) : '0.000';
                    
                    result.weekdayRecords[team][day] = {
                        wins: stats.wins,
                        losses: stats.losses,
                        draws: stats.draws,
                        win_rate: winRate
                    };
                }
            });
        });
        
        // JSON 파일로 저장
        const outputPath = path.join(__dirname, '../data/analysis-weekday.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        
        console.log(`✅ 요일별 기록 분석 완료: ${outputPath}`);
        console.log(`📊 처리된 경기 수: ${games.length}개`);
        
        // 간단한 통계 출력
        console.log('\n📈 요일별 전체 경기 수:');
        const totalByDay = {};
        ['월', '화', '수', '목', '금', '토', '일'].forEach(day => {
            totalByDay[day] = 0;
            teams.forEach(team => {
                if (result.weekdayRecords[team][day]) {
                    const stats = result.weekdayRecords[team][day];
                    totalByDay[day] += stats.wins + stats.losses + stats.draws;
                }
            });
            console.log(`   ${day}요일: ${totalByDay[day]}경기`);
        });
        
        return result;
        
    } catch (error) {
        console.error('❌ 요일별 기록 분석 중 오류 발생:', error);
        throw error;
    }
}

// 실행
if (require.main === module) {
    generateWeekdayRecords();
}

module.exports = { generateWeekdayRecords };