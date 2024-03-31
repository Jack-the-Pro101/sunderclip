import { ComponentProps, createContext, createSignal, onCleanup, onMount, useContext } from "solid-js";
import { MediaData, TrimRange } from "../../types";
import { createStore } from "solid-js/store";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

function createAppContext() {
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [videoFile, setVideoFile] = createSignal<string | null>(null);
  const [mediaData, setMediaData] = createSignal<MediaData | null>(null);
  const [trim, setTrim] = createStore<TrimRange>({ start: 0, end: Infinity });
  const [rendering, setRendering] = createSignal(false);

  return [
    { videoElement, videoFile, mediaData, rendering, trim },
    { setVideoElement, setVideoFile, setMediaData, setTrim, setRendering },
  ] as const;
}
type AppContextType = ReturnType<typeof createAppContext>;

export const AppContext = createContext<AppContextType>();

export function useAppContext() {
  const context = useContext(AppContext);

  if (context == null) throw new Error("Cannot access app context outside ContextProvider");

  return context;
}

type AppProvider = {} & ComponentProps<"div">;
export default function AppProvider(props: AppProvider) {
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [videoFile, setVideoFile] = createSignal<string | null>(null);
  const [mediaData, setMediaData] = createSignal<MediaData | null>(null);
  const [trim, setTrim] = createStore<TrimRange>({ start: 0, end: Infinity });
  const [rendering, setRendering] = createSignal(false);

  function newProject() {
    // TODO: implement actual new project dialog
    setVideoFile(null);
    setMediaData(null);
    setTrim({ start: 0, end: Infinity });
  }

  async function toggleFullscreen(event: KeyboardEvent) {
    if (event.code === "F11") await invoke("toggle_fullscreen");
  }

  onMount(async () => {
    await listen("new_proj", newProject);
    window.addEventListener("keydown", toggleFullscreen);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", toggleFullscreen);
  });

  return (
    <AppContext.Provider
      value={[
        { videoElement, videoFile, mediaData, rendering, trim },
        { setVideoElement, setVideoFile, setMediaData, setRendering, setTrim },
      ]}
    >
      {props.children}
    </AppContext.Provider>
  );
}
