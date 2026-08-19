# Task Packet — I02: HTML runtime offline

- `TASK`: I02 — HTML runtime offline (nguồn: `PLAN.md` dòng 175, cụm "I — Integration", 3 giờ, phụ thuộc I01). I01 (save/open/preview integration) đã đóng xanh (unit 143/143, E2E 7/7, biome sạch, diff đúng 3 file) — xem `repo-map.md` mục I01 nếu cần. I02 là task **thứ hai** của cụm I (I01 → I02 → I03) và **không tự đóng gate nào**: bảng cổng Go/No-Go (`PLAN.md` dòng 80-94) chỉ có `G-S0`/`G-P0`/`G-C0`/`G-K0`/`G-E0`/`G-U0` (cả sáu đã đóng) và **`G-R0` — Release** (dòng 91, hạn 15:00 ngày 10, điều kiện "Toàn bộ AT, offline, không Sev-1/2"). Không có `G-I0` trong `PLAN.md`. I02 là một bước tiến tới `G-R0`, không phải điều kiện đóng gate riêng — báo cáo hoàn thành **không được** dùng chữ "đóng gate" dưới bất kỳ hình thức nào cho I02.
- `SPEC`: EXP-01 (`SPEC.md` dòng 271, "HTML export chứa runtime/CSS/asset bằng đường dẫn tương đối"), EXP-02 (`SPEC.md` dòng 272, "Ngắt mạng vẫn hoàn thành TT, K-map và half-adder"), EXP-03 (`SPEC.md` dòng 273, "Export không chứa `.agents`, `.claude`, `.ai`, token, path tuyệt đối hoặc stack trace"), NFR-04 (`SPEC.md` dòng 368, "Hành trình offline P0 không tạo request Internet"), AT-03 (`SPEC.md` dòng 392, "Text, ảnh, MP4 và iDevice hiển thị khi ngắt mạng"), AT-09 (`SPEC.md` dòng 398, "Hoàn thành AT-05…AT-07 không mạng; không đóng gói thư mục AI"). AT-05 (`SPEC.md` dòng 394, truth table), AT-06 (dòng 395, Karnaugh), AT-07 (dòng 396, half-adder 4/4) là ba bài thi offline mà I02 phải chứng minh chạy được trong HTML export.
- `SKILLS`: `exelearning-logic-alpha` (phạm vi P0, không gate riêng cho I02), `test-driven-development` (mọi sửa logic bằng Red-Green thật), `e2e-test` (nếu thêm test E2E: one-project-per-test, không `waitForTimeout`).
- `MUC TIEU`: Chứng minh bằng test thật — không phải mô tả — rằng HTML export của `electronics-logic` chạy được **hoàn toàn offline** bằng **đường dẫn tương đối**: (a) export đóng gói runtime/CSS/template vào `idevices/electronics-logic/` và tham chiếu bằng đường dẫn tương đối (EXP-01), (b) trang export khi mở với mạng ngắt vẫn render + chấm TT/K-map/half-adder đúng (EXP-02, AT-03, AT-09), (c) export không chứa thư mục AI, token, path tuyệt đối, stack trace (EXP-03, NFR-04). Không tạo iDevice/mode/tính năng mới.
- `ĐẦU RA`: 2 test mới (1 integration + 1 unit offline) chứng minh ba điều trên, kèm bằng chứng Red-Green và baseline không đổi. Nếu `ACCEPTANCE` đạt và được PM/tester xác minh độc lập, đây là bằng chứng **I02 hoàn thành** — không phải bằng chứng đóng gate (không có `G-I0`).

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

### 1. Export đã dùng đường dẫn tương đối (EXP-01 đã cấu trúc xong — cần test chứng minh)

