import { AppError } from "../../common/http";
export const heartbeatMs = 120000;
export function assertOnline(
  s: { state: string; paused: boolean; heartbeatAt: Date | null } | null,
) {
  if (
    !s ||
    s.state !== "CONNECTED" ||
    s.paused ||
    !s.heartbeatAt ||
    Date.now() - s.heartbeatAt.getTime() > heartbeatMs
  )
    throw new AppError(
      "EXECUTOR_OFFLINE",
      "Executor paused or disconnected; pair its own wallet in Grok Bot",
      409,
    );
}
