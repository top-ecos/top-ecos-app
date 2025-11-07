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

    // Markdown formatting not used; render plain text for safety

  return (
      <div 
        className="flex-1 px-6 py-4 overflow-y-auto bg-white" 
        ref={scrollContainerRef}
      >
        <div
          className="space-y-4 min-h-full"
          role="list"
          aria-live="polite"
          aria-atomic="false"
          aria-busy={isLoading}
        >
          {consignes && (
            <div className="flex justify-start" role="note" aria-label="Consignes de la station">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-xl md:max-w-none md:w-full shadow-sm">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
                    <p className="font-semibold mb-1">Consignes de la station</p>
                    <p>{consignes}</p>
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
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-full shadow-sm">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
                      {message.content}
                    </div>
                  </div>
                </div>
              ) : message.role === 'user' ? (
                /* Doctor messages (on the right, green) */
                <div className="flex items-end space-x-2 max-w-[85%] sm:max-w-lg">
                  <div className="bg-green-500 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl rounded-br-md shadow-sm">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ) : (
                /* Patient messages (on the left, gray with avatar) */
                <div className="flex items-start space-x-3 max-w-[85%] sm:max-w-lg">
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 text-gray-900 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl rounded-bl-md shadow-sm">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start" role="status" aria-live="polite" aria-label="Le patient est en train d'écrire">
              <div className="flex items-start space-x-3 max-w-lg">
                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Espacement en bas pour s'assurer du scroll complet */}
          <div className="h-8" />
        </div>
      </div>
    );
  }
);

ChatMessages.displayName = "ChatMessages";

export default ChatMessages;
