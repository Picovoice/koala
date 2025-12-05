/*
  Copyright 2023-2025 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

/* eslint camelcase: 0 */

import { Mutex } from 'async-mutex';
import { simd } from 'wasm-feature-detect';

import {
  arrayBufferToStringAtIndex,
  base64ToUint8Array,
  isAccessKeyValid,
  loadModel,
} from '@picovoice/web-utils';

import createModuleSimd from "./lib/pv_koala_simd";
import createModulePThread from "./lib/pv_koala_pthread";

import { KoalaModel, KoalaOptions, PvStatus } from './types';

import * as KoalaErrors from './koala_errors';
import { pvStatusToException } from './koala_errors';

/**
 * WebAssembly function types
 */
type pv_koala_init_type = (
  accessKey: number,
  modelPath: number,
  device: number,
  object: number
) => Promise<number>;
type pv_koala_delay_sample_type = (
  object: number,
  delaySample: number
) => number;
type pv_koala_process_type = (
  object: number,
  pcm: number,
  enhancedPcm: number
) => Promise<number>;
type pv_koala_reset_type = (object: number) => Promise<number>;
type pv_koala_delete_type = (object: number) => void;
type pv_koala_frame_length_type = () => number;
type pv_sample_rate_type = () => number;
type pv_koala_version_type = () => number;
type pv_koala_list_hardware_devices_type = (
  hardwareDevices: number,
  numHardwareDevices: number
) => number;
type pv_koala_free_hardware_devices_type = (
  hardwareDevices: number,
  numHardwareDevices: number
) => number;
type pv_set_sdk_type = (sdk: number) => void;
type pv_get_error_stack_type = (
  messageStack: number,
  messageStackDepth: number
) => number;
type pv_free_error_stack_type = (messageStack: number) => void;

type KoalaModule = EmscriptenModule & {
  _pv_free: (address: number) => void;

  _pv_koala_delete: pv_koala_delete_type
  _pv_koala_delay_sample: pv_koala_delay_sample_type
  _pv_koala_frame_length: pv_koala_frame_length_type;
  _pv_sample_rate: pv_sample_rate_type
  _pv_koala_version: pv_koala_version_type
  _pv_koala_list_hardware_devices: pv_koala_list_hardware_devices_type;
  _pv_koala_free_hardware_devices: pv_koala_free_hardware_devices_type;

  _pv_set_sdk: pv_set_sdk_type;
  _pv_get_error_stack: pv_get_error_stack_type;
  _pv_free_error_stack: pv_free_error_stack_type;

  // em default functions
  addFunction: typeof addFunction;
  ccall: typeof ccall;
  cwrap: typeof cwrap;
}

/**
 * JavaScript/WebAssembly Binding for Koala
 */
type KoalaWasmOutput = {
  module: KoalaModule;

  pv_koala_process: pv_koala_process_type;
  pv_koala_reset: pv_koala_reset_type;

  version: string;
  sampleRate: number;
  delaySample: number;
  frameLength: number;

  objectAddress: number;
  messageStackAddressAddressAddress: number;
  messageStackDepthAddress: number;
  inputBufferAddress: number;
  outputBufferAddress: number;
};

const CPU_DEVICE_REGEX = /^cpu(:\d+)?$/;
const PV_STATUS_SUCCESS = 10000;

class Koala {
  private readonly _module: KoalaModule;

  private readonly _pv_koala_process: pv_koala_process_type;
  private readonly _pv_koala_reset: pv_koala_reset_type;

  private readonly _delaySample: number;
  private readonly _frameLength: number;
  private readonly _sampleRate: number;
  private readonly _version: string;

  private readonly _processMutex: Mutex;

  private readonly _objectAddress: number;
  private readonly _inputBufferAddress: number;
  private readonly _outputBufferAddress: number;
  private readonly _messageStackAddressAddressAddress: number;
  private readonly _messageStackDepthAddress: number;

  private static _wasmSimd: string;
  private static _wasmSimdLib: string;
  private static _wasmPThread: string;
  private static _wasmPThreadLib: string;
  private static _sdk: string = 'web';

  private static _koalaMutex = new Mutex();

  private readonly _processCallback: (enhancedPcm: Int16Array) => void;
  private readonly _processErrorCallback?: (
    error: KoalaErrors.KoalaError
  ) => void;

