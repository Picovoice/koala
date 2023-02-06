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

from pvkoala import create, KoalaActivationLimitError
from pvrecorder import PvRecorder


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--access_key', required=True)
    parser.add_argument('--output_path', required=True)
    parser.add_argument('--library_path', default=None)
    parser.add_argument('--model_path', default=None)
    parser.add_argument('--device-index', type=int, default=-1)
    args = parser.parse_args()

    koala = create(
        access_key=args.access_key,
        model_path=args.model_path,
        library_path=args.library_path)

    num_frames = 0
    try:
        print('Koala version : %s' % koala.version)

        recorder = PvRecorder(device_index=args.device_index, frame_length=koala.frame_length)
        recorder.start()

        try:
            with wave.open(args.output_path, 'wb') as f:
                f.setnchannels(1)
                f.setsampwidth(2)
                f.setframerate(koala.sample_rate)

                while True:
                    enhanced_pcm = koala.process(recorder.read())
                    f.writeframes(enhanced_pcm)
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
