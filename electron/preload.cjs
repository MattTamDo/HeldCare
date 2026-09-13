require("@smartspectra/node-sdk/preload");

const { contextBridge } = require("electron");
const {
  breathingMetrics,
  cardioMetrics,
  faceMetrics,
} = require("@smartspectra/node-sdk");

contextBridge.exposeInMainWorld("__carefallElectron", {
  isElectron: true,
  smartSpectraApiKey: process.env.SMARTSPECTRA_API_KEY ?? "",
  smartSpectraMetrics: {
    breathing: breathingMetrics,
    cardio: cardioMetrics,
    face: faceMetrics ?? [],
  },
});
