//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import SwiftUI

struct ContentView: View {
    @StateObject var viewModel = ViewModel()
    @State var sliderValue: Double = 1.0

    let activeBlue = Color(red: 55 / 255, green: 125 / 255, blue: 1, opacity: 1)
    let dangerRed = Color(red: 1, green: 14 / 255, blue: 14 / 255, opacity: 1)
    let navyBlue = Color(red: 37 / 255, green: 24 / 255, blue: 126 / 255, opacity: 1)

    var body: some View {
        let interactionDisabled = !viewModel.errorMessage.isEmpty || viewModel.state == .INIT

        VStack(spacing: 20) {
            Spacer()
            Spacer()
            Slider(value: $sliderValue) {
                Text("Mix")
                        .font(.body)
                        .foregroundColor(Color.black)
            }
            minimumValueLabel: {
                Text("Original")
                        .font(.body)
                        .foregroundColor(Color.black)
            } maximumValueLabel: {
                Text("Koalafied")
                        .font(.body)
                        .foregroundColor(Color.black)
            }
                    .onChange(of: sliderValue, perform: viewModel.onSliderChange)
                    .opacity(viewModel.state == .TEST ? 1 : 0)
                    .disabled(interactionDisabled || viewModel.state != .TEST)

            Button(action: viewModel.togglePlayback) {
                Text(viewModel.isPlaying ? "STOP" : "PLAY")
                        .font(.title)
                        .background(interactionDisabled ? Color.gray : activeBlue)
                        .foregroundColor(.white)
                        .padding(.horizontal, 35.0)
                        .padding(.vertical, 20.0)
            }
                    .background(
                            Capsule().fill(interactionDisabled ? Color.gray : activeBlue)
                    )
                    .opacity(viewModel.state == .TEST ? 1 : 0)
                    .padding(12)
                    .disabled(interactionDisabled || viewModel.state != .TEST)

            Spacer()
            Spacer()

            if viewModel.state == .RECORD {
                Text(viewModel.isRecording ?
                    String(format: "Recording : %.1fs", viewModel.recordingTimeSec) :
                    "Start by recording some audio in a noisy environment")
                        .padding()
                        .font(.body)
                        .foregroundColor(Color.black)
            } else if viewModel.state == .TEST {
                Text(String(format: "Recorded : %.1fs", viewModel.recordingTimeSec))
                        .padding()
                        .font(.body)
                        .foregroundColor(Color.black)
            } else {
                Text(viewModel.errorMessage)
                        .padding()
                        .foregroundColor(Color.white)
                        .frame(maxWidth: .infinity)
                        .background(dangerRed)
                        .font(.body)
                        .opacity(viewModel.errorMessage.isEmpty ? 0 : 1)
                        .cornerRadius(10)
            }

            Button(action: viewModel.toggleRecording) {
                Text(viewModel.isRecording ? "STOP" : "RECORD")
                        .font(.title)
                        .background(interactionDisabled ? Color.gray : activeBlue)
                        .foregroundColor(.white)
                        .padding(.horizontal, 35.0)
                        .padding(.vertical, 20.0)
            }
                    .background(
                            Capsule().fill(interactionDisabled ? Color.gray : activeBlue)
                    )
                    .padding(12)
                    .disabled(interactionDisabled)
        }
                .onReceive(NotificationCenter.default.publisher(
                    for: UIApplication.willEnterForegroundNotification),
                    perform: { _ in
                        viewModel.initialize()
                    }
                )
                .onReceive(NotificationCenter.default.publisher(
                    for: UIApplication.didEnterBackgroundNotification),
                    perform: { _ in
                        viewModel.destroy()
                    }
                )
                .padding()
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .background(Color.white)

    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