- **`Html5Exporter.ts` dòng 7-15:** layout ZIP HTML5 = `index.html`, `html/*.html`, `libs/`, `theme/`, `idevices/` ("iDevice-specific CSS/JS"), `content/resources/`, `content/css/`.
- **`Html5Exporter.ts` dòng 324-337:** `fetchIdeviceResources(idevice)` → `addFile('idevices/' + normalizedType + '/' + filePath, content)` — iDevice file được đóng gói vào `idevices/{type}/`.
- **`BaseExporter.ts` dòng 1253:** `const basePath = isIndex ? '' : '../';` — index dùng `idevices/...`, subpage dùng `../idevices/...` (cùng pattern `Html5Exporter.ts` dòng 408).
- **`IdeviceRenderer.ts` dòng 560-616:** `getCssLinks` → `<link rel="stylesheet" href="${basePath}idevices/${typeName}/${cssFile}">` (dòng 575); `getJsScripts` → `<script${typeAttr} src="${basePath}idevices/${typeName}/${jsFile}"></script>` (dòng 610) — **đều tương đối**.
- **`IdeviceRenderer.ts` dòng 126-132:** `data-idevice-path` dùng `config.cssClass` làm normalized type, đường dẫn `idevices/{type}/export/`.
- **`constants.ts` dòng 1036-1045 (`normalizeIdeviceType`):** `'electronics-logic'` → không có suffix `-idevice`/`idevice` để strip, không có alias trong `IDEVICE_TYPE_MAP` → giữ nguyên `'electronics-logic'`. ZIP path = `idevices/electronics-logic/`. **Lưu ý quan trọng:** dùng `'ElectronicsLogicIdevice'` làm `component.type` sẽ normalize thành `'electronicslogic'` (mất dấu gạch nối) → ZIP path sai. Vì vậy test **PHẢI dùng `type: 'electronics-logic'`** — đây chính là chuỗi mà document thật lưu (E2E spec `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` dòng 21: `const IDEVICE_TYPE = 'electronics-logic'`; dòng 37-38 `component.get('ideviceType') ?? component.get('type')` khớp `targetType`).
- **`idevice-config.ts` dòng 143-160 (`getIdeviceConfig`):** với type `'electronics-logic'` (chuỗi document component thật) → khớp configCache qua key name lẫn directory name (`configCache.set(entry.name, ...)` dòng 94) → `cssClass: 'electronics-logic'`, `componentType: 'json'`. Chuỗi xác minh khép kín. (Dùng `'ElectronicsLogicIdevice'` thì `normalizeTypeName` → `'electronicslogic'` — KHÔNG khớp key `'electronics-logic'` → rơi vào fallback cssClass sai; cũng là lý do test phải dùng `'electronics-logic'`.)

### 2. Runtime tự chứa, không gọi mạng (EXP-02/NFR-04 đã cấu trúc xong — cần test chứng minh)

- **`export/electronics-logic-grader.bundle.js` (31.566 B):** IIFE tự chứa, cuối file gán `globalThis.$electronicsLogicCore`, `$electronicsLogicGrader`, `$electronicsLogicKmapValidator`, `$electronicsLogicCircuitNetlist` — **toàn bộ boolean-core evaluator/grader/K-map validator/netlist được nhúng sẵn, không tải riêng gì thêm**.
- **`export/electronics-logic.js` (55.148 B):** `renderView` (dòng 19) validate + render; đọc global qua getter lười `getCore`/`getKmapValidator`/`getCircuitNetlist` (dòng 1075-1080); `globalThis.$electronicslogic = $electronicslogic` (dòng 1091). **Không có `fetch(`/`/api/`/`new URL`/`import(`/`require(`** — grep toàn file: chỉ `http://` duy nhất là hằng số SVG namespace `http://www.w3.org/2000/svg` (dòng 716), không phải request mạng.
- **`export/electronics-logic.html` (1 dòng):** `<div class="electronics-logic-export">{content}</div>` — không tham chiếu ngoài. CSS không có `url(`/`@import`/`http`.
- **`exe_export.js` dòng 400-429 (`loadTemplateAndRender`):** fetch template bằng **đường dẫn tương đối** `idevicePath + templateFilename`; `.catch` (dòng 420-424) fallback render `'{content}'` — **kể cả khi `file://` chặn fetch template, render vẫn hoàn chỉnh qua fallback**. Đây là lý do render offline sống sót.

