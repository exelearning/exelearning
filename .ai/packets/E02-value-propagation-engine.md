# Task Packet — E02: Engine `0/1/X`

- `TASK`: E02 — Engine `0/1/X` (nguồn: `PLAN.md` §5.6 "E — Circuit Engine", dòng 158, 4 giờ, phụ thuộc E01). Task thứ hai của domain Circuit, nằm trong cụm "Ngày 7 — Circuit Engine" (E01→E02→E03) trước khi E04+U01/U02 mở khóa ở Gate `G-E0` (`PLAN.md` dòng 228).
- `SPEC`: LOG-04 (`SPEC.md` §6.5, dòng 259) — **phần lan truyền giá trị `0/1/X` qua cổng** (phần topo-sort/phát hiện vòng lặp tĩnh đã xong ở E01; E02 làm phần còn lại: tính giá trị thật khi *chạy* mạch, và tự phát hiện vòng lặp một lần nữa ở thời điểm chạy vì `propagate` cần tự gọi `topologicalSort` để biết thứ tự tính). LOG-05 (dòng 260) **một phần** — E02 chỉ cung cấp hàm `propagate` thuần, gọi lại được nhiều lần với assignment mới; phần "cập nhật Output/LED không reload" trên UI là việc của U01/U02, không phải E02. `SPEC.md` §7 dòng cuối (ngữ nghĩa `X`) — E02 là nơi giá trị `X` thực sự được *gán* lần đầu (E01 chỉ báo lỗi cấu trúc, không gán giá trị gì). `SPEC.md` §8 dòng 340 ("Cùng evaluator dùng cho expression, table, K-map và gate truth function") — xem quyết định thiết kế bắt buộc ở mục "Bối cảnh đã xác minh". NFR-05 (`SPEC.md` §10) — branch coverage ≥ 90%.
- `SKILLS`: `exelearning-logic-alpha` (domain/gate G-E0), `test-driven-development` (BẮT BUỘC Red-Green-Refactor thật cho `circuit-engine.js` — thuật toán/bảng chân trị thuần túy, không DOM).
- `MUC TIEU`: Module mới `core/circuit-engine.js` (CommonJS thuần, không DOM), `require('./circuit-netlist.js')` để dùng lại `GATE_PINS`/`topologicalSort` của E01 (không viết lại). Cung cấp: (1) `SIGNAL_VALUES` — hằng số đóng băng `['0', '1', 'X']`, nguồn chân lý cho giá trị tín hiệu circuit; (2) `evaluateGate(kind, inputValues)` — hàm chân trị 3-giá cho 4 loại cổng có tính toán (`NOT`/`AND`/`OR`/`XOR`), theo luật lan truyền `X` chuẩn (dominant-value); (3) `propagate(model, inputAssignment)` — hàm chính: nhận netlist đã qua `parseNetlist`, một assignment gán giá trị cho từng node `INPUT`, chạy `topologicalSort` nội bộ, trả lỗi vòng lặp nếu có (không throw, không crash — đúng nửa "runtime" của AT-08), ngược lại đi qua từng node theo đúng thứ tự topo và trả giá trị mọi chân (input lẫn output) của mọi node.
- `ĐẦU RA`: thuật toán/bảng chân trị thuần túy trong module mới `core/circuit-engine.js` — không DOM, phụ thuộc **duy nhất** `circuit-netlist.js` (E01, cùng domain Circuit), không phụ thuộc `boolean-core.js`/`kmap-*.js`/`schema-lifecycle.js` ở runtime. Chưa có consumer nào gọi tới (E03/U01/U02 sẽ `require()` ở task sau). Không đổi bất kỳ file hiện có nào, kể cả `circuit-netlist.js` — E02 chỉ dùng API đã đóng băng của E01, không sửa thiết kế đó.

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

