import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseSpeechRecognitionOptions = {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  maxDurationMs?: number;
  silenceMs?: number;
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
    maxDurationMs = 45000,
    silenceMs = 2000,
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
  const silenceRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const clearSilence = () => {
    if (silenceRef.current) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  };

  const armSilence = () => {
    clearSilence();
    silenceRef.current = window.setTimeout(() => {
      // Manual stop after extended silence
      stop();
    }, Math.max(500, silenceMs));
  };

  const stop = useCallback(() => {
    try {
      clearTimer();
      clearSilence();
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
        armSilence();
      };

      rec.onresult = (event: any) => {
        try {
          // Reset silence timer on every result
          armSilence();
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

      // Native onspeechend can be overly aggressive (~0.5s pauses).
      // We rely on our extended silence timer instead of stopping here.
      rec.onspeechend = () => {
        // Intentionally no-op; silence timer will handle stopping.
      };

      rec.onaudiostart = () => {
        armSilence();
      };

      rec.onend = () => {
        clearTimer();
        clearSilence();
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
