import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import User from "../models/User.js";
import Subreddit from "../models/Subreddit.js";
import Thread from "../models/Thread.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

// Order matters: children must be inserted after the parents they reference.
const SEED_ORDER = [
  { model: User, file: "users.json", label: "Users" },
  { model: Subreddit, file: "subreddits.json", label: "Subreddits" },
  { model: Thread, file: "threads.json", label: "Threads" },
];

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined. Please set it in your .env file.");
  }

  console.log("Connecting to database...");
  await mongoose.connect(uri);
  console.log("Connected successfully to database.");
}

async function clearExistingData() {
  console.log("Clearing existing data...");
  // Reverse order so children are removed before the parents they reference.
  for (const { model, label } of [...SEED_ORDER].reverse()) {
    const { deletedCount } = await model.deleteMany({});
    console.log(`  - Cleared ${deletedCount} existing ${label.toLowerCase()}.`);
  }
  console.log("Existing data cleared successfully.");
}

async function loadJson(file) {
  const filePath = path.join(DATA_DIR, file);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function seedCollection(model, file, label) {
  const documents = await loadJson(file);
  const inserted = await model.insertMany(documents, { ordered: true });
  console.log(`  - Inserted ${inserted.length} ${label.toLowerCase()}.`);
  return inserted;
}

async function seedAllData() {
  console.log("Seeding data...");
  for (const { model, file, label } of SEED_ORDER) {
    await seedCollection(model, file, label);
  }
  console.log("All data seeded successfully.");
}

async function main() {
  let exitCode = 0;
  try {
    await connectToDatabase();
    await clearExistingData();
    await seedAllData();
    console.log("Database seed completed successfully.");
  } catch (error) {
    console.error("Database seed failed:", error);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed.");
    process.exit(exitCode);
  }
}

main();
