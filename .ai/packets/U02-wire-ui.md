# Task Packet — U02: Wire UI

- `TASK`: U02 — Wire UI (nguồn: `PLAN.md` dòng 167, 2 giờ, phụ thuộc `U01,E01`). DoD nguyên văn: "Click source → target, delete wire và feedback kết nối sai." Task thứ hai của chuỗi ba task U01→U02→U03 cùng khép gate `G-U0 — UI slice` (`PLAN.md` dòng 90: "Cuối ngày 9 | Half-adder nối/chấm được trong iDevice | Dùng grid/form nối pin fallback và gắn `Limited`"; dòng 233: "Gate G-U0 cuối ngày; feature freeze"). **U02 một mình không đóng `G-U0`** — chỉ đóng góp nốt vế sau của LOG-02 ("nối bằng source pin → target pin"); phần "chuyển mode, author/learner state" (U03) vẫn còn thiếu. `U01` (Node UI, kể cả bản PM AMENDMENT) đã được PM/tester xác minh độc lập **CLOSED**: 355/355 test xanh toàn thư mục `electronics-logic` (13 file), coverage `export/electronics-logic.js` = 97.22% stmt/88% branch/100% func/98.42% line, không còn statement/branch chưa phủ. `E01` (Netlist validation/topology, `PLAN.md` dòng 157) đã đóng từ trước, đông cứng cùng E02–E04 dưới gate `G-E0` (đã xác minh CLOSED, `repo-map.md`). Cả hai phụ thuộc đã sẵn sàng, không cần xác minh lại.
- `SPEC`: LOG-02 (`SPEC.md` dòng 257) — "Thêm/di chuyển/xóa node; nối bằng source pin → target pin." — **U02 làm nốt vế sau** ("nối... pin"); vế đầu đã xong ở U01. LOG-03 (`SPEC.md` dòng 258) — "Netlist JSON v1 lưu node, pin, wire, vị trí và round-trip không đổi nghĩa." — U02 phải làm `collectResponse` trả `wires` thật (không còn `[]` cố định) đúng shape SPEC.md §7. LOG-06 (`SPEC.md` dòng 261) — "Báo pin treo, nhiều nguồn vào một pin và wire trỏ node đã xóa." — **chỉ phần UI** (ngăn/feedback ngay lúc thao tác) thuộc U02; phần chấm điểm/validate toàn đồ thị đã có sẵn, đông cứng trong `circuit-grader.js` từ E01-E04 (xem "Bối cảnh đã xác minh") và KHÔNG được lặp lại. PLAT-06 (`SPEC.md` dòng 209) — "Dữ liệu sai hiển thị lỗi tiếng Việt và không crash." — áp dụng cho mọi feedback nối dây sai. NFR-07 (`SPEC.md` dòng 371) — "Lỗi người học bằng tiếng Việt; log kỹ thuật không hiển thị trực tiếp." — áp dụng cho 4 thông báo từ chối nối dây mới. NFR-05 (`SPEC.md` dòng 369) — "Core/grader mới đạt branch coverage tối thiểu 90%; UI ưu tiên integration/E2E." — U02 là UI, bằng chứng ưu tiên là test tích hợp thật trong `export/electronics-logic.test.js`, không phải Playwright mới (xem "Bối cảnh đã xác minh" — vẫn chưa có đường vào UI author thật cho circuit).
- `SKILLS`: `exelearning-logic-alpha` (domain/gate `G-U0`), `test-driven-development` (Red-Green-Refactor thật qua colocated `electronics-logic.test.js` — RED = test click/keydown trên pin/wire chưa tồn tại → fail; GREEN = thêm đúng nhánh khóa ở "Thiết kế khóa").
- `MUC TIEU`: Learner runtime (`export/electronics-logic.js`) render pin (theo `GATE_PINS` có sẵn từ E01, qua bridge đã có từ U01) trên mỗi node, cho người học nối dây bằng cú click hai bước (source pin → target pin) hoặc bàn phím, xóa wire bằng một click, nhận feedback tiếng Việt tức thời khi thao tác sai (tự-nối, sai hướng pin, pin đích đã có dây), tự động dọn wire khi node liên quan bị xóa hoặc tính lại tọa độ khi node bị di chuyển; `collectResponse` trả đúng `wires` thật thay cho placeholder rỗng của U01 — mà không đụng tới chấm điểm thật, canvas 480×320/40px, hay authoring form.
- `ĐẦU RA`: Dùng lại đúng `GATE_PINS` có sẵn trong `core/circuit-netlist.js` (qua bridge `getCircuitNetlist()` đã có từ U01, không cần bridge mới, không cần rebuild bundle). Không sửa bất kỳ file nào trong `core/`, không sửa `edition/electronics-logic.js`, không nối `checkActivity` vào chấm điểm circuit thật. Không thêm Playwright E2E mới (lý do đầy đủ ở "Bối cảnh đã xác minh").

## PM AMENDMENT (2026-08-15, sau khi Codex báo hoàn thành U02 — bắt buộc đóng trước khi coi U02 là xong)

PM/tester đã xác minh độc lập toàn bộ báo cáo hoàn thành U02 của Codex: tự chạy `electronics-logic.test.js` (50/50), core (297/297), regression đầy đủ toàn thư mục (368/368, đúng baseline 355 + 13), tự tính SHA-256 cho bundle (`fa33bea8...`, khớp chính xác baseline đã xác minh sau U01 → bundle thật sự không đổi) và grep 5 file "đóng băng" còn lại (`edition/electronics-logic.js`, `schema-lifecycle.js`, `boolean-grader.js`, `circuit-netlist.js`, `circuit-engine.js`, `circuit-grader.js`) không chứa bất kỳ định danh wire/pin mới nào của U02 → khớp claim "không đụng core/edition". Tự đo coverage scoped `export/electronics-logic.js` (97.68/87.88/100/98.8 stmt/branch/func/line — khớp chính xác số Codex báo). Grep xác nhận claim "không dùng `.dataset`/`.className` trên SVG wire/wireLayer" đúng (PASS, 0 match). Không phát hiện số liệu bịa ở bất kỳ điểm nào.

