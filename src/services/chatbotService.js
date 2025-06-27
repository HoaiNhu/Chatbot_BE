const axios = require("axios");
const Conversation = require("../models/Conversation");
const { v4: uuidv4 } = require("uuid");

class ChatbotService {
  constructor() {
    // this.apiUrl = process.env.CHATBOT_API_URL || "http://localhost:8000/chat";
    this.apiUrl =
      process.env.CHATBOT_API_URL_PROD ||
      "https://proj-chatbot.onrender.com/chat";
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
      // Kiểm tra trạng thái conversation
      const conversation = await Conversation.findOne({ sessionId });

      // Lưu tin nhắn người dùng trước
      await this.saveMessage(sessionId, message, "user");

      // Nếu conversation đã được chuyển cho staff, bot không trả lời nữa
      if (conversation && conversation.status === "escalated") {
        // Chỉ lưu tin nhắn và thông báo cho staff
        console.log(
          `Conversation ${sessionId} đã escalated, bot không trả lời`
        );

        // Thông báo cho staff qua socket.io (nếu có)
        // TODO: Implement staff notification

        return {
          text: null, // Bot không trả lời
          sessionId: sessionId,
          intent: "escalated",
          confidence: 1.0,
          status: "escalated",
          escalated: true,
          noReply: true, // Flag để biết bot không trả lời
        };
      }

      // Gọi FastAPI chatbot
      const botResponse = await this.callFastAPIChatbot(
        message,
        sessionId,
        userId
      );

      // Kiểm tra xem có cần chuyển cho staff không
      const shouldEscalate = this.shouldEscalateToStaff(message, botResponse);

      if (shouldEscalate) {
        // Chuyển conversation cho staff
        await this.escalateToStaff(sessionId, message, botResponse);

        return {
          text: "Tôi hiểu vấn đề của bạn. Để đảm bảo bạn được hỗ trợ tốt nhất, tôi sẽ chuyển cuộc trò chuyện này cho nhân viên hỗ trợ. Họ sẽ liên hệ với bạn sớm nhất có thể.",
          sessionId: sessionId,
          intent: botResponse.intent,
          confidence: botResponse.confidence,
          status: "escalated",
          escalated: true,
        };
      }

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
        status: "active",
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

  // Kiểm tra xem có cần chuyển cho staff không
  shouldEscalateToStaff(message, botResponse) {
    // Các trường hợp cần chuyển cho staff:

    // 1. Confidence thấp (< 0.3)
    if (botResponse.confidence < 0.3) {
      return true;
    }

    // 2. Intent cụ thể cần staff (intent = 2 là "escalate")
    if (botResponse.intent === 2) {
      return true;
    }

    // 3. Từ khóa khẩn cấp
    const urgentKeywords = [
      "khẩn cấp",
      "gấp",
      "ngay lập tức",
      "lỗi nghiêm trọng",
      "khiếu nại",
      "phàn nàn",
      "không hài lòng",
      "tức giận",
      "muốn nói chuyện với người",
      "chuyển cho nhân viên",
      "gặp trực tiếp",
      "gọi điện",
    ];

    const messageLower = message.toLowerCase();
    if (urgentKeywords.some((keyword) => messageLower.includes(keyword))) {
      return true;
    }

    // 4. Số lần user gửi tin nhắn > 5 (có thể không hài lòng)
    // TODO: Implement message count check

    return false;
  }

  // Chuyển conversation cho staff
  async escalateToStaff(sessionId, userMessage, botResponse) {
    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) return;

    // Cập nhật trạng thái
    conversation.status = "escalated";
    conversation.priority = this.determinePriority(botResponse);
    conversation.escalatedAt = new Date();
    conversation.escalationReason = this.getEscalationReason(
      userMessage,
      botResponse
    );

    // Tự động assign cho staff có sẵn (round-robin hoặc theo chuyên môn)
    const availableAgent = await this.findAvailableAgent();
    if (availableAgent) {
      conversation.assignedAgent = availableAgent.id;
    }

    await conversation.save();

    // Thông báo cho staff
    await this.notifyStaff(conversation);
  }

  // Tìm staff có sẵn
  async findAvailableAgent() {
    // TODO: Implement agent selection logic
    // Có thể dựa trên:
    // - Số conversation đang xử lý
    // - Chuyên môn
    // - Thời gian online
    return null; // Tạm thời return null
  }

  // Lý do chuyển cho staff
  getEscalationReason(message, botResponse) {
    if (botResponse.confidence < 0.3) {
      return "Low confidence response";
    }
    if (botResponse.intent === 2) {
      return "User requested escalation";
    }
    return "Complex issue requiring human assistance";
  }

  // Thông báo cho staff
  async notifyStaff(conversation) {
    // TODO: Implement staff notification
    // Có thể qua:
    // - Socket.IO
    // - Email
    // - Push notification
    console.log(
      `Staff notification: New escalated conversation ${conversation.sessionId}`
    );
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

  // Staff trả lời conversation
  async staffReply(sessionId, message, agentId) {
    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Kiểm tra xem conversation có được assign cho agent này không
    if (conversation.assignedAgent && conversation.assignedAgent !== agentId) {
      throw new Error("Conversation not assigned to this agent");
    }

    // Lưu tin nhắn của staff
    await this.saveMessage(sessionId, message, "agent", {
      agentId: agentId,
      timestamp: new Date(),
    });

    // Gửi tin nhắn về platform tương ứng
    if (conversation.platform === "facebook") {
      // Gửi qua Facebook Messenger
      await this.sendFacebookMessage(conversation.userId, message);
    } else if (conversation.platform === "web") {
      // Gửi qua Socket.IO cho web interface
      // TODO: Implement Socket.IO notification
      console.log(`Staff reply to web user ${conversation.userId}: ${message}`);
    }

    // Cập nhật thời gian hoạt động cuối
    conversation.lastActivity = new Date();
    await conversation.save();

    return {
      text: message,
      sessionId: sessionId,
      agentId: agentId,
      platform: conversation.platform,
      timestamp: new Date(),
    };
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

  // Gửi tin nhắn qua Facebook Messenger
  async sendFacebookMessage(userId, message) {
    try {
      const facebookToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

      if (!facebookToken) {
        console.error("Facebook Page Access Token not configured");
        return false;
      }

      const url = "https://graph.facebook.com/v21.0/me/messages";
      const headers = {
        Authorization: `Bearer ${facebookToken}`,
        "Content-Type": "application/json",
      };

      const payload = {
        recipient: { id: userId },
        message: { text: message },
      };

      const response = await axios.post(url, payload, { headers });

      if (response.status === 200) {
        console.log(`Đã gửi tin nhắn Facebook cho ${userId}: ${message}`);
        return true;
      } else {
        console.error(
          `Lỗi gửi tin nhắn Facebook: ${response.status} - ${response.data}`
        );
        return false;
      }
    } catch (error) {
      console.error("Lỗi gửi tin nhắn Facebook:", error);
      return false;
    }
  }
}

module.exports = new ChatbotService();
