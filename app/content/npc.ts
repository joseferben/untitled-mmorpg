import imageBee from "../../public/assets/npcs/bee.png";
import imageWolf from "../../public/assets/npcs/wolf.png";
import { bones, gold, honey, Item } from "./item";

type Combat = {
  health: [number, number];
  attack: [number, number];
  intelligence: [number, number];
  defense: [number, number];
};

type AmountRange = [number, number];

export type Npc = {
  name: string;
  image: string;
  combat: Combat;
  dropTable: [Item, AmountRange, number][];
};

export const bee: Npc = {
  name: "bee",
  image: imageBee,
  combat: {
    health: [5, 5],
    attack: [2, 3],
    intelligence: [1, 1],
    defense: [1, 3],
  },
  dropTable: [
    [honey, [1, 1], 0.25],
    [gold, [5, 10], 50],
  ],
};

export const wolf: Npc = {
  name: "wolf",
  image: imageWolf,
  combat: {
    health: [10, 15],
    attack: [4, 5],
    intelligence: [2, 3],
    defense: [2, 4],
  },
  dropTable: [
    [bones, [1, 1], 0.25],
    [gold, [5, 10], 50],
  ],
};