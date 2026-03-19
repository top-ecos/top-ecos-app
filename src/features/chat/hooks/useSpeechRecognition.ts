import { useCallback, useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type UseSpeechRecognitionOptions = {
  lang?: string;
  maxDurationMs?: number;
  onResult?: (text: string, isFinal: boolean) => void;
  /**
   * Async function that receives an audio Blob and returns the transcript.
   * When provided, Whisper (via this function) is used for ALL browsers.
   * When absent, the hook falls back to the native Web Speech API (if available).
   */
  transcribeFn?: (audioBlob: Blob) => Promise<string>;
};

type UseSpeechRecognitionReturn = {
  isSupported: boolean;
  isListening: boolean;
  error: string | null;
  engine: "native" | "whisper" | null;
  start: () => void;
  stop: () => void;
};

// ────────────────────────────────────────────────────────────
// Native fallback types (only used when transcribeFn is absent)
// ────────────────────────────────────────────────────────────

interface NativeSpeechRecognition {
  start(): void;
  stop(): void;
  abort(): void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
  onaudiostart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => NativeSpeechRecognition;

function getNativeCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ────────────────────────────────────────────────────────────
// MediaRecorder helpers
// ────────────────────────────────────────────────────────────

interface WhisperSession {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
}

async function startWhisperSession(): Promise<WhisperSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "";

  const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start(250);
  return { mediaRecorder, stream, chunks };
}

function stopWhisperSession(session: WhisperSession): Promise<Blob> {
  return new Promise((resolve) => {
    session.mediaRecorder.onstop = () => {
      session.stream.getTracks().forEach((t) => t.stop());
      const mime = session.mediaRecorder.mimeType || "audio/webm";
      resolve(new Blob(session.chunks, { type: mime }));
    };
    if (session.mediaRecorder.state !== "inactive") {
      session.mediaRecorder.stop();
    } else {
      session.stream.getTracks().forEach((t) => t.stop());
      const mime = session.mediaRecorder.mimeType || "audio/webm";
      resolve(new Blob(session.chunks, { type: mime }));
    }
  });
}

// ────────────────────────────────────────────────────────────
// Main hook
// ────────────────────────────────────────────────────────────

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    lang = "fr-FR",
    maxDurationMs = 60_000,
    onResult,
    transcribeFn,
  } = options;

  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const transcribeFnRef = useRef(transcribeFn);
  useEffect(() => { transcribeFnRef.current = transcribeFn; }, [transcribeFn]);

  // ── Engine selection: Whisper if transcribeFn provided, native as fallback ──
  const nativeCtorRef = useRef<SpeechRecognitionCtor | null>(getNativeCtor());
  const hasWhisper = !!transcribeFn && typeof navigator?.mediaDevices?.getUserMedia === "function";
  const hasNative = !!nativeCtorRef.current;

  // Whisper is ALWAYS preferred when available (glossary médical)
  const useWhisperEngine = hasWhisper;
  const useNative = hasNative && !hasWhisper;

  const [isSupported] = useState<boolean>(useWhisperEngine || useNative);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<"native" | "whisper" | null>(null);

  const startingRef = useRef(false);

  // Refs
  const recognitionRef = useRef<NativeSpeechRecognition | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperSessionRef = useRef<WhisperSession | null>(null);
  const whisperTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (silenceRef.current) clearTimeout(silenceRef.current);
    if (whisperTimeoutRef.current) clearTimeout(whisperTimeoutRef.current);
    timeoutRef.current = null;
    silenceRef.current = null;
    whisperTimeoutRef.current = null;
  }, []);

  const disposeNativeInstance = useCallback((rec: NativeSpeechRecognition | null) => {
    if (!rec) return;
    rec.onstart = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onspeechend = null;
    rec.onaudiostart = null;
    try { rec.abort(); } catch { /* noop */ }
  }, []);

  // ── STOP ──

  const stop = useCallback(async () => {
    clearAllTimers();
    startingRef.current = false;

    // Native cleanup
    const rec = recognitionRef.current;
    if (rec) {
      recognitionRef.current = null;
      disposeNativeInstance(rec);
    }

    // Whisper cleanup + transcription
    const session = whisperSessionRef.current;
    if (session) {
      whisperSessionRef.current = null;
      try {
        const audioBlob = await stopWhisperSession(session);
        if (audioBlob.size > 0 && transcribeFnRef.current) {
          onResultRef.current?.("…", false); // processing signal
          const transcript = await transcribeFnRef.current(audioBlob);
          if (transcript.trim()) {
            onResultRef.current?.(transcript.trim(), true);
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "whisper-failed");
      }
    }

    setIsListening(false);
    setEngine(null);
  }, [clearAllTimers, disposeNativeInstance]);

  // ── Native silence timer (fallback only) ──

  const armNativeSilence = useCallback(() => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    silenceRef.current = setTimeout(() => { stop(); }, 2_000);
  }, [stop]);

  // ── START Native (fallback — only when transcribeFn is absent) ──

  const startNative = useCallback(() => {
    const Ctor = nativeCtorRef.current;
    if (!Ctor) return;

    if (recognitionRef.current) {
      disposeNativeInstance(recognitionRef.current);
      recognitionRef.current = null;
    }

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;

    rec.onstart = () => {
      setIsListening(true);
      setError(null);
      setEngine("native");
      startingRef.current = false;
      armNativeSilence();
    };

    rec.onresult = (event: any) => {
      try {
        armNativeSilence();
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) final += res[0]?.transcript ?? "";
          else interim += res[0]?.transcript ?? "";
        }
        if (interim) onResultRef.current?.(interim, false);
        if (final) onResultRef.current?.(final, true);
      } catch { /* swallow */ }
    };

    rec.onerror = (event: any) => {
      const code = event?.error ?? "unknown";
      if (code === "aborted") return;
      setError(code);
      stop();
    };

    rec.onspeechend = () => {};
    rec.onaudiostart = () => { armNativeSilence(); };

    rec.onend = () => {
      clearAllTimers();
      setIsListening(false);
      setEngine(null);
      recognitionRef.current = null;
      startingRef.current = false;
    };

    recognitionRef.current = rec;
    rec.start();

    timeoutRef.current = setTimeout(() => { stop(); }, Math.max(1_000, maxDurationMs));
  }, [lang, maxDurationMs, armNativeSilence, clearAllTimers, disposeNativeInstance, stop]);

  // ── START Whisper (primary — MediaRecorder → transcribeFn) ──

  const startWhisper = useCallback(async () => {
    try {
      const session = await startWhisperSession();
      whisperSessionRef.current = session;

      setIsListening(true);
      setError(null);
      setEngine("whisper");
      startingRef.current = false;

      whisperTimeoutRef.current = setTimeout(() => { stop(); }, Math.max(1_000, maxDurationMs));
    } catch (e: any) {
      startingRef.current = false;
      setError(e?.name === "NotAllowedError" ? "not-allowed" : "start-failed");
      setIsListening(false);
    }
  }, [maxDurationMs, stop]);

  // ── START (unified) ──

  const start = useCallback(() => {
    if (!isSupported || startingRef.current || isListening) return;
    startingRef.current = true;

    if (useWhisperEngine) {
      startWhisper();
    } else if (useNative) {
      startNative();
    } else {
      startingRef.current = false;
    }
  }, [isSupported, isListening, useWhisperEngine, useNative, startWhisper, startNative]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      clearAllTimers();
      disposeNativeInstance(recognitionRef.current);
      recognitionRef.current = null;
      const session = whisperSessionRef.current;
      if (session) {
        try { session.mediaRecorder.stop(); } catch { /* noop */ }
        session.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [clearAllTimers, disposeNativeInstance]);

  return { isSupported, isListening, error, engine, start, stop };
}
