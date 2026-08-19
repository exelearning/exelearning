# Task Packet — I01: Save/open/preview integration

- `TASK`: I01 — Save/open/preview integration (nguồn: `PLAN.md` dòng 174, cụm "I — Integration", 3 giờ, phụ thuộc U03). U03 (bốn mode nối dây UI + preview + chấm điểm) đã đóng — xem `repo-map.md` mục "U03 Circuit-mode grading wire-up evidence" (5/5 Playwright pass, `idevices.zip` cũ đã dọn). Gate `G-U0` đã đóng, không phụ thuộc I01. I01 là task **đầu tiên** của cụm I (I01 → I02 → I03) và **không tự đóng gate nào**: bảng cổng Go/No-Go (`PLAN.md` dòng 80-94) chỉ có `G-S0`, `G-P0`, `G-C0`, `G-K0`, `G-E0`, `G-U0` (cả sáu đã đóng) và **`G-R0` — Release** (dòng 91, hạn 15:00 ngày 10, điều kiện "Toàn bộ AT, offline, không Sev-1/2"). Không có `G-I0` trong `PLAN.md`. I01 là một bước tiến tới `G-R0`, không phải điều kiện đóng gate riêng — báo cáo hoàn thành **không được** dùng chữ "đóng gate" dưới bất kỳ hình thức nào cho I01.
- `SPEC`: PLAT-03 (`SPEC.md` dòng 206, "Editor, preview và HTML export dùng cùng `schemaVersion: 1`"), PLAT-04 (`SPEC.md` dòng 207, "Save → close → reopen giữ JSON chuẩn hóa trong 10 vòng"), LOG-03 (`SPEC.md` dòng 258, "Netlist JSON v1 lưu node, pin, wire, vị trí và round-trip không đổi nghĩa" — áp dụng riêng cho mode `circuit`), NFR-03 (`SPEC.md` dòng 367, "Save/open 10 lần không sai khác JSON chuẩn hóa"), AT-02 (`SPEC.md` dòng 391, "Tạo bốn mode, save/open 10 lần; JSON không đổi nghĩa" — tiêu chí nghiệm thu trực tiếp nhất, đòi hỏi **cả bốn mode**, không phải một).
- `SKILLS`: `exelearning-logic-alpha` (phạm vi P0, không gate riêng cho I01), `test-driven-development` (sửa `exe_export.js` bằng Red-Green thật: RED = thêm ca test `needsJsonRender('json', 'electronics-logic')` trước, chạy thấy fail vì tên chưa có trong mảng → GREEN = thêm đúng 1 phần tử), `e2e-test` (2 test mới trong `electronics-logic.spec.ts` phải dùng đúng helper có sẵn, one-project-per-test, không `waitForTimeout`).
- `MUC TIEU`: Chứng minh bằng test thật — không phải mô tả — rằng cả bốn mode (`boolean`, `truthTable`, `kmap`, `circuit`) của `electronics-logic` dùng chung một schema (`schemaVersion: 1`) xuyên suốt editor → save → reload → preview, JSON chuẩn hóa không đổi nghĩa qua đúng 10 vòng save/open, và preview luôn dùng `renderView` tươi (không phải cache `htmlView` cũ) — bằng cách vá khoảng trống `jsonOnlyIdevices` trong `exe_export.js` mà quyết định trước đó của PM ("Fix now, mirror trueorfalse") đã chốt phải sửa trong I01.
- `ĐẦU RA`: 1 sửa nhỏ, bảo toàn hành vi (behavior-preserving) tại `exe_export.js` (trích `needsJsonRender` thành hàm thuần + thêm đúng 1 phần tử `'electronics-logic'`) + 4 test unit mới cho hàm đó + 2 test E2E mới thêm vào file spec đã có (không sửa 5 test cũ). Không tạo mode/idevice/tính năng mới. Nếu toàn bộ `ACCEPTANCE` đạt và được PM/tester xác minh độc lập, đây là bằng chứng **I01 hoàn thành** — không phải bằng chứng đóng gate (không có `G-I0`).

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

