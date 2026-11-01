import { WalletIdentityService } from "../wallet/wallet-identity.service";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ResearchProvider } from "./research.provider";
import { AgentStore } from "../agent-runs/agent.store";
import { object, safeError, safeJson, decimal } from "../../common/safe-data";
@Injectable()
export class ResearchService {
  constructor(
    private readonly identity: WalletIdentityService,
    private readonly provider: ResearchProvider,
    private readonly store: AgentStore,
  ) {}
  async create(candidateId: string) {
    const candidate = await this.store.candidate(candidateId);
    const run = await this.store.beginCandidate(candidateId, "RESEARCH");
    try {
      const entries = await Promise.allSettled([
        this.provider.audit(candidate.chainId, candidate.contractAddress),
        this.provider.info(
          "meta",
          candidate.chainId,
          candidate.contractAddress,
        ),
        this.provider.info(
          "dynamic",
          candidate.chainId,
          candidate.contractAddress,
        ),
        this.provider.social(candidate.contractAddress),
      ]);
      const names = [
        "audit.token",
        "info.meta",
        "info.dynamic",
        "social.lookup",
      ];
      for (const [i, result] of entries.entries())
        await this.store.action(
          run.id,
          names[i],
          result.status === "fulfilled" ? "INFO" : "DENY",
          result.status === "fulfilled"
            ? result.value
            : safeError(result.reason),
        );
      const data = entries.map((e) =>
        e.status === "fulfilled" ? e.value : null,
      );
      const audit = object(data[0]),
        meta = object(data[1]),
        dynamic = object(data[2]),
        social = object(data[3]);
      const auditAvailable = audit.available === true;
      const dynamicAvailable = decimal(dynamic.price) !== null;
      const links = Array.isArray(meta.links) ? meta.links.map(object) : [];
      const hits = Array.isArray(audit.hits) ? audit.hits.map(object) : [];
      const symbol = String(meta.symbol || candidate.symbol || "Unknown");
      const risk = auditAvailable
        ? String(audit.riskLevel || "UNKNOWN")
        : "UNAVAILABLE";
      const body = [
        `${symbol} · ${candidate.chainId}`,
        `合约 / Contract: ${candidate.contractAddress}`,
        `链上 / On-chain: price=${dynamic.price ?? "unknown"}, liquidity=${dynamic.liquidity ?? "unknown"}, volume24h=${dynamic.volume24h ?? "unknown"}, holders=${dynamic.holders ?? "unknown"}, Top10=${dynamic.top10Percent ?? "unknown"}%`,
        `安全 / Audit: ${risk}; buyTax=${audit.buyTax ?? "unknown"}%, sellTax=${audit.sellTax ?? "unknown"}%`,
        ...hits.map((h) => `风险 / Risk: ${h.title} — ${h.description}`),
        ...(Array.isArray(audit.cautions)
          ? audit.cautions.map((c) => `CAUTION: ${c}`)
          : []),
        `社媒 / Social: ${social.state || "UNAVAILABLE"}; metadata links are provider supplied, team identity is not independently verified.`,
        ...links.map((l) => `${l.label}: ${l.link}`),
        ...entries
          .filter((e) => e.status === "rejected")
          .map(
            (e) =>
              `数据缺失 / Missing: ${safeError((e as PromiseRejectedResult).reason).message}`,
          ),
        "结论 / Conclusion: 仅研究，不自动买入。Research only; no automatic purchase.",
        "审计与数据仅供参考，不构成投资建议。DYOR.",
      ];
      const brief = await this.store.createBrief({
        runId: run.id,
        candidateId,
        chainId: candidate.chainId,
        contractAddress: candidate.contractAddress,
        symbol,
        riskLevel: auditAvailable ? String(audit.riskLevel || "UNKNOWN") : null,
        liquidityUsd: decimal(dynamic.liquidity),
        top10Percent: decimal(dynamic.top10Percent),
        auditAvailable,
        dynamicAvailable,
        bodyMd: body.join("\n"),
        evidenceJson: safeJson({
          audit,
          meta,
          dynamic,
          social,
          source: "Binance Web3 skills",
          fetchedAt: new Date().toISOString(),
        }) as Prisma.InputJsonValue,
      });
      await this.store.action(run.id, "brief.emit", "ALLOW", {
        briefId: brief.id,
        auditAvailable,
        dynamicAvailable,
      });
      await this.store.updateCandidate(candidateId, {
        status: "BRIEF_READY",
        class: "PAID_TOKEN",
        symbol,
      });
      await this.store.finish(
        run.id,
        "SUCCEEDED",
        auditAvailable && dynamicAvailable
          ? "Research brief ready — no purchase"
          : "Research brief ready with unavailable data — purchase blocked",
      );
      return brief;
    } catch (error) {
      await this.store.finish(
        run.id,
        "FAILED",
        safeError(error).message,
        error,
      );
      await this.store.updateCandidate(candidateId, { status: "ABORTED" });
      throw error;
    }
  }
}
