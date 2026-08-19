# Task Packet — K03: Group validator

- `TASK`: K03 — Group validator cho nhóm Karnaugh (nguồn: `PLAN.md` §5.5, 4 giờ, phụ thuộc K01+K02).
- `SPEC`: KM-04, KM-05. Hỗ trợ: KM-01/KM-02/KM-03 (đã xong K01-K02), NFR-07 (lỗi tiếng Việt).
- `SKILLS`: `exelearning-logic-alpha` (domain/gate), `test-driven-development` (BẮT BUỘC Red-Green-Refactor thật cho `kmap-group-validator.js` — đây là thuật toán thuần túy, đúng loại logic mà skill này yêu cầu test trước).
- `MUC TIEU`: Khi người học chọn ô trên lưới K-map và bấm "Tạo nhóm" (`export/electronics-logic.js`), hệ thống chỉ tạo nhóm khi hợp lệ theo KM-04 (kích thước lũy thừa 2 trong {1,2,4,8,16}, tạo thành hình chữ nhật trong không gian Gray — kể cả nối vòng/wraparound) và KM-05 (nhóm được phép chồng nhau; nhóm không được chứa ô có giá trị hiện tại là `0`). Nhóm không hợp lệ bị từ chối kèm thông báo tiếng Việt, không tạo phần tử trong danh sách nhóm.

`DAU RA`: thuật toán kiểm định đặt trong module thuần mới `core/kmap-group-validator.js` — không phụ thuộc DOM, không sửa `boolean-core.js`/`boolean-grader.js`/`boolean-core-contract.js`/`schema-lifecycle.js` (đã đóng băng/đã chốt).

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này)

- `createKmapGroup(activity)` (hiện tại trong `export/electronics-logic.js`) đọc `[data-kmap-selected="true"]`, lấy `cells = selectedControls.map(c => Number(c.dataset.mintermIndex))`, rồi **tạo nhóm ngay không kiểm tra gì** — đây chính là chỗ hổng K03 phải lấp.
- Mỗi ô lưới là `<td data-role="kmap-cell" data-minterm-index="N">` chứa `<select data-role="kmap-value">` (giá trị `''|'0'|'1'|'X'`) và `<button data-action="toggle-kmap-cell" data-minterm-index="N" data-kmap-selected>`. `data-minterm-index` dùng chỉ số minterm chuẩn giống `kmapIndex`/`vectorToKmapModel` — đây cũng là chỉ số bắt buộc dùng cho thuật toán bên dưới.
- `variableCount` không có sẵn làm state riêng; suy ra bằng `Math.log2(activity.querySelectorAll('[data-role="kmap-cell"]').length)` (tổng số ô luôn là `2^variableCount`).
- Core (`boolean-core.js`) resolve trong `export/electronics-logic.js` qua helper `getCore: () => (typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicCore : undefined)`, được populate bởi `core/boolean-grader-browser.mjs` (entrypoint bundle `bun run bundle:resources` → `export/electronics-logic-grader.bundle.js`, xem `scripts/build-resource-bundles.js` dòng 76). **Bất kỳ module nào learner runtime cần dùng ở bản export/offline (SCORM/HTML5/EPUB) đều phải đi qua đường này** — không import ES module tương đối trực tiếp trong `export/electronics-logic.js`, vì bundle mới là thứ chạy khi không có dev server.
- `boolean-core.js` là CommonJS thuần (`'use strict'` + `require()` + `module.exports = { ... }`), được `.mjs` adapter `import` dạng default rồi dùng như object thuộc tính (`core.mintermsToVector(...)`). Module mới `kmap-group-validator.js` PHẢI theo đúng convention này (CommonJS, không phải ESM) để tương thích cách bundle hiện tại.
- `getMessages()` xây chuỗi UI theo mẫu `key: typeof _ === 'function' ? _('...') : '...'` — mọi chuỗi lỗi mới phải theo đúng mẫu này.

