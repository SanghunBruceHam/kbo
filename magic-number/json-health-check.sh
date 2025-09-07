#!/bin/bash
# JSON 파일 업데이트 상태 확인 스크립트

echo "🔍 JSON 파일 업데이트 상태 확인"
echo "=================================="

# 현재 날짜 또는 특정 날짜 설정
TARGET_DATE=${1:-$(date +"%Y-%m-%d")}
MAGIC_DIR="magic-number/data"

echo "📅 확인 기준 날짜: $TARGET_DATE"
echo ""

# 파일별 카테고리 정의
get_file_category() {
    case "$1" in
        "api-data.json"|"stats-comprehensive.json") echo "🔴 핵심 서비스" ;;
        "raw-game-records.json"|"2025-season-games.json"|"2025-team-stats.json") echo "🟡 중간 데이터" ;;
        "calc-standings.json"|"calc-magic-numbers.json"|"calc-head-to-head.json") echo "🟢 매직넘버용" ;;
        "analysis-"*".json") echo "📊 분석 데이터" ;;
        *) echo "❓ 기타" ;;
    esac
}

MISSING_FILES=()
UPDATED_FILES=()

echo "📋 파일별 업데이트 상태:"
echo "------------------------"

for file in $MAGIC_DIR/*.json; do
    if [[ -f "$file" ]]; then
        filename=$(basename "$file")
        file_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$file" 2>/dev/null || date -r "$file" +"%Y-%m-%d" 2>/dev/null || echo "unknown")
        
        category=$(get_file_category "$filename")
        
        if [[ "$file_date" == "$TARGET_DATE" ]]; then
            echo "✅ $category - $filename ($file_date)"
            UPDATED_FILES+=("$filename")
        else
            echo "⚠️  $category - $filename ($file_date) ❌"
            MISSING_FILES+=("$filename")
        fi
    fi
done

echo ""
echo "📊 업데이트 요약:"
echo "================"
echo "✅ 업데이트됨: ${#UPDATED_FILES[@]}개"
echo "⚠️  누락: ${#MISSING_FILES[@]}개"

if [[ ${#MISSING_FILES[@]} -eq 0 ]]; then
    echo ""
    echo "🎉 모든 JSON 파일이 최신 상태입니다!"
    exit 0
else  
    echo ""
    echo "🚨 다음 파일들이 업데이트되지 않았습니다:"
    printf '   - %s\n' "${MISSING_FILES[@]}"
    echo ""
    echo "🔧 권장 해결 방법:"
    echo "   1. npm run full-update"
    echo "   2. 개별 스크립트 실행 확인"
    echo "   3. GitHub Actions 로그 점검"
    exit 1
fi