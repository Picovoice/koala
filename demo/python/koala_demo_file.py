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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--access_key',
        required=True,
        help='AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
    parser.add_argument(
        '--input_path',
        required=True,
        help='Absolute path to .wav file with the input audio to be enhanced')
    parser.add_argument(
        '--output_path',
        required=True,
        help='Absolute path to .wav file where the enhanced audio will be stored')
    parser.add_argument(
        '--library_path',
        help='Absolute path to dynamic library. Default: use the library provided by `pvkoala`')
    parser.add_argument(
        '--model_path',
        help='Absolute path to Koala model. Default: use the model provided by `pvkoala`')
    args = parser.parse_args()

    koala = create(
        access_key=args.access_key,
        model_path=args.model_path,
        library_path=args.library_path)

    if args.input_path == args.output_path:
        raise ValueError("This demo cannot overwrite its input path")

    try:
        print('Koala version : %s' % koala.version)

        with wave.open(args.input_path, 'rb') as inf:
            if inf.getframerate() != koala.sample_rate:
                raise ValueError(
                    "Invalid sample rate of `%d`. Koala only accepts `%d`" % (inf.getframerate(), koala.sample_rate))
            if inf.getnchannels() != 1:
                raise ValueError("This demo can only process single-channel WAV files")
            if inf.getsampwidth() != 2:
                raise ValueError("This demo can only process WAV files with 16-bit PCM encoding")
            input_length = inf.getnframes()

            with wave.open(args.output_path, 'wb') as outf:
                outf.setnchannels(1)
                outf.setsampwidth(2)
                outf.setframerate(koala.sample_rate)
                outf.setnframes(input_length)

                start_sample = 0
                while start_sample < input_length + koala.delay_sample:
                    end_sample = start_sample + koala.frame_length

                    frame_buffer = inf.readframes(koala.frame_length)
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
                        outf.writeframes(output_frame)

                    start_sample = end_sample

    except KoalaActivationLimitError:
        print("AccessKey has reached its processing limit")
    finally:
        koala.delete()


if __name__ == '__main__':
    main()
