# One-off generator for data/drugs.json (after this, pharmacists edit data/drugs.json directly).
import json
base = {b['slug']: b for b in json.load(open('/tmp/base40.json'))}
LIC = {'berodual':'衛署藥輸字第023473號','foster-nexthaler':'衛部藥輸字第026816號','foster':'衛署藥輸字第025092號','onbrez-breezhaler':'衛署藥輸字第025282號',
 'bevespi-aerosphere':'衛部藥輸字第027524號','enerzair-breezhaler':'衛部藥輸字第028048號／第028049號','alvesco-mdi':'衛署藥輸字第024787號／第024786號','ryzodeg-flextouch':'衛部菌疫輸字第001053號',
 'lantus-solostar':'衛署菌疫輸字第000728號','humalog-mix25-kwikpen':'衛署菌疫輸字第000898號','humalog-mix50-kwikpen':'衛署菌疫輸字第000899號','levemir-flexpen':'衛署菌疫輸字第000810號',
 'toujeo-solostar':'衛部菌疫輸字第001011號','novomix30-flexpen':'衛署菌疫輸字第000820號','novorapid-flexpen':'衛署菌疫輸字第000823號','humalog-kwikpen':'衛署菌疫輸字第000900號'}
TSP = 'https://www.tspccm.org.tw/media/'
CHIP = {'乾粉吸入器':'dpi','柔霧吸入器':'smi','定量噴霧吸入器':'pmdi','胰島素注射筆':'insulin'}
ICS_RINSE = '用完用水漱口並吐掉（含吸入型類固醇）。'
TALLY = lambda n: f'本品沒有劑量計數器時：新的一支共 {n} 噴，每按一下（包括試噴）就在藥袋或紙上畫一筆，到 {n} 就換新的。'
EVO_NOTE = '影片為台灣胸腔暨重症加護醫學會的 GSK Evohaler 同型定量噴霧器教學，試噴次數請以本頁為準。'
D = {}
def add(slug, **k): D[slug] = k

# ---------------- inhalers ----------------
add('symbicort-turbuhaler', technique='turbuhaler', role='mart', rinse=True, video=TSP+'10878', lasa=['symbicort'],
    purpose='含[[吸入型類固醇]]（budesonide）和長效[[支氣管擴張劑]]（formoterol）的乾粉吸入劑，用於氣喘或慢性阻塞性肺病（COPD）。',
    usual=['使用次數與吸數依醫師處方與藥袋。', '部分氣喘病人醫師會指示「保養加緩解」（[[MART]]）用法；只有您的氣喘行動計畫有寫才可以這樣用。'],
    prep=[{'t':'新的吸入器第一次使用：蓋子轉開拿掉，吸入器直立，底座往一個方向轉到底，再轉回來直到「喀」一聲；這個步驟做 2 次（不用吸）。','tm':'turbuhaler/03-twist-grip-click','img':'tbh-twist','c':['直立','來回轉 2 次']}],
    storage=['不要高於 30°C，用完一定蓋緊蓋子。'])
add('spiriva', technique='respimat', role='maintenance', video=TSP+'10682', lasa=['respimat'],
    purpose='長效抗膽鹼[[支氣管擴張劑]]（tiotropium），用於 COPD 與部分氣喘病人的保養治療。',
    usual=['一次劑量是連續 2 噴，每天 1 次，每天固定時間使用（依醫師處方）。'])
add('berotec', technique='pmdi', role='reliever', shake=True, video=None, lasa=['beroduo'],
    purpose='短效[[支氣管擴張劑]]（fenoterol），突然喘的時候用的[[急救吸入劑]]。',
    usual=['依醫師處方在需要時使用。每天最多可用幾次請依藥袋與仿單，不要自己加量。', '如果需要的次數越來越多，表示氣喘或 COPD 沒控制好，請盡快回診。'],
    prep=[{'t':'新的吸入器第一次使用：搖勻後朝空中、遠離臉部按壓 2 下。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 2 下']},
          {'t':'超過 3 天沒有使用：使用前先朝空中按壓 1 下。','img':'prime-air','c':['朝空中 1 下']}],
    empty=[TALLY(200)],
    cleaning=['每週清潔一次：先取下金屬藥罐，用溫水沖洗塑膠吸嘴外殼，甩乾後自然風乾，乾了再把藥罐裝回去。金屬藥罐不可以碰水。'],
    storage=['30°C 以下保存；加壓罐不可刺穿、焚燒或放在超過 50°C 的地方。'])
