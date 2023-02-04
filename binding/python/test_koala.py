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
import argparse
import os
import struct
import sys
import unittest
import wave
from typing import Optional, Sequence

import numpy as np

from _koala import Koala
from _util import default_library_path, default_model_path


class KoalaTestCase(unittest.TestCase):
    ACCESS_KEY: str
    AUDIO_PATH = os.path.join(os.path.dirname(__file__), '../../resources/audio_samples/test.wav')

    pcm: Sequence[int]
    koala: Koala

    @classmethod
    def setUpClass(cls):
        with wave.open(os.path.join(os.path.dirname(__file__), '../../resources/audio_samples/test.wav'), 'rb') as f:
            buffer = f.readframes(f.getnframes())
            cls.pcm = struct.unpack('%dh' % f.getnframes(), buffer)

        cls.koala = Koala(
            access_key=cls.ACCESS_KEY,
            model_path=default_model_path('../..'),
            library_path=default_library_path('../..'))

    def test_frame_length(self) -> None:
        self.assertGreater(self.koala.frame_length, 0)

    def test_delay_sample(self) -> None:
        self.assertGreaterEqual(self.koala.delay_sample, 0)

    @staticmethod
    def _pcm_root_mean_square(pcm: Sequence[int]) -> float:
        return np.sqrt(np.mean(np.square(np.array(pcm) / (2 ** 15))))

    def _run_test(
            self,
            input_pcm: Sequence[int],
            reference_pcm: Optional[Sequence[int]] = None,
            tolerance: float = 0.01) -> None:
        num_samples = len(input_pcm)
        frame_length = self.koala.frame_length
        delay_sample = self.koala.delay_sample

        self.koala.reset()
        for frame_start in range(0, num_samples - frame_length + 1, frame_length):
            enhanced_frame = self.koala.process(input_pcm[frame_start:frame_start + frame_length])

            frame_energy = self._pcm_root_mean_square(enhanced_frame)
            if reference_pcm is None or frame_start < delay_sample:
                energy_deviation = frame_energy
            else:
                reference_frame = reference_pcm[frame_start - delay_sample:frame_start - delay_sample + frame_length]
                energy_deviation = abs(frame_energy - self._pcm_root_mean_square(reference_frame))

            self.assertLess(energy_deviation, tolerance)

    @staticmethod
    def _create_noise(num_samples: int, amplitude: float = 0.05) -> np.ndarray:
        spectrogram = np.random.RandomState(seed=0).randn(num_samples) * amplitude * (2 ** 15)
        return spectrogram.astype(np.int16)

    def test_pure_speech(self) -> None:
        self._run_test(self.pcm, self.pcm, tolerance=0.01)

    def test_pure_noise(self) -> None:
        noise_pcm = self._create_noise(5 * self.koala.sample_rate)
        self._run_test(noise_pcm, tolerance=0.01)

    def test_mixed(self) -> None:
        noisy_pcm = self.pcm + self._create_noise(len(self.pcm), amplitude=0.02)
        self._run_test(noisy_pcm, self.pcm, tolerance=0.02)

    def test_version(self):
        version = self.koala.version
        self.assertIsInstance(version, str)
        self.assertGreater(len(version), 0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--access-key', required=True)
    args = parser.parse_args()

    KoalaTestCase.ACCESS_KEY = args.access_key
    unittest.main(argv=sys.argv[:1])
