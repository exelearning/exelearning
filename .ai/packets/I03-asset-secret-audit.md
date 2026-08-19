# Task Packet — I03: Asset/secret audit

- `TASK`: I03 — Asset/secret audit (nguồn: `PLAN.md` dòng 176, cụm "I — Integration", 1 giờ, phụ thuộc I02). I02 (HTML runtime offline) đã đóng xanh và được PM xác minh độc lập. I03 là task **cuối cùng** của cụm I (I01 → I02 → I03). Bảng cổng Go/No-Go (`PLAN.md` dòng 80-94) không có `G-I0` — I03 **không tự đóng gate nào**, chỉ là bước tiến tới `G-R0` (Release). Nhưng I03 **mở khóa phụ thuộc cho Q01** (`PLAN.md` dòng 182: `Q01 | 3 | I03 | Course E2E`) — không tự bắt đầu Q01.
- **Lưu ý minh bạch về ước tính giờ:** `PLAN.md` ghi I03 = 1 giờ. Phạm vi thật (1 production fix + 3 file test, xem dưới) khả năng vượt ước tính này, vì cả bốn phần đều bắt buộc theo đúng chữ DoD của chính I03 trong `PLAN.md`: *"Text/ảnh/MP4 chạy; không request mạng/path tuyệt đối/secret/thư mục AI trong export."* Đây không phải scope creep tự thêm — đã đối chiếu từng phần với DoD và SPEC bên dưới.
- `SPEC`: PLAT-07 (`SPEC.md` dòng 210, "Text, ảnh và MP4 course mẫu hiển thị khi ngắt mạng"), EXP-01 (dòng 271, "HTML export chứa runtime/CSS/asset bằng đường dẫn tương đối"), EXP-03 (dòng 273, "Export không chứa `.agents`, `.claude`, `.ai`, token, path tuyệt đối hoặc stack trace"), SKILL-11 (dòng 127, "Skill không xuất hiện trong HTML/SCORM, không chứa token, khóa API hoặc đường dẫn tuyệt đối máy phát triển"), NFR-04 (dòng 368, "Hành trình offline P0 không tạo request Internet"), AT-03 (dòng 392, "Text, ảnh, MP4 và iDevice hiển thị khi ngắt mạng"), AT-09 (dòng 398, "Hoàn thành AT-05…AT-07 không mạng; không đóng gói thư mục AI" — I03 chỉ chịu trách nhiệm nửa sau, "không đóng gói thư mục AI"; nửa đầu AT-05…AT-07 đã được I02 chứng minh xong). EXP-02 và PLAT-03/05 **không** thuộc I03 (đã là phạm vi I01/I02) — không tự mở rộng.
- `SKILLS`: `exelearning-logic-alpha` (phạm vi P0, không gate riêng cho I03), `test-driven-development` (Red-Green thật cho fix + test mới), `systematic-debugging` (nếu `ACCEPTANCE` fail, xác định root cause trước khi sửa), `e2e-test` (không áp dụng trực tiếp — I03 không thêm Playwright spec, nhưng nguyên tắc "deterministic, không waitForTimeout" vẫn áp dụng cho các test mới).
- `MUC TIEU`: Chứng minh bằng test thật rằng: (a) đường export CLI/server-side không đóng gói file/thư mục bắt đầu bằng dấu chấm (production fix + regression, EXP-03/SKILL-11/AGENTS.md §9); (b) **toàn bộ** nội dung ZIP export (không chỉ 4 entry iDevice như I02 đã làm) không chứa thư mục AI, token, path tuyệt đối, stack trace (EXP-03 mở rộng toàn tài liệu); (c) ảnh và video mẫu được đóng gói vào export với byte giữ nguyên, độc lập với việc HTML tài liệu có tham chiếu asset hay không (PLAT-07/AT-03/EXP-01). Không thêm iDevice/tính năng mới. Không tạo hàm dùng chung giữa 3 nơi có logic lọc dot-file (lý do ở mục 3 dưới).
- `ĐẦU RA`: 1 production fix (3 dòng) + 3 thay đổi file test (2 sửa, 1 thêm) chứng minh ba điều trên, kèm bằng chứng Red-Green, coverage patch cho 3 dòng fix, và diff phạm vi đúng 4 file. Nếu `ACCEPTANCE` đạt và được PM/tester xác minh độc lập, đây là bằng chứng **I03 hoàn thành** — không đóng gate nào, nhưng mở khóa Q01.

## Bối cảnh đã xác minh (đọc code thật trước khi viết packet này, không suy diễn)

### 1. Khoảng trống thật đã xác nhận: đường CLI/server-side export KHÔNG lọc file/thư mục dot-prefix

