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
import { KoalaWorkerRequest, PvStatus } from './types';
import { KoalaError } from './koala_errors';

let koala: Koala | null = null;

const processCallback = (enhancedPcm: Int16Array): void => {
  self.postMessage({
    command: 'ok',
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

/**
 * Koala worker handler.
 */
self.onmessage = async function (
  event: MessageEvent<KoalaWorkerRequest>
): Promise<void> {
  switch (event.data.command) {
    case 'init':
      if (koala !== null) {
        self.postMessage({
          command: 'error',
          status: PvStatus.INVALID_STATE,
          shortMessage: 'Koala already initialized',
        });
        return;
      }
      try {
        Koala.setWasm(event.data.wasm);
        Koala.setWasmSimd(event.data.wasmSimd);
        koala = await Koala._init(
          event.data.accessKey,
          processCallback,
          event.data.modelPath,
          { ...event.data.options, processErrorCallback }
        );
        self.postMessage({
          command: 'ok',
          version: koala.version,
          frameLength: koala.frameLength,
          sampleRate: koala.sampleRate,
          delaySample: koala.delaySample,
        });
      } catch (e: any) {
        if (e instanceof KoalaError) {
          self.postMessage({
            command: 'error',
            status: e.status,
            shortMessage: e.shortMessage,
            messageStack: e.messageStack,
          });
        } else {
          self.postMessage({
            command: 'error',
            status: PvStatus.RUNTIME_ERROR,
            shortMessage: e.message,
          });
        }
      }
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
      if (koala === null) {
        self.postMessage({
          command: 'error',
          status: PvStatus.INVALID_STATE,
          shortMessage: 'Koala not initialized',
        });
        return;
      }
      await koala.reset();
      break;
    case 'release':
      if (koala !== null) {
        await koala.release();
        koala = null;
        close();
      }
      self.postMessage({
        command: 'ok',
      });
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
