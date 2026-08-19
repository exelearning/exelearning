# Task Packet — Q01: Course E2E

- `TASK`: Q01 — Course E2E (nguồn: `PLAN.md` dòng 182, cụm "Q — QA/release", 3 giờ, phụ thuộc I03). I03 (Asset/secret audit) đã đóng và được PM/tester xác minh độc lập 2026-08-18 (`repo-map.md`, mục "I01→I02→I03 Integration cluster evidence") — Q01 được mở khóa. Bảng gate (`PLAN.md` dòng 81-91) không có gate riêng cho Q01 — gate tiếp theo trong chuỗi là `G-R0` (Release, dòng 91). Q01 **không tự đóng gate nào**, chỉ là bước tiến tới `G-R0`. Q02 (Regression/security, `PLAN.md` dòng 183) phụ thuộc Q01 — không tự bắt đầu Q02.
- **Nguồn gốc packet — đọc trước khi làm:** file này **thay thế** `CODE_Q01_HANDOFF.md` ở gốc repo. Bản cũ tự đặt tên "GEMINI (AI WRITER DUY NHẤT)" và chỉ định Gemini là writer — sai, mâu thuẫn với `AGENTS.md` §13.4. Người dùng đã xác nhận trực tiếp (2026-08-18): đó là nhầm lẫn, **Codex viết toàn bộ**, đúng như mọi task khác trong Solo Logic Alpha. Nội dung requirement/scope của bản cũ đã được kiểm chứng lại và cập nhật trong phiên này (không copy nguyên văn không kiểm chứng) — khác biệt so với bản cũ được ghi rõ trong "Bối cảnh" bên dưới. `CODE_Q01_HANDOFF.md` đã được đánh dấu superseded, không dùng để lấy chỉ thị.
- `SPEC`: PLAT-07 (`SPEC.md` dòng 210, "Text, ảnh và MP4 course mẫu hiển thị khi ngắt mạng"), AT-03 (dòng 392, "Text, ảnh, MP4 và iDevice hiển thị khi ngắt mạng"), AT-05 (dòng 394, "Sai một ô/expression; feedback chỉ đúng lỗi"), AT-06 (dòng 395, "Bài bốn biến có don't-care, overlap và wrap chấm đúng"), AT-07 (dòng 396, "Half-adder đúng 4/4; tháo dây làm test thất bại"), AT-09 (dòng 398, "Hoàn thành AT-05…AT-07 không mạng; không đóng gói thư mục AI"), EXP-02 (dòng 272, "Ngắt mạng vẫn hoàn thành TT, K-map và half-adder"), EXP-03 (dòng 273, "Export không chứa `.agents`, `.claude`, `.ai`, token, path tuyệt đối hoặc stack trace"). Tất cả 8 ID đã đọc lại trực tiếp từ `SPEC.md` trong phiên này, không suy diễn từ bản cũ.
- `SKILLS`: `exelearning-logic-alpha` (phạm vi P0, gate discipline), `e2e-test` (toàn bộ Q01 là Playwright), `test-driven-development` (demo spec viết trước — RED trước khi `.elpx` tồn tại — rồi GREEN).
- `MUC TIEU`: Chứng minh bằng một course demo `.elpx` **thật** (author qua UI, không viết tay XML) hợp nhất text + ảnh + video + Truth Table + Karnaugh + Logic Circuit (half-adder), cùng một demo script Playwright tái lập được toàn bộ hành trình "soạn → làm → chấm → lưu/mở 10 vòng → export HTML offline" từ đầu, đúng chữ DoD của `PLAN.md` dòng 182: *"Một `.elpx` chứa text, media, TT, K-map và half-adder; demo script tái lập."* Không xây lại iDevice — engine/grader/edition/export đã xanh từ E/K/T/U/I; Q01 chỉ hợp nhất và chứng minh lại bằng một hành trình end-to-end thật.
- `ĐẦU RA`: 1 file `.elpx` mới (sinh qua UI + Playwright download, commit vào `test/fixtures/`) + 1 spec demo mới + (có điều kiện) tối đa 1 helper mới đã khai báo trước, kèm bằng chứng Red-Green thật, output đầy đủ của mọi lệnh ở `TEST BẮT BUỘC`, và diff phạm vi đúng danh sách `FILE ĐƯỢC SỬA`.

