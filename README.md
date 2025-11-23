# ViVi AI Assistant - Siêu Trợ Lý Ảo 🤖

**ViVi** là một ứng dụng web trợ lý ảo thông minh (Progressive Web App - PWA) được xây dựng bằng **React**, **TypeScript**, **Tailwind CSS** và tích hợp sức mạnh của **Google Gemini API**.

Ứng dụng tập trung vào trải nghiệm tương tác giọng nói tự nhiên, giao diện cảm xúc (Emotional UI) và khả năng xử lý đa tác vụ.

---

## ✨ Tính năng nổi bật

*   **Giao diện Emotional UI**: Gương mặt ViVi với 50+ biểu cảm (Vui, buồn, giận, ngạc nhiên, đang yêu...) phản hồi theo ngữ cảnh.
*   **Tương tác Giọng nói (Voice-First)**:
    *   Nhận dạng giọng nói tiếng Việt cực nhạy (Web Speech API).
    *   Phản hồi giọng nói AI tự nhiên (Gemini TTS) hoặc giọng chị Google (Native).
    *   Chế độ hội thoại liên tục (Continuous Conversation).
*   **Thông minh & Đa năng**:
    *   Tích hợp **Google Search**: Tra cứu thời tiết, giá vàng, tin tức thời gian thực.
    *   Bộ nhớ ngữ cảnh: Nhớ nội dung cuộc trò chuyện trước đó.
    *   Xử lý lệnh: Đặt hẹn giờ, mở ứng dụng (mô phỏng), bật/tắt WiFi.
*   **Cá nhân hóa**:
    *   Tùy chỉnh tên người dùng, cách xưng hô.
    *   Tùy biến tính cách AI (Hài hước, nghiêm túc, người yêu...).
*   **PWA Support**: Cài đặt trực tiếp lên điện thoại như ứng dụng Native.

---

## 🛠️ Yêu cầu hệ thống

*   **Node.js**: Phiên bản 18.0.0 trở lên.
*   **Google Gemini API Key**: Lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/).

---

## 🚀 Cài đặt & Chạy dưới máy Local (Development)

1.  **Clone dự án:**
    ```bash
    git clone https://github.com/your-username/vivi-assistant.git
    cd vivi-assistant
    ```

2.  **Cài đặt thư viện:**
    ```bash
    npm install
    ```

3.  **Cấu hình môi trường (Tùy chọn):**
    Tạo file `.env` ở thư mục gốc nếu muốn hard-code API Key (không khuyến khích khi public):
    ```env
    API_KEY=AIzaSyYourKeyHere...
    ```

4.  **Chạy dự án:**
    ```bash
    npm start
    # Hoặc nếu dùng Vite:
    npm run dev
    ```
    Truy cập `http://localhost:3000` (hoặc port tương ứng).

---

## 🌐 Hướng dẫn Triển khai lên Server (Production)

Vì ViVi là ứng dụng Client-side (SPA), bạn cần build ra file tĩnh và phục vụ bằng Web Server (Nginx/Apache).

### ⚠️ Lưu ý quan trọng về HTTPS
> **BẮT BUỘC:** Để sử dụng tính năng Micro (Nhận dạng giọng nói), trình duyệt yêu cầu website phải chạy trên giao thức **HTTPS**. Nếu chạy HTTP thường, tính năng nói chuyện sẽ không hoạt động.

### Cách 1: Triển khai với Nginx trên VPS (Ubuntu/CentOS)

**Bước 1: Build dự án**
Tại máy local hoặc trên server (nếu có Nodejs), chạy lệnh:
```bash
npm run build
```
Kết quả sẽ tạo ra thư mục `build` (hoặc `dist`).

**Bước 2: Upload lên Server**
Upload toàn bộ nội dung trong thư mục `build` lên server, ví dụ tại đường dẫn: `/var/www/vivi`.

**Bước 3: Cấu hình Nginx**
Mở file config của Nginx (ví dụ: `/etc/nginx/sites-available/vivi`):

```nginx
server {
    listen 80;
    server_name vivi.yourdomain.com;

    root /var/www/vivi;
    index index.html;

    location / {
        # Quan trọng cho React Router (SPA)
        try_files $uri $uri/ /index.html;
    }

    # Cấu hình nén Gzip để tải trang nhanh hơn
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**Bước 4: Cài đặt SSL (HTTPS)**
Sử dụng Certbot để cài SSL miễn phí:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d vivi.yourdomain.com
```

### Cách 2: Triển khai bằng Docker

Nếu server của bạn đã cài Docker, đây là cách gọn gàng nhất.

**Bước 1: Tạo `Dockerfile`**
Tạo file tên là `Dockerfile` ở thư mục gốc dự án:

```dockerfile
# Stage 1: Build
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
# Copy file config nginx (tạo file nginx.conf ở root project nếu cần custom)
# COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Bước 2: Build Docker Image**
```bash
docker build -t vivi-assistant .
```

**Bước 3: Run Container**
```bash
docker run -d -p 80:80 --name vivi vivi-assistant
```
*(Sau đó dùng Nginx ở máy chủ host để proxy pass vào port 80 và cài SSL)*.

### Cách 3: Triển khai lên Vercel / Netlify (Khuyên dùng)

Đây là cách dễ nhất, miễn phí và tự động có HTTPS.

1.  Đẩy code lên **GitHub**.
2.  Vào Vercel.com -> **Add New Project**.
3.  Chọn repo GitHub của bạn.
4.  Vercel sẽ tự động phát hiện là React app. Nhấn **Deploy**.
5.  (Tùy chọn) Vào Settings -> Environment Variables để thêm `API_KEY` nếu cần.

---

## 📁 Cấu trúc thư mục

```
vivi-assistant/
├── public/              # File tĩnh (manifest.json, icons...)
├── src/
│   ├── components/      # Các thành phần UI (ViViFace, Visualizer...)
│   ├── hooks/           # Custom hooks (useVoiceAssistant...)
│   ├── services/        # API calls (geminiService.ts)
│   ├── types.ts         # Định nghĩa TypeScript
│   ├── App.tsx          # Logic chính
│   └── index.tsx        # Entry point
├── package.json
└── README.md
```

---

## 👨‍💻 Tác giả

*   **Chương Xuân Vương**
*   Email: chuongxuanvuong@gmail.com
*   Facebook: [xuanvuongtv](https://www.facebook.com/xuanvuongtv)

---

## ☕ Donate

Nếu bạn thấy dự án thú vị, hãy ủng hộ tác giả:
*   **Vietcombank**: 9906802199 (xuanvuongtv)
*   **MoMo / ZaloPay**: 0906802199

© 2025 Xuân Vương.
