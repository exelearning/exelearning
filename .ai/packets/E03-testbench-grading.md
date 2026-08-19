# Task Packet — E03: Testbench/grading

- `TASK`: E03 — Testbench/grading (nguồn: `PLAN.md` §5.6 "E — Circuit Engine", dòng 159, 3 giờ, phụ thuộc E02). Task thứ ba của domain Circuit, nằm trong cụm "Ngày 7 — Circuit Engine" (E01→E02→E03) trước khi E04+U01/U02 mở khóa ở Gate `G-E0` (`PLAN.md` dòng 228). E02 (Engine `0/1/X`) đã xong và được PM/tester xác minh độc lập (xem mục "E02 Engine 0/1/X evidence" ở `repo-map.md`).
- `SPEC`: LOG-07 (`SPEC.md` §6.5, dòng 262) — "Người soạn map input/output và khai báo truth table chuẩn". E03 khóa **hình dạng dữ liệu** (testbench contract) thỏa mãn yêu cầu này; UI thật cho author nhập mapping là việc của U01+, không phải E03. LOG-08 (dòng 263) — "Test runner chạy mọi tổ hợp, trả số case đạt và bằng chứng output sai" — đây **chính là** việc E03 phải làm. `SPEC.md` §7 (dòng 276-327) — hợp đồng JSON, đặc biệt ví dụ check thật trong GradingResult: `{"id": "case-11-carry", "passed": false, "expected": "1", "actual": "0"}` — khóa định dạng id check của E03 đúng theo ví dụ này. `SPEC.md` §8 dòng 340 — sơ đồ kiến trúc vẽ `Boolean Core --> Circuit Engine + Grader` (một khối, không tách hai mũi tên) — E03 (grader) **được phép** `require('./boolean-core.js')`, khác hẳn E02 (engine) bị cấm — xem lý do đầy đủ ở "Bối cảnh đã xác minh". `SPEC.md` §9 (dòng 346-359) — pipeline chấm điểm 6 bước và dòng trọng số "Circuit: 100% testbench; lỗi cấu trúc chặn chạy và trả check tương ứng"; dòng "Cùng input và engine version luôn cho cùng kết quả" (determinism). NFR-05 (`SPEC.md` §10) — branch coverage ≥ 90%.
- `SKILLS`: `exelearning-logic-alpha` (domain/gate G-E0), `test-driven-development` (BẮT BUỘC Red-Green-Refactor thật cho `circuit-grader.js`).
- `MUC TIEU`: Module mới `core/circuit-grader.js` (CommonJS thuần, không DOM). Export duy nhất `gradeCircuitResponse({ netlist, testbench, maxScore })` → `{ score, checks }` (cùng hình dạng trả về với `kmap-grader.js`'s `gradeKmapResponse`, **không** phải `GradingResult` đầy đủ — bọc `attemptId`/`exerciseId`/`engine`/`createdAt` là việc của orchestrator `boolean-grader.js`, **chưa** được nối ở E03, xem "Bối cảnh đã xác minh"). Hàm nhận netlist thô (learner nộp) + một "testbench" do author khai báo (map biến A-D → node `INPUT`, map tên output → node `OUTPUT`, biểu thức Boolean kỳ vọng cho mỗi output), tự parse+validate netlist, tự chạy **mọi** tổ hợp `0/1` của các biến qua `propagate()` (E02), so khớp với vector kỳ vọng tính bằng `boolean-core.js`'s `createTruthVector`, trả điểm + bằng chứng từng ca đúng LOG-08.
- `ĐẦU RA`: thuật toán chấm điểm thuần túy trong module mới `core/circuit-grader.js` — không DOM, phụ thuộc đúng 3 module đã có (`circuit-netlist.js`, `circuit-engine.js`, `boolean-core.js`), không phụ thuộc `kmap-*.js`/`schema-lifecycle.js`. Chưa có consumer nào gọi tới (`boolean-grader.js` **chưa** nối nhánh `mode === 'circuit'` — việc nối dây vào orchestrator + schema validation cho circuit authoring/answer là phạm vi của một task tích hợp sau, có khả năng là U01/U03, KHÔNG phải E03 — xem "Bối cảnh đã xác minh"). Không đổi bất kỳ file hiện có nào.

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

- **`circuit-grader.js` chưa tồn tại** — đã `grep` toàn bộ `electronics-logic/` theo từ khóa `circuit` (không phân biệt hoa/thường): 7 file khớp, không file nào là grader hay chứa logic chấm điểm circuit. Clean slate.
- **E02 (`core/circuit-engine.js`) đã xong, đã đọc lại toàn bộ source thật** (không suy diễn từ packet): export đúng 3 thứ — `SIGNAL_VALUES` (`['0','1','X']`), `evaluateGate(kind, inputValues)`, `propagate(model, inputAssignment)`. `propagate` trả `{ok:true, values}` với `values['<nodeId>.<pin>']` cho **mọi** chân của **mọi** node, hoặc `{ok:false, error:{code:'combinationalLoop',...}}` nếu `model` có vòng lặp. Node `OUTPUT` chỉ có 1 chân vào cố định tên `a` (từ `GATE_PINS.OUTPUT.inputs = ['a']`, `circuit-netlist.js` dòng 5) — vậy giá trị output của một node `OUTPUT` id `X` luôn đọc tại `values['X.a']`, không có tên chân nào khác.
- **`circuit-netlist.js`'s `validateTopology(model)` đã bao gồm sẵn kiểm tra vòng lặp** — đọc lại dòng 193-194: `const sortResult = topologicalSort(model); if (!sortResult.ok) addError(errors, 'combinationalLoop', ...)` — lời gọi này **không điều kiện**, luôn chạy. Hệ quả: nếu `validateTopology(model).valid === true`, thì `topologicalSort(model).ok` chắc chắn `true` (cùng một lời gọi, cùng input), nên `propagate(model, ...)` (tự gọi `topologicalSort` bên trong) **chắc chắn** trả `ok:true`. `circuit-grader.js` được phép tin tưởng bất biến này và đọc thẳng `result.values` sau khi đã tự `validateTopology` — **không** cần thêm nhánh phòng thủ `if (!result.ok)` (xem `KHÔNG LÀM`, tránh dead code không test được làm giảm coverage giả tạo).
- **`boolean-core.js`'s `createTruthVector(expressionOrAst, variableOrder)` đã đọc lại toàn bộ (dòng 413-423) — đây là hàm E03 phải dùng lại, không tự viết vòng lặp tổ hợp riêng:**
  - Trả `{variables: [...variables], values}` với `values[row]` là **số** `0`/`1` (không phải chuỗi) — phải `String(...)` khi so với check `expected`/`actual` (cùng quy ước `boolean-grader.js` dòng 89 `String(value)`).
  - `assignmentForRow(variables, row)` (dòng 404-411) dùng `shift = variables.length - index - 1` — nghĩa là `variables[0]` là **bit cao nhất (MSB)**. Quy ước này khớp đúng với cách `boolean-grader.js` dòng 91 sinh id `case-${index.toString(2).padStart(variables.length, '0')}` — cùng một chỉ số `index`/`row` cho cả hai. E03 **phải** dùng đúng công thức `index.toString(2).padStart(variables.length, '0')` để bit thứ `k` của chuỗi nhị phân khớp đúng `variables[k]`, nhất quán với `createTruthVector`.
  - `validateVariableOrder(variables, expressionVariables)` (dòng 388-401) **tự ném** `TypeError` nếu biểu thức dùng một biến không có trong `variables` truyền vào (dòng 399-400: `Boolean variable order is missing expression variable ${missing}.`). Hệ quả quan trọng: nếu `testbench.expected[tênOutput]` dùng biến ngoài `testbench.variables`, `createTruthVector` **tự** ném lỗi — `circuit-grader.js` **không cần** tự viết thêm kiểm tra này, chỉ cần **không catch** lỗi đó (để nó ném tiếp ra ngoài, coi là lỗi cấu hình testbench của author).
- **`boolean-grader.js` đã đọc lại TOÀN BỘ file (trước đây chỉ đọc 100 dòng đầu)** — xác nhận: `validateExercise` (dòng 13-37) hard-code `!['boolean', 'truthTable', 'kmap'].includes(exercise.mode)` → **không** chấp nhận `'circuit'`. `gradeActivity` (dòng 174+) chỉ có 2 nhánh (`truthTable`, `kmap`) + fallback `gradeExpression` — **không có** nhánh `circuit`. Nghĩa là: `circuit-grader.js` của E03 **chưa được gọi từ bất kỳ đâu** trong pipeline chấm điểm thật — đây là quyết định phạm vi có chủ ý, không phải thiếu sót. Việc nối dây (thêm `'circuit'` vào `validateExercise`, thêm nhánh `gradeCircuit` vào `gradeActivity`) để dành cho một task tích hợp sau (`PLAN.md` không nêu tên task này một cách tường minh; dòng 168 `U03 | 2 | U02,T03,K04,E04 | Bốn mode iDevice | Chuyển mode, author/learner state tách biệt...` là ứng viên hợp lý nhất vì nó phụ thuộc **cả E04 lẫn K04/T03** và mô tả "bốn mode" — nhưng đây là suy luận có căn cứ, **không phải** khẳng định chắc chắn từ `PLAN.md`).
- **`schema-lifecycle.js` và `edition/electronics-logic.js` đã đọc lại — xác nhận cùng một gap**: `SUPPORTED_MODES`/`supportedModes` đều liệt kê `'circuit'`, nhưng `AUTHORING_MODES`/`authoringModes` đều **loại trừ** `'circuit'`. Hệ quả: hiện tại **không có validation schema nào** cho `authoring`/`answer` của activity mode `circuit` — một activity `mode: 'circuit'` gần như không bị kiểm tra gì ở tầng schema. Đây là gap có thật nhưng **đóng gap này KHÔNG phải phạm vi E03** — E03 chỉ xây module chấm điểm thuần túy, độc lập với `schema-lifecycle.js`.
- **`kmap-grader.js` đã đọc lại toàn bộ — tiền lệ cấu trúc trực tiếp cho E03**: module con đứng riêng, export `gradeKmapResponse({expected, response, variableCount, maxScore}) → {score, checks}`, **không tự validate** input hình dạng (tin tưởng caller `boolean-grader.js`'s `gradeKmap` đã validate trước khi gọi). **E03 khác biệt có chủ ý ở điểm này**: vì `circuit-grader.js` **chưa có** orchestrator nào gọi vào (không như `kmap-grader.js` luôn được gọi sau validation của `gradeKmap`), `circuit-grader.js` **phải tự** validate — cả phần "lỗi cấu trúc netlist của learner" (trả graceful, không throw — xem dưới) lẫn "lỗi cấu hình testbench của author" (throw `TypeError`, giống `validateExercise`/`gradeTruthTable` của `boolean-grader.js` ném lỗi cho input sai hình dạng).
- **`boolean-grader.js`'s `gradeExpression` (dòng 102-137) là tiền lệ trực tiếp cho cách xử lý "lỗi trả về graceful thay vì throw"**: `catch (error) { if (!(error instanceof core.BooleanSyntaxError)) throw error; return createResult(..., 0, [{id:'expression-syntax', passed:false, ..., error:{...}}]); }` — bắt **đúng loại lỗi cụ thể** trong phạm vi hẹp (không try/catch bao trùm cả hàm), chuyển thành check điểm 0 thay vì để lỗi văng ra ngoài. E03 áp dụng đúng tinh thần này cho `parseNetlist` (chỉ bắt quanh đúng lời gọi đó, chỉ bắt `TypeError`, re-throw nếu không phải).
- **Công thức điểm đã có tiền lệ khóa cứng, tái dùng nguyên văn**: `boolean-grader.js` dòng 98 — `Number(((passed / checks.length) * exercise.grading.maxScore).toFixed(4))`. `kmap-grader.js` dùng cùng kiểu `Number((...).toFixed(4))`. E03 dùng đúng công thức `Number(((passed / checks.length) * maxScore).toFixed(4))` — không tự nghĩ ra cách làm tròn khác.
- **Validation `maxScore` đã có tiền lệ khóa cứng**: `boolean-grader.js` dòng 31-33 — `typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0`. E03 dùng đúng 3 điều kiện này cho tham số `maxScore` của `gradeCircuitResponse`.
- **Không cần rebuild bundle** — cùng lý do E01/E02: `circuit-grader.js` không nằm trong đồ thị `require()` của bất kỳ entrypoint bundle nào hiện tại (vì `boolean-grader.js` chưa `require()` nó).

## `FILE ĐƯỢC SỬA` (2 file mới + packet)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/circuit-grader.js` | **File mới.** CommonJS thuần, không DOM. `require()` đúng 3 module: `./circuit-netlist.js` (`parseNetlist`, `validateTopology`), `./circuit-engine.js` (`propagate`), `./boolean-core.js` (`createTruthVector`) — **không** `require()` `kmap-*.js`/`schema-lifecycle.js`. Export đóng băng: `{ gradeCircuitResponse }`. Thiết kế khóa ở mục dưới. |
| `public/files/perm/idevices/base/electronics-logic/core/circuit-grader.test.js` | **File mới.** TDD thật (Red-Green-Refactor). Phủ mọi ca ở `ACCEPTANCE`. Fixture nhỏ khai literal inline (không phải fixture half-adder chính thức — xem `KHÔNG LÀM`), không thêm file vào `fixtures/`. |
| `.ai/packets/E03-testbench-grading.md` | Packet này. |

## Thiết kế khóa (chốt trong E03 — không tự thiết kế lại hình dạng testbench/thuật toán)

**Hợp đồng `testbench` (object thường, KHÔNG phải một phần của `exercise.answer` schema chính thức — xem "Bối cảnh đã xác minh" về việc chưa nối dây):**

```json
{
  "variables": ["A", "B"],
  "inputs": { "A": "in-a", "B": "in-b" },
  "outputs": { "P": "p-out" },
  "expected": { "P": "A AND B" }
}
```

- `variables`: mảng 1-4 phần tử, mỗi phần tử khớp `/^[A-D]$/`, không trùng lặp (cùng ràng buộc A-D của `boolean-core.js`, tái dùng local trong `circuit-grader.js` — không import hằng số từ `schema-lifecycle.js`, giữ tách biệt, đúng tiền lệ `boolean-grader.js`'s `validVariables` cũng tự khai `/^[A-D]$/` cục bộ thay vì import).
- `inputs`: object thường, đúng key = đúng tập `variables` (không thiếu, không thừa), mỗi value là chuỗi non-empty (id node `INPUT` dự kiến trong netlist).
- `outputs`: object thường, ≥ 1 key (tên output, chuỗi bất kỳ non-empty, **không** bắt buộc theo A-D — đây là nhãn, không phải biến Boolean), mỗi value là chuỗi non-empty (id node `OUTPUT` dự kiến).
- `expected`: object thường, đúng key = đúng tập key của `outputs`, mỗi value là chuỗi biểu thức Boolean non-empty (cú pháp `boolean-core.js`, chỉ được dùng biến trong `variables`).
- Đây là hình dạng dữ liệu **mới**, do E03 tự định nghĩa để thỏa LOG-07 — không phải trường đã có sẵn ở đâu khác trong codebase. Tên tham số hàm là `testbench`, không phải `exercise`/`answer`.

**`gradeCircuitResponse({ netlist, testbench, maxScore })` → `{ score, checks }`** (không phải `GradingResult` đầy đủ — không có `attemptId`/`exerciseId`/`engine`/`createdAt`, giống hệt `gradeKmapResponse`'s hình dạng trả về, việc bọc thêm là của orchestrator tương lai). `netlist` là JSON thô **chưa qua `parseNetlist`** (giống dữ liệu learner nộp thật — khác `circuit-engine.js`'s `propagate(model, ...)` nhận `model` đã parse rồi).

**Thuật toán (thứ tự bắt buộc — mỗi bước dừng sớm nếu phát hiện lỗi):**

1. Validate hình dạng `testbench` theo hợp đồng trên. Sai → ném `TypeError('Testbench không hợp lệ.')`.
2. Validate `maxScore` (`typeof !== 'number' || !Number.isFinite || <= 0`). Sai → ném `TypeError('Điểm tối đa không hợp lệ.')`.
3. `model = parseNetlist(netlist)` trong `try`. Nếu ném (luôn là `TypeError`, xem `circuit-netlist.js`) → bắt, **không** ném tiếp, trả ngay `{ score: 0, checks: [{ id: 'structure-invalid-netlist', passed: false, expected: 'valid-netlist-shape', actual: error.message }] }`.
4. `topology = validateTopology(model)`. Nếu `!topology.valid` → trả ngay `{ score: 0, checks: topology.errors.map(e => ({ id: 'structure-' + e.code, passed: false, expected: 'valid-topology', actual: e.code, path: e.path })) }`.
5. Kiểm tra ánh xạ I/O so với netlist **thật** (đã parse): tập id node `kind === 'INPUT'` trong `model.nodes` phải khớp **chính xác** (không thiếu, không thừa) tập `Object.values(testbench.inputs)`; nếu không khớp → trả ngay `{ score: 0, checks: [{ id: 'structure-input-mapping', passed: false, expected: 'testbench-inputs-match-netlist-inputs', actual: 'mismatch' }] }`. Tương tự cho `kind === 'OUTPUT'` so với `Object.values(testbench.outputs)` → `structure-output-mapping` nếu không khớp. **Đây là lỗi cấu trúc của netlist learner nộp (I/O không khớp testbench mong đợi) — trả graceful, KHÔNG throw**, khác hẳn bước 1 (lỗi cấu hình testbench của author — throw).
6. Với mỗi tên output trong `testbench.outputs`: `expectedVectors[name] = createTruthVector(testbench.expected[name], testbench.variables)` (có thể ném lỗi từ `boolean-core.js` nếu biểu thức sai cú pháp hoặc dùng biến ngoài `variables` — **không catch**, đây là lỗi cấu hình testbench của author, ném tiếp ra ngoài).
7. Với mỗi `index` từ `0` đến `2^variables.length - 1`: `bits = index.toString(2).padStart(variables.length, '0')`; dựng `inputAssignment` bằng cách gán `inputAssignment[testbench.inputs[variables[k]]] = bits[k]` cho mọi `k`; gọi `result = propagate(model, inputAssignment)` (tin tưởng `result.ok === true` — xem bất biến ở "Bối cảnh đã xác minh", không thêm nhánh `if (!result.ok)`). Với mỗi tên output: `actual = result.values[testbench.outputs[name] + '.a']`; `expectedValue = String(expectedVectors[name].values[index])`; đẩy check `{ id: 'case-' + bits + '-' + name.toLowerCase(), passed: actual === expectedValue, expected: expectedValue, actual }` vào mảng `checks`.
8. `passed = checks.filter(c => c.passed).length`; `score = Number(((passed / checks.length) * maxScore).toFixed(4))`. Trả `{ score, checks }`.

**Bảng phân loại lỗi (khóa cứng — không nhầm lẫn hai loại):**

| Tình huống | Nguồn lỗi | Hành vi |
|---|---|---|
| `testbench` sai hình dạng (bước 1) | Cấu hình author | `throw TypeError('Testbench không hợp lệ.')` |
| `maxScore` sai (bước 2) | Cấu hình author | `throw TypeError('Điểm tối đa không hợp lệ.')` |
| `testbench.expected[...]` sai cú pháp/dùng biến ngoài `variables` (bước 6) | Cấu hình author | Ném lỗi tự nhiên từ `boolean-core.js`, không catch |
| `netlist` sai hình dạng JSON (bước 3) | Netlist learner | Graceful, `score: 0`, 1 check `structure-invalid-netlist` |
| `netlist` sai topology — dangling/multi-source/loop/... (bước 4) | Netlist learner | Graceful, `score: 0`, 1 check / lỗi từ `validateTopology` |
| `netlist`'s tập I/O không khớp `testbench` (bước 5) | Netlist learner | Graceful, `score: 0`, 1-2 check `structure-*-mapping` |

**Id check hợp lệ (đúng ví dụ thật `SPEC.md` §7):** `case-${index.toString(2).padStart(variables.length, '0')}-${tênOutput.toLowerCase()}` — ví dụ 2 biến, `index=3` (`'11'`), output tên `"Carry"` → id `case-11-carry`, khớp byte-for-byte ví dụ trong `SPEC.md`.

## `KHÔNG LÀM`

- Không sửa `boolean-grader.js` — không thêm `'circuit'` vào `validateExercise`'s mode list, không thêm nhánh `gradeCircuit` vào `gradeActivity`, không import `circuit-grader.js` từ đó. Việc nối dây orchestrator là phạm vi một task tích hợp sau (xem "Bối cảnh đã xác minh"), không phải E03.
- Không sửa `schema-lifecycle.js` — không thêm `'circuit'` vào `AUTHORING_MODES`, không viết validation `authoring`/`answer` cho mode circuit. Gap đã xác nhận tồn tại nhưng đóng nó không phải việc của E03.
- Không sửa `edition/electronics-logic.js`, `export/electronics-logic.js`, `export/electronics-logic-grader.bundle.js` — cùng lý do, chưa có nhánh `mode==='circuit'` nào ở các file này, không phải việc của E03.
- Không sửa `core/circuit-netlist.js` hay `core/circuit-engine.js` — đã đóng băng ở E01/E02; E03 chỉ `require()` và dùng, không đổi field/hàm/message nào trong đó.
- Không tạo fixture half-adder chuẩn (tên node/biến gợi ý `sum`/`carry`, tên file `half-adder*`) — đó là E04. Dùng tên output trung tính (vd `P`, `Q`) trong test của E03.
- Không cài NAND/NOR/XNOR — LOG-10, P1 không phải P0.
- Không đụng UI/canvas/SVG — đó là U01/U02.
- Không validate id node trùng lặp giữa các biến/output khác nhau trong testbench (vd hai biến khác nhau cùng trỏ một node `INPUT`) — ngoài phạm vi khóa của E03, coi là trách nhiệm author, không thêm test hay code path cho ca này.
- Không thêm nhánh phòng thủ cho `propagate(...).ok === false` sau khi `validateTopology` đã pass — bất biến đã chứng minh ở "Bối cảnh đã xác minh" (cùng lời gọi `topologicalSort` nội bộ); thêm nhánh đó tạo dead code không thể test hợp lệ, làm giảm coverage giả tạo mà không tăng độ an toàn thật.
- Không throw cho 3 loại lỗi netlist-của-learner (hình dạng JSON, topology, I/O mapping) — bắt buộc trả graceful `{score:0, checks:[...]}` đúng bảng phân loại đã khóa. Không lẫn lộn với lỗi cấu hình testbench (throw).
- Không thêm file mới vào thư mục `fixtures/` — dùng literal inline trong `circuit-grader.test.js`.
- Không chạy `bun run bundle:resources` — `circuit-grader.js` không nằm trong đồ thị `require()` của entrypoint bundle nào hiện tại (chưa được `boolean-grader.js` gọi tới).
- Không chạm `translations/**`, không chạy `make translations` — E03 không có chuỗi UI nào (không DOM).

## `ACCEPTANCE` (quan sát được)

1. Testbench hợp lệ + mạch AND đơn giản (2 `INPUT`, 1 `AND`, 1 `OUTPUT`), `expected.P = 'A AND B'` → cả 4 checks `passed: true`, `score === maxScore`, id đúng `case-00-p`/`case-01-p`/`case-10-p`/`case-11-p`.
2. Cùng mạch, testbench khai **sai** biểu thức (`expected.P = 'A OR B'`) → đúng 2/4 checks `passed: false` (`case-01-p`, `case-10-p`, vì AND=[0,0,0,1] khác OR=[0,1,1,1] tại 2 hàng giữa), 2/4 `passed: true` (`case-00-p`, `case-11-p`); mỗi check sai có đúng `expected`/`actual` (vd `case-01-p`: `expected:'1', actual:'0'` — `expected` lấy từ biểu thức OR do testbench khai, `actual` lấy từ mạch AND thật); với `maxScore=10` → `score === 5`.
3. Mạch 1 biến (1 `INPUT`, 1 `NOT`, 1 `OUTPUT`, `testbench.variables = ['A']`) → đúng 2 checks (`case-0-*`, `case-1-*`) — chứng minh thuật toán không hardcode 2 biến.
4. Testbench với 2 output trên cùng 1 mạch 2 output thật (vd `P = A XOR B`, `Q = A AND B`) → `checks` có đủ cả nhóm `*-p` và `*-q` cho mỗi tổ hợp, tổng số checks = `2^n × 2`.
5. `netlist` sai hình dạng JSON (vd thiếu `schemaVersion` hoặc `schemaVersion` sai giá trị) → `gradeCircuitResponse` **không throw**, trả `{ score: 0, checks: [{ id: 'structure-invalid-netlist', passed: false, expected: 'valid-netlist-shape', actual: <error.message thật> }] }`.
6. `netlist` sai topology — test **ít nhất 2 loại** lỗi khác nhau từ `validateTopology` (vd `danglingInputPin` bằng cách bỏ trống 1 chân gate, và `combinationalLoop` bằng ca tự-nối tái dùng từ E01/E02) → **không throw**, trả `{ score: 0, checks: [...] }` với đúng số lượng và đúng `code` từng lỗi map từ `validateTopology(model).errors`.
7. `testbench.inputs` không khớp đúng tập node `INPUT` thật của netlist — test ít nhất 2 dạng: (a) netlist có `INPUT` không được testbench khai, (b) `testbench.inputs` trỏ tới 1 id không tồn tại hoặc tồn tại nhưng sai `kind` (khác `INPUT`) → **không throw**, trả `{ score: 0, checks: [{ id: 'structure-input-mapping', ... }] }`.
8. `testbench.outputs` không khớp đúng tập node `OUTPUT` thật của netlist (cùng 2 dạng như câu 7) → **không throw**, trả `{ score: 0, checks: [{ id: 'structure-output-mapping', ... }] }`.
9. Testbench sai hình dạng — test ít nhất 3 dạng: `variables` rỗng hoặc chứa biến ngoài A-D hoặc trùng lặp; `inputs`/`outputs` thiếu key hoặc sai kiểu; `expected` thiếu key so với `outputs` → `gradeCircuitResponse` **ném** `TypeError('Testbench không hợp lệ.')` cho mọi dạng.
10. `maxScore` không hợp lệ (test cả 4 giá trị: `0`, số âm, `NaN`, chuỗi không phải number) → ném `TypeError('Điểm tối đa không hợp lệ.')`.
11. Id check khớp byte-for-byte ví dụ thật trong `SPEC.md` §7: mạch 2 biến, output tên `"Carry"`, tổ hợp `A=1,B=1` (`index=3`) → id chính xác `case-11-carry`.
12. Gọi `gradeCircuitResponse` hai lần với cùng `{netlist, testbench, maxScore}` → hai kết quả `{score, checks}` deep-equal nhau (determinism, đúng `SPEC.md` §9).
13. Hợp đồng module: `circuit-grader.js` chỉ `require()` đúng `circuit-netlist.js` + `circuit-engine.js` + `boolean-core.js` (không `kmap-*.js`/`schema-lifecycle.js`), export đóng băng `{ gradeCircuitResponse }`, không `eval`/`Function`, không chạm `document`/`window`/`electron`.

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-grader.test.js

# Core không được đỏ sau E03 (gồm circuit-netlist.test.js của E01 và circuit-engine.test.js của E02, phải vẫn xanh nguyên)
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend đầy đủ
npx vitest run public/files/perm/idevices/base/electronics-logic

# Lint — dùng bunx trực tiếp, KHÔNG dùng bare `npx biome` (npx biome tải nhầm package
# `biome@0.3.3` không liên quan trên npm, không phải @biomejs/biome của repo này — đã xác nhận ở
# lần verify E01/E02)
bunx @biomejs/biome check \
  public/files/perm/idevices/base/electronics-logic/core/circuit-grader.js \
  public/files/perm/idevices/base/electronics-logic/core/circuit-grader.test.js
```

**Ghi chú `make fix`** (như E01/E02): Windows/Git Bash hiện tại không có `make`; kể cả có, `make fix`/`make lint` không phủ `public/files/perm/idevices/**`. Dùng lệnh `bunx @biomejs/biome check` ở trên thay thế, ghi rõ trong báo cáo.

**Ghi chú coverage** (như E01/E02): coverage mặc định của `vitest.config.mts` chỉ bao `public/app/**/*.js`, không bao `public/files/perm/**` — muốn số coverage thật cho `circuit-grader.js` phải override `--coverage.include` qua CLI, vd:

```bash
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-grader.test.js \
  --coverage --coverage.include='public/files/perm/idevices/base/electronics-logic/core/circuit-grader.js' \
  --coverage.exclude='**/*.test.js'
```

Nếu gặp `EPERM`/file lock trên `./coverage/vitest` (đã gặp ở lần verify E01, không liên quan tới code), đổi `--coverage.reportsDirectory` sang một thư mục tạm khác.

Kỳ vọng: Vitest xanh cho `circuit-grader.test.js` và toàn bộ `core/`/regression frontend không đổi kết quả so với trước E03 (E03 không sửa file nào khác ngoài 2 file mới); lint sạch; coverage ≥ 90% (NFR-05) trên `circuit-grader.js`. **Không** chạy `bun x playwright test` — chưa có UI/E2E nào liên quan tới circuit.

## `ĐẦU RA`

- `git diff --stat`/`git status` chỉ chạm đúng 2 file mới (`core/circuit-grader.js`, `core/circuit-grader.test.js`) + `.ai/packets/E03-testbench-grading.md`. Không file nào khác bị đổi — **kể cả không đổi `core/circuit-netlist.js`, `core/circuit-engine.js`, `core/boolean-core.js`, `core/boolean-grader.js`, `core/schema-lifecycle.js`**.
- Output test đầy đủ (pass/fail, số ca) cho `circuit-grader.test.js`, và xác nhận `npx vitest run public/files/perm/idevices/base/electronics-logic` cho tổng số ca **không giảm** so với baseline trước E03 (313 bài sau E02, xem `repo-map.md` mục E02 — dán số tổng trước/sau).
- Dán trực tiếp output thật (không mock) của cả 13 `ACCEPTANCE` ở trên — đặc biệt ACCEPTANCE 2 (dán JSON `checks` đầy đủ kèm số điểm tính ra), ACCEPTANCE 6/7/8 (dán JSON kết quả graceful từng loại lỗi cấu trúc) và ACCEPTANCE 11 (xác nhận id chính xác `case-11-carry`).
- Số coverage thật (không phải số 0% mặc định) cho `circuit-grader.js`, kèm lệnh CLI override đã dùng.
- Trạng thái gate `G-E0`: nêu rõ E03 **chưa** đóng được gate (`G-E0` cần cả E04 — half-adder netlist đạt 4/4 bằng test thật, dùng chính `circuit-grader.js` này). E03 là nền tảng thứ ba trên ba của "Ngày 7" — cơ chế chấm điểm testbench đã đầy đủ và tự kiểm định (LOG-07 hình dạng dữ liệu + LOG-08 chạy mọi tổ hợp/trả bằng chứng), nhưng **chưa** có bằng chứng nào dùng fixture half-adder thật (đó là E04). Không tuyên bố AT-07 đã đạt — AT-07 cần E04. Không tuyên bố `circuit-grader.js` đã được gọi từ pipeline chấm điểm thật (`boolean-grader.js` chưa nối dây) — nêu rõ đây là quyết định phạm vi có chủ ý, không phải thiếu sót bị bỏ quên.
