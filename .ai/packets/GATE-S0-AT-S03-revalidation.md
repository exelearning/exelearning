# Task Packet — Gate G-S0 revalidation: AT-S03 dry-run for the current writer (Nemotron 3 Ultra)

- `TASK`: AT-S03 revalidation for the writer currently assigned under `AGENTS.md` §13.4 (Nemotron 3 Ultra). **Not a `PLAN.md` row** — `PLAN.md`'s S01-S05 table (dòng 99-103) is fixed and is not being edited by this packet. This is a narrow, PM-authorized gap-closing task, created after Q02 was independently verified CONFIRMED (`repo-map.md`, "Q02 Nemotron 3 Ultra delivery — independently verified: CONFIRMED, AT-S03 gap remains open for PM", 2026-08-19), and after the user explicitly chose "Yêu cầu dry-run AT-S03 mới" over accepting existing evidence or deferring.
- `SPEC`: AT-S03 (`SPEC.md` dòng 389: "Codex thấy đúng năm managed skill; dry-run parser nạp `exelearning-logic-alpha` + `test-driven-development`, dry-run lỗi nạp `systematic-debugging`, và cả hai đều không sửa mã. Kiểm tra công cụ AI khác là tùy chọn."). Đọc "Codex" trong câu này là **writer đang hoạt động** theo `AGENTS.md` §13.4 hiện tại (Nemotron 3 Ultra), không phải nghĩa đen — SPEC.md không bị sửa, đây chỉ là diễn giải cho task này. Dòng 401: nhãn "Solo Logic Alpha" chỉ gắn khi AT-S01…AT-S03 **và** AT-01…AT-10 đều đạt.
- `SKILLS`: `exelearning-logic-alpha`, `test-driven-development`, `systematic-debugging` — đây chính là ba skill **đang được kiểm tra khả năng phát hiện/định tuyến**, không phải skill để hoàn thành packet theo nghĩa thường. `plan-writing` không áp dụng (không viết packet mới). Không cần `e2e-test`/skill khác — task này không chạm code sản phẩm.
- `MUC TIEU`: Tạo bằng chứng AT-S03 mới, gắn với writer hiện tại (Nemotron 3 Ultra) thay vì Codex, bằng cách lặp lại đúng kịch bản gốc đã mô tả ở `SPEC.md` dòng 389 — không đổi kịch bản, không mở rộng phạm vi. Bằng chứng phải chứng minh: (a) writer thấy đúng năm managed skill; (b) một prompt dry-run thuộc phạm vi Boolean-parser/TDD khiến writer đọc/tham chiếu cả `exelearning-logic-alpha` và `test-driven-development`; (c) một prompt dry-run thuộc phạm vi điều tra lỗi khiến writer đọc/tham chiếu `systematic-debugging`; (d) cả hai dry-run đều **không sửa bất kỳ file sản phẩm nào**.
- `DAU RA`: 1 file bằng chứng mới (`.ai/evidence/AT-S03-nemotron-dry-run.md`) + `git status --porcelain` đầy đủ trước/sau dán trong báo cáo hoàn thành. PM sẽ đọc bằng chứng, xác minh độc lập, và **tự tay cập nhật `.ai/skills.lock.json`** nếu đạt — writer không tự sửa file lock trong packet này.

## Bối cảnh đã xác minh (đọc trước khi thực hiện, không suy diễn)

### 1. Vì sao task này tồn tại

`.ai/skills.lock.json` dòng 217-226 (`executionPolicy`) và dòng 228-236 (`gateEvaluation`, gate `G-S0`, `evaluatedAt: "2026-08-12"`) ghi `"primaryWriter": "Codex"` và `AT-S03: "PASS: Codex discovered the five managed skills and completed parser/TDD and systematic-debugging dry-runs without editing product code."` Bằng chứng này gắn liền với Codex cụ thể. `AGENTS.md` §13.4 đã đổi writer đang hoạt động sang Nemotron 3 Ultra kể từ 2026-08-19. Q02 (đã CONFIRMED cùng ngày) được packet của nó khóa rõ: không tự chạy dry-run mới, không tự sửa lock — chỉ báo cáo khoảng trống. PM đã xác nhận độc lập toàn bộ Q02 và đưa khoảng trống này lên cho người dùng quyết định; người dùng chọn chạy dry-run mới thay vì chấp nhận bằng chứng cũ hoặc hoãn lại. Packet này là hành động trực tiếp theo quyết định đó.

### 2. Năm managed skill cần thấy đủ

