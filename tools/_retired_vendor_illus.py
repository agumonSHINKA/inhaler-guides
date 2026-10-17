"""Copy teammate illustrations (/workspace/inhaler/illustrations/<set>/*.svg) into site/img/s/<set>/.
- strips the baked step-number badge (the site numbers steps in HTML, so numbers always match)
- strips <title>/<desc>/<metadata> (accessible text comes from the step text via <img alt>)
- patches product-specific numbers that conflict with Taiwan inserts / QA checklist
"""
import os, re, sys, json
SRC = '/workspace/inhaler/illustrations'
DST = os.path.join(os.path.dirname(__file__), '..', 'img', 's')
PATCH = {
  'pmdi/08-wait-repeat.svg': [('30–60 秒', '約 30 秒')],
  'pmdi-spacer/08-repeat-rinse.svg': [('30–60 秒', '約 30 秒')],
  'turbuhaler/06-hold-breath.svg': [('>5–10 秒<', '><')],
  'capsule-dpi/08-hold-breath.svg': [('5–10 秒', '最多 5 秒')],
  'insulin-pen/09-hold-count.svg': [('5–10 秒', '依說明秒數')],
  'autoinjector/01-room-temp.svg': [('15–30 分', '回室溫')],
  'autoinjector/07-hold-until-done.svg': [('約 10 秒', '依說明')],
  'glp1-pen/07-hold-6s.svg': [('>6 秒<', '>依說明<')],
}
badge = re.compile(r'<circle cx="46" cy="46" r="34"[^>]*/><text x="46" y="61"[^>]*>\d+</text>')
n = 0; log = {}
for st in sorted(os.listdir(SRC)):
    p = os.path.join(SRC, st)
    if st.startswith('_') or not os.path.isdir(p): continue
    os.makedirs(os.path.join(DST, st), exist_ok=True)
    for f in sorted(os.listdir(p)):
        if not f.endswith('.svg'): continue
        s = open(os.path.join(p, f), encoding='utf-8').read()
        s, k = badge.subn('', s)
        s = re.sub(r'<title[^>]*>.*?</title>|<desc[^>]*>.*?</desc>|<metadata>.*?</metadata>|<!--.*?-->', '', s, flags=re.S)
        s = s.replace(' role="img" aria-labelledby="title desc"', ' aria-hidden="true"')
        s = s.replace(' width="400" height="400"', '')
        for a, b in PATCH.get(f'{st}/{f}', []):
            assert a in s, (st, f, a); s = s.replace(a, b)
        s = re.sub(r'\n+', '\n', s)
        open(os.path.join(DST, st, f), 'w', encoding='utf-8').write(s); n += 1
        log[f'{st}/{f}'] = {'badge_removed': k, 'patched': [a for a, _ in PATCH.get(f'{st}/{f}', [])]}
json.dump(log, open(os.path.join(DST, 'vendor-log.json'), 'w'), ensure_ascii=False, indent=1)
print(n, 'files')
