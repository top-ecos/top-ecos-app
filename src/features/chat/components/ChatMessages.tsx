import { User, AlertCircle } from "lucide-react";
import { forwardRef, useRef } from "react";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  consignes?: string;
}

const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(
  ({ messages, isLoading, consignes }, ref) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = ref || internalRef;

    return (
      <div
        className="flex-1 px-4 py-4 overflow-y-auto bg-white"
        ref={scrollContainerRef}
      >
        <div
          className="space-y-3 min-h-full"
          role="list"
          aria-live="polite"
          aria-atomic="false"
          aria-busy={isLoading}
        >
          {/* Consignes banner */}
          {consignes && (
            <div className="flex justify-start mb-4" role="note" aria-label="Consignes de la station">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 w-full shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
                    <p className="font-semibold mb-1 text-blue-700">Consignes de la station</p>
                    <p className="text-blue-700/80">{consignes}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              role="listitem"
              aria-label={
                message.role === 'system'
                  ? 'Message système'
                  : message.role === 'user'
                  ? 'Votre message'
                  : 'Message du patient'
              }
            >
              {message.role === 'system' ? (
                /* System messages */
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 max-w-full shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
                      {message.content}
                    </div>
                  </div>
                </div>
              ) : message.role === 'user' ? (
                /* Doctor messages — right, green gradient */
                <div className="flex items-end gap-2 max-w-[80%] sm:max-w-md">
                  <div
                    className="text-white px-4 py-3 rounded-[20px] rounded-br-[6px] shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #03BB26 0%, #029921 100%)',
                    }}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ) : (
                /* Patient / AI messages — left, white card */
                <div className="flex items-end gap-2.5 max-w-[80%] sm:max-w-md">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mb-0.5">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <div className="bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-[20px] rounded-bl-[6px] shadow-sm">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start" role="status" aria-live="polite" aria-label="Le patient est en train d'écrire">
              <div className="flex items-end gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <div className="bg-white border border-gray-200 px-4 py-3 rounded-[20px] rounded-bl-[6px] shadow-sm">
                  <div className="flex items-center gap-1.5 h-4">
                    <span
                      className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
                      style={{ animationDelay: '0ms', animationDuration: '1s' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
                      style={{ animationDelay: '200ms', animationDuration: '1s' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
                      style={{ animationDelay: '400ms', animationDuration: '1s' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom spacing */}
          <div className="h-14" />
        </div>
      </div>
    );
  }
);

ChatMessages.displayName = "ChatMessages";

export default ChatMessages;
