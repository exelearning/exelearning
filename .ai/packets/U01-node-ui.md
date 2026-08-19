# Task Packet — U01: Node UI

- `TASK`: U01 — Node UI (nguồn: `PLAN.md` dòng 166, 4 giờ, phụ thuộc `G-E0,P04`). DoD nguyên văn: "Palette, add/move/delete node trên grid/SVG; không pan/zoom/auto-layout." Task đầu tiên của cụm "Ngày 8 — Half-adder và node UI" (`PLAN.md` dòng 225-228, sau khi E04 đã đóng `G-E0` giữa ngày), và cũng là task đầu của chuỗi ba task U01→U02→U03 cùng khép gate `G-U0 — UI slice` (`PLAN.md` dòng 90: "Cuối ngày 9 | Half-adder nối/chấm được trong iDevice | Dùng grid/form nối pin fallback và gắn `Limited`"; dòng 233: "Gate G-U0 cuối ngày; feature freeze"). **U01 một mình không đóng `G-U0`** — chỉ đóng góp đúng nửa đầu của LOG-02 ("Thêm/di chuyển/xóa node"); phần "nối bằng source pin → target pin" (U02) và "chuyển mode, author/learner state" (U03) vẫn còn thiếu. `G-E0` (E01-E04) đã được PM/tester xác minh độc lập **CLOSED** (`repo-map.md`, mục "E04 Half-adder fixture evidence"). `P04` (Schema/lifecycle skeleton, `PLAN.md` dòng 123) đã được xác minh độc lập trước đó (`repo-map.md` mục "C04/P04 dependency re-verification for E01", 2026-08-13: `schema-lifecycle.test.js` 22/22 pass cô lập) và tiếp tục xanh xuyên suốt mọi regression tới tận E04 (345/345) — không cần chạy lại riêng cho U01.
- `SPEC`: LOG-01 (`SPEC.md` dòng 256) — "Palette có Input, Output/LED, NOT, AND, OR, XOR." — đây là toàn bộ yêu cầu palette của U01. LOG-02 (`SPEC.md` dòng 257) — "Thêm/di chuyển/xóa node; nối bằng source pin → target pin." — **U01 chỉ làm vế đầu** (thêm/di chuyển/xóa); vế "nối... pin" là U02, không được làm trong task này. PLAT-06 (`SPEC.md` dòng 209) — "Dữ liệu sai hiển thị lỗi tiếng Việt và không crash" — áp dụng cho nhánh `circuit` mới trong `validateData`. NFR-07 (`SPEC.md` dòng 371) — "Lỗi người học bằng tiếng Việt; log kỹ thuật không hiển thị trực tiếp" — áp dụng cho thông báo từ chối khi đặt node vào ô đã chiếm. NFR-05 (`SPEC.md` dòng 369) — "Core/grader mới đạt branch coverage tối thiểu 90%; UI ưu tiên integration/E2E" — U01 là UI, nên bằng chứng ưu tiên là test tích hợp thật (render DOM thật + dispatch event thật) trong `export/electronics-logic.test.js`, không phải một Playwright spec mới (xem "Bối cảnh đã xác minh" — chưa có đường vào UI thật cho mode circuit).
- `SKILLS`: `exelearning-logic-alpha` (domain/gate `G-U0`), `test-driven-development` (viết test cho `export/electronics-logic.js` bằng Red-Green-Refactor thật qua colocated `electronics-logic.test.js` — RED = test render/click/collectResponse cho mode `circuit` chưa tồn tại → fail; GREEN = thêm đúng nhánh khóa ở "Thiết kế khóa").
- `MUC TIEU`: Learner runtime (`export/electronics-logic.js`) render được palette 6 loại gate (lấy từ `GATE_PINS` của `circuit-netlist.js` qua bridge mới, không tự định nghĩa lại danh sách) và canvas dạng lưới cố định, đơn vị lưới 40px; người học thêm, di chuyển, xóa node bằng click/bàn phím (không kéo chuột, không pan/zoom/auto-layout) khi `data.mode === 'circuit'`; `collectResponse` trả đúng `{ netlist: { schemaVersion:1, nodes:[{id,kind,x,y}], wires:[] } }` để U02 (nối dây) và bước chấm điểm sau này tiêu thụ; `validateData` từ chối netlist sai hình dạng bằng lỗi tiếng Việt, không crash.
- `ĐẦU RA`: Dùng lại đúng `GATE_PINS`/`parseNetlist` có sẵn trong `core/circuit-netlist.js` (đã đóng băng từ E01) qua một dòng bridge mới trong `core/boolean-grader-browser.mjs` — không tự định nghĩa lại danh sách gate hay tự viết validate hình dạng node/netlist trong `export/electronics-logic.js`. Không sửa `edition/electronics-logic.js`. Không thêm Playwright E2E mới (lý do đầy đủ ở "Bối cảnh đã xác minh").

