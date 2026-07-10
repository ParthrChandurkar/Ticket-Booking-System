import { app } from "./app";
import { startExpiredHoldJob } from "./utils/expiredHoldJob";

const port = Number(process.env.PORT ?? 4000);

startExpiredHoldJob();

app.listen(port, () => {
  console.log(`Ticket booking API listening on port ${port}`);
});
