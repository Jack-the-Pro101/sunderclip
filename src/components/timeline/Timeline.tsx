import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import Panel from "../panel/Panel";

import styles from "./Timeline.module.css";
import { formatSeconds } from "../../util";
import { useAppContext } from "../../contexts/AppContext";
import { usePlayerContext } from "../../contexts/PlayerContext";

export default function Timeline() {
  const [{ videoElement, mediaData }] = useAppContext();
  const [{ currentTime, playing }, { setCurrentTime, setPlaying }] = usePlayerContext();

  const [dragging, setDragging] = createSignal(false);
  const [wasPlaying, setWasPlaying] = createSignal(false);
  const [cursorPos, setCursorPos] = createSignal(0);
  const [timecodeType, setTimecodeType] = createSignal<"frames" | "time">("frames");

  let cursorRef: HTMLDivElement;
  let timelineBarRef: HTMLDivElement;

  function pauseVideo() {
    videoElement()!.pause();
  }

  function resumeVideo() {
    videoElement()!.play();
  }

  function toggleVideoPlaying() {
    if (playing()) {
      pauseVideo();
    } else {
      resumeVideo();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    switch (event.code) {
      case "Space": {
        toggleVideoPlaying();
        break;
      }
      case "ArrowLeft": {
        break;
      }
      case "ArrowRight": {
        break;
      }
      default:
        return;
    }

    event.preventDefault();
  }

  function updateVideoTime(location: number) {
    videoElement()!.currentTime = location;

    setCurrentTime(location);
  }

  function handleCursorDown(event: PointerEvent) {
    setWasPlaying(playing());
    setDragging(true);
    pauseVideo();
    handleCursorMove(event);
  }

  function handleCursorMove(event: PointerEvent) {
    if (!dragging()) return;

    const cursorWidth = cursorRef.getBoundingClientRect().width;
    const cursorCenter = cursorWidth / 2;
    const mouseX = event.x;
    const timelineBarRect = timelineBarRef.getBoundingClientRect();
    const timelineBarX = timelineBarRect.x;

    const delta = mouseX - timelineBarX;

    const percentage = Math.max(0, Math.min((delta - cursorCenter) / (timelineBarRect.width - cursorWidth), 1));

    updateVideoTime(videoElement()!.duration * percentage);
    setCursorPos(Math.max(0, Math.min(delta, timelineBarRect.width - cursorCenter) - cursorCenter));
  }

  function handleCursorUp(_: PointerEvent) {
    if (!dragging()) return;

    setDragging(false);
    if (wasPlaying()) resumeVideo();
  }

  createEffect(() => {
    if (dragging()) return;

    const cursorWidth = cursorRef.getBoundingClientRect().width;
    const timelineBarRect = timelineBarRef.getBoundingClientRect();

    const time = currentTime();
    const duration = videoElement()!.duration;

    setCursorPos((!isNaN(duration) ? time / duration : 0) * (timelineBarRect.width - cursorWidth));
  });

  onMount(() => {
    window.addEventListener("pointermove", handleCursorMove);
    window.addEventListener("pointerup", handleCursorUp);
    window.addEventListener("keydown", handleKeydown);
  });

  onCleanup(() => {
    window.removeEventListener("pointermove", handleCursorMove);
    window.removeEventListener("pointerup", handleCursorUp);
    window.removeEventListener("keydown", handleKeydown);
  });

  return (
    <Panel class={styles.timeline}>
      <div class={styles.timeline__info}>
        <p class={styles.timeline__timecode} contenteditable>
          {formatSeconds(currentTime(), timecodeType() === "frames" ? mediaData()?.fps || 1 : undefined)}
        </p>
      </div>
      <div class={styles.timeline__controls}>
        <div class={styles.timeline__container} ref={(ref) => (timelineBarRef = ref)} tabIndex={0} role="slider" aria-label="Seek slider">
          <div class={styles.timeline__cursor} onPointerDown={handleCursorDown} style={`--translateX: ${cursorPos()}px`} ref={(ref) => (cursorRef = ref)}></div>
          <div class={styles.timeline__bar}></div>
          {/* <div class={styles.timeline__trim_start}></div>
          <div class={styles.timeline__trim_end}></div> */}
        </div>
      </div>
    </Panel>
  );
}
