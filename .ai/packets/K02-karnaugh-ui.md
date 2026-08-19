# Task Packet — K02: Karnaugh UI tối thiểu

- `TASK`: K02 — Karnaugh UI tối thiểu (nguồn: `PLAN.md` §5.5).
- `SPEC`: KM-02, KM-03. Hỗ trợ: KM-01 (đã xong ở K01), PLAT-03 (cùng schema v1), NFR-07 (lỗi tiếng Việt).
- `SKILLS`: `exelearning-logic-alpha` (domain/gate), `test-driven-development` (behaviour UI dùng characterization/integration test qua colocated `*.test.js` Vitest — không bắt buộc pixel/unit thuần cho render).
- `MUC TIEU`: Learner runtime của Electronics Logic render được lưới K-map (nhãn Gray 2/3/4 biến), cho điền `0/1/X`, chọn nhiều ô tạo nhóm bằng click (không kéo chuột) và liệt kê nhóm — dữ liệu trả về theo contract v1 để K03/K04 tiêu thụ.

`DAU RA`: chức năng K-map dùng model/validator CÓ SẴN trong `boolean-core.js`; không nhân bản logic lưới/label trong runtime.

## PM AMENDMENT (2026-08-13, trước khi giao Codex)

Rà soát trước gate phát hiện: `core/schema-lifecycle.js` có hằng `AUTHORING_MODES = ['boolean', 'truthTable']` dùng riêng bên trong `validate()` (bắt buộc `prompt` không rỗng, `variables.length >= 2`, và gọi `validateAnswer()` để chặn minterm trùng/ngoài phạm vi/chồng don't-care) — **tách biệt** khỏi field `authoringModes` trong config UI mà packet gốc định sửa trong `edition/electronics-logic.js`. Nếu chỉ sửa UI mà không thêm `'kmap'` vào `AUTHORING_MODES` của validator, hoạt động Karnaugh sẽ lưu được với prompt rỗng, sai số biến, hoặc minterm không hợp lệ mà không báo lỗi — vi phạm PLAT-06 (P0). Đây không phải lỗi cách viết packet mà là thiếu một file phụ thuộc thật. Bổ sung 2 file dưới đây vào phạm vi (nay là **10 file + 1 file rebuild**); mọi ràng buộc khác của packet giữ nguyên.

| File bổ sung | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.js` | Thêm `'kmap'` vào mảng `AUTHORING_MODES` (dòng 6). CHỈ đổi giá trị mảng này — không sửa `SUPPORTED_MODES`, không đổi cấu trúc `validate()`/`migrateSchemaV0ToV1()`. |
| `public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.test.js` | Thêm test: activity `mode:'kmap'` với `prompt` rỗng → lỗi `emptyPrompt`; với `variables.length < 2` hoặc `> 4` → lỗi `invalidVariables`; với `answer.minterms` trùng/ngoài phạm vi/chồng `dontCares` → lỗi tương ứng (dùng lại `validateAnswer`, giống hành vi `truthTable`); activity kmap hợp lệ → `valid: true`. |

## `FILE ĐƯỢC SỬA` (10 file + 1 file rebuild)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/boolean-grader-browser.mjs` | Expose `globalThis.$electronicsLogicCore = core` (import `./boolean-core.js`) để learner runtime dùng `vectorToKmapModel`/`kmapAxes`/`mintermsToVector`. Không sửa logic core. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js` | **Chỉ rebuild** bằng `bun run bundle:resources`; không sửa tay. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js` | `supportedModes` += `'kmap'`; `renderView` nhánh kmap gọi `renderKmap`; render lưới (nhãn hàng/cột từ `$electronicsLogicCore.vectorToKmapModel`), ô nhập `0/1/X` (select hoặc vòng click — chọn kiểu nào thì dùng nhất quán), chọn nhiều ô + nút "Tạo nhóm", danh sách nhóm (highlight/xóa); `collectResponse` trả `{ cells, groups }`; cập nhật `renderBehaviour`, `resetActivity`, `updateEmptyState`. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` | Test colocated: render nhãn/lưới 2/3/4 biến, điền `0/1/X`, chọn ô → tạo nhóm → xuất hiện trong danh sách, xóa nhóm, empty/invalid state, `collectResponse` đúng `{ cells, groups }`, reset sạch trạng thái. |
| `public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.js` | `authoringModes` += `'kmap'`; thêm option "Karnaugh" vào select `mode`; giữ nguyên cơ chế `answerSource` (expression/minterms) — không thêm field mới. |
| `public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.test.js` | Test colocated: tạo/save/normalize activity kmap (minterms), chuyển mode kmap↔truthTable không mất dữ liệu, validate lỗi tiếng Việt cho minterm sai. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.css` | Style lưới K-map, ô, nhóm, danh sách nhóm (không mở rộng palette bên ngoài). |
| `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` | Thêm mô tả kmap: mở hoạt động kmap trong preview → lưới hiện nhãn → điền ô → chọn ô → tạo nhóm → nhóm hiện trong danh sách; check hiển thị "không thể chấm" (grader kmap chưa có, K04). |

**Contract response kmap (chốt trong K02 — K03/K04 tiêu thụ đúng shape này):**

```json
{
  "cells": [["0","1","X",...], ...],
  "groups": [{"id": "g1", "cells": [0, 1, 3, 2]}]
}
```

`cells` là ma trận nhãn Gray theo `vectorToKmapModel`; `cells[i][j].index` = minterm (theo `kmapIndex`). `groups[].cells` = mảng minterm index. Deprecate/vô hiệu hóa không làm ở phiên này.

## `KHÔNG LÀM`

- Không viết K03 (validator nhóm: rectangle, power-of-2, wrap, ô 0) — dữ liệu nhóm chỉ được quản lý trong UI.
- Không viết K04 (grader kmap, trọng số 30/40/30) — `gradeActivity` chưa nhận `mode:'kmap'` là đúng kỳ vọng trong K02.
- Không sửa `boolean-core.js`, `boolean-grader.js`, `boolean-core-contract.js` (đã đóng băng C05).
- Không kéo chuột / drag-drop chính xác (KM-03 yêu cầu click-to-select).
- Không chạm `translations/**`, không chạy `make translations`. Chuỗi UI dùng `_()`/`c_()` rồi dừng.
- Không UI circuit, truth table polish, don't-care semantics grading (chờ K04).

## `ACCEPTANCE` (quan sát được)

1. IDevice có mode "Karnaugh" trong authoring; tạo activity kmap (2–4 biến, minterms) → lưu → preview render lưới đúng nhãn Gray hàng/cột.
2. Người học điền `0/1/X`; chọn nhiều ô (click) → nút "Tạo nhóm" → nhóm xuất hiện trong danh sách, có highlight chung màu; xóa được nhóm.
3. `collectResponse` trả đúng `{ cells, groups }`; reset xóa sạch ô + nhóm; empty state đúng khi chưa điền đủ.
4. Không có log lỗi console từ sự phụ thuộc core thiếu (`$electronicsLogicCore` tồn tại sau bundle).
5. `schema-lifecycle.validate()` chặn activity kmap có prompt rỗng, sai số biến (< 2 hoặc > 4), hoặc minterm/don't-care trùng/ngoài phạm vi/chồng nhau — cùng mức nghiêm ngặt như `truthTable` (PLAT-06).

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ (frontend / Vitest)
npx vitest run public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.test.js

# Rebuild bundle grader (bắt buộc sau khi sửa boolean-grader-browser.mjs)
bun run bundle:resources

# Core không được đỏ ở K02
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend
npx vitest run public/files/perm/idevices/base/electronics-logic

# E2E (cần server, BD skip nếu môi trường chưa thể chạy)
bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts

# Lint
make fix
```

Kỳ vọng: toàn bộ Vitest xanh; E2E kmap xanh; `make fix` sạch; grader bundle được rebuild chứa `$electronicsLogicCore`.

## `ĐẦU RA`

- `git diff --stat` chỉ chạm 10 file trên + `.ai/packets/K02-karnaugh-ui.md`.
- Output `npx vitest run` (hàng pass/fail) + `make fix` kết quả.
- Ghi rõ bằng chứng rebuild bundle (kích thước file trước/sau) trước khi kết luận.
- Rủi ro còn lại: `cells`/`groups` shape có thể cần về nhất khi K04 thiết kế grader — chấp nhận vì contract đã chốt tại packet này.