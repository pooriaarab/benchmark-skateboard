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
const tasks = ordered.map(({ trick, world }) => {
  const launchSpeed = round(world.speedMin + random() * (world.speedMax - world.speedMin));
  const airtimeS = round((2 * launchSpeed) / world.gravity);
  const peakHeightM = round((launchSpeed ** 2) / (2 * world.gravity));
  const rotations = trick.rotations;
  const landsWheelsDown = Number.isInteger(rotations.long) && Number.isInteger(rotations.cross);
  const canFlipFinishInAir = airtimeS + 1e-9 >= trick.minimumAirtimeS;
  const answer = { rotations, airtimeS, peakHeightM, landsWheelsDown, canFlipFinishInAir };
  const article = /^[aeiou]/i.test(trick.name) ? "an" : "a";
  const place =
    world.id === "earth" ? "Earth" : world.id === "moon" ? "the Moon" : "Mars";
  const prompt = `A skater attempts ${article} ${trick.name.toLowerCase()} on ${place}. ${trick.description}\nUse gravity ${world.gravity} m/s^2 and upward launch speed ${launchSpeed} m/s. Ignore drag and landing height differences. Airtime is 2*v0/g; peak height is v0^2/(2*g). Rotations are in full turns (1 means one 360° rotation on that axis). ${glossary.axisConvention} This trick needs at least ${trick.minimumAirtimeS} s to finish. Return only JSON: {"rotations":{"long":number,"vertical":number,"cross":number},"airtimeS":number,"peakHeightM":number,"landsWheelsDown":boolean,"canFlipFinishInAir":boolean}. Round calculated values to three decimals.`;
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
