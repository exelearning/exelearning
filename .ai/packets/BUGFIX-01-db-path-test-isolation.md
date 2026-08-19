TASK: BUGFIX-01 — Cô lập DB_PATH cho `bun test` trên native Windows
SPEC: Không có SPEC.md requirement ID — đây là lỗi hạ tầng repo có sẵn (không phải yêu cầu Electronics Logic). Gắn với
PLAN.md Risk R4 và ngân sách dự phòng cuối tuần (PLAN.md dòng 241: "Cuối tuần chỉ dùng làm dự phòng cho blocker
gate, tối đa 10 giờ"). KHÔNG chặn Gate G-P0 chính thức (xem "Bối cảnh" — G-P0 được đánh giá qua Docker, nơi lỗi này
không kích hoạt); mục tiêu thật của packet là làm sạch tín hiệu verify native-Windows cho toàn bộ PM/tester workflow
đang dùng từ K02 trở đi.
SKILLS: exelearning-logic-alpha, systematic-debugging; test-driven-development sau khi root cause được xác nhận.

## MỤC TIÊU

Trên native Windows (Git Bash, không Docker), `bun test ./src ./test/helpers ./scripts ./app --coverage` chạy
không còn lỗi liên quan đến `DB_PATH`/`/mnt/`. Hiện tại 39 test thất bại cùng một nguyên nhân
(`src/routes/config.spec.ts` ×3, `src/routes/games.spec.ts` ×19, 8 file `src/routes/api/v1/*.spec.ts` ×17) vì
`process.env.DB_PATH` nhận giá trị `/mnt/data/exelearning.db` từ `.env` thay vì `:memory:` từ `bunfig.toml`'s
`[test].env`.

## Bối cảnh đã xác minh (không phải giả thuyết)

- `.env` và `.env.dist` đặt `DB_PATH=/mnt/data/exelearning.db` — mặc định Docker/prod hợp lệ theo AGENTS.md §8.
  **KHÔNG được sửa dòng này.**
- `bunfig.toml` có `[test] env = { DB_PATH = ":memory:", ELYSIA_FILES_DIR = "/tmp/exelearning-test" }` — ý định rõ
  ràng là ghi đè cho toàn bộ `bun test`.
- **Xác nhận thực nghiệm độc lập hôm nay (2026-08-13):** một spec tối giản, cô lập
  (`test('print DB_PATH', () => console.log(process.env.DB_PATH))`) chạy qua `bun test` từ project root in ra
  `"/mnt/data/exelearning.db"` — tức `.env` đang thắng `bunfig.toml`'s `[test].env` trên máy này (Bun 1.3.14,
  Windows 11). Đây là hành vi resolution có thể tái lập, không phải lỗi cấu hình một lần.
- `getDbConfig()` (`src/db/dialect.ts:139`, `sqlitePath: process.env.DB_PATH || 'data/exelearning.db'`) đọc
  `process.env.DB_PATH` tại thời điểm `getDb()` được gọi lần đầu (lazy singleton, `src/db/client.ts:25-34`) — không
  phải vấn đề cache sai hay thứ tự import trong code dự án.
