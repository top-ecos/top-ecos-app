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

/** Detect iOS (iPhone, iPad, iPod) */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Standard iOS detection
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPad on iOS 13+ reports as "Macintosh" but has touch
  if (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** Safari-specific detection (macOS only — NOT iOS) */
function isSafariDesktop(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg/.test(ua) && !isIOS();
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

  // ── Detect engine preference ──
  const nativeCtorRef = useRef<SpeechRecognitionCtor | null>(getNativeCtor());
  const hasNativeCtor = !!nativeCtorRef.current;
  const hasWhisper = !!whisperEndpoint && typeof navigator?.mediaDevices?.getUserMedia === "function";

  // ────────────────────────────────────────────────────────
  // KEY FIX: On iOS, the native webkitSpeechRecognition exists (since iOS 14.5)
  // but it's flaky and — critically — doesn't support the medical glossary.
  // When Whisper is available, we ALWAYS prefer it on iOS to get the glossary.
  // On desktop Chrome, native is fast and reliable so we keep it.
  // On Safari macOS, native works with our fixes so we keep it.
  // ────────────────────────────────────────────────────────
  const iosDevice = isIOS();
  const preferWhisper = iosDevice && hasWhisper;

  const useNative = hasNativeCtor && !preferWhisper;
  const useWhisper = hasWhisper && (!hasNativeCtor || preferWhisper);

  const [isSupported] = useState<boolean>(useNative || useWhisper);
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

  // ── Timer helpers ──
  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (silenceRef.current) clearTimeout(silenceRef.current);
    if (whisperTimeoutRef.current) clearTimeout(whisperTimeoutRef.current);
    timeoutRef.current = null;
    silenceRef.current = null;
    whisperTimeoutRef.current = null;
  }, []);

  // ────────────────────────────────────────────
  // Safely dispose of a native recognition instance
  // Detaches ALL handlers BEFORE stopping to prevent ghost events
  // ────────────────────────────────────────────
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

  // ────────────────────────────────────────────
  // STOP (unified)
  // ────────────────────────────────────────────

  const stop = useCallback(async () => {
    clearAllTimers();
    startingRef.current = false;

    // ── Native cleanup ──
    const rec = recognitionRef.current;
    if (rec) {
      recognitionRef.current = null;
      disposeNativeInstance(rec);
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
  }, [clearAllTimers, disposeNativeInstance, whisperEndpoint, lang]);

  // ────────────────────────────────────────────
  // Silence arm (native only)
  // ────────────────────────────────────────────

  const armNativeSilence = useCallback(() => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    // On Safari macOS, give more time because of the ~2-3s init delay
    const delay = isSafariDesktop()
      ? Math.max(3_500, silenceMs)
      : Math.max(500, silenceMs);
    silenceRef.current = setTimeout(() => {
      stop();
    }, delay);
  }, [silenceMs, stop]);

  // ────────────────────────────────────────────
  // START — Native Web Speech API
  // (used on Chrome desktop + Safari macOS)
  // ────────────────────────────────────────────

  const startNative = useCallback(() => {
    const Ctor = nativeCtorRef.current;
    if (!Ctor) return;

    // Clean up any lingering instance (detach handlers first to prevent ghost events)
    if (recognitionRef.current) {
      disposeNativeInstance(recognitionRef.current);
      recognitionRef.current = null;
    }

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = interimResults;
    // On Safari macOS, continuous mode is broken → force single-shot
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

      // Safari macOS fires "no-speech" during init delay and "aborted" on cleanup
      if (isSafariDesktop() && (code === "no-speech" || code === "aborted")) {
        return;
      }

      setError(code);
      stop();
    };

    rec.onspeechend = () => { /* no-op — silence timer handles stopping */ };
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

    // Safety max-duration timeout
    timeoutRef.current = setTimeout(() => {
      stop();
    }, Math.max(1_000, maxDurationMs));
  }, [lang, interimResults, continuous, maxDurationMs, armNativeSilence, clearAllTimers, disposeNativeInstance, stop]);

  // ────────────────────────────────────────────
  // START — Whisper fallback (MediaRecorder)
  // (used on iOS + any browser without native support)
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

    if (useNative) {
      startNative();
    } else if (useWhisper) {
      startWhisper();
    } else {
      startingRef.current = false;
    }
  }, [isSupported, isListening, useNative, useWhisper, startNative, startWhisper]);

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
