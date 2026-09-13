import { StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

type WaveformCardProps = {
  title: string;
  samples: number[];
  accent: string;
  prominence?: "primary" | "secondary";
};

function pointsFor(samples: number[], width: number, height: number, paddingFraction: number) {
  if (samples.length < 2) return "";

  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const rawRange = Math.max(max - min, 0.0001);
  const padding = rawRange * paddingFraction;
  const low = min - padding;
  const high = max + padding;
  const range = Math.max(high - low, 0.0001);

  return samples
    .map((sample, index) => {
      const x = (width * index) / (samples.length - 1);
      const y = height * (1 - (sample - low) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function WaveformCard({
  title,
  samples,
  accent,
  prominence = "secondary",
}: WaveformCardProps) {
  const width = 300;
  const height = prominence === "primary" ? 110 : 74;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.trace, { borderColor: `${accent}55`, backgroundColor: `${accent}1F` }]}>
        {samples.length > 1 ? (
          <Svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
            <Polyline
              points={pointsFor(samples, width, height, prominence === "primary" ? 0.14 : 0.08)}
              fill="none"
              stroke={accent}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 12,
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  trace: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
});
