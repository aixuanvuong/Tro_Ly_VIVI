# 🤖 Hướng dẫn Cài đặt ViVi Assistant (A-Z)

Chào mừng bạn! Tài liệu này được thiết kế để giúp bạn đưa **Siêu trợ lý ViVi** lên máy chủ (VPS Ubuntu) một cách dễ dàng nhất.

> **⚠️ LƯU Ý QUAN TRỌNG:**
> Để sử dụng được **Microphone** trên điện thoại/máy tính, trang web của bạn **BẮT BUỘC PHẢI CÓ HTTPS** (ổ khóa bảo mật).
> Hướng dẫn này sẽ giúp bạn cài đặt HTTPS miễn phí hoàn toàn.

---

## 📋 Phần 1: Chuẩn bị

Trước khi bắt đầu, bạn cần có:
1.  **Một VPS Ubuntu** (20.04 hoặc 22.04). RAM tối thiểu 1GB.
2.  **Một Tên miền (Domain)**. Ví dụ: `vivi.cuaban.com`.
    *   *Vào trang quản lý tên miền, trỏ bản ghi **A** về **địa chỉ IP** của VPS.*

---

## 🛠️ Phần 2: Cài đặt trên Server (Copy & Paste)

Hãy đăng nhập vào VPS của bạn qua SSH và thực hiện lần lượt các bước sau.

### Bước 1: Cài đặt Docker & Môi trường
*(Copy cả đoạn lệnh dưới và dán vào terminal)*

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker và các công cụ cần thiết
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common nginx certbot python3-certbot-nginx git

# Cài đặt Docker Engine
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### Bước 2: Tải mã nguồn về
Bạn có thể upload file từ máy tính lên, hoặc nếu bạn dùng git:

```bash
# Di chuyển ra thư mục gốc
cd /var/www

# Clone code về (Thay link này bằng link git của bạn nếu có, hoặc tạo thư mục thủ công)
# Ở đây ta giả sử bạn tạo thư mục và upload file vào:
sudo mkdir vivi-assistant
cd vivi-assistant

# --- LÚC NÀY HÃY UPLOAD TOÀN BỘ FILE CODE VÀO THƯ MỤC NÀY ---
# (Dùng FileZilla hoặc WinSCP để upload)
```

### Bước 3: Chạy ứng dụng ViVi
Sau khi đã upload file đầy đủ vào `/var/www/vivi-assistant`:

```bash
# Chạy Docker (App sẽ chạy ở cổng 3000)
sudo docker compose up -d --build
```
*Đợi khoảng 2-3 phút để quá trình build hoàn tất.*

---

## 🌐 Phần 3: Cấu hình Tên miền & HTTPS (Quan trọng nhất)

Đây là bước giúp bạn có ổ khóa bảo mật 🔒 để dùng được Micro.

### Bước 1: Tạo file cấu hình Nginx
Thay `vivi.cuaban.com` bằng tên miền thực tế của bạn.

```bash
# Tạo file cấu hình mới
sudo nano /etc/nginx/sites-available/vivi
```

**Dán nội dung sau vào (Nhớ sửa tên miền):**

```nginx
server {
    server_name vivi.cuaban.com; # <--- THAY TÊN MIỀN CỦA BẠN VÀO ĐÂY

    location / {
        proxy_pass http://localhost:3000; # Trỏ vào Docker App đang chạy
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Bấm `Ctrl+O` -> `Enter` để lưu. Bấm `Ctrl+X` để thoát.

### Bước 2: Kích hoạt Web
```bash
# Tạo liên kết
sudo ln -s /etc/nginx/sites-available/vivi /etc/nginx/sites-enabled/
# Xóa cấu hình mặc định (nếu có)
sudo rm /etc/nginx/sites-enabled/default
# Kiểm tra lỗi
sudo nginx -t
# Khởi động lại Nginx
sudo systemctl restart nginx
```

### Bước 3: Cài đặt SSL (HTTPS) Tự động
Chạy lệnh thần thánh sau của Certbot:

```bash
sudo certbot --nginx -d vivi.cuaban.com
```
*   Nó sẽ hỏi email -> Nhập email của bạn.
*   Hỏi đồng ý điều khoản -> Chọn `Y`.
*   Nó sẽ tự động cài chứng chỉ bảo mật.

---

## ✅ Hoàn tất!

Bây giờ hãy mở trình duyệt và truy cập: `https://vivi.cuaban.com`

1.  Bạn sẽ thấy giao diện ViVi.
2.  Vào **Cài đặt** -> **Hệ thống**.
3.  Nhập **Gemini API Key** của bạn vào và Lưu.
4.  Bắt đầu trò chuyện!

---

## ❓ Các câu hỏi thường gặp

**1. Tôi lấy Gemini API Key ở đâu?**
Truy cập: [Google AI Studio](https://aistudio.google.com/app/apikey) để lấy miễn phí.

**2. Làm sao để cập nhật phiên bản mới?**
Chỉ cần upload code mới đè lên code cũ, sau đó chạy lệnh:
```bash
cd /var/www/vivi-assistant
sudo docker compose down
sudo docker compose up -d --build
```

**3. Xem log lỗi nếu App không chạy?**
```bash
sudo docker logs -f vivi_assistant
```

---
© 2025 Chương Xuân Vương