  private constructor(
    handleWasm: KoalaWasmOutput,
    processCallback: (enhancedPcm: Int16Array) => void,
    processErrorCallback?: (error: KoalaErrors.KoalaError) => void
  ) {
    this._module = handleWasm.module;

    this._pv_koala_process = handleWasm.pv_koala_process;
    this._pv_koala_reset = handleWasm.pv_koala_reset;

    this._delaySample = handleWasm.delaySample;
    this._frameLength = handleWasm.frameLength;
    this._sampleRate = handleWasm.sampleRate;
    this._version = handleWasm.version;

    this._objectAddress = handleWasm.objectAddress;
    this._inputBufferAddress = handleWasm.inputBufferAddress;
    this._outputBufferAddress = handleWasm.outputBufferAddress;
    this._messageStackAddressAddressAddress =
      handleWasm.messageStackAddressAddressAddress;
    this._messageStackDepthAddress = handleWasm.messageStackDepthAddress;

    this._processMutex = new Mutex();

    this._processCallback = processCallback;
    this._processErrorCallback = processErrorCallback;
  }

  /**
   * Delay in samples. If the input and output of consecutive calls to `.process()` are viewed as two contiguous
   * streams of audio data, this delay specifies the time shift between the input and output stream.
   */
  get delaySample(): number {
    return this._delaySample;
  }

  /**
   * Get Koala engine version.
   */
  get version(): string {
    return this._version;
  }

  /**
   * Get frame length.
   */
  get frameLength(): number {
    return this._frameLength;
  }