- **`exe_export.js` dòng 316-393 (`initJsonIdevice`) đã đọc lại trực tiếp, nguyên trạng hiện tại:** biến `isJsonIdevice = ideviceNode.getAttribute('data-idevice-component-type') === 'json'`; mảng `jsonOnlyIdevices` có đúng 8 phần tử: `'casestudy'`, `'file-attachment'`, `'form'`, `'image-gallery'`, `'magnifier'`, `'three-sixty-viewer'`, `'trueorfalse'`, `'adaptative-quiz'` — **không có `'electronics-logic'`**; `needsJsonRender = isJsonIdevice && jsonOnlyIdevices.includes(ideviceType)`; dùng ở `if (needsJsonRender || ideviceNode.classList.contains('db-no-data')) { this.loadTemplateAndRender(...) } else { exportIdevice.renderBehaviour(...); exportIdevice.init(...); ... }`. Đây là toàn bộ cơ chế quyết định "render tươi qua `renderView`" hay "dùng nhánh `renderBehaviour`/`init` giả định `htmlView` cache còn hợp lệ".
- **`config.xml` dòng 14 của `electronics-logic` đã `grep` trực tiếp: `<component-type>json</component-type>`** — xác nhận `isJsonIdevice` luôn `true` cho iDevice này, nên khoảng trống `jsonOnlyIdevices` là **có thật, có ảnh hưởng**, không phải no-op.
- **`src/shared/export/renderers/IdeviceRenderer.ts` dòng 142-147 đã đọc trực tiếp: `if (config.componentType === 'json') { dataAttrs += ' data-idevice-component-type="json"'; ... }`** — khép kín chuỗi xác minh `config.xml` → `IdeviceRenderer.ts` (gắn attribute) → `exe_export.js` (đọc attribute, quyết định nhánh render).
- **Hệ quả của khoảng trống này:** với `electronics-logic`, nhánh `else` hiện tại (`renderBehaviour`/`init`, không gọi lại `renderView`) sẽ chạy thay vì `loadTemplateAndRender`. Trong luồng UI bình thường (mở editor → sửa → đóng editor) cache `htmlView` được làm mới đáng tin cậy nên bug khó lộ qua thao tác tay thông thường — nhưng đây chính xác là loại "khác biệt ẩn giữa preview và export dùng chung schema" mà PLAT-03/AT-02 yêu cầu phải loại trừ, và là lý do PM đã chốt quyết định sửa ngay trong I01 thay vì hoãn.
- **`window.$exeExport` là object literal bắt đầu dòng 27-28 (`if (typeof window.$exeExport === 'undefined') { window.$exeExport = {`), kết thúc dòng 557-558 (`} \n} // End of if...`), alias `var $exeExport = window.$exeExport;` dòng 561 — cả ba mốc này đã tự `grep`/đọc lại lần nữa (không phải trích dẫn cũ) và đúng nguyên văn.** File `exe_export.js` hiện có **949 dòng tổng cộng** — không mâu thuẫn với object đóng ở dòng 558: sau dòng 561, file còn tiếp tục gán thêm property khác lên cùng biến `$exeExport` bằng dot-notation (`$exeExport.searchBar = {...}` từ dòng 572, có comment "To review: This should be in a different file (exe_search.js)"), nằm **ngoài** object literal gốc, không liên quan I01. `initJsonIdevice` là 1 method bên trong object literal gốc (dòng 316-393, trong khoảng 28-557) — thêm method `needsJsonRender` mới vào cùng object literal này (không phải vào `searchBar` hay phần sau dòng 561), gọi được trực tiếp qua `window.$exeExport.needsJsonRender(...)` trong test, không cần dựng DOM/fetch cho riêng phần logic quyết định.
- **Sửa lỗi chính tả trong bản packet trước:** tên biến/mảng đúng trong mã nguồn là `isJsonIdevice` và `jsonOnlyIdevices` (không phải `isJsonIdevide`/`jsonOnlyIdevides` như bản nháp trước — lỗi gõ của PM, đã tự phát hiện qua đọc lại `exe_export.js` dòng 365 và 369 nguyên văn). Toàn bộ packet này đã được sửa lại đúng chính tả; không còn chỗ nào dùng "Idevide". Codex đã dừng đúng lúc khi phát hiện sai khác này — không tự đoán/tự sửa chính tả, đúng theo "Thiết kế khóa" không được tự đổi tên.
- **`exe_export.test.js` đã đọc dòng 1-170: pattern test chuẩn của file — `beforeEach` gán `window.$exe`, `window.$exe_i18n`, `window.localStorage` (stub), jQuery stub, rồi `await import('./exe_export.js')`; `afterEach` xoá sạch các global đó.** Đã `grep` toàn file: **không có test nào đụng tới `jsonOnlyIdevices` hay `needsJsonRender`** — thêm mới an toàn, không đụng test cũ. Baseline đã tự chạy xác nhận: `npx vitest run public/app/common/exe_export.test.js` → **139 test pass** (1 file).
- **Biome/`bunx @biomejs/biome check` đã tự chạy thực tế cho cả hai file `public/app/common/exe_export.js` và `public/app/common/exe_export.test.js`: output `Checked 0 files... ignored by configuration` cho cả hai.** Nguyên nhân: `biome.json` dòng 18 có `"!**/public/app/common"` trong `files.includes` — loại **toàn bộ thư mục** `public/app/common` khỏi phạm vi Biome quét (không phải chỉ tắt formatter như câu chữ tổng quát ở AGENTS.md §6 mô tả cho `public/app/**` nói chung — với riêng thư mục con `common`, cả linter lẫn formatter đều không chạy). Hệ quả: **không có lệnh Biome nào áp dụng cho 2 file này** — đừng chạy `bunx biome check` trên chúng và tưởng là bằng chứng lint thật (sẽ chỉ báo "0 files processed"). Ngược lại, đã tự chạy `bunx @biomejs/biome check test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` → `Checked 1 file... No fixes applied` — file `.ts` này **có** nằm trong phạm vi Biome (qua override `"includes": ["**/*.spec.ts", "**/*.e2e-spec.ts", "test/**/*.ts"]` ở `biome.json` dòng 96, tắt `noExplicitAny`/`noEmptyPattern`).
- **`test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` đã đọc toàn bộ 380 dòng, hiện có đúng 5 test, tất cả trong `test.describe('Electronics Logic authoring', ...)` (dòng 89-380):** test 1 (dòng 90-167, `truthTable`, có kiểm tra reload+preview+chấm điểm+reset), test 2 (dòng 169-226, `kmap`), test 3 (dòng 228-264, `kmap` chọn sai — lỗi cấu trúc), test 4 (dòng 266-348, `circuit` half-adder), test 5 (dòng 350-379, `circuit` lỗi cấu trúc không nối). **Không có test nào cho mode `boolean`. Không có test nào reload quá 1 lần.**
- **Helper `addElectronicsLogicIdevice(page, projectUuid)` (dòng 70-87) dùng `page.locator(IDEVICE_ARTICLE).first()`** — an toàn cho iDevice đầu tiên trong project, nhưng **gọi lại helper này lần 2 trở đi trên cùng 1 project sẽ trả nhầm về iDevice ĐẦU TIÊN đã có** (luôn `.first()`), không phải iDevice mới vừa thêm. `addIdevice()` (`workarea-helpers.ts` dòng 778-814) — đã đọc lại — điều kiện chờ nội bộ cũng chỉ xác nhận `.first()` khớp, không đảm bảo phần tử thứ N đã render xong. Vì round-trip test của I01 cần 4 iDevice trong cùng 1 project, cần 1 helper mới có `expect(locator).toHaveCount(index + 1)` tường minh trước khi lấy `.nth(index)`, để loại cả hai rủi ro trên (xem "Thiết kế khóa").
- **`getSavedIdevice(page, ideviceId)` (dòng 20-68) đọc `jsonProperties` trực tiếp từ Yjs doc, tìm theo `id` VÀ `ideviceType`/`type`** — an toàn dùng lại cho nhiều iDevice cùng loại trong 1 project, không cần sửa.
- **`edition/electronics-logic.js` dòng 225-289 đã đọc lại — toàn bộ field editor xác nhận đúng tên `data-field`:** `mode` (dòng 225, options `boolean`/`truthTable`/`kmap`/`circuit`), `variable-count` (231), `prompt` (237), `circuit-outputs` (242, chỉ hiện khi `mode==='circuit'`), `answer-source` (251, options `expression`/`minterms`), `minterms` (260)/`dont-cares` (269, chỉ hiện khi `answer-source==='minterms'`), `expression` (278, chỉ hiện khi `answer-source==='expression'`), `max-score` (288), `solution` (289). UI author cho mode `boolean` **đã đầy đủ, không cần sửa** — chỉ dùng field `expression`/`minterms` chung với `truthTable`/`kmap`.
- **`edition/electronics-logic.js` dòng 140-164 (`collectEditorData`) đã đọc lại:** với `answerSource==='expression'` → `answer.expression=value('expression')??''`, `answer.minterms=[]`, `answer.dontCares=[]`. `parseIndexList` (không sort — sort diễn ra sau, ở `normalize()`).
- **`core/schema-lifecycle.js` dòng 71-74 (default) và 265-272 (`normalize()`) đã đọc lại:** default `grading.maxScore=10`; `normalize()` sort `answer.minterms`/`answer.dontCares` tăng dần trước khi lưu — giải thích vì sao nhập `'2, 1'` sẽ lưu thành `[1, 2]`.
- **`export/electronics-logic.js` đã đọc lại các đoạn liên quan tới mode `boolean` (không đọc lại `truthTable`/`kmap`/`circuit`, đã xác minh ở U01-U03):** `renderView` (dòng 19+) — 3 mode `truthTable`/`kmap`/`circuit` có nhánh riêng, **`boolean` rơi vào nhánh `else` → `renderExpressionInput`** (dòng 81-89, render `<input class="electronics-logic-expression__input" type="text" data-role="learner-expression">`). `collectResponse` (824-867) trả `{expression: value.trim()}` cho mode `boolean`. `checkActivity`/`applyResult` (869-958) — với mode `boolean` (nhánh `else` cuối, không có `kmap-cells`/`truth-values`/`circuit-canvas`): gắn `data-grade` (`passed`/`failed`) **trực tiếp lên phần tử `learner-expression`**; chuỗi feedback bình thường = `` `${messages.score}: ${result.score} / ${result.maxScore}.` `` (ví dụ đúng hệt dạng `'Điểm: 5 / 5.'`), lỗi cú pháp = `` `${messages.syntaxError} ${check.error?.message}` ``. `resetActivity` (358-386) xoá `learner-expression.value=''`, gọi `clearFeedback` (xoá mọi `[data-grade]`, kể cả trên `learner-expression`) + `updateEmptyState`. `handleResponseChange` (388-392, bind theo sự kiện `input`) gọi lại `clearFeedback`+`updateEmptyState`. `updateEmptyState` (968-985) toggle `[data-role="empty-state"]` theo `expression.value.trim() !== ''`. Message tiếng Việt đã xác nhận đúng nguyên văn: `score: 'Điểm'`.
- **`core/boolean-grader.js` đã đọc toàn bộ 201 dòng:** `gradeExpression` (103-138) chấm **nhị phân** — `passed=core.areEquivalent(response.expression, exercise.answer.expression, exercise.variables)`; `score = passed ? maxScore : 0` (không có điểm từng phần như 3 mode kia); lỗi cú pháp (`BooleanSyntaxError`) → `score=0`, check `id:'expression-syntax'`. `gradeActivity` (187-195) dispatch theo `mode`, `boolean` là nhánh `else` mặc định (không có case `'boolean'` tường minh).
- **Baseline hiện tại của toàn bộ thư mục `electronics-logic` đã tự chạy xác nhận:** `npx vitest run public/files/perm/idevices/base/electronics-logic` → **14 file test, 385 test, tất cả pass**. I01 không sửa file nào trong thư mục này — con số này **phải giữ nguyên 385** sau I01.
- **`PLAN.md` dòng 80-94 (bảng gate) và dòng 168-176 (bảng cụm I) đã đọc lại** — xác nhận trích dẫn I01 chính xác: `| I01 | 3 | U03 | Save/open/preview integration | Bốn mode round-trip 10 lần và preview dùng cùng schema/core. |`.
- **`git status` của worktree đã tự chạy lại và xác nhận: TOÀN BỘ hạ tầng Solo Logic Alpha (`.ai/`, `PLAN.md`, `SPEC.md`, `repo-map.md`, `public/files/perm/idevices/base/electronics-logic/`, `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts`, các skill quản lý, `tools/ai/`) là untracked (`??`) — chưa từng được commit qua bất kỳ task E/K/U nào trước đó, kể cả sau khi U03 đã đóng gate `G-U0`.** Đây là trạng thái vốn có từ trước I01, không phải do I01 gây ra. Ngoài ra worktree còn có **~20 file khác đã `modified` (`M`) không liên quan I01 và không liên quan `electronics-logic`** (ví dụ `AGENTS.md` — chính là bản thêm mục 13 Solo Logic Alpha Addendum, đã tự `git diff` xác nhận nội dung đổi chỉ đúng phần thêm mục 13, không có gì bất thường; `.env.test` — đã tự `git diff` xác nhận chỉ thêm 1 dòng `DB_PATH=:memory:` cho test, không chứa secret; còn lại là `bun.lock`, `bunfig.toml`, vài file `*.spec.ts` ở `src/`, `scripts/`, `app/`). **I01 không được đụng, không được stash, không được giải thích hay "dọn" các file này** — chúng nằm ngoài phạm vi Task Packet này hoàn toàn. Hệ quả trực tiếp: một lệnh `git status` trần (không tham số) ở cuối task sẽ luôn hiện toàn bộ danh sách này chứ không chỉ 3 file I01 sửa — đó là **trạng thái nền bình thường của worktree**, không phải lỗi của I01. Bằng chứng "chỉ đổi đúng 3 file" phải dùng `git status`/`git diff` có pathspec giới hạn đúng 3 file (xem `ĐẦU RA`), không dùng lệnh trần.

