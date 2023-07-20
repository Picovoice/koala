/*
  Copyright 2023 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

/* eslint camelcase: 0 */

import { Mutex } from 'async-mutex';

import {
  aligned_alloc_type,
  pv_free_type,
  buildWasm,
  arrayBufferToStringAtIndex,
  isAccessKeyValid,
  loadModel,
  PvError
} from '@picovoice/web-utils';

import { simd } from 'wasm-feature-detect';

import { KoalaModel, KoalaOptions } from './types';

/**
 * WebAssembly function types
 */
type pv_koala_init_type = (accessKey: number, modelPath: number, object: number) => Promise<number>;
type pv_koala_delay_sample_type = (object: number, delaySample: number) => Promise<number>;
type pv_koala_process_type = (object: number, pcm: number, enhancedPcm: number) => Promise<number>;
type pv_koala_reset_type = (object: number) => Promise<number>;
type pv_koala_delete_type = (object: number) => Promise<void>;
type pv_status_to_string_type = (status: number) => Promise<number>
type pv_koala_frame_length_type = () => Promise<number>;
type pv_sample_rate_type = () => Promise<number>;
type pv_koala_version_type = () => Promise<number>;

/**
 * JavaScript/WebAssembly Binding for Koala
 */
type KoalaWasmOutput = {
  aligned_alloc: aligned_alloc_type;
  memory: WebAssembly.Memory;
  pvFree: pv_free_type;
  objectAddress: number;
  pvKoalaDelete: pv_koala_delete_type;
  pvKoalaProcess: pv_koala_process_type;
  pvKoalaReset: pv_koala_reset_type;
  pvStatusToString: pv_status_to_string_type;
  delaySample: number;
  frameLength: number
  sampleRate: number;
  version: string;
  inputBufferAddress: number;
  outputBufferAddress: number;
  pvError: PvError;
};

const PV_STATUS_SUCCESS = 10000;

export class Koala {
  private readonly _pvKoalaDelete: pv_koala_delete_type;
  private readonly _pvKoalaProcess: pv_koala_process_type;
  private readonly _pvKoalaReset: pv_koala_reset_type;
  private readonly _pvStatusToString: pv_status_to_string_type;

  private _wasmMemory: WebAssembly.Memory | undefined;
  private readonly _pvFree: pv_free_type;
  private readonly _processMutex: Mutex;

  private readonly _objectAddress: number;
  private readonly _inputBufferAddress: number;
  private readonly _outputBufferAddress: number;

  private static _delaySample: number;
  private static _frameLength: number;
  private static _sampleRate: number;
  private static _version: string;
  private static _wasm: string;
  private static _wasmSimd: string;

  private static _koalaMutex = new Mutex();

  private readonly _processCallback: (enhancedPcm: Int16Array) => void;
  private readonly _processErrorCallback?: (error: string) => void;

  private readonly _pvError: PvError;

  private constructor(
    handleWasm: KoalaWasmOutput,
    processCallback: (enhancedPcm: Int16Array) => void,
    processErrorCallback?: (error: string) => void,
  ) {
    Koala._delaySample = handleWasm.delaySample;
    Koala._frameLength = handleWasm.frameLength;
    Koala._sampleRate = handleWasm.sampleRate;
    Koala._version = handleWasm.version;

    this._pvKoalaDelete = handleWasm.pvKoalaDelete;
    this._pvKoalaProcess = handleWasm.pvKoalaProcess;
    this._pvKoalaReset = handleWasm.pvKoalaReset;
    this._pvStatusToString = handleWasm.pvStatusToString;

    this._wasmMemory = handleWasm.memory;
    this._pvFree = handleWasm.pvFree;
    this._objectAddress = handleWasm.objectAddress;
    this._inputBufferAddress = handleWasm.inputBufferAddress;
    this._outputBufferAddress = handleWasm.outputBufferAddress;

    this._pvError = handleWasm.pvError;
    this._processMutex = new Mutex();

    this._processCallback = processCallback;
    this._processErrorCallback = processErrorCallback;
  }

