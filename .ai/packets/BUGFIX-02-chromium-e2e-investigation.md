TASK: BUGFIX-02 — Điều tra root cause 34 lỗi Chromium E2E chặn Gate G-P0
SPEC: Không có SPEC.md requirement ID — lỗi/regression có sẵn trong luồng asset/file-manager/theme/media, không
thuộc Electronics Logic. Đây là hạng mục bằng chứng chặn Gate G-P0 **duy nhất còn mở** (coverage đã sửa 2026-08-13;
1ms Vitest flake không tái lập trong lần chạy sạch gần nhất) và PLAN.md Risk R4. Ngân sách đề xuất: dự phòng cuối
tuần tối đa 10 giờ (PLAN.md dòng 241) — packet này có thể vượt phần lớn ngân sách đó chỉ để điều tra, xem "Ngân sách"
bên dưới.
SKILLS: exelearning-logic-alpha, systematic-debugging (bắt buộc dừng ở root cause trước khi sửa bất kỳ dòng code sản
phẩm nào); test-driven-development chỉ áp dụng sau khi root cause được xác nhận và một fix cụ thể được thiết kế.

## MỤC TIÊU (giai đoạn điều tra)

Tái lập đầy đủ danh sách 34 test Chromium thất bại (hiện chỉ có tổng số `494 passed / 34 failed / 7 skipped` và một
tên đại diện `should upload file to folder` — chưa có danh sách đầy đủ tên/lỗi trong bất kỳ tài liệu nào của dự án),
phân cụm theo nguyên nhân, và xác định root cause của tối thiểu cụm lớn nhất. **Đây là packet điều tra, không phải
packet sửa lỗi** — chỉ mở rộng sang sửa code khi root cause của một cụm cụ thể đã được xác nhận bằng bằng chứng tái
lập.

## Bối cảnh đã xác minh

- Bằng chứng gốc (2026-08-12, Docker, `oven/bun:1.3-alpine` toolchain): `bun x playwright test --project=chromium`
  đầy đủ → `494 passed, 34 failed, 7 skipped`. Lỗi tập trung ở asset/file-manager/theme/media flows có sẵn (không
  phải Electronics Logic); `should upload file to folder` tái lập với `--workers=1`.
- 2026-08-13, **native Windows** (không Docker), cùng lệnh trên working tree hiện tại (bao gồm 16 file
  Windows-compat + P03/P04/C01-C06/T01-T03/K01-K04 chưa commit): `528 passed, 1 failed, 6 skipped` (22.0 phút) — lỗi
  duy nhất là `geogebra-activity.spec.ts:93`, không liên quan đến 34-failure blocker, tái lập giống hệt qua 2 lần
  retry (không phải flaky).
- Kết quả native-Windows này **không được coi là đối chứng/re-verify** của bằng chứng Docker gốc, vì hai lý do đã
  ghi trong `repo-map.md`: (1) môi trường hoàn toàn khác (Docker/Linux vs native Windows — timing/filesystem/worker
  behavior khác nhau); (2) rà soát nhân quả theo file loại trừ khả năng 16 file Windows-compat là nguyên nhân — none
  chạm `public/app/**`, exporters/renderers, hay bất kỳ E2E spec nào mà luồng asset/file-manager/theme/media dùng.
- **Suy luận quan trọng cho việc lập kế hoạch:** vì 34 lỗi không tái lập trên native Windows nhưng tái lập trên
  Docker/Linux, root cause nhiều khả năng đặc thù môi trường (timing, filesystem case-sensitivity, worker
  concurrency, hoặc container resource limit) — nghĩa là điều tra bắt buộc phải chạy trong đúng Docker toolchain
  gốc; chạy trên native Windows sẽ không tái lập được vấn đề và lãng phí thời gian.
- Docker Desktop đã xác nhận sẵn sàng trên máy này (`docker info` thành công, ghi nhận 2026-08-13).
- Không có danh sách đầy đủ 34 tên test/lỗi được ghi lại ở bất kỳ đâu — đây là khoảng trống bằng chứng đầu tiên cần
  lấp trước khi có thể phân cụm hay xác định root cause.