- `FileSystemResourceProvider.ts` dòng 315-341 (`readDirectoryRecursive`, hàm dùng chung, `private`):
  ```typescript
  private async readDirectoryRecursive(dirPath: string, prefix: string): Promise<Map<string, Buffer>> {
      const files = new Map<string, Buffer>();
      if (!(await fs.pathExists(dirPath))) { return files; }
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
              const subFiles = await this.readDirectoryRecursive(fullPath, entryPath);
              for (const [subPath, content] of subFiles) { files.set(subPath, content); }
          } else if (entry.isFile()) {
              const content = await fs.readFile(fullPath);
              files.set(entryPath, content);
          }
      }
      return files;
  }
  ```
  **Zero filter dot-prefix** — đã đọc toàn bộ 461 dòng file, không có bất kỳ điều kiện nào loại trừ tên bắt đầu bằng `.` trong hàm này.
- Hàm này được dùng chung bởi: `fetchTheme()` (dòng 54-87), `fetchIdeviceResources()` (dòng 94-113 — chỉ lọc `.test.js`/`.spec.js` ở tầng gọi, không lọc dot-prefix), `fetchLibraryFiles()` (dòng 173-268, nhánh directory-pattern), `fetchGlobalFontFiles()` (dòng 383-409). Sửa 1 chỗ (`readDirectoryRecursive`) sửa hết cả 4 caller — đúng tinh thần "single source of truth".
- Đường này được dùng bởi **CLI** (`make export-*`) và **REST API v1 bên ngoài** (`src/routes/api/v1/**`) — không phải đường browser chính (xem mục 2).

### 2. Hai đường browser export ĐÃ được bảo vệ sẵn (thu hẹp phạm vi so với giả định ban đầu)

- `scripts/build-resource-bundles.js` dòng 99-101 (`scanDirectory`, dùng để build `bundles/idevices.zip` cho static/embedded export):
  ```javascript
  for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      ...
  ```
  **Đã lọc dot-prefix từ trước.**
- `src/routes/resources.ts` dòng 99 (`scanDirectory` riêng của route, dùng cho fallback `/api/resources/idevice/:type` khi bundle prebuilt không có sẵn): `if (entry.name.startsWith('.')) continue;` — comment nguyên văn "Skip hidden files and directories". **Đã lọc dot-prefix từ trước.**
- `BrowserResourceProvider.ts` (259 dòng, đọc toàn bộ) chỉ là adapter mỏng gọi `ResourceFetcherInterface.fetchIdevice()`/`fetchIdeviceStatic()` (client-side `ResourceFetcher.js`, 1778 dòng, đọc toàn bộ) — cả hai nhánh (bundle prebuilt và fallback listing) đều đi qua 1 trong 2 đường đã lọc ở trên. Không có logic dot-filter riêng nào khác trong `BrowserResourceProvider.ts`.
- **Kết luận đã xác minh:** khoảng trống dot-prefix **chỉ tồn tại ở đường CLI/server-side `FileSystemResourceProvider`**, không tồn tại ở đường browser chính (authoring/export tương tác — đường người dùng thật dùng hàng ngày). Đây là phạm vi hẹp hơn giả định ban đầu — không phóng đại mức độ nghiêm trọng khi báo cáo.

### 3. Sửa production: mirror đúng pattern đã có sẵn trong repo, không phát minh mới

- Thêm đúng 3 dòng vào đầu vòng `for` của `readDirectoryRecursive`, mirror chính xác pattern đã dùng ở `build-resource-bundles.js` dòng 99 và comment style ở `resources.ts` dòng 99:
  ```typescript
  for (const entry of entries) {
      // Skip hidden files and directories
      if (entry.name.startsWith('.')) {
          continue;
      }
      const fullPath = path.join(dirPath, entry.name);
      ...
  ```
- **Đã cân nhắc và từ chối** trích xuất 1 hàm dùng chung cho cả 3 nơi (`build-resource-bundles.js`, `resources.ts`, `FileSystemResourceProvider.ts`) có cùng logic 1 dòng này: ba file sống ở ba tầng runtime khác nhau (build script Node độc lập / Elysia route handler / `src/shared/export` provider dùng chung server+browser-bundle) — ép chúng cùng import 1 util chỉ để dedupe một biểu thức 1 dòng (`name.startsWith('.')`) tạo coupling không tương xứng giữa tầng build-tool và tầng runtime. Đây là phán đoán có chủ đích, không phải bỏ sót — nếu không đồng ý, DỪNG và hỏi PM trước khi tự refactor khác đi.

### 4. Asset packaging là filesystem-driven, không phụ thuộc HTML tài liệu — đã xác minh toàn bộ chuỗi