- **`circuit-engine.js` chưa tồn tại** — đã `find` toàn bộ `electronics-logic/` theo tên `circuit-engine`/`propagate`/`evaluateGate`: 0 kết quả. Clean slate, không có code cũ phải tương thích ngược.
- **E01 (`core/circuit-netlist.js`) đã xong và được PM/tester xác minh độc lập** (xem mục "E01 Netlist validation/topology evidence" ở `repo-map.md`, viết cùng ngày trước packet này): export đúng 4 thứ — `GATE_PINS` (bảng hằng số 6 loại node → `{inputs, outputs}`, đã đóng băng sâu), `parseNetlist(raw)`, `validateTopology(model)`, `topologicalSort(model)`. Chữ ký đã xác nhận bằng cách đọc trực tiếp source: `topologicalSort(model)` trả `{ok:true, order:[nodeId,...]}` hoặc `{ok:false, cycle:[nodeId,...]}`; cạnh đồ thị là `wire.from.node → wire.to.node`, tự bỏ qua cạnh trỏ tới node không tồn tại (không crash). E02 gọi thẳng `topologicalSort` từ đây, không tự viết lại.
- **`boolean-core.js`'s `evaluate()` KHÔNG dùng trực tiếp được cho E02** — đã đọc `evaluateNode` (dòng 364-374) và `variableValue` (dòng 353-362): hàm này thao tác trên **AST node** (`node.type`/`node.left`/`node.right`/`node.operator`, không phải `(a, b) => value` đơn giản), và `variableValue` **ném `TypeError`** nếu giá trị biến khác đúng `0`/`1` số học — không có chỗ nào chấp nhận `'X'`. Gọi trực tiếp hàm này cho gate truth function 3-giá là không khả thi mà không sửa `boolean-core.js` (bị cấm — xem `KHÔNG LÀM`). `SPEC.md` §8 "cùng evaluator... gate truth function" được thỏa mãn bằng **test đối chiếu chéo** (xem `ACCEPTANCE` 4), không phải bằng `require()` runtime — đây là quyết định thiết kế khóa của packet này, không tự đổi sang gọi thẳng `boolean-core.js` từ `circuit-engine.js`.
- **Chuỗi `'0'/'1'/'X'` (string) đã có tiền lệ trong domain Boolean** — `core/boolean-grader.js` dòng 7: `SUPPORTED_VALUES = Object.freeze(['0', '1', 'X'])`, dùng ở ranh giới learner-response/so sánh (khác với `evaluate()` nội bộ dùng số `0`/`1`). E02 dùng đúng vocabulary string này cho `SIGNAL_VALUES` — nhất quán với codebase hiện có, không phải phát minh mới. Đây cũng là lý do `SIGNAL_VALUES` của E02 và `dontCares`/truth-vector `'X'` của Boolean Core **không xung đột kiểu dữ liệu** dù dùng chung ký tự `'X'`: hai field hoàn toàn tách biệt ở hai module không phụ thuộc nhau (đúng yêu cầu "type/field riêng" của `SPEC.md` §7 dòng cuối).
- **Không cần rebuild bundle** — cùng lý do như E01: `circuit-engine.js` không nằm trong đồ thị `require()` của bất kỳ entrypoint bundle nào hiện tại.

## `FILE ĐƯỢC SỬA` (2 file mới + packet)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/circuit-engine.js` | **File mới.** CommonJS thuần, không DOM. `require('./circuit-netlist.js')` — **chỉ file này**, không `require()` `boolean-core.js`/`kmap-*.js`/`schema-lifecycle.js`. Export đóng băng: `SIGNAL_VALUES`, `evaluateGate`, `propagate`. Thiết kế khóa ở mục dưới. |
| `public/files/perm/idevices/base/electronics-logic/core/circuit-engine.test.js` | **File mới.** TDD thật (Red-Green-Refactor). Phủ mọi ca ở `ACCEPTANCE`. Được phép `require('./boolean-core.js')` **chỉ** cho test đối chiếu chéo (`ACCEPTANCE` 4) — đây là ngoại lệ áp dụng riêng cho file test, không áp dụng cho `circuit-engine.js`. Fixture nhỏ khai literal inline, không thêm file vào `fixtures/`. |
| `.ai/packets/E02-value-propagation-engine.md` | Packet này. |

## Thiết kế khóa (chốt trong E02 — không tự thiết kế lại tên field/bảng chân trị)