## Bối cảnh đã xác minh (đọc code thật trong phiên này, không suy diễn từ `CODE_Q01_HANDOFF.md`)

### 1. E2E spec hiện có — số liệu ĐÃ ĐỔI so với bản `CODE_Q01_HANDOFF.md` cũ

`test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` hiện có **742 dòng, 8 `test(...)`** (không phải 7 như bản handoff cũ ghi) — xác nhận bằng `grep` trực tiếp trong phiên này. 5 test gốc (dòng 141/220/279/317/401) + 2 test I01 (dòng 432/502) + **1 test thứ 8** (dòng 596, `'completes truth-table, Karnaugh, and half-adder grading in a real offline HTML5 export (I02, AT-09)'`). Test thứ 8 được thêm ngoài phạm vi khóa cứng của I01 (xem `repo-map.md`, mục "Finding #2"), nhưng đã được PM/tester xác minh kỹ thuật đúng, pass, và **chấp nhận giữ lại làm bằng chứng bổ sung cho AT-09/EXP-02**. Hệ quả trực tiếp cho Q01: **lệnh regression #2 ở `TEST BẮT BUỘC` phải mong đợi 8 pass, không phải 7.** Nếu chạy ra 7 hoặc ít hơn, đó là regression thật — dừng lại, không tự sửa file này (chỉ đọc tham chiếu).

### 2. `downloadProject()` đã có sẵn — trả lời câu hỏi "cần helper mới để tải `.elpx`?" từ Gate A của bản cũ

`test/e2e/playwright/helpers/workarea-helpers.ts` dòng 2341-2413, `export async function downloadProject(page: Page): Promise<Download>` — đã xử lý cả hai chế độ:
- **Static mode** (không remote storage): click `#head-top-save-button` để trigger download.
- **Online mode**: mở `#dropdownFile` → click `#dropdownExportAs` → click `#navbar-button-download-project` → "Download project as ELPX".

Cơ chế phát hiện mode đọc `window.eXeLearning.app.capabilities.storage.remote`. Hàm đã tự xử lý việc đóng dialog TinyMCE/File Manager có thể che nút trước khi thao tác. **Kết luận: không cần tạo helper mới cho bước tải `.elpx`** — dùng thẳng `downloadProject(page)`.

### 3. `exportHtml5Website` KHÔNG phải helper dùng chung — định nghĩa cục bộ, lặp lại độc lập ở 4 file

Grep xác nhận `async function exportHtml5Website(page: Page): Promise<Download>` được định nghĩa **cục bộ, không export**, giống hệt nhau (cùng logic: click `#dropdownFile` → submenu `#dropdownExportAs`/`#dropdownExportAsOffline` → `#navbar-button-export-html5`/`#navbar-button-exportas-html5` → `waitForEvent('download')`) trong **4 file riêng biệt**: `fx-tabs-latex.spec.ts:98`, `latex-rendering.spec.ts:131`, `idevices/electronics-logic.spec.ts:109`, `idevices/three-d-viewer.spec.ts:113`. Đây là trùng lặp đã tồn tại từ trước, ngoài phạm vi Q01 để dọn (sửa sẽ đụng ≥4 file không nằm trong `FILE ĐƯỢC SỬA`). **Q01 phải định nghĩa một bản cục bộ tương tự trong spec demo mới** — đọc `idevices/electronics-logic.spec.ts:109-124` làm mẫu tham chiếu (file này chỉ đọc, không sửa).