## `FILE ĐƯỢC SỬA` (3 file sửa/thêm + packet)

| File | Loại thay đổi |
|---|---|
| `public/app/common/exe_export.js` | **Sửa.** Trích xuất `needsJsonRender` thành method thuần trong `window.$exeExport`, thêm đúng 1 phần tử `'electronics-logic'` vào `jsonOnlyIdevices`. Không đổi hành vi nào khác của `initJsonIdevice`. Nội dung khóa ở "Thiết kế khóa". |
| `public/app/common/exe_export.test.js` | **Sửa.** Thêm 1 khối `describe('needsJsonRender', ...)` với đúng 4 `it(...)` mới. Không sửa test cũ. TDD thật (RED trước khi sửa mảng, GREEN sau). |
| `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` | **Sửa.** Thêm 1 helper mới (`addElectronicsLogicIdeviceAt`) + 2 `test(...)` mới vào cuối `test.describe('Electronics Logic authoring', ...)`. Không sửa 5 test cũ (dòng 90-379), không sửa `addElectronicsLogicIdevice`/`getSavedIdevice` đã có. |
| `.ai/packets/I01-save-open-preview.md` | Packet này (đã tồn tại khi Codex bắt đầu, không cần sửa). |

## Thiết kế khóa (chốt trong I01 — không tự đổi tên hàm, tên field, hay giá trị kỳ vọng)

