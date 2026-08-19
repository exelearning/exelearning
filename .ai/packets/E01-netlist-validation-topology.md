# Task Packet — E01: Netlist validation/topology

- `TASK`: E01 — Netlist validation/topology (nguồn: `PLAN.md` §5.6 "E — Circuit Engine", dòng 157, 3 giờ, phụ thuộc C04+P04). Đây là task đầu tiên của domain Circuit (khác domain Boolean/K-map K01-K04/C01-C06/T01-T03/P03-P04 đã xong).
- `SPEC`: LOG-03, LOG-06 (`SPEC.md` §6.5), và **chỉ phần topo-sort/phát hiện vòng lặp** của LOG-04 (**không** gồm lan truyền giá trị `0/1/X` qua cổng — đó là E02 "Engine `0/1/X`", `PLAN.md` dòng 158). Phụ thuộc: C04 evaluator/truth vector (`PLAN.md` dòng 132, đã xong — PM/tester xác minh lại 2026-08-13, xem `repo-map.md`), P04 schema/lifecycle skeleton (`PLAN.md` dòng 123, đã xong — PM/tester xác minh lại 2026-08-13), hợp đồng netlist JSON v1 (`SPEC.md` §7, đã đóng băng), cảnh báo ngữ nghĩa X (`SPEC.md` §7, dòng cuối).
- `SKILLS`: `exelearning-logic-alpha` (domain/gate G-E0), `test-driven-development` (BẮT BUỘC Red-Green-Refactor thật cho `circuit-netlist.js` — thuật toán đồ thị/validate thuần túy, không DOM).
- `MUC TIEU`: Module mới `core/circuit-netlist.js` (CommonJS thuần, không DOM) cung cấp 3 hàm nền tảng cho toàn bộ domain Circuit dùng về sau (E02-E04, U01-U02): (1) `parseNetlist(raw)` — validate hình dạng JSON netlist v1 đúng hợp đồng khóa ở `SPEC.md` §7 (`{schemaVersion, nodes:[{id,kind,x,y}], wires:[{id,from:{node,pin},to:{node,pin}}]}`), ném `TypeError` tiếng Việt nếu sai hình dạng cơ bản (LOG-03 phần schema), trả về bản sao đã validate nếu hợp lệ — round-trip qua `JSON.stringify`/`JSON.parse` phải giữ nguyên ngữ nghĩa (LOG-03 phần round-trip); (2) `validateTopology(model)` — trả `{valid, errors:[{code,path,message}]}` (không ném lỗi, không crash — đúng AT-08), gộp mọi phát hiện: dây nối trỏ node đã xóa, dây nối sai chiều, pin treo (đầu vào không có dây), nhiều dây cùng vào một pin đầu vào, và vòng lặp tổ hợp (LOG-06 + phần vòng lặp của LOG-04); (3) `topologicalSort(model)` — trả thứ tự tính toán hợp lệ hoặc danh sách node trong vòng lặp, dùng nội bộ bởi `validateTopology` và dùng trực tiếp bởi E02 sau này để lan truyền giá trị đúng thứ tự. Xuất kèm hằng số `GATE_PINS` (6 loại cổng LOG-01, trừ NAND/NOR/XNOR bị khóa bởi LOG-10) mô tả chân vào/ra mỗi loại node — nguồn chân lý duy nhất cho E02/U01/U02 tái dùng sau này.

`DAU RA`: thuật toán đồ thị/validate thuần túy trong module mới `core/circuit-netlist.js` — không DOM, không phụ thuộc file `core/*.js` khác (độc lập hoàn toàn với `boolean-core.js`/`kmap-*.js`/`schema-lifecycle.js`), chưa có consumer nào gọi tới (U01/U02/E02 sẽ `require()` ở task sau). Không đổi bất kỳ file hiện có nào — khác K04 (phải sửa 7 file tích hợp), E01 là module cô lập hoàn toàn vì chưa có UI/dispatch nào biết tới mode `circuit`.

