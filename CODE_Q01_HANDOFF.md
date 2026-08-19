> **SUPERSEDED — 2026-08-18 (PM/Tester).** File này chỉ định "Gemini (AI writer duy nhất)", mâu thuẫn với `AGENTS.md` §13.4 (Codex là sole AI writer cho Solo Logic Alpha). Người dùng xác nhận trực tiếp đây là nhầm lẫn: "sự nhầm lẫn thôi, toàn bộ codex viết hết". Nội dung dưới đây **không còn dùng để lấy chỉ thị** — đã được kiểm chứng lại, sửa 2 điểm sai (số test regression 7→8; xác nhận không cần helper `.elpx` mới) và thay thế hoàn toàn bởi **`.ai/packets/Q01-course-e2e.md`**, nhắm vào Codex. Giữ file này lại chỉ để tham khảo lịch sử — không sửa/xóa nội dung gốc bên dưới, không dùng làm nguồn chỉ thị cho bất kỳ AI writer nào.

---

# HANDSOFF PROMPT — GEMINI (AI WRITER DUY NHẤT) — Q01: Course E2E (ĐÃ SUPERSEDED, xem banner trên)

> Prompt này là **toàn bộ nhiệm vụ của bạn**. Đọc kỹ trước khi sửa bất kỳ file nào.
> Bạn là Gemini — **AI writer duy nhất** được phép sửa worktree của Solo Logic Alpha.
> Mọi câu khẳng định "đã xong" đều phải kèm output lệnh chạy thực tế. Không tin lời khẳng định không có bằng chứng.

---

## 0. RÀNG BUỘC TOÀN CỤC (không được vi phạm)

1. **Không được sửa file ngoài danh sách `FILE ĐƯỢC SỬA`** dưới đây, trừ khi có lệnh mới của người phát triển.
2. **Không được chạy `make translations`**, không sửa bất kỳ file nào trong `translations/`.
3. **Không được đưa `.agents`, `.claude`, `.ai`, tài liệu AI-development vào HTML hoặc SCORM output.**
4. **Không dùng `eval` hoặc `Function`** cho đầu vào Boolean.
5. **Không bỏ qua / `.skip` / `.todo`** test nào. Nếu không test được thì dừng và hỏi.
6. **Không mở rộng phạm vi ngoài P0 và Task Packet Q01** này.
7. Trước khi sửa code: đọc `SPEC.md` (toàn bộ) và phần §5.9 + §8 của `PLAN.md`.
8. Nếu gặp lỗi/hành vi không mong đợi: dùng quy trình `systematic-debugging` để tìm root cause TRƯỚC, rồi mới sửa.
9. Mỗi thay đổi phải bắt đầu bằng khai báo: `TASK Q01`, danh sách requirement ID, skill đã kích hoạt.
10. Chạy `make fix` (hoặc lệnh lint tương đương trên Windows) SAU MỖI thay đổi code.

---

## 1. TASK PACKET