### 3. Khoảng trống thật: KHÔNG có test nào chứng minh offline export

- Grep toàn bộ `test/` + `src/shared/export/`: **không có test nào** khớp `offline|EXP-01|EXP-02|EXP-03|absolute path|network` cho đường export (các hit khác là offline-auth của routes, không liên quan).
- `Html5Exporter.spec.ts` (25 describe, 321-2996): `MockResourceProvider.fetchIdeviceResources` trả **map rỗng** (dòng 92-94) — **không test nào assert nội dung ZIP `idevices/electronics-logic/` hay script/link tags** cho electronics-logic.
- `test/integration/html5-export-fixture.spec.ts`: fixture legacy ELP, chỉ assert `idevices/text/text.js` + `idevices/text/text.css` (dòng 178-179) và `data-idevice-path` relative (dòng 413-416) — không có electronics-logic, không assert EXP-03.
- Kết luận: EXP-01/02/03, NFR-04, AT-03, AT-09 **đều chưa được phủ bởi test nào** — đây chính là khoảng trống I02 phải lấp.

### 4. Baseline đã chạy xác nhận

- `npx vitest run public/files/perm/idevices/base/electronics-logic` → **14 file test, 385 test, tất cả pass** (đã tự chạy ở I01). I02 **thêm** `export/electronics-logic-offline.test.js` → sau I02 thư mục này có **15 file test** và số test = **385 + số test trong file mới**. I02 không sửa nội dung 14 file test hiện có — baseline cần đối chiếu là **385 test trong 14 file hiện có không đổi và vẫn pass** (không phải tổng số 385 giữ nguyên).
- `npx vitest run public/app/common/exe_export.test.js` → **143 test pass** (sau I01). I02 không sửa `exe_export.js`/`exe_export.test.js`.
- `bun test ./src/shared/export` (đã tự chạy sample): các spec exporter hiện có đều pass trước I02 — baseline để đối chiếu regression.

### 5. Cạm bẫy đã biết (từ I01 và repo-map)

- `public/app/common/` bị loại khỏi phạm vi Biome (`biome.json` dòng 18 `"!**/public/app/common"`) — **đừng chạy biome cho `exe_export.js`/`exe_export.test.js`** và coi đó là lint thật (sẽ báo "0 files processed"). Chỉ biome-check file `.ts`/`.tsx`.
- `make` không tồn tại trên máy Windows/Git Bash này (lặp lại từ E01-I01) — dùng `bun`/`bunx`/`npx`.
- Worktree có ~24 file `M` + toàn bộ hạ tầng Solo Logic Alpha untracked từ trước — **không đụng, không stash, không "dọn"** (xem "Bối cảnh đã xác minh" I01). Bằng chứng diff phải dùng pathspec giới hạn.
- `scripts/build-resource-bundles.js` dòng 189-244 (`scanDirectory`) **không filter test file** khi build static bundle (`idevices.zip` chứa cả `electronics-logic-grader.test.js`/`electronics-logic.test.js`) — nhưng các provider export (`FileSystemResourceProvider.ts` dòng 104-109, `BrowserResourceProvider.ts` dòng 67-77) **có** filter `.test.js`/`.spec.js`, nên **ZIP export HTML5 sạch**. I02 chỉ kiểm tra đường HTML export, không sửa `build-resource-bundles.js` (thuộc scope khác, ghi chú cho I03).
- Script order: server `getIdeviceExportFiles` trả main-first `[electronics-logic.js, grader.bundle.js]`; browser shim trả deps-first `[grader.bundle.js, electronics-logic.js]`; `config.xml` khai báo grader-first. **Vô hại tại runtime** (global đọc lười trong `renderView`, chạy sau khi cả hai script load) — I02 không sửa thứ tự này, chỉ cần test assert **cả hai file đều có mặt** và thứ tự hiện hành là determinism được lock.