## FILE ĐƯỢC SỬA (giai đoạn điều tra)

Không có — chỉ chạy lệnh, thu thập log, ghi phát hiện vào `repo-map.md` (PM/tester evidence log, không phải Task
Packet output). Nếu root cause dẫn tới một fix nhỏ, cô lập, rõ ràng cho một cụm cụ thể, đề xuất một packet nối tiếp
riêng (`BUGFIX-02b-...`) với `FILE ĐƯỢC SỬA` cụ thể — không tự ý mở rộng sang sửa nhiều file trong chính packet điều
tra này.

## KHÔNG LÀM

- Không sửa code sản phẩm trước khi root cause của cụm đó được xác nhận bằng bằng chứng tái lập (đúng tinh thần
  `systematic-debugging` và AGENTS.md "No workarounds").
- Không retry/skip/quarantine test để "xanh hoá" con số — che giấu lỗi không phải là sửa lỗi (AGENTS.md §5.3: không
  đánh dấu `.skip`/`.todo` để merge).
- Không mở rộng sang Electronics Logic hoặc bất kỳ backlog S/P/C/T/K/E/U/I/Q nào.
- Không coi 34-failure là đã sửa chỉ vì native-Windows run sạch (528/1/6) — hai môi trường không tương đương; phải
  đối chứng trong đúng Docker toolchain gốc trước khi đóng gate G-P0 trên hạng mục này.
- Không tái tạo container/methodology Docker gốc từ đầu một cách tuỳ tiện nếu Dockerfile/compose hiện tại của repo
  đã đủ để chạy lại — ưu tiên tái sử dụng cấu hình đã có trước khi tự dựng mới.

## ACCEPTANCE

Một bản ghi mới trong `repo-map.md` liệt kê đầy đủ tên/lỗi của toàn bộ test Chromium thất bại (34, hoặc số hiện tại
nếu đã trôi do upstream drift kể từ baseline commit `3c7c7e82` — ghi rõ nếu số thay đổi), phân cụm theo nguyên nhân
gốc, và với tối thiểu cụm lớn nhất: root cause được xác định bằng bằng chứng tái lập trực tiếp, không phải suy đoán.

## TEST BẮT BUỘC

- Chạy lại đúng phương pháp luận Docker đã dùng cho G-P0 gốc (`oven/bun:1.3-alpine` hoặc Dockerfile chuẩn của repo)
  → `bun x playwright test --project=chromium` đầy đủ, lưu log chi tiết từng test (không chỉ tổng số pass/fail).
- Với cụm đại diện (`should upload file to folder`): chạy cô lập với `--workers=1` và với số worker mặc định, so
  sánh kết quả để xác nhận/loại trừ race condition do concurrency.
- Nếu root cause được xác nhận và một fix cô lập được áp dụng (trong packet nối tiếp): chạy lại toàn bộ Chromium
  suite trong cùng Docker toolchain, kỳ vọng số lỗi giảm về 0 cho cụm đã sửa, không hồi quy trên 494 test đang pass.

## Ngân sách và điểm dừng

PLAN.md dòng 241 dành tối đa 10 giờ dự phòng cuối tuần cho đúng loại "blocker gate" này. Vì bước tái lập +
phân cụm + xác định root cause của một lỗi môi trường Docker-only chưa từng được log chi tiết có thể tốn nhiều giờ
không chắc chắn, **dừng và báo cáo hiện trạng khi chạm mốc 6 giờ điều tra** dù đã xác định được root cause hay chưa —
không tự ý tiếp tục vượt ngân sách dự phòng mà không có xác nhận mới. Ghi thời gian thực tế đã dùng trong ĐẦU RA để
đối chiếu với ngân sách 10 giờ.

## ĐẦU RA

Danh sách đầy đủ 34 lỗi đã phân cụm, root cause của cụm lớn nhất kèm bằng chứng tái lập, khuyến nghị (tự sửa trong
packet nối tiếp nhỏ / cần packet riêng lớn hơn / chấp nhận là giới hạn môi trường Docker ngoài phạm vi Solo Logic
Alpha), và thời gian thực tế đã dùng.
