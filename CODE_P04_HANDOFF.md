# HANDSOFF PROMPT — CODEX (AI WRITER DUY NHẤT)

> Prompt này là **toàn bộ nhiệm vụ của bạn**. Đọc kỹ trước khi sửa bất kỳ file nào.
> Bạn là Codex — **AI writer duy nhất** được phép sửa worktree của Solo Logic Alpha.
> Mọi câu khẳng định "đã xong" đều phải kèm output lệnh chạy thực tế. Không tin lời khẳng định không có bằng chứng.

---

## 0. RÀNG BUỘC TOÀN CỤC (không được vi phạm)

1. **Không được sửa file ngoài danh sách `FILE ĐƯỢC SỬA`** dưới đây, trừ khi có lệnh mới của người phát triển.
2. **Không được chạy `make translations`**, không sửa bất kỳ file nào trong `translations/`.
3. **Không được đưa `.agents`, `.claude`, `.ai`, tài liệu AI-development vào HTML hoặc SCORM output.**
4. **Không dùng `eval` hoặc `Function`** cho đầu vào Boolean.
5. **Không bỏ qua / `.skip` / `.todo`** test nào. Nếu không test được thì dừng và hỏi.
6. **Không mở rộng phạm vi ngoài P0 và Task Packet P04** này.
7. Trước khi sửa code: đọc `SPEC.md` (toàn bộ) và phần P04/§5.2 của `PLAN.md`.
8. Nếu gặp lỗi/hành vi không mong đợi: dùng quy trình `systematic-debugging` để tìm root cause TRƯỚC, rồi mới sửa.
9. Mỗi thay đổi phải bắt đầu bằng khai báo: `TASK P04`, danh sách requirement ID, skill đã kích hoạt.
10. Chạy `make fix` (hoặc các lệnh lint tương đương trên Windows) SAU MỌI thay đổi code.

---

## 1. TASK PACKET

```
TASK:     P04 — Schema/lifecycle skeleton
SPEC:     PLAT-03, PLAT-04, PLAT-05, PLAT-06 (và chỉ các requirement này)
SKILLS:   exelearning-logic-alpha, test-driven-development, idevice, e2e-test
MỤC TIÊU: schemaVersion:1 được áp dụng nhất quán, validator chặn dữ liệu sai,
          fixture schema 0 → 1 migrate không mất dữ liệu, và smoke save/open/export xanh.
KHOÁN:    KHÔNG viết UI feature ngoài placeholder/schema.
```

### 1.1 Requirement ID cụ thể (lấy từ SPEC.md — đọc lại nếu cần):

| ID | Nội dung yêu cầu | Trạng thái hiện tại |
|----|------------------|---------------------|
| PLAT-03 | Editor, preview và HTML export dùng cùng `schemaVersion: 1` | Core/edition đã dùng `1` (boolean-core.js:567, edition:7); **cần verify export cùng schema** |
| PLAT-04 | Save → close → reopen giữ JSON chuẩn hóa trong 10 vòng | **CHƯA có test** |
| PLAT-05 | Fixture schema 0 migrate sang 1 không mất dữ liệu | **CHƯA có** — chỉ có `fixtures/schema-v0.json` |
| PLAT-06 | Dữ liệu sai hiển thị lỗi tiếng Việt và không crash | Validator + thông báo lỗi đã có mảnh ghép (edition:21) nhưng **CHƯA có validator module hoàn chỉnh** |

---

## 2. HIỆN TRẠNG ĐÃ VERIFY (không phải giả định)

Đã được xác minh bằng lệnh chạy thực tế (ngày 2026-08-12, Windows 11, Bun 1.3.x):

- Full suite backend: `bun test ./src ./test/helpers ./scripts ./app --coverage` → **8012 pass / 0 fail**
- Coverage gate: `check-coverage.ts < ...` → **"All 449 files meet the 90% coverage threshold"** (exit 0)
- Boolean Core: `boolean-core.test.js` → **134 pass**
- Grader: `boolean-grader.test.js` → **14 pass**
- Edition: `electronics-logic.test.js` → **13 pass**
- Export: `electronics-logic.test.js` + `electronics-logic-grader.test.js` → **16 pass**

Cấu trúc iDevice đã có:

```
public/files/perm/idevices/base/electronics-logic/
├── config.xml                    (version 0.1.0, component-type json)
├── core/
│   ├── boolean-core.js           (schemaVersion: 1, dòng 567)
│   ├── boolean-core.test.js      (134 pass)
│   ├── boolean-core-contract.js  (fixtureSchemaVersion: 1)
│   ├── boolean-grader.js
│   ├── boolean-grader.test.js    (14 pass)
│   └── fixtures/boolean-syntax-v1.json
├── edition/
│   ├── electronics-logic.js      (schemaVersion: 1, dòng 7)
│   └── electronics-logic.test.js (13 pass)
├── export/
│   ├── electronics-logic.html
│   ├── electronics-logic.js
│   ├── electronics-logic-grader.bundle.js
│   └── ... (16 pass)
└── fixtures/
    └── schema-v0.json            (schemaVersion: 0 — LÀ ĐẦU VÀO CHO PLAT-05)
```

