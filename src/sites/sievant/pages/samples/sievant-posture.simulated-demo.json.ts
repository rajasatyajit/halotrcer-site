// The Sievant sample posture report as a download, byte for byte the committed sample
// (content/samples/sievant-posture.json). The file name carries "simulated-demo", so a
// forwarded copy still says what it is; its paths and names are synthetic product test data.
import { sample } from '../../../../lib/samples.ts';

export const GET = (): Response =>
  new Response(sample('sievant-posture').raw, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
