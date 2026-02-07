"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceState = "idle" | "connecting" | "listening" | "processing" | "speaking" | "error";

interface VoiceMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface UseVoiceCallOptions {
  serverUrl?: string;
  onTranscript?: (text: string) => void;
}

const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 512;
const SPEECH_CHUNK_MAX_CHARS = 220;
const RESPONSE_WAIT_MS = 15000;

export function useVoiceCall(options: UseVoiceCallOptions = {}) {
  const {
    serverUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || "ws://127.0.0.1:8998/ws/realtime",
    onTranscript,
  } = options;

  const [state, setState] = useState<VoiceState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const levelTimerRef = useRef<number | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const stateRef = useRef<VoiceState>("idle");
  const responseWaitTimerRef = useRef<number | null>(null);

  const clearResponseWaitTimer = useCallback(() => {
    if (responseWaitTimerRef.current) {
      window.clearTimeout(responseWaitTimerRef.current);
      responseWaitTimerRef.current = null;
    }
  }, []);

  const updateState = useCallback((s: VoiceState | ((prev: VoiceState) => VoiceState)) => {
    setState((prev) => {
      const next = typeof s === "function" ? s(prev) : s;
      stateRef.current = next;
      return next;
    });
  }, []);

  const cleanForSpeech = useCallback((raw: string) => {
    let text = (raw || "").trim();
    if (!text) return "";

    // Strip tool-call artifacts and inline citation/source noise.
    text = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");
    text = text.replace(/tool_call:\s*\w+\s+params:\s*\{[^}]*\}/gi, "");
    text = text.replace(/\(\s*sources?\s*:\s*[^)]+\)/gi, "");
    text = text.replace(/\(\s*sources?\s+\d+[^)]*\)/gi, "");
    text = text.replace(/^[ \t]*sources?\s*:\s*.+$/gim, "");
    text = text.replace(/[【\[]\s*\d+\s*†\s*source\s*[】\]]/gi, "");
    text = text.replace(/[【\[]\s*\d+\s*†[^\]】]{0,80}[】\]]/g, "");
    text = text.replace(/https?:\/\/\S+/g, "");

    // Markdown-ish cleanup.
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    text = text.replace(/`([^`]+)`/g, "$1");
    text = text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
    text = text.replace(/#{1,3}\s*/g, "");

    // Collapse whitespace and remove punctuation-only orphan lines.
    text = text.replace(/[ \t]{2,}/g, " ");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text
      .split("\n")
      .filter((ln) => ln.trim() !== ".")
      .join("\n")
      .trim();

    return text;
  }, []);

  const chunkForSpeech = useCallback((text: string) => {
    const chunks: string[] = [];
    const input = text.trim();
    if (!input) return chunks;

    // Prefer splitting on sentence boundaries, then hard-wrap.
    const sentences = input.split(/(?<=[.!?])\s+/);
    let current = "";
    for (const s of sentences) {
      const next = (current ? `${current} ${s}` : s).trim();
      if (next.length <= SPEECH_CHUNK_MAX_CHARS) {
        current = next;
        continue;
      }
      if (current) chunks.push(current);
      if (s.length <= SPEECH_CHUNK_MAX_CHARS) {
        current = s;
        continue;
      }
      // Hard wrap long sentences.
      let remaining = s.trim();
      while (remaining.length > SPEECH_CHUNK_MAX_CHARS) {
        let cut = remaining.lastIndexOf(" ", SPEECH_CHUNK_MAX_CHARS);
        if (cut < 40) cut = SPEECH_CHUNK_MAX_CHARS;
        chunks.push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut).trim();
      }
      current = remaining;
    }
    if (current) chunks.push(current);
    return chunks;
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }, []);

  const speakText = useCallback((raw: string) => {
    const wsOpen = wsRef.current?.readyState === WebSocket.OPEN;
    if (!wsOpen) return false;
    if (typeof window === "undefined") return false;
    if (!("speechSynthesis" in window)) return false;

    const cleaned = cleanForSpeech(raw);
    if (!cleaned) return false;

    stopSpeech();
    const parts = chunkForSpeech(cleaned);
    if (parts.length === 0) return false;

    updateState("speaking");

    let idx = 0;
    const speakNext = () => {
      const stillOpen = wsRef.current?.readyState === WebSocket.OPEN;
      if (!stillOpen) return;

      const part = parts[idx];
      if (!part) {
        updateState("listening");
        return;
      }

      const u = new SpeechSynthesisUtterance(part);
      // Keep it predictable; browser chooses best available voice.
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = 1.0;

      u.onend = () => {
        idx += 1;
        if (idx >= parts.length) {
          updateState("listening");
        } else {
          speakNext();
        }
      };
      u.onerror = () => {
        updateState("listening");
      };

      try {
        window.speechSynthesis.speak(u);
      } catch {
        updateState("listening");
      }
    };

    speakNext();
    return true;
  }, [chunkForSpeech, cleanForSpeech, stopSpeech, updateState]);

  // Duration timer
  useEffect(() => {
    if (!isConnected) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isConnected]);

  // Audio level monitoring (mic input)
  const startLevelMonitoring = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      setAudioLevel(sum / dataArray.length / 255);
      levelTimerRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopLevelMonitoring = useCallback(() => {
    if (levelTimerRef.current) {
      cancelAnimationFrame(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Audio playback (Groq TTS mp3 from server)
  const stopPlayback = useCallback(() => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.onended = null;
      playbackAudioRef.current.onerror = null;
      playbackAudioRef.current = null;
    }
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
  }, []);

  const playAudio = useCallback((audioData: ArrayBuffer) => {
    stopPlayback();
    stopSpeech();

    const blob = new Blob([audioData], { type: "audio/mp3" });
    const url = URL.createObjectURL(blob);
    playbackUrlRef.current = url;

    const audio = new Audio(url);
    playbackAudioRef.current = audio;

    audio.onplay = () => updateState("speaking");
    audio.onended = () => {
      stopPlayback();
      updateState("listening");
    };
    audio.onerror = () => {
      stopPlayback();
      updateState("listening");
    };

    audio.play().catch(() => {
      stopPlayback();
      updateState("listening");
    });
  }, [updateState, stopPlayback, stopSpeech]);

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }
    analyserRef.current = null;
  }, []);

  // Connect to voice server
  const connect = useCallback(async () => {
    try {
      updateState("connecting");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const processor = audioContext.createScriptProcessor(CHUNK_SIZE, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioContext.destination);

      const ws = new WebSocket(serverUrl);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setIsConnected(true);
        setDuration(0);
        updateState("listening");
        startLevelMonitoring();
        clearResponseWaitTimer();

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && stateRef.current === "listening") {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Data = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }
            ws.send(int16Data.buffer);
          }
        };
      };

      ws.onmessage = (event) => {
        // Binary frame = TTS audio from Groq
        if (event.data instanceof ArrayBuffer) {
          playAudio(event.data);
          return;
        }

        // Text frame = JSON
        try {
          const data = JSON.parse(event.data);
          if (data.type === "transcript") {
            const text = data.text;
            setCurrentTranscript(text);
            setMessages((prev) => [...prev, { role: "user", text, timestamp: Date.now() }]);
            updateState("processing");
            clearResponseWaitTimer();
            responseWaitTimerRef.current = window.setTimeout(() => {
              // If the server never sends a response (or client is STT-only), do not deadlock.
              if (wsRef.current?.readyState === WebSocket.OPEN && stateRef.current === "processing") {
                updateState("listening");
              }
            }, RESPONSE_WAIT_MS);
            onTranscript?.(text);
          } else if (data.type === "response") {
            clearResponseWaitTimer();
            setMessages((prev) => [...prev, { role: "assistant", text: data.text, timestamp: Date.now() }]);
            // Prefer browser TTS. If not available, immediately return to listening.
            const spoke = speakText(data.text);
            if (!spoke) updateState("listening");
          } else if (data.type === "audio_error") {
            clearResponseWaitTimer();
            updateState("listening");
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setDuration(0);
        updateState("idle");
        stopLevelMonitoring();
        stopPlayback();
        stopSpeech();
        clearResponseWaitTimer();
        cleanup();
      };

      ws.onerror = () => {
        updateState("error");
        setIsConnected(false);
        setDuration(0);
        stopLevelMonitoring();
        stopPlayback();
        stopSpeech();
        clearResponseWaitTimer();
        cleanup();
      };

      wsRef.current = ws;
    } catch {
      updateState("error");
    }
  }, [serverUrl, onTranscript, startLevelMonitoring, stopLevelMonitoring, stopPlayback, playAudio, updateState, speakText, stopSpeech, clearResponseWaitTimer, cleanup]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    stopLevelMonitoring();
    stopPlayback();
    stopSpeech();
    clearResponseWaitTimer();
    cleanup();
    setIsConnected(false);
    setDuration(0);
    updateState("idle");
    setCurrentTranscript("");
  }, [cleanup, stopLevelMonitoring, stopPlayback, stopSpeech, clearResponseWaitTimer, updateState]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentTranscript("");
  }, []);

  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return {
    state,
    isConnected,
    messages,
    currentTranscript,
    duration,
    audioLevel,
    connect,
    disconnect,
    clearMessages,
  };
}
