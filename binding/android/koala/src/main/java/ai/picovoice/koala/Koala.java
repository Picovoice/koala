/*
    Copyright 2023 Picovoice Inc.
    You may not use this file except in compliance with the license. A copy of the license is
    located in the "LICENSE" file accompanying this source.
    Unless required by applicable law or agreed to in writing, software distributed under the
    License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
    express or implied. See the License for the specific language governing permissions and
    limitations under the License.
*/


package ai.picovoice.koala;

import android.content.Context;
import android.content.res.Resources;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Android binding for Koala Noise Suppression engine.
 */
public class Koala {

    private static String defaultModelPath;

    static {
        System.loadLibrary("pv_koala");
    }

    private long handle;

    /**
     * Constructor.
     *
     * @param accessKey                  AccessKey obtained from Picovoice Console
     * @param modelPath                  Absolute path to the file containing Koala model parameters.
     *
     * @throws KoalaException if there is an error while initializing Koala.
     */
    private Koala(String accessKey, String modelPath) throws KoalaException {
        handle = KoalaNative.init(accessKey, modelPath);
    }

    private static void extractPackageResources(Context context) throws KoalaException {
        final Resources resources = context.getResources();

        try {
            defaultModelPath = extractResource(context,
                    resources.openRawResource(R.raw.koala_params),
                    resources.getResourceEntryName(R.raw.koala_params) + ".pv");
        } catch (IOException ex) {
            throw new KoalaIOException(ex);
        }
    }

    private static String extractResource(Context context, InputStream srcFileStream, String dstFilename) throws IOException {
        InputStream is = new BufferedInputStream(srcFileStream, 256);
        OutputStream os = new BufferedOutputStream(context.openFileOutput(dstFilename, Context.MODE_PRIVATE), 256);
        int r;
        while ((r = is.read()) != -1) {
            os.write(r);
        }
        os.flush();

        is.close();
        os.close();
        return new File(context.getFilesDir(), dstFilename).getAbsolutePath();
    }

    /**
     * Releases resources acquired by Koala.
     */
    public void delete() {
        if (handle != 0) {
            KoalaNative.delete(handle);
            handle = 0;
        }
    }

    /**
     * Processes given audio data and returns delayed enhanced audio.
     *
     * @param pcm A frame of audio samples. The number of samples per frame can be attained by
     *            calling {@link #getFrameLength()}. The incoming audio needs to have a sample rate
     *            equal to {@link #getSampleRate()} and be 16-bit linearly-encoded. Koala operates
     *            on single-channel audio. Consecutive calls to {@link #process()} must provide consecutive
     *            frames of audio from the same source, unless {@link #reset()} has been called in between.
     *
     * @return A frame of enhanced audio samples, stored as a sequence of 16-bit linearly-encoded integers.
     *          The output is not directly the enhanced version of the input PCM, but corresponds to samples
     *          that were given in previous calls to {@link #process()}. The delay in samples between the start
     *          time of the input frame and the start time of the output frame can be attained from {@link #delaySample()}.
     *
     * @throws KoalaException if there is an error while processing the audio frame.
     */
    public short[] process(short[] pcm) throws KoalaException {
        if (handle == 0) {
            throw new KoalaInvalidStateException("Attempted to call Koala process after delete.");
        }

        if (pcm == null) {
            throw new KoalaInvalidArgumentException("Passed null frame to Koala process.");
        }

        if (pcm.length != getFrameLength()) {
            throw new KoalaInvalidArgumentException(
                    String.format("Koala process requires frames of length %d. " +
                            "Received frame of size %d.", getFrameLength(), pcm.length));
        }
        return KoalaNative.process(handle, pcm);
    }

    /**
     * Resets Koala into a state as if it had just been newly created.
     * Call this function in between calls to {@link #process()} that do not
     * provide consecutive frames of audio.
     *
     *
     * @throws KoalaException if there is an error while processing the audio frame.
     */
    public void reset() throws KoalaException {
        if (handle == 0) {
            throw new KoalaInvalidStateException("Attempted to call Koala reset after delete.");
        }
        KoalaNative.reset(handle);
    }

    /**
     * Getter for required number of audio samples per frame.
     *
     * @return Required number of audio samples per frame.
     */
    public int getFrameLength() {
        return KoalaNative.getFrameLength();
    }

    /**
     * Getter for required audio sample rate for PCM data.
     *
     * @return Required audio sample rate for PCM data.
     */
    public int getSampleRate() {
        return KoalaNative.getSampleRate();
    }

    /**
     * Getter for Koala version.
     *
     * @return Koala version.
     */
    public String getVersion() {
        return KoalaNative.getVersion();
    }

    /**
     * Getter for Koala delaySample.
     *
     * @return Koala delaySample.
     */
    public int getDelaySample() throws KoalaException {
        return KoalaNative.delaySample(handle);
    }

    public static class Builder {

        private String accessKey = null;
        private String modelPath = null;

        /**
         * Setter for the AccessKey
         *
         * @param accessKey AccessKey obtained from Picovoice Console
         */
        public Builder setAccessKey(String accessKey) {
            this.accessKey = accessKey;
            return this;
        }

        /**
         * Setter for the absolute path to the file containing Koala model parameters.
         *
         * @param modelPath Absolute path to the file containing Koala model parameters.
         */
        public Builder setModelPath(String modelPath) {
            this.modelPath = modelPath;
            return this;
        }

        public Koala build(Context context) throws KoalaException {
            if (accessKey == null || this.accessKey.equals("")) {
                throw new KoalaInvalidArgumentException("No AccessKey was provided to Koala");
            }

            if (modelPath == null) {
                if (defaultModelPath == null) {
                    extractPackageResources(context);
                }
                modelPath = defaultModelPath;
            } else {
                File modelFile = new File(modelPath);
                String modelFilename = modelFile.getName();
                if (!modelFile.exists() && !modelFilename.equals("")) {
                    try {
                        modelPath = extractResource(context,
                                context.getAssets().open(modelPath),
                                modelFilename);
                    } catch (IOException ex) {
                        throw new KoalaIOException(ex);
                    }
                }
            }

            return new Koala(accessKey, modelPath);
        }
    }
}