  /**
   * Delay in samples. If the input and output of consecutive calls to `.process()` are viewed as two contiguous
   * streams of audio data, this delay specifies the time shift between the input and output stream.
   */
  get delaySample(): number {
    return Koala._delaySample;
  }

  /**
   * Get Koala engine version.
   */
  get version(): string {
    return Koala._version;
  }

  /**
   * Get frame length.
   */
  get frameLength(): number {
    return Koala._frameLength;
  }

  /**
   * Get sample rate.
   */
  get sampleRate(): number {
    return Koala._sampleRate;
  }

  /**
   * Set base64 wasm file.
   * @param wasm Base64'd wasm file to use to initialize wasm.
   */
  public static setWasm(wasm: string): void {
    if (this._wasm === undefined) {
      this._wasm = wasm;
    }
  }

  /**
   * Set base64 wasm file with SIMD feature.
   * @param wasmSimd Base64'd wasm file to use to initialize wasm.
   */
  public static setWasmSimd(wasmSimd: string): void {
    if (this._wasmSimd === undefined) {
      this._wasmSimd = wasmSimd;
    }
  }

  /**
   * Creates an instance of the Picovoice Koala Noise Suppression Engine.
   * Behind the scenes, it requires the WebAssembly code to load and initialize before
   * it can create an instance.
   *
   * @param accessKey AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
   * @param processCallback User-defined callback to run after receiving enhanced pcm result.
   * The output is not directly the enhanced version of the input PCM, but corresponds to samples that were given in
   * previous calls to `.process()`. The delay in samples between the start time of the input frame and the start
   * time of the output frame can be attained from `.delaySample`.
   * @param model Koala model options.
   * @param model.base64 The model in base64 string to initialize Koala.
   * @param model.publicPath The model path relative to the public directory.
   * @param model.customWritePath Custom path to save the model in storage.
   * Set to a different name to use multiple models across `koala` instances.
   * @param model.forceWrite Flag to overwrite the model in storage even if it exists.
   * @param model.version Version of the model file. Increment to update the model file in storage.
   * @param options Optional configuration arguments.
   * @param options.processErrorCallback User-defined callback invoked if any error happens
   * while processing the audio stream. Its only input argument is the error message.
   *
   * @returns An instance of the Koala engine.
   */
  public static async create(
    accessKey: string,
    processCallback: (enhancedPcm: Int16Array) => void,
    model: KoalaModel,
    options: KoalaOptions = {},
  ): Promise<Koala> {
    const customWritePath = (model.customWritePath) ? model.customWritePath : 'koala_model';
    const modelPath = await loadModel({ ...model, customWritePath });

    return Koala._init(
      accessKey,
      processCallback,
      modelPath,
      options
    );
  }