Nhưng khi đọc trực tiếp `coverage-final.json` (`branchMap`/`b`) thay vì chỉ tin bảng tóm tắt, phát hiện một nhánh logic **mới, thuộc phạm vi U02**, chưa có test nào chứng minh:

`deleteCircuitWiresForNode` (`export/electronics-logic.js`, dòng 762-768 ở bản đã giao — hàm hoàn toàn mới của U02):
```js
deleteCircuitWiresForNode: (activity, nodeId) => {
    activity.querySelectorAll('[data-role="circuit-wire"]').forEach(wire => {
        if (wire.getAttribute('data-from-node') === nodeId || wire.getAttribute('data-to-node') === nodeId) {
            wire.remove();
        }
    });
},
```
Điều kiện `||` ở dòng 764 có hai vế: `data-from-node === nodeId` (xóa wire khi node bị xóa là NGUỒN) và `data-to-node === nodeId` (xóa wire khi node bị xóa là ĐÍCH). Test duy nhất hiện có cho cascade-delete (`'cascade-deletes every wire connected to a deleted node'`, dòng 942-957) chỉ xóa node `input` — node này luôn là NGUỒN (from-node) của cả hai wire trong test, không bao giờ là đích. Do đoản mạch của `||`, vế `data-to-node === nodeId` không bao giờ là yếu tố quyết định kết quả trong bất kỳ lần chạy nào — `coverage-final.json` xác nhận branch dòng 764 có `counts=[2,0]` (vế trái quyết định đúng 2 lần, vế phải chưa từng là lý do quyết định). Đây chính xác là hành vi mà `ACCEPTANCE` #12 của packet gốc (dòng 270) đòi hỏi bằng chữ "HOẶC": "mọi wire có `data-from-node` HOẶC `data-to-node` bằng id node đó biến mất" — nhưng test hiện tại chỉ chứng minh được nửa đầu.

Đây không phải lỗi hành vi đã biết — code hiện tại gần như chắc chắn đúng vì điều kiện đối xứng tầm thường, và chính packet gốc đã nêu rõ lý do bắt buộc cascade cả hai chiều (dòng 183: tránh netlist tạo ra `unknownNodeReference`, liên quan trực tiếp LOG-06). Nhưng theo AGENTS.md §13 mục 6 (không nhận hoàn thành khi chưa có bằng chứng tái lập được), nhánh này phải được một test thật chứng minh trước khi U02 được coi là đóng.

**Phạm vi sửa của amendment — CHỈ một file, đã có sẵn trong "FILE ĐƯỢC SỬA" gốc bên dưới, không mở rộng danh sách:**

