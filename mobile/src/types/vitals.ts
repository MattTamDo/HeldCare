export type ProcessingStatus = "idle" | "starting" | "running" | "stopping" | "error" | "unknown";

export type MeasurementWithConfidence = {
  value: number;
  confidence?: number;
  timestamp?: number;
};

export type ExpressionScore = {
  label: string;
  confidence: number;
};

export type SmartSpectraSnapshot = {
  processingStatus: ProcessingStatus;
  validation: {
    code: string;
    label: string;
  };
  previewBase64?: string;
  pulseRate?: MeasurementWithConfidence;
  breathingRate?: MeasurementWithConfidence;
  arterialPressureTrace: number[];
  chestTrace: number[];
  abdomenTrace: number[];
  hrvRmssd?: number;
  expression?: ExpressionScore;
  error?: string;
};
