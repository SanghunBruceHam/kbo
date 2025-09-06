#!/bin/bash

# Create alternating pattern of Coupang ad IDs in root index.html
# Change every other occurrence (odd positions) from 918101 back to 867629

input_file="index.html"
temp_file="index_temp.html"

# Use sed to process the file
sed '
# For odd occurrences (1st, 3rd, 5th, etc), change 918101 to 867629
/918101/{
    # Use a counter to track occurrences
    x
    s/$/x/
    /^x\{1\}$/{s/.*/x/; x; s/918101/867629/; b}
    /^x\{3\}$/{s/.*/x/; x; s/918101/867629/; b}  
    /^x\{5\}$/{s/.*/x/; x; s/918101/867629/; b}
    /^x\{7\}$/{s/.*/x/; x; s/918101/867629/; b}
    /^x\{9\}$/{s/.*/x/; x; s/918101/867629/; b}
    /^x\{11\}$/{s/.*/x/; x; s/918101/867629/; b}
    /^x\{13\}$/{s/.*/x/; x; s/918101/867629/; b}
    /^x\{15\}$/{s/.*/x/; x; s/918101/867629/; b}
    /^x\{17\}$/{s/.*/x/; x; s/918101/867629/; b}
    /^x\{19\}$/{s/.*/x/; x; s/918101/867629/; b}
    x
}
' "$input_file" > "$temp_file"

mv "$temp_file" "$input_file"
echo "✅ Coupang 광고 ID 반반 섞기 완료!"