import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const cyclesDir = path.join(dataDir, "cycles");

const mutablePaths = {
  currentState: path.join(dataDir, "current_state.json"),
  timeline: path.join(dataDir, "timeline.json"),
  log: path.join(dataDir, "log.json"),
  generationLog: path.join(dataDir, "generation_log.json"),
};

function readJsonIfPresent(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`${path.relative(root, filePath)} is not valid JSON: ${err.message}`);
  }
}

function listCycleFiles() {
  if (!fs.existsSync(cyclesDir)) return [];
  return fs
    .readdirSync(cyclesDir)
    .filter((file) => file.startsWith("cycle_") && file.endsWith("_output.json"))
    .sort();
}

function assertArray(name, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${name} must be an array when present.`);
    return [];
  }
  return value;
}

function addMissingCycleErrors(kind, entries, cycleIds, errors) {
  for (const entry of entries) {
    if (!entry || typeof entry.cycle_id !== "string") {
      errors.push(`${kind} contains an entry without a string cycle_id.`);
      continue;
    }
    if (!cycleIds.has(entry.cycle_id)) {
      errors.push(`${kind} references missing cycle output ${entry.cycle_id}.`);
    }
  }
}

const errors = [];
const warnings = [];
const cycleFiles = listCycleFiles();
const cycles = cycleFiles.map((file) => {
  const cycle = readJsonIfPresent(path.join(cyclesDir, file), null);
  if (!cycle || typeof cycle.cycle_id !== "string" || typeof cycle.day !== "number") {
    errors.push(`data/cycles/${file} must contain cycle_id and day.`);
  }
  return cycle;
});

const cycleIds = new Set(cycles.map((cycle) => cycle?.cycle_id).filter(Boolean));
const latestCycleDay = cycles.reduce(
  (max, cycle) => Math.max(max, typeof cycle?.day === "number" ? cycle.day : 0),
  0,
);

const timeline = assertArray(
  "data/timeline.json",
  readJsonIfPresent(mutablePaths.timeline, []),
  errors,
);
const log = assertArray(
  "data/log.json",
  readJsonIfPresent(mutablePaths.log, []),
  errors,
);
const generationLog = assertArray(
  "data/generation_log.json",
  readJsonIfPresent(mutablePaths.generationLog, []),
  errors,
);
const currentState = readJsonIfPresent(mutablePaths.currentState, null);

addMissingCycleErrors("data/timeline.json", timeline, cycleIds, errors);
addMissingCycleErrors("data/log.json", log, cycleIds, errors);
addMissingCycleErrors("data/generation_log.json", generationLog, cycleIds, errors);

for (const cycle of cycles) {
  if (!cycle) continue;
  const hasTimeline = timeline.some((entry) => entry?.cycle_id === cycle.cycle_id);
  const hasGeneration = generationLog.some(
    (entry) => entry?.cycle_id === cycle.cycle_id,
  );
  if (!hasTimeline) warnings.push(`${cycle.cycle_id} has no timeline event.`);
  if (!hasGeneration) warnings.push(`${cycle.cycle_id} has no generation metadata.`);
}

if (currentState !== null) {
  const currentDay = currentState?.world?.day;
  if (typeof currentDay !== "number") {
    errors.push("data/current_state.json must contain world.day.");
  } else if (currentDay < latestCycleDay) {
    errors.push(
      `data/current_state.json day ${currentDay} is behind latest cycle day ${latestCycleDay}.`,
    );
  }
}

if (cycleIds.size === 0) {
  if (timeline.length > 0) errors.push("timeline entries exist without cycle outputs.");
  if (log.length > 0) errors.push("daybook entries exist without cycle outputs.");
  if (generationLog.length > 0) {
    errors.push("generation metadata exists without cycle outputs.");
  }
}

if (errors.length > 0) {
  console.error("World data consistency check failed:");
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

console.log(
  `World data consistency check passed: ${cycleIds.size} cycles, ${timeline.length} timeline events, ${log.length} daybook entries, ${generationLog.length} generation records.`,
);
if (warnings.length > 0) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}
