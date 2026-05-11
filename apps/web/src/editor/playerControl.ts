import type { PlayerRef } from "@remotion/player";

let _player: PlayerRef | null = null;

export const playerControl = {
  bind(ref: PlayerRef | null): void {
    _player = ref;
  },
  get(): PlayerRef | null {
    return _player;
  },
  requestFullscreen(): void {
    _player?.requestFullscreen();
  },
};
