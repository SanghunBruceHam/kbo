#!/usr/bin/env python3
"""
누락된 경기 확인을 위한 3-4월 크롤링
"""
import sys
from pathlib import Path

# 크롤러 모듈 import  
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'crawlers'))

# 직접 크롤러 실행하는 방식으로 변경
import os
import subprocess

def check_march_april_games():
    """3-4월 경기 확인"""
    crawler = KBOWorkingCrawler()
    
    print("🔍 3-4월 누락 경기 확인 중...")
    
    # 3월 크롤링
    print("\n📅 2025년 3월 크롤링...")
    march_games = crawler.crawl_daum_kbo(2025, 3)
    print(f"3월 총 경기: {len(march_games)}개")
    
    # 4월 크롤링  
    print("\n📅 2025년 4월 크롤링...")
    april_games = crawler.crawl_daum_kbo(2025, 4)
    print(f"4월 총 경기: {len(april_games)}개")
    
    # 정규시즌만 필터링
    march_regular = [g for g in march_games if g.get('division') == '정규']
    april_regular = [g for g in april_games if g.get('division') == '정규']
    
    print(f"\n📊 정규시즌 경기:")
    print(f"  3월: {len(march_regular)}개")
    print(f"  4월: {len(april_regular)}개")
    
    # 날짜별 정규시즌 경기 수
    march_dates = {}
    for game in march_regular:
        date = game['date']
        march_dates[date] = march_dates.get(date, 0) + 1
    
    april_dates = {}
    for game in april_regular:
        date = game['date']
        april_dates[date] = april_dates.get(date, 0) + 1
    
    print(f"\n📅 3월 정규시즌 날짜별:")
    for date in sorted(march_dates.keys()):
        print(f"  {date}: {march_dates[date]}개")
    
    print(f"\n📅 4월 정규시즌 날짜별:")
    for date in sorted(april_dates.keys())[:10]:  # 처음 10일만
        print(f"  {date}: {april_dates[date]}개")

if __name__ == "__main__":
    check_march_april_games()