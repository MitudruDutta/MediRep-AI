#!/usr/bin/env python3
"""
MediRep Real-Time Voice Server

Pipeline: Mic -> VAD -> Whisper STT -> Groq LLM -> Groq TTS -> Audio back to client
"""

import asyncio
import re
import numpy as np
import os
import traceback
from collections import deque

# Load .env files before anything else
try:
    from dotenv import load_dotenv
    _project_root = os.path.join(os.path.dirname(__file__), '..')
    load_dotenv(os.path.join(_project_root, 'backend', '.env'))
    load_dotenv(os.path.join(_project_root, '.env'))
except ImportError:
    pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn

# ============================================================
# CONFIGURATION
# ============================================================

CONFIG = {
    "whisper_model": os.environ.get("WHISPER_MODEL", "base"),
    "whisper_device": os.environ.get("WHISPER_DEVICE", "cuda"),
    "whisper_compute": os.environ.get("WHISPER_COMPUTE", "float16"),
    "vad_threshold": float(os.environ.get("VAD_THRESHOLD", "0.5")),
    "sample_rate": 16000,
    "silence_duration": 0.7,
    "groq_api_key": os.environ.get("GROQ_API_KEY", ""),
    "groq_model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
    "groq_tts_model": "playai-tts",
    "groq_tts_voice": os.environ.get("GROQ_TTS_VOICE", "Fritz-PlayAI"),
    # IMPORTANT: Frontend currently assumes any binary frames are raw PCM int16.
    # Groq TTS returns compressed audio (e.g., mp3), which will break playback.
    # Keep server-side audio OFF unless/until we add proper decoding on the client.
    "server_tts_enabled": os.environ.get("VOICE_SERVER_TTS", "0") == "1",
}

VOICE_SYSTEM_PROMPT = (
    "You are MediRep AI, a medical-information voice assistant for healthcare professionals in India. "
    "You are in VOICE mode. Keep responses concise (2-4 sentences), conversational, and natural. "
    "No markdown formatting, no bullet points, no numbered lists, no asterisks, no headers. "
    "No source citations. Speak naturally as if talking to a doctor or pharmacist. "
    "Provide evidence-based information about drugs, dosages, interactions, side effects, "
    "Indian brand availability, and pricing when asked."
)

app = FastAPI(title="MediRep Real-Time Voice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# LAZY LOADING
# ============================================================

_vad_model = None
_whisper_model = None


def get_vad():
    """Load Silero VAD model."""
    global _vad_model
    if _vad_model is None:
        import torch
        model, utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False
        )
        _vad_model = (model, utils)
        print("[LOADED] VAD")
    return _vad_model


