import mongoose from "mongoose";
import dotenv from "dotenv";

import User from "../models/User.js";
import Subreddit from "../models/Subreddit.js";
import Thread from "../models/Thread.js";

dotenv.config();

// Unique suffix so re-running this script never collides with seeded/unique-indexed data.
const RUN_ID = Date.now();

// Track every document this script creates so it can be cleaned up at the end,
// regardless of which tests passed or failed.
const createdIds = { users: [], subreddits: [], threads: [] };

// Shared fixtures populated by CREATE tests and reused by later tests.
let userA, userB, subredditA, threadA;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS - ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL - ${name}`);
    console.log(`         ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

async function testCreateValidUserA() {
  userA = await User.create({
    name: "Test User A",
    email: `test-user-a-${RUN_ID}@example.com`,
    password: "password123",
    createdAt: new Date(),
  });
  createdIds.users.push(userA._id);

  assert(userA._id, "expected created user to have an _id");
  assert(
    userA.email === `test-user-a-${RUN_ID}@example.com`,
    "email was not saved correctly",
  );
}

async function testCreateValidUserB() {
  userB = await User.create({
    name: "Test User B",
    email: `test-user-b-${RUN_ID}@example.com`,
    password: "password456",
    createdAt: new Date(),
  });
  createdIds.users.push(userB._id);

  assert(userB._id, "expected created user to have an _id");
}

async function testCreateUserMissingRequiredField() {
  let threw = false;
  try {
    await User.create({
      email: `test-user-missing-name-${RUN_ID}@example.com`,
      password: "password789",
      createdAt: new Date(),
    });
  } catch (error) {
    threw = true;
    assert(
      error.name === "ValidationError",
      `expected ValidationError, got ${error.name}`,
    );
  }
  assert(
    threw,
    "expected creating a user without a name to throw a validation error",
  );
}

async function testCreateUserDuplicateEmail() {
  let threw = false;
  try {
    await User.create({
      name: "Duplicate Email User",
      email: userA.email,
      password: "password000",
      createdAt: new Date(),
    });
  } catch (error) {
    threw = true;
    assert(
      error.code === 11000,
      `expected duplicate key error (11000), got ${error.code}`,
    );
  }
  assert(
    threw,
    "expected creating a user with a duplicate email to throw a duplicate key error",
  );
}

async function testCreateValidSubreddit() {
  subredditA = await Subreddit.create({
    name: `test-subreddit-${RUN_ID}`,
    description: "A subreddit created for CRUD testing",
    author: userA._id,
    createdAt: new Date(),
  });
  createdIds.subreddits.push(subredditA._id);

  assert(subredditA._id, "expected created subreddit to have an _id");
  assert(
    String(subredditA.author) === String(userA._id),
    "author was not saved correctly",
  );
}