## PM AMENDMENT (2026-08-15, sau khi Codex báo hoàn thành U01 — bắt buộc đóng trước khi coi U01 là xong)

PM/tester đã xác minh độc lập toàn bộ báo cáo hoàn thành U01 của Codex: tự chạy lại `electronics-logic.test.js` (36/36), core (297/297), regression đầy đủ (354/354, đúng baseline 345 + 9), tự tính SHA-256 cho cả 6 file "đóng băng" (`edition/electronics-logic.js`, `schema-lifecycle.js`, `boolean-grader.js`, `circuit-netlist.js`, `circuit-engine.js`, `circuit-grader.js` — khớp chính xác từng ký tự), tự rebuild bundle độc lập (byte-for-byte giống hệt, 27.191 bytes/SHA-256 `fa33bea8...`), tự đo lại coverage file-level (96.75/88/98.93/98.16 — khớp chính xác). Không phát hiện số liệu bịa. Nhưng khi đọc trực tiếp `coverage-final.json` (`branchMap`/`b`) thay vì chỉ tin số tổng, phát hiện một nhánh logic **mới, thuộc phạm vi U01**, chưa có test nào chạm tới:

`nextCircuitNodeId` (`export/electronics-logic.js`, dòng 560-568 ở bản đã giao — hàm hoàn toàn mới của U01):
```js
nextCircuitNodeId: (activity, kind) => {
    const existingIds = new Set(
        [...activity.querySelectorAll('[data-role="circuit-node"]')].map(node => node.dataset.nodeId),
    );
    const prefix = kind.toLowerCase();
    let sequence = 1;
    while (existingIds.has(`${prefix}-${sequence}`)) sequence += 1;
    return `${prefix}-${sequence}`;
},
```
Callback `.map(node => node.dataset.nodeId)` (dòng 562) chỉ thật sự chạy khi đã có **ít nhất một node cùng tồn tại** lúc gọi hàm. Grep toàn bộ `electronics-logic.test.js` (848 dòng đã giao) xác nhận: không có test nào đặt 2 node trở lên trước khi assert — mọi test hiện có chỉ tạo tối đa 1 node. Vòng lặp tránh trùng ID (`and-1` → `and-2`, v.v.) do đó có mặt trong code nhưng **chưa từng được một test nào chứng minh hoạt động đúng**. Đây không phải hành vi sai đã biết, không vi phạm `ACCEPTANCE` nào đã liệt kê ở dưới, không chặn `G-U0` — chỉ là một đường code mới thiếu test. Theo yêu cầu PM: đóng khoảng trống này bằng test thật trước khi làm bất kỳ việc gì khác, kể cả trước khi đề xuất đóng U01.

**Phạm vi sửa của amendment — CHỈ một file, đã có sẵn trong "FILE ĐƯỢC SỬA" gốc bên dưới, không mở rộng danh sách:**

