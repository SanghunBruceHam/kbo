const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class EnhancedKBODatabase {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, '../data/kbo-2025-enhanced.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Enhanced SQLite 데이터베이스 연결 성공:', this.dbPath);
                    resolve();
                }
            });
        });
    }

    async createTables() {
        const queries = [
            // 향상된 경기 테이블
            `CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                day_of_week TEXT NOT NULL,
                stadium TEXT,
                home_team TEXT NOT NULL,
                away_team TEXT NOT NULL,
                home_score INTEGER NOT NULL,
                away_score INTEGER NOT NULL,
                winner TEXT,
                score_diff INTEGER,
                is_shutout BOOLEAN DEFAULT 0,
                is_blowout BOOLEAN DEFAULT 0,
                is_one_run_game BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // 향상된 팀 통계 테이블
            `CREATE TABLE IF NOT EXISTS team_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_name TEXT UNIQUE NOT NULL,
                games_played INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                draws INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0,
                runs_scored INTEGER DEFAULT 0,
                runs_allowed INTEGER DEFAULT 0,
                run_differential INTEGER DEFAULT 0,
                pythagorean_expectation REAL DEFAULT 0,
                luck_factor REAL DEFAULT 0,
                one_run_games_won INTEGER DEFAULT 0,
                one_run_games_lost INTEGER DEFAULT 0,
                one_run_win_rate REAL DEFAULT 0,
                blowout_wins INTEGER DEFAULT 0,
                blowout_losses INTEGER DEFAULT 0,
                shutout_wins INTEGER DEFAULT 0,
                shutout_losses INTEGER DEFAULT 0,
                comeback_wins INTEGER DEFAULT 0,
                home_wins INTEGER DEFAULT 0,
                home_losses INTEGER DEFAULT 0,
                home_win_rate REAL DEFAULT 0,
                away_wins INTEGER DEFAULT 0,
                away_losses INTEGER DEFAULT 0,
                away_win_rate REAL DEFAULT 0,
                home_advantage_index REAL DEFAULT 0,
                vs_above_500_wins INTEGER DEFAULT 0,
                vs_above_500_losses INTEGER DEFAULT 0,
                vs_below_500_wins INTEGER DEFAULT 0,
                vs_below_500_losses INTEGER DEFAULT 0,
                current_streak TEXT DEFAULT '0',
                max_win_streak INTEGER DEFAULT 0,
                max_lose_streak INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // 월별 성적 테이블
            `CREATE TABLE IF NOT EXISTS monthly_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_name TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                draws INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0,
                runs_scored INTEGER DEFAULT 0,
                runs_allowed INTEGER DEFAULT 0,
                UNIQUE(team_name, year, month)
            )`,
            
            // 요일별 성적 테이블
            `CREATE TABLE IF NOT EXISTS weekday_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_name TEXT NOT NULL,
                day_of_week TEXT NOT NULL,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                draws INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0,
                UNIQUE(team_name, day_of_week)
            )`,
            
            // 경기장별 성적 테이블
            `CREATE TABLE IF NOT EXISTS stadium_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_name TEXT NOT NULL,
                stadium TEXT NOT NULL,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                draws INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0,
                UNIQUE(team_name, stadium)
            )`,
            
            // 시리즈 기록 테이블
            `CREATE TABLE IF NOT EXISTS series_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_name TEXT NOT NULL,
                sweep_wins INTEGER DEFAULT 0,
                sweep_losses INTEGER DEFAULT 0,
                winning_series INTEGER DEFAULT 0,
                losing_series INTEGER DEFAULT 0,
                split_series INTEGER DEFAULT 0
            )`,
            
            // 인덱스 생성
            `CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)`,
            `CREATE INDEX IF NOT EXISTS idx_games_teams ON games(home_team, away_team)`,
            `CREATE INDEX IF NOT EXISTS idx_games_stadium ON games(stadium)`,
            `CREATE INDEX IF NOT EXISTS idx_games_day ON games(day_of_week)`,
            `CREATE INDEX IF NOT EXISTS idx_team_stats_name ON team_stats(team_name)`,
            `CREATE INDEX IF NOT EXISTS idx_monthly_team ON monthly_records(team_name, year, month)`,
            `CREATE INDEX IF NOT EXISTS idx_weekday_team ON weekday_records(team_name, day_of_week)`
        ];

        for (const query of queries) {
            await this.run(query);
        }
        console.log('✅ Enhanced 테이블 생성 완료');
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // 경기장 정보를 추출하는 함수 (홈팀 기준)
    getStadium(homeTeam) {
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
        return stadiums[homeTeam] || '미상';
    }

    // 요일 한글 변환
    getDayOfWeek(date) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const d = new Date(date);
        return days[d.getDay()];
    }

    async importEnhancedGamesFromJSON() {
        // JSON 파일 읽기
        const jsonPath = path.join(__dirname, '../data/2025-season-games.json');
        
        if (!fs.existsSync(jsonPath)) {
            const { parseSeasonData } = require('./parse-season-data');
            parseSeasonData();
        }
        
        const games = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        // 기존 데이터 삭제
        await this.run('DELETE FROM games');
        
        // 경기 데이터 삽입
        const insertGame = `INSERT INTO games 
            (date, day_of_week, stadium, home_team, away_team, home_score, away_score, 
             winner, score_diff, is_shutout, is_blowout, is_one_run_game) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        for (const game of games) {
            const scoreDiff = Math.abs(game.home_score - game.away_score);
            const isShutout = game.home_score === 0 || game.away_score === 0;
            const isBlowout = scoreDiff >= 5;
            const isOneRunGame = scoreDiff === 1;
            const dayOfWeek = this.getDayOfWeek(game.date);
            const stadium = this.getStadium(game.home_team);
            
            await this.run(insertGame, [
                game.date,
                dayOfWeek,
                stadium,
                game.home_team,
                game.away_team,
                game.home_score,
                game.away_score,
                game.winner,
                scoreDiff,
                isShutout ? 1 : 0,
                isBlowout ? 1 : 0,
                isOneRunGame ? 1 : 0
            ]);
        }
        
        console.log(`✅ ${games.length}개의 향상된 경기 데이터 임포트 완료`);
        
        // 모든 통계 업데이트
        await this.updateAllStats();
    }

    async updateAllStats() {
        await this.updateEnhancedTeamStats();
        await this.updateMonthlyRecords();
        await this.updateWeekdayRecords();
        await this.updateStadiumRecords();
        console.log('✅ 모든 통계 업데이트 완료');
    }

    async updateEnhancedTeamStats() {
        const teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
        
        // 기존 통계 초기화
        await this.run('DELETE FROM team_stats');
        
        for (const team of teams) {
            // 기본 통계
            const basicStats = await this.calculateBasicStats(team);
            
            // 피타고리안 기대승률 계산
            const pythagoreanExp = this.calculatePythagorean(
                basicStats.runs_scored, 
                basicStats.runs_allowed
            );
            
            // 운 지수 계산
            const luckFactor = basicStats.win_rate - pythagoreanExp;
            
            // 1점차 경기 통계
            const oneRunStats = await this.calculateOneRunStats(team);
            
            // 대량득실점 경기 통계
            const blowoutStats = await this.calculateBlowoutStats(team);
            
            // 완봉 경기 통계
            const shutoutStats = await this.calculateShutoutStats(team);
            
            // 홈/원정 통계
            const homeAwayStats = await this.calculateHomeAwayStats(team);
            
            // 상위/하위권 상대 통계
            const vsLevelStats = await this.calculateVsLevelStats(team);
            
            // 연승/연패 통계
            const streakStats = await this.calculateStreakStats(team);
            
            // 팀 통계 삽입
            await this.run(`
                INSERT INTO team_stats 
                (team_name, games_played, wins, losses, draws, win_rate,
                 runs_scored, runs_allowed, run_differential,
                 pythagorean_expectation, luck_factor,
                 one_run_games_won, one_run_games_lost, one_run_win_rate,
                 blowout_wins, blowout_losses,
                 shutout_wins, shutout_losses,
                 home_wins, home_losses, home_win_rate,
                 away_wins, away_losses, away_win_rate,
                 home_advantage_index,
                 vs_above_500_wins, vs_above_500_losses,
                 vs_below_500_wins, vs_below_500_losses,
                 current_streak, max_win_streak, max_lose_streak)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                team,
                basicStats.games_played,
                basicStats.wins,
                basicStats.losses,
                basicStats.draws,
                basicStats.win_rate,
                basicStats.runs_scored,
                basicStats.runs_allowed,
                basicStats.run_differential,
                pythagoreanExp,
                luckFactor,
                oneRunStats.wins,
                oneRunStats.losses,
                oneRunStats.win_rate,
                blowoutStats.wins,
                blowoutStats.losses,
                shutoutStats.wins,
                shutoutStats.losses,
                homeAwayStats.home_wins,
                homeAwayStats.home_losses,
                homeAwayStats.home_win_rate,
                homeAwayStats.away_wins,
                homeAwayStats.away_losses,
                homeAwayStats.away_win_rate,
                homeAwayStats.home_advantage_index,
                vsLevelStats.vs_above_wins,
                vsLevelStats.vs_above_losses,
                vsLevelStats.vs_below_wins,
                vsLevelStats.vs_below_losses,
                streakStats.current,
                streakStats.maxWin,
                streakStats.maxLose
            ]);
        }
        
        console.log('✅ Enhanced 팀 통계 업데이트 완료');
    }

    // 피타고리안 기대승률 계산
    calculatePythagorean(runsScored, runsAllowed, exponent = 2) {
        if (runsAllowed === 0) return 1;
        return Math.pow(runsScored, exponent) / 
               (Math.pow(runsScored, exponent) + Math.pow(runsAllowed, exponent));
    }

    async calculateBasicStats(team) {
        const homeStats = await this.get(`
            SELECT 
                COUNT(*) as games,
                SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN winner != ? AND winner != 'draw' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as draws,
                SUM(home_score) as runs_scored,
                SUM(away_score) as runs_allowed
            FROM games WHERE home_team = ?
        `, [team, team, team]);
        
        const awayStats = await this.get(`
            SELECT 
                COUNT(*) as games,
                SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN winner != ? AND winner != 'draw' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as draws,
                SUM(away_score) as runs_scored,
                SUM(home_score) as runs_allowed
            FROM games WHERE away_team = ?
        `, [team, team, team]);
        
        const totalGames = (homeStats.games || 0) + (awayStats.games || 0);
        const totalWins = (homeStats.wins || 0) + (awayStats.wins || 0);
        const totalLosses = (homeStats.losses || 0) + (awayStats.losses || 0);
        const totalDraws = (homeStats.draws || 0) + (awayStats.draws || 0);
        const totalRunsScored = (homeStats.runs_scored || 0) + (awayStats.runs_scored || 0);
        const totalRunsAllowed = (homeStats.runs_allowed || 0) + (awayStats.runs_allowed || 0);
        const winRate = totalWins + totalLosses > 0 ? 
            totalWins / (totalWins + totalLosses) : 0;
        
        return {
            games_played: totalGames,
            wins: totalWins,
            losses: totalLosses,
            draws: totalDraws,
            win_rate: winRate,
            runs_scored: totalRunsScored,
            runs_allowed: totalRunsAllowed,
            run_differential: totalRunsScored - totalRunsAllowed
        };
    }

    async calculateOneRunStats(team) {
        const stats = await this.get(`
            SELECT 
                SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN winner != ? AND winner != 'draw' THEN 1 ELSE 0 END) as losses
            FROM games 
            WHERE is_one_run_game = 1 AND (home_team = ? OR away_team = ?)
        `, [team, team, team, team]);
        
        const winRate = (stats.wins && stats.losses) ? 
            stats.wins / (stats.wins + stats.losses) : 0;
        
        return {
            wins: stats.wins || 0,
            losses: stats.losses || 0,
            win_rate: winRate
        };
    }

    async calculateBlowoutStats(team) {
        const stats = await this.get(`
            SELECT 
                SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN winner != ? AND winner != 'draw' THEN 1 ELSE 0 END) as losses
            FROM games 
            WHERE is_blowout = 1 AND (home_team = ? OR away_team = ?)
        `, [team, team, team, team]);
        
        return {
            wins: stats.wins || 0,
            losses: stats.losses || 0
        };
    }

    async calculateShutoutStats(team) {
        const wins = await this.get(`
            SELECT COUNT(*) as count
            FROM games 
            WHERE is_shutout = 1 AND winner = ?
                AND (home_team = ? OR away_team = ?)
        `, [team, team, team]);
        
        const losses = await this.get(`
            SELECT COUNT(*) as count
            FROM games 
            WHERE is_shutout = 1 AND winner != ? AND winner != 'draw'
                AND (home_team = ? OR away_team = ?)
        `, [team, team, team]);
        
        return {
            wins: wins.count || 0,
            losses: losses.count || 0
        };
    }

    async calculateHomeAwayStats(team) {
        const homeStats = await this.get(`
            SELECT 
                SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN winner != ? AND winner != 'draw' THEN 1 ELSE 0 END) as losses
            FROM games WHERE home_team = ?
        `, [team, team, team]);
        
        const awayStats = await this.get(`
            SELECT 
                SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN winner != ? AND winner != 'draw' THEN 1 ELSE 0 END) as losses
            FROM games WHERE away_team = ?
        `, [team, team, team]);
        
        const homeWinRate = homeStats.wins + homeStats.losses > 0 ?
            homeStats.wins / (homeStats.wins + homeStats.losses) : 0;
        const awayWinRate = awayStats.wins + awayStats.losses > 0 ?
            awayStats.wins / (awayStats.wins + awayStats.losses) : 0;
        
        return {
            home_wins: homeStats.wins || 0,
            home_losses: homeStats.losses || 0,
            home_win_rate: homeWinRate,
            away_wins: awayStats.wins || 0,
            away_losses: awayStats.losses || 0,
            away_win_rate: awayWinRate,
            home_advantage_index: homeWinRate - awayWinRate
        };
    }

    async calculateVsLevelStats(team) {
        // 먼저 현재 시점의 팀별 승률 계산
        const allTeams = await this.all(`
            SELECT DISTINCT home_team as team FROM games
            UNION
            SELECT DISTINCT away_team as team FROM games
        `);
        
        const teamWinRates = {};
        for (const t of allTeams) {
            const stats = await this.calculateBasicStats(t.team);
            teamWinRates[t.team] = stats.win_rate;
        }
        
        // 5할 이상/미만 팀 구분
        let vsAboveWins = 0, vsAboveLosses = 0;
        let vsBelowWins = 0, vsBelowLosses = 0;
        
        const games = await this.all(`
            SELECT home_team, away_team, winner
            FROM games
            WHERE home_team = ? OR away_team = ?
        `, [team, team]);
        
        for (const game of games) {
            const opponent = game.home_team === team ? game.away_team : game.home_team;
            const isAbove500 = teamWinRates[opponent] >= 0.5;
            const isWin = game.winner === team;
            const isLoss = game.winner !== team && game.winner !== 'draw';
            
            if (isAbove500) {
                if (isWin) vsAboveWins++;
                if (isLoss) vsAboveLosses++;
            } else {
                if (isWin) vsBelowWins++;
                if (isLoss) vsBelowLosses++;
            }
        }
        
        return {
            vs_above_wins: vsAboveWins,
            vs_above_losses: vsAboveLosses,
            vs_below_wins: vsBelowWins,
            vs_below_losses: vsBelowLosses
        };
    }

    async calculateStreakStats(team) {
        const recentGames = await this.all(`
            SELECT winner
            FROM games
            WHERE home_team = ? OR away_team = ?
            ORDER BY date DESC
        `, [team, team]);
        
        let currentStreak = 0;
        let currentStreakType = null;
        let maxWinStreak = 0;
        let maxLoseStreak = 0;
        let tempWinStreak = 0;
        let tempLoseStreak = 0;
        
        // Calculate current streak (from most recent games) - 무승부 무시
        for (let i = 0; i < recentGames.length; i++) {
            const game = recentGames[i];
            
            if (game.winner === team) {
                // Win
                if (currentStreakType === null || currentStreakType === 'W') {
                    if (currentStreakType === null) currentStreakType = 'W';
                    currentStreak++;
                } else {
                    break; // Streak broken by loss
                }
            } else if (game.winner !== 'draw' && game.winner !== null) {
                // Loss
                if (currentStreakType === null || currentStreakType === 'L') {
                    if (currentStreakType === null) currentStreakType = 'L';
                    currentStreak++;
                } else {
                    break; // Streak broken by win
                }
            } else {
                // Draw - 무시하고 계속 (연속 기록에 영향 없음)
                continue;
            }
        }
        
        // Calculate max streaks (from all games) - 무승부 무시
        recentGames.forEach((game) => {
            if (game.winner === team) {
                tempWinStreak++;
                tempLoseStreak = 0; // 승리로 연패 중단
                maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
            } else if (game.winner !== 'draw' && game.winner !== null) {
                tempLoseStreak++;
                tempWinStreak = 0; // 패배로 연승 중단
                maxLoseStreak = Math.max(maxLoseStreak, tempLoseStreak);
            } else {
                // Draw - 무시 (연속 기록 유지)
                // 무승부는 연승이나 연패를 중단시키지 않음
            }
        });
        
        const current = currentStreakType === 'W' ? `${currentStreak}W` : 
                       currentStreakType === 'L' ? `${currentStreak}L` : '0';
        
        return {
            current,
            maxWin: maxWinStreak,
            maxLose: maxLoseStreak
        };
    }

    async updateMonthlyRecords() {
        await this.run('DELETE FROM monthly_records');
        
        const monthlyData = await this.all(`
            SELECT 
                strftime('%Y', date) as year,
                strftime('%m', date) as month,
                home_team, away_team, winner,
                home_score, away_score
            FROM games
        `);
        
        const teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
        const records = {};
        
        // 데이터 집계
        for (const game of monthlyData) {
            const key = (team, year, month) => `${team}-${year}-${month}`;
            
            // 홈팀 처리
            const homeKey = key(game.home_team, game.year, game.month);
            if (!records[homeKey]) {
                records[homeKey] = {
                    team: game.home_team,
                    year: parseInt(game.year),
                    month: parseInt(game.month),
                    wins: 0, losses: 0, draws: 0,
                    runs_scored: 0, runs_allowed: 0
                };
            }
            records[homeKey].runs_scored += game.home_score;
            records[homeKey].runs_allowed += game.away_score;
            if (game.winner === game.home_team) records[homeKey].wins++;
            else if (game.winner === 'draw') records[homeKey].draws++;
            else records[homeKey].losses++;
            
            // 원정팀 처리
            const awayKey = key(game.away_team, game.year, game.month);
            if (!records[awayKey]) {
                records[awayKey] = {
                    team: game.away_team,
                    year: parseInt(game.year),
                    month: parseInt(game.month),
                    wins: 0, losses: 0, draws: 0,
                    runs_scored: 0, runs_allowed: 0
                };
            }
            records[awayKey].runs_scored += game.away_score;
            records[awayKey].runs_allowed += game.home_score;
            if (game.winner === game.away_team) records[awayKey].wins++;
            else if (game.winner === 'draw') records[awayKey].draws++;
            else records[awayKey].losses++;
        }
        
        // DB에 저장
        for (const record of Object.values(records)) {
            const winRate = record.wins + record.losses > 0 ?
                record.wins / (record.wins + record.losses) : 0;
            
            await this.run(`
                INSERT INTO monthly_records 
                (team_name, year, month, wins, losses, draws, win_rate, runs_scored, runs_allowed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                record.team, record.year, record.month,
                record.wins, record.losses, record.draws,
                winRate, record.runs_scored, record.runs_allowed
            ]);
        }
        
        console.log('✅ 월별 기록 업데이트 완료');
    }

    async updateWeekdayRecords() {
        await this.run('DELETE FROM weekday_records');
        
        const teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        
        for (const team of teams) {
            for (const day of days) {
                const stats = await this.get(`
                    SELECT 
                        COUNT(*) as games,
                        SUM(CASE 
                            WHEN (home_team = ? AND winner = ?) OR 
                                 (away_team = ? AND winner = ?) 
                            THEN 1 ELSE 0 
                        END) as wins,
                        SUM(CASE 
                            WHEN (home_team = ? AND winner != ? AND winner != 'draw') OR 
                                 (away_team = ? AND winner != ? AND winner != 'draw') 
                            THEN 1 ELSE 0 
                        END) as losses,
                        SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as draws
                    FROM games
                    WHERE day_of_week = ? AND (home_team = ? OR away_team = ?)
                `, [team, team, team, team, team, team, team, team, day, team, team]);
                
                if (stats.games > 0) {
                    const winRate = stats.wins + stats.losses > 0 ?
                        stats.wins / (stats.wins + stats.losses) : 0;
                    
                    await this.run(`
                        INSERT INTO weekday_records 
                        (team_name, day_of_week, wins, losses, draws, win_rate)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [team, day, stats.wins, stats.losses, stats.draws, winRate]);
                }
            }
        }
        
        console.log('✅ 요일별 기록 업데이트 완료');
    }

    async updateStadiumRecords() {
        await this.run('DELETE FROM stadium_records');
        
        const teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
        const stadiums = await this.all('SELECT DISTINCT stadium FROM games');
        
        for (const team of teams) {
            for (const stadium of stadiums) {
                const stats = await this.get(`
                    SELECT 
                        COUNT(*) as games,
                        SUM(CASE 
                            WHEN (home_team = ? AND winner = ?) OR 
                                 (away_team = ? AND winner = ?) 
                            THEN 1 ELSE 0 
                        END) as wins,
                        SUM(CASE 
                            WHEN (home_team = ? AND winner != ? AND winner != 'draw') OR 
                                 (away_team = ? AND winner != ? AND winner != 'draw') 
                            THEN 1 ELSE 0 
                        END) as losses,
                        SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as draws
                    FROM games
                    WHERE stadium = ? AND (home_team = ? OR away_team = ?)
                `, [team, team, team, team, team, team, team, team, 
                    stadium.stadium, team, team]);
                
                if (stats.games > 0) {
                    const winRate = stats.wins + stats.losses > 0 ?
                        stats.wins / (stats.wins + stats.losses) : 0;
                    
                    await this.run(`
                        INSERT INTO stadium_records 
                        (team_name, stadium, wins, losses, draws, win_rate)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [team, stadium.stadium, stats.wins, stats.losses, stats.draws, winRate]);
                }
            }
        }
        
        console.log('✅ 경기장별 기록 업데이트 완료');
    }

    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ 데이터베이스 연결 종료');
                    resolve();
                }
            });
        });
    }
}

// 메인 실행 함수
async function main() {
    const db = new EnhancedKBODatabase();
    
    try {
        await db.connect();
        await db.createTables();
        await db.importEnhancedGamesFromJSON();
        
        // 샘플 쿼리: 피타고리안 기대승률과 운 지수
        console.log('\n📊 피타고리안 기대승률 & 운 지수:');
        const pythagoreanStats = await db.all(`
            SELECT 
                team_name,
                printf('%.3f', win_rate) as actual_win_rate,
                printf('%.3f', pythagorean_expectation) as expected_win_rate,
                printf('%+.3f', luck_factor) as luck_factor
            FROM team_stats
            ORDER BY win_rate DESC
        `);
        console.table(pythagoreanStats);
        
        // 1점차 경기 승률
        console.log('\n⚡ 1점차 경기 승률:');
        const oneRunStats = await db.all(`
            SELECT 
                team_name,
                one_run_games_won || '승 ' || one_run_games_lost || '패' as record,
                printf('%.3f', one_run_win_rate) as win_rate
            FROM team_stats
            WHERE one_run_games_won + one_run_games_lost > 0
            ORDER BY one_run_win_rate DESC
        `);
        console.table(oneRunStats);
        
        // 홈 어드밴티지 지수
        console.log('\n🏟️ 홈 어드밴티지 지수:');
        const homeAdvantage = await db.all(`
            SELECT 
                team_name,
                printf('%.3f', home_win_rate) as home_win_rate,
                printf('%.3f', away_win_rate) as away_win_rate,
                printf('%+.3f', home_advantage_index) as advantage_index
            FROM team_stats
            ORDER BY home_advantage_index DESC
        `);
        console.table(homeAdvantage);
        
        await db.close();
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        await db.close();
    }
}

// 실행
if (require.main === module) {
    main();
}

module.exports = { EnhancedKBODatabase };