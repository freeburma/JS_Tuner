/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/




console.log('JS Loaded ...');

window.AudioContext = window.AudioContext || window.webkitAudioContext; 

let audioContext = null; 
let isPlaying = false; 
let sourceNode = null; 
let analyser = null; 
let theBuffer = null; 
let DEBUGCANVAS = null; 
let mediaStreamSource = null; 

let MAX_SIZE = 0; 

let detectorElem, 
    canvasElem, 
    waveCanvas, 
    pitchElem, 
    noteElem, 
    detuneElem, 
    detuneAmount; 


let rafID = null; 
let tracks = null; 
let buflen = 2048; 
let buf = new Float32Array(buflen);  

let noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; 


window.onload = function()
{
    audioContext = new AudioContext(); 


    //// Creating Audio Context 
    MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000)); // Corresponds to a 5kHZ signal

    let request = new XMLHttpRequest(); 
    request.open("GET", "./viper.ogg", true); 
    request.responseType = "arraybuffer"; 
    request.onload = function()
    {
        audioContext.decodeAudioData(request.response, function(buffer)
        {
            theBuffer = buffer; 
        }); // end audioContext.decodeAudioData()
    }// end request.onload() -> ajax 

    request.send();

    detectorElem = document.getElementById('detector'); 
    canvasElem = document.getElementById('output'); 
    DEBUGCANVAS = document.getElementById("waveform"); 

    if (DEBUGCANVAS)
    {
        waveCanvas = DEBUGCANVAS.getContext("2d"); 
        waveCanvas.strokeStyle = black; 
        waveCanvas.lineWidth = 1; 
    }// end if -> DEBUGCANVAS

    pitchElem = document.getElementById('pitch'); 
    noteElem = document.getElementById("note"); 
    detuneElem = document.getElementById("detune"); 
    detuneAmount = document.getElementById("detune_amt"); 

    detectorElem.ondragenter = function() 
    {
        this.classList.add("droptarget"); 

        return false; 
    }// end detectorElem.ondragenter()

    detectorElem.ondragleave = function()
    {
        this.classList.remove("droptarget"); 
        return false; 
    }// end detectorElem.ondragleave()

    detectorElem.ondrop = function(e)
    {
        this.classList.remove("droptarget"); 
        e.preventDefault(); 
        theBuffer = null; 

        let reader = new FileReader(); 
        reader.onload = function(event)
        {
            audioContext.decodeAudioData(event.target.result, function(buffer) 
            {
                theBuffer = buffer; 
            }, 
            function( )
            {
                alert("Error loading!"); 
            }); 
        }// end reader.onload()

        reader.onerror = function(event)
        {
            alert("Error: " + reader.error); 
        }// end reader.onerror()

        reader.readAsArrayBuffer(e.dataTransfer.files[0]); 

        return false; 

    }// end detectorElem.ondrop()

    


}// end window.onload() 

function error() 
{
    alert('Stream generation failed.');
}// end error()

function getUserMedia(dictionary, callback)
{
    try 
    {
        navigator.getUserMedia = navigator.getUserMedia || 
                                    navigator.webkitGetUserMedia || 
                                    navigator.mozGetUserMedia; 

        navigator.getUserMedia(dictionary, callback, error); 

    }
    catch(e)
    {
        alert('getUserMedia threw exception :' + e);
    }// end try - catch()

}// end getUserMedia()

function goStream(stream) 
{
    //// Create an AudioNode from the stream 
    mediaStreamSource = audioContext.createMediaStreamSource(stream); 

    //// Connect it to the destination 
    analyser = audioContext.createAnalyser(); 
    analyser.fftSize = 2048; 
    mediaStreamSource.connect(analyser); 

    //// Updating Pitch
    updatePitch(); 

}// end goStream()

function autoCorrelate(buf, sampleRate)
{
	// Implements the ACF2+ algorithm
    let SIZE = buf.length; 
    let rms = 0; 

    for (let i = 0; i < SIZE; i++)
    {
        let val = buf[i]; 
        rms += val * val; 
    }// end for 

    rms = Math.sqrt(rms / SIZE); 

    if (rms < 0.01) // not enough signal
		return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2; // What is "r" variable 

    for (let i = 0; i < SIZE / 2; i++)
    {
        if (Math.abs(buf[i]) < thres)
        {
            r1 = i; 
            break; 
        }
    }// end for 

    for (let i = 1; i < SIZE / 2; i++)
    {
        if (Math.abs(buf[SIZE - i]) < thres)
        {
            r2 = SIZE - i; 
            break; 
        }
    }// end for 

    buf = buf.slice(r1, r2); 
    SIZE = buf.length; 

    let c = new Array(SIZE).fill(0); 

    for (let i = 0; i < SIZE; i++)
    {
        for (let j = 0; j < SIZE - i; j++)
        {
            c[i] = c[i] + buf[j] * buf[j + i]; 
        }// end for 
    }// end for 

    let d = 0; 

    while (c[d] > c[d + 1]) d++; // end while 

    let maxval = -1, maxpos = -1; 

    for (let i = d; i < SIZE; i++)
    {
        if (c[i] > maxval)
        {
            maxval = c[i]; 
            maxpos = i; 
        }// end if
    }// end for 

    var T0 = maxpos; 

    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]; 
    a = (x1 + x3 - 2 * x2) / 2; 
    b = (x3 - x1) / 2; 

    if (a)
    {
        T0 = T0 - b / (2 * a); 
    }// end if 


    return sampleRate / T0; 

}// end autoCorrelate()


