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
router.post("/webhook/facebook", chatbotController.facebookWebhook);

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

module.exports = router;
