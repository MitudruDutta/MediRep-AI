#!/bin/bash
# MediRep Real-Time Voice Setup

set -e

echo "======================================"
echo "MediRep Real-Time Voice Setup"
echo "======================================"

# Check CUDA
if command -v nvidia-smi &> /dev/null; then
    echo "GPU detected:"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo "WARNING: No GPU detected. Voice will be slow."
fi

# Create virtual environment
echo ""
echo "[1/5] Creating virtual environment..."
python -m venv .venv
source .venv/bin/activate

# Install PyTorch with CUDA
echo ""
echo "[2/5] Installing PyTorch..."
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121 -q

# Install requirements
echo ""
echo "[3/5] Installing requirements..."
pip install -r requirements.txt -q

# Install llama-cpp with CUDA
echo ""
echo "[4/5] Installing llama-cpp-python with CUDA..."
CMAKE_ARGS="-DGGML_CUDA=on" pip install llama-cpp-python --force-reinstall --no-cache-dir -q

# Install Piper TTS
echo ""
echo "[5/5] Installing Piper TTS..."
pip install piper-tts -q

# Download Piper voice model
echo ""
echo "Downloading Piper voice model..."
mkdir -p models/piper
cd models/piper
if [ ! -f "en_US-lessac-medium.onnx" ]; then
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
fi
cd ../..

echo ""
echo "======================================"
echo "Setup complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Fine-tune model in Colab (upload train.jsonl, val.jsonl)"
echo "2. Download medirep-voice.zip from Colab"
echo "3. Extract: unzip medirep-voice.zip -d models/"
echo "4. Run: python server_realtime.py"
echo ""
echo "Model path expected: models/medirep-voice-q4_k_m.gguf"