| File | Yêu cầu bổ sung |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` | Mở rộng test `'cascade-deletes every wire connected to a deleted node'` (hoặc thêm case mới cạnh nó): xóa một node đang đóng vai trò ĐÍCH (to-node) của ít nhất một wire, với NGUỒN (from-node) của wire đó là một node khác không bị xóa (vd: node bị xóa lần này là `andNode`, không phải `input`) → xác nhận wire đó biến mất dù chỉ khớp vế `to-node`. Phải giữ lại tối thiểu một wire không liên quan (cả from lẫn to đều khác node bị xóa) và assert wire đó còn nguyên sau khi xóa, để chứng minh vế `to-node` thật sự là yếu tố quyết định chứ không phải trùng hợp với vế `from-node`. |

**`KHÔNG LÀM` (áp dụng riêng cho amendment này, cộng thêm vào `KHÔNG LÀM` gốc bên dưới):**
- Không sửa bất kỳ file nào khác ngoài `electronics-logic.test.js` — không đổi logic `deleteCircuitWiresForNode` hay bất kỳ hàm nào khác trong `electronics-logic.js`/`.css`. Logic hiện tại đúng, chỉ thiếu test chứng minh vế `to-node`.
- Không tranh thủ bắt đầu U03 trong cùng lượt — amendment này chỉ đóng nốt U02, dừng lại ngay sau khi xanh.
- Không đổi bundle, không đổi bất kỳ file nào trong 6 file "đóng băng" đã xác minh ở trên.

**Bằng chứng bắt buộc khi báo lại (không nhận xác nhận bằng lời — AGENTS.md §13 mục 6):**
- Output thật của `npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` — tổng số ca phải ≥ 51 (50 hiện có + tối thiểu 1 mới/mở rộng), toàn bộ pass.
- Output thật của `npx vitest run public/files/perm/idevices/base/electronics-logic` — tổng số ca phải ≥ 369, không giảm ở file nào khác so với 368 hiện tại.
- Coverage scoped lại cho `export/electronics-logic.js` (cùng cách override `--coverage.include`/`--coverage.exclude`/`--coverage.reporter=json` đã dùng khi giao U02 gốc) — dán trực tiếp phần `branchMap`/`b` của `deleteCircuitWiresForNode` (dòng 762-768) trích từ `coverage-final.json`, xác nhận cả hai vế của nhánh dòng 764 đều có count > 0.
- `bunx @biomejs/biome check` lại trên `electronics-logic.test.js`.

Sau khi phần này xanh và có bằng chứng dán thật, PM mới coi U02 là đóng và xét tiếp U03.

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

**`core/circuit-netlist.js`** (205 dòng, đông cứng từ E01, xác minh lại không đổi): export `GATE_PINS`:
```
INPUT:      { inputs: [],        outputs: ['out'] }
OUTPUT:     { inputs: ['a'],     outputs: [] }
NOT:        { inputs: ['a'],     outputs: ['out'] }
AND/OR/XOR: { inputs: ['a','b'], outputs: ['out'] }
```
Mỗi kind có tối đa 2 pin ở một hướng (chỉ `inputs` của AND/OR/XOR có 2 phần tử `a`,`b`; mọi `outputs` chỉ có tối đa 1 phần tử). `validateTopology(model)` (hàm riêng, hiện KHÔNG được `export/electronics-logic.js` gọi ở đâu cả) làm toàn bộ kiểm tra tham chiếu chéo: `unknownNodeReference`, `unknownPin`, `wireDirectionMismatch` (bắt buộc output→input), `danglingInputPin`, `multipleSources`, `combinationalLoop`.

**`core/circuit-grader.js`** (145 dòng, đông cứng từ E01–E04, xác minh lại không đổi): `gradeCircuitResponse({netlist, testbench, maxScore})` (dòng 70) đã tự gọi `parseNetlist` rồi **`validateTopology(model)` (dòng 93)**, trả `{score:0, checks:[{id:'structure-${error.code}', expected:'valid-topology', actual:error.code, path:error.path}, ...]}` nếu topology sai. **Nghĩa là phần chấm điểm của LOG-06 (pin treo, nhiều nguồn, wire trỏ node đã xóa) đã có sẵn, đã test, đã đông cứng.** U02 KHÔNG được lặp lại logic này ở tầng UI; U02 chỉ cần đảm bảo UI không tạo ra được các trạng thái đó một cách vô lý (ví dụ: xóa node phải kéo theo xóa wire của nó) và show feedback nhanh tại thời điểm thao tác — không phải validate lại toàn bộ đồ thị.

**`core/boolean-grader.js`** (187 dòng, đông cứng, xác minh lại không đổi) — dòng 26: `!['boolean', 'truthTable', 'kmap'].includes(exercise.mode)` ⇒ ném `TypeError`. **`'circuit'` KHÔNG nằm trong danh sách mode được `gradeActivity` chấp nhận.** Bất kỳ exercise circuit nào đi qua `gradeActivity` đều throw, và `checkActivity` (dòng 678–708 của `export/electronics-logic.js`) bắt exception này rồi rơi về `messages.gradingUnavailable` (dòng 703–706). Việc nối dây thật ở U02 KHÔNG tự động kích hoạt chấm điểm thật — cần một task riêng sửa file đông cứng này, ngoài phạm vi U02. Đây là bằng chứng đọc trực tiếp từ code, không phải suy đoán.

**`edition/electronics-logic.js`** dòng 9–10:
```
supportedModes: ['boolean', 'truthTable', 'kmap', 'circuit'],
authoringModes: ['boolean', 'truthTable', 'kmap'],
```
`'circuit'` được khai báo là mode runtime hợp lệ nhưng chủ ý bị loại khỏi `authoringModes`. Chưa có form soạn bài circuit. U02 không đổi file này.

**`test/e2e/playwright/specs/idevices/electronics-logic.spec.ts`** (265 dòng, đọc lại toàn bộ cho packet này): chỉ có 3 test, cả ba đều `editor.locator('[data-field="mode"]').selectOption(...)` với `'truthTable'` hoặc `'kmap'` — không có test nào chọn `'circuit'`, khớp với việc `authoringModes` chưa có `'circuit'`. Chưa có đường vào thật cho circuit mode qua authoring UI ⇒ chưa có hành trình người dùng thật để viết E2E mới cho U02 (xác minh lại, không chỉ suy ra từ lý do của U01).

**`export/electronics-logic.js`** (862 dòng, không đổi từ khi U01+amendment giao nộp) — các đoạn liên quan, đúng số dòng hiện tại:

- `renderCircuit` (192–236): render palette + canvas `<div data-role="circuit-canvas">` chứa 96 nút `[data-role="circuit-cell"]` (12×8 lưới 40px) + `<p data-role="circuit-feedback">`. Node được `createCircuitNode` append vào SAU (không nằm trong HTML string ban đầu).
- Vòng lặp sự kiện (327–344): một listener `click` và một listener `keydown` DUY NHẤT gắn trên `circuitCanvas`, cả hai gọi `handleCircuitCanvasAction(activity, event.target)`. `keydown` chỉ kích hoạt khi `event.key` là `'Enter'`/`' '` VÀ `event.target.closest('[data-role="circuit-cell"], [data-role="circuit-node"], [data-action="delete-circuit-node"]')` khớp — danh sách selector này phải mở rộng cho U02.
- `handleCircuitCanvasAction` (472–490): thứ tự dispatch hiện tại — delete-button → node (select hoặc `activateCircuitCell` tùy có tool đang arm) → cell. Phải chèn thêm nhánh wire và pin.
- `activateCircuitCell` (492–522): nhánh "move" (512–520) trực tiếp sửa `selectedNode.dataset.x/y` và `nodeItem.style.left/top` — chỗ phải tính lại tọa độ wire khi node bị di chuyển.
- `createCircuitNode` (524–558): tạo `nodeItem` (div, `position:absolute`) chứa `node` (button `data-role="circuit-node"`) và `deleteButton` (`data-action="delete-circuit-node"`, `hidden` mặc định), append vào `canvas`. Chưa có pin con.
- `nextCircuitNodeId` (560–568): arrow function thuần (không dùng `this`) — mẫu để noi theo cho `nextCircuitWireId`.
- `armCircuitTool` (462–470): de-arm mọi palette item, gọi `clearCircuitSelection`, arm/toggle item được click, `clearCircuitFeedback`. Chưa biết về pin — phải bổ sung disarm pin.
- `selectCircuitNode` (570–579) / `clearCircuitSelection` (581–590) / `deleteCircuitNode` (592–596) / `clearCircuitFeedback` (598–604): vòng đời node còn lại. `selectCircuitNode` chỉ được gọi khi không có tool nào đang arm (do `handleCircuitCanvasAction` tự đảm bảo ở dòng 480-485) nên không cần disarm palette tool, nhưng phải disarm pin-arm (mode mới do U02 thêm).
- `collectResponse` (643–676), nhánh circuit (646–660): dòng 657 hiện là `wires: [],` — placeholder rỗng cố định — PHẢI thay bằng map thật từ DOM.
- `resetActivity` (360–387): dòng 377 xóa `[data-role="circuit-node-item"]` nhưng KHÔNG xóa wire — lỗ hổng có thật (không phải suy đoán): nếu U02 chỉ thêm wire mà không sửa `resetActivity`, reset sẽ để lại wire "mồ côi" trong khi mọi node đã bị xóa. Phải sửa.
- `updateEmptyState` (766–783) dòng 780: điều kiện "đã điền" cho circuit là `Boolean(circuitCanvas) && circuitNodes.length > 0` — chỉ dựa vào có node, không xét wire. U02 KHÔNG sửa dòng này (xem "KHÔNG LÀM").
- `getMessages` (785–842): quy ước bắt buộc `typeof _ === 'function' ? _('...') : '...'` cho mọi chuỗi. Key circuit hiện có: `circuitPaletteLabel`, `circuitCanvasLabel`, `circuitCellLabel`, `circuitNodeLabel`, `deleteCircuitNode`, `circuitOccupied`, `circuitNodeKinds`, `incompleteCircuit`, `gradingUnavailable`.
- `getCircuitNetlist: () => (typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicCircuitNetlist : undefined)` (850–851) — bridge đã có sẵn từ U01, `renderCircuit` đã dùng `this.getCircuitNetlist().GATE_PINS` (dòng 193). U02 dùng lại chính bridge này cho công thức tọa độ pin — **không cần sửa bridge/bundle, không cần `bun run bundle:resources`.**

**`export/electronics-logic.css`** (289 dòng, đọc lại toàn bộ): `.electronics-logic-circuit__canvas` = `position:relative`, lưới 12×8 ô 40px, 480×320px. `.electronics-logic-circuit__node-item` = `position:absolute; z-index:2;` 40×40px. `.electronics-logic-circuit__node` = box 40×40 `border:2px solid #344054`, màu nền theo kind, `[data-circuit-selected="true"]` có outline xanh `#175cd3`. `.electronics-logic-circuit__delete` = `position:absolute; top:0; left:44px`. Mô hình pixel này phải tái dùng cho công thức tọa độ pin/wire — **không đổi kích thước canvas 480×320/40px** (rủi ro "có thể cần chỉnh khi U02 thêm wire" từng ghi trong packet U01 nay đóng lại: chỉ thêm sub-vị trí pin bên trong ô 40px sẵn có, không cần resize).

