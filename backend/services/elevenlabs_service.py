import os
from io import BytesIO
from elevenlabs.client import ElevenLabs
from config import ELEVENLABS_API_KEY
import logging

logger = logging.getLogger(__name__)

def get_elevenlabs_client():
    if not ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY is not set")
    return ElevenLabs(api_key=ELEVENLABS_API_KEY)

async def transcribe_with_elevenlabs(audio_bytes: bytes) -> str:
    """
    Transcribe audio using ElevenLabs Scribe v2 model.
    """
    try:
        client = get_elevenlabs_client()
        
        # ElevenLabs client is synchronous, so we wrap it if we want async, 
        # or just run it. The user example is synchronous.
        # For FastAPI, it's better to run blocking IO in a threadpool if it takes time,
        # but let's stick to the simple implementation first or use run_in_executor.
        
        audio_file = BytesIO(audio_bytes)
        
        import asyncio
        import functools
        
        loop = asyncio.get_running_loop()
        
        logger.info("Starting ElevenLabs call in thread pool")
        
        # The transcription method requires a file-like object
        # Run synchronous SDK call in thread pool
        # Run synchronous SDK call in thread pool with timeout
        transcription = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                functools.partial(
                    client.speech_to_text.convert,
                    file=audio_file,
                    model_id="scribe_v2",
                    tag_audio_events=False,
                    language_code="eng",
                    diarize=False
                )
            ),
            timeout=15.0 # 15 second timeout prevents hanging
        )
        
        logger.info("ElevenLabs API returned response")
        return transcription.text
        
    except Exception as e:
        logger.error(f"ElevenLabs transcription failed: {str(e)}")
        raise e