## Bối cảnh đã xác minh (đọc code thật + grep toàn bộ thư mục trước khi viết packet này, không suy diễn)

- **Repo là clean slate cho circuit** — đã grep `circuit|netlist|node.*pin.*wire|kind.*INPUT|XOR` (case-insensitive) trên toàn bộ `public/files/perm/idevices/base/electronics-logic/`: không có file `circuit-netlist.js`/tương đương nào tồn tại. Chữ `circuit` chỉ xuất hiện đúng 2 chỗ trong toàn repo, cả hai đều là literal chuỗi mode, không có logic: `core/schema-lifecycle.js` dòng 5 (`SUPPORTED_MODES = Object.freeze(['boolean', 'truthTable', 'kmap', 'circuit'])`, dòng 6 `AUTHORING_MODES` **không** gồm `'circuit'`) và `edition/electronics-logic.js` dòng 9 (mảng `supportedModes` mirror y hệt). Đã grep riêng `circuit` (không OR-pattern) trên `export/electronics-logic.js` và `core/boolean-grader.js`: **0 kết quả** — xác nhận không có nhánh `mode === 'circuit'` nào được stub sẵn ở bất kỳ đâu. Kết luận: E01 không có điểm tích hợp nào phải chạm — đúng như `PLAN.md` đã tách U01/U02/E02+ ra làm task tích hợp riêng.
- **`core/` hiện có 5 module** (`boolean-core.js`, `boolean-core-contract.js`, `boolean-grader.js`, `kmap-grader.js`, `kmap-group-validator.js`, `schema-lifecycle.js` — đã đọc/verify hết ở K04), tất cả theo cùng 1 khuôn mẫu: `'use strict'`, CommonJS thuần (`require()`/`module.exports`), không DOM/Electron/`eval`/`Function`, export object đóng băng (`Object.freeze`). `circuit-netlist.js` phải theo đúng khuôn mẫu này. **Khác biệt quan trọng**: mọi module hiện có đều gán thêm `globalThis.$electronicsLogic<Tên>` để vào bundle trình duyệt (vd `schema-lifecycle.js` được `edition/electronics-logic.js` gọi qua `getSchemaLifecycle: () => globalThis.$electronicsLogicSchemaLifecycle`) — **circuit-netlist.js KHÔNG làm việc này ở E01** vì chưa có file nào cần require/gọi tới nó (xem `KHÔNG LÀM`). Thêm global rỗng không ai gọi là code chết, để dành cho U01/U02/E02 khi thực sự cần.
- **Hợp đồng netlist JSON v1 đã khóa** (`SPEC.md` §7, đọc lại nguyên văn, không được đổi shape):
  ```json
  {
    "schemaVersion": 1,
    "nodes": [
      {"id": "in-a", "kind": "INPUT", "x": 40, "y": 80},
      {"id": "xor-1", "kind": "XOR", "x": 180, "y": 80}
    ],
    "wires": [
      {"id": "w1", "from": {"node": "in-a", "pin": "out"}, "to": {"node": "xor-1", "pin": "a"}}
    ]
  }
  ```
  Field bắt buộc: `node.id/kind/x/y` (phẳng, không lồng `position:{x,y}`), `wire.id/from/to`, `from`/`to` = `{node, pin}` (field tên là `node`, **không phải** `nodeId`). Ví dụ này chỉ minh họa **hình dạng**, không phải một mạch đầy đủ hợp lệ — `xor-1` có pin `a` được nối nhưng pin `b` (theo bảng `GATE_PINS` khóa dưới) chưa được nối và không có `OUTPUT` node nào, nên chạy `validateTopology` trên đúng JSON này **sẽ hợp lệ trả về `danglingInputPin` cho `xor-1.b`** — đây là kết quả đúng, không phải bug, không được "sửa" ví dụ SPEC để né lỗi này. Dùng JSON này làm fixture bắt buộc cho test round-trip (Bước "Thiết kế khóa" bên dưới), không dùng cho test "không có lỗi nào".
