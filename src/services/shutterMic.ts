// The microphone for the shutter test (#42). Raw audio, with the phone's
// voice processing (echo cancelling, noise suppression, automatic gain)
// turned off where the browser allows, since each of them smears clicks.
// A take waits for the first loud sound, keeps a little from before it, and
// stops once the slowest plausible second click would have landed.

export interface Take {
  samples: Float32Array;
  sampleRate: number;
}

export interface Mic {
  /** Records one release at this marked speed. Rejects with "timeout" if nothing is heard. */
  take(nominalSec: number, onLevel?: (level: number) => void): Promise<Take>;
  cancel(): void;
  close(): void;
}

const PRE_ROLL_SEC = 0.15;
const WAIT_SEC = 20;

export function micAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== "undefined";
}

export async function openMic(): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });
  const ctx = new AudioContext();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor is deprecated but runs everywhere, iOS Safari included, without a worklet file.
  const node = ctx.createScriptProcessor(2048, 1, 1);
  const sink = ctx.createGain();
  sink.gain.value = 0;
  source.connect(node);
  node.connect(sink);
  sink.connect(ctx.destination);

  let active: { reject: (e: Error) => void } | null = null;

  return {
    take(nominalSec, onLevel) {
      return new Promise<Take>((resolve, reject) => {
        const sr = ctx.sampleRate;
        const pre: Float32Array[] = [];
        const kept: Float32Array[] = [];
        let preLen = 0;
        let triggeredAt = -1;
        let recorded = 0;
        let baseline = 0;
        let chunks = 0;
        const tail = Math.round((Math.max(0.15, nominalSec * 4 + 0.08) + 0.35) * sr);
        const timer = setTimeout(() => finish(new Error("timeout")), WAIT_SEC * 1000);
        active = { reject: (e) => finish(e) };

        function finish(err?: Error) {
          clearTimeout(timer);
          node.onaudioprocess = null;
          active = null;
          if (err) return reject(err);
          const all = new Float32Array(kept.reduce((n, c) => n + c.length, 0));
          let o = 0;
          for (const c of kept) {
            all.set(c, o);
            o += c.length;
          }
          resolve({ samples: all, sampleRate: sr });
        }

        node.onaudioprocess = (e) => {
          const data = new Float32Array(e.inputBuffer.getChannelData(0));
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v));
          onLevel?.(peak);
          if (triggeredAt < 0) {
            // The background level: follows the quiet, never learns a click (which may come at once).
            chunks++;
            if (chunks === 1) baseline = Math.min(peak, 0.01);
            else if (peak < baseline * 3) baseline = baseline * 0.95 + peak * 0.05;
            pre.push(data);
            preLen += data.length;
            while (preLen - pre[0].length > PRE_ROLL_SEC * sr) preLen -= pre.shift()!.length;
            if (peak > Math.max(0.02, baseline * 6)) {
              triggeredAt = recorded;
              kept.push(...pre);
            }
            return;
          }
          kept.push(data);
          recorded += data.length;
          if (recorded - triggeredAt >= tail) finish();
        };
      });
    },
    cancel() {
      active?.reject(new Error("cancelled"));
    },
    close() {
      active?.reject(new Error("cancelled"));
      node.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
