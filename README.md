# 🤖 Hướng dẫn Cài đặt Siêu Trợ Lý ViVi (A-Z)

Chào mừng bạn! Tài liệu này được viết dành riêng cho người mới bắt đầu. Bạn chỉ cần làm theo từng bước, **Copy** và **Paste** các lệnh dưới đây vào Server (VPS) là sẽ có ngay một trợ lý ảo riêng.

> **⚠️ LƯU Ý QUAN TRỌNG:**
> Để ViVi nghe được giọng nói của bạn, trang web **BẮT BUỘC PHẢI CÓ HTTPS** (biểu tượng ổ khóa trên trình duyệt).
> Đừng lo, hướng dẫn này sẽ giúp bạn cài HTTPS hoàn toàn miễn phí.

---

## 📋 Phần 1: Những thứ cần chuẩn bị

1.  **Một VPS (Máy chủ ảo)**: Nên dùng hệ điều hành **Ubuntu 20.04** hoặc **22.04**.
2.  **Một Tên miền (Domain)**: Ví dụ `troly.tenmiencuaban.com`.
    *   *Hãy vào trang quản lý tên miền và trỏ nó về địa chỉ IP của VPS trước khi bắt đầu.*

---

## 🛠️ Phần 2: Cài đặt trên Server (Chỉ cần Copy & Paste)

Hãy đăng nhập vào VPS của bạn và thực hiện lần lượt:

### Bước 1: Cài đặt các công cụ cần thiết
Copy toàn bộ đoạn dưới đây và dán vào cửa sổ lệnh (Terminal) rồi nhấn Enter:

```bash
# 1. Cập nhật hệ thống mới nhất
sudo apt update && sudo apt upgrade -y

# 2. Cài đặt Docker, Git và Nginx
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common nginx certbot python3-certbot-nginx git

# 3. Cài đặt Docker Engine (Bộ máy chạy ứng dụng)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### Bước 2: Tải mã nguồn ViVi về máy
Sử dụng đường dẫn GitHub chính thức của dự án:

```bash
# Di chuyển ra thư mục web
cd /var/www

# Kéo mã nguồn về từ GitHub
sudo git clone https://github.com/aixuanvuong/Tro_Ly_VIVI.git

# Truy cập vào thư mục vừa tải
cd Tro_Ly_VIVI
```

### Bước 3: Khởi động ViVi
Lệnh này sẽ tự động cài đặt mọi thứ và chạy ứng dụng:

```bash
sudo docker compose up -d --build
```
*Hãy đi pha một tách cà phê ☕ và đợi khoảng 2-3 phút để máy chủ làm việc xong.*

---

## 🌐 Phần 3: Kết nối Tên miền & Bảo mật (HTTPS)

Đây là bước quan trọng nhất để kích hoạt tính năng Micro.

### Bước 1: Tạo cấu hình kết nối
Hãy thay đổi `tenmiencuaban.com` bằng tên miền thực tế của bạn trong lệnh dưới.

1.  Mở trình soạn thảo:
```bash
sudo nano /etc/nginx/sites-available/vivi
```

2.  **Copy đoạn dưới đây**, dán vào cửa sổ lệnh.
    **QUAN TRỌNG:** Sửa dòng `server_name` thành tên miền của bạn.

```nginx
server {
    # THAY TÊN MIỀN CỦA BẠN Ở DÒNG DƯỚI (Ví dụ: troly.abc.com)
    server_name tenmiencuaban.com;

    location / {
        proxy_pass http://localhost:3000; # Kết nối tới ViVi đang chạy
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3.  Lưu lại bằng cách bấm: `Ctrl+O` -> `Enter` -> `Ctrl+X`.

### Bước 2: Kích hoạt và lấy chứng chỉ bảo mật
Copy lần lượt các dòng sau:

```bash
# Kích hoạt cấu hình vừa tạo
sudo ln -s /etc/nginx/sites-available/vivi /etc/nginx/sites-enabled/

# Xóa cấu hình mặc định để tránh lỗi
sudo rm /etc/nginx/sites-enabled/default

# Khởi động lại hệ thống mạng
sudo systemctl restart nginx

# --- CÀI ĐẶT Ổ KHÓA BẢO MẬT (SSL) ---
# Thay tenmiencuaban.com bằng tên miền của bạn
sudo certbot --nginx -d tenmiencuaban.com
```
*Máy sẽ hỏi Email của bạn (để thông báo nếu chứng chỉ hết hạn), hãy nhập email vào. Sau đó chọn Y (Yes) nếu được hỏi.*

---

## ✅ Hoàn tất! Chúc mừng bạn

Bây giờ hãy mở trình duyệt (Chrome/Safari) trên điện thoại hoặc máy tính và vào địa chỉ:
`https://tenmiencuaban.com`

**Các bước thiết lập đầu tiên:**
1.  Bấm nút **"Bắt đầu"** ở màn hình chào mừng.
2.  Ứng dụng sẽ tự mở phần **Cài đặt -> Hệ thống**.
3.  Bấm vào link hướng dẫn lấy **Gemini API Key** (Miễn phí).
4.  Nhập Key vào và bấm **Lưu**.
5.  Xong! Bạn có thể bắt đầu nói chuyện với ViVi.

---

## ❓ Hướng dẫn cập nhật

Sau này khi tác giả cập nhật tính năng mới, bạn chỉ cần làm như sau để nâng cấp server của mình:

```bash
cd /var/www/Tro_Ly_VIVI

# 1. Lấy code mới nhất về
sudo git pull origin main

# 2. Chạy lại ứng dụng
sudo docker compose down
sudo docker compose up -d --build
```

---
**Thông tin liên hệ & Hỗ trợ:**
*   Email: chuongxuanvuong@gmail.com
*   Facebook: xuanvuongtv
*   © 2025 Chương Xuân Vương