- **Cảnh báo ngữ nghĩa X** (`SPEC.md` §7, dòng cuối, nguyên văn): "`X` trong truth table/K-map là don't-care; `X` trong circuit là tín hiệu chưa xác định. Hai khái niệm phải có type/field riêng." E01 **không tạo giá trị X nào cả** (đó là E02 lan truyền tín hiệu) — chỉ nêu ở đây để Codex không nhầm `danglingInputPin` (một *lỗi cấu trúc* E01 phát hiện) với việc *gán giá trị* X cho pin đó lúc chạy (một *hành vi runtime* của E02). E01 dừng lại ở việc báo cáo, không gán giá trị.
- **Quyết định đặt tên `kind` cho Output/LED (khoảng trống trong SPEC, phải tự khóa)**: `SPEC.md` LOG-01/LOG-05 gọi node này là "Output/LED" (tên hiển thị UI), nhưng ví dụ JSON hợp đồng ở §7 chỉ minh họa `"INPUT"` và `"XOR"`, chưa từng viết ra literal `kind` thật cho node Output/LED ở bất kỳ đâu trong `SPEC.md`. E01 khóa **`"OUTPUT"`** làm giá trị `kind` (nhất quán với quy ước danh từ-chức-năng viết hoa của 5 loại còn lại: `INPUT/NOT/AND/OR/XOR`; "LED" chỉ là cách hiển thị/vẽ ở tầng UI của U01, không phải khái niệm dữ liệu). Đây là quyết định của packet này — không tự đổi lại thành `"LED"` hay `"OUTPUT_LED"`.
- **Không có bảng chân (pin arity) nào tồn tại sẵn để tái dùng** — đã grep xác nhận. `SPEC.md` §8 "Cùng evaluator dùng cho expression, table, K-map và gate truth function" nói về việc **E02** phải tái dùng `boolean-core.js` cho hàm chân trị AND/OR/XOR/NOT lúc lan truyền giá trị — đó là ngữ nghĩa cổng (E02), khác với **bảng chân/pin arity** (cổng có bao nhiêu chân vào/ra, tên gì) mà E01 phải tự định nghĩa vì đây là lần đầu domain Circuit tồn tại trong repo. Không nhầm 2 việc này — E01 không tính bất kỳ giá trị `0/1/X` nào, chỉ biết "node loại X có các chân tên gì".
- **Không cần rebuild bundle** — khác K04 (`bun run bundle:resources` bắt buộc vì sửa `boolean-grader.js`/thêm `kmap-grader.js` được `require()` từ entrypoint đã bundle), `circuit-netlist.js` không được `require()` từ bất kỳ file nào nằm trong `scripts/build-resource-bundles.js`'s entrypoints hiện tại (`boolean-grader-browser.mjs`) — không cần rebuild, không cần sửa entrypoint.

## `FILE ĐƯỢC SỬA` (2 file mới + packet)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/circuit-netlist.js` | **File mới.** CommonJS thuần, không DOM, không `require()` file `core/*.js` nào khác. Export đóng băng: `GATE_PINS`, `parseNetlist`, `validateTopology`, `topologicalSort`. Thiết kế khóa ở mục dưới — không tự đặt lại tên hàm/field. |
| `public/files/perm/idevices/base/electronics-logic/core/circuit-netlist.test.js` | **File mới.** TDD thật (Red-Green-Refactor). Bắt buộc phủ mọi ca liệt kê ở `ACCEPTANCE`. Fixture nhỏ khai trực tiếp trong file test (literal object), **không** thêm file mới vào `fixtures/` (thư mục đó dành riêng cho fixture schema v0/v1 của P04, không phải chỗ chứa kịch bản netlist — đúng tiền lệ K03: `kmap-group-validator.test.js` dùng literal inline, không file fixture riêng). |
| `.ai/packets/E01-netlist-validation-topology.md` | Packet này. |

