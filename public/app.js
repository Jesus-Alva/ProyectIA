const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const status = document.querySelector("#status");
const welcome = document.querySelector(".welcome");

let conversationId = null;

function addMessage(text, role) {
  const message = document.createElement("div");
  message.className = `message message-${role}`;
  message.textContent = text;
  messages.append(message);
  message.scrollIntoView({ behavior: "smooth", block: "end" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();

  if (!message || message.length > 2000 || sendButton.disabled) {
    return;
  }

  welcome.hidden = true;
  addMessage(message, "user");
  input.value = "";
  sendButton.disabled = true;
  status.textContent = "Escribiendo…";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo enviar el mensaje.");
    }

    conversationId = result.conversation_id;
    addMessage(result.reply, "assistant");
  } catch (error) {
    addMessage(error.message, "assistant");
  } finally {
    status.textContent = "";
    sendButton.disabled = false;
    input.focus();
  }
});
