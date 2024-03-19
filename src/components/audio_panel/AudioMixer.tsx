import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { emit } from "@tauri-apps/api/event";

import Panel from "../panel/Panel";

import { useAppContext } from "../../contexts/AppContext";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { FfprobeAudioStream } from "../../../types";

import styles from "./AudioMixer.module.css";
import panelStyles from "../panel/PanelCommon.module.css";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export function createAudioAnalyser(audioContext: AudioContext, source: HTMLMediaElement) {
  const mediaSource = audioContext.createMediaElementSource(source);
  const analyserNode = audioContext.createAnalyser();

  mediaSource.connect(analyserNode);
  analyserNode.connect(audioContext.destination);

  const pcmData = new Float32Array(analyserNode.fftSize);

  function computeAmplitude() {
    analyserNode.getFloatTimeDomainData(pcmData);
    let sumSquares = 0;

    for (const amplitude of pcmData) sumSquares += amplitude ** 2;
    return Math.sqrt(sumSquares / pcmData.length);
  }

  return { computeAmplitude, source: mediaSource };
}

const MAX_AUDIO_DIFF = 0.1;

export default function AudioMixer() {
  const [{ videoFile, mediaData }] = useAppContext();
  const [{ playing, currentTime, audioTracks, audioContext }, { setAudioTracks }] = usePlayerContext();

  const [audioMeters, setAudioMeters] = createSignal<number[]>([]);

  function updateAudioTracks() {
    const result: number[] = [];
    for (let i = 0; i < audioTracks.length; i++) {
      const audioTrack = audioTracks[i];
      result.push(audioTrack.getCurrentAmplitude());

      if (i > 0) {
        audioTrack!.sourceElement!.play();
      }
    }
    setAudioMeters(result);

    if (playing()) {
      requestAnimationFrame(updateAudioTracks);
    } else {
      for (let i = 0; i < audioTracks.length; i++) {
        const audioTrack = audioTracks[i];

        if (i > 0) audioTrack.sourceElement.pause();
      }
    }
  }

  createEffect(() => {
    if (playing()) updateAudioTracks();
  });

  createEffect(() => {
    audioTracks.forEach((stream) => {
      stream.sourceElement.muted = stream.muted;
    });
  });

  createEffect(() => {
    const videoTime = currentTime();

    audioTracks.slice(1).forEach((track) => {
      if (Math.abs(videoTime - track.sourceElement.currentTime) > MAX_AUDIO_DIFF) track.sourceElement.currentTime = videoTime;
    });
  });

  async function requestAudioExtract(videoSource: string, audioTrackIndex: number) {
    console.log("E");

    const response = await invoke<string>("extract_audio", {
      videoSource,
      audioTrackIndex,
    });

    console.log(response);

    try {
      const data = JSON.parse(response) as { audio_source: string };

      return data.audio_source;
    } catch (err) {
      console.error(err);

      return null;
    }
  }

  createEffect(() => {
    const data = mediaData();
    const video = videoFile();
    if (data == null || video == null) return;

    (data.streams.filter((stream) => stream.codec_type === "audio") as FfprobeAudioStream[]).forEach(async (stream, i) => {
      if (i === 0) return setAudioTracks(0, "trackIndex", stream.index);

      const audio = new Audio(`${location.protocol}//extract-audio.${location.hostname}/${encodeURIComponent(video)}/${stream.index}`);
      audio.crossOrigin = "anonymous";

      const { computeAmplitude, source } = createAudioAnalyser(audioContext, audio);

      setAudioTracks(i, {
        trackIndex: stream.index,
        muted: false,
        getCurrentAmplitude: computeAmplitude,
        sourceElement: audio,
        sourceNode: source,
      });
    });
  });

  onCleanup(() => {
    audioTracks.slice(1).forEach((stream) => URL.revokeObjectURL(stream.sourceElement.src));
  });

  return (
    <Panel class={styles.audio_mixer} column>
      <h2 class={panelStyles.heading}>Audio Mixer</h2>
      <ol class={styles.audio_mixer__streams}>
        <Show when={mediaData() != null} fallback={<p class={panelStyles.content_fallback}>{videoFile() != null ? "Loading..." : "No video selected"}</p>}>
          <For each={audioTracks}>
            {(stream, i) => (
              <li class={styles.audio_mixer__stream}>
                <span class={styles.audio_mixer__stream_label} contentEditable>
                  Track {i() + 1}
                </span>
                <span class={styles.audio_mixer__stream_internal}>(stream {stream.trackIndex == -1 ? "?" : stream.trackIndex})</span>

                <div class={styles.audio_mixer__btns}>
                  <button class={styles.audio_mixer__btn} onClick={() => setAudioTracks(i(), "muted", !stream.muted)}>
                    {stream.muted ? "Muted" : "Mute"}
                  </button>
                </div>
                <div class={styles.audio_mixer__visualizer} role="meter" style={`--silence: ${100 - audioMeters()[i()] * 100}%`}></div>
              </li>
            )}
          </For>
        </Show>
      </ol>
    </Panel>
  );
}
