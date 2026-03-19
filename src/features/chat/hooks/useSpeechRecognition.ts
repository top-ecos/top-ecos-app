import { useCallback, useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type UseSpeechRecognitionOptions = {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  maxDurationMs?: number;
  silenceMs?: number;
  onResult?: (text: string, isFinal: boolean) => void;
  whisperEndpoint?: string;
  whisperApiKey?: string;
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
// Helpers
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
// Whisper engine — MediaRecorder → backend
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

async function transcribeWithWhisper(
  audioBlob: Blob,
  endpoint: string,
  lang: string,
  apiKey?: string,
): Promise<string> {
  const formData = new FormData();
  const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
  formData.append("audio", audioBlob, `recording.${ext}`);
  formData.append("language", lang.split("-")[0]);

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["apikey"] = apiKey;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Whisper API error: ${res.status}`);
  }

  const data = await res.json();
  return data.text ?? "";
}

// ────────────────────────────────────────────────────────────
// Main hook
// ────────────────────────────────────────────────────────────

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    lang = "fr-FR",
    interimResults = true,
    continuous = false,
    maxDurationMs = 45_000,
    silenceMs = 2_000,
    onResult,
    whisperEndpoint,
    whisperApiKey,
  } = options;

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // ── Engine selection ──
  const nativeCtorRef = useRef<SpeechRecognitionCtor | null>(getNativeCtor());
  const hasNativeCtor = !!nativeCtorRef.current;
  const hasWhisper = !!whisperEndpoint && typeof navigator?.mediaDevices?.getUserMedia === "function";

  // ────────────────────────────────────────────────────────
  // STRATEGY: Always prefer Whisper when available.
  // Whisper gives access to the medical glossary (88 terms)
  // which is critical for accurate transcription of ECOS terms.
  // Native API is only used as a last resort (no mic API = no Whisper).
  // ────────────────────────────────────────────────────────
  const useWhisperEngine = hasWhisper;
  const useNative = hasNativeCtor && !hasWhisper;

  const [isSupported] = useState<boolean>(useWhisperEngine || useNative);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<"native" | "whisper" | null>(null);

  const startingRef = useRef(false);

  // ── Refs ──
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

    const rec = recognitionRef.current;
    if (rec) {
      recognitionRef.current = null;
      disposeNativeInstance(rec);
    }

    const session = whisperSessionRef.current;
    if (session) {
      whisperSessionRef.current = null;
      try {
        const audioBlob = await stopWhisperSession(session);
        if (audioBlob.size > 0 && whisperEndpoint) {
          onResultRef.current?.("…", false);
          const transcript = await transcribeWithWhisper(audioBlob, whisperEndpoint, lang, whisperApiKey);
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
  }, [clearAllTimers, disposeNativeInstance, whisperEndpoint, whisperApiKey, lang]);

  // ── Native silence timer (fallback only) ──

  const armNativeSilence = useCallback(() => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    silenceRef.current = setTimeout(() => { stop(); }, Math.max(500, silenceMs));
  }, [silenceMs, stop]);

  // ── START Native (fallback only — used when Whisper is unavailable) ──

  const startNative = useCallback(() => {
    const Ctor = nativeCtorRef.current;
    if (!Ctor) return;

    if (recognitionRef.current) {
      disposeNativeInstance(recognitionRef.current);
      recognitionRef.current = null;
    }

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = interimResults;
    rec.continuous = continuous;

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
  }, [lang, interimResults, continuous, maxDurationMs, armNativeSilence, clearAllTimers, disposeNativeInstance, stop]);

  // ── START Whisper (primary engine) ──

  const startWhisper = useCallback(async () => {
    if (!whisperEndpoint) {
      setError("no-whisper-endpoint");
      startingRef.current = false;
      return;
    }

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
      if (e?.name === "NotAllowedError") {
        setError("not-allowed");
      } else {
        setError("start-failed");
      }
      setIsListening(false);
    }
  }, [whisperEndpoint, maxDurationMs, stop]);

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