Theo `AGENTS.md` §13 và `.ai/skills.lock.json` (`audit.filesRead`, liệt kê file của cả 5 skill): `exelearning-logic-alpha`, `test-driven-development`, `systematic-debugging`, `receiving-code-review`, `plan-writing`. `.agents/skills` là nguồn canonical (theo `AGENTS.md` §13, mục cuối). Danh sách 5 tên này phải khớp chính xác với `ls .agents/skills/` — không nhiều hơn, không ít hơn.

### 3. Vì sao đây là "dry-run" chứ không phải task thật

Cả hai prompt kịch bản dưới (mục "Thiết kế khóa") là **giả định** — mô phỏng đúng loại yêu cầu mà `exelearning-logic-alpha`/`test-driven-development`/`systematic-debugging` được thiết kế để bắt (theo `description` trong frontmatter của từng skill, đã đọc trực tiếp trong `.agents/skills/*/SKILL.md`). Writer chỉ cần: nhận diện đúng skill nào áp dụng, mở/đọc file `SKILL.md` tương ứng, và tường thuật lại bước tiếp theo skill đó chỉ định — **rồi dừng lại**. Không viết code thật, không tạo test thật, không sửa bất kỳ file trong `src/`, `public/`, `test/`, hay bất kỳ đường dẫn sản phẩm nào. Đây đúng là ý nghĩa "dry-run" trong `SPEC.md` dòng 389 và đúng cách Codex đã được đánh giá PASS trước đó.

## `FILE ĐƯỢC SỬA` (1 file mới + packet, không sửa gì khác)

| File | Loại thay đổi |
|---|---|
| `.ai/evidence/AT-S03-nemotron-dry-run.md` | **Tạo mới.** Nội dung theo mẫu ở `ACCEPTANCE` mục 1. |
| `.ai/packets/GATE-S0-AT-S03-revalidation.md` | Packet này — không sửa. |

**KHÔNG sửa** `.ai/skills.lock.json` (PM sẽ tự làm sau khi xác minh độc lập). **KHÔNG sửa** bất kỳ file trong `src/`, `public/`, `test/`, `app/`, `scripts/` — kể cả khi prompt dry-run "gợi ý" một thay đổi hợp lý, dừng lại ở bước đọc/tường thuật.

## Thiết kế khóa (chốt trong packet này — không tự đổi kịch bản)

**Kịch bản A — Boolean parser + TDD (khớp AT-S03 phần "dry-run parser").**

Prompt giả định để writer xử lý (không thực thi thật, chỉ định tuyến):

> "Thêm hỗ trợ toán tử NAND vào Boolean parser (phạm vi P0), viết test trước theo TDD."

Kỳ vọng: writer nhận diện prompt này khớp mô tả của cả `exelearning-logic-alpha` ("Boolean expressions and Boolean algebra: lexer/parser...") và `test-driven-development` ("Apply Red–Green–Refactor to Boolean Core, parsers..."), mở và đọc cả hai `SKILL.md`, và tường thuật lại quy trình Red-Green-Refactor mà `test-driven-development/SKILL.md` chỉ định (Red → chạy test xác nhận fail đúng lý do → Green → …) như bước tiếp theo **nếu đây là task thật**. Sau đó dừng — không viết parser, không tạo file test.

**Kịch bản B — Điều tra lỗi (khớp AT-S03 phần "dry-run lỗi").**

Prompt giả định:

> "Karnaugh map validator đôi khi đánh dấu một nhóm chứa ô don't-care là không hợp lệ dù netlist hợp lệ — điều tra nguyên nhân gốc trước khi đề xuất sửa."

Kỳ vọng: writer nhận diện prompt này khớp mô tả của `systematic-debugging` ("Investigate build failures, test failures, Boolean evaluator defects... Use before proposing or applying a fix"), mở và đọc `systematic-debugging/SKILL.md`. Vì `systematic-debugging/SKILL.md` tự nói rõ "Read `SPEC.md`, `PLAN.md`, the active Task Packet, and `../exelearning-logic-alpha/SKILL.md`", writer cũng sẽ đọc lại `exelearning-logic-alpha` — đây là hành vi đúng, không phải trùng lặp cần tránh. Tường thuật lại Phase 1 ("Investigate": đọc lỗi/stack trace, tái lập, xác định tính nhất quán, truy vết dữ liệu) như bước tiếp theo nếu đây là task thật. Sau đó dừng — không sửa validator.