add('berodual', technique='pmdi', role='reliever', shake=True, video=None, lasa=['beroduo'],
    purpose='兩種短效[[支氣管擴張劑]]（ipratropium＋fenoterol）的定量噴霧劑，用於緩解喘、胸悶。',
    usual=['依醫師處方在需要時使用。每天最多可用幾次請依藥袋與仿單，不要自己加量。', '如果需要的次數越來越多，請盡快回診。'],
    prep=[{'t':'新的吸入器第一次使用：搖勻後朝空中、遠離臉部按壓 2 下。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 2 下']},
          {'t':'超過 3 天沒有使用：先朝空中按壓 1 下。','img':'prime-air','c':['朝空中 1 下']}],
    empty=[TALLY(200)],
    cleaning=['每週清潔一次：先取下金屬藥罐，用溫水沖洗塑膠吸嘴外殼，甩乾後自然風乾，乾了再裝回藥罐。藥罐不可碰水。'],
    storage=['30°C 以下保存；加壓罐不可刺穿、焚燒或放在超過 50°C 的地方。'])
add('spiolto', technique='respimat', role='copdOnly', video=TSP+'10682', lasa=['respimat'],
    purpose='兩種長效[[支氣管擴張劑]]（tiotropium＋olodaterol），用於[[慢性阻塞性肺病]]的保養治療。',
    usual=['一次劑量是連續 2 噴，每天 1 次，每天固定時間使用（依醫師處方）。'])
add('symbicort-rapihaler', technique='pmdi', role='mart', rinse=True, shake=True, video=TSP+'10877', lasa=['symbicort'],
    purpose='含[[吸入型類固醇]]（budesonide）和長效[[支氣管擴張劑]]（formoterol）的定量噴霧吸入器。',
    usual=['使用次數與噴數依醫師處方與藥袋；是否也當緩解用，只能依醫師給您的行動計畫。'],
    prep=[{'t':'新的吸入器、超過 1 週沒用、或摔到之後：搖 5 秒，朝空中遠離臉部按 1 下；再搖 5 秒、再按 1 下，共試噴 2 次。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['搖 5 秒','共試噴 2 次']}],
    empty=['看吸入器上的劑量計數器；數字快到 0 時準備新的一支。'],
    cleaning=['每週用乾布擦吸嘴裡外。不要放進水裡、不要拆下藥罐。'],
    storage=['30°C 以下保存。從鋁箔袋取出後 3 個月內用完（請在吸入器上寫下拆封日期）。'])
add('seretide', technique='pmdi', role='maintenance', rinse=True, shake=True, video=TSP+'s/pMXI9a', videoNote=EVO_NOTE, lasa=['seretide'],
    purpose='含[[吸入型類固醇]]（fluticasone）和長效[[支氣管擴張劑]]（salmeterol）的定量噴霧吸入器（優氟吸入劑）。',
    usual=['每天使用次數依醫師處方，即使沒有症狀也要規律使用。'],
    prep=[{'t':'第一次使用：取下吸嘴蓋，搖勻後朝空中、遠離臉部試噴，直到計數器顯示 120。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中試噴','計數器到 120']},
          {'t':'超過 1 星期沒有使用：使用前搖勻並朝空中試噴（次數請依仿單或藥師說明）。','img':'prime-air','c':['朝空中試噴']}],
    gap='約 30 秒',
    empty=['看計數器的數字；數字快到 0 時請準備新的一支。'],
    cleaning=['每週一次用乾布或紙巾擦吸嘴裡外。不要拆下藥罐，不要用水洗。'],
    storage=['30°C 以下保存。'])
add('flixotide', technique='pmdi', role='maintenance', rinse=True, shake=True, video=TSP+'s/pMXI9a', videoNote=EVO_NOTE,
    purpose='[[吸入型類固醇]]（fluticasone）定量噴霧吸入器，用於預防氣喘發作。',
    usual=['每天規律使用，次數依醫師處方。'],
    prep=[{'t':'第一次使用或超過 1 星期沒用：搖勻後朝空中、遠離臉部試噴 2 下。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 2 下']}],
    gap='約 30 秒',
    empty=['有計數器時看計數器。'+TALLY(120)],
    cleaning=['每週一次用乾布或紙巾擦吸嘴裡外。不要拆下藥罐，不要用水洗。'],
    storage=['30°C 以下保存。'])
