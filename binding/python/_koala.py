#
#    Copyright 2023 Picovoice Inc.
#
#    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
#    file accompanying this source.
#
#    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
#    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
#    specific language governing permissions and limitations under the License.
#

import os
from ctypes import *
from enum import Enum
from typing import Sequence

import numpy as np
from numpy.typing import NDArray


class KoalaError(Exception):
    pass


class KoalaMemoryError(KoalaError):
    pass


class KoalaIOError(KoalaError):
    pass


class KoalaInvalidArgumentError(KoalaError):
    pass


class KoalaStopIterationError(KoalaError):
    pass


class KoalaKeyError(KoalaError):
    pass


class KoalaInvalidStateError(KoalaError):
    pass


class KoalaRuntimeError(KoalaError):
    pass


class KoalaActivationError(KoalaError):
    pass


class KoalaActivationLimitError(KoalaError):
    pass


class KoalaActivationThrottledError(KoalaError):
    pass


class KoalaActivationRefusedError(KoalaError):
    pass


class Koala(object):
    """
    Python binding for Koala noise-suppression engine.
    """

    class PicovoiceStatuses(Enum):
        SUCCESS = 0
        OUT_OF_MEMORY = 1
        IO_ERROR = 2
        INVALID_ARGUMENT = 3
        STOP_ITERATION = 4
        KEY_ERROR = 5
        INVALID_STATE = 6
        RUNTIME_ERROR = 7
        ACTIVATION_ERROR = 8
        ACTIVATION_LIMIT_REACHED = 9
        ACTIVATION_THROTTLED = 10
        ACTIVATION_REFUSED = 11

    _PICOVOICE_STATUS_TO_EXCEPTION = {
        PicovoiceStatuses.OUT_OF_MEMORY: KoalaMemoryError,
        PicovoiceStatuses.IO_ERROR: KoalaIOError,
        PicovoiceStatuses.INVALID_ARGUMENT: KoalaInvalidArgumentError,
        PicovoiceStatuses.STOP_ITERATION: KoalaStopIterationError,
        PicovoiceStatuses.KEY_ERROR: KoalaKeyError,
        PicovoiceStatuses.INVALID_STATE: KoalaInvalidStateError,
        PicovoiceStatuses.RUNTIME_ERROR: KoalaRuntimeError,
        PicovoiceStatuses.ACTIVATION_ERROR: KoalaActivationError,
        PicovoiceStatuses.ACTIVATION_LIMIT_REACHED: KoalaActivationLimitError,
        PicovoiceStatuses.ACTIVATION_THROTTLED: KoalaActivationThrottledError,
        PicovoiceStatuses.ACTIVATION_REFUSED: KoalaActivationRefusedError
    }

    class CKoala(Structure):
        pass

    def __init__(
            self,
            access_key: str,
            model_path: str,
            library_path: str) -> None:
        """
        Constructor.

        :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
        :param model_path: Absolute path to the file containing model parameters.
        :param library_path: Absolute path to Koala's dynamic library.
        """

        if not isinstance(access_key, str) or len(access_key) == 0:
            raise KoalaInvalidArgumentError("`access_key` should be a non-empty string.")

        if not os.path.exists(model_path):
            raise KoalaIOError("Could not find model file at `%s`." % model_path)

        if not os.path.exists(library_path):
            raise KoalaIOError("Could not find Koala's dynamic library at `%s`." % library_path)

        library = cdll.LoadLibrary(library_path)

        init_func = library.pv_koala_init
        init_func.argtypes = [c_char_p, c_char_p, POINTER(POINTER(self.CKoala))]
        init_func.restype = self.PicovoiceStatuses

        self._handle = POINTER(self.CKoala)()

        status = init_func(access_key.encode(), model_path.encode(), byref(self._handle))
        if status is not self.PicovoiceStatuses.SUCCESS:
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status]()

        self._delete_func = library.pv_koala_delete
        self._delete_func.argtypes = [POINTER(self.CKoala)]
        self._delete_func.restype = None

        delay_sample_func = library.pv_koala_delay_sample
        delay_sample_func.argtypes = [POINTER(self.CKoala), POINTER(c_int32)]
        delay_sample_func.restype = self.PicovoiceStatuses
        delay_sample = c_int32()
        status = delay_sample_func(self._handle, delay_sample)
        if status is not self.PicovoiceStatuses.SUCCESS:
            self.delete()
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status]()
        self._delay_sample = delay_sample.value

        self._process_func = library.pv_koala_process
        self._process_func.argtypes = [
            POINTER(self.CKoala),
            POINTER(c_short),
            POINTER(c_short),
        ]
        self._process_func.restype = self.PicovoiceStatuses

        self._reset_func = library.pv_koala_reset
        self._reset_func.argtypes = [POINTER(self.CKoala)]
        self._reset_func.restype = self.PicovoiceStatuses

        self._sample_rate = library.pv_sample_rate()

        self._frame_length = library.pv_koala_frame_length()

        version_func = library.pv_koala_version
        version_func.argtypes = []
        version_func.restype = c_char_p
        self._version = version_func().decode('utf-8')

        self._pv_free = library.pv_free
        self._pv_free.argtypes = [c_void_p]
        self._pv_free.restype = None

    def process(self, pcm: Sequence[int]) -> NDArray[int]:
        """
        Processes a frame of audio and returns delayed enhanced audio.

        :param pcm: A frame of audio samples. The number of samples per frame can be attained by calling
        `.frame_length`. The incoming audio needs to have a sample rate equal to `.sample_rate` and be 16-bit
        linearly-encoded. Koala operates on single-channel audio. The audio frame must be the one directly after the
        frame that was passed to the last call to `process`, unless `reset` has been called in between.

        :return: A frame of enhanced audio samples, stored in a contiguous `numpy` array with `dtype=np.int16`.
        The output is NOT directly the enhanced version of the input PCM, but corresponds to samples that were given in
        previous calls to `process`. The length of the delay (in samples) can be attained by calling `.delay_sample`.
        """

        if len(pcm) != self.frame_length:
            raise KoalaInvalidArgumentError()

        enhanced_pcm = np.empty(self.frame_length, dtype=np.int16)

        status = self._process_func(
            self._handle,
            (c_short * len(pcm))(*pcm),
            enhanced_pcm.ctypes.data_as(POINTER(c_short)))
        if status is not self.PicovoiceStatuses.SUCCESS:
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status]()

        return enhanced_pcm

    def process_complete(self, pcm: Sequence[int]) -> NDArray[int]:
        """
        Processes a sequence of audio and returns synchronized enhanced audio.
        This is a convenience function that adds padding to the input audio, divides it into frames, calls `.process()`
        on each frame, concatenates and synchronizes the output by removing the delay, and finally calls `.reset()`.

        :param pcm: A sequence of audio samples of arbitrary length. The incoming audio needs to have a sample rate
        equal to `.sample_rate` and be 16-bit linearly-encoded. Koala operates on single-channel audio.

        :return: A frame of enhanced audio samples, stored in a contiguous `numpy` array with `dtype=np.int16`.
        Its length is identical to the
        """
        input_length = len(pcm)
        start_sample = 0
        output_frames = []
        while start_sample < input_length + self.delay_sample:
            end_sample = start_sample + self.frame_length
            if end_sample <= input_length:
                input_frame = pcm[start_sample:end_sample]
            else:
                input_frame = np.zeros(self.frame_length, dtype=np.int16)
                if start_sample < input_length:
                    input_frame[:input_length - start_sample] = pcm[start_sample:]

            output_frame = self.process(input_frame)

            if end_sample > self._delay_sample:
                if end_sample > input_length + self.delay_sample:
                    output_frame = output_frame[:input_length + self.delay_sample - start_sample]
                if start_sample < self.delay_sample:
                    output_frame = output_frame[self.delay_sample - start_sample:]
                output_frames.append(output_frame)

            start_sample = end_sample

        self.reset()
        return np.concatenate(output_frames)

    def reset(self) -> None:
        """
        Resets Koala into a state as if it had just been newly created.
        Call this function in between calls to `process` that do not refer to back-to-back frames of audio.
        """

        status = self._reset_func(self._handle)
        if status is not self.PicovoiceStatuses.SUCCESS:
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status]()

    def delete(self) -> None:
        """Releases resources acquired by Koala."""

        self._delete_func(self._handle)

    @property
    def sample_rate(self) -> int:
        """Audio sample rate accepted by `.process`."""

        return self._sample_rate

    @property
    def frame_length(self) -> int:
        """Number of audio samples per frame expected by `.process`."""

        return self._frame_length

    @property
    def delay_sample(self) -> int:
        """
        Delay in samples. If the input and output of sequential calls to `pv_koala_process` are viewed as two
        contiguous streams of audio data, this delay specifies the time shift between the input and output stream."""

        return self._delay_sample

    @property
    def version(self) -> str:
        """Version."""

        return self._version


__all__ = [
    'Koala',
    'KoalaActivationError',
    'KoalaActivationLimitError',
    'KoalaActivationRefusedError',
    'KoalaActivationThrottledError',
    'KoalaError',
    'KoalaIOError',
    'KoalaInvalidArgumentError',
    'KoalaInvalidStateError',
    'KoalaKeyError',
    'KoalaMemoryError',
    'KoalaRuntimeError',
    'KoalaStopIterationError',
]
