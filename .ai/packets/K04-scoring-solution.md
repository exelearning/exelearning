# Task Packet — K04: Scoring/solution (K-map)

- `TASK`: K04 — Chấm điểm K-map: coverage, minimality, SOP equivalence (nguồn: `PLAN.md` §5.5, 2 giờ, phụ thuộc C06+K03).
- `SPEC`: KM-06, KM-07, KM-08 (`SPEC.md` §6.4). Phụ thuộc: KM-01..KM-05 (đã xong K01-K03), C06 `minimizeSop` (đã đóng băng), contract `GradingResult` v1 (`SPEC.md` §7, đã đóng băng), trọng số chấm điểm K-map (`SPEC.md` §9: 30% ô, 40% nhóm hợp lệ/phủ đủ, 30% SOP).
- `SKILLS`: `exelearning-logic-alpha` (domain/gate G-K0), `test-driven-development` (BẮT BUỘC Red-Green-Refactor thật cho `kmap-grader.js` — thuật toán chấm điểm thuần túy, không DOM).
- `MUC TIEU`: Khi `exercise.mode === 'kmap'`, `gradeActivity(exercise, response, metadata)` (`core/boolean-grader.js`) trả về `GradingResult` v1 đầy đủ, chấm 3 chiều độc lập rồi cộng trọng số đúng 100%: (1) **30% từng ô** — mọi `2^variableCount` ô grid đúng giá trị so với đáp án (don't-care chấp nhận mọi giá trị); (2) **40% nhóm** — mọi minterm=1 bắt buộc phải được ít nhất 1 nhóm hợp lệ phủ tới (KM-06 "phủ đủ"), và mỗi nhóm người học tạo phải hợp lệ so với đáp án thật (KM-06 "phát hiện nhóm sai/thừa" — nhóm chứa ô đáp án = 0 là nhóm sai); (3) **30% SOP** — nhóm của người học có tương đương đáp án hay không (KM-07/KM-08), và có tối giản hay không (so chi phí `{implicants, literals}` với `core.minimizeSop`, **không** so cách nhóm cụ thể — KM-08 "không trừ điểm nếu nhóm khác đáp án mẫu nhưng vẫn đúng/phủ đủ/tối giản"). Hiển thị một lời giải tối giản chuẩn (KM-07) qua field phụ `solution` trên check `kmap-sop-minimal`, không đổi 4 field gốc của `GradingResult`.

`DAU RA`: thuật toán chấm điểm thuần trong module mới `core/kmap-grader.js` (không DOM), được `core/boolean-grader.js` gọi qua dispatch mới cho `mode:'kmap'`. Tái dùng `kmap-group-validator.js` của K03 (không viết lại thuật toán hình chữ nhật Gray) — xem cách tái dùng ở dưới.

## Bối cảnh đã xác minh (đọc code thật + chạy `boolean-core.js` thật trước khi viết packet này, không suy diễn)

- `core/boolean-grader.js` hiện tại (150 dòng, đọc toàn bộ): `validateExercise` dòng 25 chặn mode bằng `!['boolean', 'truthTable'].includes(exercise.mode)` — phải thêm `'kmap'`. `gradeActivity` (dòng 138-145) dispatch nhị phân `mode==='truthTable' ? gradeTruthTable : gradeExpression` — phải thêm nhánh thứ 3. `expectedTruthVector(exercise)` (dòng 61-76) đã mode-agnostic (rẽ nhánh theo `authoring.answerSource`, không theo `mode`) — **dùng nguyên, không sửa**. `createResult(exercise, metadata, score, checks)` (dòng 48-59) là helper nội bộ **không export** — `kmap-grader.js` không gọi được, `boolean-grader.js` phải tự bọc kết quả từ `kmap-grader.js` qua `createResult` như 2 nhánh kia.
- `core/schema-lifecycle.js`: `AUTHORING_MODES = Object.freeze(['boolean', 'truthTable', 'kmap'])` (đã có sẵn) và validate `answer`/`authoring` đã generic, không theo `mode` — **K04 không sửa file này**.
- `scripts/build-resource-bundles.js` dùng `Bun.build({ entrypoints: ['core/boolean-grader-browser.mjs'], ... })`, resolve transitively mọi `require()` lồng nhau. `kmap-grader.js` được `require()` từ trong `boolean-grader.js` (entrypoint hiện có của bundle `$electronicsLogicGrader`) → **tự động vào bundle, không cần sửa `boolean-grader-browser.mjs`**. `export/electronics-logic.js` chỉ gọi chấm điểm qua `getGrader().gradeActivity(...)` (đã có, xem `checkActivity` dòng 445-460) — không cần thêm `globalThis.$electronicsLogic*` mới.
- **Phát hiện quan trọng nhất — tái dùng `kmap-group-validator.js` thay vì viết lại kiểm tra hình chữ nhật**: `validateKmapGroup({ variableCount, cells, values })` (K03, `core/kmap-group-validator.js`) nhận `values` làm tham số, không hardcode nguồn. Đã chạy thật (`node -e`, không suy diễn):
  ```
  expected = core.mintermsToVector({variables:['A','B','C','D'], minterms:[0,2,8,10,12,14], dontCares:[4]})
  expected.values = [1,0,1,0,"X",0,0,0,1,0,1,0,1,0,1,0]
  validateKmapGroup({variableCount:4, cells:[0,2,8,10], values: expected.values.map(String)}) → {valid:true}
  validateKmapGroup({variableCount:4, cells:[8,10,12,14], values: expected.values.map(String)}) → {valid:true}
  validateKmapGroup({variableCount:4, cells:[0,1], values: expected.values.map(String)}) → {valid:false, reason:'containsZero'}
  validateKmapGroup({variableCount:4, cells:[0,2,8,10,4], values: expected.values.map(String)}) → {valid:false, reason:'invalidSize'}
  ```
  Gọi `validateKmapGroup` với **`values` = đáp án đúng đã coerce string** (không phải giá trị người học gõ trên lưới) cho ra đúng 1 hàm vừa kiểm tra hình chữ nhật Gray (kể cả wraparound) **vừa** kiểm tra nhóm không chạm ô sai (đáp án = 0) — dùng lại nguyên thuật toán K03 đã test kỹ, không viết lại `popcount`/`varyMask`. Đây là cách duy nhất được chấp nhận để kiểm tra tính hợp lệ của nhóm ở K04 — **không** chỉ kiểm tra kích thước rồi bỏ qua kiểm tra hình chữ nhật (nếu bỏ qua, người học có thể khai một tập ô không phải hình chữ nhật hợp lệ làm "nhóm" và được tính điểm minimal sai).
- `expected.variables` (từ `mintermsToVector`/`createTruthVector`) là mảng biến → `variableCount = expected.variables.length`, không cần truyền riêng nếu không muốn, nhưng ký hiệu bên dưới vẫn liệt kê `variableCount` tường minh cho rõ ràng.
- `core.vectorToKmapModel(expected).cells` là mảng 2 chiều row-major `{row, column, index, value, assignment}` — **cùng thứ tự `[row][col]`** với `response.cells` mà `collectResponse` trả về (đã xác nhận: `renderKmap` dựng DOM trực tiếp từ cấu trúc này) → chấm ô bằng cách duyệt song song 2 mảng, không cần tự tính `kmapIndex`.
- `core.vectorToMinterms(expected).minterms` = danh sách minterm có giá trị đáp án = 1 (không gồm don't-care) → tập bắt buộc phải được nhóm phủ tới (KM-06).
- `core.minimizeSop(expected)` = `{variables, expression, implicants, cost:{implicants, literals}}` — đáp án tối giản chuẩn. Đã chạy thật, khóa 2 fixture số học sau làm bằng chứng/test:
  - **Fixture chính (wrap + overlap + don't-care, đúng kịch bản G-K0/AT-06)**: `variables=['A','B','C','D']`, `minterms=[0,2,8,10,12,14]`, `dontCares=[4]` → `minimizeSop` = `{expression:'!B*!D+A*!D', cost:{implicants:2, literals:4}}`, 2 nhóm đáp án `{0,2,8,10}` (4 góc, wraparound) và `{8,10,12,14}` (chồng ô 8,10 với nhóm kia). Người học điền đúng 16 ô + tạo đúng 2 nhóm này → `score = 10/10` (chứng minh dưới).
  - **Fixture phụ (dùng don't-care để tối giản, cho `KHONG_LAM`/test bổ sung)**: `variables=['A','B','C']`, `minterms=[0,1,2]`, `dontCares=[3]` → `{expression:'!A', cost:{implicants:1, literals:1}}`.
- `export/electronics-logic.js` hiện tại (đọc lại toàn bộ vùng liên quan, dòng 405-560):
  - `collectResponse` (dòng 411-429) đã trả đúng `{ cells: string[][], groups: [{id, cells:number[]}] }` cho kmap — **không đổi**.
  - `checkActivity` (dòng 431-461) gọi `grader.gradeActivity(...)` trong `try/catch`; bất kỳ lỗi ném ra (kể cả `TypeError` mới của K04) đều tự động rơi vào `gradingUnavailable` — **không cần sửa `checkActivity`**.
  - `applyResult` (dòng 463-484) hiện chỉ có **2 nhánh**: `truthValues.length > 0` (bảng chân trị) và else (biểu thức) — **chưa có nhánh kmap**, phải thêm nhánh thứ 3 kiểm tra `activity.querySelectorAll('[data-role="kmap-cell"]').length > 0` (đặt trước 2 nhánh cũ).
  - Phần tử nhóm đã render là `<li data-role="kmap-group" data-group-id="gN">` (gán ở `createKmapGroup`, dòng ~345-346); phần tử ô là `<td data-role="kmap-cell" data-minterm-index="N">` chứa `<select data-role="kmap-value">` (dòng 139-153). `[data-grade="passed"/"failed"]` đã có CSS chung (không riêng `truth-value`) — style áp được ngay cho cả `kmap-value` lẫn `kmap-group` mà **không cần sửa CSS**.
  - `getMessages()` (dòng 509-545) theo mẫu `key: typeof _ === 'function' ? _('...') : '...'` — thêm 2 khóa mới theo đúng mẫu.
- **Phát hiện cần sửa — test E2E cũ sẽ sai sau khi K04 xong**: `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` dòng 169-218 có test `'edits Karnaugh cells and groups in preview while grading remains gated for K04'`, assertion cuối cùng kỳ vọng `toContainText('Không thể chấm bài lúc này.')` — câu này chỉ đúng khi K04 **chưa tồn tại**. Bài tập của test này (đọc lại) dùng `variables=['A','B','C']`, `minterms=[1,3,7]`, `dontCares=[5]`. Đã chạy thật để tìm lời giải đúng:
  ```
  expected.values = [0,1,0,1,0,"X",0,1]
  validateKmapGroup({variableCount:3, cells:[1,3,5,7], values: expected.values.map(String)}) → {valid:true}
  minimizeSop(expected) → {expression:'C', cost:{implicants:1, literals:1}}
  ```
  → Nhóm `{1,3,5,7}` (dùng ô don't-care 5) là **một nhóm duy nhất, hợp lệ, đúng bằng đáp án tối giản `C`**. Sửa test: đổi tên bỏ "gated for K04", điền đúng giá trị 8 ô theo `expected.values`, chọn đúng 4 ô minterm `{1,3,5,7}` rồi tạo 1 nhóm, bấm chấm điểm, kỳ vọng `score/maxScore = 10/10` (hoặc đọc `maxScore` thật từ fixture nếu khác 10) thay vì `gradingUnavailable`.
  - **Cảnh báo thứ tự DOM** (đã xác minh, để tránh Codex tự suy đoán sai): thứ tự các `<select data-role="kmap-value">` trong DOM theo hàng/cột KHÔNG theo thứ tự minterm tăng dần tuần tự — cột theo nhãn Gray `['00','01','11','10']` nên với ví dụ 3 biến, thứ tự minterm theo vị trí DOM là `[0,1,3,2,4,5,7,6]`, không phải `[0,1,2,3,4,5,6,7]`. **Không dùng `.nth(i)` theo chỉ số minterm** để set giá trị ô hay chọn ô trong test mới/sửa — dùng locator theo thuộc tính thật: `[data-role="kmap-cell"][data-minterm-index="N"] [data-role="kmap-value"]` để set giá trị, và nút toggle tương ứng `[data-role="kmap-cell"][data-minterm-index="N"] [data-action="toggle-kmap-cell"]` để chọn ô trước khi tạo nhóm (test hiện có ở K02/K03 đã dùng đúng mẫu `data-minterm-index` cho việc toggle — chỉ riêng việc **set giá trị bằng `.nth()`** trong test cũ mới là chỗ dễ nhầm khi viết test mới).

## `FILE ĐƯỢC SỬA` (7 file + 1 file rebuild + packet)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/kmap-grader.js` | **File mới.** CommonJS thuần (`require('./boolean-core.js')`, `require('./kmap-group-validator.js')`), không DOM. Export `WEIGHTS = {cells:0.3, groups:0.4, sop:0.3}` và `gradeKmapResponse({ expected, response, variableCount, maxScore }) → { score, checks }`. Thuật toán chốt ở mục dưới — không tự thiết kế lại trọng số hay cách tái dùng validator. |
| `public/files/perm/idevices/base/electronics-logic/core/kmap-grader.test.js` | **File mới.** TDD thật (Red-Green-Refactor). Bắt buộc test bằng 2 fixture đã khóa ở trên (đặc biệt fixture chính phải cho đúng `score === 10` khi nhập hoàn hảo — số đã chứng minh ở mục "Thuật toán" bên dưới). Thêm ca: thiếu nhóm (coverage thiếu) → điểm nhóm giảm đúng tỷ lệ, SOP fail cả 2 check; nhóm thừa/sai (chạm ô đáp án=0) → check nhóm đó fail; đúng phủ nhưng nhóm KHÁC đáp án mẫu vẫn tối giản (vd dùng nhóm khác cùng chi phí nếu có, hoặc test riêng KM-08 bằng 1 fixture có 2 lời giải tối giản tương đương nếu tồn tại — nếu không tìm được ví dụ thật 2 lời giải cùng chi phí trong 2 fixture đã cho, có thể chứng minh KM-08 gián tiếp: chấm dựa trên `cost`, không so `pattern`/`implicants` cụ thể, nên tự nhiên thỏa KM-08 — ghi rõ trong test comment ngắn gọn); hàm toàn 0 (không có minterm=1, không cần nhóm) → dùng check tổng hợp thay vì chia 0/0; hàm toàn 1 hoặc toàn don't-care nếu hợp lý. |
| `public/files/perm/idevices/base/electronics-logic/core/boolean-grader.js` | Thêm `const kmapGrader = require('./kmap-grader.js');` đầu file. `validateExercise` dòng 25: thêm `'kmap'` vào mảng mode hợp lệ. Thêm hàm `gradeKmap(exercise, response, metadata)`: validate shape `response.cells` (đúng `expected.values.length` ô phẳng, mỗi ô ∈ `{'0','1','X'}`, lỗi `TypeError` tiếng Việt kiểu `` `Câu trả lời Karnaugh phải có đúng ${size} ô.` ``/`'Mỗi ô Karnaugh chỉ nhận 0, 1 hoặc X.'`) và `response.groups` (mảng object `{id:string, cells:number[]}`, `cells` là số nguyên hợp lệ trong `[0, size)`, lỗi `'Danh sách nhóm Karnaugh không hợp lệ.'`), sau đó gọi `kmapGrader.gradeKmapResponse({ expected: expectedTruthVector(exercise), response, variableCount: exercise.variables.length, maxScore: exercise.grading.maxScore })` rồi bọc kết quả qua `createResult(exercise, metadata, score, checks)`. `gradeActivity` (dòng 138-145): đổi dispatch nhị phân thành theo `exercise.mode` (`'truthTable'` → `gradeTruthTable`, `'kmap'` → `gradeKmap`, còn lại → `gradeExpression`). |
| `public/files/perm/idevices/base/electronics-logic/core/boolean-grader.test.js` | Bổ sung test dispatch: `mode:'kmap'` hợp lệ → gọi đúng nhánh mới, trả `GradingResult` đủ 4 field gốc + field `engine`/`engineVersion` đúng như 2 mode kia; `mode:'kmap'` với `response` sai shape → ném đúng `TypeError` tiếng Việt tương ứng; test không cần lặp lại toàn bộ thuật toán chấm điểm (đã có ở `kmap-grader.test.js`) — chỉ test tích hợp dispatch + validate + wrap `GradingResult`. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js` | Thêm nhánh thứ 3 vào `applyResult` (trước 2 nhánh cũ), điều kiện `activity.querySelectorAll('[data-role="kmap-cell"]').length > 0`: dùng `result.checks` (lập `Map` theo `id`) để gán `dataset.grade = 'passed'/'failed'` cho từng `<select data-role="kmap-value">` (khớp `kmap-cell-{mintermIndex}`) và từng `<li data-role="kmap-group">` (khớp `kmap-group-{groupId}`, bỏ qua nếu không có check tương ứng — trường hợp `kmap-groups-not-required`); dựng `feedback.textContent` gồm điểm số + tóm tắt số check nhóm đạt/tổng (dùng khóa `kmapGroupsResult` mới) + gợi ý lời giải tối giản lấy từ `check id==='kmap-sop-minimal'`'s field `solution` (khóa `kmapSolutionHint` mới, chỉ nối vào nếu `solution` tồn tại). Thêm 2 khóa vào `getMessages()`: `kmapGroupsResult: _('Đạt {passed}/{total} yêu cầu nhóm.')`, `kmapSolutionHint: _('Một lời giải tối giản: {expression}.')` (giữ đúng mẫu `typeof _ === 'function' ? _(...) : '...'`). |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` | Test colocated bổ sung cho nhánh `applyResult` kmap mới: dựng `result` giả (hoặc dùng `$electronicsLogicGrader` thật nếu môi trường test nạp được bundle) khớp fixture chính → assert `dataset.grade` đúng trên ô + nhóm, `feedback.textContent` chứa điểm `10`/`10`, chứa gợi ý lời giải; ca điểm không tuyệt đối (thiếu 1 nhóm) → assert `dataset.grade='failed'` đúng ô/nhóm liên quan. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js` | **Chỉ rebuild** bằng `bun run bundle:resources`; không sửa tay. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.test.js` | Thêm 1 ca test mới (mirror ca `mode:'boolean'` đã có) gọi `global.$electronicsLogicGrader.gradeActivity(...)` qua bundle đã build với `mode:'kmap'`, dùng fixture chính, assert `score === maxScore` và có check `id==='kmap-sop-minimal'` mang field `solution`. |
| `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` | Sửa test `'edits Karnaugh cells and groups in preview while grading remains gated for K04'` (dòng 169-218) theo đúng mô tả ở mục "Bối cảnh đã xác minh" phía trên: đổi tên bỏ "gated for K04", điền đúng 8 ô theo `expected.values` của fixture `minterms=[1,3,7], dontCares=[5]`, chọn nhóm `{1,3,5,7}`, bấm chấm điểm, assert điểm tuyệt đối thay vì `gradingUnavailable`. Dùng locator theo `data-minterm-index`, không dùng `.nth()` theo thứ tự minterm (xem cảnh báo thứ tự DOM ở trên). Không đổi test KM-04/KM-05 khác (dòng 220-257, không liên quan K04). |

## Thuật toán chấm điểm (chốt trong K04 — không tự thiết kế lại trọng số/công thức)

Đầu vào `gradeKmapResponse({ expected, response, variableCount, maxScore })`: `expected` là truth vector chuẩn (`{variables, values}`, `values[i]` là `0|1|'X'`, độ dài `2^variableCount`, thứ tự minterm). `response = { cells: string[][], groups: [{id, cells:number[]}] }` (đã qua validate shape ở `boolean-grader.js`, `cells` ở đây là số nguyên chỉ minterm, không phải index [row][col]). `maxScore` là số dương.

**Bước 1 — 30% từng ô (`WEIGHTS.cells`)**: dùng `core.vectorToKmapModel(expected).cells` duyệt song song với `response.cells` theo đúng `[row][col]` (thứ tự đã xác nhận trùng nhau). Với mỗi ô `{index, value}`: `expectedValue = String(value)`, `actual = response.cells[row][col]`, `passed = expectedValue === 'X' || actual === expectedValue` (giống hệt quy tắc don't-care của `gradeTruthTable`). Check: `{ id: 'kmap-cell-' + index, passed, expected: expectedValue, actual }`. Luôn có đúng `2^variableCount` check ở bước này (không có ca rỗng).

**Bước 2 — 40% nhóm (`WEIGHTS.groups`)**: gọi `stringValues = expected.values.map(String)`. Với mỗi `group` trong `response.groups`: `groupResult = validateKmapGroup({ variableCount, cells: group.cells, values: stringValues })` (tái dùng K03, xem bằng chứng ở trên). Check hợp lệ nhóm: `{ id: 'kmap-group-' + group.id, passed: groupResult.valid, expected: 'valid-group', actual: groupResult.valid ? 'valid-group' : groupResult.reason }`.
Lấy `expectedOnes = core.vectorToMinterms(expected).minterms`. Với mỗi `index` trong `expectedOnes`: `covered = response.groups.some((g, i) => groupResults[i].valid && g.cells.includes(index))` (chỉ nhóm **hợp lệ** mới được tính là phủ — nhóm sai không cho điểm phủ). Check: `{ id: 'kmap-coverage-' + index, passed: covered, expected: 'covered', actual: covered ? 'covered' : 'not-covered' }`.
Gộp `groupDimensionChecks = coverageChecks.concat(groupValidityChecks)`. **Ca biên**: nếu `groupDimensionChecks.length === 0` (hàm toàn 0 — không có minterm=1 nào cần phủ — VÀ người học không tạo nhóm nào) → dùng đúng 1 check tổng hợp `{ id: 'kmap-groups-not-required', passed: true, expected: 'no-groups-needed', actual: 'no-groups-needed' }` thay vì chia 0/0. (Nếu hàm toàn 0 nhưng người học lỡ tạo nhóm, nhóm đó chắc chắn chạm ô đáp án=0 → tự động fail ở `groupValidityChecks`, không rơi vào ca biên này — không cần xử lý gì thêm.)

**Bước 3 — 30% SOP (`WEIGHTS.sop`)**: `equivalent = groupDimensionChecks.every(check => check.passed)` (đúng cả phủ đủ lẫn không có nhóm sai — kể cả ca biên `kmap-groups-not-required` vốn `passed:true`, coi là tương đương đúng nghĩa vacuous truth). Check: `{ id: 'kmap-sop-equivalence', passed: equivalent, expected: 'covers-exactly-required-minterms', actual: equivalent ? 'covers-exactly-required-minterms' : 'incorrect-or-incomplete-coverage' }`.
`expectedMinimal = core.minimizeSop(expected)`. Nếu `equivalent`: `learnerImplicants = response.groups.length`, `learnerLiterals = response.groups.reduce((sum, g) => sum + (variableCount - Math.log2(g.cells.length)), 0)`, `minimal = learnerImplicants === expectedMinimal.cost.implicants && learnerLiterals === expectedMinimal.cost.literals`. Nếu **không** `equivalent`: `minimal = false` (không xét tối giản khi chưa đúng — đúng tinh thần KM-08 "tối giản" là tinh chỉnh trên nền đã đúng, không độc lập với đúng/sai). Check: `{ id: 'kmap-sop-minimal', passed: minimal, expected: expectedMinimal.cost.implicants + ' nhóm, ' + expectedMinimal.cost.literals + ' literal', actual: equivalent ? (learnerImplicants + ' nhóm, ' + learnerLiterals + ' literal') : 'not-equivalent', solution: expectedMinimal.expression }` — **field `solution` luôn có mặt** (đúng/sai đều hiển thị được lời giải mẫu theo KM-07), đây là field phụ ngoài 4 field gốc, đúng tiền lệ `error` ở nhánh lỗi cú pháp của `gradeExpression`.

**Tổng điểm**: `cellScore = (cellChecks.filter(c=>c.passed).length / cellChecks.length) * maxScore * WEIGHTS.cells`; `groupScore` tương tự với `groupDimensionChecks` (hoặc ca biên, tỷ lệ luôn `1/1`); `sopScore` tương tự với `[equivalenceCheck, minimalCheck]` (luôn đúng 2 check, không có ca rỗng). `score = Number((cellScore + groupScore + sopScore).toFixed(4))` — **chỉ làm tròn 1 lần ở tổng cuối cùng**, không làm tròn từng phần riêng rồi cộng (tránh sai số cộng dồn). `checks` trả về = `cellChecks.concat(groupDimensionChecks, [equivalenceCheck, minimalCheck])`.

**Chứng minh số học fixture chính** (đã chạy thật, không suy diễn — dùng làm test bắt buộc `score === 10` khi `maxScore=10`): người học điền đúng 16/16 ô (kể cả ô don't-care index 4, mọi giá trị đều `passed`) → `cellScore = 16/16 * 10 * 0.3 = 3.0`. Người học tạo đúng 2 nhóm `{0,2,8,10}` và `{8,10,12,14}` (cả 2 `valid:true`, đã chứng minh) → 6 check `kmap-coverage-*` (minterm 0,2,8,10,12,14) đều `passed` (mỗi minterm được ít nhất 1 nhóm hợp lệ phủ) + 2 check `kmap-group-*` đều `passed` → `groupScore = 8/8 * 10 * 0.4 = 4.0`. `equivalent = true` → `learnerImplicants=2`, `learnerLiterals=(4-log2(4))+(4-log2(4))=2+2=4`, khớp `expectedMinimal.cost={implicants:2,literals:4}` → `minimal=true` → `sopScore = 2/2 * 10 * 0.3 = 3.0`. **Tổng = 3.0+4.0+3.0 = 10.0** (đúng `maxScore` mặc định).

## `KHÔNG LÀM`

- Không sửa `boolean-core.js`, `boolean-core-contract.js` — mọi hàm cần (`vectorToKmapModel`, `vectorToMinterms`, `minimizeSop`, `mintermsToVector`, `createTruthVector`) đã export sẵn, đã chạy thật xác nhận đúng shape.
- Không sửa `schema-lifecycle.js` — `AUTHORING_MODES` đã gồm `'kmap'`, validate `answer`/`authoring` đã generic (xem bối cảnh đã xác minh).
- Không sửa `boolean-grader-browser.mjs` — `kmap-grader.js` vào bundle tự động qua `require()` lồng trong `boolean-grader.js` (đã xác nhận cơ chế `Bun.build`).
- Không viết lại thuật toán kiểm tra hình chữ nhật Gray (`popcount`/`varyMask`) trong `kmap-grader.js` — **bắt buộc** gọi `validateKmapGroup` từ `kmap-group-validator.js` với `values` = đáp án đúng (xem cách tái dùng ở trên). Không sửa `kmap-group-validator.js` — chữ ký `validateKmapGroup({variableCount, cells, values})` đã đủ tổng quát cho cả K03 (values = lưới người học) lẫn K04 (values = đáp án).
- Không sửa `edition/electronics-logic.js` — không có trường soạn thảo mới nào cần cho K04.
- Không sửa CSS (`electronics-logic.css`) — `[data-grade="passed"/"failed"]` đã generic, áp được cho `kmap-value` và `kmap-group` mà không cần luật mới.
- Không đổi 4 field gốc của `GradingResult` v1 (`attemptId, exerciseId, engine, engineVersion, score, maxScore, checks, createdAt`) — field `solution` chỉ là field phụ trên **một check cụ thể** (`kmap-sop-minimal`), đúng tiền lệ field `error` của `gradeExpression`.
- Không so sánh cách nhóm cụ thể (`pattern`/`implicants` từng ô) giữa người học và đáp án mẫu để chấm tối giản — chỉ so `cost:{implicants, literals}` (đúng KM-08: nhóm khác đáp án mẫu nhưng cùng chi phí vẫn được tính tối giản).
- Không tính điểm phủ (`kmap-coverage-*`) cho minterm được "phủ" bởi một nhóm **không hợp lệ** — nhóm sai không được tính là đã phủ, dù về mặt tập hợp ô có chứa minterm đó.
- Không đổi test KM-04/KM-05 hiện có (dòng 220-257 của spec E2E) — chỉ sửa đúng 1 test bị stale đã nêu.
- Không chạm `translations/**`, không chạy `make translations`. Chuỗi UI mới dùng `_()` rồi dừng.

## `ACCEPTANCE` (quan sát được)

1. `gradeActivity(exercise, response, metadata)` với `exercise.mode==='kmap'`, fixture chính (`minterms=[0,2,8,10,12,14]`, `dontCares=[4]`), người học điền đúng 16 ô + đúng 2 nhóm `{0,2,8,10}`/`{8,10,12,14}` → trả `GradingResult` với `score === maxScore` (10/10 nếu `maxScore` mặc định), mọi check `passed:true`, check `kmap-sop-minimal` có `solution` khớp `'!B*!D+A*!D'` (hoặc biểu thức tương đương do `minimizeSop` sinh ra).
2. Cùng fixture, người học chỉ tạo 1 trong 2 nhóm (thiếu phủ minterm 12,14) → điểm nhóm giảm đúng tỷ lệ, `kmap-sop-equivalence` và `kmap-sop-minimal` đều `passed:false`, `score < maxScore`.
3. Người học tạo 1 nhóm hợp lệ về hình dạng nhưng chạm ô đáp án=0 (nhóm "sai") → check `kmap-group-{id}` tương ứng `passed:false, actual:'containsZero'`, không được tính vào phủ.
4. Hàm toàn 0 (không minterm=1) + người học không tạo nhóm → chấm nhóm đạt tuyệt đối qua check `kmap-groups-not-required`, không chia 0/0, không lỗi.
5. Trong preview trình duyệt: điền đúng lưới + đúng nhóm theo fixture chính, bấm "Kiểm tra" (`check`) → ô grid và nhóm được gắn `data-grade="passed"`, vùng phản hồi hiện điểm số + tóm tắt nhóm đạt + gợi ý lời giải tối giản; sai ít nhất 1 ô/nhóm → phần tử tương ứng `data-grade="failed"`.
6. Test E2E cũ `'...gated for K04'` được sửa đúng như mô tả, chạy xanh với kết quả chấm điểm thật (không còn assert `gradingUnavailable`).
7. Sau `bun run bundle:resources`, gọi `$electronicsLogicGrader.gradeActivity(...)` với `mode:'kmap'` qua bundle đã build cho đúng kết quả như gọi trực tiếp `core/boolean-grader.js` (xác nhận qua `electronics-logic-grader.test.js`).

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ (public/files/perm/idevices/** dùng Vitest theo AGENTS.md §2 — kể cả core/ CommonJS, không phải bun test)
npx vitest run public/files/perm/idevices/base/electronics-logic/core/kmap-grader.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/core/boolean-grader.test.js

# Frontend (Vitest)
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.test.js

# Rebuild bundle grader (bắt buộc sau khi sửa boolean-grader.js/kmap-grader.js)
bun run bundle:resources

# Core không được đỏ ở K04
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend đầy đủ
npx vitest run public/files/perm/idevices/base/electronics-logic

# E2E (cần server, báo rõ nếu môi trường chưa thể chạy)
bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts

# Lint
make fix
```

**Ghi chú `make fix`** (đã xác nhận từ K02/K03, vẫn đúng ở K04): Windows/Git Bash hiện tại không có `make`; kể cả có, `make fix`/`make lint` không phủ `public/files/perm/idevices/**`. Nếu gặp, dùng thay thế sau và ghi rõ lý do trong báo cáo:

```bash
bun x biome check --write \
  public/files/perm/idevices/base/electronics-logic/core/kmap-grader.js \
  public/files/perm/idevices/base/electronics-logic/core/kmap-grader.test.js \
  public/files/perm/idevices/base/electronics-logic/core/boolean-grader.js \
  public/files/perm/idevices/base/electronics-logic/core/boolean-grader.test.js \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.test.js
```

Kỳ vọng: Vitest xanh cho cả `core/` lẫn `export/`; E2E kmap (cũ đã sửa + các test khác không đổi) xanh; lint sạch; bundle rebuild chứa nhánh `mode:'kmap'` hoạt động qua `$electronicsLogicGrader`.

## `ĐẦU RA`

- `git diff --stat` chỉ chạm đúng 7 file + rebuild bundle nêu trên + `.ai/packets/K04-scoring-solution.md`.
- Output test đầy đủ (pass/fail) cho cả 4 file test bị/được chạm (`kmap-grader.test.js`, `boolean-grader.test.js`, `electronics-logic.test.js`, `electronics-logic-grader.test.js`) + kết quả E2E + kết quả lint.
- Xác nhận bằng số: chạy fixture chính qua `gradeActivity` thật (không mock) và dán output `score`/`checks` — phải khớp `score===10` như chứng minh ở mục thuật toán.
- Bằng chứng rebuild bundle (kích thước trước/sau, xác nhận bundle chạy được `mode:'kmap'` — ví dụ qua `electronics-logic-grader.test.js` xanh).
- Nêu rõ nếu dùng `biome check` thay `make fix` và lý do.
- Trạng thái gate `G-K0` sau K04: nêu rõ đây là điều kiện **cuối cùng** cần cho G-K0 ("Truth table + K-map 4 biến chấm đúng wrap/overlap/don't-care") — nếu mọi ACCEPTANCE ở trên đạt, đề xuất PM/tester chạy AT-06 để đóng gate.
