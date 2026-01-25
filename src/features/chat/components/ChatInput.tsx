
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button-premium";
import { Textarea } from "@/shared/components/ui/textarea";
import { Mic, MicOff, Send } from "lucide-react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { toast } from "@/shared/components/ui/sonner";

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
  const baseTextRef = useRef<string>("");
  const finalDictationRef = useRef<string>("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (isSending || !inputMessage.trim() || isDisabled) return;

    // If dictation is active, stop first and wait for it to end
    if (isListening) {
      stop();
      const started = Date.now();
      // Wait up to 1500ms for isListening to flip to false
      while (Date.now() - started < 1500) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
        if (!isListening) break;
      }
    }

    setIsSending(true);
    try {
      onSend();
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = isLoading || isPaused || isTimeUp;
  const buttonDisabled = isDisabled || !inputMessage.trim() || isSending;

  // Speech recognition integration
  const { isSupported, isListening, error, start, stop } = useSpeechRecognition({
    lang: "fr-FR",
    interimResults: true,
    continuous: false,
    maxDurationMs: 60000,
    silenceMs: 3500,
    onResult: (text, isFinal) => {
      const base = baseTextRef.current || "";
      const prevFinal = finalDictationRef.current || "";
      if (isFinal) {
        finalDictationRef.current = `${prevFinal}${prevFinal ? " " : ""}${text}`.trim();
        const merged = `${base} ${finalDictationRef.current}`.trim();
        onInputChange(merged);
      } else {
        const preview = `${base} ${prevFinal} ${text}`.trim();
        onInputChange(preview);
      }
    },
  });

  // Stop dictation if input becomes disabled (pause/timeup/loading)
  useEffect(() => {
    if (isDisabled && isListening) {
      stop();
    }
  }, [isDisabled, isListening, stop]);

  // Surface common errors as toasts (non-blocking)
  useEffect(() => {
    if (!error) return;
    const messages: Record<string, string> = {
      'not-allowed': "Autorise le micro pour utiliser la dictée.",
      'service-not-allowed': "Le service micro est bloqué par le navigateur.",
      'no-speech': "Aucun son détecté. Réessaie.",
      'network': "Problème réseau détecté.",
      'start-failed': "Impossible de démarrer la dictée.",
      'unknown': "Erreur de dictée inconnue.",
    };
    toast.error(messages[error] || `Erreur de dictée: ${error}`);
  }, [error]);

  const toggleListening = () => {
    if (isDisabled) return;
    if (!isListening) {
      baseTextRef.current = inputMessage;
      finalDictationRef.current = "";
      start();
    } else {
      stop();
    }
  };

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
        {isSupported && (
          <Button
            onClick={toggleListening}
            disabled={isDisabled}
            className={`h-[50px] w-[50px] rounded-full flex items-center justify-center transition-colors duration-200 border ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white border-red-600 shadow-lg shadow-red-200'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
            aria-label={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
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