- `FileSystemAssetProvider.ts` (507 dòng, đọc toàn bộ). Constructor `(basePath: string)` (dòng 36-39). `getAllAssets()`/`forEachAsset()`/`listAssetMetadata()` quét `content/resources/` (dòng 142-145), rồi 4 thư mục legacy `resources`/`images`/`media`/`files` (dòng 148-154), rồi **file ở cấp root theo whitelist đuôi file** (dòng 166-218, `collectRootAssets`) — whitelist gồm `.jpg/.jpeg/.png/.gif/.webp/.svg/.bmp/.ico/.mp3/.wav/.ogg/.aac/.flac/.m4a/.mp4/.webm/.ogv/.avi/.mov/.pdf/.doc(x)/.xls(x)/.ppt(x)/.zip/.rar/.7z` (dòng 174-204) — **`.mp4` và `.webm` được xử lý hoàn toàn giống nhau, không có nhánh code riêng cho từng định dạng.**
- Với file root-level không nằm trong `content/resources/`, `extractFolderPath()` (dòng 104-123) trả `folderPath = ''` → `asset.id = filename` (dòng 76-77).
- `BaseExporter.ts` dòng 772-850 (`buildAssetExportPathMap`): với `folderPath = ''`, `basePath = filename` (dòng 824) → không trùng tên (lần đầu) → `finalPath = filename` (dòng 827-839) → `assetExportPathMap.set(asset.id, filename)`.
- `BaseExporter.ts` dòng 521-553 (`addAssetsToZipWithResourcePath`): `zipPath = \`content/resources/${exportPath}\`` (dòng 535) → gọi `writeAssetToZip()`.
- `BaseExporter.ts` dòng 699-707 (`writeAssetToZip`) → `resolveAssetExportData()` (dòng 657-685): dòng 662-663 — **`if (!isSrtSubtitleAsset(...)) { return asset.data; }`** — trả nguyên bytes không biến đổi cho mọi asset không phải phụ đề `.srt`. Ảnh/video **không** qua bất kỳ transform nào → **byte giữ nguyên 100% khi vào ZIP.**
- `Html5Exporter.ts` dòng 357 gọi `addAssetsToZipWithResourcePath(fileList)` như một phần chuẩn của `export()` — đã grep xác nhận đây là lời gọi thật trong flow chính, không phải method rời phải tự gọi tay.
- **Kết luận:** với 1 file ảnh/video thật đặt ở root của `basePath` truyền vào `FileSystemAssetProvider`, đường ZIP cuối cùng là **`content/resources/{tên file gốc}`**, nội dung byte-identical. Đã lần theo toàn bộ chuỗi 4 file, không đoán.

### 5. Fixture thật đã có sẵn — không fabricate; quyết định về "MP4" trong PLAT-07

- `test/fixtures/sample-2.jpg` (35.047 B), `sample-3.jpg` (14.106 B), `sample-video-480-900kb.webm` (901.185 B) — đã tự chạy `ls -la` xác nhận kích thước chính xác.
- **Không có file `.mp4` nào trong toàn bộ repo** (đã xác nhận trước đó và lặp lại bằng grep trong `test/fixtures/`).
- **Quyết định khóa:** dùng `sample-video-480-900kb.webm` thật làm bằng chứng cho phần "video" của PLAT-07/AT-03. Lý do (xem mục 4): whitelist đuôi file trong `FileSystemAssetProvider` xử lý `.mp4`/`.webm` **giống hệt nhau, không có code riêng cho từng định dạng** — chứng minh cơ chế đóng gói đúng cho `.webm` tức là chứng minh đúng cho `.mp4` cùng cơ chế đó. **Không được tạo file `.mp4` giả/rỗng chỉ để khớp tên đuôi** — file rác không phát được sẽ tự nó vi phạm triết lý "No workarounds" của dự án. Nếu sau này có file `.mp4` thật để bổ sung, đó là việc làm thêm ngoài `ACCEPTANCE` của I03.
- **Cạm bẫy đã phát hiện và tránh:** `test/fixtures/` còn chứa `sample-1.pdf`, `sample-4.jpg`, `sample-audio.wav` và **7 file `.zip`** (`aaa_web.zip`, `anchors.zip`, `download-elpx-link.zip`, `example-theme.zip`, `test-theme-collab.zip`, `test-theme-with-icons.zip`, `test-theme.zip`) — tất cả đều khớp whitelist đuôi file ở mục 4. Nếu trỏ `FileSystemAssetProvider` thẳng vào `test/fixtures/` làm `basePath`, nó sẽ quét luôn cả 10 file này (~2,5 MB dữ liệu không liên quan), làm test chậm và mong manh trước thay đổi tương lai của thư mục fixture dùng chung. **Thiết kế khóa (mục Piece 4 dưới) dùng thư mục tạm riêng, chỉ copy đúng 3 file cần** — không trỏ thẳng vào `test/fixtures/`.

