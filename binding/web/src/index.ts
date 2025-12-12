import Koala from './koala';
import { KoalaWorker } from './koala_worker';
import * as KoalaErrors from './koala_errors';

import {
  KoalaModel,
  KoalaOptions,
  KoalaWorkerInitRequest,
  KoalaWorkerProcessRequest,
  KoalaWorkerReleaseRequest,
  KoalaWorkerRequest,
  KoalaWorkerInitResponse,
  KoalaWorkerProcessResponse,
  KoalaWorkerReleaseResponse,
  KoalaWorkerFailureResponse,
  KoalaWorkerResponse,
} from './types';

import koalaWasmSimd from './lib/pv_koala_simd.wasm';
import koalaWasmSimdLib from './lib/pv_koala_simd.txt';
import koalaWasmPThread from './lib/pv_koala_pthread.wasm';
import koalaWasmPThreadLib from './lib/pv_koala_pthread.txt';

Koala.setWasmSimd(koalaWasmSimd);
Koala.setWasmSimdLib(koalaWasmSimdLib);
Koala.setWasmPThread(koalaWasmPThread);
Koala.setWasmPThreadLib(koalaWasmPThreadLib);
KoalaWorker.setWasmSimd(koalaWasmSimd);
KoalaWorker.setWasmSimdLib(koalaWasmSimdLib);
KoalaWorker.setWasmPThread(koalaWasmPThread);
KoalaWorker.setWasmPThreadLib(koalaWasmPThreadLib);

export {
  Koala,
  KoalaErrors,
  KoalaModel,
  KoalaOptions,
  KoalaWorker,
  KoalaWorkerInitRequest,
  KoalaWorkerProcessRequest,
  KoalaWorkerReleaseRequest,
  KoalaWorkerRequest,
  KoalaWorkerInitResponse,
  KoalaWorkerProcessResponse,
  KoalaWorkerReleaseResponse,
  KoalaWorkerFailureResponse,
  KoalaWorkerResponse,
};
