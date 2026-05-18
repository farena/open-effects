# Whisper ASR Service

Local speech-to-text transcription using [openai-whisper-asr-webservice](https://github.com/ahmetoner/whisper-asr-webservice) with the `faster_whisper` engine.

---

## Prerequisites

### 1. NVIDIA driver on the Windows host

Install the latest NVIDIA Game Ready or Studio driver from [nvidia.com/drivers](https://www.nvidia.com/drivers). The Windows driver exposes the GPU to WSL2 automatically — no separate Linux driver install is needed inside WSL2.

### 2. NVIDIA Container Toolkit in WSL2

Inside your WSL2 terminal:

```bash
sudo apt install nvidia-container-toolkit && sudo systemctl restart docker
```

### Verify GPU is accessible inside Docker

```bash
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

If this prints your GPU details, you are ready to go.

---

## Launch the Whisper service

From the repository root:

```bash
docker compose up -d whisper
```

### First-run note

The `small` model (~460 MB) is downloaded the first time you POST to `/asr`. Expect a delay of **~30 seconds** on the initial request while the model downloads and loads. Subsequent requests are fast because the model stays loaded until `MODEL_IDLE_TIMEOUT` (300 s) elapses with no activity.

---

## Verify the service is running

```bash
curl localhost:9000/docs
```

The OpenAPI documentation page should render in your browser at `http://localhost:9000/docs`.

---

## Switching the model

To use a larger / more accurate model (e.g. `large-v3-turbo`):

1. Edit `docker-compose.yml` and change the `ASR_MODEL` environment variable:
   ```yaml
   ASR_MODEL: large-v3-turbo
   ```
2. Recreate the container:
   ```bash
   docker compose up -d --force-recreate whisper
   ```

The new model will be downloaded on the first request. All models are stored in the `whisper-models` Docker volume so they persist across container restarts.

---

## CPU fallback

If you do not have an NVIDIA GPU, make two changes to `docker-compose.yml`:

1. Change the image tag from `:latest-gpu` to `:latest`:
   ```yaml
   image: onerahmet/openai-whisper-asr-webservice:latest
   ```
2. Remove the entire `deploy:` block.

Transcription will be slower but otherwise fully functional.

---

## Troubleshooting

### Port 9000 is already in use

Change the host-side port mapping in `docker-compose.yml`:

```yaml
ports:
  - "9001:9000"
```

Then update `WHISPER_URL` in your `.env` to `http://localhost:9001`.

### Model download times out on first request

Increase `MODEL_IDLE_TIMEOUT` (seconds) in `docker-compose.yml`:

```yaml
MODEL_IDLE_TIMEOUT: "600"
```

Recreate the container with `docker compose up -d --force-recreate whisper` after changing the value.
