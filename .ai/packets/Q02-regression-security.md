# Task Packet — Q02: Regression/security

- `TASK`: Q02 — Regression/security (nguồn: `PLAN.md` dòng 183, cụm "Q — QA/release", 2 giờ, phụ thuộc Q01). Q01 ("Course E2E") đã đóng xanh và được PM/Tester xác minh độc lập ngày 2026-08-19 (`repo-map.md`, mục "Q01 Codex delivery — FINAL (AT-06 fix): independently verified stable, Q01 confirmed"). Bảng cổng Go/No-Go không có `G-Q0` — Q02 **không tự đóng gate nào**, chỉ tiến tới `G-R0` (Release) và **mở khóa phụ thuộc cho Q03** (`PLAN.md` dòng 184: `Q03 | 2 | Q02 | Bàn giao`).
- `SPEC`: AT-S01, AT-S02, AT-S03 (`SPEC.md` dòng 387-389); AT-01…AT-10 (`SPEC.md` dòng 390-399); dòng 401 — nhãn "Solo Logic Alpha" chỉ được gắn khi **tất cả** các AT trên đạt. PLAT-06 (`SPEC.md` dòng ~207, "Dữ liệu sai hiển thị lỗi tiếng Việt và không crash" — mục tiêu của "malformed JSON" trong mô tả Q02). EXP-03 (dòng 273, "Export không chứa `.agents`, `.claude`, `.ai`, token, path tuyệt đối hoặc stack trace" — mục tiêu của "secret scan"). EXP-02, AT-03, AT-09 (mục tiêu của "offline").
- `SKILLS`: `exelearning-logic-alpha` (phạm vi P0, không gate riêng cho Q02), `systematic-debugging` (bắt buộc nếu bất kỳ lệnh nào trong `TEST BẮT BUỘC` fail — xác định root cause trước khi báo cáo hoặc sửa), `test-driven-development` (Red-Green thật cho test mới ở Piece 1), `e2e-test` (test mới phải theo đúng convention của `electronics-logic.spec.ts` — không `waitForTimeout()`, dùng locator/expect có timeout).
- `MUC TIEU`: Chứng minh bằng việc chạy lại toàn bộ bộ test hiện có (không viết lại, không đoán) rằng AT-01…AT-10 vẫn xanh sau Q01; xác nhận rõ ràng trạng thái AT-S01…AT-S03 (bao gồm một khoảng trống minh bạch cần nêu, không che giấu — xem mục 6 dưới); đóng khoảng trống thật duy nhất còn lại của "malformed JSON" bằng **đúng một** test E2E mới cho `electronics-logic` (các iDevice khác đã có bằng chứng generic, xem mục 3); xác nhận lại "offline" và "secret scan" đã đạt qua các bằng chứng có sẵn từ I01-I03/Q01, không xây dựng lại.
- `ĐẦU RA`: 1 test E2E mới (Piece 1) + báo cáo tổng hợp bằng chứng cho AT-S01…AT-S03 và AT-01…AT-10 (bảng đối chiếu AT-ID → file test → kết quả, dán trong báo cáo hoàn thành, không phải file mới) + xác nhận Red-Green cho test mới + toàn bộ output các lệnh ở `TEST BẮT BUỘC`. Nếu `ACCEPTANCE` đạt và được PM/tester xác minh độc lập, đây là bằng chứng **Q02 hoàn thành** — không đóng gate nào, nhưng mở khóa Q03.

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

### 1. Baseline hiện tại (đã tự chạy trong phiên xác minh Q01, dùng làm mốc so sánh cho Q02)

`bun run test:unit` (= `bun test ./src ./test/helpers ./scripts ./app --coverage`) tại thời điểm Q01 được xác nhận (2026-08-19): **8013 pass, 0 fail, 113544 expect() calls, 220 file, ~100s**. Đây là mốc regression — nếu con số này lệch (kể cả tăng bất thường hay giảm) sau khi thêm test ở Piece 1, phải giải thích chênh lệch trong báo cáo, không bỏ qua.

### 2. Bản đồ bằng chứng AT đã có sẵn — hầu hết AT-01…AT-10 đã được các task trước chứng minh, Q02 chỉ cần chạy lại và đối chiếu

Đã grep `.ai/packets/*.md` và đọc trực tiếp source/test liên quan, xác nhận:

- **AT-01** (clean build): chứng minh gián tiếp qua toàn bộ test suite pass + `bun run test:unit`/`test:frontend` không lỗi biên dịch.
- **AT-02** (iDevice round-trip): `I01-save-open-preview.md` đã xác nhận round-trip 4 chế độ, 10 vòng reload.
- **AT-03** (offline text/ảnh/MP4/iDevice): `I02`/`I03` (`test/integration/html5-export-media-offline.spec.ts`, `html5-export-electronics-logic-offline.spec.ts`) + `Q01` test `'AT-09 completes the course offline...'` (`electronics-logic-demo.spec.ts` dòng 540-570+) đã chứng minh qua route interception thật.
- **AT-04/AT-05** (boolean fixtures, truth table): `electronics-logic-demo.spec.ts` dòng 450-477 (`AT-05 marks only one wrong truth-table cell...`) + `core/boolean-*.test.js`.
- **AT-06** (Karnaugh): `electronics-logic-demo.spec.ts` dòng 479-509, đã được PM/Tester xác minh độc lập ổn định (23/23 lần chạy) ngày 2026-08-19.
- **AT-07** (half-adder): `electronics-logic-demo.spec.ts` dòng 511-538 + `core/circuit-half-adder.test.js`.
- **AT-08** (lỗi mạch, không crash): `E01-netlist-validation-topology.md` (`circuit-netlist.test.js`, phát hiện cấu trúc tĩnh) + `E02-value-propagation-engine.md` (`circuit-engine.test.js`, không crash khi lan truyền vòng lặp) + `E04-halfadder-fixture.md` (fixture half-adder, gỡ dây → lỗi `structure-danglingInputPin`, không throw) + E2E `'shows a structural error for an unconnected circuit...'` (`electronics-logic.spec.ts` dòng 401+).
- **AT-09** (hoàn thành offline, không đóng gói thư mục AI): `Q01` test dòng 540-570+ (dùng `auditWholeExport`, xem mục 4 dưới) + `electronics-logic.spec.ts` dòng 596-741 (bản offline-export test riêng cho electronics-logic, I02).
- **AT-10** (regression, không Sev-1/2): kết quả tổng hợp của toàn bộ các lệnh ở `TEST BẮT BUỘC` dưới, cộng với việc không có phát hiện Sev-1/2 nào còn mở trong `repo-map.md` tính đến 2026-08-19.

Việc của Q02 cho các mục trên là **chạy lại + dán bằng chứng + lập bảng đối chiếu AT-ID → file/dòng test → PASS/FAIL** trong báo cáo hoàn thành — không viết lại test đã có, không nghi ngờ vô căn cứ những gì đã CONFIRMED.

### 3. Khoảng trống thật duy nhất đã xác nhận: "malformed JSON" cho riêng `electronics-logic` chưa có bằng chứng ở tầng E2E

