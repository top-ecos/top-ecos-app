import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, Send, Loader2, X, Square } from "lucide-react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { toast } from "@/shared/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

interface ChatInputProps {
  inputMessage: string;
  isLoading: boolean;
  isPaused: boolean;
  isTimeUp: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  placeholderText?: string;
}

/** Transcribe audio via the voice-to-text Edge Function (Supabase client handles auth). */
async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
  const formData = new FormData();
  formData.append("audio", audioBlob, `recording.${ext}`);
  formData.append("language", "fr");

  const { data, error } = await supabase.functions.invoke("voice-to-text", {
    body: formData,
  });

  if (error) throw new Error(error.message || "Transcription failed");
  return data?.text ?? "";
}

/** Format seconds as mm:ss */
function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ── Waveform bars component ──
const WaveformBars = () => (
  <>
    <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "24px" }}>
      {[1, 2, 3, 4, 1].map((variant, i) => (
        <div
          key={i}
          className="bg-red-400"
          style={{
            width: "3px",
            borderRadius: "2px",
            animation: `waveBar${variant} 0.8s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
    <style>{`
      @keyframes waveBar1 { 0%,100% { height: 10px; } 50% { height: 22px; } }
      @keyframes waveBar2 { 0%,100% { height: 18px; } 50% { height: 6px; } }
      @keyframes waveBar3 { 0%,100% { height: 6px; } 50% { height: 20px; } }
      @keyframes waveBar4 { 0%,100% { height: 22px; } 50% { height: 8px; } }
    `}</style>
  </>
);

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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseTextRef = useRef<string>("");
  const finalDictationRef = useRef<string>("");
  const unmountedRef = useRef(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Flag to ignore the next transcription result (used by Cancel)
  const ignoreNextResultRef = useRef(false);

  useEffect(() => {
    return () => { unmountedRef.current = true; };
  }, []);

  // ── Stable onResult callback ──
  const handleSpeechResult = useCallback(
    (text: string, isFinal: boolean) => {
      if (unmountedRef.current) return;

      // If cancel was pressed, ignore everything the hook sends back
      if (ignoreNextResultRef.current) {
        if (isFinal) {
          ignoreNextResultRef.current = false;
          setIsTranscribing(false);
        }
        return;
      }

      if (text === "…" && !isFinal) {
        setIsTranscribing(true);
        return;
      }

      setIsTranscribing(false);
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
    [onInputChange],
  );

  const isDisabled = isLoading || isPaused || isTimeUp;

  const { isSupported, isListening, error, engine, start, stop } = useSpeechRecognition({
    lang: "fr-FR",
    maxDurationMs: 120_000,
    onResult: handleSpeechResult,
    transcribeFn: transcribeAudio,
  });

  const sendDisabled = isDisabled || !inputMessage.trim() || isSending;

  // ── Recording timer ──
  useEffect(() => {
    if (isListening) {
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isListening]);

  // ── Stop listening if station becomes disabled ──
  useEffect(() => {
    if (isDisabled && isListening) stop();
  }, [isDisabled, isListening, stop]);

  // ── Error toasts ──
  useEffect(() => {
    if (!error) return;
    const messages: Record<string, string> = {
      "not-allowed": "Autorise le micro pour utiliser la dictée.",
      "service-not-allowed": "Le service micro est bloqué par le navigateur.",
      "no-speech": "Aucun son détecté. Réessaie.",
      "network": "Problème réseau détecté.",
      "start-failed": "Impossible de démarrer la dictée.",
      "whisper-failed": "Erreur de transcription. Réessaie.",
      "unknown": "Erreur de dictée inconnue.",
    };
    toast.error(messages[error] || `Erreur de dictée : ${error}`);
  }, [error]);

  // ── Auto-focus textarea after transcription lands ──
  useEffect(() => {
    if (!isListening && !isTranscribing && inputMessage.trim() && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = inputMessage.length;
      textareaRef.current.setSelectionRange(len, len);
      // Auto-resize textarea to fit content
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [isListening, isTranscribing, inputMessage]);

  // ── Start recording ──
  const handleStartRecording = () => {
    if (isDisabled) return;
    ignoreNextResultRef.current = false;
    baseTextRef.current = inputMessage;
    finalDictationRef.current = "";
    start();
  };

  // ── Stop recording (transcribe → text appears in textarea for review) ──
  const handleStopRecording = useCallback(() => {
    stop();
    // After stop, the hook transcribes and calls handleSpeechResult,
    // which puts the text into the textarea via onInputChange.
    // The user can then review, edit, and send manually.
  }, [stop]);

  // ── Cancel recording (discard audio, no transcription) ──
  const handleCancelRecording = useCallback(() => {
    ignoreNextResultRef.current = true;
    stop();
  }, [stop]);

  // ── Send message (keyboard or button) ──
  const handleSend = useCallback(async () => {
    if (isSending || isDisabled || !inputMessage.trim()) return;

    setIsSending(true);
    try {
      if (!unmountedRef.current) onSend();
    } finally {
      if (!unmountedRef.current) setIsSending(false);
    }
  }, [isSending, inputMessage, isDisabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = isTimeUp
    ? "Temps écoulé"
    : isPaused
      ? "En pause — reprends pour continuer"
      : (placeholderText || "Procède à l'interrogatoire…");

  // ════════════════════════════════════════════
  // STATE 3: Transcription in progress
  // ════════════════════════════════════════════
  if (isTranscribing && !ignoreNextResultRef.current) {
    return (
      <div className="px-3 pb-3 pt-2 bg-white">
        <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-amber-300 bg-amber-50 px-4 py-3">
          <Loader2 className="h-5 w-5 text-amber-500 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-700">Transcription en cours…</p>
            <p className="text-xs text-amber-500 mt-0.5">Le texte va apparaître ci-dessous pour relecture</p>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  // STATE 2: Recording in progress
  // ════════════════════════════════════════════
  if (isListening) {
    return (
      <div className="px-3 pb-3 pt-2 bg-white">
        <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-red-300 bg-red-50 px-4 py-3">
          {/* Waveform animation */}
          <WaveformBars />

          {/* Text + timer */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-red-600">Enregistrement en cours</p>
              <span className="text-xs font-mono text-red-400 tabular-nums">
                {formatTimer(recordingSeconds)}
              </span>
            </div>
            <p className="text-xs text-red-400 mt-0.5">Appuie sur Stop quand tu as fini</p>
          </div>

          {/* Cancel button */}
          <button
            onClick={handleCancelRecording}
            className="h-9 w-9 rounded-full bg-white border border-red-200 flex items-center justify-center hover:bg-red-50 transition-colors flex-shrink-0"
            title="Annuler l'enregistrement"
            aria-label="Annuler l'enregistrement"
          >
            <X className="h-4 w-4 text-red-500" />
          </button>

          {/* Stop button (transcribe → review in textarea) */}
          <button
            onClick={handleStopRecording}
            className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all flex-shrink-0"
            title="Terminer et transcrire"
            aria-label="Terminer et transcrire"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>

        {isTimeUp && (
          <p className="mt-2 text-center text-xs text-red-400 font-medium">
            Temps écoulé · Évalue ta performance ou quitte la station
          </p>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════
  // STATE 1: Idle — keyboard input + mic button
  // ════════════════════════════════════════════
  return (
    <div className="px-3 pb-3 pt-2 bg-white">
      <div
        className={`relative flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all duration-200 ${
          isDisabled
            ? "bg-gray-50 border-gray-200"
            : "bg-gray-50 border-gray-200 focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-sm"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className={`flex-1 resize-none bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none min-h-[44px] max-h-[120px] text-gray-900 placeholder-gray-400 text-sm py-2.5 leading-relaxed ${
            isDisabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
          style={{ height: "auto", minHeight: "44px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 120) + "px";
          }}
        />

        <div className="flex items-center gap-1.5 pb-1 flex-shrink-0">
          {isSupported && (
            <button
              onClick={handleStartRecording}
              disabled={isDisabled}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 bg-white text-gray-500 border border-gray-200 hover:bg-gray-100 hover:text-gray-700 ${
                isDisabled ? "opacity-40 cursor-not-allowed" : ""
              }`}
              title="Démarrer la dictée"
              aria-label="Démarrer la dictée"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={sendDisabled}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 flex-none ${
              sendDisabled
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-[#03BB26] hover:bg-green-600 text-white shadow-sm hover:shadow-md hover:shadow-green-200 active:scale-95"
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
