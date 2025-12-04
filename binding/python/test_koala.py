#
#    Copyright 2023-2025 Picovoice Inc.
#
#    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
#    file accompanying this source.
#
#    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
#    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
#    specific language governing permissions and limitations under the License.
#
import argparse
import math
import os
import struct
import sys
import unittest
import wave
from typing import Optional, Sequence

from _koala import (
    Koala,
    KoalaError,
    list_hardware_devices,
)
from _util import (
    default_library_path,
    default_model_path
)


class KoalaTestCase(unittest.TestCase):
    AUDIO_PATH = os.path.join(os.path.dirname(__file__), '../../resources/audio_samples/test.wav')
    NOISE_PATH = os.path.join(os.path.dirname(__file__), '../../resources/audio_samples/noise.wav')

    access_key: str
    device: str
    test_pcm: Sequence[int]
    noise_pcm: Sequence[int]
    koala: Koala

    @staticmethod
    def load_wav_resource(path: str) -> Sequence[int]:
        with wave.open(path, 'rb') as f:
            buffer = f.readframes(f.getnframes())
            return struct.unpack('%dh' % f.getnframes(), buffer)

    @classmethod
    def setUpClass(cls) -> None:
        cls.test_pcm = cls.load_wav_resource(cls.AUDIO_PATH)
        cls.noise_pcm = cls.load_wav_resource(cls.NOISE_PATH)

        cls.koala = Koala(
            access_key=cls.access_key,
            model_path=default_model_path('../..'),
            device=cls.device,
            library_path=default_library_path('../..'))

    def test_frame_length(self) -> None:
        self.assertGreater(self.koala.frame_length, 0)

    def test_delay_sample(self) -> None:
        self.assertGreaterEqual(self.koala.delay_sample, 0)

    @staticmethod
    def _pcm_root_mean_square(pcm: Sequence[int]) -> float:
        sum_of_squares = 0
        for x in pcm:
            sum_of_squares += (x / 32768.0) ** 2
        return math.sqrt(sum_of_squares / len(pcm))

    def _run_test(
            self,
            input_pcm: Sequence[int],
            reference_pcm: Optional[Sequence[int]] = None,
            tolerance: float = 0.02) -> None:
        o = None

        try:
            o = Koala(
                access_key=self.access_key,
                model_path=default_model_path("../../"),
                device=self.device,
                library_path=default_library_path("../../"),
            )

            num_samples = len(input_pcm)
            frame_length = o.frame_length
            delay_sample = o.delay_sample

            for frame_start in range(0, num_samples - frame_length + 1, frame_length):
                enhanced_frame = o.process(input_pcm[frame_start:frame_start + frame_length])

                frame_energy = self._pcm_root_mean_square(enhanced_frame)
                if reference_pcm is None or frame_start < delay_sample:
                    energy_deviation = frame_energy
                else:
                    reference_frame = reference_pcm[frame_start - delay_sample:
                                                    frame_start - delay_sample + frame_length]
                    energy_deviation = abs(frame_energy - self._pcm_root_mean_square(reference_frame))

                self.assertLess(energy_deviation, tolerance)
        finally:
            if o is not None:
                o.delete()

    def test_pure_speech(self) -> None:
        self._run_test(self.test_pcm, self.test_pcm, tolerance=0.02)

    def test_pure_noise(self) -> None:
        self._run_test(self.noise_pcm, tolerance=0.02)

    def test_mixed(self) -> None:
        noisy_pcm = [x + y for x, y in zip(self.test_pcm, self.noise_pcm)]
        self._run_test(noisy_pcm, self.test_pcm, tolerance=0.02)

    def test_reset(self) -> None:
        frame_length = self.koala.frame_length
        reference_frames = []

        self.koala.reset()
        for frame_start in range(0, len(self.test_pcm) - frame_length + 1, frame_length):
            input_frame = self.test_pcm[frame_start:frame_start + frame_length]
            reference_frames.append(self.koala.process(input_frame))

        self.koala.reset()
        for frame_start in range(0, len(self.test_pcm) - frame_length + 1, frame_length):
            input_frame = self.test_pcm[frame_start:frame_start + frame_length]
            output_frame = self.koala.process(input_frame)
            self.assertTrue(all(x == y for x, y in zip(output_frame, reference_frames.pop(0))))

    def test_version(self) -> None:
        version = self.koala.version
        self.assertIsInstance(version, str)
        self.assertGreater(len(version), 0)

    def test_message_stack(self):
        relative_path = '../..'

        error = None
        try:
            k = Koala(
                access_key='invalid',
                model_path=default_model_path(relative_path),
                device=self.device,
                library_path=default_library_path(relative_path))
            self.assertIsNone(k)
        except KoalaError as e:
            error = e.message_stack

        self.assertIsNotNone(error)
        self.assertGreater(len(error), 0)

        try:
            k = Koala(
                access_key='invalid',
                device=self.device,
                model_path=default_model_path(relative_path),
                library_path=default_library_path(relative_path))
            self.assertIsNone(k)
        except KoalaError as e:
            self.assertEqual(len(error), len(e.message_stack))
            self.assertListEqual(list(error), list(e.message_stack))

    def test_process_message_stack(self):
        relative_path = '../..'

        k = Koala(
            access_key=self.access_key,
            device=self.device,
            model_path=default_model_path(relative_path),
            library_path=default_library_path(relative_path))

        test_pcm = [0] * k.frame_length

        address = k._handle
        k._handle = None

        try:
            res = k.process(test_pcm)
            self.assertEqual(len(res), 0)
        except KoalaError as e:
            self.assertGreater(len(e.message_stack), 0)
            self.assertLess(len(e.message_stack), 8)

        k._handle = address

    def test_available_devices(self) -> None:
        res = list_hardware_devices(library_path=default_library_path("../.."))
        self.assertGreater(len(res), 0)
        for x in res:
            self.assertIsInstance(x, str)
            self.assertGreater(len(x), 0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--access-key', required=True)
    parser.add_argument('--device', required=True)
    args = parser.parse_args()

    KoalaTestCase.access_key = args.access_key
    KoalaTestCase.device = args.device
    unittest.main(argv=sys.argv[:1])