async function testCreateValidThread() {
  threadA = await Thread.create({
    title: "Test Thread",
    content: "Content used for CRUD testing",
    author: userB._id,
    subreddit: subredditA._id,
    createdAt: new Date(),
  });
  createdIds.threads.push(threadA._id);

  assert(threadA._id, "expected created thread to have an _id");
  assert(threadA.upvotes === 0, "expected default upvotes to be 0");
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

async function testFindUserByEmail() {
  const found = await User.findOne({ email: userA.email });
  assert(found, "expected to find userA by email");
  assert(
    String(found._id) === String(userA._id),
    "found user does not match userA",
  );
}

async function testFindSubredditById() {
  const found = await Subreddit.findById(subredditA._id);
  assert(found, "expected to find subredditA by id");
  assert(found.name === subredditA.name, "found subreddit name does not match");
}

async function testFindThreadsBySubreddit() {
  const threads = await Thread.find({ subreddit: subredditA._id });
  assert(threads.length >= 1, "expected at least one thread for subredditA");
  assert(
    threads.some((t) => String(t._id) === String(threadA._id)),
    "expected threadA to be included in the results",
  );
}

async function testFindUserByNonexistentId() {
  const fakeId = new mongoose.Types.ObjectId();
  const found = await User.findById(fakeId);
  assert(
    found === null,
    "expected findById with a nonexistent id to return null",
  );
}

async function testFindThreadWithPopulatedRefs() {
  const found = await Thread.findById(threadA._id)
    .populate("author")
    .populate("subreddit");
  assert(found.author, "expected populated author");
  assert(
    found.author.email === userB.email,
    "populated author does not match userB",
  );
  assert(found.subreddit, "expected populated subreddit");
  assert(
    found.subreddit.name === subredditA.name,
    "populated subreddit does not match subredditA",
  );
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

async function testUpdateUserPassword() {
  userA.password = "newPassword123";
  await userA.save();

  const found = await User.findById(userA._id);
  assert(
    found.password === "newPassword123",
    "expected updated password to be persisted",
  );
}

async function testIncrementThreadUpvotes() {
  const updated = await Thread.findByIdAndUpdate(
    threadA._id,
    { $inc: { upvotes: 1 } },
    { new: true },
  );
  assert(
    updated.upvotes === 1,
    `expected upvotes to be 1, got ${updated.upvotes}`,
  );
}

async function testUpdateSubredditDescription() {
  const updated = await Subreddit.findOneAndUpdate(
    { _id: subredditA._id },
    { description: "Updated description" },
    { new: true },
  );
  assert(
    updated.description === "Updated description",
    "expected description to be updated",
  );
}

async function testUpdateUserToDuplicateEmailFails() {
  let threw = false;
  try {
    await User.findByIdAndUpdate(
      userB._id,
      { email: userA.email },
      { new: true, runValidators: true },
    );
  } catch (error) {
    threw = true;
    assert(
      error.code === 11000,
      `expected duplicate key error (11000), got ${error.code}`,
    );
  }
  assert(threw, "expected updating userB's email to userA's email to fail");
}

async function testUpdateThreadRemovingRequiredFieldFails() {
  let threw = false;
  try {
    await Thread.findByIdAndUpdate(
      threadA._id,
      { $unset: { content: "" } },
      { new: true, runValidators: true },
    );
  } catch (error) {
    threw = true;
    assert(
      error.name === "ValidationError",
      `expected ValidationError, got ${error.name}`,
    );
  }
  assert(threw, "expected removing a required field to fail validation");
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

async function testDeleteSingleThread() {
  const throwaway = await Thread.create({
    title: "Throwaway Thread",
    content: "To be deleted",
    author: userB._id,
    subreddit: subredditA._id,
    createdAt: new Date(),
  });

  await Thread.findByIdAndDelete(throwaway._id);
  const found = await Thread.findById(throwaway._id);
  assert(found === null, "expected deleted thread to no longer be found");
}

async function testDeleteManyThreadsBySubreddit() {
  const extra1 = await Thread.create({
    title: "Extra Thread 1",
    content: "Bulk delete test",
    author: userB._id,
    subreddit: subredditA._id,
    createdAt: new Date(),
  });
  const extra2 = await Thread.create({
    title: "Extra Thread 2",
    content: "Bulk delete test",
    author: userB._id,
    subreddit: subredditA._id,
    createdAt: new Date(),
  });
  createdIds.threads.push(extra1._id, extra2._id);

  const result = await Thread.deleteMany({ subreddit: subredditA._id });
  assert(
    result.deletedCount >= 2,
    `expected at least 2 threads deleted, got ${result.deletedCount}`,
  );

  const remaining = await Thread.find({ subreddit: subredditA._id });
  assert(
    remaining.length === 0,
    "expected no threads to remain for subredditA",
  );

  // threadA and the extras were all removed by deleteMany above.
  createdIds.threads = [];
}

async function testDeleteUser() {
  await User.findByIdAndDelete(userB._id);
  const found = await User.findById(userB._id);
  assert(found === null, "expected deleted user to no longer be found");

  createdIds.users = createdIds.users.filter(
    (id) => String(id) !== String(userB._id),
  );
}

async function testDeleteNonexistentIdReturnsZero() {
  const fakeId = new mongoose.Types.ObjectId();
  const result = await Subreddit.deleteOne({ _id: fakeId });
  assert(
    result.deletedCount === 0,
    `expected deletedCount to be 0, got ${result.deletedCount}`,
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runTests() {
  console.log("CREATE");
  await test("creates a valid user (userA)", testCreateValidUserA);
  await test("creates a valid user (userB)", testCreateValidUserB);
  await test(
    "fails to create a user missing a required field",
    testCreateUserMissingRequiredField,
  );
  await test(
    "fails to create a user with a duplicate email",
    testCreateUserDuplicateEmail,
  );
  await test("creates a valid subreddit", testCreateValidSubreddit);
  await test("creates a valid thread", testCreateValidThread);

  console.log("READ");
  await test("finds a user by email", testFindUserByEmail);
  await test("finds a subreddit by id", testFindSubredditById);
  await test(
    "finds threads belonging to a subreddit",
    testFindThreadsBySubreddit,
  );
  await test(
    "returns null when finding a nonexistent user id",
    testFindUserByNonexistentId,
  );
  await test(
    "finds a thread with populated author/subreddit refs",
    testFindThreadWithPopulatedRefs,
  );

  console.log("UPDATE");
  await test("updates a user's password", testUpdateUserPassword);
  await test("increments a thread's upvotes", testIncrementThreadUpvotes);
  await test(
    "updates a subreddit's description",
    testUpdateSubredditDescription,
  );
  await test(
    "fails to update a user to a duplicate email",
    testUpdateUserToDuplicateEmailFails,
  );
  await test(
    "fails to update a thread when removing a required field",
    testUpdateThreadRemovingRequiredFieldFails,
  );

  console.log("DELETE");
  await test("deletes a single thread", testDeleteSingleThread);
  await test(
    "deletes many threads by subreddit",
    testDeleteManyThreadsBySubreddit,
  );
  await test("deletes a user", testDeleteUser);
  await test(
    "returns zero deletedCount for a nonexistent id",
    testDeleteNonexistentIdReturnsZero,
  );
}

async function cleanup() {
  console.log("Cleaning up test data...");
  if (createdIds.threads.length) {
    await Thread.deleteMany({ _id: { $in: createdIds.threads } });
  }
  if (createdIds.subreddits.length) {
    await Subreddit.deleteMany({ _id: { $in: createdIds.subreddits } });
  }
  if (createdIds.users.length) {
    await User.deleteMany({ _id: { $in: createdIds.users } });
  }
  console.log("Cleanup complete.");
}

async function main() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "MONGODB_URI is not defined. Please set it in your .env file.",
      );
    }

    console.log("Connecting to database...");
    await mongoose.connect(uri);
    console.log("Connected successfully to database.\n");

    await runTests();
  } catch (error) {
    console.error("Test run failed unexpectedly:", error);
    failed++;
  } finally {
    await cleanup();

    console.log(
      `\n${passed} passed, ${failed} failed, ${passed + failed} total`,
    );

    await mongoose.disconnect();
    console.log("Disconnected from database.");

    process.exitCode = failed > 0 ? 1 : 0;
  }
}

main();
