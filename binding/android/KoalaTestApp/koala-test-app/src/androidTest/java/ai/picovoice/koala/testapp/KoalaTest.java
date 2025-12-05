/*
    Copyright 2023-2025 Picovoice Inc.
    You may not use this file except in compliance with the license. A copy of the license is
    located in the "LICENSE" file accompanying this source.
    Unless required by applicable law or agreed to in writing, software distributed under the
    License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
    express or implied. See the License for the specific language governing permissions and
    limitations under the License.
*/

package ai.picovoice.koala.testapp;

import static androidx.test.core.app.ApplicationProvider.getApplicationContext;

import android.content.Context;
import android.content.res.AssetManager;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.ShortBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import ai.picovoice.koala.Koala;
import ai.picovoice.koala.KoalaException;


@RunWith(AndroidJUnit4.class)
public class KoalaTest {

    static Set<String> extractedFiles = new HashSet<>();
    Context testContext;
    Context appContext;
    AssetManager assetManager;
    String testResourcesPath;

    String accessKey = "";
    String device;

    @Before
    public void Setup() throws IOException {
        testContext = InstrumentationRegistry.getInstrumentation().getContext();
        appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assetManager = testContext.getAssets();
        testResourcesPath = new File(appContext.getFilesDir(), "test_resources").getAbsolutePath();

        accessKey = appContext.getString(R.string.pvTestingAccessKey);
        device = appContext.getString(R.string.pvTestingDevice);
    }

    private List<Short> loadPcm(File file) throws IOException {
        FileInputStream inputStream = new FileInputStream(file);
        inputStream.skip(44);

        List<Short> output = new ArrayList<>();

        byte[] buffer = new byte[512 * 2];
        ByteBuffer pcmBuff = ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN);

