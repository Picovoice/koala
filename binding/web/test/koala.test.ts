import { Koala, KoalaWorker } from "../";

// @ts-ignore
import koalaParams from './koala_params';

const ACCESS_KEY = Cypress.env('ACCESS_KEY');

function rootMeanSquare(pcm: Int16Array): number {
  let sumSquares = 0;
  for (let i = 0; i < pcm.length; i++) {
    sumSquares += Math.pow(pcm[i] / 32768, 2);
  }
  return Math.sqrt(sumSquares / pcm.length);
}

async function runTest(
  instance: typeof Koala | typeof KoalaWorker,
  inputPcm: Int16Array,
  referencePcm?: Int16Array,
  tolerance = 0.02
) {
  const errorFrames: number[] = [];

  const runProcess = () => new Promise<void>(async (resolve, reject) => {
    let numFrames = 0;
    let numProcessed = 0;

    const koala = await instance.create(
      ACCESS_KEY,
      enhancedPcm => {
        const frameStart = numProcessed * koala.frameLength;
        const frameEnergy = rootMeanSquare(enhancedPcm);

        let energyDeviation: number;
        if (referencePcm === undefined || frameStart < koala.delaySample) {
          energyDeviation = frameEnergy;
        } else {
          const referenceFrame = referencePcm.slice(frameStart - koala.delaySample, frameStart - koala.delaySample + koala.frameLength);
          energyDeviation = Math.abs(frameEnergy - rootMeanSquare(referenceFrame));
        }

        try {
          expect(energyDeviation).to.be.lessThan(tolerance);
        } catch (e) {
          errorFrames.push(numProcessed);
        }

        numProcessed += 1;
        if (numFrames === numProcessed) {
          if (koala instanceof KoalaWorker) {
            koala.terminate();
          } else {
            koala.release();
          }

          if (errorFrames.length !== 0) {
            reject(`Failed comparison for frames: '${errorFrames.join(",")}'`);
          } else {
            resolve();
          }
        }
      },
      { publicPath: '/test/koala_params.pv', forceWrite: true },
      {
        processErrorCallback: (error: string) => {
          reject(error);
        }
      }
    );

    numFrames = Math.round(inputPcm.length / koala.frameLength) - 1;
    await koala.reset();
    for (let i = 0; i < (inputPcm.length - koala.frameLength + 1); i += koala.frameLength) {
      await koala.process(inputPcm.slice(i, i + koala.frameLength));
    }
  });

  try {
    await runProcess();
  } catch (e: any) {
    expect(e).to.be.undefined;
  }
}

async function testReset(
  instance: typeof Koala | typeof KoalaWorker,
  inputPcm: Int16Array
): Promise<void> {
  let frames: Int16Array[] = [];
  let numFrames = 0;

  const koala = await Koala.create(
    ACCESS_KEY,
    enhancedPcm => {
      frames.push(enhancedPcm);
    },
    { publicPath: '/test/koala_params.pv', forceWrite: true }
  );

  numFrames = Math.round(inputPcm.length / koala.frameLength) - 1;
  await koala.reset();
  for (let i = 0; i < (inputPcm.length - koala.frameLength + 1); i += koala.frameLength) {
    await koala.process(inputPcm.slice(i, i + koala.frameLength));
  }

  const waitUntil = (): Promise<void> => new Promise(resolve => {
    setInterval(() => {
      if (numFrames === frames.length) {
        resolve();
      }
    }, 100);
  });

  await waitUntil();
  const originalFrames = [...frames];
  frames = [];

  await koala.reset();
  for (let i = 0; i < (inputPcm.length - koala.frameLength + 1); i += koala.frameLength) {
    await koala.process(inputPcm.slice(i, i + koala.frameLength));
  }

  await waitUntil();

  for (let i = 0; i < originalFrames.length; i++) {
    expect(originalFrames[i]).to.deep.eq(frames[i]);
  }

  if (koala instanceof KoalaWorker) {
    koala.terminate();
  } else {
    await koala.release();
  }
}