- `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js` dòng 19-31 (`renderView`): khi `this.validateData(data)` trả `invalid`, hàm trả về một `<section class="electronics-logic-runtime electronics-logic-runtime--invalid" data-testid="electronics-logic-runtime" data-schema-version="">` chứa `<p class="electronics-logic-runtime__alert" role="alert">` với nội dung `messages.invalidData` — **không throw**.
- Dòng 987-991 (`getMessages`): `invalidData: _('Dữ liệu bài tập Electronics Logic không hợp lệ.')` — thông báo tiếng Việt cố định, đúng chữ PLAT-06 ("hiển thị lỗi tiếng Việt và không crash").
- `export/electronics-logic.test.js` dòng 484-492 (`'renders a Vietnamese alert for malformed runtime data without throwing'`) và dòng 554-574 (`'reports every malformed schema-v1 runtime boundary with stable error codes'`, 13 case) đã chứng minh cơ chế này **ở tầng unit (Vitest, gọi trực tiếp `renderer.renderView(data, ...)` với `data` giả)**.
- **Đã đọc toàn bộ `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` (742 dòng, 8 test hiện có)**: không có test nào tạo một component `electronics-logic` với `jsonProperties` bị hỏng qua đường Yjs thật (giống cách người dùng thật gặp phải khi mở lại một project cũ bị hỏng dữ liệu) rồi kiểm tra hành vi hiển thị. Tám test hiện có chỉ cover: truth-table/kmap/circuit/boolean authoring hợp lệ, round-trip 10 vòng, lỗi cấu trúc mạch (AT-08, không phải JSON hỏng), và offline export.
- **Đã đọc toàn bộ `test/e2e/playwright/specs/malformed-idevice-json.spec.ts` (130 dòng, regression #2177)**: chứng minh cơ chế **generic, ở tầng framework** (structure-binding/edit-blocking dialog) hoạt động đúng cho iDevice `trueorfalse` — không test `electronics-logic`.
- **Kết luận:** cơ chế hiển thị lỗi tiếng Việt/không crash cho `electronics-logic` đã tồn tại thật trong production code và đã có bằng chứng unit-level vững chắc, nhưng **chưa có bằng chứng E2E (trình duyệt thật) nào riêng cho iDevice này**. Đây là khoảng trống thật, hẹp, đúng với dòng "malformed JSON" trong `PLAN.md` — không phải suy đoán.

### 4. "Secret scan" — ba lớp bằng chứng độc lập đã tồn tại, Q02 chỉ xác nhận lại cả ba còn khớp nhau

- `I02` (`electronics-logic.spec.ts` dòng 141-168 phần offline-export, và `html5-export-electronics-logic-offline.spec.ts` dòng 141-168): quét 4 entry runtime/CSS của riêng `electronics-logic`.
- `I03` (`html5-export-fixture.spec.ts`, describe `'EXP-03/SKILL-11 whole-export forbidden pattern audit'`): quét **toàn bộ** ZIP xuất từ fixture `old_el_cid.elp` (fixture cũ, không chứa `electronics-logic`).
- `Q01` (`electronics-logic-demo.spec.ts` dòng 382-417, hàm `auditWholeExport`, gọi ở dòng 556 trong test `AT-09`): quét **toàn bộ** ZIP xuất từ khóa học demo thật — khóa học này **có chứa** đủ ba mode `electronics-logic` (truth table, K-map, half-adder) cộng text/ảnh/video. Đây là bài audit toàn diện nhất, đã thêm regex phát hiện dạng token (`sk-proj-`, `sk-ant-`, `ghp_`, `AIza`, `Bearer`) và path tuyệt đối, và một `dotSegment` regex bắt mọi đoạn path bắt đầu bằng dấu chấm ở **bất kỳ vị trí nào**, không chỉ cấp gốc.
- Ba danh sách forbidden-pattern được cài đặt độc lập ở ba nơi (không dùng chung hàm — đã là quyết định có chủ đích của I03, xem `I03-asset-secret-audit.md` mục 3). Q02 **không** hợp nhất chúng (ngoài phạm vi, rủi ro cao) — chỉ chạy lại cả ba và xác nhận không có xung đột/lệch kết quả.

### 5. "Offline" — đã đạt qua I01-I03 và Q01 AT-09, Q02 chỉ chạy lại

`EXP-02`/`AT-03`/`AT-09` đã có bằng chứng qua route-interception thật (không mock mạng) ở cả `Q01` (khóa học đầy đủ) và `I02`/`electronics-logic.spec.ts` dòng 596-741 (riêng `electronics-logic`, cách ly). Không cần thêm test.

### 6. Khoảng trống quản trị đã phát hiện — AT-S03 được đánh giá cho Codex, không phải writer hiện tại — PHẢI báo cáo, KHÔNG tự sửa

- `.ai/skills.lock.json` dòng 217-226 (`executionPolicy`): `"primaryWriter": "Codex"`, `"authorizationSource": "Direct user instruction on 2026-08-12 assigning all implementation work to Codex."`
- Dòng 228-236 (`gateEvaluation`, gate `G-S0`, `evaluatedAt: "2026-08-12"`): `AT-S03: "PASS: Codex discovered the five managed skills and completed parser/TDD and systematic-debugging dry-runs..."` — bằng chứng PASS này **gắn liền với Codex cụ thể**, không phải một AI writer bất kỳ.
- `AGENTS.md` §13.4 mục 4 đã được PM cập nhật ngày 2026-08-19: Codex tạm dừng (hết quota), **Nemotron 3 Ultra là writer đang hoạt động**, DeepSeek V4 là dự phòng. `skills.lock.json` **chưa được cập nhật** để phản ánh thay đổi này (không thuộc phạm vi PM tự sửa file lock — đây là artifact của gate `G-S0` đã đóng, việc ghi đè cần quyết định riêng).
- **Q02 KHÔNG được tự chạy một vòng dry-run AT-S03 mới cho Nemotron 3 Ultra và cũng KHÔNG được tự sửa `skills.lock.json`** — đây là một quyết định quản trị lớn hơn phạm vi "chạy lại test" của Q02 (2 giờ). Việc của Q02 chỉ là: (a) chạy lại cơ chế AT-S02 (`sync-project-skills.ps1 -Check`) vì đây là kiểm tra parity thuần túy, không phụ thuộc writer; (b) đọc lại `skills.lock.json` xác nhận AT-S01 (provenance/hash) vẫn nhất quán nội bộ — cũng không phụ thuộc writer; (c) **nêu rõ trong báo cáo hoàn thành** rằng AT-S03 hiện mang bằng chứng của Codex, chưa có bằng chứng tương đương cho Nemotron 3 Ultra, và đây là quyết định PM cần đưa ra trước khi gắn nhãn "Solo Logic Alpha" chính thức — không tự ý kết luận PASS hay FAIL thay PM.

## `FILE ĐƯỢC SỬA` (1 file sửa + packet)

| File | Loại thay đổi |
|---|---|
| `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` | **Sửa (chèn 1 test mới giữa dòng 741 và 742).** Xem Piece 1 dưới. |
| `.ai/packets/Q02-regression-security.md` | Packet này. |

**KHÔNG sửa** bất kỳ file production nào (`export/electronics-logic.js`, `core/schema-lifecycle.js`, v.v.) — cơ chế hiển thị lỗi tiếng Việt/không crash đã tồn tại và đã được chứng minh ở tầng unit (mục 3). Nếu test mới ở Piece 1 FAIL, đây là tín hiệu cần dừng lại và báo PM theo `systematic-debugging`, không tự sửa production code để "làm xanh" trong phạm vi Q02.

**KHÔNG sửa** `.ai/skills.lock.json` — xem mục 6.

## Thiết kế khóa (chốt trong Q02 — không tự đổi tên, không tự thêm assert ngoài khóa)

**Piece 1 — `electronics-logic.spec.ts`, chèn test mới ngay sau dòng 741 (`});` đóng test offline-export), trước dòng 742 (`});` đóng `test.describe`).**

Tất cả helper dùng dưới đây (`gotoWorkarea`, `waitForAppReady`, `openPreviewPanel`, `waitForPreviewContent`, `getPreviewFrame`) đã được import sẵn ở đầu file (dòng 2-15) — **không cần thêm import nào**. Kỹ thuật ghi trực tiếp vào `structureBinding`/`compMap` mirror chính xác `test/e2e/playwright/specs/malformed-idevice-json.spec.ts` dòng 70-103 (đã proven, đang chạy xanh), chỉ đổi `ideviceType`/payload.

```typescript
test('shows a Vietnamese alert instead of crashing when stored jsonProperties are malformed', async ({
    authenticatedPage,
    createProject,
}) => {
    const page = authenticatedPage;
    const projectUuid = await createProject(page, 'Electronics Logic Malformed JSON');
    await gotoWorkarea(page, projectUuid);
    await waitForAppReady(page);

    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    const MALFORMED_JSON =
        '{"id":"idevice-malformed-electronics","type":"electronics-logic","schemaVersion":1,"mode":"unsupported"}';

    const pageId = await page.evaluate(
        ({ jsonProperties }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const firstPageId = bridge?.documentManager?.getNavigation()?.get(0)?.get('id');
            if (!firstPageId || !bridge?.structureBinding) {
                throw new Error('Yjs project structure is not available');
            }
            const binding = bridge.structureBinding;
            const blockId = binding.createBlock(firstPageId, 'Malformed Electronics Logic');
            binding.createComponent(firstPageId, blockId, 'electronics-logic', {
                id: 'idevice-malformed-electronics',
                htmlContent: '<div class="electronics-logic-runtime"></div>',
                jsonProperties: '{}',
            });
            const compMap = binding.getComponentMap('idevice-malformed-electronics');
            binding.manager.getDoc().transact(() => {
                compMap.set('jsonProperties', jsonProperties);
            });
            return firstPageId;
        },
        { jsonProperties: MALFORMED_JSON },
    );

    await page.locator(`#menu_nav_content .nav-element[nav-id="${pageId}"]`).click();

    await openPreviewPanel(page);
    await waitForPreviewContent(page);

    const invalidRuntime = getPreviewFrame(page).locator('.electronics-logic-runtime--invalid');
    await expect(invalidRuntime).toBeVisible();
    await expect(invalidRuntime.locator('[role="alert"]')).toContainText(
        'Dữ liệu bài tập Electronics Logic không hợp lệ.',
    );

    expect(pageErrors).toEqual([]);
});
```

- `MALFORMED_JSON` cố ý là JSON hợp lệ về cú pháp nhưng sai schema (`mode: "unsupported"`, thiếu `variables`/`prompt`/`accessibility`/`learner`) — đúng case `[{ mode: 'unsupported' }, 'invalidMode']` đã được chứng minh ở `export/electronics-logic.test.js` dòng 559. Việc test cú pháp-JSON-hỏng (không parse được) đã là phạm vi generic của `malformed-idevice-json.spec.ts` (framework-level, iDevice-agnostic) — không lặp lại ở đây.
- Nếu `binding.createBlock`/`binding.createComponent`/`binding.getComponentMap` báo lỗi runtime khi chạy (API khác với giả định), đây là tín hiệu dừng lại và đọc lại `structureBinding` source thật trước khi sửa lời gọi — không đoán tên hàm khác.
- Không set `test.setTimeout` riêng — test này nhẹ hơn nhiều so với test round-trip/offline-export (không có vòng lặp reload, không export ZIP), mirror các test đơn giản khác trong cùng file (ví dụ dòng 279).

## `KHÔNG LÀM`

- Không sửa bất kỳ file production nào (`export/electronics-logic.js`, `core/schema-lifecycle.js`, `edition/electronics-logic.js`, `structure-binding.ts`, v.v.). Nếu Piece 1 FAIL, dừng lại và báo PM — đừng tự vá.
- Không sửa `.ai/skills.lock.json` — xem mục 6 của "Bối cảnh". Không tự chạy một vòng dry-run AT-S03 mới cho Nemotron 3 Ultra để "tự chứng minh" — đây là quyết định PM.
- Không thêm test thứ hai cho cú pháp-JSON-hỏng-không-parse-được của `electronics-logic` — phạm vi đó đã là generic/framework-level, đã được chứng minh qua `trueorfalse` ở `malformed-idevice-json.spec.ts`; thêm bản sao cho từng iDevice là dư thừa ngoài yêu cầu.
- Không hợp nhất 3 audit "secret scan" độc lập (I02/I03/Q01) thành một hàm dùng chung — I03 đã cân nhắc và từ chối việc này cho 2 trong 3 nơi, giữ nguyên quyết định đó, không tự mở rộng sang nơi thứ 3.
- Không chạy `make` (không có trên máy Windows/Git Bash này) — dùng `bun`/`bunx`/`npx`/`pwsh` trực tiếp như liệt kê dưới.
- Không dùng `waitForTimeout()`; không `.skip`/`.todo`; không đưa secret/token thật vào test.
- Không tự tuyên bố gate nào đóng (không có `G-Q0`). Không tự gắn nhãn "Solo Logic Alpha" — quyết định đó thuộc PM sau khi cân nhắc khoảng trống AT-S03 ở mục 6.
- Không bắt đầu Q03 — Q02 dừng sau `ACCEPTANCE`.

## `ACCEPTANCE` (quan sát được)

1. Test mới (Piece 1): `bunx playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` → toàn bộ 9 test (8 cũ + 1 mới) pass. Test mới xác nhận: không `pageerror`, preview hiển thị `.electronics-logic-runtime--invalid` với thông báo tiếng Việt đúng nguyên văn.
2. Regression E2E có mục tiêu: `bunx playwright test --project=chromium test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts test/e2e/playwright/specs/malformed-idevice-json.spec.ts test/e2e/playwright/specs/idevice-json-save-validation.spec.ts` → toàn bộ pass, không lệch so với trạng thái đã CONFIRMED ngày 2026-08-19.
3. Regression unit: `bun run test:unit` → **8013 pass trở lên** (thêm test mới không đổi số backend vì test mới là Playwright/E2E, không phải bun test — nếu số khác 8013, giải thích rõ), 0 fail.
4. Regression frontend: `bun run test:frontend` → 0 fail, không lệch baseline đã biết.
5. Regression integration: `bun run test:integration` → 0 fail, bao gồm toàn bộ file của I01-I03.
6. AT-S02: `pwsh -File tools/ai/sync-project-skills.ps1 -Check` (hoặc `powershell -File ...` nếu `pwsh` không có trên máy) → xác nhận PASS (parity `.agents/skills` ↔ `.claude/skills`). Nếu binary PowerShell nào cũng không có, ghi rõ trong báo cáo và dùng so sánh thủ công (diff cây thư mục + hash) làm bằng chứng thay thế.
7. AT-S01: đọc `.ai/skills.lock.json`, xác nhận whitelist/hash/exclusions/license status vẫn nhất quán nội bộ (không cần chạy lệnh, chỉ cần đối chiếu bằng mắt và báo cáo PASS/FAIL kèm lý do).
8. AT-S03: **không chạy dry-run mới**. Báo cáo hoàn thành phải nêu rõ nguyên văn khoảng trống ở mục 6 của "Bối cảnh" — coi đây là một phát hiện cần PM quyết định, không phải lỗi cần Q02 tự sửa.
9. Lint: `bunx @biomejs/biome check test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` → sạch.
10. Bảng đối chiếu AT-ID → file/dòng test → PASS/FAIL cho đủ AT-01…AT-10 (dùng mục 2 của "Bối cảnh" làm khung, xác nhận lại bằng lần chạy thật hôm nay, không chỉ chép lại từ packet này) phải có trong báo cáo hoàn thành.
11. Bằng chứng Red-Green thật cho Piece 1: RED (test mới fail đúng lý do — trước khi thêm test, hoặc chạy tạm với selector sai để xác nhận nó thật sự kiểm tra đúng thứ) → GREEN (sau khi đúng, pass).

## `TEST BẮT BUỘC`

```bash
# E2E — test mới + toàn bộ regression file electronics-logic
bunx playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts

