const chatbotService = require("../services/chatbotService");
const Conversation = require("../models/Conversation");

class ChatbotController {
  // Tạo session mới
  async createSession(req, res) {
    try {
      const { userId, platform = "web" } = req.body;
      const sessionId = await chatbotService.createSession(userId, platform);

      res.status(201).json({
        success: true,
        sessionId,
        message: "Session created successfully",
      });
    } catch (error) {
      console.error("Create session error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create session",
        error: error.message,
      });
    }
  }

  // Xử lý tin nhắn
  async sendMessage(req, res) {
    try {
      const { message, sessionId, userId } = req.body;

      if (!message || !sessionId) {
        return res.status(400).json({
          success: false,
          message: "Message and sessionId are required",
        });
      }

      const response = await chatbotService.processMessage(
        message,
        sessionId,
        userId
      );

      // Kiểm tra xem bot có trả lời không
      if (response.noReply) {
        // Bot không trả lời, chỉ thông báo cho staff
        res.json({
          success: true,
          data: {
            text: null,
            sessionId: response.sessionId,
            intent: response.intent,
            confidence: response.confidence,
            status: response.status,
            escalated: true,
            noReply: true,
          },
          message: "Message received, waiting for staff response",
        });
      } else {
        // Bot có trả lời
        res.json({
          success: true,
          data: response,
        });
      }
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process message",
        error: error.message,
      });
    }
  }

  // Lấy lịch sử conversation
  async getConversationHistory(req, res) {
    try {
      const { sessionId } = req.params;
      const messages = await chatbotService.getConversationHistory(sessionId);

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      console.error("Get conversation history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get conversation history",
        error: error.message,
      });
    }
  }

  // Lấy danh sách conversations (cho admin/agent)
  async getConversations(req, res) {
    try {
      const { status, userId, platform, limit = 50 } = req.query;
      const filters = { status, userId, platform, limit: parseInt(limit) };

      const conversations = await chatbotService.getConversations(filters);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get conversations",
        error: error.message,
      });
    }
  }

  // Lấy danh sách conversations cần staff xử lý
  async getEscalatedConversations(req, res) {
    try {
      const { agentId } = req.query;
      const filters = {
        status: "escalated",
        limit: 50,
      };

      if (agentId) {
        filters.assignedAgent = agentId;
      }

      const conversations = await chatbotService.getConversations(filters);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      console.error("Get escalated conversations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get escalated conversations",
        error: error.message,
      });
    }
  }

  // Đánh giá conversation
  async rateConversation(req, res) {
    try {
      const { sessionId } = req.params;
      const { rating } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
      }

      const conversation = await chatbotService.rateConversation(
        sessionId,
        rating
      );

      res.json({
        success: true,
        data: conversation,
        message: "Rating submitted successfully",
      });
    } catch (error) {
      console.error("Rate conversation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit rating",
        error: error.message,
      });
    }
  }

  // Chuyển conversation cho agent
  async assignToAgent(req, res) {
    try {
      const { sessionId } = req.params;
      const { agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          message: "Agent ID is required",
        });
      }

      const conversation = await chatbotService.assignToAgent(
        sessionId,
        agentId
      );

      res.json({
        success: true,
        data: conversation,
        message: "Conversation assigned successfully",
      });
    } catch (error) {
      console.error("Assign to agent error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to assign conversation",
        error: error.message,
      });
    }
  }

  // Đóng conversation
  async closeConversation(req, res) {
    try {
      const { sessionId } = req.params;
      const conversation = await chatbotService.closeConversation(sessionId);

      res.json({
        success: true,
        data: conversation,
        message: "Conversation closed successfully",
      });
    } catch (error) {
      console.error("Close conversation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to close conversation",
        error: error.message,
      });
    }
  }

  // Lấy thống kê
  async getStatistics(req, res) {
    try {
      const { timeRange = "7d" } = req.query;
      const stats = await chatbotService.getStatistics(timeRange);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Get statistics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get statistics",
        error: error.message,
      });
    }
  }

  // Webhook cho Facebook Messenger
  async facebookWebhook(req, res) {
    try {
      const { body } = req;

      // Verify webhook
      if (body.object === "page") {
        for (const entry of body.entry) {
          const webhookEvent = entry.messaging[0];
          const senderId = webhookEvent.sender.id;
          const message = webhookEvent.message?.text;

          if (message) {
            console.log(`Facebook message from ${senderId}: ${message}`);

            // Tạo hoặc lấy session cho Facebook user
            let conversation = await Conversation.findOne({
              userId: senderId,
              platform: "facebook",
            });

            if (!conversation) {
              const sessionId = await chatbotService.createSession(
                senderId,
                "facebook"
              );
              conversation = await Conversation.findOne({ sessionId });
            }

            // Xử lý tin nhắn
            const response = await chatbotService.processMessage(
              message,
              conversation.sessionId,
              senderId
            );

            // Chỉ gửi phản hồi nếu bot có trả lời
            if (response.text && !response.noReply) {
              await chatbotService.sendFacebookMessage(senderId, response.text);
            } else if (response.escalated && !response.noReply) {
              // Lần đầu escalated, gửi thông báo
              await chatbotService.sendFacebookMessage(senderId, response.text);
            }
            // Nếu noReply = true thì không gửi gì cả, để staff trả lời
          }
        }

        res.status(200).send("EVENT_RECEIVED");
      } else {
        res.sendStatus(404);
      }
    } catch (error) {
      console.error("Facebook webhook error:", error);
      res.status(500).json({
        success: false,
        message: "Webhook processing failed",
        error: error.message,
      });
    }
  }

  // Health check
  async healthCheck(req, res) {
    try {
      res.json({
        success: true,
        message: "Chatbot service is running",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Service health check failed",
        error: error.message,
      });
    }
  }

  // Lấy các message cần review
  async getMessagesNeedReview(req, res) {
    try {
      // Tìm tất cả messages có need_review
      const conversations = await Conversation.find({
        "messages.metadata.need_review": true,
      });
      // Gom tất cả message cần review lại
      let messages = [];
      conversations.forEach((conv) => {
        conv.messages.forEach((msg) => {
          if (msg.metadata && msg.metadata.need_review) {
            messages.push({
              conversationId: conv._id,
              sessionId: conv.sessionId,
              messageId: msg._id,
              text: msg.text,
              intent: msg.intent,
              confidence: msg.confidence,
              createdAt: msg.timestamp,
            });
          }
        });
      });
      res.json({ success: true, data: messages });
    } catch (error) {
      console.error("Get messages need review error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get messages need review",
        error: error.message,
      });
    }
  }

  // Cập nhật intent cho message và bỏ need_review
  async labelMessageIntent(req, res) {
    try {
      const { messageId } = req.params;
      const { intent } = req.body;
      if (!intent) {
        return res
          .status(400)
          .json({ success: false, message: "Intent is required" });
      }
      // Tìm conversation chứa message này
      const conversation = await Conversation.findOne({
        "messages._id": messageId,
      });
      if (!conversation) {
        return res
          .status(404)
          .json({ success: false, message: "Message not found" });
      }
      // Cập nhật intent và bỏ need_review cho message
      conversation.messages.forEach((msg) => {
        if (msg._id.toString() === messageId) {
          msg.intent = intent;
          if (msg.metadata) {
            msg.metadata.need_review = false;
          } else {
            msg.metadata = { need_review: false };
          }
        }
      });
      await conversation.save();
      res.json({ success: true, message: "Intent updated successfully" });
    } catch (error) {
      console.error("Label message intent error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update intent",
        error: error.message,
      });
    }
  }

  // Staff trả lời conversation
  async staffReply(req, res) {
    try {
      const { sessionId } = req.params;
      const { message, agentId } = req.body;

      if (!message || !agentId) {
        return res.status(400).json({
          success: false,
          message: "Message and agentId are required",
        });
      }

      const response = await chatbotService.staffReply(
        sessionId,
        message,
        agentId
      );

      res.json({
        success: true,
        data: response,
        message: "Staff reply sent successfully",
      });
    } catch (error) {
      console.error("Staff reply error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send staff reply",
        error: error.message,
      });
    }
  }
}

module.exports = new ChatbotController();