## Thiết kế khóa (chốt trong E01 — không tự thiết kế lại tên field/mã lỗi)

**`GATE_PINS`** — bảng hằng số, nguồn chân lý duy nhất cho chân vào/ra mỗi loại node (LOG-01, đã loại NAND/NOR/XNOR theo LOG-10):

| `kind` | chân vào (`inputs`) | chân ra (`outputs`) |
|---|---|---|
| `INPUT` | `[]` | `['out']` |
| `OUTPUT` | `['a']` | `[]` |
| `NOT` | `['a']` | `['out']` |
| `AND` | `['a', 'b']` | `['out']` |
| `OR` | `['a', 'b']` | `['out']` |
| `XOR` | `['a', 'b']` | `['out']` |

Tên chân `a`/`out` của `XOR` khớp đúng ví dụ hợp đồng ở `SPEC.md` §7 (`{"node": "xor-1", "pin": "a"}`) — không tự đổi tên chân.

**`parseNetlist(raw)` — Tier 1, ném `TypeError` tiếng Việt** (mô phỏng đúng phong cách `validateExercise` trong `core/boolean-grader.js`: một `throw` gọn cho mỗi nhóm lỗi hình dạng, không cần message riêng cho từng field). Validate: `raw` là plain object; `raw.schemaVersion === 1`; `raw.nodes`/`raw.wires` là mảng; mỗi node có `id` (string non-empty, unique trong toàn mảng `nodes`), `kind` ∈ khóa của `GATE_PINS` (kind lạ → ném lỗi ở đây, **không** phải ở `validateTopology` — kind không thuộc từ vựng đã biết là dữ liệu sai hình dạng, không phải lỗi cấu trúc mạch), `x`/`y` là `Number.isFinite`; mỗi wire có `id` (string non-empty, unique), `from`/`to` là object có `node` (string) và `pin` (string). **Cho phép field thừa** không có trong hợp đồng (không strict-reject unknown fields — permissive, tiền lệ giống `schema-lifecycle.js` không strict). Trả về bản sao (deep clone, không tham chiếu `raw`) đúng shape đã validate — không cần viết hàm `serializeNetlist` riêng: round-trip test dùng thẳng `JSON.parse(JSON.stringify(model))` rồi `parseNetlist` lại lần 2, so sánh deep-equal với model gốc (model đã là plain-object JSON-safe, không cần serializer riêng — thêm hàm đó là trừu tượng thừa).

**`validateTopology(model)` — Tier 2, không bao giờ ném lỗi** (mô phỏng đúng phong cách `validate()` trong `core/schema-lifecycle.js`: trả `{valid, errors}`, tích lũy **toàn bộ** phát hiện trong một lần gọi, không dừng ở lỗi đầu tiên — kể cả khi có vòng lặp, vẫn tiếp tục kiểm tra pin treo/nhiều nguồn cho phần còn lại của mạch, vì đây là các kiểm tra độc lập nhau). Nhận `model` đã qua `parseNetlist` (không tự validate lại hình dạng cơ bản). Mỗi lỗi có shape `{code, path, message}` (đúng khuôn `ERROR_MESSAGES`/`addError` của `schema-lifecycle.js`, nhưng là catalog **riêng** của `circuit-netlist.js` — không import/sửa `ERROR_MESSAGES` của `schema-lifecycle.js`, hai domain lỗi khác nhau). 6 mã lỗi khóa:

