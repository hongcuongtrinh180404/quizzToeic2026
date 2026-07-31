

```markdown
# 📘 TOEIC Synonym Recall - Product Requirement Document (PRD)

## 1. Tổng quan Dự án (Project Overview)
* **Tên ứng dụng:** TOEIC Synonym Recall
* **Mục tiêu:** Website học từ đồng nghĩa TOEIC dựa trên trường nghĩa, tập trung vào phương pháp **Active Recall** (Gợi nhớ chủ động), **Phản xạ nhận diện** và **Spelling** (Gõ từ chuẩn xác) thay vì chỉ đọc danh sách thụ động.
* **Hình thức triển khai:** Static Web Application (HTML/CSS/JS thuần hoặc React/Vite), lưu dữ liệu tiến độ ở `localStorage` và deploy hoàn toàn miễn phí qua **GitHub Pages**.

---

## 2. Cấu trúc Dữ liệu (Data Structure)

Dữ liệu được lưu trữ dưới dạng file `data.json` trực tiếp trong thư mục dự án:

```json
[
  {
    "id": 1,
    "meaning": "Nguyên bản, thật",
    "key_word": "authentic",
    "synonyms": ["genuine", "real", "original"]
  },
  {
    "id": 2,
    "meaning": "Nhanh chóng, ngay lập tức",
    "key_word": "promptly",
    "synonyms": ["quickly", "immediately", "instantly", "rapidly", "swiftly", "speedily", "at once"]
  }
]

```

---

## 3. Luồng Người Dùng (User Flow)

```
[ Trang Cấu Hình ] ──(Chọn Mode + Số nhóm từ)──> [ Màn Hình Luyện Tập ] ──(Hoàn thành)──> [ Màn Hình Báo Cáo ]

```

---

## 4. Chi Tiết Các Màn Hình & Tính Năng

### 🏠 4.1. Trang Cấu Hình Phiên Học (Setup Screen)

Khi truy cập website, người dùng thiết lập các tham số cho phiên học:

1. **Chọn Mode Học:**
* **Mode 1: Synonym Chain** *(Kéo - Thả / Chọn thẻ từ đồng nghĩa)*
* **Mode 2: Meaning to Synonyms** *(Nhập bàn phím toàn bộ nhóm từ từ nghĩa Tiếng Việt)*


2. **Chọn Số Lượng Trường Nghĩa (Số câu hỏi trong phiên):**
* Cho phép chọn các mức cố định: `5`, `10`, `20` hoặc `Tất cả`.


3. **Nút "Bắt đầu học":** Khởi chạy phiên luyện tập.

---

### 🎮 4.2. Mode 1: Synonym Chain (Kéo - Thả / Select Cards)

* **Mục tiêu:** Luyện phản xạ nhận diện từ đồng nghĩa nhanh.
* **Giao diện & Thao tác:**
* Hiển thị 1 **Từ gốc Tiếng Anh** (VD: `PROMPTLY`).
* Hiển thị một "bể" chứa các **Thẻ từ (Word Cards)** bao gồm:
* Tất cả các từ đồng nghĩa ĐÚNG của từ gốc.
* Các **từ nhiễu** được lấy ngẫu nhiên từ các trường nghĩa khác.


* Người dùng **Kéo - Thả** (hoặc Click) các thẻ từ đúng vào vùng đáp án.


* **Phản hồi:**
* Chọn đúng: Thẻ từ sáng xanh và gắn vào vùng đáp án.
* Chọn sai: Thẻ từ rung nhẹ / báo đỏ và trả về bể từ.
* Khi chọn đủ 100% từ đồng nghĩa đúng $\rightarrow$ Tự động chuyển nhóm tiếp theo.



---

### ⌨️ 4.3. Mode 2: Meaning to Synonyms (Gõ Từ Theo Nghĩa)

* **Mục tiêu:** Luyện truy xuất trí nhớ chủ động (Active Recall) và viết đúng chính tả (Spelling).
* **Giao diện & Thao tác:**
* Hiển thị **Trường nghĩa Tiếng Việt** (VD: `Nguyên bản, thật`).
* Hiển thị số ô ẩn tương ứng với số từ cần tìm: `Đã tìm: 0 / 3` `[ _ ] [ _ ] [ _ ]`.
* Có **1 ô Text Input duy nhất** bên dưới.
* Người dùng gõ 1 từ bất kỳ trong nhóm và nhấn **Enter**.



---

### ⚙️ 4.4. Quy Trình Xử Lý Logic Chung (Core Logic & Validation Rules)

1. **Chuẩn hóa dữ liệu đầu vào (Input Sanitization):**
* Tự động xóa khoảng trắng thừa ở 2 đầu và giữa từ (`.trim()`).
* Tự động chuyển tất cả thành chữ thường (`.toLowerCase()`).
* *Ví dụ:* `"  AUTHENTIC  "` $\rightarrow$ `"authentic"`. Hệ thống sẽ tính là **ĐÚNG** dù ngân hàng từ lưu `Authentic` hay `authentic`.


2. **Xử lý phản hồi gõ phím (Mode 2):**
* **Nếu ĐÚNG & CHƯA NHẬP:** Từ hiện ra trên ô tương ứng, ô input tự động **xóa sạch (clear)** để chuẩn bị gõ từ tiếp theo.
* **Nếu SAI hoặc ĐÃ NHẬP RỒI:** Ô input giữ nguyên chữ, viền đỏ / rung nhẹ (shake animation).


3. **Nút Gợi ý (Hint):**
* Mở khóa chữ cái đầu tiên kèm số lượng ký tự của 1 từ chưa tìm được (VD: `g _ _ _ _ _ e` cho *genuine*).


4. **Nút "Bỏ qua / Xem đáp án":**
* Hiển thị ngay toàn bộ đáp án còn thiếu của nhóm hiện tại.
* Đánh dấu nhóm từ này vào **Danh sách Cần Ôn Lại Gấp (Box 1)** để ưu tiên xuất hiện lại trong các phiên học sau.



---

### 📊 4.5. Màn Hình Báo Cáo (Result Screen)

Hiển thị sau khi hoàn thành đủ số trường nghĩa đã chọn:

* Tổng số nhóm từ đã luyện.
* Số nhóm hoàn thành xuất sắc (không dùng Hint/Bỏ qua).
* Danh sách các nhóm từ cần ôn lại (đã bấm Bỏ qua hoặc dùng Hint quá nhiều).
* Nút **"Học phiên mới"** hoặc **"Ôn lại các từ sai"**.

---

## 5. Công Nghệ & Triển Khai (Tech Stack & Deployment)

* **Frontend:** HTML5, CSS3 (hoặc Tailwind CSS), JavaScript (ES6+) / React / Vite.
* **Storage:** `localStorage` (lưu tiến độ học và trạng thái Box SRS của người dùng).
* **Deployment:** GitHub Pages (Deploy tự động qua GitHub Actions hoặc nhánh `gh-pages`).

```

---

Bản mô tả này đã bao quát trọn vẹn toàn bộ ý tưởng của bạn. Bước tiếp theo, chúng ta có thể bắt đầu tạo **file `data.json` chuẩn** hoặc viết **bộ khung code (HTML/CSS/JS)** cho dự án này!

```