### 6. Vị trí chèn chính xác trong 2 file test hiện có (để không vỡ cấu trúc)

- `src/shared/export/providers/FileSystemResourceProvider.spec.ts` (656 dòng, có ≥15 `describe` lồng nhau dùng chung 1 `beforeEach`/`testDir` (dòng 15-69) với hàng chục assert `.size` chính xác). **KHÔNG** thêm vào `beforeEach` chung này — rủi ro vỡ nhiều assert không liên quan. Thêm 1 `describe` **hoàn toàn tự chứa** (temp dir riêng, tự tạo/tự xóa) vào **cuối file**, sau describe cuối cùng hiện có.
- `test/integration/html5-export-fixture.spec.ts` (554 dòng). `describe('HTML5 Export Fixture Comparison', ...)` mở ở dòng 44, khai báo `exportedZip` (dòng 47), điền trong `beforeAll` (51-102) từ fixture thật `test/fixtures/old_el_cid.elp`. Describe con cuối cùng `Subpage Structure` đóng ở dòng 508; describe cha đóng ở dòng 509. Một `describe('HTML Structure Comparison with Reference', ...)` khác, **không liên quan**, bắt đầu ở dòng 511 (sibling, không lồng). **Phải chèn describe mới của I03 giữa dòng 508 và 509** (bên trong describe cha, để dùng lại `exportedZip` có sẵn) — chèn ở cuối file sẽ rơi ra ngoài scope biến `exportedZip` và gây lỗi biên dịch.

### 7. Ghi chú hoãn lại — đã được I02 hẹn trước, KHÔNG thuộc `ACCEPTANCE` của I03

- I02 packet dòng 46 đã ghi chú: `build-resource-bundles.js` đóng gói cả file `*.test.js`/`*.spec.js` vào `bundles/idevices.zip` (static bundle) mà không lọc — nghiên cứu trước đó xác nhận có 44 file `*.test.js` thật trong bundle này, không chứa secret. Đây là phát hiện **khác** với khoảng trống dot-prefix (file `.test.js` không bắt đầu bằng dấu chấm, nên fix của I03 **không** khắc phục việc này). Ghi vào báo cáo I03 như một đề xuất follow-up cho PM cân nhắc lịch trình riêng — không phải điều kiện `ACCEPTANCE`, không tự sửa `build-resource-bundles.js` trong I03.

## `FILE ĐƯỢC SỬA` (3 file sửa + 1 file thêm + packet)

| File | Loại thay đổi |
|---|---|
| `src/shared/export/providers/FileSystemResourceProvider.ts` | **Sửa.** Thêm bộ lọc dot-prefix vào `readDirectoryRecursive` (quanh dòng 315-341). Production fix duy nhất của I03 — đúng 3 dòng. |
| `src/shared/export/providers/FileSystemResourceProvider.spec.ts` | **Sửa (thêm ở cuối file).** Thêm 1 `describe` tự chứa (temp dir riêng) chứng minh fix trên qua `fetchIdeviceResources('text')`. |
| `test/integration/html5-export-fixture.spec.ts` | **Sửa (chèn giữa dòng 508 và 509).** Thêm 1 `describe` lồng trong describe cha hiện có, quét **toàn bộ** `exportedZip` theo EXP-03/SKILL-11 hai tầng. |
| `test/integration/html5-export-media-offline.spec.ts` | **Thêm (mới).** Integration test export thật với `FileSystemAssetProvider` trỏ vào thư mục tạm chứa 3 fixture ảnh/video thật, chứng minh đóng gói byte-identical vào `content/resources/`. |
| `.ai/packets/I03-asset-secret-audit.md` | Packet này. |

**KHÔNG sửa** bất kỳ file production nào khác (`build-resource-bundles.js`, `resources.ts`, `BrowserResourceProvider.ts`, `ResourceFetcher.js`, `BaseExporter.ts`, `Html5Exporter.ts`, `FileSystemAssetProvider.ts`) trừ khi một test trong `ACCEPTANCE` thực sự fail và chỉ rõ lỗi production ở đó — lúc đó dừng lại báo PM trước khi sửa.

## Thiết kế khóa (chốt trong I03 — không tự đổi tên, không tự thêm assert ngoài khóa)

**Piece 1 — production fix trong `FileSystemResourceProvider.ts`.**

Trước:
```typescript
    private async readDirectoryRecursive(dirPath: string, prefix: string): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        if (!(await fs.pathExists(dirPath))) {
            return files;
        }
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
```

