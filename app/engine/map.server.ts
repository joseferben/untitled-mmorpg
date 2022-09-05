import { execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import TiledMap, { TiledLayer, TiledTile } from "tiled-types";
import invariant from "tiny-invariant";
import { getResourceKind } from "~/content/content";
import { Resource, spawnResource } from "~/engine/models/resource.server";
import { array2d } from "../utils";
import { ResourceKind } from "./core/resource";

const TMX_FILE_DIR = "public/assets/map";
const TMX_FILE_PATH = `${TMX_FILE_DIR}/map.tmx`;
const tmxFile = fs.readFileSync(TMX_FILE_PATH);
const hashSum = crypto.createHash("md5");
hashSum.update(tmxFile);

const hash = hashSum.digest("base64url");

const JSON_FILE_PATH = `${TMX_FILE_DIR}/map.${hash}.json`;

const OBSTACLE_LAYER_NAME = "obstacle";

type Tile = {
  description: string;
  imagePaths: string[];
  x: number;
  y: number;
  obstacle: boolean;
  gid: number;
  resource: Resource | null;
};

type Map = {
  tiles: Tile[][];
  tiledMap: TiledMap;
};

declare global {
  var __map__: Map;
}

let map: Map;

function gidToTiledTile(gid: number, tiled: TiledMap): TiledTile | undefined {
  if (gid === 0) {
    return undefined;
  }
  const tilesets = tiled.tilesets
    .filter((t) => t.firstgid <= gid)
    .sort((a, b) => b.firstgid - a.firstgid);
  if (tilesets.length === 0) {
    return;
  }
  const tileset = tilesets[0];
  const localId = gid - tileset.firstgid;
  // if (gid === 77) {
  //   console.log(tileset);
  //   console.log(localId);
  // }
  if (tileset.tiles !== undefined) {
    return tileset.tiles.find((t) => t.id === localId);
  }
}

function isTiledTileObstacle(layer: TiledLayer, tiledTile: TiledTile): boolean {
  if (layer.name === OBSTACLE_LAYER_NAME) {
    return true;
  }
  const tiledProperty = (tiledTile.properties || []).find(
    (p) => p.name === "obstacle"
  );
  return tiledProperty ? tiledProperty.value === true : false;
}

function getDescription(tiledTile: TiledTile): string {
  const descriptionProp = (tiledTile.properties || []).find(
    (p) => p.name === "description"
  );
  return descriptionProp !== undefined
    ? String(descriptionProp.value)
    : "This is a description";
}

function getResourceKindOfTile(tiledTile: TiledTile): ResourceKind | null {
  const tiledProperty = (tiledTile.properties || []).find(
    (p) => p.name === "resource"
  );
  const resourceKindName =
    tiledProperty !== undefined ? String(tiledProperty.value) : null;
  return resourceKindName ? getResourceKind(resourceKindName) : null;
}

async function processTile(
  tiles: Tile[][],
  layer: TiledLayer,
  tiledTile: TiledTile,
  x: number,
  y: number,
  gid: number
) {
  const description = getDescription(tiledTile);
  if (!tiles[x][y]) {
    // Create tiled
    tiles[x][y] = {
      description,
      imagePaths: tiledTile.image ? [tiledTile.image] : [],
      x,
      y,
      obstacle: isTiledTileObstacle(layer, tiledTile),
      gid,
      resource: null,
    };
  } else {
    // Update existing tile
    const hasImageAlready =
      tiles[x][y].imagePaths.find((i) => i === tiledTile.image) !== undefined;
    if (tiledTile.image && !hasImageAlready) {
      tiles[x][y].imagePaths.push(tiledTile.image);
    }
    // Set if obstacle
    tiles[x][y].obstacle =
      tiles[x][y].obstacle || isTiledTileObstacle(layer, tiledTile);
  }
  // Set resource
  const resourceKind = getResourceKindOfTile(tiledTile);
  if (resourceKind) {
    tiles[x][y].resource = await spawnResource(x, y, resourceKind);
  }
}

function mapOfTiledMap(tiledMap: TiledMap): Map {
  if (tiledMap.orientation !== "orthogonal") {
    throw new Error("Only orthogonal maps supported");
  }
  const tiles: Tile[][] = array2d(tiledMap.width, tiledMap.height);

  for (const layer of tiledMap.layers) {
    if (layer.type === "tilelayer") {
      console.log("process tile layer", layer.name);
      if (typeof layer.data !== "string") {
        for (const [idx, gid] of layer.data.entries()) {
          const x = idx % tiledMap.width;
          const y = Math.floor(idx / tiledMap.width);
          const tiledTile = gidToTiledTile(gid, tiledMap);
          if (tiledTile !== undefined) {
            processTile(tiles, layer, tiledTile, x, y, gid);
          }
        }
      }
    } else if (layer.type === "objectgroup") {
      console.log("process object layer", layer.name);
    }
  }
  return { tiles, tiledMap };
}

function loadMap(): Map {
  console.log("load map");
  if (fs.existsSync(JSON_FILE_PATH) && !process.env.BYPASS_CACHE) {
    console.log("map found in cache, load cache");
    return mapOfTiledMap(JSON.parse(fs.readFileSync(JSON_FILE_PATH, "utf8")));
  } else {
    console.log("map not found in cache");
    const jsonFiles = fs
      .readdirSync(TMX_FILE_DIR)
      .filter((file) => file.endsWith(".json"));
    jsonFiles.forEach((file) => fs.rmSync(`${TMX_FILE_DIR}/${file}`));
    execSync(`tiled --export-map json ${TMX_FILE_PATH} ${JSON_FILE_PATH}`);
    return mapOfTiledMap(JSON.parse(fs.readFileSync(JSON_FILE_PATH, "utf8")));
  }
}

function sliceMap(
  map: Map,
  x: number,
  y: number,
  width: number,
  height: number
): Map {
  invariant(x > Math.floor(width / 2), `can not slice map at (${x}, ${y})`);
  invariant(y > Math.floor(height / 2), `can not slice map at (${x}, ${y})`);
  const tiles: Tile[][] = array2d(width, height);
  const fromX = Math.round(x - width / 2);
  const toX = Math.round(x + width / 2);
  const fromY = Math.round(y - height / 2);
  const toY = Math.round(y + height / 2);
  for (const [x, col] of map.tiles.slice(fromX, toX).entries()) {
    for (const [y, tile] of col.slice(fromY, toY).entries()) {
      // copy over
      tiles[x][y] = { ...tile };
    }
  }
  return { ...map, tiles };
}

// this is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
// in production we'll have a single connection to the DB.
if (process.env.NODE_ENV === "production") {
  map = loadMap();
} else {
  if (!global.__map__) {
    global.__map__ = loadMap();
  }
  map = global.__map__;
}

invariant(map != undefined, "map can not be undefined");

export type { Map, Tile };
export { map, sliceMap };