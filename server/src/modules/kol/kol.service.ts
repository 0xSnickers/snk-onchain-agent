import { Injectable } from "@nestjs/common";
import { KolRepository } from "./kol.repository";
import { AppError } from "../../common/http";
import { CreateKol, UpdateKol } from "./kol.dto";
import { xapiConfigured } from "./xapi.provider";
@Injectable()
export class KolService {
  constructor(private readonly repository: KolRepository) {}
  async list() {
    return {
      accounts: await this.repository.list(),
      x: {
        configured: xapiConfigured(),
        state: xapiConfigured() ? "READY" : "OPTIONAL",
      },
    };
  }
  add(input: CreateKol) {
    return this.repository.add(input);
  }
  async update(id: string, input: UpdateKol) {
    try {
      return await this.repository.update(id, input);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      )
        throw new AppError(
          "KOL_ALREADY_EXISTS",
          "This account is already in the watchlist",
          409,
        );
      throw error;
    }
  }
  async remove(id: string) {
    await this.repository.remove(id);
    return { removed: true };
  }
}
