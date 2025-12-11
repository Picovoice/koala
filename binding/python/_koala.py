#
# Copyright 2023-2025 Picovoice Inc.
#
# You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
# file accompanying this source.
#
# Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
# an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#

import os
from ctypes import *
from enum import Enum
from typing import Sequence


class KoalaError(Exception):
    def __init__(self, message: str = '', message_stack: Sequence[str] = None):
        super().__init__(message)

        self._message = message
        self._message_stack = list() if message_stack is None else message_stack

    def __str__(self):
        message = self._message
        if len(self._message_stack) > 0:
            message += ':'
            for i in range(len(self._message_stack)):
                message += '\n  [%d] %s' % (i, self._message_stack[i])
        return message

    @property
    def message(self) -> str:
        return self._message

    @property
    def message_stack(self) -> Sequence[str]:
        return self._message_stack


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
            device: str,
            library_path: str) -> None:
        """
        Constructor.

        :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
        :param model_path: Absolute path to the file containing model parameters.
        :param device: String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
        suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device.
        To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index
        of the target GPU. If set to `cpu`, the engine will run on the CPU with the default number of threads.
        To specify the number of threads, set this argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}`
        is the desired number of threads.
        :param library_path: Absolute path to Koala's dynamic library.
        """

        if not isinstance(access_key, str) or len(access_key) == 0:
            raise KoalaInvalidArgumentError("`access_key` should be a non-empty string.")

        if not os.path.exists(model_path):
            raise KoalaIOError("Could not find model file at `%s`." % model_path)

        if not isinstance(device, str) or len(device) == 0:
            raise FalconInvalidArgumentError("`device` should be a non-empty string.")

        if not os.path.exists(library_path):
            raise KoalaIOError("Could not find Koala's dynamic library at `%s`." % library_path)

        library = cdll.LoadLibrary(library_path)

        set_sdk_func = library.pv_set_sdk
        set_sdk_func.argtypes = [c_char_p]
        set_sdk_func.restype = None

        set_sdk_func('python'.encode('utf-8'))

        self._get_error_stack_func = library.pv_get_error_stack
        self._get_error_stack_func.argtypes = [POINTER(POINTER(c_char_p)), POINTER(c_int)]
        self._get_error_stack_func.restype = self.PicovoiceStatuses

        self._free_error_stack_func = library.pv_free_error_stack
        self._free_error_stack_func.argtypes = [POINTER(c_char_p)]
        self._free_error_stack_func.restype = None

        init_func = library.pv_koala_init
        init_func.argtypes = [c_char_p, c_char_p, c_char_p, POINTER(POINTER(self.CKoala))]
        init_func.restype = self.PicovoiceStatuses

        self._handle = POINTER(self.CKoala)()

        status = init_func(
            access_key.encode(),
            model_path.encode(),
            device.encode(),
            byref(self._handle))
        if status is not self.PicovoiceStatuses.SUCCESS:
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status](
                message='Initialization failed',
                message_stack=self._get_error_stack())

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
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status](
                message='Failed to get delay samples',
                message_stack=self._get_error_stack())

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

    def process(self, pcm: Sequence[int]) -> Sequence[int]:
        """
        Processes a frame of audio and returns delayed enhanced audio.

        :param pcm: A frame of audio samples. The number of samples per frame can be attained by calling
        `.frame_length`. The incoming audio needs to have a sample rate equal to `.sample_rate` and be 16-bit
        linearly-encoded. Koala operates on single-channel audio. Consecutive calls to `.process()` must provide
        consecutive frames of audio from the same source, unless `.reset()` has been called in between.

        :return: A frame of enhanced audio samples, stored as a sequence of 16-bit linearly-encoded integers.
        The output is not directly the enhanced version of the input PCM, but corresponds to samples that were given in
        previous calls to `.process()`. The delay in samples between the start time of the input frame and the start
        time of the output frame can be attained from `.delay_sample`.
        """

        if len(pcm) != self.frame_length:
            raise KoalaInvalidArgumentError(
                "Length of input frame %d does not match required frame length %d" % (len(pcm), self.frame_length))

        frame_type = c_short * self.frame_length
        pcm = frame_type(*pcm)
        enhanced_pcm = frame_type()

        status = self._process_func(self._handle, pcm, enhanced_pcm)
        if status is not self.PicovoiceStatuses.SUCCESS:
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status](
                message='Processing failed',
                message_stack=self._get_error_stack())

        # noinspection PyTypeChecker
        return list(enhanced_pcm)

    def reset(self) -> None:
        """
        Resets Koala into a state as if it had just been newly created.
        Call this function in between calls to `process` that do not provide consecutive frames of audio.
        """

        status = self._reset_func(self._handle)
        if status is not self.PicovoiceStatuses.SUCCESS:
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status](
                message='Reset failed',
                message_stack=self._get_error_stack())

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
        Delay in samples. If the input and output of consecutive calls to `.process()` are viewed as two contiguous
        streams of audio data, this delay specifies the time shift between the input and output stream."""

        return self._delay_sample

    @property
    def version(self) -> str:
        """Version."""

        return self._version

    def _get_error_stack(self) -> Sequence[str]:
        message_stack_ref = POINTER(c_char_p)()
        message_stack_depth = c_int()
        status = self._get_error_stack_func(byref(message_stack_ref), byref(message_stack_depth))
        if status is not self.PicovoiceStatuses.SUCCESS:
            raise self._PICOVOICE_STATUS_TO_EXCEPTION[status](message='Unable to get Koala error state')

        message_stack = list()
        for i in range(message_stack_depth.value):
            message_stack.append(message_stack_ref[i].decode('utf-8'))

        self._free_error_stack_func(message_stack_ref)

        return message_stack


def list_hardware_devices(library_path: str) -> Sequence[str]:
    dll_dir_obj = None
    if hasattr(os, "add_dll_directory"):
        dll_dir_obj = os.add_dll_directory(os.path.dirname(library_path))

    library = cdll.LoadLibrary(library_path)

    if dll_dir_obj is not None:
        dll_dir_obj.close()

    list_hardware_devices_func = library.pv_koala_list_hardware_devices
    list_hardware_devices_func.argtypes = [POINTER(POINTER(c_char_p)), POINTER(c_int32)]
    list_hardware_devices_func.restype = Koala.PicovoiceStatuses
    c_hardware_devices = POINTER(c_char_p)()
    c_num_hardware_devices = c_int32()
    status = list_hardware_devices_func(byref(c_hardware_devices), byref(c_num_hardware_devices))
    if status is not Koala.PicovoiceStatuses.SUCCESS:
        raise _PICOVOICE_STATUS_TO_EXCEPTION[status](message='`pv_koala_list_hardware_devices` failed.')
    res = [c_hardware_devices[i].decode() for i in range(c_num_hardware_devices.value)]

    free_hardware_devices_func = library.pv_koala_free_hardware_devices
    free_hardware_devices_func.argtypes = [POINTER(c_char_p), c_int32]
    free_hardware_devices_func.restype = None
    free_hardware_devices_func(c_hardware_devices, c_num_hardware_devices.value)

    return res


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
    'list_hardware_devices',
]