add('duasma', technique='pmdi', role='maintenance', rinse=True, shake=True, video=None,
    purpose='[[吸入型類固醇]]（budesonide）定量噴霧劑，用於預防氣喘發作。可接[[吸藥輔助器]]使用。',
    usual=['每天規律使用，次數依醫師處方。'],
    prep=[{'t':'第一次使用：搖勻後朝空中、遠離臉部按壓 2 下。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 2 下']}],
    spacerNote=['接輔助器時：按壓藥罐後立刻用正常呼吸的速度吸入（不要延遲，藥霧會很快黏在輔助器內壁），閉氣約 5–10 秒。', '輔助器用溫水加清潔劑或肥皂清洗，沖乾淨後讓它乾燥。'],
    empty=[TALLY(200)],
    cleaning=['吸入器的清潔方式請依仿單或藥師說明。'])
add('foster-nexthaler', technique='nexthaler', role='mart', rinse=True, video=TSP+'10879', lasa=['foster'],
    purpose='含[[吸入型類固醇]]（beclometasone）和長效[[支氣管擴張劑]]（formoterol）的乾粉吸入劑。',
    usual=['使用次數依醫師處方；是否也當緩解用，只能依醫師給您的行動計畫。'],
    storage=['開袋前不要放在 25°C 以上。從保護袋取出後 6 個月內用完（請寫下開袋日期）。'])
add('foster', technique='pmdi', role='mart', rinse=True, shake='check', video=TSP+'10683', lasa=['foster'],
    purpose='含[[吸入型類固醇]]（beclometasone）和長效[[支氣管擴張劑]]（formoterol）的定量吸入劑（溶液型）。',
    usual=['使用次數依醫師處方；是否也當緩解用，只能依醫師給您的行動計畫。'],
    prep=[{'t':'第一次使用或超過 14 天沒用：朝空中、遠離臉部按壓 1 下，確認計數器變成 120。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 1 下','計數器 120']}],
    empty=['看計數器的數字；數字快到 0 時準備新的一支。'],
    cleaning=['用乾布擦吸嘴裡外。不要拆下藥罐，不要用水洗。'],
    storage=['藥局交給您之前放冰箱；領藥後放 25°C 以下，最多 5 個月（請在盒上寫下領藥日期）。'])
add('anoro', technique='ellipta', role='copd', video=TSP+'7025', lasa=['ellipta'],
    purpose='兩種長效[[支氣管擴張劑]]（umeclidinium＋vilanterol）的乾粉吸入劑。',
    usual=['每天 1 次、每次 1 吸，每天固定時間使用（依醫師處方）。'],
    storage=['藥盒開封後 6 週內用完（請在標籤寫下開封日與丟棄日）。'])
add('breztri', technique='pmdi', role='copd', rinse=True, shake=True, video=TSP+'10686', videoNote='影片為同一種 Aerosphere 吸入器（Bevespi）的操作教學，試噴次數請以本頁為準。', lasa=['aerosphere'],
    purpose='三合一（[[吸入型類固醇]] budesonide＋兩種長效支氣管擴張劑）的定量噴霧吸入器。',
    usual=['使用次數依醫師處方，即使沒有症狀也要規律使用。'],
    prep=[{'t':'第一次使用：每次先充分搖勻，朝空中、遠離臉部按壓，共 4 次。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 4 次']},
          {'t':'超過 7 天沒用、摔到、或每週清洗後：搖勻後朝空中按壓 2 次。','img':'prime-air','c':['朝空中 2 次']}],
    empty=['看計數器的數字；數字快到 0 時準備新的一支。'],
    cleaning=['每週清洗一次：取出藥罐（藥罐不可碰水），溫水從吸入器上方流過約 30 秒，再從吸嘴端流過約 30 秒，甩乾後自然風乾；裝回藥罐後依上面規定試噴 2 次。'],
    storage=['25°C 以下乾燥處保存。從鋁箔袋取出後 3 個月內用完。'])
