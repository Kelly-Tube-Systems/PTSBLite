import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../src/platform/desktop";

// The page's only way to reach the main process. Each method calls the main
// process's handler of the same name, so the two cannot drift apart unnoticed:
// both are typed against DesktopBridge.

function invoke<K extends keyof DesktopBridge>(channel: K): ReturnType<DesktopBridge[K]> {
  return ipcRenderer.invoke(channel) as ReturnType<DesktopBridge[K]>;
}

const bridge: DesktopBridge = {
  updateReady: () => invoke("updateReady"),
  installUpdate: () => invoke("installUpdate")
};

contextBridge.exposeInMainWorld("ptsblite", bridge);
