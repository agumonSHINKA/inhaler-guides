#!/usr/bin/env python3
"""Build the searchable TFDA index (data/index/*.json) from the TFDA open-data license dataset (InfoId=36).
Usage: python3 tools/classify.py /path/to/36_3.json
Rules are documented in REVIEW_NOTES.md and on the governance page (about/)."""
import json, re, sys, collections, os, datetime
src = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'index')
raw = json.load(open(src))
rows = [{k: v for x in r for k, v in x.items()} for r in raw]

EXCL_KIND = {'原料藥', '硬空膠囊', '體外試劑'}
EXCL_CAT = {'製劑原料', '原料藥', '由醫師或檢驗師使用', '限由醫師使用', '限由牙醫師使用',
            '空膠囊', '自用製劑原料', '調劑專用', '調劑專用製劑'}

def norm(s): return (s or '').replace('\u3000', '').strip()

# ---------- inhaler device detection by brand/device keyword ----------
INH = [
 ('respimat', r'RESPIMAT|舒沛噴'),
 ('turbuhaler', r'TURBUHALER|都保'),
 ('nexthaler', r'NEXTHALER|耐舒樂'),
 ('ellipta', r'ELLIPTA|易利達'),
 ('accuhaler', r'ACCUHALER|DISKUS|準納'),
 ('breezhaler', r'BREEZHALER|微風'),
 ('handihaler', r'HANDIHALER|HANDI'),
 ('genuair', r'GENUAIR'),
 ('easyhaler', r'EASYHALER|易吸'),
 ('pmdi', r'MDI|EVOHALER|優氟|RAPIHALER|AEROSPHERE|INHALER|AEROSOL|定量|噴霧|氣化'),
]
# ---------- self-injected products (subcutaneous, home use) ----------
INJ = [
 ('insulin-pen', r'INSULIN|胰島素|GLARGINE|DEGLUDEC|DETEMIR|\bASPART\b|LISPRO|GLULISINE|ICODEC'),
 ('injection-pen', r'SEMAGLUTIDE|LIRAGLUTIDE|DULAGLUTIDE|TIRZEPATIDE|EXENATIDE|LIXISENATIDE|TERIPARATIDE|ABALOPARATIDE'),
 ('epinephrine-autoinjector', r'EPINEPHRINE.*(AUTO|PEN)|EPIPEN|ADRENALINE.*(AUTO|PEN)|ANAPEN|JEXT'),
 ('prefilled-syringe', r'ENOXAPARIN|DALTEPARIN|TINZAPARIN|NADROPARIN|FONDAPARINUX|FILGRASTIM|PEGFILGRASTIM|EPOETIN|DARBEPOETIN|INTERFERON|PEGINTERFERON|GLATIRAMER|FOLLITROPIN|SOMATROPIN|SOMAPACITAN|METHOTREXATE.*(PEN|SYRINGE|預充)'),
 ('autoinjector', r'ADALIMUMAB|ETANERCEPT|GOLIMUMAB|CERTOLIZUMAB|SECUKINUMAB|IXEKIZUMAB|DUPILUMAB|USTEKINUMAB|GUSELKUMAB|RISANKIZUMAB|TILDRAKIZUMAB|BRODALUMAB|EVOLOCUMAB|ALIROCUMAB|INCLISIRAN|OMALIZUMAB|MEPOLIZUMAB|BENRALIZUMAB|TEZEPELUMAB|TOCILIZUMAB|SARILUMAB|ABATACEPT|EMICIZUMAB|ERENUMAB|GALCANEZUMAB|FREMANEZUMAB|SUMATRIPTAN|ANAKINRA|BIMEKIZUMAB|TRALOKINUMAB|LEBRIKIZUMAB|OFATUMUMAB|DENOSUMAB.*60|BUROSUMAB|ROMOSOZUMAB'),
]

