// AudioWorkletProcessor — captures raw mic PCM at whatever sample rate
// the AudioContext was created with (whisperRecognition.ts creates it at
// 16000Hz, matching Xenova/whisper-base's own preprocessor_config.json,
// so no separate resampling step is needed downstream) and streams small
// Float32Array chunks + a per-chunk RMS energy reading back to the main
// thread over this node's MessagePort, for silence/pause detection.
//
// Deliberately plain JavaScript, not TypeScript: Vite's `?url`-suffix
// import does not transpile .ts files (confirmed via Vite's own issue
// tracker, #9952), and this file is loaded through
// `audioWorklet.addModule(new URL('./pcmCaptureProcessor.js', import.meta.url))`
// — keeping it untyped removes any dependency on a transpile step
// running correctly inside the isolated AudioWorkletGlobalScope, which
// has no bundler-injected helpers.
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    const channel = input && input[0]
    if (!channel || channel.length === 0) return true

    let sumSquares = 0
    for (let i = 0; i < channel.length; i++) {
      sumSquares += channel[i] * channel[i]
    }
    const rms = Math.sqrt(sumSquares / channel.length)

    // Copy out of the process()-owned buffer before posting — inputs[]
    // is reused/cleared by the audio rendering thread on the next
    // render quantum, so the reference itself isn't safe to hand off.
    this.port.postMessage({ samples: channel.slice(0), rms })

    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