**`SIGNAL_VALUES`** — `Object.freeze(['0', '1', 'X'])`. Mọi giá trị tín hiệu trong `circuit-engine.js` là một trong ba string này, không dùng số học (khác `boolean-core.js`).

**`evaluateGate(kind, inputValues)`** — chỉ nhận `kind` ∈ `{'NOT', 'AND', 'OR', 'XOR'}` (4 loại có `GATE_PINS[kind].outputs` không rỗng); gọi với `'INPUT'`/`'OUTPUT'` → ném `TypeError` tiếng Việt (hai loại này không có bảng chân trị — giá trị của chúng do `propagate` xử lý theo cách khác, xem dưới). `inputValues` là mảng giá trị `SIGNAL_VALUES`, **đúng thứ tự** `GATE_PINS[kind].inputs` (vd `AND`: `inputValues[0]` = chân `a`, `inputValues[1]` = chân `b`). Bảng chân trị khóa (luật giá trị áp đảo — dominant value):

`NOT` (1 chân vào):

| `a` | `NOT` |
|---|---|
| `0` | `1` |
| `1` | `0` |
| `X` | `X` |

`AND` (áp đảo là `0`):

| `a` | `b` | `AND` |
|---|---|---|
| `0` | `0`/`1`/`X` | `0` |
| `X`/`1` | `0` | `0` |
| `1` | `1` | `1` |
| `1` | `X` | `X` |
| `X` | `1` | `X` |
| `X` | `X` | `X` |

`OR` (áp đảo là `1`):

| `a` | `b` | `OR` |
|---|---|---|
| `1` | `0`/`1`/`X` | `1` |
| `X`/`0` | `1` | `1` |
| `0` | `0` | `0` |
| `0` | `X` | `X` |
| `X` | `0` | `X` |
| `X` | `X` | `X` |

`XOR` (không có giá trị áp đảo — hễ có một chân `X` thì kết quả luôn `X`):

| `a` | `b` | `XOR` |
|---|---|---|
| `0` | `0` | `0` |
| `0` | `1` | `1` |
| `1` | `0` | `1` |
| `1` | `1` | `0` |
| `X` | bất kỳ | `X` |
| bất kỳ | `X` | `X` |

**`propagate(model, inputAssignment)`** — `model` đã qua `parseNetlist` (không tự validate lại hình dạng). `inputAssignment` là object thường, key = id của node `kind: 'INPUT'`, value **nếu có mặt** phải là đúng một trong `SIGNAL_VALUES` (`'0'`/`'1'`/`'X'`, string) — value khác 3 giá trị này (vd số `1`, chuỗi `'2'`) → ném `TypeError` tiếng Việt. **Key vắng mặt trong `inputAssignment` không phải lỗi** — node `INPUT` đó nhận giá trị `'X'` mặc định (tín hiệu chưa xác định, đúng ngữ nghĩa `SPEC.md` §7). Key không khớp id node `INPUT` nào trong `model` bị bỏ qua (permissive, cùng tinh thần `parseNetlist`).

Thuật toán: gọi `topologicalSort(model)` trước. Nếu `ok:false` → trả ngay `{ ok: false, error: { code: 'combinationalLoop', path: 'nodes[' + cycle.join(',') + ']', message: 'Mạch có vòng lặp tổ hợp, không thể xác định thứ tự tính toán.' } }` (copy đúng nguyên văn message của `circuit-netlist.js` — nhất quán trong toàn domain Circuit), không throw, không crash. Nếu `ok:true`, duyệt `order` theo đúng thứ tự, với mỗi node:
- `kind === 'INPUT'`: giá trị chân `out` = giá trị đã resolve từ `inputAssignment` theo luật trên.
- `kind === 'OUTPUT'`: giá trị chân `a` = giá trị đã tính của chân nguồn nối tới nó qua wire (tra `model.wires` tìm wire có `to.node === node.id`); node `OUTPUT` không có `outputs` nên không tính gì thêm.
- `kind` khác (`NOT`/`AND`/`OR`/`XOR`): với mỗi chân trong `GATE_PINS[kind].inputs`, tra wire có `to: {node: node.id, pin}` để lấy giá trị chân nguồn (đã tính sẵn vì đứng trước trong `order`); gọi `evaluateGate(kind, inputValues)` để tính chân `out`.