**1. `public/app/common/exe_export.js` — thêm method mới ngay trước `initJsonIdevice: function(ideviceType, intervalName) {` (dòng 316), và thay khối tính toán cũ ở dòng 365-380:**

Method mới (thêm, không có trong code hiện tại):

```javascript
needsJsonRender: function (componentType, ideviceType) {
    const jsonOnlyIdevices = [
        'casestudy',
        'file-attachment',
        'form',
        'image-gallery',
        'magnifier',
        'three-sixty-viewer',
        'trueorfalse',
        'adaptative-quiz',
        'electronics-logic',
    ];
    return componentType === 'json' && jsonOnlyIdevices.includes(ideviceType);
},
```

Trong `initJsonIdevice`, thay đúng khối (giữ nguyên biến `ideviceType` đã có ở dòng ngay trước, xoá biến `isJsonIdevice` không còn dùng):

```javascript
// TRƯỚC (xoá khối này):
const isJsonIdevice = ideviceNode.getAttribute('data-idevice-component-type') === 'json';
const jsonOnlyIdevices = [ /* 8 phần tử cũ */ ];
const ideviceType = ideviceNode.getAttribute('data-idevice-type');
const needsJsonRender = isJsonIdevice && jsonOnlyIdevices.includes(ideviceType);

// SAU (thay bằng):
const ideviceType = ideviceNode.getAttribute('data-idevice-type');
const needsJsonRender = this.needsJsonRender(ideviceNode.getAttribute('data-idevice-component-type'), ideviceType);
```

Dòng `if (needsJsonRender || ideviceNode.classList.contains('db-no-data')) { ... } else { ... }` ngay sau đó **giữ nguyên, không đổi**.

**2. `public/app/common/exe_export.test.js` — thêm khối `describe` mới (vị trí: bất kỳ đâu ở top level của file, cạnh các `describe` khác đã có), đúng 4 ca:**

