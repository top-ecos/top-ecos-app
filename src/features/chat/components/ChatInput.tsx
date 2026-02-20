
import { useEffect, useRef, useState } from "react";
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

    if (isListening) {
      stop();
      const started = Date.now();
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

  const { isSupported, isListening, error, start, stop } = useSpeechRecognition({
    lang: "fr-FR",
    interimResults: true,
    continuous: true,
    maxDurationMs: 60000,
    silenceMs: 2000,
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

  useEffect(() => {
    if (isDisabled && isListening) stop();
  }, [isDisabled, isListening, stop]);

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

  const placeholder = isTimeUp
    ? "Temps écoulé"
    : isPaused
      ? "En pause — reprends pour continuer"
      : (placeholderText || "Procède à l'interrogatoire…");

  return (
    <div className="px-3 pb-3 pt-2 bg-white">
      {/* Unified pill input container */}
      <div
        className={`flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all duration-200 ${
          isDisabled
            ? 'bg-gray-50 border-gray-200'
            : 'bg-gray-50 border-gray-200 focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-sm'
        }`}
      >
        {/* Mic pulse ring when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-2xl pointer-events-none animate-ping border-2 border-red-300 opacity-30" />
        )}

        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className={`flex-1 resize-none bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none min-h-[44px] max-h-[120px] text-gray-900 placeholder-gray-400 text-sm py-2.5 leading-relaxed ${
            isDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ height: 'auto', minHeight: '44px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />

        <div className="flex items-center gap-1.5 pb-1 flex-shrink-0">
          {isSupported && (
            <button
              onClick={toggleListening}
              disabled={isDisabled}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white shadow-md shadow-red-200 scale-105'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100 hover:text-gray-700'
              } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
              aria-label={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={buttonDisabled}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 flex-none ${
              buttonDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#03BB26] hover:bg-green-600 text-white shadow-sm hover:shadow-md hover:shadow-green-200 active:scale-95'
            }`}
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isTimeUp && (
        <p className="mt-2 text-center text-xs text-red-400 font-medium">
          Temps écoulé · Évalue ta performance ou quitte la station
        </p>
      )}
    </div>
  );
};

export default ChatInput;