## `FILE ĐƯỢC SỬA` (7 file + 1 file rebuild)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/kmap-group-validator.js` | **File mới.** CommonJS thuần, không DOM. Export `validateKmapGroup({ variableCount, cells, values })` — xem thuật toán chốt bên dưới. |
| `public/files/perm/idevices/base/electronics-logic/core/kmap-group-validator.test.js` | **File mới.** Test đơn vị TDD (Red-Green-Refactor thật, không viết code trước rồi mới thêm test): kích thước sai (0,3,5,6,7,9...), kích thước đúng nhưng không phải hình chữ nhật, nhóm hợp lệ có nối vòng (wraparound), nhóm chứa ô giá trị `0`, biên `variableCount` = 2/3/4, nhóm hợp lệ chứa ô rỗng/`X`. |
| `public/files/perm/idevices/base/electronics-logic/core/boolean-grader-browser.mjs` | Thêm `import kmapGroupValidator from './kmap-group-validator.js';` và `globalThis.$electronicsLogicKmapValidator = kmapGroupValidator;`. Không sửa 2 dòng expose hiện có. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js` | **Chỉ rebuild** bằng `bun run bundle:resources`; không sửa tay. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js` | Thêm helper `getKmapValidator` (giống mẫu `getCore`, dòng ~512). Sửa `createKmapGroup(activity)`: trước khi tạo `<li>` nhóm, gọi `getKmapValidator().validateKmapGroup({ variableCount, cells, values })` (xem cách tính `variableCount`/`values` ở trên); nếu không hợp lệ → hiện thông báo lỗi trong vùng `data-role="kmap-group-feedback"` (thêm mới, `aria-live="assertive"`, đặt cạnh nút "Tạo nhóm" trong `renderKmap`), KHÔNG tạo nhóm, KHÔNG xóa lựa chọn hiện tại, return sớm; nếu hợp lệ → xóa thông báo lỗi cũ rồi chạy tiếp luồng hiện có. Thêm 2-3 khóa vào `getMessages()` cho các `reason` (ví dụ `kmapGroupInvalidSize`, `kmapGroupNotRectangle`, `kmapGroupContainsZero` — có thể đổi tên/chữ miễn giữ đúng nghĩa và bọc `_()`). |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` | Test colocated bổ sung: chọn số ô sai lũy thừa 2 → bị từ chối, danh sách nhóm không đổi, thông báo lỗi hiện ra; chọn đúng lũy thừa 2 nhưng không liền kề hợp lệ → bị từ chối; chọn nhóm nối vòng hợp lệ (ví dụ 4 góc bản đồ 4 biến) → được tạo; chọn nhóm hợp lệ hình dạng nhưng có ô giá trị `0` → bị từ chối với thông báo khác; hai nhóm hợp lệ chồng ô nhau → cả hai đều tạo được (không có lỗi overlap giả); `collectResponse` không đổi shape `{cells, groups}` đã chốt ở K02. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.css` | Style tối thiểu cho `[data-role="kmap-group-feedback"]` nếu style lỗi/alert có sẵn (vd. dùng chung với `[data-role="grading-feedback"]`) chưa đủ layout. Chỉ sửa nếu thật sự cần — không mở rộng palette. |
| `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` | Thêm 1 kịch bản: trong preview, chọn số ô không hợp lệ (vd. 3 ô) → bấm "Tạo nhóm" → thấy thông báo lỗi, danh sách nhóm vẫn trống/không đổi; sau đó chọn nhóm hợp lệ → nhóm xuất hiện. |

## Thuật toán kiểm định (chốt trong K03 — không tự thiết kế lại)

Đầu vào: `{ variableCount: number, cells: number[], values: string[] }`. `cells` = chỉ số minterm ứng viên (không trùng lặp — DOM đảm bảo điều này, validator không bắt buộc phải tự khử trùng lặp). `values[i]` = giá trị chuỗi hiện tại (`''|'0'|'1'|'X'`) của ô có chỉ số minterm `i`, độ dài `2^variableCount`.

