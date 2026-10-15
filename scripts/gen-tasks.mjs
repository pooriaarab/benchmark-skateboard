import { readFile, writeFile } from "node:fs/promises";

const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : process.argv[index + 1];
};
const seed = Number(valueAfter("--seed", "20261015"));
const split = valueAfter("--split", "public");
if (!Number.isInteger(seed) || !["public", "hidden"].includes(split)) {
  throw new Error("Usage: gen-tasks.mjs [--seed INTEGER] [--split public|hidden]");
}
const glossary = JSON.parse(await readFile(new URL("../data/tricks.json", import.meta.url), "utf8"));
const worlds = [
  { id: "earth", name: "Earth", gravity: 9.81, baseSpeed: 2.8 },
  { id: "moon", name: "Moon", gravity: 1.62, baseSpeed: 1.4 },
  { id: "mars", name: "Mars", gravity: 3.71, baseSpeed: 2.2 },
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
const tasks = glossary.tricks.flatMap((trick) => worlds.map((world) => {
  const launchSpeed = round(world.baseSpeed + (random() - 0.5) * 0.2);
  const airtimeS = round((2 * launchSpeed) / world.gravity);
  const peakHeightM = round((launchSpeed ** 2) / (2 * world.gravity));
  const rotations = trick.rotations;
  const landsWheelsDown = Number.isInteger(rotations.long) && Number.isInteger(rotations.cross);
  const canFlipFinishInAir = airtimeS + 1e-9 >= trick.minimumAirtimeS;
  const answer = { rotations, airtimeS, peakHeightM, landsWheelsDown, canFlipFinishInAir };
  const article = /^[aeiou]/i.test(trick.name) ? "an" : "a";
  const place = world.id === "earth" ? "Earth" : `the ${world.name}`;
  const prompt = `A skater attempts ${article} ${trick.name.toLowerCase()} on ${place}. ${trick.description}\nUse gravity ${world.gravity} m/s^2 and upward launch speed ${launchSpeed} m/s. Ignore drag and landing height differences. Airtime is 2*v0/g; peak height is v0^2/(2*g). ${glossary.axisConvention} This trick needs at least ${trick.minimumAirtimeS} s to finish. Return only JSON: {"rotations":{"long":number,"vertical":number,"cross":number},"airtimeS":number,"peakHeightM":number,"landsWheelsDown":boolean,"canFlipFinishInAir":boolean}. Round calculated values to three decimals.`;
  return {
    id: `${split}-${trick.id}-${world.id}-${seed}`,
    kind: "single",
    prompt,
    expected: JSON.stringify(answer),
    metadata: { seed, split, trick: trick.id, world: world.id, gravity: world.gravity, launchSpeed, minimumAirtimeS: trick.minimumAirtimeS },
  };
}));
const output = split === "public" ? "data/tasks.jsonl" : "data/tasks.hidden.jsonl";
await writeFile(output, `${tasks.map((task) => JSON.stringify(task)).join("\n")}\n`);
console.log(`generated ${tasks.length} ${split} tasks in ${output} with seed ${seed}`);
