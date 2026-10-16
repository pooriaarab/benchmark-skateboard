import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : process.argv[index + 1];
};
const seed = Number(valueAfter("--seed", "20261015"));
const split = valueAfter("--split", "public");
const outputFlag = valueAfter("--output", "");
if (!Number.isInteger(seed) || !["public", "hidden"].includes(split)) {
  throw new Error("Usage: gen-tasks.mjs [--seed INTEGER] [--split public|hidden] [--output PATH]");
}
const glossary = JSON.parse(await readFile(new URL("../data/tricks.json", import.meta.url), "utf8"));
const worlds = [
  { id: "earth", name: "Earth", gravity: 9.81, speedMin: 1.35, speedMax: 3.65 },
  { id: "moon", name: "Moon", gravity: 1.62, speedMin: 0.75, speedMax: 2.05 },
  { id: "mars", name: "Mars", gravity: 3.71, speedMin: 1.05, speedMax: 2.85 },
];
let state = seed >>> 0;
const random = () => {
  state += 0x6d2b79f5;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};
const round = (value) => Math.round(value * 1000) / 1000;
const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};
const pairs = glossary.tricks.flatMap((trick) => worlds.map((world) => ({ trick, world })));
const ordered = split === "hidden" ? shuffle(pairs) : pairs;
const idPrefix = split === "hidden" ? "hidden" : "public";
const publicAirtimes = new Map();
if (split === "hidden") {
  try {
    const publicText = await readFile(new URL("../data/tasks.jsonl", import.meta.url), "utf8");
    for (const line of publicText.trim().split("\n")) {
      const task = JSON.parse(line);
      publicAirtimes.set(`${task.metadata.trick}:${task.metadata.world}`, JSON.parse(task.expected).airtimeS);
    }
  } catch {
    // no public file to diverge from
  }
}
const lowestLaunchSpeed = 0.3;
const underpoweredRate = 0.55;
const tasks = ordered.map(({ trick, world }) => {
  const neededSpeed = (world.gravity * trick.minimumAirtimeS) / 2;
  const lowCeiling = Math.min(world.speedMax, neededSpeed * 0.9);
  const highFloor = Math.max(world.speedMin, neededSpeed * 1.1);
  const canUnderpower = lowCeiling > lowestLaunchSpeed;
  const canBeFeasible = highFloor <= world.speedMax;
  const underpowered = !canBeFeasible || (canUnderpower && random() < underpoweredRate);
  const low = underpowered ? lowestLaunchSpeed : highFloor;
  const high = underpowered ? lowCeiling : world.speedMax;
  const draw = (a, b) => round(a + random() * (b - a));
  let launchSpeed = draw(low, high);
  const twinAirtime = publicAirtimes.get(`${trick.id}:${world.id}`);
  if (twinAirtime !== undefined) {
    const gap = (speed) => Math.abs((2 * speed) / world.gravity / twinAirtime - 1);
    const bands = [[low, high]];
    if (canUnderpower && canBeFeasible) bands.push(underpowered ? [highFloor, world.speedMax] : [lowestLaunchSpeed, lowCeiling]);
    let best = launchSpeed;
    let bestGap = gap(launchSpeed);
    for (const [a, b] of bands) {
      for (let tries = 0; tries < 12 && gap(launchSpeed) <= 0.1; tries += 1) {
        launchSpeed = draw(a, b);
        if (gap(launchSpeed) > bestGap) {
          best = launchSpeed;
          bestGap = gap(launchSpeed);
        }
      }
      if (gap(launchSpeed) > 0.1) break;
    }
    if (gap(launchSpeed) <= 0.1) launchSpeed = best;
  }
  const airtimeS = round((2 * launchSpeed) / world.gravity);
  const peakHeightM = round((launchSpeed ** 2) / (2 * world.gravity));
  const rotations = trick.rotations;
  const landsWheelsDown = Number.isInteger(rotations.long) && Number.isInteger(rotations.cross);
  const canFlipFinishInAir = airtimeS + 1e-9 >= trick.minimumAirtimeS;
  const answer = { rotations, airtimeS, peakHeightM, landsWheelsDown, canFlipFinishInAir };
  const article = /^[aeiou]/i.test(trick.name) && !/^one-/i.test(trick.name) ? "an" : "a";
  const place =
    world.id === "earth" ? "Earth" : world.id === "moon" ? "the Moon" : "Mars";
  const prompt = `A skater attempts ${article} ${trick.name.toLowerCase()} on ${place}. ${trick.description}\nUse gravity ${world.gravity} m/s^2 and upward launch speed ${launchSpeed} m/s. Ignore drag and landing height differences. Airtime is 2*v0/g; peak height is v0^2/(2*g). Rotations are in full turns (1 means one 360° rotation on that axis). ${glossary.axisConvention} This trick needs at least ${trick.minimumAirtimeS} s to finish. Set landsWheelsDown true only when the long- and cross-axis turns are whole numbers; set canFlipFinishInAir true only when the airtime meets that minimum. Return only JSON: {"rotations":{"long":number,"vertical":number,"cross":number},"airtimeS":number,"peakHeightM":number,"landsWheelsDown":boolean,"canFlipFinishInAir":boolean}. Round calculated values to three decimals.`;
  return {
    id: `${idPrefix}-${trick.id}-${world.id}-${seed}`,
    kind: "single",
    prompt,
    expected: JSON.stringify(answer),
    metadata: {
      seed,
      split,
      trick: trick.id,
      world: world.id,
      gravity: world.gravity,
      launchSpeed,
      minimumAirtimeS: trick.minimumAirtimeS,
    },
  };
});
const defaultOutput =
  split === "public" ? "data/tasks.jsonl" : fileURLToPath(new URL("../.hidden/tasks.jsonl", import.meta.url));
const output = outputFlag || defaultOutput;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${tasks.map((task) => JSON.stringify(task)).join("\n")}\n`);
console.log(`generated ${tasks.length} ${split} tasks in ${output} with seed ${seed}`);