**SVG dataset — chi tiết kỹ thuật bắt buộc.** Phần tử `<svg>`/`<line>` tạo bằng `document.createElementNS('http://www.w3.org/2000/svg', ...)`. Để không phụ thuộc vào mức hỗ trợ `.dataset`/`.className` trên `SVGElement`, MỌI thuộc tính `data-*`, `class`, `role`, `tabindex`, `aria-*`, `x1/y1/x2/y2` trên `<svg>` và `<line>` PHẢI đặt bằng `setAttribute`/đọc bằng `getAttribute` — không dùng `.dataset.xxx =` hay `.className =` trên hai phần tử này. Các phần tử HTML khác (`button` pin) vẫn dùng `.dataset` như phần còn lại của file.

## `FILE ĐƯỢC SỬA` (3 file + packet, không rebuild bundle)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js` | Thêm pin, wire layer, state machine nối dây, xóa wire, cascade-delete, tính lại tọa độ khi move, sửa `collectResponse`/`resetActivity`, thêm message keys |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.css` | Style cho `.electronics-logic-circuit__pin`, `__wire-layer`, `__wire` |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` | Test mới cho toàn bộ hành vi wire (xem `ACCEPTANCE`) |
| `.ai/packets/U02-wire-ui.md` | Chính packet này — nếu PM cần sửa sau khi giao Codex, thêm section `## PM AMENDMENT (ngày, lý do)` mới, không viết đè "Thiết kế khóa" đã chốt |

**Không đụng:** mọi file trong `core/` (kể cả `circuit-netlist.js`, `circuit-grader.js`, `boolean-grader.js`), `export/electronics-logic-grader.bundle.js`, `export/electronics-logic-grader.test.js`, `edition/electronics-logic.js`, bất kỳ file `translations/**`, bất kỳ spec dưới `test/e2e/playwright/**`.

## Thiết kế khóa (chốt trong U02 — Codex có thể tự chọn chi tiết CSS/pixel, nhưng PHẢI giữ đúng các hợp đồng dưới đây)

**1. Pin — phần tử DOM.** Với mỗi node, sau khi tạo `node` (button chính) và `deleteButton`, tạo thêm một `<button type="button">` cho MỖI pin trong `GATE_PINS[kind].inputs` và `GATE_PINS[kind].outputs`. Pin là **anh em (sibling)** của `node`, KHÔNG lồng bên trong `<button data-role="circuit-node">` (không hợp lệ HTML, gây mơ hồ khi `target.closest('[data-role="circuit-node"]')`). Thuộc tính bắt buộc:
```
data-role="circuit-pin"
data-action="select-circuit-pin"
data-node-id="{id}"                // id của node chứa pin, vd "and-1"
data-pin-name="{pinName}"          // "a" | "b" | "out"
data-pin-direction="input" | "output"
data-circuit-wire-source="false"   // "true" khi đang armed làm nguồn nối dây
aria-pressed="false"
aria-label = messages.circuitPinInputLabel / circuitPinOutputLabel, thay {pin} và {id}
```
Vị trí: `style.left`/`style.top` (px, tương đối so với `nodeItem` 40×40, KHÔNG cộng x/y của node) lấy từ hàm thuần `circuitPinOffset(kind, direction, pinName)`.

**2. Công thức tọa độ pin — quyết định để test tái lập được.** Hàm mới `circuitPinOffset: function (kind, direction, pinName)`:
- `x = direction === 'output' ? 40 : 0` (output luôn cạnh phải, input luôn cạnh trái — vì wire luôn output→input theo `validateTopology`).
- Lấy mảng pin đúng hướng từ `this.getCircuitNetlist().GATE_PINS[kind]`; nếu mảng có ≤ 1 phần tử thì `y = 20` (giữa ô); nếu có 2 phần tử (chỉ xảy ra với `inputs` của AND/OR/XOR) thì phần tử đầu `y = 10`, phần tử sau `y = 30`.
- Đây là hàm nguồn-sự-thật-duy-nhất: dùng cho vị trí pin (cộng vào 0,0 vì đã tương đối), vị trí đầu wire lúc tạo (cộng vào node.x/node.y), và vị trí đầu wire lúc tính lại khi move (cộng vào x/y mới). Không viết lại công thức này ở nơi khác.