add('trimbow', technique='pmdi', role='copd', rinse=True, shake='check', video=TSP+'10689',
    purpose='三合一（[[吸入型類固醇]] beclometasone＋formoterol＋glycopyrronium）的定量吸入劑。',
    usual=['使用次數依醫師處方，即使沒有症狀也要規律使用。'],
    prep=[{'t':'第一次使用：計數器應顯示 121。朝空中、遠離臉部按壓 1 下，計數器變成 120 就完成。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 1 下','121 → 120']}],
    gap='約 30 秒',
    empty=['看計數器的數字；數字快到 0 時準備新的一支。'],
    cleaning=['用乾布擦吸嘴。不要拆下藥罐，不要用水洗。'],
    storage=['藥局交給您之前放冰箱；領藥後放 25°C 以下，最多 4 個月（請寫下領藥日期）。'])
add('ventolin', technique='pmdi', role='reliever', shake=True, video=TSP+'s/pMXI9a', videoNote=EVO_NOTE,
    purpose='短效[[支氣管擴張劑]]（salbutamol），突然喘的時候用的[[急救吸入劑]]。',
    usual=['依醫師處方在需要時使用；每天最多可用幾次請依藥袋與仿單。', '需要越用越多次，表示病情沒控制好，請盡快回診。'],
    prep=[{'t':'第一次使用或超過 5 天沒用：搖勻後朝空中、遠離臉部按壓 2 下。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 2 下']}],
    gap='約 30 秒',
    empty=[TALLY(200)],
    cleaning=['每週清潔一次：取出金屬藥罐，用溫水沖洗塑膠外殼與吸嘴，甩乾後自然風乾，乾了再裝回藥罐。藥罐不可碰水。'],
    storage=['30°C 以下保存，避免結霜與陽光直射。'])
add('onbrez-breezhaler', technique='breezhaler', role='copdOnly', video=TSP+'10673', lasa=['breezhaler'],
    purpose='長效[[支氣管擴張劑]]（indacaterol）吸入膠囊，用於[[慢性阻塞性肺病]]的保養治療。',
    usual=['每天 1 次、每次 1 顆膠囊（放進吸入器吸，不能吞），每天固定時間（依醫師處方）。'],
    storage=['30°C 以下；膠囊留在鋁箔中，要用時才取出。'])
add('striverdi-respimat', technique='respimat', role='copdOnly', video=TSP+'10682', lasa=['respimat'],
    purpose='長效[[支氣管擴張劑]]（olodaterol），用於[[慢性阻塞性肺病]]的保養治療。',
    usual=['一次劑量是連續 2 噴，每天 1 次，每天固定時間使用（依醫師處方）。'])
add('incruse-ellipta', technique='ellipta', role='copd', video=TSP+'5877', lasa=['ellipta'],
    purpose='長效抗膽鹼[[支氣管擴張劑]]（umeclidinium）乾粉吸入劑。',
    usual=['每天 1 次、每次 1 吸，每天固定時間（依醫師處方）。'],
    storage=['藥盒開封後 6 週內用完（請在標籤寫下開封日與丟棄日）。'])
add('relvar-ellipta', technique='ellipta', role='maintenance', rinse=True, video=TSP+'10684', lasa=['ellipta','relvar-strength'],
    purpose='含[[吸入型類固醇]]（fluticasone furoate）和長效[[支氣管擴張劑]]（vilanterol）的乾粉吸入劑。有 92/22 和 184/22 兩種含量。',
    usual=['每天 1 次、每次 1 吸，每天固定時間（依醫師處方）。'],
    storage=['30°C 以下；從藥盒取出後最多 1 個月內用完（請寫下開封日與丟棄日）。'])
add('seretide-accuhaler', technique='accuhaler', role='maintenance', rinse=True, video=TSP+'s/UK2fjq', lasa=['seretide','accuhaler-strength'],
    purpose='含[[吸入型類固醇]]（fluticasone）和長效[[支氣管擴張劑]]（salmeterol）的乾粉吸入劑（準納）。有 100/50、250/50、500/50 等含量。',
    usual=['每天使用次數依醫師處方，即使沒有症狀也要規律使用。'])
