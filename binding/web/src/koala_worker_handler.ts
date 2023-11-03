/*
  Copyright 2023 Picovoice Inc.
  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.
  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

/// <reference no-default-lib="false"/>
/// <reference lib="webworker" />

import { Koala } from './koala';
import { KoalaWorkerRequest, KoalaWorkerInitRequest, PvStatus } from './types';
import { KoalaError } from './koala_errors';

let koala: Koala | null = null;

const processCallback = (enhancedPcm: Int16Array): void => {
  self.postMessage({
    command: 'ok-process',
    enhancedPcm: enhancedPcm,
  });
};

const processErrorCallback = (error: KoalaError): void => {
  self.postMessage({
    command: 'error',
    status: error.status,
    shortMessage: error.shortMessage,
    messageStack: error.messageStack,
  });
};

const initRequest = async (request: KoalaWorkerInitRequest): Promise<any> => {
  if (koala !== null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Koala already initialized',
    };
  }
  try {
    Koala.setWasm(request.wasm);
    Koala.setWasmSimd(request.wasmSimd);
    koala = await Koala._init(
      request.accessKey,
      processCallback,
      request.modelPath,
      { ...request.options, processErrorCallback }
    );
    return {
      command: 'ok',
      version: koala.version,
      frameLength: koala.frameLength,
      sampleRate: koala.sampleRate,
      delaySample: koala.delaySample,
    };
  } catch (e: any) {
    if (e instanceof KoalaError) {
      return {
        command: 'error',
        status: e.status,
        shortMessage: e.shortMessage,
        messageStack: e.messageStack,
      };
    }
    return {
      command: 'error',
      status: PvStatus.RUNTIME_ERROR,
      shortMessage: e.message,
    };
  }
};

const resetRequest = async (): Promise<any> => {
  if (koala === null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Koala not initialized',
    };
  }
  try {
    await koala.reset();
    return {
      command: 'ok-reset',
    };
  } catch (e: any) {
    if (e instanceof KoalaError) {
      return {
        command: 'error',
        status: e.status,
        shortMessage: e.shortMessage,
        messageStack: e.messageStack,
      };
    }
    return {
      command: 'error',
      status: PvStatus.RUNTIME_ERROR,
      shortMessage: e.message,
    };
  }
};

const releaseRequest = async (): Promise<any> => {
  if (koala !== null) {
    await koala.release();
    koala = null;
    close();
  }
  return {
    command: 'ok',
  };
};

/**
 * Koala worker handler.
 */
self.onmessage = async function (
  event: MessageEvent<KoalaWorkerRequest>
): Promise<void> {
  switch (event.data.command) {
    case 'init':
      self.postMessage(await initRequest(event.data));
      break;
    case 'process':
      if (koala === null) {
        self.postMessage({
          command: 'error',
          status: PvStatus.INVALID_STATE,
          shortMessage: 'Koala not initialized',
        });
        return;
      }
      await koala.process(event.data.inputFrame);
      break;
    case 'reset':
      self.postMessage(await resetRequest());
      break;
    case 'release':
      self.postMessage(await releaseRequest());
      break;
    default:
      self.postMessage({
        command: 'failed',
        status: PvStatus.RUNTIME_ERROR,
        // @ts-ignore
        shortMessage: `Unrecognized command: ${event.data.command}`,
      });
  }
};