### 4. Mẫu phục vụ export offline qua `page.route()` — đã có tiền lệ pass thật

`idevices/electronics-logic.spec.ts:649-665` (bên trong test thứ 8 ở mục 1): sau khi tải ZIP thật và giải nén bằng `unzipSync` (từ `fflate`, import trực tiếp — xem cách import ở đầu file đó), phục vụ đúng byte qua `page.route('http://el-offline.local/**', ...)`, trả 404 cho bất kỳ key nào không có trong ZIP, rồi `page.goto('http://el-offline.local/index.html')`. Đây là bằng chứng "không cần mạng thật" (EXP-02/AT-09) đã được PM xác minh chạy thật và pass. **Test 5 của Q01 (mục 6) phải theo đúng mẫu này**, không phát minh cơ chế khác.

### 5. Helper khác đã xác nhận tồn tại bằng grep trực tiếp (không suy diễn)

`waitForAppReady`, `openElpFile`, `saveProject`, `gotoWorkarea`, `selectFirstPage`, `openPreviewPanel`, `getPreviewFrame`, `waitForPreviewContent`, `addIdevice`, `editIdevice`, `saveIdevice`, `expandIdeviceCategory`, `reloadPage`, `listZipContents`, `zipContainsFile` — tất cả tồn tại thật trong `workarea-helpers.ts` (đã grep danh sách đầy đủ `export async function`/`export function`). Fixture `test/e2e/playwright/fixtures/auth.fixture.ts` tồn tại thật (`ls` xác nhận), cung cấp project `chromium`/`firefox`/`static` theo `playwright.config.ts` (`testDir: './test/e2e/playwright/specs'`, đã đọc trực tiếp dòng 89/160-183).

### 6. Media fixture — kích thước xác nhận lại trong phiên này, không đổi so với lúc I03 dùng

`ls -la` vừa chạy lại: `test/fixtures/sample-2.jpg` (35.047 B), `sample-3.jpg` (14.106 B), `sample-video-480-900kb.webm` (901.185 B), mtime `2025-08-11` — khớp số liệu I03 đã dùng. Không có `.mp4` nào trong repo (I03 đã xác nhận, không lặp lại việc tìm). Giữ nguyên quyết định của I03: dùng `.webm` làm bằng chứng "MP4" của PLAT-07/AT-03, vì `FileSystemAssetProvider` xử lý `.mp4`/`.webm` bằng cùng một whitelist, không có nhánh riêng (xem I03 packet mục 4-5 để biết chuỗi xác minh đầy đủ).

### 7. Đích của Q01 chưa tồn tại — xác nhận Q01 thật sự chưa bắt đầu

`ls` xác nhận: **không có** `test/e2e/playwright/specs/demo/` (thư mục), **không có** `test/fixtures/electronics-logic-demo.elpx`. Sạch để bắt đầu từ RED.

## `FILE ĐƯỢC SỬA` (2 file thêm bắt buộc + tối đa 1 helper có điều kiện + packet)

| File | Loại thay đổi |
|---|---|
| `test/fixtures/electronics-logic-demo.elpx` | **Thêm (mới).** Course demo bàn giao — phải sinh ra bằng cách author qua UI thật rồi tải qua `downloadProject()` (mục 2), lưu byte tải về vào đúng đường dẫn này. **Không viết tay XML.** |
| `test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts` | **Thêm (mới).** Demo script tái lập — 6 test tối thiểu, xem "Thiết kế khóa". |
| `test/e2e/playwright/helpers/*.ts` (tên cụ thể phải khai báo trước khi tạo) | **Có điều kiện — nhiều khả năng KHÔNG cần.** Theo mục 2-3 đã xác minh, `downloadProject`/`exportHtml5Website`-cục-bộ đã đủ. Chỉ tạo nếu Gate A (bước 1 dưới) phát hiện một nhu cầu thật cụ thể không thể giải quyết bằng helper có sẵn hoặc bản cục bộ trong spec — nếu vậy, dừng và khai báo tên file trước khi viết, không tự tạo âm thầm. |
| `.ai/packets/Q01-course-e2e.md` | Packet này. |