**Tiền điều kiện của `propagate` (phạm vi cắt rõ ràng — không tự mở rộng):** hàm này giả định `model` đã `validateTopology` hợp lệ (`valid: true`) **ngoại trừ khả năng có vòng lặp**, vì vòng lặp là chính `propagate` tự phát hiện qua `topologicalSort` nội bộ (bắt buộc để biết thứ tự tính, không phải tính năng phụ). Hành vi của `propagate` trên một `model` có lỗi cấu trúc khác (`danglingInputPin`, `multipleSources`, `unknownNodeReference`, `unknownPin`, `wireDirectionMismatch`) **không được test hay định nghĩa ở E02** — pipeline đúng là caller gọi `validateTopology` trước, chỉ gọi `propagate` khi `valid: true`. Đây là việc của E03/U01/U02 khi ráp pipeline thật, không phải việc tự phòng thủ thêm ở E02.

**Giá trị trả về khi thành công:** `{ ok: true, values: { 'nodeId.pin': SIGNAL_VALUES, ... } }` — **mọi** chân (cả `inputs` lẫn `outputs`) của **mọi** node trong `model.nodes`, key dạng `"<nodeId>.<pin>"` (dấu chấm, dễ đọc — khác quy ước `\0` nội bộ của `circuit-netlist.js`, vì đây là API công khai cho E03/U01/U02 dùng trực tiếp, không phải cấu trúc nội bộ). Ví dụ: mạch `in-a`→`xor-1`, `values['in-a.out']`, `values['xor-1.a']`, `values['xor-1.b']`, `values['xor-1.out']` đều phải có mặt.

**Determinism (`SPEC.md` §9 dòng "Cùng input và engine version luôn cho cùng kết quả"):** `propagate` không được có side-effect hay trạng thái ẩn — cùng `model`+`inputAssignment` gọi bao nhiêu lần cũng phải ra đúng `values` giống hệt nhau.

## `KHÔNG LÀM`

- Không viết testbench/chấm điểm (map I/O, chạy mọi tổ hợp tự động, `GradingResult` với `score`/`checks`/`attemptId`) — đó là E03.
- Không tạo fixture half-adder chuẩn — đó là E04, không tạo file tên `half-adder*`.
- Không cài NAND/NOR/XNOR vào `evaluateGate` hay bất kỳ đâu — LOG-10, P1 không phải P0.
- Không đụng UI/canvas/SVG, không tự động re-render hay lắng nghe sự kiện input đổi — đó là U01/U02. `propagate` là hàm thuần, UI tự gọi lại khi cần (LOG-05 phần "không reload" là trách nhiệm của U01/U02 gọi `propagate` đúng lúc, không phải của E02).
- Không sửa `core/circuit-netlist.js` — thiết kế đã đóng băng ở E01; E02 chỉ `require()` và dùng, không đổi field/hàm/message nào trong đó dù có lý do "cải thiện".
- Không `require()` `core/boolean-core.js`, `core/kmap-*.js`, `core/schema-lifecycle.js` từ **`circuit-engine.js`** (file nguồn). Ngoại lệ hẹp: **`circuit-engine.test.js`** được phép `require('./boolean-core.js')` riêng cho test đối chiếu chéo `ACCEPTANCE` 4 — không mở rộng ngoại lệ này sang các file khác hay sang chính `circuit-engine.js`.
- Không sửa `edition/electronics-logic.js`, `export/electronics-logic.js`, `export/electronics-logic-grader.bundle.js` — chưa có nhánh `mode==='circuit'` nào ở đây, không phải việc của E02.
- Không chạy `bun run bundle:resources` — `circuit-engine.js` không nằm trong đồ thị `require()` của entrypoint bundle nào hiện tại.
- Không gán `globalThis.$electronicsLogicCircuitEngine` (hay tên tương tự) — chưa có consumer thật; để dành cho E03/U01/U02.
- Không thêm file mới vào thư mục `fixtures/` — dùng literal inline trong `circuit-engine.test.js`.
- Không tự phòng thủ/định nghĩa hành vi cho `model` có lỗi cấu trúc phi-vòng-lặp (xem "Tiền điều kiện của `propagate`" ở trên) — không thêm test hay code path cho trường hợp đó, giữ phạm vi đúng như đã khóa.
- Không chạm `translations/**`, không chạy `make translations` — E02 không có chuỗi UI nào (không DOM).

