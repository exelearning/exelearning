TASK: U03 — Bốn mode iDevice
SPEC: LOG-07, SPEC.md dòng 342 ("Authoring state và learner state tách riêng"), SPEC.md dòng 359 ("Circuit: 100% testbench; lỗi cấu trúc chặn chạy và trả check tương ứng"), PLAT-06, AT-02, AT-08, NFR-05; Gate G-U0 (PLAN.md dòng 90)
SKILLS: `exelearning-logic-alpha` (toàn bộ); `test-driven-development` (bắt buộc cho `core/circuit-grader.js`, `core/schema-lifecycle.js`, `core/boolean-grader.js` — thuộc loại "Core/validator/engine/grader" theo PLAN.md §2.2); UI/lifecycle (`edition/electronics-logic.js`, `export/electronics-logic.js`) theo hàng "UI/lifecycle" của cùng bảng — test integration/smoke theo Task Packet này, không bắt buộc TDD nhưng khuyến khích.

## Phụ thuộc — đã xác minh PASS

PLAN.md dòng 168: `U03 | 2 | U02,T03,K04,E04`. Cả bốn phụ thuộc đã đóng:
- U02 (Wire UI): packet `.ai/packets/U02-wire-ui.md`, đã verify PASS.
- T03: PM/tester verify PASS 2026-08-12 (repo-map.md).
- K04 + gate G-K0: PM/tester verify "recommended CLOSED" 2026-08-13 (repo-map.md).
- E04 + gate G-E0: PM/tester verify PASS 2026-08-14 (repo-map.md).

Gate G-P0 (Platform ready) vẫn **FAIL** kể từ P03/P04 — đây là chặn **toàn repo**, không liên quan Electronics Logic (Chromium E2E, ~494/34/7, Docker-gathered, repo-map.md dòng 420). PLAN fallback (repo-map.md dòng 206) đã cho phép Core work độc lập dưới nhãn `Technical Prototype` từ lâu; mọi task T01→E04→U01→U02 đều note "G-P0 remains FAIL... unaffected". U03 kế thừa tình trạng này nguyên vẹn — không chặn task, chỉ ảnh hưởng NHÃN release cuối cùng (Technical Prototype vs Solo Logic Alpha), không phải nội dung packet này.

## MỤC TIÊU

Học liệu circuit-mode (mạch logic) hiện có UI dựng/nối (U01+U02) nhưng **chưa chấm điểm được** — `boolean-grader.js` từ chối thẳng `exercise.mode === 'circuit'`, và `schema-lifecycle.js` gần như bỏ qua toàn bộ validate cho mode này. Gate G-U0 (PLAN.md dòng 90) yêu cầu rõ: "Half-adder **nối/chấm được** trong iDevice" trước cuối ngày 9. U03 là task cuối cùng có thể đóng khoảng trống "chấm được" này (U01/U02 chỉ là UI thuần, I01/I02 không thêm logic chấm mới). Vì vậy U03 phải nối **toàn bộ đường chấm điểm circuit-mode** — không chỉ UI chuyển mode như dòng DoD một dòng của PLAN.md gợi ý — cộng với UI author tối thiểu để tạo được testbench (input/output/expected) cho half-adder, và hiển thị kết quả chấm đúng trong runtime.

**Đây là một quyết định mở rộng phạm vi (scope) của PM dựa trên bằng chứng gate G-U0.** User (chủ dự án) đã xác nhận PASS qua AskUserQuestion ngày 2026-08-16 — chọn "Approve full grading wire-up (recommended)". Packet này chính thức ở phạm vi đầy đủ, không còn là đề xuất chờ duyệt. Chi tiết quyết định giữ nguyên ở mục ĐẦU RA #1 để truy vết.

## Bổ sung phạm vi E2E (PM amendment, 2026-08-16)