**KHÔNG ĐƯỢC SỬA:** `src/**`, `public/**`, `scripts/**`, `SPEC.md`, `PLAN.md`, `AGENTS.md`, `Makefile`, `package.json`, `bun.lock`, `translations/**`, `test/fixtures/sample-2.jpg`, `test/fixtures/sample-3.jpg`, `test/fixtures/sample-video-480-900kb.webm`, và `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` (chỉ đọc để tham chiếu mẫu `exportHtml5Website`/`addElectronicsLogicIdevice`/route interception — không sửa, kể cả để "sửa lại thành 7 test").

## `Thiết kế khóa` (chốt trong Q01 — không tự đổi tên, không tự thêm/bớt test ngoài khóa)

**Trình tự bắt buộc (Gate, dừng lại nếu một gate không đạt trong phạm vi hợp lý — báo cáo, không tự vượt gate):**

1. **Gate A — Khai báo (không sửa gì):** xác nhận Task ID/requirement/skill; xác nhận helper dùng cho tải `.elpx` là `downloadProject()` (mục 2) — nếu phát hiện cần khác đi, dừng và báo trước.
2. **Gate B — RED:** viết `electronics-logic-demo.spec.ts` với đủ 6 test dưới đây; `.elpx` đích **chưa tồn tại** ở bước này nên Test 6 phải đỏ vì thiếu file — đúng nghĩa RED. Sau đó chạy lệnh #2 ở `TEST BẮT BUỘC` (spec idevices hiện có) — phải **8 pass, không đổi file đó** (mục 1). Nếu đỏ, dừng, báo root cause, không sửa file đó.
3. **Gate C — GREEN:** lặp cho tới khi spec demo xanh toàn bộ. Chỉ ghi `test/fixtures/electronics-logic-demo.elpx` **sau khi Test 6 xanh** (không commit file rác nửa chừng).
4. **Gate D — Regression toàn diện:** chạy lại toàn bộ lệnh ở `TEST BẮT BUỘC`, dán output thật.
5. **Gate E — Báo cáo:** theo `ĐẦU RA`.

**6 test tối thiểu trong `electronics-logic-demo.spec.ts`** (mỗi test tự tạo project riêng, độc lập, deterministic — không `waitForTimeout` bừa, không `test.describe.configure({ mode: 'serial' })`):

1. **Round-trip tạo course:** project mới → thêm 1 Text (`addTextIdevice`/`addTextIdeviceWithContent` đã có sẵn), 1 ảnh (`sample-2.jpg` hoặc `sample-3.jpg`), 1 video (`sample-video-480-900kb.webm`), 1 Truth Table, 1 Karnaugh, 1 Logic Circuit (half-adder, theo đúng cấu hình half-adder đã dùng ở I01/U03 — 2 input A/B, `Sum = A XOR B`, `Carry = A AND B`) → `saveProject` → `reloadPage`/`gotoWorkarea` lại → verify từng iDevice còn nguyên, lặp ≥10 vòng (PLAT-04 tinh thần round-trip, dùng mẫu I01 nếu có).
2. **AT-05:** làm bài Truth Table — sai 1 ô/expression trước (verify feedback chỉ đúng lỗi, không chấm sai lan sang ô đúng) → sửa đúng → chấm pass.
3. **AT-06:** làm bài Karnaugh 4 biến có don't-care, overlap và wrap — theo đúng cấu hình đã chứng minh ở `idevices/electronics-logic.spec.ts` dòng 220/279 (đọc tham chiếu số liệu, không phát minh bài mới).
4. **AT-07:** half-adder đúng 4/4 → sau đó tháo 1 dây → verify test thất bại đúng cách (không crash, không điểm giả — theo mẫu dòng 401 của file tham chiếu).
5. **AT-09/EXP-02/EXP-03:** export HTML offline qua bản cục bộ `exportHtml5Website` (mục 3) + phục vụ qua `page.route()` (mục 4, origin tổng hợp, 404 cho request lệch) → hoàn thành TT/K-map/half-adder trên trang offline → giải nén ZIP đã tải và quét **toàn bộ** entry không chứa `.agents`/`.claude`/`.ai`/token-shaped string/path tuyệt đối/stack trace (cùng tinh thần audit của I03, có thể tái dùng cùng danh sách forbidden pattern — đọc `test/integration/html5-export-fixture.spec.ts` describe `EXP-03/SKILL-11...` làm tham chiếu logic, không import chéo integration↔e2e).
6. **PLAT-07 — download & round-trip `.elpx`:** sau khi Test 1-5 xanh trên cùng một course, dùng `downloadProject()` (mục 2) tải `.elpx`, lưu vào `test/fixtures/electronics-logic-demo.elpx`, mở lại (`openElpFile` đã có sẵn) và verify đầy đủ text + ảnh + video + TT + K-map + half-adder còn nguyên.

