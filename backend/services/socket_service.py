import socketio
import logging

logger = logging.getLogger(__name__)

# Initialize Socket.IO server (ASGI)
# CORS is handled here for the socket connection
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'  # Allow all origins for development
)

@sio.event
async def connect(sid, environ):
    logger.info("Socket connected: %s", sid)

@sio.event
async def disconnect(sid):
    logger.info("Socket disconnected: %s", sid)

@sio.event
async def join_room(sid, data):
    room = data.get('room')
    if room:
        sio.enter_room(sid, room)
        logger.info("Socket %s joined room %s", sid, room)