# E2E — regression có mục tiêu: course demo (AT-05/06/07/09) + malformed JSON generic + idevice JSON save validation
bunx playwright test --project=chromium test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts test/e2e/playwright/specs/malformed-idevice-json.spec.ts test/e2e/playwright/specs/idevice-json-save-validation.spec.ts

# Regression — backend unit (mốc so sánh: 8013 pass / 0 fail / 113544 expect() / 220 file)
bun run test:unit

# Regression — frontend unit
bun run test:frontend

# Regression — integration (bao gồm I01-I03: offline, media, secret audit)
bun run test:integration

# AT-S02 — skill parity
pwsh -File tools/ai/sync-project-skills.ps1 -Check

# Lint
bunx @biomejs/biome check test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
```

**Ghi chú `make`:** Windows/Git Bash không có `make` — dùng `bun`/`bunx`/`npx`/`pwsh` trực tiếp như trên.

**Ghi chú phạm vi E2E:** không yêu cầu chạy toàn bộ `bunx playwright test` (mọi spec) trong Q02 — trạng thái xanh toàn bộ suite đã được PM/Tester xác nhận độc lập ngày 2026-08-19 ngay trước Q02 (`repo-map.md`). Nếu bất kỳ lệnh nào ở trên phát hiện regression, mở rộng phạm vi chạy ngay lập tức và báo cáo rõ, không thu hẹp lại để né việc giải thích.

## `ĐẦU RA`

- **Bắt buộc dán CẢ HAI loại bằng chứng git — thiếu một trong hai coi như chưa đạt `ĐẦU RA`:**
  1. Pathspec giới hạn đúng 1 file:
     ```bash
     git status -- test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
     git diff --stat -- test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
     ```
  2. **`git status --porcelain` đầy đủ, không pathspec** — dán nguyên văn. PM sẽ đối chiếu với baseline đã biết từ Q01; bất kỳ dòng nào ngoài baseline đó + file mới đều phải được giải thích.
- Dán output RED rồi GREEN cho test mới (Piece 1).
- Dán output đầy đủ cho cả 7 lệnh ở `TEST BẮT BUỘC`.
- Dán bảng đối chiếu AT-ID → file/dòng test → PASS/FAIL (AT-01…AT-10) và trạng thái AT-S01/AT-S02/AT-S03 (bao gồm nguyên văn khoảng trống AT-S03 ở mục 6).
- Trạng thái: Q02 **không đóng gate nào** (không có `G-Q0`) — chỉ là bằng chứng Q02 hoàn thành, một bước tiến tới `G-R0` (Release). Q02 hoàn thành **mở khóa phụ thuộc cho Q03** — không tự bắt đầu Q03 dù `ACCEPTANCE` đã xanh. Dừng lại, chờ PM/tester xác minh độc lập.