  /**
   * Get sample rate.
   */
  get sampleRate(): number {
    return this._sampleRate;
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
   * Set base64 SIMD wasm file in text format.
   * @param wasmSimdLib Base64'd wasm file in text format.
   */
  public static setWasmSimdLib(wasmSimdLib: string): void {
    if (this._wasmSimdLib === undefined) {
      this._wasmSimdLib = wasmSimdLib;
    }
  }

  /**
   * Set base64 wasm file with SIMD and pthread feature.
   * @param wasmPThread Base64'd wasm file to use to initialize wasm.
   */
  public static setWasmPThread(wasmPThread: string): void {
    if (this._wasmPThread === undefined) {
      this._wasmPThread = wasmPThread;
    }
  }

  /**
   * Set base64 SIMD and thread wasm file in text format.
   * @param wasmPThreadLib Base64'd wasm file in text format.
   */
  public static setWasmPThreadLib(wasmPThreadLib: string): void {
    if (this._wasmPThreadLib === undefined) {
      this._wasmPThreadLib = wasmPThreadLib;
    }
  }

  public static setSdk(sdk: string): void {
    Koala._sdk = sdk;
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
   * @param options.device String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
   * suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device. To select a specific
   * GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index of the target GPU. If set to
   * `cpu`, the engine will run on the CPU with the default number of threads. To specify the number of threads, set this
   * argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the desired number of threads.
   * @param options.processErrorCallback User-defined callback invoked if any error happens
   * while processing the audio stream. Its only input argument is the error message.
   *
   * @returns An instance of the Koala engine.
   */
  public static async create(
    accessKey: string,
    processCallback: (enhancedPcm: Int16Array) => void,
    model: KoalaModel,
    options: KoalaOptions = {}
  ): Promise<Koala> {
    const customWritePath = model.customWritePath
      ? model.customWritePath
      : 'koala_model';
    const modelPath = await loadModel({ ...model, customWritePath });

    return Koala._init(accessKey, processCallback, modelPath, options);
  }

  public static async _init(
    accessKey: string,
    processCallback: (enhancedPcm: Int16Array) => void,
    modelPath: string,
    options: KoalaOptions = {}
  ): Promise<Koala> {
    let { device = "best" } = options;
    const { processErrorCallback } = options;

    if (!isAccessKeyValid(accessKey)) {
      throw new KoalaErrors.KoalaInvalidArgumentError('Invalid AccessKey');
    }

    const isSimd = await simd();
    if (!isSimd) {
      throw new KoalaErrors.KoalaRuntimeError('Browser not supported.');
    }

    if (device === "best") {
      device = "cpu:1";
    }

    const isWorkerScope = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
    if (!isWorkerScope) {
      if (device && CPU_DEVICE_REGEX.test(device)) {
        if (device !== "cpu" && device !== "cpu:1") {
          console.warn("Multi-threading is not supported on main thread.");
        }
        device = "cpu:1";
      }
    }

    const sabDefined = (typeof SharedArrayBuffer !== 'undefined')
      && (device !== "cpu") && (device !== "cpu:1");

    return new Promise<Koala>((resolve, reject) => {
      Koala._koalaMutex
        .runExclusive(async () => {
          const wasmOutput = await Koala.initWasm(
            accessKey.trim(),
            modelPath,
            (device) ? device : "best",
            (sabDefined) ? this._wasmPThread : this._wasmSimd,
            (sabDefined) ? this._wasmPThreadLib : this._wasmSimdLib,
            (sabDefined) ? createModulePThread : createModuleSimd,
          );
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
      const error = new KoalaErrors.KoalaInvalidArgumentError(
        "The argument 'pcm' must be provided as an Int16Array"
      );
      if (this._processErrorCallback) {
        this._processErrorCallback(error);
      } else {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }

    if (pcm.length !== this.frameLength) {
      const error =
        new KoalaErrors.KoalaInvalidArgumentError(`Koala process requires frames of length ${this.frameLength}.
        Received frame of size ${pcm.length}.`);
      if (this._processErrorCallback) {
        this._processErrorCallback(error);
      } else {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }

    this._processMutex
      .runExclusive(async () => {
        if (this._module === undefined) {
          throw new KoalaErrors.KoalaInvalidStateError(
            'Attempted to call Koala process after release.'
          );
        }

        this._module.HEAP16.set(pcm, this._inputBufferAddress / Int16Array.BYTES_PER_ELEMENT);

        const status = await this._pv_koala_process(
          this._objectAddress,
          this._inputBufferAddress,
          this._outputBufferAddress
        );

        if (status !== PvStatus.SUCCESS) {
          const messageStack = Koala.getMessageStack(
            this._module._pv_get_error_stack,
            this._module._pv_free_error_stack,
            this._messageStackAddressAddressAddress,
            this._messageStackDepthAddress,
            this._module.HEAP32,
            this._module.HEAPU8
          );

          const error = pvStatusToException(
            status,
            'Process failed',
            messageStack
          );
          if (this._processErrorCallback) {
            this._processErrorCallback(error);
          } else {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        }

        const output = this._module.HEAP16.slice(
          this._outputBufferAddress / Int16Array.BYTES_PER_ELEMENT,
          this._outputBufferAddress / Int16Array.BYTES_PER_ELEMENT +
          this.frameLength
        );

        this._processCallback(output);
      })
      .catch((error: any) => {
        if (this._processErrorCallback) {
          this._processErrorCallback(
            pvStatusToException(PvStatus.RUNTIME_ERROR, error.toString())
          );
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
          if (this._module === undefined) {
            throw new KoalaErrors.KoalaInvalidStateError(
              'Attempted to call Koala reset after release.'
            );
          }

          const status = await this._pv_koala_reset(this._objectAddress);
          if (status !== PvStatus.SUCCESS) {
            const messageStack = Koala.getMessageStack(
              this._module._pv_get_error_stack,
              this._module._pv_free_error_stack,
              this._messageStackAddressAddressAddress,
              this._messageStackDepthAddress,
              this._module.HEAP32,
              this._module.HEAPU8
            );

            throw pvStatusToException(status, 'Reset failed', messageStack);
          }
        })
        .then(() => {
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
    if (!this._module) {
      return;
    }

    this._module._pv_koala_delete(this._objectAddress);
    this._module._pv_free(this._inputBufferAddress);
    this._module._pv_free(this._outputBufferAddress);
    this._module._pv_free(this._messageStackAddressAddressAddress);
    this._module._pv_free(this._messageStackDepthAddress);
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

  /**
   * Lists all available devices that Koala can use for inference.
   * Each entry in the list can be the used as the `device` argument for the `.create` method.
   *
   * @returns List of all available devices that Koala can use for inference.
   */
  public static async listAvailableDevices(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      Koala._koalaMutex
        .runExclusive(async () => {
          const isSimd = await simd();
          if (!isSimd) {
            throw new KoalaErrors.KoalaRuntimeError('Unsupported Browser');
          }

          const blob = new Blob(
            [base64ToUint8Array(this._wasmSimdLib)],
            { type: 'application/javascript' }
          );
          const module: KoalaModule = await createModuleSimd({
            mainScriptUrlOrBlob: blob,
            wasmBinary: base64ToUint8Array(this._wasmSimd),
          });

          const hardwareDevicesAddressAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
          if (hardwareDevicesAddressAddress === 0) {
            throw new KoalaErrors.KoalaOutOfMemoryError(
              'malloc failed: Cannot allocate memory for hardwareDevices'
            );
          }

          const numHardwareDevicesAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
          if (numHardwareDevicesAddress === 0) {
            throw new KoalaErrors.KoalaOutOfMemoryError(
              'malloc failed: Cannot allocate memory for numHardwareDevices'
            );
          }

          const status: PvStatus = module._pv_koala_list_hardware_devices(
            hardwareDevicesAddressAddress,
            numHardwareDevicesAddress
          );

          const messageStackDepthAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
          if (!messageStackDepthAddress) {
            throw new KoalaErrors.KoalaOutOfMemoryError(
              'malloc failed: Cannot allocate memory for messageStackDepth'
            );
          }

          const messageStackAddressAddressAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
          if (!messageStackAddressAddressAddress) {
            throw new KoalaErrors.KoalaOutOfMemoryError(
              'malloc failed: Cannot allocate memory messageStack'
            );
          }

          if (status !== PvStatus.SUCCESS) {
            const messageStack = Koala.getMessageStack(
              module._pv_get_error_stack,
              module._pv_free_error_stack,
              messageStackAddressAddressAddress,
              messageStackDepthAddress,
              module.HEAP32,
              module.HEAPU8,
            );
            module._pv_free(messageStackAddressAddressAddress);
            module._pv_free(messageStackDepthAddress);

            throw pvStatusToException(
              status,
              'List devices failed',
              messageStack
            );
          }
          module._pv_free(messageStackAddressAddressAddress);
          module._pv_free(messageStackDepthAddress);

          const numHardwareDevices: number = module.HEAP32[numHardwareDevicesAddress / Int32Array.BYTES_PER_ELEMENT];
          module._pv_free(numHardwareDevicesAddress);

          const hardwareDevicesAddress = module.HEAP32[hardwareDevicesAddressAddress / Int32Array.BYTES_PER_ELEMENT];

          const hardwareDevices: string[] = [];
          for (let i = 0; i < numHardwareDevices; i++) {
            const deviceAddress = module.HEAP32[hardwareDevicesAddress / Int32Array.BYTES_PER_ELEMENT + i];
            hardwareDevices.push(arrayBufferToStringAtIndex(module.HEAPU8, deviceAddress));
          }
          module._pv_koala_free_hardware_devices(
            hardwareDevicesAddress,
            numHardwareDevices
          );
          module._pv_free(hardwareDevicesAddressAddress);

          return hardwareDevices;
        })
        .then((result: string[]) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  private static async initWasm(
    accessKey: string,
    modelPath: string,
    device: string,
    wasmBase64: string,
    wasmLibBase64: string,
    createModuleFunc: any,
  ): Promise<KoalaWasmOutput> {
    const blob = new Blob(
      [base64ToUint8Array(wasmLibBase64)],
      { type: 'application/javascript' }
    );
    const module: KoalaModule = await createModuleFunc({
      mainScriptUrlOrBlob: blob,
      wasmBinary: base64ToUint8Array(wasmBase64),
    });

    const pv_koala_init: pv_koala_init_type = this.wrapAsyncFunction(
      module,
      "pv_koala_init",
      4);
    const pv_koala_process: pv_koala_process_type = this.wrapAsyncFunction(
      module,
      "pv_koala_process",
      3);
    const pv_koala_reset: pv_koala_reset_type = this.wrapAsyncFunction(
      module,
      "pv_koala_reset",
      1);

    const objectAddressAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
    if (objectAddressAddress === 0) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    const accessKeyAddress = module._malloc((accessKey.length + 1) * Uint8Array.BYTES_PER_ELEMENT);
    if (accessKeyAddress === 0) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    for (let i = 0; i < accessKey.length; i++) {
      module.HEAP8[accessKeyAddress + i] = accessKey.charCodeAt(i);
    }
    module.HEAP8[accessKeyAddress + accessKey.length] = 0;

    const modelPathEncoded = new TextEncoder().encode(modelPath);
    const modelPathAddress = module._malloc((modelPathEncoded.length + 1) * Uint8Array.BYTES_PER_ELEMENT);
    if (modelPathAddress === 0) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    module.HEAP8.set(modelPathEncoded, modelPathAddress);
    module.HEAP8[modelPathAddress + modelPathEncoded.length] = 0;

    const deviceAddress = module._malloc((device.length + 1) * Uint8Array.BYTES_PER_ELEMENT);
    if (deviceAddress === 0) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }
    for (let i = 0; i < device.length; i++) {
      module.HEAPU8[deviceAddress + i] = device.charCodeAt(i);
    }
    module.HEAPU8[deviceAddress + device.length] = 0;

    const sdkEncoded = new TextEncoder().encode(this._sdk);
    const sdkAddress = module._malloc((sdkEncoded.length + 1) * Uint8Array.BYTES_PER_ELEMENT);
    if (!sdkAddress) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }
    module.HEAP8.set(sdkEncoded, sdkAddress);
    module.HEAP8[sdkAddress + sdkEncoded.length] = 0;
    module._pv_set_sdk(sdkAddress);

    const messageStackDepthAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
    if (!messageStackDepthAddress) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    const messageStackAddressAddressAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
    if (!messageStackAddressAddressAddress) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    let status = await pv_koala_init(
      accessKeyAddress,
      modelPathAddress,
      deviceAddress,
      objectAddressAddress
    );

    module._pv_free(accessKeyAddress);
    module._pv_free(modelPathAddress);
    module._pv_free(deviceAddress);

    if (status !== PvStatus.SUCCESS) {
      const messageStack = Koala.getMessageStack(
        module._pv_get_error_stack,
        module._pv_free_error_stack,
        messageStackAddressAddressAddress,
        messageStackDepthAddress,
        module.HEAP32,
        module.HEAPU8,
      );

      throw pvStatusToException(status, 'Initialization failed', messageStack);
    }

    const objectAddress = module.HEAP32[objectAddressAddress / Int32Array.BYTES_PER_ELEMENT];
    module._pv_free(objectAddressAddress);

    const delaySampleAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
    if (delaySampleAddress === 0) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    status = module._pv_koala_delay_sample(objectAddress, delaySampleAddress);
    if (status !== PV_STATUS_SUCCESS) {
      const messageStack = Koala.getMessageStack(
        module._pv_get_error_stack,
        module._pv_free_error_stack,
        messageStackAddressAddressAddress,
        messageStackDepthAddress,
        module.HEAP32,
        module.HEAPU8,
      );

      throw pvStatusToException(status, 'Get Koala delay samples failed', messageStack);
    }

    const delaySample = module.HEAP32[delaySampleAddress / Int32Array.BYTES_PER_ELEMENT];
    module._pv_free(delaySampleAddress);

    const frameLength = module._pv_koala_frame_length();
    const sampleRate = module._pv_sample_rate();
    const versionAddress = module._pv_koala_version();

    const version = arrayBufferToStringAtIndex(
      module.HEAPU8,
      versionAddress,
    );

    const inputBufferAddress = module._malloc(frameLength * Int16Array.BYTES_PER_ELEMENT);
    if (inputBufferAddress === 0) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    const outputBufferAddress = module._malloc(frameLength * Int16Array.BYTES_PER_ELEMENT);
    if (outputBufferAddress === 0) {
      throw new KoalaErrors.KoalaOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    return {
      module: module,

      pv_koala_process: pv_koala_process,
      pv_koala_reset: pv_koala_reset,

      delaySample: delaySample,
      frameLength: frameLength,
      sampleRate: sampleRate,
      version: version,

      objectAddress: objectAddress,
      messageStackAddressAddressAddress: messageStackAddressAddressAddress,
      messageStackDepthAddress: messageStackDepthAddress,
      inputBufferAddress: inputBufferAddress,
      outputBufferAddress: outputBufferAddress,
    };
  }

  private static getMessageStack(
    pv_get_error_stack: pv_get_error_stack_type,
    pv_free_error_stack: pv_free_error_stack_type,
    messageStackAddressAddressAddress: number,
    messageStackDepthAddress: number,
    memoryBufferInt32: Int32Array,
    memoryBufferUint8: Uint8Array
  ): string[] {
    const status = pv_get_error_stack(messageStackAddressAddressAddress, messageStackDepthAddress);
    if (status !== PvStatus.SUCCESS) {
      throw new Error(`Unable to get error state: ${status}`);
    }

    const messageStackAddressAddress = memoryBufferInt32[messageStackAddressAddressAddress / Int32Array.BYTES_PER_ELEMENT];

    const messageStackDepth = memoryBufferInt32[messageStackDepthAddress / Int32Array.BYTES_PER_ELEMENT];
    const messageStack: string[] = [];
    for (let i = 0; i < messageStackDepth; i++) {
      const messageStackAddress = memoryBufferInt32[
        (messageStackAddressAddress / Int32Array.BYTES_PER_ELEMENT) + i
      ];
      const message = arrayBufferToStringAtIndex(memoryBufferUint8, messageStackAddress);
      messageStack.push(message);
    }

    pv_free_error_stack(messageStackAddressAddress);

    return messageStack;
  }

  private static wrapAsyncFunction(module: KoalaModule, functionName: string, numArgs: number): (...args: any[]) => any {
    // @ts-ignore
    return module.cwrap(
      functionName,
      "number",
      Array(numArgs).fill("number"),
      { async: true }
    );
  }
}

export default Koala;
