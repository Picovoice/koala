/*
    Copyright 2023 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is
    located in the "LICENSE" file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the
    License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
    express or implied. See the License for the specific language governing permissions and
    limitations under the License.
*/


package ai.picovoice.koalaactivitydemo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.view.View;
import android.widget.SeekBar;
import android.widget.SeekBar.OnSeekBarChangeListener;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ToggleButton;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import ai.picovoice.android.voiceprocessor.VoiceProcessor;
import ai.picovoice.android.voiceprocessor.VoiceProcessorException;
import ai.picovoice.koala.Koala;
import ai.picovoice.koala.KoalaActivationException;
import ai.picovoice.koala.KoalaActivationLimitException;
import ai.picovoice.koala.KoalaActivationRefusedException;
import ai.picovoice.koala.KoalaActivationThrottledException;
import ai.picovoice.koala.KoalaException;
import ai.picovoice.koala.KoalaInvalidArgumentException;

public class MainActivity extends AppCompatActivity implements OnSeekBarChangeListener {

    private static final String ACCESS_KEY = "${YOUR_ACCESS_KEY_HERE}";

    private final MicrophoneReader microphoneReader = new MicrophoneReader();
    private Koala koala;

    private ToggleButton recordButton;
    private ToggleButton playStopButton;
    private TextView recordedText;
    private ConstraintLayout playbackArea;

