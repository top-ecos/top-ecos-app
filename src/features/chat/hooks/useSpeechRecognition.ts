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
  /**
   * URL of your backend endpoint that proxies to OpenAI Whisper.
   * Required for the Whisper fallback (iOS / unsupported browsers).
   * The endpoint should accept a POST with FormData containing an "audio" Blob
   * and return JSON: { text: string }
   *
   * Example endpoint: POST /api/transcribe
   */
  whisperEndpoint?: string;
};

type UseSpeechRecognitionReturn = {
  isSupported: boolean;
  isListening: boolean;
  error: string | null;
  /** "native" when using Web Speech API, "whisper" when using fallback */
  engine: "native" | "whisper" | null;
  start: () => void;
  stop: () => void;
};

// ────────────────────────────────────────────────────────────
// Helpers — detect capabilities once
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

/** Safari-specific detection (macOS only — iOS doesn't have the API at all) */
function isSafariDesktop(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg/.test(ua) && !/iPhone|iPad|iPod/.test(ua);
}

// ────────────────────────────────────────────────────────────
// Whisper fallback engine — uses MediaRecorder → backend
// ────────────────────────────────────────────────────────────

interface WhisperSession {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
}

async function startWhisperSession(): Promise<WhisperSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Prefer webm/opus (Chrome, Firefox), fall back to mp4/aac (Safari)
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

  mediaRecorder.start(250); // collect data in 250ms chunks for responsiveness

  return { mediaRecorder, stream, chunks };
}

function stopWhisperSession(session: WhisperSession): Promise<Blob> {
  return new Promise((resolve) => {
    session.mediaRecorder.onstop = () => {
      // Stop all tracks to release the mic
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
): Promise<string> {
  const formData = new FormData();
  // Determine extension from mime
  const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
  formData.append("audio", audioBlob, `recording.${ext}`);
  formData.append("language", lang.split("-")[0]); // "fr-FR" → "fr"

  const res = await fetch(endpoint, {
    method: "POST",
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
  } = options;

  // ── Stable ref for onResult to avoid stale closures ──
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // ── Detect engine once ──
  const nativeCtorRef = useRef<SpeechRecognitionCtor | null>(getNativeCtor());
  const hasNative = !!nativeCtorRef.current;
  const hasWhisper = !!whisperEndpoint && typeof navigator?.mediaDevices?.getUserMedia === "function";

  const [isSupported] = useState<boolean>(hasNative || hasWhisper);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<"native" | "whisper" | null>(null);

  // Prevent double-starts
  const startingRef = useRef(false);

  // ── Refs for native engine ──
  const recognitionRef = useRef<NativeSpeechRecognition | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refs for Whisper engine ──
  const whisperSessionRef = useRef<WhisperSession | null>(null);
  const whisperTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperSilenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timer helpers ──
  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (silenceRef.current) clearTimeout(silenceRef.current);
    if (whisperTimeoutRef.current) clearTimeout(whisperTimeoutRef.current);
    if (whisperSilenceRef.current) clearTimeout(whisperSilenceRef.current);
    timeoutRef.current = null;
    silenceRef.current = null;
    whisperTimeoutRef.current = null;
    whisperSilenceRef.current = null;
  }, []);

  // ────────────────────────────────────────────
  // STOP (unified)
  // ────────────────────────────────────────────

  const stop = useCallback(async () => {
    clearAllTimers();
    startingRef.current = false;

    // ── Native cleanup ──
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }

    // ── Whisper cleanup + transcription ──
    const session = whisperSessionRef.current;
    if (session) {
      whisperSessionRef.current = null;
      try {
        const audioBlob = await stopWhisperSession(session);
        if (audioBlob.size > 0 && whisperEndpoint) {
          // Send a "processing…" interim signal
          onResultRef.current?.("…", false);
          const transcript = await transcribeWithWhisper(audioBlob, whisperEndpoint, lang);
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
  }, [clearAllTimers, whisperEndpoint, lang]);

  // ────────────────────────────────────────────
  // Silence arm (native only — Whisper has its own)
  // ────────────────────────────────────────────

  const armNativeSilence = useCallback(() => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    // On Safari, give more time because of the ~2-3s init delay
    const delay = isSafariDesktop()
      ? Math.max(3_500, silenceMs)
      : Math.max(500, silenceMs);
    silenceRef.current = setTimeout(() => {
      stop();
    }, delay);
  }, [silenceMs, stop]);

  // ────────────────────────────────────────────
  // START — Native Web Speech API
  // ────────────────────────────────────────────

  const startNative = useCallback(() => {
    const Ctor = nativeCtorRef.current;
    if (!Ctor) return;

    // Abort any lingering instance first
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* noop */ }
      recognitionRef.current = null;
    }

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = interimResults;

    // FIX: On Safari macOS, continuous mode is broken.
    // Force single-shot mode and we'll handle restart if needed.
    rec.continuous = isSafariDesktop() ? false : continuous;

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
      } catch {
        // swallow parsing errors
      }
    };

    rec.onerror = (event: any) => {
      const code = event?.error ?? "unknown";
      // On Safari, "no-speech" is very common during the init delay — don't kill support
      if (code === "no-speech" && isSafariDesktop()) {
        // Silently ignore, silence timer will handle stop
        return;
      }
      setError(code);
      if (code === "not-allowed" || code === "service-not-allowed") {
        // Don't permanently kill isSupported — user might grant permission later
        setError(code);
      }
      stop();
    };

    // Safari fires onspeechend very aggressively (~0.5s).
    // We rely on our silence timer instead.
    rec.onspeechend = () => { /* no-op */ };

    rec.onaudiostart = () => {
      armNativeSilence();
    };

    rec.onend = () => {
      clearAllTimers();
      setIsListening(false);
      setEngine(null);
      recognitionRef.current = null;
      startingRef.current = false;
    };

    recognitionRef.current = rec;
    rec.start();

    // Safety max-duration timeout
    timeoutRef.current = setTimeout(() => {
      stop();
    }, Math.max(1_000, maxDurationMs));
  }, [lang, interimResults, continuous, maxDurationMs, armNativeSilence, clearAllTimers, stop]);

  // ────────────────────────────────────────────
  // START — Whisper fallback (MediaRecorder)
  // ────────────────────────────────────────────

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

      // Safety max-duration timeout
      whisperTimeoutRef.current = setTimeout(() => {
        stop();
      }, Math.max(1_000, maxDurationMs));

      // Silence timeout — for Whisper we just use duration since we can't
      // detect silence without an AudioWorklet. The user presses stop manually
      // or the maxDuration kicks in.
      // We could add an AnalyserNode-based silence detector later.
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

  // ────────────────────────────────────────────
  // START (unified entry point)
  // ────────────────────────────────────────────

  const start = useCallback(() => {
    if (!isSupported || startingRef.current || isListening) return;
    startingRef.current = true;

    if (hasNative) {
      startNative();
    } else if (hasWhisper) {
      startWhisper();
    } else {
      startingRef.current = false;
    }
  }, [isSupported, isListening, hasNative, hasWhisper, startNative, startWhisper]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      clearAllTimers();
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
      // Stop Whisper mic tracks
      const session = whisperSessionRef.current;
      if (session) {
        try { session.mediaRecorder.stop(); } catch { /* noop */ }
        session.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [clearAllTimers]);

  return { isSupported, isListening, error, engine, start, stop };
}
