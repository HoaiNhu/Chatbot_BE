const axios = require("axios");
const Conversation = require("../models/Conversation");
const { v4: uuidv4 } = require("uuid");

class ChatbotService {
  constructor() {
    this.apiUrl = process.env.CHATBOT_API_URL || "http://localhost:8000/chat";
  }

  // Tạo session mới
  async createSession(userId = null, platform = "web") {
    const sessionId = uuidv4();

    const conversation = new Conversation({
      sessionId,
      userId,
      platform,
      status: "active",
    });

    await conversation.save();
    return sessionId;
  }

  // Xử lý tin nhắn từ người dùng
  async processMessage(message, sessionId, userId = null) {
    try {
      // Lưu tin nhắn người dùng
      await this.saveMessage(sessionId, message, "user");

      // Gọi FastAPI chatbot
      const botResponse = await this.callFastAPIChatbot(
        message,
        sessionId,
        userId
      );

      // Lưu phản hồi của bot
      await this.saveMessage(sessionId, botResponse.text, "bot", {
        intent: botResponse.intent,
        confidence: botResponse.confidence,
      });

      // Cập nhật trạng thái conversation nếu cần
      await this.updateConversationStatus(sessionId, botResponse);

      return {
        text: botResponse.text,
        sessionId: botResponse.session_id,
        intent: botResponse.intent,
        confidence: botResponse.confidence,
        quickReplies: botResponse.quick_replies || [],
        attachments: botResponse.attachments || [],
      };
    } catch (error) {
      console.error("Error processing message:", error);

      // Lưu tin nhắn lỗi
      await this.saveMessage(
        sessionId,
        "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.",
        "bot"
      );

      throw error;
    }
  }

  // Gọi FastAPI chatbot
  async callFastAPIChatbot(message, sessionId, userId = null) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          message,
          session_id: sessionId,
          user_id: userId,
          platform: "web",
        },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("FastAPI chatbot error:", error);

      // Fallback response
      return {
        text: "Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau.",
        intent: 0,
        confidence: 0,
        session_id: sessionId,
      };
    }
  }

  // Lưu tin nhắn vào database
  async saveMessage(sessionId, text, sender, metadata = {}) {
    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Nếu là message của user và có intent/confidence thì gắn need_review nếu confidence thấp
    if (
      sender === "user" &&
      metadata.intent &&
      typeof metadata.confidence === "number"
    ) {
      if (metadata.confidence < 0.7) {
        if (!metadata) metadata = {};
        metadata.need_review = true;
      }
    }

    conversation.messages.push({
      text,
      sender,
      timestamp: new Date(),
      ...metadata,
    });

    await conversation.save();
  }

  // Cập nhật trạng thái conversation
  async updateConversationStatus(sessionId, botResponse) {
    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) return;

    // Nếu bot phát hiện cần chuyển cho nhân viên
    if (botResponse.intent === 2 || botResponse.confidence < 0.3) {
      conversation.status = "escalated";
      conversation.priority = this.determinePriority(botResponse);
    }

    // Nếu vấn đề đã được giải quyết
    if (botResponse.intent === 6) {
      conversation.status = "resolved";
      conversation.resolvedAt = new Date();
    }

    await conversation.save();
  }

  // Xác định mức độ ưu tiên
  determinePriority(botResponse) {
    const urgentKeywords = [
      "khẩn cấp",
      "gấp",
      "ngay lập tức",
      "lỗi nghiêm trọng",
    ];
    const highKeywords = ["quan trọng", "cần thiết", "vấn đề"];

    const message = botResponse.text.toLowerCase();

    if (urgentKeywords.some((keyword) => message.includes(keyword))) {
      return "urgent";
    } else if (highKeywords.some((keyword) => message.includes(keyword))) {
      return "high";
    }

    return "medium";
  }

  // Lấy lịch sử conversation
  async getConversationHistory(sessionId) {
    const conversation = await Conversation.findOne({ sessionId });
    return conversation ? conversation.messages : [];
  }

  // Lấy danh sách conversations
  async getConversations(filters = {}) {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.userId) query.userId = filters.userId;
    if (filters.platform) query.platform = filters.platform;

    return await Conversation.find(query)
      .sort({ lastActivity: -1 })
      .limit(filters.limit || 50);
  }

  // Đánh giá mức độ hài lòng
  async rateConversation(sessionId, rating) {
    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    conversation.satisfaction = rating;
    await conversation.save();

    return conversation;
  }

  // Chuyển conversation cho nhân viên
  async assignToAgent(sessionId, agentId) {
    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    conversation.assignedAgent = agentId;
    conversation.status = "escalated";
    await conversation.save();

    return conversation;
  }

  // Đóng conversation
  async closeConversation(sessionId) {
    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    conversation.status = "closed";
    conversation.resolvedAt = new Date();
    await conversation.save();

    return conversation;
  }

  // Thống kê
  async getStatistics(timeRange = "7d") {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "1d":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const stats = await Conversation.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          resolvedConversations: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          escalatedConversations: {
            $sum: { $cond: [{ $eq: ["$status", "escalated"] }, 1, 0] },
          },
          avgSatisfaction: { $avg: "$satisfaction" },
        },
      },
    ]);

    return (
      stats[0] || {
        totalConversations: 0,
        resolvedConversations: 0,
        escalatedConversations: 0,
        avgSatisfaction: 0,
      }
    );
  }
}

module.exports = new ChatbotService();
