
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button-premium";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  inputMessage: string;
  isLoading: boolean;
  isPaused: boolean;
  isTimeUp: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  placeholderText?: string;
}

const ChatInput = ({ 
  inputMessage, 
  isLoading, 
  isPaused,
  isTimeUp,
  onInputChange, 
  onSend,
  placeholderText,
}: ChatInputProps) => {
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (isSending || !inputMessage.trim() || isDisabled) return;
    
    setIsSending(true);
    try {
      onSend();
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = isLoading || isPaused || isTimeUp;
  const buttonDisabled = isDisabled || !inputMessage.trim() || isSending;

  return (
    <div className="p-4 bg-white">
      <div className="flex items-end space-x-3">
        <Textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isTimeUp
              ? "Temps écoulé - Impossible de continuer"
              : isPaused
                ? "Station en pause - Clique sur 'Reprendre' pour continuer"
                : (placeholderText || "Procède à l’interrogatoire médical (Entrée pour envoyer, Maj + Entrée pour revenir à la ligne)")
          }
          disabled={isDisabled}
          className={`flex-1 resize-none min-h-[50px] max-h-[120px] bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
            isDisabled ? 'bg-gray-100 opacity-50' : ''
          }`}
          style={{ 
            height: 'auto',
            minHeight: '50px'
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />
        <Button 
          onClick={handleSend}
          disabled={buttonDisabled}
          className="h-[50px] w-[50px] bg-[#03BB26] hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
      
      {isTimeUp && (
        <div className="mt-2 text-center text-red-600 font-medium">
          Le temps est écoulé. C'est le moment d'évaluer ta performance ou de quitter la station.
        </div>
      )}
    </div>
  );
};

export default ChatInput;
