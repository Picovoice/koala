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
import struct
import wave

from pvkoala import create, available_devices, KoalaActivationLimitError

PROGRESS_BAR_LENGTH = 30


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--access_key',
        help='AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
    parser.add_argument(
        '--input_path',
        help='Absolute path to .wav file with the input audio to be enhanced')
    parser.add_argument(
        '--output_path',
        help='Absolute path to .wav file where the enhanced audio will be stored')
    parser.add_argument(
        '--library_path',
        help='Absolute path to dynamic library. Default: using the library provided by `pvkoala`')
    parser.add_argument(
        '--model_path',
        help='Absolute path to Koala model. Default: using the model provided by `pvkoala`')
    parser.add_argument(
        '--device',
        help='Device to run inference on (`best`, `cpu:{num_threads}` or `gpu:{gpu_index}`). '
             'Default: automatically selects best device for `pvkoala`')
    parser.add_argument(
        '--show_inference_devices',
        action='store_true',
        help='Show the list of available devices for Koala inference and exit')
    args = parser.parse_args()

    if args.show_inference_devices:
        print('\n'.join(available_devices(library_path=args.library_path)))
        return

    if args.access_key is None:
        raise ValueError('Missing required argument --access_key')

    if args.input_path is None:
        raise ValueError('Missing required argument --input_path')

    if args.output_path is None:
        raise ValueError('Missing required argument --output_path')

    if not args.input_path.lower().endswith('.wav'):
        raise ValueError('Given argument --input_path must have WAV file extension')

    if not args.output_path.lower().endswith('.wav'):
        raise ValueError('Given argument --output_path must have WAV file extension')

    if args.input_path == args.output_path:
        raise ValueError('This demo cannot overwrite its input path')

    koala = create(
        access_key=args.access_key,
        model_path=args.model_path,
        device=args.device,
        library_path=args.library_path)

    length_sec = 0.0
    try:
        print('Koala version: %s' % koala.version)

        with wave.open(args.input_path, 'rb') as input_file:
            if input_file.getframerate() != koala.sample_rate:
                raise ValueError('Invalid sample rate of `%d`. Koala only accepts `%d`' % (
                    input_file.getframerate(),
                    koala.sample_rate))
            if input_file.getnchannels() != 1:
                raise ValueError('This demo can only process single-channel WAV files')
            if input_file.getsampwidth() != 2:
                raise ValueError('This demo can only process WAV files with 16-bit PCM encoding')
            input_length = input_file.getnframes()

            with wave.open(args.output_path, 'wb') as output_file:
                output_file.setnchannels(1)
                output_file.setsampwidth(2)
                output_file.setframerate(koala.sample_rate)

                start_sample = 0
                while start_sample < input_length + koala.delay_sample:
                    end_sample = start_sample + koala.frame_length

                    frame_buffer = input_file.readframes(koala.frame_length)
                    num_samples_read = len(frame_buffer) // struct.calcsize('h')
                    input_frame = struct.unpack('%dh' % num_samples_read, frame_buffer)
                    if num_samples_read < koala.frame_length:
                        input_frame = input_frame + (0,) * (koala.frame_length - num_samples_read)

                    output_frame = koala.process(input_frame)

                    if end_sample > koala.delay_sample:
                        if end_sample > input_length + koala.delay_sample:
                            output_frame = output_frame[:input_length + koala.delay_sample - start_sample]
                        if start_sample < koala.delay_sample:
                            output_frame = output_frame[koala.delay_sample - start_sample:]
                        output_file.writeframes(struct.pack('%dh' % len(output_frame), *output_frame))
                        length_sec += len(output_frame) / koala.sample_rate

                    start_sample = end_sample
                    progress = start_sample / (input_length + koala.delay_sample)
                    bar_length = int(progress * PROGRESS_BAR_LENGTH)
                    print(
                        '\r[%3d%%]|%s%s|' % (
                            progress * 100,
                            '#' * bar_length,
                            ' ' * (PROGRESS_BAR_LENGTH - bar_length)),
                        end='',
                        flush=True)

                print()

    except KeyboardInterrupt:
        print()
    except KoalaActivationLimitError:
        print('AccessKey has reached its processing limit')
    finally:
        if length_sec > 0:
            print('%.2f seconds of audio have been written to %s.' % (length_sec, args.output_path))

        koala.delete()


if __name__ == '__main__':
    main()