def get_whisper():
    """Load faster-whisper for STT."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            CONFIG["whisper_model"],
            device=CONFIG["whisper_device"],
            compute_type=CONFIG["whisper_compute"],
        )
        print("[LOADED] Whisper")
    return _whisper_model


# ============================================================
# GROQ API (LLM + TTS)
# ============================================================

def clean_for_voice(text: str) -> str:
    """Strip markdown/artifacts for clean voice output."""
    ic = re.IGNORECASE | re.DOTALL
    # Strip any tool-call artifacts if they leak into output.
    text = re.sub(r'<tool_call>.*?</tool_call>\s*(?:<params>.*?</params>|\{[^}]*\})', '', text, flags=ic)
    text = re.sub(r'tool_call:\s*\w+\s+params:\s*\{[^}]*\}', '', text, flags=ic)
    text = re.sub(r'\[Tool Result\]:.*', '', text, flags=ic)
    # Strip inline source tags (voice should not read these).
    text = re.sub(r'\(\s*sources?\s*:\s*[^)]+\)', '', text, flags=ic)
    text = re.sub(r'\(\s*sources?\s+\d+[^)]*\)', '', text, flags=ic)
    text = re.sub(r'(?im)^\s*sources?\s*:\s*.+$', '', text)
    text = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', text)
    text = re.sub(r'#{1,3}\s*', '', text)
    text = re.sub(r'[-*]\s+', '', text)
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'\n{2,}', '. ', text)
    text = re.sub(r'\n', ' ', text)
    return text.strip()


async def groq_chat(user_text: str, history: list) -> str:
    """Generate response via Groq LLM."""
    messages = [{"role": "system", "content": VOICE_SYSTEM_PROMPT}]
    messages.extend(history[-6:])
    messages.append({"role": "user", "content": user_text})

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {CONFIG['groq_api_key']}",
                "Content-Type": "application/json",
            },
            json={
                "model": CONFIG["groq_model"],
                "messages": messages,
                "max_tokens": 300,
                "temperature": 0.7,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def groq_tts(text: str) -> bytes:
    """Generate speech audio via Groq TTS API."""
    cleaned = clean_for_voice(text)
    if not cleaned:
        return b""

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/audio/speech",
            headers={
                "Authorization": f"Bearer {CONFIG['groq_api_key']}",
                "Content-Type": "application/json",
            },
            json={
                "model": CONFIG["groq_tts_model"],
                "input": cleaned,
                "voice": CONFIG["groq_tts_voice"],
                "response_format": "mp3",
            },
        )
        # Do not throw here; server-side audio is optional and should never kill the voice session.
        if resp.status_code != 200:
            print(f"Groq TTS error: HTTP {resp.status_code} - {resp.text[:200]}")
            return b""
        return resp.content


# ============================================================
# VOICE ACTIVITY DETECTION
# ============================================================

class VADProcessor:
    """Process audio and detect speech segments."""

    def __init__(self):
        self.model, self.utils = get_vad()
        self.audio_buffer = deque(maxlen=int(CONFIG["sample_rate"] * 30))
        self.is_speaking = False
        self.silence_frames = 0
        self.silence_threshold = int(
            CONFIG["silence_duration"] * CONFIG["sample_rate"] / 512
        )

    def process_chunk(self, audio_chunk: bytes) -> tuple[bool, np.ndarray | None]:
        """Process audio chunk. Returns (speech_ended, audio_data)."""
        import torch

        audio = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
        self.audio_buffer.extend(audio)

        audio_tensor = torch.from_numpy(audio)
        speech_prob = self.model(audio_tensor, CONFIG["sample_rate"]).item()

        if speech_prob > CONFIG["vad_threshold"]:
            self.is_speaking = True
            self.silence_frames = 0
            return False, None
        elif self.is_speaking:
            self.silence_frames += 1
            if self.silence_frames >= self.silence_threshold:
                self.is_speaking = False
                self.silence_frames = 0
                audio_data = np.array(self.audio_buffer)
                self.audio_buffer.clear()
                return True, audio_data

        return False, None

    def reset(self):
        """Clear buffers."""
        self.audio_buffer.clear()
        self.is_speaking = False
        self.silence_frames = 0


# ============================================================
# WEBSOCKET ENDPOINT
# ============================================================

@app.websocket("/ws/realtime")
async def realtime_voice(websocket: WebSocket):
    """Real-time voice: STT -> Groq LLM -> Groq TTS -> audio back."""
    await websocket.accept()

    vad = VADProcessor()
    whisper = get_whisper()
    conversation_history = []
    has_groq = bool(CONFIG["groq_api_key"])

    if not has_groq:
        print("[WARN] GROQ_API_KEY not set - STT only mode")

    print("Client connected")

    try:
        while True:
            audio_chunk = await websocket.receive_bytes()

            speech_ended, audio_data = vad.process_chunk(audio_chunk)

            if not speech_ended or audio_data is None:
                continue

            # Transcribe in thread to not block event loop
            def _transcribe(ad=audio_data):
                segs, _ = whisper.transcribe(ad, language="en", vad_filter=True)
                return " ".join(s.text for s in segs).strip()

            user_text = await asyncio.to_thread(_transcribe)

            if not user_text:
                vad.reset()
                continue

            print(f"User: {user_text}")

            # Send transcript to client
            await websocket.send_json({"type": "transcript", "text": user_text})

            if not has_groq:
                vad.reset()
                continue

            conversation_history.append({"role": "user", "content": user_text})

            # Generate LLM response via Groq
            try:
                response = await groq_chat(user_text, conversation_history)
            except Exception as e:
                print(f"Groq LLM error: {e}")
                response = "I'm sorry, I couldn't process that right now. Please try again."

            print(f"Assistant: {response}")
            conversation_history.append({"role": "assistant", "content": response})

            # Send response text to client (for overlay display)
            await websocket.send_json({"type": "response", "text": response})

            # Server-side audio streaming is disabled by default because the client
            # assumes raw PCM frames. The web UI already speaks responses via
            # browser TTS (SpeechSynthesis) on the JSON "response" event.
            if CONFIG["server_tts_enabled"]:
                try:
                    audio_bytes = await groq_tts(response)
                    if audio_bytes:
                        # NOTE: This is mp3 bytes; do not enable unless client can decode.
                        await websocket.send_json({"type": "audio_error"})
                except Exception as e:
                    print(f"Groq TTS error: {e}")
                    await websocket.send_json({"type": "audio_error"})

            # Reset VAD to clear audio buffered during generation
            vad.reset()

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        try:
            await websocket.close()
        except Exception:
            pass


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "groq_configured": bool(CONFIG["groq_api_key"]),
        "models_loaded": {
            "vad": _vad_model is not None,
            "whisper": _whisper_model is not None,
        }
    }


@app.on_event("startup")
async def startup():
    """Pre-load models on startup."""
    print("=" * 60)
    print("MediRep Voice Server Starting...")
    print(f"Whisper: {CONFIG['whisper_model']} ({CONFIG['whisper_device']})")
    print(f"Groq LLM: {CONFIG['groq_model']}")
    print(f"Groq TTS: {CONFIG['groq_tts_model']} ({CONFIG['groq_tts_voice']})")
    print(f"Server TTS: {'ENABLED' if CONFIG['server_tts_enabled'] else 'disabled (browser TTS)'}")
    print(f"Groq API: {'configured' if CONFIG['groq_api_key'] else 'NOT configured'}")
    print("=" * 60)

    # Load audio models in background
    asyncio.create_task(asyncio.to_thread(get_vad))
    asyncio.create_task(asyncio.to_thread(get_whisper))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8998)