add('ultibro-breezhaler', technique='breezhaler', role='copdOnly', video=TSP+'10673', lasa=['breezhaler'],
    purpose='兩種長效[[支氣管擴張劑]]（indacaterol＋glycopyrronium）吸入膠囊，用於[[慢性阻塞性肺病]]的保養治療。',
    usual=['每天 1 次、每次 1 顆膠囊（放進吸入器吸，不能吞），每天固定時間（依醫師處方）。'],
    empty=['看鋁箔剩下幾顆膠囊。吸入器使用 30 天後要丟棄，換用新盒附的吸入器。'])
add('bevespi-aerosphere', technique='pmdi', role='copd', shake=True, video=TSP+'10686', lasa=['aerosphere'],
    purpose='兩種長效[[支氣管擴張劑]]（glycopyrronium＋formoterol）的定量噴霧吸入器。',
    usual=['使用次數依醫師處方，即使沒有症狀也要規律使用。'],
    prep=[{'t':'第一次使用：每次先充分搖勻，朝空中、遠離臉部按壓，共 4 次。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中 4 次']},
          {'t':'超過 7 天沒用、摔到、或每週清洗後：搖勻後朝空中按壓 2 次。','img':'prime-air','c':['朝空中 2 次']}],
    hold='最多約 10 秒（舒服範圍內）',
    empty=['看計數器的數字；數字快到 0 時準備新的一支。'],
    cleaning=['每週清洗一次：取出藥罐（藥罐不可碰水），溫水從吸入器上方流過約 30 秒，再從吸嘴端流過約 30 秒，甩乾後自然風乾；裝回藥罐後試噴 2 次。'],
    storage=['25°C 以下乾燥處保存。從鋁箔袋取出後 3 個月內用完。'])
add('trelegy-ellipta', technique='ellipta', role='maintenance', rinse=True, video=TSP+'5879', lasa=['ellipta'],
    purpose='三合一（[[吸入型類固醇]] fluticasone furoate＋umeclidinium＋vilanterol）乾粉吸入劑。',
    usual=['每天 1 次、每次 1 吸，每天固定時間（依醫師處方）。'],
    storage=['藥盒開封後 1 個月內用完（請在標籤寫下開封日與丟棄日）。'])
add('enerzair-breezhaler', technique='breezhaler', role='maintenance', rinse=True, video=TSP+'10690', lasa=['breezhaler','enerzair-strength'],
    purpose='三合一（[[吸入型類固醇]] mometasone＋兩種長效支氣管擴張劑）吸入膠囊，用於氣喘的保養治療。有 150/50/80 和 150/50/160 兩種含量。',
    usual=['每天 1 次、每次 1 顆膠囊（放進吸入器吸，不能吞），每天固定時間（依醫師處方）。'])
add('alvesco-mdi', technique='pmdi', role='maintenance', rinse=True, shake='check', video=None, lasa=['alvesco-strength'],
    purpose='[[吸入型類固醇]]（ciclesonide）定量吸入劑，用於預防氣喘發作。有 80 和 160 微公克兩種含量。',
    usual=['每天規律使用，次數依醫師處方。'],
    prep=[{'t':'第一次使用（或久未使用）：先朝空中、遠離臉部試噴（次數請依仿單或藥師說明）。','tm':'pmdi/03-prime-test-spray','img':'prime-air','c':['朝空中試噴']}],
    cleaning=['清潔方式請依仿單或藥師說明。'])

# ---------------- insulin pens ----------------
def pen(slug, **k): k.setdefault('technique','insulin-pen'); k['highAlert']=True; add(slug, **k)
pen('awiqli', role='insulinWeekly', video=None, lasa=['flextouch','weekly'], test='依盒內使用說明書（台灣仿單未收錄使用說明，待藥師確認）', hold='依盒內使用說明書', retries=None,
    purpose='每週一次的長效[[基礎胰島素]]（insulin icodec），濃度 700 單位/mL。',
    usual=['一週只打一次，不是每天打。每週固定同一天注射，劑量依醫師處方。', '請在月曆上記下每週注射的日子。'],
    warn=['一週只打一次，不是每天打。', '高濃度（700 單位/mL）：絕對不可以用空針從筆裡抽藥。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用或隨身攜帶時：30°C 以下或冰箱，最多 12 週。'])