**3. Lớp wire (SVG).** `renderCircuit` render thêm MỘT `<svg>` duy nhất, là con của `circuit-canvas`, ngay sau các cell, tồn tại kể cả khi chưa có wire nào:
```html
<svg class="electronics-logic-circuit__wire-layer" data-role="circuit-wire-layer" width="480" height="320"></svg>
```
Không đặt `aria-hidden` trên `<svg>` này (các `<line>` con cần lộ diện cho AT vì có `role="button"` riêng).

**4. Wire — phần tử DOM, tạo bằng `createCircuitWire(activity, sourcePin, targetPin)`.**
```
<line> tạo bằng document.createElementNS('http://www.w3.org/2000/svg', 'line')
setAttribute('class', 'electronics-logic-circuit__wire')
setAttribute('data-role', 'circuit-wire')
setAttribute('data-action', 'delete-circuit-wire')
setAttribute('data-wire-id', id)          // "w1", "w2", ... — xem nextCircuitWireId
setAttribute('data-from-node', sourceNodeId)
setAttribute('data-from-pin', sourcePinName)
setAttribute('data-to-node', targetNodeId)
setAttribute('data-to-pin', targetPinName)
setAttribute('x1'/'y1'/'x2'/'y2', ...)    // từ circuitPinOffset + node.x/node.y hiện tại
setAttribute('tabindex', '0')
setAttribute('role', 'button')
setAttribute('aria-label', ...)           // messages.circuitWireLabel, thay {from}="{nodeId}.{pinName}", {to} tương tự
```
Append vào `[data-role="circuit-wire-layer"]`.

**5. `nextCircuitWireId(activity)`** — arrow function thuần, nhại đúng khuôn `nextCircuitNodeId`:
```js
nextCircuitWireId: activity => {
    const existingIds = new Set(
        [...activity.querySelectorAll('[data-role="circuit-wire"]')].map(wire => wire.getAttribute('data-wire-id')),
    );
    let sequence = 1;
    while (existingIds.has(`w${sequence}`)) sequence += 1;
    return `w${sequence}`;
},
```
(Khớp ví dụ netlist JSON ở `SPEC.md` §7: `{"id": "w1", "from": {"node": "in-a", "pin": "out"}, "to": {"node": "xor-1", "pin": "a"}}`.)

**6. State machine nối dây hai cú click — `handleCircuitPinClick(activity, pinButton)`.** Gọi từ `handleCircuitCanvasAction` khi `target.closest('[data-role="circuit-pin"]')` khớp. Gọi `armedSource = activity.querySelector('[data-role="circuit-pin"][data-circuit-wire-source="true"]')`.

- **Chưa có `armedSource` (click đầu tiên):**
  - Pin không phải `output` → feedback = `circuitWireSourceRequired`; không arm gì; return.
  - Pin là `output` → de-arm mọi `[data-role="circuit-palette-item"]` (`aria-pressed="false"`), gọi `clearCircuitSelection(activity)`, rồi arm pin này (`dataset.circuitWireSource='true'`, `aria-pressed='true'`), `clearCircuitFeedback(activity)`; return.
- **Đã có `armedSource` (click thứ hai):**
  - `pinButton === armedSource` → hủy arm (toggle off): `dataset.circuitWireSource='false'`, `aria-pressed='false'`, `clearCircuitFeedback(activity)`; KHÔNG tạo wire, không hiện lỗi; return.
  - `pinButton.dataset.nodeId === armedSource.dataset.nodeId` (cùng node) → feedback = `circuitWireSelfConnection`; GIỮ NGUYÊN armedSource để thử lại; return.
  - `pinButton.dataset.pinDirection !== 'input'` (không phải input hợp lệ) → feedback = `circuitWireTargetInvalid`; giữ armed; return.
  - Đã có wire khác trỏ vào đúng `(pinButton.dataset.nodeId, pinButton.dataset.pinName)` (`activity.querySelector('[data-role="circuit-wire"][data-to-node="…"][data-to-pin="…"]')` khác null) → feedback = `circuitWireOccupied`; giữ armed; return.
  - Hợp lệ (input pin, khác node, chưa có wire đến) → `createCircuitWire(activity, armedSource, pinButton)`; disarm `armedSource`; `clearCircuitFeedback(activity)`; `handleResponseChange(activity)`.

Mọi nhánh "giữ armed để thử lại" đúng tiền lệ đã có ở U01 (`activateCircuitCell` giữ nguyên trạng thái đã arm khi ô bị chiếm — dòng 496–503).

**7. Xóa wire — click là xóa ngay, không có bước chọn riêng.** `handleCircuitCanvasAction` thêm nhánh: `target.closest('[data-role="circuit-wire"]')` → `deleteCircuitWire(activity, wire)`:
```js
deleteCircuitWire: function (activity, wire) {
    wire.remove();
    this.clearCircuitFeedback(activity);
    this.handleResponseChange(activity);
},
```
Lý do không cần bước "chọn rồi mới xóa" như node: wire chỉ có hai thao tác (tạo/xóa), không có "move" — giữ đơn giản, nhất quán triết lý "no cleverness" của dự án. Bàn phím: Enter/Space hoạt động qua listener `keydown` đã mở rộng selector (mục 9).

**8. Thứ tự dispatch trong `handleCircuitCanvasAction`** (khóa cứng để không mơ hồ, dù pin/node/wire vốn không lồng nhau nên thứ tự không đổi kết quả — khóa để Codex khỏi tự chọn):
```
delete-circuit-node  →  circuit-wire (xóa)  →  circuit-pin (state machine)  →  circuit-node (select/activate)  →  circuit-cell
```

**9. Mở rộng selector bàn phím** (dòng 337–339 hiện tại) — thêm `, [data-role="circuit-pin"], [data-role="circuit-wire"]` vào chuỗi `closest(...)`.

