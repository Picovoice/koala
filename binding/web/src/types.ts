/*
  Copyright 2023 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

import { PvModel } from '@picovoice/web-utils';

import { KoalaError } from './koala_errors';

export enum PvStatus {
  SUCCESS = 10000,
  OUT_OF_MEMORY,
  IO_ERROR,
  INVALID_ARGUMENT,
  STOP_ITERATION,
  KEY_ERROR,
  INVALID_STATE,
  RUNTIME_ERROR,
  ACTIVATION_ERROR,
  ACTIVATION_LIMIT_REACHED,
  ACTIVATION_THROTTLED,
  ACTIVATION_REFUSED,
}

/**
 * KoalaModel types
 */
export type KoalaModel = PvModel;

export type KoalaOptions = {
  /** @defaultValue undefined */
  processErrorCallback?: (error: KoalaError) => void;
};

export type KoalaWorkerInitRequest = {
  command: 'init';
  accessKey: string;
  modelPath: string;
  options: KoalaOptions;
  wasm: string;
  wasmSimd: string;
};

export type KoalaWorkerProcessRequest = {
  command: 'process';
  inputFrame: Int16Array;
};

export type KoalaWorkerResetRequest = {
  command: 'reset';
};

export type KoalaWorkerReleaseRequest = {
  command: 'release';
};

export type KoalaWorkerRequest =
  | KoalaWorkerInitRequest
  | KoalaWorkerProcessRequest
  | KoalaWorkerResetRequest
  | KoalaWorkerReleaseRequest;

export type KoalaWorkerFailureResponse = {
  command: 'failed' | 'error';
  status: PvStatus;
  shortMessage: string;
  messageStack: string[];
};

export type KoalaWorkerInitResponse =
  | KoalaWorkerFailureResponse
  | {
      command: 'ok';
      frameLength: number;
      sampleRate: number;
      version: string;
      delaySample: number;
    };

export type KoalaWorkerProcessResponse =
  | KoalaWorkerFailureResponse
  | {
      command: 'ok';
      enhancedPcm: Int16Array;
    };

export type KoalaWorkerResetResponse =
  | KoalaWorkerFailureResponse
  | {
      command: 'ok';
    };

export type KoalaWorkerReleaseResponse =
  | KoalaWorkerFailureResponse
  | {
      command: 'ok';
    };

export type KoalaWorkerResponse =
  | KoalaWorkerInitResponse
  | KoalaWorkerProcessResponse
  | KoalaWorkerResetResponse
  | KoalaWorkerReleaseResponse;
