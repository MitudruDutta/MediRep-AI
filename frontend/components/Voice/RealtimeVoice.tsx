"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RealtimeVoiceProps {
  onTranscript?: (text: string) => void;
  className?: string;
}

const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || "ws://localhost:8998/ws/realtime";
const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 512;

export function RealtimeVoice({ onTranscript, className }: RealtimeVoiceProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Connect to voice server
  const connect = useCallback(async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      // Create WebSocket connection
      const ws = new WebSocket(VOICE_SERVER_URL);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setIsConnected(true);
        setIsListening(true);
        startAudioCapture(stream, audioContext, ws);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Received audio response
          audioQueueRef.current.push(event.data);
          if (!isPlayingRef.current) {
            playAudioQueue();
          }
        } else {
          // Received text (transcript)
          try {
            const data = JSON.parse(event.data);
            if (data.transcript) {
              onTranscript?.(data.transcript);
            }
          } catch {}
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsListening(false);
        cleanup();
      };

      ws.onerror = (error) => {
        console.error("Voice WebSocket error:", error);
        setIsConnected(false);
        cleanup();
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  }, [onTranscript]);

  // Start capturing audio and sending to server
  const startAudioCapture = (
    stream: MediaStream,
    audioContext: AudioContext,
    ws: WebSocket
  ) => {
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(CHUNK_SIZE, 1, 1);

    processor.onaudioprocess = (e) => {
      if (ws.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        ws.send(int16Data.buffer);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    processorRef.current = processor;
  };

  // Play audio queue (responses from server)
  const playAudioQueue = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const audioData = audioQueueRef.current.shift()!;
    const audioContext = audioContextRef.current;

    if (!audioContext) return;

    try {
      // Convert raw PCM to playable format
      const float32Data = new Float32Array(audioData.byteLength / 2);
      const int16View = new Int16Array(audioData);
      for (let i = 0; i < int16View.length; i++) {
        float32Data[i] = int16View[i] / 32768;
      }

      const audioBuffer = audioContext.createBuffer(1, float32Data.length, SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        playAudioQueue(); // Play next chunk
      };

      source.start();
    } catch (error) {
      console.error("Audio playback error:", error);
      playAudioQueue(); // Try next chunk
    }
  };

  // Disconnect
  const disconnect = useCallback(() => {
    wsRef.current?.close();
    cleanup();
    setIsConnected(false);
    setIsListening(false);
  }, []);

  // Cleanup resources
  const cleanup = () => {
    processorRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const toggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Connection status indicator */}
      <div className="flex items-center gap-2 text-sm">
        {isConnected && (
          <>
            {isListening && !isSpeaking && (
              <span className="flex items-center gap-1 text-green-600">
                <Mic className="w-3 h-3 animate-pulse" />
                Listening...
              </span>
            )}
            {isSpeaking && (
              <span className="flex items-center gap-1 text-blue-600">
                <Volume2 className="w-3 h-3 animate-pulse" />
                Speaking...
              </span>
            )}
          </>
        )}
      </div>

      {/* Call button */}
      <Button
        variant={isConnected ? "destructive" : "default"}
        size="lg"
        onClick={toggleConnection}
        className={cn(
          "rounded-full w-14 h-14 p-0",
          isConnected && "animate-pulse"
        )}
      >
        {isConnected ? (
          <PhoneOff className="w-6 h-6" />
        ) : (
          <Phone className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