---

## 3. FILE ĐƯỢC SỬA (chỉ được phép sửa những file này — thêm file mới phải khai báo)

Danh sách sau là **toàn bộ** các file được phép chạm tới. File nằm ngoài danh sách: không sửa, không tạo, không xóa. File mới phải được khai báo trước trong câu trả lời và nằm trong thư mục iDevice này.

```
public/files/perm/idevices/base/electronics-logic/
├── core/boolean-core.js                       (chỉ nếu cần helper migrate — tối thiểu)
├── core/boolean-core.test.js                  (thêm test cho migration)
├── core/boolean-core-contract.js              (chỉ nếu cần khai báo schema lifecycle)
├── core/schema-lifecycle.js                   [FILE MỚI — validator + migrate, module thuần]
├── core/schema-lifecycle.test.js              [FILE MỚI — colocated vitest]
├── edition/electronics-logic.js               (nối validator vào load/save)
├── edition/electronics-logic.test.js          (thêm test invalid-data + round-trip)
├── fixtures/schema-v0.json                    (KHÔNG sửa — là dữ liệu đầu vào)
├── fixtures/schema-v1.json                    [FILE MỚI — fixture chuẩn hóa v1]
└── fixtures/schema-v0-migrated.json           [FILE MỚI — kết quả migrate mong đợi]
```

**KHÔNG ĐƯỢC SỬA:** `config.xml`, `export/*` (chỉ đọc để hiểu luồng), `boolean-grader.js` (chỉ đọc), bất kỳ file nào ngoài cây trên, `translations/**`, `SPEC.md`, `PLAN.md`, `AGENTS.md`, `Makefile`.

---

## 4. KHÔNG LÀM (explicit exclusions)

- Không thêm UI chọn mode mới, không thêm pan/zoom/auto-layout, không thêm iDevice mới.
- Không đổi `schemaVersion` hiện tại của Core/edition ra khỏi `1`.
- Không refactor `boolean-core.js` / `boolean-grader.js` ngoài mục đích migrate.
- Không chạy `make translations`, không ghi key mới.
- Không nâng cấp/đổi dependency.
- Không sửa code eXeLearning core (`src/**`) — task này nằm hoàn toàn trong iDevice.
- Không để migration phá dữ liệu: mọi trường không biết phải được giữ nguyên hoặc có policy rõ ràng.

---

## 5. QUY TRÌNH THỰC HIỆN (tuần tự, dừng ở mỗi gate)

### Gate A — Đọc và khai báo (không sửa gì)
1. Đọc toàn bộ `SPEC.md`, phần §5.2 của `PLAN.md`, và các file trong `core/` + `edition/` + `fixtures/`.
2. Trả lời: xác nhận Task ID, requirement ID, skill kích hoạt, và **kế hoạch test đầu tiên (RED)** cho validator + migrate.

### Gate B — TDD: validator + migrate (Red → Green)
3. **RED:** viết `core/schema-lifecycle.test.js` trước, gồm ít nhất:
   - `migrateSchemaV0ToV1(v0)`: `schema-v0.json` → khớp `schema-v0-migrated.json` (không mất trường `answer`, `learner`, `accessibility`…).
   - `validate(activity)`:
     - activity thiếu `schemaVersion` → lỗi.
     - `schemaVersion` không phải `1` → lỗi (trước khi migrate; sau migrate không còn lỗi này).
     - `variables` > 4 → lỗi.
     - `mode` không thuộc `truthTable|booleanExpression|karnaugh|circuit` → lỗi.
     - `answer.outputs` độ dài không bằng `2^variables` → lỗi.
     - mọi lỗi trả về **thông báo tiếng Việt** (cùng chuỗi hoặc có prefix giống edition:21).
   - Chạy lệnh → test **đỏ** (chưa có implementation).
4. **GREEN:** viết `core/schema-lifecycle.js` (module thuần, không DOM/Electron) cho đủ test xanh.
5. Chạy lại test → **xanh**; chạy `make fix` tương đương (biome check `--write` lên file mới).

### Gate C — Nối vào edition lifecycle
6. Trong `edition/electronics-logic.js`: tại điểm nhận dữ liệu (load/import), gọi `validate()`; nếu lỗi → hiển thị lỗi tiếng Việt đã có sẵn (không crash). Tại điểm save, gọi `migrateSchemaV0ToV1` nếu gặp dữ liệu v0.
7. Thêm test vào `edition/electronics-logic.test.js`:
   - Dữ liệu sai → hiển thị lỗi, không crash.
   - Save → close → reopen **10 vòng** giữ JSON chuẩn hóa (PLAT-04).
   - Chạy test → xanh.

