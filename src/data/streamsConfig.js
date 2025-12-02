// src/data/streamsConfig.js

// Import all 6 stream JSON files (hyphens, not underscores)
import ENG101_MAT110 from "./ENG101-MAT110.json";
import ENG101_MAT092 from "./ENG101-MAT092.json";
import ENG102_MAT110 from "./ENG102-MAT110.json";
import ENG102_MAT092 from "./ENG102-MAT092.json";
import ENG091_MAT110 from "./ENG091-MAT110.json";
import ENG091_MAT092 from "./ENG091-MAT092.json";

// Configure all streams here
const streamsConfig = {
  "ENG101 + MAT110": {
    id: "ENG101 + MAT110",
    label: "ENG101 + MAT110",
    plan: ENG101_MAT110,
    expectedCount: ENG101_MAT110.length,
  },

  "ENG101 + MAT092": {
    id: "ENG101 + MAT092",
    label: "ENG101 + MAT092",
    plan: ENG101_MAT092,
    expectedCount: ENG101_MAT092.length,
  },

  "ENG102 + MAT110": {
    id: "ENG102 + MAT110",
    label: "ENG102 + MAT110",
    plan: ENG102_MAT110,
    expectedCount: ENG102_MAT110.length,
  },

  "ENG102 + MAT092": {
    id: "ENG102 + MAT092",
    label: "ENG102 + MAT092",
    plan: ENG102_MAT092,
    expectedCount: ENG102_MAT092.length,
  },

  "ENG091 + MAT110": {
    id: "ENG091 + MAT110",
    label: "ENG091 + MAT110",
    plan: ENG091_MAT110,
    expectedCount: ENG091_MAT110.length,
  },

  "ENG091 + MAT092": {
    id: "ENG091 + MAT092",
    label: "ENG091 + MAT092",
    plan: ENG091_MAT092,
    expectedCount: ENG091_MAT092.length,
  },
};

export const DEFAULT_STREAM_ID = "ENG101 + MAT110";

export default streamsConfig;