U01 và U02 đều hoãn Playwright E2E với lý do đã re-verify: circuit mode chưa có lối vào UI author thật (dropdown `mode` chỉ có 3 option), viết E2E lúc đó buộc phải giả lập trạng thái Yjs trực tiếp thay vì hành trình thật. U03 là task xoá bỏ đúng rào cản đó — sau task này, dropdown `mode` có option `circuit` thật, và toàn bộ đường chấm điểm hoạt động. PM/tester đã hỏi lại user có nên thêm E2E ngay trong U03 thay vì đợi I01/I02 hay không; user chọn **"Add E2E spec to U03 now (recommended)"**. Do đó U03 bổ sung 1 file E2E mới vào FILE ĐƯỢC SỬA (mục 13) và một thiết kế khoá riêng (Thiết kế khoá #7) — xem chi tiết bên dưới. File E2E là file MỚI (chưa tồn tại), không có hash "trước" trong bảng Bối cảnh #12.

## Bổ sung: sửa lỗi tải trình duyệt cho schema-lifecycle.js (PM amendment, 2026-08-16, sau báo cáo Codex tại gate E2E)

Codex dừng đúng quy trình tại gate E2E (đúng tinh thần KHÔNG LÀM: gặp lệch giữa thiết kế khoá và thực tế thì dừng, báo PM) và báo cáo bằng chứng: cả 5 test Playwright (3 cũ + 2 mới) fail vì `[data-testid="electronics-logic-editor"]` không render; snapshot trình duyệt hiện "Dữ liệu Electronics Logic không hợp lệ." / "Không thể nạp bộ kiểm tra dữ liệu Electronics Logic." Toàn bộ 6 file unit test (155 test) vẫn PASS, bundle export vẫn build đúng, 10 file PHẢI GIỮ NGUYÊN vẫn khớp hash — lỗi CHỈ ở đường tải file thô trong trình duyệt thật, không phải ở logic chấm điểm.

PM/tester tự xác minh lại bằng cách đọc trực tiếp mã nguồn (không chỉ tin báo cáo), ngày 2026-08-16:
- `config.xml:15-18` — `edition-js` nạp `../core/schema-lifecycle.js` làm **classic script thô, không qua bundler**, trước `electronics-logic.js`.
- `core/schema-lifecycle.js:3` — đúng như Thiết kế khoá #2 đã khoá, có `const { isValidTestbench } = require('./circuit-grader.js');` ở top-level. Trình duyệt không có `require` toàn cục → dòng này ném `ReferenceError` ngay khi script nạp → phần còn lại của file, kể cả dòng 293 (`globalThis.$electronicsLogicSchemaLifecycle = lifecycle;`), không bao giờ chạy.
- `edition/electronics-logic.js:427` — điểm tiêu thụ DUY NHẤT của global này trong toàn bộ iDevice (`typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicSchemaLifecycle : undefined`, xác nhận bằng grep toàn thư mục) → global `undefined` → khớp chính xác lỗi Codex báo cáo. Không có file nào khác cần sửa để thoả điểm tiêu thụ này.
- `core/circuit-grader.js:3-5` — bản thân file này CŨNG có 3 `require()` top-level (`boolean-core.js`, `circuit-engine.js`, `circuit-netlist.js` — cả ba PHẢI GIỮ NGUYÊN). Vì vậy KHÔNG THỂ nạp `circuit-grader.js` thô trực tiếp vào `edition-js` để vá nhanh — sẽ kéo lỗi tương tự xuống 3 file đang khoá hash, không có cách né mà không sửa các file đó.
- `core/boolean-grader-browser.mjs` — file glue CHỈ phục vụ `export-js` (gán `$electronicsLogicCore`/`$electronicsLogicGrader`/`$electronicsLogicKmapValidator`/`$electronicsLogicCircuitNetlist`), CHƯA BAO GIỜ đụng tới `schema-lifecycle.js`. Đường tải `edition-js` và `export-js` được thiết kế TÁCH BIỆT từ đầu — không phải sơ suất cần "hợp nhất".
- Khác biệt then chốt: `schema-lifecycle.js` (không như `boolean-core.js`/`boolean-grader.js`/`kmap-group-validator.js`/`circuit-netlist.js`) đã tự đóng gói theo mẫu môi trường-kép ngay trong chính file (dòng 292-293: `module.exports` có bảo vệ `typeof module !== 'undefined'`, và `globalThis.$electronicsLogicSchemaLifecycle` luôn được gán) — file này vốn đã sẵn sàng làm entry point cho bundler, không cần file `.mjs` glue riêng như `boolean-grader-browser.mjs`.

**Quyết định PM — TỪ CHỐI đề xuất Option A của Codex** (bundle thêm schema-lifecycle vào `core/boolean-grader-browser.mjs`, đổi `edition-js` sang nạp chung bundle `electronics-logic-grader.bundle.js` với `export-js`): việc này mở lại 2 file đang PHẢI GIỮ NGUYÊN đại diện cho pipeline chấm điểm runtime đã đóng gate G-E0/E03/E04 (`core/boolean-grader-browser.mjs`, `export/electronics-logic-grader.bundle.js`), làm ACCEPTANCE #8 (10 file giữ nguyên hash) mất 2 phần tử, và trộn logic chấm điểm runtime (`gradeActivity`/`propagate`/kmap validator) vào bundle editor dù editor không bao giờ gọi tới — vi phạm ranh giới tách biệt edition/export mà kiến trúc hiện tại chủ đích giữ.

**Quyết định PM — PHÊ DUYỆT phương án thay thế**: bundle `core/schema-lifecycle.js` làm entry point trực tiếp (không cần file `.mjs` glue mới, vì file đã tự đăng ký `globalThis` sẵn) thành một bundle IIFE riêng, độc lập hoàn toàn với bundle chấm điểm hiện có. Xem Thiết kế khoá #8. `core/boolean-grader-browser.mjs` và `export/electronics-logic-grader.bundle.js` giữ nguyên trong danh sách PHẢI GIỮ NGUYÊN, không đổi. Đây là quyết định kỹ thuật trong phạm vi uỷ quyền PM (không đổi ACCEPTANCE #1-6 đã được user duyệt, không đổi hành vi/UX nào) — không cần hỏi lại user; xem ĐẦU RA/rủi ro #7.

**Cập nhật (lần 2, cùng ngày, sau khi Codex build thử theo thiết kế trên)**: giả định "không cần `.mjs` glue" ở quyết định trên SAI về cơ chế bundler — Bun bọc toàn bộ file entry viết theo CommonJS (`module.exports = ...`) trong một closure lazy không bao giờ được gọi khi không có consumer, nên dòng tự đăng ký `globalThis` bên trong không bao giờ chạy dù lệnh build báo exit 0. Quyết định KIẾN TRÚC ở trên (bundle độc lập, không đụng 2 file đã khoá gate G-E0/E03/E04) vẫn giữ nguyên đúng — chỉ sai một chi tiết triển khai. Xem xác minh độc lập và thiết kế đã sửa tại Thiết kế khoá #8 (mục "Cập nhật quan trọng") và ĐẦU RA/rủi ro #8.

## Bổ sung: sửa lỗi `validateData()` chấm sai `data.netlist` không tồn tại cho circuit mode (PM amendment, 2026-08-16, sau báo cáo Codex tại gate E2E, sau khi 2 bổ sung ở trên đã đóng)

Sau khi bundle schema-lifecycle (Thiết kế khoá #8, sửa lần 2) và coverage gate đều qua, Codex báo cáo gate G-U0 vẫn chưa đóng: Playwright đạt 3/5 (`truthTable`, kmap editing, kmap invalid-selection PASS; 2 test circuit mới — half-adder author/save/reload/preview và unconnected-circuit structural error — FAIL trước cả khi canvas mạch render). Codex xác định đúng nguyên nhân tại `export/electronics-logic.js` dòng 269-280: `validateData()` gọi `circuitNetlist.parseNetlist(data.netlist)` trên dữ liệu authoring/render, nhưng circuit mode lưu đáp án ở `answer.testbench` (đã khoá ở Thiết kế khoá #4), KHÔNG có field `netlist` cấp cao nhất nào trong dữ liệu đã lưu — netlist chỉ tồn tại tại runtime, do learner tự dựng qua canvas và được `collectResponse()` đọc lại từ DOM (Bối cảnh #5), chưa từng là một phần của `data` truyền vào `validateData()`/`renderView()`. Codex đúng quy trình: dừng lại, không tự xoá validation hay đổi data model ngoài thiết kế khoá, và chỉ ra unit test hiện có tại `export/electronics-logic.test.js` che khuất lỗi này bằng cách tự chèn `netlist: { schemaVersion: 1, nodes: [], wires: [] }` giả vào helper `createCircuitData()` (dòng 40-49) — dữ liệu giả này không tồn tại trong dữ liệu thật, nên unit test PASS trong khi luồng thật (Playwright, không đi qua helper giả) FAIL.

PM/tester tự xác minh lại bằng cách đọc trực tiếp mã nguồn (không chỉ tin báo cáo), cùng ngày:
- `export/electronics-logic.js:1-60` (`renderView`) — `validateData(data)` là bước gate ĐẦU TIÊN; nếu `valid: false`, hàm trả ngay section lỗi `.electronics-logic-runtime--invalid` và KHÔNG BAO GIỜ chạy tới nhánh render theo mode (kể cả `renderCircuit`) — xác nhận đây đúng là nguyên nhân canvas không render.
- `export/electronics-logic.js:240-293` (`validateData`, toàn bộ thân hàm, đọc lại lần nữa để chốt số dòng) — xác nhận đúng dòng 269-280 gọi `circuitNetlist.parseNetlist(data.netlist)` trong khối `try`, bắt lỗi thành `errors.push('invalidNetlist')`; đối chiếu nhánh `kmap` liền kề (dòng 263-267) chỉ kiểm tra SỰ TỒN TẠI của core module (`typeof core.mintermsToVector/vectorToKmapModel === 'function'`), KHÔNG kiểm tra hình dạng dữ liệu `data.answer`/`data.variables` — đây là mẫu đúng, nhất quán cho mọi mode: `validateData()` là gate cấu trúc nông (kiểm tra "render được không"), không phải nơi validate sâu hình dạng đáp án theo mode.
- `export/electronics-logic.js:192-231` (`renderCircuit(messages)`) — xác nhận hàm nhận DUY NHẤT tham số `messages`, KHÔNG nhận `data`; toàn bộ nội dung dựng palette từ `this.getCircuitNetlist().GATE_PINS` (core module tĩnh) và lưới ô trống 12×8 — không đọc `data.netlist`, `data.answer.testbench`, hay `data.variables` ở bất kỳ đâu. Chứng minh: render canvas ban đầu hoàn toàn không phụ thuộc hình dạng `data` — chỉ cần core module `circuitNetlist` đã nạp.
- `export/electronics-logic.js:1079-1094` (accessor `getCore`/`getKmapValidator`/`getCircuitNetlist`) — xác nhận không có helper `getCircuitGrader()`/tương đương để gọi `isValidTestbench` (từ `circuit-grader.js`) ngay trong `validateData()`; và `core/boolean-grader.js` (`module.exports = { ENGINE, gradeActivity }`, xác minh bằng grep) KHÔNG re-export `isValidTestbench` — không có đường validate `answer.testbench` sâu hơn ngay tại tầng này mà không mở lại file đang khoá (`boolean-grader-browser.mjs`) hoặc nhân bản logic (cả hai đều bị cấm ở KHÔNG LÀM).
- `export/electronics-logic.test.js:40-49` (`createCircuitData`) và dòng 1206-1239 (test `'validates circuit data through parseNetlist without applying Boolean authoring rules'`) — xác nhận đúng mô tả Codex: helper tự chèn `netlist` giả ở cấp `data`, và có 1 test riêng khẳng định hành vi SAI này (gọi `parseNetlist(data.netlist)`, kỳ vọng lỗi `invalidNetlist`) như thể đó là hành vi đúng. Grep toàn file xác nhận mọi usage `netlist` khác đều là kết quả `collectResponse(activity).netlist` (đúng — thuộc response runtime, không phải `data`), không có chỗ nào khác phụ thuộc field `data.netlist`.

Kết luận nguyên nhân gốc: đây là lỗ hổng thiết kế có từ trước (tiền-U03, khả năng từ lúc scaffold circuit mode ban đầu), giả định sai rằng dữ liệu đã lưu của circuit mode có `netlist` cấp cao nhất — không phải lỗi do Codex gây ra trong quá trình làm U03, và không liên quan 2 bổ sung bundler ở trên.

**Quyết định PM — PHÊ DUYỆT sửa `validateData()` theo đúng mẫu nhánh `kmap` liền kề**: bỏ hoàn toàn khối `try { circuitNetlist.parseNetlist(data.netlist) } catch { errors.push('invalidNetlist') }`, chỉ giữ kiểm tra sự tồn tại của core module (`coreUnavailable`) — xem Thiết kế khoá #9. Đây là lựa chọn tối thiểu, nhất quán kiến trúc (Single source of truth, AGENTS.md §1): không thêm field mới vào schema, không đổi data model đã khoá ở Thiết kế khoá #4 (`answer.testbench`), không mở lại `boolean-grader-browser.mjs`/`circuit-grader.js` để lấy `isValidTestbench`, không nhân bản logic validate netlist ở nơi khác. Đồng thời PHÊ DUYỆT sửa `export/electronics-logic.test.js`: xoá field `netlist` giả khỏi `createCircuitData()`, và thay test dòng 1206-1239 bằng test khẳng định ĐÚNG hành vi mới (xem Thiết kế khoá #9). Đây là quyết định kỹ thuật trong phạm vi uỷ quyền PM (không đổi ACCEPTANCE #1-6 đã được user duyệt, không đổi hành vi/UX nào cho learner — canvas vẫn render y hệt, chỉ khác ở chỗ KHÔNG còn bị chặn oan bởi validation sai) — không cần hỏi lại user; xem ĐẦU RA/rủi ro #9.

## Bổ sung: gỡ artifact `public/bundles/idevices.zip` cũ để Playwright đọc đúng mã nguồn hiện tại (PM amendment, 2026-08-16, sau báo cáo Codex "Playwright 3/5, phát hiện blocker #4 ở bundle cũ")

Sau khi Thiết kế khoá #9 được áp dụng đúng (Codex xác nhận bằng diff khớp chính xác thiết kế đã duyệt, toàn bộ unit test/coverage/build bundle PASS), Codex báo cáo gate G-U0 vẫn chưa đóng: Playwright vẫn 3/5, nhưng 2 test circuit fail vì lý do MỚI, không còn liên quan Thiết kế khoá #9 — node đặt đúng (6/6, đúng ID), nhưng test 1 (half-adder) báo "Không tìm thấy pin input-1.out.", và test 2 (unconnected circuit) kỳ vọng "Mạch chưa đúng cấu trúc, chưa thể chấm điểm." nhưng nhận "Không thể chấm bài lúc này." Codex tự điều tra bằng instrumentation chỉ-đọc (đã gỡ sau khi xong, xác nhận hash file spec E2E trở về đúng baseline) và xác định nguyên nhân: `public/app/yjs/ResourceFetcher.js` (dòng 715-716, 748-749) nạp mã runtime iDevice từ endpoint `/api/resources/bundle/idevices`, phục vụ trực tiếp từ artifact `public/bundles/idevices.zip` — đóng gói ngày 2026-08-14, TRƯỚC toàn bộ thay đổi U03. Codex đối chiếu hash/size: entry `electronics-logic.js` trong zip là 43.159 byte/`9c008527...` (mã nguồn hiện tại: 55.148 byte/`8255c4c5...`); entry grader bundle trong zip là 27.191 byte/`fa33bea8...` (bundle vừa build lại ở Thiết kế khoá #6: 31.566 byte/`abbba25b...`). Codex đúng quy trình: dừng lại, không tự chạy `bun scripts/build-resource-bundles.js` bản đầy đủ (đã cấm rõ ở KHÔNG LÀM), và xin PM quyết định giữa (a) thêm bước "targeted rebuild" chỉ cho `idevices.zip`, hoặc (b) gỡ lệnh cấm chạy full builder.

PM/tester tự xác minh lại toàn bộ chain bằng cách đọc trực tiếp mã nguồn (không chỉ tin báo cáo), cùng ngày:
- Đối chiếu hash Codex báo với Bối cảnh #12 dòng 90 trong chính packet này: `fa33bea8...` khớp CHÍNH XÁC với hash baseline TRƯỚC U03 của `export/electronics-logic-grader.bundle.js` đã ghi từ trước — xác nhận độc lập (không chỉ dựa lời Codex) rằng entry trong zip đúng là bản TRƯỚC khi Thiết kế khoá #6 chạy, không phải một phiên bản trung gian nào khác.
- `.gitignore:8` — `/public/bundles/` bị gitignore toàn bộ; xác nhận bằng `git check-ignore -v public/bundles/idevices.zip` (kết quả: khớp rule dòng 8) và `git status --porcelain public/bundles/` (kết quả: rỗng — không có gì để git theo dõi). Đây là artifact build cục bộ, không phải mã nguồn theo dõi bởi git — cùng loại với thư mục `coverage/` đã xử lý trước đó trong phiên làm việc này.
- `scripts/build-resource-bundles.js` (đọc toàn bộ 422 dòng) — xác nhận đúng báo cáo Codex: hàm `build()` (dòng 386-415) xoá TOÀN BỘ `public/bundles/` (`fs.rmSync(OUTPUT_PATH, {recursive:true})`, dòng 392-393) rồi build lại tuần tự theme/idevices/libs/common/content-css. KHÔNG có bất kỳ cờ CLI, biến môi trường, hay tham số nào để giới hạn phạm vi build (grep `process.argv`: không có kết quả trong file). `buildIdevicesBundle()` (dòng 189-244) gộp TẤT CẢ iDevice (không riêng electronics-logic) thành một `idevices.zip` duy nhất, không có tham số scope theo từng iDevice. File không export hàm nào (không `module.exports`) và tự gọi `build()` ngay khi nạp (dòng 418) — không thể `require()` lại để tái dùng logic mà không kích hoạt toàn bộ quy trình xoá-và-build-lại.
- `Makefile` (dòng 180, 545, 552, 556) và `package.json` (`build:all`, `bundle:resources`) — xác nhận `make bundle` (chạy `bun run build:all` → `bundle:resources` → CHÍNH XÁC `bun scripts/build-resource-bundles.js`) là điều kiện tiên quyết của `test-e2e`/`test-e2e-firefox`/`test-e2e-static`. Tức là đường "đúng chuẩn" theo AGENTS.md để chạy E2E vốn dĩ LUÔN build lại `idevices.zip` như một side effect. Máy Codex không có `make` (đã xác nhận nhiều lần suốt engagement) nên Codex luôn chạy `bun x playwright test ...` trực tiếp, âm thầm bỏ qua bước này từ đầu — khoảng trống này tồn tại xuyên suốt, chỉ lộ ra ở U03 vì đây là task đầu tiên thêm bề mặt runtime hoàn toàn mới (circuit mode) kể từ lần build zip gần nhất.
- `public/app/yjs/ResourceFetcher.js` (đọc trực tiếp dòng 286-307, 700-742, 748-790) — xác nhận đúng trích dẫn của Codex, và quan trọng hơn: có sẵn một đường lùi (fallback) ĐÃ HOẠT ĐỘNG trong chính mã sản phẩm, không cần viết gì mới. `loadBundleManifest()` (dòng 290-307) chỉ set `bundlesAvailable = true/false` dựa trên `GET /bundle/manifest` có trả HTTP OK hay không — kiểm tra SỰ TỒN TẠI, không kiểm tra độ mới. `fetchBundle()` (dòng 375-394) bắt lỗi/404 an toàn (`return null`, không throw) — nếu `GET /bundle/idevices` trả 404 (file không còn), `loadIdevicesBundle()` (dòng 748-755) nhận `allFiles === null`, đánh dấu `idevices:all` là "đã thử" với map rỗng rồi return — khiến hàm gọi nó (`fetchIdevice`, dòng 714-726) rơi xuống bước 5 CÓ SẴN: `fetchIdeviceFallback(ideviceType)` (dòng 788-825), gọi `GET /api/resources/idevice/:ideviceType`.
- `src/routes/resources.ts` (đọc trực tiếp dòng 13-19, 87-133, 173-221, 433-448) — route `/api/resources/idevice/:ideviceType` (dòng 174) và `/api/resources/bundle/idevices` (dòng 434) đều chỉ kiểm tra tồn tại file bằng `deps.fs.existsSync()`, không có cơ chế kiểm tra độ mới. Route fallback (dòng 174-221) gọi `buildFileList()` → `scanDirectory()` (dòng 87-121) — quét TRỰC TIẾP, ĐỆ QUY, KHÔNG lọc phần mở rộng, KHÔNG cache, toàn bộ `IDEVICES_BASE_PATH/electronics-logic/export/` mỗi lần gọi — đường lùi này LUÔN trả đúng nội dung hiện tại trên đĩa, gồm cả `electronics-logic.js` và `electronics-logic-grader.bundle.js` vừa build lại đúng ở Thiết kế khoá #6/#9.

Kết luận: có một lựa chọn thứ ba, an toàn hơn cả 2 phương án Codex đề xuất — KHÔNG rebuild gì cả, KHÔNG chạy bất kỳ script build nào, KHÔNG sửa `scripts/build-resource-bundles.js` (file ngoài phạm vi FILE ĐƯỢC SỬA của packet này). Chỉ cần XOÁ MỘT FILE artifact cục bộ đã gitignore (`public/bundles/idevices.zip`) để kích hoạt đường lùi có sẵn, đã là mã sản phẩm (không phải mã mới), thiết kế chủ đích cho đúng tình huống "bundle không có sẵn" — phục vụ mã nguồn hiện tại trực tiếp từ đĩa cho MỌI iDevice, không riêng electronics-logic. Đây là hành động cùng loại với việc xoá thư mục `coverage/` đã làm trước đó trong phiên này: dọn một build artifact cục bộ, không đụng mã nguồn theo dõi bởi git, không mở rộng FILE ĐƯỢC SỬA.

**Quyết định PM — PHÊ DUYỆT phương án thứ ba (xoá artifact, không rebuild)**: xem Thiết kế khoá #10. TỪ CHỐI phương án (a) targeted rebuild của Codex vì đòi hỏi viết logic mới (dù không persist) để tái tạo một phần `buildIdevicesBundle()` — không cần thiết khi đường lùi sẵn có đã đủ. TỪ CHỐI phương án (b) gỡ lệnh cấm full builder vì vẫn xoá-và-build-lại toàn bộ theme/libs/common/content-css ngoài phạm vi task, và vẫn đụng vào file build tooling dùng chung toàn dự án. Đây là quyết định kỹ thuật trong phạm vi uỷ quyền PM (không đổi ACCEPTANCE #1-6 đã được user duyệt, không đổi hành vi/UX học liệu — chỉ đổi CÁCH mã runtime được TẢI trong môi trường test, không đổi NỘI DUNG mã đó; không sửa file nào trong FILE ĐƯỢC SỬA hay bất kỳ file theo dõi bởi git nào) — không cần hỏi lại user; xem ĐẦU RA/rủi ro #10.

## Bối cảnh đã xác minh (đọc trực tiếp mã nguồn, ngày 2026-08-15)

1. `core/boolean-grader.js:26` — `validateExercise()` throw `TypeError` nếu `exercise.mode` không thuộc `['boolean', 'truthTable', 'kmap']`. `gradeActivity()` (dòng 174-181) chỉ có 3 nhánh dispatch (`truthTable`/`kmap`/else→expression) — không có circuit.
2. `core/schema-lifecycle.js:5-6` — `SUPPORTED_MODES` đã có `'circuit'`, nhưng `AUTHORING_MODES = ['boolean', 'truthTable', 'kmap']` cố tình loại trừ nó. Các nhánh validate bị gate theo `AUTHORING_MODES.includes(activity.mode)` tại dòng 192 (`emptyPrompt`), 201 (`hasEnoughVariables`), 206 (`authoring.answerSource`/`solution`), 216 (`validateAnswer`) — tất cả hiện bỏ qua circuit mode. Circuit-mode activity gần như luôn `valid:true` bất kể nội dung `answer`.
3. `core/circuit-grader.js` (145 dòng, đã đọc toàn bộ) — hợp đồng ĐÃ ĐÓNG dưới gate G-E0/E03/E04:
   - `isValidTestbench(testbench)` (dòng 23-48, hiện **không export**): `variables` là mảng 1-4 chữ cái A-D duy nhất; `inputs` khớp key chính xác với `variables`, giá trị là chuỗi non-empty (node ID); `outputs` là map non-empty, key/value đều chuỗi non-empty; `expected` khớp key chính xác với `outputs`, giá trị chuỗi non-empty (biểu thức Boolean).
   - `gradeCircuitResponse({netlist, testbench, maxScore})` (dòng 70-142): throw `TypeError('Testbench không hợp lệ.')` nếu `!isValidTestbench(testbench)`. Lỗi cấu trúc netlist/topology/mapping input-output → `{score: 0, checks: [{id: 'structure-...', passed: false, expected, actual}]}`, KHÔNG throw. Thành công → chạy tất cả `2^variables.length` tổ hợp, mỗi tổ hợp × mỗi output tạo 1 check `{id: 'case-<bits>-<tên output lowercase>', passed, expected, actual}`; `score = (passed/checks.length) * maxScore` làm tròn 4 chữ số thập phân.
4. `export/electronics-logic.js:830-873` — `collectResponse()` ĐÃ đúng cho circuit mode: dựng `{netlist: {schemaVersion, nodes, wires}}` từ DOM `[data-role="circuit-node"]`/`[data-role="circuit-wire"]`. KHÔNG cần sửa.
5. `export/electronics-logic.js:875-905` — `checkActivity()` gọi `grader.gradeActivity(...)` trong `try/catch` chung; lỗi bất kỳ (kể cả `TypeError` từ mode circuit hiện tại) rơi vào `catch` → `messages.gradingUnavailable`. Sau khi boolean-grader.js dispatch đúng, luồng này tự động hoạt động đúng — KHÔNG cần sửa `checkActivity`.
6. `export/electronics-logic.js:907-953` — `applyResult()` hiện có 3 nhánh: `kmapCells.length > 0` / `truthValues.length > 0` / else (giả định expression, đọc `result.checks[0]` và `check.id === 'expression-syntax'`). KHÔNG có nhánh circuit — một kết quả chấm circuit hợp lệ sẽ rơi vào nhánh `else` cuối, hiện chỉ `${messages.score}: ${result.score} / ${result.maxScore}.` mà không phân biệt "lỗi cấu trúc" (score luôn 0, cần thông báo mô tả) với "đã chấm thật" (cần "đúng X/Y") — vi phạm tinh thần PLAT-06 khi mạch lỗi cấu trúc.
7. `core/fixtures/circuit-half-adder.json` — hình mẫu testbench (`variables: ["A","B"]`, `inputs: {A:"in-a", B:"in-b"}`, `outputs: {Sum:"sum-out", Carry:"carry-out"}`, `expected: {Sum:"A XOR B", Carry:"A AND B"}`) dùng ID ngữ nghĩa — CHỈ để test core, không khớp scheme runtime thật.
8. `export/electronics-logic.js` (`nextCircuitNodeId`, đã đóng từ U01/U02) — node ID runtime luôn là `${kind.toLowerCase()}-${sequence}` (`input-1`, `input-2`, `and-1`, `output-1`...), gán theo **thứ tự đặt node trên canvas**, không phải tên ngữ nghĩa do tác giả/learner chọn. → `testbench.inputs`/`testbench.outputs` PHẢI được suy ra tự động từ thứ tự khai báo biến/đầu ra, không thể để tác giả gõ tay node ID.
9. `edition/electronics-logic.js` (370 dòng, đã đọc toàn bộ) — dropdown `mode` (dòng 180-184) chỉ có 3 option (`boolean`/`truthTable`/`kmap`), không có circuit. `collectEditorData()` (dòng 128-152) luôn set `answer.expression`/`minterms`/`dontCares`, chưa từng đụng đến `testbench`. `authoringModes: [...]` (dòng 10) là metadata tĩnh, KHÔNG được đọc ở bất kỳ đâu khác trong file (xác nhận qua đọc toàn văn) — an toàn để cập nhật cho nhất quán nhưng không ảnh hưởng hành vi. `validationMessages` (dòng 17-48) là bản sao phía client của `ERROR_MESSAGES` trong `schema-lifecycle.js`, được `createValidationAlert` (dòng 351) tra cứu theo `error.code` — **phải thêm key mới ở cả hai nơi, giá trị giống hệt nhau**.
10. `normalize()` (`schema-lifecycle.js:246-255`) trim `answer.expression` **vô điều kiện** (không kiểm tra mode) — do đó thiết kế khoá dưới đây PHẢI giữ `answer.expression`/`minterms`/`dontCares` luôn là kiểu đúng (string/array) kể cả ở circuit mode, nếu không `normalize()` sẽ crash khi tác giả lưu ở mode khác rồi quay lại.
11. `scripts/build-resource-bundles.js:75-94` (`buildElectronicsLogicGrader`) — hàm build private, không export, gọi `Bun.build({entrypoints:[...boolean-grader-browser.mjs], outdir, naming, target:'browser', format:'iife', minify:true})`. Hàm `build()` cấp cao (dòng 386-421) xoá (`fs.rmSync(OUTPUT_PATH, {recursive:true})`) và build lại TOÀN BỘ `public/bundles/` — vượt xa phạm vi task này.
12. Baseline SHA-256 (tính ngay trước khi viết packet này, `sha256sum`) — dùng để đối chiếu trước/sau:

```
d563c4b8d26b06f9a19f4dad36b31f1889cfdcb845324e3a53c739feb1c4b912  core/circuit-grader.js        [ĐƯỢC PHÉP ĐỔI — chỉ thêm export]
a5fedd0f52a5dee93daf6661424ac6535002303a294b42a74610e17edc946bf0  core/circuit-engine.js        [PHẢI GIỮ NGUYÊN]
2f78cb5216d4d15a659594b9b67a4d6a8231ba7498425cb9e893328cc5b2c138  core/circuit-netlist.js       [PHẢI GIỮ NGUYÊN]
11041529c97ad60f74c430a3c3585b5568bd0126f4dc89ca35f23c45492c9e0a  core/boolean-core.js          [PHẢI GIỮ NGUYÊN]
2f858b071fe4f84bfeb56d7d3a7050c3680f54adc5b3c822d4821fc6f31954f7  core/kmap-grader.js           [PHẢI GIỮ NGUYÊN]
7f13616008852099ccec3a52c5f1b223cec2329e93a09c64b16ba60da62a4270  core/kmap-group-validator.js  [PHẢI GIỮ NGUYÊN]
05dc2bb70e66fa2d207c17b9e9f54af5ca3bd5db9d15e671c8f2e2ad769c1f62  core/boolean-core-contract.js [PHẢI GIỮ NGUYÊN]
08e66f8763048dd8fb6692ec6ede31c4762d513ae8c9d69452901a8e69008412  core/schema-lifecycle.js      [ĐƯỢC PHÉP ĐỔI]
1ba8d5c0f76b28b50385234e0d903ca140666bdd38ac1f3bff5e5bf600dbaa30  core/boolean-grader.js        [ĐƯỢC PHÉP ĐỔI]
0fbbc1eb3295634507c0155883a8502906f24a3554c11af466014fa710f56631  core/boolean-grader-browser.mjs [PHẢI GIỮ NGUYÊN]
cacc7044431d30536dc106731b7b7d603242038ad07f2c8bb1b2ee6d0ba50625  edition/electronics-logic.js  [ĐƯỢC PHÉP ĐỔI]
ab5a75153886b975995303bdbb96add1b64b4b0ea9412cb3c058bd7978d8a85e  edition/electronics-logic.css [PHẢI GIỮ NGUYÊN]
d362e2f2ba52753331e08b82903e58de0ad83069a90cffb067b28c675175e8bc  export/electronics-logic.js   [ĐƯỢC PHÉP ĐỔI]
a167c5a82c0808643cd63f978b41e348ef204b3de698c4e2e73992b3cba87351  export/electronics-logic.css  [PHẢI GIỮ NGUYÊN]
fa33bea85dd1425e73d90ca9cd245fe8462f0e71bc4565a1122dcdb168497538  export/electronics-logic-grader.bundle.js [ĐƯỢC PHÉP ĐỔI — build lại, lần đầu tiên trong toàn bộ engagement]
bc3b96e8d4e06b451e44927b5edf0640dbedb383de19581c443d380bfd10efe2  export/electronics-logic.html [PHẢI GIỮ NGUYÊN]
87cfb3ddbc7d0f586f95ca665167b01614c3aeab1a9ca38fda43c51c44771e21  config.xml                    [ĐƯỢC PHÉP ĐỔI — bổ sung 2026-08-16, chỉ khối edition-js, xem Thiết kế khoá #8]
```

## FILE ĐƯỢC SỬA

1. `public/files/perm/idevices/base/electronics-logic/core/circuit-grader.js` — CHỈ thêm export `isValidTestbench`, không đổi logic/hành vi `gradeCircuitResponse` hay `isValidTestbench`.
2. `public/files/perm/idevices/base/electronics-logic/core/circuit-grader.test.js` — thêm test cho export mới.
3. `public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.js`
4. `public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.test.js`
5. `public/files/perm/idevices/base/electronics-logic/core/boolean-grader.js`
6. `public/files/perm/idevices/base/electronics-logic/core/boolean-grader.test.js`
7. `public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.js`
8. `public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.test.js`
9. `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js`
10. `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js`
11. `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js` — sinh ra bằng lệnh build trong TEST BẮT BUỘC, KHÔNG sửa tay.
12. `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.test.js` — thêm 1 khối `it()` mới cho mode circuit qua bundle (theo mẫu 2 khối hiện có).
13. `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` — FILE ĐÃ TỒN TẠI (265 dòng, hiện chỉ phủ `truthTable`/`kmap`), CHỈ THÊM 2 `test()` mới cho mode circuit vào `describe` sẵn có — không tạo file mới, không dùng `Write` để ghi đè, không đổi 3 test hiện có. Xem Thiết kế khoá #7.
14. `public/files/perm/idevices/base/electronics-logic/config.xml` — CHỈ đổi khối `edition-js` (dòng 15-18) theo Thiết kế khoá #8; không đổi `export-js` hay bất kỳ khối nào khác.
15. `public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.bundle.js` — file MỚI, sinh ra bằng lệnh build ở Thiết kế khoá #8, KHÔNG sửa tay.
16. `public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.test.js` — file MỚI, smoke test cho bundle mới, theo mẫu khoá ở Thiết kế khoá #8.
17. `public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle-browser.mjs` — file MỚI, glue module ESM làm entry point thật cho bundle edition-js, mirror `core/boolean-grader-browser.mjs`. Bổ sung 2026-08-16 sau khi Thiết kế khoá #8 (bản đầu) build "thành công" nhưng không hoạt động — xem Thiết kế khoá #8 mục "Cập nhật quan trọng".

## Thiết kế khóa

### 1. `core/circuit-grader.js` — thêm export (dòng 144 hiện tại)

```js
module.exports = Object.freeze({ gradeCircuitResponse, isValidTestbench });
```

### 2. `core/schema-lifecycle.js`

Thêm require ở đầu file (sau `'use strict';`):
```js
const { isValidTestbench: isValidCircuitTestbench } = require('./circuit-grader.js');
```

Đổi hằng số (dòng 5-6):
```js
const AUTHORING_MODES = Object.freeze(['boolean', 'truthTable', 'kmap', 'circuit']);
const EXPRESSION_ANSWER_MODES = Object.freeze(['boolean', 'truthTable', 'kmap']);
```
Lý do tách hai hằng số: `AUTHORING_MODES` chi phối `emptyPrompt`/`hasEnoughVariables` (circuit CẦN áp dụng — half-adder có 2 biến, cần đề bài không rỗng). `EXPRESSION_ANSWER_MODES` chi phối `authoring.answerSource`/`solution`/`validateAnswer` (circuit KHÔNG dùng shape này).

Thêm message (trong `ERROR_MESSAGES`):
```js
invalidTestbench: 'Testbench mạch điện không hợp lệ.',
```

Dòng 206 đổi `AUTHORING_MODES` → `EXPRESSION_ANSWER_MODES`:
```js
} else if (EXPRESSION_ANSWER_MODES.includes(activity.mode)) {
```

Dòng 216 đổi `AUTHORING_MODES` → `EXPRESSION_ANSWER_MODES`, và thêm nhánh circuit ngay sau khối `if (Object.hasOwn(...))`:
```js
if (EXPRESSION_ANSWER_MODES.includes(activity.mode) && isPlainObject(activity.authoring)) {
    validateAnswer(activity, addError);
}
if (activity.mode === 'circuit') {
    validateCircuitTestbench(activity, addError);
}
if (Object.hasOwn(activity.answer, 'outputs')) {
    ... (giữ nguyên) ...
}
```

Hàm mới (đặt sau `validateAnswer`, trước `validate`):
```js
function validateCircuitTestbench(activity, addError) {
    const testbench = activity.answer.testbench;
    const variablesMatch =
        Array.isArray(activity.variables) &&
        Array.isArray(testbench?.variables) &&
        testbench.variables.length === activity.variables.length &&
        testbench.variables.every((variable, index) => variable === activity.variables[index]);
    if (!variablesMatch || !isValidCircuitTestbench(testbench)) {
        addError('invalidTestbench', 'answer.testbench');
    }
}
```

`normalize()` — **không sửa**. `answer.testbench` không cần chuẩn hoá thêm vì dữ liệu luôn được trim tại tầng authoring UI (mục 3) trước khi tới đây; xem ĐẦU RA/rủi ro còn lại.

Cập nhật `lifecycle` export (dòng 257-270) để thêm `EXPRESSION_ANSWER_MODES` vào object đóng băng, cùng hàng với `AUTHORING_MODES`.

### 3. `core/boolean-grader.js`

Thêm require (đầu file, cạnh `kmapGrader`):
```js
const circuitGrader = require('./circuit-grader.js');
```

Dòng 26 đổi:
```js
!['boolean', 'truthTable', 'kmap', 'circuit'].includes(exercise.mode) ||
```

Hàm mới (đặt sau `gradeKmap`, trước `gradeActivity`):
```js
function gradeCircuit(exercise, response, metadata) {
    if (!isPlainObject(response?.netlist)) {
        throw new TypeError('Câu trả lời mạch không hợp lệ.');
    }
    const { score, checks } = circuitGrader.gradeCircuitResponse({
        netlist: response.netlist,
        testbench: exercise.answer.testbench,
        maxScore: exercise.grading.maxScore,
    });
    return createResult(exercise, metadata, score, checks);
}
```

`gradeActivity()` (dòng 174-181) thêm nhánh trước dòng `return gradeExpression(...)`:
```js
if (exercise.mode === 'circuit') return gradeCircuit(exercise, response, metadata);
```

Không cần validate lại shape `testbench` ở đây — `circuitGrader.gradeCircuitResponse` đã tự throw `TypeError('Testbench không hợp lệ.')` qua `isValidTestbench` nội bộ (mục Bối cảnh #3), nhất quán với cách `expectedTruthVector` tự throw cho các mode khác thay vì `validateExercise` kiểm tra hết.

### 4. `edition/electronics-logic.js`

Dòng 10, cập nhật cho nhất quán với schema-lifecycle.js (thuần metadata, không ảnh hưởng hành vi):
```js
authoringModes: ['boolean', 'truthTable', 'kmap', 'circuit'],
```

Thêm vào `validationMessages` (dòng 17-48), giá trị **giống hệt byte-for-byte** với `ERROR_MESSAGES.invalidTestbench` ở schema-lifecycle.js:
```js
invalidTestbench: _('Testbench mạch điện không hợp lệ.'),
```

Dòng 180-184, thêm option thứ 4:
```js
this.createSelectField('mode', _('Chế độ'), [
    { value: 'boolean', label: _('Boolean') },
    { value: 'truthTable', label: _('Bảng chân trị') },
    { value: 'kmap', label: _('Karnaugh') },
    { value: 'circuit', label: _('Mạch logic') },
]),
```

`renderEditor()` — tách khối `answer-source` (dòng 192-223 hiện tại) ra khỏi `form.append(...)` đầu tiên (bỏ `createSelectField('answer-source', ...)` khỏi mảng đối số đầu), rồi bọc toàn bộ logic đáp án trong nhánh mode:
```js
form.append(
    this.createSelectField('mode', _('Chế độ'), [ /* 4 option ở trên */ ]),
    this.createSelectField(
        'variable-count',
        _('Số biến'),
        [2, 3, 4].map(count => ({ value: String(count), label: String(count) })),
        String(this.data.variables.length),
    ),
    this.createTextAreaField('prompt', _('Đề bài'), this.data.prompt, true),
);

if (this.data.mode === 'circuit') {
    form.append(
        this.createTextAreaField(
            'circuit-outputs',
            _('Đầu ra mạch (mỗi dòng: Tên = Biểu thức)'),
            this.testbenchToOutputsField(this.data.answer.testbench),
            true,
        ),
    );
} else {
    form.append(
        this.createSelectField('answer-source', _('Nguồn đáp án'), [
            { value: 'expression', label: _('Biểu thức') },
            { value: 'minterms', label: _("Minterm và don't-care") },
        ]),
    );
    if (this.data.authoring.answerSource === 'minterms') {
        /* giữ nguyên khối minterms/dont-cares hiện có */
    } else {
        /* giữ nguyên khối expression hiện có */
    }
}

form.append(
    this.createNumberField('max-score', _('Điểm tối đa'), this.data.grading.maxScore),
    this.createTextAreaField('solution', _('Lời giải ngắn'), this.data.authoring.solution, false),
);
```

`collectEditorData()` (dòng 128-152) — đổi khối `if (draft.authoring.answerSource === 'expression') {...} else {...}` (dòng 142-150) thành 3 nhánh, các dòng trước đó (mode/variables/prompt/answerSource/solution/maxScore) **giữ nguyên**:
```js
if (draft.mode === 'circuit') {
    const { outputs, expected } = this.parseCircuitOutputs(value('circuit-outputs'));
    draft.answer.expression = '';
    draft.answer.minterms = [];
    draft.answer.dontCares = [];
    draft.answer.testbench = {
        variables: draft.variables,
        inputs: this.buildCircuitInputs(draft.variables),
        outputs,
        expected,
    };
} else if (draft.authoring.answerSource === 'expression') {
    draft.answer.expression = value('expression') ?? '';
    draft.answer.minterms = [];
    draft.answer.dontCares = [];
} else {
    draft.answer.expression = '';
    draft.answer.minterms = this.parseIndexList(value('minterms'));
    draft.answer.dontCares = this.parseIndexList(value('dont-cares'));
}
```
**Quan trọng:** KHÔNG xoá `draft.answer.testbench` khi `draft.mode !== 'circuit'` — giữ lại dữ liệu cũ để tác giả không mất testbench khi đổi qua lại mode (schema-lifecycle.js chỉ validate testbench khi `mode === 'circuit'`, dữ liệu thừa ở mode khác vô hại).

Ba hàm thuần mới (đặt cạnh `parseIndexList`, cùng phong cách arrow-function trên object):
```js
parseCircuitOutputs: value => {
    if (typeof value !== 'string') return { outputs: {}, expected: {} };
    const outputs = {};
    const expected = {};
    let sequence = 0;
    value.split('\n').forEach(line => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) return;
        const name = line.slice(0, separatorIndex).trim();
        const expression = line.slice(separatorIndex + 1).trim();
        if (name === '' || expression === '') return;
        sequence += 1;
        outputs[name] = `output-${sequence}`;
        expected[name] = expression;
    });
    return { outputs, expected };
},

buildCircuitInputs: variables =>
    Object.fromEntries(variables.map((variable, index) => [variable, `input-${index + 1}`])),

testbenchToOutputsField: testbench => {
    if (testbench === null || typeof testbench !== 'object') return '';
    const outputs = testbench.outputs || {};
    const expected = testbench.expected || {};
    return Object.keys(outputs)
        .map(name => `${name} = ${expected[name] ?? ''}`)
        .join('\n');
},
```
`parseCircuitOutputs`/`testbenchToOutputsField` là cặp round-trip đối xứng (parse ↔ hiển thị lại), bắt buộc cho AT-02. Node ID sinh ra (`input-<n>`/`output-<n>`) đặt tương ứng thứ tự khai báo biến/dòng — xem ràng buộc UX trong ĐẦU RA.

`bindAuthoringEvents()` — **không sửa**: field `answer-source` dùng `querySelector(...)?.addEventListener(...)` đã an toàn khi field không tồn tại (circuit mode); field mới `circuit-outputs` là input dạng text thuần, không cần listener riêng (nhất quán với `expression`/`minterms`, chỉ đọc lúc `save()`).

### 5. `export/electronics-logic.js`

Thêm 2 message vào `getMessages()` (cạnh `correctCells`/`gradingUnavailable`):
```js
correctCircuitCases: typeof _ === 'function' ? _('Đúng {passed}/{total} tổ hợp kiểm tra.') : 'Đúng {passed}/{total} tổ hợp kiểm tra.',
circuitStructureInvalid: typeof _ === 'function' ? _('Mạch chưa đúng cấu trúc, chưa thể chấm điểm.') : 'Mạch chưa đúng cấu trúc, chưa thể chấm điểm.',
```

`applyResult()` (dòng 907-953) — thêm nhánh `circuitCanvas` TRƯỚC nhánh `else` cuối cùng (giữ nguyên 2 nhánh `kmapCells`/`truthValues` đầu):
```js
applyResult: (activity, result, messages) => {
    const feedback = activity.querySelector('[data-role="grading-feedback"]');
    const kmapCells = [...activity.querySelectorAll('[data-role="kmap-cell"]')];
    const truthValues = [...activity.querySelectorAll('[data-role="truth-value"]')];
    const circuitCanvas = activity.querySelector('[data-role="circuit-canvas"]');
    if (kmapCells.length > 0) {
        /* giữ nguyên */
    } else if (truthValues.length > 0) {
        /* giữ nguyên */
    } else if (circuitCanvas) {
        const structural = result.checks.length > 0 && result.checks.every(check => check.id.startsWith('structure-'));
        if (structural) {
            feedback.textContent = messages.circuitStructureInvalid;
        } else {
            const passed = result.checks.filter(check => check.passed).length;
            feedback.textContent = `${messages.score}: ${result.score} / ${result.maxScore}. ${messages.correctCircuitCases
                .replace('{passed}', passed)
                .replace('{total}', result.checks.length)}`;
        }
    } else {
        /* giữ nguyên (nhánh expression) */
    }
    feedback.setAttribute('role', result.score === result.maxScore ? 'status' : 'alert');
},
```
Phân biệt "lỗi cấu trúc" bằng tiền tố `id` (`structure-*` — mục Bối cảnh #3) — không cần field mới, đủ để bám PLAT-06/AT-08 (thông báo tiếng Việt mô tả, không hiện điểm 0 gây hiểu lầm).

`checkActivity()`, `collectResponse()`, `updateEmptyState()` — **không sửa**, đã hoạt động đúng cho circuit mode (mục Bối cảnh #4, #5).

### 6. Build lại bundle

Chạy đúng lệnh sau (KHÔNG chạy `bun scripts/build-resource-bundles.js` — xem KHÔNG LÀM):
```bash
bun build public/files/perm/idevices/base/electronics-logic/core/boolean-grader-browser.mjs --outfile public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js --target browser --format iife --minify
```
Tham số khớp chính xác với `Bun.build()` trong `scripts/build-resource-bundles.js:80-87` (`target: 'browser'`, `format: 'iife'`, `minify: true`).

### 7. E2E: `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts`

Thêm 2 `test()` mới vào `describe('Electronics Logic authoring', ...)` hiện có, theo đúng khuôn mẫu 3 test đã có (dùng chung `addElectronicsLogicIdevice`, `getSavedIdevice`, các helper đã import sẵn). KHÔNG tạo `describe` mới, KHÔNG đổi 3 test hiện có.

Selector đã xác minh trực tiếp trong `export/electronics-logic.js` (không đoán):
- Palette: `[data-role="circuit-palette-item"][data-node-kind="<KIND>"]` — `<KIND>` ∈ `INPUT|OUTPUT|NOT|AND|OR|XOR` (dòng 198, đúng key `GATE_PINS`).
- Ô lưới: `[data-role="circuit-cell"][data-x="<x>"][data-y="<y>"]` — lưới 12×8, bước 40px, `x` ∈ [0,440], `y` ∈ [0,280] (dòng 206-219).
- Node đã đặt: `[data-role="circuit-node"]`, id runtime luôn `${kind.toLowerCase()}-${sequence}` theo THỨ TỰ đặt node CÙNG loại (không phải thứ tự tổng) — `nextCircuitNodeId` dòng 615-623.
- Chân: `[data-role="circuit-pin"][data-node-id="<id>"][data-pin-name="<pin>"]`. Tên chân theo `GATE_PINS` (`core/circuit-netlist.js:3-10`): INPUT→ra `out`; OUTPUT→vào `a`; NOT→vào `a`, ra `out`; AND/OR/XOR→vào `a`,`b`, ra `out`.
- Nối dây: click chân NGUỒN (chân ra) trước, rồi chân ĐÍCH (chân vào) sau — `handleCircuitPinClick` dòng 664+, đúng thứ tự unit test `connectCircuitPins` (`export/electronics-logic.test.js:77-81`) đã dùng.
- Dây đã tạo: `[data-role="circuit-wire"]`.
- Nút chấm: `[data-action="check"]` (đã dùng ở 2 test hiện có).
- Phản hồi: `[data-role="grading-feedback"]` (đã dùng ở 2 test hiện có).
- Thông báo lỗi cấu trúc — nguyên văn khoá ở Thiết kế khoá #5: `messages.circuitStructureInvalid` = `'Mạch chưa đúng cấu trúc, chưa thể chấm điểm.'`.
- Thông báo điểm — nguyên văn ghép ở Thiết kế khoá #5: `` `${messages.score}: ${result.score} / ${result.maxScore}. ${messages.correctCircuitCases...}` `` → với `messages.score = 'Điểm'`, `messages.correctCircuitCases = 'Đúng {passed}/{total} tổ hợp kiểm tra.'`.

Mạch dựng trong test: half-adder 2 biến A,B — testbench tác giả nhập `Sum = A XOR B` / `Carry = A AND B` (đúng ACCEPTANCE #2). Đặt node THEO ĐÚNG thứ tự sau để id khớp dự đoán (không cần đọc `data-node-id` động):

| Thứ tự đặt | Kind | x,y | ID kết quả | Vai trò |
|---|---|---|---|---|
| 1 | INPUT | 0,0 | `input-1` | A |
| 2 | INPUT | 0,80 | `input-2` | B |
| 3 | XOR | 160,0 | `xor-1` | Sum |
| 4 | AND | 160,80 | `and-1` | Carry |
| 5 | OUTPUT | 320,0 | `output-1` | Sum (khớp `testbench.outputs.Sum`) |
| 6 | OUTPUT | 320,80 | `output-2` | Carry (khớp `testbench.outputs.Carry`) |

Dây: `input-1.out→xor-1.a`, `input-2.out→xor-1.b`, `input-1.out→and-1.a`, `input-2.out→and-1.b`, `xor-1.out→output-1.a`, `and-1.out→output-2.a` (6 dây).

**Test 1** — hành trình đầy đủ (mẫu theo test `truthTable` hiện có: author→save→reload→preview→grade):
```ts
test('authors, saves, and grades a half-adder circuit through the palette, wiring, and preview', async ({
    authenticatedPage,
    createProject,
}) => {
    const page = authenticatedPage;
    const projectUuid = await createProject(page, 'Electronics Logic Circuit');
    const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

    await editor.locator('[data-field="mode"]').selectOption('circuit');
    await editor.locator('[data-field="variable-count"]').selectOption('2');
    await editor.locator('[data-field="prompt"]').fill('Dựng mạch bán tổng (half-adder) cho A, B.');
    await editor.locator('[data-field="circuit-outputs"]').fill('Sum = A XOR B\nCarry = A AND B');
    await editor.locator('[data-field="max-score"]').fill('8');
    await saveIdevice(page, ideviceId);
    await saveProject(page);

    const savedBeforeReload = await getSavedIdevice(page, ideviceId);
    expect(savedBeforeReload.error).toBeUndefined();
    expect(savedBeforeReload.jsonProperties).toMatchObject({
        mode: 'circuit',
        prompt: 'Dựng mạch bán tổng (half-adder) cho A, B.',
        variables: ['A', 'B'],
        answer: {
            expression: '',
            minterms: [],
            dontCares: [],
            testbench: {
                variables: ['A', 'B'],
                inputs: { A: 'input-1', B: 'input-2' },
                outputs: { Sum: 'output-1', Carry: 'output-2' },
                expected: { Sum: 'A XOR B', Carry: 'A AND B' },
            },
        },
        grading: { maxScore: 8 },
    });

    await reloadPage(page);
    await waitForAppReady(page);
    const savedAfterReload = await getSavedIdevice(page, ideviceId);
    expect(savedAfterReload.error).toBeUndefined();
    expect(savedAfterReload.jsonProperties).toEqual(savedBeforeReload.jsonProperties);

    await openPreviewPanel(page);
    await waitForPreviewContent(page);

    const preview = getPreviewFrame(page).locator('.electronics-logic-runtime').first();
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('data-mode', 'circuit');
    await expect(preview).toHaveAttribute('data-behaviour-bound', 'true');

    const placeNode = async (kind: string, x: number, y: number) => {
        await preview.locator(`[data-role="circuit-palette-item"][data-node-kind="${kind}"]`).click();
        await preview.locator(`[data-role="circuit-cell"][data-x="${x}"][data-y="${y}"]`).click();
    };
    const connect = async (fromId: string, fromPin: string, toId: string, toPin: string) => {
        await preview.locator(`[data-role="circuit-pin"][data-node-id="${fromId}"][data-pin-name="${fromPin}"]`).click();
        await preview.locator(`[data-role="circuit-pin"][data-node-id="${toId}"][data-pin-name="${toPin}"]`).click();
    };

    await placeNode('INPUT', 0, 0); // input-1 = A
    await placeNode('INPUT', 0, 80); // input-2 = B
    await placeNode('XOR', 160, 0); // xor-1 = Sum
    await placeNode('AND', 160, 80); // and-1 = Carry
    await placeNode('OUTPUT', 320, 0); // output-1 = Sum
    await placeNode('OUTPUT', 320, 80); // output-2 = Carry
    await expect(preview.locator('[data-role="circuit-node"]')).toHaveCount(6);

    await connect('input-1', 'out', 'xor-1', 'a');
    await connect('input-2', 'out', 'xor-1', 'b');
    await connect('input-1', 'out', 'and-1', 'a');
    await connect('input-2', 'out', 'and-1', 'b');
    await connect('xor-1', 'out', 'output-1', 'a');
    await connect('and-1', 'out', 'output-2', 'a');
    await expect(preview.locator('[data-role="circuit-wire"]')).toHaveCount(6);

    await preview.locator('[data-action="check"]').click();
    await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('8 / 8');
    await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('Đúng 8/8 tổ hợp kiểm tra.');
});
```

**Test 2** — lỗi cấu trúc không được hiện điểm gây hiểu lầm (ACCEPTANCE #5):
```ts
test('shows a structural error for an unconnected circuit instead of a misleading score', async ({
    authenticatedPage,
    createProject,
}) => {
    const page = authenticatedPage;
    const projectUuid = await createProject(page, 'Electronics Logic Circuit Structure Error');
    const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

    await editor.locator('[data-field="mode"]').selectOption('circuit');
    await editor.locator('[data-field="variable-count"]').selectOption('2');
    await editor.locator('[data-field="prompt"]').fill('Dựng mạch bán tổng (half-adder) cho A, B.');
    await editor.locator('[data-field="circuit-outputs"]').fill('Sum = A XOR B\nCarry = A AND B');
    await saveIdevice(page, ideviceId);
    await saveProject(page);
    await openPreviewPanel(page);
    await waitForPreviewContent(page);

    const preview = getPreviewFrame(page).locator('.electronics-logic-runtime').first();
    await expect(preview).toHaveAttribute('data-behaviour-bound', 'true');

    await preview.locator('[data-role="circuit-palette-item"][data-node-kind="OUTPUT"]').click();
    await preview.locator('[data-role="circuit-cell"][data-x="0"][data-y="0"]').click();
    await expect(preview.locator('[data-role="circuit-node"]')).toHaveCount(1);

    await preview.locator('[data-action="check"]').click();
    await expect(preview.locator('[data-role="grading-feedback"]')).toHaveText(
        'Mạch chưa đúng cấu trúc, chưa thể chấm điểm.',
    );
    await expect(preview.locator('[data-role="grading-feedback"]')).not.toContainText('Điểm');
});
```

Ràng buộc bắt buộc khi triển khai:
- Chỉ thêm 2 `test()` này vào `describe` hiện có, không tạo file/describe mới, không đổi 3 test hiện có.
- Không dùng `page.evaluate`/thao tác Yjs trực tiếp để "giả" trạng thái canvas mạch — đây chính là hành trình mà U01/U02 hoãn lại và U03 phải chứng minh thật. Toàn bộ tương tác canvas PHẢI qua click Playwright thật như 2 test trên.
- Không đoán thêm selector ngoài danh sách đã xác minh ở trên; nếu bundle/DOM thực tế lệch so với thiết kế này (ví dụ thứ tự chân, id node), dừng lại và báo PM — không tự ý đổi thiết kế khoá.

### 8. Sửa đường tải trình duyệt cho `core/schema-lifecycle.js` (PM amendment sau báo cáo gate E2E, 2026-08-16; **sửa lần 2** sau báo cáo "build thành công nhưng không chạy", cùng ngày)

**Cập nhật quan trọng (lần 2):** thiết kế lần đầu (đã bị thay thế hoàn toàn bởi nội dung bên dưới, không giữ lại dạng gạch ngang) giả định bundle trực tiếp từ `core/schema-lifecycle.js` — KHÔNG cần `.mjs` glue — vì file tự gán `globalThis` ở dòng 293. Giả định này SAI. Codex build đúng lệnh, exit 0, "Bundled 6 modules", nhưng smoke test fail 2/2 (`expected undefined to be defined`). PM xác minh độc lập bằng 3 cách, cả 3 đều xác nhận:
1. Đọc trực tiếp `electronics-logic-schema.bundle.js` do Codex build: cấu trúc là `var In=T((Mn,V)=>{ ...toàn bộ nội dung schema-lifecycle.js, kể cả dòng gán globalThis... });` — `T(...)` là helper lazy-init kiểu `__commonJS` (chỉ chạy khi được GỌI), và `In` (wrapper cho entry point) **không bao giờ được gọi** ở top-level IIFE vì không có consumer nào yêu cầu nó — bundler coi file entry viết theo CommonJS (`module.exports = ...`) là module cần lazy-wrap, kể cả khi nó là entry point.
2. Tự chạy lại `npx vitest run .../electronics-logic-schema.test.js` trên đúng bundle Codex build — tái hiện chính xác lỗi Codex báo (2/2 fail, cùng thông báo lỗi).
3. Đối chiếu với bundle export-js đang hoạt động đúng (`electronics-logic-grader.bundle.js`, build từ `boolean-grader-browser.mjs`): mã gán `globalThis` nằm NGAY Ở SCOPE NGOÀI CÙNG của IIFE (`...if(typeof globalThis<"u")globalThis.$electronicsLogicCore=...`), không bọc trong closure `T(...)` nào — vì entry point đó viết thuần ESM (chỉ có `import`, không có `module.exports` của chính nó), nên mã top-level của nó được bundler inline và chạy ngay lập tức, đúng ngữ nghĩa ESM (khác hẳn CommonJS).

Kết luận: bundler chỉ chạy ngay mã top-level của entry point khi entry viết thuần ESM. Nếu entry là CommonJS, bundler lazy-wrap nó và không có gì gọi wrapper đó trong build IIFE đơn-entry không có `--global-name` phù hợp. **Bắt buộc phải có file `.mjs` glue riêng**, đúng đề xuất của Codex, mirror chính xác mẫu `core/boolean-grader-browser.mjs` đã chứng minh hoạt động (Thiết kế khoá gốc #6 sử dụng đúng cơ chế này cho export-js).

**File mới — glue module (bắt buộc, không phải tuỳ chọn):**
`public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle-browser.mjs`
```js
import lifecycle from './schema-lifecycle.js';

if (typeof globalThis !== 'undefined') {
    globalThis.$electronicsLogicSchemaLifecycle = lifecycle;
}
```
Mirror byte-for-byte phong cách `core/boolean-grader-browser.mjs` (import ESM thuần + gán `globalThis` có điều kiện, không thêm logic gì khác). Đây là entry point THẬT của bundle — `core/schema-lifecycle.js` không đổi thêm gì so với Thiết kế khoá #2 đã khoá (dòng tự đăng ký `globalThis` ở dòng 293 của chính nó trở thành vô hại/dư thừa bên trong bundle vì file glue cũng gán lại đúng giá trị đó — không cần xoá, không đổi).

**File mới — build output, KHÔNG sửa tay:**
`public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.bundle.js`

Lệnh build (entry point là file glue MỚI ở trên — **KHÔNG PHẢI** `core/schema-lifecycle.js` trực tiếp):
```bash
bun build public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle-browser.mjs --outfile public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.bundle.js --target browser --format iife --minify
```
Tham số khớp chính xác kiểu build hiện có ở Thiết kế khoá #6 (`target: 'browser'`, `format: 'iife'`, `minify: true`) — cùng cơ chế đã chứng minh hoạt động đúng cho `electronics-logic-grader.bundle.js`. Tên file output KHÔNG đổi so với thiết kế lần đầu — chỉ đổi INPUT của lệnh build.

**`config.xml`** — đổi khối `edition-js` (dòng 15-18 hiện tại):
```xml
<edition-js>
    <filename>electronics-logic-schema.bundle.js</filename>
    <filename>electronics-logic.js</filename>
</edition-js>
```
Bỏ `../core/schema-lifecycle.js` (file thô, không còn nạp trực tiếp), thay bằng bundle mới cùng thư mục `edition/` (không cần tiền tố `../`, khớp phong cách dòng `electronics-logic.js` sẵn có). KHÔNG đổi khối `export-js` (dòng 22-25) — export-js chưa từng nạp `schema-lifecycle.js`, không liên quan lỗi này.

**File mới — smoke test:**
`public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.test.js`

Theo đúng khuôn mẫu `export/electronics-logic-grader.test.js` (dynamic `import()` qua `pathToFileURL` + query cache-bust, xoá global trước mỗi test) — mục đích: bắt CHÍNH LOẠI lỗi này (script tự nạp và tự gán global khi chạy KHÔNG có `require`/`module`) ở tầng Vitest nhanh, không chỉ chờ Playwright chậm:
```js
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

describe('Electronics Logic schema lifecycle bundle', () => {
    it('exposes the canonical schema lifecycle globally and validates without Node globals', async () => {
        global.$electronicsLogicSchemaLifecycle = undefined;
        const bundlePath = join(
            process.cwd(),
            'public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.bundle.js',
        );
        await import(`${pathToFileURL(bundlePath).href}?browser-smoke=1`);

        expect(global.$electronicsLogicSchemaLifecycle).toBeDefined();
        const result = global.$electronicsLogicSchemaLifecycle.validate({
            id: 'offline-circuit',
            type: 'electronics.logic',
            schemaVersion: 1,
            mode: 'circuit',
            prompt: 'Dựng mạch bán tổng.',
            variables: ['A', 'B'],
            authoring: { answerSource: 'expression', placeholderText: 'x', solution: '' },
            answer: {
                expression: '',
                minterms: [],
                dontCares: [],
                testbench: {
                    variables: ['A', 'B'],
                    inputs: { A: 'input-1', B: 'input-2' },
                    outputs: { Sum: 'output-1', Carry: 'output-2' },
                    expected: { Sum: 'A XOR B', Carry: 'A AND B' },
                },
            },
            grading: { maxScore: 8 },
            learner: {},
            accessibility: { label: '' },
        });

        expect(result).toEqual({ valid: true, errors: [] });
    });

    it('rejects an invalid circuit testbench through the rebuilt offline bundle', async () => {
        global.$electronicsLogicSchemaLifecycle = undefined;
        const bundlePath = join(
            process.cwd(),
            'public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.bundle.js',
        );
        await import(`${pathToFileURL(bundlePath).href}?browser-smoke=2`);

        const result = global.$electronicsLogicSchemaLifecycle.validate({
            id: 'offline-circuit-invalid',
            type: 'electronics.logic',
            schemaVersion: 1,
            mode: 'circuit',
            prompt: 'Dựng mạch bán tổng.',
            variables: ['A', 'B'],
            authoring: { answerSource: 'expression', placeholderText: 'x', solution: '' },
            answer: { expression: '', minterms: [], dontCares: [], testbench: {} },
            grading: { maxScore: 8 },
            learner: {},
            accessibility: { label: '' },
        });

        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.code === 'invalidTestbench')).toBe(true);
    });
});
```
File này MỚI, không có baseline hash "trước". Không bắt buộc TDD (nhóm UI/lifecycle/integration theo SKILLS), nhưng PHẢI PASS trước khi coi gate E2E là đủ điều kiện chạy lại.

### 9. Sửa `validateData()` bỏ chấm sai `data.netlist` không tồn tại cho circuit mode (PM amendment, 2026-08-16, sau báo cáo Codex "Playwright 3/5, circuit fail trước khi render canvas")

**`export/electronics-logic.js`** — nhánh `circuit` trong `validateData()` (dòng 269-280 hiện tại):

Trước (sai — `data.netlist` không tồn tại trong dữ liệu đã lưu):
```js
if (data.mode === 'circuit') {
    const circuitNetlist = this.getCircuitNetlist();
    if (!circuitNetlist || typeof circuitNetlist.parseNetlist !== 'function') {
        errors.push('coreUnavailable');
    } else {
        try {
            circuitNetlist.parseNetlist(data.netlist);
        } catch (_error) {
            errors.push('invalidNetlist');
        }
    }
}
```

Sau (đúng — mirror chính xác nhánh `kmap` liền kề, dòng 263-267, chỉ kiểm tra core module đã nạp):
```js
if (data.mode === 'circuit') {
    const circuitNetlist = this.getCircuitNetlist();
    if (!circuitNetlist || typeof circuitNetlist.parseNetlist !== 'function') {
        errors.push('coreUnavailable');
    }
}
```
Mã lỗi `invalidNetlist` không còn được `validateData()` sinh ra cho circuit mode — không còn field `data` nào để gọi `parseNetlist` lên. `circuitNetlist.parseNetlist` vẫn dùng nguyên trạng ở nơi khác trong runtime (`collectResponse`/`checkActivity`, Bối cảnh #4-5) để đọc netlist THẬT do learner dựng — không đổi gì ở đó.

**`export/electronics-logic.test.js`**:

1. `createCircuitData()` (dòng 40-49) — xoá dòng `netlist: { schemaVersion: 1, nodes: [], wires: [] },` khỏi object mặc định. Field này không tồn tại trong dữ liệu authoring/saved thật; giữ lại tiếp tục che khuất lỗi tương tự trong tương lai.
2. Test `'validates circuit data through parseNetlist without applying Boolean authoring rules'` (dòng 1206-1239) — XOÁ TOÀN BỘ khối `invalidNetlists.forEach(...)` (khẳng định hành vi sai `invalidNetlist`). Đổi tên và nội dung test thành khẳng định hành vi ĐÚNG, ví dụ:
```js
it('validates circuit data without requiring a top-level netlist field', () => {
    expect(renderer.validateData(createCircuitData())).toEqual({ valid: true, errors: [] });

    global.$electronicsLogicCircuitNetlist = undefined;
    expect(renderer.validateData(createCircuitData())).toEqual({ valid: false, errors: ['coreUnavailable'] });
});
```
Giữ nguyên phần `coreUnavailable` (dòng 1237-1238 cũ) — hành vi ĐÚNG, không đổi. Chỉ xoá phần khẳng định `invalidNetlist` sai.
3. Không sửa gì khác trong file — mọi usage `netlist` còn lại (ví dụ dòng 719-725, 746, 875, 956, 980, 1034-1036, 1103, 1118-1120, 1262-1263) đều là kết quả `collectResponse(activity).netlist`, thuộc response runtime, không phải `data` — đã đúng, đã xác minh qua grep toàn file (xem "Bổ sung" ở trên).

Sau khi sửa, `renderCircuit(messages)` (dòng 192-231, không đổi) render canvas rỗng thành công cho MỌI dữ liệu circuit hợp lệ, không phụ thuộc bất kỳ trạng thái netlist/testbench nào — đúng thiết kế đã xác minh.

### 10. Gỡ artifact `public/bundles/idevices.zip` cũ trước khi chạy Playwright (PM amendment, 2026-08-16, sau báo cáo Codex "blocker #4: bundle cũ")

**Hành động duy nhất — thao tác trên artifact build cục bộ, KHÔNG phải thay đổi mã nguồn:**

Trước khi xoá, bắt buộc chạy và ghi kết quả vào báo cáo (an toàn — xác nhận file không bị git theo dõi):
```bash
git check-ignore -v public/bundles/idevices.zip
git status --porcelain public/bundles/
```
Phải xác nhận: lệnh đầu khớp rule trong `.gitignore` (dòng 8), lệnh sau trả rỗng (không có gì để track/stage). Nếu một trong hai xác nhận thất bại — DỪNG LẠI, báo PM, không xoá.

Sau khi xác nhận, xoá đúng một file:
```bash
rm public/bundles/idevices.zip
```

**KHÔNG được xoá/đụng vào** (không liên quan U03, phải giữ nguyên để không đổi hành vi test ngoài phạm vi):
- `public/bundles/manifest.json`
- `public/bundles/themes/**`
- `public/bundles/libs.zip`
- `public/bundles/common.zip`
- `public/bundles/content-css.zip`

**Vì sao đủ, không cần rebuild gì:** `manifest.json` vẫn còn → `ResourceFetcher.bundlesAvailable = true` (`public/app/yjs/ResourceFetcher.js:297`) → client vẫn thử `loadIdevicesBundle()` (dòng 715-716) → server trả 404 cho `GET /api/resources/bundle/idevices` (`src/routes/resources.ts:434-448`, vì `idevices.zip` không còn) → `fetchBundle()` bắt 404, trả `null` an toàn (`ResourceFetcher.js:380-382`) → `loadIdevicesBundle()` đánh dấu `idevices:all` đã thử với map rỗng, return (dòng 752-755) → hàm gọi (`fetchIdevice`) rơi xuống bước fallback CÓ SẴN: `fetchIdeviceFallback(ideviceType)` (dòng 724-726, 788+) → `GET /api/resources/idevice/electronics-logic` → `resources.ts:174-221` đọc TRỰC TIẾP, ĐỆ QUY, không cache từ `IDEVICES_BASE_PATH/electronics-logic/export/` trên đĩa — đúng mã nguồn HIỆN TẠI, gồm `electronics-logic.js` (đã sửa Thiết kế khoá #9) và `electronics-logic-grader.bundle.js` (đã build lại Thiết kế khoá #6). Toàn bộ cơ chế lùi này là mã sản phẩm CÓ SẴN từ trước U03, không phải mã mới viết cho packet này — không vi phạm "No workarounds"/"Single source of truth" (AGENTS.md §1) vì không có logic nào bị nhân bản hay thêm mới.

**Sau khi Playwright PASS 5/5:** không cần khôi phục lại `idevices.zip` trong phạm vi U03 — file này sẽ được sinh lại đúng, đầy đủ ở lần chạy `make bundle`/`bun run build:all` thật tiếp theo (thuộc quy trình build/release riêng, ngoài phạm vi packet này). Ghi rõ trong báo cáo hoàn thành rằng `public/bundles/idevices.zip` đang ở trạng thái "đã xoá cục bộ" sau task này — xem ĐẦU RA/rủi ro #10.

## KHÔNG LÀM

- Không thêm pan/zoom/auto-layout cho canvas mạch (đã khoá từ U01).
- Không vẽ mạch tham chiếu/gợi ý cho learner trên canvas.
- Không hỗ trợ mạch 1 biến — giữ nguyên ràng buộc 2–4 biến áp dụng chung cho cả 4 mode qua `AUTHORING_MODES`.
- Không đổi `core/circuit-engine.js`, `core/circuit-netlist.js`, `core/boolean-core.js`, `core/kmap-grader.js`, `core/kmap-group-validator.js`, `core/boolean-core-contract.js`, `core/boolean-grader-browser.mjs`, `edition/electronics-logic.css`, `export/electronics-logic.css`, `export/electronics-logic.html` — hash phải giữ nguyên (đối chiếu bảng ở Bối cảnh #12).
- Không sửa logic/hành vi của `gradeCircuitResponse` hay `isValidTestbench` trong `circuit-grader.js` — chỉ thêm export.
- Không chạy `bun scripts/build-resource-bundles.js` bản đầy đủ — script này xoá và build lại TOÀN BỘ `public/bundles/` (theme/idevice/lib/common/content-css), vượt phạm vi task.
- Không thêm điều kiện "netlist rỗng" vào `incomplete` check trong `checkActivity` — mạch rỗng tự nhiên rơi vào lỗi cấu trúc qua `validateTopology`, không crash, chấp nhận được cho phạm vi task này.
- Không xoá/reset `draft.answer.testbench` khi tác giả đổi mode khỏi circuit.
- Không cho phép tác giả gõ tay node ID trong testbench — input/output map phải tự sinh theo thứ tự khai báo biến/dòng đầu ra (mục Thiết kế khoá #4).
- Không bắt đầu I01/I02.
- Không sửa bất kỳ file nào trong `translations/**`.
- Không sửa `.ai/packets/**` nào khác ngoài file packet này.
- Không giả lập canvas mạch qua `page.evaluate`/ghi Yjs trực tiếp trong test E2E mới — phải thao tác qua click UI thật (xem Thiết kế khoá #7).
- Không tạo `describe` E2E mới hay sửa 3 test hiện có trong `electronics-logic.spec.ts` — chỉ thêm đúng 2 `test()` đã khoá thiết kế.
- Không mở lại `core/boolean-grader-browser.mjs` hay `export/electronics-logic-grader.bundle.js` để nhét thêm `schema-lifecycle` vào chung bundle chấm điểm — hai file này VẪN PHẢI GIỮ NGUYÊN (xem quyết định từ chối Option A ở phần "Bổ sung: sửa lỗi tải trình duyệt").
- Không sao chép logic `isValidTestbench`/`ERROR_MESSAGES` sang nơi khác để né việc bundle — vi phạm single source of truth (AGENTS.md §1).
- Không thêm shim/polyfill `window.require` hay tương tự để làm `require()` thô "chạy được" trong trình duyệt — thuộc loại workaround bị cấm ở AGENTS.md §1; hướng xử lý bắt buộc là bundle thật, theo Thiết kế khoá #8.
- Không thêm lại validation hình dạng `data.netlist` cấp cao nhất trong `validateData()` (kể cả gọi `circuitNetlist.parseNetlist(data.netlist)`) — field này không tồn tại trong dữ liệu authoring/saved của circuit mode; netlist chỉ tồn tại tại runtime qua `collectResponse()` (xem Thiết kế khoá #9).
- Không chạy `bun scripts/build-resource-bundles.js` (bản đầy đủ hay bất kỳ biến thể "rút gọn"/"targeted" tự viết nào) để xử lý blocker #4 — xử lý CHỈ bằng cách xoá `public/bundles/idevices.zip` cũ, dựa vào đường lùi có sẵn trong `ResourceFetcher.js`/`resources.ts` (xem Thiết kế khoá #10); không viết thêm logic build mới, không đụng `scripts/build-resource-bundles.js` dưới bất kỳ hình thức nào.
- Không xoá bất kỳ file/thư mục nào khác trong `public/bundles/` ngoài đúng `idevices.zip` — giữ nguyên `manifest.json`, `themes/`, `libs.zip`, `common.zip`, `content-css.zip` (xem Thiết kế khoá #10).

## ACCEPTANCE

1. Tạo activity mới trong editor, đổi `mode` → `circuit`: form ẩn "Nguồn đáp án"/"Biểu thức"/"Minterm"/"Don't-care", hiện đúng 1 field mới "Đầu ra mạch (mỗi dòng: Tên = Biểu thức)".
2. Nhập `Sum = A XOR B` và `Carry = A AND B` với 2 biến A,B → lưu → `schema-lifecycle.validate()` trả `valid: true`; `answer.testbench` = `{variables:["A","B"], inputs:{A:"input-1",B:"input-2"}, outputs:{Sum:"output-1",Carry:"output-2"}, expected:{Sum:"A XOR B",Carry:"A AND B"}}`.
3. Testbench sai dạng (vd. để trống field, hoặc JSON tay thiếu `expected`) → `validate()` trả lỗi `invalidTestbench`; editor hiện đúng thông báo tiếng Việt tương ứng qua `validationMessages.invalidTestbench`.
4. `boolean-grader.gradeActivity()` với `exercise.mode === 'circuit'`, netlist half-adder hợp lệ khớp đúng testbench trên → chấm đúng 4/4 case (2 output × 2² tổ hợp), `score === maxScore`.
5. Netlist có lỗi cấu trúc (vòng lặp/pin treo/nhiều nguồn/mapping input-output sai) → không throw ra ngoài `checkActivity`; `applyResult` hiện `messages.circuitStructureInvalid`, không hiện điểm số gây hiểu lầm.
6. Circuit hợp lệ và chấm được (đúng một phần) → `applyResult` hiện `"Điểm: X / Y. Đúng A/B tổ hợp kiểm tra."`.
7. `export/electronics-logic-grader.bundle.js` build lại thành công; smoke test mới trong `electronics-logic-grader.test.js` chấm đúng 1 case circuit qua bundle (dynamic import, không qua require core trực tiếp — theo đúng mẫu 2 khối hiện có).
8. 10 file "PHẢI GIỮ NGUYÊN" ở Bối cảnh #12 có hash SHA-256 không đổi.
9. Playwright spec mới (Thiết kế khoá #7, test 1) dựng half-adder qua click UI thật (palette → ô lưới → chân → dây), lưu, tải lại trang, mở preview, chấm điểm — `grading-feedback` hiện `"8 / 8"` và `"Đúng 8/8 tổ hợp kiểm tra."`; dữ liệu Yjs trước/sau reload khớp `toEqual`.
10. Playwright spec mới (Thiết kế khoá #7, test 2) dựng mạch lỗi cấu trúc (1 node OUTPUT không nối) → `grading-feedback` hiện đúng nguyên văn `"Mạch chưa đúng cấu trúc, chưa thể chấm điểm."`, KHÔNG chứa chữ "Điểm".
11. `core/schema-lifecycle-browser.mjs` (glue module mới) tồn tại đúng nội dung khoá; `edition/electronics-logic-schema.bundle.js` build thành công TỪ FILE GLUE ĐÓ (không phải từ `core/schema-lifecycle.js` trực tiếp) qua đúng lệnh khoá ở Thiết kế khoá #8; `config.xml` nạp bundle này trong `edition-js` thay vì file thô.
12. Smoke test mới (`edition/electronics-logic-schema.test.js`) xác nhận `globalThis.$electronicsLogicSchemaLifecycle` được thiết lập và `validate()` hoạt động đúng khi chạy bundle mà không có `require`/`module` trong scope — cho cả testbench hợp lệ và không hợp lệ.
13. Toàn bộ 5 test trong `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` PASS (3 test cũ + 2 test mới ở Thiết kế khoá #7), 0 fail, 0 skip — xác nhận editor render đúng ở mọi mode, không riêng circuit.
14. `validateData()` với dữ liệu circuit hợp lệ (không có field `netlist` cấp cao nhất) → `{ valid: true, errors: [] }`; khi core module `circuitNetlist` chưa nạp → `{ valid: false, errors: ['coreUnavailable'] }`; mã lỗi `invalidNetlist` không còn được sinh ra bởi `validateData()` (xem Thiết kế khoá #9).
15. `public/bundles/idevices.zip` bị xoá đúng quy trình xác minh (Thiết kế khoá #10), KHÔNG có lệnh build/rebuild bundle nào chạy để thay thế; 4 loại bundle còn lại (`manifest.json`, `themes/`, `libs.zip`, `common.zip`, `content-css.zip`) không đổi. Toàn bộ 5 test Playwright (ACCEPTANCE #13) PASS trong điều kiện này — xác nhận đường lùi fallback có sẵn trong `ResourceFetcher.js`/`resources.ts` phục vụ đúng mã nguồn hiện tại mà không cần bất kỳ bundle nào được sinh lại.

## TEST BẮT BUỘC

```bash
# Từng file thay đổi
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-grader.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/core/boolean-grader.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.test.js
npx vitest run public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.test.js

# Hồi quy toàn thư mục iDevice
npx vitest run public/files/perm/idevices/base/electronics-logic

# Coverage phạm vi (patch coverage ≥ 90% trên các dòng sửa — NFR-05, AGENTS.md §5.3)
npx vitest run public/files/perm/idevices/base/electronics-logic --coverage --coverage.include="public/files/perm/idevices/base/electronics-logic/**" --coverage.exclude="**/*.test.js" --coverage.exclude="**/*.bundle.js"

# Lint/format
make fix

# Build lại bundle chấm điểm export-js (lệnh chính xác — xem Thiết kế khoá #6)
bun build public/files/perm/idevices/base/electronics-logic/core/boolean-grader-browser.mjs --outfile public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js --target browser --format iife --minify

# Build lại bundle schema-lifecycle cho edition-js (lệnh chính xác — xem Thiết kế khoá #8 sửa lần 2, 2026-08-16; entry point là file glue core/schema-lifecycle-browser.mjs, KHÔNG PHẢI schema-lifecycle.js trực tiếp)
bun build public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle-browser.mjs --outfile public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.bundle.js --target browser --format iife --minify

# Gỡ artifact bundle iDevice cũ trước khi chạy lại Playwright (xem Thiết kế khoá #10) — CHỈ xoá đúng 1 file này,
# không đụng phần còn lại của public/bundles/. Bắt buộc chạy 2 lệnh xác minh trước và ghi kết quả vào báo cáo.
git check-ignore -v public/bundles/idevices.zip
git status --porcelain public/bundles/
rm public/bundles/idevices.zip

# E2E: 3 test cũ + 2 test mới circuit mode — PHẢI PASS cả 5 (xem Thiết kế khoá #7, #8 và #10; cả hai bundle chấm điểm/schema-lifecycle và config.xml phải cập nhật, và idevices.zip cũ phải đã bị xoá, trước khi chạy lệnh này)
bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts

# Đối chiếu hash — 10 file PHẢI GIỮ NGUYÊN (so với bảng ở Bối cảnh #12)
sha256sum \
  public/files/perm/idevices/base/electronics-logic/core/circuit-engine.js \
  public/files/perm/idevices/base/electronics-logic/core/circuit-netlist.js \
  public/files/perm/idevices/base/electronics-logic/core/boolean-core.js \
  public/files/perm/idevices/base/electronics-logic/core/kmap-grader.js \
  public/files/perm/idevices/base/electronics-logic/core/kmap-group-validator.js \
  public/files/perm/idevices/base/electronics-logic/core/boolean-core-contract.js \
  public/files/perm/idevices/base/electronics-logic/core/boolean-grader-browser.mjs \
  public/files/perm/idevices/base/electronics-logic/edition/electronics-logic.css \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.css \
  public/files/perm/idevices/base/electronics-logic/export/electronics-logic.html
```

Kết quả mong đợi: tất cả lệnh vitest PASS (0 fail, 0 skip); `make fix` sạch; lệnh build bundle thoát mã 0 và file output tồn tại; `sha256sum` khớp chính xác 10 hash liệt kê ở Bối cảnh #12; `git check-ignore`/`git status --porcelain` xác nhận `idevices.zip` an toàn để xoá (Thiết kế khoá #10) trước khi chạy Playwright; cả 5 test Playwright PASS.

## ĐẦU RA

- Diff đầy đủ của 15 file mã nguồn/test/manifest (11 file core/edition/export gốc [gồm cả smoke test bundle chấm điểm] + 1 file E2E spec + `config.xml` + 1 file glue module `core/schema-lifecycle-browser.mjs` mới + 1 file smoke test bundle schema-lifecycle mới; không tính 2 file bundle sinh ra bằng lệnh build).
- Output đầy đủ của mọi lệnh trong TEST BẮT BUỘC, gồm bảng coverage phạm vi, kết quả smoke test bundle schema-lifecycle mới, VÀ kết quả cả 5 test Playwright (3 cũ + 2 mới, pass/fail rõ ràng, không được skip).
- Bảng hash trước/sau cho toàn bộ 17 file đã có baseline (10 giữ nguyên + 7 được đổi: `circuit-grader.js`, `schema-lifecycle.js`, `boolean-grader.js`, `edition/electronics-logic.js`, `export/electronics-logic.js`, `export/electronics-logic-grader.bundle.js`, `config.xml`). File E2E spec (#13), glue module mới (#17), bundle schema-lifecycle mới (#15) và smoke test cho bundle đó (#16) KHÔNG có hash "trước" (file mới hoàn toàn, hoặc bổ sung nội dung ngoài phạm vi baseline #12) — chỉ cần xác nhận tồn tại, biên dịch/lint sạch, và test liên quan PASS.
- Rủi ro/quyết định cần nêu rõ cho PM xác nhận:
  1. **Quyết định mở rộng phạm vi**: U03 trong PLAN.md chỉ ghi DoD một dòng ("Chuyển mode, author/learner state tách biệt..."), nhưng gate G-U0 đòi "nối/chấm được" — packet này diễn giải đó là yêu cầu nối dây chấm điểm circuit-mode đầy đủ (schema + grader + UI author tối thiểu + hiển thị kết quả). Đây là suy luận PM — **user đã xác nhận PASS qua AskUserQuestion ngày 2026-08-16** ("Approve full grading wire-up (recommended)"); không cần hỏi lại, chỉ ghi nhận trong báo cáo hoàn thành.
  2. **Giới hạn UX đã biết, chấp nhận được**: input/output trong testbench map theo THỨ TỰ đặt node trên canvas (`input-1`, `input-2`...), không theo nhãn ngữ nghĩa (A/B/Sum/Carry). Tác giả phải tự nhớ đặt đúng thứ tự khớp với khai báo biến/dòng đầu ra đã nhập. Không chặn gate G-U0 (gate chỉ yêu cầu "nối/chấm được", không yêu cầu UX đặt tên nút).
  3. Hash `export/electronics-logic-grader.bundle.js` đổi lần đầu tiên trong toàn bộ engagement (trước đó luôn đứng yên qua U01/U02) — đây là thay đổi ĐÚNG dự kiến của task này, không phải hồi quy hay lỗi.
  4. `normalize()` không chuẩn hoá `answer.testbench` — dựa vào việc dữ liệu đã được trim ở tầng authoring UI (`parseCircuitOutputs`). Nếu tương lai có đường ghi `answer.testbench` khác (import, API), cần bổ sung chuẩn hoá tại `normalize()`.
  5. `checkActivity`'s điều kiện `incomplete` không có nhánh riêng cho circuit rỗng — mạch 0 node vẫn có thể bấm "Chấm điểm", sẽ rơi vào lỗi cấu trúc (`structure-*`) thay vì thông báo "chưa hoàn thành" như các mode khác. Không crash, nhưng trải nghiệm khác các mode khác một chút — chấp nhận được cho phạm vi U03, có thể cải thiện sau nếu cần.
  6. **Bổ sung E2E được PM/user duyệt riêng**: user cũng đã chọn **"Add E2E spec to U03 now (recommended)"** ngày 2026-08-16, thay vì hoãn sang I01/I02 như U01/U02 đã làm — lý do: U03 là task đầu tiên cho circuit mode một lối vào UI author thật, nên đây là thời điểm tự nhiên để viết E2E hành trình thật thay vì giả lập. Xem "Bổ sung phạm vi E2E" ngay sau MỤC TIÊU và Thiết kế khoá #7.
  7. **Sửa lỗi tải trình duyệt phát hiện tại gate E2E (PM quyết định kỹ thuật, không cần hỏi lại user)**: Thiết kế khoá #2 gốc (thêm `require('./circuit-grader.js')` vào `core/schema-lifecycle.js`) đúng về logic nhưng sai về đường tải — `schema-lifecycle.js` được `config.xml` nạp thô (không qua bundler) trong `edition-js`, khiến `require` không tồn tại ở trình duyệt và cả 5 test Playwright (3 cũ + 2 mới) fail trước khi editor render. Codex phát hiện đúng, dừng lại đúng quy trình (không tự vá, không tự nới phạm vi), và đề xuất Option A (gộp vào bundle `boolean-grader-browser.mjs`/`electronics-logic-grader.bundle.js` hiện có). PM tự xác minh lại toàn bộ chain phụ thuộc và TỪ CHỐI Option A vì sẽ mở lại 2 file đã đóng gate G-E0/E03/E04; PHÊ DUYỆT phương án thay thế: bundle `schema-lifecycle.js` làm entry point riêng, độc lập với bundle chấm điểm (Thiết kế khoá #8). Đây là quyết định kỹ thuật trong phạm vi uỷ quyền PM — không đổi ACCEPTANCE #1-6 đã được user duyệt, không đổi hành vi/UX nào — nên không cần AskUserQuestion, chỉ ghi nhận trong báo cáo hoàn thành.
  8. **Sửa lỗi bundler thứ hai, phát hiện sau khi build lần đầu "thành công" (PM quyết định kỹ thuật, không cần hỏi lại user)**: thiết kế Thiết kế khoá #8 bản đầu (bundle trực tiếp từ `core/schema-lifecycle.js`, không cần `.mjs` glue vì file tự đăng ký `globalThis`) build không lỗi (exit 0, "Bundled 6 modules") nhưng KHÔNG hoạt động đúng — Bun bọc file entry viết theo CommonJS trong một closure lazy không bao giờ được gọi khi thiếu consumer, nên dòng tự đăng ký `globalThis` bên trong không bao giờ chạy dù build "thành công". Codex phát hiện đúng qua smoke test mới (2/2 fail), thử cả bản không-minify và `--global-name` đều không giải quyết được, và tự đề xuất đúng hướng khắc phục: thêm file glue ESM `core/schema-lifecycle-browser.mjs` (mirror `boolean-grader-browser.mjs`) làm entry point thật của bundle — không tự áp dụng khi chưa được duyệt. PM xác minh độc lập bằng 3 cách trước khi duyệt: (a) đọc trực tiếp bundle lỗi Codex build, xác nhận closure entry không bao giờ được gọi; (b) tự chạy lại smoke test trên đúng bundle đó, tái hiện chính xác lỗi Codex báo; (c) đối chiếu cấu trúc bundle export-js đang hoạt động đúng, xác nhận mã top-level của entry ESM được inline chạy ngay chứ không bọc closure — từ đó xác nhận cơ chế gốc rễ và PHÊ DUYỆT nguyên trạng đề xuất của Codex, khoá thành Thiết kế khoá #8 (sửa lần 2). Không đổi ACCEPTANCE về bản chất (chỉ làm rõ #11), không đổi hành vi/UX, không mở lại file nào đang khoá — chỉ thêm 1 file glue mới rất mỏng (3 dòng logic, mirror mẫu đã có) — nên không cần hỏi lại user.
  9. **Sửa lỗi `validateData()` chấm sai `data.netlist` không tồn tại, phát hiện sau khi 2 bổ sung bundler ở trên đã đóng (PM quyết định kỹ thuật, không cần hỏi lại user)**: Codex báo Playwright 3/5 (2 test circuit mới fail trước khi canvas render). PM xác minh độc lập qua đọc trực tiếp `renderView`/`validateData`/`renderCircuit` (`export/electronics-logic.js` dòng 1-60, 240-293, 192-231) và `export/electronics-logic.test.js` (dòng 40-49, 1206-1239), xác nhận `validateData()` gọi `parseNetlist(data.netlist)` trên một field không tồn tại trong dữ liệu circuit mode đã lưu (chỉ có `answer.testbench`, đã khoá ở Thiết kế khoá #4) — lỗi thiết kế có từ trước U03, bị unit test hiện có che khuất bằng dữ liệu giả trong `createCircuitData()` và một test riêng khẳng định đúng hành vi sai đó. Codex dừng đúng quy trình, không tự sửa validation hay data model ngoài thiết kế khoá. PM PHÊ DUYỆT sửa tối thiểu mirror đúng nhánh `kmap` liền kề (chỉ kiểm tra core module đã nạp, bỏ validate hình dạng netlist) và sửa test fixture/test case tương ứng — Thiết kế khoá #9. Không đổi ACCEPTANCE #1-6 đã được user duyệt (chỉ thêm ACCEPTANCE #14 khoá hành vi mới), không đổi hành vi/UX cho learner (canvas render y hệt, chỉ hết bị chặn oan bởi validation sai), không mở file nào đang khoá hash — nên không cần AskUserQuestion.
  10. **Xử lý blocker #4 — artifact `idevices.zip` lỗi thời làm Playwright đọc nhầm mã cũ (PM quyết định kỹ thuật, không cần hỏi lại user)**: sau khi Thiết kế khoá #9 xác nhận đúng (diff khớp chính xác, mọi unit test/coverage/bundle build PASS), Codex phát hiện gate G-U0 vẫn chưa đóng vì lý do MỚI — `ResourceFetcher.js` tải mã runtime iDevice từ `public/bundles/idevices.zip`, đóng gói ngày 2026-08-14 (trước toàn bộ thay đổi U03; hash grader bundle trong zip khớp CHÍNH XÁC baseline trước-U03 đã ghi ở Bối cảnh #12 dòng 90 — xác nhận độc lập, không chỉ tin lời Codex). Codex đúng quy trình dừng lại, không tự chạy full resource-bundle builder (đã cấm ở KHÔNG LÀM), và xin PM chọn giữa targeted-rebuild hoặc gỡ cấm. PM xác minh độc lập toàn bộ chain (`scripts/build-resource-bundles.js` không có cơ chế build phạm vi hẹp và không thể tái sử dụng logic mà không kích hoạt xoá-và-build-lại toàn bộ; `Makefile`/`package.json` xác nhận `make bundle` — vốn không khả dụng trên máy Codex suốt engagement — mới là đường "đúng chuẩn" vẫn luôn ẩn build lại zip này trước E2E; `ResourceFetcher.js`/`resources.ts` đọc trực tiếp) và phát hiện một lựa chọn thứ ba an toàn hơn cả hai phương án Codex đề xuất: KHÔNG rebuild gì, chỉ XOÁ file artifact cục bộ đã gitignore (`public/bundles/idevices.zip`), kích hoạt đường lùi CÓ SẴN trong chính mã sản phẩm (`fetchIdeviceFallback`/`buildFileList`/`scanDirectory`) để phục vụ mã nguồn hiện tại trực tiếp từ đĩa. PHÊ DUYỆT phương án này — xem Thiết kế khoá #10. Không đổi ACCEPTANCE #1-6 đã được user duyệt (chỉ thêm ACCEPTANCE #15), không đổi hành vi/UX học liệu, không sửa `scripts/build-resource-bundles.js` hay bất kỳ file nào ngoài FILE ĐƯỢC SỬA, không mở rộng phạm vi build tooling dùng chung toàn dự án — nên không cần AskUserQuestion. Tác dụng phụ đã biết, chấp nhận được: `public/bundles/idevices.zip` sẽ ở trạng thái "đã xoá cục bộ" sau khi U03 hoàn tất; file này được gitignore nên không ảnh hưởng git/PR, và sẽ được sinh lại đầy đủ, đúng, ở lần chạy `make bundle`/`build:all` thật tiếp theo (thuộc quy trình build/release, ngoài phạm vi packet này). Đây cũng là một khoảng trống tồn tại xuyên suốt engagement (Codex chưa từng có `make` khả dụng, luôn bỏ qua bước build-trước-E2E) — không phải lỗi riêng của U03, nhưng U03 là task đầu tiên khiến nó gây fail quan sát được; nếu I01/I02 tiếp tục thêm bề mặt runtime mới, khoảng trống này có thể tái diễn và nên được một task/packet riêng xử lý triệt để (ví dụ thêm cờ build phạm vi hẹp vào `scripts/build-resource-bundles.js`) — KHÔNG thuộc phạm vi U03, chỉ ghi nhận ở đây để theo dõi.
