import os
import glob
import re

for file in glob.glob("tests/*.test.ts"):
    with open(file, "r") as f:
        content = f.read()
    
    new_content = re.sub(r'theoremSignature:\s*"\((.*?)\)\s*:\s*(.*?)"', r'theoremSignature: "theorem thm (\1) : \2"', content)
    
    if new_content != content:
        with open(file, "w") as f:
            f.write(new_content)
        print(f"Fixed {file}")
