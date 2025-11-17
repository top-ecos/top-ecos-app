import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseSpeechRecognitionOptions = {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  maxDurationMs?: number;
  onResult?: (text: string, isFinal: boolean) => void;
};

type UseSpeechRecognitionReturn = {
  isSupported: boolean;
  isListening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
};

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const {
    lang = "fr-FR",
    interimResults = true,
    continuous = false,
    maxDurationMs = 20000,
    onResult,
  } = options;

  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  }, []);

  const [isSupported, setIsSupported] = useState<boolean>(!!SpeechRecognition);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const permissionDeniedRef = useRef(false);

  const recognitionRef = useRef<any | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const stop = useCallback(() => {
    try {
      clearTimer();
      if (recognitionRef.current) {
        // Calling stop triggers onend
        recognitionRef.current.stop();
      }
    } catch {
      // no-op
    }
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition || permissionDeniedRef.current) {
      setIsSupported(false);
      return;
    }
    if (isListening) return;

    try {
      const rec: any = new (SpeechRecognition as any)();
      rec.lang = lang;
      rec.interimResults = interimResults;
      rec.continuous = continuous;

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      rec.onresult = (event: any) => {
        try {
          let interim = "";
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) final += res[0]?.transcript ?? "";
            else interim += res[0]?.transcript ?? "";
          }
          if (interim && onResult) onResult(interim, false);
          if (final && onResult) onResult(final, true);
        } catch (e) {
          // swallow parsing errors
        }
      };

      rec.onerror = (event: any) => {
        // Common errors: 'not-allowed', 'service-not-allowed', 'no-speech', 'network'
        const code = event?.error ?? "unknown";
        setError(code);
        if (code === "not-allowed" || code === "service-not-allowed") {
          permissionDeniedRef.current = true;
          setIsSupported(false);
        }
        stop();
      };

      rec.onspeechend = () => {
        // User stopped speaking
        stop();
      };

      rec.onend = () => {
        clearTimer();
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();

      // Safety timeout
      timeoutRef.current = window.setTimeout(() => {
        stop();
      }, Math.max(1000, maxDurationMs));
    } catch (e) {
      setError("start-failed");
      setIsSupported(!!SpeechRecognition);
    }
  }, [SpeechRecognition, continuous, interimResults, isListening, lang, maxDurationMs, onResult, stop]);

  useEffect(() => {
    return () => {
      clearTimer();
      try {
        recognitionRef.current?.abort?.();
      } catch {}
    };
  }, []);

  return { isSupported, isListening, error, start, stop };
}