## `FILE ĐƯỢC SỬA` (2 file thêm + packet)

| File | Loại thay đổi |
|---|---|
| `test/integration/html5-export-electronics-logic-offline.spec.ts` | **Thêm (mới).** Integration test: dựng document chứa 1 component `type: 'electronics-logic'`, chạy `Html5Exporter` bằng provider thật (đọc từ `public/files/perm/idevices/base/electronics-logic/export/`), unzip, assert EXP-01/EXP-02/EXP-03 trên output. Nội dung khóa ở "Thiết kế khóa". |
| `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-offline.test.js` | **Thêm (mới).** Unit test offline: load `grader.bundle.js` + `electronics-logic.js` thật, chặn `fetch` (throw), render + chấm TT/K-map/half-adder, assert không request mạng nào được tạo. Nội dung khóa ở "Thiết kế khóa". |
| `.ai/packets/I02-html-runtime-offline.md` | Packet này. |

**KHÔNG sửa** bất kỳ file production nào (`exe_export.js`, `Html5Exporter.ts`, `IdeviceRenderer.ts`, runtime iDevice, `build-resource-bundles.js`) trừ khi một test trong `ACCEPTANCE` thực sự fail và chỉ rõ lỗi production — lúc đó dừng lại báo PM trước khi sửa (xem `KHÔNG LÀM`).

## Thiết kế khóa (chốt trong I02 — không tự đổi tên, không tự thêm assert ngoài khóa)

**1. `test/integration/html5-export-electronics-logic-offline.spec.ts` — integration test export offline.**

Dựng document theo pattern `Html5Exporter.spec.ts`: lớp `MockDocument implements ExportDocument` (dòng 47-71 — `getMetadata()` trả `ExportMetadata` mặc định, `getNavigation()` trả `this.pages`) + `samplePages` (dòng 276-319), nhưng dùng provider **thật**:

```typescript
// imports
import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'path';
import {
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
    unzipSync,
    type ExportDocument, type ExportMetadata, type ExportPage,
} from '../../src/shared/export';

const samplePages: ExportPage[] = [
    {
        id: 'page-1', title: 'Electronics Logic', parentId: null, order: 0,
        blocks: [
            {
                id: 'block-1', name: 'Content', order: 0,
                components: [
                    {
                        id: 'comp-1', type: 'electronics-logic', order: 0,
                        content: '<p>Electronics logic iDevice</p>',
                        properties: {},
                    },
                ],
            },
        ],
    },
];
```

