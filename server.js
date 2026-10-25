const express = require("express");
const Groq = require("groq-sdk");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.get("/", (_req, res) => res.send("Cortex AI server is running"));

app.post("/api/chat", limiter, async (req, res) => {
  try {
    const incoming = req.body && req.body.messages;
    if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 22) {
      return res.status(400).json({ error: "Некорректная история чата" });
    }
    const messages = [];
    messages.push({
      role: "system",
      content: "Ты Cortex AI — дружелюбный и умный помощник. Отвечай на русском языке, понятно и по делу. Используй markdown: код оборачивай в тройные обратные кавычки с указанием языка, списки через -, важное выделяй **жирным**."
    });
    for (const item of incoming) {
      if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string" || item.content.length > 4000) {
        return res.status(400).json({ error: "Некорректное сообщение" });
      }
      messages.push({ role: item.role, content: item.content });
    }
    const last = messages[messages.length - 1];
    if (last.role !== "user") return res.status(400).json({ error: "Последнее сообщение должно быть вопросом пользователя" });

    const result = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.7,
      max_tokens: 2048
    });
    return res.json({ reply: result.choices?.[0]?.message?.content || "Не удалось получить ответ." });
  } catch (error) {
    // Do not log secrets or raw provider errors to the public response.
    console.error("Cortex chat request failed");
    return res.status(500).json({ error: "Не удалось получить ответ от ИИ" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Cortex server listening on ${port}`));
