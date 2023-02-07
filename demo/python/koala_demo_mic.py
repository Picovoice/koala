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
import contextlib
import math
import struct
import wave

from pvkoala import create, KoalaActivationLimitError
from pvrecorder import PvRecorder

VU_DYNAMIC_RANGE_DB = 50.0
VU_MAX_BAR_LENGTH = 30


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--access_key',
        help='AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
    parser.add_argument(
        '--output_path',
        help='Absolute path to .wav file where the enhanced recorded audio will be stored')
    parser.add_argument(
        '--reference_output_path',
        help='Optional absolute path to .wav file where the original recorded audio will be stored')
    parser.add_argument(
        '--library_path',
        help='Absolute path to dynamic library. Default: using the library provided by `pvkoala`')
    parser.add_argument(
        '--model_path',
        help='Absolute path to Koala model. Default: using the model provided by `pvkoala`')
    parser.add_argument('--audio_device_index', type=int, default=-1, help='Index of input audio device')
    parser.add_argument('--show_audio_devices', action='store_true', help='Only list available devices and exit')
    args = parser.parse_args()

    if args.show_audio_devices:
        for index, name in enumerate(PvRecorder.get_audio_devices()):
            print('Device #%d: %s' % (index, name))
        return

    if args.access_key is None:
        raise ValueError('Missing required argument --access_key')

    if args.output_path is None:
        raise ValueError('Missing required argument --output_path')

    if not args.output_path.lower().endswith('.wav'):
        raise ValueError('Given argument --output_path must have WAV file extension')

    if args.reference_output_path is not None and not args.reference_output_path.lower().endswith('.wav'):
        raise ValueError('Given argument --reference_output_path must have WAV file extension')

    koala = create(
        access_key=args.access_key,
        model_path=args.model_path,
        library_path=args.library_path)

    length_sec = 0.0
    try:
        print('Koala version: %s' % koala.version)

        recorder = PvRecorder(device_index=args.audio_device_index, frame_length=koala.frame_length)
        recorder.start()
        print('Listening... (press Ctrl+C to stop)')

        try:
            with contextlib.ExitStack() as file_stack:
                output_file = file_stack.enter_context(wave.open(args.output_path, 'wb'))
                output_file.setnchannels(1)
                output_file.setsampwidth(2)
                output_file.setframerate(koala.sample_rate)

                reference_file = None
                if args.reference_output_path is not None:
                    reference_file = file_stack.enter_context(wave.open(args.reference_output_path, 'wb'))
                    reference_file.setnchannels(1)
                    reference_file.setsampwidth(2)
                    reference_file.setframerate(koala.sample_rate)

                while True:
                    input_frame = recorder.read()
                    if reference_file is not None:
                        reference_file.writeframes(struct.pack('%dh' % len(input_frame), *input_frame))

                    enhanced_frame = koala.process(input_frame)
                    output_file.writeframes(struct.pack('%dh' % len(enhanced_frame), *enhanced_frame))
                    length_sec += koala.frame_length / koala.sample_rate

                    input_volume = sum((x / 32768.0) ** 2 for x in input_frame) / koala.frame_length
                    input_volume = max(min(1 + 10 * math.log10(input_volume + 1e-10) / VU_DYNAMIC_RANGE_DB, 1), 0)
                    bar_length = int(input_volume * VU_MAX_BAR_LENGTH)
                    print(
                        '\r[%3d%%]%s%s|' % (
                            input_volume * 100,
                            '█' * bar_length,
                            ' ' * (VU_MAX_BAR_LENGTH - bar_length)),
                        end='',
                        flush=True)

        finally:
            recorder.stop()

    except KeyboardInterrupt:
        print()
    except KoalaActivationLimitError:
        print('AccessKey has reached its processing limit.')
    finally:
        if length_sec > 0:
            print('%.2f seconds of audio have been written to %s.' % (length_sec, args.output_path))
            if args.reference_output_path is not None:
                print('Recorded reference has been written to %s.' % args.reference_output_path)

        koala.delete()


if __name__ == '__main__':
    main()