| `code` | Điều kiện | Yêu cầu nguồn |
|---|---|---|
| `unknownNodeReference` | `wire.from.node` hoặc `wire.to.node` không tồn tại trong `nodes[]` | LOG-06 "wire trỏ node đã xóa" |
| `unknownPin` | `wire.from.pin`/`wire.to.pin` không thuộc `GATE_PINS[node.kind]` | Điều kiện tiên quyết bắt buộc để 2 mã dưới tính đúng — không thể đếm "treo"/"nhiều nguồn" nếu không biết pin có hợp lệ hay không |
| `wireDirectionMismatch` | `wire.from.pin` không phải chân `outputs` của node nguồn, hoặc `wire.to.pin` không phải chân `inputs` của node đích | LOG-02 "nối bằng source pin → target pin" — nếu bỏ qua, phép đếm treo/nhiều-nguồn bên dưới vô nghĩa vì không còn biết chân nào là "đầu vào" |
| `danglingInputPin` | Một chân thuộc `inputs` của node nào đó có 0 wire trỏ tới (`to`) | LOG-06 "pin treo" |
| `multipleSources` | Một chân thuộc `inputs` có ≥ 2 wire trỏ tới (`to`) | LOG-06 "nhiều nguồn vào một pin" |
| `combinationalLoop` | `topologicalSort(model).ok === false` | LOG-04, phần vòng lặp — `path` nối các node id trong vòng lặp, vd `'nodes[g1,g2,g3]'` |

Message mẫu (giữ tinh thần, không bắt buộc chữ nguyên văn): `unknownNodeReference: 'Dây nối trỏ tới node không tồn tại.'`, `danglingInputPin: 'Chân đầu vào chưa được nối dây.'`, `combinationalLoop: 'Mạch có vòng lặp tổ hợp, không thể xác định thứ tự tính toán.'`.

