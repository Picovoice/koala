import { Koala, KoalaWorker } from '../';

const ACCESS_KEY = Cypress.env('ACCESS_KEY');
const NUM_TEST_ITERATIONS = Number(Cypress.env('NUM_TEST_ITERATIONS'));
const PROC_PERFORMANCE_THRESHOLD_SEC = Number(
  Cypress.env('PROC_PERFORMANCE_THRESHOLD_SEC')
);

async function testPerformance(
  instance: typeof Koala | typeof KoalaWorker,
  inputPcm: Int16Array
) {
  const perfResults: number[] = [];
  for (let j = 0; j < NUM_TEST_ITERATIONS; j++) {
    let numFrames = 0;
    let processedFrames = 0;

    const koala = await Koala.create(
      ACCESS_KEY,
      _ => {
        processedFrames += 1;
      },
      { publicPath: '/test/koala_params.pv', forceWrite: true }
    );

    numFrames = Math.round(inputPcm.length / koala.frameLength) - 1;

    const waitUntil = (): Promise<void> =>
      new Promise(resolve => {
        setInterval(() => {
          if (numFrames === processedFrames) {
            resolve();
          }
        }, 100);
      });

    await koala.reset();
    const start = Date.now();
    for (
      let i = 0;
      i < inputPcm.length - koala.frameLength + 1;
      i += koala.frameLength
    ) {
      await koala.process(inputPcm.slice(i, i + koala.frameLength));
    }

    await waitUntil();
    const end = Date.now();
    perfResults.push((end - start) / 1000);

    if (koala instanceof KoalaWorker) {
      koala.terminate();
    } else {
      await koala.release();
    }
  }

  const avgPerf = perfResults.reduce((a, b) => a + b) / NUM_TEST_ITERATIONS;
  // eslint-disable-next-line no-console
  console.log(`Average proc performance: ${avgPerf} seconds`);
  expect(avgPerf).to.be.lessThan(PROC_PERFORMANCE_THRESHOLD_SEC);
}

describe('Koala binding performance test', () => {
  Cypress.config('defaultCommandTimeout', 60000);

  it(`should be lower than performance threshold (${PROC_PERFORMANCE_THRESHOLD_SEC}s)`, () => {
    cy.getFramesFromFile('audio_samples/test.wav').then(async inputPcm => {
      await testPerformance(Koala, inputPcm);
    });
  });

  it(`should be lower than performance threshold (${PROC_PERFORMANCE_THRESHOLD_SEC}s) (worker)`, () => {
    cy.getFramesFromFile('audio_samples/test.wav').then(async inputPcm => {
      await testPerformance(KoalaWorker, inputPcm);
    });
  });
});