## `ACCEPTANCE` (quan sát được)

1. `evaluateGate('NOT', ['0'])` → `'1'`; `evaluateGate('NOT', ['1'])` → `'0'`; `evaluateGate('NOT', ['X'])` → `'X'`.
2. `evaluateGate('AND', [...])` và `evaluateGate('OR', [...])` đúng bảng chân trị áp đảo ở trên cho **toàn bộ 9 tổ hợp** `{'0','1','X'} × {'0','1','X'}` mỗi cổng (test dạng bảng/`it.each`, không chỉ vài ca rời rạc).
3. `evaluateGate('XOR', [...])` đúng bảng ở trên cho toàn bộ 9 tổ hợp — đặc biệt xác nhận `XOR` **không có** giá trị áp đảo (`evaluateGate('XOR', ['0','X'])` → `'X'`, khác hẳn `AND`/`OR`).
4. **Đối chiếu chéo với `boolean-core.js`**: với mọi tổ hợp `'0'`/`'1'` (không `'X'`) trên cả 4 cổng, kết quả `evaluateGate` khớp đúng kết quả `core.evaluate('a AND b', {a: Number(a), b: Number(b)})` (và tương tự cho `OR`/`XOR`/`NOT a`) từ `require('./boolean-core.js')` — thỏa `SPEC.md` §8 "cùng evaluator" bằng test, không bằng runtime dependency.
5. `evaluateGate('INPUT', [])` và `evaluateGate('OUTPUT', ['0'])` đều ném `TypeError`.
6. `propagate(model, assignment)` trên mạch hợp lệ (2 `INPUT` `in-a`/`in-b` + 1 `XOR` nối đủ 2 chân + 1 `OUTPUT` nối chân `out` của XOR), `assignment` đủ cả 2 input → `values['out-1.a']` đúng bằng XOR(a,b) cho **cả 4 tổ hợp** `{0,1}×{0,1}`.
7. `propagate` trên cùng mạch nhưng `assignment` **thiếu** key `in-b` → `values['in-b.out'] === 'X'`, và giá trị lan truyền đúng luật áp đảo tới `xor-1.out`/`out-1.a` (ví dụ `in-a` = `'1'` → XOR với `X` → kết quả `'X'`, không phải lỗi).
8. `propagate` trên mạch có vòng lặp tổ hợp (tái dùng ca tự-nối của E01: `NOT` node nối `out` ngược vào chính chân `a`) → trả `{ok: false, error: {code: 'combinationalLoop', ...}}`, không throw, không crash.
9. `propagate` với `assignment` có value không hợp lệ cho một key có mặt (vd số `1` thay vì chuỗi `'1'`, hoặc chuỗi `'2'`) → ném `TypeError` tiếng Việt.
10. `propagate` trả `values` chứa đúng **mọi** chân (input lẫn output) của **mọi** node trong mạch — không chỉ node cuối cùng — đối chiếu số lượng key với tổng số chân theo `GATE_PINS`.
11. Gọi `propagate` hai lần với cùng `model`+`assignment` → hai kết quả `values` deep-equal nhau (determinism).
12. Không có test nào chạm DOM/`window`/`document`; `circuit-engine.js` là CommonJS thuần, export đóng băng, không `eval`/`Function`, không `require()` `boolean-core.js`/`kmap-*.js`/`schema-lifecycle.js` (chỉ `circuit-netlist.js`).

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-engine.test.js

