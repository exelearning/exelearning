# Task Packet — E04: Half-adder fixture

- `TASK`: E04 — Half-adder fixture (nguồn: `PLAN.md` §5.6 "E — Circuit Engine", dòng 160, 2 giờ, phụ thuộc E03). Task cuối của domain Circuit trong cụm "Ngày 8 — Half-adder và node UI" (`PLAN.md` dòng 225-228: "E04, U01 và U02... Gate `G-E0` giữa ngày; sau đó mới được làm node/wire UI"). E01 (netlist/topology), E02 (engine `0/1/X`) và E03 (testbench/grading) đã xong, đã được PM/tester xác minh độc lập (xem các mục "E01 Netlist validation/topology evidence", "E02 Engine 0/1/X evidence", "E03 Testbench/grading evidence" ở `repo-map.md`). E04 là task **duy nhất** còn thiếu để đóng gate `G-E0`.
- `SPEC`: LOG-09 (`SPEC.md` dòng 264) — "Half-adder Sum=`A XOR B`, Carry=`AB` đạt 4/4 hoàn toàn offline" — đây **chính là** yêu cầu E04 phải chứng minh bằng test thật, không phải mô tả UI. `PLAN.md` dòng 89 — gate `G-E0`: "Half-adder netlist đạt 4/4 bằng test, loop/dangling được báo" — khớp đúng 3 mệnh đề DoD của E04 (`PLAN.md` dòng 160): "Netlist đúng đạt 4/4; thiếu/sai wire thất bại; lỗi cấu trúc không crash." `SPEC.md` dòng 396 — AT-07: "Half-adder đúng 4/4; tháo dây làm test thất bại" — E04, nếu qua xác minh độc lập, là bằng chứng đóng AT-07 (khác E01-E03, không task nào trong ba task đó tự đóng được AT-07). `SPEC.md` dòng 397 — AT-08: "Loop, pin treo, nhiều nguồn được báo và không crash" — đã được chứng minh **tổng quát** ở E01 (`circuit-netlist.test.js`) và E03 (`circuit-grader.test.js`'s ACCEPTANCE 6); E04 chỉ cần chứng minh **lại bằng chính fixture half-adder** cho đúng 1 loại lỗi cấu trúc (`danglingInputPin`, vì đây là loại lỗi khớp tự nhiên với "tháo dây" của AT-07) — không cần lặp lại `combinationalLoop`/`multipleSources` bằng half-adder riêng (xem "Bối cảnh đã xác minh" và `KHÔNG LÀM`). `SPEC.md` §7 dòng 296-307 — ví dụ netlist thật trong hợp đồng dữ liệu dùng chính node id `in-a`/`xor-1` — E04 dùng đúng quy ước đặt tên này, không tự nghĩ tên khác. NFR-05 (`SPEC.md` dòng 369) — branch coverage ≥ 90%; không áp dụng số mới cho E04 vì E04 không tạo module `.js` sản xuất nào (xem "Bối cảnh đã xác minh").
- `SKILLS`: `exelearning-logic-alpha` (domain/gate `G-E0`), `test-driven-development` (viết `circuit-half-adder.test.js` bằng Red-Green-Refactor thật: RED = test import fixture JSON chưa tồn tại/chưa đúng nội dung → fail; GREEN = tạo đúng fixture khóa ở "Thiết kế khóa").
- `MUC TIEU`: Thêm fixture half-adder chuẩn (`core/fixtures/circuit-half-adder.json`, netlist + testbench đúng LOG-09) và bộ test độc lập (`core/circuit-half-adder.test.js`) chứng minh — bằng `circuit-grader.js` (E03) **không sửa đổi** — ba hành vi khóa ở `PLAN.md` dòng 160: (1) mạch đúng đạt 4/4 (8/8 checks, `score === maxScore`); (2) mạch thiếu 1 dây → lỗi cấu trúc graceful (`danglingInputPin`), không throw, không crash; (3) mạch nối sai 1 dây (vẫn hợp lệ về topology) → chấm thiếu điểm chính xác tại đúng ca sai.
- `ĐẦU RA`: 1 file fixture JSON thuần dữ liệu + 1 file test CommonJS thuần (không DOM), không sửa bất kỳ file core nào đã đóng băng (`circuit-netlist.js`, `circuit-engine.js`, `circuit-grader.js`, `boolean-core.js`). Không nối dây UI/iDevice/orchestrator (đó là U01-U03/I01-I02, các task sau, phụ thuộc `G-E0`). Nếu toàn bộ `ACCEPTANCE` đạt và được PM/tester xác minh độc lập, đây là bằng chứng đề xuất đóng gate `G-E0` — việc **tuyên bố gate đóng** vẫn là quyết định của PM/tester sau khi tự tái lập, không phải của Codex (AGENTS.md §13 quy tắc 8: dừng ở gate gần nhất, không tự mở khóa U01/U02).

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

- **`core/fixtures/circuit-half-adder.json` chưa tồn tại** — đã `Glob` toàn bộ `electronics-logic/**/fixtures/**`: chỉ có `electronics-logic/fixtures/schema-v0.json`, `schema-v1.json`, `schema-v0-migrated.json` (fixture cho `schema-lifecycle.js`, không liên quan circuit) và `core/fixtures/boolean-syntax-v1.json` (fixture cú pháp Boolean, không phải netlist). Clean slate cho fixture circuit đầu tiên.
- **`circuit-netlist.js`'s `GATE_PINS` đã đọc lại dòng 3-10 (đóng băng từ E01, không đổi)**: `INPUT: {inputs:[], outputs:['out']}`, `OUTPUT: {inputs:['a'], outputs:[]}`, `NOT: {inputs:['a'], outputs:['out']}`, `AND: {inputs:['a','b'], outputs:['out']}`, `OR: {inputs:['a','b'], outputs:['out']}`, `XOR: {inputs:['a','b'], outputs:['out']}`. Half-adder chỉ cần `INPUT`, `XOR`, `AND`, `OUTPUT` — cả 4 kind đã có sẵn từ E02, không cần thêm kind mới.
- **`validateTopology`'s lỗi `danglingInputPin` đã đọc lại dòng 186-189 (đóng băng từ E01)**: `path` có dạng chính xác `` `nodes[${node.id}].inputs[${pin}]` `` (không phải `.` ngăn cách, mà `[...]`). Với node `and-1` thiếu dây vào chân `b` → `path === 'nodes[and-1].inputs[b]'` — khóa cứng giá trị này trong `ACCEPTANCE`, không phải suy đoán.
- **`circuit-grader.js`'s `gradeCircuitResponse` đã đọc lại toàn bộ 144 dòng (đóng băng từ E03, đã hash-verify byte-identical sau xác minh độc lập)** — hành vi graceful khi `!topology.valid`: `checks = topology.errors.map(e => ({id: 'structure-' + e.code, passed:false, expected:'valid-topology', actual:e.code, path:e.path}))`, `score:0`. Không throw. Đây chính là cơ chế E04 dùng cho ca "thiếu wire" — E04 **không viết code chấm điểm mới**, chỉ viết fixture + test gọi `gradeCircuitResponse` có sẵn.
- **Quy ước bit/id check đã khóa từ E03, tái xác nhận**: `bits = index.toString(2).padStart(variables.length, '0')`, `variables[0]` là bit cao nhất (MSB). Với `variables:['A','B']`, `index=2` → `bits='10'` → `A='1', B='0'`. Id check: `` `case-${bits}-${tênOutput.toLowerCase()}` ``.
- **Đã tự tính tay (không suy đoán) cả 3 kịch bản khóa dưới "Thiết kế khóa"** bằng cách mô phỏng đúng thuật toán `gradeCircuitResponse` (8 bước, xem mục "Thiết kế khóa" của packet E03) trên giấy — kết quả chính xác đã ghi cứng trong `ACCEPTANCE` bên dưới. PM/tester sẽ tái tính độc lập lần nữa khi xác minh, không chấp nhận chỉ vì Codex dán số ra.
- **Không có consumer nào gọi `circuit-grader.js`/`circuit-engine.js`/`circuit-netlist.js` ngoài file test của chính chúng** — `boolean-grader.js` vẫn chưa nối nhánh `mode==='circuit'` (xác nhận lại ở lần verify E03). E04 **không** thay đổi việc này — E04 vẫn ở tầng Core, chưa phải tầng UI/iDevice/orchestrator.
- **Không cần rebuild bundle** — cùng lý do E01-E03: không file nào trong đồ thị E04 nằm trong `require()` graph của bất kỳ entrypoint bundle nào hiện tại.
- **`boolean-core-contract.test.js` dùng cú pháp `import ... from './fixtures/xxx.json'` (ESM)**, nhưng đây là file khác domain (Boolean syntax, không phải Circuit). Toàn bộ 3 file Circuit hiện có (`circuit-netlist.test.js`, `circuit-engine.test.js`, `circuit-grader.test.js`) đều dùng `require()` (CommonJS thuần, đã xác nhận dòng đầu `circuit-grader.test.js`: `const { readFileSync } = require('node:fs');`, `const { gradeCircuitResponse } = require('./circuit-grader.js');`). E04 **phải** giữ nhất quán CommonJS với 3 file anh em trực tiếp này, không dùng `import` — `require('./fixtures/circuit-half-adder.json')` hoạt động tự nhiên trong CommonJS, không cần cấu hình thêm.

## `FILE ĐƯỢC SỬA` (2 file mới + packet)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/fixtures/circuit-half-adder.json` | **File mới.** Dữ liệu thuần (không code). Nội dung khóa byte-for-byte ở "Thiết kế khóa" — không tự đổi tên node/wire/id. |
| `public/files/perm/idevices/base/electronics-logic/core/circuit-half-adder.test.js` | **File mới.** CommonJS thuần (`require`, giống `circuit-grader.test.js`), không DOM. `require()` đúng `./circuit-grader.js` (và `./fixtures/circuit-half-adder.json`) — **không** `require()` trực tiếp `circuit-engine.js`/`circuit-netlist.js` (đi qua `circuit-grader.js` như mọi consumer khác, đúng lớp trừu tượng đã khóa từ E03). TDD thật, phủ đúng 3 `ACCEPTANCE`. |
| `.ai/packets/E04-halfadder-fixture.md` | Packet này. |

## Thiết kế khóa (chốt trong E04 — không tự đổi node id, wire id hay giá trị kỳ vọng)

**Nội dung `core/fixtures/circuit-half-adder.json` (khóa byte-for-byte cho phần `netlist`/`testbench`; field `schemaVersion`/`id` ở cấp fixture để mở, đặt tên hợp lý):**

```json
{
    "schemaVersion": 1,
    "id": "half-adder",
    "netlist": {
        "schemaVersion": 1,
        "nodes": [
            { "id": "in-a", "kind": "INPUT", "x": 40, "y": 40 },
            { "id": "in-b", "kind": "INPUT", "x": 40, "y": 160 },
            { "id": "xor-1", "kind": "XOR", "x": 200, "y": 40 },
            { "id": "and-1", "kind": "AND", "x": 200, "y": 160 },
            { "id": "sum-out", "kind": "OUTPUT", "x": 360, "y": 40 },
            { "id": "carry-out", "kind": "OUTPUT", "x": 360, "y": 160 }
        ],
        "wires": [
            { "id": "w1", "from": { "node": "in-a", "pin": "out" }, "to": { "node": "xor-1", "pin": "a" } },
            { "id": "w2", "from": { "node": "in-b", "pin": "out" }, "to": { "node": "xor-1", "pin": "b" } },
            { "id": "w3", "from": { "node": "in-a", "pin": "out" }, "to": { "node": "and-1", "pin": "a" } },
            { "id": "w4", "from": { "node": "in-b", "pin": "out" }, "to": { "node": "and-1", "pin": "b" } },
            { "id": "w5", "from": { "node": "xor-1", "pin": "out" }, "to": { "node": "sum-out", "pin": "a" } },
            { "id": "w6", "from": { "node": "and-1", "pin": "out" }, "to": { "node": "carry-out", "pin": "a" } }
        ]
    },
    "testbench": {
        "variables": ["A", "B"],
        "inputs": { "A": "in-a", "B": "in-b" },
        "outputs": { "Sum": "sum-out", "Carry": "carry-out" },
        "expected": { "Sum": "A XOR B", "Carry": "A AND B" }
    }
}
```

Đúng quy ước đặt tên của ví dụ thật trong `SPEC.md` §7 (`in-a`, `xor-1`). `Sum` = XOR(A,B), `Carry` = AND(A,B) khớp chính xác LOG-09.

**Ba kịch bản test bắt buộc, mỗi kịch bản gọi `gradeCircuitResponse({netlist, testbench, maxScore: 10})` — netlist truyền vào là một bản sao (`structuredClone` hoặc deep copy thủ công) của `fixture.netlist`, KHÔNG sửa trực tiếp object gốc import từ JSON (tránh rò rỉ trạng thái giữa các test):**

1. **Mạch đúng (không sửa gì):** dùng nguyên `fixture.netlist` + `fixture.testbench`. Kết quả bắt buộc: `checks.length === 8`, cả 8 `passed === true`, thứ tự id đúng `case-00-sum, case-00-carry, case-01-sum, case-01-carry, case-10-sum, case-10-carry, case-11-sum, case-11-carry`, `score === 10`.
2. **Thiếu wire (dangling pin):** xóa phần tử `wires` có `id: 'w4'` khỏi bản sao netlist (chân `and-1.b` mất nguồn). Kết quả bắt buộc — **không throw**: `{ score: 0, checks: [{ id: 'structure-danglingInputPin', passed: false, expected: 'valid-topology', actual: 'danglingInputPin', path: 'nodes[and-1].inputs[b]' }] }` (đúng 1 phần tử `checks`).
3. **Sai wire (nối nhầm nguồn, vẫn hợp lệ topology):** trong bản sao netlist, đổi `from.node` của wire `w4` từ `'in-b'` thành `'in-a'` (giữ nguyên `to: {node:'and-1', pin:'b'}`) — hệ quả mạch thật tính `Carry = AND(A,A) = A` thay vì `AND(A,B)`, còn `Sum` không đổi. Kết quả bắt buộc: **không throw**, `checks.length === 8`, đúng **7/8** `passed === true`, đúng **1** phần tử sai — `{ id: 'case-10-carry', passed: false, expected: '0', actual: '1' }` (tại `A=1,B=0`: biểu thức khai đúng `AND(1,0)=0` là `expected`; mạch nối sai `AND(1,1)=1` là `actual` — 3 hàng còn lại của `Carry` trùng nhau giữa `AND(A,B)` và `AND(A,A)` một cách tình cờ tại `A=B` và tại `A=0`, chỉ lệch tại `A=1,B=0`), `score === 8.75`.

## `KHÔNG LÀM`

- Không sửa `circuit-grader.js`, `circuit-engine.js`, `circuit-netlist.js`, `boolean-core.js` — cả 4 đã đóng băng từ E01-E03, đã hash-verify. E04 chỉ `require()` và dùng.
- Không sửa `boolean-grader.js`, `schema-lifecycle.js`, `edition/electronics-logic.js`, `export/electronics-logic*.js` — chưa nối nhánh `mode==='circuit'`, việc nối dây orchestrator/UI là phạm vi U01-U03/I01-I02, không phải E04.
- Không đổi node id, wire id, tên output (`Sum`/`Carry`) hay bất kỳ giá trị nào đã khóa ở "Thiết kế khóa" — PM/tester sẽ tái tính tay các con số kỳ vọng dựa đúng trên các id này khi xác minh độc lập; đổi tên tùy tiện làm mất khả năng tái lập.
- Không thêm test cho `combinationalLoop` hay `multipleSources` bằng fixture half-adder riêng — hai loại lỗi này đã được chứng minh tổng quát đầy đủ ở E01 (`circuit-netlist.test.js`) và E03 (`circuit-grader.test.js`'s ACCEPTANCE 6); lặp lại ở đây là trùng phạm vi, không tăng bằng chứng thật.
- Không thêm NAND/NOR/XNOR hay node kind mới — LOG-10 (P1) bị khóa tới sau Gate Release.
- Không đụng UI/canvas/SVG/drag-drop — đó là U01/U02.
- Không tạo hay chỉnh sửa nội dung course mẫu / iDevice authoring thật — đó là I01/I02. Fixture ở đây chỉ phục vụ test tầng Core, không phải nội dung tác giả sử dụng qua UI.
- Không tự tuyên bố gate `G-E0` đã đóng trong báo cáo hoàn thành — chỉ nêu "toàn bộ `ACCEPTANCE` đạt, đề xuất đóng `G-E0`"; quyết định đóng gate là của PM/tester sau khi tái lập độc lập (AGENTS.md §13 quy tắc 8: dừng ở gate gần nhất).
- Không bắt đầu U01/U02 trong cùng lượt, kể cả khi cả 3 kịch bản `ACCEPTANCE` đều xanh.
- Không chạy `bun run bundle:resources` — không file nào trong đồ thị E04 nằm trong entrypoint bundle nào.
- Không chạm `translations/**`, không chạy `make translations` — E04 không có chuỗi UI (không DOM).
- Không đánh dấu `.skip`/`.todo`.

## `ACCEPTANCE` (quan sát được)

1. Gọi `gradeCircuitResponse` với nguyên `fixture.netlist` + `fixture.testbench`, `maxScore: 10` → `checks.length === 8`, toàn bộ `passed === true`, đúng thứ tự id `case-00-sum, case-00-carry, case-01-sum, case-01-carry, case-10-sum, case-10-carry, case-11-sum, case-11-carry`, `score === 10`. Đây là bằng chứng trực tiếp cho LOG-09/AT-07 "Half-adder đúng 4/4".
2. Gọi lại với netlist đã xóa wire `w4` (bản sao, không sửa fixture gốc) → **không throw** (xác nhận bằng cách gọi trong `expect(() => ...).not.toThrow()` hoặc tương đương, không phải chỉ đơn thuần không có `try/catch`), trả đúng `{ score: 0, checks: [{ id: 'structure-danglingInputPin', passed: false, expected: 'valid-topology', actual: 'danglingInputPin', path: 'nodes[and-1].inputs[b]' }] }`. Bằng chứng cho AT-07 "tháo dây làm test thất bại" + AT-08 "pin treo được báo và không crash" (áp dụng cụ thể cho fixture half-adder).
3. Gọi lại với netlist đã đổi `from.node` của wire `w4` thành `'in-a'` (bản sao) → **không throw**, `checks.length === 8`, đúng 7/8 `passed === true`, phần tử sai duy nhất là `{ id: 'case-10-carry', passed: false, expected: '0', actual: '1' }`, `score === 8.75`. Bằng chứng cho AT-07 "tháo dây [nối sai] làm test thất bại" ở nhánh chấm điểm thông thường (không phải nhánh lỗi cấu trúc).
4. (Kiểm tra phụ, gộp vào test của mục 1) Nội dung `core/fixtures/circuit-half-adder.json` khi `require()` có đúng 6 `nodes`, đúng 6 `wires`, đúng id/kind như khóa ở "Thiết kế khóa" — chống trôi dữ liệu fixture âm thầm về sau (vd một lần sửa file JSON vô tình đổi id mà không ai để ý vì test vẫn "tình cờ" xanh).

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-half-adder.test.js

# Core không được đỏ sau E04 (gồm toàn bộ circuit-*.test.js của E01/E02/E03, phải vẫn xanh nguyên)
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend đầy đủ
npx vitest run public/files/perm/idevices/base/electronics-logic

# Lint — dùng bunx trực tiếp, KHÔNG dùng bare `npx biome` (đã xác nhận gotcha ở lần verify E01/E02/E03)
bunx @biomejs/biome check \
  public/files/perm/idevices/base/electronics-logic/core/circuit-half-adder.test.js \
  public/files/perm/idevices/base/electronics-logic/core/fixtures/circuit-half-adder.json
```

**Ghi chú `make fix`** (như E01-E03): Windows/Git Bash hiện tại không có `make`; kể cả có, `make fix`/`make lint` không phủ `public/files/perm/idevices/**`. Dùng lệnh `bunx @biomejs/biome check` ở trên thay thế.

**Ghi chú coverage** — khác E01-E03: E04 **không** tạo module `.js` sản xuất mới (chỉ thêm 1 fixture JSON thuần dữ liệu + 1 file test), nên **không có** số coverage mới cần đạt 90%. Không cần chạy `--coverage.include` riêng cho E04. Nếu muốn xác nhận E04 không làm giảm coverage đã có của `circuit-grader.js`/`circuit-netlist.js`/`circuit-engine.js`, có thể chạy lại đúng lệnh coverage đã dùng ở E03 (`--coverage.include` trỏ 3 file đó) và so sánh với baseline đã ghi ở `repo-map.md` mục "E03 Testbench/grading evidence" (97.36% Stmts / 94.23% Branch / 100% Funcs / 100% Lines cho riêng `circuit-grader.js`) — số không được thấp hơn baseline này.

Kỳ vọng: Vitest xanh cho `circuit-half-adder.test.js` và toàn bộ `core/`/regression frontend không đổi kết quả so với trước E04 (E04 không sửa file nào khác ngoài 2 file mới); lint sạch. **Không** chạy `bun x playwright test` — chưa có UI/E2E nào liên quan tới circuit.

## `ĐẦU RA`

- `git status`/diff chỉ chạm đúng 2 file mới (`core/fixtures/circuit-half-adder.json`, `core/circuit-half-adder.test.js`) + `.ai/packets/E04-halfadder-fixture.md`. Không file nào khác bị đổi — **kể cả không đổi `core/circuit-netlist.js`, `core/circuit-engine.js`, `core/circuit-grader.js`, `core/boolean-core.js`**.
- Output test đầy đủ (pass/fail, số ca) cho `circuit-half-adder.test.js`, và xác nhận `npx vitest run public/files/perm/idevices/base/electronics-logic` cho tổng số ca **không giảm** so với baseline trước E04 (342 bài sau E03, xem `repo-map.md` mục E03 — dán số tổng trước/sau).
- Dán trực tiếp output thật (không mock) của cả 3 `ACCEPTANCE` chính ở trên — đặc biệt JSON đầy đủ của kịch bản 2 (`structure-danglingInputPin` + `path`) và kịch bản 3 (mảng `checks` đầy đủ 8 phần tử, chỉ ra rõ phần tử `case-10-carry` sai).
- Trạng thái gate `G-E0`: nêu rõ E04, nếu toàn bộ `ACCEPTANCE` đạt, là bằng chứng cuối cùng còn thiếu để đóng gate (E01+E02+E03 đã xác minh xong trước đó) — nhưng **không tự tuyên bố gate đã đóng**; đề xuất PM/tester xác minh độc lập rồi mới quyết định. Không tự bắt đầu U01/U02 dù tự thấy `ACCEPTANCE` đã xanh.
