#!/usr/bin/env python3

import re

# Read the file
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all occurrences of 918101 and replace every other one with 867629
pattern = r'("id":)918101'
matches = list(re.finditer(pattern, content))

# Replace every other occurrence (odd positions: 1st, 3rd, 5th, etc.)
offset = 0
for i, match in enumerate(matches):
    if i % 2 == 0:  # odd positions (0-indexed, so 0, 2, 4... = 1st, 3rd, 5th...)
        start = match.start() + offset
        end = match.end() + offset
        # Replace 918101 with 867629
        content = content[:start] + match.group(1) + '867629' + content[end:]
        offset += len('867629') - len('918101')

# Write back to file
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Coupang 광고 ID 반반 섞기 완료!")
print("867629와 918101이 교대로 배치됨")