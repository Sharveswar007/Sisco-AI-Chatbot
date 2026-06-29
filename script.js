const chatBox = document.getElementById("chat-box");
const historyList = document.getElementById("history-list");
const newChatBtn = document.getElementById("new-chat-btn");
const userInput = document.getElementById("user-input");

const DEFAULT_SYSTEM_PROMPT = {
  role: "system",
  content: `You are Sisco-AI, a smart and friendly AI assistant powered by Groq. You are helpful, concise, and speak in simple, clear English.

Your personality is calm, professional, and supportive. If the user ever asks about your identity, always reply:
"I am Sisco-AI, your personal assistant powered by Groq 🤖."

You can answer questions, explain concepts, tell jokes, and help users with coding, homework, and general knowledge.

Avoid saying 'As an AI language model'. Just be a helpful assistant.`,
};

let sessions = [];
let currentSessionId = null;

// Initialize history
function initHistory() {
  const saved = localStorage.getItem("siscoSessions");
  if (saved) {
    try {
      sessions = JSON.parse(saved);
    } catch(e) {
      console.error("Failed to parse history", e);
      sessions = [];
    }
  }

  if (sessions.length === 0) {
    createNewSession();
  } else {
    // Load the most recent session
    loadSession(sessions[0].id);
  }
  
  renderSidebar();
}

function createNewSession() {
  const newSession = {
    id: Date.now().toString(),
    title: "New Chat",
    messages: [DEFAULT_SYSTEM_PROMPT]
  };
  sessions.unshift(newSession); // add to top
  saveSessions();
  loadSession(newSession.id);
  renderSidebar();
}

function loadSession(id) {
  currentSessionId = id;
  chatBox.innerHTML = "";
  
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  
  if (session.messages.length === 1) {
     displayMessage("bot", "Hello! How can I assist you today?", false);
  } else {
    session.messages.forEach(msg => {
      if (msg.role !== "system") {
        displayMessage(msg.role === "assistant" || msg.role === "bot" ? "bot" : "user", msg.content, false);
      }
    });
  }
  setTimeout(() => chatBox.scrollTop = chatBox.scrollHeight, 50);
  
  // Update active state in sidebar
  document.querySelectorAll(".history-item").forEach(item => {
    item.classList.toggle("active", item.dataset.id === id);
  });
}

function saveSessions() {
  localStorage.setItem("siscoSessions", JSON.stringify(sessions));
}

function renderSidebar() {
  historyList.innerHTML = "";
  sessions.forEach(session => {
    const li = document.createElement("div");
    li.className = "history-item";
    if (session.id === currentSessionId) li.classList.add("active");
    li.dataset.id = session.id;
    
    li.innerHTML = `
      <div class="history-title">${escapeHtml(session.title)}</div>
      <button class="delete-btn" aria-label="Delete chat" title="Delete chat">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
      </button>
    `;
    
    // Click title to load session
    li.querySelector('.history-title').addEventListener("click", () => {
      loadSession(session.id);
    });
    
    // Delete session
    li.querySelector('.delete-btn').addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });
    
    historyList.appendChild(li);
  });
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  saveSessions();
  if (sessions.length === 0) {
    createNewSession();
  } else if (currentSessionId === id) {
    loadSession(sessions[0].id);
  }
  renderSidebar();
}

// Generate a title based on first user message
function generateTitle(message) {
  return message.length > 30 ? message.substring(0, 30) + '...' : message;
}

document.querySelector(".chat-footer").addEventListener("submit", function (e) {
  e.preventDefault();
  sendMessage();
});

newChatBtn.addEventListener("click", createNewSession);

async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;
  
  if (session.title === "New Chat" && session.messages.length === 1) {
    session.title = generateTitle(userMessage);
    renderSidebar(); // Update title in sidebar
  }

  displayMessage("user", userMessage);
  userInput.value = "";

  // Identity override
  const lower = userMessage.toLowerCase();
  const identityTriggers = ["who are you", "your name", "what is your name", "are you a bot"];
  if (identityTriggers.some(trigger => lower.includes(trigger))) {
    const botReply = "I am Sisco-AI, your personal assistant powered by Groq 🤖.";
    displayMessage("bot", botReply);
    session.messages.push({ role: "user", content: userMessage });
    session.messages.push({ role: "assistant", content: botReply });
    saveSessions();
    return;
  }

  session.messages.push({ role: "user", content: userMessage });
  saveSessions();

  try {
    // Call the Netlify Serverless Function instead of Groq directly
    const response = await fetch("/.netlify/functions/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: session.messages
      })
    });

    const data = await response.json();
    const botReply = data.choices?.[0]?.message?.content || "Sorry, I didn’t get that.";
    displayMessage("bot", botReply);

    session.messages.push({ role: "assistant", content: botReply });
    saveSessions();
  } catch (error) {
    console.error("Error:", error);
    displayMessage("bot", "Oops! Something went wrong.");
  }
}

function renderMessageContent(message) {
  return message.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre class="chat-code"><code class="${lang}">${escapeHtml(code)}</code></pre>`;
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function displayMessage(sender, message, smoothScroll = true) {
  const msgElement = document.createElement("div");
  msgElement.classList.add("message");
  msgElement.classList.add(sender === "user" ? "user" : "bot");
  msgElement.innerHTML = renderMessageContent(message);
  chatBox.appendChild(msgElement);
  
  if (smoothScroll) {
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
  } else {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  
  if (typeof hljs !== 'undefined') {
    msgElement.querySelectorAll('pre code').forEach((el) => {
      hljs.highlightElement(el);
    });
  }
}

// Initialize on load
initHistory();