## `KHÔNG LÀM`

- Không sửa engine/grader/edition/export/iDevice runtime nào — tất cả đã xanh (E/K/T/U/I), Q01 chỉ dùng lại qua UI thật.
- Không thêm iDevice, mode, tính năng, nút, dependency mới.
- Không viết tay nội dung `.elpx` (XML/JSON bên trong) — bắt buộc author qua UI rồi tải qua Playwright.
- Không tạo file media mới (ảnh/video) — dùng đúng 3 fixture đã có ở mục 6.
- Không tạo `.mp4` giả — theo đúng quyết định đã khóa của I03 (mục 6), dùng `.webm`.
- Không chạy full E2E suite toàn repo làm điều kiện đóng task (tốn giờ, ~22 phút theo lần chạy gần nhất) — chỉ chạy 2 spec ở `TEST BẮT BUỘC` #1-2. Nếu nghi ngờ regression ở file khác, báo cáo, đừng tự chạy toàn bộ.
- Không tạo helper `exportHtml5Website` dùng chung — giữ nguyên tiền lệ định nghĩa cục bộ mỗi spec (mục 3), tránh đụng 4 file ngoài phạm vi.
- Không sửa `idevices/electronics-logic.spec.ts` dù chỉ để "sửa lại đúng 7 test" — con số đúng bây giờ là 8 (mục 1), không phải regression.
- Không chạy `make translations`, không ghi key i18n mới.
- Không nâng cấp/đổi dependency.
- Không dùng `eval`/`Function` cho Boolean input (kế thừa ràng buộc toàn cục AGENTS.md §13, nhắc lại vì Q01 chạm nhiều luồng authoring).
- Không `.skip`/`.todo` bất kỳ test nào. Không tự ý mở rộng sang Q02.
- Không tự tuyên bố gate nào đóng — Q01 không có gate riêng.

## `ACCEPTANCE` (quan sát được)

1. Lệnh #1 (`TEST BẮT BUỘC`): demo spec RED (Gate B) → GREEN (Gate C), toàn bộ 6 test pass, không `.skip`/`.todo`.
2. Lệnh #2: `idevices/electronics-logic.spec.ts` → **8 pass**, không đổi file (xanh nguyên trạng theo số liệu đã xác minh ở mục 1 — không phải 7).
3. Lệnh #3-4, #6: regression 0 fail.
4. Lệnh #5: biome sạch trên mọi file mới/sửa.
5. `test/fixtures/electronics-logic-demo.elpx` tồn tại, mở lại được, chứa đủ text + ảnh + video + TT + K-map + half-adder, round-trip ≥10 vòng không mất dữ liệu.
6. Export HTML offline của course demo không chứa `.agents`, `.claude`, `.ai`, token-shaped string, path tuyệt đối hay stack trace (AT-09/EXP-03), quét toàn bộ entry chứ không chỉ 4 entry iDevice.
7. Không file nào ngoài `FILE ĐƯỢC SỬA` bị sửa (đối chiếu `git status --porcelain` đầy đủ, không pathspec, với baseline đã biết).
8. Một người khác chạy lại đúng lệnh #1 từ đầu là dựng lại được toàn bộ course từ project rỗng (demo script tự tái lập, không phụ thuộc state để lại từ lần chạy trước).

