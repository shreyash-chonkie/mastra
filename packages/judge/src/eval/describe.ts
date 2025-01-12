import { harness } from './harness';

export const mDescribe = harness.describe.bind(harness);

export const mIt = harness.it.bind(harness);