- Không tự đổi `type` sang tên khác — `'electronics-logic'` là chuỗi khóa (đã xác minh đây là chuỗi document component thật: E2E spec `IDEVICE_TYPE = 'electronics-logic'`; `normalizeIdeviceType` giữ nguyên → ZIP path `idevices/electronics-logic/`; `getIdeviceConfig` khớp key name/dir). KHÔNG dùng `'ElectronicsLogicIdevice'` (sẽ normalize thành `'electronicslogic'` thiếu gạch nối → path sai).
- `new FileSystemResourceProvider(path.join(process.cwd(), 'public'))` + `new FflateZipProvider()` + `new FileSystemAssetProvider(<thư mục rỗng tồn tại, ví dụ process.cwd()>)` — `Html5Exporter` cần cả 4 tham số `(document, resources, assets, zip)` (đã đọc fixture `test/integration/html5-export-fixture.spec.ts` dòng 86-90). Content không chứa ảnh asset nên assetProvider chỉ cần tồn tại, không được dùng tới.
- **Các assert bắt buộc (không thêm bớt):**
  1. `result.success === true` và `result.data` tồn tại.
  2. Unzip → **có đủ 4 entry** `idevices/electronics-logic/electronics-logic-grader.bundle.js`, `idevices/electronics-logic/electronics-logic.js`, `idevices/electronics-logic/electronics-logic.css`, `idevices/electronics-logic/electronics-logic.html` (EXP-01 — runtime/CSS/template được đóng gói).
  3. `index.html` chứa `src="idevices/electronics-logic/electronics-logic.js"` và `src="idevices/electronics-logic/electronics-logic-grader.bundle.js"` và `href="idevices/electronics-logic/electronics-logic.css"` — **đường dẫn tương đối, không có tiền tố `/api/`, `http://`, `https://`, `file://`, `C:\`** (EXP-01).
  4. Nếu có subpage (thêm 1 page thứ 2 `parentId: 'page-1'`), assert `html/page-2.html` chứa `../idevices/electronics-logic/electronics-logic.js` (đường dẫn tương đối ngược lên).
  5. **EXP-03 (quét toàn bộ output ZIP):** với mọi entry trong ZIP, decode UTF-8 và assert KHÔNG chứa bất kỳ pattern nào:
     - `.agents/`, `.claude/`, `.ai/` (thư mục AI)
     - `Bearer ` + regex token-like (`[A-Za-z0-9_-]{20,}` không nằm trong hash/base64 hợp lệ — đơn giản hoá: assert không có `sk-`, `ghp_`, `AIza`, `Bearer `)
     - path tuyệt đối kiểu `/api/`, `http://`, `https://`, `file://`, `C:\`, `/Users/`, `/home/`
     - `stack trace` / `at Object.` / `at <anonymous>` (dấu hiệu stack trace rò rỉ)
  6. **EXP-02/NFR-04 (runtime không gọi mạng):** với 2 entry JS trong `idevices/electronics-logic/`, assert KHÔNG chứa `fetch(`, `XMLHttpRequest`, `/api/`, `https://`, `http://` — ngoại trừ chính xác hằng số `http://www.w3.org/2000/svg` (SVG namespace, không phải request) xuất hiện trong `electronics-logic.js` (đã xác minh dòng 716). Assert này chứng minh runtime không có khả năng tạo request mạng trong export.

**2. `public/files/perm/idevices/base/electronics-logic/export/electronics-logic-offline.test.js` — unit test offline render+chấm.**

Dùng happy-dom (mặc định vitest config), pattern theo các test runtime hiện có trong thư mục (đã đọc `electronics-logic.test.js` mẫu). Cấu trúc khóa:

```javascript
// Load pattern bắt buộc: dùng pathToFileURL + cache-busting query, y như các test hiện có
// (export/electronics-logic-grader.test.js dòng 5-17, export/electronics-logic.test.js dòng 16-21)
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

describe('electronics-logic offline export runtime', () => {
    let fetchCalls;
    let originalFetch;

    beforeAll(async () => {
        originalFetch = globalThis.fetch;
        fetchCalls = [];
        globalThis.fetch = (...args) => {
            fetchCalls.push(args);
            return Promise.reject(new Error('offline: network disabled'));
        };
        // Load the REAL export artifacts (same files Html5Exporter packages)
        const currentDirectory = join(process.cwd(), 'public/files/perm/idevices/base/electronics-logic/export');
        let moduleSequence = 0;
        moduleSequence += 1;
        await import(`${pathToFileURL(join(currentDirectory, 'electronics-logic-grader.bundle.js')).href}?offline=${moduleSequence}`);
        moduleSequence += 1;
        await import(`${pathToFileURL(join(currentDirectory, 'electronics-logic.js')).href}?offline=${moduleSequence}`);
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    // 3 tests khóa: truthTable, kmap, circuit (half-adder)
    // Mỗi test: dựng payload schema-v1 hợp lệ → renderView(data, false, '{content}')
    // → assert HTML chứa .electronics-logic-runtime + data-schema-version="1"
    // → chấm qua grader: globalThis.$electronicsLogicGrader.gradeActivity(...)
    // → assert điểm đúng; CUỐI test: expect(fetchCalls.length).toBe(0)
});
```

