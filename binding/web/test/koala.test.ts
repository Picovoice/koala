import { Koala, KoalaWorker } from '../';

// @ts-ignore
import koalaParams from './koala_params';
import { KoalaError } from "../dist/types/koala_errors";

const ACCESS_KEY = Cypress.env('ACCESS_KEY');
const DEVICE = Cypress.env('DEVICE');

const getDeviceList = () => {
  const result: string[] = [];
  if (DEVICE === 'cpu') {
    const maxThreads = self.navigator.hardwareConcurrency / 2;

    for (let i = 1; i <= maxThreads; i *= 2) {
      result.push(`cpu:${i}`);
    }
  } else {
    result.push(DEVICE);
  }

  return result;
};

function rootMeanSquare(pcm: Int16Array): number {
  let sumSquares = 0;
  for (let i = 0; i < pcm.length; i++) {
    sumSquares += Math.pow(pcm[i] / 32768, 2);
  }
  return Math.sqrt(sumSquares / pcm.length);
}

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function runTest(
  instance: typeof Koala | typeof KoalaWorker,
  inputPcm: Int16Array,
  referencePcm?: Int16Array,
  device?: string,
  tolerance = 0.02
) {
  const errorFrames: number[] = [];

  const runProcess = () =>
    new Promise<void>(async (resolve, reject) => {
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
            const referenceFrame = referencePcm.slice(
              frameStart - koala.delaySample,
              frameStart - koala.delaySample + koala.frameLength
            );
            energyDeviation = Math.abs(
              frameEnergy - rootMeanSquare(referenceFrame)
            );
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
              reject(
                `Failed comparison for frames: '${errorFrames.join(',')}'`
              );
            } else {
              resolve();
            }
          }
        },
        { publicPath: '/test/koala_params.pv', forceWrite: true },
        {
          device: device,
          processErrorCallback: (error: KoalaError) => {
            reject(error);
          },
        }
      );

      numFrames = Math.round(inputPcm.length / koala.frameLength) - 1;
      await koala.reset();
      for (
        let i = 0;
        i < inputPcm.length - koala.frameLength + 1;
        i += koala.frameLength
      ) {
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

  const koala = await instance.create(
    ACCESS_KEY,
    enhancedPcm => {
      frames.push(enhancedPcm);
    },
    { publicPath: '/test/koala_params.pv', forceWrite: true }
  );

  numFrames = Math.round(inputPcm.length / koala.frameLength) - 1;
  await koala.reset();
  for (
    let i = 0;
    i < inputPcm.length - koala.frameLength + 1;
    i += koala.frameLength
  ) {
    await koala.process(inputPcm.slice(i, i + koala.frameLength));
  }

  const waitUntil = (): Promise<void> =>
    new Promise(resolve => {
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
  for (
    let i = 0;
    i < inputPcm.length - koala.frameLength + 1;
    i += koala.frameLength
  ) {
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
  it(`should return process error message stack`, async () => {
    let error: KoalaError | null = null;

    const runProcess = () => new Promise<void>(async resolve => {
      const koala = await Koala.create(
        ACCESS_KEY,
        () => { },
        {
          publicPath: '/test/koala_params.pv',
          forceWrite: true,
        },
        {
          processErrorCallback: (e: KoalaError) => {
            error = e;
            resolve();
          }
        }
      );
      const testPcm = new Int16Array(koala.frameLength);
      // @ts-ignore
      const objectAddress = koala._objectAddress;

      // @ts-ignore
      koala._objectAddress = 0;
      await koala.process(testPcm);

      await delay(1000);

      // @ts-ignore
      koala._objectAddress = objectAddress;
      await koala.release();
    });

    await runProcess();
    expect(error).to.not.be.null;
    if (error) {
      expect((error as KoalaError).messageStack.length).to.be.gt(0);
      expect((error as KoalaError).messageStack.length).to.be.lte(8);
    }
  });

  for (const instance of [Koala, KoalaWorker]) {
    const instanceString = instance === KoalaWorker ? 'worker' : 'main';
    it(`should be able to init with public path (${instanceString})`, async () => {
      try {
        const koala = await instance.create(ACCESS_KEY, _ => {}, {
          publicPath: '/test/koala_params.pv',
          forceWrite: true,
        });
        expect(koala).to.not.be.undefined;
        expect(koala.frameLength).to.be.greaterThan(0);
        expect(koala.delaySample).to.be.gte(0);
        expect(typeof koala.version).to.eq('string');
        expect(koala.version).length.to.be.greaterThan(0);
        if (koala instanceof KoalaWorker) {
          koala.terminate();
        } else {
          await koala.release();
        }
      } catch (e) {
        expect(e).to.be.undefined;
      }
    });

    it(`should be able to init with base64 (${instanceString})`, async () => {
      try {
        const koala = await instance.create(ACCESS_KEY, _ => {}, {
          base64: koalaParams,
          forceWrite: true,
        });
        expect(koala).to.not.be.undefined;
        expect(koala.frameLength).to.be.greaterThan(0);
        expect(koala.delaySample).to.be.gte(0);
        expect(typeof koala.version).to.eq('string');
        expect(koala.version).length.to.be.greaterThan(0);
        if (koala instanceof KoalaWorker) {
          koala.terminate();
        } else {
          await koala.release();
        }
      } catch (e) {
        expect(e).to.be.undefined;
      }
    });

    for (const device of getDeviceList()) {
      it(`should be able to process pure speech (${instanceString}) (${device})`, () => {
        cy.getFramesFromFile('audio_samples/test.wav').then(async inputPcm => {
          await runTest(instance, inputPcm, inputPcm, device);
        });
      });

      it(`should be able to process noise speech (${instanceString}) (${device})`, () => {
        cy.getFramesFromFile('audio_samples/noise.wav').then(async inputPcm => {
          await runTest(instance, inputPcm, undefined, device);
        });
      });

      it(`should be able to process mixed speech (${instanceString}) (${device})`, () => {
        cy.getFramesFromFile('audio_samples/noise.wav').then(inputPcm => {
          cy.getFramesFromFile('audio_samples/test.wav').then(
            async referencePcm => {
              const noisyPcm = new Int16Array(inputPcm.length);
              for (let i = 0; i < inputPcm.length; i++) {
                noisyPcm[i] = inputPcm[i] + referencePcm[i];
              }

              await runTest(instance, noisyPcm, referencePcm, device);
            }
          );
        });
      });
    }

    it(`should be able to reset (${instanceString})`, () => {
      cy.getFramesFromFile('audio_samples/test.wav').then(async inputPcm => {
        await testReset(instance, inputPcm);
      });
    });

    it(`should return correct error message stack (${instanceString})`, async () => {
      let messageStack = [];
      try {
        const koala = await instance.create('invalidAccessKey', _ => {}, {
          publicPath: '/test/koala_params.pv',
          forceWrite: true,
        });
        expect(koala).to.be.undefined;
      } catch (e: any) {
        messageStack = e.messageStack;
      }

      expect(messageStack.length).to.be.gt(0);
      expect(messageStack.length).to.be.lte(8);

      try {
        const koala = await instance.create('invalidAccessKey', _ => {}, {
          publicPath: '/test/koala_params.pv',
          forceWrite: true,
        });
        expect(koala).to.be.undefined;
      } catch (e: any) {
        expect(messageStack.length).to.be.eq(e.messageStack.length);
      }
    });
  }
});