Sau (chỉ thêm 3 dòng ngay đầu vòng `for`, không đổi gì khác):
```typescript
    private async readDirectoryRecursive(dirPath: string, prefix: string): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        if (!(await fs.pathExists(dirPath))) {
            return files;
        }
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            // Skip hidden files and directories
            if (entry.name.startsWith('.')) {
                continue;
            }
            const fullPath = path.join(dirPath, entry.name);
            const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
```

Phần còn lại của hàm (xử lý `isDirectory()`/`isFile()`) giữ nguyên 100%.

**Piece 2 — `FileSystemResourceProvider.spec.ts`, describe mới ở cuối file.**

```typescript
describe('dot-prefixed entry exclusion (AGENTS.md §9 / EXP-03 / SKILL-11)', () => {
    let localTestDir: string;
    let localProvider: FileSystemResourceProvider;

    beforeEach(async () => {
        localTestDir = path.join(os.tmpdir(), `exe-dotfile-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const ideviceExportDir = path.join(localTestDir, 'files', 'perm', 'idevices', 'base', 'text', 'export');
        await fs.ensureDir(ideviceExportDir);
        await fs.writeFile(path.join(ideviceExportDir, 'text.js'), 'console.log("real runtime");');
        await fs.writeFile(path.join(ideviceExportDir, 'text.css'), '.text {}');
        // Tên file/thư mục giả lập đúng những gì AGENTS.md §9 cấm xuất hiện trong output
        await fs.writeFile(path.join(ideviceExportDir, '.env'), 'SECRET_KEY=should-not-ship');
        const aiDir = path.join(ideviceExportDir, '.claude');
        await fs.ensureDir(aiDir);
        await fs.writeFile(path.join(aiDir, 'notes.md'), 'internal agent notes');

        localProvider = new FileSystemResourceProvider(localTestDir);
    });

    afterEach(async () => {
        await fs.remove(localTestDir);
    });

    it('excludes dot-prefixed files and directories from fetchIdeviceResources', async () => {
        const files = await localProvider.fetchIdeviceResources('text');
        const keys = Array.from(files.keys());

        expect(keys).toContain('text.js');
        expect(keys).toContain('text.css');
        expect(keys.some(k => k.startsWith('.'))).toBe(false);
        expect(keys.some(k => k.includes('/.'))).toBe(false);
        expect(keys.some(k => k.includes('.env'))).toBe(false);
        expect(keys.some(k => k.includes('.claude'))).toBe(false);
        expect(keys.some(k => k.includes('notes.md'))).toBe(false);
    });
});
```

- `localTestDir`/`localProvider` đặt tên khác `testDir`/`provider` (biến dùng chung ở đầu file) để tránh mọi khả năng đụng độ biến trong cùng file scope.
- Payload `.env` chứa chuỗi `SECRET_KEY=should-not-ship` là **dữ liệu giả** để chứng minh loại trừ — không phải credential thật.
- Không cần test thêm cho `fetchTheme`/`fetchLibraryFiles`/`fetchGlobalFontFiles` — cùng gọi 1 hàm `readDirectoryRecursive` đã sửa, 1 test đại diện là đủ để chứng minh fix (test tất cả 4 caller là dư thừa ngoài yêu cầu).

**Piece 3 — `html5-export-fixture.spec.ts`, chèn giữa dòng 508 và 509 (bên trong describe cha, dùng lại `exportedZip`).**

```typescript
    describe('EXP-03/SKILL-11 whole-export forbidden pattern audit', () => {
        const forbiddenPatternsAlways = [
            '.agents/',
            '.claude/',
            '.ai/',
            'sk-',
            'ghp_',
            'AIza',
            'Bearer ',
            'file://',
            'C:\\',
            '/Users/',
            '/home/',
            'stack trace',
            'at Object.',
            'at <anonymous>',
        ];
        // /api/, http://, https:// chỉ cấm ngoài trang .html — văn bản tác giả hợp lệ
        // trong nội dung bài học có thể chứa link ngoài (trích dẫn, tài liệu tham khảo).
        const forbiddenPatternsNonPageOnly = ['/api/', 'http://', 'https://'];
        const binaryEntry = /\.(png|jpe?g|gif|webp|ico|bmp|mp3|wav|ogg|mp4|webm|mov|avi|pdf|zip|woff2?|ttf|eot)$/i;

        it('keeps every packaged entry free of AI folders, secret-shaped tokens, and absolute local paths', () => {
            if (!exportedZip) return;
            const violations: string[] = [];
            let scanned = 0;
            let skippedBinary = 0;

            for (const [entryPath, bytes] of Object.entries(exportedZip)) {
                if (binaryEntry.test(entryPath)) {
                    skippedBinary++;
                    continue;
                }
                scanned++;
                const content = new TextDecoder().decode(bytes).replaceAll('http://www.w3.org/2000/svg', '');
                for (const pattern of forbiddenPatternsAlways) {
                    if (content.includes(pattern)) violations.push(`${entryPath}: "${pattern}"`);
                }
                if (!/\.html$/i.test(entryPath)) {
                    for (const pattern of forbiddenPatternsNonPageOnly) {
                        if (content.includes(pattern)) violations.push(`${entryPath}: "${pattern}"`);
                    }
                }
            }

            console.log(
                `[I03 EXP-03 audit] scanned ${scanned} text entries, skipped ${skippedBinary} binary entries, ${Object.keys(exportedZip).length} total`,
            );
            expect(violations).toEqual([]);
        });
    });
