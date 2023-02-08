/*
    Copyright 2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is
    located in the "LICENSE" file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the
    License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
    express or implied. See the License for the specific language governing permissions and
    limitations under the License.
*/


package ai.picovoice.koalaactivitydemo;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.Process;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ToggleButton;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import ai.picovoice.koala.*;

public class MainActivity extends AppCompatActivity {
    private final MicrophoneReader microphoneReader = new MicrophoneReader();
    public Koala koala;

    private static final String ACCESS_KEY = "${YOUR_ACCESS_KEY_HERE}";

    private ToggleButton recordButton;
    private TextView detectedText;
    private Needle needleView;

    private CountDownTimer visibilityTimer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.koala_activity_demo);

        recordButton = findViewById(R.id.startButton);
        needleView = findViewById(R.id.needle);
        detectedText = findViewById(R.id.detectedText);

        visibilityTimer = new CountDownTimer(750, 750) {
            @Override
            public void onTick(long l) {
                detectedText.setVisibility(View.VISIBLE);
            }

            @Override
            public void onFinish() {
                detectedText.setVisibility(View.INVISIBLE);
            }
        };

        try {
            koala = new Koala(ACCESS_KEY);
        } catch (KoalaInvalidArgumentException e) {
            onKoalaInitError(String.format("AccessKey '%s' is invalid", ACCESS_KEY));
        } catch (KoalaActivationException e) {
            onKoalaInitError("AccessKey activation error");
        } catch (KoalaActivationLimitException e) {
            onKoalaInitError("AccessKey reached its device limit");
        } catch (KoalaActivationRefusedException e) {
            onKoalaInitError("AccessKey refused");
        } catch (KoalaActivationThrottledException e) {
            onKoalaInitError("AccessKey has been throttled");
        } catch (KoalaException e) {
            onKoalaInitError("Failed to initialize Koala " + e.getMessage());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        koala.delete();
    }

    private void onKoalaInitError(String error){
        TextView errorMessage = findViewById(R.id.errorMessage);
        errorMessage.setText(error);
        errorMessage.setVisibility(View.VISIBLE);

        recordButton.setEnabled(false);
        recordButton.setBackground(ContextCompat.getDrawable(this, R.drawable.button_disabled));
    }

    private void displayError(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private boolean hasRecordPermission() {
        return ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestRecordPermission() {
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 0);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (grantResults.length == 0 || grantResults[0] == PackageManager.PERMISSION_DENIED) {
            ToggleButton toggleButton = findViewById(R.id.startButton);
            toggleButton.toggle();
        } else {
            microphoneReader.start();
        }
    }

    public void onClick(View view) {
        try {
            if (recordButton.isChecked()) {
                if (hasRecordPermission()) {
                    microphoneReader.start();
                } else {
                    requestRecordPermission();
                }
            } else {
                microphoneReader.stop();
            }
        } catch (InterruptedException e) {
            displayError("Audio stop command interrupted\n" + e.getMessage());
        }
    }

    private class MicrophoneReader {
        private final AtomicBoolean started = new AtomicBoolean(false);
        private final AtomicBoolean stop = new AtomicBoolean(false);
        private final AtomicBoolean stopped = new AtomicBoolean(false);

        void start() {

            if (started.get()) {
                return;
            }

            started.set(true);

            Executors.newSingleThreadExecutor().submit((Callable<Void>) () -> {
                Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO);
                read();
                return null;
            });
        }

        void stop() throws InterruptedException {
            if (!started.get()) {
                return;
            }

            stop.set(true);

            while (!stopped.get()) {
                Thread.sleep(10);
            }

            started.set(false);
            stop.set(false);
            stopped.set(false);
        }

        private void read() throws KoalaException {
            final int minBufferSize = AudioRecord.getMinBufferSize(
                    koala.getSampleRate(),
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT);
            final int bufferSize = Math.max(koala.getSampleRate() / 2, minBufferSize);

            AudioRecord audioRecord = null;

            short[] buffer = new short[koala.getFrameLength()];

            try {
                audioRecord = new AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        koala.getSampleRate(),
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufferSize);
                audioRecord.startRecording();

                while (!stop.get()) {
                    if (audioRecord.read(buffer, 0, buffer.length) == buffer.length) {
                        final float voiceProbability = koala.process(buffer);
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                needleView.setValue(voiceProbability);
                                if (needleView.isDetected()) {
                                    visibilityTimer.cancel();
                                    visibilityTimer.start();
                                }
                            }
                        });
                    }
                }

                audioRecord.stop();
            } catch (IllegalArgumentException | IllegalStateException e) {
                throw new KoalaException(e);
            } finally {
                if (audioRecord != null) {
                    audioRecord.release();
                }

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        visibilityTimer.cancel();
                        needleView.reset();
                        detectedText.setVisibility(View.INVISIBLE);
                    }
                });
                stopped.set(true);
            }
        }
    }
}
