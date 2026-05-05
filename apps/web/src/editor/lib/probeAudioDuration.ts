export function probeAudioDuration(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = src;
    a.onloadedmetadata = () => resolve(a.duration);
    a.onerror = () => reject(new Error("audio_probe_failed"));
  });
}

export const secondsToFrames = (seconds: number, fps: number) =>
  Math.floor(seconds * fps);