- Guard tại `src/db/dialect.ts:217` (`fullPath.startsWith('/mnt/') && deps.platform !== 'linux'`) ném lỗi khi path
  bắt đầu bằng `/mnt/` trên non-Linux. Guard này có từ trước (2026-02-05, PR #1200), không liên quan Solo Logic
  Alpha. **KHÔNG được làm yếu hoặc xoá.**
- Bằng chứng gián tiếp có sẵn trong repo: `src/routes/themes.spec.ts` (dòng 192-431) và `src/db/client.spec.ts`
  (dòng 30-234) đã tự thêm pattern lưu/khôi phục thủ công
  (`const originalPath = process.env.DB_PATH; process.env.DB_PATH = ':memory:'; ...; process.env.DB_PATH = originalPath;`)
  quanh từng test riêng lẻ — nghĩa là các tác giả trước đó đã từng chạm lỗi này và tự vá cục bộ thay vì sửa tại
  nguồn.
- Vì mọi bằng chứng G-P0 trước đây đều chạy trong Docker (nơi `/mnt/` hợp lệ nên guard không bao giờ kích hoạt, dù
  DB_PATH có thể vẫn resolve sai theo cùng cơ chế), lỗi này KHÔNG nằm trong 3 hạng mục chặn G-P0 đã ghi nhận
  (coverage/Chromium/1ms flake) — đây là lỗi cô lập môi trường test riêng cho native Windows.
- **Chưa xác nhận:** cơ chế chính xác vì sao `.env` thắng `bunfig.toml`'s `[test].env` (ví dụ: Bun có thể tự động
  nạp `.env` vào `process.env` trước khi áp dụng `[test].env`, và có thể không ghi đè biến đã tồn tại — đây là suy
  đoán hợp lý dựa trên quan sát, không phải bằng chứng đã đọc từ tài liệu Bun chính thức). Xác nhận cơ chế thật là
  bước đầu tiên bắt buộc của `systematic-debugging` trước khi chọn cách sửa.

## FILE ĐƯỢC SỬA

Chỉ những file cần thiết để đảm bảo `bun test` luôn thấy `DB_PATH=":memory:"` bất kể `.env` — phạm vi dự kiến
`bunfig.toml` và/hoặc một cơ chế nạp env test tập trung mới. Nếu root cause yêu cầu chạm file khác ngoài dự kiến,
dừng và ghi lại lý do trước khi mở rộng.

## KHÔNG LÀM

- Không xoá hoặc đổi `DB_PATH` trong `.env`/`.env.dist` — giá trị Docker/prod đúng theo thiết kế.
- Không làm yếu/xoá guard `/mnt/` trên non-Linux trong `src/db/dialect.ts` — bảo vệ an toàn có chủ đích, không liên
  quan bug này.
- Không nhân rộng pattern lưu/khôi phục `process.env.DB_PATH` thủ công sang thêm file `*.spec.ts` — sửa tại nguồn,
  không thêm workaround cục bộ thứ ba/tư.
- Không đổi hành vi `getDb()`/`getDbConfig()` cho môi trường không phải test (dev/prod/Docker).
- Không mở rộng sang BUGFIX-02 (34-failure Chromium blocker) — hai packet độc lập.
- Không đánh dấu bất kỳ test nào trong 39 test đang fail là `.skip`/`.todo` để "xanh hoá" nhanh.

## ACCEPTANCE

`bun test ./src ./test/helpers ./scripts ./app --coverage` trên native Windows Git Bash trả về 0 lỗi liên quan đến
`/mnt/` hoặc `DB_PATH`; tổng số test pass tăng từ 7830 lên tối thiểu 7869 (39 test hiện fail phải pass); không test
nào khác trong 220 file bị hồi quy.

## TEST BẮT BUỘC

- Trước khi sửa (bằng chứng Red): `bun test src/routes/config.spec.ts -t "should return application settings"` →
  tái lập lỗi hiện tại.
- Sau khi sửa: `bun test ./src ./test/helpers ./scripts ./app --coverage` → toàn bộ pass, 0 fail liên quan DB_PATH.
- `bun test src/routes/config.spec.ts src/routes/games.spec.ts` → pass.
- `bun test src/routes/api/v1` (toàn bộ 8 file) → pass.
- `bun x biome check` (thay thế `make fix` đã thiết lập từ K02, vì `make` không có trên native Windows Git Bash) trên
  file đã sửa → exit 0.

## ĐẦU RA

Diff, output thực tế của toàn bộ lệnh test bắt buộc (Red trước, Green sau), xác nhận cơ chế root cause chính xác
(không chỉ mô tả triệu chứng), và rủi ro còn lại nếu có.
