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
import struct
import wave

from pvkoala import create, KoalaActivationLimitError
from pvrecorder import PvRecorder


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--access_key',
        required=True,
        help='AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
    parser.add_argument(
        '--output_path',
        required=True,
        help='Absolute path to .wav file where the enhanced recorded audio will be stored')
    parser.add_argument(
        '--library_path',
        help='Absolute path to dynamic library. Default: use the library provided by `pvkoala`')
    parser.add_argument(
        '--model_path',
        help='Absolute path to Koala model. Default: use the model provided by `pvkoala`')
    parser.add_argument('--audio_device_index', type=int, default=-1, help='Index of input audio device')
    parser.add_argument('--show_audio_devices', action='store_true', help='Only list available devices and exit')
    args = parser.parse_args()

    if args.show_audio_devices:
        for index, name in enumerate(PvRecorder.get_audio_devices()):
            print("Device #%d: %s" % (index, name))
        return

    koala = create(
        access_key=args.access_key,
        model_path=args.model_path,
        library_path=args.library_path)

    num_frames = 0
    try:
        print('Koala version : %s' % koala.version)

        recorder = PvRecorder(device_index=args.audio_device_index, frame_length=koala.frame_length)
        recorder.start()

        try:
            with wave.open(args.output_path, 'wb') as f:
                f.setnchannels(1)
                f.setsampwidth(2)
                f.setframerate(koala.sample_rate)

                while True:
                    enhanced_pcm = koala.process(recorder.read())
                    f.writeframes(struct.pack('%dh' % len(enhanced_pcm), *enhanced_pcm))
                    num_frames += 1
        finally:
            recorder.stop()

    except KeyboardInterrupt:
        pass
    except KoalaActivationLimitError:
        print("AccessKey has reached its processing limit.")
    finally:
        if num_frames > 0:
            print("%.2f seconds of audio have been written to %s." % (
                num_frames * koala.frame_length / koala.sample_rate,
                args.output_path))
        koala.delete()


if __name__ == '__main__':
    main()
