/*
    Copyright 2023 Picovoice Inc.
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

import com.microsoft.appcenter.espresso.Factory;
import com.microsoft.appcenter.espresso.ReportHelper;

import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import ai.picovoice.koala.Koala;
import ai.picovoice.koala.KoalaException;


@RunWith(AndroidJUnit4.class)
public class KoalaTest {

    @Rule
    public ReportHelper reportHelper = Factory.getReportHelper();
    Context testContext;
    Context appContext;
    AssetManager assetManager;
    String testResourcesPath;

    String accessKey = "";

    @After
    public void TearDown() {
        reportHelper.label("Stopping App");
    }

    @Before
    public void Setup() throws IOException {
        testContext = InstrumentationRegistry.getInstrumentation().getContext();
        appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assetManager = testContext.getAssets();
        extractAssetsRecursively("test_resources");
        testResourcesPath = new File(appContext.getFilesDir(), "test_resources").getAbsolutePath();

        accessKey = appContext.getString(R.string.pvTestingAccessKey);
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
        Koala koala = new Koala.Builder().setAccessKey(accessKey).build(getApplicationContext());

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
    public void testPureSpeech() throws KoalaException, IOException {
        List<Short> testPcm = loadPcm(new File(testResourcesPath, "audio/test.wav"));
        runTest(testPcm, testPcm, 0.02);
    }

    @Test
    public void testPureNoise() throws KoalaException, IOException {
        List<Short> noisePcm = loadPcm(new File(testResourcesPath, "audio/noise.wav"));
        runTest(noisePcm, null, 0.02);
    }

    @Test
    public void testMixed() throws KoalaException, IOException {
        List<Short> testPcm = loadPcm(new File(testResourcesPath, "audio/test.wav"));
        List<Short> noisePcm = loadPcm(new File(testResourcesPath, "audio/noise.wav"));
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
        List<Short> testPcm = loadPcm(new File(testResourcesPath, "audio/test.wav"));

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

    private void extractAssetsRecursively(String path) throws IOException {

        String[] list = assetManager.list(path);
        if (list.length > 0) {
            File outputFile = new File(appContext.getFilesDir(), path);
            if (!outputFile.exists()) {
                outputFile.mkdirs();
            }

            for (String file : list) {
                String filepath = path + "/" + file;
                extractAssetsRecursively(filepath);
            }
        } else {
            extractTestFile(path);
        }
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

    private void extractTestFile(String filepath) throws IOException {

        InputStream is = new BufferedInputStream(assetManager.open(filepath), 256);
        File absPath = new File(appContext.getFilesDir(), filepath);
        OutputStream os = new BufferedOutputStream(new FileOutputStream(absPath), 256);
        int r;
        while ((r = is.read()) != -1) {
            os.write(r);
        }
        os.flush();

        is.close();
        os.close();
    }
}