**10. Mutual exclusion giữa 3 "mode": tool-armed / node-selected / pin-armed.** Thêm helper mới:
```js
clearCircuitWireArm: activity => {
    activity.querySelectorAll('[data-role="circuit-pin"][data-circuit-wire-source="true"]').forEach(pin => {
        pin.dataset.circuitWireSource = 'false';
        pin.setAttribute('aria-pressed', 'false');
    });
},
```
- `armCircuitTool`: gọi thêm `this.clearCircuitWireArm(activity);` (cùng chỗ đang gọi `clearCircuitSelection`).
- `selectCircuitNode`: gọi thêm `this.clearCircuitWireArm(activity);` ở đầu hàm (cùng chỗ đang gọi `clearCircuitSelection`). Không cần de-arm palette tool ở đây — `handleCircuitCanvasAction` đã đảm bảo `selectCircuitNode` chỉ được gọi khi không tool nào đang arm.
- `handleCircuitPinClick` nhánh arm-pin (click đầu, pin output hợp lệ): de-arm palette tool + `clearCircuitSelection` như mô tả ở mục 6 (không gọi `clearCircuitWireArm` ở đây vì đang tự set chính trạng thái đó).

**11. Cascade-delete: xóa node phải xóa mọi wire nối tới nó.** Sửa `deleteCircuitNode`:
```js
deleteCircuitNode: function (activity, deleteButton) {
    const nodeItem = deleteButton.closest('[data-role="circuit-node-item"]');
    const nodeId = nodeItem?.querySelector('[data-role="circuit-node"]')?.dataset.nodeId;
    if (nodeId) this.deleteCircuitWiresForNode(activity, nodeId);
    nodeItem?.remove();
    this.clearCircuitFeedback(activity);
    this.handleResponseChange(activity);
},
deleteCircuitWiresForNode: (activity, nodeId) => {
    activity.querySelectorAll('[data-role="circuit-wire"]').forEach(wire => {
        if (wire.getAttribute('data-from-node') === nodeId || wire.getAttribute('data-to-node') === nodeId) {
            wire.remove();
        }
    });
},
```
Lý do bắt buộc: nếu không cascade-delete, UI có thể tạo ra netlist có `unknownNodeReference` — trạng thái mà LOG-06 yêu cầu phải báo lỗi ở tầng chấm điểm, nhưng ở tầng UI không nên để người dùng tạo ra được nó một cách vô ý.

**12. Tính lại tọa độ wire khi move node.** Sửa nhánh "move" trong `activateCircuitCell` (dòng 512–520 hiện tại), thêm một dòng sau khi cập nhật `nodeItem.style.left/top`:
```js
this.recalculateCircuitWiresForNode(activity, selectedNode.dataset.nodeId, selectedNode.dataset.nodeKind, x, y);
```
Hàm mới:
```js
recalculateCircuitWiresForNode: function (activity, nodeId, kind, x, y) {
    activity.querySelectorAll('[data-role="circuit-wire"]').forEach(wire => {
        if (wire.getAttribute('data-from-node') === nodeId) {
            const offset = this.circuitPinOffset(kind, 'output', wire.getAttribute('data-from-pin'));
            wire.setAttribute('x1', String(x + offset.x));
            wire.setAttribute('y1', String(y + offset.y));
        }
        if (wire.getAttribute('data-to-node') === nodeId) {
            const offset = this.circuitPinOffset(kind, 'input', wire.getAttribute('data-to-pin'));
            wire.setAttribute('x2', String(x + offset.x));
            wire.setAttribute('y2', String(y + offset.y));
        }
    });
},
```
Lý do bắt buộc: không tính lại thì wire hiển thị "đứt" khỏi node sau khi di chuyển — bug thấy được ngay, vi phạm "không workaround, implementation bền vững" của AGENTS.md.

**13. `collectResponse` — thay `wires: []`.** Nhánh circuit (dòng 646–660 hiện tại), thay dòng 657:
```js
wires: [...activity.querySelectorAll('[data-role="circuit-wire"]')].map(wire => ({
    id: wire.getAttribute('data-wire-id'),
    from: { node: wire.getAttribute('data-from-node'), pin: wire.getAttribute('data-from-pin') },
    to: { node: wire.getAttribute('data-to-node'), pin: wire.getAttribute('data-to-pin') },
})),
```
Khớp đúng shape netlist JSON ở `SPEC.md` §7.

**14. `resetActivity` — xóa wire cùng lúc xóa node.** Thêm ngay cạnh dòng 377 hiện tại (`activity.querySelectorAll('[data-role="circuit-node-item"]').forEach(node => node.remove());`):
```js
activity.querySelectorAll('[data-role="circuit-wire"]').forEach(wire => wire.remove());
```

**15. Message keys mới** (thêm vào `getMessages()`, giữ đúng quy ước `typeof _ === 'function' ? _('...') : '...'`):
- `circuitPinInputLabel`: `'Chân vào {pin} của nút {id}'`
- `circuitPinOutputLabel`: `'Chân ra {pin} của nút {id}'`
- `circuitWireLabel`: `'Dây nối {from} tới {to}. Bấm để xóa.'`
- `circuitWireSourceRequired`: `'Hãy bấm vào chân ra (bên phải nút) trước để bắt đầu nối dây.'`
- `circuitWireSelfConnection`: `'Không thể nối một nút với chính nó.'`
- `circuitWireTargetInvalid`: `'Hãy bấm vào một chân vào (bên trái nút) để hoàn tất dây nối.'`
- `circuitWireOccupied`: `'Chân vào này đã có dây nối tới.'`

**16. CSS mới** (`export/electronics-logic.css`) — yêu cầu cấu trúc, không khóa từng giá trị pixel/màu:
- `.electronics-logic-circuit__wire-layer`: `position:absolute; top:0; left:0; width:480px; height:320px; pointer-events:none;` z-index nằm giữa cell (mặc định) và node-item (`z-index:2`) — ví dụ `z-index:1`.
- `.electronics-logic-circuit__wire`: `pointer-events:auto; cursor:pointer;` stroke dùng màu nhất quán với bảng màu hiện có (vd tối theo `#344054` như border node).
- `.electronics-logic-circuit__pin`: `position:absolute; width:12px; height:12px; margin:-6px; border-radius:50%;` nền phân biệt input/output; `[data-circuit-wire-source="true"]` dùng cùng kiểu outline xanh như `[data-circuit-selected="true"]` của node (`border-color:#175cd3; outline:0.15rem solid #175cd3`) để nhất quán thị giác.

