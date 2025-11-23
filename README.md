# ViVi AI Assistant - Siêu Trợ Lý Ảo 🤖

**ViVi** là một ứng dụng web trợ lý ảo thông minh (Progressive Web App - PWA) được tối ưu hóa để triển khai trên hệ thống máy chủ **Ubuntu** bằng Docker.

---

## 🚀 Hướng dẫn Cài đặt trên Server Ubuntu

Quy trình này áp dụng cho VPS mới tinh (DigitalOcean, AWS, Google Cloud, v.v.) chạy Ubuntu 20.04 hoặc 22.04.

### 1. Chuẩn bị môi trường (Chỉ làm 1 lần)

Đăng nhập vào VPS qua SSH và chạy các lệnh sau để cài đặt Docker:

```bash
# Cập nhật danh sách gói
sudo apt update

# Cài đặt các gói cần thiết
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Thêm GPG key của Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Thêm repository Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Cài đặt Docker Engine và Docker Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# (Tùy chọn) Cài đặt docker-compose standalone nếu muốn dùng lệnh 'docker-compose' thay vì 'docker compose'
sudo apt install -y docker-compose
```

### 2. Triển khai Ứng dụng

**Bước 1: Tải mã nguồn**
Upload toàn bộ file dự án lên server (ví dụ vào thư mục `/root/vivi-assistant`) hoặc dùng git clone.

**Bước 2: Chạy ứng dụng**
Tại thư mục chứa file `docker-compose.yml`, chạy lệnh:

```bash
# Build và chạy ngầm (-d)
sudo docker-compose up -d --build
```

**Bước 3: Kiểm tra**
```bash
sudo docker ps
```
Nếu thấy trạng thái **Up**, ứng dụng đã chạy thành công tại cổng 80.
Truy cập: `http://<IP-Server-Cua-Ban>`

---

### 3. Cấu hình HTTPS (BẮT BUỘC CHO MICROPHONE) ⚠️

Trình duyệt Chrome/Safari **chặn truy cập Microphone** nếu web không có HTTPS (ổ khóa bảo mật). Để ViVi hoạt động trên server, bạn cần cài SSL.

Cách đơn giản nhất là dùng **Nginx Proxy Manager** hoặc cài **Certbot** trực tiếp trên Host.

**Cách dùng Certbot + Nginx trên Host (Khuyên dùng):**

1.  Cài Nginx trên Ubuntu (ngoài Docker): `sudo apt install nginx`
2.  Cấu hình Nginx Proxy Pass vào Docker (đang chạy port 80).
3.  Chạy `sudo certbot --nginx` để lấy chứng chỉ SSL miễn phí.

---

## 🛠️ Lệnh quản lý

*   **Xem log lỗi:** `sudo docker logs -f vivi_assistant`
*   **Dừng app:** `sudo docker-compose down`
*   **Khởi động lại:** `sudo docker-compose restart`
*   **Cập nhật code mới:**
    ```bash
    git pull
    sudo docker-compose up -d --build
    ```

---

## 👨‍💻 Tác giả

*   **Chương Xuân Vương**
*   Email: chuongxuanvuong@gmail.com

© 2025 ViVi Project.