Đầu ra: `{ valid: true }` hoặc `{ valid: false, reason: 'invalidSize' | 'notRectangle' | 'containsZero' }`. Đây là kiểm tra tuần tự có ngắt sớm (short-circuit) — KHÔNG dùng mảng `errors[]` nhiều lỗi cùng lúc như `schema-lifecycle.js`, vì bước 2/3 vô nghĩa nếu bước 1 đã sai.

1. **Kích thước** — `size = cells.length`. Hợp lệ khi `size ∈ {1,2,4,8,16}` VÀ `size ≤ 2^variableCount`. Sai → `reason: 'invalidSize'`.
2. **Hình chữ nhật Gray (kể cả nối vòng)** — tính `varyMask = OR` của `(cells[i] XOR cells[0])` với mọi `i`. Nhóm hợp lệ hình chữ nhật **khi và chỉ khi** `popcount(varyMask) === log2(size)`. Sai → `reason: 'notRectangle'`. (Chứng minh: mỗi `cells[i] XOR cells[0]` là tập con bit của `varyMask` theo cách dựng; nếu số phần tử đúng bằng `2^popcount(varyMask)` thì đây là song ánh lên mọi tập con bit của `varyMask` — tức mọi tổ hợp bit tự do đều có mặt, không cần bước "closure" riêng. Đúng vì đánh nhãn Gray làm cho kề nhau vật lý — kể cả nối vòng — tương đương khác nhau đúng 1 bit trong không gian chỉ số minterm chuẩn.)
3. **Không chứa ô giá trị 0** — nếu bước 1-2 hợp lệ, kiểm tra `values[cell]` cho mọi `cell` trong `cells`, dùng **giá trị hiện tại người học đã nhập trên lưới** (không dùng đáp án ẩn của tác giả — việc chấm điểm là của K04). Có ít nhất 1 ô `values[cell] === '0'` → `reason: 'containsZero'`. Ô giá trị `''` (chưa điền) hoặc `'X'` đều được phép, không bị chặn.

## `KHÔNG LÀM`

- Không viết K04 (grader/scoring kmap, trọng số 30/40/30, coverage/minimality/SOP) — `gradeActivity` vẫn chưa nhận `mode:'kmap'`, đúng như kỳ vọng.
- Không sửa `boolean-core.js`, `boolean-grader.js`, `boolean-core-contract.js`, `schema-lifecycle.js` (đã đóng băng C05 / đã chốt K01-K02).
- Không sửa `edition/electronics-logic.js` — không có UI tạo nhóm ở phía authoring; KM-04/KM-05 chỉ áp dụng cho nhóm learner tạo trong runtime (`export/electronics-logic.js`).
- Không chặn ô giá trị rỗng (`''`) hoặc `'X'` trong nhóm — chỉ `'0'` bị từ chối (xem bước 3 thuật toán).
- Không đổi contract `collectResponse` (`{ cells, groups }`) đã chốt ở K02 — nhóm không hợp lệ đơn giản không được tạo, không thêm state/field mới vào response.
- Không thêm kiểm tra "overlap giữa các nhóm" — KM-05 cho phép chồng nhau, validator chỉ xét MỘT nhóm ứng viên độc lập với các nhóm đã có.
- Không import ES module tương đối trực tiếp trong `export/electronics-logic.js` cho validator mới — phải đi qua `globalThis.$electronicsLogicKmapValidator` như core/grader hiện có.
- Không chạm `translations/**`, không chạy `make translations`. Chuỗi UI dùng `_()`/`c_()` rồi dừng.

## `ACCEPTANCE` (quan sát được)