## `KHÔNG LÀM`

- Không gọi `validateTopology` hay bất kỳ hàm nào của `circuit-netlist.js`/`circuit-grader.js` từ tầng UI — việc đó đã có sẵn, đã đông cứng, thuộc pipeline chấm điểm, không thuộc U02.
- Không sửa `core/boolean-grader.js` để thêm `'circuit'` vào allowlist mode của `validateExercise` (dòng 26). Đã xác nhận bằng đọc code rằng việc này CẦN THIẾT để có chấm điểm circuit thật, nhưng không nằm trong DoD của U02 (`PLAN.md` dòng 167 chỉ nói "Click source → target, delete wire và feedback kết nối sai" — không nhắc chấm điểm).
- Không sửa `checkActivity` — giữ nguyên hành vi hiện tại (circuit mode tiếp tục rơi về `gradingUnavailable`). Quyết định có chủ đích, giống cách U01 đã để nguyên `checkActivity`.
- Không sửa `export/electronics-logic-grader.bundle.js` hay chạy `bun run bundle:resources` — U02 không đụng core/bridge, bundle không đổi.
- Không sửa `updateEmptyState` dòng 780 (điều kiện "đã điền" của circuit) để bắt buộc phải có wire — giữ nguyên "có ít nhất 1 node là đủ", tránh mở rộng phạm vi ngoài DoD.
- Không sửa `edition/electronics-logic.js` — chưa có form soạn bài circuit, không thuộc U02 (đã xác minh `authoringModes` không có `'circuit'`).
- Không thêm Playwright E2E spec mới cho circuit — chưa có đường vào UI author thật (lý do đầy đủ ở "Bối cảnh đã xác minh", xác minh lại bằng cách đọc toàn bộ 265 dòng của `electronics-logic.spec.ts`); test tích hợp Vitest/jsdom trong `electronics-logic.test.js` là bằng chứng NFR-05 cho task này.
- Không đổi kích thước canvas 480×320px hay lưới 40px — chỉ thêm sub-vị trí pin bên trong ô 40px sẵn có.
- Không thêm pan/zoom/auto-routing cho wire — wire là đường thẳng `<line>` nối trực tiếp hai điểm, không bo góc, không tránh chồng lấn.
- Không cho phép chọn nhiều wire cùng lúc hay có "undo" riêng cho wire — mỗi click trên wire xóa ngay chính wire đó.
- Không dùng `.dataset`/`.className` trên phần tử `<svg>`/`<line>` — luôn `setAttribute`/`getAttribute` (lý do kỹ thuật ở "Bối cảnh đã xác minh").
- Không viết U03 (chuyển mode, author/learner state, empty/invalid/runtime-error states) trong cùng lượt, kể cả khi thấy tiện tay làm luôn.
- Không chạm `translations/**`, không chạy `make translations`. Chuỗi UI mới dùng `_()` rồi dừng.
- Không tự tuyên bố gate `G-U0` đã đóng trong báo cáo hoàn thành — U02 chỉ là một phần; còn thiếu U03.
- Không đánh dấu `.skip`/`.todo`.
- Nếu diff logic thật (không tính test/CSS) có dấu hiệu vượt ~400 dòng, dừng lại và báo PM để tách bớt phạm vi thay vì cố hoàn tất một lượt (rủi ro R5, `PLAN.md` dòng 295).
- Không sửa lại "Thiết kế khóa" của packet này sau khi giao Codex; nếu phát hiện sai sót, PM sẽ thêm section `## PM AMENDMENT (ngày, lý do)` mới, không viết đè nội dung cũ.

## `ACCEPTANCE` (quan sát được)

1. Sau khi đặt 2 node (vd AND và OUTPUT) trên canvas, mỗi node có đúng số pin con bằng `GATE_PINS[kind].inputs.length + GATE_PINS[kind].outputs.length`, mỗi pin có `data-role="circuit-pin"`, `data-node-id`, `data-pin-name`, `data-pin-direction` đúng — bằng chứng trực tiếp cho phần "pin" của LOG-03.
2. Click một pin `input` đầu tiên (chưa arm gì) → không tạo wire, feedback = `circuitWireSourceRequired`, không pin nào có `data-circuit-wire-source="true"`.
3. Click một pin `output` đầu tiên → chính pin đó có `data-circuit-wire-source="true"` và `aria-pressed="true"`, feedback rỗng.
4. Từ trạng thái đã arm (mục 3), click lại đúng pin đó → disarm, feedback rỗng, không có wire nào được tạo.
5. Từ trạng thái đã arm, click một pin khác trên CÙNG node → feedback = `circuitWireSelfConnection`, pin nguồn vẫn còn armed.
6. Từ trạng thái đã arm, click một pin `output` trên node khác → feedback = `circuitWireTargetInvalid`, nguồn vẫn còn armed.
7. Từ trạng thái đã arm, click một pin `input` trên node khác ĐÃ có wire đến → feedback = `circuitWireOccupied`, nguồn vẫn còn armed.
8. Từ trạng thái đã arm, click một pin `input` hợp lệ trên node khác, chưa có wire đến → tạo đúng một `<line data-role="circuit-wire">` mới trong `[data-role="circuit-wire-layer"]`, với `data-wire-id`/`data-from-node`/`data-from-pin`/`data-to-node`/`data-to-pin` đúng, `x1/y1/x2/y2` khớp `circuitPinOffset` cộng tọa độ node; nguồn hết armed; feedback rỗng — bằng chứng trực tiếp cho LOG-02 vế "nối bằng source pin → target pin".
9. Tạo 2 wire liên tiếp → `data-wire-id` lần lượt là `w1` rồi `w2`.
10. Click trực tiếp vào một `<line data-role="circuit-wire">` đã có → wire biến mất khỏi DOM ngay, không cần bước chọn trước, `handleResponseChange` được gọi.
11. Bàn phím: focus một pin/wire hợp lệ rồi nhấn Enter hoặc Space → cùng hiệu ứng như click chuột.
12. Xóa một node đang có ≥ 1 wire nối tới/từ nó (qua nút xóa node có sẵn từ U01) → mọi wire có `data-from-node` hoặc `data-to-node` bằng id node đó biến mất khỏi DOM cùng lúc.
13. Di chuyển một node đang có wire (chọn node rồi click ô mới, cơ chế move có sẵn từ U01) → `x1/y1` (nếu node là nguồn) hoặc `x2/y2` (nếu là đích) của MỌI wire liên quan cập nhật đúng theo tọa độ mới, wire không liên quan không đổi.
14. `collectResponse(activity).netlist.wires` phản ánh đúng, đầy đủ danh sách wire hiện có trên DOM theo đúng shape `{id, from:{node,pin}, to:{node,pin}}`; nếu chưa có wire nào, trả `[]` do DOM trống — bằng chứng trực tiếp cho LOG-03.
15. Gọi `resetActivity(activity)` khi đang có cả node lẫn wire → sau khi gọi, không còn phần tử `[data-role="circuit-node-item"]` hay `[data-role="circuit-wire"]` nào trong DOM.
16. Arm một pin nguồn, sau đó click một nút trong palette (arm một tool đặt node) → pin nguồn tự động hết armed.
17. Arm một pin nguồn, sau đó click chọn một node khác (không qua tool) → pin nguồn tự động hết armed.
18. Toàn bộ chuỗi test hiện có của U01 (node add/move/delete/select, occupied-cell rejection, id sequencing) tiếp tục pass không đổi — không phá vỡ hành vi cũ.
19. `git diff --stat` chỉ chạm đúng danh sách ở "FILE ĐƯỢC SỬA" — đặc biệt mọi file `core/*.js`, `edition/electronics-logic.js`, `export/electronics-logic-grader.bundle.js` giữ nguyên byte-for-byte.

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js

