[README.md](https://github.com/user-attachments/files/30777924/README.md)
[README.md](https://github.com/user-attachments/files/30760605/README.md)
# OmniLabVN# OmniLab

**OmniLab** là không gian học tập khoa học kết hợp trình đọc PDF song song với khu vực ghi chú và vẽ tay, được xây dựng hoàn toàn bằng HTML/CSS/JavaScript thuần (không cần backend).

## Tính năng chính

- **Đọc PDF** — nạp tài liệu, chuyển trang, phóng to/thu nhỏ (dùng PDF.js), có trạng thái đang tải.
- **Soạn thảo văn bản** — định dạng đậm/nghiêng/gạch chân, căn lề, danh sách, đổi phông chữ/cỡ chữ/giãn dòng, tô màu chữ và highlight, chèn ký hiệu khoa học (√ π ∞ Σ ∫ Δ …), hoàn tác/làm lại.
- **Vẽ tay & hình học** — bút vẽ, bút dạ quang, tẩy, vẽ đường thẳng/chữ nhật/hình tròn, hệ trục tọa độ Oxy, **vẽ đồ thị hàm số y = f(x)**, hỗ trợ cảm ứng (chuột + cảm ứng ngón tay/bút cảm ứng), hoàn tác/làm lại có lịch sử thao tác.
- **Máy tính khoa học** — các hàm sin/cos/tan/log/ln/căn bậc hai/giai thừa, hằng số π và e, bộ nhớ M+/M−/MR/MC, biểu thức được tính bằng trình phân tích cú pháp an toàn (không dùng `eval`).
- **Lưu trữ tự động** — tự động lưu vào LocalStorage của trình duyệt kèm chỉ báo trạng thái “Đã lưu / Đang chỉnh sửa”, có thể lưu thủ công bằng nút Lưu Bài hoặc phím tắt `Ctrl+S`.
- **Giao diện sáng / tối** — chuyển đổi nhanh, ghi nhớ lựa chọn giữa các lần truy cập.
- **Responsive** — thu gọn hợp lý trên màn hình nhỏ/máy tính bảng.

## Phím tắt

| Phím | Chức năng |
|---|---|
| `Ctrl/Cmd + S` | Lưu bài |
| `Ctrl/Cmd + B / I / U` | Đậm / Nghiêng / Gạch chân |
| `Ctrl/Cmd + Z` (khi ở chế độ vẽ) | Hoàn tác nét vẽ |
| `Ctrl/Cmd + Shift + Z` hoặc `Ctrl/Cmd + Y` | Làm lại nét vẽ |
| `Alt + 1` / `Alt + 2` | Chuyển chế độ Soạn thảo / Vẽ tay |
| `←` / `→` | Chuyển trang PDF (khi không gõ trong ô ghi chú) |
| `Esc` | Đóng hộp thoại / máy tính |

## Chạy thử

Mở trực tiếp `index.html` bằng trình duyệt, hoặc phục vụ qua một máy chủ tĩnh bất kỳ, ví dụ:

```bash
python3 -m http.server 8080
```

rồi truy cập `http://localhost:8080`.

## Công nghệ sử dụng

- [PDF.js](https://mozilla.github.io/pdf.js/) — hiển thị PDF trên `<canvas>`
- [Font Awesome 6](https://fontawesome.com/) — biểu tượng
- Google Fonts: Space Grotesk, Inter, JetBrains Mono, cùng các phông chữ ghi chú (Roboto, Playfair Display, Dancing Script, Courier Prime)
- Không có dependency build — chạy trực tiếp bằng trình duyệt