```

- `binaryEntry` **không** khớp `.svg` — SVG là text/XML thật, phải quét (kèm exemption namespace `http://www.w3.org/2000/svg` giống I02).
- Dùng mảng `violations` + `toEqual([])` thay vì message tùy chỉnh trong `expect()` — chỉ dùng API `expect`/`toEqual`/`toContain` đã xác nhận có dùng thật trong codebase, không đoán API chưa kiểm chứng.
- `if (!exportedZip) return;` giữ nguyên guard pattern đã có sẵn trong file (dòng 56-59 và mọi `it()` khác trong describe cha).

**Piece 4 — `test/integration/html5-export-media-offline.spec.ts` (file mới).**

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
    FileSystemAssetProvider,
    FileSystemResourceProvider,
    FflateZipProvider,
    Html5Exporter,
    unzipSync,
    type ExportDocument,
    type ExportMetadata,
    type ExportPage,
} from '../../src/shared/export';

class MockDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor(metadata: Partial<ExportMetadata> = {}, pages: ExportPage[] = []) {
        this.metadata = {
            title: 'Test Project',
            author: 'Test Author',
            language: 'en',
            description: 'A test project',
            license: 'CC-BY-SA',
            theme: 'base',
            ...metadata,
        };
        this.pages = pages;
    }

    getMetadata(): ExportMetadata {
        return this.metadata;
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

const samplePages: ExportPage[] = [
    {
        id: 'page-1',
        title: 'Media Page',
        parentId: null,
        order: 0,
        blocks: [
            {
                id: 'block-1',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'text',
                        order: 0,
                        content: '<p>Media asset offline packaging check</p>',
                        properties: {},
                    },
                ],
            },
        ],
    },
];

// Nguồn thật trong test/fixtures/ — KHÔNG trỏ FileSystemAssetProvider thẳng vào
// test/fixtures/ (sẽ quét thêm 7 file .zip + sample-1.pdf + sample-4.jpg +
// sample-audio.wav không liên quan, xem "Bối cảnh" mục 5). Copy đúng 3 file
// cần vào thư mục tạm riêng trước khi export.
const mediaFixtures = [
    { source: 'sample-2.jpg', zipPath: 'content/resources/sample-2.jpg' },
    { source: 'sample-3.jpg', zipPath: 'content/resources/sample-3.jpg' },
    { source: 'sample-video-480-900kb.webm', zipPath: 'content/resources/sample-video-480-900kb.webm' },
] as const;

describe('Html5Exporter image/video asset offline packaging (I03)', () => {
    let result: Awaited<ReturnType<Html5Exporter['export']>>;
    let exportedZip: Record<string, Uint8Array>;
    let assetsDir: string;
    const fixturesDir = path.join(process.cwd(), 'test/fixtures');

    beforeAll(async () => {
        assetsDir = path.join(os.tmpdir(), `exe-media-offline-${Date.now()}`);
        await fs.ensureDir(assetsDir);
        for (const { source } of mediaFixtures) {
            await fs.copyFile(path.join(fixturesDir, source), path.join(assetsDir, source));
        }

        const document = new MockDocument({}, samplePages);
        const resources = new FileSystemResourceProvider(path.join(process.cwd(), 'public'));
        const assets = new FileSystemAssetProvider(assetsDir);
        const zip = new FflateZipProvider();
        const exporter = new Html5Exporter(document, resources, assets, zip);

        result = await exporter.export();
        if (result.data) {
            exportedZip = unzipSync(result.data);
        }
    });

    afterAll(async () => {
        await fs.remove(assetsDir);
    });

    it('exports successfully with a real image/video asset directory', () => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    });

    it('packages every image/video fixture into content/resources/ with byte-identical content', async () => {
        for (const { source, zipPath } of mediaFixtures) {
            const original = await fs.readFile(path.join(fixturesDir, source));
            const packaged = exportedZip[zipPath];
            expect(packaged).toBeDefined();
            expect(Buffer.from(packaged as Uint8Array).equals(original)).toBe(true);
        }
        console.log(`[I03 media packaging] verified ${mediaFixtures.length} byte-identical entries under content/resources/`);
    });
});
```

- `type: 'text'` cho component — đã xác nhận `public/files/perm/idevices/base/text/export/` tồn tại thật (`exequextsq.svg`, `text.css`, `text.html`, `text.js`, `text.test.js`) qua `ls` trực tiếp — không phải iDevice giả định.
- Không cần asset nào được HTML tham chiếu qua `asset://` — đã xác minh toàn chuỗi ở "Bối cảnh" mục 4 rằng đóng gói asset độc lập hoàn toàn với nội dung HTML.
- Không thêm assert nào về `fetch`/network — phần "không gọi mạng" của runtime đã được I02 chứng minh; Piece 4 chỉ chứng minh asset **có mặt cục bộ** trong ZIP (điều kiện cần để hiển thị offline), không lặp lại I02.