| File | Yêu cầu bổ sung |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` | Thêm test case: đặt 2 node cùng `kind` (vd 2 node `AND` tại 2 ô lưới trống khác nhau) → node thứ nhất có id dạng `and-1`, node thứ hai `and-2` (xác nhận qua `dataset.nodeId` hoặc qua `collectResponse().netlist.nodes`) — phải là assertion thật trên giá trị id cụ thể, không chỉ đếm số lượng node. Có thể bổ sung thêm case xóa `and-1` rồi đặt `AND` mới → id được cấp lại `and-1` (chứng minh vòng lặp dựa trên tập ID hiện có tại thời điểm gọi, không phải bộ đếm tăng dần toàn cục), nhưng không bắt buộc nếu case đầu đã đủ phủ dòng 560-568. |

**`KHÔNG LÀM` (áp dụng riêng cho amendment này, cộng thêm vào `KHÔNG LÀM` gốc bên dưới):**
- Không sửa bất kỳ file nào khác ngoài `electronics-logic.test.js` — không đổi logic `nextCircuitNodeId` hay bất kỳ hàm nào khác trong `electronics-logic.js` để "dễ test hơn". Logic hiện tại đúng, chỉ thiếu test.
- Không tranh thủ bắt đầu U02/U03 trong cùng lượt — amendment này chỉ đóng nốt U01, dừng lại ngay sau khi xanh.
- Không đổi bundle, không đổi bất kỳ file nào trong 6 file "đóng băng" đã xác minh ở trên.

**Bằng chứng bắt buộc khi báo lại (không nhận xác nhận bằng lời — AGENTS.md §13 mục 6):**
- Output thật của `npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` — tổng số ca phải ≥ 37 (36 hiện có + tối thiểu 1 mới), toàn bộ pass.
- Output thật của `npx vitest run public/files/perm/idevices/base/electronics-logic` — tổng số ca phải ≥ 355, không giảm ở file nào khác so với 354 hiện tại.
- Coverage scoped lại cho `export/electronics-logic.js` (cùng cách override `--coverage.exclude` đã dùng khi giao U01, vì `vitest.config.mts` vẫn exclude `public/files/perm/**`) — xác nhận dòng 560-568 không còn nằm trong "Uncovered Line #s" (file production không đổi nên dải dòng này giữ nguyên).
- `bunx @biomejs/biome check` lại trên `electronics-logic.test.js`.

Sau khi phần này xanh và có bằng chứng dán thật, PM mới coi U01 là đóng và xét tiếp U02.

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

- **Vì sao `edition/electronics-logic.js` (author-facing) bị loại khỏi phạm vi U01, khác tiền lệ K02:** K02 thêm `'kmap'` vào `edition/`'s `authoringModes` vì kmap tái dùng nguyên cơ chế authoring đã có của T01 (expression/minterms). Circuit thì khác — LOG-07 (`SPEC.md` dòng 262: "Người soạn map input/output và khai báo truth table chuẩn") cho thấy authoring của circuit là một cơ chế **khai báo công thức kỳ vọng theo từng output** (đúng hình dạng `testbench.expected` mà E04 đã khóa: `{Sum:"A XOR B", Carry:"A AND B"}`), **không phải** tác giả tự vẽ mạch tham chiếu bằng chính Node/Wire UI. Không có form authoring nào khớp hình dạng này tồn tại. Thêm `'circuit'` vào dropdown mode của `edition/` mà chưa có form authoring đúng sẽ cho phép tác giả lưu activity circuit vô nghĩa (không `netlist`/`testbench` hợp lệ) mà không bị chặn — đúng loại rủi ro PLAT-06 mà bản thân PM AMENDMENT của K02 đã từng vá. Vì vậy U01 **chỉ** đụng learner runtime (`export/`), không đụng `edition/`.
- **`core/schema-lifecycle.js` đã đọc lại — không cần sửa gì cho U01 (khác gap PLAT-06 mà K02 phát hiện):** `SUPPORTED_MODES` đã có `'circuit'`, còn `AUTHORING_MODES` **cố ý không có** `'circuit'` — nghĩa là mọi kiểm tra dành riêng cho authoring (`prompt` rỗng, số biến, `validateAnswer`) đã tự động bỏ qua cho mode circuit, đúng như trạng thái "supported nhưng chưa có form tác giả" mà U01 giữ nguyên. Đây là hành vi **đã đúng sẵn**, không phải khoảng trống cần vá.
- **`export/electronics-logic.js` đã đọc lại toàn bộ 593 dòng, các điểm nối bắt buộc cho nhánh `circuit`:**
  - `supportedModes` (dòng 7): hiện `['boolean', 'truthTable', 'kmap']`, thiếu `'circuit'`.
  - `renderView` (dòng 37-48): 2 chuỗi ternary (`learnerControl`, `emptyMessage`) rẽ theo `data.mode`, hiện fallback cuối cùng (không khớp `truthTable`/`kmap`) là nhánh `boolean`. Phải chèn nhánh `data.mode === 'circuit'` **trước** fallback boolean, không phải thay thế nó.
  - `validateData` (dòng 188-226): `invalidVariables` (dòng 196-202), `invalidAuthoring`/`answerSource` (dòng 204-206) hiện là kiểm tra **vô điều kiện** cho mọi mode — với circuit, các trường này không có ý nghĩa (không có form authoring) nên phải được **bỏ qua** khi `data.mode === 'circuit'`. Nhánh `data.mode === 'kmap'` (dòng 208-213, gọi `getCore()`) là khuôn mẫu trực tiếp cho nhánh `circuit` mới: gọi `getCircuitNetlist()`, kiểm tra tồn tại + gọi `parseNetlist(data.netlist)` trong `try/catch` (throw → đẩy lỗi `invalidNetlist` vào mảng `errors`, không throw ra ngoài `validateData`).
  - `collectResponse` (dòng 411-429): dispatch bằng cách **dò phần tử DOM** (không dò `data.mode` trực tiếp) — `learner-expression` → boolean, `kmap-row` → kmap, còn lại rơi vào fallback `{values:[...]}` (truth-table). Nếu không thêm nhánh dò `[data-role="circuit-canvas"]` **trước** fallback này, activity circuit sẽ âm thầm trả `{values: []}` sai hoàn toàn — đây là điểm dễ bỏ sót nhất trong toàn bộ task, phải kiểm tra kỹ khi tự test.
  - `renderBehaviour` (dòng 228-271): node được tạo **động sau** lần render/bind đầu tiên (giống hệt kmap group, dòng 340-357 tạo `<li>` bằng `document.createElement` sau khi đã bind xong). Cơ chế đúng đã có sẵn ở dòng 258-261 (`kmap-group-list` bind **một lần** ở container, dùng `event.target.closest('[data-action="delete-kmap-group"]')` để nhận diện phần tử con tạo sau). **Bắt buộc áp dụng đúng khuôn mẫu delegation này cho node** (bind một lần trên `[data-role="circuit-canvas"]`, không `addEventListener` riêng lẻ từng node) — nếu bind trực tiếp từng node, node tạo ra sau lần render đầu sẽ không phản hồi click.
  - `checkActivity` (dòng 431-461): **không cần sửa gì.** Đã xác minh ngược tới tận `core/boolean-grader.js` (dòng 26): `validateExercise()` có allowlist cứng `!['boolean','truthTable','kmap'].includes(exercise.mode)` → với `mode:'circuit'` sẽ `throw new TypeError(...)` ngay dòng đầu `gradeActivity`. `checkActivity`'s `try/catch` (dòng 451-460) đã bắt mọi throw và rơi về `messages.gradingUnavailable` — đúng hành vi "chưa thể chấm mạch điện" mong muốn, **hoàn toàn miễn phí, không cần viết thêm dòng code nào**. Kiểm tra `incomplete` (dòng 436-439) cũng không cản trở: response `{netlist:{...}}` không có `expression`/`values`/`cells` nên `incomplete` luôn `false`, request đi thẳng tới grader và throw đúng như trên.
  - `updateEmptyState` (dòng 519-532): ternary hiện chỉ xét `expression`/`truthValues`/`kmapValues`; cần thêm nhánh `circuitNodes.length > 0` theo đúng khuôn mẫu đã có (không thay đổi 3 nhánh cũ).
- **Cấm sửa `core/boolean-grader.js` để "thêm circuit vào allowlist"** — đây là một cách "sửa" hợp lý bề ngoài nhưng SAI: file này đã đóng băng từ E03, và nếu thêm `'circuit'` vào allowlist của `validateExercise`, request sẽ đi tiếp vào `gradeExpression` (dòng 180) — hàm này không biết đọc `response.netlist`, sẽ hỏng theo cách không graceful thay vì rơi về `gradingUnavailable` như hiện tại. Giữ nguyên file này.
- **`core/circuit-netlist.js` đã đọc lại dòng 1-73, 199-204 (đóng băng từ E01, không đổi):** `GATE_PINS` đúng thứ tự `INPUT, OUTPUT, NOT, AND, OR, XOR` (khớp thứ tự liệt kê của LOG-01) — palette phải lấy đúng `Object.keys(GATE_PINS)` theo thứ tự này, không tự chép tay một mảng khác. `validateNodes` (dòng 31-44) yêu cầu mỗi node `{id: chuỗi không rỗng và duy nhất, kind: một key hợp lệ của GATE_PINS, x: số hữu hạn, y: số hữu hạn}` — khớp chính xác hình dạng `{id,kind,x,y}` mà E04's fixture đã dùng. `parseNetlist(raw)` (dòng 64-73) yêu cầu `schemaVersion===1`, `nodes`/`wires` là mảng (mảng rỗng hợp lệ — `{nodes:[...], wires:[]}` từ U01 sẽ pass), throw `TypeError` nếu sai, trả về bản sao sâu nếu đúng. `module.exports` (dòng 199-204): `{GATE_PINS, parseNetlist, topologicalSort, validateTopology}`.
- **`core/boolean-grader-browser.mjs` đã đọc lại toàn bộ 9 dòng — hiện KHÔNG expose bất kỳ module Circuit nào ra browser** (chỉ `boolean-core.js`, `boolean-grader.js`, `kmap-group-validator.js` → `$electronicsLogicCore`/`$electronicsLogicGrader`/`$electronicsLogicKmapValidator`). Phải thêm dòng thứ tư theo đúng khuôn mẫu 3 dòng hiện có: `import circuitNetlist from './circuit-netlist.js';` + `globalThis.$electronicsLogicCircuitNetlist = circuitNetlist;`. Việc này **bắt buộc rebuild bundle** theo đúng tiền lệ K02/K03. Baseline bundle hiện tại (chưa đổi từ K03, E04 không chạm bundle): `electronics-logic-grader.bundle.js` = **22.739 bytes**, SHA-256 `ef3795e11bc8bccf872a895268dce0e8b36d41eab72c6f9b32a84ec56e8017dc` (`repo-map.md` mục "K03 Group validator evidence").
- **Vì sao U01 không cần Playwright E2E mới:** `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` (265 dòng, đã đọc lại) chỉ có **một** cơ chế để vào một mode: `editor.locator('[data-field="mode"]').selectOption(...)` trên dropdown authoring. U01 cố tình không thêm `'circuit'` vào dropdown đó (xem bullet đầu tiên) nên không có hành trình người dùng thật nào để E2E hóa ở task này — viết một spec E2E cho circuit bây giờ sẽ phải giả lập trạng thái Yjs trực tiếp, không phải hành trình thật. NFR-05 ("UI ưu tiên integration/E2E") được đáp ứng bằng `export/electronics-logic.test.js`: đây là test tích hợp thật theo đúng khuôn mẫu đã dùng cho kmap/truth-table — render HTML thật, gán vào `document.body.innerHTML`, dispatch event DOM thật, assert trên DOM thật, không mock các thao tác này. Việc thêm mode circuit vào UI author + E2E là phạm vi tự nhiên của U03 (`PLAN.md` dòng 168: "Chuyển mode... empty/invalid/runtime-error states").
- **Rủi ro R5 (`PLAN.md` dòng 295): "AI sửa lan rộng | Diff ngoài file hoặc >400 dòng logic/task | Dừng, tách packet/diff; chỉ một writer."** U01 chạm một file lớn (`export/electronics-logic.js`, hiện 593 dòng) ở nhiều điểm nối cùng lúc — nếu tổng diff logic thật (không tính test/CSS) có xu hướng vượt ~400 dòng, Codex phải dừng và báo PM để tách bớt phạm vi thay vì tự ý cố hoàn tất trong một lượt.
- **Baseline hồi quy hiện tại (PM/tester tái lập độc lập, `repo-map.md` mục "E04 Half-adder fixture evidence"):** `npx vitest run public/files/perm/idevices/base/electronics-logic` → **Test Files 13 passed (13); Tests 345 passed (345)**. Đây là số phải giữ nguyên hoặc chỉ tăng sau U01, không được giảm.
- **Quyết định hình dạng dữ liệu:** activity circuit lưu netlist ở field cấp cao nhất mới `data.netlist` (anh em với `data.answer`, không lồng bên trong) — khớp đúng cách `SPEC.md` §7 trình bày ví dụ netlist như một khối JSON riêng, tách khỏi hợp đồng `answer` chung của Boolean/TruthTable/Kmap. `data.answer` vẫn phải là plain object hợp lệ (kiểm tra chung, không đổi) nhưng có thể để rỗng `{}` cho mode circuit vì không dùng tới.

## `FILE ĐƯỢC SỬA` (4 file + 1 file rebuild + packet)

| File | Loại thay đổi |
|---|---|
| `public/files/perm/idevices/base/electronics-logic/core/boolean-grader-browser.mjs` | Thêm `import circuitNetlist from './circuit-netlist.js';` + `globalThis.$electronicsLogicCircuitNetlist = circuitNetlist;`. Không sửa 3 dòng bridge hiện có. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js` | **Chỉ rebuild** bằng `bun run bundle:resources`; không sửa tay. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js` | `supportedModes` += `'circuit'`; `renderView` thêm nhánh `circuit` (trước fallback boolean) gọi `renderCircuit`; `renderCircuit(messages)` render palette 6 nút (từ `getCircuitNetlist().GATE_PINS`) + canvas lưới cố định 40px (SVG hoặc lai SVG/HTML, node/ô lưới phải là phần tử focusable native tương đương khuôn mẫu kmap); `validateData` thêm nhánh `circuit` (bỏ qua `invalidVariables`/`invalidAuthoring`, thêm `coreUnavailable`/`invalidNetlist` qua `getCircuitNetlist().parseNetlist`); `renderBehaviour` bind palette (trực tiếp) + canvas (delegation, khuôn mẫu `kmap-group-list`); thêm các hàm thao tác node (đặt/di chuyển/xóa, gọi `handleResponseChange` sau mỗi thao tác giống `toggleKmapCell`/`createKmapGroup`); `collectResponse` thêm nhánh dò `[data-role="circuit-canvas"]` trả `{netlist:{schemaVersion:1,nodes,wires:[]}}`; `resetActivity` xóa node + bỏ arm + bỏ chọn; `updateEmptyState` thêm nhánh `circuitNodes.length > 0`; `getMessages` thêm tối thiểu `incompleteCircuit` + các chuỗi UI mới (nhãn palette/canvas, thông báo ô đã chiếm) qua `_()`; thêm `getCircuitNetlist: () => (typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicCircuitNetlist : undefined)` cạnh `getCore`/`getKmapValidator`. **Không sửa** `checkActivity` (đã đúng sẵn, xem "Bối cảnh đã xác minh"). |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js` | Test colocated cho mode `circuit`: render đúng 6 nút palette đúng thứ tự/`data-node-kind`; arm tool + click ô trống → thêm node đúng toạ độ snap; click ô đã chiếm khi đang arm → không thêm node, có thông báo; chọn node + activate ô trống khác → di chuyển; chọn node + xóa → node biến mất; `collectResponse` đúng shape `{netlist:{schemaVersion:1,nodes,wires:[]}}`; `checkActivity` hiển thị đúng `messages.gradingUnavailable` (không throw, không cần mock gì thêm ngoài `beforeEach` đã set `global.$electronicsLogicGrader = grader` thật); `validateData` từ chối `data.netlist` sai hình dạng bằng `invalidNetlist`; `resetActivity` xóa sạch. Thêm `global.$electronicsLogicCircuitNetlist = require('../core/circuit-netlist.js')` (hoặc `import`, giữ nhất quán cách nạp 3 module core hiện có ở đầu file) vào `beforeEach`. |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.css` | Style palette (nút, trạng thái armed/`aria-pressed`), canvas lưới, node (theo từng `kind`), trạng thái chọn/từ chối — theo đúng quy ước BEM-like (`electronics-logic-circuit__...`) và biến màu/spacing đã dùng cho `.electronics-logic-kmap__*`. |
| `.ai/packets/U01-node-ui.md` | Packet này. |

## Thiết kế khóa (chốt trong U01 — Codex có thể tự chọn cơ chế DOM chi tiết, nhưng PHẢI giữ đúng các hợp đồng dưới đây)

- **Node schema:** `{ id: string không rỗng và duy nhất trong response hiện tại, kind: một trong 'INPUT'|'OUTPUT'|'NOT'|'AND'|'OR'|'XOR', x: number bội số 40, y: number bội số 40 }` — khớp `validateNodes` của `circuit-netlist.js`, không tự thêm field khác.
- **Đơn vị lưới:** 40px (cùng quy ước toạ độ đã dùng ở fixture half-adder của E04: `in-a: x:40,y:40`, `xor-1: x:200,y:40`, v.v.). Canvas cố định, không pan/zoom/auto-layout — đề xuất mặc định 480×320 (12×8 ô), đủ rộng hơn vùng half-adder đã dùng; kích thước pixel chính xác không bị khóa cứng, miễn giữ cố định/dạng lưới.
- **Palette:** đúng 6 nút, thứ tự = `Object.keys(getCircuitNetlist().GATE_PINS)` (`INPUT, OUTPUT, NOT, AND, OR, XOR`), mỗi nút `data-role="circuit-palette-item"` + `data-node-kind` + `aria-pressed`. Click để "arm" (chọn công cụ đặt node) — chỉ một nút được armed tại một thời điểm; không tự vẽ icon phức tạp, nhãn chữ theo `_()` là đủ.
- **Tương tác — click/bàn phím, không kéo chuột** (quyết định thiết kế của PM, suy ra từ tiền lệ KM-03/K02 — không phải một dòng SPEC.md riêng cho circuit, nhưng nhất quán với triết lý accessibility đã áp dụng cho kmap trong toàn bộ codebase này):
  1. Armed palette item + click ô lưới trống trên canvas → thêm node mới tại toạ độ đã snap.
  2. Armed palette item + click ô đã có node → **từ chối**, không đổi trạng thái, hiển thị thông báo tiếng Việt qua vùng `aria-live` (NFR-07).
  3. Chọn một node đã đặt (không armed tool nào) rồi kích hoạt một ô trống khác → di chuyển node đó tới toạ độ mới (giữ nguyên `id`/`kind`).
  4. Chọn một node rồi kích hoạt điều khiển xóa (nút xóa gắn với node đang chọn, khuôn mẫu như nút xóa của mỗi kmap group) → xóa node khỏi canvas và khỏi response.
  5. Mọi ô lưới/node PHẢI tới được bằng Tab và kích hoạt được bằng Enter/Space — dùng phần tử focusable native (`<button>` hoặc tương đương) giống hệt cách kmap dùng `<select>`/`<button>` cho từng ô, không tự chế cơ chế `tabindex` thủ công phức tạp.
- **Tạo node động sau render đầu → bắt buộc dùng event delegation** gắn một lần trên `[data-role="circuit-canvas"]` (khuôn mẫu `kmap-group-list`, `electronics-logic.js` dòng 258-261), không `addEventListener` riêng lẻ từng node.
- **`collectResponse` khi mode circuit:** `{ netlist: { schemaVersion: 1, nodes: [{id,kind,x,y}, ...], wires: [] } }` — `wires` luôn là mảng rỗng ở U01 (U02 mới thêm dây).
- **`validateData` khi `data.mode === 'circuit'`:** bỏ qua `invalidVariables`/`invalidAuthoring` (không áp dụng cho circuit); thêm — nếu `getCircuitNetlist()` không tồn tại/không có `parseNetlist` → lỗi `coreUnavailable`; nếu có nhưng gọi `parseNetlist(data.netlist)` throw → lỗi `invalidNetlist` (bắt bằng `try/catch`, không để throw lọt ra ngoài `validateData`, đúng PLAT-06).
- **`checkActivity` khi mode circuit:** không sửa gì — hành vi "Không thể chấm bài lúc này." đã tự động đúng qua cơ chế đã xác minh ở "Bối cảnh đã xác minh". Nếu trong lúc test tự thấy hành vi khác đi (throw lọt ra ngoài, hoặc treo UI), đó là dấu hiệu một thay đổi khác trong task đã vô tình phá vỡ giả định này — dừng lại và kiểm tra, không tự thêm nhánh đặc cách để "vá" triệu chứng.
- **`resetActivity` khi mode circuit:** xóa toàn bộ node khỏi canvas (về đúng trạng thái trống ban đầu), bỏ armed palette item (`aria-pressed="false"` hết), bỏ chọn node đang chọn (nếu có).

## `KHÔNG LÀM`

- Không sửa `edition/electronics-logic.js` hay bất kỳ file nào dưới `edition/` — không thêm `'circuit'` vào `authoringModes`, không thêm option "Circuit"/"Mạch điện" vào dropdown mode authoring. Lý do đầy đủ ở "Bối cảnh đã xác minh".
- Không sửa `core/schema-lifecycle.js` — không thêm `'circuit'` vào `AUTHORING_MODES`. File này đã đúng sẵn cho trạng thái "supported nhưng chưa có authoring form" của circuit.
- Không sửa `core/boolean-grader.js` — đặc biệt không thêm `'circuit'` vào allowlist mode của `validateExercise` (dòng 26). Làm vậy sẽ phá vỡ cơ chế graceful-stub đang hoạt động đúng, khiến `checkActivity` rơi vào nhánh lỗi không graceful thay vì `gradingUnavailable`.
- Không sửa `core/circuit-netlist.js`, `core/circuit-engine.js`, `core/circuit-grader.js`, `core/boolean-core.js` — đã đóng băng từ E01-E04, chỉ dùng qua `getCircuitNetlist()`.
- Không nối `circuit-grader.js`/`circuit-engine.js` vào `checkActivity` hay bất kỳ đường chấm điểm thật nào cho mode circuit — chấm điểm mạch thật cần có wire (U02) trước, không thuộc U01.
- Không viết U02 (nối wire, source pin → target pin, nửa sau LOG-02) hay U03 (chuyển mode, author/learner state, empty/invalid/runtime-error states) trong cùng lượt, kể cả khi thấy tiện tay làm luôn.
- Không kéo-thả (drag-and-drop) để đặt/di chuyển node — chỉ click/bàn phím.
- Không pan/zoom/auto-layout (nguyên văn DoD `PLAN.md` dòng 166).
- Không thêm NAND/NOR/XNOR hay bất kỳ node kind nào ngoài 6 kind hiện có trong `GATE_PINS` — LOG-10 (P1) bị khóa tới sau Gate Release.
- Không thêm Playwright E2E spec mới cho circuit — chưa có đường vào UI author thật (lý do đầy đủ ở "Bối cảnh đã xác minh"); test tích hợp Vitest/jsdom trong `electronics-logic.test.js` là bằng chứng NFR-05 cho task này.
- Không chạm `translations/**`, không chạy `make translations`. Chuỗi UI mới dùng `_()` rồi dừng.
- Không tự tuyên bố gate `G-U0` đã đóng trong báo cáo hoàn thành — U01 chỉ là một phần ba, còn thiếu U02 và U03.
- Không đánh dấu `.skip`/`.todo`.
- Nếu diff logic thật (không tính test/CSS) có dấu hiệu vượt ~400 dòng, dừng lại và báo PM để tách bớt phạm vi thay vì cố hoàn tất một lượt (rủi ro R5, `PLAN.md` dòng 295).

## `ACCEPTANCE` (quan sát được)

1. Palette hiển thị đúng 6 nút, đúng thứ tự `INPUT, OUTPUT, NOT, AND, OR, XOR`, mỗi nút có `data-node-kind` tương ứng — bằng chứng trực tiếp cho LOG-01.
2. Arm một nút palette (vd `AND`) rồi kích hoạt một ô lưới trống trên canvas → đúng một node mới xuất hiện với `kind:'AND'`, toạ độ là bội số 40.
3. Arm một nút palette rồi kích hoạt một ô đã có node → **không** thêm node mới, node cũ giữ nguyên, có thông báo tiếng Việt qua vùng `aria-live`.
4. Chọn một node đã đặt rồi kích hoạt một ô trống khác → node di chuyển tới toạ độ mới, vẫn đúng một node (không nhân đôi), `id` giữ nguyên.
5. Chọn một node rồi kích hoạt điều khiển xóa → node biến mất khỏi canvas và khỏi kết quả `collectResponse`.
6. `collectResponse` khi mode `circuit` trả đúng `{ netlist: { schemaVersion: 1, nodes: [{id,kind,x,y}, ...], wires: [] } }` khớp chính xác các node hiện có, không có phần tử `wires`.
7. Mọi ô lưới/node thao tác được bằng bàn phím thuần (Tab tới, Enter/Space kích hoạt) — xác minh bằng test dispatch `keydown`, không chỉ `click`.
8. Nút "Kiểm tra" khi mode `circuit` hiển thị đúng `messages.gradingUnavailable` ("Không thể chấm bài lúc này."), không throw, không treo UI — và không có dòng code mới nào trong `checkActivity` để đạt việc này (đã miễn phí từ hành vi có sẵn của `boolean-grader.js`).
9. `validateData` từ chối `data.mode:'circuit'` với `data.netlist` sai hình dạng (thiếu `nodes`/`wires`, node thiếu `kind` hợp lệ, `x`/`y` không phải số, v.v.) bằng lỗi `invalidNetlist` trong mảng `errors`, không throw ra ngoài `validateData`, `renderView` vẫn render được thông báo lỗi thay vì crash (PLAT-06).
10. `resetActivity` xóa sạch toàn bộ node, bỏ trạng thái armed của palette, bỏ chọn — canvas quay về đúng trạng thái trống như lần render đầu.
11. `git diff --stat` chỉ chạm đúng danh sách ở "FILE ĐƯỢC SỬA" — đặc biệt `edition/electronics-logic.js`, `core/schema-lifecycle.js`, `core/boolean-grader.js`, mọi file `core/circuit-*.js` giữ nguyên byte-for-byte.

## `TEST BẮT BUỘC`

```bash
# Đơn lẻ
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js

# Rebuild bundle grader (bắt buộc sau khi sửa boolean-grader-browser.mjs)
bun run bundle:resources

# Core không được đỏ ở U01 (U01 không sửa file nào trong core/, chỉ dùng qua bridge)
npx vitest run public/files/perm/idevices/base/electronics-logic/core

# Regression frontend đầy đủ — tổng số ca không được thấp hơn baseline 345/345 (13 file)
npx vitest run public/files/perm/idevices/base/electronics-logic

# Lint — dùng bunx trực tiếp, KHÔNG dùng bare `npx biome` (Windows/Git Bash không có make;
# kể cả có, make fix/make lint không phủ public/files/perm/idevices/**)
bunx @biomejs/biome check \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.css \
  public/files/perm/idevices/base/electronics-logic/core/boolean-grader-browser.mjs
```

**Không** chạy `bun x playwright test` — chưa có đường vào UI author thật cho mode circuit (xem "Bối cảnh đã xác minh").

**Ghi chú coverage:** khác E04, U01 **có** thêm logic sản xuất mới vào một file hiện có (`export/electronics-logic.js`) — theo AGENTS.md §5.3, patch coverage trên các dòng mới/sửa phải ≥ 90%. Chạy coverage scoped đúng file này (`--coverage.include` trỏ `export/electronics-logic.js`, theo đúng khuôn mẫu đã dùng ở E01-E03) và dán số Branch/Function/Line cho riêng file, không chỉ số coverage toàn cục.

Kỳ vọng: toàn bộ Vitest xanh; `core/` không đổi kết quả so với trước U01; lint sạch; bundle rebuild thành công và chứa đúng một occurrence mới của `$electronicsLogicCircuitNetlist`.

## `ĐẦU RA`

- `git diff --stat` chỉ chạm đúng danh sách "FILE ĐƯỢC SỬA" ở trên + `.ai/packets/U01-node-ui.md`. Không file nào khác bị đổi — kể cả không đổi `edition/electronics-logic.js`, `core/schema-lifecycle.js`, `core/boolean-grader.js`, mọi `core/circuit-*.js`.
- Output đầy đủ (pass/fail, số ca) cho từng lệnh ở `TEST BẮT BUỘC`, và xác nhận tổng số ca của `npx vitest run public/files/perm/idevices/base/electronics-logic` **không giảm** so với baseline 345/345 (13 file) — dán số tổng trước/sau.
- Bằng chứng rebuild bundle: kích thước + SHA-256 trước/sau (trước = 22.739 bytes / `ef3795e11bc8bccf872a895268dce0e8b36d41eab72c6f9b32a84ec56e8017dc`), và xác nhận đúng một occurrence mới của `$electronicsLogicCircuitNetlist` trong file bundle.
- Dán trực tiếp output thật (không mô tả bằng lời) xác nhận từng mục trong 11 `ACCEPTANCE` ở trên — đặc biệt mục 8 (chứng minh `checkActivity` không bị sửa mà vẫn đúng hành vi) và mục 9 (JSON đầy đủ của lỗi `invalidNetlist`).
- Nêu rõ, trung thực, tối thiểu các rủi ro/giới hạn còn lại sau U01:
  1. Chưa có form authoring cho mode circuit — tác giả chưa thể tự tạo activity circuit qua UI thật; đây là khoảng trống chưa được task nào trong `PLAN.md` nêu tên tường minh (không tự quyết định thuộc U03 hay task khác — nêu ra để PM quyết định sau).
  2. U01 không tự đóng gate `G-U0` — cần U02 (nối wire) và U03 (chuyển mode, author/learner state) mới đủ điều kiện đề xuất đóng.
  3. Kích thước canvas cố định (đề xuất 480×320/40px) là lựa chọn của Codex trong task này, có thể cần điều chỉnh khi U02 thêm phần render dây nối.
- Không tự bắt đầu U02/U03 trong cùng lượt dù thấy toàn bộ `ACCEPTANCE` đã xanh.
