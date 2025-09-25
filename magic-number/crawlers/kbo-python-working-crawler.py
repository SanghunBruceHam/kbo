#!/usr/bin/env python3
"""
KBO 데이터 크롤링 시스템 - 실제 작동 버전
다음 스포츠 실제 HTML 구조에 맞춘 정확한 파싱
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import json
import time
import re
import subprocess
from datetime import datetime
import os
import sys
from pathlib import Path
import calendar

# PathManager 추가 - config 디렉토리를 Python path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'config'))
from paths import get_path_manager


def run_post_crawl_processing():
    """크롤링 완료 후 자동으로 데이터 처리 및 분석 스크립트 실행"""
    try:
        # 프로젝트 루트 디렉토리 찾기
        project_root = Path(__file__).resolve().parent.parent.parent
        os.chdir(project_root)

        print("📊 1단계: 시즌 데이터 처리...")
        result = subprocess.run(['npm', 'run', 'process'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ 시즌 데이터 처리 완료")
        else:
            print(f"❌ 시즌 데이터 처리 실패: {result.stderr}")
            return

        print("📈 2단계: 매직넘버 계산...")
        result = subprocess.run(['npm', 'run', 'rank-matrix'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ 매직넘버 계산 완료")
        else:
            print(f"❌ 매직넘버 계산 실패: {result.stderr}")

        print("⚡ 3단계: UI 최적화 사전계산...")
        result = subprocess.run(['npm', 'run', 'precompute-matrix'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ UI 사전계산 완료")
        else:
            print(f"❌ UI 사전계산 실패: {result.stderr}")

        print("🔍 4단계: 전체 분석 데이터 생성...")
        result = subprocess.run(['npm', 'run', 'analysis'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ 전체 분석 완료")
        else:
            print(f"❌ 전체 분석 실패: {result.stderr}")

        print("🎉 모든 후처리 작업 완료!")

    except Exception as e:
        print(f"❌ 후처리 작업 중 오류 발생: {e}")
        print("💡 수동으로 다음 명령어들을 실행해주세요:")
        print("   npm run process && npm run rank-matrix && npm run precompute-matrix && npm run analysis")

class KBOWorkingCrawler:
    def __init__(self):
        self.base_url = 'https://sports.daum.net/schedule/kbo'

        # PathManager 사용
        self.paths = get_path_manager()
        self.paths.setup_python_path()  # Python 모듈 import 경로 설정

        print(f"🏟️ KBO 실제 작동 크롤러 초기화 완료 - 데이터 경로: {self.paths.data_dir}")

        # 필요한 디렉토리들 생성
        self.paths.ensure_dir(Path(self.paths.data_dir))

        self.team_mapping = {
            'KIA': 'KIA', 'KT': 'KT', 'LG': 'LG', 'NC': 'NC', 'SSG': 'SSG',
            '두산': '두산', '롯데': '롯데', '삼성': '삼성', '키움': '키움', '한화': '한화',
            'SK': 'SSG', '기아': 'KIA'
        }

        # 기존 경기 데이터 캐시 (중복 방지용)
        self.existing_games_cache = None

        print(f"🏟️ KBO 실제 작동 크롤러 초기화 완료 - 데이터 경로: {self.paths.data_dir}")

    def load_existing_games(self, year=2025):
        """기존 경기 데이터를 로드하여 캐시에 저장 - 상태 정보 포함"""
        if self.existing_games_cache is not None:
            return self.existing_games_cache

        main_clean_file = Path(self.paths.data_dir) / f'{year}-season-data-clean.txt'
        existing_games = {}  # 딕셔너리로 변경하여 상태 정보 저장

        if main_clean_file.exists():
            with open(main_clean_file, 'r', encoding='utf-8') as f:
                content = f.read()
                current_date = None

                for line in content.split('\n'):
                    line = line.strip()
                    if not line:
                        continue

                    # 날짜 라인인지 확인
                    if re.match(r'^\d{4}-\d{2}-\d{2}', line):
                        current_date = line.split()[0]  # 날짜만 추출
                    elif current_date:
                        # 경기 라인에서 중복 체크용 키와 상태 저장
                        parts = line.split()
                        if len(parts) >= 5:
                            time = parts[0]
                            state = parts[1]
                            home_team = parts[3]
                            away_team = parts[4]
                            game_key = f"{current_date}_{time}_{home_team}_{away_team}"
                            existing_games[game_key] = {
                                'state': state,
                                'line': line,
                                'date': current_date
                            }

        self.existing_games_cache = existing_games
        print(f"📚 기존 경기 데이터 캐시 로드: {len(existing_games)}개 경기")
        return existing_games

    def is_duplicate_game(self, game_date, game_time, home_team, away_team, new_state=None):
        """경기 중복 여부 확인 - 오늘 날짜는 특별 처리"""
        from datetime import datetime, timezone, timedelta

        # 한국 시간으로 오늘 날짜 구하기
        kst = timezone(timedelta(hours=9))
        today = datetime.now(kst).strftime('%Y-%m-%d')

        existing_games = self.load_existing_games()
        game_key = f"{game_date}_{game_time}_{home_team}_{away_team}"

        # 오늘 날짜 경기 처리
        if game_date == today:
            if game_key in existing_games:
                existing_state = existing_games[game_key]['state']

                # 오늘 날짜의 경기전/예정 경기는 삭제하고 새로 크롤링한 데이터로 대체
                if existing_state in ["경기전", "예정"]:
                    print(f"  🔄 오늘 경기 업데이트: {game_date} {game_time} {away_team} vs {home_team} ({existing_state} → {new_state})")
                    self.mark_for_update(game_key, existing_games[game_key]['line'])
                    return False  # 중복 아님 - 새 데이터로 대체

                # 오늘 날짜의 완료/취소 경기는 그대로 유지
                if existing_state in ["종료", "완료", "끝", "취소", "우천취소", "연기", "경기취소"]:
                    print(f"  ✅ 오늘 완료/취소 경기 유지: {game_date} {game_time} {away_team} vs {home_team} [{existing_state}]")
                    return True  # 중복으로 처리 - 기존 데이터 유지

            # 오늘 날짜의 새로운 경기는 추가
            return False

        # 오늘이 아닌 날짜는 기존 로직 유지
        if game_key in existing_games:
            existing_state = existing_games[game_key]['state']

            # 상태 업데이트인지 확인
            if new_state and existing_state in ["경기전", "예정"]:
                if new_state in ["종료", "완료", "끝", "취소", "우천취소", "연기", "경기취소"]:
                    print(f"  🔄 경기 상태 업데이트 허용: {game_date} {game_time} {away_team} vs {home_team} ({existing_state} → {new_state})")
                    # 기존 라인을 업데이트 표시하여 나중에 제거
                    self.mark_for_update(game_key, existing_games[game_key]['line'])
                    return False  # 중복이 아님 - 업데이트 허용

            # 동일한 상태이거나 이미 완료된 경기면 중복으로 처리
            return True

        return False  # 새로운 경기

    def mark_for_update(self, game_key, old_line):
        """업데이트할 경기 표시"""
        if not hasattr(self, 'lines_to_remove'):
            self.lines_to_remove = set()
        self.lines_to_remove.add(old_line)

    def setup_driver(self, headless=False):
        """Chrome WebDriver 설정"""
        print("🚀 Chrome WebDriver 설정 중...")
        
        options = Options()
        if headless:
            options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1920,1080')
        
        try:
            driver = webdriver.Chrome(options=options)
            print("✅ WebDriver 설정 완료")
            return driver
        except Exception as e:
            print(f"❌ WebDriver 설정 실패: {e}")
            return None

    def crawl_daum_kbo(self, year=2025, month=8):
        """다음 스포츠에서 KBO 데이터 크롤링"""
        print(f"\n📡 {year}년 {month}월 KBO 데이터 크롤링 시작...")
        
        # GitHub Actions 환경 감지
        import os
        is_github_actions = os.getenv('GITHUB_ACTIONS') == 'true'
        
        driver = self.setup_driver(headless=is_github_actions)
        if not driver:
            return []
        
        try:
            # URL 접속
            target_month = f"{year}{month:02d}"
            url = f"{self.base_url}?date={target_month}"
            print(f"🔗 접속: {url}")
            
            driver.get(url)
            time.sleep(5)
            
            # 테이블이 로드될 때까지 대기
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "scheduleList"))
                )
                print("✅ 스케줄 테이블 로드 완료")
            except:
                print("⚠️ 스케줄 테이블 로드 타임아웃")
            
            time.sleep(2)
            
            # 전체 페이지 스크린샷을 위한 설정
            # 브라우저 창 크기 조정 및 스크롤
            original_size = driver.get_window_size()
            
            # 페이지 끝까지 스크롤하여 모든 내용 로드
            last_height = driver.execute_script("return document.body.scrollHeight")
            while True:
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                new_height = driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height
            
            # 페이지 상단으로 돌아가기
            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            
            # 전체 페이지 높이에 맞춰 창 크기 조정
            total_height = driver.execute_script("""
                return Math.max(
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.clientHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                );
            """)
            
            # 브라우저 창 크기를 전체 페이지에 맞게 조정
            driver.set_window_size(1920, total_height)
            time.sleep(2)
            
            screenshot_path = Path(self.paths.crawlers_dir) / 'kbo-working-screenshot.png'
            driver.save_screenshot(str(screenshot_path))
            print(f"📸 전체 페이지 스크린샷 저장: kbo-working-screenshot.png (높이: {total_height}px)")
            
            # 원래 창 크기로 복원
            driver.set_window_size(original_size['width'], original_size['height'])
            
            # HTML 파싱
            html = driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            
            # 데이터 추출
            games = self.extract_games_from_table(soup)
            
            print(f"\n✅ 총 {len(games)}개 경기 데이터 추출 완료")
            
            return games
            
        except Exception as e:
            print(f"❌ 크롤링 오류: {e}")
            import traceback
            traceback.print_exc()
            return []
        finally:
            time.sleep(3)  # 확인용
            driver.quit()
            print("🔚 브라우저 종료")

    def extract_games_from_table(self, soup):
        """스케줄 테이블에서 경기 데이터 추출"""
        print("\n🎯 스케줄 테이블에서 데이터 추출 중...")
        
        games = []
        
        # scheduleList tbody 찾기
        schedule_tbody = soup.find('tbody', id='scheduleList')
        if not schedule_tbody:
            print("❌ scheduleList를 찾을 수 없음")
            return []
        
        # 모든 tr 행 찾기
        rows = schedule_tbody.find_all('tr')
        print(f"📊 {len(rows)}개 행 발견")
        
        current_date = None
        
        for row_idx, row in enumerate(rows):
            try:
                # 날짜 셀 확인 (rowspan이 있는 td_date)
                date_cell = row.find('td', class_='td_date')
                if date_cell:
                    date_span = date_cell.find('span', class_='num_date')
                    if date_span:
                        date_text = date_span.get_text(strip=True)
                        # "08.01" 형식을 "2025-08-01"로 변환
                        date_match = re.match(r'(\d{2})\.(\d{2})', date_text)
                        if date_match:
                            month = date_match.group(1)
                            day = date_match.group(2)
                            current_date = f"2025-{month}-{day}"
                            print(f"\n📅 날짜: {current_date}")
                
                # 경기 정보 추출
                team_cell = row.find('td', class_='td_team')
                if team_cell and current_date:
                    # 홈팀 정보
                    home_team_div = team_cell.find('div', class_='team_home')
                    away_team_div = team_cell.find('div', class_='team_away')
                    
                    if home_team_div and away_team_div:
                        # 팀명 추출
                        home_team_name = home_team_div.find('span', class_='txt_team')
                        away_team_name = away_team_div.find('span', class_='txt_team')
                        
                        # 점수 추출
                        home_score_elem = home_team_div.find('span', class_='num_score')
                        if not home_score_elem:
                            home_score_elem = home_team_div.find('em', class_='num_score')
                        
                        away_score_elem = away_team_div.find('span', class_='num_score')
                        if not away_score_elem:
                            away_score_elem = away_team_div.find('em', class_='num_score')
                        
                        if home_team_name and away_team_name:
                            home_team = home_team_name.get_text(strip=True)
                            away_team = away_team_name.get_text(strip=True)

                            # 경기 상태 확인 (먼저 확인)
                            state_elem = team_cell.find('span', class_='state_game')
                            state = state_elem.get_text(strip=True) if state_elem else "종료"

                            # 점수 정보 추출 (취소 경기는 점수가 없을 수 있음)
                            home_score = 0
                            away_score = 0

                            if home_score_elem and away_score_elem:
                                # 점수 텍스트에서 숫자만 추출
                                home_score_text = home_score_elem.get_text(strip=True)
                                away_score_text = away_score_elem.get_text(strip=True)

                                # 숫자만 추출
                                home_score_match = re.search(r'\d+', home_score_text)
                                away_score_match = re.search(r'\d+', away_score_text)

                                if home_score_match and away_score_match:
                                    home_score = int(home_score_match.group())
                                    away_score = int(away_score_match.group())

                            # 완료된 경기와 취소 경기 모두 저장
                            completed_states = ["종료", "완료", "끝", "취소", "우천취소", "연기", "경기취소"]
                            cancelled_states = ["취소", "우천취소", "연기", "경기취소"]
                            in_progress_states = ["경기중", "1회말", "2회말", "3회말", "4회말", "5회말", "6회말", "7회말", "8회말", "9회말",
                                                 "1회초", "2회초", "3회초", "4회초", "5회초", "6회초", "7회초", "8회초", "9회초",
                                                 "연장", "10회", "11회", "12회", "진행중"]

                            is_valid_game = (
                                state in completed_states or
                                (state == "종료" and home_score >= 0 and away_score >= 0 and
                                 home_score <= 30 and away_score <= 30) or  # 완료 경기 점수 검증
                                state in cancelled_states  # 취소 경기는 점수 무관
                            )

                            if is_valid_game:
                                    # 추가 정보 추출

                                    # td_time - 경기 시간
                                    time_cell = row.find('td', class_='td_time')
                                    game_time = time_cell.get_text(strip=True) if time_cell else ""

                                    # td_area - 구장 정보 (앞 2글자만)
                                    area_cell = row.find('td', class_='td_area')
                                    stadium_full = area_cell.get_text(strip=True) if area_cell else ""
                                    stadium = stadium_full[:2] if stadium_full else ""

                                    # td_sort - 정렬 정보
                                    sort_cell = row.find('td', class_='td_sort')
                                    sort_info = sort_cell.get_text(strip=True) if sort_cell else ""

                                    # td_tv - 중계 정보
                                    tv_cell = row.find('td', class_='td_tv')
                                    tv_info = tv_cell.get_text(strip=True) if tv_cell else ""

                                    # info_team 정보 추출
                                    home_info_elem = home_team_div.find('span', class_='info_team')
                                    away_info_elem = away_team_div.find('span', class_='info_team')
                                    home_info = home_info_elem.get_text(strip=True) if home_info_elem else ""
                                    away_info = away_info_elem.get_text(strip=True) if away_info_elem else ""

                                    # td_team 팀정보 (앞 2글자만)
                                    home_team_short = self.normalize_team_name(home_team)[:2]
                                    away_team_short = self.normalize_team_name(away_team)[:2]

                                    # 정규화된 팀명으로 중복 체크
                                    normalized_home = self.normalize_team_name(away_team)  # team_away div = 홈팀
                                    normalized_away = self.normalize_team_name(home_team)  # team_home div = 원정팀

                                    # 중복 체크 - 크롤링 단계에서 즉시 확인 (상태 정보 포함)
                                    if self.is_duplicate_game(current_date, game_time, normalized_home, normalized_away, state):
                                        print(f"  ♻️ 중복 경기 제외: {current_date} {game_time} {normalized_away} vs {normalized_home}")
                                        continue

                                    # KBO 웹사이트에서 team_home div가 실제로는 원정팀, team_away div가 홈팀을 의미함
                                    game = {
                                        'date': current_date,
                                        'away_team': normalized_away,  # team_home div = 원정팀
                                        'home_team': normalized_home,  # team_away div = 홈팀
                                        'away_score': home_score,  # team_home 점수 = 원정팀 점수
                                        'home_score': away_score,  # team_away 점수 = 홈팀 점수
                                        'state': state,
                                        'time': game_time,
                                        'stadium': stadium,
                                        'sort': sort_info,
                                        'tv': tv_info,
                                        'away_info': home_info,  # team_home div = 원정팀 정보
                                        'home_info': away_info,  # team_away div = 홈팀 정보
                                        'away_team_short': home_team_short,  # 원정팀 앞 2글자
                                        'home_team_short': away_team_short   # 홈팀 앞 2글자
                                    }

                                    games.append(game)
                                    if state in cancelled_states:
                                        print(f"  ❌ {normalized_away} vs {normalized_home} [{state}]")
                                    else:
                                        print(f"  ✅ {normalized_away} {home_score}:{away_score} {normalized_home} [완료]")
                            else:
                                # 경기전 상태인 경기들만 저장 (진행중인 경기는 제외)
                                if state not in completed_states and state not in cancelled_states and state not in in_progress_states:
                                    # 경기전 경기 정보 생성
                                    # 추가 정보 추출
                                    time_cell = row.find('td', class_='td_time')
                                    game_time = time_cell.get_text(strip=True) if time_cell else ""

                                    area_cell = row.find('td', class_='td_area')
                                    stadium_full = area_cell.get_text(strip=True) if area_cell else ""
                                    stadium = stadium_full[:2] if stadium_full else ""

                                    sort_cell = row.find('td', class_='td_sort')
                                    sort_info = sort_cell.get_text(strip=True) if sort_cell else ""

                                    tv_cell = row.find('td', class_='td_tv')
                                    tv_info = tv_cell.get_text(strip=True) if tv_cell else ""

                                    # 정규화된 팀명으로 중복 체크
                                    normalized_home = self.normalize_team_name(away_team)  # team_away div = 홈팀
                                    normalized_away = self.normalize_team_name(home_team)  # team_home div = 원정팀

                                    # 중복 체크 - 경기전 경기도 확인 (상태 정보 포함)
                                    if self.is_duplicate_game(current_date, game_time, normalized_home, normalized_away, state):
                                        print(f"  ♻️ 중복 경기전 경기 제외: {current_date} {game_time} {normalized_away} vs {normalized_home}")
                                        continue

                                    # 경기전 경기도 동일한 구조로 생성 (점수는 0:0)
                                    schedule_game = {
                                        'date': current_date,
                                        'away_team': normalized_away,
                                        'home_team': normalized_home,
                                        'away_score': 0,
                                        'home_score': 0,
                                        'state': state,
                                        'time': game_time,
                                        'stadium': stadium,
                                        'sort': sort_info,
                                        'tv': tv_info,
                                        'away_info': '',
                                        'home_info': '',
                                        'away_team_short': normalized_away[:2],
                                        'home_team_short': normalized_home[:2]
                                    }

                                    # 동일한 games 리스트에 추가
                                    games.append(schedule_game)

                                    print(f"  📅 {normalized_away} vs {normalized_home} [{state}] - 예정 경기 저장")
                                elif state in in_progress_states:
                                    print(f"  ⚾ {self.normalize_team_name(away_team)} vs {self.normalize_team_name(home_team)} [{state}] - 경기중, 완료 후 재크롤링 필요")
                                else:
                                    print(f"  ⏳ {self.normalize_team_name(away_team)} vs {self.normalize_team_name(home_team)} [{state}] - 제외")
                
            except Exception as e:
                print(f"  ⚠️ 행 {row_idx} 파싱 오류: {e}")
                continue
        
        return games

    def normalize_team_name(self, team_name):
        """팀명 정규화"""
        return self.team_mapping.get(team_name.strip(), team_name.strip())

    def get_weekday(self, date_str):
        """날짜 문자열에서 요일 구하기 (YYYY-MM-DD -> 요일)"""
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            weekdays = ['월', '화', '수', '목', '금', '토', '일']
            return weekdays[date_obj.weekday()]
        except:
            return ""

    def save_results(self, games, year, month):
        """결과 저장 - 간소화된 중복 방지 로직"""
        if not games:
            print("\n❌ 저장할 데이터가 없습니다.")
            return

        # 저장 시작 알림
        print(f"💾 {month}월 데이터 저장 시작...")

        # PathManager와 일치하는 안전한 경로 사용
        main_clean_file = Path(self.paths.data_dir) / f'{year}-season-data-clean.txt'

        # 크롤링 단계에서 이미 중복 제거했으므로 기존 로직 간소화
        print(f"📊 크롤링에서 중복 제거된 경기: {len(games)}개")

        if games:
            try:
                # 기존 데이터 로드
                all_data = {}

                if main_clean_file.exists():
                    with open(main_clean_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        current_date = None

                        for line in content.split('\n'):
                            line = line.strip()
                            if not line:
                                continue

                            # 날짜 라인인지 확인
                            if re.match(r'^\d{4}-\d{2}-\d{2}(\s*\([월화수목금토일]\))?$', line):
                                # 요일 정보 제거하고 날짜만 추출
                                date_only = re.match(r'^(\d{4}-\d{2}-\d{2})', line).group(1)
                                current_date = date_only
                                if current_date not in all_data:
                                    all_data[current_date] = set()  # set으로 변경하여 중복 방지
                            elif current_date:
                                # 기존 경기 라인 저장 (단, 업데이트될 라인은 제외)
                                if not hasattr(self, 'lines_to_remove') or line not in self.lines_to_remove:
                                    all_data[current_date].add(line)
                                else:
                                    print(f"  🗑️ 기존 라인 제거: {line[:50]}...")

                # 새로운 경기 추가 (크롤링 단계에서 이미 중복 제거됨)
                for game in games:
                    date = game['date']
                    if date not in all_data:
                        all_data[date] = set()

                    # 새로운 확장 형식: 열 정렬된 가독성 좋은 형식
                    if game['state'] in ["취소", "우천취소", "연기", "경기취소"]:
                        score_part = "취소"
                    elif game['state'] in ["종료", "완료", "끝"]:
                        score_part = f"{game['away_score']}:{game['home_score']}"
                    else:
                        # 경기전 상태인 경우
                        score_part = "경기전"

                    # sort 필드에 페넌트레이스가 없으면 추가
                    sort_info = game['sort']
                    if not sort_info or sort_info == "":
                        sort_info = "페넌트레이스"
                    elif "페넌트레이스" not in sort_info and "올스타" not in sort_info:
                        sort_info = "페넌트레이스"

                    line = f"{game['time']:<8} {game['state']:<6} {game['stadium']:<6} {game['home_team']:<4} {game['away_team']:<4} {score_part:<8} {game['tv']:<8} {sort_info}"

                    # set에 추가하므로 자동으로 중복 제거됨
                    all_data[date].add(line)

                # 전체 파일 다시 쓰기
                with open(main_clean_file, 'w', encoding='utf-8') as f:
                    first = True
                    for date in sorted(all_data.keys()):
                        if not first:
                            f.write("\n\n")
                        first = False

                        weekday = self.get_weekday(date)
                        f.write(f"{date} ({weekday})\n")

                        # 시간순으로 경기 정렬
                        sorted_games = sorted(list(all_data[date]), key=lambda x: x.split()[0] if x.split() else "")
                        for line in sorted_games:
                            f.write(f"{line}\n")

                # 캐시 무효화 - 다음 크롤링에서 새로운 데이터 사용
                self.existing_games_cache = None

                # 업데이트 표시 제거
                if hasattr(self, 'lines_to_remove'):
                    delattr(self, 'lines_to_remove')

                print(f"💾 {len(games)}개 경기를 {main_clean_file}에 저장")
                print(f"✅ {month}월 데이터 안전하게 저장 완료!")

            except Exception as e:
                print(f"❌ 파일 저장 중 오류 발생: {e}")
                print(f"💡 수동으로 백업 필요: {len(games)}개 경기 데이터")
        else:
            print("ℹ️ 저장할 새로운 경기가 없습니다")

        # 요약 출력
        if games:
            print("\n📊 크롤링 결과 요약:")
            print(f"- 총 경기 수: {len(games)}개")
            print(f"- 기간: {min(g['date'] for g in games)} ~ {max(g['date'] for g in games)}")

            # 날짜별 경기 수
            date_counts = {}
            for game in games:
                date = game['date']
                date_counts[date] = date_counts.get(date, 0) + 1

            print("\n📅 날짜별 경기 수:")
            for date in sorted(date_counts.keys())[:10]:  # 처음 10일만
                print(f"  {date}: {date_counts[date]}개")

            if len(date_counts) > 10:
                print(f"  ... 외 {len(date_counts) - 10}일")

def main():
    """메인 실행"""
    # 수동 실행 체크 - GITHUB_ACTIONS나 MANUAL_RUN 환경변수가 있을 때만 실행
    if not (os.getenv('GITHUB_ACTIONS') or os.getenv('MANUAL_RUN')):
        print("🔒 자동 실행 방지됨")
        print("💡 크롤러를 실행하려면:")
        print("   MANUAL_RUN=true python3 kbo-python-working-crawler.py")
        print("   또는 GitHub Actions에서 자동 실행됩니다.")
        return
    
    print("=" * 60)
    print("🏟️ KBO 실제 작동 크롤링 시스템")
    print("📡 다음 스포츠 월별 스케줄 크롤링")
    print("=" * 60)
    
    crawler = KBOWorkingCrawler()
    
    # 3월부터 10월까지 크롤링
    from datetime import datetime, timezone, timedelta
    kst = timezone(timedelta(hours=9))
    current_month = datetime.now(kst).month

    all_games = []

    # 현재 월부터 시즌 끝(10월)까지만 크롤링
    # KBO 정규시즌: 3월~10월
    season_months = [3, 4, 5, 6, 7, 8, 9, 10]
    months_to_crawl = [month for month in season_months if month >= current_month]

    print(f"📅 현재 {current_month}월 - 크롤링 대상: {months_to_crawl}월")

    # 크롤링 성공/실패 추적
    successful_months = []
    failed_months = []

    for month in months_to_crawl:
        try:
            print(f"\n🗓️ {month}월 크롤링 시작...")
            games = crawler.crawl_daum_kbo(2025, month)

            if games:
                # 즉시 저장 - 다음 월 크롤링이 실패해도 이미 크롤링한 데이터는 보존됨
                crawler.save_results(games, 2025, month)
                all_games.extend(games)
                successful_months.append(month)
                print(f"✅ {month}월 크롤링 완료 및 저장! ({len(games)}개 경기)")
            else:
                print(f"⚠️ {month}월 크롤링 결과 없음")

        except Exception as e:
            failed_months.append(month)
            print(f"❌ {month}월 크롤링 중 오류 발생: {e}")
            print(f"💾 이전까지 크롤링한 데이터는 저장되었습니다.")
            continue  # 다음 월 크롤링 계속 진행

    # 최종 요약
    print("\n" + "=" * 60)
    print("📊 크롤링 요약:")
    if successful_months:
        print(f"✅ 성공한 월: {', '.join(map(str, successful_months))}")
        print(f"📊 총 {len(all_games)}개 경기 수집 및 저장 완료")
    if failed_months:
        print(f"❌ 실패한 월: {', '.join(map(str, failed_months))}")

    if not all_games:
        print("\n❌ 전체 크롤링 실패 - 데이터 없음")
    else:
        print(f"\n🎯 크롤링 종료! 총 {len(all_games)}개 경기 처리")

        # 크롤링 성공 시 데이터 처리 및 분석 스크립트 자동 실행
        print("\n🚀 크롤링 완료 - 자동 데이터 처리 시작...")
        run_post_crawl_processing()

    print("=" * 60)

if __name__ == "__main__":
    main()