# Core không được đỏ sau E02 (gồm cả circuit-netlist.test.js của E01, phải vẫn xanh nguyên)
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend đầy đủ
npx vitest run public/files/perm/idevices/base/electronics-logic

# Lint — dùng bunx trực tiếp, KHÔNG dùng bare `npx biome` (npx biome tải nhầm package
# `biome@0.3.3` không liên quan trên npm, không phải @biomejs/biome của repo này — đã xác nhận ở
# lần verify E01, 2026-08-14)
bunx @biomejs/biome check \
  public/files/perm/idevices/base/electronics-logic/core/circuit-engine.js \
  public/files/perm/idevices/base/electronics-logic/core/circuit-engine.test.js
```

**Ghi chú `make fix`** (như E01): Windows/Git Bash hiện tại không có `make`; kể cả có, `make fix`/`make lint` không phủ `public/files/perm/idevices/**`. Dùng lệnh `bunx @biomejs/biome check` ở trên thay thế, ghi rõ trong báo cáo.

**Ghi chú coverage** (như E01): coverage mặc định của `vitest.config.mts` chỉ bao `public/app/**/*.js`, không bao `public/files/perm/**` — muốn số coverage thật cho `circuit-engine.js` phải override `--coverage.include` qua CLI, vd:

```bash
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-engine.test.js \
  --coverage --coverage.include='public/files/perm/idevices/base/electronics-logic/core/circuit-engine.js' \
  --coverage.exclude='**/*.test.js'
```

Nếu gặp `EPERM`/file lock trên `./coverage/vitest` (đã gặp ở lần verify E01, không liên quan tới code), đổi `--coverage.reportsDirectory` sang một thư mục tạm khác.

Kỳ vọng: Vitest xanh cho `circuit-engine.test.js` và toàn bộ `core/`/regression frontend không đổi kết quả so với trước E02 (E02 không sửa file nào khác ngoài 2 file mới); lint sạch; coverage ≥ 90% (NFR-05) trên `circuit-engine.js`. **Không** chạy `bun x playwright test` — chưa có UI/E2E nào liên quan tới circuit.

## `ĐẦU RA`

- `git diff --stat`/`git status` chỉ chạm đúng 2 file mới (`core/circuit-engine.js`, `core/circuit-engine.test.js`) + `.ai/packets/E02-value-propagation-engine.md`. Không file nào khác bị đổi — **kể cả không đổi `core/circuit-netlist.js`**.
- Output test đầy đủ (pass/fail, số ca) cho `circuit-engine.test.js`, và xác nhận `npx vitest run public/files/perm/idevices/base/electronics-logic` cho tổng số ca **không giảm** so với baseline trước E02 (278 bài, xem `repo-map.md` mục E01 — dán số tổng trước/sau).
- Dán trực tiếp output thật (không mock) của cả 12 `ACCEPTANCE` ở trên — đặc biệt ACCEPTANCE 4 (đối chiếu chéo `boolean-core.js`, dán số ca đã so sánh), ACCEPTANCE 7 (lan truyền `X` qua mạch thiếu 1 input, dán JSON `values` đầy đủ) và ACCEPTANCE 8 (dán JSON kết quả `combinationalLoop` khi chạy `propagate` trên mạch có vòng lặp).
- Số coverage thật (không phải số 0% mặc định) cho `circuit-engine.js`, kèm lệnh CLI override đã dùng.
- Trạng thái gate `G-E0`: nêu rõ E02 **chưa** đóng được gate (`G-E0` cần cả E03+E04 — half-adder netlist đạt 4/4 bằng test); E02 chỉ là nền tảng thứ hai trên ba của "Ngày 7". Không tuyên bố AT-07/AT-08 đã đạt đầy đủ — AT-07 (half-adder 4/4) cần E04; AT-08 (circuit errors reported, không crash) phần tĩnh đã đạt ở E01, phần "không crash khi chạy mạch có vòng lặp" đạt ở E02 (`ACCEPTANCE` 8), nhưng phần pin-treo/nhiều-nguồn "không crash lúc chạy" vẫn ngoài phạm vi E02 theo đúng "Tiền điều kiện của `propagate`" đã khóa ở trên.