def form_page(r):
    f = norm(r['劑型']); txt = ' '.join([norm(r['英文品名']).upper(), norm(r['中文品名']), norm(r['主成分略述']).upper()])
    use = norm(r.get('用法用量') or '')
    name = norm(r['英文品名']).upper() + norm(r['中文品名'])
    ing = norm(r['主成分略述']).upper() + ' ' + name
    pack = norm(r.get('包裝') or '')
    if re.search(r'診斷|DIAGNOS', name): return None
    # inhaled
    if f in ('氣化噴霧劑','口腔吸入劑') and not re.search(r'吸入|INHAL|MDI|HFA|AEROSPHERE|RAPIHALER|NEBUL|EVOHALER|UDV|定量', name):
        return 'topical'
    if re.search(r'靜脈|INFUSION|CONCENTRATE|輸注', name) and ('注射' in f or '輸注' in f): return None
    if re.search(r'PRESSURI[SZ]ED INHALATION', name): return 'pmdi'
    if re.search(r'NEBUL|吸入液|INHALATION SOLUTION|UDV|噴霧用溶液|RESPULE|SOLUTION FOR NEBUL', name) and not re.search(r'RESPIMAT|舒沛噴', name):
        return 'nebulizer'
    if re.search(r'NICORETTE INHALER|ROTADISK|旋達碟', name): return 'inhaler-other'
    if re.search(r'CAPSULE WITH DEVICE|吸入膠囊|INHALATION POWDER, HARD CAPSULE', name) and not re.search(r'BREEZHALER|HANDIHALER', name): return 'capsule-inhaler'
    if f in ('口腔吸入劑','乾粉吸入劑','吸入用膠囊劑','粉狀吸入劑','氣化噴霧劑','口腔氣化噴霧劑','鼻用吸入劑') or ('吸入' in f and '液' not in f):
        if '鼻' in f: return 'nasal-spray'
        for p, rx in INH:
            if re.search(rx, name): return p
        if '膠囊' in f: return 'capsule-inhaler'
        if '乾粉' in f or '粉狀' in f: return 'dpi-generic'
        return 'pmdi'
    if f in ('吸入用液劑','氣化噴霧用溶液劑'):
        return 'nebulizer'
    # injections: only home self-injected
    if '注射' in f or '輸注' in f or f in ('皮下注射劑','預充填式注射劑'):
        for p, rx in INJ:
            if re.search(rx, ing):
                is_vial = re.search(r'VIAL|小瓶', name) or (re.search(r'小瓶|瓶', pack) and not re.search(r'筆|匣|管|預充', pack))
                if '凍晶' in f and p == 'autoinjector': return None
                if p in ('insulin-pen', 'injection-pen'):
                    if is_vial or (p == 'insulin-pen' and not re.search(r'PEN|筆|SOLOSTAR|FLEX|KWIK|PENFILL|CARTRIDGE|芯管|JUNIOR|TEMPO', name) and not re.search(r'筆|匣|芯管|卡管|預充', pack)):
                        return 'vial-syringe'
                    if p == 'injection-pen' and re.search(r'TRULICITY|易週糖|單劑量|SINGLE[- ]DOSE', name): return 'autoinjector'
                    if p == 'injection-pen' and re.search(r'MOUNJARO|猛健樂', name) and not re.search(r'KWIKPEN|筆', name): return 'autoinjector'
                return p
        return None
    # eye / ear / nose
    if f in ('點眼液劑','點眼懸液劑','眼用液劑','點眼乳劑','無菌眼用液劑','眼用懸浮液','眼用凝膠劑'): return 'eye-drops'
    if f in ('點眼膏劑','眼用軟膏劑'): return 'eye-ointment'
    if f in ('點耳液劑','耳用滴劑'): return 'ear-drops'
    if f in ('鼻用噴液劑','鼻用懸液劑','鼻用噴液懸浮劑','點鼻液劑','鼻用氣化噴霧劑','鼻內凝膠劑'): return 'nasal-spray'
    if f == '無菌眼耳鼻用液劑': return 'eye-drops'
    # vaginal / rectal
    if f in ('陰道錠','陰道栓劑','陰道用軟膠囊劑'): return 'vaginal-insert'
    if f in ('陰道用凝膠劑','陰道用乳膏劑'): return 'vaginal-cream'
    if f in ('陰道釋放系統','陰道避孕環'): return 'vaginal-ring'
    if f == '栓劑':
        if re.search(r'VAGIN|陰道', txt + use): return 'vaginal-insert'
        return 'suppository'
    if f in ('浣腸劑',): return 'enema'
    # transdermal / plasters
    if f in ('穿皮貼片劑',): return 'transdermal-patch'
    if f in ('藥膠布','貼片劑','貼布劑','水性藥膠布','油性藥膠布'): return 'medicated-plaster'
    # oral special
    if f in ('舌下錠',): return 'sublingual'
    if f in ('口頰溶片','口頰錠','口溶膜'): return 'buccal'
    if f in ('口溶錠','凍晶口溶錠','口腔崩散錠','持續釋放口溶錠'): return 'odt'
    if f in ('發泡錠','發泡顆粒劑','可溶錠'): return 'effervescent'
    if f in ('咀嚼錠',): return 'chewable'
    if f in ('口含錠','口腔錠'): return 'lozenge'
    if f in ('口腔噴液劑','口腔噴霧溶液劑'):
        return 'oral-spray'
    if f in ('口內膏','漱口劑','牙科用凝膠劑','牙科用軟膏劑','牙膏劑'): return 'mouth-topical'
    if re.search(r'持續|緩釋|長效|腸溶|多層', f): return 'oral-modified'
    if f in ('錠劑','膜衣錠','糖衣錠','著衣錠','丸劑'): return 'oral-tablet'
    if '膠囊' in f: return 'oral-capsule'
    if f in ('內服液劑','糖漿劑','懸液劑','液劑','口服液劑','溶液劑','酏劑','內服乳劑','口服懸液劑','口服溶液劑','內服懸液劑','滴劑','內服凝膠劑','合劑','乳漿劑','酊劑','懸浮液','懸浮劑') :
        # 液劑/滴劑/酊劑 may be external; check usage text
        if re.search(r'外用|塗|擦|患部', use) and not re.search(r'口服|內服', use): return 'topical'
        return 'oral-liquid'
    if f in ('懸液用粉劑','糖漿用粉劑','口服懸液用粉劑','糖漿用顆粒劑','懸液用顆粒劑','懸浮液用顆粒劑','口服溶液用粉劑','溶液用粉劑'): return 'oral-reconstitute'
    if f in ('（粉）','粉劑','散劑','顆粒劑','內服顆粒劑','細粒劑','細顆粒'):
        if re.search(r'外用|撒布|患部', use + f): return 'topical'
        return 'oral-powder'
    # topical
    if f in ('乳膏劑','軟膏劑','外用液劑','外用凝膠劑','洗劑','乳膠劑','外用噴液劑','外用粉劑','乳劑','擦劑','油劑','霜劑','泡沫劑','凝膠劑','凝膠 (非無菌半固體製劑)','洗髮劑','外用懸液劑','外用散劑','糊劑','油膏劑','外用氣化噴霧劑','噴霧劑','醑劑','棒劑','藥皂','薄荷棒','凍膠','膠劑'):
        return 'topical'
    return None

