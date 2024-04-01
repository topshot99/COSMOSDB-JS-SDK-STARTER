import { CosmosClient, CosmosDbDiagnosticLevel } from "@azure/cosmos";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({
  endpoint,
  key,
  diagnosticLevel: CosmosDbDiagnosticLevel.debug,
});
const diaganosticsPath = "diagnostics.json";

async function main(): Promise<void> {
  const { database } = await client.database(process.env.DATABASE).read();
  const { container } = await database.container(process.env.CONTAINER).read();

  const query = "SELECT * FROM c";
  // Add abort controller
  const controller = new AbortController();
  const signal = controller.signal;
  // Abort the query after n seconds
  setTimeout(
    () => controller.abort(),
    parseInt(process.env.QUERY_ABORT_TIME_MS)
  );
  const queryOptions = {
    signal,
    enableCrossPartitionQuery: true,
    enableScanInQuery: true,
    forceQueryPlan: true,
    maxDegreeOfParallelism: 6,
    maxItemCount: 100,
    populateQueryMetrics: true,
  };

  const queryIterator = container.items.query(query, queryOptions);
  let result = 0;

  try {
    const { diagnostics } = await queryIterator.fetchNext({
      ruCapPerOperation: parseInt(process.env.RU_THRESOLD),
    });
    saveDiagnosticsToFile(diagnostics, diaganosticsPath);
  } catch (error) {
    saveDiagnosticsToFile(error.diagnostics, diaganosticsPath);
  }
}

function saveDiagnosticsToFile(diagnostics: any, filePath: string): void {
  const json = JSON.stringify(diagnostics, null, 2);
  fs.writeFileSync(filePath, json);
}

main().catch((error) => {
  console.error(error);
});
