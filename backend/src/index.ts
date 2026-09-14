import { createApp } from "./app.js";
import { config } from "./config.js";
import { processPendingWithdrawals } from "./services/cctp.js";
import { isCircleConfigured } from "./services/circle.js";
import { settleEndedWaves } from "./services/payouts.js";

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`zura backend listening on :${config.PORT}`);
});

/** Background worker: settles ended Waves and advances CCTP withdrawals. */
if (config.WORKER_ENABLED && isCircleConfigured()) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await settleEndedWaves();
      await processPendingWithdrawals();
    } catch (err) {
      console.error("worker tick failed", err);
    } finally {
      running = false;
    }
  }, 30_000);
}
