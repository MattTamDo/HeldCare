import Constants from "expo-constants";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import WaveformCard from "../components/WaveformCard";
import {
  SmartSpectra,
  hasSmartSpectraNativeModule,
} from "../native/SmartSpectra";
import { postHealthSnapshot, type HealthBridgeConfig } from "../lib/healthBridge";
import type { MeasurementWithConfidence, SmartSpectraSnapshot } from "../types/vitals";

const EMPTY_SNAPSHOT: SmartSpectraSnapshot = {
  processingStatus: "idle",
  validation: { code: "waiting", label: "Waiting" },
  arterialPressureTrace: [],
  chestTrace: [],
  abdomenTrace: [],
};

function sampleWave(length: number, tick: number, amplitude = 1, phase = 0) {
  return Array.from({ length }, (_, index) => {
    const t = (tick + index) / 8 + phase;
    return Math.sin(t) * amplitude + Math.sin(t * 0.42) * amplitude * 0.35;
  });
}

function createMockSnapshot(tick: number): SmartSpectraSnapshot {
  const confidence = Math.min(96, 70 + tick * 1.4);
  const settled = Math.min(tick / 10, 1);

  return {
    processingStatus: "running",
    validation: tick < 4 ? { code: "cameraTuning", label: "Tuning" } : { code: "ok", label: "OK" },
    pulseRate: {
      value: 72 + Math.sin(tick / 8) * (3 - settled * 1.4),
      confidence,
      timestamp: Date.now(),
    },
    breathingRate: {
      value: 15 + Math.sin(tick / 9) * (1.2 - settled * 0.5),
      confidence: Math.min(94, confidence - 4),
      timestamp: Date.now(),
    },
    arterialPressureTrace: sampleWave(180, tick, 1.4),
    chestTrace: sampleWave(90, tick, 0.9, 0.8),
    abdomenTrace: sampleWave(90, tick, 0.75, 1.6),
    hrvRmssd: 42 + Math.sin(tick / 6) * 4,
    expression: {
      label: "Neutral",
      confidence: 91,
    },
  };
}

function metricRows(snapshot: SmartSpectraSnapshot) {
  return [
    { label: "Pulse", value: formatMeasurement(snapshot.pulseRate, " bpm") },
    { label: "Respiration", value: formatMeasurement(snapshot.breathingRate, " brpm") },
    {
      label: "Signal quality",
      value: snapshot.pulseRate?.confidence ? `${Math.round(snapshot.pulseRate.confidence)}%` : "--",
    },
    {
      label: "Pressure waveform",
      value: snapshot.arterialPressureTrace.length > 0 ? `${snapshot.arterialPressureTrace.length} samples` : "--",
    },
    { label: "HRV RMSSD", value: formatHrv(snapshot.hrvRmssd) },
    {
      label: "Face analysis",
      value: snapshot.expression
        ? `${snapshot.expression.label} ${Math.round(snapshot.expression.confidence)}%`
        : "--",
    },
  ];
}

function confidenceColor(confidence?: number) {
  if (!Number.isFinite(confidence)) return "rgba(255,255,255,0.65)";
  const value = Math.max(0, Math.min(Number(confidence), 100));
  if (value >= 85) return "#3ee88b";
  if (value >= 60) return "#f2d15c";
  return "#ff5c72";
}

function statusColor(status: SmartSpectraSnapshot["processingStatus"]) {
  if (status === "running") return "#3ee88b";
  if (status === "starting" || status === "stopping") return "#f2a65c";
  if (status === "error") return "#ff5c72";
  return "#8993a7";
}

function validationColor(code: string) {
  if (code === "ok" || code === "OK") return "#3ee88b";
  if (code === "cameraTuning" || code === "Tuning") return "#f2a65c";
  return "#f2d15c";
}

function formatMeasurement(metric?: MeasurementWithConfidence, suffix = "", digits = 0) {
  if (!metric || !Number.isFinite(metric.value)) return "--";
  return `${metric.value.toFixed(digits)}${suffix}`;
}

function formatHrv(value?: number) {
  if (!value || value <= 0) return "--";
  return `${value.toFixed(1)} ms`;
}