pen('ryzodeg-flextouch', role='insulinCoform', video=None, lasa=['flextouch'], test='2 單位', retries='最多 6 次', hold='至少 6 秒',
    purpose='長效（degludec）＋速效（aspart）胰島素的複方，澄清液，不需要混勻。',
    usual=['依醫師處方，和一天中的主餐一起注射。'],
    missed='忘記打：在當天下一次正餐時補打，之後照原來時間；不要為了補而多打一次。（依台灣仿單；有疑問請聯絡藥師／醫師）',
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：冰箱或 30°C 以下，28 天內用完。'])
pen('tresiba-flextouch', role='insulinBasal', video=None, lasa=['flextouch'], test='2 單位', retries='最多 6 次', hold='至少 6 秒',
    purpose='長效[[基礎胰島素]]（insulin degludec），每天一次。',
    usual=['每天注射一次，劑量依醫師處方。'],
    missed='成人忘記打：醒著發現時補打，兩次注射至少間隔 8 小時，之後照原來時間。（依台灣仿單；待藥師確認措辭）',
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：冰箱或 30°C 以下，56 天內用完。'])
pen('lantus-solostar', role='insulinBasal', video=None, lasa=['glargine','solostar'], test='2 單位', retries=None, hold='10 秒',
    purpose='長效[[基礎胰島素]]（insulin glargine 100 單位/mL）。',
    usual=['每天固定時間注射一次，劑量依醫師處方。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。冰的筆請在注射前 1–2 小時拿出來回溫。', '開始使用後：30°C 以下保存，不要再放回冰箱，4 週內用完。'])
pen('semglee-pen', role='insulinBasal', video=None, lasa=['glargine'], test='2 單位', retries='最多 4 次', hold='10 秒',
    purpose='長效[[基礎胰島素]]（insulin glargine 100 單位/mL）。',
    usual=['每天固定時間注射一次，劑量依醫師處方。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：25°C 以下，不要放冰箱，4 週內用完。'])
pen('humalog-mix25-kwikpen', role='insulinMix', mix='每次注射前：把筆在手掌間滾動 10 次，再上下翻轉（180°）10 次，直到均勻乳白色。不要用力搖。', video=None, lasa=['humalog'], test='2 單位（依使用說明書）', retries=None, hold='依使用說明書（台灣仿單未收錄，待確認）',
    purpose='預混型胰島素：25% 速效 lispro＋75% 中效 lispro protamine，外觀為乳白色。',
    usual=['依醫師處方，通常在餐前注射。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：30°C 以下，不要放冰箱，28 天內用完。'])
pen('humalog-mix50-kwikpen', role='insulinMix', mix='每次注射前：把筆在手掌間滾動 10 次，再上下翻轉 10 次，直到均勻乳白色。不要用力搖。', video=None, lasa=['humalog'], test='2 單位', retries=None, hold='數到 5',
    purpose='預混型胰島素：50% 速效 lispro＋50% 中效 lispro protamine，外觀為乳白色。',
    usual=['依醫師處方，通常在餐前注射。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：30°C 以下；可使用天數依包裝說明書（待藥師確認）。'])
pen('levemir-flexpen', role='insulinBasal', video=None, lasa=['flexpen'], test='2 單位', retries='最多 6 次', hold='至少 6 秒',
    purpose='長效[[基礎胰島素]]（insulin detemir）。',
    usual=['依醫師處方，每天 1 或 2 次固定時間注射。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：30°C 以下或冰箱，6 週內用完。'])
pen('toujeo-solostar', role='insulinBasal', video=None, lasa=['glargine','solostar'], test='3 單位', testNote='依原廠使用說明（非台灣版）；台灣版使用說明待藥師確認', retries='3 次仍無藥滴就換針頭（原廠說明）', hold='數到 5',
    purpose='高濃度長效[[基礎胰島素]]（insulin glargine 300 單位/mL）。',
    usual=['每天固定時間注射一次，劑量依醫師處方。'],
    warn=['高濃度（300 單位/mL）：絕對不可以用空針從筆裡抽藥。', '和蘭德仕（Lantus，100 單位/mL）不同，不可互換或自己換算劑量。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：30°C 以下，不要放冰箱，42 天內用完。'])
pen('novomix30-flexpen', role='insulinMix', video=None, lasa=['flexpen'], test='2 單位', retries='最多 6 次', hold='至少 6 秒',
    mix='新筆第一次注射前：筆保持水平，在手掌間滾動 10 次，再把筆在上下兩個位置間擺動 10 次，讓筆芯裡的玻璃球兩端來回滾動；重複滾動和擺動，直到藥液均勻白色雲霧狀。之後每次注射前：在上下兩個位置間擺動至少 10 次。',
    purpose='預混型胰島素：30% 速效 aspart＋70% 中效 aspart protamine，外觀為乳白色。',
    usual=['依醫師處方，通常在餐前注射。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：不要放冰箱，30°C 以下，4 星期內用完。'])
pen('novorapid-flexpen', role='insulinRapid', video=None, lasa=['flexpen'], test='2 單位', retries='最多 6 次', hold='至少 6 秒',
    purpose='[[速效胰島素]]（insulin aspart），控制吃飯後的血糖。',
    usual=['依醫師處方在餐前注射；打了就要吃飯。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：30°C 以下或冰箱 2–8°C，4 星期內用完。'])
for s, gl in (('soliqua-100-33','33'),('soliqua-100-50','50')):
    pen(s, role='insulinCombo', triage2='glp1', video=None, lasa=['soliqua','glargine','solostar'], test='2 單位', testNote='依原廠使用說明（非台灣版）；台灣版待確認', retries='3 次仍無藥滴就換針頭（原廠說明）', hold='數到 10',
        purpose=f'長效胰島素（insulin glargine 100 單位/mL）＋GLP-1 受體促效劑（lixisenatide {gl} 微克/mL）的固定比例複方，不是單純的胰島素。',
        usual=['每天一次，在一餐前注射（時間與劑量依醫師處方）。'],
        warn=['100/33 和 100/50 兩種筆不可互換，請核對筆上的含量。', '持續劇烈腹痛（可能痛到背部）、伴隨嘔吐：可能是胰臟炎，請停藥並當天急診。'],
        storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：25°C 以下最多 28 天，或 30°C 以下最多 14 天；不要再放回冰箱，不可冷凍。'])
pen('apidra-solostar', role='insulinRapid', video=None, lasa=['solostar'], test='2 單位', retries=None, hold='10 秒',
    purpose='[[速效胰島素]]（insulin glulisine），控制吃飯後的血糖。',
    usual=['依醫師處方在用餐前後短時間內注射（時間依仿單與醫囑）。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：25°C 以下，不需冷藏，4 週內用完。'])
pen('humalog-kwikpen', role='insulinRapid', video=None, lasa=['humalog'], test='2 單位', retries='最多 4 次，仍無藥滴就換針頭', hold='數到 5',
    purpose='[[速效胰島素]]（insulin lispro），控制吃飯後的血糖。',
    usual=['依醫師處方在餐前注射；打了就要吃飯。'],
    storage=['未開封：冰箱 2–8°C，不可冷凍。', '開始使用後：30°C 以下，28 天內用完。'])

out = []
for slug, b in base.items():
    d = D[slug]
    lic = LIC.get(slug) or b['insert'].split('/exportpdf/')[-1]
    lic1 = lic.split('／')[0]
    d2 = dict(slug=slug, no=b['no'], brand=b['brand'], zhName=b['zh'], ingredient=b['ingredient'] if 'ingredient' in b else b['ing'], strength=b['strength'],
              category=b['cat'], chip=CHIP[b['cat']], license=lic, insert='https://mcp.fda.gov.tw/exportpdf/' + lic1, **d)
    d2.pop('ing', None)
    d2['reviewStatus'] = 'draft'
    d2['sources'] = [f'食藥署核准仿單（{lic}），2026-10-17 下載', '事實查核清單 qa/checklist.md v0.1（2026-10-18）', '醫師審閱 qa/physician-review.md']
    out.append(d2)
for o in out:
    o['ingredient'] = base[o['slug']]['ing']
json.dump({'version': '1.0.0', 'lastReviewed': '2026-10', 'effective': '2026-10-18', 'drugs': out}, open('data/drugs.json', 'w'), ensure_ascii=False, indent=1)
print(len(out))
