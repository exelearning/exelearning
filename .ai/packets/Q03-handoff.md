# Task Packet — Q03: Bàn giao / Handoff (Solo Logic Alpha)

- `TASK`: Q03 — Bàn giao / Handoff
- `SPEC`: PLAN.md §12 (Bàn giao ngày 24/08/2026), AT-10 (SPEC.md dòng 399), AT-S01…AT-S03 (SPEC.md dòng 387–389)
- `SKILLS`: `exelearning-logic-alpha`, `plan-writing` (cho việc đóng gói bài giao), `changelog` (nếu cần cập nhật CHANGELOG)
- `MUC TIEU`: Tạo bộ bàn giao hoàn chỉnh để gắn nhãn `Solo Logic Alpha` — bao gồm README cập nhật, báo cáo test, release notes, limitations, backlog, và xác minh tất cả AT-S/AT đã đạt.
- `FILE DUOC SUA`:
  - `README.md` — cập nhật hướng dẫn build/run/demo cho Solo Logic Alpha
  - `public/CHANGELOG.md` — thêm bản thảo release notes (theo skill `changelog`)
  - `.ai/evidence/test-report-AT.md` — **tạo mới**: báo cáo tổng hợp AT-S01…AT-S03 và AT-01…AT-10
  - `.ai/evidence/release-notes.md` — **tạo mới**: release notes, limitations, backlog
  - `.ai/evidence/README-demo.md` — **tạo mới**: hướng dẫn demo chi tiết (có thể gộp vào README.md)
- `KHONG LAM`:
  - Không sửa code sản phẩm (`src/`, `public/app/`, `public/files/perm/idevices/`, `test/`) — báo cáo test tổng hợp
    chỉ được ghi vào `.ai/evidence/test-report-AT.md`, không sửa bất kỳ file nào trong `test/`
  - Không thêm feature mới
  - Không tự ý chạy lại toàn bộ `make test-e2e`/`make test-coverage` nếu bằng chứng cùng ngày (2026-08-19) đã có
    trong `repo-map.md` — trích dẫn đúng mục/ngày trong `repo-map.md` thay vì chạy lại. Chỉ chạy đúng lệnh còn
    thiếu bằng chứng, và khi chạy phải dán output thật, không tái tạo/gõ tay output để "trông giống" — xem phát
    hiện về git-proof bị dựng lại trong `repo-map.md` (mục "AT-S03 dry-run evidence... one evidence-integrity
    finding"). Vi phạm này sẽ bị PM từ chối toàn bộ báo cáo.
  - Không sửa `.ai/skills.lock.json` (PM tự làm sau khi xác minh AT-S03)
  - Không thay đổi `SPEC.md`, `PLAN.md`, `AGENTS.md`
- `ACCEPTANCE`:
  1. `README.md` có mục "Solo Logic Alpha — Build & Demo" với lệnh tái lập chính xác
  2. `.ai/evidence/test-report-AT.md` liệt kê từng AT với trạng thái PASS/FAIL và bằng chứng (file, log, lệnh)
  3. `.ai/evidence/release-notes.md` chứa: phiên bản, ngày, 8 deliverable theo PLAN.md §12, limitations (Sev-3/4), backlog
  4. `public/CHANGELOG.md` có bản thảo "## [Unreleased] — Solo Logic Alpha" theo format chuẩn
  5. Tất cả 13 AT (AT-S01…AT-S03, AT-01…AT-10) được xác nhận PASS với bằng chứng
  6. Không còn Sev-1/Sev-2 mở
- `TEST BAT BUOC`:
  ```bash
  # Ưu tiên trích dẫn bằng chứng cùng ngày (2026-08-19) đã có trong repo-map.md thay vì chạy lại.
  # Chỉ chạy lệnh dưới đây nếu repo-map.md thực sự thiếu bằng chứng cho lệnh đó:
  make fix
  make test-unit
  make test-integration
  make test-e2e
  # Kiểm tra coverage
  make test-coverage
  ```
  Mong đợi: tất cả xanh, patch coverage ≥ 90% trên dòng mới/sửa. Mọi output — dù chạy mới hay trích dẫn cũ — phải
  là thật và kiểm chứng được (đường dẫn file/dòng trong `repo-map.md`, hoặc output lệnh dán nguyên văn).
- `DAU RA`:
  - diff các file được phép sửa
  - `.ai/evidence/test-report-AT.md`
  - `.ai/evidence/release-notes.md`
  - `.ai/evidence/README-demo.md` (hoặc diff README.md)
  - `public/CHANGELOG.md` diff
  - Rủi ro còn lại (nếu có AT nào FAIL hoặc Sev-3/4 chưa ghi)

---

## Chi tiết thực thi (5–8 hành động)

1. **Tổng hợp bằng chứng AT** — đọc `.ai/evidence/AT-S03-nemotron-dry-run.md`, `.ai/skills.lock.json` (AT-S01, AT-S02), Q01 E2E test results (AT-01…AT-09), và regression test results (AT-10). Ghi vào `.ai/evidence/test-report-AT.md` theo mẫu bảng.

2. **Cập nhật README.md** — thêm section "## Solo Logic Alpha — Build & Demo" bao gồm:
   - Lệnh clone, cài đặt, build (`make deps`, `make bundle`, `make up-local`)
   - Lệnh chạy demo course: mở `test/fixtures/electronics-logic-demo.elpx`
   - Lệnh chạy test bộ: `make test-unit && make test-integration && make test-e2e`
   - Lưu ý offline: ngắt mạng vẫn chạy được TT/K-map/half-adder

3. **Tạo release-notes.md** — theo 8 deliverable PLAN.md §12:
   - Source fork commit/tag
   - 5 skill + lock + sync script + discovery evidence (AT-S01…AT-S03)
   - Boolean Core + unit/property/golden tests
   - Electronics Logic iDevice (4 mode: boolean, truthTable, kmap, circuit)
   - Course demo `.elpx` (text, ảnh, video, TT, K-map, half-adder)
   - HTML offline export (audit EXP-03)
   - Test report AT-S/AT-01…AT-10
   - README build/run/demo, limitations, backlog

4. **Ghi limitations & backlog** — từ risk register PLAN.md §10 và KNOWN_ISSUES.md, phân loại Sev-3/4.

5. **Cập nhật CHANGELOG.md** — dùng skill `changelog` tạo bản thảo "## [Unreleased] — Solo Logic Alpha".

6. **Tạo README-demo.md** (tùy chọn, hoặc gộp vào README) — kịch bản demo từng AT để PM/t tester chạy lại.

7. **Xác minh git status** — chỉ các file cho phép xuất hiện trong diff.

8. **Báo cáo hoàn thành** — diff + test evidence + rủi ro còn lại, dừng chờ PM xác minh Gate G-R0.

---

## Rủi ro & Lưu ý

- Nếu bất kỳ AT nào chưa có bằng chứng PASS (ví dụ AT-S01, AT-S02 chưa có file evidence tách), ghi rõ FAIL trong test-report và dừng — không tự gắn nhãn Alpha.
- Nếu `make test-e2e` chưa chạy gần đây, cần chạy lại để có evidence AT-10 (regression).
- File `.ai/evidence/test-report-AT.md` phải là **duy nhất** nguồn khẳng định AT status — không dùng lời nói.
- PM sẽ dựa trên test-report này để quyết định Gate G-R0.