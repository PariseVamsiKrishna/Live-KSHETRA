import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Link } from 'lucide-react';
import { useMeeting } from '../../../context/MeetingContext';

export default function ChatSidebar() {
  const { chatMessages, sendChat, setActivePanel, localUser } = useMeeting();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    sendChat(input.trim());
    setInput('');
  }

  return (
    <div className="sidebar-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-meet-border flex-shrink-0">
        <h3 className="font-medium text-meet-text text-sm">In-call messages</h3>
        <button onClick={() => setActivePanel(null)} className="p-1 hover:bg-meet-surface rounded-full">
          <X className="w-4 h-4 text-meet-textSoft" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-meet-textSoft text-xs gap-2 py-8">
            <div className="text-3xl">💬</div>
            <p>Messages sent here are visible to all participants</p>
          </div>
        )}
        {chatMessages.map((msg) => {
          const isSelf = msg.senderName === localUser.name;
          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${isSelf ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5">
                {!isSelf && (
                  <span className="text-meet-blue text-xs font-medium">{msg.senderName}</span>
                )}
                <span className="text-meet-textSoft text-[10px]">
                  {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className={`px-3 py-2 rounded-2xl text-sm max-w-[220px] break-words ${
                  isSelf
                    ? 'bg-meet-blue text-meet-bg rounded-tr-sm'
                    : 'bg-meet-surface text-meet-text rounded-tl-sm'
                }`}
              >
                <AutoLink text={msg.message} />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-meet-border flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            className="meet-input flex-1"
            placeholder="Send a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-meet-blue flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-opacity-90 transition-all flex-shrink-0"
          >
            <Send className="w-4 h-4 text-meet-bg" />
          </button>
        </div>
        <p className="text-meet-textSoft text-[10px] mt-1 text-right">{input.length}/1000</p>
      </form>
    </div>
  );
}

function AutoLink({ text }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
