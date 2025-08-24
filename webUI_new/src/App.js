import "./App.css";
import logo from "./post_finance_logo.png";
import botAvatar from "./avatar.png";
import { useState, useEffect, useRef } from "react";
import Lottie, { Player } from "lottie-react";
import loadingGif from "./loading.gif";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showQuickQuestion, setShowQuickQuestion] = useState(true);
  const [loading, setLoading] = useState(false);
  const [animationData, setAnimationData] = useState(null);
  <script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>;

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetch(
      "https://lottie.host/ac4d6d35-3187-42be-b1ea-102b9a127929/MjC2Y8QfXg.json"
    )
      .then((res) => res.json())
      .then((data) => setAnimationData(data));
  }, []);

  const getBotResponse = async (userMessage) => {
    try {
      const response = await fetch(
        "https:api-bernhackt.letbotchat.com/ask-db",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ question: userMessage }),
        }
      );

      const data = await response.json();

      // API'nin döndürdüğü cevabı al
      return data.answer || "The bot did not respond.";
    } catch (error) {
      console.error("API error:", error);
      return "An error occurred, please try again.";
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);

    setInput(""); // input'u hemen temizle
    setShowQuickQuestion(false);
    setLoading(true); // loading başlasın

    const botReplyText = await getBotResponse(userMessage.text);
    const botMessage = { sender: "bot", text: botReplyText };
    setMessages((prev) => [...prev, botMessage]);

    setLoading(false); // loading bitsin
  };

  return (
    <main className="main">
      <div className="container">
        <header className="header">
          <div className="branding">
            <img src={logo} alt="React Router" className="logo" />
            <p className="text-[64px]">SpendCast</p>
            <div className="chat-wrapper">
              <div className="chat-box">
                <h2 className="chat-heading">
                  SpendCast Assistant - Ask me something
                </h2>

                {showQuickQuestion && (
                  <div className="quick-question">
                    {[
                      "How many product I have?",
                      "Show only the products I purchased in July and their prices.",
                      "Display only the items I bought in July along with their prices.",
                    ].map((question, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          const userMessage = {
                            sender: "user",
                            text: question,
                          };
                          setMessages((prev) => [...prev, userMessage]);
                          setShowQuickQuestion(false);
                          setLoading(true); // Loading başlasın

                          getBotResponse(question).then((botReplyText) => {
                            const botMessage = {
                              sender: "bot",
                              text: botReplyText,
                              avatar: botAvatar,
                            };
                            setMessages((prev) => [...prev, botMessage]);
                            setLoading(false); // Loading bitsin
                          });
                        }}
                        className="quick-question-item"
                      >
                        {question}
                      </div>
                    ))}
                  </div>
                )}

                <div className="messages">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`message ${
                        msg.sender === "user" ? "user" : "bot"
                      }`}
                    >
                      {msg.sender === "bot" && msg.avatar && (
                        <img
                          src={msg.avatar}
                          alt="Bot Avatar"
                          className="bot-avatar"
                        />
                      )}
                      {msg.text}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                {loading && (
                  <div className="animation">
                    <Lottie
                      animationData={animationData}
                      loop={true}
                      style={{ width: 120, height: 120 }}
                    />
                  </div>
                )}
                <div className="input-area">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="input"
                    placeholder="Please write your message..."
                  />
                  <button onClick={handleSend} className="send-button">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>
      <p className="info">
        The analysis is based on 2024 data made available by PostFinance
      </p>
    </main>
  );
}

export default App;
