# Chatbot Backend - Hệ thống hỗ trợ khách hàng

Backend Node.js cho hệ thống chatbot hỗ trợ khách hàng với tích hợp Python NLP, MongoDB và Facebook Messenger.

## 🚀 Tính năng

- **Xử lý tin nhắn thông minh**: Tích hợp với Python NLP backend
- **Quản lý conversation**: Lưu trữ và theo dõi các cuộc trò chuyện
- **Tích hợp Facebook Messenger**: Webhook để nhận và gửi tin nhắn
- **Hệ thống đánh giá**: Cho phép khách hàng đánh giá chất lượng dịch vụ
- **Chuyển tiếp cho nhân viên**: Tự động chuyển các vấn đề phức tạp
- **Thống kê và báo cáo**: Theo dõi hiệu suất chatbot
- **Bảo mật**: Rate limiting, CORS, Helmet security

## 📋 Yêu cầu hệ thống

- Node.js 16+
- MongoDB 4.4+
- Python 3.8+ (cho NLP backend)

## 🛠️ Cài đặt

1. **Clone repository**

```bash
git clone <repository-url>
cd Chatbot_NodeJS
```

2. **Cài đặt dependencies**

```bash
npm install
```

3. **Cấu hình môi trường**

```bash
# Copy file config.env và cập nhật các giá trị
cp config.env.example config.env
```

4. **Cấu hình MongoDB**

- Cài đặt MongoDB local hoặc sử dụng MongoDB Atlas
- Cập nhật `MONGODB_URI` trong `config.env`

5. **Cấu hình Python NLP backend**

- Đảm bảo Python chatbot đang chạy trên port 5005
- Cập nhật `CHATBOT_API_URL` trong `config.env`

## 🚀 Chạy ứng dụng

### Development mode

```bash
npm run dev
```

### Production mode

```bash
npm start
```

Server sẽ chạy trên `http://localhost:3001`

## 📡 API Endpoints

### Chatbot APIs

| Method | Endpoint                                       | Mô tả                               |
| ------ | ---------------------------------------------- | ----------------------------------- |
| GET    | `/api/chatbot/health`                          | Health check                        |
| POST   | `/api/chatbot/session`                         | Tạo session mới                     |
| POST   | `/api/chatbot/message`                         | Gửi tin nhắn                        |
| GET    | `/api/chatbot/conversation/:sessionId/history` | Lấy lịch sử conversation            |
| POST   | `/api/chatbot/conversation/:sessionId/rate`    | Đánh giá conversation               |
| GET    | `/api/chatbot/conversations`                   | Lấy danh sách conversations (admin) |
| POST   | `/api/chatbot/conversation/:sessionId/assign`  | Chuyển cho agent                    |
| POST   | `/api/chatbot/conversation/:sessionId/close`   | Đóng conversation                   |
| GET    | `/api/chatbot/statistics`                      | Lấy thống kê                        |

### Facebook Messenger Webhook

| Method | Endpoint                        | Mô tả                     |
| ------ | ------------------------------- | ------------------------- |
| GET    | `/api/chatbot/webhook/facebook` | Webhook verification      |
| POST   | `/api/chatbot/webhook/facebook` | Nhận tin nhắn từ Facebook |

### Legacy API (Backward compatibility)

| Method | Endpoint    | Mô tả                 |
| ------ | ----------- | --------------------- |
| POST   | `/api/chat` | Gửi tin nhắn (legacy) |

## 📊 Cấu trúc Database

### Conversation Schema

```javascript
{
  sessionId: String,        // Unique session ID
  userId: String,           // User ID (optional)
  platform: String,         // web, facebook, telegram, whatsapp
  status: String,           // active, resolved, escalated, closed
  priority: String,         // low, medium, high, urgent
  category: String,         // General category
  assignedAgent: String,    // Agent ID (if escalated)
  messages: [Message],      // Array of messages
  startedAt: Date,          // Session start time
  lastActivity: Date,       // Last activity time
  resolvedAt: Date,         // Resolution time
  satisfaction: Number,     // 1-5 rating
  tags: [String],           // Tags for categorization
  metadata: Object          // Additional data
}
```

### Message Schema

```javascript
{
  text: String,             // Message content
  sender: String,           // user, bot, agent
  timestamp: Date,          // Message time
  intent: String,           // Detected intent
  confidence: Number,       // Confidence score
  metadata: Object          // Additional data
}
```

## 🔧 Cấu hình

### Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/chatbot_support
MONGODB_URI_PROD=mongodb+srv://username:password@cluster.mongodb.net/chatbot_support

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# External APIs
CHATBOT_API_URL=http://localhost:5005/chat
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_VERIFY_TOKEN=your_webhook_verify_token

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔌 Tích hợp với Frontend

Frontend React có thể sử dụng các API sau:

```javascript
import {
  sendMessage,
  createSession,
  getConversationHistory,
} from "./services/ChatbotService";

// Tạo session mới
const sessionId = await createSession();

// Gửi tin nhắn
const response = await sendMessage("Xin chào", sessionId);

// Lấy lịch sử
const history = await getConversationHistory(sessionId);
```

## 🔒 Bảo mật

- **Rate Limiting**: Giới hạn số request từ mỗi IP
- **CORS**: Cấu hình cross-origin requests
- **Helmet**: Security headers
- **Input Validation**: Validate tất cả input
- **Error Handling**: Xử lý lỗi an toàn

## 📈 Monitoring

### Health Check

```bash
curl http://localhost:3001/api/chatbot/health
```

### Statistics

```bash
curl http://localhost:3001/api/chatbot/statistics?timeRange=7d
```

## 🚀 Deployment

### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables

Đảm bảo cập nhật tất cả environment variables cho production:

- `NODE_ENV=production`
- `MONGODB_URI_PROD`
- `JWT_SECRET`
- `FACEBOOK_APP_SECRET`

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📝 License

MIT License

## 🆘 Support

Nếu gặp vấn đề, vui lòng tạo issue hoặc liên hệ team phát triển.