1. Chọn số ô không thuộc {1,2,4,8,16} (vd. 3 hoặc 5 ô) → bấm "Tạo nhóm" → không tạo nhóm mới, thông báo lỗi tiếng Việt hiện ra, danh sách nhóm không đổi.
2. Chọn đúng số ô lũy thừa 2 nhưng không liền kề hợp lệ trong không gian Gray → bị từ chối tương tự, thông báo lỗi (có thể khác thông báo ở mục 1).
3. Chọn nhóm hợp lệ có nối vòng (wraparound) — ví dụ 4 góc của bản đồ 4 biến — được chấp nhận, xuất hiện trong danh sách nhóm.
4. Chọn nhóm hợp lệ về hình dạng nhưng chứa ít nhất 1 ô đang có giá trị `0` → bị từ chối, thông báo lỗi khác với lỗi hình dạng ở mục 1/2.
5. Hai nhóm hợp lệ có ô chung nhau (overlap) → cả hai đều tạo được bình thường, không có lỗi overlap giả.
6. `core/kmap-group-validator.js` có bộ test đơn vị độc lập (không qua DOM) phủ đủ: sai kích thước, đúng kích thước nhưng không phải hình chữ nhật, nối vòng hợp lệ, chứa `0`, các biên `variableCount` 2/3/4.
7. Sau `bun run bundle:resources`, `$electronicsLogicKmapValidator` tồn tại trong bundle; không có lỗi console do thiếu phụ thuộc khi tạo nhóm trong preview.

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ (frontend / Vitest)
npx vitest run public/files/perm/idevices/base/electronics-logic/core/kmap-group-validator.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js

# Rebuild bundle grader (bắt buộc sau khi sửa boolean-grader-browser.mjs)
bun run bundle:resources

# Core không được đỏ ở K03
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend
npx vitest run public/files/perm/idevices/base/electronics-logic

# E2E (cần server, BD skip nếu môi trường chưa thể chạy)
bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts

# Lint
make fix
```

**Ghi chú quan trọng về `make fix`** (phát hiện đã xác nhận ở K02, vẫn đúng cho K03): môi trường Windows/Git Bash hiện tại **không có `make`** trong PATH. Ngoài ra, kể cả khi có `make`, `make fix`/`make lint` **không chạm tới** `public/files/perm/idevices/**` (chỉ phủ `src/`, `test/`, `public/app/` — xem `package.json` scripts `lint:src`/`lint:test`/`lint:public`). Nếu gặp một trong hai tình huống này, dùng lệnh thay thế sau (tôn trọng đúng `biome.json` — không phải bypass tùy tiện) và ghi rõ trong báo cáo:

```bash
bun x biome check --write \
  public/files/perm/idevices/base/electronics-logic/core/kmap-group-validator.js \
  public/files/perm/idevices/base/electronics-logic/core/kmap-group-validator.test.js \
  public/files/perm/idevices/base/electronics-logic/core/boolean-grader-browser.mjs \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js
```

Kỳ vọng: toàn bộ Vitest xanh; E2E kmap (cũ + mới) xanh; lint sạch (qua `make fix` hoặc lệnh thay thế nêu trên, có ghi chú lý do nếu dùng thay thế); grader bundle được rebuild chứa `$electronicsLogicKmapValidator`.

## `ĐẦU RA`

- `git diff --stat` chỉ chạm đúng 7 file + rebuild bundle nêu trên + `.ai/packets/K03-group-validator.md`.
- Output `npx vitest run` (hàng pass/fail) đầy đủ cho cả 2 file test bị/được chạm + kết quả lint.
- Bằng chứng rebuild bundle (kích thước file trước/sau, xác nhận chuỗi `$electronicsLogicKmapValidator` có trong bundle — ví dụ qua `grep`/`wc -c`/hash).
- Nêu rõ nếu dùng lệnh `biome check` thay thế cho `make fix` và lý do (theo ghi chú ở trên).
- Rủi ro còn lại cho K04: `groups[].cells` trong `collectResponse` giờ đảm bảo luôn là nhóm hợp lệ (đã qua validator) — K04 khi thiết kế grader có thể tin tưởng invariant này mà không cần validate lại hình dạng.