describe('Koala Binding', function () {
  it('should be able to init with public path', async () => {
    try {
      const koala = await Koala.create(
        ACCESS_KEY,
        _ => {},
        { publicPath: '/test/koala_params.pv', forceWrite: true }
      );
      expect(koala).to.not.be.undefined;
      expect(koala.frameLength).to.be.greaterThan(0);
      expect(koala.delaySample).to.be.gte(0);
      expect(typeof koala.version).to.eq('string');
      expect(koala.version).length.to.be.greaterThan(0);
      await koala.release();
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  it('should be able to init with public path (worker)', async () => {
    try {
      const koala = await KoalaWorker.create(
        ACCESS_KEY,
        _ => {},
        { publicPath: '/test/koala_params.pv', forceWrite: true }
      );
      expect(koala).to.not.be.undefined;
      expect(koala.frameLength).to.be.greaterThan(0);
      expect(koala.delaySample).to.be.gte(0);
      expect(typeof koala.version).to.eq('string');
      expect(koala.version).length.to.be.greaterThan(0);
      await koala.terminate();
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  it('should be able to init with base64', async () => {
    try {
      const koala = await Koala.create(
        ACCESS_KEY,
        _ => {},
        { base64: koalaParams, forceWrite: true }
      );
      expect(koala).to.not.be.undefined;
      expect(koala.frameLength).to.be.greaterThan(0);
      expect(koala.delaySample).to.be.gte(0);
      expect(typeof koala.version).to.eq('string');
      expect(koala.version).length.to.be.greaterThan(0);
      await koala.release();
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  it('should be able to init with base64 (worker)', async () => {
    try {
      const koala = await KoalaWorker.create(
        ACCESS_KEY,
        _ => {},
        { base64: koalaParams, forceWrite: true }
      );
      expect(koala).to.not.be.undefined;
      expect(koala.frameLength).to.be.greaterThan(0);
      expect(koala.delaySample).to.be.gte(0);
      expect(typeof koala.version).to.eq('string');
      expect(koala.version).length.to.be.greaterThan(0);
      await koala.release();
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  it('should be able to process pure speech', () => {
    cy.getFramesFromFile('audio_samples/test.wav').then( async inputPcm => {
      await runTest(Koala, inputPcm, inputPcm);
    });
  });

  it('should be able to process pure speech (worker)', () => {
    cy.getFramesFromFile('audio_samples/test.wav').then( async inputPcm => {
      await runTest(KoalaWorker, inputPcm, inputPcm);
    });
  });

  it('should be able to process noise speech', () => {
    cy.getFramesFromFile('audio_samples/noise.wav').then( async inputPcm => {
      await runTest(Koala, inputPcm);
    });
  });

  it('should be able to process noise speech (worker)', () => {
    cy.getFramesFromFile('audio_samples/noise.wav').then( async inputPcm => {
      await runTest(KoalaWorker, inputPcm);
    });
  });

  it('should be able to process mixed speech', () => {
    cy.getFramesFromFile('audio_samples/noise.wav').then( inputPcm => {
      cy.getFramesFromFile('audio_samples/test.wav').then(async referencePcm => {
        const noisyPcm = new Int16Array(inputPcm.length);
        for (let i = 0; i < inputPcm.length; i++) {
          noisyPcm[i] = inputPcm[i] + referencePcm[i];
        }

        await runTest(Koala, noisyPcm, referencePcm);
      });
    });
  });

  it('should be able to process mixed speech (worker)', () => {
    cy.getFramesFromFile('audio_samples/noise.wav').then( inputPcm => {
      cy.getFramesFromFile('audio_samples/test.wav').then(async referencePcm => {
        const noisyPcm = new Int16Array(inputPcm.length);
        for (let i = 0; i < inputPcm.length; i++) {
          noisyPcm[i] = inputPcm[i] + referencePcm[i];
        }

        await runTest(KoalaWorker, noisyPcm, referencePcm);
      });
    });
  });

  it('should be able to reset', () => {
    cy.getFramesFromFile('audio_samples/test.wav').then( async inputPcm => {
      await testReset(Koala, inputPcm);
    });
  });

  it('should be able to reset (worker)', () => {
    cy.getFramesFromFile('audio_samples/test.wav').then( async inputPcm => {
      await testReset(KoalaWorker, inputPcm);
    });
  });
});
