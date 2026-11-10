let context: AudioContext | undefined;
export function sound(kind: string, enabled: boolean) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const notes =
      kind === "money"
        ? [392, 494, 587, 784]
        : kind === "ROLL"
          ? [160, 220, 180, 280]
          : kind === "PLAY"
            ? [330, 240]
            : [440];
    notes.forEach((hz, i) => {
      const osc = context!.createOscillator(),
        gain = context!.createGain();
      osc.type = kind === "ROLL" ? "triangle" : "sine";
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0, now + i * 0.075);
      gain.gain.linearRampToValueAtTime(0.045, now + i * 0.075 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.075 + 0.15);
      osc.connect(gain);
      gain.connect(context!.destination);
      osc.start(now + i * 0.075);
      osc.stop(now + i * 0.075 + 0.17);
    });
  } catch {
    /* Audio is optional in webviews. */
  }
}
