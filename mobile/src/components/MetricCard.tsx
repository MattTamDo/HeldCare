import { StyleSheet, Text, View } from "react-native";

type MetricCardProps = {
  title: string;
  value: string;
  accent: string;
  valueColor?: string;
  monospace?: boolean;
};

export default function MetricCard({
  title,
  value,
  accent,
  valueColor = "#ffffff",
  monospace = false,
}: MetricCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          styles.value,
          { color: valueColor },
          monospace ? styles.monospace : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 78,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 12,
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  value: {
    fontSize: 24,
    fontWeight: "800",
  },
  monospace: {
    fontVariant: ["tabular-nums"],
  },
});
