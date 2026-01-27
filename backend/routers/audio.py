from fastapi import APIRouter, UploadFile, File, HTTPException, Form
import logging
from services.elevenlabs_service import transcribe_with_elevenlabs

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    """Transcribe uploaded audio file using ElevenLabs."""
    logger.info(f"Received audio transcription request: {file.filename}, type={file.content_type}")
    try:
        # Read file
        content = await file.read()
        logger.info(f"Read audio file: {len(content)} bytes")
        
        # Transcribe using ElevenLabs
        text = await transcribe_with_elevenlabs(content)
        # text = "This is a test transcription. Connectivity is good."
        
        logger.info(f"Transcription successful: {text[:50]}...")
        return {"text": text}
        
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