- **Payload khóa (không tự đổi) — đã đối chiếu đầy đủ với `schema-lifecycle.js` dòng 190-262 (`validate`), không chỉ `grading.maxScore`:** validator bắt buộc `id` (chuỗi khác rỗng, dòng 198), `prompt` (chuỗi khác rỗng vì cả 4 mode đều nằm trong `AUTHORING_MODES`, dòng 206-209), `learner` (plain object, dòng 255), `accessibility.label` (chuỗi, dòng 256-259) — **bốn field này bị thiếu ở bản trước và là nguyên nhân thật của 3 test fail ban đầu**, không phải lỗi cơ chế offline. Payload đầy đủ, đúng field:
  - `truthTable`: `{ id:'offline-truth-table', type:'electronics.logic', schemaVersion:1, mode:'truthTable', prompt:'Hoàn thành bảng chân trị.', variables:['A','B'], authoring:{answerSource:'minterms', solution:''}, answer:{expression:'', minterms:[0,1,2], dontCares:[]}, grading:{maxScore:4}, learner:{}, accessibility:{label:'Bài tập bảng chân trị Electronics Logic'} }` — bài sai 1 dòng thì feedback báo sai (AT-05).
  - `kmap`: `{ id:'offline-kmap', type:'electronics.logic', schemaVersion:1, mode:'kmap', prompt:'Hoàn thành bìa Karnaugh.', variables:['A','B'], authoring:{answerSource:'minterms', solution:''}, answer:{expression:'', minterms:[3], dontCares:[0,1,2]}, grading:{maxScore:6}, learner:{}, accessibility:{label:'Bài tập Karnaugh Electronics Logic'} }` — **đã sửa so với bản trước (bản trước ghi `minterms:[0,3], dontCares:[]` nhưng mô tả "có don't-care" — tự mâu thuẫn, chưa từng đối chiếu với `kmap-grader.js`).** Payload mới đã đối chiếu trực tiếp với `core/kmap-grader.js` dòng 12-90 (`gradeKmapResponse`, trọng số `WEIGHTS = {cells:0.3, groups:0.4, sop:0.3}` dòng 6) và `core/boolean-core.js` dòng 459-468 (`vectorToMinterms`, chỉ `value===1` mới tính là minterm) + dòng 728-738 (`minimizeSop`, `minterms.length===0` → `cost:{implicants:0, literals:0}`). 3 trong 4 ô là don't-care nên **bất kỳ lưới `cells` hợp lệ nào cũng đạt điểm ô tối đa**; response `groups:[]` (cố tình không nhóm) khiến minterm bắt buộc (index 3) bị báo "không được phủ" → điểm dừng ở đúng `maxScore*WEIGHTS.cells = 6*0.3 = 1.8`, thấp hơn tối đa — chứng minh chấm sai đúng cách (AT-06), không cần biết thứ tự Gray-code của lưới K-map để dựng response vẫn đảm bảo đúng toán học 100%.
  - `circuit`: `{ id:'offline-circuit', type:'electronics.logic', schemaVersion:1, mode:'circuit', prompt:'Hoàn thành mạch cộng bán phần.', variables:['A','B'], authoring:{answerSource:'expression'}, answer:{expression:'', minterms:[], dontCares:[], testbench: halfAdder.testbench}, grading:{maxScore:8}, learner:{}, accessibility:{label:'Bài tập mạch cộng bán phần Electronics Logic'} }` với `halfAdder = require('../core/fixtures/circuit-half-adder.json')`, response `{ netlist: halfAdder.netlist }` — nét y như test grader hiện có `export/electronics-logic-grader.test.js` dòng 7 (`require('../core/fixtures/circuit-half-adder.json')`) + dòng 100-119 (exercise/response). `circuit` không nằm trong `EXPRESSION_ANSWER_MODES` nên `authoring.solution` không bị validate, chỉ cần `authoring` là plain object — không cần field `solution`. Assert `result.score` đạt `result.maxScore` (half-adder 4/4, AT-07).
  - Được phép dùng một hàm helper `createBaseData(overrides)` trả về object nền đầy đủ field bắt buộc rồi spread `overrides` cho từng test (pattern base+override), miễn giá trị cuối cùng của từng field khớp đúng payload khóa ở trên — không phải chép nguyên văn cấu trúc, nhưng giá trị phải khớp.