## `KHÔNG LÀM`

- Không sửa file production nào khác ngoài đúng 3 dòng dot-filter trong `FileSystemResourceProvider.ts` — không refactor thêm, không đổi signature `readDirectoryRecursive`/`fetchIdeviceResources`/`fetchTheme`/`fetchLibraryFiles`/`fetchGlobalFontFiles`, không đổi hành vi lọc `.test.js`/`.spec.js` hiện có (dòng 104-109).
- Không tạo hàm dùng chung (shared util) cho logic dot-filter giữa `build-resource-bundles.js`/`resources.ts`/`FileSystemResourceProvider.ts` — đã cân nhắc và từ chối, xem "Bối cảnh" mục 3. Nếu thấy lý do đủ mạnh để làm khác, DỪNG và hỏi PM trước, không tự quyết.
- Không sửa `build-resource-bundles.js`/`resources.ts`/`BrowserResourceProvider.ts`/`ResourceFetcher.js` — đã xác nhận an toàn (mục 2), ngoài phạm vi I03.
- Không fabricate file `.mp4` giả — dùng nguyên `sample-video-480-900kb.webm` thật đã có; xem "Bối cảnh" mục 5.
- Không trỏ `FileSystemAssetProvider` thẳng vào `test/fixtures/` — dùng thư mục tạm riêng như đã khóa ở Piece 4.
- Không đụng `beforeEach`/`testDir` dùng chung hiện có trong `FileSystemResourceProvider.spec.ts` (dòng 15-69) và không sửa nội dung bất kỳ describe nào trong số ≥15 describe hiện có — chỉ thêm 1 describe mới, tự chứa, ở cuối file.
- Không sửa nội dung các describe hiện có trong `html5-export-fixture.spec.ts` (`HEAD Structure`/`Navigation`/`Body Structure`/`Subpage Structure`/`HTML Structure Comparison with Reference`) — chỉ chèn đúng 1 describe mới giữa dòng 508 và 509.
- Không sửa file/packet của I02 (`html5-export-electronics-logic-offline.spec.ts`, `electronics-logic-offline.test.js`, `.ai/packets/I02-html-runtime-offline.md`) hay `.ai/packets/I01-*.md`.
- Không bắt đầu Q01/Q02/Q03 — I03 dừng sau `ACCEPTANCE`.
- Không tự tuyên bố gate nào đóng (không có `G-I0`).
- Không dùng `waitForTimeout()`; không `.skip`/`.todo`; không chạy `make` (không có trên máy Windows/Git Bash này).
- Không đưa secret/token thật vào test — payload `.env` ở Piece 2 là dữ liệu giả để chứng minh loại trừ, không phải credential thật.
- Không tự sửa `build-resource-bundles.js` để lọc file `*.test.js` khỏi bundle static — đây là ghi chú follow-up cho PM (mục 7), không phải việc của I03.

## `ACCEPTANCE` (quan sát được)