**File bằng chứng — `.ai/evidence/AT-S03-nemotron-dry-run.md`, cấu trúc bắt buộc:**

```markdown
# AT-S03 dry-run evidence — Nemotron 3 Ultra (2026-08-19)

## 1. Five-skill discovery
(dán output `ls .agents/skills/` hoặc tương đương, liệt kê đủ 5 tên)

## 2. Scenario A — Boolean parser + TDD
Prompt: "..."
Skills routed: exelearning-logic-alpha, test-driven-development
(tường thuật những gì đã đọc từ mỗi SKILL.md, bước tiếp theo skill chỉ định)
No product file edited: (xác nhận)

## 3. Scenario B — bug investigation
Prompt: "..."
Skills routed: systematic-debugging (+ exelearning-logic-alpha per its own instruction)
(tường thuật)
No product file edited: (xác nhận)

## 4. Git proof
git status --porcelain (before):
...
git status --porcelain (after):
...
```

## `KHÔNG LÀM`

- Không sửa `.ai/skills.lock.json` — PM tự làm sau khi xác minh độc lập bằng chứng này.
- Không sửa bất kỳ file sản phẩm nào (`src/`, `public/`, `test/`, `app/`, `scripts/`) dù prompt dry-run có vẻ hợp lý để thực thi thật — đây là dry-run, chỉ đọc và tường thuật.
- Không đổi nội dung hai prompt kịch bản đã khóa ở trên — nếu thấy chúng không khớp skill nào (routing thất bại), đó chính là kết quả cần báo cáo (FAIL), không phải lý do để đổi prompt cho "ăn khớp".
- Không tự kết luận AT-S03 PASS/FAIL trong `skills.lock.json` — chỉ báo cáo bằng chứng, PM kết luận.
- Không bắt đầu hay đề cập tiến độ Q03 — task này độc lập với chuỗi Q01→Q02→Q03, không chặn cũng không tự mở khóa Q03 thay Q02.
- Không chạy `make` (không có trên máy Windows/Git Bash này).

## `ACCEPTANCE` (quan sát được)

1. `.ai/evidence/AT-S03-nemotron-dry-run.md` tồn tại, đúng cấu trúc 4 mục ở trên, không thiếu mục nào.
2. Mục 1 liệt kê đúng 5 skill, khớp `ls .agents/skills/` chạy thật tại thời điểm thực hiện.
3. Mục 2 xác nhận cả `exelearning-logic-alpha` và `test-driven-development` được đọc/tham chiếu, có tường thuật cụ thể (trích dẫn hoặc diễn giải nội dung thật đã đọc, không phải câu chung chung), và xác nhận rõ "không sửa file sản phẩm".
4. Mục 3 xác nhận `systematic-debugging` được đọc/tham chiếu, có tường thuật cụ thể, xác nhận "không sửa file sản phẩm".
5. Mục 4: `git status --porcelain` đầy đủ (không pathspec) dán cả trước và sau — bản "sau" chỉ được khác bản "trước" đúng một dòng (file bằng chứng mới `??`), không có dòng nào khác (không `.ai/skills.lock.json`, không bất kỳ file `src/`/`public/`/`test/`/`app/`/`scripts/` nào).
6. Báo cáo hoàn thành nêu rõ: đây là bằng chứng cho PM xác minh độc lập và tự cập nhật `.ai/skills.lock.json`, không phải bản thân đã là kết luận PASS chính thức.

## `TEST BẮT BUỘC`

```bash
# Baseline trước khi bắt đầu
git status --porcelain

# Xác nhận danh sách 5 managed skill
ls .agents/skills/

# (Thực hiện Kịch bản A và B — đọc, tường thuật, không sửa code)

# Xác nhận sau khi hoàn tất: chỉ có file bằng chứng mới xuất hiện
git status --porcelain
```

Không có lệnh build/test/lint nào khác bắt buộc — task này không sửa code nên không có gì để build/test/lint. Nếu trong lúc thực hiện phát hiện bất kỳ thôi thúc nào để "tiện tay sửa luôn", dừng lại — đó là vi phạm phạm vi dry-run.

## `ĐẦU RA`

- Toàn văn `.ai/evidence/AT-S03-nemotron-dry-run.md`.
- `git status --porcelain` đầy đủ, dán cả trước và sau, nguyên văn.
- Xác nhận bằng lời: task này không đóng gate, không tự sửa `.ai/skills.lock.json`, không tự gắn nhãn AT-S03 PASS — chỉ tạo bằng chứng, dừng lại chờ PM/tester xác minh độc lập.