```
TASK:     Q01 — Course E2E
SPEC:     PLAT-07, AT-03, AT-05, AT-06, AT-07, AT-09, EXP-02, EXP-03 (và chỉ các requirement này)
SKILLS:   exelearning-logic-alpha, e2e-test, test-driven-development
MỤC TIÊU: Tạo một course demo `.elpx` chứa đầy đủ: text, media (ảnh + video), Truth Table,
          Karnaugh và half-adder (Logic Circuit); kèm demo script tái lập chạy lại được
          toàn bộ hành trình "soạn → làm → chấm → lưu/mở → HTML offline".
KHÓA:     KHÔNG sửa bất kỳ file nào trong `src/**`, `public/app/**`,
          `public/files/perm/idevices/**`, `scripts/**`, `SPEC.md`, `PLAN.md`,
          `AGENTS.md`, `Makefile`, `package.json`, `bun.lock`, `translations/**`.
```

### 1.1 Requirement ID cụ thể (lấy từ SPEC.md — đọc lại nếu cần):

| ID | Nội dung yêu cầu | Trạng thái hiện tại |
|----|------------------|---------------------|
| PLAT-07 | Text, ảnh và MP4 course mẫu hiển thị khi ngắt mạng | Đã có fixture media (`sample-2.jpg`, `sample-3.jpg`, `sample-video-480-900kb.webm`); **chưa có course demo `.elpx` hợp nhất tất cả** |
| AT-03 | Text, ảnh, MP4 và iDevice hiển thị khi ngắt mạng | Chưa có course demo tổng hợp |
| AT-05 | Truth table: sai một ô/expression; feedback chỉ đúng lỗi | Đã được chứng minh ở e2e `electronics-logic.spec.ts` (test dòng 141) |
| AT-06 | K-map: bài bốn biến có don't-care, overlap và wrap chấm đúng | Đã chứng minh (test dòng 220, 279) |
| AT-07 | Half-adder đúng 4/4; tháo dây làm test thất bại | Đã chứng minh (test dòng 317, 401) |
| AT-09 | Hoàn thành AT-05…AT-07 không mạng; không dùng gói thư mục AI | Đã chứng minh (test dòng 596, offline export I02); I03 audit đã xanh |
| EXP-02 | Ngắt mạng vẫn hoàn thành TT, K-map và half-adder | Đã chứng minh ở I02 |
| EXP-03 | Export không chứa `.agents`, `.claude`, `.ai`, token, path tuyệt đối hoặc stack trace | I03 đã hoàn thành và được PM xác minh độc lập |

**Bản chất công việc Q01:** không phải xây lại iDevice — iDevice đã đủ P0 và e2e đã cover từng loại. Q01 là **hợp nhất thành một course demo thật** + **demo script tái lập**, đúng DoD `PLAN.md:182`: *"Một `.elpx` chứa text, media, TT, K-map và half-adder; demo script tái lập."*

---

## 2. HIỆN TRẠNG ĐÃ VERIFY (không phải giả định) — do PM/tester chạy thực tế

- E2E spec hiện có: `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` (742 dòng) — 7 test đã cover: TT authoring, K-map editing/grading, invalid K-map, half-adder grading, structural error, boolean expression, 10-vòng round-trip, offline export (I02/AT-09).
- Playwright config: `playwright.config.ts` ở project root; `testDir = ./test/e2e/playwright/specs`; projects `chromium` (dynamic :3001), `firefox`, `static` (:3002). Server tự khởi động qua `webServer` (`bun src/index.ts`).
- Helpers có sẵn: `test/e2e/playwright/helpers/workarea-helpers.ts` — `addIdevice`, `expandIdeviceCategory`, `getPreviewFrame`, `gotoWorkarea`, `openPreviewPanel`, `reloadPage`, `saveIdevice`, `saveProject`, `selectFirstPage`, `waitForAppReady`, `waitForPreviewContent`; fixture `test/e2e/playwright/fixtures/auth.fixture.ts` (project `chromium`/`firefox`/`static`).
- Media mẫu có sẵn: `test/fixtures/sample-2.jpg`, `test/fixtures/sample-3.jpg`, `test/fixtures/sample-video-480-900kb.webm` (webm thay MP4, đã được I03 dùng; không tạo file media mới).
- Cách export/giải nén HTML5: spec hiện có dùng `exportHtml5Website()` (waitForEvent download) + `unzipSync` từ `src/shared/export`.
- I03 (Asset/secret audit) đã xanh, được PM xác minh độc lập — Q01 được mở khóa.

---

## 3. FILE ĐƯỢC SỬA (chỉ được phép sửa những file này — thêm file mới phải khai báo)

Danh sách sau là **toàn bộ** các file được phép chạm tới. File nằm ngoài danh sách: không sửa, không tạo, không xóa. File mới phải được khai báo trước trong câu trả lời.

```
test/fixtures/electronics-logic-demo.elpx                 [FILE MỚI — course demo bàn giao]
test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts   [FILE MỚI — demo script tái lập]
```

- `test/fixtures/electronics-logic-demo.elpx`: course mẫu bàn giao (SPEC §12.5) — phải tạo được bằng cách **author qua UI rồi lưu/download qua Playwright**, KHÔNG viết tay XML. Chứa tối thiểu: 1 Text, 1 media ảnh, 1 media video (webm mẫu), 1 Truth Table, 1 Karnaugh, 1 Logic Circuit (half-adder).
- `test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts`: demo script tái lập — chạy lại từ đầu tạo đúng course trên, làm bài, chấm, lưu/mở 10 vòng, export HTML offline và verify. Nếu cần helper mới (ví dụ download `.elpx`), được phép **khai báo thêm 1 file helper** nằm trong `test/e2e/playwright/helpers/`.

**KHÔNG ĐƯỢC SỬA:** `src/**`, `public/**`, `scripts/**`, `SPEC.md`, `PLAN.md`, `AGENTS.md`, `Makefile`, `package.json`, `bun.lock`, `translations/**`, `test/fixtures/sample-*.jpg`, `test/fixtures/sample-video-480-900kb.webm`, và `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` (chỉ đọc để tham chiếu helper).

---

## 4. KHÔNG LÀM (explicit exclusions)

- Không sửa engine/grader/edition/export iDevice — tất cả đã xanh, Q01 chỉ dùng lại.
- Không thêm iDevice, mode, tính năng, nút, dependency mới.
- Không viết tay nội dung `.elpx` (XML) — phải author qua UI.
- Không tạo file media mới (ảnh/video) — dùng fixture có sẵn.
- Không chạy full E2E suite toàn repo làm điều kiện đóng task (tốn giờ); chỉ chạy 2 file spec trong §6. Nếu bạn nghi ngờ regression ở file khác, báo cáo — đừng tự chạy toàn bộ.
- Không chạy `make translations`, không ghi key i18n mới.
- Không nâng cấp/đổi dependency.
- Không dùng `test.describe.configure({ mode: 'serial' })` hay thủ thuật tạo sự phụ thuộc thứ tự giữa các test — mỗi test phải độc lập và tự tái lập.

---

## 5. QUY TRÌNH THỰC HIỆN (tuần tự, dừng ở mỗi gate)

### Gate A — Đọc và khai báo (không sửa gì)
1. Đọc toàn bộ `SPEC.md`, phần §5.9 + §8 + §12 của `PLAN.md`, và `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` + `test/e2e/playwright/helpers/workarea-helpers.ts` + `test/e2e/playwright/fixtures/auth.fixture.ts` + `playwright.config.ts`.
2. Trả lời: xác nhận Task ID, requirement ID, skill kích hoạt, và **kế hoạch test đầu tiên (RED)** cho demo spec. Xác định rõ cách download `.elpx` qua Playwright (helper nào dùng, cần thêm helper gì — khai báo trước).

### Gate B — RED: viết demo spec trước (không có implementation mới để test, nên RED nghĩa là spec chưa tồn tại và chạy báo không tìm thấy test)
3. Viết `test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts` trước, gồm ít nhất:
   - Test 1: tạo project mới, thêm 1 Text, 1 ảnh, 1 video (webm), 1 Truth Table, 1 Karnaugh, 1 Logic Circuit; save → reload → verify từng iDevice còn nguyên (round-trip ≥ 10 vòng theo PLAT-04).
   - Test 2: làm bài Truth Table (sai 1 ô → feedback đúng lỗi; sửa đúng → chấm pass) — AT-05.
   - Test 3: làm bài Karnaugh bốn biến có don't-care/overlap/wrap — AT-06.
   - Test 4: làm half-adder đúng 4/4; sau đó tháo dây → test thất bại — AT-07.
   - Test 5: export HTML offline, serve qua `page.route()` (không mạng), hoàn thành TT/K-map/half-adder; giải nén ZIP và kiểm tra KHÔNG chứa `.agents`, `.claude`, `.ai`, token, path tuyệt đối — AT-09 + EXP-03.
   - Test 6: download `.elpx` sau khi author, lưu `test/fixtures/electronics-logic-demo.elpx`, mở lại và verify dữ liệu đầy đủ (PLAT-07).
   - Không `.skip`/`.todo`. Mỗi test độc lập (tự tạo project riêng) và deterministic — không `waitForTimeout` bừa.
   - Chạy lệnh 1 trong §6 → **đỏ** (spec chưa tồn tại hoặc chưa pass).
4. Chạy lệnh 2 trong §6 (spec idevices hiện có) → phải **xanh nguyên trạng** (7 pass). Nếu đỏ, dừng và báo cáo, đừng sửa file đó.

### Gate C — GREEN: hoàn thiện spec + tạo course demo
5. Chạy spec demo lặp cho tới khi xanh toàn bộ. Lưu `.elpx` sinh ra vào `test/fixtures/electronics-logic-demo.elpx` **chỉ khi Test 6 xanh**.
6. Verify `electronics-logic-demo.elpx` được mở lại và round-trip 10 vòng không đổi (đã nằm trong Test 6). Chạy `make fix` tương đương (biome check `--write` lên file mới).

### Gate D — Verify toàn diện + regression
7. Chạy lại tất cả lệnh trong §6 và dán output thật.

### Gate E — Báo cáo
8. Ghi báo cáo theo §8.

---

## 6. TEST COMMANDS BẮT BUỘC (chạy và dán output thật)

Trên Windows PowerShell, đặt env trước khi chạy:

```powershell
$env:BASE_PATH=""; $env:DB_PATH=":memory:"; $env:ELYSIA_FILES_DIR="$env:TEMP\exelearning-test"
$BUN = "$env:LOCALAPPDATA\Microsoft\WinGet\Links\bun"
```

| # | Lệnh | Kết quả mong đợi |
|---|------|------------------|
| 1 | `npx playwright test demo/electronics-logic-demo.spec.ts --project=chromium` | RED (Gate B) → GREEN (Gate C), toàn bộ test trong spec pass |
| 2 | `npx playwright test idevices/electronics-logic.spec.ts --project=chromium` | 7 pass, KHÔNG đổi behavior (regression) |
| 3 | `& $BUN test ./src/shared/export` | 0 fail (regression export — I02/I03) |
| 4 | `& $BUN x vitest run public/files/perm/idevices/base/electronics-logic/` | 0 fail (regression iDevice) |
| 5 | `& $BUN x biome check test/fixtures` — hoặc biome check các file `.ts`/`.js` mới nếu có helper mới | no errors |
| 6 | `& $BUN test ./src ./test/helpers ./scripts ./app --coverage` | 0 fail (regression backend) |

> Ghi chú lệnh 2: bắt buộc xanh nguyên trạng. File này là tham chiếu — nếu nó đỏ thì dừng ở Gate B, báo cáo root cause, KHÔNG sửa file đó.

---

## 7. ĐỊNH NGHĨA HOÀN THÀNH (Definition of Done — tất cả phải xanh)

- [ ] Lệnh 1: demo spec xanh (không `.skip`/`.todo`).
- [ ] Lệnh 2: spec idevices xanh nguyên trạng (7 pass, không đổi file).
- [ ] Lệnh 3–4, 6: regression 0 fail.
- [ ] Lệnh 5: biome sạch.
- [ ] `test/fixtures/electronics-logic-demo.elpx` tồn tại, mở lại được, chứa text + ảnh + video + TT + K-map + half-adder, round-trip 10 vòng (PLAT-07/AT-03).
- [ ] Không file nào ngoài danh sách §3 (và helper mới đã khai báo) bị sửa.
- [ ] Export HTML offline của course demo không chứa `.agents`, `.claude`, `.ai`, token, path tuyệt đối (AT-09/EXP-03).
- [ ] Demo script tái lập: một người khác chạy lại `npx playwright test demo/electronics-logic-demo.spec.ts --project=chromium` là dựng lại được đủ course từ đầu.

---

## 8. ĐẦU RA (bắt buộc ghi trong báo cáo cuối)

1. **Diff:** danh sách file đã thêm/sửa (đúng trong §3) + tóm tắt thay đổi.
2. **Test result:** output thật của lệnh 1–6 (dán nguyên văn, không tóm tắt bằng lời).
3. **Red→Green:** ghi kết quả đỏ trước và xanh sau của từng test mới.
4. **Regression:** xác nhận lệnh 2–4, 6 xanh.
5. **Course demo:** kết quả round-trip 10 vòng + nội dung `.elpx` (danh sách iDevice bên trong, xác nhận đủ text/media/TT/K-map/half-adder).
6. **Rủi ro còn lại:** mô tả trung thực những gì chưa được phủ.
7. **Bước tiếp theo đề xuất:** 1 câu gợi ý task tiếp theo (Q02 — Regression/security), KHÔNG tự ý thực hiện.

---

## 9. NẾU BỊ KẸT

- Không đoán: nếu không chắc đường dẫn file, luồng save/open, hay cách download `.elpx` qua Playwright — **đọc code trước** (helpers hiện có), nếu vẫn không rõ thì dừng và hỏi, đừng sửa bừa.
- Không vượt gate: nếu test đỏ không tự xanh trong phạm vi hợp lý, dừng ở gate hiện tại, báo cáo, không chuyển sang gate sau.
- Không tự ý mở rộng phạm vi sang task khác.
