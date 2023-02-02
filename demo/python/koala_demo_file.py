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
import wave

import numpy as np
from pvkoala import create, KoalaActivationLimitError


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--access_key', required=True)
    parser.add_argument('--model_path')
    parser.add_argument('--library_path')
    parser.add_argument('--input_path', required=True)
    parser.add_argument('--output_path', required=True)
    args = parser.parse_args()

    koala = create(
        access_key=args.access_key,
        model_path=args.model_path,
        library_path=args.library_path)

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
                    if end_sample <= input_length:
                        input_frame = np.frombuffer(inf.readframes(koala.frame_length), dtype=np.int16)
                    else:
                        input_frame = np.zeros(koala.frame_length, dtype=np.int16)
                        if start_sample < input_length:
                            input_frame[:input_length - start_sample] = \
                                np.frombuffer(inf.readframes(input_length - start_sample), dtype=np.int16)

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
