const audioContext = new AudioContext()
const devicesSelect = document.querySelector('#devices')
const pitchText = document.querySelector('#pitch')
const frequencyText = document.querySelector('#frequency')
const recordButton = document.querySelector('#record')
let audioProcessor, mediaRecorder, sourceStream, recording

navigator.mediaDevices.enumerateDevices().then(devices => {
    const fragment = document.createDocumentFragment()
    devices.forEach(device => {
      if (device.kind === 'audioinput') {
        const option = document.createElement('option')
        option.textContent = device.label
        option.value = device.deviceId
        fragment.appendChild(option)
      }
    })
    devicesSelect.appendChild(fragment)
  
    // Run the event listener on the `<select>` element after the input devices
    // have been populated. This way the record button won't remain disabled at
    // start.
    devicesSelect.dispatchEvent(new Event('change'))
  })

// Runs whenever a different audio input device is selected by the user.
devicesSelect.addEventListener('change', async e => {
    if (e.target.value) {
      if (recording) {
        stop()
      }
  
      // Retrieve the MediaStream for the selected audio input device.
      sourceStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: {
            exact: e.target.value
          }
        }
      })
  
      // Enable the record button if we have obtained a MediaStream.
      recordButton.disabled = !sourceStream
    }
  })

  // Runs when the user clicks the record button.
recordButton.addEventListener('click', () => {
    if (recording) {
      stop()
    } else {
      record()
    }
  })


  function record () {
    recording = true
    recordButton.textContent = 'Stop recording'
  
    if (!audioProcessor) {
      audioProcessor = new Worker('audio-processor.js')
  
      audioProcessor.onmessage = e => {
        if (recording) {
          if (e.data) {
            pitchText.textContent = e.data.key + e.data.octave.toString()
            frequencyText.textContent = e.data.frequency.toFixed(2) + 'Hz'
          } else {
            pitchText.textContent = 'Unknown'
            frequencyText.textContent = ''
          }
        }
      }
    }
  
    mediaRecorder = new MediaRecorder(sourceStream)
  
    mediaRecorder.ondataavailable = async e => {
      if (e.data.size !== 0) {
        // Load the blob.
        const response = await fetch(URL.createObjectURL(data))
        const arrayBuffer = await response.arrayBuffer()
        // Decode the audio.
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        const audioData = audioBuffer.getChannelData(0)
        // Send the audio data to the audio processing worker.
        audioProcessor.postMessage({
          sampleRate: audioBuffer.sampleRate,
          audioData
        })
      }
    }
  
    mediaRecorder.start()
  }  


  function stop () {
    recording = false
    mediaRecorder.stop()
    recordButton.textContent = 'Record'
  }