function SnapshotBadge({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.badge}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={styles.badgeText}>
        {title}: {value}
      </Text>
    </View>
  );
}

function RecordedMetricsPanel({ snapshot }: { snapshot: SmartSpectraSnapshot }) {
  const rows = metricRows(snapshot);
  const ready = rows.filter((row) => row.value !== "--").length;

  return (
    <View style={styles.recordedPanel}>
      <View style={styles.recordedHeader}>
        <Text style={styles.recordedTitle}>RECORDED METRICS</Text>
        <Text style={styles.recordedCount}>{ready}/6</Text>
      </View>
      <View style={styles.recordedRows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.recordedRow}>
            <View style={styles.recordedLabel}>
              <View style={[styles.recordedDot, row.value !== "--" ? styles.recordedDotReady : null]} />
              <Text style={styles.recordedLabelText}>{row.label}</Text>
            </View>
            <Text numberOfLines={1} style={styles.recordedValue}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function VitalOverlayCard({
  title,
  value,
  accent,
  valueColor = "#ffffff",
  wide = false,
}: {
  title: string;
  value: string;
  accent: string;
  valueColor?: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.vitalCard, wide ? styles.vitalCardWide : null]}>
      <View style={styles.vitalTitleRow}>
        <View style={[styles.vitalDot, { backgroundColor: accent }]} />
        <Text numberOfLines={1} style={styles.vitalTitle}>
          {title}
        </Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.vitalValue, { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

export default function SmartSpectraVitalsScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 820;
  const [snapshot, setSnapshot] = useState<SmartSpectraSnapshot>(EMPTY_SNAPSHOT);
  const [started, setStarted] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>("front");
  const [permission, requestPermission] = useCameraPermissions();
  const [bridgeStatus, setBridgeStatus] = useState<"off" | "sending" | "connected" | "error">("off");
  const packetsRef = useRef(0);
  const lastBridgeSentAtRef = useRef(0);

  const apiKey = String(Constants.expoConfig?.extra?.smartSpectraApiKey ?? "");
  const bridgeConfig = useMemo<HealthBridgeConfig | null>(() => {
    const platformUrl = String(Constants.expoConfig?.extra?.careFallPlatformUrl ?? "");
    const sessionId = String(Constants.expoConfig?.extra?.careFallSessionId ?? "");
    if (!platformUrl || !sessionId) return null;
    return { platformUrl, sessionId };
  }, []);
  const useMock = !hasSmartSpectraNativeModule || !apiKey;

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      void requestPermission();
    }
  }, [permission?.canAskAgain, permission?.granted, requestPermission]);

  useEffect(() => {
    if (useMock) {
      if (!permission?.granted) {
        setStarted(false);
        setSnapshot(EMPTY_SNAPSHOT);
        return;
      }

      setStarted(true);
      let tick = 0;
      setSnapshot(createMockSnapshot(tick));
      const interval = setInterval(() => {
        tick += 1;
        setSnapshot(createMockSnapshot(tick));
      }, 500);

      return () => clearInterval(interval);
    }

    const subscription = SmartSpectra.addSnapshotListener(setSnapshot);

    void SmartSpectra.configure({
      apiKey,
      cameraPosition: "front",
      imageOutputEnabled: true,
    }).then(async () => {
      if (apiKey && hasSmartSpectraNativeModule) {
        await SmartSpectra.start();
        setStarted(true);
      }
    });

    return () => {
      subscription.remove();
      void SmartSpectra.stop();
    };
  }, [apiKey, permission?.granted, useMock]);

  const expressionText = useMemo(() => {
    if (!snapshot.expression) return "--";
    const label = snapshot.expression.label.slice(0, 8).padEnd(8, " ");
    const confidence = `${Math.round(snapshot.expression.confidence)}%`.padStart(4, " ");
    return `${label} ${confidence}`;
  }, [snapshot.expression]);

  useEffect(() => {
    if (!bridgeConfig || !permission?.granted || snapshot.processingStatus !== "running") {
      setBridgeStatus(bridgeConfig ? "off" : "off");
      return;
    }

    const now = Date.now();
    if (now - lastBridgeSentAtRef.current < 1000) return;
    lastBridgeSentAtRef.current = now;
    packetsRef.current += 1;
    setBridgeStatus("sending");

    void postHealthSnapshot({
      config: bridgeConfig,
      snapshot,
      packets: packetsRef.current,
      cameraFacing,
      source: useMock ? "expo-mock" : "expo-presage",
    })
      .then(() => setBridgeStatus("connected"))
      .catch(() => setBridgeStatus("error"));
  }, [bridgeConfig, cameraFacing, permission?.granted, snapshot, useMock]);

  async function toggleMeasurement() {
    if (started) {
      await SmartSpectra.stop();
      setStarted(false);
    } else {
      await SmartSpectra.start();
      setStarted(true);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.cameraBackdrop}>
        {snapshot.previewBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${snapshot.previewBase64}` }}
            style={styles.cameraBackdropMedia}
            resizeMode="cover"
          />
        ) : permission?.granted ? (
          <CameraView facing={cameraFacing} style={styles.cameraBackdropMedia} />
        ) : (
          <View style={styles.cameraFallback}>
            <Text style={styles.previewIcon}>[]</Text>
            <Text style={styles.previewText}>
              {permission?.canAskAgain === false
                ? "Camera permission is disabled"
                : "Camera permission needed"}
            </Text>
          </View>
        )}
        <View style={styles.backdropShade} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.screen, { paddingVertical: compact ? 10 : 14 }]}
      >
        <View style={styles.topRowOverlay}>
          <View style={styles.badgesOverlay}>
            <SnapshotBadge
              title="Status"
              value={snapshot.processingStatus}
              color={statusColor(snapshot.processingStatus)}
            />
            <SnapshotBadge
              title="Validation"
              value={snapshot.validation.label}
              color={validationColor(snapshot.validation.code)}
            />
          </View>
          <Pressable
            disabled={useMock}
            onPress={toggleMeasurement}
            style={({ pressed }) => [
              styles.startButton,
              pressed ? styles.startButtonPressed : null,
              useMock ? styles.startButtonDisabled : null,
            ]}
          >
            <Text style={styles.startButtonText}>{useMock ? "Mock" : started ? "Stop" : "Start"}</Text>
          </Pressable>
        </View>

        <View style={[styles.trackerSurface, { minHeight: compact ? 606 : 690 }]}>
          <View style={styles.trackerHeader}>
            <View>
              <Text style={styles.trackerEyebrow}>PRESAGE HEALTH TRACKER</Text>
              <Text style={styles.trackerTitle}>
                {permission?.granted ? "Live contactless measurement" : "Camera waiting"}
              </Text>
            </View>
            <View style={styles.headerBadges}>
              <View style={styles.monitorBadge}>
                <View style={[styles.monitorDot, permission?.granted ? null : styles.monitorDotWaiting]} />
                <Text style={styles.monitorText}>{permission?.granted ? "ON" : "WAIT"}</Text>
              </View>
              <View style={styles.monitorBadge}>
                <View
                  style={[
                    styles.monitorDot,
                    bridgeStatus === "connected" ? null : styles.monitorDotWaiting,
                    bridgeStatus === "error" ? styles.monitorDotError : null,
                  ]}
                />
                <Text style={styles.monitorText}>
                  {bridgeStatus === "connected"
                    ? "SYNC"
                    : bridgeStatus === "sending"
                      ? "SEND"
                      : bridgeStatus === "error"
                        ? "ERR"
                        : "LOCAL"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.vitalGrid}>
            <VitalOverlayCard
              title="Pulse Rate"
              value={formatMeasurement(snapshot.pulseRate, " bpm")}
              accent="#ff4e55"
              valueColor={confidenceColor(snapshot.pulseRate?.confidence)}
            />
            <VitalOverlayCard
              title="Breathing Rate"
              value={formatMeasurement(snapshot.breathingRate, " brpm")}
              accent="#34d5ff"
              valueColor={confidenceColor(snapshot.breathingRate?.confidence)}
            />
            <VitalOverlayCard
              title="HRV RMSSD"
              value={formatHrv(snapshot.hrvRmssd)}
              accent="#26d6b0"
            />
            <VitalOverlayCard
              title="Expression"
              value={expressionText}
              accent="#ff9e3d"
            />
          </View>

          <View style={[styles.pressureTracker, { height: compact ? 176 : 206 }]}>
            <WaveformCard
              title="Arterial Pressure"
              samples={snapshot.arterialPressureTrace}
              accent="#e650ff"
              prominence="primary"
            />
          </View>

          <View style={[styles.waveformRow, { height: compact ? 136 : 150 }]}>
            <WaveformCard
              title="Chest Waveform"
              samples={snapshot.chestTrace}
              accent="#26c6da"
            />
            <WaveformCard
              title="Abdomen Waveform"
              samples={snapshot.abdomenTrace}
              accent="#26a7ff"
            />
          </View>
        </View>

        <View style={styles.cameraSwitch}>
          <Pressable
            onPress={() => setCameraFacing("front")}
            style={[styles.switchButton, cameraFacing === "front" ? styles.switchButtonActive : null]}
          >
            <Text style={[styles.switchText, cameraFacing === "front" ? styles.switchTextActive : null]}>
              FRONT CAMERA
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setCameraFacing("back")}
            style={[styles.switchButton, cameraFacing === "back" ? styles.switchButtonActive : null]}
          >
            <Text style={[styles.switchText, cameraFacing === "back" ? styles.switchTextActive : null]}>
              BACK CAMERA
            </Text>
          </Pressable>
        </View>

        <RecordedMetricsPanel snapshot={snapshot} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050813",
  },
  cameraBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050813",
  },
  cameraBackdropMedia: {
    width: "100%",
    height: "100%",
  },
  cameraFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#10182d",
  },
  backdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,5,14,0.42)",
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  screen: {
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: "transparent",
    paddingBottom: 18,
  },
  topRowOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    zIndex: 1,
  },
  badgesOverlay: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    flexShrink: 1,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  startButton: {
    minWidth: 76,
    minHeight: 38,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  startButtonPressed: {
    opacity: 0.8,
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: "#050813",
    fontSize: 12,
    fontWeight: "800",
  },
  previewIcon: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
  },
  previewText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
    fontWeight: "700",
  },
  trackerSurface: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(15,20,29,0.50)",
    overflow: "hidden",
    padding: 16,
    gap: 14,
  },
  trackerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trackerEyebrow: {
    color: "#aeb8cb",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  trackerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  monitorBadge: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
  },
  monitorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3ee88b",
  },
  monitorDotWaiting: {
    backgroundColor: "#f2d15c",
  },
  monitorDotError: {
    backgroundColor: "#ff5c72",
  },
  monitorText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
  },
  vitalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  vitalCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 96,
    justifyContent: "space-between",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(30,38,49,0.72)",
    padding: 14,
  },
  vitalCardWide: {
    flexBasis: "100%",
  },
  vitalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vitalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  vitalTitle: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  vitalValue: {
    fontSize: 30,
    fontWeight: "900",
  },
  pressureTracker: {
    borderRadius: 22,
    overflow: "hidden",
  },
  cameraSwitch: {
    flexDirection: "row",
    gap: 10,
  },
  switchButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(140,152,176,0.34)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  switchButtonActive: {
    borderColor: "#26c6da",
    backgroundColor: "rgba(38,198,218,0.18)",
  },
  switchText: {
    color: "#8993a7",
    fontSize: 12,
    fontWeight: "900",
  },
  switchTextActive: {
    color: "#ffffff",
  },
  recordedPanel: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(140,152,176,0.26)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 12,
    gap: 10,
  },
  recordedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recordedTitle: {
    color: "#aeb8cb",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
  },
  recordedCount: {
    color: "#8993a7",
    fontSize: 14,
    fontWeight: "800",
  },
  recordedRows: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(140,152,176,0.24)",
    overflow: "hidden",
  },
  recordedRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(140,152,176,0.20)",
    paddingHorizontal: 10,
  },
  recordedLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4e5e78",
  },
  recordedDotReady: {
    backgroundColor: "#3ee88b",
  },
  recordedLabelText: {
    color: "#aeb8cb",
    fontSize: 13,
    fontWeight: "600",
  },
  recordedValue: {
    maxWidth: "48%",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  waveformRow: {
    flexDirection: "row",
    gap: 10,
  },
});