  public static async _init(
    accessKey: string,
    processCallback: (enhancedPcm: Int16Array) => void,
    modelPath: string,
    options: KoalaOptions = {},
  ): Promise<Koala> {
    const { processErrorCallback } = options;

    if (!isAccessKeyValid(accessKey)) {
      throw new Error('Invalid AccessKey');
    }

    return new Promise<Koala>((resolve, reject) => {
      Koala._koalaMutex
        .runExclusive(async () => {
          const isSimd = await simd();
          const wasmOutput = await Koala.initWasm(accessKey.trim(), (isSimd) ? this._wasmSimd : this._wasm, modelPath, options);
          return new Koala(wasmOutput, processCallback, processErrorCallback);
        })
        .then((result: Koala) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Processes a frame of audio. The required sample rate can be retrieved from '.sampleRate' and the length
   * of frame (number of audio samples per frame) can be retrieved from '.frameLength' The audio needs to be
   * 16-bit linearly-encoded. Furthermore, the engine operates on single-channel audio. Consecutive calls to
   * `.process()` must provide consecutive frames of audio from the same source, unless `.reset()` has been
   * called in between.
   *
   * @param pcm A frame of audio with properties described above.
   */
  public async process(pcm: Int16Array): Promise<void> {
    if (!(pcm instanceof Int16Array)) {
      const error = new Error('The argument \'pcm\' must be provided as an Int16Array');
      if (this._processErrorCallback) {
        this._processErrorCallback(error.toString());
      } else {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }

    if (pcm.length !== this.frameLength) {
      const error = new Error(`Koala process requires frames of length ${this.frameLength}. 
        Received frame of size ${pcm.length}.`);
      if (this._processErrorCallback) {
        this._processErrorCallback(error.toString());
      } else {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }

    this._processMutex
      .runExclusive(async () => {
        if (this._wasmMemory === undefined) {
          throw new Error('Attempted to call Koala process after release.');
        }
        const memoryBuffer = new Int16Array(this._wasmMemory.buffer);

        memoryBuffer.set(
          pcm,
          this._inputBufferAddress / Int16Array.BYTES_PER_ELEMENT,
        );

        const status = await this._pvKoalaProcess(
          this._objectAddress,
          this._inputBufferAddress,
          this._outputBufferAddress
        );

        const memoryBufferUint8 = new Uint8Array(this._wasmMemory.buffer);

        if (status !== PV_STATUS_SUCCESS) {
          const msg = `process failed with status ${arrayBufferToStringAtIndex(
            memoryBufferUint8,
            await this._pvStatusToString(status),
          )}`;

          throw new Error(
            `${msg}\nDetails: ${this._pvError.getErrorString()}`
          );
        }

        const output = memoryBuffer.slice(
          this._outputBufferAddress / Int16Array.BYTES_PER_ELEMENT,
          (this._outputBufferAddress / Int16Array.BYTES_PER_ELEMENT) + this.frameLength
        );

        this._processCallback(output);
      })
      .catch((error: any) => {
        if (this._processErrorCallback) {
          this._processErrorCallback(error.toString());
        } else {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      });
  }

  /**
   * Resets Koala into a state as if it had just been newly created.
   * Call this function in between calls to `process` that do not provide consecutive frames of audio.
   */
  public async reset(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._processMutex
        .runExclusive(async () => {
          if (this._wasmMemory === undefined) {
            throw new Error('Attempted to call Koala reset after release.');
          }

          const status = await this._pvKoalaReset(this._objectAddress);

          if (status !== PV_STATUS_SUCCESS) {
            const memoryBuffer = new Uint8Array(this._wasmMemory.buffer);
            const msg = `process failed with status ${arrayBufferToStringAtIndex(
              memoryBuffer,
              await this._pvStatusToString(status),
            )}`;

            throw new Error(
              `${msg}\nDetails: ${this._pvError.getErrorString()}`
            );
          }

          resolve();
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Releases resources acquired by WebAssembly module.
   */
  public async release(): Promise<void> {
    await this._pvKoalaDelete(this._objectAddress);
    await this._pvFree(this._inputBufferAddress);
    await this._pvFree(this._outputBufferAddress);
    delete this._wasmMemory;
    this._wasmMemory = undefined;
  }

  async onmessage(e: MessageEvent): Promise<void> {
    switch (e.data.command) {
      case 'process':
        await this.process(e.data.inputFrame);
        break;
      default:
        // eslint-disable-next-line no-console
        console.warn(`Unrecognized command: ${e.data.command}`);
    }
  }

  private static async initWasm(accessKey: string, wasmBase64: string, modelPath: string, _: KoalaOptions): Promise<KoalaWasmOutput> {
    // A WebAssembly page has a constant size of 64KiB. -> 1MiB ~= 16 pages
    const memory = new WebAssembly.Memory({ initial: 300 });

    const memoryBufferUint8 = new Uint8Array(memory.buffer);

    const pvError = new PvError();

    const exports = await buildWasm(memory, wasmBase64, pvError);

    const aligned_alloc = exports.aligned_alloc as aligned_alloc_type;
    const pv_free = exports.pv_free as pv_free_type;
    const pv_koala_version = exports.pv_koala_version as pv_koala_version_type;
    const pv_koala_delay_sample = exports.pv_koala_delay_sample as pv_koala_delay_sample_type;
    const pv_koala_process = exports.pv_koala_process as pv_koala_process_type;
    const pv_koala_reset = exports.pv_koala_reset as pv_koala_reset_type;
    const pv_koala_delete = exports.pv_koala_delete as pv_koala_delete_type;
    const pv_koala_init = exports.pv_koala_init as pv_koala_init_type;
    const pv_status_to_string = exports.pv_status_to_string as pv_status_to_string_type;
    const pv_koala_frame_length = exports.pv_koala_frame_length as pv_koala_frame_length_type;
    const pv_sample_rate = exports.pv_sample_rate as pv_sample_rate_type;

    const objectAddressAddress = await aligned_alloc(
      Int32Array.BYTES_PER_ELEMENT,
      Int32Array.BYTES_PER_ELEMENT,
    );
    if (objectAddressAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    const accessKeyAddress = await aligned_alloc(
      Uint8Array.BYTES_PER_ELEMENT,
      (accessKey.length + 1) * Uint8Array.BYTES_PER_ELEMENT,
    );

    if (accessKeyAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    for (let i = 0; i < accessKey.length; i++) {
      memoryBufferUint8[accessKeyAddress + i] = accessKey.charCodeAt(i);
    }
    memoryBufferUint8[accessKeyAddress + accessKey.length] = 0;

    const modelPathEncoded = new TextEncoder().encode(modelPath);
    const modelPathAddress = await aligned_alloc(
      Uint8Array.BYTES_PER_ELEMENT,
      (modelPathEncoded.length + 1) * Uint8Array.BYTES_PER_ELEMENT,
    );

    if (modelPathAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    memoryBufferUint8.set(modelPathEncoded, modelPathAddress);
    memoryBufferUint8[modelPathAddress + modelPathEncoded.length] = 0;

    let status = await pv_koala_init(
      accessKeyAddress,
      modelPathAddress,
      objectAddressAddress);
    if (status !== PV_STATUS_SUCCESS) {
      const msg = `'pv_koala_init' failed with status ${arrayBufferToStringAtIndex(
        memoryBufferUint8,
        await pv_status_to_string(status),
      )}`;

      throw new Error(
        `${msg}\nDetails: ${pvError.getErrorString()}`
      );
    }
    const memoryBufferView = new DataView(memory.buffer);
    const objectAddress = memoryBufferView.getInt32(objectAddressAddress, true);

    const delaySampleAddress = await aligned_alloc(
      Int32Array.BYTES_PER_ELEMENT,
      Int32Array.BYTES_PER_ELEMENT,
    );

    if (delaySampleAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    status = await pv_koala_delay_sample(objectAddress, delaySampleAddress);
    if (status !== PV_STATUS_SUCCESS) {
      const msg = `'pv_koala_delay_sample' failed with status ${arrayBufferToStringAtIndex(
        memoryBufferUint8,
        await pv_status_to_string(status),
      )}`;

      throw new Error(
        `${msg}\nDetails: ${pvError.getErrorString()}`
      );
    }

    const delaySample = memoryBufferView.getInt32(delaySampleAddress, true);

    const frameLength = await pv_koala_frame_length();
    const sampleRate = await pv_sample_rate();
    const versionAddress = await pv_koala_version();
    const version = arrayBufferToStringAtIndex(
      memoryBufferUint8,
      versionAddress,
    );

    await pv_free(accessKeyAddress);
    await pv_free(modelPathAddress);
    await pv_free(delaySample);

    const inputBufferAddress = await aligned_alloc(
      Int16Array.BYTES_PER_ELEMENT,
      frameLength * Int16Array.BYTES_PER_ELEMENT,
    );
    if (inputBufferAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    const outputBufferAddress = await aligned_alloc(
      Int16Array.BYTES_PER_ELEMENT,
      frameLength * Int16Array.BYTES_PER_ELEMENT,
    );
    if (outputBufferAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    return {
      aligned_alloc,
      memory: memory,
      pvFree: pv_free,
      objectAddress: objectAddress,
      pvKoalaDelete: pv_koala_delete,
      pvKoalaProcess: pv_koala_process,
      pvKoalaReset: pv_koala_reset,
      pvStatusToString: pv_status_to_string,
      delaySample: delaySample,
      frameLength: frameLength,
      sampleRate: sampleRate,
      version: version,
      inputBufferAddress: inputBufferAddress,
      outputBufferAddress: outputBufferAddress,
      pvError: pvError
    };
  }
}