**`topologicalSort(model)`** — thuật toán chuẩn (khuyến nghị Kahn's algorithm vì tự nhiên cho ra vừa thứ tự vừa tập node còn lại khi có vòng lặp, không bắt buộc dùng đúng thuật toán này nếu có lý do khác nhưng phải cho đúng 2 shape trả về sau): cạnh đồ thị là `wire.from.node → wire.to.node`. Trả `{ ok: true, order: [nodeId, ...] }` (mọi node nguồn đứng trước node đích, độ dài `order === nodes.length`) khi không có vòng lặp; trả `{ ok: false, cycle: [nodeId, ...] }` (danh sách node id tham gia vòng lặp — kể cả vòng lặp tự thân 1 node, node tự nối vào chính nó) khi phát hiện vòng. Hàm này **không** tự validate hình dạng (giả định input đã qua `parseNetlist`) và **không** xử lý `unknownNodeReference`/`unknownPin` (những node/pin tham chiếu sai đã được `validateTopology` báo riêng — `topologicalSort` chỉ cần xây đồ thị trên các node có thật, bỏ qua cạnh trỏ tới node không tồn tại để không crash, đúng tinh thần AT-08 "không crash").

**Không bọc `GradingResult`** — E01 không tạo `score`/`checks`/`attemptId` gì cả (đó là E03 "Testbench/grading"). `validateTopology` chỉ trả `{valid, errors}`, không phải `GradingResult` v1.

## `KHÔNG LÀM`

- Không cài đặt lan truyền giá trị `0/1/X` qua cổng (bảng chân trị AND/OR/XOR/NOT) — đó là E02. `GATE_PINS` ở đây chỉ mô tả **số lượng và tên chân**, không mô tả **hàm tính giá trị** của cổng.
- Không viết testbench/chấm điểm circuit (map I/O, chạy mọi tổ hợp, `GradingResult`) — đó là E03.
- Không tạo fixture half-adder chuẩn (`Sum = A XOR B`, `Carry = A AND B`) — đó là E04, packet này không được tạo file fixture nào tên `half-adder*`.
- Không cài NAND/NOR/XNOR vào `GATE_PINS` — LOG-10 khóa lại đến sau "Gate Release", P1 không phải P0.
- Không đụng tới UI/canvas/SVG (palette, add/move/delete node, click-to-wire) — đó là U01/U02.
- Không sửa `core/schema-lifecycle.js` — `SUPPORTED_MODES` đã có `'circuit'` sẵn, `AUTHORING_MODES` cố tình chưa gồm `'circuit'` (chờ U03 "Bốn mode iDevice" bật authoring circuit); E01 không làm activity đi qua schema-lifecycle được.
- Không sửa `core/boolean-core.js`, `core/boolean-grader.js`, `core/kmap-*.js` — không liên quan tới đồ thị/topology; không import các file này vào `circuit-netlist.js`.
- Không sửa `edition/electronics-logic.js`, `export/electronics-logic.js`, `export/electronics-logic-grader.bundle.js` — chưa có nhánh `mode==='circuit'` nào ở đây (đã grep xác nhận 0 kết quả), không phải việc của E01 để thêm.
- Không chạy `bun run bundle:resources` — `circuit-netlist.js` không nằm trong đồ thị `require()` của bất kỳ entrypoint bundle nào hiện tại, rebuild sẽ không có tác dụng và có thể gây nhầm lẫn là đã "tích hợp" trong khi chưa.
- Không gán `globalThis.$electronicsLogicCircuitNetlist` (hay tên tương tự) — chưa có consumer nào gọi tới; để dành cho task thêm consumer thật (U01/U02/E02) tự thêm khi cần.
- Không thêm file mới vào thư mục `fixtures/` — dùng literal inline trong `circuit-netlist.test.js`.
- Không đổi ví dụ JSON ở `SPEC.md` §7 để né kết quả `danglingInputPin` — ví dụ đó là hình dạng tham khảo, không phải mạch đầy đủ, giữ nguyên như đã khóa.
- Không chạm `translations/**`, không chạy `make translations` — E01 không có chuỗi UI nào (không DOM).

## `ACCEPTANCE` (quan sát được)

1. `parseNetlist(raw)` với đúng JSON ví dụ ở `SPEC.md` §7 (2 node, 1 wire) → trả object clone hợp lệ, không ném lỗi; `JSON.stringify(model)` rồi `JSON.parse` rồi `parseNetlist` lại → deep-equal với model lần đầu (round-trip LOG-03).
2. `parseNetlist(raw)` với `raw.nodes` thiếu, hoặc một node thiếu `kind`, hoặc `kind` lạ (vd `"FOO"`), hoặc `x`/`y` không phải số hữu hạn, hoặc `id` trùng lặp giữa 2 node, hoặc wire thiếu `from.pin` → ném `TypeError`, message tiếng Việt.
3. `validateTopology(model)` trên mạch đầy đủ hợp lệ (vd: 2 `INPUT` + 1 `XOR` nối đủ cả 2 chân `a`/`b` + 1 `OUTPUT` nối chân `out` của XOR) → `{valid: true, errors: []}`.
4. `validateTopology(model)` trên đúng ví dụ JSON của `SPEC.md` §7 (chưa nối chân `b` của `xor-1`, không có `OUTPUT`) → `valid: false`, chứa đúng 1 lỗi `danglingInputPin` cho `xor-1`/`b` (và không có lỗi nào khác — `xor-1.out` không nối là hợp lệ, chỉ chân `inputs` mới bị kiểm tra treo).
5. `validateTopology(model)` với 1 wire có `to.node` trỏ tới id không tồn tại trong `nodes[]` → chứa lỗi `unknownNodeReference`, không ném lỗi, không crash.
6. `validateTopology(model)` với 2 wire cùng trỏ `to` vào một chân đầu vào (vd 2 wire khác nhau cùng `to:{node:'and-1', pin:'a'}`) → chứa lỗi `multipleSources`.
7. `validateTopology(model)` với 1 wire nối `from`/`to` sai chiều (vd `from` trỏ vào một chân thuộc `inputs`) → chứa lỗi `wireDirectionMismatch`.
8. `validateTopology(model)` trên mạch có vòng lặp tổ hợp (vd `NOT` node có `out` nối ngược lại chính chân `a` của nó, hoặc vòng 2-3 node) → chứa lỗi `combinationalLoop`; `topologicalSort(model)` cùng input trả `{ok: false, cycle: [...]}` liệt kê đúng các node trong vòng.
9. `validateTopology(model)` trên mạch có **đồng thời** ≥ 2 loại lỗi (vd vừa `danglingInputPin` vừa `multipleSources` ở 2 chân khác nhau) → `errors` chứa **cả hai**, không dừng ở lỗi đầu tiên.
10. `topologicalSort(model)` trên mạch hợp lệ không vòng lặp → `{ok: true, order: [...]}` với `order.length === model.nodes.length`, mọi node nguồn của một wire đứng trước node đích trong `order`.
11. Không có test nào trong `circuit-netlist.test.js` chạm DOM/`window`/`document` — chạy được dưới cả Vitest lẫn (nếu ai đó thử) Bun mà không lỗi "window is not defined", vì module không dùng DOM.

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ (public/files/perm/idevices/** dùng Vitest theo AGENTS.md §2 — kể cả core/ CommonJS, không phải bun test)
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-netlist.test.js

# Core không được đỏ sau E01 (không được ảnh hưởng bởi module mới độc lập)
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend đầy đủ (đảm bảo không vô tình phá K01-K04/C01-C06/T01-T03/P03-P04)
npx vitest run public/files/perm/idevices/base/electronics-logic

# Lint
make fix
```

**Ghi chú `make fix`** (đã xác nhận từ K02-K04, vẫn đúng ở E01): Windows/Git Bash hiện tại không có `make`; kể cả có, `make fix`/`make lint` không phủ `public/files/perm/idevices/**`. Nếu gặp, dùng thay thế sau và ghi rõ lý do trong báo cáo:

```bash
bun x biome check --write \
  public/files/perm/idevices/base/electronics-logic/core/circuit-netlist.js \
  public/files/perm/idevices/base/electronics-logic/core/circuit-netlist.test.js
```

Kỳ vọng: Vitest xanh cho `circuit-netlist.test.js` và toàn bộ `core/`/regression frontend không đổi kết quả so với trước E01 (E01 không sửa file nào khác); lint sạch. **Không** chạy `bun x playwright test` cho E01 — chưa có UI/E2E nào liên quan tới circuit (U01/U02 sẽ cần sau).

## `ĐẦU RA`

- `git diff --stat` chỉ chạm đúng 2 file mới (`core/circuit-netlist.js`, `core/circuit-netlist.test.js`) + `.ai/packets/E01-netlist-validation-topology.md`. Không file nào khác trong `git status` bị đổi.
- Output test đầy đủ (pass/fail, số ca) cho `circuit-netlist.test.js`, và xác nhận `npx vitest run public/files/perm/idevices/base/electronics-logic` cho kết quả tổng số ca **không giảm** so với baseline trước E01 (dán số tổng test trước/sau).
- Dán trực tiếp output thật (không mock) của cả 11 ACCEPTANCE ở trên — đặc biệt ACCEPTANCE 4 (chạy đúng ví dụ JSON của `SPEC.md` §7 qua `validateTopology`, dán JSON kết quả) và ACCEPTANCE 8 (dán JSON kết quả `combinationalLoop`/`topologicalSort` trên 1 fixture có vòng lặp cụ thể).
- Nêu rõ nếu dùng `biome check` thay `make fix` và lý do (thiếu `make` trên môi trường hiện tại).
- Trạng thái gate `G-E0`: nêu rõ E01 **chưa** đóng được gate (`G-E0` cần cả E02+E03+E04 — half-adder netlist đạt 4/4 bằng test); E01 chỉ là nền tảng đầu tiên. Không tuyên bố "AT-08 đã đạt" — AT-08 (circuit errors reported, không crash) mới đạt phần *phát hiện lỗi cấu trúc tĩnh*; phần "không crash" khi *chạy* mạch lỗi (vd cố lan truyền giá trị qua mạch có vòng lặp) vẫn cần E02 xử lý.