### Gate D — Fixture migrate (PLAT-05)
8. Tạo `fixtures/schema-v0-migrated.json` = output mong đợi khi migrate `schema-v0.json`.
9. Test đối chiếu khớp chính xác (deep equal). Xanh.

### Gate E — Verify toàn diện + báo cáo
10. Chạy lại tất cả lệnh dưới đây và dán output.

---

## 6. TEST COMMANDS BẮT BUỘC (chạy và dán output thật)

Trên Windows PowerShell, đặt env trước khi chạy:

```powershell
$env:BASE_PATH=""; $env:DB_PATH=":memory:"; $env:ELYSIA_FILES_DIR="$env:TEMP\exelearning-test"
$BUN = "$env:LOCALAPPDATA\Microsoft\WinGet\Links\bun"
```

| # | Lệnh | Kết quả mong đợi |
|---|------|------------------|
| 1 | `& $BUN x vitest run public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.test.js` | all pass |
| 2 | `& $BUN x vitest run public/files/perm/idevices/base/electronics-logic/core/boolean-core.test.js public/files/perm/idevices/base/electronics-logic/core/boolean-grader.test.js` | 134 + 14 pass |
| 3 | `& $BUN x vitest run public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.test.js` | 13 + test mới pass |
| 4 | `& $BUN x vitest run public/files/perm/idevices/base/electronics-logic/export/` | 16 pass, KHÔNG đổi behavior |
| 5 | `& $BUN x biome check --write public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.js public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.test.js public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.js public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.test.js` | no errors |
| 6 | `& $BUN test ./src ./test/helpers ./scripts ./app --coverage` | 0 fail (regression) |
| 7 | `Get-Content "$env:TEMP\exe-coverage.txt" -Raw | & $BUN run scripts/check-coverage.ts` | "All ... meet the 90% coverage threshold", exit 0 |

> Ghi chú lệnh 7: file `%TEMP%\exe-coverage.txt` là kết quả lệnh 6 (đã có trong thư mục temp; nếu thiếu, tự chạy lệnh 6 redirect vào file rồi chạy gate).

---

## 7. ĐỊNH NGHĨA HOÀN THÀNH (Definition of Done — tất cả phải xanh)

- [ ] Lệnh 1–4: tất cả pass (không test `.skip`/`.todo`).
- [ ] Lệnh 5: biome sạch (0 error trên 4 file).
- [ ] Lệnh 6: full suite backend 0 fail (không regression).
- [ ] Lệnh 7: coverage gate xanh (exit 0).
- [ ] Mọi file `.js` mới trong iDevice đều có colocated `*.test.js` (vitest).
- [ ] Không file nào ngoài danh sách §3 bị sửa.
- [ ] Patch coverage ≥ 90% trên các dòng mới/thay đổi (kiểm tra bằng coverage report của lệnh 6 + diff).
- [ ] Lỗi validator hiển thị bằng tiếng Việt (PLAT-06), không crash.
- [ ] Round-trip 10 vòng giữ JSON chuẩn hóa (PLAT-04).
- [ ] `schema-v0.json` → migrate → khớp `schema-v0-migrated.json` (PLAT-05).

---

## 8. ĐẦU RA (bắt buộc ghi trong báo cáo cuối)

1. **Diff:** danh sách file đã thêm/sửa (đúng trong §3) + tóm tắt thay đổi.
2. **Test result:** output thật của lệnh 1–7 (dán nguyên văn, không tóm tắt bằng lời).
3. **Red→Green:** với từng test mới, ghi kết quả đỏ trước và xanh sau.
4. **Regression:** xác nhận lệnh 6/7 xanh.
5. **Rủi ro còn lại:** mô tả trung thực những gì chưa được phủ (ví dụ: nhánh export chưa có test migration nếu chưa đạt).
6. **Bước tiếp theo đề xuất:** 1 câu gợi ý task tiếp theo (T01 hoặc C02/C03), KHÔNG tự ý thực hiện.

---

## 9. NẾU BỊ KẸT

- Không đoán: nếu không chắc đường dẫn file, luồng save/open, hay vị trí gọi validator trong edition — **đọc code trước**, nếu vẫn không rõ thì dừng và hỏi, đừng sửa bừa.
- Không vượt gate: nếu test đỏ không tự xanh trong phạm vi hợp lý, dừng ở gate hiện tại, báo cáo, không chuyển sang gate sau.
- Không tự ý mở rộng phạm vi sang task khác.
