import { harness } from './harness';

async function main() {
  await import('../index.evals');
  await harness.run();
}

main();