```javascript
describe('needsJsonRender', () => {
    it('treats electronics-logic as a JSON-only idevice needing fresh renderView', () => {
        expect(window.$exeExport.needsJsonRender('json', 'electronics-logic')).toBe(true);
    });

    it('still treats trueorfalse as a JSON-only idevice (existing precedent)', () => {
        expect(window.$exeExport.needsJsonRender('json', 'trueorfalse')).toBe(true);
    });

    it('does not require fresh renderView for a JSON idevice outside the allow-list', () => {
        expect(window.$exeExport.needsJsonRender('json', 'text')).toBe(false);
    });

    it('does not require fresh renderView when component type is not json', () => {
        expect(window.$exeExport.needsJsonRender('html', 'electronics-logic')).toBe(false);
    });
});
```

Đặt trong cùng `describe`/`beforeEach` gốc của file (đã `import('./exe_export.js')` và gán `window.$exeExport` — xem "Bối cảnh đã xác minh") để `window.$exeExport.needsJsonRender` sẵn sàng khi test chạy.

**3. `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` — thêm helper mới ngay sau `addElectronicsLogicIdevice` (sau dòng 87, trước dòng 89 `test.describe(...)`):**

```typescript
async function addElectronicsLogicIdeviceAt(page: Page, index: number) {
    await expandIdeviceCategory(page, /Science|Ciencia/i);
    const paletteItem = page.locator(`[data-testid="idevice-${IDEVICE_TYPE}"], .idevice_item[id="${IDEVICE_TYPE}"]`);
    await expect(paletteItem.first()).toBeVisible();
    await addIdevice(page, IDEVICE_TYPE);

    const articles = page.locator(IDEVICE_ARTICLE);
    await expect(articles).toHaveCount(index + 1);
    const article = articles.nth(index);
    const ideviceId = await article.getAttribute('id');
    if (!ideviceId) throw new Error(`Electronics Logic iDevice #${index} rendered without an id`);
    const editor = article.locator('[data-testid="electronics-logic-editor"]');
    await expect(editor).toBeVisible();
    return { editor, ideviceId };
}
```

`expect(articles).toHaveCount(index + 1)` là bắt buộc, không phải tùy chọn — đây là điều kiện chờ tường minh thay cho race condition đã xác minh ở `addIdevice()` (helper gốc chỉ chờ `.first()`, không chờ phần tử thứ N).

**4. Test E2E mới #1 — mode `boolean` riêng lẻ (thêm trước `});` đóng `test.describe` ở dòng 380):**

```typescript
test('authors, saves, and grades a boolean expression through the palette, editor, and preview', async ({
    authenticatedPage,
    createProject,
}) => {
    const page = authenticatedPage;
    const projectUuid = await createProject(page, 'Electronics Logic Boolean');
    const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

    await editor.locator('[data-field="mode"]').selectOption('boolean');
    await editor.locator('[data-field="variable-count"]').selectOption('2');
    await editor.locator('[data-field="prompt"]').fill('Nhập biểu thức boolean tương đương A AND B.');
    await editor.locator('[data-field="answer-source"]').selectOption('expression');
    await editor.locator('[data-field="expression"]').fill('A AND B');
    await editor.locator('[data-field="max-score"]').fill('5');
    await editor.locator('[data-field="solution"]').fill('A AND B là phép nhân logic (AND).');

    await saveIdevice(page, ideviceId);
    await saveProject(page);

    const savedBeforeReload = await getSavedIdevice(page, ideviceId);
    expect(savedBeforeReload.error).toBeUndefined();
    expect(savedBeforeReload.jsonProperties?.schemaVersion).toBe(1);
    expect(savedBeforeReload.jsonProperties?.type).toBe('electronics.logic');
    expect(savedBeforeReload.jsonProperties).toMatchObject({
        mode: 'boolean',
        prompt: 'Nhập biểu thức boolean tương đương A AND B.',
        variables: ['A', 'B'],
        authoring: { answerSource: 'expression', solution: 'A AND B là phép nhân logic (AND).' },
        answer: { expression: 'A AND B', minterms: [], dontCares: [] },
        grading: { maxScore: 5 },
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
    await expect(preview).toHaveAttribute('data-schema-version', '1');
    await expect(preview).toHaveAttribute('data-mode', 'boolean');
    await expect(preview).toContainText('Nhập biểu thức boolean tương đương A AND B.');
    await expect(preview).not.toContainText('A AND B là phép nhân logic (AND).');

    const learnerExpression = preview.locator('[data-role="learner-expression"]');
    await expect(learnerExpression).toBeVisible();
    await expect(preview.locator('[data-role="empty-state"]')).toBeVisible();

    await learnerExpression.fill('A OR B');
    await expect(preview.locator('[data-role="empty-state"]')).toBeHidden();
    await preview.locator('[data-action="check"]').click();
    await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('Điểm: 0 / 5.');
    await expect(learnerExpression).toHaveAttribute('data-grade', 'failed');

    await preview.locator('[data-action="reset"]').click();
    await expect(learnerExpression).toHaveValue('');
    await expect(learnerExpression).not.toHaveAttribute('data-grade');
    await expect(preview.locator('[data-role="empty-state"]')).toBeVisible();
    await expect(preview.locator('[data-role="grading-feedback"]')).toBeEmpty();

    await learnerExpression.fill('A AND B');
    await preview.locator('[data-action="check"]').click();
    await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('Điểm: 5 / 5.');
    await expect(learnerExpression).toHaveAttribute('data-grade', 'passed');
});
```

**5. Test E2E mới #2 — round-trip 10 vòng, gộp cả 4 mode trong 1 project (thêm ngay sau test #1, vẫn trước `});` đóng `test.describe`):**

```typescript
test('round-trips boolean, truth-table, Karnaugh, and circuit authoring across ten save/reload cycles', async ({
    authenticatedPage,
    createProject,
}) => {
    const page = authenticatedPage;
    const projectUuid = await createProject(page, 'Electronics Logic Round Trip');

    const { editor: booleanEditor, ideviceId: booleanId } = await addElectronicsLogicIdevice(page, projectUuid);
    await booleanEditor.locator('[data-field="mode"]').selectOption('boolean');
    await booleanEditor.locator('[data-field="variable-count"]').selectOption('2');
    await booleanEditor.locator('[data-field="prompt"]').fill('Vòng lặp lưu/mở: Boolean.');
    await booleanEditor.locator('[data-field="answer-source"]').selectOption('expression');
    await booleanEditor.locator('[data-field="expression"]').fill('A AND B');
    await booleanEditor.locator('[data-field="max-score"]').fill('5');
    await saveIdevice(page, booleanId);

    const { editor: truthTableEditor, ideviceId: truthTableId } = await addElectronicsLogicIdeviceAt(page, 1);
    await truthTableEditor.locator('[data-field="mode"]').selectOption('truthTable');
    await truthTableEditor.locator('[data-field="variable-count"]').selectOption('2');
    await truthTableEditor.locator('[data-field="prompt"]').fill('Vòng lặp lưu/mở: bảng chân trị.');
    await truthTableEditor.locator('[data-field="answer-source"]').selectOption('minterms');
    await truthTableEditor.locator('[data-field="minterms"]').fill('2, 1');
    await truthTableEditor.locator('[data-field="max-score"]').fill('4');
    await saveIdevice(page, truthTableId);

    const { editor: kmapEditor, ideviceId: kmapId } = await addElectronicsLogicIdeviceAt(page, 2);
    await kmapEditor.locator('[data-field="mode"]').selectOption('kmap');
    await kmapEditor.locator('[data-field="variable-count"]').selectOption('2');
    await kmapEditor.locator('[data-field="prompt"]').fill('Vòng lặp lưu/mở: Karnaugh.');
    await kmapEditor.locator('[data-field="answer-source"]').selectOption('minterms');
    await kmapEditor.locator('[data-field="minterms"]').fill('3, 0');
    await kmapEditor.locator('[data-field="max-score"]').fill('6');
    await saveIdevice(page, kmapId);

    const { editor: circuitEditor, ideviceId: circuitId } = await addElectronicsLogicIdeviceAt(page, 3);
    await circuitEditor.locator('[data-field="mode"]').selectOption('circuit');
    await circuitEditor.locator('[data-field="variable-count"]').selectOption('2');
    await circuitEditor.locator('[data-field="prompt"]').fill('Vòng lặp lưu/mở: mạch logic.');
    await circuitEditor.locator('[data-field="circuit-outputs"]').fill('Sum = A XOR B\nCarry = A AND B');
    await circuitEditor.locator('[data-field="max-score"]').fill('8');
    await saveIdevice(page, circuitId);

    await saveProject(page);

    const modes = [
        { key: 'boolean', ideviceId: booleanId, prompt: 'Vòng lặp lưu/mở: Boolean.', baseline: undefined as unknown },
        { key: 'truthTable', ideviceId: truthTableId, prompt: 'Vòng lặp lưu/mở: bảng chân trị.', baseline: undefined as unknown },
        { key: 'kmap', ideviceId: kmapId, prompt: 'Vòng lặp lưu/mở: Karnaugh.', baseline: undefined as unknown },
        { key: 'circuit', ideviceId: circuitId, prompt: 'Vòng lặp lưu/mở: mạch logic.', baseline: undefined as unknown },
    ];

    for (const m of modes) {
        const saved = await getSavedIdevice(page, m.ideviceId);
        expect(saved.error).toBeUndefined();
        expect(saved.jsonProperties?.mode).toBe(m.key);
        m.baseline = saved.jsonProperties;
    }

    for (let round = 1; round <= 10; round += 1) {
        await reloadPage(page);
        await waitForAppReady(page);
        for (const m of modes) {
            const saved = await getSavedIdevice(page, m.ideviceId);
            expect(saved.error).toBeUndefined();
            expect(saved.jsonProperties).toEqual(m.baseline);
        }
    }

    await openPreviewPanel(page);
    await waitForPreviewContent(page);

    for (const m of modes) {
        const preview = getPreviewFrame(page).locator(`.electronics-logic-runtime[data-mode="${m.key}"]`);
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute('data-schema-version', '1');
        await expect(preview).toContainText(m.prompt);
    }
});
```

**JSON kỳ vọng ngay sau lần save đầu (khóa cứng, PM/tester sẽ tái xác minh độc lập khi review — không chấp nhận chỉ vì Codex dán số ra):**

- `boolean`: `{ schemaVersion:1, type:'electronics.logic', mode:'boolean', prompt:'Vòng lặp lưu/mở: Boolean.', variables:['A','B'], authoring:{answerSource:'expression'}, answer:{expression:'A AND B', minterms:[], dontCares:[]}, grading:{maxScore:5} }`.
- `truthTable`: `{ ..., mode:'truthTable', prompt:'Vòng lặp lưu/mở: bảng chân trị.', authoring:{answerSource:'minterms'}, answer:{expression:'', minterms:[1,2], dontCares:[]}, grading:{maxScore:4} }` — `'2, 1'` chuẩn hóa thành `[1,2]` (sort tăng dần, xem "Bối cảnh đã xác minh").
- `kmap`: `{ ..., mode:'kmap', prompt:'Vòng lặp lưu/mở: Karnaugh.', authoring:{answerSource:'minterms'}, answer:{expression:'', minterms:[0,3], dontCares:[]}, grading:{maxScore:6} }` — `'3, 0'` chuẩn hóa thành `[0,3]`.
- `circuit`: `{ ..., mode:'circuit', prompt:'Vòng lặp lưu/mở: mạch logic.', answer:{expression:'', minterms:[], dontCares:[], testbench:{variables:['A','B'], inputs:{A:'input-1',B:'input-2'}, outputs:{Sum:'output-1',Carry:'output-2'}, expected:{Sum:'A XOR B',Carry:'A AND B'}}}, grading:{maxScore:8} }` — cùng dạng `testbench` đã dùng ở test 4 hiện có (dòng 266-348), không tự đổi tên `input-1`/`output-1`.

Không bắt buộc thêm `toMatchObject` riêng cho JSON trên trong test round-trip (test đã tự chứng minh qua `mode` check + `toEqual(m.baseline)` xuyên 10 vòng) — nhưng nếu `mode`/`jsonProperties` không khớp đúng các giá trị trên ngay từ vòng đầu, đó là lỗi thật, không phải lỗi test.

## `KHÔNG LÀM`

- Không sửa 5 test hiện có (dòng 90-379) — chỉ thêm, không đổi hành vi/assertion đã có.
- Không sửa bất kỳ file nào trong `public/files/perm/idevices/base/electronics-logic/**` (core/edition/export) — khoảng trống duy nhất đã xác minh cho I01 nằm ở `exe_export.js` (tầng orchestrator export, ngoài thư mục iDevice). UI author cho mode `boolean` đã đầy đủ từ trước, không cần sửa.
- Không đổi 8 phần tử đã có trong `jsonOnlyIdevices` — chỉ thêm đúng 1 phần tử `'electronics-logic'`, giữ nguyên thứ tự các phần tử cũ.
- Không refactor thêm gì khác trong `initJsonIdevice`/`exe_export.js` ngoài khối đã khóa ở "Thiết kế khóa" — không đổi nhánh `else`, không đổi fallback `db-no-data`, không đổi `initJsonIdevices`/`initJsonIdeviceInterval`.
- Không viết I02/I03 — I01 chỉ là 1 task trong cụm I, dừng lại sau khi `ACCEPTANCE` của I01 đạt.
- Không tự tuyên bố gate nào đóng (không có `G-I0`) — kể cả khi toàn bộ `ACCEPTANCE` xanh.
- Không chạm `translations/**`, không chạy `make translations` — `needsJsonRender` không có chuỗi UI mới; 2 test E2E mới chỉ dùng chuỗi tiếng Việt đã có sẵn trong `export/electronics-logic.js` (`'Điểm'`, các prompt tự đặt là dữ liệu test, không phải chuỗi UI hệ thống).
- Không dùng `waitForTimeout()` cho chờ bất đồng bộ — dùng `expect(...).toHaveCount()`/`toBeVisible()`/`toHaveAttribute()` (đều tự động chờ/thử lại) như 5 test hiện có.
- Không đánh dấu `.skip`/`.todo`.
- Không chạy `make` — máy Windows/Git Bash hiện tại không có `make` (gotcha đã lặp lại từ E01-U03) — dùng lệnh thay thế ở `TEST BẮT BUỘC`.
- Không chạy `bunx @biomejs/biome check` nhắm vào `exe_export.js`/`exe_export.test.js` và coi đó là bằng chứng lint — đã xác minh thực tế 2 file này nằm ngoài phạm vi quét của Biome (`biome.json` loại trừ toàn bộ `public/app/common`), lệnh đó chỉ trả về "0 files processed / ignored", không kiểm tra được gì.
- Không thêm project mới ngoài đúng 2 project mà 2 test mới cần (1 cho test boolean riêng lẻ, 1 cho test round-trip) — không gộp chung, không dùng lại project của 5 test cũ.

## `ACCEPTANCE` (quan sát được)

1. `window.$exeExport.needsJsonRender('json', 'electronics-logic')` → `true`; `needsJsonRender('json', 'trueorfalse')` → `true`; `needsJsonRender('json', 'text')` → `false`; `needsJsonRender('html', 'electronics-logic')` → `false`. Bằng chứng RED (fail trước khi thêm `'electronics-logic'` vào mảng) rồi GREEN (pass sau khi thêm) phải được dán trong báo cáo.
2. `npx vitest run public/app/common/exe_export.test.js` → đúng **143 test pass** (139 cũ + 4 mới), 0 fail, 0 skip.
3. `bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` → đúng **7 test pass** (5 cũ giữ nguyên + 2 mới), 0 fail, 0 skip.
4. Test boolean riêng lẻ: JSON sau save khớp `toMatchObject` đã khóa ở "Thiết kế khóa"; sau reload `toEqual` y hệt; preview có `data-schema-version="1"`, `data-mode="boolean"`, hiện đúng prompt, **không** hiện `solution`; nhập sai → `data-grade="failed"` + feedback chứa `'Điểm: 0 / 5.'`; reset → giá trị input rỗng, hết `data-grade`, empty-state hiện lại, feedback rỗng; nhập đúng → `data-grade="passed"` + feedback chứa `'Điểm: 5 / 5.'`.
5. Test round-trip: cả 4 `jsonProperties` (boolean/truthTable/kmap/circuit) khớp đúng JSON đã khóa ở "Thiết kế khóa" ngay sau save đầu; qua **đúng 10 vòng** reload, cả 4 đều `toEqual` baseline ban đầu không lệch (chứng minh trực tiếp AT-02/NFR-03/PLAT-04); sau đó cả 4 runtime hiện trong preview với đúng `data-schema-version="1"` và đúng prompt tương ứng theo `data-mode`.
6. `npx vitest run public/files/perm/idevices/base/electronics-logic` → vẫn nguyên **385 test pass, 14 file** — không lệch so với baseline trước I01 (I01 không sửa file nào trong thư mục này).
7. `bunx @biomejs/biome check test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` → sạch, không lỗi mới.

## `TEST BẮT BUỘC`

```bash
# Unit — hàm mới, dán cả RED (trước khi sửa mảng) và GREEN (sau khi sửa)
npx vitest run public/app/common/exe_export.test.js

# Regression Core/E-U workstream — phải NGUYÊN 385 test, không đổi (I01 không chạm thư mục này)
npx vitest run public/files/perm/idevices/base/electronics-logic

# E2E — đúng 7 pass, 0 fail, 0 skip (5 cũ + 2 mới)
bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts

# Lint — CHỈ cho file .ts; exe_export.js/exe_export.test.js nằm ngoài phạm vi Biome (xem "Bối cảnh đã xác minh"), đừng chạy biome cho 2 file đó
bunx @biomejs/biome check test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
```

**Ghi chú `make`** (như E01-U03): Windows/Git Bash hiện tại không có `make`; dùng các lệnh `npx`/`bunx`/`bun x` ở trên thay thế cho `make test-frontend`/`make test-e2e`/`make fix`.

**Ghi chú coverage:** `needsJsonRender` là hàm thuần rất nhỏ (1 điều kiện `&&`), 4 test đã khóa ở "Thiết kế khóa" phủ đủ cả 4 tổ hợp nhánh — patch coverage tự nhiên đạt 100% cho phần thêm mới, không cần chạy `--coverage` riêng để chứng minh. Phần sửa trong `initJsonIdevice` chỉ đổi cách gọi (gọi qua `this.needsJsonRender(...)` thay vì tính inline), không thêm nhánh mới — không phát sinh yêu cầu coverage mới ngoài 4 test trên.

Kỳ vọng: cả 4 lệnh trên xanh tuyệt đối, không có ngoại lệ/`try-catch` nuốt lỗi nào. **Không** cần chạy `make test-e2e-static` — I01 không đụng static build/embedding.

## `ĐẦU RA`

- **Không dùng `git status` trần** (worktree đã có sẵn nhiều file `modified`/untracked không liên quan I01 — xem "Bối cảnh đã xác minh"). Thay vào đó dán output của 2 lệnh có pathspec giới hạn đúng 3 file I01 sửa:
  ```bash
  git status -- public/app/common/exe_export.js public/app/common/exe_export.test.js test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
  git diff -- public/app/common/exe_export.js public/app/common/exe_export.test.js
  ```
  (file thứ 3 là untracked từ trước I01 — dùng `git diff --no-index /dev/null test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` hoặc dán trực tiếp nội dung 2 test mới đã thêm nếu `git diff` không áp dụng được cho file untracked). Yêu cầu: đúng 3 file trên xuất hiện trong output, không file nào khác được liệt kê trong các lệnh này (vì đã giới hạn pathspec nên về mặt kỹ thuật không thể liệt kê file khác — mục đích là chứng minh diff của riêng 3 file đúng như "Thiết kế khóa", không phải chứng minh worktree sạch tuyệt đối). **Không** yêu cầu, không tự ý stash/dọn các file `modified`/untracked khác đang có sẵn trong worktree — ngoài phạm vi I01.
- Dán output RED rồi GREEN cho 4 test `needsJsonRender` (bằng chứng Red-Green thật, không phải chỉ báo cáo bằng lời).
- Dán output đầy đủ (pass/fail, số ca) cho cả 4 lệnh ở `TEST BẮT BUỘC` — đặc biệt: JSON đầy đủ của cả 4 `jsonProperties` baseline trong test round-trip ngay sau lần save đầu, và xác nhận rõ ràng cả 10 vòng lặp đều `toEqual` baseline (không phải chỉ dán dòng "7 passed" cuối cùng mà không cho thấy vòng lặp đã thực sự chạy 10 lần).
- Trạng thái: I01 **không đóng gate nào** (không có `G-I0` trong `PLAN.md`) — chỉ là bằng chứng I01 hoàn thành, một bước tiến tới `G-R0` (Release, 15:00 ngày 10). `G-U0` đã đóng từ trước, không phụ thuộc I01. Không tự tuyên bố gate nào đóng trong báo cáo hoàn thành. Không tự bắt đầu I02 dù `ACCEPTANCE` đã xanh — dừng lại, chờ PM/tester xác minh độc lập.