function updatePitch(time) 
{
    let cycles = new Array; 
    analyser.getFloatTimeDomainData(buf); 

    let ac = autoCorrelate(buf, audioContext.sampleRate); 
    // TODO: Paint confidence meter on canvasElem here.

    if (DEBUGCANVAS)
    {
        waveCanvas.clearRect(0, 0, 512, 256); // Clearing Canvas 
        waveCanvas.strokeStyle = "red"; 
        waveCanvas.beginPath(); 

        waveCanvas.moveTo(0, 0); 
        waveCanvas.lineTo(0, 256); 

        waveCanvas.moveTo(128, 0)
        waveCanvas.lineTo(128, 256); 

        waveCanvas.moveTo(256, 0); 
        waveCanvas.lineTo(256, 256); 

        waveCanvas.moveTo(384, 0); 
        waveCanvas.lineTo(384, 256); 

        waveCanvas.moveTo(512, 0); 
        waveCanvas.lineTo(512, 256); 

        waveCanvas.stroke(); 
        waveCanvas.strokeStyle = "black"; 
    
        waveCanvas.beginPath(); 
        waveCanvas.moveTo(0, buf[0]); 

        for (let i = 1; i < 512; i++)
        {
            waveCanvas.lineTo(i, 128 + (buf[i] * 128)); 
        }// end for

        waveCanvas.stroke(); 

    }// end if 

    // ac: is accuracy
    if (ac == -1) // Can't detect the tune
    {

        detectorElem.className = "vague"; 
        pitchElem.innerText = "--"; 
        noteElem.innerText = "-"; 
        detuneElem.className = ""; 
        detuneAmount.innerText = "--"; 
    }
    else 
    {
        detectorElem.className = "confident"; 
        
        pitch = ac; // TODO: might declare "pitch" variable 

        pitchElem.innerText = Math.round(pitch); 

        let note = noteFromPitch(pitch); // Getting note from "noteFromPitch()"
        noteElem.innerHTML = noteStrings[note % 12]; // Getting all 12 nodes from the array 

        let detune = centsOffFromPitch(pitch, note);  // Getting cents range between -50 to +50

        if (detune == 0)
        {
            detuneElem.className = ""; 
            detuneAmount.innerHTML = "--"; 
        }
        else 
        {
            //// TODO: categorizing the Flat and Sharp 
            if (detune < 0)
            {
                detuneElem.className = "flat"; // Flat
            }
            else 
            {
                detuneElem.className = "sharp"; 
            }

            detuneAmount.innerHTML = Math.abs(detune); 
        }// end if 

    }// end if 

    if ( ! window.requestAnimationFrame)
    {
        window.requestAnimationFrame = window.webkitRequestAnimationFrame; 
    }// end if 

    rafID = window.requestAnimationFrame(updatePitch); 

}// end updatePitch()

function noteFromPitch(frequency)
{
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2)); 

    return Math.round(noteNum) + 69; 
}// end noteFromPitch()

function frequencyFromNoteNumber(note)
{
    return 440 * Math.pow(2, (note - 69) / 12); 
}// end frequencyFromNoteNumber()

function centsOffFromPitch(frequency, note)
{
    return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2)); 
}

////==================================================================
//// Toggle functions 
////==================================================================

function toggleOscillator() 
{
    if (isPlaying) 
    {
        // Stop playing and return 
        sourceNode.stop(0); 
        sourceNode = null;
        analyser = null; 
        isPlaying = false; 

        if ( ! window.cancelAnimationFrame )
        {
            window.cancelAnimationFrame = window.webkitCancelAnimationFrame; 
        }// end if 

        window.cancelAnimationFrame(rafID); 

        return "play oscillator"; 

    }// end if -> isPlaying 

    sourceNode = audioContext.createOscillator(); 

    analyser = audioContext.createAnalyser(); 
    analyser.fftSize = 2048; 

    sourceNode.connect(analyser); 
    analyser.connect(audioContext.destination); 

    sourceNode.start(0); 

    isPlaying = true; 
    isLiveInput = false; 

    updatePitch(); 

    return "stop"; 


}// end toggleOscillator()

//// **** This is method i will need for my proj
function toggleLiveInput() 
{
    if (isPlaying) 
    {
        // Stop playing and return 
        sourceNode.stop(0); 
        sourceNode = null;
        analyser = null; 
        isPlaying = false; 

        if ( ! window.cancelAnimationFrame )
        {
            window.cancelAnimationFrame = window.webkitCancelAnimationFrame; 
        }// end if 

        window.cancelAnimationFrame(rafID); 

    }// end if -> isPlaying

    //// Setting up audio 
    getUserMedia(
    {
        "audio": 
        {
            mandatory: 
            {
                "googEchoCancellation": "false",
                "googAutoGainControl": "false",
                "googNoiseSuppression": "false",
                "googHighpassFilter": "false"
            }, 
            "optional": []
        },
    }, goStream); 


}// end toggleLiveInput() 

function togglePlayback() 
{
    if (isPlaying) {
		//stop playing and return
		sourceNode.stop(0);
		sourceNode = null;
		analyser = null;
		isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
		window.cancelAnimationFrame(rafID);
		return "start";
	}// end if 

    sourceNode = audioContext.createBufferSource(); 
    sourceNode.buffer = theBuffer; 
    sourceNode.loop  = true; 

    analyser = audioContext.createAnalyser();
	analyser.fftSize = 2048;

	sourceNode.connect(analyser);
	analyser.connect(audioContext.destination);

	sourceNode.start(0);
	isPlaying = true;
	isLiveInput = false;

	updatePitch();

	return "stop";

}// end togglePlayback() 