- **Assert `fetchCalls.length === 0` là bắt buộc trong cả 3 test** — đây là bằng chứng NFR-04/EXP-02 (không tạo request Internet nào). Không cần test mới cho mode `boolean` (I02 chỉ phủ TT/K-map/half-adder theo đúng DoD/AT-09).
- Gọi `gradeActivity` theo đúng signature mà `core/boolean-grader.js` (`gradeActivity`, dòng 187-195) đã expose qua `$electronicsLogicGrader` — không tự bịa API. Nếu signature cần `context`/`exercise` shape khác, đọc `export/electronics-logic-grader.bundle.js` tail export hoặc test runtime hiện có trong thư mục để đối chiếu trước khi viết (xem "Khóa" — không tự suy diễn).

## `KHÔNG LÀM`

- Không sửa bất kỳ file production nào trừ khi `ACCEPTANCE` thực sự fail vì lỗi production — nếu fail, DỪNG và báo PM kèm log đầy đủ, không tự "sửa qua loa".
- Không sửa baseline: không sửa file nào trong `public/files/perm/idevices/base/electronics-logic/**` ngoài file test mới ở `export/`; không sửa `exe_export.js`/`exe_export.test.js`; không sửa `Html5Exporter.ts`/`IdeviceRenderer.ts`/`BaseExporter.ts`/`constants.ts`/`idevice-config.ts`/`build-resource-bundles.js`.
- Không sửa script order (server vs browser) — vô hại, ngoài phạm vi.
- Không sửa `Html5Exporter.spec.ts`/`html5-export-fixture.spec.ts` đã có — chỉ thêm file integration mới.
- Không viết I03 (asset/secret audit) — I02 dừng sau `ACCEPTANCE`. **Ranh giới chính xác (để tránh nhầm lẫn):** assert #5 trong "Thiết kế khóa" mục 1 (EXP-03) của I02 **chỉ** quét 4 entry `idevices/electronics-logic/*` mà chính I02 đóng gói — đây là trong phạm vi I02, đã khóa, được phép. I03 là một task **riêng, chưa được giao**, mở rộng audit EXP-03 sang **toàn bộ output document** (mọi trang, mọi asset ảnh/video, mọi component) — không tự suy rộng phạm vi quét của I02 sang đó, không tự tạo file/fixture/packet nào cho I03, không tự đặt tên test/describe có nhãn "I03", dù đã có kinh nghiệm từ I02. Nếu thấy khoảng trống I03 trong lúc làm I02, ghi chú lại trong báo cáo cho PM — không tự lấp.
- Không tự tuyên bố gate nào đóng (không có `G-I0`).
- Không dùng `waitForTimeout()`; không `.skip`/`.todo`; không chạy `make`.
- Không chạy biome cho file `.js` trong `public/files/perm/idevices/...` nếu nằm ngoài phạm vi Biome — trước khi chạy, `bunx @biomejs/biome check` file đó xem có được quét không; nếu "0 files processed / ignored", bỏ qua và ghi chú trong báo cáo (không coi là lint fail).
- Không đưa payload chứa secret/token thật vào test — payload là dữ liệu giả, không phải credential.
- Không sửa `.ai/packets/I01-*.md` hay packet cũ.

## `ACCEPTANCE` (quan sát được)