## `TEST BẮT BUỘC`

Trên Windows PowerShell, đặt env trước khi chạy (kế thừa từ bản handoff cũ, đã đúng cho môi trường này):

```powershell
$env:BASE_PATH=""; $env:DB_PATH=":memory:"; $env:ELYSIA_FILES_DIR="$env:TEMP\exelearning-test"
$BUN = "$env:LOCALAPPDATA\Microsoft\WinGet\Links\bun"
```

| # | Lệnh | Kết quả mong đợi |
|---|------|------------------|
| 1 | `npx playwright test demo/electronics-logic-demo.spec.ts --project=chromium` | RED (Gate B) → GREEN (Gate C), 6/6 test pass |
| 2 | `npx playwright test idevices/electronics-logic.spec.ts --project=chromium` | **8 pass**, KHÔNG đổi behavior/file (xem mục 1 — không phải 7) |
| 3 | `& $BUN test ./src/shared/export` | 0 fail (regression export — I02/I03) |
| 4 | `& $BUN x vitest run public/files/perm/idevices/base/electronics-logic/` | 0 fail (regression iDevice) |
| 5 | `& $BUN x biome check` trên mọi file `.ts`/`.js` mới/sửa (spec demo + helper mới nếu có) | no errors |
| 6 | `& $BUN test ./src ./test/helpers ./scripts ./app --coverage` | 0 fail (regression backend — Q01 không thêm production code nên không có patch coverage riêng để đo, chỉ cần 0 fail) |

## `ĐẦU RA` (bắt buộc ghi trong báo cáo cuối)

1. **Diff:** danh sách file đã thêm/sửa (đúng trong `FILE ĐƯỢC SỬA`) + tóm tắt thay đổi. Kèm `git status --porcelain` đầy đủ không pathspec (đối chiếu baseline).
2. **Test result:** output thật của lệnh 1-6 (dán nguyên văn).
3. **Red→Green:** kết quả đỏ trước và xanh sau cho spec demo (Gate B → Gate C).
4. **Regression:** xác nhận lệnh 2-4, 6 xanh, đặc biệt lệnh 2 ra đúng 8 (không phải 7).
5. **Course demo:** kết quả round-trip ≥10 vòng + nội dung `.elpx` (danh sách iDevice bên trong, xác nhận đủ text/ảnh/video/TT/K-map/half-adder).
6. **Rủi ro còn lại:** mô tả trung thực những gì chưa được phủ.
7. **Bước tiếp theo đề xuất:** 1 câu gợi ý Q02 (Regression/security, `PLAN.md` dòng 183) — không tự ý thực hiện.
8. Trạng thái: Q01 **không đóng gate nào** — chỉ là bằng chứng hoàn thành, bước tiến tới `G-R0`. Dừng lại, chờ PM/tester xác minh độc lập trước khi chạm Q02.

## Nếu bị kẹt

- Không đoán: nếu không chắc đường dẫn, luồng save/open, hay cách tải `.elpx` — đọc code trước (helper đã liệt kê ở mục 2-5), nếu vẫn không rõ thì dừng và hỏi, đừng sửa bừa.
- Không vượt gate: test đỏ không tự xanh trong phạm vi hợp lý → dừng ở gate hiện tại, báo cáo, không chuyển gate sau.
- Không tự ý mở rộng phạm vi sang Q02.
