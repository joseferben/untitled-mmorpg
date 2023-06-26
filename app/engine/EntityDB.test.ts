// create entitydb and store entity test

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EntityDB } from "./EntityDB";
import Database from "better-sqlite3";
import { JSONDB } from "./JSONDB";

type Foo = {
  id: string;
  name: string;
  x: number;
  y: number;
  inCombat?: boolean;
  complex?: { foo: string };
};

let db: EntityDB<Foo>;

beforeEach(async () => {
  const s = new Database(":memory:");
  s.pragma("journal_mode = WAL");
  s.pragma("synchronous = off");
  const jsonDB = new JSONDB(s);
  db = new EntityDB<Foo>({
    indices: ["name", "x"],
    jsonDB,
    persistAfterChangeCount: 0,
  });
});

afterEach(() => {});

describe("EntityDB", () => {
  it("create foo", () => {
    const created = db.create({
      name: "first",
      x: 1,
      y: 3,
      inCombat: false,
    });
    const first = db.findById(created.id);
    expect(first).toHaveProperty("name", "first");
  });
  it("update foo", () => {
    const created = db.create({
      name: "first",
      x: 1,
      y: 3,
      inCombat: false,
    });
    created.name = "updated";
    created.inCombat = true;
    db.update(created);
    const updated = db.findById(created.id);
    expect(updated).toHaveProperty("name", "updated");
  });
  it("find by field", () => {
    db.create({
      name: "first",
      x: 1,
      y: 3,
      inCombat: false,
    });
    db.create({
      name: "second",
      x: 1,
      y: 3,
    });
    const foundByName = db.findBy("name", "first");
    expect(foundByName).toHaveLength(1);
    expect(foundByName[0]).toHaveProperty("name", "first");
    const foundByX = db.findBy("x", 1);
    expect(foundByX).toHaveLength(2);
  });
  it("find by 2 fields", () => {
    db.create({
      name: "first",
      x: 1,
      y: 3,
      inCombat: false,
    });
    db.create({
      name: "second",
      x: 1,
      y: 3,
    });
    const found = db.findByFilter({ name: "first", x: 1 });
    expect(found).toHaveLength(1);
    expect(found[0]).toHaveProperty("name", "first");
  });
});