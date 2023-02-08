import { Koala } from './koala';
import { KoalaWorker } from './koala_worker';

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

import koalaWasm from '../lib/pv_koala.wasm';
import koalaWasmSimd from '../lib/pv_koala_simd.wasm';

Koala.setWasm(koalaWasm);
Koala.setWasmSimd(koalaWasmSimd);
KoalaWorker.setWasm(koalaWasm);
KoalaWorker.setWasmSimd(koalaWasmSimd);

export {
  Koala,
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