        while (inputStream.available() > 0) {
            int numRead = inputStream.read(pcmBuff.array());
            ShortBuffer pcmShortBuffer = pcmBuff.asShortBuffer();
            for (int i = 0; i < (numRead / 2); i++) {
                output.add(pcmShortBuffer.get(i));
            }
        }
        return output;
    }

    private double pcmRootMeanSquare(short[] frame) {
        double sumOfSquares = 0;
        for (short x : frame) {
            sumOfSquares += Math.pow((x / 32768f), 2);
        }
        return Math.sqrt((sumOfSquares / frame.length));
    }

    private short[] frameFromList(List<Short> inputList, int start, int count) {
        short[] output = new short[count];
        for (int i = 0; i < count; i++) {
            output[i] = inputList.get(start + i);
        }
        return output;
    }

    private void runTest(List<Short> inputPcm, List<Short> referencePcm, double tolerance) throws KoalaException {
        Koala koala = new Koala.Builder()
                .setAccessKey(accessKey)
                .setDevice(device)
                .build(getApplicationContext());

        for (int i = 0; i < (inputPcm.size() - koala.getFrameLength()); i += koala.getFrameLength()) {
            short[] frame = frameFromList(inputPcm, i, koala.getFrameLength());
            short[] enhancedFrame = koala.process(frame);

            double energyDeviation;
            double enhancedFrameEnergy = pcmRootMeanSquare(enhancedFrame);
            if (referencePcm == null || i < koala.getDelaySample()) {
                energyDeviation = enhancedFrameEnergy;
            } else {
                short[] referenceFrame = frameFromList(
                        referencePcm, i - koala.getDelaySample(),
                        koala.getFrameLength());
                double referenceFrameEnergy = pcmRootMeanSquare(referenceFrame);
                energyDeviation = Math.abs(enhancedFrameEnergy - referenceFrameEnergy);
            }
            assertTrue(energyDeviation < tolerance);
        }
    }

    @Test
    public void testInitFailWithInvalidDevice() {
        boolean didFail = false;
        try {
            new Koala.Builder()
                    .setAccessKey(accessKey)
                    .setDevice("invalid:9")
                    .build(appContext);
        } catch (KoalaException e) {
            didFail = true;
        }

        assertTrue(didFail);
    }

    @Test
    public void testPureSpeech() throws KoalaException, IOException {
        List<Short> testPcm = loadPcm(new File(getAudioFilepath("test.wav")));
        runTest(testPcm, testPcm, 0.02);
    }

    @Test
    public void testPureNoise() throws KoalaException, IOException {
        List<Short> noisePcm = loadPcm(new File(getAudioFilepath("noise.wav")));
        runTest(noisePcm, null, 0.02);
    }

    @Test
    public void testMixed() throws KoalaException, IOException {
        List<Short> testPcm = loadPcm(new File(getAudioFilepath("test.wav")));
        List<Short> noisePcm = loadPcm(new File(getAudioFilepath("noise.wav")));
        List<Short> mixedPcm = new ArrayList<>();
        for (int i = 0; i < testPcm.size(); i++) {
            Short mixed = (short) (testPcm.get(i) + noisePcm.get(i));
            mixedPcm.add(mixed);
        }
        runTest(mixedPcm, testPcm, 0.02);
    }

    @Test
    public void testReset() throws KoalaException, IOException {
        Koala koala = new Koala.Builder().setAccessKey(accessKey).build(getApplicationContext());
        List<Short> testPcm = loadPcm(new File(getAudioFilepath("test.wav")));

        List<short[]> referenceFrames = new ArrayList<>();

        for (int i = 0; i < (testPcm.size() - koala.getFrameLength()); i += koala.getFrameLength()) {
            short[] inputFrame = frameFromList(testPcm, i, koala.getFrameLength());
            referenceFrames.add(koala.process(inputFrame));
        }

        koala.reset();

        for (int i = 0; i < (testPcm.size() - koala.getFrameLength()); i += koala.getFrameLength()) {
            short[] inputFrame = frameFromList(testPcm, i, koala.getFrameLength());
            short[] outputFrame = koala.process(inputFrame);

            short[] referenceFrame = referenceFrames.remove(0);
            for (int j = 0; j < outputFrame.length; j++) {
                assertEquals(outputFrame[j], referenceFrame[j]);
            }
        }
    }

    @Test
    public void testVersion() throws KoalaException {
        Koala koala = new Koala.Builder().setAccessKey(accessKey).build(getApplicationContext());
        assertTrue(koala.getVersion().length() > 0);
    }

    @Test
    public void testErrorStack() {
        String[] error = {};
        try {
            new Koala.Builder()
                    .setAccessKey("invalid")
                    .build(getApplicationContext());
        } catch (KoalaException e) {
            error = e.getMessageStack();
        }

        assertTrue(0 < error.length);
        assertTrue(error.length <= 8);

        try {
            new Koala.Builder()
                    .setAccessKey("invalid")
                    .build(getApplicationContext());
        } catch (KoalaException e) {
            for (int i = 0; i < error.length; i++) {
                assertEquals(e.getMessageStack()[i], error[i]);
            }
        }
    }

    @Test
    public void testGetAvailableDevices() throws KoalaException {
        String[] availableDevices = Koala.getAvailableDevices();
        assertTrue(availableDevices.length > 0);
        for (String d : availableDevices) {
            assertTrue(d != null && d.length() > 0);
        }
    }

    public String getAudioFilepath(String audioFilename) throws IOException {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String resPath = new File(
                context.getFilesDir(),
                "test_resources").getAbsolutePath();
        extractTestFile(String.format("test_resources/audio/%s", audioFilename));
        return new File(resPath, String.format("audio/%s", audioFilename)).getAbsolutePath();
    }

    private void extractTestFile(String filepath) throws IOException {
        File absPath = new File(
                appContext.getFilesDir(),
                filepath);

        if (extractedFiles.contains(filepath)) {
            return;
        }

        if (!absPath.exists()) {
            if (absPath.getParentFile() != null) {
                absPath.getParentFile().mkdirs();
            }
            absPath.createNewFile();
        }

        InputStream is = new BufferedInputStream(
                assetManager.open(filepath),
                256);
        OutputStream os = new BufferedOutputStream(
                new FileOutputStream(absPath),
                256);

        int r;
        while ((r = is.read()) != -1) {
            os.write(r);
        }
        os.flush();

        is.close();
        os.close();

        extractedFiles.add(filepath);

    }
}