1. Unit test: `bun test src/shared/export/providers/FileSystemResourceProvider.spec.ts` → toàn bộ pass, bao gồm describe mới chứng minh `fetchIdeviceResources('text')` loại bỏ `.env` và `.claude/notes.md` nhưng giữ `text.js`/`text.css` (production fix + EXP-03/SKILL-11/AGENTS.md §9).
2. Integration test: `bun test test/integration/html5-export-fixture.spec.ts` → toàn bộ pass, bao gồm describe mới quét **mọi** entry trong `exportedZip` (không chỉ 4 entry iDevice như I02) không chứa `.agents/`/`.claude/`/`.ai/`/token/`file://`/path tuyệt đối/stack trace, và không chứa `/api/`/`http://`/`https://` ngoài các trang `.html` (EXP-03 mở rộng toàn tài liệu).
3. Integration test mới: `bun test test/integration/html5-export-media-offline.spec.ts` → pass, chứng minh `sample-2.jpg`/`sample-3.jpg`/`sample-video-480-900kb.webm` được đóng gói vào `content/resources/` với nội dung byte-identical so với file nguồn (PLAT-07/AT-03/EXP-01).
4. Regression: `bun test ./src/shared/export` → không lệch baseline (fix chỉ thêm điều kiện `continue`, không đổi hành vi với entry không-dot hiện có).
5. Regression: `bun test test/integration` → toàn bộ pass, bao gồm file I02 (`html5-export-electronics-logic-offline.spec.ts`) không đổi nội dung và vẫn pass.
6. Coverage: `bun test ./src ./test/helpers ./scripts ./app --coverage` → 3 dòng mới trong `FileSystemResourceProvider.ts` phải hiện là đã covered (patch coverage ≥ 90% theo AGENTS.md §5.3) — dán số coverage riêng của file này trong báo cáo, không chỉ % tổng.
7. Bằng chứng Red-Green thật phải được dán trong báo cáo cho cả 3 file test mới/sửa: RED (chạy trước khi có thay đổi hoặc trước khi fix — fail đúng lý do dot-prefix chưa bị lọc / entry EXP-03 chưa được quét toàn bộ / file media chưa tồn tại) → GREEN (sau khi sửa đúng, pass).

## `TEST BẮT BUỘC`

```bash
# Unit — regression + test mới (dot-prefix exclusion)
bun test src/shared/export/providers/FileSystemResourceProvider.spec.ts

# Integration — regression + audit EXP-03 mở rộng toàn ZIP
bun test test/integration/html5-export-fixture.spec.ts

# Integration — test mới (asset ảnh/video)
bun test test/integration/html5-export-media-offline.spec.ts

# Regression export — spec hiện có vẫn xanh
bun test ./src/shared/export

# Regression integration — toàn thư mục, bao gồm file I02 không đổi
bun test test/integration

# Coverage — patch coverage cho 3 dòng production fix
bun test ./src ./test/helpers ./scripts ./app --coverage

# Lint
bunx @biomejs/biome check src/shared/export/providers/FileSystemResourceProvider.ts src/shared/export/providers/FileSystemResourceProvider.spec.ts test/integration/html5-export-fixture.spec.ts test/integration/html5-export-media-offline.spec.ts
```

**Ghi chú `make`:** Windows/Git Bash không có `make` (lặp lại từ E01-I02) — dùng `bun`/`bunx`/`npx`.

**Ghi chú coverage:** khác I02 (chỉ thêm test), I03 có 3 dòng production code mới — coverage patch cho đúng 3 dòng đó là điều kiện bắt buộc, không chỉ chạy test cho có.

## `ĐẦU RA`

- **Bắt buộc dán CẢ HAI loại bằng chứng git — thiếu một trong hai coi như chưa đạt `ĐẦU RA`:**
  1. Pathspec giới hạn đúng 4 file (bằng chứng diff sạch, không lẫn các file `M`/untracked có sẵn từ trước):
     ```bash
     git status -- src/shared/export/providers/FileSystemResourceProvider.ts src/shared/export/providers/FileSystemResourceProvider.spec.ts test/integration/html5-export-fixture.spec.ts test/integration/html5-export-media-offline.spec.ts
     git diff --stat -- src/shared/export/providers/FileSystemResourceProvider.ts src/shared/export/providers/FileSystemResourceProvider.spec.ts test/integration/html5-export-fixture.spec.ts test/integration/html5-export-media-offline.spec.ts
     ```
  2. **`git status --porcelain` đầy đủ, không pathspec** — dán nguyên văn, không rút gọn. Mục đích: lộ ra bất kỳ file nào khác ngoài 4 file trên. PM sẽ đối chiếu với baseline đã biết từ I01/I02; bất kỳ dòng nào ngoài baseline đó + 4 file mới đều phải được giải thích trong báo cáo, không được bỏ qua.
- Dán output RED rồi GREEN cho cả 3 file test mới/sửa (bằng chứng Red-Green thật, không chỉ báo cáo bằng lời).
- Dán output đầy đủ (pass/fail, số ca) cho cả 7 lệnh ở `TEST BẮT BUỘC` — đặc biệt: số entry đã quét/bỏ qua trong log `[I03 EXP-03 audit]`, và số coverage riêng của `FileSystemResourceProvider.ts` từ lệnh coverage.
- Trạng thái: I03 **không đóng gate nào** (không có `G-I0`) — chỉ là bằng chứng I03 hoàn thành, một bước tiến tới `G-R0` (Release). I03 hoàn thành đồng nghĩa cụm I (I01→I02→I03) đã xong và **mở khóa phụ thuộc cho Q01** — không tự bắt đầu Q01 dù `ACCEPTANCE` đã xanh. Dừng lại, chờ PM/tester xác minh độc lập.
