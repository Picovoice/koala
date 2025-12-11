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

import os.path
import subprocess
import sys
import unittest


class KoalaCTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls._access_key = sys.argv[1]
        cls._device = sys.argv[2]
        cls._platform = sys.argv[3]
        cls._arch = "" if len(sys.argv) != 5 else sys.argv[4]
        cls._root_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..")

    @staticmethod
    def _get_lib_ext(platform):
        if platform == "windows":
            return "dll"
        elif platform == "mac":
            return "dylib"
        else:
            return "so"

    def _get_model_path(self):
        return os.path.join(self._root_dir, 'lib/common/koala_params.pv')

    def _get_library_file(self):
        if self._platform == "windows":
            if self._arch == "amd64":
                os.environ["PATH"] += os.pathsep + os.path.join(self._root_dir, "lib", "windows", "amd64")

        return os.path.join(
            self._root_dir,
            "lib",
            self._platform,
            self._arch,
            "libpv_koala." + self._get_lib_ext(self._platform)
        )

    def _get_audio_file(self, audio_file_name):
        return os.path.join(self._root_dir, 'resources/audio_samples', audio_file_name)

    def run_koala(self, audio_file_name):
        args = [
            os.path.join(os.path.dirname(__file__), "../build/koala_demo_file"),
            "-a", self._access_key,
            "-l", self._get_library_file(),
            "-m", self._get_model_path(),
            "-y", self._device,
            "-i", self._get_audio_file(audio_file_name),
            "-o", os.path.join(os.path.dirname(__file__), "output.wav"),
        ]
        process = subprocess.Popen(args, stderr=subprocess.PIPE, stdout=subprocess.PIPE)
        stdout, stderr = process.communicate()
        self.assertEqual(process.poll(), 0)
        self.assertEqual(stderr.decode('utf-8'), '')
        self.assertTrue("Real time factor" in stdout.decode('utf-8'))

    def test_koala(self):
        self.run_koala("test.wav")

    def test_list_hardware_devices(self):
        args = [
            os.path.join(os.path.dirname(__file__), "../build/koala_demo_file"),
            "-l", self._get_library_file(),
            "-z"
        ]
        process = subprocess.Popen(args, stderr=subprocess.PIPE, stdout=subprocess.PIPE)
        stdout, stderr = process.communicate()
        self.assertEqual(process.poll(), 0)
        self.assertEqual(stderr.decode('utf-8'), '')


if __name__ == '__main__':
    if len(sys.argv) < 4 or len(sys.argv) > 5:
        print("usage: test_koala_c.py ${AccessKey} ${Device} ${Platform} [${Arch}]")
        exit(1)
    unittest.main(argv=sys.argv[:1])
