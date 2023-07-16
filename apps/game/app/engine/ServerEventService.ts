import { EventEmitter } from "node:events";
import { initOnce } from "~/utils";
import type { Player, SerializedClientState, ServerEvent } from "@wwyb/core";
import { EntityDB } from "@wwyb/entitydb";
import type { PlayerService } from "./PlayerService";

export type PlayerEmitter = {
  id: string;
  playerId: string;
  emitter: Emitter;
};

class Emitter {
  constructor(readonly emitter: EventEmitter) {}

  on(listener: (event: ServerEvent) => void) {
    this.emitter.on("event", listener);
  }
}

export class ServerEventService {
  readonly db!: EntityDB<PlayerEmitter>;
  constructor(readonly playerService: PlayerService) {
    [this.db] = initOnce(
      this.constructor.name,
      () =>
        new EntityDB<PlayerEmitter>({
          fields: ["playerId"],
          namespace: "pem",
        })
    );
  }

  sendToAll(event: ServerEvent) {
    this.db.findAll().forEach((playerEmitter) => {
      playerEmitter.emitter.emitter.emit("event", event);
    });
  }

  playerStepped(player: Player, x: number, y: number, lastStep: boolean) {
    const state: SerializedClientState = {
      me: player,
      players: this.playerService.findAroundPlayer(player),
    };
    this.sendToAll({
      state,
      event: {
        tag: "playerStepped",
        playerId: player.id,
        x,
        y,
        lastStep,
      },
    });
  }

  playerEmitter(player: Player) {
    const found = this.db.findOneBy("playerId", player.id);
    if (!found) {
      const emitter = new EventEmitter();
      return this.db.create({
        playerId: player.id,
        emitter: new Emitter(emitter),
      });
    }
    return found;
  }
}