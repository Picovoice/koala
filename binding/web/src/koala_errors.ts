//
// Copyright 2023 Picovoice Inc.
//
// You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
// file accompanying this source.
//
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//

import { PvError } from '@picovoice/web-utils';
import { PvStatus } from './types';

class KoalaError extends Error {
  private readonly _status: PvStatus;
  private readonly _shortMessage: string;
  private readonly _messageStack: string[];

  constructor(
    status: PvStatus,
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(KoalaError.errorToString(message, messageStack, pvError));
    this._status = status;
    this.name = 'KoalaError';
    this._shortMessage = message;
    this._messageStack = messageStack;
  }

  get status(): PvStatus {
    return this._status;
  }

  get shortMessage(): string {
    return this._shortMessage;
  }

  get messageStack(): string[] {
    return this._messageStack;
  }

  private static errorToString(
    initial: string,
    messageStack: string[],
    pvError: PvError | null = null
  ): string {
    let msg = initial;

    if (pvError) {
      const pvErrorMessage = pvError.getErrorString();
      if (pvErrorMessage.length > 0) {
        msg += `\nDetails: ${pvErrorMessage}`;
      }
    }

    if (messageStack.length > 0) {
      msg += `: ${messageStack.reduce(
        (acc, value, index) => acc + '\n  [' + index + '] ' + value,
        ''
      )}`;
    }

    return msg;
  }
}

class KoalaOutOfMemoryError extends KoalaError {
  constructor(
    message: string,
    messageStack?: string[],
    pvError: PvError | null = null
  ) {
    super(PvStatus.OUT_OF_MEMORY, message, messageStack, pvError);
    this.name = 'KoalaOutOfMemoryError';
  }
}

class KoalaIOError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.IO_ERROR, message, messageStack, pvError);
    this.name = 'KoalaIOError';
  }
}

class KoalaInvalidArgumentError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.INVALID_ARGUMENT, message, messageStack, pvError);
    this.name = 'KoalaInvalidArgumentError';
  }
}

class KoalaStopIterationError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.STOP_ITERATION, message, messageStack, pvError);
    this.name = 'KoalaStopIterationError';
  }
}

class KoalaKeyError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.KEY_ERROR, message, messageStack, pvError);
    this.name = 'KoalaKeyError';
  }
}

class KoalaInvalidStateError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.INVALID_STATE, message, messageStack, pvError);
    this.name = 'KoalaInvalidStateError';
  }
}

class KoalaRuntimeError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.RUNTIME_ERROR, message, messageStack, pvError);
    this.name = 'KoalaRuntimeError';
  }
}

class KoalaActivationError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.ACTIVATION_ERROR, message, messageStack, pvError);
    this.name = 'KoalaActivationError';
  }
}

class KoalaActivationLimitReachedError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.ACTIVATION_LIMIT_REACHED, message, messageStack, pvError);
    this.name = 'KoalaActivationLimitReachedError';
  }
}

class KoalaActivationThrottledError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.ACTIVATION_THROTTLED, message, messageStack, pvError);
    this.name = 'KoalaActivationThrottledError';
  }
}

class KoalaActivationRefusedError extends KoalaError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.ACTIVATION_REFUSED, message, messageStack, pvError);
    this.name = 'KoalaActivationRefusedError';
  }
}

export {
  KoalaError,
  KoalaOutOfMemoryError,
  KoalaIOError,
  KoalaInvalidArgumentError,
  KoalaStopIterationError,
  KoalaKeyError,
  KoalaInvalidStateError,
  KoalaRuntimeError,
  KoalaActivationError,
  KoalaActivationLimitReachedError,
  KoalaActivationThrottledError,
  KoalaActivationRefusedError,
};

export function pvStatusToException(
  pvStatus: PvStatus,
  errorMessage: string,
  messageStack: string[] = [],
  pvError: PvError | null = null
): KoalaError {
  switch (pvStatus) {
    case PvStatus.OUT_OF_MEMORY:
      return new KoalaOutOfMemoryError(errorMessage, messageStack, pvError);
    case PvStatus.IO_ERROR:
      return new KoalaIOError(errorMessage, messageStack, pvError);
    case PvStatus.INVALID_ARGUMENT:
      return new KoalaInvalidArgumentError(errorMessage, messageStack, pvError);
    case PvStatus.STOP_ITERATION:
      return new KoalaStopIterationError(errorMessage, messageStack, pvError);
    case PvStatus.KEY_ERROR:
      return new KoalaKeyError(errorMessage, messageStack, pvError);
    case PvStatus.INVALID_STATE:
      return new KoalaInvalidStateError(errorMessage, messageStack, pvError);
    case PvStatus.RUNTIME_ERROR:
      return new KoalaRuntimeError(errorMessage, messageStack, pvError);
    case PvStatus.ACTIVATION_ERROR:
      return new KoalaActivationError(errorMessage, messageStack, pvError);
    case PvStatus.ACTIVATION_LIMIT_REACHED:
      return new KoalaActivationLimitReachedError(
        errorMessage,
        messageStack,
        pvError
      );
    case PvStatus.ACTIVATION_THROTTLED:
      return new KoalaActivationThrottledError(
        errorMessage,
        messageStack,
        pvError
      );
    case PvStatus.ACTIVATION_REFUSED:
      return new KoalaActivationRefusedError(
        errorMessage,
        messageStack,
        pvError
      );
    default:
      // eslint-disable-next-line no-console
      console.warn(`Unmapped error code: ${pvStatus}`);
      return new KoalaError(pvStatus, errorMessage);
  }
}
