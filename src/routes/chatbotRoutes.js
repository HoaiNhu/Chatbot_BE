const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbotController");
const rateLimit = require("express-rate-limit");

// Rate limiting
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many messages from this IP, please try again later.",
});

// Health check
router.get("/health", chatbotController.healthCheck);

// Session management
router.post("/session", chatbotController.createSession);

// Message handling
router.post("/message", messageLimiter, chatbotController.sendMessage);

// Conversation history
router.get(
  "/conversation/:sessionId/history",
  chatbotController.getConversationHistory
);

// Conversation management (for admin/agent)
router.get("/conversations", chatbotController.getConversations);
router.get(
  "/conversations/escalated",
  chatbotController.getEscalatedConversations
);
router.post("/conversation/:sessionId/reply", chatbotController.staffReply);
router.post(
  "/conversation/:sessionId/rate",
  chatbotController.rateConversation
);
router.post("/conversation/:sessionId/assign", chatbotController.assignToAgent);
router.post(
  "/conversation/:sessionId/close",
  chatbotController.closeConversation
);

// Statistics
router.get("/statistics", chatbotController.getStatistics);

// Facebook Messenger webhook
router.post("/webhook/facebook", async (req, res, next) => {
  try {
    await chatbotController.facebookWebhook(req, res);
    // Sau khi xử lý webhook, emit message mới qua socket.io
    const io = req.app.locals.io;
    const { senderId, messageText } = req.body; // Cần đảm bảo controller trả về hoặc lưu thông tin này
    if (io && senderId && messageText) {
      io.emit("new_message", {
        text: messageText,
        sender: "facebook",
        userId: senderId,
        timestamp: new Date(),
      });
    }
  } catch (err) {
    next(err);
  }
});

// Webhook verification for Facebook
router.get("/webhook/facebook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Thêm API lấy message cần review
router.get("/messages/need-review", chatbotController.getMessagesNeedReview);

// Thêm API cập nhật nhãn intent cho message
router.post("/messages/:messageId/label", chatbotController.labelMessageIntent);

module.exports = router;
