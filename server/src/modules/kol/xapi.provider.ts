import { Injectable } from "@nestjs/common";
import { NetworkService } from "../../common/network.service";
import { AppError } from "../../common/http";
import { imageUrl } from "../../common/image-url";
type Data = Record<string, unknown>;
export const xapiConfigured = () => Boolean(process.env.XAPI_KEY);
const count = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 2147483647
    ? v
    : null;
@Injectable()
export class XapiProvider {
  constructor(private readonly network: NetworkService) {}
  private async call(
    action: "twitter.user_by_screen_name" | "twitter.user_tweets",
    input: Record<string, string>,
  ) {
    const key = process.env.XAPI_KEY;
    if (!key)
      throw new AppError(
        "XAPI_NOT_CONFIGURED",
        "Set XAPI_KEY in server/.env to enable KOL sync",
        409,
      );
    const result = await this.network.json<{
      success?: boolean;
      data?: Data;
      error?: { code?: string };
    }>(
      "https://action.xapi.to/v1/actions/execute",
      { action_id: action, input },
      { "XAPI-Key": key },
    );
    // The action gateway can return HTTP 200 with success=false.
    if (result.success === false || result.error) {
      const code = result.error?.code || "";
      if (/401|403|AUTH/.test(code))
        throw new AppError(
          "XAPI_AUTH_FAILED",
          "xapi.to authentication failed; check XAPI_KEY",
          409,
        );
      if (/402|BALANCE|QUOTA/.test(code))
        throw new AppError(
          "XAPI_QUOTA_EXCEEDED",
          "xapi.to balance or API quota is insufficient",
          402,
        );
      if (/429|RATE_LIMIT/.test(code))
        throw new AppError(
          "XAPI_RATE_LIMITED",
          "xapi.to rate limited the request; retry later",
          429,
        );
      throw new AppError(
        "XAPI_UPSTREAM_ERROR",
        "xapi.to could not complete the data request",
      );
    }
    if (result.error || !result.data || typeof result.data !== "object")
      throw new AppError(
        "XAPI_INVALID_RESPONSE",
        "xapi.to returned no usable data",
      );
    return result.data;
  }
  async profile(handle: string) {
    const d = await this.call("twitter.user_by_screen_name", {
      screen_name: handle,
    });
    if (typeof d.rest_id !== "string" || !/^\d{1,30}$/.test(d.rest_id))
      throw new AppError("XAPI_INVALID_RESPONSE", "xapi.to user ID is missing");
    return {
      id: d.rest_id,
      avatarUrl: imageUrl(d.avatar),
      displayName:
        typeof d.name === "string" && d.name.trim()
          ? d.name.trim().slice(0, 160)
          : null,
    };
  }
  async user(handle: string) {
    return (await this.profile(handle)).id;
  }
  async tweets(userId: string, cursor?: string) {
    const d = await this.call("twitter.user_tweets", {
      user_id: userId,
      ...(cursor ? { cursor } : {}),
    });
    if (!Array.isArray(d.tweets))
      throw new AppError(
        "XAPI_INVALID_RESPONSE",
        "xapi.to tweet list is missing",
      );
    if (d.tweets.length > 200)
      throw new AppError(
        "XAPI_INVALID_RESPONSE",
        "xapi.to returned an oversized page",
      );
    const posts: {
      postId: string;
      text: string;
      authorId: string;
      authorHandle: string;
      postedAt: Date | null;
      likes: number | null;
      reposts: number | null;
      replies: number | null;
    }[] = [];
    for (const r of d.tweets as Data[]) {
      const author = r.author as Data | undefined;
      if (
        typeof r.id !== "string" ||
        !/^\d{1,30}$/.test(r.id) ||
        typeof r.full_text !== "string" ||
        !author ||
        typeof author.id !== "string" ||
        typeof author.screen_name !== "string" ||
        !/^[a-zA-Z0-9_]{1,15}$/.test(author.screen_name)
      )
        throw new AppError(
          "XAPI_INVALID_RESPONSE",
          "xapi.to returned a malformed tweet",
        );
      // Retweets and conversation entries can belong to another author.
      if (author.id !== userId) continue;
      const timestamp =
        typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
      posts.push({
        postId: r.id,
        text: r.full_text.slice(0, 50000),
        authorId: author.id,
        authorHandle: author.screen_name,
        postedAt: Number.isFinite(timestamp) ? new Date(timestamp) : null,
        likes: count(r.favorite_count),
        reposts: count(r.retweet_count),
        replies: count(r.reply_count),
      });
    }
    const cursors = d.cursors as Data | undefined;
    const nextCursor =
      typeof cursors?.bottom === "string" && cursors.bottom.length <= 2048
        ? cursors.bottom
        : null;
    return { posts, nextCursor };
  }
}