    private String referenceFilepath;
    private String enhancedFilepath;
    private MediaPlayer referenceMediaPlayer;
    private MediaPlayer enhancedMediaPlayer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.koala_activity_demo);

        recordButton = findViewById(R.id.startButton);
        playStopButton = findViewById(R.id.playStopButton);
        recordedText = findViewById(R.id.recordedText);
        playbackArea = findViewById(R.id.playbackArea);

        SeekBar faderSlider = findViewById(R.id.faderSlider);
        faderSlider.setOnSeekBarChangeListener(this);

        recordedText.setText("");
        playbackArea.setVisibility(View.INVISIBLE);

        try {
            koala = new Koala.Builder().setAccessKey(ACCESS_KEY).build(getApplicationContext());
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

        referenceFilepath = getApplicationContext().getFileStreamPath("reference.wav").getAbsolutePath();
        enhancedFilepath = getApplicationContext().getFileStreamPath("enhanced.wav").getAbsolutePath();
        referenceMediaPlayer = new MediaPlayer();
        enhancedMediaPlayer = new MediaPlayer();
        referenceMediaPlayer.setVolume(0, 0);
        enhancedMediaPlayer.setVolume(1, 1);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (referenceMediaPlayer != null) {
            referenceMediaPlayer.release();
        }
        if (enhancedMediaPlayer != null) {
            enhancedMediaPlayer.release();
        }
        koala.delete();
    }

    private void onKoalaInitError(String error) {
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
        return ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED;
    }

    private void requestRecordPermission() {
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 0);
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (grantResults.length == 0 || grantResults[0] == PackageManager.PERMISSION_DENIED) {
            ToggleButton toggleButton = findViewById(R.id.startButton);
            toggleButton.toggle();
        } else {
            try {
                microphoneReader.start();
            } catch (Exception e) {
                displayError(e.toString());
            }
        }
    }

    public void onClickRecord(View view) {
        try {
            if (recordButton.isChecked()) {
                playbackArea.setVisibility(View.INVISIBLE);
                playStopButton.setChecked(false);

                if (referenceMediaPlayer.isPlaying()) {
                    referenceMediaPlayer.stop();
                }
                if (enhancedMediaPlayer.isPlaying()) {
                    enhancedMediaPlayer.stop();
                }

                if (hasRecordPermission()) {
                    try {
                        microphoneReader.start();
                    } catch (Exception e) {
                        displayError(e.toString());
                    }
                } else {
                    requestRecordPermission();
                }
            } else {
                try {
                    microphoneReader.stop();
                } catch (Exception e) {
                    displayError(e.toString());
                }
                resetMediaPlayer(referenceMediaPlayer, referenceFilepath);
                resetMediaPlayer(enhancedMediaPlayer, enhancedFilepath);

                playbackArea.setVisibility(View.VISIBLE);
            }
        } catch (IOException e) {
            displayError("Recording toggle failed\n" + e.getMessage());
        }
    }

    private void resetMediaPlayer(MediaPlayer mediaPlayer, String audioFile) throws IOException {
        mediaPlayer.reset();
        mediaPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
        );
        mediaPlayer.setLooping(true);
        mediaPlayer.setDataSource(audioFile);
        mediaPlayer.prepare();
    }

    public void onClickPlay(View view) {
        if (playStopButton.isChecked()) {
            referenceMediaPlayer.start();
            enhancedMediaPlayer.start();
        } else {
            referenceMediaPlayer.pause();
            enhancedMediaPlayer.pause();
            referenceMediaPlayer.seekTo(0);
            enhancedMediaPlayer.seekTo(0);
        }
    }

    @Override
    public void onStartTrackingTouch(SeekBar seekBar) {
    }

    @Override
    public void onStopTrackingTouch(SeekBar seekBar) {
    }

    @Override
    public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
        if (seekBar.getId() == R.id.faderSlider) {
            float progressFloat = (float) progress;
            float referenceVol = (100f - progressFloat) / 100f;
            float enhancedVol = progressFloat / 100f;

            referenceMediaPlayer.setVolume(referenceVol, referenceVol);
            enhancedMediaPlayer.setVolume(enhancedVol, enhancedVol);
        }
    }

    private class MicrophoneReader {
        private final VoiceProcessor voiceProcessor = VoiceProcessor.getInstance();

        private RandomAccessFile referenceFile;
        private RandomAccessFile enhancedFile;
        private int referenceSamplesWritten;
        private int enhancedSamplesWritten;

        @SuppressLint("DefaultLocale")
        public MicrophoneReader() {
            voiceProcessor.addFrameListener(frame -> {
                synchronized (voiceProcessor) {
                    if (referenceFile == null || enhancedFile == null) {
                        return;
                    }
                    try {
                        final short[] frameBufferEnhanced = koala.process(frame);
                        writeFrame(referenceFile, frame);
                        referenceSamplesWritten += frame.length;
                        if (referenceSamplesWritten >= koala.getDelaySample()) {
                            writeFrame(enhancedFile, frameBufferEnhanced);
                            enhancedSamplesWritten += frameBufferEnhanced.length;
                        }

                        if ((referenceSamplesWritten / koala.getFrameLength()) % 10 == 0) {
                            runOnUiThread(() -> {
                                double secondsRecorded = ((double) (referenceSamplesWritten) /
                                        (double) (koala.getSampleRate()));
                                recordedText.setText(String.format("Recording: %.1fs", secondsRecorded));
                            });
                        }
                    } catch (KoalaException | IOException e) {
                        runOnUiThread(() -> displayError(e.toString()));
                    }
                }
            });
            voiceProcessor.addErrorListener(error -> {
                runOnUiThread(() -> displayError(error.toString()));
            });
        }

        void start() throws IOException, VoiceProcessorException {
            referenceSamplesWritten = 0;
            enhancedSamplesWritten = 0;

            referenceFile = new RandomAccessFile(referenceFilepath, "rws");
            enhancedFile = new RandomAccessFile(enhancedFilepath, "rws");
            writeWavHeader(referenceFile, (short) 1, (short) 16, koala.getSampleRate(), 0);
            writeWavHeader(enhancedFile, (short) 1, (short) 16, koala.getSampleRate(), 0);

            voiceProcessor.start(koala.getFrameLength(), koala.getSampleRate());
        }

        @SuppressLint("DefaultLocale")
        void stop() throws IOException, KoalaException, VoiceProcessorException {
            voiceProcessor.stop();

            runOnUiThread(() -> {
                double secondsRecorded = ((double) (referenceSamplesWritten) / (double) (koala.getSampleRate()));
                recordedText.setText(String.format("Recorded: %.1fs", secondsRecorded));
            });

            synchronized (voiceProcessor) {
                short[] emptyFrame = new short[koala.getFrameLength()];
                Arrays.fill(emptyFrame, (short) 0);
                while (enhancedSamplesWritten < referenceSamplesWritten) {
                    final short[] frameBufferEnhanced = koala.process(emptyFrame);
                    writeFrame(enhancedFile, frameBufferEnhanced);
                    enhancedSamplesWritten += frameBufferEnhanced.length;
                }
                writeWavHeader(referenceFile, (short) 1, (short) 16, koala.getSampleRate(), referenceSamplesWritten);
                writeWavHeader(enhancedFile, (short) 1, (short) 16, koala.getSampleRate(), enhancedSamplesWritten);
                referenceFile.close();
                enhancedFile.close();
                referenceFile = null;
                enhancedFile = null;
            }
        }

        private void writeFrame(RandomAccessFile outputFile, short[] frame) throws IOException {
            ByteBuffer byteBuf = ByteBuffer.allocate(2 * frame.length);
            byteBuf.order(ByteOrder.LITTLE_ENDIAN);

            for (short s : frame) {
                byteBuf.putShort(s);
            }
            outputFile.write(byteBuf.array());
        }

        private void writeWavHeader(
                RandomAccessFile outputFile,
                short channelCount,
                short bitDepth,
                int sampleRate,
                int totalSampleCount
        ) throws IOException {
            int WAV_HEADER_LENGTH = 44;
            ByteBuffer byteBuf = ByteBuffer.allocate(WAV_HEADER_LENGTH);
            byteBuf.order(ByteOrder.LITTLE_ENDIAN);

            byteBuf.put("RIFF".getBytes(StandardCharsets.US_ASCII));
            byteBuf.putInt((bitDepth / 8 * totalSampleCount) + 36);
            byteBuf.put("WAVE".getBytes(StandardCharsets.US_ASCII));
            byteBuf.put("fmt ".getBytes(StandardCharsets.US_ASCII));
            byteBuf.putInt(16);
            byteBuf.putShort((short) 1);
            byteBuf.putShort(channelCount);
            byteBuf.putInt(sampleRate);
            byteBuf.putInt(sampleRate * channelCount * bitDepth / 8);
            byteBuf.putShort((short) (channelCount * bitDepth / 8));
            byteBuf.putShort(bitDepth);
            byteBuf.put("data".getBytes(StandardCharsets.US_ASCII));
            byteBuf.putInt(bitDepth / 8 * totalSampleCount);

            outputFile.seek(0);
            outputFile.write(byteBuf.array());
        }
    }
}
