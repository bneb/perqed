import re
with open('/tmp/arxiv_paper.html', 'r') as f:
    text = f.read()

matches = re.finditer(r'<li class="ltx_bibitem" id="bib\.bib20">.*?</li>', text, re.DOTALL)
for m in matches:
    print(m.group(0))
