#!/usr/bin/env python3
"""
MediRep Real-Time Voice Server

Real-time conversational AI with streaming:
- VAD (Voice Activity Detection) - knows when user stops
- Streaming STT (faster-whisper)
- Streaming LLM (llama.cpp)
- Streaming TTS (Piper)

Target: ~500ms to first audio response
"""

import asyncio
import json
import numpy as np
import wave
import io
import os
import sys
import re
from collections import deque
from typing import AsyncGenerator

# Add backend to path for tool integration
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../backend'))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ============================================================
# CONFIGURATION
# ============================================================

CONFIG = {
    "model_path": "./models/medirep-voice-q4_k_m.gguf",
    "whisper_model": "base",  # or "small" for better accuracy
    "piper_model": "en_US-lessac-medium",  # Fast English voice
    "vad_threshold": 0.5,
    "sample_rate": 16000,
    "silence_duration": 0.7,  # seconds of silence to detect end of speech
}

app = FastAPI(title="MediRep Real-Time Voice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# LAZY LOADING - Models load on first use
# ============================================================

_vad_model = None
_whisper_model = None
_llm = None
_tts = None


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
        print("VAD loaded")
    return _vad_model


def get_whisper():
    """Load faster-whisper for streaming STT."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            CONFIG["whisper_model"],
            device="cuda",
            compute_type="float16"
        )
        print("Whisper loaded")
    return _whisper_model


def get_llm():
    """Load fine-tuned LLM."""
    global _llm
    if _llm is None:
        from llama_cpp import Llama
        _llm = Llama(
            model_path=CONFIG["model_path"],
            n_ctx=4096,
            n_gpu_layers=35,
            verbose=False,
        )
        print("LLM loaded")
    return _llm


def get_tts():
    """Load Piper TTS for fast synthesis."""
    global _tts
    if _tts is None:
        # Piper is subprocess-based for speed
        _tts = PiperTTS(CONFIG["piper_model"])
        print("TTS loaded")
    return _tts


# ============================================================
# PIPER TTS WRAPPER (Streaming)
# ============================================================

class PiperTTS:
    """Fast TTS using Piper - synthesizes chunks as they come."""

    def __init__(self, model_name: str):
        self.model_name = model_name
        # Check if piper is installed
        import shutil
        self.piper_path = shutil.which("piper")
        if not self.piper_path:
            print("WARNING: Piper not found. Install with: pip install piper-tts")
            self.piper_path = None

    async def synthesize_streaming(self, text_generator: AsyncGenerator[str, None]) -> AsyncGenerator[bytes, None]:
        """Synthesize audio from streaming text."""
        buffer = ""

        async for token in text_generator:
            buffer += token

            # Synthesize on sentence boundaries for natural speech
            if any(buffer.endswith(p) for p in ['. ', '? ', '! ', '.\n', '?\n', '!\n']):
                if buffer.strip():
                    audio = await self._synthesize_chunk(buffer.strip())
                    if audio:
                        yield audio
                    buffer = ""

        # Synthesize remaining text
        if buffer.strip():
            audio = await self._synthesize_chunk(buffer.strip())
            if audio:
                yield audio

    async def _synthesize_chunk(self, text: str) -> bytes:
        """Synthesize a single chunk of text."""
        if not self.piper_path or not text:
            return b""

        try:
            proc = await asyncio.create_subprocess_exec(
                self.piper_path,
                "--model", self.model_name,
                "--output-raw",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await proc.communicate(text.encode())
            return stdout
        except Exception as e:
            print(f"TTS error: {e}")
            return b""


# ============================================================
# TOOL EXECUTION (from backend services)
# ============================================================

def load_tools():
    """Load backend service tools."""
    tools = {}

    try:
        from services import turso_service
        tools["search_drugs"] = lambda p: turso_service.search_drugs(p.get("query", ""))
    except:
        pass

    try:
        from services.therapeutic_comparison_service import TherapeuticComparisonService
        svc = TherapeuticComparisonService()
        tools["compare_drugs"] = lambda p: svc.compare_drugs(p.get("drug1"), p.get("drug2"))
        tools["list_drug_class"] = lambda p: svc.get_class_members(p.get("class_name"))
    except:
        pass

    try:
        from services.insurance_service import get_pmjay_packages
        tools["get_insurance_rate"] = lambda p: get_pmjay_packages(procedure_name=p.get("procedure"))
    except:
        pass

    return tools


TOOLS = {}


def execute_tool(tool_name: str, params: dict) -> str:
    """Execute a tool and return result."""
    global TOOLS
    if not TOOLS:
        TOOLS = load_tools()

    if tool_name in TOOLS:
        try:
            result = TOOLS[tool_name](params)
            return json.dumps(result, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)})
    return json.dumps({"error": f"Unknown tool: {tool_name}"})


def parse_tool_calls(text: str) -> list:
    """Extract tool calls from LLM response."""
    pattern = r'<tool_call>(\w+)</tool_call>\s*<params>(\{[^}]+\})</params>'
    matches = re.findall(pattern, text, re.DOTALL)

    calls = []
    for tool_name, params_str in matches:
        try:
            params = json.loads(params_str)
            calls.append({"tool": tool_name, "params": params})
        except:
            continue
    return calls


# ============================================================
# STREAMING LLM GENERATION
# ============================================================

async def stream_llm_response(user_text: str, history: list) -> AsyncGenerator[str, None]:
    """Stream LLM response token by token."""
    llm = get_llm()

    # Build prompt
    prompt = "<|system|>You are MediRep AI, a medical assistant. Use tools for real-time data.\n"
    prompt += "Available tools: search_drugs, compare_drugs, list_drug_class, get_insurance_rate\n"
    prompt += "Format: <tool_call>name</tool_call><params>{...}</params></s>\n"

    for msg in history[-6:]:  # Last 6 messages for context
        role = msg["role"]
        content = msg["content"]
        prompt += f"<|{role}|>{content}</s>\n"

    prompt += f"<|user|>{user_text}</s>\n<|assistant|>"

    # Stream tokens
    full_response = ""
    for output in llm(prompt, max_tokens=256, stream=True, temperature=0.7):
        token = output["choices"][0]["text"]
        full_response += token

        # Check for tool calls mid-generation
        if "<tool_call>" in full_response and "</params>" in full_response:
            # Execute tool and continue
            tool_calls = parse_tool_calls(full_response)
            if tool_calls:
                for call in tool_calls:
                    result = execute_tool(call["tool"], call["params"])
                    # Don't yield tool call syntax to TTS
                    continue
        else:
            # Clean token for TTS (remove special tokens)
            clean = token.replace("<|", "").replace("|>", "").replace("</s>", "")
            if clean and not clean.startswith("tool"):
                yield clean

    # If there were tool calls, generate final response
    if "<tool_call>" in full_response:
        tool_calls = parse_tool_calls(full_response)
        if tool_calls:
            tool_results = {c["tool"]: execute_tool(c["tool"], c["params"]) for c in tool_calls}

            # Generate response with tool results
            prompt += full_response + f"\n<|tool_result|>{json.dumps(tool_results)}</s>\n<|assistant|>"

            for output in llm(prompt, max_tokens=256, stream=True, temperature=0.7):
                token = output["choices"][0]["text"]
                clean = token.replace("<|", "").replace("|>", "").replace("</s>", "")
                if clean:
                    yield clean


# ============================================================
# VOICE ACTIVITY DETECTION
# ============================================================

class VADProcessor:
    """Process audio and detect speech segments."""

    def __init__(self):
        self.model, self.utils = get_vad()
        self.get_speech_timestamps = self.utils[0]
        self.audio_buffer = deque(maxlen=int(CONFIG["sample_rate"] * 30))  # 30 sec buffer
        self.is_speaking = False
        self.silence_frames = 0
        self.silence_threshold = int(CONFIG["silence_duration"] * CONFIG["sample_rate"] / 512)

    def process_chunk(self, audio_chunk: bytes) -> tuple[bool, np.ndarray | None]:
        """
        Process audio chunk.
        Returns (speech_ended, audio_data if ended else None)
        """
        import torch

        # Convert bytes to numpy
        audio = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
        self.audio_buffer.extend(audio)

        # Check for speech
        audio_tensor = torch.from_numpy(audio)
        speech_prob = self.model(audio_tensor, CONFIG["sample_rate"]).item()

        if speech_prob > CONFIG["vad_threshold"]:
            self.is_speaking = True
            self.silence_frames = 0
            return False, None
        elif self.is_speaking:
            self.silence_frames += 1
            if self.silence_frames >= self.silence_threshold:
                # Speech ended - return buffered audio
                self.is_speaking = False
                self.silence_frames = 0
                audio_data = np.array(self.audio_buffer)
                self.audio_buffer.clear()
                return True, audio_data

        return False, None


# ============================================================
# WEBSOCKET ENDPOINT
# ============================================================

@app.websocket("/ws/realtime")
async def realtime_voice(websocket: WebSocket):
    """Real-time bidirectional voice conversation."""
    await websocket.accept()

    vad = VADProcessor()
    whisper = get_whisper()
    tts = get_tts()
    conversation_history = []

    print("Client connected")

    try:
        while True:
            # Receive audio chunk from client
            audio_chunk = await websocket.receive_bytes()

            # Process with VAD
            speech_ended, audio_data = vad.process_chunk(audio_chunk)

            if speech_ended and audio_data is not None:
                # Transcribe
                segments, _ = whisper.transcribe(
                    audio_data,
                    language="en",
                    vad_filter=True,
                )
                user_text = " ".join(s.text for s in segments).strip()

                if not user_text:
                    continue

                print(f"User: {user_text}")

                # Add to history
                conversation_history.append({"role": "user", "content": user_text})

                # Stream response
                full_response = ""
                async for audio_chunk in tts.synthesize_streaming(
                    stream_llm_response(user_text, conversation_history)
                ):
                    # Send audio chunk to client immediately
                    await websocket.send_bytes(audio_chunk)

                # Add assistant response to history
                # (We'd need to capture this from the LLM stream)

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        await websocket.close()


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": {
            "vad": _vad_model is not None,
            "whisper": _whisper_model is not None,
            "llm": _llm is not None,
            "tts": _tts is not None,
        }
    }


@app.on_event("startup")
async def startup():
    """Pre-load models on startup."""
    print("Loading models...")
    # Load in background to not block startup
    asyncio.create_task(asyncio.to_thread(get_vad))
    asyncio.create_task(asyncio.to_thread(get_whisper))
    asyncio.create_task(asyncio.to_thread(get_llm))
    asyncio.create_task(asyncio.to_thread(get_tts))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8998)