1. Integration test: `bun test test/integration/html5-export-electronics-logic-offline.spec.ts` → pass, chứng minh (a) ZIP chứa 4 entry `idevices/electronics-logic/...`, (b) `index.html` + subpage tham chiếu relative (không `/api/`/absolute), (c) quét toàn bộ ZIP không dính `.agents`/`.claude`/`.ai`/token/path tuyệt đối/stack trace (EXP-03), (d) runtime JS không chứa `fetch(`/`/api/`/`https?://` ngoại trừ SVG namespace (NFR-04).
2. Unit offline test: `npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic-offline.test.js` → pass cả 3 bài TT/K-map/half-adder với `fetch` bị chặn throw và `fetchCalls.length === 0` (EXP-02, AT-03, AT-09).
3. Regression: `npx vitest run public/files/perm/idevices/base/electronics-logic` → **15 file test** (14 hiện có + file mới `electronics-logic-offline.test.js`) tất cả pass; **385 test của 14 file hiện có không đổi** (I02 không sửa nội dung file test cũ).
4. `bun test ./src/shared/export` → các spec exporter hiện có vẫn pass (không lệch baseline).
5. Bằng chứng Red-Green thật phải được dán trong báo cáo: RED (chạy test offline TRƯỚC khi có — fail vì không có file/kết quả, hoặc fail vì một điều kiện chưa thoả) → GREEN (sau khi thêm test đúng, pass).

## `TEST BẮT BUỘC`

```bash
# Integration — test mới
bun test test/integration/html5-export-electronics-logic-offline.spec.ts

# Unit offline — test mới
npx vitest run public/files/perm/idevices/base/electronics-logic/export/electronics-logic-offline.test.js

# Regression Core iDevice — 15 file (14 cũ + file mới) tất cả pass; 385 test của 14 file cũ không đổi
npx vitest run public/files/perm/idevices/base/electronics-logic

# Regression export — spec hiện có vẫn xanh
bun test ./src/shared/export

# Lint (chỉ file .ts; .js trong public/files/perm/... chạy thử rồi quyết định theo output)
bunx @biomejs/biome check test/integration/html5-export-electronics-logic-offline.spec.ts
```

**Ghi chú `make`:** Windows/Git Bash không có `make` (lặp lại từ E01-I01) — dùng `bun`/`bunx`/`npx`.

**Ghi chú coverage:** I02 chỉ thêm test — không thêm production code, không phát sinh yêu cầu coverage mới ngoài việc các test mới phải pass đủ điều kiện trong `ACCEPTANCE`.

## `ĐẦU RA`

- **Bắt buộc dán CẢ HAI loại bằng chứng git — thiếu một trong hai coi như chưa đạt `ĐẦU RA`:**
  1. Pathspec giới hạn đúng 2 file mới (bằng chứng diff sạch, không lẫn 24 file `M` có sẵn):
     ```bash
     git status -- test/integration/html5-export-electronics-logic-offline.spec.ts public/files/perm/idevices/base/electronics-logic/export/electronics-logic-offline.test.js
     git diff --stat -- test/integration/html5-export-electronics-logic-offline.spec.ts public/files/perm/idevices/base/electronics-logic/export/electronics-logic-offline.test.js
     ```
  2. **`git status --porcelain` đầy đủ, không pathspec** — dán nguyên văn, không rút gọn. Mục đích: lộ ra bất kỳ file nào khác ngoài 2 file trên mà lệnh (1) không thể thấy được (bài học từ vi phạm phạm vi round 2/3 trong lần triển khai trước — bằng chứng scoped từng che khuất 2 rồi 3 file ngoài phạm vi). PM sẽ đối chiếu với baseline ~24 file `M`/untracked đã biết; bất kỳ dòng nào ngoài baseline đó + 2 file mới đều phải được giải thích trong báo cáo, không được bỏ qua.
- Dán output RED rồi GREEN cho cả 2 test mới (bằng chứng Red-Green thật, không chỉ báo cáo bằng lời).
- Dán output đầy đủ (pass/fail, số ca) cho cả 4 lệnh ở `TEST BẮT BUỘC` — đặc biệt: danh sách 4 entry ZIP `idevices/electronics-logic/` trong integration test, và số `fetchCalls` = 0 trong unit offline test.
- Trạng thái: I02 **không đóng gate nào** (không có `G-I0` trong `PLAN.md`) — chỉ là bằng chứng I02 hoàn thành, một bước tiến tới `G-R0` (Release, 15:00 ngày 10). Không tự bắt đầu I03 dù `ACCEPTANCE` đã xanh — dừng lại, chờ PM/tester xác minh độc lập.
