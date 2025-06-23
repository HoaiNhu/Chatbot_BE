const fs = require("fs");
const mongoose = require("mongoose");
const Conversation = require("./src/models/Conversation");

// Kết nối MongoDB (sửa lại URI cho đúng nếu cần)
mongoose.connect(`${process.env.MONGODB_URI}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function exportData() {
  try {
    const conversations = await Conversation.find({
      "messages.intent": { $ne: null },
    });
    const data = [];
    conversations.forEach((conv) => {
      conv.messages.forEach((msg) => {
        if (
          msg.sender === "user" &&
          msg.intent &&
          (!msg.metadata || !msg.metadata.need_review)
        ) {
          data.push({ text: msg.text, intent: msg.intent });
        }
      });
    });
    // Đường dẫn tới file data.json của backend Python
    fs.writeFileSync(
      "../Proj1_Chatbot/data/data.json",
      JSON.stringify(data, null, 2)
    );
    console.log("Exported training data!");
    process.exit();
  } catch (err) {
    console.error("Export error:", err);
    process.exit(1);
  }
}

exportData();