seen = set(); INJ_PAGES = {'insulin-pen','vial-syringe','injection-pen','epinephrine-autoinjector','prefilled-syringe','autoinjector'}
out = []; skipped = collections.Counter(); bypage = collections.Counter(); unmapped = collections.Counter()
for r in rows:
    if norm(r['註銷狀態']): continue
    if norm(r['許可證種類']) in EXCL_KIND: skipped['kind:' + norm(r['許可證種類'])] += 1; continue
    lic = norm(r['許可證字號'])
    if lic in seen: skipped['duplicate-row'] += 1; continue
    p = form_page(r)
    is_inj = p in INJ_PAGES
    # self-injected products are often classed 限由醫師使用 in TFDA data; keep them (prescribed for home self-injection)
    if norm(r['藥品類別']) in EXCL_CAT and not is_inj: skipped['cat:' + norm(r['藥品類別'])] += 1; continue
    seen.add(lic)
    if not p: unmapped[norm(r['劑型'])] += 1; continue
    bypage[p] += 1
    out.append([norm(r['許可證字號']), norm(r['中文品名']), norm(r['英文品名']), norm(r['主成分略述'])[:120], norm(r['劑型']), p,
                {'須由醫師處方使用': 'Rx', '醫師藥師藥劑生指示藥品': 'OTC-i', '成藥': 'OTC', '乙類成藥': 'OTC', '甲類成藥': 'OTC'}.get(norm(r['藥品類別']), 'Rx')])

out.sort(key=lambda x: x[2])
os.makedirs(OUT, exist_ok=True)
# shard by technique group to allow lazy loading
GROUPS = {'oral': ['oral-tablet','oral-capsule','oral-modified','oral-liquid','oral-powder','oral-reconstitute','chewable','odt','sublingual','buccal','effervescent','lozenge','oral-spray','mouth-topical'],
          'topical': ['topical','transdermal-patch','medicated-plaster'],
          'other': None}
shards = collections.defaultdict(list)
for o in out:
    g = 'oral' if o[5] in GROUPS['oral'] else 'topical' if o[5] in GROUPS['topical'] else 'other'
    shards[g].append(o)
for g, lst in shards.items():
    json.dump({'fields': ['license','zh','en','ingredient','form','page','class'], 'rows': lst}, open(os.path.join(OUT, g + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
meta = {'source': 'TFDA 全部藥品許可證資料集 (data.fda.gov.tw InfoId=36)', 'downloaded': os.environ.get('TFDA_DATE', datetime.date.today().isoformat()),
        'total_rows': len(rows), 'included': len(out), 'by_page': dict(bypage), 'skipped': dict(skipped), 'unmapped_forms': dict(unmapped.most_common()),
        'shards': {g: len(l) for g, l in shards.items()}}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(meta, ensure_ascii=False, indent=1))
