# 用藥指導（病人衛教網站）v1

靜態網站，沒有後端、沒有登入、沒有追蹤器。內容放在 JSON 裡，藥師可以直接編輯：
- `data/drugs.json`：40 個詳細藥品頁；`data/index/*.json`：TFDA 自行使用藥品索引；`data/lasa.json`：LASA 名稱或外觀相似藥組
- `i18n/zh-TW/`：介面文字、技巧頁、高警訊用藥、名詞解釋
- `config/site.json`：品牌、顏色、電話；`config/codes.json`：院內藥品代碼對應（`?code=XXXX`）

建置：`node tools/build.mjs` 會產生 `dist/`。推到 main 分支時，GitHub Actions 會把 dist 部署到 GitHub Pages。
上線前請先看 **REVIEW_NOTES.md**（待藥師／醫師確認的項目）。