# Core không được đỏ ở U02 (U02 không sửa file nào trong core/, chỉ dùng qua bridge)
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend đầy đủ — tổng số ca không được thấp hơn baseline 355/355 (13 file)
npx vitest run public/files/perm/idevices/base/electronics-logic

# Lint — dùng bunx trực tiếp, KHÔNG dùng bare `npx biome` (Windows/Git Bash không có make;
# kể cả có, make fix/make lint không phủ public/files/perm/idevices/**)
bunx @biomejs/biome check \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.css
```

**Không** chạy `bun x playwright test` — chưa có đường vào UI author thật cho mode circuit (xem "Bối cảnh đã xác minh"). **Không** chạy `bun run bundle:resources` — U02 không đụng core/bridge, bundle không đổi (xem "KHÔNG LÀM").

**Ghi chú coverage:** giống U01, U02 thêm logic sản xuất mới vào một file hiện có (`export/electronics-logic.js`) — theo AGENTS.md §5.3, patch coverage trên các dòng mới/sửa phải ≥ 90%. Chạy coverage scoped đúng file này (`--coverage.include` trỏ `export/electronics-logic.js`, `--coverage.exclude` trỏ `export/electronics-logic-grader.bundle.js`, `--coverage.reporter=json` để có `coverage-final.json` phục vụ soi dòng/nhánh chưa phủ — không chỉ tin bảng tóm tắt) và dán số Branch/Function/Line cho riêng file, không chỉ số coverage toàn cục.

Kỳ vọng: toàn bộ Vitest xanh; `core/` không đổi kết quả so với trước U02; lint sạch; không có rebuild bundle nào xảy ra.

## `ĐẦU RA`

- `git diff --stat` chỉ chạm đúng danh sách "FILE ĐƯỢC SỬA" ở trên + `.ai/packets/U02-wire-ui.md`. Không file nào khác bị đổi — kể cả không đổi bất kỳ `core/*.js`, `edition/electronics-logic.js`, `export/electronics-logic-grader.bundle.js`.
- Output đầy đủ (pass/fail, số ca) cho từng lệnh ở `TEST BẮT BUỘC`, và xác nhận tổng số ca của `npx vitest run public/files/perm/idevices/base/electronics-logic` **không giảm** so với baseline 355/355 (13 file) — dán số tổng trước/sau.
- Xác nhận rõ ràng `export/electronics-logic-grader.bundle.js` KHÔNG đổi (hash trước/sau giống nhau) — vì U02 không đụng core/bridge, khác U01 (U01 có rebuild bundle).
- Dán trực tiếp output thật (không mô tả bằng lời) xác nhận từng mục trong 19 `ACCEPTANCE` ở trên, kèm tên test + số dòng trong `electronics-logic.test.js` chứng minh mỗi mục — không chấp nhận một test duy nhất tuyên bố phủ nhiều mục mà không có assertion tương ứng.
- Nêu rõ, trung thực, tối thiểu các rủi ro/giới hạn còn lại sau U02:
  1. Chấm điểm circuit thật (`core/boolean-grader.js` chưa nhận `mode: 'circuit'`) vẫn chưa hoạt động — cần một task riêng sửa file đông cứng này, rebuild bundle, và thêm smoke test tương ứng trong `electronics-logic-grader.test.js`.
  2. Chưa có form soạn bài (authoring) cho circuit mode trong `edition/electronics-logic.js` — `authoringModes` vẫn thiếu `'circuit'`.
  3. U02 không tự đóng gate `G-U0` — cần U03 (`PLAN.md` dòng 168, phụ thuộc U02+T03+K04+E04) mới đủ điều kiện đề xuất đóng.
  4. `updateEmptyState`'s điều kiện "đã điền" cho circuit mode (chỉ cần ≥1 node, không cần wire) chưa phản ánh đúng ngữ nghĩa "mạch hoàn chỉnh" — để lại cho U03 ("empty/invalid/runtime-error states" theo đúng DoD của U03) quyết định có cần sửa hay không.
- Không tự bắt đầu U03 trong cùng lượt dù thấy toàn bộ `ACCEPTANCE` đã xanh.
