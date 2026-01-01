import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 模擬AI回應
  const getMockResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    // 檢查是否詢問特定股票
    if (lowerMessage.includes('2330') || lowerMessage.includes('台積電')) {
      return '台積電（2330）是台灣最大的半導體製造公司，也是全球晶圓代工龍頭。近期受惠於AI晶片需求強勁，營運表現持續亮眼。目前股價在高檔震盪，建議關注其月營收公告和法說會內容。';
    }
    
    if (lowerMessage.includes('2454') || lowerMessage.includes('聯發科')) {
      return '聯發科（2454）是全球IC設計大廠，主要產品包括手機晶片和AI處理器。公司積極布局5G和AI領域，近期推出的天璣系列晶片在市場上獲得不錯反響。';
    }
    
    if (lowerMessage.includes('2317') || lowerMessage.includes('鴻海')) {
      return '鴻海（2317）是全球最大的電子代工廠，客戶包括Apple等國際大廠。近年積極轉型，投資電動車、半導體等新事業。成交值通常較高，是台股重要指標股之一。';
    }
    
    // 檢查是否詢問新聞或市場資訊
    if (lowerMessage.includes('新聞') || lowerMessage.includes('消息')) {
      return '目前台股市場關注重點包括：美國聯準會利率政策、AI產業發展、台灣出口數據等。建議您關注財經新聞網站如鉅亨網、經濟日報等獲取最新資訊。';
    }
    
    if (lowerMessage.includes('建議') || lowerMessage.includes('推薦')) {
      return '投資建議因人而異，需考慮個人風險承受度和投資目標。一般建議：1) 分散投資降低風險 2) 定期定額長期投資 3) 做好功課了解投資標的 4) 不要追高殺低。本系統僅供參考，實際投資請諮詢專業理財顧問。';
    }
    
    if (lowerMessage.includes('成交值') || lowerMessage.includes('排行')) {
      return '成交值代表當日股票交易的總金額，是衡量市場熱度的重要指標。成交值高的股票通常流動性較好，但也可能伴隨較大波動。您可以在上方的排行榜中查看最新的上市和上櫃成交值排行。';
    }
    
    // 預設回應
    return '您好！我可以幫您查詢台股個股資訊和市場動態。您可以詢問：\n• 特定股票資訊（例如：台積電最近表現如何？）\n• 市場新聞和趨勢\n• 投資相關問題\n\n請問有什麼我可以幫助您的嗎？';
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    // 添加用戶消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // 模擬AI思考時間
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getMockResponse(inputValue),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* 浮動按鈕 */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-blue-700 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>

      {/* 聊天視窗 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-[calc(100vw-3rem)] max-w-sm bg-white rounded-lg shadow-2xl z-50 flex flex-col"
            style={{ height: '500px', maxHeight: 'calc(100vh - 150px)' }}
          >
            {/* 標題欄 */}
            <div className="bg-blue-600 text-white p-4 rounded-t-lg">
              <h3 className="font-semibold">AI 股票助手</h3>
              <p className="text-xs text-blue-100 mt-1">詢問個股資訊或市場動態</p>
            </div>

            {/* 消息區域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">開始對話，詢問股票相關問題</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString('zh-TW', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* 輸入區域 */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="輸入訊息..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isTyping}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping}
                  className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                * 目前為模擬回應，僅供展示使用
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
